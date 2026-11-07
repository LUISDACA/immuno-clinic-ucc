"""E2E tests against the FastAPI ASGI app via httpx — HTTP layer, middleware, and auth gates."""

from __future__ import annotations

import asyncio

import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest_asyncio.fixture
async def client(integration_client):
    """Use independent request sessions on SQLite file or opt-in PostgreSQL."""
    yield integration_client


# ── Health check ─────────────────────────────────────────────────────────────


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_returns_200(self, client: AsyncClient):
        response = await client.get("/")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_health_body_has_status_healthy(self, client: AsyncClient):
        response = await client.get("/")
        body = response.json()
        assert body["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_health_body_has_app_name(self, client: AsyncClient):
        response = await client.get("/")
        body = response.json()
        assert "app" in body
        assert isinstance(body["app"], str)

    @pytest.mark.asyncio
    async def test_health_body_has_version(self, client: AsyncClient):
        response = await client.get("/")
        body = response.json()
        assert "version" in body


# ── Request middleware ────────────────────────────────────────────────────────


class TestRequestMiddleware:
    @pytest.mark.asyncio
    async def test_response_includes_request_id_header(self, client: AsyncClient):
        response = await client.get("/")
        assert "x-request-id" in response.headers

    @pytest.mark.asyncio
    async def test_request_id_is_non_empty_string(self, client: AsyncClient):
        response = await client.get("/")
        rid = response.headers.get("x-request-id", "")
        assert rid and len(rid) > 0

    @pytest.mark.asyncio
    async def test_each_request_gets_unique_id(self, client: AsyncClient):
        r1 = await client.get("/")
        r2 = await client.get("/")
        assert r1.headers["x-request-id"] != r2.headers["x-request-id"]

    @pytest.mark.asyncio
    async def test_silent_path_still_gets_id_header(self, client: AsyncClient):
        response = await client.get("/docs")
        # /docs is in _SILENT_PATHS but middleware still attaches the header
        assert "x-request-id" in response.headers


# ── Auth protection ──────────────────────────────────────────────────────────


class TestAuthProtection:
    @pytest.mark.asyncio
    async def test_admin_list_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/admin/students")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_scheme_endpoint_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/scheme/")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_bearer_token_returns_401(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/admin/students",
            headers={"Authorization": "Bearer not.a.valid.jwt"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_admin_export_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/admin/students/export")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_missing_body_returns_422(self, client: AsyncClient):
        response = await client.post("/api/v1/auth/login", data={})
        assert response.status_code == 422


# ── Security headers ─────────────────────────────────────────────────────────


class TestSecurityHeaders:
    @pytest.mark.asyncio
    async def test_x_content_type_options_nosniff(self, client: AsyncClient):
        response = await client.get("/")
        assert response.headers.get("x-content-type-options") == "nosniff"

    @pytest.mark.asyncio
    async def test_x_frame_options_deny(self, client: AsyncClient):
        response = await client.get("/")
        assert response.headers.get("x-frame-options") == "DENY"

    @pytest.mark.asyncio
    async def test_referrer_policy_set(self, client: AsyncClient):
        response = await client.get("/")
        assert "referrer-policy" in response.headers

    @pytest.mark.asyncio
    async def test_content_security_policy_present(self, client: AsyncClient):
        response = await client.get("/")
        assert "content-security-policy" in response.headers

    @pytest.mark.asyncio
    async def test_security_headers_on_api_endpoints(self, client: AsyncClient):
        response = await client.get("/api/v1/admin/students")
        assert response.headers.get("x-content-type-options") == "nosniff"
        assert response.headers.get("x-frame-options") == "DENY"


# ── CORS ─────────────────────────────────────────────────────────────────────


class TestCors:
    @pytest.mark.asyncio
    async def test_cors_header_present_for_allowed_origin(self, client: AsyncClient):
        response = await client.get("/", headers={"Origin": "http://localhost:3000"})
        assert "access-control-allow-origin" in response.headers

    @pytest.mark.asyncio
    async def test_options_preflight_returns_200(self, client: AsyncClient):
        response = await client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code in (200, 204)


# ── Concurrency (light load) ──────────────────────────────────────────────────


class TestConcurrency:
    @pytest.mark.asyncio
    async def test_ten_concurrent_health_requests_all_succeed(self, client: AsyncClient):
        responses = await asyncio.wait_for(
            asyncio.gather(*[client.get("/") for _ in range(10)]), 10
        )
        assert all(r.status_code == 200 for r in responses)

    @pytest.mark.asyncio
    async def test_concurrent_requests_each_get_unique_request_id(self, client: AsyncClient):
        responses = await asyncio.wait_for(asyncio.gather(*[client.get("/") for _ in range(5)]), 10)
        ids = [r.headers.get("x-request-id") for r in responses]
        assert len(set(ids)) == 5, "Each concurrent request must get a distinct request ID"

    @pytest.mark.asyncio
    async def test_concurrent_401_responses_for_missing_auth(self, client: AsyncClient):
        responses = await asyncio.wait_for(
            asyncio.gather(*[client.get("/api/v1/admin/students") for _ in range(8)]), 10
        )
        assert all(r.status_code == 401 for r in responses)
