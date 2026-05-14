"""Tests for the in-memory cache on ``AdminReportService.get_statistics``.

The endpoint runs heavy SQL aggregations, so the result is cached for 60
seconds keyed by (program, campus, semester). These tests verify:

1. A second call with identical scope reuses the cached result and does
   NOT hit the repository again.
2. The cache key is per-(program, campus, semester) — different scopes
   must miss the cache independently.
3. The cache is process-wide and survives across service instances.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import app.modules.admin.reports.service as report_service_module
import pytest
from app.modules.admin.reports.service import AdminReportService


@pytest.fixture(autouse=True)
def _clear_statistics_cache():
    report_service_module._STATISTICS_CACHE.clear()
    yield
    report_service_module._STATISTICS_CACHE.clear()


def _build_service(repo_response: dict):
    """Build an AdminReportService with a mocked repository."""
    repo = MagicMock()
    repo.get_statistics = AsyncMock(return_value=repo_response)
    service = AdminReportService.__new__(AdminReportService)
    service.student_reports = repo
    service.student_csv_exporter = MagicMock()
    return service, repo


def _admin(program: str | None = None, campus: str | None = None):
    """Build a minimal user that ``_scoped_filters`` treats as app-admin (no scope)."""
    from app.common.enums import Role

    return SimpleNamespace(role=Role.APP_ADMIN, program=program, campus=campus)


@pytest.mark.asyncio
async def test_get_statistics_caches_repeated_calls():
    """The second call with identical scope must hit the cache, not the DB."""
    service, repo = _build_service({"total": 42})

    first = await service.get_statistics(_admin(), semester=None)
    second = await service.get_statistics(_admin(), semester=None)

    assert first == {"total": 42}
    assert second == {"total": 42}
    # Repo was only invoked once — second call served from cache.
    assert repo.get_statistics.await_count == 1


@pytest.mark.asyncio
async def test_get_statistics_misses_cache_for_different_semester():
    """Different semester values are independent cache keys."""
    service, repo = _build_service({"total": 0})

    await service.get_statistics(_admin(), semester=1)
    await service.get_statistics(_admin(), semester=2)
    await service.get_statistics(_admin(), semester=1)  # repeat sem=1 → cached

    # Three distinct calls but only two unique scopes → 2 DB hits.
    assert repo.get_statistics.await_count == 2


@pytest.mark.asyncio
async def test_statistics_cache_survives_across_service_instances():
    """The cache lives at module level, so a new service instance reads from the same store."""
    service_a, repo_a = _build_service({"total": 7})
    service_b, repo_b = _build_service({"total": 999})  # different payload, same scope

    await service_a.get_statistics(_admin(), semester=None)
    cached_result = await service_b.get_statistics(_admin(), semester=None)

    # service_b returns whatever service_a put into the module-level cache,
    # NOT the payload its own repository would have returned.
    assert cached_result == {"total": 7}
    assert repo_a.get_statistics.await_count == 1
    assert repo_b.get_statistics.await_count == 0
