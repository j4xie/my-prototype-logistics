"""
成本监控服务 (Phase 8.5)

跟踪和管理 VL API 调用成本：
- 实时成本统计（日/周/月）
- 预算限制和告警
- 自动成本优化模式切换
- 成本预测

定价参考（阿里云 Qwen VL）：
- qwen-vl-plus: ¥0.008/千token (输入) + ¥0.016/千token (输出)
- qwen-vl-max: ¥0.020/千token (输入) + ¥0.050/千token (输出)
- qwen3-vl-flash: ¥0.005/千token (输入) + ¥0.010/千token (输出)
"""

import os
import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any
from threading import Lock
from collections import defaultdict

logger = logging.getLogger(__name__)


# 模型定价配置（每千 token 的价格，单位：人民币）
MODEL_PRICING = {
    "qwen-vl-plus": {"input": 0.008, "output": 0.016, "avg_mixed": 0.012},
    "qwen-vl-max": {"input": 0.020, "output": 0.050, "avg_mixed": 0.035},
    "qwen3-vl-flash": {"input": 0.005, "output": 0.010, "avg_mixed": 0.0075},
    "qwen3-vl-plus": {"input": 0.010, "output": 0.030, "avg_mixed": 0.020},
}

# 估算的每次分析 token 消耗
ANALYSIS_TOKEN_ESTIMATES = {
    "quick": 2000,      # 快速分析
    "standard": 3000,   # 标准分析
    "deep": 4000,       # 深度分析
}


@dataclass
class ApiCallRecord:
    """API 调用记录"""
    timestamp: datetime
    model: str
    analysis_type: str
    input_tokens: int
    output_tokens: int
    cost_rmb: float
    camera_id: str = ""
    stream_id: str = ""


@dataclass
class DailyCost:
    """每日成本统计"""
    date: str
    api_calls: int = 0
    total_tokens: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cost_rmb: float = 0.0
    skipped_frames: int = 0
    saved_cost_rmb: float = 0.0
    model_breakdown: Dict[str, Dict] = field(default_factory=dict)


@dataclass
class CostAlert:
    """成本告警"""
    alert_type: str  # daily_limit, weekly_limit, monthly_limit, spike
    threshold: float
    current_value: float
    triggered_at: datetime
    message: str


