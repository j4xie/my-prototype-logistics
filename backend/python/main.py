from __future__ import annotations
"""
Unified Python Services Entry Point

Consolidates all Python modules into a single FastAPI application:
- SmartBI: Data analysis, Excel parsing, field detection, forecasting
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
    analysis_cache
)

# Import Client Requirement API router
from client_requirement.api import routes as client_requirement_routes

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

# Optional: classifier router (requires torch + transformers)
if classifier is not None:
    app.include_router(classifier.router, prefix="/api/classifier", tags=["Intent Classifier"])
else:
    logger.warning("Classifier router not registered (torch/transformers not installed)")

# Database analysis endpoints (PostgreSQL)
# Note: db_analysis.router already has /api/smartbi/analysis/db prefix
app.include_router(db_analysis.router, tags=["Database Analysis"])

# =====================================================
# Client Requirement API Routes
# =====================================================
app.include_router(
    client_requirement_routes.router,
    prefix="/api/client-requirement",
    tags=["Client Requirement"]
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
            "modules": ["smartbi", "client_requirement"],
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
                "cross_sheet": "/api/smartbi/cross-sheet-analysis"
            },
            "client_requirement": "/api/client-requirement"
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
