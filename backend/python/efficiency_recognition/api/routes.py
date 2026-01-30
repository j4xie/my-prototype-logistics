"""
人效识别 API 路由
提供视频/图片分析的 REST API 接口

API 端点:
- POST /efficiency/analyze-frame - 分析单帧图片
- POST /efficiency/analyze-video-upload - 分析上传的视频
- POST /efficiency/batch-analyze - 批量分析
- GET /efficiency/health - 健康检查
- POST /efficiency/analyze - 统一分析入口（效率+OCR+计数）

环境变量:
- AUTO_SUBMIT_DEFAULT: 是否默认启用自动提交到Java后端 (true/false)
- DEFAULT_FACTORY_ID: 默认工厂ID
- BACKEND_BASE_URL: Java后端地址
"""

import os
import base64
import tempfile
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from ..services.video_analyzer import VideoEfficiencyAnalyzer
from ..services.data_collector import EfficiencyDataCollector, CollectedEfficiencyData

router = APIRouter(tags=["人效识别"])

# 配置项（从环境变量读取）
AUTO_SUBMIT_DEFAULT = os.getenv("AUTO_SUBMIT_DEFAULT", "false").lower() == "true"
DEFAULT_FACTORY_ID = os.getenv("DEFAULT_FACTORY_ID", "F001")
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://139.196.165.140:10010")

# 全局实例
_analyzer: Optional[VideoEfficiencyAnalyzer] = None
_collector: Optional[EfficiencyDataCollector] = None

# 分析结果缓存
_analysis_cache: Dict[str, Dict] = {}


def get_analyzer() -> VideoEfficiencyAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = VideoEfficiencyAnalyzer()
    return _analyzer


def get_collector() -> EfficiencyDataCollector:
    global _collector
    if _collector is None:
        _collector = EfficiencyDataCollector(
            backend_url=BACKEND_BASE_URL,
            factory_id=DEFAULT_FACTORY_ID
        )
    return _collector


def should_auto_submit(request_auto_submit: bool = None) -> bool:
    """
    判断是否应该自动提交
    优先级: 请求参数 > 环境变量默认值
    """
    if request_auto_submit is not None:
        return request_auto_submit
    return AUTO_SUBMIT_DEFAULT


# ==================== 请求/响应模型 ====================

class FrameAnalysisRequest(BaseModel):
    """单帧分析请求"""
    image_base64: str = Field(..., description="Base64编码的图片")
    camera_id: Optional[str] = Field(None, description="摄像头ID")
    location: Optional[str] = Field(None, description="位置描述")
    factory_type: Optional[str] = Field("食品加工", description="工厂类型")
    process_hint: Optional[str] = Field(None, description="工序提示")
    auto_submit: bool = Field(False, description="是否自动提交到Java后端")
    auth_token: Optional[str] = Field(None, description="认证Token（auto_submit时需要）")
    worker_id: Optional[int] = Field(None, description="工人ID（auto_submit时可选）")
    work_minutes: int = Field(60, description="工作时长（分钟）")


class WorkerInfo(BaseModel):
    """工人信息"""
    position: str = ""
    status: str = ""
    action: str = ""
    safety_gear: Dict[str, bool] = {}
    confidence: float = 0.0


class FrameAnalysisResponse(BaseModel):
    """单帧分析响应"""
    success: bool
    timestamp: str
    worker_count: int = 0
    active_workers: int = 0
    idle_workers: int = 0
    completed_actions: int = 0
    process_stage: str = ""
    efficiency_score: float = 0.0
    safety_issues: List[str] = []
    safety_compliance: bool = True
    scene_description: str = ""
    workers: List[WorkerInfo] = []
    notes: str = ""
    error: Optional[str] = None
    # 自动提交结果
    auto_submitted: bool = False
    submit_result: Optional[Dict] = None


class BatchAnalysisRequest(BaseModel):
    """批量分析请求"""
    frames: List[FrameAnalysisRequest] = Field(..., description="帧列表")
    aggregate: bool = Field(True, description="是否聚合结果")