class CostMonitor:
    """成本监控服务"""

    def __init__(
        self,
        daily_budget: float = 500.0,
        weekly_budget: float = 3000.0,
        monthly_budget: float = 10000.0,
        alert_threshold_percent: float = 80.0
    ):
        """
        初始化成本监控器

        Args:
            daily_budget: 每日预算（人民币）
            weekly_budget: 每周预算（人民币）
            monthly_budget: 每月预算（人民币）
            alert_threshold_percent: 告警阈值（预算使用百分比）
        """
        self.daily_budget = daily_budget
        self.weekly_budget = weekly_budget
        self.monthly_budget = monthly_budget
        self.alert_threshold_percent = alert_threshold_percent

        # 成本记录
        self._daily_costs: Dict[str, DailyCost] = {}
        self._call_records: List[ApiCallRecord] = []
        self._alerts: List[CostAlert] = []
        self._lock = Lock()

        # 优化模式
        self._optimization_mode = "balanced"  # economy, balanced, performance
        self._auto_optimize = True

        # 加载持久化数据（如果存在）
        self._load_state()

    def record_api_call(
        self,
        model: str,
        analysis_type: str,
        input_tokens: int,
        output_tokens: int,
        camera_id: str = "",
        stream_id: str = ""
    ) -> float:
        """
        记录一次 API 调用

        Args:
            model: 使用的模型
            analysis_type: 分析类型
            input_tokens: 输入 token 数
            output_tokens: 输出 token 数
            camera_id: 摄像头ID
            stream_id: 流ID

        Returns:
            本次调用的成本（人民币）
        """
        with self._lock:
            # 计算成本
            pricing = MODEL_PRICING.get(model, MODEL_PRICING["qwen-vl-plus"])
            cost = (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1000

            # 创建记录
            record = ApiCallRecord(
                timestamp=datetime.now(),
                model=model,
                analysis_type=analysis_type,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_rmb=cost,
                camera_id=camera_id,
                stream_id=stream_id
            )
            self._call_records.append(record)

            # 更新每日统计
            today = date.today().isoformat()
            if today not in self._daily_costs:
                self._daily_costs[today] = DailyCost(date=today)

            daily = self._daily_costs[today]
            daily.api_calls += 1
            daily.total_tokens += input_tokens + output_tokens
            daily.input_tokens += input_tokens
            daily.output_tokens += output_tokens
            daily.cost_rmb += cost

            # 更新模型分解
            if model not in daily.model_breakdown:
                daily.model_breakdown[model] = {
                    "calls": 0, "tokens": 0, "cost": 0.0
                }
            daily.model_breakdown[model]["calls"] += 1
            daily.model_breakdown[model]["tokens"] += input_tokens + output_tokens
            daily.model_breakdown[model]["cost"] += cost

            # 检查告警
            self._check_alerts(daily)

            # 自动优化模式切换
            if self._auto_optimize:
                self._auto_adjust_mode(daily)

            return cost

    def record_skipped_frame(self, model: str = "qwen-vl-plus"):
        """记录跳过的帧（通过本地预处理节省的调用）"""
        with self._lock:
            today = date.today().isoformat()
            if today not in self._daily_costs:
                self._daily_costs[today] = DailyCost(date=today)

            daily = self._daily_costs[today]
            daily.skipped_frames += 1

            # 估算节省的成本
            pricing = MODEL_PRICING.get(model, MODEL_PRICING["qwen-vl-plus"])
            estimated_tokens = ANALYSIS_TOKEN_ESTIMATES["standard"]
            saved_cost = estimated_tokens * pricing["avg_mixed"] / 1000
            daily.saved_cost_rmb += saved_cost

    def get_today_summary(self) -> Dict[str, Any]:
        """获取今日成本摘要"""
        today = date.today().isoformat()
        daily = self._daily_costs.get(today, DailyCost(date=today))

        return {
            "date": today,
            "api_calls": daily.api_calls,
            "total_tokens": daily.total_tokens,
            "cost_rmb": round(daily.cost_rmb, 2),
            "skipped_frames": daily.skipped_frames,
            "saved_cost_rmb": round(daily.saved_cost_rmb, 2),
            "net_cost_rmb": round(daily.cost_rmb, 2),  # 实际支出
            "budget": {
                "daily_limit": self.daily_budget,
                "remaining": round(self.daily_budget - daily.cost_rmb, 2),
                "usage_percent": round(daily.cost_rmb / self.daily_budget * 100, 1)
                if self.daily_budget > 0 else 0
            },
            "model_breakdown": daily.model_breakdown,
            "optimization_mode": self._optimization_mode
        }

    def get_weekly_summary(self) -> Dict[str, Any]:
        """获取本周成本摘要"""
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

        total_cost = 0.0
        total_calls = 0
        total_tokens = 0
        total_skipped = 0
        total_saved = 0.0
        daily_data = []

        for i in range(7):
            day = week_start + timedelta(days=i)
            day_str = day.isoformat()
            if day_str in self._daily_costs:
                daily = self._daily_costs[day_str]
                total_cost += daily.cost_rmb
                total_calls += daily.api_calls
                total_tokens += daily.total_tokens
                total_skipped += daily.skipped_frames
                total_saved += daily.saved_cost_rmb
                daily_data.append({
                    "date": day_str,
                    "cost_rmb": round(daily.cost_rmb, 2),
                    "api_calls": daily.api_calls
                })

        return {
            "week_start": week_start.isoformat(),
            "week_end": (week_start + timedelta(days=6)).isoformat(),
            "total_cost_rmb": round(total_cost, 2),
            "total_api_calls": total_calls,
            "total_tokens": total_tokens,
            "skipped_frames": total_skipped,
            "saved_cost_rmb": round(total_saved, 2),
            "budget": {
                "weekly_limit": self.weekly_budget,
                "remaining": round(self.weekly_budget - total_cost, 2),
                "usage_percent": round(total_cost / self.weekly_budget * 100, 1)
                if self.weekly_budget > 0 else 0
            },
            "daily_breakdown": daily_data
        }

    def get_monthly_summary(self) -> Dict[str, Any]:
        """获取本月成本摘要"""
        today = date.today()
        month_start = today.replace(day=1)

        total_cost = 0.0
        total_calls = 0
        total_tokens = 0
        total_skipped = 0
        total_saved = 0.0
        model_totals: Dict[str, Dict] = defaultdict(lambda: {"calls": 0, "tokens": 0, "cost": 0.0})

        current = month_start
        while current <= today:
            day_str = current.isoformat()
            if day_str in self._daily_costs:
                daily = self._daily_costs[day_str]
                total_cost += daily.cost_rmb
                total_calls += daily.api_calls
                total_tokens += daily.total_tokens
                total_skipped += daily.skipped_frames
                total_saved += daily.saved_cost_rmb

                for model, stats in daily.model_breakdown.items():
                    model_totals[model]["calls"] += stats["calls"]
                    model_totals[model]["tokens"] += stats["tokens"]
                    model_totals[model]["cost"] += stats["cost"]

            current += timedelta(days=1)

        # 预测月末成本
        days_passed = (today - month_start).days + 1
        days_in_month = 30  # 简化
        projected_cost = total_cost / days_passed * days_in_month if days_passed > 0 else 0

        return {
            "month": today.strftime("%Y-%m"),
            "days_passed": days_passed,
            "total_cost_rmb": round(total_cost, 2),
            "total_api_calls": total_calls,
            "total_tokens": total_tokens,
            "skipped_frames": total_skipped,
            "saved_cost_rmb": round(total_saved, 2),
            "projected_month_end_cost": round(projected_cost, 2),
            "budget": {
                "monthly_limit": self.monthly_budget,
                "remaining": round(self.monthly_budget - total_cost, 2),
                "usage_percent": round(total_cost / self.monthly_budget * 100, 1)
                if self.monthly_budget > 0 else 0
            },
            "model_breakdown": dict(model_totals)
        }

    def get_cost_summary(self) -> Dict[str, Any]:
        """获取完整成本摘要"""
        return {
            "today": self.get_today_summary(),
            "this_week": self.get_weekly_summary(),
            "this_month": self.get_monthly_summary(),
            "alerts": [
                {
                    "alert_type": a.alert_type,
                    "message": a.message,
                    "triggered_at": a.triggered_at.isoformat()
                }
                for a in self._alerts[-10:]  # 最近10条告警
            ],
            "optimization": {
                "current_mode": self._optimization_mode,
                "auto_optimize": self._auto_optimize
            }
        }

    def set_budget(
        self,
        daily: Optional[float] = None,
        weekly: Optional[float] = None,
        monthly: Optional[float] = None
    ):
        """设置预算限制"""
        with self._lock:
            if daily is not None:
                self.daily_budget = daily
            if weekly is not None:
                self.weekly_budget = weekly
            if monthly is not None:
                self.monthly_budget = monthly

            self._save_state()

    def set_alert_threshold(self, percent: float):
        """设置告警阈值（预算使用百分比）"""
        self.alert_threshold_percent = percent
        self._save_state()

    def set_optimization_mode(self, mode: str, auto: bool = True):
        """
        设置优化模式

        Args:
            mode: economy（省钱）/ balanced（平衡）/ performance（高性能）
            auto: 是否启用自动模式切换
        """
        if mode not in ["economy", "balanced", "performance"]:
            raise ValueError(f"Invalid mode: {mode}")

        self._optimization_mode = mode
        self._auto_optimize = auto
        self._save_state()

    def get_optimization_config(self) -> Dict[str, Any]:
        """获取当前优化模式的配置"""
        configs = {
            "economy": {
                "mode": "economy",
                "description": "省钱模式 - 最小化 API 调用成本",
                "default_model": "qwen3-vl-flash",
                "sampling_interval": 60,
                "skip_threshold": 0.10,  # 更宽松的跳帧阈值
                "deep_analysis_ratio": 0.05
            },
            "balanced": {
                "mode": "balanced",
                "description": "平衡模式 - 成本与性能平衡",
                "default_model": "qwen-vl-plus",
                "sampling_interval": 30,
                "skip_threshold": 0.05,
                "deep_analysis_ratio": 0.15
            },
            "performance": {
                "mode": "performance",
                "description": "高性能模式 - 最大化分析精度",
                "default_model": "qwen-vl-max",
                "sampling_interval": 10,
                "skip_threshold": 0.02,  # 更严格的跳帧阈值
                "deep_analysis_ratio": 0.30
            }
        }

        return configs.get(self._optimization_mode, configs["balanced"])

    def _check_alerts(self, daily: DailyCost):
        """检查并触发告警"""
        # 日预算告警
        if daily.cost_rmb >= self.daily_budget * self.alert_threshold_percent / 100:
            alert = CostAlert(
                alert_type="daily_limit",
                threshold=self.daily_budget * self.alert_threshold_percent / 100,
                current_value=daily.cost_rmb,
                triggered_at=datetime.now(),
                message=f"日成本已达 ¥{daily.cost_rmb:.2f}，超过预警阈值 {self.alert_threshold_percent}%"
            )
            self._alerts.append(alert)
            logger.warning(alert.message)

    def _auto_adjust_mode(self, daily: DailyCost):
        """根据成本自动调整优化模式"""
        if not self._auto_optimize:
            return

        usage_percent = daily.cost_rmb / self.daily_budget * 100 if self.daily_budget > 0 else 0

        if usage_percent >= 90 and self._optimization_mode != "economy":
            self._optimization_mode = "economy"
            logger.info(f"自动切换到省钱模式（预算使用 {usage_percent:.1f}%）")
        elif usage_percent >= 70 and self._optimization_mode == "performance":
            self._optimization_mode = "balanced"
            logger.info(f"自动切换到平衡模式（预算使用 {usage_percent:.1f}%）")

    def _save_state(self):
        """保存状态到文件"""
        try:
            state = {
                "daily_budget": self.daily_budget,
                "weekly_budget": self.weekly_budget,
                "monthly_budget": self.monthly_budget,
                "alert_threshold_percent": self.alert_threshold_percent,
                "optimization_mode": self._optimization_mode,
                "auto_optimize": self._auto_optimize
            }
            state_file = os.path.join(
                os.path.dirname(__file__),
                ".cost_monitor_state.json"
            )
            with open(state_file, "w") as f:
                json.dump(state, f)
        except Exception as e:
            logger.error(f"Failed to save cost monitor state: {e}")

    def _load_state(self):
        """从文件加载状态"""
        try:
            state_file = os.path.join(
                os.path.dirname(__file__),
                ".cost_monitor_state.json"
            )
            if os.path.exists(state_file):
                with open(state_file, "r") as f:
                    state = json.load(f)
                    self.daily_budget = state.get("daily_budget", self.daily_budget)
                    self.weekly_budget = state.get("weekly_budget", self.weekly_budget)
                    self.monthly_budget = state.get("monthly_budget", self.monthly_budget)
                    self.alert_threshold_percent = state.get(
                        "alert_threshold_percent", self.alert_threshold_percent
                    )
                    self._optimization_mode = state.get("optimization_mode", "balanced")
                    self._auto_optimize = state.get("auto_optimize", True)
        except Exception as e:
            logger.error(f"Failed to load cost monitor state: {e}")


# 全局实例
_cost_monitor: Optional[CostMonitor] = None


def get_cost_monitor() -> CostMonitor:
    """获取全局成本监控器实例"""
    global _cost_monitor
    if _cost_monitor is None:
        # 从环境变量读取默认预算
        daily_budget = float(os.environ.get("EFFICIENCY_DAILY_BUDGET", "500"))
        weekly_budget = float(os.environ.get("EFFICIENCY_WEEKLY_BUDGET", "3000"))
        monthly_budget = float(os.environ.get("EFFICIENCY_MONTHLY_BUDGET", "10000"))

        _cost_monitor = CostMonitor(
            daily_budget=daily_budget,
            weekly_budget=weekly_budget,
            monthly_budget=monthly_budget
        )
    return _cost_monitor
