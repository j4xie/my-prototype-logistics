import pandas as pd
from typing import List, Dict, Any
from collections import defaultdict

def aggregate_daily_statistics(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate daily statistics from intent match records using pandas."""
    if not records:
        return _empty_stats()

    df = pd.DataFrame(records)

    # Basic counts
    total = len(df)
    matched = df['matchedIntentCode'].notna().sum()
    unmatched = total - matched
    llm_fallback = df['llmCalled'].fillna(False).sum()

    # Signal distribution
    strong_signal = df['isStrongSignal'].fillna(False).sum()
    weak_signal = total - strong_signal

    # Confirmation stats
    confirmation_requested = df['requiresConfirmation'].fillna(False).sum()
    confirmed_mask = df['userConfirmed'].notna()
    user_confirmed = (df.loc[confirmed_mask, 'userConfirmed'] == True).sum()
    user_rejected = (df.loc[confirmed_mask, 'userConfirmed'] == False).sum()

    # Execution stats
    exec_status = df['executionStatus'].fillna('PENDING')
    executed = (exec_status == 'EXECUTED').sum()
    failed = (exec_status == 'FAILED').sum()
    cancelled = (exec_status == 'CANCELLED').sum()

    # Error attribution counts
    error_attr = df['errorAttribution'].fillna('')
    rule_miss = (error_attr == 'RULE_MISS').sum()
    ambiguous = (error_attr == 'AMBIGUOUS').sum()
    false_positive = (error_attr == 'FALSE_POSITIVE').sum()
    user_cancel = (error_attr == 'USER_CANCEL').sum()
    system_error = (error_attr == 'SYSTEM_ERROR').sum()

    # Average confidence
    confidence_values = df['confidenceScore'].dropna()
    avg_confidence = float(confidence_values.mean()) if len(confidence_values) > 0 else 0.0

    # Intent category stats
    category_stats = _calculate_category_stats(df)

    # Match method stats
    method_stats = _calculate_method_stats(df)

    # Confidence distribution
    confidence_dist = _calculate_confidence_distribution(df)

    return {
        "totalRequests": int(total),
        "matchedCount": int(matched),
        "unmatchedCount": int(unmatched),
        "llmFallbackCount": int(llm_fallback),
        "strongSignalCount": int(strong_signal),
        "weakSignalCount": int(weak_signal),
        "confirmationRequested": int(confirmation_requested),
        "userConfirmedCount": int(user_confirmed),
        "userRejectedCount": int(user_rejected),
        "executedCount": int(executed),
        "failedCount": int(failed),
        "cancelledCount": int(cancelled),
        "ruleMissCount": int(rule_miss),
        "ambiguousCount": int(ambiguous),
        "falsePositiveCount": int(false_positive),
        "userCancelCount": int(user_cancel),
        "systemErrorCount": int(system_error),
        "avgConfidence": round(avg_confidence, 4),
        "intentCategoryStats": category_stats,
        "matchMethodStats": method_stats,
        "confidenceDistribution": confidence_dist
    }

def _calculate_category_stats(df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
    """Calculate statistics grouped by intent category."""
    result = {}
    category_col = df['matchedIntentCategory'].fillna('未分类')

    for category in category_col.unique():
        mask = category_col == category
        category_df = df[mask]
        count = len(category_df)

        # Success rate: executed / (executed + failed)
        exec_status = category_df['executionStatus'].fillna('PENDING')
        executed = (exec_status == 'EXECUTED').sum()
        failed = (exec_status == 'FAILED').sum()
        success_rate = executed / (executed + failed) if (executed + failed) > 0 else 0.0

        result[category] = {
            "count": int(count),
            "successRate": round(success_rate, 4)
        }

    return result

def _calculate_method_stats(df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
    """Calculate statistics grouped by match method."""
    result = {}
    method_col = df['matchMethod'].fillna('NONE')

    for method in method_col.unique():
        mask = method_col == method
        method_df = df[mask]
        count = len(method_df)

        confidence_values = method_df['confidenceScore'].dropna()
        avg_conf = float(confidence_values.mean()) if len(confidence_values) > 0 else 0.0

        result[method] = {
            "count": int(count),
            "avgConfidence": round(avg_conf, 4)
        }

    return result

def _calculate_confidence_distribution(df: pd.DataFrame) -> Dict[str, int]:
    """Calculate confidence score distribution in 5 buckets."""
    buckets = {
        "0.0-0.3": 0,
        "0.3-0.5": 0,
        "0.5-0.7": 0,
        "0.7-0.9": 0,
        "0.9-1.0": 0
    }

    confidence = df['confidenceScore'].dropna()

    for score in confidence:
        if score < 0.3:
            buckets["0.0-0.3"] += 1
        elif score < 0.5:
            buckets["0.3-0.5"] += 1
        elif score < 0.7:
            buckets["0.5-0.7"] += 1
        elif score < 0.9:
            buckets["0.7-0.9"] += 1
        else:
            buckets["0.9-1.0"] += 1

    return buckets

def _empty_stats() -> Dict[str, Any]:
    """Return empty statistics structure."""
    return {
        "totalRequests": 0,
        "matchedCount": 0,
        "unmatchedCount": 0,
        "llmFallbackCount": 0,
        "strongSignalCount": 0,
        "weakSignalCount": 0,
        "confirmationRequested": 0,
        "userConfirmedCount": 0,
        "userRejectedCount": 0,
        "executedCount": 0,
        "failedCount": 0,
        "cancelledCount": 0,
        "ruleMissCount": 0,
        "ambiguousCount": 0,
        "falsePositiveCount": 0,
        "userCancelCount": 0,
        "systemErrorCount": 0,
        "avgConfidence": 0.0,
        "intentCategoryStats": {},
        "matchMethodStats": {},
        "confidenceDistribution": {
            "0.0-0.3": 0,
            "0.3-0.5": 0,
            "0.5-0.7": 0,
            "0.7-0.9": 0,
            "0.9-1.0": 0
        }
    }
