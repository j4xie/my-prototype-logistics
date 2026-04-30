"""ai/db.py — ai_intent_configs read filtering."""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_filter_platform_visible_to_F001_FACTORY(sample_intent_rows):
    """F001 + FACTORY business should see: platform COMMON + F001 FACTORY,
    NOT F002 FACTORY, NOT RESTAURANT, NOT deleted, NOT inactive."""
    from ai.db import filter_intents_for_request
    visible = filter_intents_for_request(
        sample_intent_rows,
        factoryId="F001",
        businessType="FACTORY",
    )
    codes = {r["intent_code"] for r in visible}
    assert "INVENTORY_QUERY" in codes
    assert "F001_CUSTOM_INTENT" in codes
    assert "F002_LEAK_CHECK" not in codes
    assert "RESTAURANT_MENU" not in codes
    assert "DELETED_INTENT" not in codes
    assert "INACTIVE_INTENT" not in codes


@pytest.mark.asyncio
async def test_filter_platform_visible_to_RESTAURANT(sample_intent_rows):
    from ai.db import filter_intents_for_request
    visible = filter_intents_for_request(
        sample_intent_rows,
        factoryId="R_BEJ",
        businessType="RESTAURANT",
    )
    codes = {r["intent_code"] for r in visible}
    assert "INVENTORY_QUERY" in codes
    assert "RESTAURANT_MENU" in codes
    assert "F001_CUSTOM_INTENT" not in codes
    assert "F002_LEAK_CHECK" not in codes


def test_max_config_version_across_visible(sample_intent_rows):
    from ai.db import filter_intents_for_request, max_config_version
    visible = filter_intents_for_request(
        sample_intent_rows, factoryId="F001", businessType="FACTORY"
    )
    assert max_config_version(visible) == 5


def test_snapshot_class_basic_construction():
    from ai.db import IntentSnapshot
    snap = IntentSnapshot(rows=[], loaded_at_unix=0.0, max_config_version=0)
    assert snap.rows == []
    assert snap.max_config_version == 0


def test_to_dto_converts_row_to_AIIntentConfigDto():
    from ai.db import row_to_dto
    row = {
        "id": "uuid-X",
        "factory_id": None,
        "business_type": "COMMON",
        "intent_code": "X",
        "intent_name": "X名",
        "intent_category": "ANALYSIS",
        "sensitivity_level": "LOW",
        "tool_name": "x_tool",
        "is_active": True,
        "priority": 50,
        "config_version": 7,
        "keywords": '["k"]',
        "description": "d",
        "max_tokens": 2000,
        "quota_cost": 1,
        "cache_ttl_minutes": 0,
        "requires_approval": False,
        "negative_keyword_penalty": 15,
        "confidence_boost": 0.10,
    }
    dto = row_to_dto(row)
    assert dto.id == "uuid-X"
    assert dto.intentCode == "X"
    assert dto.factoryId is None
    assert dto.priority == 50
    assert dto.configVersion == 7
    assert dto.confidenceBoost == 0.10