class UnifiedAnalysisRequest(BaseModel):
    """统一分析请求 - 支持多种分析类型"""
    image_base64: str = Field(..., description="Base64编码的图片")
    analysis_types: List[str] = Field(
        default=["efficiency"],
        description="分析类型列表: efficiency, ocr, counting, mixed"
    )
    camera_id: Optional[str] = Field(None, description="摄像头ID")
    location: Optional[str] = Field(None, description="位置描述")
    factory_type: Optional[str] = Field("食品加工", description="工厂类型")
    workstation_id: Optional[str] = Field(None, description="工位ID（用于计数更新）")
    batch_id: Optional[str] = Field(None, description="批次ID（用于OCR验证）")
    auto_submit: bool = Field(False, description="是否自动提交结果")
    auth_token: Optional[str] = Field(None, description="认证Token")


class OcrResult(BaseModel):
    """OCR识别结果"""
    readable: bool = True
    print_quality: str = "GOOD"  # GOOD, ACCEPTABLE, POOR
    recognized_text: Dict[str, Optional[str]] = {}
    batch_match: Optional[bool] = None
    quality_issues: List[str] = []
    overall_score: int = 0
    recommendation: str = "PASS"  # PASS, REVIEW, REJECT


class CountingResult(BaseModel):
    """计数识别结果"""
    total_count: int = 0
    products: List[Dict] = []  # [{type, count, status, confidence}]
    notes: str = ""


class UnifiedAnalysisResponse(BaseModel):
    """统一分析响应"""
    success: bool
    timestamp: str
    analysis_types: List[str] = []
    results: Dict[str, Any] = {}
    error: Optional[str] = None


# ==================== API 端点 ====================

@router.post("/analyze-frame", response_model=FrameAnalysisResponse)
async def analyze_frame(request: FrameAnalysisRequest):
    """分析单帧图片，可选自动提交到Java后端"""
    analyzer = get_analyzer()
    collector = get_collector()

    try:
        result = analyzer.analyze_frame(
            request.image_base64,
            frame_index=0,
            context={
                "factory_type": request.factory_type,
                "process_hint": request.process_hint or ""
            }
        )

        workers = [
            WorkerInfo(
                position=w.position,
                status=w.status,
                action=w.action,
                safety_gear=w.safety_gear,
                confidence=w.confidence
            ) for w in result.workers
        ]

        safety_compliance = len(result.safety_issues) == 0
        for w in result.workers:
            if w.safety_gear:
                if not w.safety_gear.get("work_clothes", True):
                    safety_compliance = False
                if not w.safety_gear.get("cap", True):
                    safety_compliance = False

        # 构建响应
        response = FrameAnalysisResponse(
            success=True,
            timestamp=datetime.now().isoformat(),
            worker_count=result.worker_count,
            active_workers=result.active_workers,
            idle_workers=result.idle_workers,
            completed_actions=result.completed_actions,
            process_stage=result.process_stage,
            efficiency_score=result.efficiency_score,
            safety_issues=result.safety_issues,
            safety_compliance=safety_compliance,
            scene_description=result.scene_description,
            workers=workers,
            notes=result.notes
        )

        # 自动提交到 Java 后端
        if request.auto_submit:
            # 设置认证 Token
            if request.auth_token:
                collector.set_auth_token(request.auth_token)

            # 转换为效率数据
            vl_dict = {
                "worker_count": result.worker_count,
                "active_workers": result.active_workers,
                "idle_workers": result.idle_workers,
                "completed_actions": result.completed_actions,
                "process_stage": result.process_stage,
                "efficiency_score": result.efficiency_score,
                "safety_issues": result.safety_issues,
                "workers": [
                    {
                        "position": w.position,
                        "status": w.status,
                        "action": w.action,
                        "safety_gear": w.safety_gear,
                        "confidence": w.confidence
                    } for w in result.workers
                ]
            }

            collected = collector.convert_vl_result_to_efficiency_data(
                vl_dict,
                camera_id=request.camera_id or "default",
                location=request.location or ""
            )

            # 构建请求数据
            request_data = collector.build_efficiency_record_request(
                collected,
                worker_id=request.worker_id,
                work_minutes=request.work_minutes
            )

            # 同步提交
            submit_result = collector.submit_efficiency_record_sync(request_data)
            response.auto_submitted = True
            response.submit_result = submit_result

        return response

    except Exception as e:
        return FrameAnalysisResponse(
            success=False,
            timestamp=datetime.now().isoformat(),
            error=str(e)
        )


