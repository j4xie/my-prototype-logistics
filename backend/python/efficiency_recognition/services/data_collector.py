"""
人效数据采集服务
将 VL 模型识别结果转换并写入后端系统

数据流:
摄像头视频 -> VL识别 -> 数据标准化 -> 后端API -> 数据库

对接的后端API:
- POST /api/mobile/{factoryId}/work-sessions/start - 开始工作会话
- POST /api/mobile/{factoryId}/work-sessions/end - 结束工作会话
- POST /api/mobile/{factoryId}/wage/efficiency/record - 记录效率数据
"""

import os
import json
import httpx
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path


def load_config():
    env_paths = [
        Path(__file__).parent.parent / ".env",
        Path(__file__).parent.parent.parent / "smartbi" / ".env",
        Path.cwd() / ".env",
    ]
    for env_path in env_paths:
        if env_path.exists():
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip()


load_config()

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://139.196.165.140:10010")
FACTORY_ID = os.getenv("DEFAULT_FACTORY_ID", "F001")


class ProcessStageType(Enum):
    """工序类型枚举 - 与后端 ProcessStageType 对应"""
    RECEIVING = "RECEIVING"
    SLAUGHTER = "SLAUGHTER"
    CUTTING = "CUTTING"
    PROCESSING = "PROCESSING"
    PACKAGING = "PACKAGING"
    COLD_STORAGE = "COLD_STORAGE"
    SHIPPING = "SHIPPING"
    QUALITY_CHECK = "QUALITY_CHECK"
    CLEANING = "CLEANING"
    MIXING = "MIXING"
    FILLING = "FILLING"


SCENE_TO_PROCESS = {
    "灌装": ProcessStageType.FILLING,
    "包装": ProcessStageType.PACKAGING,
    "化料": ProcessStageType.MIXING,
    "分割": ProcessStageType.CUTTING,
    "屠宰": ProcessStageType.SLAUGHTER,
    "冷藏": ProcessStageType.COLD_STORAGE,
    "质检": ProcessStageType.QUALITY_CHECK,
    "清洗": ProcessStageType.CLEANING,
    "收货": ProcessStageType.RECEIVING,
    "发货": ProcessStageType.SHIPPING,
    "加工": ProcessStageType.PROCESSING,
}


@dataclass
class WorkerEfficiencyData:
    """工人效率数据 - 对应 EfficiencyRecordRequest"""
    worker_id: Optional[int] = None
    piece_count: int = 0
    work_minutes: int = 0
    process_stage_type: str = ""
    work_date: str = ""
    workstation_id: Optional[str] = None
    product_type_id: Optional[str] = None
    qualified_count: int = 0
    notes: str = ""


@dataclass
class WorkSessionData:
    """工作会话数据 - 对应 EmployeeWorkSession"""
    user_id: int = 0
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    break_minutes: int = 0
    workstation_id: Optional[str] = None


@dataclass
class SafetyComplianceData:
    """安全合规数据"""
    worker_id: Optional[int] = None
    timestamp: str = ""
    work_clothes: bool = False
    gloves: bool = False
    mask: bool = False
    cap: bool = False
    apron: bool = False
    issues: List[str] = field(default_factory=list)


@dataclass
class CollectedEfficiencyData:
    """采集的完整效率数据"""
    timestamp: str = ""
    camera_id: str = ""
    location: str = ""

    total_workers: int = 0
    active_workers: int = 0
    idle_workers: int = 0
    worker_details: List[Dict] = field(default_factory=list)

    process_stage: str = ""
    completed_actions: int = 0
    efficiency_score: float = 0.0

    safety_compliance: bool = True
    safety_issues: List[str] = field(default_factory=list)

    raw_recognition: Dict = field(default_factory=dict)


