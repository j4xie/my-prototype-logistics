"""Storage layer: filesystem ops for picking the latest update bundle.

Per spec §1 (storage layout) + §6.1 (test plan). Six tests covering:
- list timestamps descending by numeric sort (not lex)
- latest helper picks largest numeric
- 404 raises when no rv dir / no channel dir
- rollback marker detection
- path-traversal rejection on resolve_asset_path
"""
from __future__ import annotations

from pathlib import Path

import pytest

from ota.services import storage


def test_list_timestamps_descending(ota_root: Path):
    rv_channel = ota_root / "updates" / "1.0.0" / "production"
    rv_channel.mkdir(parents=True)
    for ts in ("100", "200", "300"):
        (rv_channel / ts).mkdir()

    result = storage.list_timestamps_descending(rv_channel)

    assert result == ["300", "200", "100"]


def test_latest_returns_largest_numeric_not_lexicographic(ota_root: Path):
    """Lex sort would put '20' after '100'; numeric sort puts '100' first."""
    rv_channel = ota_root / "updates" / "1.0.0" / "production"
    rv_channel.mkdir(parents=True)
    for ts in ("20", "100"):
        (rv_channel / ts).mkdir()

    latest = storage.find_latest_bundle(ota_root, runtime_version="1.0.0", channel="production")

    assert latest.name == "100"


def test_no_dir_for_runtime_raises_404(ota_root: Path):
    with pytest.raises(storage.BundleNotFoundError):
        storage.find_latest_bundle(ota_root, runtime_version="9.9.9", channel="production")


def test_no_dir_for_channel_raises_404(ota_root: Path):
    (ota_root / "updates" / "1.0.0").mkdir(parents=True)  # rv exists, channel doesn't

    with pytest.raises(storage.BundleNotFoundError):
        storage.find_latest_bundle(ota_root, runtime_version="1.0.0", channel="production")


def test_rollback_marker_detected(populated_bundle_dir: Path):
    """A `rollback` file in the bundle dir flips storage.is_rollback() to True."""
    assert storage.is_rollback(populated_bundle_dir) is False

    (populated_bundle_dir / "rollback").touch()

    assert storage.is_rollback(populated_bundle_dir) is True


def test_path_traversal_rejected(ota_root: Path):
    """resolve_asset_path must reject paths escaping the ota_root via ../../."""
    with pytest.raises(storage.UnsafePathError):
        storage.resolve_asset_path(ota_root, "../../etc/passwd")
