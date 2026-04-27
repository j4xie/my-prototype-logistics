"""Shared advisory-lock key derivation for the C field-conflict layer.

Both ``writer.write_provenance`` and ``conflict_resolver.resolve_conflict`` need
to take ``pg_advisory_xact_lock(99, key)`` over the same logical cell key
``(factory_id, entity_type, entity_id, field_name)``. Keeping the key
derivation in one module ensures the two callers compute the identical int4
value — if they ever diverge, the inner lock in ``write_provenance`` would
no longer be reentrant against the outer lock in ``resolve_conflict`` and
the two writers would deadlock instead of serialize.

PG advisory locks are reentrant per (session, namespace, key), so calling
``pg_advisory_xact_lock(99, K)`` twice in the same transaction is a no-op
on the second call (counter increments + decrements normally on COMMIT).
"""
from __future__ import annotations

import hashlib

# Namespace=99 reserved for C field-conflict advisory locks. B uses the 1-arg
# form per-factory (smartbi.canonical.concurrency), so the 2-arg form with
# namespace 99 can't collide with B even if hash keys happen to match.
C_FIELD_LOCK_NAMESPACE = 99


def field_lock_key(
    factory_id: str, entity_type: str, entity_id: int, field_name: str
) -> int:
    """Stable int4 hash for ``pg_advisory_xact_lock`` (signed 32-bit range).

    Uses md5 (not Python's builtin ``hash``) so the key is stable across
    processes and immune to ``PYTHONHASHSEED`` randomization. The ``% 2**31``
    keeps us inside PG's signed int4 range so ``$1::int`` never overflows.

    This is the canonical key for the ``(factory, entity_type, entity_id,
    field_name)`` tuple. ``writer.py`` and ``conflict_resolver.py`` MUST use
    this helper rather than re-implementing the algorithm — divergence would
    silently break lock reentrancy and cause deadlocks under contention.
    """
    payload = f"{factory_id}|{entity_type}|{entity_id}|{field_name}".encode(
        "utf-8"
    )
    return int(hashlib.md5(payload).hexdigest()[:8], 16) % (2**31)
