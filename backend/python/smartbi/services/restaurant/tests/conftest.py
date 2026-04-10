"""Conftest for restaurant analyzer unit tests.

Ensures `smartbi/` is on sys.path so that relative imports inside
`smartbi/services/__init__.py` resolve (it imports top-level `services.*`).
"""
from __future__ import annotations

import sys
from pathlib import Path

# Resolve to <repo>/backend/python and <repo>/backend/python/smartbi
# This file: <python>/smartbi/services/restaurant/tests/conftest.py
# parents[0]=tests, [1]=restaurant, [2]=services, [3]=smartbi, [4]=python
_HERE = Path(__file__).resolve()
_PYTHON_ROOT = _HERE.parents[4]
_SMARTBI_ROOT = _HERE.parents[3]

for p in (_PYTHON_ROOT, _SMARTBI_ROOT):
    p_str = str(p)
    if p_str not in sys.path:
        sys.path.insert(0, p_str)
