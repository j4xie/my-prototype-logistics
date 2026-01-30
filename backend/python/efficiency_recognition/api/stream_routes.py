"""
多摄像头流管理 API 路由
提供摄像头流的添加、移除、状态查询等功能

API 端点:
- POST /streams/add - 添加单个摄像头流
- POST /streams/batch-add - 批量添加摄像头流
- POST /streams/remove - 移除摄像头流
- GET /streams/status - 获取所有流状态
- GET /streams/{stream_id}/status - 获取单个流状态
- POST /streams/stop-all - 停止所有流
- GET /streams/preprocessing-stats - 获取本地预处理统计（Phase 8 成本优化）
"""

from typing import Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.multi_stream_sampler import get_sampler, AnalysisType

router = APIRouter(tags=["多摄像头流管理"])


# ==================== 请求/响应模型 ====================

class AddStreamRequest(BaseModel):
    """添加流请求"""
    stream_id: str = Field(..., description="流唯一标识")
    rtsp_url: str = Field(..., description="RTSP 流地址")
    camera_id: Optional[str] = Field(None, description="摄像头ID")
    location: Optional[str] = Field(None, description="位置描述")
    analysis_type: str = Field(
        "efficiency",
        description="分析类型: efficiency, ocr, counting, mixed"
    )
    interval_seconds: int = Field(60, description="采集间隔（秒）", ge=10, le=3600)
    # Phase 8 成本优化选项
    use_local_preprocessing: bool = Field(
        True,
        description="启用本地预处理（OpenCV 帧差分检测，减少无效 VL API 调用）"
    )
    skip_unchanged_frames: bool = Field(
        True,
        description="跳过无变化帧（变化率低于阈值时不调用 VL API）"
    )


class BatchAddStreamsRequest(BaseModel):
    """批量添加流请求"""
    streams: List[AddStreamRequest] = Field(..., description="流配置列表")
    default_interval_seconds: int = Field(60, description="默认采集间隔")
    # Phase 8 成本优化: 批量默认配置
    default_preprocessing: bool = Field(
        True,
        description="批量添加时的默认预处理配置"
    )


class RemoveStreamRequest(BaseModel):
    """移除流请求"""
    stream_id: str = Field(..., description="流唯一标识")


# ==================== API 端点 ====================

@router.post("/add")
async def add_stream(request: AddStreamRequest):
    """
    添加单个摄像头流到并行处理池

    分析类型说明:
    - efficiency: 工人效率分析（默认）
    - ocr: 标签OCR识别
    - counting: 货品计数
    - mixed: 同时进行所有分析

    Phase 8 成本优化:
    - use_local_preprocessing: 启用本地预处理，减少无效 VL API 调用（默认开启）
    - skip_unchanged_frames: 跳过无变化帧，当帧差分变化率 < 5% 时不调用 VL（默认开启）
    """
    sampler = get_sampler()

    result = await sampler.add_stream(
        stream_id=request.stream_id,
        rtsp_url=request.rtsp_url,
        camera_id=request.camera_id or request.stream_id,
        location=request.location or "",
        analysis_type=request.analysis_type,
        interval_seconds=request.interval_seconds,
        use_local_preprocessing=request.use_local_preprocessing,
        skip_unchanged_frames=request.skip_unchanged_frames
    )

    return result


@router.post("/batch-add")
async def batch_add_streams(request: BatchAddStreamsRequest):
    """
    批量添加多个摄像头流

    一次性添加多个摄像头，适合初始化配置时使用

    Phase 8 成本优化:
    - 默认启用本地预处理，减少 40-60% 无效 VL API 调用
    - 每个流可单独配置是否启用预处理
    """
    sampler = get_sampler()

    streams_data = [
        {
            "stream_id": s.stream_id,
            "rtsp_url": s.rtsp_url,
            "camera_id": s.camera_id or s.stream_id,
            "location": s.location or "",
            "analysis_type": s.analysis_type,
            "interval_seconds": s.interval_seconds,
            "use_local_preprocessing": s.use_local_preprocessing,
            "skip_unchanged_frames": s.skip_unchanged_frames
        }
        for s in request.streams
    ]

    result = await sampler.batch_add_streams(
        streams=streams_data,
        default_interval=request.default_interval_seconds,
        default_preprocessing=request.default_preprocessing
    )

    return result


@router.post("/remove")
async def remove_stream(request: RemoveStreamRequest):
    """移除一个摄像头流"""
    sampler = get_sampler()
    result = await sampler.remove_stream(request.stream_id)
    return result


@router.get("/status")
async def get_all_streams_status():
    """获取所有流的状态"""
    sampler = get_sampler()
    status = sampler.get_status()

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        **status
    }


@router.get("/{stream_id}/status")
async def get_stream_status(stream_id: str):
    """获取单个流的状态"""
    sampler = get_sampler()
    status = sampler.get_stream_status(stream_id)

    if status is None:
        raise HTTPException(status_code=404, detail=f"Stream {stream_id} not found")

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        **status
    }


@router.post("/stop-all")
async def stop_all_streams():
    """停止所有流"""
    sampler = get_sampler()
    result = await sampler.stop_all()

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        **result
    }


@router.get("/analysis-types")
async def get_analysis_types():
    """获取支持的分析类型"""
    return {
        "success": True,
        "analysis_types": [
            {
                "type": "efficiency",
                "description": "工人效率分析 - 识别工人数量、状态、安全装备",
                "default": True
            },
            {
                "type": "ocr",
                "description": "标签OCR识别 - 识别批次号、生产日期等标签信息"
            },
            {
                "type": "counting",
                "description": "货品计数 - 识别并统计货品数量和类型"
            },
            {
                "type": "mixed",
                "description": "混合分析 - 同时进行效率、OCR和计数分析"
            }
        ]
    }


@router.get("/preprocessing-stats")
async def get_preprocessing_stats():
    """
    获取本地预处理统计（Phase 8 成本优化）

    返回本地预处理的效果统计，包括：
    - 跳过的帧数和比例
    - 节省的 VL API 调用次数
    - 预处理器状态

    通过本地预处理可以减少 40-60% 的 VL API 调用：
    - 帧差分检测：变化 < 5% 的帧直接跳过
    - 运动检测：无运动的帧跳过
    - 场景稳定性：连续3帧无变化则跳过
    """
    sampler = get_sampler()
    stats = sampler.get_preprocessing_stats()

    # 计算成本节省估算
    if stats.get("available") and stats.get("sampler"):
        saved_calls = stats["sampler"].get("api_calls_saved", 0)
        # 估算每次 VL 调用约 3000 tokens，按 qwen-vl-plus 价格 ¥0.012/千tokens
        estimated_cost_saved = saved_calls * 3000 * 0.012 / 1000
        stats["cost_optimization"] = {
            "api_calls_saved": saved_calls,
            "estimated_tokens_saved": saved_calls * 3000,
            "estimated_cost_saved_rmb": round(estimated_cost_saved, 2)
        }

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        **stats
    }
