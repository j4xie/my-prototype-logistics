"""
LLM 动态场景理解 API 路由 (Phase 7)

提供场景理解和变化检测功能

API 端点:
- POST /scene/understand - LLM 理解当前场景
- POST /scene/detect-changes - LLM 检测场景变化
- GET /scene/current/{camera_id} - 获取当前场景理解
- GET /scene/history - 获取变化历史
- POST /scene/auto-adapt/{change_id} - 应用 LLM 建议的操作
- GET /scene/all - 获取所有摄像头场景摘要
- GET /scene/stats - 获取场景理解统计
"""

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.scene_understanding_service import get_scene_service

router = APIRouter(tags=["LLM 场景理解"])


# ==================== 请求/响应模型 ====================

class SceneUnderstandRequest(BaseModel):
    """场景理解请求"""
    image_base64: str = Field(..., description="Base64编码的图片")
    camera_id: str = Field(..., description="摄像头ID")
    save_reference: bool = Field(True, description="是否保存参考帧")


class ChangeDetectionRequest(BaseModel):
    """变化检测请求"""
    camera_id: str = Field(..., description="摄像头ID")
    current_frame_base64: str = Field(..., description="当前帧 Base64")


# ==================== API 端点 ====================

@router.post("/understand")
async def understand_scene(request: SceneUnderstandRequest):
    """
    LLM 理解当前场景

    使用 VL 模型分析图片，提取：
    - 场景描述
    - 设备识别
    - 工位识别
    - 区域划分
    - 工作流程推断
    """
    scene_service = get_scene_service()

    understanding = await scene_service.understand_scene(
        image_base64=request.image_base64,
        camera_id=request.camera_id,
        save_reference=request.save_reference
    )

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "scene_id": understanding.scene_id,
        "camera_id": understanding.camera_id,
        "scene_description": understanding.scene_description,
        "equipment": [
            {
                "name": e.name,
                "equipment_type": e.equipment_type,
                "location": e.location,
                "status": e.status,
                "confidence": e.confidence
            }
            for e in understanding.equipment
        ],
        "workstations": [
            {
                "station_id": w.station_id,
                "station_type": w.station_type,
                "location": w.location,
                "occupied": w.occupied,
                "worker_count": w.worker_count,
                "confidence": w.confidence
            }
            for w in understanding.workstations
        ],
        "zones": [
            {
                "name": z.name,
                "zone_type": z.zone_type,
                "boundaries": z.boundaries,
                "description": z.description
            }
            for z in understanding.zones
        ],
        "workflow_understanding": understanding.workflow_understanding,
        "confidence": understanding.confidence,
        "notes": understanding.notes
    }


@router.post("/detect-changes")
async def detect_scene_changes(request: ChangeDetectionRequest):
    """
    LLM 检测场景变化

    对比当前帧和上次场景理解，检测：
    - 设备变化（新增/移除/移动）
    - 工位变化
    - 区域调整
    - 并评估影响和提供建议
    """
    scene_service = get_scene_service()

    result = await scene_service.detect_changes(
        camera_id=request.camera_id,
        current_frame_base64=request.current_frame_base64
    )

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "change_id": result.change_id,
        "camera_id": result.camera_id,
        "has_changes": result.has_changes,
        "is_first_scan": result.is_first_scan,
        "change_summary": result.change_summary,
        "change_details": [
            {
                "change_type": d.change_type.value,
                "description": d.description,
                "old_value": d.old_value,
                "new_value": d.new_value,
                "location": d.location,
                "confidence": d.confidence
            }
            for d in result.change_details
        ],
        "impact_assessment": result.impact_assessment,
        "impact_level": result.impact_level.value,
        "suggested_actions": result.suggested_actions,
        "confidence": result.confidence
    }


@router.get("/current/{camera_id}")
async def get_current_scene(camera_id: str):
    """
    获取当前场景理解

    返回该摄像头最近一次的场景分析结果
    """
    scene_service = get_scene_service()

    understanding = scene_service.get_current_understanding(camera_id)

    if understanding is None:
        raise HTTPException(
            status_code=404,
            detail=f"No scene understanding found for camera: {camera_id}"
        )

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        **understanding
    }


