"""Root-level conftest for pytest.

Ensures `backend/python/` and `backend/python/smartbi/` are on sys.path so
that the `smartbi.services.*` package can load (its __init__ imports
top-level `services.*` which requires `smartbi/` on sys.path).
"""
from __future__ import annotations

import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent  # backend/python
_SMARTBI = _HERE / "smartbi"

for p in (_HERE, _SMARTBI):
    p_str = str(p)
    if p_str not in sys.path:
        sys.path.insert(0, p_str)
