"""Pydantic request models for admin endpoints."""
from __future__ import annotations

from pydantic import BaseModel, Field


class BundleRef(BaseModel):
    """Identifies an OTA bundle on disk by (runtimeVersion, channel, timestamp)."""

    runtimeVersion: str = Field(..., description="e.g. '1.0.0'")
    channel: str = Field(..., description="'production' or 'staging'")
    timestamp: str = Field(..., description="millis-since-epoch directory name")