@router.get("/history")
async def get_change_history(
    camera_id: str,
    limit: int = 50,
    only_applied: Optional[bool] = None
):
    """
    获取变化历史

    Args:
        camera_id: 摄像头ID
        limit: 返回数量限制
        only_applied: 是否只返回已应用的变化
    """
    scene_service = get_scene_service()

    changes = scene_service.get_change_history(
        camera_id=camera_id,
        limit=limit,
        only_applied=only_applied
    )

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "camera_id": camera_id,
        "changes": changes,
        "total": len(changes)
    }


@router.post("/auto-adapt/{change_id}")
async def auto_adapt_change(change_id: str):
    """
    应用 LLM 建议的操作

    根据变化检测的建议，自动调整监控配置
    """
    scene_service = get_scene_service()

    result = scene_service.auto_adapt(change_id)

    if not result.success and result.error_message:
        raise HTTPException(
            status_code=400,
            detail=result.error_message
        )

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "change_id": change_id,
        "applied_actions": result.applied_actions,
        "skipped_actions": result.skipped_actions,
        "message": f"Applied {len(result.applied_actions)} actions, skipped {len(result.skipped_actions)}"
    }


@router.get("/all")
async def get_all_scenes():
    """
    获取所有摄像头场景摘要

    返回系统中所有已分析摄像头的场景概览
    """
    scene_service = get_scene_service()

    scenes = scene_service.get_all_camera_scenes()

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "scenes": scenes,
        "total": len(scenes)
    }


@router.get("/stats")
async def get_scene_statistics():
    """
    获取场景理解统计

    返回总分析数、设备数、工位数、变化统计等
    """
    scene_service = get_scene_service()

    stats = scene_service.get_statistics()

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        **stats
    }


@router.delete("/camera/{camera_id}")
async def clear_camera_scene(camera_id: str):
    """
    清除摄像头的场景数据

    删除该摄像头的场景理解和变化历史
    """
    scene_service = get_scene_service()

    removed_understanding = False
    removed_history = False

    if camera_id in scene_service.scene_understandings:
        del scene_service.scene_understandings[camera_id]
        removed_understanding = True

    if camera_id in scene_service.change_history:
        del scene_service.change_history[camera_id]
        removed_history = True

    if not removed_understanding and not removed_history:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for camera: {camera_id}"
        )

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "message": f"Cleared scene data for camera {camera_id}",
        "removed_understanding": removed_understanding,
        "removed_history": removed_history
    }


@router.post("/compare")
async def compare_two_scenes(
    camera_id: str,
    image_a_base64: str,
    image_b_base64: str
):
    """
    比较两张图片的场景差异

    直接比较两张图片，不依赖历史数据
    """
    scene_service = get_scene_service()

    # 先理解第一张图
    understanding_a = await scene_service.understand_scene(
        image_base64=image_a_base64,
        camera_id=f"{camera_id}_temp_a",
        save_reference=False
    )

    # 保存为临时基准
    scene_service.scene_understandings[camera_id] = understanding_a
    scene_service.scene_understandings[camera_id].reference_frame_base64 = image_a_base64

    # 检测与第二张图的变化
    result = await scene_service.detect_changes(
        camera_id=camera_id,
        current_frame_base64=image_b_base64
    )

    # 清理临时数据
    if f"{camera_id}_temp_a" in scene_service.scene_understandings:
        del scene_service.scene_understandings[f"{camera_id}_temp_a"]

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "scene_a": {
            "scene_description": understanding_a.scene_description,
            "equipment_count": len(understanding_a.equipment),
            "workstation_count": len(understanding_a.workstations),
            "zone_count": len(understanding_a.zones)
        },
        "comparison": {
            "has_changes": result.has_changes,
            "change_summary": result.change_summary,
            "change_details": [
                {
                    "change_type": d.change_type.value,
                    "description": d.description,
                    "location": d.location
                }
                for d in result.change_details
            ],
            "impact_level": result.impact_level.value,
            "confidence": result.confidence
        }
    }
