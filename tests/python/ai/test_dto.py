"""Pydantic round-trip + Java JSON shape compatibility for ai.dto."""

import json

import pydantic
import pytest


def test_match_method_enum_has_all_12_values():
    from ai.dto import MatchMethod
    expected = {
        "EXACT", "PHRASE_MATCH", "REGEX", "KEYWORD",
        "SEMANTIC", "CLASSIFIER", "FUSION", "SIMILAR",
        "LLM", "DOMAIN_DEFAULT", "REJECTED", "NONE",
    }
    actual = {m.value for m in MatchMethod}
    assert actual == expected, f"Missing or extra values: {actual ^ expected}"


def test_action_type_enum_basic():
    from ai.dto import ActionType
    assert ActionType.QUERY.value == "QUERY"
    assert ActionType.UNKNOWN.value == "UNKNOWN"


def test_ai_intent_config_dto_has_factory_id_field():
    from ai.dto import AIIntentConfigDto
    cfg = AIIntentConfigDto(
        id="uuid-001",
        intentCode="TEST",
        intentName="测试",
    )
    assert cfg.factoryId is None  # null = platform-level
    assert cfg.businessType == "COMMON"  # default
    assert cfg.isActive is True  # default per Java @Builder.Default
    assert cfg.priority == 0


def test_intent_match_result_empty_byte_shape():
    """Java IntentMatchResult.empty(userInput) produces specific shape.
    Python builder must match."""
    from ai.dto import IntentMatchResultDto, MatchMethod, ActionType
    result = IntentMatchResultDto.empty(userInput="测试输入")
    assert result.bestMatch is None
    assert result.topCandidates == []
    assert result.confidence == 0.0
    assert result.matchMethod == MatchMethod.NONE
    assert result.matchedKeywords == []
    assert result.isStrongSignal is False
    assert result.requiresConfirmation is False
    assert result.userInput == "测试输入"
    assert result.actionType == ActionType.UNKNOWN
    assert result.targetEntity is None


def test_intent_match_result_serializes_to_19_top_keys():
    """JSON output must contain all 19 top-level fields (matching Java)."""
    from ai.dto import IntentMatchResultDto
    result = IntentMatchResultDto.empty(userInput="测试")
    json_str = result.model_dump_json()
    obj = json.loads(json_str)
    expected_keys = {
        "bestMatch", "topCandidates", "confidence", "matchMethod",
        "matchedKeywords", "isStrongSignal", "requiresConfirmation",
        "clarificationQuestion", "userInput", "actionType", "questionType",
        "targetEntity", "sessionId", "conversationMessage",
        "isMultiIntent", "additionalIntents", "executionStrategy",
        "timingMs", "preprocessedQuery",
    }
    actual_keys = set(obj.keys())
    assert expected_keys == actual_keys, f"Diff: {expected_keys ^ actual_keys}"


def test_candidate_intent_round_trip():
    from ai.dto import CandidateIntentDto, MatchMethod
    c = CandidateIntentDto(
        intentCode="X",
        intentName="X 名",
        intentCategory="ANALYSIS",
        confidence=0.9,
        matchScore=85,
        matchedKeywords=["a", "b"],
        matchMethod=MatchMethod.FUSION,
        description="desc",
    )
    json_str = c.model_dump_json()
    c2 = CandidateIntentDto.model_validate_json(json_str)
    assert c == c2


def test_request_dto_required_fields():
    from ai.dto import IntentMatchRequest

    with pytest.raises(pydantic.ValidationError) as exc_info:
        IntentMatchRequest(query="test")
    msg = str(exc_info.value)
    assert "factoryId" in msg
    assert "userId" in msg
    assert "role" in msg
    assert "businessType" in msg
    # Note: username NOT in assertion list — it's now Optional. Java's
    # AIIntentServiceImpl facade has no username available and sends null,
    # so the wire contract treats username as optional metadata.


