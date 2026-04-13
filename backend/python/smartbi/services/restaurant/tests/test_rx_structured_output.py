"""Unit tests for structured RxAction output (P3 Task 3.7)."""
import pytest

from smartbi.shared.diagnostics_engine import DiagnosticsEngine, RxAction


def test_cost_rigidity_playbook_returns_structured_rx_actions():
    """The cost_rigidity playbook must emit ≥3 structured RxAction objects."""
    engine = DiagnosticsEngine(domain="restaurant", sub_sector="火锅")
    diagnoses = engine.run({
        "revenue": 731048,
        "food_cost": 307040,
        "labor_cost": 237660,
        "rent": 85000,
        "cost_rigidity": 0.561,
    })

    # Find the cost_rigidity diagnosis
    cost_rigidity_diag = None
    for d in diagnoses:
        key = getattr(d, "metric_key", None) or getattr(d, "metric", None)
        if key == "cost_rigidity":
            cost_rigidity_diag = d
            break

    assert cost_rigidity_diag is not None, (
        f"cost_rigidity diagnosis not found. Got: {[(getattr(d, 'metric_key', None) or getattr(d, 'metric', None)) for d in diagnoses]}"
    )

    # rx_actions field must exist and have ≥3 structured items
    assert hasattr(cost_rigidity_diag, "rx_actions"), (
        "Diagnosis is missing rx_actions field"
    )
    assert len(cost_rigidity_diag.rx_actions) >= 3, (
        f"Expected ≥3 RxAction, got {len(cost_rigidity_diag.rx_actions)}"
    )

    first_action = cost_rigidity_diag.rx_actions[0]
    assert isinstance(first_action, RxAction)
    assert first_action.title, "title must be non-empty"
    assert first_action.description, "description must be non-empty"
    assert first_action.owner, "owner must be non-empty"
    assert first_action.timeframe, "timeframe must be non-empty"
    assert first_action.priority in ("P0", "P1", "P2"), f"got {first_action.priority}"
    assert first_action.effort in ("low", "medium", "high"), f"got {first_action.effort}"
    assert first_action.expected_impact, "expected_impact must be non-empty"


def test_diagnosis_to_dict_includes_rx_actions():
    """Diagnosis.to_dict() must emit camelCase rxActions array."""
    engine = DiagnosticsEngine(domain="restaurant", sub_sector="火锅")
    diagnoses = engine.run({
        "revenue": 731048,
        "food_cost": 307040,
        "labor_cost": 237660,
        "rent": 85000,
        "cost_rigidity": 0.561,
    })

    cost_rigidity_diag = None
    for d in diagnoses:
        key = getattr(d, "metric_key", None) or getattr(d, "metric", None)
        if key == "cost_rigidity":
            cost_rigidity_diag = d
            break

    json_dict = cost_rigidity_diag.to_dict()
    assert "rxActions" in json_dict
    assert isinstance(json_dict["rxActions"], list)
    assert len(json_dict["rxActions"]) >= 3

    first = json_dict["rxActions"][0]
    assert "title" in first
    assert "owner" in first
    assert "timeframe" in first
    assert "priority" in first
    assert "effort" in first
    assert "expectedImpact" in first  # camelCase conversion


def test_rx_action_dataclass_basic():
    """RxAction dataclass has all 8 fields."""
    action = RxAction(
        id="TEST-001",
        title="测试行动",
        description="测试描述",
        owner="店长",
        timeframe="本周内",
        priority="P0",
        effort="low",
        expected_impact="测试影响",
    )
    assert action.to_dict() == {
        "id": "TEST-001",
        "title": "测试行动",
        "description": "测试描述",
        "owner": "店长",
        "timeframe": "本周内",
        "priority": "P0",
        "effort": "low",
        "expectedImpact": "测试影响",
    }
