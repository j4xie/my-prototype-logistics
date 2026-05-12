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
* Optional Blue-Green slot detection (``resolve_java_base`` + module-level
  cache) so the harness keeps working when Java prod flips 10010↔10020
  mid-task — mirrors the canonical pattern in
  ``scripts/t6-dryrun-compare.sh:99-126``.

Spec: scripts/parity-gate/README.md
"""
from __future__ import annotations

import json
import os
import sys
import time
from typing import Any, Dict, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urlunparse
from urllib.request import Request, urlopen


# Blue-Green Java prod port pair. The Java backend lives on 10010 (blue) or
# 10020 (green) depending on which slot ``deploy-backend.sh --env prod`` last
# activated. ``detect_active_java_port`` probes both and returns whichever
# answers /api/mobile/health with 200.
BG_DEFAULT_PORTS: Tuple[int, ...] = (10010, 10020)
_BG_HEALTH_PATH = "/api/mobile/health"

# Module-level cache so detection runs once per process even when
# ``fetch_pair`` is called dozens of times in a batch.
_BG_RESOLVED_BASE: Dict[str, str] = {}


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


def _probe_java_health(host: str, port: int, timeout: int = 3) -> bool:
    """Hit /api/mobile/health on host:port. True iff 200 OK.

    Mirrors ``scripts/t6-dryrun-compare.sh:detect_java_port`` — connection
    refused / 5xx / timeout all map to False. No exception leaks; the caller
    only needs the boolean. (Per ``feedback_no_defensive_in_verify_scripts.md``
    we don't paper over real failures — but a health probe IS the place where
    a refused connection is signal, not noise.)
    """
    url = f"http://{host}:{port}{_BG_HEALTH_PATH}"
    try:
        with urlopen(Request(url), timeout=timeout) as resp:
            return resp.status == 200
    except (HTTPError, URLError, OSError, TimeoutError):
        return False


def detect_active_java_port(
    host: str,
    ports: Tuple[int, ...] = BG_DEFAULT_PORTS,
    timeout: int = 3,
) -> Optional[int]:
    """Probe each candidate Java port; return the first that answers
    /api/mobile/health with 200.

    Returns None if every port refuses or returns non-200 — the caller is
    expected to surface that as a clear error rather than silently fall back
    to localhost or whatever.
    """
    for port in ports:
        if _probe_java_health(host, port, timeout=timeout):
            return port
    return None


def _swap_port(base_url: str, new_port: int) -> str:
    """Replace the port component of ``base_url`` with ``new_port``."""
    parts = urlparse(base_url)
    if not parts.hostname:
        return base_url
    netloc = f"{parts.hostname}:{new_port}"
    if parts.username:
        userinfo = parts.username
        if parts.password:
            userinfo += f":{parts.password}"
        netloc = f"{userinfo}@{netloc}"
    return urlunparse(parts._replace(netloc=netloc))


def resolve_java_base(
    java_base: str,
    bg_fallback: bool = False,
    ports: Tuple[int, ...] = BG_DEFAULT_PORTS,
    timeout: int = 3,
    verbose: bool = True,
) -> str:
    """Return the effective Java base URL, applying BG detection if requested.

    Behaviour:
    * ``bg_fallback=False`` → return ``java_base`` unchanged (existing behaviour
      preserved; explicit URLs are honoured).
    * ``bg_fallback=True`` AND host:port in ``java_base`` matches one of the
      known BG ports → probe both ports, return base URL with the active port
      substituted. If neither responds, return ``java_base`` untouched and let
      the actual fetch surface the error (loud failure > silent fallback).
    * Result cached per ``(java_base, ports)`` for the lifetime of the process,
      so a 50-endpoint batch only probes once.

    The cache key includes the input base so callers that pass distinct hosts
    (e.g. tests with localhost + prod) don't share resolution.
    """
    if not bg_fallback:
        return java_base

    cache_key = f"{java_base}|{','.join(str(p) for p in ports)}"
    if cache_key in _BG_RESOLVED_BASE:
        return _BG_RESOLVED_BASE[cache_key]

    parts = urlparse(java_base)
    host = parts.hostname
    requested_port = parts.port
    if not host:
        _BG_RESOLVED_BASE[cache_key] = java_base
        return java_base

    # Only auto-detect when the user pointed at one of the known BG ports.
    # If they explicitly chose a non-BG port (e.g. :10011 test env), don't
    # rewrite — that would silently move the test off the intended slot.
    if requested_port not in ports:
        _BG_RESOLVED_BASE[cache_key] = java_base
        return java_base

    # Probe in declared order; requested_port first if it's still alive,
    # otherwise the next port in the tuple.
    probe_order = (requested_port,) + tuple(p for p in ports if p != requested_port)
    active = detect_active_java_port(host, probe_order, timeout=timeout)
    if active is None:
        if verbose:
            print(
                f"[parity-gate] WARN: BG detection found no live Java on "
                f"{host}:{probe_order} — keeping {java_base}",
                file=sys.stderr,
            )
        _BG_RESOLVED_BASE[cache_key] = java_base
        return java_base

    if active == requested_port:
        resolved = java_base
    else:
        resolved = _swap_port(java_base, active)

    if verbose and resolved != java_base:
        print(
            f"[parity-gate] BG fallback: {java_base} unreachable, "
            f"switched to {resolved}",
            file=sys.stderr,
        )

    _BG_RESOLVED_BASE[cache_key] = resolved
    return resolved


def _reset_bg_cache() -> None:
    """Test hook — clear the BG resolution cache."""
    _BG_RESOLVED_BASE.clear()


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
