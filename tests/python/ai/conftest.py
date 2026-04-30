"""Shared fixtures for ai/ test suite."""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture
def mock_db_pool():
    """Mock asyncpg pool that callers configure as needed."""
    pool = MagicMock()
    return pool


@pytest.fixture
def sample_intent_rows() -> list[dict[str, Any]]:
    """Canned rows mimicking ai_intent_configs SELECT result.

    Covers six scope/state combinations exercised by db.py filter logic:
    - uuid-1: platform-level COMMON (visible to everyone)
    - uuid-2: F001 FACTORY (only F001 callers)
    - uuid-3: F002 FACTORY (must NOT leak to F001)
    - uuid-4: platform RESTAURANT (only RESTAURANT business)
    - uuid-5: soft-deleted (must be filtered out at SQL load — included
      here in the fixture only to assert filter logic does not depend on
      deleted_at column being already-stripped)
    - uuid-6: inactive (same — SQL strips, but a defensive in-memory
      filter is OK)
    """
    return [
        {
            "id": "uuid-1",
            "factory_id": None,  # platform-level
            "business_type": "COMMON",
            "intent_code": "INVENTORY_QUERY",
            "intent_name": "库存查询",
            "intent_category": "ANALYSIS",
            "sensitivity_level": "LOW",
            "tool_name": "material_inventory_query",
            "is_active": True,
            "priority": 80,
            "config_version": 1,
            "deleted_at": None,
            "keywords": '["库存","查询"]',
            "description": "查询库存",
            "max_tokens": 2000,
            "quota_cost": 1,
            "cache_ttl_minutes": 0,
            "requires_approval": False,
            "negative_keyword_penalty": 15,
            "confidence_boost": 0.0,
        },
        {
            "id": "uuid-2",
            "factory_id": "F001",
            "business_type": "FACTORY",
            "intent_code": "F001_CUSTOM_INTENT",
            "intent_name": "F001 自定义",
            "intent_category": "ANALYSIS",
            "sensitivity_level": "LOW",
            "tool_name": "f001_custom",
            "is_active": True,
            "priority": 90,
            "config_version": 5,
            "deleted_at": None,
            "keywords": '["F001"]',
            "description": "F001",
            "max_tokens": 2000,
            "quota_cost": 1,
            "cache_ttl_minutes": 0,
            "requires_approval": False,
            "negative_keyword_penalty": 15,
            "confidence_boost": 0.0,
        },
        {
            "id": "uuid-3",
            "factory_id": "F002",  # different factory — must NOT leak
            "business_type": "FACTORY",
            "intent_code": "F002_LEAK_CHECK",
            "intent_name": "F002 泄露检查",
            "intent_category": "ANALYSIS",
            "sensitivity_level": "LOW",
            "tool_name": "f002_leak",
            "is_active": True,
            "priority": 90,
            "config_version": 3,
            "deleted_at": None,
            "keywords": '["F002"]',
            "description": "F002",
            "max_tokens": 2000,
            "quota_cost": 1,
            "cache_ttl_minutes": 0,
            "requires_approval": False,
            "negative_keyword_penalty": 15,
            "confidence_boost": 0.0,
        },
        {
            "id": "uuid-4",
            "factory_id": None,
            "business_type": "RESTAURANT",
            "intent_code": "RESTAURANT_MENU",
            "intent_name": "菜单",
            "intent_category": "RESTAURANT",
            "sensitivity_level": "LOW",
            "tool_name": "restaurant_menu",
            "is_active": True,
            "priority": 50,
            "config_version": 2,
            "deleted_at": None,
            "keywords": '["菜单"]',
            "description": "菜单",
            "max_tokens": 2000,
            "quota_cost": 1,
            "cache_ttl_minutes": 0,
            "requires_approval": False,
            "negative_keyword_penalty": 15,
            "confidence_boost": 0.0,
        },
        {
            "id": "uuid-5",
            "factory_id": None,
            "business_type": "COMMON",
            "intent_code": "DELETED_INTENT",
            "intent_name": "已删",
            "intent_category": "ANALYSIS",
            "sensitivity_level": "LOW",
            "tool_name": "deleted",
            "is_active": True,
            "priority": 10,
            "config_version": 1,
            "deleted_at": "2026-01-01 00:00:00",  # soft-deleted
            "keywords": "[]",
            "description": "deleted",
            "max_tokens": 2000,
            "quota_cost": 1,
            "cache_ttl_minutes": 0,
            "requires_approval": False,
            "negative_keyword_penalty": 15,
            "confidence_boost": 0.0,
        },
        {
            "id": "uuid-6",
            "factory_id": None,
            "business_type": "COMMON",
            "intent_code": "INACTIVE_INTENT",
            "intent_name": "已禁",
            "intent_category": "ANALYSIS",
            "sensitivity_level": "LOW",
            "tool_name": "inactive",
            "is_active": False,  # disabled
            "priority": 10,
            "config_version": 1,
            "deleted_at": None,
            "keywords": "[]",
            "description": "inactive",
            "max_tokens": 2000,
            "quota_cost": 1,
            "cache_ttl_minutes": 0,
            "requires_approval": False,
            "negative_keyword_penalty": 15,
            "confidence_boost": 0.0,
        },
    ]
