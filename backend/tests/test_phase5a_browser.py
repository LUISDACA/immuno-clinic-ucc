"""Opt-in real browser flow. Only synthetic local PostgreSQL and a temp Chrome profile."""

import asyncio
import base64
import os
import shutil
import socket
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import httpx
import pytest
import uvicorn
from app.common.enums import Gender, Role
from app.main import app
from app.modules.evidence.models import EvidenceBatch, EvidenceFile
from app.modules.users.models import Profile, User
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from tests.test_phase1_e2e import catalog, login


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.mark.asyncio
@pytest.mark.parametrize("flow", ["phase5a-browser.mjs", "phase5b-theme-browser.mjs"])
@pytest.mark.skipif(
    os.getenv("PHASE5A_BROWSER") != "1", reason="Opt-in real Chrome/Next build required"
)
async def test_browser_comment_review_permissions(
    integration_client, integration_engine, integration_accounts, tmp_path, flow
):
    assert integration_engine.dialect.name == "postgresql"
    root = Path(__file__).resolve().parents[2]
    node = os.environ.get("PHASE5A_NODE") or shutil.which("node")
    chrome = shutil.which("google-chrome")
    assert node and chrome, "Node and Chrome required"
    assert (root / "frontend-next/.next/BUILD_ID").exists(), "Build Next with webpack first"
    await catalog(integration_engine, integration_accounts)
    async with async_sessionmaker(integration_engine)() as db:
        # UI pagination fixtures are synthetic; no additional credential is used.
        for i in range(45):
            user = User(
                email=f"page{i}@example.invalid",
                hashed_password="synthetic-unusable-hash",
                role=Role.STUDENT,
                is_active=True,
                created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            )
            db.add(user)
            await db.flush()
            db.add(
                Profile(
                    user_id=user.id,
                    first_name="Page",
                    last_name=f"Fixture {i:02d}",
                    sex=Gender.FEMALE,
                    program="Medicina",
                    campus="Bogotá",
                    semester=1,
                )
            )
        db.add_all(
            [
                EvidenceBatch(
                    user_id=integration_accounts["student"],
                    created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
                    files=(
                        [
                            EvidenceFile(
                                original_filename=("evidencia_sintetica_" + "x" * 210 + ".pdf"),
                                stored_path=f"synthetic/evidence-{i}.pdf",
                                file_size=1,
                                mime_type="application/pdf",
                                uploaded_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
                            )
                        ]
                        if flow == "phase5b-theme-browser.mjs"
                        else []
                    ),
                )
                for i in range(45)
            ]
        )
        await db.commit()
    student, _ = await login(integration_client, "student", 2)
    admin, _ = await login(integration_client, "admin", 2)
    response = await integration_client.get("/api/v1/scheme/", headers=student)
    dose_id = response.json()["vaccines"][0]["doses"][0]["id"]
    assert (
        await integration_client.put(
            f"/api/v1/admin/doses/{dose_id}/review", headers=admin, json={"status": "in_review"}
        )
    ).status_code == 200
    async with integration_engine.connect() as conn:
        schema = (await conn.execute(text("SELECT current_schema()"))).scalar_one()
    database_url = integration_engine.url.set(drivername="postgresql").render_as_string(
        hide_password=False
    )
    database_url += "?" + urlencode({"options": f"-c search_path={schema}"})
    api_port, web_port, cdp_port = free_port(), free_port(), free_port()
    web = f"http://localhost:{web_port}"
    # Reuse isolated dependency overrides; disable lifespan seeds/background workers.
    server = uvicorn.Server(
        uvicorn.Config(
            app,
            host="127.0.0.1",
            port=api_port,
            lifespan="off",
            access_log=False,
            log_level="error",
        )
    )
    serving = asyncio.create_task(server.serve())
    processes = []

    async def wait_url(url):
        async with httpx.AsyncClient() as client:
            for _ in range(150):
                try:
                    response = await client.get(url)
                    if response.status_code == 200:
                        return
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.1)
        raise AssertionError("Local service failed to start")

    try:
        env = dict(
            os.environ,
            BFF_DATABASE_URL=database_url,
            BFF_SESSION_KEY=base64.b64encode(os.urandom(32)).decode(),
            BFF_ORIGIN=web,
            API_INTERNAL_URL=f"http://127.0.0.1:{api_port}",
            NEXT_TELEMETRY_DISABLED="1",
        )
        next_process = await asyncio.create_subprocess_exec(
            node,
            "node_modules/next/dist/bin/next",
            "start",
            "-p",
            str(web_port),
            "-H",
            "127.0.0.1",
            cwd=root / "frontend-next",
            env=env,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        processes.append(next_process)
        await wait_url(web + "/login")
        chrome_process = await asyncio.create_subprocess_exec(
            chrome,
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--no-first-run",
            "--disable-background-networking",
            "--disable-component-update",
            f"--user-data-dir={tmp_path / 'chrome'}",
            f"--remote-debugging-port={cdp_port}",
            "--remote-debugging-address=127.0.0.1",
            "about:blank",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        processes.append(chrome_process)
        cdp = f"http://127.0.0.1:{cdp_port}"
        await wait_url(cdp + "/json/list")
        runner = await asyncio.create_subprocess_exec(
            node,
            "--experimental-websocket",
            f"tests/e2e/{flow}",
            cwd=root / "frontend-next",
            env=dict(
                env,
                PHASE5A_CDP=cdp,
                PHASE5A_WEB=web,
                PHASE5A_STUDENT=str(integration_accounts["student"]),
                PHASE5A_DOSE=dose_id,
                PHASE5B_ARTIFACT_DIR=str(root / "docs/ui/evidence/phase5b/shared-theme"),
            ),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        processes.append(runner)
        stdout, stderr = await asyncio.wait_for(runner.communicate(), timeout=180)
        assert runner.returncode == 0, stderr.decode()
        assert "PASS:" in stdout.decode()
        response = await integration_client.get("/api/v1/scheme/", headers=student)
        expected = "denied" if flow == "phase5a-browser.mjs" else "in_review"
        assert response.json()["vaccines"][0]["doses"][0]["status"] == expected
    finally:
        for process in reversed(processes):
            if process.returncode is None:
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=5)
                except TimeoutError:
                    process.kill()
                    await process.wait()
        server.should_exit = True
        await serving
