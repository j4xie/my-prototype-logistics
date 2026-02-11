from __future__ import annotations
"""
Unified Python Services Entry Point

Consolidates all Python modules into a single FastAPI application:
- SmartBI: Data analysis, Excel parsing, field detection, forecasting
- Efficiency Recognition: Video/image analysis for worker efficiency
- Scene Intelligence: LLM-powered factory scene understanding
- Client Requirements: Customer feedback system

Port: 8083
"""
import sys
from pathlib import Path

# Add smartbi directory to path so 'services' module can be found
_smartbi_dir = Path(__file__).parent / "smartbi"
if str(_smartbi_dir) not in sys.path:
    sys.path.insert(0, str(_smartbi_dir))

import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Import settings from smartbi config
from smartbi.config import get_settings

# Import SmartBI API routers
from smartbi.api import (
    excel,
    field,
    metrics,
    forecast,
    insight,
    chart,
    analysis,
    ml,
    linucb,
    chat,
    db_analysis,
    classifier,
    cross_sheet,
    yoy,
    statistical,
    analysis_cache,
    ai_proxy
)

# Import Efficiency Recognition API routers (optional - requires opencv)
try:
    from efficiency_recognition.api import (
        router as efficiency_router,
        stream_router as efficiency_stream_router,
        photo_router as efficiency_photo_router,
        tracking_router as efficiency_tracking_router,
        cost_router as efficiency_cost_router,
        recording_router as efficiency_recording_router,
        scene_router as efficiency_scene_router,
    )
    _efficiency_available = True
except ImportError as e:
    _efficiency_available = False
    import logging as _log
    _log.getLogger(__name__).warning(f"Efficiency Recognition not available: {e}")

# Import Scene Intelligence API router (optional)
try:
    from scene_intelligence import scene_router as scene_intelligence_router
    _scene_available = True
except ImportError as e:
    _scene_available = False
    import logging as _log
    _log.getLogger(__name__).warning(f"Scene Intelligence not available: {e}")

# Import Client Requirement API router (wizard_api.py is the complete router with
# legacy endpoints + wizard endpoints + gap-analysis + guide-config)
from client_requirement import wizard_api as client_requirement_routes

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if get_settings().debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("Python Services starting up...")
    logger.info(f"Debug mode: {get_settings().debug}")
    logger.info(f"LLM Model: {get_settings().llm_model}")

    # Check PostgreSQL connection if enabled
    if get_settings().postgres_enabled:
        try:
            from smartbi.database.connection import test_connection, is_postgres_enabled
            if is_postgres_enabled() and test_connection():
                logger.info("PostgreSQL connection established")
            else:
                logger.warning("PostgreSQL enabled but connection failed")
        except Exception as e:
            logger.warning(f"PostgreSQL initialization error: {e}")
    else:
        logger.info("PostgreSQL is disabled")

    yield
    logger.info("Python Services shutting down...")