class EfficiencyDataCollector:
    """人效数据采集器"""

    def __init__(self, backend_url: str = None, factory_id: str = None, auth_token: str = None):
        self.backend_url = backend_url or BACKEND_BASE_URL
        self.factory_id = factory_id or FACTORY_ID
        self.auth_token = auth_token
        self.client = httpx.Client(timeout=30.0)

        self.camera_workstation_map: Dict[str, str] = {}
        self.worker_cache: Dict[str, int] = {}
        self.accumulated_data: Dict[str, CollectedEfficiencyData] = {}

    def set_auth_token(self, token: str):
        """设置认证 Token"""
        self.auth_token = token

    def map_camera_to_workstation(self, camera_id: str, workstation_id: str):
        """映射摄像头到工位"""
        self.camera_workstation_map[camera_id] = workstation_id

    def map_scene_to_process(self, scene_description: str) -> Optional[ProcessStageType]:
        """将场景描述映射到工序类型"""
        for keyword, process_type in SCENE_TO_PROCESS.items():
            if keyword in scene_description:
                return process_type

        keyword_map = {
            ("瓶", "罐", "液体", "饮料"): ProcessStageType.FILLING,
            ("箱", "装箱", "封箱", "打包"): ProcessStageType.PACKAGING,
            ("原料", "配料", "搅拌", "碎冰"): ProcessStageType.MIXING,
            ("切", "分", "肉"): ProcessStageType.CUTTING,
            ("检", "测", "抽检"): ProcessStageType.QUALITY_CHECK,
            ("洗", "清洁", "消毒"): ProcessStageType.CLEANING,
            ("冷", "冰", "冻"): ProcessStageType.COLD_STORAGE,
        }

        for keywords, process_type in keyword_map.items():
            if any(kw in scene_description for kw in keywords):
                return process_type

        return ProcessStageType.PROCESSING

    def convert_vl_result_to_efficiency_data(
        self,
        vl_result: Dict,
        camera_id: str = "",
        location: str = ""
    ) -> CollectedEfficiencyData:
        """将 VL 识别结果转换为标准效率数据"""
        data = CollectedEfficiencyData(
            timestamp=datetime.now().isoformat(),
            camera_id=camera_id,
            location=location,
            raw_recognition=vl_result
        )

        data.total_workers = vl_result.get("worker_count", 0)
        data.active_workers = vl_result.get("active_workers", 0)
        data.idle_workers = vl_result.get("idle_workers", 0)

        workers = vl_result.get("workers", [])
        for w in workers:
            worker_detail = {
                "position": w.get("position", ""),
                "status": w.get("status", ""),
                "action": w.get("action", ""),
                "safety_gear": w.get("safety_gear", {}),
                "confidence": w.get("confidence", 0.0)
            }
            data.worker_details.append(worker_detail)

            safety_gear = w.get("safety_gear", {})
            if not safety_gear.get("work_clothes", True):
                data.safety_issues.append("未穿工作服")
                data.safety_compliance = False
            if not safety_gear.get("cap", True):
                data.safety_issues.append("未戴卫生帽")
                data.safety_compliance = False

        data.process_stage = vl_result.get("process_stage", "")
        data.completed_actions = vl_result.get("completed_actions", 0)
        data.efficiency_score = vl_result.get("efficiency_score", 0.0)

        safety_issues = vl_result.get("safety_issues", [])
        data.safety_issues.extend(safety_issues)
        if safety_issues:
            data.safety_compliance = False

        return data

    def accumulate_data(self, key: str, data: CollectedEfficiencyData):
        """累积数据（用于聚合多帧/多时段的识别结果）"""
        if key not in self.accumulated_data:
            self.accumulated_data[key] = data
        else:
            existing = self.accumulated_data[key]
            existing.total_workers = max(existing.total_workers, data.total_workers)
            existing.active_workers = max(existing.active_workers, data.active_workers)
            existing.completed_actions += data.completed_actions
            existing.safety_issues.extend(data.safety_issues)
            existing.safety_issues = list(set(existing.safety_issues))
            existing.safety_compliance = existing.safety_compliance and data.safety_compliance
            existing.efficiency_score = (existing.efficiency_score + data.efficiency_score) / 2

    def build_efficiency_record_request(
        self,
        data: CollectedEfficiencyData,
        worker_id: int = None,
        work_minutes: int = None
    ) -> Dict:
        """构建效率记录请求 - 对应后端 EfficiencyRecordRequest"""
        process_type = self.map_scene_to_process(data.process_stage)
        workstation_id = self.camera_workstation_map.get(data.camera_id, data.camera_id)

        return {
            "workerId": worker_id,
            "pieceCount": data.completed_actions,
            "workMinutes": work_minutes or 60,
            "processStageType": process_type.value if process_type else "PROCESSING",
            "workDate": datetime.now().strftime("%Y-%m-%d"),
            "workstationId": workstation_id,
            "qualifiedCount": data.completed_actions,
            "notes": f"VL自动识别 | 效率分:{data.efficiency_score:.0f} | 在岗:{data.active_workers}/{data.total_workers}"
        }

    async def submit_efficiency_record(self, request_data: Dict) -> Dict:
        """提交效率记录到后端 (异步)"""
        url = f"{self.backend_url}/api/mobile/{self.factory_id}/wage/efficiency/record"
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"

        try:
            response = self.client.post(url, json=request_data, headers=headers)
            result = response.json()
            return result
        except Exception as e:
            return {"success": False, "message": str(e)}

    def submit_efficiency_record_sync(self, request_data: Dict) -> Dict:
        """同步版本的提交效率记录"""
        url = f"{self.backend_url}/api/mobile/{self.factory_id}/wage/efficiency/record"
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"

        try:
            response = self.client.post(url, json=request_data, headers=headers)
            result = response.json()
            print(f"提交效率记录: {result}")
            return result
        except Exception as e:
            print(f"提交失败: {e}")
            return {"success": False, "message": str(e)}

    def generate_report(self, data_list: List[CollectedEfficiencyData]) -> Dict:
        """生成人效分析报告"""
        if not data_list:
            return {"error": "无数据"}

        total_workers = sum(d.total_workers for d in data_list)
        total_active = sum(d.active_workers for d in data_list)
        total_actions = sum(d.completed_actions for d in data_list)
        avg_efficiency = sum(d.efficiency_score for d in data_list) / len(data_list)

        all_safety_issues = []
        for d in data_list:
            all_safety_issues.extend(d.safety_issues)
        unique_issues = list(set(all_safety_issues))

        process_stats = {}
        for d in data_list:
            stage = d.process_stage or "未知"
            if stage not in process_stats:
                process_stats[stage] = {
                    "count": 0,
                    "workers": 0,
                    "actions": 0,
                    "efficiency": 0
                }
            process_stats[stage]["count"] += 1
            process_stats[stage]["workers"] += d.total_workers
            process_stats[stage]["actions"] += d.completed_actions
            process_stats[stage]["efficiency"] += d.efficiency_score

        for stage, stats in process_stats.items():
            if stats["count"] > 0:
                stats["efficiency"] = round(stats["efficiency"] / stats["count"], 1)

        return {
            "summary": {
                "total_samples": len(data_list),
                "total_workers_observed": total_workers,
                "total_active_workers": total_active,
                "activity_rate": round(total_active / total_workers * 100, 1) if total_workers > 0 else 0,
                "total_completed_actions": total_actions,
                "average_efficiency_score": round(avg_efficiency, 1),
            },
            "safety": {
                "compliance_rate": round(sum(1 for d in data_list if d.safety_compliance) / len(data_list) * 100, 1),
                "issues_found": unique_issues,
                "issue_count": len(unique_issues)
            },
            "by_process": process_stats,
            "timestamp": datetime.now().isoformat()
        }
