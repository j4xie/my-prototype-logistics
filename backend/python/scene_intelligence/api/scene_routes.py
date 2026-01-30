"""
场景智能 API 路由
提供场景理解、变化检测、自动适应等功能

API 端点:
- POST /scene/understand - LLM 理解当前场景
- POST /scene/detect-changes - LLM 检测场景变化
- GET /scene/current/{camera_id} - 获取当前场景理解
- GET /scene/history - 获取变化历史
- GET /scene/change/{change_id} - 获取变化详情
- POST /scene/auto-adapt/{change_id} - 应用 LLM 建议的操作
- GET /scene/all-cameras - 获取所有摄像头的场景摘要
"""

import base64
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field

from ..services.scene_understanding_service import get_scene_service

router = APIRouter(tags=["场景智能"])


# ==================== 请求/响应模型 ====================

class UnderstandSceneRequest(BaseModel):
    """场景理解请求"""
    image_base64: str = Field(..., description="Base64编码的图片")
    camera_id: str = Field(..., description="摄像头ID")


class DetectChangesRequest(BaseModel):
    """变化检测请求"""
    camera_id: str = Field(..., description="摄像头ID")
    current_frame_base64: str = Field(..., description="当前帧 Base64")


# ==================== API 端点 ====================

@router.post("/understand")
async def understand_scene(request: UnderstandSceneRequest):
    """
    LLM 理解当前场景

    让 LLM 分析图片，自动识别：
    - 设备及其状态
    - 工位和工作区域
    - 区域划分
    - 工作流程

    首次调用时会建立该摄像头的场景基线。
    """
    scene_service = get_scene_service()

    try:
        understanding = await scene_service.understand_scene(
            image_base64=request.image_base64,
            camera_id=request.camera_id
        )

        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "camera_id": request.camera_id,
            "scene_description": understanding.scene_description,
            "equipment": [
                {
                    "name": e.name,
                    "location": e.location,
                    "status": e.status,
                    "equipment_type": e.equipment_type
                }
                for e in understanding.equipment
            ],
            "workstations": [
                {
                    "id": w.id,
                    "type": w.workstation_type,
                    "occupied": w.occupied,
                    "location": w.location
                }
                for w in understanding.workstations
            ],
            "zones": [
                {
                    "name": z.name,
                    "type": z.zone_type,
                    "boundaries": z.boundaries
                }
                for z in understanding.zones
            ],
            "workflow_understanding": understanding.workflow_understanding
        }

    except Exception as e:
        return {
            "success": False,
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }


@router.post("/understand-upload")
async def understand_scene_upload(
    file: UploadFile = File(...),
    camera_id: str = Form(...)
):
    """
    LLM 理解上传的图片场景

    功能与 /understand 相同，但接受文件上传
    """
    content = await file.read()
    image_base64 = base64.b64encode(content).decode()

    request = UnderstandSceneRequest(
        image_base64=image_base64,
        camera_id=camera_id
    )

    return await understand_scene(request)


@router.post("/detect-changes")
async def detect_changes(request: DetectChangesRequest):
    """
    LLM 检测场景变化

    将当前帧与之前记录的场景进行对比，检测：
    - 设备变化（新增/移除/移动）
    - 工位变化
    - 区域调整

    并提供影响评估和建议操作。
    """
    scene_service = get_scene_service()

    try:
        change = await scene_service.detect_changes(
            camera_id=request.camera_id,
            current_frame_base64=request.current_frame_base64
        )

        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "change_id": change.change_id,
            "camera_id": change.camera_id,
            "has_changes": change.has_changes,
            "change_summary": change.change_summary,
            "change_details": change.change_details,
            "impact_assessment": change.impact_assessment,
            "suggested_actions": change.suggested_actions,
            "confidence": change.confidence
        }

    except Exception as e:
        return {
            "success": False,
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }


