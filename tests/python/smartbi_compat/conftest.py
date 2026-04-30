"""Shared fixtures for smartbi_compat tests."""
import sys
import pathlib

# parents[3] = project root (conftest.py -> smartbi_compat -> python -> tests -> project root)
_PY_ROOT = pathlib.Path(__file__).resolve().parents[3] / "backend" / "python"
if str(_PY_ROOT) not in sys.path:
    sys.path.insert(0, str(_PY_ROOT))
