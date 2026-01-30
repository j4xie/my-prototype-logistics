"""
多摄像头并行采集服务
支持同时从多个 RTSP 流采集帧并进行不同类型的分析

功能:
- 并行管理多个摄像头流
- 定时采集帧进行分析
- 支持多种分析类型（效率、OCR、计数）
- 自动同步结果到 Java 后端
- 本地预处理优化（减少不必要的 VL API 调用）

Phase 8 优化:
- 集成 LocalPreprocessor 进行帧差分检测
- 支持分层采样策略
- 背压控制防止内存溢出
"""

import os
import asyncio
import base64
import subprocess
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
import logging

logger = logging.getLogger(__name__)

# 导入本地预处理器
try:
    from .local_preprocessor import get_preprocessor, LocalPreprocessor
    LOCAL_PREPROCESSING_AVAILABLE = True
except ImportError:
    LOCAL_PREPROCESSING_AVAILABLE = False
    logger.warning("Local preprocessing not available")

# 导入成本监控器
try:
    from .cost_monitor import get_cost_monitor
    COST_MONITORING_AVAILABLE = True
except ImportError:
    COST_MONITORING_AVAILABLE = False
    logger.warning("Cost monitoring not available")


class AnalysisType(Enum):
    """分析类型"""
    EFFICIENCY = "efficiency"
    OCR = "ocr"
    COUNTING = "counting"
    MIXED = "mixed"


@dataclass
class StreamConfig:
    """流配置"""
    stream_id: str
    rtsp_url: str
    camera_id: str = ""
    location: str = ""
    analysis_type: str = "efficiency"
    interval_seconds: int = 60
    enabled: bool = True
    # Phase 8 优化选项
    use_local_preprocessing: bool = True  # 启用本地预处理
    skip_unchanged_frames: bool = True    # 跳过无变化帧


@dataclass
class StreamTask:
    """流任务状态"""
    config: StreamConfig
    is_active: bool = True
    frame_count: int = 0
    analyzed_count: int = 0       # Phase 8: 实际分析的帧数
    skipped_count: int = 0        # Phase 8: 跳过的帧数（预处理过滤）
    last_analysis_time: Optional[str] = None
    last_result: Optional[Dict] = None
    last_skip_reason: Optional[str] = None  # Phase 8: 最后跳过原因
    error_count: int = 0
    last_error: Optional[str] = None
    _task: Optional[asyncio.Task] = field(default=None, repr=False)


@dataclass
class AnalysisResult:
    """分析结果"""
    stream_id: str
    timestamp: str
    analysis_type: str
    success: bool
    data: Optional[Dict] = None
    error: Optional[str] = None


