from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import logging

from models.analysis_models import (
    AggregateRequest, AggregateResponse,
    FailurePatternRequest, FailurePatternResponse,
    AmbiguousIntentRequest, AmbiguousIntentResponse,
    MissingRulesRequest, MissingRulesResponse,
    KeywordExtractionRequest, KeywordExtractionResponse,
    WeeklyReportRequest, WeeklyReportResponse,
    ApiResponse
)
from services.aggregator import aggregate_daily_statistics
from services.pattern_detector import (
    identify_failure_patterns,
    identify_ambiguous_intents,
    identify_missing_rules
)
from services.keyword_extractor import extract_keywords

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/aggregate-daily", response_model=ApiResponse)
async def aggregate_daily(request: AggregateRequest):
    """Aggregate daily statistics from intent match records."""
    try:
        records = [r.model_dump() for r in request.records]
        result = aggregate_daily_statistics(records)
        return ApiResponse(success=True, data=result)
    except Exception as e:
        logger.error(f"Failed to aggregate daily statistics: {e}")
        return ApiResponse(success=False, message=str(e))


@router.post("/identify-failure-patterns", response_model=ApiResponse)
async def identify_failures(request: FailurePatternRequest):
    """Identify frequently occurring failure patterns."""
    try:
        records = [r.model_dump() for r in request.records]
        min_freq = request.minFrequency or 3
        patterns = identify_failure_patterns(records, min_freq)
        return ApiResponse(success=True, data={"patterns": patterns})
    except Exception as e:
        logger.error(f"Failed to identify failure patterns: {e}")
        return ApiResponse(success=False, message=str(e))


@router.post("/identify-ambiguous-intents", response_model=ApiResponse)
async def identify_ambiguous(request: AmbiguousIntentRequest):
    """Identify inputs that match multiple different intents."""
    try:
        records = [r.model_dump() for r in request.records]
        min_count = request.minCount or 2
        intents = identify_ambiguous_intents(records, min_count)
        return ApiResponse(success=True, data={"intents": intents})
    except Exception as e:
        logger.error(f"Failed to identify ambiguous intents: {e}")
        return ApiResponse(success=False, message=str(e))


@router.post("/identify-missing-rules", response_model=ApiResponse)
async def identify_missing(request: MissingRulesRequest):
    """Identify inputs that consistently fail to match (RULE_MISS)."""
    try:
        records = [r.model_dump() for r in request.records]
        min_count = request.minCount or 3
        rules = identify_missing_rules(records, min_count)
        return ApiResponse(success=True, data={"rules": rules})
    except Exception as e:
        logger.error(f"Failed to identify missing rules: {e}")
        return ApiResponse(success=False, message=str(e))


@router.post("/extract-keywords", response_model=ApiResponse)
async def extract_kw(request: KeywordExtractionRequest):
    """Extract keywords from user inputs using jieba segmentation."""
    try:
        min_freq = request.minFrequency or 2
        top_n = request.topN or 10
        keywords = extract_keywords(request.inputs, min_freq, top_n)
        return ApiResponse(success=True, data={"keywords": keywords})
    except Exception as e:
        logger.error(f"Failed to extract keywords: {e}")
        return ApiResponse(success=False, message=str(e))


@router.post("/generate-weekly-report", response_model=ApiResponse)
async def generate_weekly(request: WeeklyReportRequest):
    """Generate weekly analysis report."""
    try:
        # Aggregate weekly trends
        daily_stats = request.dailyStats or []

        if not daily_stats:
            return ApiResponse(success=True, data={
                "summary": {},
                "trends": {},
                "recommendations": []
            })

        # Calculate weekly summary
        total_requests = sum(d.get('totalRequests', 0) for d in daily_stats)
        total_matched = sum(d.get('matchedCount', 0) for d in daily_stats)
        total_failed = sum(d.get('failedCount', 0) for d in daily_stats)

        summary = {
            "totalRequests": total_requests,
            "totalMatched": total_matched,
            "totalFailed": total_failed,
            "matchRate": total_matched / total_requests if total_requests > 0 else 0,
            "daysAnalyzed": len(daily_stats)
        }

        # Calculate trends (compare first half vs second half)
        mid = len(daily_stats) // 2
        first_half = daily_stats[:mid] if mid > 0 else []
        second_half = daily_stats[mid:] if mid > 0 else daily_stats

        first_match_rate = _calc_avg_match_rate(first_half)
        second_match_rate = _calc_avg_match_rate(second_half)

        trends = {
            "matchRateTrend": "improving" if second_match_rate > first_match_rate else "declining" if second_match_rate < first_match_rate else "stable",
            "firstHalfMatchRate": first_match_rate,
            "secondHalfMatchRate": second_match_rate
        }

        # Generate recommendations
        recommendations = []
        failure_patterns = request.failurePatterns or []
        ambiguous_intents = request.ambiguousIntents or []
        missing_rules = request.missingRules or []

        if failure_patterns:
            top_pattern = failure_patterns[0] if failure_patterns else None
            if top_pattern:
                recommendations.append(
                    f"Top failure pattern: '{top_pattern.get('userInput', 'N/A')}' "
                    f"occurred {top_pattern.get('count', 0)} times. Consider adding specific handling."
                )

        if ambiguous_intents:
            recommendations.append(
                f"Found {len(ambiguous_intents)} ambiguous input patterns. "
                f"Consider refining intent definitions or adding clarification prompts."
            )

        if missing_rules:
            recommendations.append(
                f"Found {len(missing_rules)} potential missing rules. "
                f"Review and add appropriate intent patterns."
            )

        if not recommendations:
            recommendations.append("System performing well. No immediate action required.")

        return ApiResponse(success=True, data={
            "summary": summary,
            "trends": trends,
            "recommendations": recommendations
        })

    except Exception as e:
        logger.error(f"Failed to generate weekly report: {e}")
        return ApiResponse(success=False, message=str(e))


def _calc_avg_match_rate(stats: List[Dict[str, Any]]) -> float:
    """Calculate average match rate from daily stats."""
    if not stats:
        return 0.0

    total_requests = sum(d.get('totalRequests', 0) for d in stats)
    total_matched = sum(d.get('matchedCount', 0) for d in stats)

    return total_matched / total_requests if total_requests > 0 else 0.0
