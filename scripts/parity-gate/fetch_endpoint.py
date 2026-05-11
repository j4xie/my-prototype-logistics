"""HTTP fetch helpers for parity-gate.

Mirrors the JWT + urllib pattern from
``scripts/active-e2e/curl-replay/replay-and-compare.py:53-92`` so the two
tools stay consistent. Differences:

* Returns a dataclass-shaped dict including parsed-JSON ``data`` (not
  just raw bytes) — dict-eq compares parsed values.
* No try/except over connection refused / HTTP 500 swallow per HARD
  ``feedback_no_defensive_in_verify_scripts.md``: real failures are
  reported via verdict, NOT silently smoothed into a "match=False" result.
  When the JWT secret is missing or both endpoints fail to connect, the
  caller sees a structured ``verdict`` and can decide how to react.

Spec: scripts/parity-gate/README.md
"""
from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def make_jwt_token(factory_id: str, secret: Optional[str] = None) -> str:
    """Generate a parity-gate JWT for ``factory_super_admin`` on ``factory_id``.

    Falls back to ``$JWT_SECRET`` env var when ``secret`` is omitted. Raises
    when both are missing — better to crash loudly than to silently send
    requests with an empty signature.
    """
    secret = secret or os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError(
            "JWT_SECRET missing. Pass --jwt-secret or set $JWT_SECRET env var "
            "before running parity-gate."
        )
    try:
        import jwt  # pyjwt
    except ImportError as e:
        raise RuntimeError(
            "PyJWT not installed. `pip install pyjwt` or activate the project "
            "venv that already has it (see backend/python/requirements.txt)."
        ) from e

    payload = {
        "userId": 1,
        "username": "parity_gate",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": int(time.time()) + 3600,
    }
    tok = jwt.encode(payload, secret, algorithm="HS256")
    return tok if isinstance(tok, str) else tok.decode("utf-8")


def fetch_endpoint(
    base_url: str,
    path: str,
    factory_id: str,
    token: str,
    method: str = "GET",
    timeout: int = 20,
) -> Dict[str, Any]:
    """Fetch a single endpoint and parse the JSON body.

    Args:
        base_url: e.g. ``http://47.100.235.168:10010``
        path: URL path (may contain ``{factoryId}`` placeholder).
        factory_id: replaces ``{factoryId}`` in path.
        token: JWT bearer.
        method: HTTP method (default GET).
        timeout: request timeout in seconds.

    Returns:
        {
            "url": str,                       # full URL hit
            "http": int,                      # status code; -1 if network error
            "lat_s": float,                   # latency in seconds
            "size": int,                      # raw body size
            "raw": str,                       # raw body as utf-8 string (or "")
            "data": Any | None,               # parsed JSON or None on parse fail
            "error": str | None,              # error message when http < 0
            "verdict": str,                   # "ok" | "http_error" | "network_error" | "parse_error"
        }
    """
    url = base_url.rstrip("/") + path.replace("{factoryId}", factory_id).replace(
        "{factory_id}", factory_id
    )
    headers = {"Authorization": f"Bearer {token}"}
    data: Optional[bytes] = None
    if method in ("POST", "PUT", "PATCH"):
        headers["Content-Type"] = "application/json"
        data = b"{}"

    req = Request(url, headers=headers, method=method, data=data)
    t0 = time.time()

    try:
        with urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            status = resp.status
            verdict = "ok"
    except HTTPError as e:
        try:
            body = e.read()
        except Exception:
            body = b""
        status = e.code
        verdict = "http_error"
    except (URLError, OSError, TimeoutError) as e:
        return {
            "url": url,
            "http": -1,
            "lat_s": round(time.time() - t0, 3),
            "size": 0,
            "raw": "",
            "data": None,
            "error": str(e)[:200],
            "verdict": "network_error",
        }

    lat_s = round(time.time() - t0, 3)
    raw = ""
    parsed: Optional[Any] = None
    parse_err: Optional[str] = None
    try:
        raw = body.decode("utf-8", errors="replace")
        parsed = json.loads(raw) if raw else None
    except json.JSONDecodeError as e:
        parse_err = f"json decode: {e}"
        verdict = "parse_error"

    return {
        "url": url,
        "http": status,
        "lat_s": lat_s,
        "size": len(body),
        "raw": raw,
        "data": parsed,
        "error": parse_err,
        "verdict": verdict,
    }


def fetch_pair(
    java_base: str,
    python_base: str,
    path: str,
    factory_id: str,
    java_token: str,
    python_token: Optional[str] = None,
    method: str = "GET",
    timeout: int = 20,
) -> Dict[str, Dict[str, Any]]:
    """Fetch the same endpoint from Java + Python in sequence.

    The Java backend and Python backend may share the same JWT secret (and
    they do in prod), in which case ``python_token`` defaults to ``java_token``.
    """
    if python_token is None:
        python_token = java_token
    java_r = fetch_endpoint(java_base, path, factory_id, java_token, method, timeout)
    python_r = fetch_endpoint(python_base, path, factory_id, python_token, method, timeout)
    return {"java": java_r, "python": python_r}
