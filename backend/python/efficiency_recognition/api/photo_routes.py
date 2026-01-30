"""
手动照片分析 API 路由
提供照片上传和分析功能（货品识别、OCR、计数）

API 端点:
- POST /photo/analyze - 分析上传的照片
- POST /photo/ocr - 仅OCR识别
- POST /photo/counting - 仅货品计数
"""

import base64
from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field

from ..services.video_analyzer import VideoEfficiencyAnalyzer

router = APIRouter(tags=["手动照片分析"])

# 全局分析器
_analyzer: Optional[VideoEfficiencyAnalyzer] = None


def get_analyzer() -> VideoEfficiencyAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = VideoEfficiencyAnalyzer()
    return _analyzer


# ==================== 请求/响应模型 ====================

class PhotoAnalysisRequest(BaseModel):
    """照片分析请求（Base64）"""
    image_base64: str = Field(..., description="Base64编码的图片")
    analysis_type: str = Field(
        "counting",
        description="分析类型: counting, ocr, both"
    )
    workstation_id: Optional[str] = Field(None, description="工位ID（用于更新计数）")
    batch_id: Optional[str] = Field(None, description="批次ID（用于OCR验证）")


class OcrOnlyRequest(BaseModel):
    """仅OCR请求"""
    image_base64: str = Field(..., description="Base64编码的图片")
    expected_batch_number: Optional[str] = Field(None, description="预期批次号（用于验证）")


class CountingOnlyRequest(BaseModel):
    """仅计数请求"""
    image_base64: str = Field(..., description="Base64编码的图片")
    expected_product_type: Optional[str] = Field(None, description="预期产品类型")


# ==================== API 端点 ====================

@router.post("/analyze")
async def analyze_photo(
    file: UploadFile = File(...),
    analysis_type: str = Form("counting"),
    workstation_id: Optional[str] = Form(None),
    batch_id: Optional[str] = Form(None)
):
    """
    分析上传的照片

    analysis_type 可选值:
    - counting: 货品识别和计数
    - ocr: 标签OCR识别
    - both: 同时进行计数和OCR

    Returns:
        分析结果，根据 analysis_type 包含不同内容
    """
    analyzer = get_analyzer()

    # 读取并编码图片
    content = await file.read()
    image_base64 = base64.b64encode(content).decode()

    results = {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "filename": file.filename,
        "analysis_type": analysis_type
    }

    try:
        if analysis_type in ["counting", "both"]:
            counting_result = analyzer.analyze_counting(image_base64)
            results["counting"] = counting_result

        if analysis_type in ["ocr", "both"]:
            ocr_result = analyzer.analyze_ocr(image_base64)
            results["ocr"] = ocr_result

            # 如果提供了批次ID，进行验证
            if batch_id and ocr_result.get("recognized_text"):
                detected_batch = ocr_result["recognized_text"].get("batch_number")
                results["batch_validation"] = {
                    "expected": batch_id,
                    "detected": detected_batch,
                    "match": detected_batch == batch_id if detected_batch else None
                }

        # 如果指定了工位ID且有计数结果，返回更新提示
        if workstation_id and "counting" in results:
            results["workstation_update"] = {
                "workstation_id": workstation_id,
                "count_to_add": results["counting"].get("total_count", 0),
                "note": "调用 /workstation-counting/{id}/manual-count 来更新工位计数"
            }

        return results

    except Exception as e:
        return {
            "success": False,
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }


@router.post("/analyze-base64")
async def analyze_photo_base64(request: PhotoAnalysisRequest):
    """
    分析 Base64 编码的照片

    与 /analyze 功能相同，但接受 JSON 请求体
    """
    analyzer = get_analyzer()

    results = {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "analysis_type": request.analysis_type
    }

    try:
        if request.analysis_type in ["counting", "both"]:
            counting_result = analyzer.analyze_counting(request.image_base64)
            results["counting"] = counting_result

        if request.analysis_type in ["ocr", "both"]:
            ocr_result = analyzer.analyze_ocr(request.image_base64)
            results["ocr"] = ocr_result

            if request.batch_id and ocr_result.get("recognized_text"):
                detected_batch = ocr_result["recognized_text"].get("batch_number")
                results["batch_validation"] = {
                    "expected": request.batch_id,
                    "detected": detected_batch,
                    "match": detected_batch == request.batch_id if detected_batch else None
                }

        if request.workstation_id and "counting" in results:
            results["workstation_update"] = {
                "workstation_id": request.workstation_id,
                "count_to_add": results["counting"].get("total_count", 0)
            }

        return results

    except Exception as e:
        return {
            "success": False,
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }


@router.post("/ocr")
async def ocr_only(
    file: UploadFile = File(...),
    expected_batch_number: Optional[str] = Form(None)
):
    """
    仅进行OCR识别

    专用于标签识别，返回详细的文字识别结果
    """
    analyzer = get_analyzer()

    content = await file.read()
    image_base64 = base64.b64encode(content).decode()

    try:
        ocr_result = analyzer.analyze_ocr(image_base64)

        result = {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "filename": file.filename,
            **ocr_result
        }

        # 批次号验证
        if expected_batch_number and ocr_result.get("recognized_text"):
            detected = ocr_result["recognized_text"].get("batch_number")
            result["validation"] = {
                "expected_batch_number": expected_batch_number,
                "detected_batch_number": detected,
                "match": detected == expected_batch_number if detected else False,
                "confidence": "high" if detected == expected_batch_number else "needs_review"
            }

        return result

    except Exception as e:
        return {
            "success": False,
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }


@router.post("/ocr-base64")
async def ocr_only_base64(request: OcrOnlyRequest):
    """仅OCR识别（Base64输入）"""
    analyzer = get_analyzer()

    try:
        ocr_result = analyzer.analyze_ocr(request.image_base64)

        result = {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            **ocr_result
        }

        if request.expected_batch_number and ocr_result.get("recognized_text"):
            detected = ocr_result["recognized_text"].get("batch_number")
            result["validation"] = {
                "expected_batch_number": request.expected_batch_number,
                "detected_batch_number": detected,
                "match": detected == request.expected_batch_number if detected else False
            }

        return result

    except Exception as e:
        return {
            "success": False,
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }


@router.post("/counting")
async def counting_only(
    file: UploadFile = File(...),
    expected_product_type: Optional[str] = Form(None)
):
    """
    仅进行货品计数

    专用于货品识别和计数
    """
    analyzer = get_analyzer()

    content = await file.read()
    image_base64 = base64.b64encode(content).decode()

    try:
        counting_result = analyzer.analyze_counting(image_base64)

        result = {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "filename": file.filename,
            **counting_result
        }

        # 产品类型验证
        if expected_product_type and counting_result.get("products"):
            detected_types = [p.get("product_type") for p in counting_result["products"]]
            result["product_validation"] = {
                "expected_type": expected_product_type,
                "detected_types": detected_types,
                "type_found": expected_product_type in detected_types
            }

        return result

    except Exception as e:
        return {
            "success": False,
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }


@router.post("/counting-base64")
async def counting_only_base64(request: CountingOnlyRequest):
    """仅货品计数（Base64输入）"""
    analyzer = get_analyzer()

    try:
        counting_result = analyzer.analyze_counting(request.image_base64)

        result = {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            **counting_result
        }

        if request.expected_product_type and counting_result.get("products"):
            detected_types = [p.get("product_type") for p in counting_result["products"]]
            result["product_validation"] = {
                "expected_type": request.expected_product_type,
                "detected_types": detected_types,
                "type_found": request.expected_product_type in detected_types
            }

        return result

    except Exception as e:
        return {
            "success": False,
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }
