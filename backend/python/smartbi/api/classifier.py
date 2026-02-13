"""
Intent Classifier API

意图分类器 API 端点
提供单条和批量意图分类服务

注意：响应格式兼容 Java ClassifierIntentMatcher
"""
import logging
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.intent_classifier import get_classifier, IntentClassifierService

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== 请求/响应模型 ====================

class ClassifyRequest(BaseModel):
    """单条分类请求"""
    text: str = Field(..., description="待分类文本")
    top_k: int = Field(5, ge=1, le=10, description="返回 top-k 个结果")
    threshold: float = Field(0.0, ge=0.0, le=1.0, description="最小置信度阈值")


class ClassifyBatchRequest(BaseModel):
    """批量分类请求"""
    texts: List[str] = Field(..., description="待分类文本列表")
    top_k: int = Field(1, ge=1, le=10, description="每个文本返回 top-k 个结果")


class LoadModelRequest(BaseModel):
    """加载模型请求"""
    model_path: str = Field(..., description="模型目录路径")


class ConfidenceRequest(BaseModel):
    """意图置信度请求"""
    text: str = Field(..., description="待分类文本")
    intent_code: str = Field(..., description="目标意图代码")


# ==================== API 端点 ====================

@router.post("/classify")
async def classify_intent(request: ClassifyRequest):
    """
    对单条文本进行意图分类

    Args:
        request: 包含 text, top_k, threshold 的请求体

    Returns:
        分类结果，兼容 Java ClassifierIntentMatcher
    """
    classifier = get_classifier()

    if not classifier.is_loaded():
        return {
            "success": False,
            "predictions": [],
            "top_intent": None,
            "top_confidence": 0.0,
            "error": "分类器模型未加载"
        }

    result = classifier.classify(request.text, request.top_k)

    if not result.get("success"):
        return {
            "success": False,
            "predictions": [],
            "top_intent": None,
            "top_confidence": 0.0,
            "error": result.get("message", "分类失败")
        }

    # 转换为 Java 兼容格式
    intents = result.get("intents", [])
    predictions = []
    for i, intent in enumerate(intents):
        confidence = intent.get("confidence", 0.0)
        if confidence >= request.threshold:
            predictions.append({
                "intent": intent.get("intent_code"),
                "confidence": confidence,
                "rank": i + 1
            })

    top_intent = result.get("top_intent")

    return {
        "success": True,
        "predictions": predictions,
        "top_intent": top_intent.get("intent_code") if top_intent else None,
        "top_confidence": top_intent.get("confidence", 0.0) if top_intent else 0.0,
        "error": None
    }


@router.post("/classify/batch")
async def classify_intent_batch(request: ClassifyBatchRequest):
    """
    批量意图分类

    Args:
        request: 包含 texts 列表的请求体

    Returns:
        分类结果列表
    """
    classifier = get_classifier()

    if not classifier.is_loaded():
        return {
            "success": False,
            "count": 0,
            "results": [],
            "error": "分类器模型未加载"
        }

    if len(request.texts) > 100:
        raise HTTPException(
            status_code=400,
            detail="批量请求最多支持 100 条文本"
        )

    results = classifier.classify_batch(request.texts, request.top_k)

    # 转换为 Java 兼容格式
    formatted_results = []
    for result in results:
        if result.get("success"):
            top_intent = result.get("top_intent")
            formatted_results.append({
                "success": True,
                "top_intent": top_intent.get("intent_code") if top_intent else None,
                "top_confidence": top_intent.get("confidence", 0.0) if top_intent else 0.0
            })
        else:
            formatted_results.append({
                "success": False,
                "top_intent": None,
                "top_confidence": 0.0,
                "error": result.get("message")
            })

    return {
        "success": True,
        "count": len(formatted_results),
        "results": formatted_results
    }


@router.post("/confidence")
async def get_intent_confidence(request: ConfidenceRequest):
    """
    获取特定意图的置信度

    Args:
        request: 包含 text 和 intent_code 的请求体

    Returns:
        指定意图的置信度
    """
    classifier = get_classifier()

    if not classifier.is_loaded():
        return {
            "success": False,
            "confidence": 0.0,
            "error": "分类器模型未加载"
        }

    # 获取所有预测，查找目标意图
    result = classifier.classify(request.text, top_k=185)  # 返回所有

    if not result.get("success"):
        return {
            "success": False,
            "confidence": 0.0,
            "error": result.get("message")
        }

    # 查找目标意图的置信度
    intents = result.get("intents", [])
    for intent in intents:
        if intent.get("intent_code") == request.intent_code:
            return {
                "success": True,
                "confidence": intent.get("confidence", 0.0),
                "intent_code": request.intent_code
            }

    # 未找到目标意图（可能是无效的意图代码）
    return {
        "success": True,
        "confidence": 0.0,
        "intent_code": request.intent_code,
        "message": "未找到指定意图"
    }


@router.post("/load")
async def load_model(request: LoadModelRequest):
    """
    加载或重新加载模型

    Args:
        request: 包含 model_path 的请求体

    Returns:
        加载结果
    """
    classifier = get_classifier()

    if not Path(request.model_path).exists():
        raise HTTPException(
            status_code=404,
            detail=f"模型路径不存在: {request.model_path}"
        )

    success = classifier.load_model(request.model_path)

    if success:
        return {
            "success": True,
            "message": f"模型加载成功: {request.model_path}",
            "model_info": classifier.get_model_info()
        }
    else:
        raise HTTPException(
            status_code=500,
            detail="模型加载失败，请检查日志"
        )


@router.get("/info")
async def get_model_info():
    """
    获取模型信息

    Returns:
        模型状态和配置信息，兼容 Java ModelInfoResponse
    """
    classifier = get_classifier()
    info = classifier.get_model_info()

    # 转换为 Java 兼容格式
    return {
        "available": info.get("loaded", False),
        "model_path": info.get("model_path", ""),
        "num_labels": info.get("num_labels", 0),
        "device": info.get("device", "cpu"),
        "labels": list(classifier.id_to_label.values()) if classifier.id_to_label else []
    }


@router.get("/health")
async def classifier_health():
    """
    分类器健康检查

    Returns:
        服务健康状态，兼容 Java HealthResponse
    """
    classifier = get_classifier()
    is_loaded = classifier.is_loaded()

    return {
        "status": "healthy" if is_loaded else "degraded",
        "model_available": is_loaded,
        "error": None if is_loaded else "模型未加载"
    }
