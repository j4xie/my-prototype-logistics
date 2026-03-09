from __future__ import annotations
"""
Production AI API

Endpoints for AI-powered production management:
- Production commentary (real-time AI evaluation for workshop dashboard)
- Efficiency alerts (automated efficiency anomaly detection)
- Process recommendation (AI-suggested process for worker checkin)
- Photo quantity estimation (estimate product count from photo)
"""
import logging
from typing import Any, Optional, List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Request / Response Models
# ============================================================

class ProductionCommentaryRequest(BaseModel):
    """Request for AI production commentary"""
    plans: List[Dict[str, Any]]  # Today's production plan summaries
    reportedData: Optional[List[Dict[str, Any]]] = None  # Today's work reports
    factoryId: Optional[str] = None


class ProductionCommentaryResponse(BaseModel):
    success: bool
    commentary: str = ""
    alerts: List[Dict[str, Any]] = []
    suggestions: List[str] = []


class EfficiencyAlertRequest(BaseModel):
    """Request for efficiency anomaly detection"""
    efficiencyData: List[Dict[str, Any]]  # Worker efficiency records
    threshold: float = 0.8  # Alert threshold (below 80% of standard)
    factoryId: Optional[str] = None


class EfficiencyAlertResponse(BaseModel):
    success: bool
    alerts: List[Dict[str, Any]] = []
    summary: str = ""


class ProcessRecommendationRequest(BaseModel):
    """Request for AI process recommendation"""
    employeeId: int
    employeeHistory: Optional[List[Dict[str, Any]]] = None
    activePlans: List[Dict[str, Any]]  # Current active production plans
    currentStaffing: Optional[Dict[str, int]] = None  # Process -> current worker count
    timeOfDay: Optional[str] = None  # morning/afternoon/evening


class ProcessRecommendationResponse(BaseModel):
    success: bool
    recommendations: List[Dict[str, Any]] = []  # [{processName, score, reason}]


class PhotoQuantityRequest(BaseModel):
    """Request for photo-based quantity estimation"""
    imageBase64: Optional[str] = None
    imageUrl: Optional[str] = None
    productType: Optional[str] = None
    containerType: Optional[str] = None  # box/tray/basket


class PhotoQuantityResponse(BaseModel):
    success: bool
    estimatedQuantity: Optional[int] = None
    confidence: float = 0.0
    detectedProduct: Optional[str] = None
    notes: str = ""


# ============================================================
# Endpoints
# ============================================================

@router.post("/production-commentary", response_model=ProductionCommentaryResponse)
async def generate_production_commentary(request: ProductionCommentaryRequest):
    """
    Generate AI commentary for the production dashboard.
    Analyzes today's production data and generates natural language insights.
    """
    try:
        plans = request.plans
        reported = request.reportedData or []

        if not plans:
            return ProductionCommentaryResponse(
                success=True,
                commentary="今日暂无排产计划。",
                alerts=[],
                suggestions=[]
            )

        # Build summary
        total_planned = sum(p.get("plannedQty", 0) for p in plans)
        total_reported = sum(p.get("reportedQty", 0) for p in plans)
        completion_rate = (total_reported / total_planned * 100) if total_planned > 0 else 0

        # Identify lagging plans
        lagging = []
        ahead = []
        for p in plans:
            planned = p.get("plannedQty", 0)
            reported_qty = p.get("reportedQty", 0)
            if planned > 0:
                progress = reported_qty / planned * 100
                name = p.get("productName", "未知产品")
                process = p.get("processName", "")
                label = f"{name}{(' ' + process) if process else ''}"
                if progress < 50:
                    lagging.append({"name": label, "progress": round(progress, 1)})
                elif progress > 100:
                    ahead.append({"name": label, "progress": round(progress, 1)})

        # Generate commentary
        parts = []
        parts.append(f"当前整体完成率 {completion_rate:.0f}%，计划总量 {total_planned}，已报产量 {total_reported}。")

        if lagging:
            lag_desc = "、".join(f"{l['name']}({l['progress']}%)" for l in lagging[:3])
            parts.append(f"进度落后工序：{lag_desc}，建议增派人手。")

        if ahead:
            ahead_desc = "、".join(f"{a['name']}({a['progress']}%)" for a in ahead[:2])
            parts.append(f"超额完成：{ahead_desc}。")

        if completion_rate >= 90:
            parts.append("整体进度良好，预计按时完成。")
        elif completion_rate >= 60:
            parts.append("整体进度正常，请关注落后工序。")
        else:
            parts.append("整体进度偏慢，建议检查瓶颈工序并调配资源。")

        commentary = " ".join(parts)

        # Build alerts
        alerts = []
        for l in lagging:
            if l["progress"] < 30:
                alerts.append({
                    "level": "critical",
                    "message": f"{l['name']} 完成率仅 {l['progress']}%，严重落后",
                    "processName": l["name"]
                })
            elif l["progress"] < 50:
                alerts.append({
                    "level": "warning",
                    "message": f"{l['name']} 完成率 {l['progress']}%，需要关注",
                    "processName": l["name"]
                })

        suggestions = []
        if lagging and ahead:
            suggestions.append(f"建议从{ahead[0]['name']}调人支援{lagging[0]['name']}")
        if completion_rate < 60:
            suggestions.append("建议召开紧急调度会议")

        return ProductionCommentaryResponse(
            success=True,
            commentary=commentary,
            alerts=alerts,
            suggestions=suggestions
        )

    except Exception as e:
        logger.error(f"Production commentary error: {e}", exc_info=True)
        return ProductionCommentaryResponse(
            success=False,
            commentary=f"生成评述失败: {str(e)}"
        )


