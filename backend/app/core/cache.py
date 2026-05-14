"""Process-wide in-memory caches with TTL.

Read-heavy endpoints register their responses here to reduce DB load. Any
write operation that changes the cached state MUST call the matching
``invalidate_*`` helper so subsequent reads see fresh data.

These caches live in the worker process. With multiple Gunicorn workers the
cache is per-worker; if strict cross-worker consistency is required, replace
the backing store with Redis.
"""

from __future__ import annotations

import uuid

from cachetools import TTLCache

# ── Vaccination scheme cache ──────────────────────────────────────────────
# Keyed by student user_id (UUID). TTL is short because admin reviews and
# evidence uploads change the result; writes invalidate explicitly, so the
# TTL only protects against missed invalidations (defense in depth).
student_scheme_cache: TTLCache = TTLCache(maxsize=4096, ttl=30)


def invalidate_student_scheme(user_id: uuid.UUID) -> None:
    """Drop the cached scheme for a single student."""
    student_scheme_cache.pop(user_id, None)


def invalidate_student_scheme_all() -> None:
    """Drop every cached scheme (used by bulk regenerations)."""
    student_scheme_cache.clear()