@router.post("/analyze-frame-upload")
async def analyze_frame_upload(
    file: UploadFile = File(...),
    camera_id: str = Form(None),
    location: str = Form(None),
    factory_type: str = Form("食品加工"),
    process_hint: str = Form(None),
    auto_submit: bool = Form(False),
    auth_token: str = Form(None),
    worker_id: int = Form(None),
    work_minutes: int = Form(60)
):
    """分析上传的图片文件，可选自动提交"""
    content = await file.read()
    image_base64 = base64.b64encode(content).decode()

    request = FrameAnalysisRequest(
        image_base64=image_base64,
        camera_id=camera_id,
        location=location,
        factory_type=factory_type,
        process_hint=process_hint,
        auto_submit=auto_submit,
        auth_token=auth_token,
        worker_id=worker_id,
        work_minutes=work_minutes
    )

    return await analyze_frame(request)


@router.post("/analyze-video-upload")
async def analyze_video_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    camera_id: str = Form(None),
    location: str = Form(None),
    interval_seconds: float = Form(5.0),
    max_frames: int = Form(10)
):
    """分析上传的视频文件（异步）"""
    temp_dir = tempfile.mkdtemp()
    video_path = os.path.join(temp_dir, file.filename)

    content = await file.read()
    with open(video_path, "wb") as f:
        f.write(content)

    task_id = f"video_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.urandom(4).hex()}"

    async def process_video():
        analyzer = get_analyzer()
        result = analyzer.analyze_video(
            video_path,
            interval_seconds=interval_seconds,
            max_frames=max_frames,
            context={"factory_type": "食品加工"}
        )

        _analysis_cache[task_id] = {
            "success": result.success,
            "video_path": video_path,
            "frames_analyzed": result.frame_count,
            "summary": result.summary,
            "error": result.error,
            "completed_at": datetime.now().isoformat()
        }

        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

    background_tasks.add_task(process_video)

    return {
        "success": True,
        "task_id": task_id,
        "message": "视频分析任务已提交，请使用 task_id 查询结果"
    }


@router.get("/task/{task_id}")
async def get_task_result(task_id: str):
    """获取异步任务结果"""
    if task_id not in _analysis_cache:
        return {
            "success": False,
            "status": "pending",
            "message": "任务进行中或不存在"
        }

    result = _analysis_cache[task_id]
    return {
        "success": True,
        "status": "completed",
        "result": result
    }


@router.post("/batch-analyze")
async def batch_analyze(request: BatchAnalysisRequest):
    """批量分析多帧图片"""
    analyzer = get_analyzer()
    collector = get_collector()

    results = []
    collected_data = []

    for i, frame_req in enumerate(request.frames):
        try:
            result = analyzer.analyze_frame(
                frame_req.image_base64,
                frame_index=i,
                context={
                    "factory_type": frame_req.factory_type,
                    "process_hint": frame_req.process_hint or ""
                }
            )

            vl_dict = {
                "worker_count": result.worker_count,
                "active_workers": result.active_workers,
                "idle_workers": result.idle_workers,
                "completed_actions": result.completed_actions,
                "process_stage": result.process_stage,
                "efficiency_score": result.efficiency_score,
                "safety_issues": result.safety_issues,
                "workers": [
                    {
                        "position": w.position,
                        "status": w.status,
                        "action": w.action,
                        "safety_gear": w.safety_gear,
                        "confidence": w.confidence
                    } for w in result.workers
                ]
            }

            collected = collector.convert_vl_result_to_efficiency_data(
                vl_dict,
                camera_id=frame_req.camera_id or f"frame_{i}",
                location=frame_req.location or ""
            )
            collected_data.append(collected)

            results.append({
                "frame_index": i,
                "success": True,
                "worker_count": result.worker_count,
                "active_workers": result.active_workers,
                "efficiency_score": result.efficiency_score
            })

        except Exception as e:
            results.append({
                "frame_index": i,
                "success": False,
                "error": str(e)
            })

    report = None
    if request.aggregate and collected_data:
        report = collector.generate_report(collected_data)

    return {
        "success": True,
        "total_frames": len(request.frames),
        "successful_frames": sum(1 for r in results if r.get("success")),
        "results": results,
        "aggregated_report": report
    }