@router.post("/efficiency-alert", response_model=EfficiencyAlertResponse)
async def check_efficiency_alerts(request: EfficiencyAlertRequest):
    """
    Scan efficiency data and generate alerts for anomalies.
    Alerts when worker/process efficiency drops below threshold.
    """
    try:
        data = request.efficiencyData
        threshold = request.threshold
        alerts = []

        for record in data:
            actual = record.get("actualEfficiency", 0)
            standard = record.get("standardEfficiency", 1)
            worker = record.get("workerName", "未知")
            process = record.get("processName", "")

            if standard > 0 and actual / standard < threshold:
                ratio = actual / standard * 100
                alerts.append({
                    "workerName": worker,
                    "processName": process,
                    "ratio": round(ratio, 1),
                    "level": "critical" if ratio < 60 else "warning",
                    "message": f"{worker} 在 {process} 效率为标准的 {ratio:.0f}%"
                })

        summary = f"共检测 {len(data)} 条记录，发现 {len(alerts)} 条效率异常。"
        if alerts:
            critical_count = sum(1 for a in alerts if a["level"] == "critical")
            if critical_count > 0:
                summary += f" 其中 {critical_count} 条严重异常需立即关注。"

        return EfficiencyAlertResponse(
            success=True,
            alerts=alerts,
            summary=summary
        )

    except Exception as e:
        logger.error(f"Efficiency alert error: {e}", exc_info=True)
        return EfficiencyAlertResponse(
            success=False,
            summary=f"效率检测失败: {str(e)}"
        )


@router.post("/process-recommendation", response_model=ProcessRecommendationResponse)
async def recommend_process(request: ProcessRecommendationRequest):
    """
    AI-powered process recommendation for worker checkin.
    Considers: active plans, worker history, current staffing gaps, time of day.
    """
    try:
        active_plans = request.activePlans
        history = request.employeeHistory or []
        staffing = request.currentStaffing or {}

        if not active_plans:
            return ProcessRecommendationResponse(
                success=True,
                recommendations=[]
            )

        recommendations = []

        # Score each available process
        for plan in active_plans:
            process_name = plan.get("processName", "")
            product_name = plan.get("productName", "")
            if not process_name:
                continue

            score = 50  # Base score
            reasons = []

            # Factor 1: Staffing gap (higher score if understaffed)
            needed = plan.get("estimatedWorkers", 3)
            current = staffing.get(process_name, 0)
            if current < needed:
                gap_bonus = min((needed - current) * 15, 40)
                score += gap_bonus
                reasons.append(f"缺 {needed - current} 人")

            # Factor 2: Worker history (familiar processes get bonus)
            familiar = any(h.get("processName") == process_name for h in history)
            if familiar:
                score += 20
                reasons.append("你的熟练工序")

            # Factor 3: Progress urgency (behind schedule gets bonus)
            progress = plan.get("progress", 0)
            if progress < 30:
                score += 15
                reasons.append("进度落后")

            recommendations.append({
                "processName": process_name,
                "productName": product_name,
                "planId": plan.get("planId", ""),
                "score": min(score, 100),
                "reason": "、".join(reasons) if reasons else "可选工序",
                "recommended": score >= 70,
            })

        # Sort by score descending
        recommendations.sort(key=lambda x: x["score"], reverse=True)

        return ProcessRecommendationResponse(
            success=True,
            recommendations=recommendations
        )

    except Exception as e:
        logger.error(f"Process recommendation error: {e}", exc_info=True)
        return ProcessRecommendationResponse(success=False)


@router.post("/photo-quantity-estimate", response_model=PhotoQuantityResponse)
async def estimate_quantity_from_photo(request: PhotoQuantityRequest):
    """
    Estimate product quantity from a photo.
    Uses VL model to analyze the image and count items.
    Currently returns a placeholder — full VL integration in next iteration.
    """
    try:
        if not request.imageBase64 and not request.imageUrl:
            raise HTTPException(status_code=400, detail="请提供图片")

        # Placeholder: In production, this would call the VL model
        # For now, return a reasonable estimate based on container type
        container = request.containerType or "box"
        estimates = {"box": 25, "tray": 15, "basket": 30, "pallet": 100}
        estimated = estimates.get(container, 20)

        return PhotoQuantityResponse(
            success=True,
            estimatedQuantity=estimated,
            confidence=0.6,
            detectedProduct=request.productType or "待识别",
            notes="基于容器类型的初步估算，请手动确认数量"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Photo quantity estimation error: {e}", exc_info=True)
        return PhotoQuantityResponse(
            success=False,
            notes=f"图片分析失败: {str(e)}"
        )
