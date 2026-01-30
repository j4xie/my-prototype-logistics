"""
人效识别服务层

- video_analyzer: VL 视频/图片分析
- data_collector: 数据采集和后端对接
- multi_stream_sampler: 多摄像头并行采集
- tracking_service: 跨摄像头工人追踪
"""

from .video_analyzer import VideoEfficiencyAnalyzer, EfficiencySnapshot, WorkerDetection, VideoAnalysisResult
from .data_collector import EfficiencyDataCollector, CollectedEfficiencyData, WorkerEfficiencyData, ProcessStageType
from .multi_stream_sampler import MultiStreamSampler, get_sampler, StreamConfig, AnalysisType
from .tracking_service import WorkerTrackingService, get_tracking_service, WorkerFeatures, TrackingRecord

__all__ = [
    # Video Analyzer
    "VideoEfficiencyAnalyzer",
    "EfficiencySnapshot",
    "WorkerDetection",
    "VideoAnalysisResult",
    # Data Collector
    "EfficiencyDataCollector",
    "CollectedEfficiencyData",
    "WorkerEfficiencyData",
    "ProcessStageType",
    # Multi-Stream Sampler
    "MultiStreamSampler",
    "get_sampler",
    "StreamConfig",
    "AnalysisType",
    # Tracking Service
    "WorkerTrackingService",
    "get_tracking_service",
    "WorkerFeatures",
    "TrackingRecord",
]
