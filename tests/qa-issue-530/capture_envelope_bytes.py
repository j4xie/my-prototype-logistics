"""Capture the on-wire 401 envelope bytes for issue #530 before/after.

Run from ``backend/python`` so the local sys.path picks up ``auth_middleware``
and ``smartbi_compat``::

    cd backend/python
    python ../../tests/qa-issue-530/capture_envelope_bytes.py

Emits two stanzas to stdout — one for an IN-SCOPE path (issue #530, fixed in
this PR) and one for an OUT-OF-SCOPE sister path (issue #530 leaves these on
the legacy shape so the blast radius matches the issue scope). Each stanza
shows status, raw bytes, byte count, and parsed JSON shape.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Run from repo root or backend/python — handle both.
HERE = Path(__file__).resolve()
PY_ROOT = HERE.parent.parent.parent / "backend" / "python"
sys.path.insert(0, str(PY_ROOT))

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from auth_middleware import JWTAuthMiddleware  # noqa: E402


def _build_client() -> TestClient:
    app = FastAPI()
    app.add_middleware(
        JWTAuthMiddleware,
        jwt_secret="evidence-secret-32-bytes-padding-",
        enabled=True,
    )

    @app.get("/api/mobile/{factory_id}/smart-bi/analysis/{kind}")
    async def _ok(factory_id: str, kind: str):
        return {"ok": True}

    return TestClient(app)


def _capture(client: TestClient, label: str, path: str) -> None:
    response = client.get(path)
    raw = response.content
    print(f"=== {label} ===")
    print(f"URL:       GET {path}")
    print(f"Status:    {response.status_code}")
    print(f"Bytes:     {len(raw)}")
    print(f"Content-Type: {response.headers.get('content-type')}")
    print(f"Raw body:  {raw!r}")
    print(f"Decoded:   {raw.decode('utf-8')}")
    print()


def main() -> None:
    client = _build_client()
    _capture(
        client,
        label="AFTER (in-scope, issue #530 fixed) — /smart-bi/analysis/production",
        path="/api/mobile/F001/smart-bi/analysis/production?startDate=2026-01-01&endDate=2026-01-31",
    )
    _capture(
        client,
        label="AFTER (in-scope, issue #530 fixed) — /smart-bi/analysis/quality",
        path="/api/mobile/F001/smart-bi/analysis/quality?startDate=2026-01-01&endDate=2026-01-31",
    )
    _capture(
        client,
        label="AFTER (in-scope, issue #530 fixed) — /smart-bi/analysis/finance",
        path="/api/mobile/F001/smart-bi/analysis/finance?startDate=2026-01-01&endDate=2026-01-31",
    )
    _capture(
        client,
        label="BEFORE shape (out-of-scope sister /analysis/region — unchanged on purpose)",
        path="/api/mobile/F001/smart-bi/analysis/region?startDate=2026-01-01&endDate=2026-01-31",
    )


if __name__ == "__main__":
    main()
