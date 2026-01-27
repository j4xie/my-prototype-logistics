"""
Python Services - Unified Entry Point

统一的 Python 服务入口，包含所有模块：
- SmartBI: 数据分析、Excel 处理、图表生成
- Error Analysis: AI 意图错误分析
- Scheduling: LinUCB 推荐算法、效率计算

端口: 8083
"""
from __future__ import annotations

import logging
import sys
import os
from pathlib import Path
from contextlib import asynccontextmanager

# =============================================================================
# Path Setup - 确保各模块的 services 可以被正确导入
# =============================================================================
BASE_DIR = Path(__file__).resolve().parent

# Add module paths to sys.path for backward compatible imports
# This allows `from services.xxx import yyy` to work within each module
sys.path.insert(0, str(BASE_DIR / "modules" / "smartbi"))
sys.path.insert(0, str(BASE_DIR / "modules" / "scheduling"))
sys.path.insert(0, str(BASE_DIR / "modules" / "error_analysis"))
sys.path.insert(0, str(BASE_DIR / "modules" / "classifier"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('python-services.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("Python Services starting...")
    logger.info("Modules: SmartBI, ErrorAnalysis, Scheduling, IntentClassifier")
    yield
    logger.info("Python Services shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Python Services",
    description="""
    统一的 Python 服务，包含：
    - **/api/smartbi/*** - SmartBI 数据分析
    - **/api/error-analysis/*** - AI 意图错误分析
    - **/api/scheduling/*** - 调度算法 (LinUCB)
    - **/api/classifier/*** - 意图分类器 (BERT)
    """,
    version="2.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Register Module Routers
# =============================================================================

# SmartBI Module
try:
    from modules.smartbi.api import router as smartbi_router
    app.include_router(smartbi_router, prefix="/api/smartbi", tags=["SmartBI"])
    logger.info("SmartBI module loaded")
except ImportError as e:
    logger.warning(f"Failed to load SmartBI module: {e}")

# Error Analysis Module
try:
    from modules.error_analysis.api import router as error_analysis_router
    app.include_router(error_analysis_router, prefix="/api/error-analysis", tags=["ErrorAnalysis"])
    logger.info("ErrorAnalysis module loaded")
except ImportError as e:
    logger.warning(f"Failed to load ErrorAnalysis module: {e}")

# Scheduling Module (LinUCB)
try:
    from modules.scheduling.api import router as scheduling_router
    app.include_router(scheduling_router, prefix="/api/scheduling", tags=["Scheduling"])
    logger.info("Scheduling module loaded")
except ImportError as e:
    logger.warning(f"Failed to load Scheduling module: {e}")

# Intent Classifier Module
try:
    from modules.classifier.api import router as classifier_router
    app.include_router(classifier_router, prefix="/api/classifier", tags=["IntentClassifier"])
    logger.info("IntentClassifier module loaded")
except ImportError as e:
    logger.warning(f"Failed to load IntentClassifier module: {e}")


# =============================================================================
# Legacy API Compatibility (保持向后兼容)
# =============================================================================

# 保持原有的 /api/linucb/* 路径可用 (Java 端当前使用这个路径)
try:
    from modules.scheduling.api import linucb
    app.include_router(linucb.router, prefix="/api/linucb", tags=["LinUCB-Legacy"])
    logger.info("LinUCB legacy routes (/api/linucb/*) loaded")
except ImportError as e:
    logger.warning(f"Failed to load LinUCB legacy routes: {e}")

# 保持原有的 /api/analysis/* 路径可用 (Java 端当前使用这个路径)
try:
    from modules.error_analysis.api import analysis as error_analysis_api
    app.include_router(error_analysis_api.router, prefix="/api/analysis", tags=["Analysis-Legacy"])
    logger.info("Analysis legacy routes (/api/analysis/*) loaded")
except ImportError as e:
    logger.warning(f"Failed to load Analysis legacy routes: {e}")


# =============================================================================
# Health Check & Info
# =============================================================================

@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "python-services",
        "version": "2.1.0",
        "modules": ["smartbi", "error_analysis", "scheduling", "classifier"]
    }


@app.get("/")
async def root():
    """服务信息"""
    return {
        "service": "Python Services",
        "version": "2.1.0",
        "description": "统一的 Python 服务",
        "modules": {
            "smartbi": "/api/smartbi/*",
            "error_analysis": "/api/error-analysis/*",
            "scheduling": "/api/scheduling/*",
            "classifier": "/api/classifier/*"
        },
        "legacy_routes": {
            "linucb": "/api/linucb/*",
            "analysis": "/api/analysis/*"
        },
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8083)
