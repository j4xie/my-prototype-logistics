"""
Shared pytest configuration for tests/python/.

Adds backend/python to sys.path so test modules can import from
llm.*, common.*, smartbi.*, etc. without installing packages.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Project root is 2 levels up: tests/python/conftest.py → tests/python → tests → root
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_PYTHON_ROOT = _PROJECT_ROOT / "backend" / "python"

if str(_PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(_PYTHON_ROOT))
# Also add smartbi sub-dir (required by main.py / other modules)
_SMARTBI_DIR = _PYTHON_ROOT / "smartbi"
if str(_SMARTBI_DIR) not in sys.path:
    sys.path.insert(1, str(_SMARTBI_DIR))
