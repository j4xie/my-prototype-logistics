"""Pydantic round-trip + Java JSON shape compatibility for ai.dto."""

import json


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
    import pydantic
    try:
        IntentMatchRequest(query="test")
        raise AssertionError("Should have raised")
    except pydantic.ValidationError as e:
        msg = str(e)
        assert "factoryId" in msg
        assert "userId" in msg
        assert "role" in msg
        assert "businessType" in msg
