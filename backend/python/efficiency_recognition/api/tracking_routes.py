"""
跨摄像头工人追踪 API 路由
提供工人识别、轨迹查询、拓扑配置等功能

API 端点:
- POST /tracking/identify - 识别画面中的工人
- GET /tracking/trajectory/{tracking_id} - 获取工人轨迹
- GET /tracking/record/{tracking_id} - 获取追踪记录详情
- POST /tracking/topology - 配置摄像头拓扑
- GET /tracking/topology - 获取拓扑配置
- POST /tracking/link - 关联追踪ID到系统工人
- GET /tracking/all - 获取所有追踪记录
"""

import base64
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field

from ..services.tracking_service import get_tracking_service

router = APIRouter(tags=["跨摄像头追踪"])


# ==================== 请求/响应模型 ====================

class IdentifyRequest(BaseModel):
    """工人识别请求"""
    image_base64: str = Field(..., description="Base64编码的图片")
    camera_id: str = Field(..., description="摄像头ID")
    timestamp: Optional[str] = Field(None, description="时间戳（ISO格式）")


class TopologyRequest(BaseModel):
    """摄像头拓扑配置请求"""
    camera_a_id: str = Field(..., description="摄像头A的ID")
    camera_b_id: str = Field(..., description="摄像头B的ID")
    transition_time_seconds: int = Field(30, description="两摄像头之间的典型移动时间（秒）")
    direction: str = Field(
        "BIDIRECTIONAL",
        description="方向: A_TO_B / B_TO_A / BIDIRECTIONAL"
    )


class LinkWorkerRequest(BaseModel):
    """关联工人请求"""
    tracking_id: str = Field(..., description="追踪ID")
    worker_id: int = Field(..., description="系统工人ID")


# ==================== API 端点 ====================

@router.post("/identify")
async def identify_workers(request: IdentifyRequest):
    """
    识别画面中的工人并匹配追踪记录

    使用 VL 模型提取工人全身特征（衣服、体型、工牌等），
    然后与已有的追踪记录进行匹配。

    Returns:
        识别到的工人列表，包含追踪ID和特征信息
    """
    tracking_service = get_tracking_service()

    timestamp = None
    if request.timestamp:
        try:
            timestamp = datetime.fromisoformat(request.timestamp)
        except ValueError:
            timestamp = datetime.now()

    try:
        results = await tracking_service.identify_workers(
            image_base64=request.image_base64,
            camera_id=request.camera_id,
            timestamp=timestamp
        )

        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "camera_id": request.camera_id,
            "workers": [
                {
                    "tracking_id": r.tracking_id,
                    "worker_id": r.worker_id,
                    "is_new": r.is_new,
                    "confidence": r.confidence,
                    "match_reason": r.match_reason,
                    "features": {
                        "badge_number": r.features.badge_number,
                        "clothing_upper": r.features.clothing_upper,
                        "clothing_lower": r.features.clothing_lower,
                        "body_type": r.features.body_type,
                        "height_estimate": r.features.height_estimate,
                        "safety_gear": r.features.safety_gear,
                        "position_in_frame": r.features.position_in_frame,
                        "action": r.features.action
                    }
                }
                for r in results
            ],
            "total_workers": len(results),
            "new_tracks": sum(1 for r in results if r.is_new)
        }

    except Exception as e:
        return {
            "success": False,
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }


@router.post("/identify-upload")
async def identify_workers_upload(
    file: UploadFile = File(...),
    camera_id: str = Form(...)
):
    """
    识别上传图片中的工人

    功能与 /identify 相同，但接受文件上传
    """
    content = await file.read()
    image_base64 = base64.b64encode(content).decode()

    request = IdentifyRequest(
        image_base64=image_base64,
        camera_id=camera_id
    )

    return await identify_workers(request)


@router.get("/trajectory/{tracking_id}")
async def get_trajectory(tracking_id: str):
    """
    获取工人的移动轨迹

    返回该追踪ID在各个摄像头之间的移动记录
    """
    tracking_service = get_tracking_service()

    trajectory = tracking_service.get_trajectory(tracking_id)

    if trajectory is None:
        raise HTTPException(
            status_code=404,
            detail=f"Tracking ID {tracking_id} not found"
        )

    return {
        "success": True,
        "tracking_id": tracking_id,
        "trajectory": trajectory,
        "point_count": len(trajectory)
    }


@router.get("/record/{tracking_id}")
async def get_tracking_record(tracking_id: str):
    """
    获取追踪记录详情

    包含工人特征、最后位置、出现次数等信息
    """
    tracking_service = get_tracking_service()

    record = tracking_service.get_tracking_record(tracking_id)

    if record is None:
        raise HTTPException(
            status_code=404,
            detail=f"Tracking ID {tracking_id} not found"
        )

    return {
        "success": True,
        **record
    }


@router.post("/topology")
async def set_camera_topology(request: TopologyRequest):
    """
    配置摄像头拓扑关系

    设置两个摄像头之间的空间关系，用于优化追踪匹配。
    transition_time_seconds 表示工人从一个摄像头移动到另一个的典型时间。
    """
    tracking_service = get_tracking_service()

    tracking_service.set_camera_topology(
        camera_a_id=request.camera_a_id,
        camera_b_id=request.camera_b_id,
        transition_time_seconds=request.transition_time_seconds,
        direction=request.direction
    )

    return {
        "success": True,
        "message": f"Topology set: {request.camera_a_id} <-> {request.camera_b_id}",
        "topology": {
            "camera_a_id": request.camera_a_id,
            "camera_b_id": request.camera_b_id,
            "transition_time_seconds": request.transition_time_seconds,
            "direction": request.direction
        }
    }


