"""
成本监控 API 路由 (Phase 8.5)

提供 VL API 调用成本的监控和管理功能

API 端点:
- GET /cost/summary - 获取成本摘要（日/周/月）
- GET /cost/today - 获取今日成本
- GET /cost/weekly - 获取本周成本
- GET /cost/monthly - 获取本月成本
- POST /cost/budget - 设置预算限制
- POST /cost/alert - 设置告警阈值
- GET /cost/optimization - 获取当前优化配置
- POST /cost/optimization - 设置优化模式
"""

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.cost_monitor import get_cost_monitor

router = APIRouter(tags=["成本监控"])


# ==================== 请求/响应模型 ====================

class SetBudgetRequest(BaseModel):
    """设置预算请求"""
    daily_budget: Optional[float] = Field(None, description="每日预算（人民币）", ge=0)
    weekly_budget: Optional[float] = Field(None, description="每周预算（人民币）", ge=0)
    monthly_budget: Optional[float] = Field(None, description="每月预算（人民币）", ge=0)


class SetAlertRequest(BaseModel):
    """设置告警请求"""
    threshold_percent: float = Field(
        ...,
        description="告警阈值（预算使用百分比）",
        ge=0,
        le=100
    )


class SetOptimizationRequest(BaseModel):
    """设置优化模式请求"""
    mode: str = Field(
        ...,
        description="优化模式: economy（省钱）/ balanced（平衡）/ performance（高性能）"
    )
    auto_optimize: bool = Field(
        True,
        description="是否启用自动模式切换（当预算紧张时自动切换到省钱模式）"
    )


# ==================== API 端点 ====================

@router.get("/summary")
async def get_cost_summary():
    """
    获取完整成本摘要

    返回今日、本周、本月的成本统计，以及告警和优化配置
    """
    monitor = get_cost_monitor()
    summary = monitor.get_cost_summary()

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        **summary
    }


@router.get("/today")
async def get_today_cost():
    """
    获取今日成本统计

    包括 API 调用次数、Token 消耗、成本、跳帧节省等
    """
    monitor = get_cost_monitor()
    today = monitor.get_today_summary()

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        **today
    }


@router.get("/weekly")
async def get_weekly_cost():
    """
    获取本周成本统计

    包括每日分解和周预算使用情况
    """
    monitor = get_cost_monitor()
    weekly = monitor.get_weekly_summary()

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        **weekly
    }


@router.get("/monthly")
async def get_monthly_cost():
    """
    获取本月成本统计

    包括月末成本预测和模型使用分解
    """
    monitor = get_cost_monitor()
    monthly = monitor.get_monthly_summary()

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        **monthly
    }


@router.post("/budget")
async def set_budget(request: SetBudgetRequest):
    """
    设置预算限制

    可以单独设置日/周/月预算，未设置的保持不变
    """
    monitor = get_cost_monitor()

    monitor.set_budget(
        daily=request.daily_budget,
        weekly=request.weekly_budget,
        monthly=request.monthly_budget
    )

    return {
        "success": True,
        "message": "预算设置成功",
        "budget": {
            "daily": monitor.daily_budget,
            "weekly": monitor.weekly_budget,
            "monthly": monitor.monthly_budget
        }
    }


@router.post("/alert")
async def set_alert_threshold(request: SetAlertRequest):
    """
    设置成本告警阈值

    当预算使用比例超过阈值时触发告警
    """
    monitor = get_cost_monitor()
    monitor.set_alert_threshold(request.threshold_percent)

    return {
        "success": True,
        "message": f"告警阈值设置为 {request.threshold_percent}%",
        "threshold_percent": request.threshold_percent
    }


@router.get("/optimization")
async def get_optimization_config():
    """
    获取当前优化模式配置

    返回当前模式的详细配置参数
    """
    monitor = get_cost_monitor()
    config = monitor.get_optimization_config()

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "current_mode": monitor._optimization_mode,
        "auto_optimize": monitor._auto_optimize,
        "config": config
    }


@router.post("/optimization")
async def set_optimization_mode(request: SetOptimizationRequest):
    """
    设置优化模式

    模式说明:
    - economy: 省钱模式 - 使用最便宜的模型，较长采样间隔，宽松跳帧阈值
    - balanced: 平衡模式（默认）- 成本与性能平衡
    - performance: 高性能模式 - 使用高精度模型，短采样间隔，严格跳帧阈值
    """
    monitor = get_cost_monitor()

    try:
        monitor.set_optimization_mode(request.mode, request.auto_optimize)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    config = monitor.get_optimization_config()

    return {
        "success": True,
        "message": f"优化模式设置为 {request.mode}",
        "current_mode": request.mode,
        "auto_optimize": request.auto_optimize,
        "config": config
    }


@router.get("/pricing")
async def get_model_pricing():
    """
    获取模型定价信息

    返回各模型的定价和推荐使用场景
    """
    from ..services.cost_monitor import MODEL_PRICING, ANALYSIS_TOKEN_ESTIMATES

    model_info = []
    for model, pricing in MODEL_PRICING.items():
        # 估算单次分析成本
        std_tokens = ANALYSIS_TOKEN_ESTIMATES["standard"]
        estimated_cost = std_tokens * pricing["avg_mixed"] / 1000

        model_info.append({
            "model": model,
            "pricing": {
                "input_per_1k_tokens": pricing["input"],
                "output_per_1k_tokens": pricing["output"],
                "avg_mixed_per_1k_tokens": pricing["avg_mixed"]
            },
            "estimated_cost_per_analysis": round(estimated_cost, 4),
            "recommended_for": _get_model_recommendation(model)
        })

    return {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "models": model_info,
        "token_estimates": ANALYSIS_TOKEN_ESTIMATES
    }


def _get_model_recommendation(model: str) -> str:
    """获取模型推荐使用场景"""
    recommendations = {
        "qwen-vl-plus": "标准分析、多摄像头并行（推荐）",
        "qwen-vl-max": "高精度任务、OCR、特征提取",
        "qwen3-vl-flash": "实时分析、省钱模式、快速识别",
        "qwen3-vl-plus": "深度推理、场景理解、变化检测"
    }
    return recommendations.get(model, "通用分析")
