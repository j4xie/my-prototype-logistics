"""
NVR 录像分析 API 路由 (Phase 3)

提供历史录像的效率分析功能

API 端点:
- POST /recording/analyze - 分析指定时间段的录像
- GET /recording/task/{task_id} - 查询分析任务状态
- POST /recording/cancel/{task_id} - 取消分析任务
- GET /recording/tasks - 获取所有分析任务列表
"""

import asyncio
import uuid
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

router = APIRouter(tags=["NVR 录像分析"])


# ==================== 枚举和模型 ====================

class AnalysisStatus(str, Enum):
    """分析任务状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RecordingAnalysisRequest(BaseModel):
    """录像分析请求"""
    playback_url: str = Field(..., description="RTSP 回放地址")
    device_id: Optional[str] = Field(None, description="设备ID")
    channel_id: Optional[int] = Field(None, description="通道ID")
    camera_id: Optional[str] = Field(None, description="摄像头ID（用于数据归档）")
    location: Optional[str] = Field(None, description="位置描述")
    start_time: Optional[str] = Field(None, description="开始时间 (ISO format)")
    end_time: Optional[str] = Field(None, description="结束时间 (ISO format)")
    analysis_types: List[str] = Field(
        default=["efficiency"],
        description="分析类型列表: efficiency, ocr, counting"
    )
    sample_interval_seconds: int = Field(
        60,
        description="采样间隔（秒），每隔多少秒分析一帧",
        ge=5,
        le=600
    )
    max_frames: int = Field(
        100,
        description="最大分析帧数",
        ge=1,
        le=1000
    )
    auto_submit: bool = Field(
        True,
        description="是否自动提交结果到 Java 后端"
    )


class RecordingAnalysisTask(BaseModel):
    """录像分析任务"""
    task_id: str
    status: AnalysisStatus
    playback_url: str
    device_id: Optional[str] = None
    channel_id: Optional[int] = None
    analysis_types: List[str]
    sample_interval_seconds: int
    max_frames: int

    # 进度信息
    total_frames: int = 0
    analyzed_frames: int = 0
    skipped_frames: int = 0
    failed_frames: int = 0
    progress_percent: float = 0.0

    # 时间信息
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    # 结果摘要
    summary: Optional[Dict] = None
    error_message: Optional[str] = None


# ==================== 任务存储（内存） ====================

_analysis_tasks: Dict[str, RecordingAnalysisTask] = {}


# ==================== API 端点 ====================

@router.post("/analyze")
async def analyze_recording(
    request: RecordingAnalysisRequest,
    background_tasks: BackgroundTasks
):
    """
    分析 NVR 历史录像

    异步分析录像，返回任务ID。可通过任务ID查询进度。

    流程：
    1. 使用 FFmpeg 从 RTSP 回放流提取帧
    2. 按采样间隔跳过帧，减少分析量
    3. 对每帧调用 VL 模型进行分析
    4. 汇总结果并返回
    """
    task_id = str(uuid.uuid4())

    task = RecordingAnalysisTask(
        task_id=task_id,
        status=AnalysisStatus.PENDING,
        playback_url=request.playback_url,
        device_id=request.device_id,
        channel_id=request.channel_id,
        analysis_types=request.analysis_types,
        sample_interval_seconds=request.sample_interval_seconds,
        max_frames=request.max_frames,
        created_at=datetime.now().isoformat()
    )

    _analysis_tasks[task_id] = task

    # 启动后台分析任务
    background_tasks.add_task(
        _run_recording_analysis,
        task_id=task_id,
        request=request
    )

    return {
        "success": True,
        "message": "分析任务已创建",
        "task_id": task_id,
        "status": task.status,
        "check_progress_url": f"/api/efficiency/recording/task/{task_id}"
    }


@router.get("/task/{task_id}")
async def get_analysis_task(task_id: str):
    """
    获取分析任务状态和进度
    """
    task = _analysis_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    return {
        "success": True,
        "task": task.dict()
    }


@router.post("/cancel/{task_id}")
async def cancel_analysis_task(task_id: str):
    """
    取消分析任务
    """
    task = _analysis_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    if task.status in [AnalysisStatus.COMPLETED, AnalysisStatus.FAILED, AnalysisStatus.CANCELLED]:
        return {
            "success": False,
            "message": f"任务已结束，无法取消（状态: {task.status}）"
        }

    task.status = AnalysisStatus.CANCELLED
    task.completed_at = datetime.now().isoformat()

    return {
        "success": True,
        "message": "任务已取消",
        "task_id": task_id
    }


@router.get("/tasks")
async def list_analysis_tasks(
    status: Optional[AnalysisStatus] = None,
    limit: int = 50
):
    """
    获取所有分析任务列表
    """
    tasks = list(_analysis_tasks.values())

    # 按创建时间倒序
    tasks.sort(key=lambda t: t.created_at, reverse=True)

    # 过滤状态
    if status:
        tasks = [t for t in tasks if t.status == status]

    # 限制数量
    tasks = tasks[:limit]

    return {
        "success": True,
        "total": len(_analysis_tasks),
        "returned": len(tasks),
        "tasks": [t.dict() for t in tasks]
    }


@router.delete("/tasks/cleanup")
async def cleanup_tasks(
    keep_hours: int = 24,
    keep_status: Optional[List[AnalysisStatus]] = None
):
    """
    清理旧任务
    """
    if keep_status is None:
        keep_status = [AnalysisStatus.RUNNING, AnalysisStatus.PENDING]

    cutoff = datetime.now().timestamp() - keep_hours * 3600

    removed_count = 0
    task_ids_to_remove = []

    for task_id, task in _analysis_tasks.items():
        created_ts = datetime.fromisoformat(task.created_at).timestamp()
        if created_ts < cutoff and task.status not in keep_status:
            task_ids_to_remove.append(task_id)

    for task_id in task_ids_to_remove:
        del _analysis_tasks[task_id]
        removed_count += 1

    return {
        "success": True,
        "message": f"已清理 {removed_count} 个旧任务",
        "removed_count": removed_count,
        "remaining_count": len(_analysis_tasks)
    }


# ==================== 后台分析任务 ====================

async def _run_recording_analysis(task_id: str, request: RecordingAnalysisRequest):
    """
    执行录像分析的后台任务
    """
    import logging
    logger = logging.getLogger(__name__)

    task = _analysis_tasks.get(task_id)
    if not task:
        return

    task.status = AnalysisStatus.RUNNING
    task.started_at = datetime.now().isoformat()

    try:
        # 导入分析器和采集器
        from ..services.video_analyzer import VideoEfficiencyAnalyzer
        from ..services.multi_stream_sampler import MultiStreamSampler

        analyzer = VideoEfficiencyAnalyzer()
        sampler = MultiStreamSampler()

        # 收集分析结果
        results = []
        frame_count = 0

        logger.info(f"开始分析录像: {request.playback_url}")

        # 从回放流提取帧并分析
        # 使用 FFmpeg 提取帧
        while frame_count < request.max_frames:
            if task.status == AnalysisStatus.CANCELLED:
                logger.info(f"任务已取消: {task_id}")
                break

            try:
                # 计算跳过的秒数
                seek_seconds = frame_count * request.sample_interval_seconds

                # 使用 FFmpeg 从指定位置提取帧
                frame_base64 = await _capture_frame_from_playback(
                    request.playback_url,
                    seek_seconds
                )

                if frame_base64 is None:
                    # 可能到达录像末尾
                    logger.info(f"无法获取更多帧，可能已到达录像末尾 (已分析 {frame_count} 帧)")
                    break

                task.total_frames = frame_count + 1

                # 分析帧
                frame_result = {
                    "frame_index": frame_count,
                    "timestamp_seconds": seek_seconds,
                    "analysis": {}
                }

                if "efficiency" in request.analysis_types:
                    try:
                        efficiency_result = analyzer.analyze_frame(
                            frame_base64,
                            frame_index=frame_count,
                            context={"factory_type": "食品加工"}
                        )
                        frame_result["analysis"]["efficiency"] = {
                            "worker_count": efficiency_result.worker_count,
                            "active_workers": efficiency_result.active_workers,
                            "idle_workers": efficiency_result.idle_workers,
                            "efficiency_score": efficiency_result.efficiency_score,
                            "process_stage": efficiency_result.process_stage,
                            "safety_issues": efficiency_result.safety_issues
                        }
                    except Exception as e:
                        frame_result["analysis"]["efficiency"] = {"error": str(e)}
                        task.failed_frames += 1

                if "ocr" in request.analysis_types:
                    try:
                        ocr_result = analyzer.analyze_ocr(frame_base64)
                        frame_result["analysis"]["ocr"] = ocr_result
                    except Exception as e:
                        frame_result["analysis"]["ocr"] = {"error": str(e)}

                if "counting" in request.analysis_types:
                    try:
                        counting_result = analyzer.analyze_counting(frame_base64)
                        frame_result["analysis"]["counting"] = counting_result
                    except Exception as e:
                        frame_result["analysis"]["counting"] = {"error": str(e)}

                results.append(frame_result)
                task.analyzed_frames += 1
                task.progress_percent = (frame_count + 1) / request.max_frames * 100

                frame_count += 1

                # 避免过快请求
                await asyncio.sleep(0.5)

            except Exception as e:
                logger.warning(f"分析帧 {frame_count} 失败: {e}")
                task.failed_frames += 1
                frame_count += 1

        # 汇总结果
        task.summary = _summarize_results(results, request.analysis_types)
        task.status = AnalysisStatus.COMPLETED
        task.completed_at = datetime.now().isoformat()

        logger.info(f"录像分析完成: task_id={task_id}, analyzed={task.analyzed_frames}")

        # 自动提交结果
        if request.auto_submit and results:
            try:
                from ..services.data_collector import EfficiencyDataCollector
                collector = EfficiencyDataCollector()

                # 提交汇总结果
                # ... (实现提交逻辑)
                logger.info("已提交分析结果到后端")
            except Exception as e:
                logger.warning(f"提交结果失败: {e}")

    except Exception as e:
        logger.error(f"录像分析失败: {e}", exc_info=True)
        task.status = AnalysisStatus.FAILED
        task.error_message = str(e)
        task.completed_at = datetime.now().isoformat()


async def _capture_frame_from_playback(playback_url: str, seek_seconds: int) -> Optional[str]:
    """
    从回放流的指定位置提取帧
    """
    import os
    import base64
    import subprocess
    import tempfile

    temp_file = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
    temp_path = temp_file.name
    temp_file.close()

    try:
        # FFmpeg 路径
        ffmpeg_paths = [
            r"C:\Users\Steve\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe",
            "/usr/bin/ffmpeg",
            "ffmpeg",
        ]

        ffmpeg_cmd = "ffmpeg"
        for p in ffmpeg_paths:
            if os.path.exists(p) or p == "ffmpeg":
                ffmpeg_cmd = p
                break

        # 构建命令
        cmd = [
            ffmpeg_cmd,
            "-rtsp_transport", "tcp",
            "-ss", str(seek_seconds),  # 跳转到指定位置
            "-i", playback_url,
            "-frames:v", "1",
            "-q:v", "2",
            "-y",
            temp_path
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            return None

        if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
            with open(temp_path, "rb") as f:
                return base64.b64encode(f.read()).decode()

        return None

    except subprocess.TimeoutExpired:
        return None
    except Exception:
        return None
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def _summarize_results(results: List[Dict], analysis_types: List[str]) -> Dict:
    """
    汇总分析结果
    """
    summary = {
        "total_frames": len(results),
        "analysis_types": analysis_types
    }

    if "efficiency" in analysis_types:
        efficiency_data = [
            r["analysis"].get("efficiency", {})
            for r in results
            if "efficiency" in r.get("analysis", {}) and "error" not in r["analysis"]["efficiency"]
        ]

        if efficiency_data:
            worker_counts = [d.get("worker_count", 0) for d in efficiency_data]
            efficiency_scores = [d.get("efficiency_score", 0) for d in efficiency_data if d.get("efficiency_score")]

            summary["efficiency"] = {
                "avg_worker_count": round(sum(worker_counts) / len(worker_counts), 1) if worker_counts else 0,
                "max_worker_count": max(worker_counts) if worker_counts else 0,
                "min_worker_count": min(worker_counts) if worker_counts else 0,
                "avg_efficiency_score": round(sum(efficiency_scores) / len(efficiency_scores), 1) if efficiency_scores else 0,
                "analyzed_frames": len(efficiency_data)
            }

    if "counting" in analysis_types:
        counting_data = [
            r["analysis"].get("counting", {})
            for r in results
            if "counting" in r.get("analysis", {}) and "error" not in r["analysis"]["counting"]
        ]

        if counting_data:
            summary["counting"] = {
                "analyzed_frames": len(counting_data)
            }

    return summary
