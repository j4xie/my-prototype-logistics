"""Router-wiring regression gate (BUG-R1A-1 follow-up).

History: PR #425 shipped ``smartbi_compat.api.config_thresholds`` with 41 unit
tests + 5 endpoints (Phase 2C Tier 1 pilot), but ``main.py`` never called
``app.include_router(config_thresholds.router)``. Unit tests passed (router
import + handlers tested in isolation), yet production curl returned 404 —
the wiring step had no test gate.

This file plugs that gap:

* ``test_config_thresholds_endpoints_wired`` — the **specific** bug: assert
  all 5 ``/api/mobile/smartbi-config/thresholds`` routes resolve in
  ``main.app.routes`` after import.

* ``test_every_smartbi_compat_router_is_wired`` — the **same-cause sweep**:
  for every module in ``smartbi_compat.api`` that defines ``router = APIRouter()``,
  assert at least one of its routes appears in ``main.app.routes``. Future
  Phase 2C Tier 1 sub-modules (intents / incentive-rules / field-mappings /
  metric-formulas / chart-templates / reload+status / data-sources) get
  catch-the-mistake-at-CI-time coverage automatically.

Pattern: zero live DB / network / config required — pure import + route
inspection. Same cost profile as ``test_imports.py``.
"""
from __future__ import annotations

import importlib
import pkgutil

import pytest


@pytest.fixture(scope="module")
def app():
    """Import main once per module; expose its FastAPI instance."""
    import main  # noqa: WPS433 — module-level side effects are intentional
    return main.app


def _route_paths(app, *, methods: bool = False):
    """Return set of (path, method) tuples or just paths from app.routes.

    FastAPI's APIRoute objects expose ``.path`` and ``.methods``. Mount
    objects (Starlette internals) have ``.path`` only — we skip those when
    ``methods=True`` since they don't carry HTTP verbs.
    """
    out = set()
    for route in app.routes:
        path = getattr(route, "path", None)
        if path is None:
            continue
        if methods:
            for m in getattr(route, "methods", set()) or set():
                out.add((path, m))
        else:
            out.add(path)
    return out


def test_config_thresholds_endpoints_wired(app):
    """All 5 Phase 2C Tier 1 pilot endpoints must resolve in main.app."""
    expected = {
        ("/api/mobile/smartbi-config/thresholds", "GET"),
        ("/api/mobile/smartbi-config/thresholds", "POST"),
        ("/api/mobile/smartbi-config/thresholds/{id}", "PUT"),
        ("/api/mobile/smartbi-config/thresholds/{id}", "DELETE"),
        ("/api/mobile/smartbi-config/thresholds/reload", "POST"),
    }
    actual = _route_paths(app, methods=True)
    missing = expected - actual
    assert not missing, (
        f"config_thresholds endpoints not wired into main.app: {missing}. "
        "Check the smartbi_compat block in backend/python/main.py."
    )


def test_every_smartbi_compat_router_is_wired(app):
    """Same-cause sweep: any smartbi_compat.api module defining a router
    must have at least one of its routes mounted on main.app.

    Mechanism: each submodule's ``router`` carries a ``routes`` list at
    import time. ``app.include_router(r)`` copies those into ``app.routes``
    (re-wrapped as APIRoute). We match on the full path string — if the
    submodule defines path ``/foo/bar`` and ``/foo/bar`` shows up in
    ``app.routes``, wiring is intact.

    A submodule with zero ``@router.<verb>`` decorators is skipped (no
    paths to compare). In practice every router we ship has at least one
    endpoint.
    """
    import smartbi_compat.api as compat_pkg

    app_paths = _route_paths(app)

    misses: list[str] = []
    for mod_info in pkgutil.iter_modules(compat_pkg.__path__):
        if mod_info.ispkg:
            continue
        mod_name = f"smartbi_compat.api.{mod_info.name}"
        try:
            mod = importlib.import_module(mod_name)
        except Exception as e:  # pragma: no cover — surfaces import-time bugs
            pytest.fail(f"Cannot import {mod_name}: {e}")

        router = getattr(mod, "router", None)
        if router is None:
            continue

        submod_paths = {
            getattr(r, "path", None)
            for r in getattr(router, "routes", [])
            if getattr(r, "path", None) is not None
        }
        if not submod_paths:
            continue

        if submod_paths.isdisjoint(app_paths):
            misses.append(
                f"{mod_name}: router defines {sorted(submod_paths)!r} "
                "but none appear in main.app.routes"
            )

    assert not misses, (
        "smartbi_compat routers not wired into main.app:\n"
        + "\n".join(f"  - {m}" for m in misses)
        + "\n\nAdd `app.include_router(<module>.router, ...)` to the "
        "smartbi_compat block in backend/python/main.py."
    )
