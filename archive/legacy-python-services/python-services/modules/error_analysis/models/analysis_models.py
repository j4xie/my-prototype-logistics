"""
Pydantic models for the Error Analysis Service.

Based on Java entities: IntentMatchRecord and ErrorAttributionStatistics
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class MatchMethod(str, Enum):
    """Intent matching method enumeration."""
    EXACT = "EXACT"
    REGEX = "REGEX"
    KEYWORD = "KEYWORD"
    SEMANTIC = "SEMANTIC"
    FUSION = "FUSION"
    SIMILAR = "SIMILAR"
    LLM = "LLM"
    DOMAIN_DEFAULT = "DOMAIN_DEFAULT"
    NONE = "NONE"


class ExecutionStatus(str, Enum):
    """Execution status enumeration."""
    PENDING = "PENDING"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ErrorAttribution(str, Enum):
    """Error attribution category enumeration."""
    RULE_MISS = "RULE_MISS"
    AMBIGUOUS = "AMBIGUOUS"
    FALSE_POSITIVE = "FALSE_POSITIVE"
    USER_CANCEL = "USER_CANCEL"
    SYSTEM_ERROR = "SYSTEM_ERROR"


# =============================================================================
# Request Models
# =============================================================================

class IntentMatchRecordDTO(BaseModel):
    """DTO for intent match record data from Java backend."""
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
    """Request for aggregating statistics from multiple records."""
    records: List[IntentMatchRecordDTO]


class FailurePatternRequest(BaseModel):
    """Request for detecting failure patterns."""
    records: List[IntentMatchRecordDTO]
    minFrequency: int = Field(default=3, ge=1, description="Minimum frequency to consider as a pattern")


class AmbiguousIntentRequest(BaseModel):
    """Request for detecting ambiguous intent patterns."""
    records: List[IntentMatchRecordDTO]
    minCount: int = Field(default=2, ge=1, description="Minimum count to consider as ambiguous")


class MissingRulesRequest(BaseModel):
    """Request for detecting missing rules."""
    records: List[IntentMatchRecordDTO]
    minCount: int = Field(default=3, ge=1, description="Minimum count to suggest as missing rule")


class KeywordExtractionRequest(BaseModel):
    """Request for extracting keywords from user inputs."""
    inputs: List[str]
    minFrequency: int = Field(default=2, ge=1, description="Minimum frequency for keyword extraction")
    topN: int = Field(default=10, ge=1, description="Number of top keywords to return")


class WeeklyReportRequest(BaseModel):
    """Request for generating weekly analysis report."""
    dailyStats: List[Dict[str, Any]]
    failurePatterns: List[Dict[str, Any]]
    ambiguousIntents: List[Dict[str, Any]]
    missingRules: List[Dict[str, Any]]


# =============================================================================
# Response Models
# =============================================================================

class CategoryStats(BaseModel):
    """Statistics for an intent category."""
    count: int
    successRate: float


class MethodStats(BaseModel):
    """Statistics for a matching method."""
    count: int
    avgConfidence: float


class AggregateResponse(BaseModel):
    """Aggregated statistics response."""
    # Basic counts
    totalRequests: int = 0
    matchedCount: int = 0
    unmatchedCount: int = 0

    # LLM and signal counts
    llmFallbackCount: int = 0
    strongSignalCount: int = 0
    weakSignalCount: int = 0

    # Confirmation counts
    confirmationRequested: int = 0
    userConfirmedCount: int = 0
    userRejectedCount: int = 0

    # Execution counts
    executedCount: int = 0
    failedCount: int = 0
    cancelledCount: int = 0

    # Error attribution counts
    ruleMissCount: int = 0
    ambiguousCount: int = 0
    falsePositiveCount: int = 0
    userCancelCount: int = 0
    systemErrorCount: int = 0

    # Metrics
    avgConfidence: float = 0.0

    # Detailed stats
    intentCategoryStats: Dict[str, CategoryStats] = {}
    matchMethodStats: Dict[str, MethodStats] = {}
    confidenceDistribution: Dict[str, int] = {}


class FailurePattern(BaseModel):
    """Detected failure pattern."""
    userInput: str
    count: int
    matchedIntent: Optional[str] = None
    errorAttribution: Optional[str] = None
    samples: List[str] = []


class FailurePatternResponse(BaseModel):
    """Response containing detected failure patterns."""
    patterns: List[FailurePattern]


class AmbiguousIntent(BaseModel):
    """Detected ambiguous intent pattern."""
    userInput: str
    count: int
    matchedIntents: List[str]
    avgConfidence: float


class AmbiguousIntentResponse(BaseModel):
    """Response containing detected ambiguous intents."""
    intents: List[AmbiguousIntent]


class MissingRule(BaseModel):
    """Detected missing rule suggestion."""
    userInput: str
    count: int
    suggestedKeywords: List[str]


class MissingRulesResponse(BaseModel):
    """Response containing detected missing rules."""
    rules: List[MissingRule]


class KeywordExtractionResponse(BaseModel):
    """Response containing extracted keywords."""
    keywords: List[str]


class WeeklyReportResponse(BaseModel):
    """Response containing weekly analysis report."""
    summary: Dict[str, Any]
    trends: Dict[str, Any]
    recommendations: List[str]


class ApiResponse(BaseModel):
    """Standard API response wrapper."""
    success: bool = True
    data: Optional[Any] = None
    message: Optional[str] = None
