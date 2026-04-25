# Day 0 Audit + Day 1 ALIAS 搬家 — 结果报告

**日期**: 2026-04-25
**Commit**: `a18f4c393` (因并发 session 顺走, 我的文件 bundle 在那条 commit 里, 其 commit message 未提我的工作 — 这是 .claude/rules/concurrent-edit-safety.md Apr 11 事故同模式)

## Day 0 ALIAS Pre-Flight Audit 结果

跑 `数据织网/implementation/day0-alias-audit.py` 对 prod 12 factories 的 1,091 distinct field names 做覆盖检测.

### 命中率 (扩展前 — 13 canonical fields)

| Factory | Coverage | % | bill_flow shape ok? |
|---|---|---|---|
| F002 (财务/分析) | 6/13 | 46% | ❌ 缺 source_bill_no |
| F003 / F004 (财务报表) | 1/13 | 8% | ❌ 缺 store_name + bill_no |
| RES_3101_009 (POS) | 7/13 | 54% | ❌ 缺 source_bill_no |
| RES_GML_001 (桂满陇 POS) | 7/13 | 54% | ❌ 缺 source_bill_no |
| R_XMX_FRESH (商品汇总) | 9/13 | 69% | ❌ 缺 date |
| R_XMX_FRESH2/3 | 2/13 | 15% | ❌ 缺 date + bill_no |

**结论**: prod **0/9 factory 有完整 bill_flow shape**. 大多数是 product_summary shape (商品汇总).

### 命中率 (扩展后 — 26 canonical fields, Day 1 实施完)

| Factory | Coverage | % | product_summary shape ok? |
|---|---|---|---|
| F002 | 16/26 | 62% | ✅ |
| F003 / F004 | 1/26 | 4% | ❌ (财务 pivot, 留 B finance shape) |
| RES_3101_009 | 20/26 | 77% | ✅ |
| RES_GML_001 | 20/26 | 77% | ✅ |
| R_XMX_FRESH | 22/26 | **85%** | ✅ |
| R_XMX_FRESH2/3 | 13/26 | 50% | ✅ |

**结论**: 6/9 factory 满足 product_summary shape (store + product_name + revenue), A 上线后**这 6 家立刻能看到商品类卡片**.

## Day 1 ALIAS 搬家 + 扩展 (用户决策 option 2)

### 文件改动

1. **新建** `backend/python/smartbi/canonical/aliases.py` (169 行)
   - A v1.4 §3.0 Day 1 任务前置: 把 `_ALIAS_TO_ATTR` 从 `scripts/backfill_silver.py` 搬到 `smartbi/canonical/`
   - 26 个 canonical fields, ~110 个中文/英文别名
   - 加 13 个 product_summary 字段:
     - 产品维度: `product_name` / `product_code` / `category`
     - 销售维度: `revenue` / `qty_sold` / `unit_price` / `product_unit`
     - 退货: `refund_qty` / `refund_amount`
     - POS 扩展: `service_fee` / `tax` / `tip` / `invoice_amount`

2. **修改** `backend/python/scripts/backfill_silver.py`
   - 删除原 `_ALIAS_TO_ATTR` dict
   - `from smartbi.canonical.aliases import ALIAS_TO_ATTR`
   - 保留 `_ALIAS_TO_ATTR = ALIAS_TO_ATTR` 别名 (向后兼容现有 test)

3. **更新** `数据织网/02-A-能力驱动渲染.md` v1.4 → v1.5
   - §2.1 canonical 字段表从 13 → 26 行
   - 修订记录加 v1.5 entry 描述 Day 0 audit 决策 + 扩展逻辑

## 行为影响验证

| 模块 | 影响 | 原因 |
|---|---|---|
| `backfill_silver.py` `_build_canonical_row` | **不变** | CanonicalRow 只读原 12 字段, 新字段静默忽略 |
| `tests/test_backfill_silver.py` | **不变** | `from backfill_silver import _ALIAS_TO_ATTR` 仍工作 |
| Capability calculator (Day 2 实施) | **新增可用 13 字段** | 客户上传 product_summary 数据时能解锁新卡片 |
| B 阶段 ProductSummaryWriter | **不需 ALIAS 改动** | B 只需读这些 canonical 字段写 agg_product_period |

## 下一步 (Day 2-3)

按 02-A spec §7 Phase 1 继续:

1. **Day 2-3**: `smartbi/capability/` 模块骨架
   - `calculator.py` — `CapabilityCalculator` class
   - `contract.py` — `RequiresSpec` dataclass
   - `api.py` — FastAPI endpoint `/api/smartbi/capability/{factory_id}`
   - 单元测试覆盖空 factory / 单文件 / 多文件 / 缓存 TTL / RLS

2. **Day 4-5 (与 Chat B 并行启动点)**: B 标注数据集准备可启动 (B 不依赖 capability API, 只依赖 ALIAS)

## 工具

`数据织网/implementation/day0-alias-audit.py` — 可重跑. 用法:
```
ssh root@47.100.235.168 "PGPASSWORD=... psql ... -c '...' " > field_defs.txt
python -X utf8 数据织网/implementation/day0-alias-audit.py field_defs.txt
```

`数据织网/implementation/field_defs.txt` — 2026-04-25 prod snapshot, 1091 行.