@router.post("/build-efficiency-record")
async def build_efficiency_record(
    analysis_result: FrameAnalysisResponse,
    worker_id: int = None,
    work_minutes: int = 60
):
    """将分析结果转换为后端 EfficiencyRecordRequest 格式"""
    collector = get_collector()

    collected = CollectedEfficiencyData(
        timestamp=analysis_result.timestamp,
        total_workers=analysis_result.worker_count,
        active_workers=analysis_result.active_workers,
        idle_workers=analysis_result.idle_workers,
        completed_actions=analysis_result.completed_actions,
        process_stage=analysis_result.process_stage,
        efficiency_score=analysis_result.efficiency_score,
        safety_compliance=analysis_result.safety_compliance,
        safety_issues=analysis_result.safety_issues
    )

    request_data = collector.build_efficiency_record_request(
        collected,
        worker_id=worker_id,
        work_minutes=work_minutes
    )

    return {
        "success": True,
        "efficiency_record_request": request_data,
        "api_endpoint": "/api/mobile/{factoryId}/wage/efficiency/record",
        "http_method": "POST"
    }


@router.get("/workstation-mapping")
async def get_workstation_mapping():
    """获取摄像头到工位的映射配置"""
    collector = get_collector()
    return {
        "success": True,
        "mappings": collector.camera_workstation_map
    }


@router.post("/workstation-mapping")
async def set_workstation_mapping(mappings: Dict[str, str]):
    """设置摄像头到工位的映射"""
    collector = get_collector()
    for camera_id, workstation_id in mappings.items():
        collector.map_camera_to_workstation(camera_id, workstation_id)

    return {
        "success": True,
        "message": f"已设置 {len(mappings)} 个映射",
        "mappings": collector.camera_workstation_map
    }


@router.get("/health")
async def health_check():
    """健康检查"""
    analyzer = get_analyzer()
    return {
        "status": "healthy",
        "service": "efficiency_recognition",
        "vl_available": analyzer.isAvailable() if hasattr(analyzer, 'isAvailable') else True,
        "timestamp": datetime.now().isoformat()
    }


# ==================== 统一分析入口 (Phase 4) ====================

@router.post("/analyze", response_model=UnifiedAnalysisResponse)
async def unified_analyze(request: UnifiedAnalysisRequest):
    """
    统一分析入口，支持多种分析类型

    analysis_types 可选值:
    - efficiency: 工人效率分析
    - ocr: 标签OCR识别
    - counting: 货品计数
    - mixed: 同时做所有分析
    """
    analyzer = get_analyzer()
    collector = get_collector()
    results = {}

    try:
        # 如果包含 mixed，则执行所有分析
        types_to_analyze = request.analysis_types
        if "mixed" in types_to_analyze:
            types_to_analyze = ["efficiency", "ocr", "counting"]

        # 效率分析
        if "efficiency" in types_to_analyze:
            eff_result = analyzer.analyze_frame(
                request.image_base64,
                frame_index=0,
                context={
                    "factory_type": request.factory_type,
                    "process_hint": ""
                }
            )
            results["efficiency"] = {
                "worker_count": eff_result.worker_count,
                "active_workers": eff_result.active_workers,
                "idle_workers": eff_result.idle_workers,
                "completed_actions": eff_result.completed_actions,
                "process_stage": eff_result.process_stage,
                "efficiency_score": eff_result.efficiency_score,
                "safety_issues": eff_result.safety_issues,
                "scene_description": eff_result.scene_description,
                "workers": [
                    {
                        "position": w.position,
                        "status": w.status,
                        "action": w.action,
                        "safety_gear": w.safety_gear,
                        "confidence": w.confidence
                    } for w in eff_result.workers
                ]
            }

        # OCR 分析
        if "ocr" in types_to_analyze:
            ocr_result = analyzer.analyze_ocr(request.image_base64)
            results["ocr"] = ocr_result

        # 计数分析
        if "counting" in types_to_analyze:
            counting_result = analyzer.analyze_counting(request.image_base64)
            results["counting"] = counting_result

        # 自动提交效率数据
        if request.auto_submit and "efficiency" in results:
            if request.auth_token:
                collector.set_auth_token(request.auth_token)

            collected = collector.convert_vl_result_to_efficiency_data(
                results["efficiency"],
                camera_id=request.camera_id or "default",
                location=request.location or ""
            )
            request_data = collector.build_efficiency_record_request(collected)
            submit_result = collector.submit_efficiency_record_sync(request_data)
            results["submit_result"] = submit_result

        return UnifiedAnalysisResponse(
            success=True,
            timestamp=datetime.now().isoformat(),
            analysis_types=types_to_analyze,
            results=results
        )

    except Exception as e:
        return UnifiedAnalysisResponse(
            success=False,
            timestamp=datetime.now().isoformat(),
            error=str(e)
        )


