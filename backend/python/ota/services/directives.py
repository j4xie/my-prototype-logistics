"""Server-emitted directives per Expo Updates v1 protocol §6.

Two directive types are supported on protocol version 1:
- noUpdateAvailable: client is already on the latest update for its runtime
- rollBackToEmbedded: tell the client to revert to the bundle baked into the APK
"""
from __future__ import annotations


def no_update_available() -> dict:
    """Directive emitted when the client's current update == latest server update."""
    return {"type": "noUpdateAvailable"}


def rollback_to_embedded(commit_time_iso: str) -> dict:
    """Directive emitted when the bundle dir contains a `rollback` marker.

    `commit_time_iso` is the ISO-8601 timestamp of the rollback marker file,
    which the client uses to determine whether the rollback is newer than its
    embedded update.
    """
    return {
        "type": "rollBackToEmbedded",
        "parameters": {"commitTime": commit_time_iso},
    }
