"""
Models package for Error Analysis Service.
"""

from .analysis_models import (
    # Enums
    MatchMethod,
    ExecutionStatus,
    ErrorAttribution,
    # Request Models
    IntentMatchRecordDTO,
    AggregateRequest,
    FailurePatternRequest,
    AmbiguousIntentRequest,
    MissingRulesRequest,
    KeywordExtractionRequest,
    WeeklyReportRequest,
    # Response Models
    CategoryStats,
    MethodStats,
    AggregateResponse,
    FailurePattern,
    FailurePatternResponse,
    AmbiguousIntent,
    AmbiguousIntentResponse,
    MissingRule,
    MissingRulesResponse,
    KeywordExtractionResponse,
    WeeklyReportResponse,
    ApiResponse,
)

__all__ = [
    # Enums
    "MatchMethod",
    "ExecutionStatus",
    "ErrorAttribution",
    # Request Models
    "IntentMatchRecordDTO",
    "AggregateRequest",
    "FailurePatternRequest",
    "AmbiguousIntentRequest",
    "MissingRulesRequest",
    "KeywordExtractionRequest",
    "WeeklyReportRequest",
    # Response Models
    "CategoryStats",
    "MethodStats",
    "AggregateResponse",
    "FailurePattern",
    "FailurePatternResponse",
    "AmbiguousIntent",
    "AmbiguousIntentResponse",
    "MissingRule",
    "MissingRulesResponse",
    "KeywordExtractionResponse",
    "WeeklyReportResponse",
    "ApiResponse",
]
