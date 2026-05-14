"""Unit tests for app.core.cache."""

import time
import uuid

import pytest
from cachetools import TTLCache

from app.core import cache as cache_module


@pytest.fixture(autouse=True)
def _clear_cache():
    """Reset the module-level cache before each test."""
    cache_module.student_scheme_cache.clear()
    yield
    cache_module.student_scheme_cache.clear()


def test_invalidate_student_scheme_removes_only_target():
    """Invalidating a single student must not touch other entries."""
    u1 = uuid.uuid4()
    u2 = uuid.uuid4()
    cache_module.student_scheme_cache[u1] = {"vaccines": ["A"]}
    cache_module.student_scheme_cache[u2] = {"vaccines": ["B"]}

    cache_module.invalidate_student_scheme(u1)

    assert u1 not in cache_module.student_scheme_cache
    assert cache_module.student_scheme_cache[u2] == {"vaccines": ["B"]}


def test_invalidate_student_scheme_is_idempotent_when_key_missing():
    """Invalidating an absent key must not raise."""
    missing = uuid.uuid4()
    # Pre-condition: key not present.
    assert missing not in cache_module.student_scheme_cache

    # Should not raise.
    cache_module.invalidate_student_scheme(missing)


def test_invalidate_student_scheme_all_clears_everything():
    """Bulk invalidation must drop every cached scheme."""
    for _ in range(5):
        cache_module.student_scheme_cache[uuid.uuid4()] = {"ok": True}
    assert len(cache_module.student_scheme_cache) == 5

    cache_module.invalidate_student_scheme_all()

    assert len(cache_module.student_scheme_cache) == 0


def test_ttl_expires_entries(monkeypatch):
    """Entries older than the TTL must be evicted on read.

    We replace the module-level cache with a short-TTL instance to avoid
    sleeping for 30 seconds in the test suite.
    """
    short_ttl_cache: TTLCache = TTLCache(maxsize=8, ttl=1)
    monkeypatch.setattr(cache_module, "student_scheme_cache", short_ttl_cache)

    key = uuid.uuid4()
    short_ttl_cache[key] = "value"
    assert short_ttl_cache.get(key) == "value"

    time.sleep(1.1)

    assert short_ttl_cache.get(key) is None
