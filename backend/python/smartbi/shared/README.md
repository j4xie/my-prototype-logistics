# SmartBI 共享底层 (`shared/`)

**领域无关** 的基础设施层. 餐饮 (`services/restaurant/`) 和工厂 (`services/factory/`) 都依赖此目录, 但本目录**不依赖任何 domain-specific 代码**.

## 隔离铁律

```
        ┌─────────────────────────────────┐
        │       shared/  (本目录)           │
        │  ── domain-agnostic 基础设施 ──   │
        └─────────────────────────────────┘
                  ↑              ↑
                  │              │
        ┌─────────┴────┐   ┌────┴───────────┐
        │ restaurant/  │   │   factory/      │
        │  (本 chat 全建)│   │  (Phase 2 全建) │
        └──────────────┘   └─────────────────┘
              ⊥                     ⊥
              └───── 禁止互相 import ────┘
```

| 允许 | 禁止 |
|------|------|
| `from shared.dynamic_config_resolver import ...` | `from services.factory.* import ...` (in restaurant) |
| `from shared.alias_normalizer import ...` | `from services.restaurant.* import ...` (in factory) |
| | `from services.* import ...` (in shared/) |

## 数据隔离

所有共享表都通过 `domain` 列严格隔离:

```sql
business_config_overrides:
  domain VARCHAR(16) NOT NULL CHECK (domain IN ('restaurant', 'factory'))
  config_key VARCHAR(255) NOT NULL CHECK (config_key LIKE domain || '.%')

alias_review_queue:
  domain VARCHAR(16) NOT NULL CHECK (domain IN ('restaurant', 'factory'))
```

任何查找强制带 `domain` 参数:

```python
# ✅ 正确
resolver = DynamicConfigResolver(factory_id="F001", domain="restaurant")
config = resolver.resolve("restaurant.cogs.美团外卖")

# ❌ 拒绝 — 没带 domain
resolver = DynamicConfigResolver(factory_id="F001")  # TypeError

# ❌ 拒绝 — config_key 没带 domain 前缀
resolver.resolve("cogs.美团外卖")  # ValueError

# ❌ 拒绝 — 跨 domain 查找
resolver = DynamicConfigResolver(factory_id="F001", domain="restaurant")
resolver.resolve("factory.bom.熟食加工")  # ValueError
```

## CI 检查

`pre-commit` 钩子会检查:

```bash
# services/restaurant/ 不能 import services/factory/
grep -rE "^from services\.factory" services/restaurant/ && exit 1

# services/factory/ 不能 import services/restaurant/
grep -rE "^from services\.restaurant" services/factory/ && exit 1

# shared/ 不能 import services/
grep -rE "^from services\." shared/ && exit 1
```

## 模块

| 模块 | 职责 | Phase |
|------|------|-------|
| `dynamic_config_resolver.py` | 4 层覆盖配置查找 (临时→门店→工厂→YAML 默认) | **Week 1** ✅ |
| `alias_normalizer.py` | 半自动命名归一 (餐饮菜品 + 工厂 SKU) | **Week 1** ✅ |
| `diagnostics_engine.py` | 通用 metric 注册 + 阈值引擎 + playbook 触发 | Week 2 |
| `data_integrity_validator.py` | CSV 元信息识别 + 截断检测 + 月度连续性 | Week 3 |
| `temporal_comparator.py` | 同期对比自动降级 (年→季→月→单期) | Week 3 |
| `benchmark_alert_engine.py` | 通用对标预警 (读 benchmark YAML) | Week 2 |