@router.post("/detect-changes-upload")
async def detect_changes_upload(
    file: UploadFile = File(...),
    camera_id: str = Form(...)
):
    """
    LLM 检测上传图片的场景变化
    """
    content = await file.read()
    image_base64 = base64.b64encode(content).decode()

    request = DetectChangesRequest(
        camera_id=camera_id,
        current_frame_base64=image_base64
    )

    return await detect_changes(request)


@router.get("/current/{camera_id}")
async def get_current_understanding(camera_id: str):
    """
    获取当前场景理解

    返回该摄像头最近一次的场景分析结果
    """
    scene_service = get_scene_service()

    understanding = scene_service.get_current_understanding(camera_id)

    if understanding is None:
        raise HTTPException(
            status_code=404,
            detail=f"No scene understanding found for camera {camera_id}"
        )

    return {
        "success": True,
        **understanding
    }


@router.get("/history")
async def get_change_history(
    camera_id: Optional[str] = None,
    limit: int = 20
):
    """
    获取变化历史

    Args:
        camera_id: 可选，筛选特定摄像头
        limit: 返回数量限制（默认20）
    """
    scene_service = get_scene_service()

    history = scene_service.get_change_history(
        camera_id=camera_id,
        limit=limit
    )

    return {
        "success": True,
        "history": history,
        "total": len(history)
    }


@router.get("/change/{change_id}")
async def get_change_detail(change_id: str):
    """
    获取变化详情

    返回变化的完整信息，包括具体变化内容和建议操作
    """
    scene_service = get_scene_service()

    change = scene_service.get_change(change_id)

    if change is None:
        raise HTTPException(
            status_code=404,
            detail=f"Change {change_id} not found"
        )

    return {
        "success": True,
        **change
    }


@router.post("/auto-adapt/{change_id}")
async def auto_adapt(change_id: str):
    """
    应用 LLM 建议的操作

    根据变化检测的建议，自动执行适应性调整。
    目前支持的操作类型:
    - update_detection_zone: 更新检测区域
    - add_workstation: 注册新工位
    - update_counting_rule: 更新计数规则
    - recalibrate: 重新校准

    注意：此操作需要人工确认后执行，以确保安全。
    """
    scene_service = get_scene_service()

    change = scene_service.get_change(change_id)

    if change is None:
        raise HTTPException(
            status_code=404,
            detail=f"Change {change_id} not found"
        )

    if change.get("applied"):
        return {
            "success": False,
            "message": "Change has already been applied"
        }

    # 标记为已应用
    scene_service.mark_change_applied(change_id)

    # 实际的适应性操作在这里实现
    # 目前只是记录，实际操作需要根据系统集成情况实现
    applied_actions = []
    for action in change.get("suggested_actions", []):
        action_type = action.get("type")
        if action_type == "update_detection_zone":
            # TODO: 实际更新检测区域
            applied_actions.append({
                "type": action_type,
                "status": "recorded",
                "note": "Detection zone update recorded for manual review"
            })
        elif action_type == "add_workstation":
            # TODO: 实际添加工位
            applied_actions.append({
                "type": action_type,
                "status": "recorded",
                "note": "Workstation addition recorded for manual review"
            })
        elif action_type == "update_counting_rule":
            # TODO: 实际更新计数规则
            applied_actions.append({
                "type": action_type,
                "status": "recorded",
                "note": "Counting rule update recorded for manual review"
            })
        else:
            applied_actions.append({
                "type": action_type,
                "status": "skipped",
                "note": "Action type not implemented"
            })

    return {
        "success": True,
        "change_id": change_id,
        "message": "Change adaptation recorded",
        "applied_actions": applied_actions,
        "note": "Actions have been recorded. Some may require manual review before taking effect."
    }


@router.get("/all-cameras")
async def get_all_cameras_understanding():
    """
    获取所有摄像头的场景理解摘要

    返回系统中所有已分析摄像头的简要信息
    """
    scene_service = get_scene_service()

    summaries = scene_service.get_all_cameras_understanding()

    return {
        "success": True,
        "cameras": summaries,
        "total": len(summaries)
    }
