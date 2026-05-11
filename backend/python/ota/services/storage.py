"""Filesystem storage layer for OTA bundles.

Layout (see spec §1):
  <ota_root>/updates/<runtimeVersion>/<channel>/<timestamp>/
      metadata.json
      expoConfig.json
      bundles/<launch>.hbc
      assets/<hash>
      [rollback]   (optional marker file)
"""
from __future__ import annotations

import re
from pathlib import Path


class BundleNotFoundError(Exception):
    """Raised when no update bundle exists for the requested (runtime, channel)."""


class UnsafePathError(Exception):
    """Raised when an asset path / path component would escape the OTA root."""


_VALID_PATH_COMPONENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def _validate_path_component(value: str, kind: str) -> None:
    """Validate a single filesystem path segment before it's joined into a Path.

    Per chat2 audit Critical 1: headers (`expo-runtime-version`, `expo-channel-name`)
    and admin request body fields are user-controlled and flow into filesystem paths.
    Reject anything that could enable traversal / hidden-file probing / NUL injection.

    Allowed: `^[A-Za-z0-9][A-Za-z0-9._-]*$` — must start with alphanumeric, then any
    of alphanumerics + dot + underscore + hyphen. Explicitly disallows: `.`, `..`,
    leading dots, slashes/backslashes, NUL, shell metacharacters, whitespace.
    """
    if not isinstance(value, str) or not value:
        raise UnsafePathError(f"Empty {kind} component")
    if value in (".", ".."):
        raise UnsafePathError(f"Invalid {kind} {value!r}: . and .. are reserved")
    if not _VALID_PATH_COMPONENT.fullmatch(value):
        raise UnsafePathError(
            f"Invalid {kind} {value!r}: must match ^[A-Za-z0-9][A-Za-z0-9._-]*$"
        )


def list_timestamps_descending(rv_channel_dir: Path) -> list[str]:
    """Return timestamp subdir names sorted numerically descending.

    Numeric sort (not lexicographic) so that '100' > '20'.
    """
    if not rv_channel_dir.is_dir():
        return []
    timestamps = [p.name for p in rv_channel_dir.iterdir() if p.is_dir()]
    timestamps.sort(key=int, reverse=True)
    return timestamps


def find_latest_bundle(
    ota_root: Path, runtime_version: str, channel: str
) -> Path:
    """Return the latest <timestamp>/ Path for (runtime_version, channel).

    Raises UnsafePathError if either component is malicious (path traversal,
    leading dot, NUL, etc).
    Raises BundleNotFoundError if no matching directory exists.
    """
    _validate_path_component(runtime_version, "runtime_version")
    _validate_path_component(channel, "channel")
    rv_channel = ota_root / "updates" / runtime_version / channel
    timestamps = list_timestamps_descending(rv_channel)
    if not timestamps:
        raise BundleNotFoundError(
            f"No bundle for runtime_version={runtime_version!r} channel={channel!r}"
        )
    return rv_channel / timestamps[0]


def is_rollback(bundle_dir: Path) -> bool:
    """True iff the bundle dir contains a `rollback` marker file."""
    return (bundle_dir / "rollback").is_file()


def resolve_asset_path(ota_root: Path, relative_path: str) -> Path:
    """Resolve a client-supplied relative asset path against ota_root, safely.

    Rejects any path that escapes the ota_root (via .., absolute, symlinks).
    """
    ota_root_abs = ota_root.resolve()
    candidate = (ota_root_abs / relative_path).resolve()
    try:
        candidate.relative_to(ota_root_abs)
    except ValueError as e:
        raise UnsafePathError(
            f"Path {relative_path!r} resolves outside ota_root"
        ) from e
    return candidate
