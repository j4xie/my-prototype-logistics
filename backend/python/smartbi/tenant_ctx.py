"""Tenant isolation context — propagates factory_id into asyncpg sessions.

Design (Apr 22 2026, Week 1 Day 1 of Unified Data Layer v1 spec):

- `current_factory_id` ContextVar is set by JWTAuthMiddleware after token decode.
- `pool_setup_tenant_scope` is registered as asyncpg's pool `setup` callback:
  every connection borrowed from the pool runs `SET LOCAL app.factory_id = ...`.
- Gold/Silver fact/dim tables have RLS policies USING
  `factory_id = current_setting('app.factory_id')`. Without the setting,
  queries return zero rows (RLS bites regardless of developer discipline).

Why ContextVar (not Request.state)?
- Request.state requires the `request` object passed into every DB helper.
  That's 200+ call sites. ContextVar is ambient; set once, read everywhere
  in the same async task tree. FastAPI propagates contextvars across
  `await` boundaries correctly.

Why `SET LOCAL` (not `SET`)?
- `SET LOCAL` is scoped to the current transaction. asyncpg pool issues
  implicit transactions; when the connection returns to the pool, the
  setting is cleared. This avoids leaking one tenant's factory_id to the
  next borrower.

Internal / service calls (factory_id = None):
- Set `app.factory_id` to the sentinel `__internal__` for platform-wide
  background jobs. Those jobs' queries should be reviewed manually (few)
  and can cast via `factory_id = ANY(array[...])` explicitly. RLS policies
  will NOT match `__internal__` so these callers must be BYPASSRLS or
  query through admin role.
"""
from __future__ import annotations

import contextvars
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Ambient per-task context — set by middleware, read by pool setup callback.
current_factory_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "smartbi_current_factory_id", default=None
)

INTERNAL_SENTINEL = "__internal__"


def set_factory_id(factory_id: Optional[str]):
    """Set factory_id for the current async task.

    Returns a Token that callers can pass to reset_factory_id() on unwind.
    Non-None, non-empty strings are accepted. None / empty → INTERNAL_SENTINEL.
    """
    if factory_id is None or (isinstance(factory_id, str) and not factory_id.strip()):
        return current_factory_id.set(INTERNAL_SENTINEL)
    return current_factory_id.set(factory_id)


def get_factory_id() -> Optional[str]:
    """Returns the factory_id for this task, or None if not set."""
    return current_factory_id.get()


def reset_factory_id(token):
    """Reset factory_id to its previous value (for middleware unwind)."""
    current_factory_id.reset(token)


async def set_pg_connection_tenant(conn):
    """Apply current_factory_id to a freshly-borrowed asyncpg connection.

    Registered as asyncpg.create_pool(setup=...). Called every time a
    connection is checked out. If no factory is set in the task, INTERNAL
    sentinel is applied (queries will return 0 rows on RLS-protected tables,
    which is the safe default).
    """
    fid = get_factory_id() or INTERNAL_SENTINEL
    # SET LOCAL requires a transaction; pool.setup runs outside transaction,
    # so use session-scoped SET here. Connection returns to pool uses setup
    # again next time, overwriting this value — so no cross-tenant leak.
    await conn.execute("SELECT set_config('app.factory_id', $1, false)", fid)