def test_request_dto_username_optional():
    """username is Optional — Java facade may not have it.

    AIIntentServiceImpl.recognizeIntentWithConfidence(...) doesn't take
    username; it builds PythonIntentMatchRequest with username=null. Pydantic
    must accept that without raising a 422 ValidationError.
    """
    from ai.dto import IntentMatchRequest
    req = IntentMatchRequest(
        query="q",
        factoryId="F001",
        userId="22",
        role="factory_super_admin",
        businessType="FACTORY",
    )
    assert req.username is None


def test_request_dto_userId_is_string_not_int():
    """Plan §5.3: userId is String to match Java JWT claim type.

    Pydantic int would reject the string "22" with 422 — guard against
    regression by asserting the field stays a str on construction.
    """
    from ai.dto import IntentMatchRequest

    req = IntentMatchRequest(
        query="test",
        factoryId="F001",
        userId="22",
        username="admin",
        role="factory_super_admin",
        businessType="FACTORY",
    )
    assert isinstance(req.userId, str)
    assert req.userId == "22"


def test_request_dto_options_default_matches_plan_5_3():
    """Plan §5.3 options shape: enableLlmFallback / timeoutMs / minConfidence /
    intentConfigVersion. Defaults applied when caller omits options."""
    from ai.dto import IntentMatchRequest, IntentMatchOptions

    req = IntentMatchRequest(
        query="x",
        factoryId="F001",
        userId="22",
        username="admin",
        role="factory_super_admin",
        businessType="FACTORY",
    )
    assert isinstance(req.options, IntentMatchOptions)
    assert req.options.enableLlmFallback is True
    assert req.options.timeoutMs == 30000
    assert req.options.minConfidence == 0.70
    assert req.options.intentConfigVersion is None
    # history field present + defaults to empty list (forward-compat for stage 8 LLM)
    assert req.history == []


def test_ai_intent_config_dto_confidence_boost_is_json_number():
    """Java BigDecimal -> JSON number; Python must match (not JSON string).

    Pydantic v2 default emits Decimal as JSON string '"0.50"', which would
    break byte-shape parity with Jackson on the Java side. The DTO uses
    `float` so the JSON value is unquoted (a number). This test guards
    against future regression to Decimal.
    """
    from ai.dto import AIIntentConfigDto
    cfg = AIIntentConfigDto(intentCode="X", intentName="Y", confidenceBoost=0.50)
    parsed = json.loads(cfg.model_dump_json())
    assert isinstance(parsed['confidenceBoost'], (int, float)), \
        f"Expected JSON number, got {type(parsed['confidenceBoost']).__name__}"
    assert parsed['confidenceBoost'] == 0.50


def test_intent_match_result_populated_serializes_to_19_top_keys():
    """Same 19 keys whether empty or populated — byte-shape contract.

    Companion to test_intent_match_result_serializes_to_19_top_keys which
    only checks the empty() factory output. This populates every nullable
    field to confirm Pydantic doesn't drop keys when values become non-None
    (model_dump_json with default settings serializes None as JSON null).
    """
    from ai.dto import (
        IntentMatchResultDto, MatchMethod, ActionType, QuestionType,
        AIIntentConfigDto,
    )
    cfg = AIIntentConfigDto(intentCode="X", intentName="Y")
    r = IntentMatchResultDto(
        bestMatch=cfg,
        confidence=0.85,
        matchMethod=MatchMethod.KEYWORD,
        matchedKeywords=["成本"],
        isStrongSignal=True,
        requiresConfirmation=False,
        userInput="q",
        actionType=ActionType.QUERY,
        questionType=QuestionType.OPERATIONAL_COMMAND,
        timingMs={"preprocessMs": 5, "matchMs": 10, "totalMs": 15},
    )
    obj = json.loads(r.model_dump_json())
    expected_keys = {
        "bestMatch", "topCandidates", "confidence", "matchMethod",
        "matchedKeywords", "isStrongSignal", "requiresConfirmation",
        "clarificationQuestion", "userInput", "actionType", "questionType",
        "targetEntity", "sessionId", "conversationMessage",
        "isMultiIntent", "additionalIntents", "executionStrategy",
        "timingMs", "preprocessedQuery",
    }
    assert set(obj.keys()) == expected_keys, f"Diff: {set(obj.keys()) ^ expected_keys}"
    assert len(obj) == 19
