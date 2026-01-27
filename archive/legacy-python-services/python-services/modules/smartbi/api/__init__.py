# Setup path for services imports
import sys
from pathlib import Path
_module_dir = Path(__file__).resolve().parent.parent
if str(_module_dir) not in sys.path:
    sys.path.insert(0, str(_module_dir))

from fastapi import APIRouter
from . import excel, analysis, chart, metrics, insight, forecast, field, ml, chat, db_analysis

router = APIRouter()

# Register all SmartBI routes
router.include_router(excel.router, prefix="/excel", tags=["SmartBI-Excel"])
router.include_router(analysis.router, prefix="/analysis", tags=["SmartBI-Analysis"])
router.include_router(chart.router, prefix="/chart", tags=["SmartBI-Chart"])
router.include_router(metrics.router, prefix="/metrics", tags=["SmartBI-Metrics"])
router.include_router(insight.router, prefix="/insight", tags=["SmartBI-Insight"])
router.include_router(forecast.router, prefix="/forecast", tags=["SmartBI-Forecast"])
router.include_router(field.router, prefix="/field", tags=["SmartBI-Field"])
router.include_router(ml.router, prefix="/ml", tags=["SmartBI-ML"])
router.include_router(chat.router, prefix="/chat", tags=["SmartBI-Chat"])
router.include_router(db_analysis.router, prefix="/db", tags=["SmartBI-DB"])
