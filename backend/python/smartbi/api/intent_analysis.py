from __future__ import annotations
"""
Intent Analysis API

Endpoints for intent match error attribution analytics:
- /api/analysis/aggregate-daily: aggregate daily intent-match statistics

Called by Java ErrorAttributionAnalysisScheduler at 01:00 daily via
PythonErrorAnalysisClient. Response shape must match
`com.cretas.aims.dto.python.ErrorAnalysisResponse.AggregateResponse`
and be wrapped in `{success, data, message}`.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


# ============================================================================
# Request / Response models (shapes mirror Java DTOs)
# ============================================================================


class IntentMatchRecordDTO(BaseModel):
    """Single intent-match record from Java."""
    id: Optional[str] = None
    userInput: Optional[str] = None
    normalizedInput: Optional[str] = None
    matchedIntentCode: Optional[str] = None
    matchedIntentName: Optional[str] = None
    matchedIntentCategory: Optional[str] = None
    confidenceScore: Optional[float] = None
    matchMethod: Optional[str] = None
    isStrongSignal: Optional[bool] = None
    requiresConfirmation: Optional[bool] = None
    llmCalled: Optional[bool] = None
    userConfirmed: Optional[bool] = None
    executionStatus: Optional[str] = None
    errorAttribution: Optional[str] = None


class AggregateRequest(BaseModel):
    records: List[IntentMatchRecordDTO] = Field(default_factory=list)


class CategoryStats(BaseModel):
    count: int
    successRate: float


class MethodStats(BaseModel):
    count: int
    avgConfidence: float


class AggregateResponse(BaseModel):
    totalRequests: int
    matchedCount: int
    unmatchedCount: int
    llmFallbackCount: int
    strongSignalCount: int
    weakSignalCount: int
    confirmationRequested: int
    userConfirmedCount: int
    userRejectedCount: int
    executedCount: int
    failedCount: int
    cancelledCount: int
    ruleMissCount: int
    ambiguousCount: int
    falsePositiveCount: int
    userCancelCount: int
    systemErrorCount: int
    avgConfidence: Optional[float]
    intentCategoryStats: Dict[str, CategoryStats]
    matchMethodStats: Dict[str, MethodStats]
    confidenceDistribution: Dict[str, int]


class ApiResponse(BaseModel):
    success: bool
    data: Optional[AggregateResponse] = None
    message: Optional[str] = None


# ============================================================================
# Aggregation logic
# ============================================================================


def _is_matched(rec: IntentMatchRecordDTO) -> bool:
    code = rec.matchedIntentCode
    return bool(code) and code != "NONE"


def _confidence_bucket(score: float) -> str:
    """Map a [0,1] confidence score to a 10-way bucket like '0.8-0.9'."""
    if score < 0.0:
        score = 0.0
    if score >= 1.0:
        return "0.9-1.0"
    lo = int(score * 10) / 10.0
    hi = lo + 0.1
    return f"{lo:.1f}-{hi:.1f}"


def _aggregate(records: List[IntentMatchRecordDTO]) -> AggregateResponse:
    total = len(records)

    matched = sum(1 for r in records if _is_matched(r))
    unmatched = total - matched

    llm_fallback = sum(1 for r in records if r.llmCalled)

    strong_signal = sum(1 for r in records if r.isStrongSignal)
    weak_signal = sum(1 for r in records if r.isStrongSignal is False)

    confirmation_requested = sum(1 for r in records if r.requiresConfirmation)
    user_confirmed = sum(1 for r in records if r.userConfirmed is True)
    # Rejected = was asked to confirm but didn't confirm (explicitly False or null after ask)
    user_rejected = sum(
        1 for r in records
        if r.requiresConfirmation and r.userConfirmed is not True
    )

    executed = sum(1 for r in records if r.executionStatus == "EXECUTED")
    failed = sum(1 for r in records if r.executionStatus == "FAILED")
    cancelled = sum(1 for r in records if r.executionStatus == "CANCELLED")

    rule_miss = sum(1 for r in records if r.errorAttribution == "RULE_MISS")
    ambiguous = sum(1 for r in records if r.errorAttribution == "AMBIGUOUS")
    false_positive = sum(1 for r in records if r.errorAttribution == "FALSE_POSITIVE")
    user_cancel = sum(1 for r in records if r.errorAttribution == "USER_CANCEL")
    system_error = sum(1 for r in records if r.errorAttribution == "SYSTEM_ERROR")

    matched_scores = [
        r.confidenceScore for r in records
        if _is_matched(r) and r.confidenceScore is not None
    ]
    avg_confidence = sum(matched_scores) / len(matched_scores) if matched_scores else None

    # ----- Per-category statistics -----
    # Successful = executionStatus == EXECUTED (the downstream truth,
    # not just "matched") — consistent with how Java reports success.
    category_stats: Dict[str, CategoryStats] = {}
    category_groups: Dict[str, List[IntentMatchRecordDTO]] = {}
    for r in records:
        cat = r.matchedIntentCategory or "UNKNOWN"
        category_groups.setdefault(cat, []).append(r)
    for cat, group in category_groups.items():
        c = len(group)
        ok = sum(1 for r in group if r.executionStatus == "EXECUTED")
        category_stats[cat] = CategoryStats(
            count=c,
            successRate=(ok / c) if c else 0.0,
        )

    # ----- Per-match-method statistics -----
    method_stats: Dict[str, MethodStats] = {}
    method_groups: Dict[str, List[IntentMatchRecordDTO]] = {}
    for r in records:
        method = r.matchMethod or "NONE"
        method_groups.setdefault(method, []).append(r)
    for method, group in method_groups.items():
        c = len(group)
        scores = [r.confidenceScore for r in group if r.confidenceScore is not None]
        avg = (sum(scores) / len(scores)) if scores else 0.0
        method_stats[method] = MethodStats(count=c, avgConfidence=avg)

    # ----- Confidence distribution (10 buckets) -----
    distribution: Dict[str, int] = {
        f"{i/10:.1f}-{(i+1)/10:.1f}": 0 for i in range(10)
    }
    for r in records:
        if r.confidenceScore is None:
            continue
        bucket = _confidence_bucket(r.confidenceScore)
        distribution[bucket] = distribution.get(bucket, 0) + 1

    return AggregateResponse(
        totalRequests=total,
        matchedCount=matched,
        unmatchedCount=unmatched,
        llmFallbackCount=llm_fallback,
        strongSignalCount=strong_signal,
        weakSignalCount=weak_signal,
        confirmationRequested=confirmation_requested,
        userConfirmedCount=user_confirmed,
        userRejectedCount=user_rejected,
        executedCount=executed,
        failedCount=failed,
        cancelledCount=cancelled,
        ruleMissCount=rule_miss,
        ambiguousCount=ambiguous,
        falsePositiveCount=false_positive,
        userCancelCount=user_cancel,
        systemErrorCount=system_error,
        avgConfidence=avg_confidence,
        intentCategoryStats=category_stats,
        matchMethodStats=method_stats,
        confidenceDistribution=distribution,
    )


# ============================================================================
# Route
# ============================================================================


@router.post("/aggregate-daily", response_model=ApiResponse)
def aggregate_daily(request: AggregateRequest) -> ApiResponse:
    """Aggregate daily intent-match statistics.

    Called by Java ErrorAttributionAnalysisScheduler (01:00 cron) with
    a list of IntentMatchRecordDTO. Returns counts/rates/distributions
    that populate the `error_attribution_statistics` table.
    """
    data = _aggregate(request.records)
    return ApiResponse(success=True, data=data, message=None)
