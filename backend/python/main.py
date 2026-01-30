"""
Python Backend Services - Unified Entry Point

统一的 Python 后端服务入口，整合所有 Python 模块：
- SmartBI: 数据分析、图表、预测
- Efficiency Recognition: 人效视觉识别
- Scheduling: 调度算法 (LinUCB)
- Chat: 对话服务
- Classifier: 意图分类

端口: 8083
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# 添加模块路径
ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "smartbi"))

# 导入配置
from smartbi.config import get_settings

# ==================================================
# 导入各模块路由
# ==================================================

# SmartBI 模块 (数据分析)
from smartbi.api import (
    excel, field, metrics, forecast, insight,
    chart, analysis, ml, db_analysis
)

# 人效识别模块
from efficiency_recognition.api import router as efficiency_router
from efficiency_recognition.api import stream_router as efficiency_stream_router
from efficiency_recognition.api import photo_router as efficiency_photo_router
from efficiency_recognition.api import tracking_router as efficiency_tracking_router

# 场景智能模块
from scene_intelligence.api import router as scene_router

# 调度算法模块
from scheduling.api import router as scheduling_router

# 对话服务模块
from chat.api import router as chat_router

# 意图分类模块
from classifier.api import router as classifier_router

# 客户需求反馈模块
from client_requirement.api import router as client_requirement_router

# Configure logging
settings = get_settings()
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("Python Backend Services starting up...")
    logger.info(f"Debug mode: {settings.debug}")
    logger.info(f"LLM Model: {settings.llm_model}")

    # Check PostgreSQL connection if enabled
    if settings.postgres_enabled:
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
    logger.info("Python Backend Services shutting down...")


# Create FastAPI application
app = FastAPI(
    title="Python Backend Services",
    description="统一的 Python 后端服务",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================================================
# SmartBI 模块路由 - /api/smartbi/*
# ==================================================
app.include_router(excel.router, prefix="/api/smartbi/excel", tags=["SmartBI - Excel"])
app.include_router(field.router, prefix="/api/smartbi/field", tags=["SmartBI - Field"])
app.include_router(metrics.router, prefix="/api/smartbi/metrics", tags=["SmartBI - Metrics"])
app.include_router(forecast.router, prefix="/api/smartbi/forecast", tags=["SmartBI - Forecast"])
app.include_router(insight.router, prefix="/api/smartbi/insight", tags=["SmartBI - Insight"])
app.include_router(chart.router, prefix="/api/smartbi/chart", tags=["SmartBI - Chart"])
app.include_router(analysis.router, prefix="/api/smartbi/analysis", tags=["SmartBI - Analysis"])
app.include_router(ml.router, prefix="/api/smartbi/ml", tags=["SmartBI - ML"])
app.include_router(db_analysis.router, tags=["SmartBI - DB Analysis"])  # 已有前缀

# ==================================================
# SmartBI 兼容路由 - /api/* (Java端配置使用此路径)
# ==================================================
app.include_router(excel.router, prefix="/api/excel", tags=["SmartBI - Excel (Legacy)"])
app.include_router(field.router, prefix="/api/field", tags=["SmartBI - Field (Legacy)"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["SmartBI - Metrics (Legacy)"])
app.include_router(forecast.router, prefix="/api/forecast", tags=["SmartBI - Forecast (Legacy)"])
app.include_router(insight.router, prefix="/api/insight", tags=["SmartBI - Insight (Legacy)"])
app.include_router(chart.router, prefix="/api/chart", tags=["SmartBI - Chart (Legacy)"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["SmartBI - Analysis (Legacy)"])
app.include_router(ml.router, prefix="/api/ml", tags=["SmartBI - ML (Legacy)"])

# ==================================================
# 人效识别模块路由 - /api/efficiency/*
# ==================================================
app.include_router(efficiency_router, prefix="/api/efficiency", tags=["人效识别"])
app.include_router(efficiency_stream_router, prefix="/api/efficiency/streams", tags=["多摄像头流管理"])
app.include_router(efficiency_photo_router, prefix="/api/efficiency/photo", tags=["手动照片分析"])
app.include_router(efficiency_tracking_router, prefix="/api/efficiency/tracking", tags=["跨摄像头追踪"])

# ==================================================
# 场景智能模块路由 - /api/scene/*
# ==================================================
app.include_router(scene_router, prefix="/api/scene", tags=["场景智能"])

# ==================================================
# 调度算法模块路由 - /api/scheduling/*
# ==================================================
app.include_router(scheduling_router, prefix="/api/scheduling", tags=["调度算法"])

# ==================================================
# 对话服务模块路由 - /api/chat/*
# ==================================================
app.include_router(chat_router, prefix="/api/chat", tags=["对话服务"])

# ==================================================
# 意图分类模块路由 - /api/classifier/*
# ==================================================
app.include_router(classifier_router, prefix="/api/classifier", tags=["意图分类"])

# ==================================================
# 客户需求反馈模块路由 - /api/public/client-requirement/*
# ==================================================
app.include_router(client_requirement_router, prefix="/api/public/client-requirement", tags=["客户需求反馈"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    postgres_status = "disabled"

    if settings.postgres_enabled:
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
            "service": "python-backend",
            "version": "1.0.0",
            "timestamp": datetime.now().isoformat(),
            "postgres": postgres_status,
            "modules": [
                "smartbi",
                "efficiency_recognition",
                "efficiency_recognition/streams",
                "efficiency_recognition/photo",
                "efficiency_recognition/tracking",
                "scene_intelligence",
                "scheduling",
                "chat",
                "classifier",
                "client_requirement"
            ]
        }
    )


@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Python Backend Services",
        "version": "1.0.0",
        "description": "统一的 Python 后端服务",
        "modules": {
            "smartbi": {
                "description": "AI 数据分析服务",
                "prefix": "/api/smartbi",
                "endpoints": ["excel", "field", "metrics", "forecast", "insight", "chart", "analysis", "ml"]
            },
            "efficiency_recognition": {
                "description": "人效视觉识别服务",
                "prefix": "/api/efficiency",
                "sub_modules": {
                    "streams": "/api/efficiency/streams - 多摄像头流管理",
                    "photo": "/api/efficiency/photo - 手动照片分析",
                    "tracking": "/api/efficiency/tracking - 跨摄像头追踪"
                }
            },
            "scene_intelligence": {
                "description": "场景智能服务 (LLM动态场景理解)",
                "prefix": "/api/scene"
            },
            "scheduling": {
                "description": "调度算法服务 (LinUCB)",
                "prefix": "/api/scheduling"
            },
            "chat": {
                "description": "对话服务",
                "prefix": "/api/chat"
            },
            "classifier": {
                "description": "意图分类服务",
                "prefix": "/api/classifier"
            },
            "client_requirement": {
                "description": "客户需求反馈服务",
                "prefix": "/api/public/client-requirement"
            }
        },
        "health": "/health",
        "docs": "/docs"
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