# Create FastAPI application
app = FastAPI(
    title="Python Services",
    description="Unified Python services for SmartBI analytics and client requirements",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# SmartBI API Routes
# =====================================================
app.include_router(excel.router, prefix="/api/excel", tags=["Excel"])
app.include_router(field.router, prefix="/api/field", tags=["Field Detection"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["Metrics"])
app.include_router(forecast.router, prefix="/api/forecast", tags=["Forecast"])
app.include_router(insight.router, prefix="/api/insight", tags=["Insight"])
app.include_router(chart.router, prefix="/api/chart", tags=["Chart"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(ml.router, prefix="/api/ml", tags=["ML"])
app.include_router(linucb.router, prefix="/api/linucb", tags=["LinUCB"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(cross_sheet.router, prefix="/api/smartbi", tags=["Cross-Sheet Analysis"])
app.include_router(yoy.router, prefix="/api/smartbi", tags=["YoY Comparison"])
app.include_router(statistical.router, prefix="/api/statistical", tags=["Statistical Analysis"])
app.include_router(analysis_cache.router, prefix="/api/smartbi", tags=["Analysis Cache"])

# =====================================================
# AI Proxy Routes (called by Java backend)
# =====================================================
app.include_router(ai_proxy.router, prefix="/api/ai", tags=["AI Proxy"])

# Optional: classifier router (requires torch + transformers)
if classifier is not None:
    app.include_router(classifier.router, prefix="/api/classifier", tags=["Intent Classifier"])
else:
    logger.warning("Classifier router not registered (torch/transformers not installed)")

# Database analysis endpoints (PostgreSQL)
# Note: db_analysis.router already has /api/smartbi/analysis/db prefix
app.include_router(db_analysis.router, tags=["Database Analysis"])

# =====================================================
# Efficiency Recognition API Routes (optional)
# =====================================================
if _efficiency_available:
    app.include_router(efficiency_router, prefix="/api/efficiency", tags=["人效识别"])
    app.include_router(efficiency_stream_router, prefix="/api/efficiency/streams", tags=["多摄像头流管理"])
    app.include_router(efficiency_photo_router, prefix="/api/efficiency/photo", tags=["手动照片分析"])
    app.include_router(efficiency_tracking_router, prefix="/api/efficiency/tracking", tags=["跨摄像头追踪"])
    app.include_router(efficiency_cost_router, prefix="/api/efficiency/cost", tags=["成本监控"])
    app.include_router(efficiency_recording_router, prefix="/api/efficiency/recording", tags=["NVR录像分析"])
    app.include_router(efficiency_scene_router, prefix="/api/efficiency/scene", tags=["场景理解"])
else:
    logger.warning("Efficiency Recognition routes not registered")

# =====================================================
# Scene Intelligence API Routes (optional)
# =====================================================
if _scene_available:
    app.include_router(scene_intelligence_router, prefix="/api/scene", tags=["场景智能"])
else:
    logger.warning("Scene Intelligence routes not registered")

# =====================================================
# Client Requirement API Routes
# =====================================================
app.include_router(
    client_requirement_routes.router,
    prefix="/api/client-requirement",
    tags=["Client Requirement"]
)
app.include_router(
    client_requirement_routes.router,
    prefix="/api/public/client-requirement",
    tags=["Client Requirement (Public)"]
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    postgres_status = "disabled"

    if get_settings().postgres_enabled:
        try:
            from smartbi.database.connection import test_connection, is_postgres_enabled
            if is_postgres_enabled() and test_connection():
                postgres_status = "connected"
            else:
                postgres_status = "disconnected"
        except Exception:
            postgres_status = "error"

    return JSONResponse(
        content={
            "status": "healthy",
            "service": "python-services",
            "version": "2.0.0",
            "timestamp": datetime.now().isoformat(),
            "modules": [
                "smartbi",
                "client_requirement",
                *( ["efficiency_recognition"] if _efficiency_available else []),
                *( ["scene_intelligence"] if _scene_available else []),
            ],
            "postgres": postgres_status
        }
    )


@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Python Services",
        "version": "2.0.0",
        "description": "Unified Python services for SmartBI analytics and client requirements",
        "modules": {
            "smartbi": {
                "excel": "/api/excel",
                "field": "/api/field",
                "metrics": "/api/metrics",
                "forecast": "/api/forecast",
                "insight": "/api/insight",
                "chart": "/api/chart",
                "analysis": "/api/analysis",
                "ml": "/api/ml",
                "linucb": "/api/linucb",
                "chat": "/api/chat",
                "classifier": "/api/classifier",
                "db_analysis": "/api/smartbi/analysis/db",
                "cross_sheet": "/api/smartbi/cross-sheet-analysis",
                "ai_proxy": "/api/ai"
            },
            "client_requirement": "/api/client-requirement",
            **({"efficiency_recognition": "/api/efficiency"} if _efficiency_available else {}),
            **({"scene_intelligence": "/api/scene"} if _scene_available else {}),
        },
        "endpoints": {
            "health": "/health",
            "docs": "/docs"
        },
        "postgres_enabled": get_settings().postgres_enabled
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": str(exc) if settings.debug else "Internal server error",
            "data": None
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