class MultiStreamSampler:
    """多摄像头并行采集和分析服务"""

    def __init__(
        self,
        max_concurrent: int = 8,
        analyzer=None,
        collector=None,
        on_result: Optional[Callable[[AnalysisResult], None]] = None
    ):
        """
        初始化多流采集器

        Args:
            max_concurrent: 最大并发流数量
            analyzer: VideoEfficiencyAnalyzer 实例
            collector: EfficiencyDataCollector 实例
            on_result: 分析结果回调函数
        """
        self.max_concurrent = max_concurrent
        self.executor = ThreadPoolExecutor(max_workers=max_concurrent)
        self.active_streams: Dict[str, StreamTask] = {}
        self._lock = threading.Lock()
        self._running = False

        # 懒加载分析器和收集器
        self._analyzer = analyzer
        self._collector = collector
        self._on_result = on_result
        self._preprocessor = None  # Phase 8: 本地预处理器

        # FFmpeg 路径
        self._ffmpeg_cmd = self._find_ffmpeg()

        # Phase 8: 全局统计
        self._global_stats = {
            "total_frames": 0,
            "analyzed_frames": 0,
            "skipped_frames": 0,
            "api_calls_saved": 0
        }

    def _find_ffmpeg(self) -> str:
        """查找 FFmpeg 可执行文件"""
        ffmpeg_paths = [
            r"C:\Users\Steve\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe",
            r"C:\Users\Steve\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe",
            r"C:\ffmpeg\bin\ffmpeg.exe",
            r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
            "/usr/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
            "ffmpeg",
        ]
        for p in ffmpeg_paths:
            if os.path.exists(p) or p == "ffmpeg":
                return p
        return "ffmpeg"

    @property
    def analyzer(self):
        """懒加载分析器"""
        if self._analyzer is None:
            from .video_analyzer import VideoEfficiencyAnalyzer
            self._analyzer = VideoEfficiencyAnalyzer()
        return self._analyzer

    @property
    def collector(self):
        """懒加载收集器"""
        if self._collector is None:
            from .data_collector import EfficiencyDataCollector
            self._collector = EfficiencyDataCollector()
        return self._collector

    @property
    def preprocessor(self):
        """懒加载本地预处理器（Phase 8 优化）"""
        if self._preprocessor is None and LOCAL_PREPROCESSING_AVAILABLE:
            self._preprocessor = get_preprocessor()
        return self._preprocessor

    def capture_frame(self, rtsp_url: str, timeout: int = 10) -> Optional[str]:
        """
        从 RTSP 流捕获单帧

        Args:
            rtsp_url: RTSP 流地址
            timeout: 超时时间（秒）

        Returns:
            Base64 编码的图片，失败返回 None
        """
        temp_file = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
        temp_path = temp_file.name
        temp_file.close()

        try:
            cmd = [
                self._ffmpeg_cmd,
                "-rtsp_transport", "tcp",
                "-i", rtsp_url,
                "-frames:v", "1",
                "-q:v", "2",
                "-y",
                temp_path
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout
            )

            if result.returncode != 0:
                logger.error(f"FFmpeg error: {result.stderr}")
                return None

            if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
                with open(temp_path, "rb") as f:
                    return base64.b64encode(f.read()).decode()

            return None

        except subprocess.TimeoutExpired:
            logger.error(f"Frame capture timeout for {rtsp_url}")
            return None
        except Exception as e:
            logger.error(f"Frame capture error: {e}")
            return None
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    async def add_stream(
        self,
        stream_id: str,
        rtsp_url: str,
        camera_id: str = "",
        location: str = "",
        analysis_type: str = "efficiency",
        interval_seconds: int = 60,
        use_local_preprocessing: bool = True,
        skip_unchanged_frames: bool = True
    ) -> Dict[str, Any]:
        """
        添加一个摄像头流到并行处理池

        Args:
            stream_id: 流唯一标识
            rtsp_url: RTSP 流地址
            camera_id: 摄像头ID
            location: 位置描述
            analysis_type: 分析类型
            interval_seconds: 采集间隔（秒）
            use_local_preprocessing: 启用本地预处理（Phase 8 优化）
            skip_unchanged_frames: 跳过无变化帧（Phase 8 优化）

        Returns:
            操作结果
        """
        with self._lock:
            if stream_id in self.active_streams:
                return {
                    "success": False,
                    "message": f"Stream {stream_id} already exists"
                }

            if len(self.active_streams) >= self.max_concurrent:
                return {
                    "success": False,
                    "message": f"Maximum concurrent streams ({self.max_concurrent}) reached"
                }

            config = StreamConfig(
                stream_id=stream_id,
                rtsp_url=rtsp_url,
                camera_id=camera_id or stream_id,
                location=location,
                analysis_type=analysis_type,
                interval_seconds=interval_seconds,
                use_local_preprocessing=use_local_preprocessing,
                skip_unchanged_frames=skip_unchanged_frames
            )

            task = StreamTask(config=config)
            self.active_streams[stream_id] = task

            # 启动采集循环
            task._task = asyncio.create_task(self._run_stream_loop(task))

            return {
                "success": True,
                "message": f"Stream {stream_id} added",
                "stream_id": stream_id,
                "preprocessing_enabled": use_local_preprocessing and LOCAL_PREPROCESSING_AVAILABLE
            }

    async def batch_add_streams(
        self,
        streams: List[Dict[str, Any]],
        default_interval: int = 60,
        default_preprocessing: bool = True
    ) -> Dict[str, Any]:
        """
        批量添加多个摄像头流

        Args:
            streams: 流配置列表
            default_interval: 默认采集间隔
            default_preprocessing: 默认启用本地预处理（Phase 8 优化）

        Returns:
            批量操作结果
        """
        results = []
        for stream in streams:
            result = await self.add_stream(
                stream_id=stream.get("stream_id"),
                rtsp_url=stream.get("rtsp_url"),
                camera_id=stream.get("camera_id", ""),
                location=stream.get("location", ""),
                analysis_type=stream.get("analysis_type", "efficiency"),
                interval_seconds=stream.get("interval_seconds", default_interval),
                use_local_preprocessing=stream.get("use_local_preprocessing", default_preprocessing),
                skip_unchanged_frames=stream.get("skip_unchanged_frames", default_preprocessing)
            )
            results.append({
                "stream_id": stream.get("stream_id"),
                **result
            })

        successful = sum(1 for r in results if r.get("success"))
        return {
            "success": True,
            "total": len(streams),
            "successful": successful,
            "failed": len(streams) - successful,
            "local_preprocessing_available": LOCAL_PREPROCESSING_AVAILABLE,
            "results": results
        }

    async def remove_stream(self, stream_id: str) -> Dict[str, Any]:
        """
        移除一个流

        Args:
            stream_id: 流标识

        Returns:
            操作结果
        """
        with self._lock:
            if stream_id not in self.active_streams:
                return {
                    "success": False,
                    "message": f"Stream {stream_id} not found"
                }

            task = self.active_streams[stream_id]
            task.is_active = False

            if task._task and not task._task.done():
                task._task.cancel()

            del self.active_streams[stream_id]

            return {
                "success": True,
                "message": f"Stream {stream_id} removed"
            }

    async def stop_all(self) -> Dict[str, Any]:
        """停止所有流"""
        stream_ids = list(self.active_streams.keys())
        for stream_id in stream_ids:
            await self.remove_stream(stream_id)

        return {
            "success": True,
            "message": f"Stopped {len(stream_ids)} streams"
        }

    def get_status(self) -> Dict[str, Any]:
        """获取所有流的状态（包含 Phase 8 优化统计）"""
        streams = {}
        for stream_id, task in self.active_streams.items():
            # 计算跳帧率
            skip_ratio = (
                task.skipped_count / task.frame_count
                if task.frame_count > 0 else 0
            )

            streams[stream_id] = {
                "rtsp_url": task.config.rtsp_url,
                "camera_id": task.config.camera_id,
                "location": task.config.location,
                "analysis_type": task.config.analysis_type,
                "interval_seconds": task.config.interval_seconds,
                "is_active": task.is_active,
                "frame_count": task.frame_count,
                "analyzed_count": task.analyzed_count,
                "skipped_count": task.skipped_count,
                "skip_ratio": round(skip_ratio, 4),
                "last_skip_reason": task.last_skip_reason,
                "last_analysis_time": task.last_analysis_time,
                "error_count": task.error_count,
                "last_error": task.last_error,
                "preprocessing_enabled": task.config.use_local_preprocessing
            }

        # 计算全局跳帧率
        global_skip_ratio = (
            self._global_stats["skipped_frames"] / self._global_stats["total_frames"]
            if self._global_stats["total_frames"] > 0 else 0
        )

        return {
            "active_streams": len(self.active_streams),
            "max_concurrent": self.max_concurrent,
            "local_preprocessing_available": LOCAL_PREPROCESSING_AVAILABLE,
            "global_stats": {
                "total_frames": self._global_stats["total_frames"],
                "analyzed_frames": self._global_stats["analyzed_frames"],
                "skipped_frames": self._global_stats["skipped_frames"],
                "api_calls_saved": self._global_stats["api_calls_saved"],
                "skip_ratio": round(global_skip_ratio, 4)
            },
            "streams": streams
        }

    def get_stream_status(self, stream_id: str) -> Optional[Dict[str, Any]]:
        """获取单个流的状态（包含 Phase 8 优化统计）"""
        if stream_id not in self.active_streams:
            return None

        task = self.active_streams[stream_id]

        # 计算跳帧率
        skip_ratio = (
            task.skipped_count / task.frame_count
            if task.frame_count > 0 else 0
        )

        return {
            "stream_id": stream_id,
            "config": {
                "rtsp_url": task.config.rtsp_url,
                "camera_id": task.config.camera_id,
                "location": task.config.location,
                "analysis_type": task.config.analysis_type,
                "interval_seconds": task.config.interval_seconds,
                "use_local_preprocessing": task.config.use_local_preprocessing,
                "skip_unchanged_frames": task.config.skip_unchanged_frames
            },
            "status": {
                "is_active": task.is_active,
                "frame_count": task.frame_count,
                "analyzed_count": task.analyzed_count,
                "skipped_count": task.skipped_count,
                "skip_ratio": round(skip_ratio, 4),
                "last_skip_reason": task.last_skip_reason,
                "last_analysis_time": task.last_analysis_time,
                "last_result": task.last_result,
                "error_count": task.error_count,
                "last_error": task.last_error
            }
        }

    def get_preprocessing_stats(self) -> Dict[str, Any]:
        """获取本地预处理统计（Phase 8 成本优化）"""
        if self.preprocessor is None:
            return {
                "available": False,
                "reason": "OpenCV not available" if not LOCAL_PREPROCESSING_AVAILABLE else "Not initialized"
            }

        preprocessor_stats = self.preprocessor.get_stats()

        return {
            "available": True,
            "opencv_available": LOCAL_PREPROCESSING_AVAILABLE,
            "preprocessor": preprocessor_stats,
            "sampler": {
                "total_frames": self._global_stats["total_frames"],
                "analyzed_frames": self._global_stats["analyzed_frames"],
                "skipped_frames": self._global_stats["skipped_frames"],
                "api_calls_saved": self._global_stats["api_calls_saved"]
            }
        }

    async def _run_stream_loop(self, task: StreamTask):
        """
        单个流的采集循环（Phase 8 优化：集成本地预处理）

        Args:
            task: 流任务
        """
        logger.info(f"Starting stream loop for {task.config.stream_id}")

        while task.is_active:
            try:
                # 捕获帧
                frame = await asyncio.get_event_loop().run_in_executor(
                    self.executor,
                    self.capture_frame,
                    task.config.rtsp_url
                )

                if frame is None:
                    task.error_count += 1
                    task.last_error = "Frame capture failed"
                    logger.warning(f"Frame capture failed for {task.config.stream_id}")
                    await asyncio.sleep(min(task.config.interval_seconds, 30))
                    continue

                task.frame_count += 1
                self._global_stats["total_frames"] += 1

                # Phase 8: 本地预处理检查（减少 VL API 调用）
                should_analyze = True
                skip_reason = None

                if (task.config.use_local_preprocessing and
                    task.config.skip_unchanged_frames and
                    self.preprocessor is not None):

                    preprocess_result = self.preprocessor.should_analyze(
                        frame,
                        device_id=task.config.stream_id
                    )

                    should_analyze = preprocess_result.should_analyze
                    skip_reason = preprocess_result.reason

                    if not should_analyze:
                        # 跳过此帧，不调用 VL API
                        task.skipped_count += 1
                        task.last_skip_reason = skip_reason
                        self._global_stats["skipped_frames"] += 1
                        self._global_stats["api_calls_saved"] += 1

                        # Phase 8.5: 记录跳过帧到成本监控器
                        if COST_MONITORING_AVAILABLE:
                            try:
                                cost_monitor = get_cost_monitor()
                                cost_monitor.record_skipped_frame()
                            except Exception:
                                pass  # 成本监控不影响主流程

                        logger.debug(
                            f"Skipped frame for {task.config.stream_id}: "
                            f"{skip_reason} (change={preprocess_result.change_ratio:.2%})"
                        )
                        await asyncio.sleep(task.config.interval_seconds)
                        continue

                # 执行 VL 分析
                task.analyzed_count += 1
                self._global_stats["analyzed_frames"] += 1

                result = await self._analyze_frame(frame, task.config)
                task.last_analysis_time = datetime.now().isoformat()
                task.last_result = result.data if result.success else None

                # Phase 8.5: 记录 API 调用到成本监控器
                if result.success and COST_MONITORING_AVAILABLE:
                    try:
                        cost_monitor = get_cost_monitor()
                        # 估算 token 消耗（根据分析类型）
                        input_tokens = 2000  # 图片 + prompt
                        output_tokens = 1000 if task.config.analysis_type != "mixed" else 2000
                        cost_monitor.record_api_call(
                            model="qwen-vl-plus",  # 默认模型
                            analysis_type=task.config.analysis_type,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            camera_id=task.config.camera_id,
                            stream_id=task.config.stream_id
                        )
                    except Exception:
                        pass  # 成本监控不影响主流程

                if not result.success:
                    task.error_count += 1
                    task.last_error = result.error

                # 回调处理
                if self._on_result:
                    self._on_result(result)

                # 自动提交到后端
                if result.success and result.data:
                    await self._submit_result(result, task.config)

            except asyncio.CancelledError:
                logger.info(f"Stream loop cancelled for {task.config.stream_id}")
                break
            except Exception as e:
                task.error_count += 1
                task.last_error = str(e)
                logger.error(f"Stream loop error for {task.config.stream_id}: {e}")

            await asyncio.sleep(task.config.interval_seconds)

        logger.info(f"Stream loop ended for {task.config.stream_id}")

    async def _analyze_frame(
        self,
        frame_base64: str,
        config: StreamConfig
    ) -> AnalysisResult:
        """
        分析单帧

        Args:
            frame_base64: Base64 编码的帧
            config: 流配置

        Returns:
            分析结果
        """
        try:
            analysis_type = config.analysis_type

            if analysis_type == "efficiency" or analysis_type == "mixed":
                result = self.analyzer.analyze_frame(
                    frame_base64,
                    frame_index=0,
                    context={"factory_type": "食品加工"}
                )
                data = {
                    "worker_count": result.worker_count,
                    "active_workers": result.active_workers,
                    "idle_workers": result.idle_workers,
                    "completed_actions": result.completed_actions,
                    "process_stage": result.process_stage,
                    "efficiency_score": result.efficiency_score,
                    "safety_issues": result.safety_issues
                }

                if analysis_type == "mixed":
                    # 添加 OCR 和计数结果
                    data["ocr"] = self.analyzer.analyze_ocr(frame_base64)
                    data["counting"] = self.analyzer.analyze_counting(frame_base64)

                return AnalysisResult(
                    stream_id=config.stream_id,
                    timestamp=datetime.now().isoformat(),
                    analysis_type=analysis_type,
                    success=True,
                    data=data
                )

            elif analysis_type == "ocr":
                result = self.analyzer.analyze_ocr(frame_base64)
                return AnalysisResult(
                    stream_id=config.stream_id,
                    timestamp=datetime.now().isoformat(),
                    analysis_type=analysis_type,
                    success=True,
                    data=result
                )

            elif analysis_type == "counting":
                result = self.analyzer.analyze_counting(frame_base64)
                return AnalysisResult(
                    stream_id=config.stream_id,
                    timestamp=datetime.now().isoformat(),
                    analysis_type=analysis_type,
                    success=True,
                    data=result
                )

            else:
                return AnalysisResult(
                    stream_id=config.stream_id,
                    timestamp=datetime.now().isoformat(),
                    analysis_type=analysis_type,
                    success=False,
                    error=f"Unknown analysis type: {analysis_type}"
                )

        except Exception as e:
            return AnalysisResult(
                stream_id=config.stream_id,
                timestamp=datetime.now().isoformat(),
                analysis_type=config.analysis_type,
                success=False,
                error=str(e)
            )

    async def _submit_result(
        self,
        result: AnalysisResult,
        config: StreamConfig
    ):
        """
        提交分析结果到 Java 后端

        Args:
            result: 分析结果
            config: 流配置
        """
        try:
            if result.analysis_type in ["efficiency", "mixed"]:
                collected = self.collector.convert_vl_result_to_efficiency_data(
                    result.data,
                    camera_id=config.camera_id,
                    location=config.location
                )
                request_data = self.collector.build_efficiency_record_request(collected)
                self.collector.submit_efficiency_record_sync(request_data)
                logger.debug(f"Submitted efficiency record for {config.stream_id}")

        except Exception as e:
            logger.error(f"Failed to submit result for {config.stream_id}: {e}")


# 全局实例
_sampler: Optional[MultiStreamSampler] = None


def get_sampler() -> MultiStreamSampler:
    """获取全局多流采集器实例"""
    global _sampler
    if _sampler is None:
        _sampler = MultiStreamSampler()
    return _sampler
