"""Pydantic request models for admin endpoints.

Per chat2 audit Critical 2: all three fields flow into filesystem path
concatenation in admin_register / admin_rollback / admin_list, so they must
be validated against the same safe-component regex as the storage layer.
Two layers of defense: Pydantic (returns 422 early) + storage.
_validate_path_component (raises UnsafePathError, caught → 400).
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

# Same pattern as ota.services.storage._VALID_PATH_COMPONENT — kept in sync.
_SAFE_COMPONENT_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]*$"


class BundleRef(BaseModel):
    """Identifies an OTA bundle on disk by (runtimeVersion, channel, timestamp).

    All three fields are path segments and validated identically.
    """

    runtimeVersion: str = Field(..., pattern=_SAFE_COMPONENT_PATTERN, description="e.g. '1.0.0'")
    channel: str = Field(..., pattern=_SAFE_COMPONENT_PATTERN, description="'production' or 'staging'")
    timestamp: str = Field(..., pattern=_SAFE_COMPONENT_PATTERN, description="millis-since-epoch directory name")

    @field_validator("runtimeVersion", "channel", "timestamp")
    @classmethod
    def _reject_dot_aliases(cls, v: str) -> str:
        """Pattern alone allows `.` and `..` since dot is in the char class.
        Explicit reject for defense-in-depth (storage layer also rejects).
        """
        if v in (".", ".."):
            raise ValueError("path component cannot be '.' or '..'")
        return v
