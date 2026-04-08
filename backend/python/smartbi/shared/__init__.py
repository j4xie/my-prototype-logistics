"""SmartBI 共享底层 (domain-agnostic)

本目录是餐饮 + 工厂共用的基础设施层. 任何放在这里的代码必须满足:

1. **领域无关 (domain-agnostic)**: 不能假设是餐饮或工厂场景
2. **强制 domain 参数**: 所有跨 domain 的查找/写入必须带 `domain: Literal["restaurant", "factory"]`
3. **不允许跨 domain 数据污染**: 接口拒绝 `domain=None` 或 `domain="all"` 这种泛化值

跨 domain 隔离铁律 (与 services/restaurant/__init__.py + services/factory/__init__.py 一致):

  ✅ services/restaurant/* 可以 import shared/*
  ✅ services/factory/* 可以 import shared/*
  ❌ services/restaurant/* 禁止 import services/factory/*
  ❌ services/factory/* 禁止 import services/restaurant/*
  ❌ shared/* 禁止 import services/restaurant/* 或 services/factory/*  (依赖反转)

数据库层隔离:
  - business_config_overrides.domain 列必填, CHECK 约束限定取值
  - business_config_overrides.config_key 必须以 'restaurant.' 或 'factory.' 开头
  - 任何查找强制 WHERE domain = ?, 不允许 domain IS NULL

模块清单:
  - dynamic_config_resolver.py  : 4 层覆盖配置查找
  - alias_normalizer.py          : 半自动命名归一 (餐饮菜品 + 工厂 SKU)
  - diagnostics_engine.py        : 通用 metric 注册 + playbook 触发 (Phase 2)
  - data_integrity_validator.py  : CSV 元信息 + 截断检测 (Phase 2)
  - temporal_comparator.py       : 同期对比自动降级 (Phase 2)
  - benchmark_alert_engine.py    : 通用对标预警 (Phase 2)
"""
from .dynamic_config_resolver import (
    ConfigSource,
    ConfigValue,
    Domain,
    DynamicConfigResolver,
)

__all__ = [
    "ConfigSource",
    "ConfigValue",
    "Domain",
    "DynamicConfigResolver",
]
