# Setup path for services imports
import sys
from pathlib import Path
_module_dir = Path(__file__).resolve().parent.parent
if str(_module_dir) not in sys.path:
    sys.path.insert(0, str(_module_dir))

from fastapi import APIRouter
from . import linucb

router = APIRouter()

# Register Scheduling routes
router.include_router(linucb.router, prefix="/linucb", tags=["Scheduling-LinUCB"])
