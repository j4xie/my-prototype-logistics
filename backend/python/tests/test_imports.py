"""CI gate that catches missing-dependency import errors BEFORE prod deploy.

History: the OTA Phase 1 module (PR #363, merged 2026-05-12) added a new
`cryptography` dependency in `ota.services.signing` but the corresponding
`cryptography>=42.0.0` line in `requirements.txt` was omitted. The deploy
ran clean (pip install -r requirements.txt installed the OLD set), then
when the new code hit production the uvicorn workers crashed on import
with `ModuleNotFoundError: No module named 'cryptography'`. Python service
was DOWN ~5 minutes until hot-fix via `pip install cryptography` on the
server. **Every Python endpoint** (analysis_production, analysis_quality,
OTA, chat, smartbi, etc.) returned 5xx during the outage.

These tests run at CI time against `requirements.txt` — they fail loudly
the moment any module main.py imports goes missing from the dep list,
catching the bug before the deploy script even runs.
"""
from __future__ import annotations


def test_main_imports_successfully():
    """The end-all gate: if main.py can't import, no Python endpoint runs.

    This test will surface missing deps (cryptography, etc.), syntax errors,
    circular imports, and any module-level side-effect crashes in any of the
    routers main.py mounts.
    """
    import main  # noqa: F401 — import-only test


def test_ota_module_imports_completely():
    """OTA module specifically — Phase 1 P0 root cause.

    Imports each submodule directly so a regression that splits dependencies
    across files (e.g. cryptography only used in one helper) still triggers
    the test, not just the main.py aggregator.
    """
    from ota.api import endpoints  # noqa: F401
    from ota.services import (  # noqa: F401
        directives,
        manifest_builder,
        multipart,
        signing,
        storage,
    )
    # The specific symbols that caused the 2026-05-12 outage:
    from ota.services.signing import (  # noqa: F401
        sign_rsa_sha256,
        load_private_key_cached,
        sign_with_loaded_key,
        canonicalize_for_signing,
        build_signature_header,
    )
    from ota.models import BundleRef  # noqa: F401
    from ota.config import OTASettings, get_settings  # noqa: F401


def test_cryptography_is_importable():
    """Direct check: cryptography library must be installed.

    Mirrors the failing import in production. If this test fails, the
    requirements.txt is incomplete (which was the root cause of the P0).
    """
    from cryptography.hazmat.primitives import hashes, serialization  # noqa: F401
    from cryptography.hazmat.primitives.asymmetric import padding, rsa  # noqa: F401
