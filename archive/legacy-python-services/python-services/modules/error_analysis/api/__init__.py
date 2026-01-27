# Setup path for services/models imports
import sys
from pathlib import Path
_module_dir = Path(__file__).resolve().parent.parent
if str(_module_dir) not in sys.path:
    sys.path.insert(0, str(_module_dir))

from .analysis import router

__all__ = ['router']