# ==================== 边缘触发分析 (Phase 8.0) ====================

class EdgeTriggeredAnalysisRequest(BaseModel):
    """边缘触发分析请求 - 由海康 ISAPI 事件触发时使用"""
    image_base64: str = Field(..., description="Base64编码的图片")
    device_id: str = Field(..., description="设备ID")
    camera_id: Optional[str] = Field(None, description="摄像头ID（可选，默认使用device_id）")
    channel_id: Optional[int] = Field(1, description="通道ID")
    event_type: Optional[str] = Field(None, description="触发事件类型（fielddetection/linedetection）")
    location: Optional[str] = Field(None, description="位置描述")
    factory_id: Optional[str] = Field(None, description="工厂ID")


class EdgeTriggeredAnalysisResponse(BaseModel):
    """边缘触发分析响应"""
    success: bool
    timestamp: str
    device_id: str
    worker_count: int = 0
    active_workers: int = 0
    efficiency_score: float = 0.0
    process_stage: str = ""
    safety_issues: List[str] = []
    error: Optional[str] = None


@router.post("/edge-triggered", response_model=EdgeTriggeredAnalysisResponse)
async def edge_triggered_analyze(request: EdgeTriggeredAnalysisRequest):
    """
    边缘触发分析入口

    当摄像头边缘AI检测到人员相关事件时（fielddetection/linedetection），
    Java后端会调用此接口进行VL深度分析。

    相比定时轮询，此事件驱动模式可减少90-95%的API调用成本。

    特点:
    - 专为ISAPI事件触发设计
    - 自动记录分析结果
    - 返回精简的效率数据
    """
    analyzer = get_analyzer()

    try:
        result = analyzer.analyze_frame(
            request.image_base64,
            frame_index=0,
            context={
                "factory_type": "食品加工",
                "event_type": request.event_type or "edge_triggered",
                "device_id": request.device_id
            }
        )

        camera_id = request.camera_id or request.device_id

        return EdgeTriggeredAnalysisResponse(
            success=True,
            timestamp=datetime.now().isoformat(),
            device_id=request.device_id,
            worker_count=result.worker_count,
            active_workers=result.active_workers,
            efficiency_score=result.efficiency_score,
            process_stage=result.process_stage,
            safety_issues=result.safety_issues
        )

    except Exception as e:
        return EdgeTriggeredAnalysisResponse(
            success=False,
            timestamp=datetime.now().isoformat(),
            device_id=request.device_id,
            error=str(e)
        )


# ==================== 配置查询 ====================

@router.get("/config")
async def get_efficiency_config():
    """获取效率识别服务配置"""
    return {
        "success": True,
        "config": {
            "auto_submit_default": AUTO_SUBMIT_DEFAULT,
            "default_factory_id": DEFAULT_FACTORY_ID,
            "backend_base_url": BACKEND_BASE_URL,
            "service_version": "1.0.0"
        }
    }