@router.get("/topology")
async def get_camera_topology():
    """获取所有摄像头拓扑配置"""
    tracking_service = get_tracking_service()

    topology = tracking_service.get_camera_topology()

    return {
        "success": True,
        "topology": topology,
        "total_relations": len(topology)
    }


@router.post("/link")
async def link_to_worker(request: LinkWorkerRequest):
    """
    将追踪ID关联到系统中的工人

    当确认某个追踪ID对应某个系统工人时，进行关联
    """
    tracking_service = get_tracking_service()

    success = tracking_service.link_to_worker(
        tracking_id=request.tracking_id,
        worker_id=request.worker_id
    )

    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Tracking ID {request.tracking_id} not found"
        )

    return {
        "success": True,
        "message": f"Linked tracking {request.tracking_id} to worker {request.worker_id}"
    }


@router.get("/all")
async def get_all_tracks():
    """
    获取所有追踪记录摘要

    返回当前所有活跃的追踪记录列表
    """
    tracking_service = get_tracking_service()

    tracks = tracking_service.get_all_tracks()

    return {
        "success": True,
        "tracks": tracks,
        "total": len(tracks)
    }


@router.get("/features/{tracking_id}")
async def get_worker_features(tracking_id: str):
    """
    获取工人的特征信息

    返回该追踪ID对应的工人全身特征
    """
    tracking_service = get_tracking_service()

    record = tracking_service.get_tracking_record(tracking_id)

    if record is None:
        raise HTTPException(
            status_code=404,
            detail=f"Tracking ID {tracking_id} not found"
        )

    return {
        "success": True,
        "tracking_id": tracking_id,
        "features": record.get("features", {})
    }


@router.get("/stats")
async def get_tracking_statistics():
    """
    获取追踪统计信息

    返回总追踪数、活跃追踪数、按摄像头分布等统计数据
    """
    tracking_service = get_tracking_service()
    stats = tracking_service.get_statistics()

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        **stats
    }


@router.delete("/cleanup")
async def cleanup_old_tracks(
    max_age_hours: int = 24,
    keep_linked: bool = True
):
    """
    清理旧的追踪记录

    Args:
        max_age_hours: 清理多少小时前的记录
        keep_linked: 是否保留已关联到系统工人的记录
    """
    tracking_service = get_tracking_service()
    result = tracking_service.cleanup_old_tracks(
        max_age_hours=max_age_hours,
        keep_linked=keep_linked
    )

    return {
        "success": True,
        "message": f"清理完成，移除 {result['removed_tracks']} 条记录",
        **result
    }


@router.get("/by-camera/{camera_id}")
async def get_tracks_by_camera(camera_id: str):
    """
    获取指定摄像头的追踪记录

    返回最后出现在该摄像头的所有追踪记录
    """
    tracking_service = get_tracking_service()
    tracks = tracking_service.get_tracks_by_camera(camera_id)

    return {
        "success": True,
        "camera_id": camera_id,
        "tracks": tracks,
        "total": len(tracks)
    }


@router.get("/search/badge")
async def search_by_badge(badge_number: str):
    """
    按工牌号搜索追踪记录

    支持部分匹配
    """
    tracking_service = get_tracking_service()
    results = tracking_service.search_by_badge(badge_number)

    return {
        "success": True,
        "query": badge_number,
        "results": results,
        "total": len(results)
    }


@router.get("/search/clothing")
async def search_by_clothing(color: str):
    """
    按衣着颜色搜索追踪记录

    在上衣和下装描述中搜索指定颜色
    """
    tracking_service = get_tracking_service()
    results = tracking_service.search_by_clothing(color)

    return {
        "success": True,
        "query": color,
        "results": results,
        "total": len(results)
    }


@router.get("/movement/{tracking_id}")
async def get_movement_summary(tracking_id: str):
    """
    获取工人移动摘要

    返回该工人在各摄像头之间的移动统计
    """
    tracking_service = get_tracking_service()
    summary = tracking_service.get_worker_movement_summary(tracking_id)

    if summary is None:
        raise HTTPException(
            status_code=404,
            detail=f"Tracking ID {tracking_id} not found"
        )

    return {
        "success": True,
        **summary
    }


@router.delete("/topology/{camera_a_id}/{camera_b_id}")
async def delete_camera_topology(camera_a_id: str, camera_b_id: str):
    """
    删除摄像头拓扑关系
    """
    tracking_service = get_tracking_service()

    key1 = f"{camera_a_id}_{camera_b_id}"
    key2 = f"{camera_b_id}_{camera_a_id}"

    deleted = False
    if key1 in tracking_service.camera_topology:
        del tracking_service.camera_topology[key1]
        deleted = True
    if key2 in tracking_service.camera_topology:
        del tracking_service.camera_topology[key2]
        deleted = True

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Topology not found: {camera_a_id} <-> {camera_b_id}"
        )

    return {
        "success": True,
        "message": f"Deleted topology: {camera_a_id} <-> {camera_b_id}"
    }
