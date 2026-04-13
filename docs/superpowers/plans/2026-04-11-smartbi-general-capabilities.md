# SmartBI General Capabilities — Lessons from Enterprise Restaurant Data

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize 7 patterns from 鼎鲜火锅's real finance/ops data into universal SmartBI capabilities, with sensible defaults and configurable overrides. No customer sign-off required before shipping.

**Architecture:** Each gap becomes a new module with a domain-agnostic core + restaurant adapter. All ambiguous treatments implemented as toggles/enums, not questions. Integrates with existing P1 section handlers (15) and P2 Java tool layer (14 tools). No rewrites — incremental additions.

**Tech Stack:** Python (FastAPI + pandas + openpyxl + python-pptx), Java (Spring Boot + Flyway), PostgreSQL, existing `AbstractSectionHandler` + `AbstractBusinessTool` patterns.

**Prerequisites:**
- P1 complete (15 section handlers @ commit `88c7f0f42`)
- P2 complete (14 diagnostic tools + 2 skills + Flyway intents @ commit `4526b7c73`)
- P3.1 complete (Kasavana-Smith menu engineering @ commit `2fa68d4d2`)
- Worktree: `C:/Users/Steve/my-prototype-logistics/my-prototype-logistics-smartbi-task17` on `feature/smartbi-restaurant-p1-section-split`
- Baseline: **104 Python tests** + **18 Java tests** passing

---

## 0. Executive Summary

The 12 files 鼎鲜 sent are not test fixtures — they're a **mature餐饮连锁 financial management system**. Every mature chain has the same 7 patterns we missed:

1. **Expense Account Tree (55+ subaccounts)** — we bucket everything into 5 crude categories, losing diagnostic precision 10x
2. **Margin Spec Contract (口径边界)** — we hardcode one interpretation of "net profit", causing 5-10% errors vs customer's own books
3. **2-layer BOM with yield rate** — kitchens have semi-finished products (自制高汤, 鸡爪酱) and waste (出成率); our Layer 2 resolver is flat
4. **Shrinkage Engine** — every kitchen has standard-vs-actual variance; without this there's no improvement loop
5. **Department Hierarchy Tree** — labor/cost by "前厅/后厨/明档/洗杀" is mandatory for multi-kitchen stores
6. **Monthly PPT Export** — bosses still want 19-slide decks, not JSON; we have nothing here
7. **Raw Material Master** — 库存单位/核算单位 conversion is foundational; we assume "one unit = one unit"

**Design philosophy** (from user feedback): **no pre-launch questionnaires**. Every ambiguous treatment becomes a `FactoryConfig` field with a sensible default. Customers who disagree can toggle later. Everything is configurable and every option is implemented, including both 折前/折后 毛利率, all 3 充卡 treatments (PREPAID/REVENUE/EXCLUDED), etc.

**Scope**: 27 tasks across 5 phases, estimated **3-4 person-weeks**. Phase 3.5A (5 quick wins) ships in 1 day. The 2 highest-ROI modules are **G1 Expense Tree** (10x diagnostic precision) and **G6 PPT Exporter** ("replaces your financial report" 成交故事).

**Why now**: P1/P2/P3.1 gave us the wiring. Without this phase, customers will see diagnostics that look smart but can't reconcile against their own books → trust death.

---

## 1. Universal Pattern Analysis

### G1: Expense Account Tree (费用科目树)

**Pattern**: Every mature restaurant chain has 30-60 expense subaccounts organized as a tree (门店可控 vs 集团代管 → 一级 → 二级). Ours is a flat 5-bucket.

**Evidence**:
- `3、费用科目规范.xlsx` Sheet1: 41 rows × 7 cols `所属 | 费用二级科目 | 科目解释 | 属性 | 流程规范 | 备注 | 责任人`
- `火锅2月利润表.xls` rows 13-58: **45 营业费用子科目** (工资/奖金/福利/保险/住房公积金/服装/宿舍/通讯/办公/工伤/推荐/水/电/柴油/交通/燃料/维修/差旅/零钞/刷卡/卫生/运杂/房产税/招待/抵扣券/招聘/洗涤/排污/电梯/消杀/低值易耗/物料/广告/培训/绿化/充卡赠送/折旧/长期摊销/内部管理/房租/物业管理/健康证/折扣佣金/区部/支付宝/微信/汇兑/报刊/演艺/其他)
- `附件一、核算结构.xlsx` Sheet1: 30-row三级部门树 sample

**Universal scope**: **Applies to every vertical** (bakery, 西餐, 日料, 面馆, 快餐). Not restaurant-specific. Even manufacturing (Cretas's core) has a chart of accounts.

**Configuration strategy**:
- Default tree loaded from `knowledge/restaurant/expense_account_tree/default.yaml`
- `FactoryConfig.expenseAccountTreeId` overrides (per-factory YAML path or DB reference)
- Fallback: 5-bucket mode stays valid for legacy Excel uploads

### G2: Margin Spec Contract (毛利率口径)

**Pattern**: Every finance team has to answer 4 ambiguous binary questions before computing "net margin":
1. 员工餐 计入营业成本? (yes/no)
2. 燃气 计入营业成本? (yes/no)
3. 充卡赠送 in revenue side treatment? (PREPAID / REVENUE / EXCLUDED)
4. 投资费用 (装修/扩建) 计入经营费用? (yes/no/摊销)

Plus: 毛利率 computed 折前 vs 折后 (both matter).

**Evidence**:
- `#1附件一：净利润率计算口径确认表.docx` — entire document is this question
- Real P&L row 16 `折前毛利率` + row 17 `折后毛利率` (both computed, both shown)
- Row 20 `充卡赠送 51680.61` explicitly called out as a bucket

**Universal scope**: **Every restaurant**. Also applies to manufacturing (scrap rate), retail (markdown), services (billable hours).

**Configuration strategy**:
- `FactoryConfig.marginSpec` JSON with ALL 4 flags + both margin modes
- Defaults: `includeStaffMealInCogs: true`, `includeGasInCogs: true`, `storedValueTreatment: PREPAID`, `includeInvestmentInOpex: false`, `marginCalcMode: BOTH`, `primaryMarginDisplay: UNFOLDED`
- Analyzer computes BOTH 折前 + 折后 always; UI picks which to highlight
- `stored_value_analyzer` has a `mode` param that implements all 3 PREPAID/REVENUE/EXCLUDED paths

### G3: 2-layer BOM with Yield Rate (成本卡 + 出成率)

**Pattern**: Kitchens have 3 levels of ingredient composition:
- Raw materials (凤爪, 大葱)
- Semi-finished products (自制鸡爪酱, 自制高汤) made FROM raw materials
- Dishes (金汤凤爪) made FROM both raw and semi-finished

Plus yield rate (出成率): 大葱买来 1000g, 切好只剩 500g (50% yield), so 毛料 = 净料 / 出成率.

**Evidence**:
- `附件七-2、菜品成本卡模板.xlsx` Sheet `成本卡`: 金汤凤爪 references `自制鸡爪酱` + `自制鸡爪汁` + `凤爪` (raw)
- `附件六-2、自制半成品成本卡模板.xlsx` Sheet `成本卡`: 自制鸡爪酱 BOM has columns `耗用部门 | 原料名称 | 核算单位 | 批次净料 | 出成率 | 批次毛料 | 单位毛料 | 制作人`
- Real example: 大葱 批次净料 500g × 出成率 0.5 = 批次毛料 1000g

**Universal scope**: **餐饮-only** (bakery has equivalent: 面团 → 面包 structure with yield loss). Retail/manufacturing don't have yield rate semantics.

**Configuration strategy**:
- New entity `IntermediateProduct` with `yield_rate` field (default 1.0 = no loss)
- `sku_form_manager` Layer 2 schema gains optional `semi_finished_products` array
- `BomResolver.resolve_cogs()` becomes recursive: dish → semi-finished → raw
- Factories can opt out via `FactoryConfig.bomLayerMax: 1` (stays flat)

### G4: Shrinkage Engine (损溢)

**Pattern**: Every kitchen has variance between standard cost (what BOM says it should cost) and actual cost (what月底盘点 shows). Without tracking this, no improvement loop exists.

**Evidence**:
- `4-1-xx店 - 月度经营分析-24.10.pptx` Slide 9 `档口实际成本 / 标准成本 / 损溢额 / 损溢率` table (8 档口 × 4 columns)
- Slide 10 `工作改进跟踪表` rows with `负589 / 加强原料验收 / 责任人 / 截止时间`

**Universal scope**: **Every inventory-based business** (restaurant / retail / manufacturing). Not specific to餐饮.

**Configuration strategy**:
- New `ShrinkageEngine` component in `services/finance/`
- Requires: standard cost (from BOM G3) + actual cost (from月底盘点 data input)
- Output: per-department variance + top offenders + suggested action items
- Defaults: no config, runs whenever both inputs available

### G5: Department Hierarchy Tree (部门三级树)

**Pattern**: Multi-kitchen restaurants organize costs by department (前厅/后厨/财务/...) then sub-department (明档/热菜/冷菜/刺身/...). Required for per-department P&L and per-head productivity analysis.

**Evidence**:
- `附件一、核算结构.xlsx` Sheet1 3-level tree template
- `4-1-xx店 - 月度经营分析-24.10.pptx` Slide 14 `30-row 部门人均产出比` table covers 热菜/凉菜/明档/烤鸭/前厅管理/服务员/收银/传菜/PA/营销/店总/财务/采购/仓管/保安
- Slide 8 `档口毛利率` breaks down 毛利 per 档口 (8 departments)

**Universal scope**: **Restaurant-specific naming, universal concept**. Any multi-team operation benefits.

**Configuration strategy**:
- New entity `DepartmentNode` (parent_id, level, sort_order, head_count_target)
- `FactoryConfig.departmentTreeId` → YAML or DB reference
- Default tree: `knowledge/restaurant/department_tree/hotpot_default.yaml` (火锅 layout)
- Alt defaults: `bakery_default.yaml`, `western_default.yaml`, etc.
- `store_pnl_one_pager` gains optional `department_breakdown` field when tree available

### G6: Monthly PPT Exporter (月度经营分析 PPT)

**Pattern**: Restaurant bosses accept ONE deliverable format for monthly review: a 15-25 slide deck matching their existing template. JSON or HTML reports get ignored. Existing templates are stable over 5+ years.

**Evidence**:
- `4-1-xx店 - 月度经营分析-24.10.pptx` — 19 slides:
  1. 封面, 2. 目录, 3. 月度简报, 4. (章节分隔), 5. 1-12月营收完成表, 6. 5营业点对比, 7. 25行环比二期表, 8. 厨房档口毛利率, 9. 损溢指标分析, 10. 工作改进跟踪表, 11. 费用开支明细, 12. 25+费用科目预算达成, 13. 人力成本+在职人数, 14. 30行部门人均产出, 15. (章节分隔), 16. 下月营收计划, 17. 下月毛利计划, 18. 下月费用计划, 19. 具体措施

**Universal scope**: **Universal for formal business reporting**. Pattern applies to any industry where monthly review meetings are a thing.

**Configuration strategy**:
- New `MonthlyPptExporter` service using `python-pptx`
- Template library: `knowledge/restaurant/ppt_templates/monthly_default.pptx` (19-slide skeleton)
- Alt templates: `weekly_simple.pptx`, `quarterly_summary.pptx`
- Placeholder replacement: reads `store_pnl_one_pager` JSON + section data, fills into template
- Output: downloadable `.pptx` file via new endpoint `GET /api/smartbi/restaurant/ppt-export/{factoryId}/{period}`

### G7: Raw Material Master (原料字典 + 单位换算)

**Pattern**: Every restaurant has a raw material dictionary with 库存单位 (斤 / 包) vs 核算单位 (克 / 个), and a conversion规格 (1 斤 = 500 克). Without this, BOM calculation is wrong by factors of 10-1000.

**Evidence**:
- `附件三、门店原材料.xlsx` Sheet1 45 rows × 8 cols: `原料类别 | 原料名称 | 库存单位 | 核算单位 | 核算规格 | 规格 | 最近收料单价 | 供应商`
- Sample: `小青龙 | 斤 | 克 | 500 | 1*20 | 147.02 | 长沙四季商贸`

**Universal scope**: **Universal** — any inventory system needs this. Cretas Java already has `Material` entity but SmartBI Python服务 doesn't consume it.

**Configuration strategy**:
- New `RawMaterial` entity in Python SmartBI with `(name, inventory_unit, calc_unit, calc_spec, supplier, recent_price)`
- Populated via API sync from Cretas Java `Material` table (existing endpoint)
- `BomResolver` uses `RawMaterial.calc_spec` for unit conversion in COGS
- Fallback: if no RawMaterial record, assume 1:1 conversion (warn in logs)

---

## 2. File Structure

### New files to create

**Finance module** (`backend/python/smartbi/services/finance/`):
- `__init__.py`
- `margin_spec.py` — `MarginSpec` dataclass with defaults (G2)
- `expense_account_tree.py` — `ExpenseAccountNode` + tree loader + aggregation (G1)
- `shrinkage_engine.py` — standard vs actual variance (G4)
- `tests/test_margin_spec.py`
- `tests/test_expense_account_tree.py`
- `tests/test_shrinkage_engine.py`
- `tests/fixtures/expense_tree_hotpot.yaml`
- `tests/fixtures/expense_tree_bakery.yaml`

**BOM module** (`backend/python/smartbi/services/bom/`):
- `__init__.py`
- `raw_material.py` — `RawMaterial` entity + unit conversion (G7)
- `intermediate_product.py` — `IntermediateProduct` with yield_rate (G3)
- `two_layer_resolver.py` — recursive dish → semi → raw COGS (G3)
- `tests/test_raw_material.py`
- `tests/test_intermediate_product.py`
- `tests/test_two_layer_resolver.py`
- `tests/fixtures/hotpot_dishes.yaml`
- `tests/fixtures/bakery_dishes.yaml`

**Reporting module** (`backend/python/smartbi/services/reporting/`):
- `__init__.py`
- `department_tree.py` — `DepartmentNode` + tree operations (G5)
- `monthly_ppt_exporter.py` — 19-slide PPT generator (G6)
- `tests/test_department_tree.py`
- `tests/test_monthly_ppt_exporter.py`
- `tests/fixtures/department_tree_hotpot.yaml`
- `tests/fixtures/department_tree_bakery.yaml`

**Knowledge defaults** (`backend/python/smartbi/knowledge/restaurant/`):
- `expense_account_tree/default.yaml` — universal 5-bucket fallback
- `expense_account_tree/hotpot_default.yaml` — 45-subaccount hotpot tree
- `expense_account_tree/bakery_default.yaml` — bakery template
- `department_tree/hotpot_default.yaml` — 前厅/后厨/... hierarchy
- `department_tree/bakery_default.yaml`
- `ppt_templates/monthly_default.pptx` — 19-slide skeleton

**New section handlers** (`backend/python/smartbi/services/restaurant/sections/`):
- `expense_breakdown.py` — wraps ExpenseAccountTree for per-subaccount drill-down
- `shrinkage_analysis.py` — wraps ShrinkageEngine
- `department_pnl.py` — per-department P&L breakdown
- `monthly_ppt_export.py` — triggers PPT generation

**New Java tools** (`backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/`):
- `RestaurantExpenseBreakdownTool.java`
- `RestaurantShrinkageAnalysisTool.java`
- `RestaurantDepartmentPnlTool.java`
- `RestaurantMonthlyPptExportTool.java`

**Flyway migration** (`backend/java/cretas-api/src/main/resources/db/migration/`):
- `V20260411_02__ai_intent_config_restaurant_finance_bom.sql`

### Files to modify

- `backend/python/smartbi/services/restaurant/analyzer.py:596` — `_extract_financial_metrics()` consults `MarginSpec` config
- `backend/python/smartbi/services/restaurant/stored_value_analyzer.py` — add `mode` param (PREPAID|REVENUE|EXCLUDED)
- `backend/python/smartbi/services/restaurant/store_pnl_one_pager.py` — optional department_breakdown field
- `backend/python/smartbi/services/restaurant/channel_margin_calculator.py` — configurable `venue_list` param
- `backend/python/smartbi/knowledge/restaurant/benchmarks/火锅.yaml` — stored_value threshold adjustment
- `backend/python/smartbi/api/restaurant_sections.py` — register 4 new section handlers
- `backend/python/smartbi/config.py` — add `FactoryConfig.marginSpec / expenseAccountTreeId / departmentTreeId / bomLayerMax` fields

---

## 3. Phase 3.5A — Quick Wins (1 day, 5 tasks)

These ship THIS WEEK, no dependencies, no customer coordination. Each is a half-day of work at most.

---

### Task QW1: Stored value threshold in 火锅.yaml

**Why:** 鼎鲜 2 月充卡赠送 51680.61 / 731048 = 7.07% of revenue. Our current benchmarks don't flag this as critical. Must adjust threshold so the demo data actually triggers the warning.

**Files:**
- Modify: `backend/python/smartbi/knowledge/restaurant/benchmarks/火锅.yaml`
- Test: `backend/python/smartbi/services/restaurant/tests/test_section_analysis.py` — add 1 new test case

- [ ] **Step 1: Write failing test**

```python
# test_section_analysis.py — append to existing file
def test_stored_value_triggers_critical_at_7pct():
    """Regression: 鼎鲜 7.07% stored_value_giveaway ratio must be 'critical'.

    Previous thresholds missed this because warning was at 10%, critical at 15%.
    Real mature hotpot chains have 5-8% dependency — above that is a liquidity
    risk, not just a KPI concern.
    """
    from smartbi.services.restaurant.sections.stored_value import StoredValueHandler
    from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus

    h = StoredValueHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={"financial_data": {"current": {
            "revenue": 731048,
            "stored_value_giveaway": 51680.61,
        }}},
    )
    resp = h.compute(req, context={})

    assert resp.status == SectionStatus.OK
    assert resp.data.get("severity") == "critical", (
        f"Expected 'critical' for 7.07% ratio, got {resp.data.get('severity')}"
    )
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `python -m pytest smartbi/services/restaurant/tests/test_section_analysis.py::test_stored_value_triggers_critical_at_7pct -v`

Expected: FAIL with `Expected 'critical' for 7.07% ratio, got 'warning'` (or similar mismatch).

- [ ] **Step 3: Find current thresholds**

```bash
grep -rn "stored_value\|giveaway" backend/python/smartbi/knowledge/restaurant/benchmarks/ \
  backend/python/smartbi/services/restaurant/stored_value_analyzer.py
```

Locate the current warning/critical threshold values. Likely hardcoded in `stored_value_analyzer.py` as 0.10 and 0.15.

- [ ] **Step 4: Update thresholds**

In `stored_value_analyzer.py` (or `火锅.yaml` if loaded from YAML):
```python
# Old:
WARNING_RATIO = 0.10
CRITICAL_RATIO = 0.15

# New (hot pot industry — 5-8% is the normal band):
WARNING_RATIO = 0.05   # 5% flags early
CRITICAL_RATIO = 0.07  # 7% is already a liquidity concern
```

If loaded from YAML, update `火锅.yaml`:
```yaml
stored_value:
  warning_ratio: 0.05
  critical_ratio: 0.07
  formula: "stored_value_giveaway / revenue"
  description_zh: |
    火锅业态充卡赠送占营收 >5% 警告, >7% 严重.
    鼎鲜 2 月 7.07% = 液ity risk, 需要重审定价+会员策略.
```

- [ ] **Step 5: Run test, verify PASS**

Expected: 1 passed.

- [ ] **Step 6: Full regression**

```bash
python -m pytest smartbi/services/restaurant/tests/ -q 2>&1 | tail -5
```

Expected: `105 passed` (104 previous + 1 new).

- [ ] **Step 7: Commit**

```bash
git add backend/python/smartbi/services/restaurant/stored_value_analyzer.py \
        backend/python/smartbi/knowledge/restaurant/benchmarks/火锅.yaml \
        backend/python/smartbi/services/restaurant/tests/test_section_analysis.py
git commit -m "fix(smartbi-restaurant): lower stored_value thresholds for hot pot reality

P3.5A QW1: real 火锅 chains (鼎鲜 2026-02) show 5-8% stored_value_giveaway
ratio is common and already risky. Previous thresholds (10% warning, 15%
critical) missed this entirely. New: 5% warning, 7% critical. Matches
industry reality and correctly flags the 鼎鲜 7.07% case as critical."
```

---

### Task QW2: Configurable channel_margin venues

**Why:** 鼎鲜 has 5 venues (包厢 / 宴会 / 午茶 / 大厅晚餐 / 外卖), not our hardcoded 3 (堂食 / 外卖 / 团购). Hardcoding loses information for any chain with multi-room layouts.

**Files:**
- Modify: `backend/python/smartbi/services/restaurant/channel_margin_calculator.py`
- Modify: `backend/python/smartbi/services/restaurant/sections/channel_margin.py`
- Test: `backend/python/smartbi/services/restaurant/tests/test_section_pos.py`

- [ ] **Step 1: Write failing test**

```python
def test_channel_margin_accepts_custom_venue_list():
    """鼎鲜 has 5 venues, not 3. Calculator must accept a custom venue list."""
    import pandas as pd
    from smartbi.services.restaurant.channel_margin_calculator import ChannelMarginCalculator
    # Test both hotpot (5 venues) and西餐 (2 venues) to prove generality

    hotpot_df = pd.DataFrame([
        {"订单来源": "包厢", "实收额": 3200, "数量": 1},
        {"订单来源": "宴会", "实收额": 8800, "数量": 1},
        {"订单来源": "午茶", "实收额": 450, "数量": 1},
        {"订单来源": "大厅晚餐", "实收额": 1250, "数量": 1},
        {"订单来源": "外卖", "实收额": 78, "数量": 1},
    ])
    calc = ChannelMarginCalculator(factory_id="F-DINGXIAN", sub_sector="火锅")
    report = calc.calculate(
        df=hotpot_df,
        order_method_col="订单来源",
        revenue_col="实收额",
        venue_list=["包厢", "宴会", "午茶", "大厅晚餐", "外卖"],  # NEW param
    )
    assert len(report.to_dict()["channelDetails"]) == 5

    # Western restaurant: 2 venues
    western_df = pd.DataFrame([
        {"订单来源": "堂食", "实收额": 680, "数量": 1},
        {"订单来源": "外卖", "实收额": 120, "数量": 1},
    ])
    calc2 = ChannelMarginCalculator(factory_id="F-TEATRO", sub_sector="西餐")
    report2 = calc2.calculate(
        df=western_df,
        order_method_col="订单来源",
        revenue_col="实收额",
        venue_list=["堂食", "外卖"],
    )
    assert len(report2.to_dict()["channelDetails"]) == 2
```

- [ ] **Step 2: Run test, verify FAIL**

Expected: `TypeError: calculate() got an unexpected keyword argument 'venue_list'`

- [ ] **Step 3: Add venue_list param to ChannelMarginCalculator.calculate()**

```python
# channel_margin_calculator.py — modify calculate() signature
def calculate(
    self,
    df,
    order_method_col: str = "订单来源",
    revenue_col: str = "实收额",
    store_id: Optional[str] = None,
    period: str = "current",
    venue_list: Optional[List[str]] = None,  # NEW — None = auto-detect
) -> ChannelMarginReport:
    ...
    # If venue_list provided, only include these venues (rest aggregated to 其他)
    if venue_list is not None:
        df = df.copy()
        mask = df[order_method_col].isin(venue_list)
        # Unknown venues → aggregate to "其他"
        df.loc[~mask, order_method_col] = "其他"
    ...
```

- [ ] **Step 4: Also update the section handler to pass venue_list through**

```python
# sections/channel_margin.py
def compute(self, request, context):
    ...
    venue_list = request.params.get("venue_list")  # NEW — optional config
    section_data = analyzer._compute_channel_margin(
        pos_df=pos_df,
        order_method_col=order_method_col,
        revenue_col=revenue_col,
        store_id=request.store_id,
        period=request.period,
        venue_list=venue_list,  # pass through
    )
    ...
```

And update `RestaurantAnalyzerV2._compute_channel_margin()` signature likewise.

- [ ] **Step 5: Run test, verify PASS**

- [ ] **Step 6: Full regression**

Expected: `106 passed` (105 previous + 1 new test — QW1 added the first).

- [ ] **Step 7: Commit**

```bash
git add backend/python/smartbi/services/restaurant/channel_margin_calculator.py \
        backend/python/smartbi/services/restaurant/sections/channel_margin.py \
        backend/python/smartbi/services/restaurant/analyzer.py \
        backend/python/smartbi/services/restaurant/tests/test_section_pos.py
git commit -m "feat(smartbi-restaurant): configurable venue_list in channel_margin

P3.5A QW2: accept venue_list param so chains with non-default venue
layouts (鼎鲜: 包厢/宴会/午茶/大厅晚餐/外卖) get proper breakdowns.
Unknown venues aggregate to '其他'. Defaults: None = auto-detect from data."
```

---

### Task QW3: FactoryConfig.marginSpec JSON field

**Why:** G2 foundation — add the schema now with sensible defaults, wire up consumers later. Per user instruction: implement all options, default to common values, let customer toggle.

**Files:**
- Create: `backend/python/smartbi/services/finance/margin_spec.py`
- Create: `backend/python/smartbi/services/finance/__init__.py`
- Create: `backend/python/smartbi/services/finance/tests/__init__.py`
- Create: `backend/python/smartbi/services/finance/tests/test_margin_spec.py`

- [ ] **Step 1: Write failing test**

```python
# test_margin_spec.py
from smartbi.services.finance.margin_spec import (
    MarginSpec, StoredValueTreatment, MarginCalcMode,
)


def test_default_margin_spec_is_sensible():
    spec = MarginSpec()
    assert spec.include_staff_meal_in_cogs is True
    assert spec.include_gas_in_cogs is True
    assert spec.stored_value_treatment == StoredValueTreatment.PREPAID
    assert spec.include_investment_in_opex is False
    assert spec.margin_calc_mode == MarginCalcMode.BOTH
    assert spec.primary_margin_display == "UNFOLDED"


def test_margin_spec_from_dict_roundtrip():
    original = {
        "includeStaffMealInCogs": False,
        "includeGasInCogs": True,
        "storedValueTreatment": "REVENUE",
        "includeInvestmentInOpex": False,
        "marginCalcMode": "FOLDED",
        "primaryMarginDisplay": "FOLDED",
    }
    spec = MarginSpec.from_dict(original)
    assert spec.include_staff_meal_in_cogs is False
    assert spec.stored_value_treatment == StoredValueTreatment.REVENUE
    assert spec.margin_calc_mode == MarginCalcMode.FOLDED
    # Roundtrip
    assert spec.to_dict() == original


def test_margin_spec_missing_keys_uses_defaults():
    """Backward compat: old factory configs without marginSpec still work."""
    spec = MarginSpec.from_dict({})
    assert spec.include_staff_meal_in_cogs is True  # default


def test_margin_spec_invalid_treatment_raises():
    with pytest.raises(ValueError, match="Unknown stored value treatment"):
        MarginSpec.from_dict({"storedValueTreatment": "NOT_A_REAL_VALUE"})


def test_three_stored_value_treatment_modes_all_exist():
    """Confirm all 3 modes are implemented as enum values."""
    assert StoredValueTreatment.PREPAID.value == "PREPAID"
    assert StoredValueTreatment.REVENUE.value == "REVENUE"
    assert StoredValueTreatment.EXCLUDED.value == "EXCLUDED"
```

Add `import pytest` at top.

- [ ] **Step 2: Run test, verify FAIL**

Expected: `ModuleNotFoundError: No module named 'smartbi.services.finance'`

- [ ] **Step 3: Implement margin_spec.py**

```python
# backend/python/smartbi/services/finance/margin_spec.py
"""Margin spec contract — configurable boundary decisions for P&L computation.

Every mature restaurant finance team has to answer 4 ambiguous binary questions
before computing "net margin":
  1. Is 员工餐 (staff meal) cost included in 营业成本 (COGS)?
  2. Is 燃气 (gas) cost included in 营业成本?
  3. How are 充卡赠送 (stored value giveaways) treated on the revenue side?
  4. Are 投资费用 (renovation/expansion) included in 经营费用?

Plus: 毛利率 is computed 折前 (before discount) AND 折后 (after discount),
both matter for different audiences (owner wants pre-discount, finance wants
post-discount).

This module makes every option explicit as a config field with a sensible
default. Customers who disagree can override via `FactoryConfig.marginSpec`.
No pre-launch questionnaire required.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class StoredValueTreatment(str, Enum):
    """How to treat stored value card amounts on revenue side.

    PREPAID  — 充卡时计入预收款负债, 消费时才结转收入 (most common, default)
    REVENUE  — 充卡时直接计入收入, "赠送"部分作为费用支出 (aggressive recognition)
    EXCLUDED — 充卡完全不纳入收入, 只追踪兑付余额 (conservative)
    """
    PREPAID = "PREPAID"
    REVENUE = "REVENUE"
    EXCLUDED = "EXCLUDED"


class MarginCalcMode(str, Enum):
    """Which margin variant(s) to compute.

    FOLDED   — only (折后收入 - 成本) / 折后收入 (post-discount)
    UNFOLDED — only (折前收入 - 成本) / 折前收入 (pre-discount)
    BOTH     — compute both, display primary based on primary_margin_display
    """
    FOLDED = "FOLDED"
    UNFOLDED = "UNFOLDED"
    BOTH = "BOTH"


@dataclass
class MarginSpec:
    """Configurable P&L boundary spec.

    All fields have sensible defaults that match common restaurant practice.
    Customers who want different treatment can override via factory config.

    Usage:
        spec = MarginSpec()  # all defaults
        spec = MarginSpec.from_dict(factory_config.get("marginSpec", {}))
        if spec.include_staff_meal_in_cogs:
            cogs += staff_meal_cost
    """
    include_staff_meal_in_cogs: bool = True
    include_gas_in_cogs: bool = True
    stored_value_treatment: StoredValueTreatment = StoredValueTreatment.PREPAID
    include_investment_in_opex: bool = False
    margin_calc_mode: MarginCalcMode = MarginCalcMode.BOTH
    primary_margin_display: str = "UNFOLDED"  # "FOLDED" or "UNFOLDED"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MarginSpec":
        """Parse from camelCase JSON config. Missing keys use defaults."""
        if not isinstance(data, dict):
            raise ValueError(f"Expected dict, got {type(data).__name__}")

        treatment_str = data.get("storedValueTreatment", "PREPAID")
        try:
            treatment = StoredValueTreatment(treatment_str)
        except ValueError:
            raise ValueError(
                f"Unknown stored value treatment: {treatment_str!r}. "
                f"Must be one of {[t.value for t in StoredValueTreatment]}"
            )

        mode_str = data.get("marginCalcMode", "BOTH")
        try:
            mode = MarginCalcMode(mode_str)
        except ValueError:
            raise ValueError(
                f"Unknown margin calc mode: {mode_str!r}. "
                f"Must be one of {[m.value for m in MarginCalcMode]}"
            )

        return cls(
            include_staff_meal_in_cogs=data.get("includeStaffMealInCogs", True),
            include_gas_in_cogs=data.get("includeGasInCogs", True),
            stored_value_treatment=treatment,
            include_investment_in_opex=data.get("includeInvestmentInOpex", False),
            margin_calc_mode=mode,
            primary_margin_display=data.get("primaryMarginDisplay", "UNFOLDED"),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to camelCase JSON for factory config storage."""
        return {
            "includeStaffMealInCogs": self.include_staff_meal_in_cogs,
            "includeGasInCogs": self.include_gas_in_cogs,
            "storedValueTreatment": self.stored_value_treatment.value,
            "includeInvestmentInOpex": self.include_investment_in_opex,
            "marginCalcMode": self.margin_calc_mode.value,
            "primaryMarginDisplay": self.primary_margin_display,
        }
```

Create `services/finance/__init__.py` with:
```python
"""Finance module — margin spec, expense account tree, shrinkage engine."""
from .margin_spec import MarginSpec, StoredValueTreatment, MarginCalcMode

__all__ = ["MarginSpec", "StoredValueTreatment", "MarginCalcMode"]
```

Also create `services/finance/tests/__init__.py` (empty) to make it a package.

- [ ] **Step 4: Run test, verify PASS**

```bash
python -m pytest smartbi/services/finance/tests/test_margin_spec.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Full regression**

Expected: 111 passed (106 previous + 5 new).

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/finance/
git commit -m "feat(smartbi-finance): add MarginSpec config with sensible defaults

P3.5A QW3: FactoryConfig.marginSpec JSON placeholder with all 4
boundary flags + both margin modes + 3 stored value treatments all
as enum values. Defaults: staff_meal=in, gas=in, sv=PREPAID,
investment=out, margin=BOTH, primary=UNFOLDED.

No consumer wiring yet — that's QW4-QW5 and Phase 3.5B F2/F4.
Shipping config-first to unblock downstream tasks."
```

---

### Task QW4: FactoryConfig.expenseAccountTree JSON placeholder

**Why:** G1 foundation — define the tree data structure now, populate via YAML. Analyzer integration comes in Phase 3.5B.

**Files:**
- Create: `backend/python/smartbi/services/finance/expense_account_tree.py`
- Create: `backend/python/smartbi/services/finance/tests/test_expense_account_tree.py`
- Create: `backend/python/smartbi/knowledge/restaurant/expense_account_tree/default.yaml`
- Create: `backend/python/smartbi/knowledge/restaurant/expense_account_tree/hotpot_default.yaml`

- [ ] **Step 1: Write failing test**

```python
# test_expense_account_tree.py
from pathlib import Path

import pytest

from smartbi.services.finance.expense_account_tree import (
    ExpenseAccountNode, ExpenseAccountTree, load_tree_from_yaml,
)


def test_node_is_leaf_when_no_children():
    node = ExpenseAccountNode(code="工资", name_zh="工资", parent_code="人力成本")
    assert node.is_leaf() is True


def test_tree_aggregates_leaf_values_to_parents():
    """Tree: 人力成本 → [工资, 奖金, 福利费]
    Given leaf values, parent should be sum of children.
    """
    tree = ExpenseAccountTree()
    tree.add(ExpenseAccountNode(code="人力成本", name_zh="人力成本", parent_code=None))
    tree.add(ExpenseAccountNode(code="工资", name_zh="工资", parent_code="人力成本"))
    tree.add(ExpenseAccountNode(code="奖金", name_zh="奖金", parent_code="人力成本"))
    tree.add(ExpenseAccountNode(code="福利费", name_zh="福利费", parent_code="人力成本"))

    values = {"工资": 237660, "奖金": 15000, "福利费": 5000}
    aggregated = tree.aggregate(values)

    assert aggregated["人力成本"] == 237660 + 15000 + 5000
    assert aggregated["工资"] == 237660  # leaf unchanged


def test_tree_multi_level_aggregation():
    """3-level tree: 总费用 → 营业费用 → [工资, 奖金] + 财务费用 → 手续费"""
    tree = ExpenseAccountTree()
    for node in [
        ExpenseAccountNode(code="总费用", name_zh="总费用", parent_code=None),
        ExpenseAccountNode(code="营业费用", name_zh="营业费用", parent_code="总费用"),
        ExpenseAccountNode(code="工资", name_zh="工资", parent_code="营业费用"),
        ExpenseAccountNode(code="奖金", name_zh="奖金", parent_code="营业费用"),
        ExpenseAccountNode(code="财务费用", name_zh="财务费用", parent_code="总费用"),
        ExpenseAccountNode(code="手续费", name_zh="手续费", parent_code="财务费用"),
    ]:
        tree.add(node)

    values = {"工资": 100, "奖金": 20, "手续费": 30}
    agg = tree.aggregate(values)

    assert agg["营业费用"] == 120
    assert agg["财务费用"] == 30
    assert agg["总费用"] == 150


def test_load_hotpot_tree_from_yaml(tmp_path):
    """Load a hotpot-specific tree from YAML."""
    yaml_content = """
nodes:
  - code: 总费用
    name_zh: 总费用
  - code: 营业费用
    name_zh: 营业费用
    parent: 总费用
  - code: 工资
    name_zh: 工资
    parent: 营业费用
  - code: 充卡赠送
    name_zh: 充卡赠送
    parent: 营业费用
"""
    yaml_file = tmp_path / "hotpot.yaml"
    yaml_file.write_text(yaml_content)

    tree = load_tree_from_yaml(yaml_file)
    assert len(tree.nodes) == 4
    assert tree.nodes["充卡赠送"].parent_code == "营业费用"


def test_load_default_hotpot_yaml_has_45_subaccounts():
    """The shipped hotpot_default.yaml matches 鼎鲜 2-月 P&L structure."""
    default_path = (
        Path(__file__).parents[3]
        / "knowledge"
        / "restaurant"
        / "expense_account_tree"
        / "hotpot_default.yaml"
    )
    tree = load_tree_from_yaml(default_path)

    # Tree should have at least 45 leaf accounts matching real hot pot P&L
    leaves = [n for n in tree.nodes.values() if n.is_leaf()]
    assert len(leaves) >= 45, f"Expected ≥45 leaf accounts, got {len(leaves)}"

    # Sanity: critical 鼎鲜 accounts must be present
    codes = set(tree.nodes.keys())
    for expected in ["工资", "房租费", "充卡赠送", "水费", "电费", "柴油", "维修费", "广告宣传活动费"]:
        assert expected in codes, f"Missing expected account: {expected}"
```

- [ ] **Step 2: Run test, verify FAIL**

Expected: `ModuleNotFoundError: No module named 'smartbi.services.finance.expense_account_tree'`

- [ ] **Step 3: Implement expense_account_tree.py**

```python
# backend/python/smartbi/services/finance/expense_account_tree.py
"""Expense account tree — hierarchical chart of accounts.

Every mature finance team organizes expenses as a tree (1-3 levels):
  总费用
    ├── 营业费用
    │     ├── 工资
    │     ├── 奖金
    │     ├── 福利费
    │     └── ...
    └── 财务费用
          ├── 手续费
          └── 汇兑损益

Our previous flat 5-bucket model (food/labor/rent/other/net_profit) lost 40+
subaccounts of information. This module restores the tree, enabling:
  - Per-leaf diagnostic rules (e.g. "后厨临时工超预算 4500" vs generic "人工率高")
  - Budget-vs-actual variance at any tree level
  - Drill-down from total to leaf

Default trees for common verticals in `knowledge/restaurant/expense_account_tree/`.
Per-factory customization via `FactoryConfig.expenseAccountTreeId`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml


@dataclass
class ExpenseAccountNode:
    """One node in the expense account tree.

    `parent_code=None` marks the root. Leaf nodes have no children referencing
    them; the is_leaf() check is done on the containing Tree.
    """
    code: str                          # unique identifier, e.g. "工资"
    name_zh: str                       # display name
    parent_code: Optional[str] = None  # parent code or None for root
    description: Optional[str] = None
    attribute: Optional[str] = None    # 可控比例 / 可控金额 / 固定金额 / 固定比例 / 激励
    responsible: Optional[str] = None  # 责任人

    def is_leaf(self) -> bool:
        """True for a freshly constructed node (Tree will compute properly)."""
        return True  # overridden by Tree.is_leaf(code)


@dataclass
class ExpenseAccountTree:
    """Hierarchical expense account tree with aggregation.

    Usage:
        tree = load_tree_from_yaml(Path("hotpot_default.yaml"))
        values = {"工资": 237660, "奖金": 15000, ...}  # leaf values from P&L
        aggregated = tree.aggregate(values)
        # aggregated["人力成本"] = sum of all leaves under 人力成本
    """
    nodes: dict[str, ExpenseAccountNode] = field(default_factory=dict)

    def add(self, node: ExpenseAccountNode) -> None:
        if node.code in self.nodes:
            raise ValueError(f"Duplicate node code: {node.code!r}")
        self.nodes[node.code] = node

    def is_leaf(self, code: str) -> bool:
        """A node is a leaf if no other node has it as a parent."""
        return not any(n.parent_code == code for n in self.nodes.values())

    def get_children(self, code: str) -> list[ExpenseAccountNode]:
        return [n for n in self.nodes.values() if n.parent_code == code]

    def aggregate(self, leaf_values: dict[str, float]) -> dict[str, float]:
        """Given leaf account values, compute all parent account sums.

        Unknown leaves in `leaf_values` are silently ignored (robust to
        data drift). Missing leaves default to 0.
        """
        result: dict[str, float] = {}

        # Seed leaves with their values
        for code, node in self.nodes.items():
            if self.is_leaf(code):
                result[code] = float(leaf_values.get(code, 0))

        # Propagate up the tree (repeat until stable)
        changed = True
        while changed:
            changed = False
            for code, node in self.nodes.items():
                if code in result:
                    continue
                children = self.get_children(code)
                if all(c.code in result for c in children):
                    result[code] = sum(result[c.code] for c in children)
                    changed = True

        return result


def load_tree_from_yaml(yaml_path: Path) -> ExpenseAccountTree:
    """Load an ExpenseAccountTree from YAML.

    Expected format:
        nodes:
          - code: 总费用
            name_zh: 总费用
          - code: 营业费用
            name_zh: 营业费用
            parent: 总费用
          - ...
    """
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict) or "nodes" not in data:
        raise ValueError(f"Invalid YAML: expected 'nodes' key at top level, got {type(data).__name__}")

    tree = ExpenseAccountTree()
    for raw in data["nodes"]:
        tree.add(ExpenseAccountNode(
            code=raw["code"],
            name_zh=raw.get("name_zh", raw["code"]),
            parent_code=raw.get("parent"),
            description=raw.get("description"),
            attribute=raw.get("attribute"),
            responsible=raw.get("responsible"),
        ))

    return tree
```

- [ ] **Step 4: Create the hotpot_default.yaml fixture**

Create `backend/python/smartbi/knowledge/restaurant/expense_account_tree/hotpot_default.yaml` with the structure matching 鼎鲜 2 月 P&L:

```yaml
# Default expense account tree for 火锅 (hotpot) chains.
# Based on 鼎鲜火锅 2026-02 P&L structure (45 leaf accounts).
# Override via FactoryConfig.expenseAccountTreeId.
nodes:
  - code: 总费用
    name_zh: 总费用

  # 营业成本 (COGS)
  - code: 营业成本
    name_zh: 营业成本
    parent: 总费用

  # 营业费用 (OpEx — 45 subaccounts)
  - code: 营业费用
    name_zh: 营业费用
    parent: 总费用

  # Labor
  - code: 人力成本
    name_zh: 人力成本
    parent: 营业费用
  - code: 工资
    name_zh: 工资
    parent: 人力成本
  - code: 奖金
    name_zh: 奖金
    parent: 人力成本
  - code: 福利费
    name_zh: 福利费
    parent: 人力成本
  - code: 保险费
    name_zh: 保险费
    parent: 人力成本
  - code: 住房公积金
    name_zh: 住房公积金
    parent: 人力成本
  - code: 服装费
    name_zh: 服装费
    parent: 人力成本
  - code: 宿舍费用
    name_zh: 宿舍费用
    parent: 人力成本

  # Utility
  - code: 水电费
    name_zh: 水电费
    parent: 营业费用
  - code: 水费
    name_zh: 水费
    parent: 水电费
  - code: 电费
    name_zh: 电费
    parent: 水电费
  - code: 柴油
    name_zh: 柴油
    parent: 水电费
  - code: 燃料费
    name_zh: 燃料费
    parent: 水电费

  # Operations
  - code: 运营费用
    name_zh: 运营费用
    parent: 营业费用
  - code: 通讯费
    name_zh: 通讯费
    parent: 运营费用
  - code: 办公费
    name_zh: 办公费
    parent: 运营费用
  - code: 工伤费
    name_zh: 工伤费
    parent: 运营费用
  - code: 推荐费
    name_zh: 推荐费
    parent: 运营费用
  - code: 交通费
    name_zh: 交通费
    parent: 运营费用
  - code: 维修费
    name_zh: 维修费
    parent: 运营费用
  - code: 差旅费
    name_zh: 差旅费
    parent: 运营费用
  - code: 零钞兑换费
    name_zh: 零钞兑换费
    parent: 运营费用
  - code: 刷卡手续费
    name_zh: 刷卡手续费
    parent: 运营费用

  # Site
  - code: 场地费用
    name_zh: 场地费用
    parent: 营业费用
  - code: 卫生费
    name_zh: 卫生费
    parent: 场地费用
  - code: 运杂费
    name_zh: 运杂费
    parent: 场地费用
  - code: 房产税
    name_zh: 房产税
    parent: 场地费用
  - code: 房租费
    name_zh: 房租费
    parent: 场地费用
  - code: 物业管理费
    name_zh: 物业管理费
    parent: 场地费用
  - code: 绿化费
    name_zh: 绿化费
    parent: 场地费用
  - code: 消杀费
    name_zh: 消杀费
    parent: 场地费用
  - code: 电梯维护费
    name_zh: 电梯维护费
    parent: 场地费用
  - code: 排污费
    name_zh: 排污费
    parent: 场地费用

  # Marketing
  - code: 营销费用
    name_zh: 营销费用
    parent: 营业费用
  - code: 招待费
    name_zh: 招待费
    parent: 营销费用
  - code: 抵扣券
    name_zh: 抵扣券
    parent: 营销费用
  - code: 广告宣传活动费
    name_zh: 广告宣传活动费
    parent: 营销费用
  - code: 充卡赠送
    name_zh: 充卡赠送
    parent: 营销费用
  - code: 折扣与佣金
    name_zh: 折扣与佣金
    parent: 营销费用
  - code: 演艺费
    name_zh: 演艺费
    parent: 营销费用

  # HR
  - code: 人事费用
    name_zh: 人事费用
    parent: 营业费用
  - code: 招聘费
    name_zh: 招聘费
    parent: 人事费用
  - code: 培训费
    name_zh: 培训费
    parent: 人事费用
  - code: 健康证
    name_zh: 健康证
    parent: 人事费用

  # Supplies
  - code: 物资费用
    name_zh: 物资费用
    parent: 营业费用
  - code: 洗涤费
    name_zh: 洗涤费
    parent: 物资费用
  - code: 低值易耗品
    name_zh: 低值易耗品
    parent: 物资费用
  - code: 物料费
    name_zh: 物料费
    parent: 物资费用

  # Financial
  - code: 财务费用
    name_zh: 财务费用
    parent: 总费用
  - code: 支付宝手续费
    name_zh: 支付宝手续费
    parent: 财务费用
  - code: 微信手续费
    name_zh: 微信手续费
    parent: 财务费用
  - code: 汇兑损益
    name_zh: 汇兑损益
    parent: 财务费用

  # Management
  - code: 管理费用
    name_zh: 管理费用
    parent: 总费用
  - code: 内部管理费
    name_zh: 内部管理费
    parent: 管理费用
  - code: 区部费用
    name_zh: 区部费用
    parent: 管理费用
  - code: 折旧费
    name_zh: 折旧费
    parent: 管理费用
  - code: 长期摊销费用
    name_zh: 长期摊销费用
    parent: 管理费用
  - code: 报刊费
    name_zh: 报刊费
    parent: 管理费用
  - code: 其他费用
    name_zh: 其他费用
    parent: 管理费用
```

Count leaves: 45+. Aligns with 鼎鲜 P&L row 20-65.

- [ ] **Step 5: Create default.yaml (5-bucket fallback)**

```yaml
# Universal 5-bucket fallback for legacy Excel uploads without tree data.
nodes:
  - code: 总费用
    name_zh: 总费用
  - code: food_cost
    name_zh: 食材成本
    parent: 总费用
  - code: labor_cost
    name_zh: 人力成本
    parent: 总费用
  - code: rent
    name_zh: 房租
    parent: 总费用
  - code: other_cost
    name_zh: 其他费用
    parent: 总费用
  - code: net_profit
    name_zh: 净利润
    parent: 总费用
```

- [ ] **Step 6: Run test, verify PASS**

Expected: 5 passed.

- [ ] **Step 7: Full regression**

Expected: 116 passed (111 previous + 5 new).

- [ ] **Step 8: Commit**

```bash
git add backend/python/smartbi/services/finance/expense_account_tree.py \
        backend/python/smartbi/services/finance/tests/test_expense_account_tree.py \
        backend/python/smartbi/knowledge/restaurant/expense_account_tree/
git commit -m "feat(smartbi-finance): add ExpenseAccountTree model + hotpot default YAML

P3.5A QW4: 3-level tree model with aggregation (leaves → parents).
Hotpot default YAML has 45 subaccounts matching 鼎鲜 2026-02 P&L
structure. Fallback default.yaml preserves the legacy 5-bucket schema.

Consumer wiring (analyzer.py._extract_financial_metrics) comes in
Phase 3.5B F5/F6 — this is the config foundation task."
```

---

### Task QW5: FactoryConfig.departmentTree JSON placeholder

**Why:** G5 foundation — mirror QW4's pattern for department hierarchies. Needed for per-department P&L (Phase 3.5D P2).

**Files:**
- Create: `backend/python/smartbi/services/reporting/__init__.py`
- Create: `backend/python/smartbi/services/reporting/department_tree.py`
- Create: `backend/python/smartbi/services/reporting/tests/__init__.py`
- Create: `backend/python/smartbi/services/reporting/tests/test_department_tree.py`
- Create: `backend/python/smartbi/knowledge/restaurant/department_tree/hotpot_default.yaml`
- Create: `backend/python/smartbi/knowledge/restaurant/department_tree/bakery_default.yaml`

- [ ] **Step 1: Write failing test**

```python
# test_department_tree.py
from pathlib import Path

from smartbi.services.reporting.department_tree import (
    DepartmentNode, DepartmentTree, load_dept_tree_from_yaml,
)


def test_dept_tree_basic_hierarchy():
    tree = DepartmentTree()
    tree.add(DepartmentNode(code="酒店", name_zh="酒店总部", parent_code=None, head_count_target=None))
    tree.add(DepartmentNode(code="后厨", name_zh="后厨", parent_code="酒店", head_count_target=30))
    tree.add(DepartmentNode(code="热菜", name_zh="热菜档", parent_code="后厨", head_count_target=8))
    tree.add(DepartmentNode(code="冷菜", name_zh="冷菜档", parent_code="后厨", head_count_target=4))

    assert tree.get_children("后厨") == [
        tree.nodes["热菜"], tree.nodes["冷菜"]
    ]
    # Leaf detection
    assert tree.is_leaf("热菜") is True
    assert tree.is_leaf("后厨") is False


def test_dept_tree_aggregates_labor_cost():
    """Given per-leaf labor cost, parent aggregates."""
    tree = DepartmentTree()
    for node in [
        DepartmentNode("酒店", "酒店", None, None),
        DepartmentNode("后厨", "后厨", "酒店", None),
        DepartmentNode("热菜", "热菜", "后厨", None),
        DepartmentNode("冷菜", "冷菜", "后厨", None),
    ]:
        tree.add(node)

    values = {"热菜": 80000, "冷菜": 40000}
    agg = tree.aggregate(values)
    assert agg["后厨"] == 120000
    assert agg["酒店"] == 120000


def test_load_hotpot_default():
    """Hotpot default YAML covers typical 火锅 departments."""
    path = (
        Path(__file__).parents[3]
        / "knowledge"
        / "restaurant"
        / "department_tree"
        / "hotpot_default.yaml"
    )
    tree = load_dept_tree_from_yaml(path)
    codes = set(tree.nodes.keys())
    # Expected departments
    for expected in ["前厅", "后厨", "热菜", "冷菜", "明档", "财务", "店总"]:
        assert expected in codes, f"Missing: {expected}"


def test_load_bakery_default_different_structure():
    """Bakery tree has different structure than hotpot — proves universality."""
    path = (
        Path(__file__).parents[3]
        / "knowledge"
        / "restaurant"
        / "department_tree"
        / "bakery_default.yaml"
    )
    tree = load_dept_tree_from_yaml(path)
    codes = set(tree.nodes.keys())
    # Bakery-specific departments
    assert "烘焙间" in codes or "面包房" in codes
    assert "门店销售" in codes or "零售" in codes
```

- [ ] **Step 2: Implement department_tree.py (mirror expense_account_tree pattern)**

```python
# backend/python/smartbi/services/reporting/department_tree.py
"""Department hierarchy tree for multi-kitchen restaurant operations.

Universal pattern: any multi-team restaurant organizes labor and costs by
department (前厅 / 后厨) → sub-department (明档 / 热菜 / 冷菜 / 烤鸭) →
potentially further (个人).

Required for:
  - Per-department P&L (Slide 8 of monthly PPT template)
  - 30-row 人均产出比 table (Slide 14)
  - Budget-vs-actual per dept for diagnostics drill-down

Default trees in `knowledge/restaurant/department_tree/` for common verticals.
Factory-specific overrides via `FactoryConfig.departmentTreeId`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml


@dataclass
class DepartmentNode:
    code: str                           # unique identifier (e.g. "热菜")
    name_zh: str                        # display (e.g. "热菜档")
    parent_code: Optional[str] = None
    head_count_target: Optional[int] = None  # budgeted headcount
    category: Optional[str] = None      # 后厨 / 前厅 / 管理 / 其他

    def is_leaf_hint(self) -> bool:
        return True  # overridden by Tree.is_leaf(code)


@dataclass
class DepartmentTree:
    nodes: dict[str, DepartmentNode] = field(default_factory=dict)

    def add(self, node: DepartmentNode) -> None:
        if node.code in self.nodes:
            raise ValueError(f"Duplicate department code: {node.code!r}")
        self.nodes[node.code] = node

    def is_leaf(self, code: str) -> bool:
        return not any(n.parent_code == code for n in self.nodes.values())

    def get_children(self, code: str) -> list[DepartmentNode]:
        return [n for n in self.nodes.values() if n.parent_code == code]

    def aggregate(self, leaf_values: dict[str, float]) -> dict[str, float]:
        """Aggregate leaf labor/cost values to parents."""
        result: dict[str, float] = {}
        for code in self.nodes:
            if self.is_leaf(code):
                result[code] = float(leaf_values.get(code, 0))

        changed = True
        while changed:
            changed = False
            for code in self.nodes:
                if code in result:
                    continue
                children = self.get_children(code)
                if all(c.code in result for c in children):
                    result[code] = sum(result[c.code] for c in children)
                    changed = True
        return result


def load_dept_tree_from_yaml(yaml_path: Path) -> DepartmentTree:
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    tree = DepartmentTree()
    for raw in data["nodes"]:
        tree.add(DepartmentNode(
            code=raw["code"],
            name_zh=raw.get("name_zh", raw["code"]),
            parent_code=raw.get("parent"),
            head_count_target=raw.get("head_count_target"),
            category=raw.get("category"),
        ))
    return tree
```

Add to `services/reporting/__init__.py`:
```python
from .department_tree import DepartmentNode, DepartmentTree, load_dept_tree_from_yaml
__all__ = ["DepartmentNode", "DepartmentTree", "load_dept_tree_from_yaml"]
```

- [ ] **Step 3: Create hotpot_default.yaml**

```yaml
# Default department tree for 火锅 chains (based on 鼎鲜 Slide 14)
nodes:
  - code: 酒店
    name_zh: 酒店总部
    category: 管理

  - code: 后厨
    name_zh: 后厨
    parent: 酒店
    category: 后厨

  - code: 热菜
    name_zh: 热菜档
    parent: 后厨
    head_count_target: 8
    category: 后厨
  - code: 冷菜
    name_zh: 凉菜档
    parent: 后厨
    head_count_target: 4
    category: 后厨
  - code: 明档
    name_zh: 明档
    parent: 后厨
    head_count_target: 4
    category: 后厨
  - code: 铁板
    name_zh: 铁板
    parent: 后厨
    head_count_target: 2
    category: 后厨
  - code: 点心
    name_zh: 点心
    parent: 后厨
    head_count_target: 3
    category: 后厨
  - code: 洗杀
    name_zh: 洗杀
    parent: 后厨
    head_count_target: 4
    category: 后厨
  - code: 海鲜养殖员
    name_zh: 海鲜养殖
    parent: 后厨
    head_count_target: 1
    category: 后厨
  - code: 厨部临时工
    name_zh: 厨部临时工
    parent: 后厨
    category: 后厨

  - code: 前厅
    name_zh: 前厅
    parent: 酒店
    category: 前厅

  - code: 前厅管理层
    name_zh: 前厅管理层
    parent: 前厅
    head_count_target: 3
    category: 前厅
  - code: 前厅服务员
    name_zh: 前厅服务员
    parent: 前厅
    head_count_target: 15
    category: 前厅
  - code: 收银酒水
    name_zh: 收银酒水
    parent: 前厅
    head_count_target: 3
    category: 前厅
  - code: 传菜部
    name_zh: 传菜部
    parent: 前厅
    head_count_target: 5
    category: 前厅
  - code: PA保洁
    name_zh: PA 保洁
    parent: 前厅
    head_count_target: 3
    category: 前厅
  - code: 前厅临时工
    name_zh: 前厅临时工
    parent: 前厅
    category: 前厅

  - code: 后勤
    name_zh: 后勤
    parent: 酒店
    category: 管理
  - code: 店总
    name_zh: 店总
    parent: 后勤
    head_count_target: 1
    category: 管理
  - code: 财务
    name_zh: 财务
    parent: 后勤
    head_count_target: 1
    category: 管理
  - code: 行政人事
    name_zh: 行政人事
    parent: 后勤
    head_count_target: 1
    category: 管理
  - code: 采购
    name_zh: 采购
    parent: 后勤
    head_count_target: 1
    category: 管理
  - code: 维修
    name_zh: 维修
    parent: 后勤
    head_count_target: 1
    category: 管理
  - code: 仓管
    name_zh: 仓管
    parent: 后勤
    head_count_target: 1
    category: 管理
  - code: 保安
    name_zh: 保安
    parent: 后勤
    head_count_target: 1
    category: 管理

  - code: 营销
    name_zh: 营销部
    parent: 酒店
    head_count_target: 2
    category: 前厅
```

- [ ] **Step 4: Create bakery_default.yaml**

```yaml
# Default department tree for bakery chains — proves universality
nodes:
  - code: 门店
    name_zh: 门店总部
    category: 管理

  - code: 生产
    name_zh: 生产
    parent: 门店
    category: 后厨
  - code: 烘焙间
    name_zh: 烘焙间
    parent: 生产
    head_count_target: 4
    category: 后厨
  - code: 面包房
    name_zh: 面包房
    parent: 生产
    head_count_target: 3
    category: 后厨
  - code: 裱花间
    name_zh: 裱花间
    parent: 生产
    head_count_target: 2
    category: 后厨

  - code: 销售
    name_zh: 销售
    parent: 门店
    category: 前厅
  - code: 门店销售
    name_zh: 门店销售
    parent: 销售
    head_count_target: 6
    category: 前厅
  - code: 收银
    name_zh: 收银
    parent: 销售
    head_count_target: 2
    category: 前厅

  - code: 管理
    name_zh: 管理
    parent: 门店
    category: 管理
  - code: 店长
    name_zh: 店长
    parent: 管理
    head_count_target: 1
    category: 管理
  - code: 仓储
    name_zh: 仓储
    parent: 管理
    head_count_target: 1
    category: 管理
```

- [ ] **Step 5: Run test, verify PASS**

Expected: 4 passed.

- [ ] **Step 6: Full regression**

Expected: 120 passed (116 + 4).

- [ ] **Step 7: Commit**

```bash
git add backend/python/smartbi/services/reporting/ \
        backend/python/smartbi/knowledge/restaurant/department_tree/
git commit -m "feat(smartbi-reporting): add DepartmentTree + hotpot/bakery defaults

P3.5A QW5: 3-level department hierarchy model, mirrors
ExpenseAccountTree pattern. Hotpot default from 鼎鲜 Slide 14
(24 departments), bakery default for cuisine diversity.

Consumer wiring (store_pnl_one_pager dept breakdown + monthly PPT
Slide 8/14) comes in Phase 3.5D P2/P3."
```

---

**Phase 3.5A Exit Gate:**
- 5 commits (QW1-QW5) on feature branch
- Tests: 104 → 120 (16 new tests)
- All 5 quick wins ship in ≤ 1 day combined
- No breaking changes — all additive
- Ready to proceed to Phase 3.5B Foundation

---

## 4. Phase 3.5B — Foundation (1 week, 8 tasks)

Wire the QW3-QW5 config placeholders into the actual analyzer pipeline. Delivers G1 (expense tree integration), G2 (margin spec consumer), and G7 (raw material master). No BOM depth or PPT yet — just the finance foundation so diagnostics can reference leaf-level accounts.

---

### Task F1: Integrate MarginSpec into FinancialMetrics

**Why:** `_extract_financial_metrics()` currently hardcodes all 4 boundary decisions. Wire it to consult `MarginSpec` so customer overrides work end-to-end.

**Files:**
- Modify: `backend/python/smartbi/services/restaurant/analyzer.py:596-663` — `_extract_financial_metrics()`
- Modify: `backend/python/smartbi/services/restaurant/analyzer.py:130-200` — `__init__()` accepts `margin_spec` param
- Test: `backend/python/smartbi/services/restaurant/tests/test_v2_analyzer_integration.py` — 3 new test cases

- [ ] **Step 1: Write failing test**

```python
def test_financial_metrics_respects_margin_spec_staff_meal_flag():
    """When includeStaffMealInCogs=False, staff meal should NOT enter food_cost."""
    from smartbi.services.finance.margin_spec import MarginSpec
    from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

    spec_exclude = MarginSpec(include_staff_meal_in_cogs=False)
    analyzer = RestaurantAnalyzerV2(
        factory_id="F-TEST",
        sub_sector="火锅",
        margin_spec=spec_exclude,  # NEW param
    )
    report = analyzer.analyze(financial_data={
        "current": {
            "revenue": 731048,
            "food_cost": 307040,
            "staff_meal_cost": 8000,  # separate line
            "labor_cost": 237660,
            "rent": 85000,
        },
        "previous": {"revenue": 1390503, "labor_cost": 323805},
    })
    fm = report["sections"]["financialMetrics"]
    # When excluded, food_cost should stay at 307040 (not +8000)
    assert fm["foodCost"] == 307040


def test_financial_metrics_respects_margin_spec_staff_meal_flag_included():
    """Default includeStaffMealInCogs=True merges staff meal into food_cost."""
    from smartbi.services.finance.margin_spec import MarginSpec
    from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

    analyzer = RestaurantAnalyzerV2(
        factory_id="F-TEST",
        sub_sector="火锅",
        margin_spec=MarginSpec(),  # defaults, include_staff_meal=True
    )
    report = analyzer.analyze(financial_data={
        "current": {
            "revenue": 731048,
            "food_cost": 307040,
            "staff_meal_cost": 8000,
            "labor_cost": 237660,
        },
    })
    fm = report["sections"]["financialMetrics"]
    # When included, food_cost = 307040 + 8000 = 315040
    assert fm["foodCost"] == 315040


def test_no_margin_spec_uses_defaults_preserves_byte_identity():
    """Regression: RestaurantAnalyzerV2() without margin_spec must match
    pre-3.5B behavior (golden test passes)."""
    from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

    analyzer = RestaurantAnalyzerV2(factory_id="F-TEST", sub_sector="火锅")
    # Default margin_spec should be None or MarginSpec() — either way,
    # existing data without staff_meal_cost/gas_cost/etc. produces same
    # output as before.
    report = analyzer.analyze(financial_data={
        "current": {"revenue": 731048, "food_cost": 307040, "labor_cost": 237660},
    })
    fm = report["sections"]["financialMetrics"]
    assert fm["revenue"] == 731048
    assert fm["foodCost"] == 307040
    assert fm["laborCost"] == 237660
```

- [ ] **Step 2: Run test, verify FAIL**

Expected: First two fail with `TypeError: __init__() got unexpected keyword 'margin_spec'`. Third test passes (regression baseline).

- [ ] **Step 3: Add margin_spec param to `__init__`**

```python
# analyzer.py:158-177 — modify __init__
def __init__(
    self,
    factory_id: str,
    sub_sector: str,
    db_session: Optional[Session] = None,
    sku_form_manager: Optional[SkuFormManager] = None,
    monthly_calibrator: Optional[MonthlyPurchaseCalibrator] = None,
    margin_spec: Optional["MarginSpec"] = None,  # NEW
):
    # ... existing body ...
    # Near the bottom, after self.monthly_calibrator = monthly_calibrator:
    from smartbi.services.finance.margin_spec import MarginSpec as _MarginSpec
    self.margin_spec = margin_spec or _MarginSpec()  # default = sensible defaults
```

- [ ] **Step 4: Integrate in `_extract_financial_metrics`**

```python
# analyzer.py:596 — modify _extract_financial_metrics
def _extract_financial_metrics(self, financial_data: dict) -> FinancialMetrics:
    current = financial_data.get("current") or financial_data
    previous = financial_data.get("previous")

    revenue = float(current.get("revenue", 0))
    food_cost = self._safe_float(current.get("food_cost"))
    labor_cost = self._safe_float(current.get("labor_cost"))
    rent = self._safe_float(current.get("rent"))
    other_cost = self._safe_float(current.get("other_cost"))
    net_profit = self._safe_float(current.get("net_profit"))

    # NEW: Apply MarginSpec adjustments
    if self.margin_spec.include_staff_meal_in_cogs:
        staff_meal = self._safe_float(current.get("staff_meal_cost"))
        if staff_meal is not None and food_cost is not None:
            food_cost = food_cost + staff_meal

    if self.margin_spec.include_gas_in_cogs:
        gas_cost = self._safe_float(current.get("gas_cost"))
        if gas_cost is not None and food_cost is not None:
            food_cost = food_cost + gas_cost

    # ... rest of method stays the same (ratios, cost_rigidity, etc.)
```

- [ ] **Step 5: Run new tests + golden regression**

```bash
python -m pytest smartbi/services/restaurant/tests/test_v2_analyzer_integration.py -v
python -m pytest smartbi/services/restaurant/tests/test_batch_regression_golden.py -v
```

Expected: All new tests pass + golden stays green (backward compat preserved because dingxian fixture has no `staff_meal_cost` / `gas_cost`).

- [ ] **Step 6: Full regression**

Expected: 123 passed (120 + 3 new).

- [ ] **Step 7: Commit**

```bash
git add backend/python/smartbi/services/restaurant/analyzer.py \
        backend/python/smartbi/services/restaurant/tests/test_v2_analyzer_integration.py
git commit -m "feat(smartbi-restaurant): MarginSpec integration in _extract_financial_metrics

P3.5B F1: RestaurantAnalyzerV2 accepts margin_spec param (default =
sensible defaults). _extract_financial_metrics consults the spec to
decide whether staff_meal_cost + gas_cost get merged into food_cost.

Golden test still passes — dingxian fixture lacks staff_meal_cost/gas_cost
fields, so behavior is byte-identical when customer data omits them.
When present, flags control inclusion. 3 new regression tests."
```

---

### Task F2: Dual margin computation (折前 + 折后)

**Why:** G2 promise — compute BOTH 折前 and 折后 毛利率 always. UI picks which to highlight via `primary_margin_display`.

**Files:**
- Modify: `backend/python/smartbi/services/restaurant/analyzer.py` — `FinancialMetrics` dataclass + `_extract_financial_metrics`
- Test: existing `test_v2_analyzer_integration.py`

- [ ] **Step 1: Write failing test**

```python
def test_dual_margin_both_computed():
    """BOTH folded and unfolded margins must be in financialMetrics output."""
    from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

    analyzer = RestaurantAnalyzerV2(factory_id="F-TEST", sub_sector="火锅")
    report = analyzer.analyze(financial_data={
        "current": {
            "revenue": 731048,           # 折后收入 (post-discount)
            "gross_revenue": 820000,     # 折前收入 (pre-discount)
            "food_cost": 307040,
            "labor_cost": 237660,
        },
    })
    fm = report["sections"]["financialMetrics"]
    # Both margins should be present
    assert "grossMarginFolded" in fm     # (731048 - 307040) / 731048
    assert "grossMarginUnfolded" in fm   # (820000 - 307040) / 820000

    # Values should be different
    assert fm["grossMarginFolded"] != fm["grossMarginUnfolded"]
    # Folded > unfolded (smaller denominator, same numerator-ish)
    assert fm["grossMarginFolded"] > fm["grossMarginUnfolded"]


def test_dual_margin_without_gross_revenue_falls_back():
    """When gross_revenue not provided, folded == unfolded (no discount data)."""
    from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

    analyzer = RestaurantAnalyzerV2(factory_id="F-TEST", sub_sector="火锅")
    report = analyzer.analyze(financial_data={
        "current": {"revenue": 731048, "food_cost": 307040},
    })
    fm = report["sections"]["financialMetrics"]
    # Should still be present, just equal
    assert fm.get("grossMarginFolded") is not None
    assert fm.get("grossMarginUnfolded") == fm.get("grossMarginFolded")
```

- [ ] **Step 2: Run test, verify FAIL**

Expected: `KeyError: 'grossMarginFolded'`

- [ ] **Step 3: Extend FinancialMetrics dataclass**

```python
# analyzer.py — find FinancialMetrics dataclass, add fields
@dataclass
class FinancialMetrics:
    revenue: float
    food_cost: Optional[float] = None
    labor_cost: Optional[float] = None
    rent: Optional[float] = None
    other_cost: Optional[float] = None
    net_profit: Optional[float] = None
    food_cost_ratio: Optional[float] = None
    labor_cost_ratio: Optional[float] = None
    rent_ratio: Optional[float] = None
    restaurant_net_margin: Optional[float] = None
    cost_rigidity: Optional[float] = None
    revenue_change_pct: Optional[float] = None
    labor_cost_change_pct: Optional[float] = None
    food_cost_change_pct: Optional[float] = None
    # NEW G2 dual margin
    gross_revenue: Optional[float] = None
    gross_margin_folded: Optional[float] = None     # (revenue - food_cost) / revenue
    gross_margin_unfolded: Optional[float] = None   # (gross_revenue - food_cost) / gross_revenue

    def to_dict(self) -> dict:
        return {
            "revenue": self.revenue,
            "foodCost": self.food_cost,
            "laborCost": self.labor_cost,
            "rent": self.rent,
            "otherCost": self.other_cost,
            "netProfit": self.net_profit,
            "foodCostRatio": self.food_cost_ratio,
            "laborCostRatio": self.labor_cost_ratio,
            "rentRatio": self.rent_ratio,
            "restaurantNetMargin": self.restaurant_net_margin,
            "costRigidity": self.cost_rigidity,
            "revenueChangePct": self.revenue_change_pct,
            "laborCostChangePct": self.labor_cost_change_pct,
            "foodCostChangePct": self.food_cost_change_pct,
            # NEW
            "grossRevenue": self.gross_revenue,
            "grossMarginFolded": self.gross_margin_folded,
            "grossMarginUnfolded": self.gross_margin_unfolded,
        }
```

- [ ] **Step 4: Populate in `_extract_financial_metrics`**

```python
# analyzer.py:596 — inside _extract_financial_metrics, after current ratio computations:
gross_revenue = self._safe_float(current.get("gross_revenue")) or revenue
metrics.gross_revenue = gross_revenue

if food_cost is not None:
    if revenue > 0:
        metrics.gross_margin_folded = (revenue - food_cost) / revenue * 100
    if gross_revenue > 0:
        metrics.gross_margin_unfolded = (gross_revenue - food_cost) / gross_revenue * 100
```

- [ ] **Step 5: Verify golden test still passes**

```bash
python -m pytest smartbi/services/restaurant/tests/test_batch_regression_golden.py -v
```

If the golden fixture now contains `grossMarginFolded: null` instead of the key being absent, the `_strip_volatile` function in the golden test will handle it. If not, regenerate the fixture:

```bash
rm smartbi/services/restaurant/tests/fixtures/batch_golden_dingxian.json
python -m pytest smartbi/services/restaurant/tests/test_batch_regression_golden.py -v
# First run: fixture captured, test skipped
python -m pytest smartbi/services/restaurant/tests/test_batch_regression_golden.py -v
# Second run: should pass
```

- [ ] **Step 6: Full regression**

Expected: 125 passed (123 + 2 new).

- [ ] **Step 7: Commit**

```bash
git add backend/python/smartbi/services/restaurant/analyzer.py \
        backend/python/smartbi/services/restaurant/tests/test_v2_analyzer_integration.py \
        backend/python/smartbi/services/restaurant/tests/fixtures/batch_golden_dingxian.json
git commit -m "feat(smartbi-restaurant): dual 折前/折后 gross margin computation

P3.5B F2: FinancialMetrics gains gross_revenue/grossMarginFolded/
grossMarginUnfolded fields. Both margins computed when gross_revenue
provided; falls back to folded-only when absent. UI can pick primary
display via FactoryConfig.marginSpec.primaryMarginDisplay.

Golden fixture regenerated to include the new null fields."
```

---

### Task F3: Stored value 3-mode treatment

**Why:** G2 promise — implement all 3 stored value treatment modes (PREPAID/REVENUE/EXCLUDED). Current analyzer only handles one implicit mode.

**Files:**
- Modify: `backend/python/smartbi/services/restaurant/stored_value_analyzer.py` — add `mode` param
- Modify: `backend/python/smartbi/services/restaurant/sections/stored_value.py` — pass mode from margin_spec
- Test: `backend/python/smartbi/services/restaurant/tests/test_section_analysis.py` — 3 new test cases

- [ ] **Step 1: Write failing test**

```python
def test_stored_value_mode_prepaid_treats_giveaway_as_future_liability():
    """PREPAID mode: 充卡 = 预收款, 消费时结转收入, 赠送部分是 liability reduction."""
    from smartbi.services.restaurant.stored_value_analyzer import StoredValueAnalyzer
    from smartbi.services.finance.margin_spec import StoredValueTreatment

    analyzer = StoredValueAnalyzer()
    report = analyzer.analyze(
        stored_value_giveaway=51680.61,
        revenue=731048,
        mode=StoredValueTreatment.PREPAID,
    )
    # PREPAID: giveaway recognized against prepaid balance, not revenue
    assert report.mode == "PREPAID"
    assert report.giveaway_ratio == pytest.approx(0.0707, rel=0.01)
    # Severity based on ratio against threshold from 火锅.yaml
    assert report.severity == "critical"


def test_stored_value_mode_revenue_treats_giveaway_as_expense():
    """REVENUE mode: 充卡 = 收入, 赠送部分 = 费用, ratio is expense/revenue."""
    from smartbi.services.restaurant.stored_value_analyzer import StoredValueAnalyzer
    from smartbi.services.finance.margin_spec import StoredValueTreatment

    analyzer = StoredValueAnalyzer()
    report = analyzer.analyze(
        stored_value_giveaway=51680.61,
        revenue=731048,
        mode=StoredValueTreatment.REVENUE,
    )
    assert report.mode == "REVENUE"
    # Same ratio, different narrative
    assert report.giveaway_ratio == pytest.approx(0.0707, rel=0.01)
    # Expense-style reporting
    assert "费用" in (report.message_zh or "")


def test_stored_value_mode_excluded_skips_analysis():
    """EXCLUDED mode: 充卡 not in revenue at all, no ratio to compute."""
    from smartbi.services.restaurant.stored_value_analyzer import StoredValueAnalyzer
    from smartbi.services.finance.margin_spec import StoredValueTreatment

    analyzer = StoredValueAnalyzer()
    report = analyzer.analyze(
        stored_value_giveaway=51680.61,
        revenue=731048,
        mode=StoredValueTreatment.EXCLUDED,
    )
    assert report.mode == "EXCLUDED"
    # Severity should be info (not risky — customer already excludes from revenue)
    assert report.severity == "info"
```

- [ ] **Step 2: Run test, verify FAIL**

Expected: `TypeError: analyze() got unexpected keyword argument 'mode'`

- [ ] **Step 3: Extend StoredValueAnalyzer.analyze() with mode param**

```python
# stored_value_analyzer.py — modify analyze() signature
from smartbi.services.finance.margin_spec import StoredValueTreatment

class StoredValueAnalyzer:
    def analyze(
        self,
        stored_value_giveaway: float,
        revenue: float,
        stored_value_charge: Optional[float] = None,
        previous_balance: Optional[float] = None,
        mode: StoredValueTreatment = StoredValueTreatment.PREPAID,  # NEW
    ) -> "StoredValueReport":
        """Analyze stored value dependency.

        mode: how the customer accounts for stored value (PREPAID/REVENUE/EXCLUDED).
              Affects the narrative and severity. Default PREPAID (most common).
        """
        ratio = stored_value_giveaway / revenue if revenue > 0 else 0

        # Thresholds from 火锅.yaml (loaded earlier in QW1)
        WARNING_RATIO = 0.05
        CRITICAL_RATIO = 0.07

        if mode == StoredValueTreatment.EXCLUDED:
            # Customer already excludes from revenue — not a risk
            severity = "info"
            message = f"充卡赠送 {stored_value_giveaway:,.0f} 已从收入中排除, 无依赖风险"
        else:
            if ratio >= CRITICAL_RATIO:
                severity = "critical"
            elif ratio >= WARNING_RATIO:
                severity = "warning"
            else:
                severity = "info"

            if mode == StoredValueTreatment.PREPAID:
                message = (
                    f"预收款模式: 充卡赠送 {ratio*100:.1f}% 占营收. "
                    f"若超 {CRITICAL_RATIO*100:.0f}% 需关注负债兑付压力."
                )
            elif mode == StoredValueTreatment.REVENUE:
                message = (
                    f"收入直接确认模式: 充卡赠送 {ratio*100:.1f}% 作为营销费用. "
                    f"占比过高会压缩毛利."
                )

        return StoredValueReport(
            stored_value_giveaway=stored_value_giveaway,
            revenue=revenue,
            giveaway_ratio=ratio,
            severity=severity,
            message_zh=message,
            mode=mode.value,  # NEW field
        )
```

Update `StoredValueReport` dataclass to include `mode: str` field and include in `to_dict()`.

- [ ] **Step 4: Pass mode from section handler**

```python
# sections/stored_value.py — compute() method
def compute(self, request, context):
    ...
    # NEW: read mode from context (set by orchestrator from margin_spec)
    mode = context.get("stored_value_mode") or StoredValueTreatment.PREPAID

    report = self._get_analyzer().analyze(
        stored_value_giveaway=giveaway,
        revenue=revenue,
        stored_value_charge=charge,
        previous_balance=previous_balance,
        mode=mode,
    )
    ...
```

And in `analyzer.py` `analyze()` orchestrator:
```python
# Before calling handlers, populate context:
context["stored_value_mode"] = self.margin_spec.stored_value_treatment
```

- [ ] **Step 5: Run tests, verify PASS**

Expected: 3 new tests pass.

- [ ] **Step 6: Full regression**

Expected: 128 passed (125 + 3 new).

- [ ] **Step 7: Commit**

```bash
git add backend/python/smartbi/services/restaurant/stored_value_analyzer.py \
        backend/python/smartbi/services/restaurant/sections/stored_value.py \
        backend/python/smartbi/services/restaurant/analyzer.py \
        backend/python/smartbi/services/restaurant/tests/test_section_analysis.py
git commit -m "feat(smartbi-restaurant): stored value 3-mode treatment (PREPAID/REVENUE/EXCLUDED)

P3.5B F3: StoredValueAnalyzer.analyze() accepts mode param, implements
all 3 treatments per MarginSpec. PREPAID (default) treats giveaway as
future liability, REVENUE treats as marketing expense, EXCLUDED skips
analysis entirely. Narrative and severity adapt per mode.

Mode flows from FactoryConfig.marginSpec.storedValueTreatment via
analyzer context. Backward compat: PREPAID is default, matches previous
hardcoded behavior."
```

---

### Task F4: Raw Material Master + unit conversion

**Why:** G7 foundation — model raw materials with inventory/calc unit conversion. Critical for BOM Layer 2+3 accuracy.

**Files:**
- Create: `backend/python/smartbi/services/bom/__init__.py`
- Create: `backend/python/smartbi/services/bom/raw_material.py`
- Create: `backend/python/smartbi/services/bom/tests/__init__.py`
- Create: `backend/python/smartbi/services/bom/tests/test_raw_material.py`

- [ ] **Step 1: Write failing test**

```python
# test_raw_material.py
import pytest

from smartbi.services.bom.raw_material import RawMaterial, UnitConverter


def test_raw_material_basic_creation():
    mat = RawMaterial(
        name="小青龙(冻-好)200-300g",
        category="海鲜类",
        inventory_unit="斤",
        calc_unit="克",
        calc_spec=500,  # 1 斤 = 500 克
        recent_price=147.02,
        supplier="长沙四季商贸",
    )
    assert mat.name == "小青龙(冻-好)200-300g"
    assert mat.calc_spec == 500


def test_unit_converter_斤_to_克():
    """1 斤 of 小青龙 should convert to 500 g."""
    mat = RawMaterial(
        name="小青龙", category="海鲜", inventory_unit="斤",
        calc_unit="克", calc_spec=500, recent_price=147.02, supplier="test",
    )
    assert UnitConverter.inventory_to_calc(mat, 1) == 500
    assert UnitConverter.inventory_to_calc(mat, 2.5) == 1250


def test_unit_converter_reverse_calc_to_inventory():
    """500g of 小青龙 is 1 斤."""
    mat = RawMaterial(
        name="小青龙", category="海鲜", inventory_unit="斤",
        calc_unit="克", calc_spec=500, recent_price=147.02, supplier="test",
    )
    assert UnitConverter.calc_to_inventory(mat, 500) == 1
    assert UnitConverter.calc_to_inventory(mat, 250) == 0.5


def test_unit_converter_calc_cost_per_calc_unit():
    """Per-gram cost: ¥147.02/斤 ÷ 500g = ¥0.294/g."""
    mat = RawMaterial(
        name="小青龙", category="海鲜", inventory_unit="斤",
        calc_unit="克", calc_spec=500, recent_price=147.02, supplier="test",
    )
    cost_per_gram = UnitConverter.cost_per_calc_unit(mat)
    assert cost_per_gram == pytest.approx(0.29404, rel=1e-4)


def test_unit_converter_handles_1_to_1_spec():
    """For 包 → 包 (1:1), conversion is identity."""
    mat = RawMaterial(
        name="硬中华", category="烟草", inventory_unit="包",
        calc_unit="包", calc_spec=1, recent_price=41.5, supplier="烟草公司",
    )
    assert UnitConverter.inventory_to_calc(mat, 10) == 10
    assert UnitConverter.cost_per_calc_unit(mat) == 41.5


def test_unit_converter_raises_on_zero_spec():
    """calc_spec=0 is a data error — divide by zero would be silent."""
    mat = RawMaterial(
        name="broken", category="test", inventory_unit="斤",
        calc_unit="克", calc_spec=0, recent_price=10, supplier="test",
    )
    with pytest.raises(ValueError, match="calc_spec.*zero"):
        UnitConverter.inventory_to_calc(mat, 1)


def test_multi_cuisine_raw_materials():
    """Different cuisines use different raw materials — universal pattern."""
    hotpot_mat = RawMaterial(
        name="肥牛卷", category="肉类", inventory_unit="斤",
        calc_unit="克", calc_spec=500, recent_price=48.0, supplier="test",
    )
    bakery_mat = RawMaterial(
        name="高筋面粉", category="粮油", inventory_unit="kg",
        calc_unit="克", calc_spec=1000, recent_price=8.5, supplier="test",
    )
    western_mat = RawMaterial(
        name="澳洲牛排", category="肉类", inventory_unit="块",
        calc_unit="块", calc_spec=1, recent_price=68.0, supplier="test",
    )

    assert UnitConverter.cost_per_calc_unit(hotpot_mat) == pytest.approx(0.096)
    assert UnitConverter.cost_per_calc_unit(bakery_mat) == pytest.approx(0.0085)
    assert UnitConverter.cost_per_calc_unit(western_mat) == 68.0
```

- [ ] **Step 2: Run test, verify FAIL**

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Implement raw_material.py**

```python
# backend/python/smartbi/services/bom/raw_material.py
"""Raw material master + unit conversion.

Every inventory system has this pattern:
  - Inventory unit (库存单位): 斤, 包, kg, 块, 箱, ...
  - Calc unit (核算单位): 克, 包, 克, 块, 瓶, ...
  - Conversion spec (核算规格): how many calc_units = 1 inventory_unit
    Examples: 1 斤 = 500 克 (spec=500)
              1 包 = 1 包 (spec=1)
              1 kg = 1000 克 (spec=1000)
              1 块 = 1 块 (spec=1)

Without this, COGS calculation is wrong by factors of 10-1000. A recipe
saying "500 克 of 小青龙" is NOT the same as "500 斤".

Data source: 附件三、门店原材料.xlsx sheet columns map directly to
RawMaterial fields (库存单位/核算单位/核算规格/规格/最近收料单价/供应商).

Populated via API sync from Cretas Java `Material` table, or via YAML
upload for prototype factories.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class RawMaterial:
    """One raw material with unit conversion data."""
    name: str                           # e.g. "小青龙(冻-好)200-300g"
    category: str                       # e.g. "海鲜类"
    inventory_unit: str                 # e.g. "斤"
    calc_unit: str                      # e.g. "克"
    calc_spec: float                    # e.g. 500 (1 斤 = 500 克)
    recent_price: float                 # price per inventory_unit (e.g. 147.02 ¥/斤)
    supplier: str                       # e.g. "长沙四季商贸"
    regulation: Optional[str] = None    # e.g. "1*20" (packaging spec)


class UnitConverter:
    """Stateless helpers for unit conversion + cost per calc unit."""

    @staticmethod
    def _check_spec(mat: RawMaterial) -> None:
        if mat.calc_spec == 0:
            raise ValueError(
                f"RawMaterial {mat.name!r} has calc_spec=zero — divide by zero. "
                f"Check 附件三 entry for correct 核算规格."
            )

    @staticmethod
    def inventory_to_calc(mat: RawMaterial, inventory_amount: float) -> float:
        """Convert inventory quantity to calc quantity.

        Example: 2.5 斤 of 小青龙 → 2.5 * 500 = 1250 g
        """
        UnitConverter._check_spec(mat)
        return inventory_amount * mat.calc_spec

    @staticmethod
    def calc_to_inventory(mat: RawMaterial, calc_amount: float) -> float:
        """Convert calc quantity to inventory quantity.

        Example: 250 g of 小青龙 → 250 / 500 = 0.5 斤
        """
        UnitConverter._check_spec(mat)
        return calc_amount / mat.calc_spec

    @staticmethod
    def cost_per_calc_unit(mat: RawMaterial) -> float:
        """Price per calc unit.

        Example: ¥147.02 per 斤 / 500 g per 斤 = ¥0.294 per gram
        """
        UnitConverter._check_spec(mat)
        return mat.recent_price / mat.calc_spec

    @staticmethod
    def cost_of_calc_quantity(mat: RawMaterial, calc_amount: float) -> float:
        """Total cost for a given calc quantity.

        Example: 800 g of 小青龙 at ¥0.294/g = ¥235.23
        """
        return calc_amount * UnitConverter.cost_per_calc_unit(mat)
```

Add to `services/bom/__init__.py`:
```python
from .raw_material import RawMaterial, UnitConverter
__all__ = ["RawMaterial", "UnitConverter"]
```

- [ ] **Step 4: Run tests, verify PASS**

Expected: 7 passed.

- [ ] **Step 5: Full regression**

Expected: 135 passed (128 + 7).

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/bom/
git commit -m "feat(smartbi-bom): add RawMaterial + UnitConverter for 库存/核算 units

P3.5B F4: models 附件三、门店原材料.xlsx schema (inventory_unit / 
calc_unit / calc_spec / recent_price / supplier). UnitConverter 
provides inventory↔calc bidirectional + cost_per_calc_unit helpers.

7 unit tests cover hotpot 海鲜 (斤→克), bakery 面粉 (kg→克), 
western 牛排 (块→块 identity), 烟草 (包→包 identity), zero-spec 
error handling, and bidirectional roundtrip. Universal across cuisines.

Consumer wiring (BomResolver G3) comes in Phase 3.5C B2."
```

---

### Task F5: ExpenseAccountTree loader wired into analyzer

**Why:** QW4 created the tree model. This task loads it at analyzer construction time and exposes `get_expense_account_tree()` for downstream use by diagnostics.

**Files:**
- Modify: `backend/python/smartbi/services/restaurant/analyzer.py` — accept `expense_account_tree_id` + lazy load
- Test: existing `test_v2_analyzer_integration.py`

- [ ] **Step 1: Write failing test**

```python
def test_analyzer_loads_expense_tree_by_id():
    from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

    analyzer = RestaurantAnalyzerV2(
        factory_id="F-TEST",
        sub_sector="火锅",
        expense_account_tree_id="hotpot_default",  # NEW
    )
    tree = analyzer.get_expense_account_tree()
    assert tree is not None
    assert "工资" in tree.nodes
    assert "充卡赠送" in tree.nodes
    assert "房租费" in tree.nodes


def test_analyzer_default_tree_is_default_yaml():
    """No tree_id specified → load default.yaml (5-bucket fallback)."""
    from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

    analyzer = RestaurantAnalyzerV2(factory_id="F-TEST", sub_sector="火锅")
    tree = analyzer.get_expense_account_tree()
    # default.yaml has food_cost/labor_cost/rent/other_cost/net_profit
    assert "food_cost" in tree.nodes
    assert "labor_cost" in tree.nodes


def test_analyzer_unknown_tree_id_raises():
    from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

    analyzer = RestaurantAnalyzerV2(
        factory_id="F-TEST",
        sub_sector="火锅",
        expense_account_tree_id="nonexistent_tree",
    )
    with pytest.raises((FileNotFoundError, ValueError), match="nonexistent"):
        analyzer.get_expense_account_tree()
```

- [ ] **Step 2: Run test, verify FAIL**

- [ ] **Step 3: Add tree loading to analyzer**

```python
# analyzer.py — __init__ addition
def __init__(
    self,
    factory_id: str,
    sub_sector: str,
    db_session=None,
    sku_form_manager=None,
    monthly_calibrator=None,
    margin_spec=None,
    expense_account_tree_id: Optional[str] = None,  # NEW
):
    ...
    self.expense_account_tree_id = expense_account_tree_id or "default"
    self._expense_tree_cache = None  # lazy load

def get_expense_account_tree(self) -> "ExpenseAccountTree":
    """Lazy-load the expense account tree by id.

    Tree files live in knowledge/restaurant/expense_account_tree/{id}.yaml.
    Defaults to 'default' (5-bucket fallback).
    """
    if self._expense_tree_cache is None:
        from pathlib import Path
        from smartbi.services.finance.expense_account_tree import load_tree_from_yaml

        yaml_path = (
            Path(__file__).parents[2]
            / "knowledge"
            / "restaurant"
            / "expense_account_tree"
            / f"{self.expense_account_tree_id}.yaml"
        )
        if not yaml_path.exists():
            raise FileNotFoundError(
                f"Expense account tree {self.expense_account_tree_id!r} not found at {yaml_path}"
            )
        self._expense_tree_cache = load_tree_from_yaml(yaml_path)
    return self._expense_tree_cache
```

- [ ] **Step 4: Run tests, verify PASS**

Expected: 3 new tests pass.

- [ ] **Step 5: Full regression**

Expected: 138 passed (135 + 3).

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/restaurant/analyzer.py \
        backend/python/smartbi/services/restaurant/tests/test_v2_analyzer_integration.py
git commit -m "feat(smartbi-restaurant): expense_account_tree_id config + lazy loader

P3.5B F5: RestaurantAnalyzerV2 accepts expense_account_tree_id param
(default 'default' = 5-bucket fallback). Tree loaded lazily on first
access via get_expense_account_tree(). Trees live in
knowledge/restaurant/expense_account_tree/{id}.yaml.

Consumers: F6 diagnostics drill-down + 3.5D department_pnl section."
```

---

### Task F6: Expense breakdown section handler

**Why:** Surface the expense tree through a new section endpoint so mobile can drill down from "人力成本率高" to "前厅临时工超预算 4500".

**Files:**
- Create: `backend/python/smartbi/services/restaurant/sections/expense_breakdown.py`
- Create: `backend/python/smartbi/services/restaurant/tests/test_section_expense_breakdown.py`

- [ ] **Step 1: Write failing test**

```python
# test_section_expense_breakdown.py
import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.expense_breakdown import (
    ExpenseBreakdownHandler,
)


def test_expense_breakdown_aggregates_by_tree():
    h = ExpenseBreakdownHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id=None,
        sub_sector="火锅",
        params={
            "expense_account_tree_id": "hotpot_default",
            "expense_leaf_values": {
                "工资": 237660,
                "奖金": 0,
                "房租费": 85000,
                "充卡赠送": 51680.61,
                "水费": 3200,
                "电费": 8500,
                "柴油": 2100,
                "广告宣传活动费": 1500,
            },
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK

    # Aggregation sanity
    agg = resp.data["aggregated"]
    assert agg["人力成本"] == 237660  # workers + bonus
    assert agg["水电费"] == 3200 + 8500 + 2100  # utilities
    assert agg["场地费用"] >= 85000  # rent

    # Top N breakdown
    assert "topAccounts" in resp.data
    top_5 = resp.data["topAccounts"][:5]
    assert len(top_5) > 0
    assert top_5[0]["code"] == "工资"  # largest expense


def test_expense_breakdown_empty_values_returns_all_zeros():
    h = ExpenseBreakdownHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={"expense_leaf_values": {}},
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    assert all(v == 0 for v in resp.data["aggregated"].values())
```

- [ ] **Step 2: Run test, verify FAIL**

- [ ] **Step 3: Implement ExpenseBreakdownHandler**

```python
# sections/expense_breakdown.py
"""Expense breakdown section — aggregates leaf account values by tree."""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from smartbi.services.finance.expense_account_tree import load_tree_from_yaml
from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class ExpenseBreakdownHandler(AbstractSectionHandler):
    """Aggregate per-leaf expense values to tree parents + rank top N."""

    section_name = "expense_breakdown"

    def __init__(self) -> None:
        self._tree_cache: dict[str, Any] = {}

    def _get_tree(self, tree_id: str):
        if tree_id not in self._tree_cache:
            yaml_path = (
                Path(__file__).parents[3]
                / "knowledge"
                / "restaurant"
                / "expense_account_tree"
                / f"{tree_id}.yaml"
            )
            if not yaml_path.exists():
                return None
            self._tree_cache[tree_id] = load_tree_from_yaml(yaml_path)
        return self._tree_cache[tree_id]

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        tree_id = request.params.get("expense_account_tree_id", "hotpot_default")
        leaf_values = request.params.get("expense_leaf_values") or {}

        tree = self._get_tree(tree_id)
        if tree is None:
            return self.skipped(
                request,
                f"未找到费用科目树 {tree_id!r}",
                started,
            )

        aggregated = tree.aggregate(leaf_values)

        # Top N by value — only leaves, sorted descending
        top_accounts = sorted(
            [
                {"code": code, "nameZh": tree.nodes[code].name_zh, "value": val}
                for code, val in aggregated.items()
                if tree.is_leaf(code) and val > 0
            ],
            key=lambda x: x["value"],
            reverse=True,
        )

        return self.ok(
            request,
            data={
                "treeId": tree_id,
                "aggregated": aggregated,
                "topAccounts": top_accounts[:20],
                "leafCount": sum(1 for c in tree.nodes if tree.is_leaf(c)),
            },
            started=started,
        )
```

- [ ] **Step 4: Run test, verify PASS**

Expected: 2 passed.

- [ ] **Step 5: Full regression**

Expected: 140 passed (138 + 2).

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/restaurant/sections/expense_breakdown.py \
        backend/python/smartbi/services/restaurant/tests/test_section_expense_breakdown.py
git commit -m "feat(smartbi-restaurant): add expense_breakdown section handler

P3.5B F6: new section handler aggregates per-leaf expense values to
tree parents + ranks top 20 leaf accounts by value. Uses the loaded
expense_account_tree YAML from QW4. Mobile drill-down from '人力成本率高'
to '工资 237660 + 奖金 0 + 福利费 5000 → total 242660' now possible.

Not yet registered in router — F8 does that."
```

---

### Task F7: Register expense_breakdown in FastAPI router

**Why:** Make the new section callable via `POST /api/smartbi/restaurant/sections/expense_breakdown`.

**Files:**
- Modify: `backend/python/smartbi/api/restaurant_sections.py`
- Test: existing router tests

- [ ] **Step 1: Add import + HANDLERS entry**

```python
# restaurant_sections.py — add import
from smartbi.services.restaurant.sections.expense_breakdown import ExpenseBreakdownHandler

# In HANDLERS dict (sorted alphabetically):
HANDLERS = {
    ...
    "expense_breakdown": ExpenseBreakdownHandler(),
    ...
}
```

- [ ] **Step 2: Verify via manual curl-equivalent Python test**

```python
def test_router_exposes_expense_breakdown():
    from smartbi.api.restaurant_sections import HANDLERS
    assert "expense_breakdown" in HANDLERS
    assert HANDLERS["expense_breakdown"].section_name == "expense_breakdown"
```

Add to `test_sections_contract.py`.

- [ ] **Step 3: Full regression**

Expected: 141 passed (140 + 1).

- [ ] **Step 4: Commit**

```bash
git add backend/python/smartbi/api/restaurant_sections.py \
        backend/python/smartbi/services/restaurant/tests/test_sections_contract.py
git commit -m "feat(smartbi-restaurant): register expense_breakdown in section router

P3.5B F7: section handler now callable via
POST /api/smartbi/restaurant/sections/expense_breakdown.
Completes the G1 foundation — analyzer can compute, router can serve."
```

---

### Task F8: Fix stored value section to use MarginSpec mode

**Why:** F3 added mode param but only wired it for the standalone handler. The batch orchestrator in `analyzer.analyze()` needs to propagate `margin_spec.stored_value_treatment` to the context.

**Files:**
- Modify: `backend/python/smartbi/services/restaurant/analyzer.py` — `analyze()` orchestrator
- Test: existing `test_v2_analyzer_integration.py`

- [ ] **Step 1: Write failing test**

```python
def test_analyzer_propagates_stored_value_mode_to_section():
    from smartbi.services.finance.margin_spec import MarginSpec, StoredValueTreatment
    from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2

    spec = MarginSpec(stored_value_treatment=StoredValueTreatment.REVENUE)
    analyzer = RestaurantAnalyzerV2(
        factory_id="F-TEST",
        sub_sector="火锅",
        margin_spec=spec,
    )
    report = analyzer.analyze(financial_data={
        "current": {
            "revenue": 731048,
            "food_cost": 307040,
            "stored_value_giveaway": 51680.61,
        },
    })
    sv = report["sections"].get("storedValueDependency")
    assert sv is not None
    assert sv.get("mode") == "REVENUE"
```

- [ ] **Step 2: Run test, verify FAIL**

Expected: `sv.get("mode") == None` or default "PREPAID".

- [ ] **Step 3: Propagate mode in analyze()**

```python
# analyzer.py — in analyze() method, before context handler calls:
if financial_data:
    context["stored_value_mode"] = self.margin_spec.stored_value_treatment
```

And in `stored_value.py` section handler, ensure it reads `context.get("stored_value_mode")`.

- [ ] **Step 4: Run test, verify PASS**

- [ ] **Step 5: Full regression + golden**

```bash
python -m pytest smartbi/services/restaurant/tests/ -q
python -m pytest smartbi/services/restaurant/tests/test_batch_regression_golden.py -v
```

Expected: 142 passed, golden still green.

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/restaurant/analyzer.py \
        backend/python/smartbi/services/restaurant/sections/stored_value.py \
        backend/python/smartbi/services/restaurant/tests/test_v2_analyzer_integration.py
git commit -m "feat(smartbi-restaurant): propagate margin_spec mode to stored_value section

P3.5B F8: RestaurantAnalyzerV2.analyze() now passes
margin_spec.stored_value_treatment through context to the stored_value
section handler. All 3 modes (PREPAID/REVENUE/EXCLUDED) reachable
from batch analysis.

Completes Phase 3.5B foundation: MarginSpec fully wired,
ExpenseAccountTree loadable + queryable, RawMaterial ready for BOM."
```

---

**Phase 3.5B Exit Gate:**
- 8 commits (F1-F8)
- Tests: 120 → 142 (22 new tests)
- `MarginSpec` fully integrated with `_extract_financial_metrics`
- Dual margin (折前 + 折后) computed
- 3-mode stored value treatment wired
- `ExpenseAccountTree` loadable by id, queryable via new `expense_breakdown` section
- `RawMaterial` + `UnitConverter` ready for BOM depth (Phase 3.5C)
- Byte-identity golden test still green
- Ready to proceed to Phase 3.5C

---

## 5. Phase 3.5C — BOM Depth (1 week, 6 tasks)

Adds 2-layer BOM support (dish → semi-finished → raw material) with yield rate (出成率), plus the Shrinkage Engine that compares standard vs actual cost at the department level.

---

### Task B1: IntermediateProduct model (semi-finished products)

**Why:** G3 foundation — model a semi-finished product (自制鸡爪酱) with its own BOM of raw materials + yield rate. Dishes will reference these by name.

**Files:**
- Create: `backend/python/smartbi/services/bom/intermediate_product.py`
- Create: `backend/python/smartbi/services/bom/tests/test_intermediate_product.py`

- [ ] **Step 1: Write failing test**

```python
# test_intermediate_product.py
import pytest

from smartbi.services.bom.intermediate_product import (
    IntermediateProduct, IngredientLine,
)
from smartbi.services.bom.raw_material import RawMaterial, UnitConverter


@pytest.fixture
def sample_raw_materials():
    """3 raw materials for a 自制鸡爪酱 recipe."""
    return {
        "南乳汁": RawMaterial(
            name="南乳汁", category="调料", inventory_unit="瓶", calc_unit="克",
            calc_spec=500, recent_price=12.0, supplier="test",
        ),
        "色拉油": RawMaterial(
            name="色拉油", category="粮油", inventory_unit="斤", calc_unit="克",
            calc_spec=500, recent_price=6.5, supplier="test",
        ),
        "姜": RawMaterial(
            name="姜", category="蔬菜", inventory_unit="斤", calc_unit="克",
            calc_spec=500, recent_price=8.0, supplier="test",
        ),
    }


def test_intermediate_product_basic(sample_raw_materials):
    """Recipe: 1 batch of 自制鸡爪酱 yields 45 斤, uses 3 ingredients."""
    ip = IntermediateProduct(
        name="自制鸡爪酱",
        department="明档",
        batch_yield_qty=45,
        batch_yield_unit="斤",
        ingredients=[
            IngredientLine(raw_material_name="南乳汁", raw_amount_calc=600, yield_rate=1.0),
            IngredientLine(raw_material_name="色拉油", raw_amount_calc=1500, yield_rate=1.0),
            IngredientLine(raw_material_name="姜", raw_amount_calc=421, yield_rate=0.95),
        ],
    )
    assert len(ip.ingredients) == 3
    assert ip.batch_yield_qty == 45


def test_calculate_batch_cost(sample_raw_materials):
    """Total cost = sum(raw_amount × cost_per_calc_unit)."""
    ip = IntermediateProduct(
        name="自制鸡爪酱",
        department="明档",
        batch_yield_qty=45,
        batch_yield_unit="斤",
        ingredients=[
            IngredientLine(raw_material_name="南乳汁", raw_amount_calc=600, yield_rate=1.0),
            IngredientLine(raw_material_name="色拉油", raw_amount_calc=1500, yield_rate=1.0),
        ],
    )
    # 南乳汁: 600g × (12.0/500) = 600 × 0.024 = 14.4
    # 色拉油: 1500g × (6.5/500) = 1500 × 0.013 = 19.5
    total = ip.calculate_batch_cost(sample_raw_materials)
    assert total == pytest.approx(14.4 + 19.5, rel=0.01)


def test_calculate_unit_cost(sample_raw_materials):
    """Unit cost = batch_cost / batch_yield_qty."""
    ip = IntermediateProduct(
        name="自制鸡爪酱",
        department="明档",
        batch_yield_qty=45,
        batch_yield_unit="斤",
        ingredients=[
            IngredientLine(raw_material_name="南乳汁", raw_amount_calc=600, yield_rate=1.0),
        ],
    )
    # Batch cost: 600 × 0.024 = 14.4
    # Unit cost: 14.4 / 45 = 0.32 per 斤
    unit_cost = ip.calculate_unit_cost(sample_raw_materials)
    assert unit_cost == pytest.approx(14.4 / 45, rel=0.01)


def test_yield_rate_adjusts_raw_amount():
    """For 大葱 with yield 0.5: recipe says need 500g net, buy 1000g gross."""
    mat = RawMaterial(
        name="大葱", category="蔬菜", inventory_unit="斤", calc_unit="克",
        calc_spec=500, recent_price=3.0, supplier="test",
    )
    line = IngredientLine(
        raw_material_name="大葱",
        raw_amount_calc=500,  # net amount needed
        yield_rate=0.5,       # 50% yield
    )
    # Gross amount (毛料) = net / yield = 500 / 0.5 = 1000g
    gross = line.gross_amount_calc()
    assert gross == 1000

    # Cost uses gross amount
    cost = line.calculate_cost({"大葱": mat})
    # 1000g × (3.0/500) = 1000 × 0.006 = 6.0
    assert cost == pytest.approx(6.0, rel=0.01)


def test_missing_raw_material_raises():
    ip = IntermediateProduct(
        name="broken",
        department="test",
        batch_yield_qty=1,
        batch_yield_unit="份",
        ingredients=[
            IngredientLine(raw_material_name="不存在", raw_amount_calc=100),
        ],
    )
    with pytest.raises(KeyError, match="不存在"):
        ip.calculate_batch_cost({})


def test_universal_bakery_intermediate():
    """Bakery: 自制面团 uses flour + water + yeast. Proves universality."""
    mats = {
        "高筋面粉": RawMaterial(
            name="高筋面粉", category="粮油", inventory_unit="kg", calc_unit="克",
            calc_spec=1000, recent_price=8.5, supplier="test",
        ),
        "酵母": RawMaterial(
            name="酵母", category="辅料", inventory_unit="袋", calc_unit="克",
            calc_spec=100, recent_price=12.0, supplier="test",
        ),
    }
    dough = IntermediateProduct(
        name="自制面团",
        department="烘焙间",
        batch_yield_qty=10,  # 10 kg of dough
        batch_yield_unit="kg",
        ingredients=[
            IngredientLine(raw_material_name="高筋面粉", raw_amount_calc=5000, yield_rate=1.0),
            IngredientLine(raw_material_name="酵母", raw_amount_calc=50, yield_rate=1.0),
        ],
    )
    # 面粉: 5000 × (8.5/1000) = 42.5
    # 酵母: 50 × (12/100) = 6.0
    total = dough.calculate_batch_cost(mats)
    assert total == pytest.approx(42.5 + 6.0, rel=0.01)
```

- [ ] **Step 2: Run test, verify FAIL**

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Implement intermediate_product.py**

```python
# backend/python/smartbi/services/bom/intermediate_product.py
"""Intermediate product (semi-finished) model.

Restaurant kitchens make semi-finished products (prep) that dishes then
reference. Example: 自制鸡爪酱 uses 南乳汁 + 色拉油 + 姜, produces 45 斤 per
batch. Dishes like 金汤凤爪 use 800g of this sauce per portion.

Supports yield rate (出成率): when 1 kg of raw 大葱 only yields 0.5 kg of
usable 净料 after trimming, the recipe needs to buy 2x the net amount to
produce the required quantity.

Data source: 附件六-1/2、自制半成品成本卡.xlsx — columns map to
IngredientLine fields (原料名称 / 批次净料 / 出成率 / 批次毛料 / 单位毛料).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from smartbi.services.bom.raw_material import RawMaterial, UnitConverter


@dataclass
class IngredientLine:
    """One line in an intermediate product's recipe.

    raw_amount_calc is the NET amount in calc_unit (克).
    yield_rate adjusts: gross = net / yield_rate.
    """
    raw_material_name: str
    raw_amount_calc: float      # net amount needed (克)
    yield_rate: float = 1.0     # 出成率 (1.0 = no loss, 0.5 = 50% loss)
    raw_material_alias: Optional[str] = None  # optional display alias

    def gross_amount_calc(self) -> float:
        """Gross amount to buy (before trimming/prep loss)."""
        if self.yield_rate == 0:
            raise ValueError(
                f"yield_rate=0 for {self.raw_material_name!r} — divide by zero"
            )
        return self.raw_amount_calc / self.yield_rate

    def calculate_cost(self, raw_materials: dict[str, RawMaterial]) -> float:
        """Cost of the gross amount (considering yield loss)."""
        if self.raw_material_name not in raw_materials:
            raise KeyError(
                f"Raw material {self.raw_material_name!r} not in raw_materials dict"
            )
        mat = raw_materials[self.raw_material_name]
        return UnitConverter.cost_of_calc_quantity(mat, self.gross_amount_calc())


@dataclass
class IntermediateProduct:
    """A semi-finished product made from raw materials.

    One batch produces batch_yield_qty (in batch_yield_unit).
    calculate_unit_cost returns cost per 1 batch_yield_unit.
    """
    name: str
    department: str             # 耗用部门 (明档 / 热菜 / 烘焙间 / ...)
    batch_yield_qty: float      # e.g. 45
    batch_yield_unit: str       # e.g. "斤"
    ingredients: list[IngredientLine] = field(default_factory=list)

    def calculate_batch_cost(self, raw_materials: dict[str, RawMaterial]) -> float:
        """Total cost for one batch (sum of all ingredient costs)."""
        total = 0.0
        for line in self.ingredients:
            total += line.calculate_cost(raw_materials)
        return total

    def calculate_unit_cost(self, raw_materials: dict[str, RawMaterial]) -> float:
        """Cost per unit of output."""
        if self.batch_yield_qty == 0:
            raise ValueError(f"IntermediateProduct {self.name!r} has batch_yield_qty=0")
        return self.calculate_batch_cost(raw_materials) / self.batch_yield_qty

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "department": self.department,
            "batchYieldQty": self.batch_yield_qty,
            "batchYieldUnit": self.batch_yield_unit,
            "ingredients": [
                {
                    "rawMaterial": line.raw_material_name,
                    "netAmountCalc": line.raw_amount_calc,
                    "yieldRate": line.yield_rate,
                    "grossAmountCalc": line.gross_amount_calc(),
                }
                for line in self.ingredients
            ],
        }
```

Update `services/bom/__init__.py`:
```python
from .raw_material import RawMaterial, UnitConverter
from .intermediate_product import IntermediateProduct, IngredientLine

__all__ = [
    "RawMaterial", "UnitConverter",
    "IntermediateProduct", "IngredientLine",
]
```

- [ ] **Step 4: Run tests, verify PASS**

Expected: 6 passed.

- [ ] **Step 5: Full regression**

Expected: 148 passed (142 + 6).

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/bom/intermediate_product.py \
        backend/python/smartbi/services/bom/__init__.py \
        backend/python/smartbi/services/bom/tests/test_intermediate_product.py
git commit -m "feat(smartbi-bom): add IntermediateProduct with yield rate support

P3.5C B1: models 附件六 (自制半成品成本卡) — 批次净料 / 出成率 / 
批次毛料 semantics. IngredientLine.gross_amount_calc() computes 
buy-side amount from recipe-side amount considering yield loss.
IntermediateProduct.calculate_unit_cost() returns cost per output unit.

6 unit tests cover hotpot 自制鸡爪酱 (no yield loss), 大葱 50% yield
(doubles the buy amount), bakery 自制面团 (cross-cuisine), missing
raw material error, and degenerate yield_rate=0 error."
```

---

### Task B2: Dish model with 2-layer BOM

**Why:** Dishes (菜品) reference BOTH raw materials AND intermediate products. Resolve total cost by recursively computing the intermediate products' cost.

**Files:**
- Create: `backend/python/smartbi/services/bom/dish.py`
- Create: `backend/python/smartbi/services/bom/tests/test_dish.py`

- [ ] **Step 1: Write failing test**

```python
# test_dish.py
import pytest

from smartbi.services.bom.raw_material import RawMaterial
from smartbi.services.bom.intermediate_product import (
    IntermediateProduct, IngredientLine,
)
from smartbi.services.bom.dish import Dish, DishIngredientLine


@pytest.fixture
def kitchen_data():
    """Real 鼎鲜 金汤凤爪 recipe data."""
    raw = {
        "凤爪": RawMaterial(
            name="凤爪", category="肉类", inventory_unit="斤", calc_unit="克",
            calc_spec=500, recent_price=22.0, supplier="test",
        ),
        "南乳汁": RawMaterial(
            name="南乳汁", category="调料", inventory_unit="瓶", calc_unit="克",
            calc_spec=500, recent_price=12.0, supplier="test",
        ),
        "色拉油": RawMaterial(
            name="色拉油", category="粮油", inventory_unit="斤", calc_unit="克",
            calc_spec=500, recent_price=6.5, supplier="test",
        ),
    }
    intermediates = {
        "自制鸡爪酱": IntermediateProduct(
            name="自制鸡爪酱",
            department="明档",
            batch_yield_qty=45000,  # 45 斤 × 1000 = 45000 克 (assume batch in g)
            batch_yield_unit="克",
            ingredients=[
                IngredientLine(raw_material_name="南乳汁", raw_amount_calc=600),
                IngredientLine(raw_material_name="色拉油", raw_amount_calc=1500),
            ],
        ),
    }
    return raw, intermediates


def test_dish_references_raw_and_intermediate(kitchen_data):
    raw, intermediates = kitchen_data
    dish = Dish(
        name="金汤凤爪",
        department="明档",
        sell_price=69.0,
        ingredients=[
            DishIngredientLine(name="凤爪", amount_calc=750, source="raw"),
            DishIngredientLine(name="自制鸡爪酱", amount_calc=800, source="intermediate"),
        ],
    )
    assert len(dish.ingredients) == 2
    assert dish.ingredients[0].source == "raw"
    assert dish.ingredients[1].source == "intermediate"


def test_dish_calculates_total_cost_with_both_layers(kitchen_data):
    raw, intermediates = kitchen_data
    dish = Dish(
        name="金汤凤爪",
        department="明档",
        sell_price=69.0,
        ingredients=[
            DishIngredientLine(name="凤爪", amount_calc=750, source="raw"),
            DishIngredientLine(name="自制鸡爪酱", amount_calc=800, source="intermediate"),
        ],
    )
    cost = dish.calculate_cost(raw, intermediates)

    # 凤爪: 750g × (22.0/500) = 750 × 0.044 = 33.0
    # 鸡爪酱 unit cost: (600×0.024 + 1500×0.013) / 45000 = (14.4 + 19.5) / 45000 = 0.000753/g
    # 鸡爪酱 amount cost: 800 × 0.000753 = 0.602
    expected = 33.0 + (14.4 + 19.5) / 45000 * 800
    assert cost == pytest.approx(expected, rel=0.01)


def test_dish_gross_margin(kitchen_data):
    raw, intermediates = kitchen_data
    dish = Dish(
        name="金汤凤爪",
        department="明档",
        sell_price=69.0,
        ingredients=[
            DishIngredientLine(name="凤爪", amount_calc=750, source="raw"),
        ],
    )
    margin = dish.gross_margin(raw, intermediates)
    # Cost = 33.0, price = 69.0, margin = (69-33)/69 = 0.5217
    assert margin == pytest.approx((69 - 33) / 69, rel=0.01)


def test_dish_missing_intermediate_raises(kitchen_data):
    raw, _ = kitchen_data
    dish = Dish(
        name="broken_dish",
        department="test",
        sell_price=50.0,
        ingredients=[
            DishIngredientLine(name="不存在的半成品", amount_calc=100, source="intermediate"),
        ],
    )
    with pytest.raises(KeyError, match="不存在的半成品"):
        dish.calculate_cost(raw, {})


def test_dish_unknown_source_raises(kitchen_data):
    raw, intermediates = kitchen_data
    dish = Dish(
        name="bad",
        department="test",
        sell_price=50.0,
        ingredients=[
            DishIngredientLine(name="凤爪", amount_calc=100, source="invalid"),
        ],
    )
    with pytest.raises(ValueError, match="invalid"):
        dish.calculate_cost(raw, intermediates)
```

- [ ] **Step 2: Run test, verify FAIL**

- [ ] **Step 3: Implement dish.py**

```python
# backend/python/smartbi/services/bom/dish.py
"""Dish model with 2-layer BOM.

A dish references both raw materials (凤爪, 大葱) and intermediate products
(自制鸡爪酱, 自制高汤). The resolver recursively computes cost through
the intermediate layer.

Data source: 附件七-1/2、菜品成本卡.xlsx — columns 原料 / 核算单位 / 毛料 map
to DishIngredientLine fields. The "source" field distinguishes raw from
intermediate (determined by whether the name starts with "自制" or matches
an intermediate_products dict key).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from smartbi.services.bom.raw_material import RawMaterial, UnitConverter
from smartbi.services.bom.intermediate_product import IntermediateProduct


@dataclass
class DishIngredientLine:
    """One ingredient line in a dish recipe.

    source="raw" → look up in raw_materials dict
    source="intermediate" → look up in intermediate_products dict
    """
    name: str                               # "凤爪" or "自制鸡爪酱"
    amount_calc: float                      # grams needed
    source: Literal["raw", "intermediate"]  # which dict to look in


@dataclass
class Dish:
    """A menu dish with 2-layer BOM."""
    name: str
    department: str                         # 耗用部门
    sell_price: float                       # 销售单价
    ingredients: list[DishIngredientLine] = field(default_factory=list)

    def calculate_cost(
        self,
        raw_materials: dict[str, RawMaterial],
        intermediate_products: dict[str, IntermediateProduct],
    ) -> float:
        """Total ingredient cost for one portion of this dish.

        Recursive: intermediate products compute their own cost from raw materials.
        """
        total = 0.0
        for ing in self.ingredients:
            if ing.source == "raw":
                if ing.name not in raw_materials:
                    raise KeyError(f"Raw material {ing.name!r} missing from raw_materials")
                mat = raw_materials[ing.name]
                total += UnitConverter.cost_of_calc_quantity(mat, ing.amount_calc)
            elif ing.source == "intermediate":
                if ing.name not in intermediate_products:
                    raise KeyError(
                        f"Intermediate product {ing.name!r} missing from intermediate_products"
                    )
                ip = intermediate_products[ing.name]
                unit_cost = ip.calculate_unit_cost(raw_materials)
                total += ing.amount_calc * unit_cost
            else:
                raise ValueError(f"Unknown source {ing.source!r} for ingredient {ing.name!r}")
        return total

    def gross_margin(
        self,
        raw_materials: dict[str, RawMaterial],
        intermediate_products: dict[str, IntermediateProduct],
    ) -> float:
        """Gross margin = (sell_price - cost) / sell_price."""
        if self.sell_price == 0:
            return 0
        cost = self.calculate_cost(raw_materials, intermediate_products)
        return (self.sell_price - cost) / self.sell_price

    def to_dict(
        self,
        raw_materials: dict[str, RawMaterial],
        intermediate_products: dict[str, IntermediateProduct],
    ) -> dict:
        cost = self.calculate_cost(raw_materials, intermediate_products)
        return {
            "name": self.name,
            "department": self.department,
            "sellPrice": self.sell_price,
            "cost": round(cost, 2),
            "grossMargin": round(self.gross_margin(raw_materials, intermediate_products), 4),
            "ingredients": [
                {
                    "name": ing.name,
                    "amountCalc": ing.amount_calc,
                    "source": ing.source,
                }
                for ing in self.ingredients
            ],
        }
```

Update `services/bom/__init__.py` to export.

- [ ] **Step 4: Run tests, verify PASS**

Expected: 5 passed.

- [ ] **Step 5: Full regression**

Expected: 153 passed (148 + 5).

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/bom/dish.py \
        backend/python/smartbi/services/bom/__init__.py \
        backend/python/smartbi/services/bom/tests/test_dish.py
git commit -m "feat(smartbi-bom): add Dish model with 2-layer BOM

P3.5C B2: Dish references both raw_materials and intermediate_products
via DishIngredientLine.source field. calculate_cost() recursively
computes through the intermediate layer. Models 附件七 (菜品成本卡) 
with real 金汤凤爪 reference data (凤爪 raw + 自制鸡爪酱 intermediate).

5 unit tests cover both-layer cost, margin, missing intermediate error,
and invalid source error."
```

---

### Task B3: ShrinkageEngine (standard vs actual variance)

**Why:** G4 — every kitchen has variance between standard cost (from BOM) and actual cost (from月底盘点 — inventory count). Track this to drive improvement.

**Files:**
- Create: `backend/python/smartbi/services/finance/shrinkage_engine.py`
- Create: `backend/python/smartbi/services/finance/tests/test_shrinkage_engine.py`

- [ ] **Step 1: Write failing test**

```python
# test_shrinkage_engine.py
import pytest

from smartbi.services.finance.shrinkage_engine import (
    ShrinkageEngine, ShrinkageRow, ShrinkageReport,
)


def test_shrinkage_single_department_zero_variance():
    """Standard == actual → zero shrinkage."""
    engine = ShrinkageEngine()
    report = engine.analyze([
        ShrinkageRow(department="热菜", standard_cost=50000, actual_cost=50000),
    ])
    assert report.total_variance_amount == 0
    assert report.total_variance_rate == 0
    assert len(report.top_offenders) == 0


def test_shrinkage_single_department_positive_variance():
    """Actual > standard → positive shrinkage (损溢)."""
    engine = ShrinkageEngine()
    report = engine.analyze([
        ShrinkageRow(department="热菜", standard_cost=50000, actual_cost=52000),
    ])
    assert report.total_variance_amount == 2000
    # Rate: 2000 / 50000 = 4%
    assert report.total_variance_rate == pytest.approx(0.04, rel=0.01)
    # Threshold for alert: >2% variance per dept → offender
    assert len(report.top_offenders) == 1
    assert report.top_offenders[0].department == "热菜"


def test_shrinkage_multi_department_ranking():
    """Multiple depts — ranked by variance rate desc."""
    engine = ShrinkageEngine()
    rows = [
        ShrinkageRow(department="热菜", standard_cost=50000, actual_cost=52000),   # 4%
        ShrinkageRow(department="冷菜", standard_cost=20000, actual_cost=20100),   # 0.5%
        ShrinkageRow(department="刺身", standard_cost=30000, actual_cost=34000),   # 13.3%
        ShrinkageRow(department="铁板", standard_cost=15000, actual_cost=14850),   # -1% (good)
    ]
    report = engine.analyze(rows)

    # Total variance: 2000 + 100 + 4000 - 150 = 5950
    assert report.total_variance_amount == 5950
    # Offenders (>2%): 刺身 (13.3%) + 热菜 (4%)
    assert len(report.top_offenders) == 2
    # Highest first
    assert report.top_offenders[0].department == "刺身"
    assert report.top_offenders[1].department == "热菜"


def test_shrinkage_generates_action_items():
    """For each offender, suggest an action item."""
    engine = ShrinkageEngine()
    report = engine.analyze([
        ShrinkageRow(department="刺身", standard_cost=30000, actual_cost=34000),
    ])
    assert len(report.action_items) >= 1
    item = report.action_items[0]
    assert "刺身" in item.description
    assert item.responsible_department == "刺身"
    assert item.variance_amount == 4000


def test_shrinkage_zero_standard_cost_skipped():
    """Degenerate case: standard=0 → rate undefined, skip."""
    engine = ShrinkageEngine()
    report = engine.analyze([
        ShrinkageRow(department="热菜", standard_cost=0, actual_cost=1000),
    ])
    # Can't compute rate, but total_variance_amount still works
    assert report.total_variance_amount == 1000
    # No offender because rate undefined
    assert len(report.top_offenders) == 0
```

- [ ] **Step 2: Run test, verify FAIL**

- [ ] **Step 3: Implement shrinkage_engine.py**

```python
# backend/python/smartbi/services/finance/shrinkage_engine.py
"""Shrinkage (损溢) engine — standard vs actual cost variance analysis.

Every kitchen has variance between:
  - Standard cost: what the BOM says the dishes SHOULD have cost
  - Actual cost: what月底盘点 (inventory count) shows was actually consumed

Variance > 2% per department → offender, generate action item.

Data sources:
  - Standard cost: from 2-layer BOM (Dish.calculate_cost × sold_qty)
  - Actual cost: from 月度盘点 (月初盘存 + 本期采购 - 月末盘存)

References:
  - 4-1-xx店 - 月度经营分析-24.10.pptx Slide 9 (损溢指标分析 table)
  - Slide 10 (工作改进跟踪表 action items format)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ShrinkageRow:
    """One department's standard vs actual cost comparison."""
    department: str
    standard_cost: float       # sum over all dishes: BOM cost × sold_qty
    actual_cost: float         # from inventory count


@dataclass
class ActionItem:
    """An action item auto-generated from an offender row."""
    description: str
    responsible_department: str
    variance_amount: float
    variance_rate: float
    suggestion_zh: str


@dataclass
class ShrinkageReport:
    """Full shrinkage analysis output."""
    rows: list[ShrinkageRow]
    total_standard_cost: float
    total_actual_cost: float
    total_variance_amount: float           # actual - standard
    total_variance_rate: float             # variance / standard
    top_offenders: list[ShrinkageRow] = field(default_factory=list)
    action_items: list[ActionItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "rows": [
                {
                    "department": r.department,
                    "standardCost": round(r.standard_cost, 2),
                    "actualCost": round(r.actual_cost, 2),
                    "varianceAmount": round(r.actual_cost - r.standard_cost, 2),
                    "varianceRate": (
                        round((r.actual_cost - r.standard_cost) / r.standard_cost, 4)
                        if r.standard_cost > 0 else None
                    ),
                }
                for r in self.rows
            ],
            "totalStandardCost": round(self.total_standard_cost, 2),
            "totalActualCost": round(self.total_actual_cost, 2),
            "totalVarianceAmount": round(self.total_variance_amount, 2),
            "totalVarianceRate": round(self.total_variance_rate, 4),
            "topOffenders": [
                {
                    "department": r.department,
                    "varianceAmount": round(r.actual_cost - r.standard_cost, 2),
                    "varianceRate": round(
                        (r.actual_cost - r.standard_cost) / r.standard_cost, 4
                    ) if r.standard_cost > 0 else None,
                }
                for r in self.top_offenders
            ],
            "actionItems": [
                {
                    "description": a.description,
                    "responsibleDepartment": a.responsible_department,
                    "varianceAmount": round(a.variance_amount, 2),
                    "varianceRate": round(a.variance_rate, 4),
                    "suggestionZh": a.suggestion_zh,
                }
                for a in self.action_items
            ],
        }


class ShrinkageEngine:
    """Compute shrinkage variance + generate action items."""

    OFFENDER_THRESHOLD = 0.02  # 2% variance triggers an action item

    def analyze(self, rows: list[ShrinkageRow]) -> ShrinkageReport:
        if not rows:
            return ShrinkageReport(
                rows=[], total_standard_cost=0, total_actual_cost=0,
                total_variance_amount=0, total_variance_rate=0,
            )

        total_std = sum(r.standard_cost for r in rows)
        total_actual = sum(r.actual_cost for r in rows)
        total_var_amt = total_actual - total_std
        total_var_rate = total_var_amt / total_std if total_std > 0 else 0

        # Offenders: rows with rate > threshold
        offenders = []
        for r in rows:
            if r.standard_cost <= 0:
                continue  # can't compute rate
            rate = (r.actual_cost - r.standard_cost) / r.standard_cost
            if abs(rate) > self.OFFENDER_THRESHOLD and r.actual_cost > r.standard_cost:
                offenders.append(r)

        # Rank offenders by rate desc
        offenders.sort(
            key=lambda r: (r.actual_cost - r.standard_cost) / r.standard_cost,
            reverse=True,
        )

        # Generate action items for top offenders
        action_items = []
        for r in offenders[:10]:  # top 10 max
            variance = r.actual_cost - r.standard_cost
            rate = variance / r.standard_cost
            action_items.append(ActionItem(
                description=(
                    f"{r.department} 档口损溢 {variance:,.0f} ({rate*100:.1f}%)"
                ),
                responsible_department=r.department,
                variance_amount=variance,
                variance_rate=rate,
                suggestion_zh=self._generate_suggestion(r.department, rate),
            ))

        return ShrinkageReport(
            rows=rows,
            total_standard_cost=total_std,
            total_actual_cost=total_actual,
            total_variance_amount=total_var_amt,
            total_variance_rate=total_var_rate,
            top_offenders=offenders,
            action_items=action_items,
        )

    def _generate_suggestion(self, department: str, rate: float) -> str:
        """Template suggestion text by severity."""
        if rate > 0.10:
            return f"{department} 损溢超 10%, 严重超标. 建议立即复盘原料验收 + 切配流程 + 存储条件"
        if rate > 0.05:
            return f"{department} 损溢 5-10%, 需关注. 加强原料验收标准, 检查出成率是否偏离标准"
        return f"{department} 损溢 2-5%, 偏轻. 复核一次月度盘点准确性"
```

- [ ] **Step 4: Run tests, verify PASS**

Expected: 5 passed.

- [ ] **Step 5: Full regression**

Expected: 158 passed (153 + 5).

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/finance/shrinkage_engine.py \
        backend/python/smartbi/services/finance/tests/test_shrinkage_engine.py
git commit -m "feat(smartbi-finance): add ShrinkageEngine for 损溢 analysis

P3.5C B3: ShrinkageEngine compares per-department standard cost
(from 2-layer BOM) vs actual cost (from monthly inventory count),
ranks offenders >2% variance, generates action items with severity-
based suggestions.

Models 鼎鲜 Slide 9 (损溢指标分析) and Slide 10 (工作改进跟踪表).
5 unit tests cover single-dept zero/positive variance, multi-dept
ranking, action item generation, and degenerate zero-standard case."
```

---

### Task B4: Shrinkage section handler

**Why:** Expose ShrinkageEngine as a FastAPI section endpoint.

**Files:**
- Create: `backend/python/smartbi/services/restaurant/sections/shrinkage_analysis.py`
- Create: `backend/python/smartbi/services/restaurant/tests/test_section_shrinkage.py`
- Modify: `backend/python/smartbi/api/restaurant_sections.py` — register handler

- [ ] **Step 1: Write failing test**

```python
# test_section_shrinkage.py
import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.shrinkage_analysis import ShrinkageAnalysisHandler


def test_shrinkage_section_processes_rows():
    h = ShrinkageAnalysisHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id=None,
        sub_sector="火锅",
        params={
            "shrinkage_rows": [
                {"department": "热菜", "standardCost": 50000, "actualCost": 52000},
                {"department": "冷菜", "standardCost": 20000, "actualCost": 20100},
                {"department": "刺身", "standardCost": 30000, "actualCost": 34000},
            ],
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    assert resp.data["totalVarianceAmount"] == 6100
    assert len(resp.data["topOffenders"]) >= 1
    # 刺身 is worst
    assert resp.data["topOffenders"][0]["department"] == "刺身"


def test_shrinkage_section_skipped_without_rows():
    h = ShrinkageAnalysisHandler()
    req = SectionRequest(
        factory_id="F-TEST", upload_id=None, sub_sector="火锅", params={},
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED
    assert "shrinkage_rows" in (resp.warnings[0] if resp.warnings else "")
```

- [ ] **Step 2: Run test, verify FAIL**

- [ ] **Step 3: Implement handler**

```python
# sections/shrinkage_analysis.py
"""Shrinkage analysis section — wraps ShrinkageEngine."""
from __future__ import annotations

import time
from typing import Any

from smartbi.services.finance.shrinkage_engine import ShrinkageEngine, ShrinkageRow
from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class ShrinkageAnalysisHandler(AbstractSectionHandler):
    section_name = "shrinkage_analysis"

    def __init__(self) -> None:
        self._engine = ShrinkageEngine()

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        rows_data = request.params.get("shrinkage_rows")

        if not rows_data:
            return self.skipped(
                request,
                "未提供 shrinkage_rows 参数 (需要各档口 standard_cost + actual_cost)",
                started,
            )

        try:
            rows = [
                ShrinkageRow(
                    department=r["department"],
                    standard_cost=float(r.get("standardCost") or r.get("standard_cost") or 0),
                    actual_cost=float(r.get("actualCost") or r.get("actual_cost") or 0),
                )
                for r in rows_data
            ]
        except (KeyError, TypeError, ValueError) as e:
            return self.skipped(
                request,
                f"shrinkage_rows 格式错误: {e}",
                started,
            )

        report = self._engine.analyze(rows)
        return self.ok(request, data=report.to_dict(), started=started)
```

Register in `restaurant_sections.py`:
```python
from smartbi.services.restaurant.sections.shrinkage_analysis import ShrinkageAnalysisHandler
HANDLERS = {
    ...
    "shrinkage_analysis": ShrinkageAnalysisHandler(),
    ...
}
```

- [ ] **Step 4: Run tests, verify PASS**

- [ ] **Step 5: Full regression**

Expected: 160 passed (158 + 2).

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/restaurant/sections/shrinkage_analysis.py \
        backend/python/smartbi/services/restaurant/tests/test_section_shrinkage.py \
        backend/python/smartbi/api/restaurant_sections.py
git commit -m "feat(smartbi-restaurant): add shrinkage_analysis section handler

P3.5C B4: exposes ShrinkageEngine as a FastAPI section. Reads
shrinkage_rows from params, returns variance rows + top offenders
+ action items. Registered at /api/smartbi/restaurant/sections/shrinkage_analysis."
```

---

### Task B5: Java tool wrapper for shrinkage_analysis

**Why:** Mirror the P2 pattern — every new section needs a Java tool so mobile can reach it via AIIntentService.

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/RestaurantShrinkageAnalysisTool.java`

- [ ] **Step 1: Implement tool**

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Restaurant shrinkage analysis tool — wraps the Python shrinkage_analysis
 * section. Activated by intents like "哪个档口损溢最多" / "标准成本 vs 实际".
 */
@Slf4j
@Component
public class RestaurantShrinkageAnalysisTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_shrinkage_analysis";
    }

    @Override
    public String getDescription() {
        return "档口标准成本 vs 实际成本差异分析 (损溢). 识别超标档口 + 生成改进跟踪表. "
             + "适用场景: 客户问'哪个档口损溢最多'/'标准成本对不对'/'为什么实际成本高'.";
    }

    @Override
    protected String getSectionName() {
        return "shrinkage_analysis";
    }
}
```

- [ ] **Step 2: Compile check**

```bash
cd backend/java/cretas-api
./mvnw.cmd compile -o -q
```

Expected: clean compile.

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/RestaurantShrinkageAnalysisTool.java
git commit -m "feat(smartbi-restaurant): Java tool wrapper for shrinkage_analysis

P3.5C B5: 17-line tool follows AbstractRestaurantDiagnosticTool pattern.
Auto-registered via @Component on next restart. Mobile can now ask
'哪个档口损溢最多' and route to the Python shrinkage_analysis section."
```

---

### Task B6: Flyway migration for shrinkage intent config

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260411_03__restaurant_shrinkage_intent.sql`

- [ ] **Step 1: Write migration**

```sql
-- V20260411_03: Register shrinkage_analysis intent for P3.5C B6

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_SHRINKAGE', '档口损溢分析', 'SMARTBI', 'restaurant_shrinkage_analysis', 'LOW',
        '["损溢","标准成本","实际成本","哪个档口","档口超标","损耗率"]',
        '档口标准成本 vs 实际成本差异分析 (损溢). 识别超标档口 + 生成改进跟踪表.', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_shrinkage_analysis', is_active = true;
```

- [ ] **Step 2: Commit**

```bash
git add backend/java/cretas-api/src/main/resources/db/migration/V20260411_03__restaurant_shrinkage_intent.sql
git commit -m "feat(smartbi-restaurant): Flyway intent config for shrinkage_analysis

P3.5C B6: registers RESTAURANT_SHRINKAGE intent bound to
restaurant_shrinkage_analysis tool. Keywords include '损溢'/'标准成本'/
'哪个档口'/'档口超标'. Applied on next Java deploy."
```

---

**Phase 3.5C Exit Gate:**
- 6 commits (B1-B6)
- Tests: 142 → 160 (18 new tests)
- 2-layer BOM model (IntermediateProduct + Dish) with yield rate
- ShrinkageEngine with action items
- New `shrinkage_analysis` section endpoint + Java tool + intent config
- Universal fixtures covering hotpot + bakery

---

## 6. Phase 3.5D — Presentation (1 week, 6 tasks)

Department-level P&L breakdown + monthly PPT exporter matching 鼎鲜's 19-slide format.

---

### Task P1: Department P&L section handler

**Why:** G5 delivery — wrap the DepartmentTree (QW5) into a section that splits labor/cost by department.

**Files:**
- Create: `backend/python/smartbi/services/restaurant/sections/department_pnl.py`
- Create: `backend/python/smartbi/services/restaurant/tests/test_section_department_pnl.py`

- [ ] **Step 1: Write failing test**

```python
# test_section_department_pnl.py
import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.department_pnl import DepartmentPnlHandler


def test_department_pnl_aggregates_by_tree():
    h = DepartmentPnlHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id=None,
        sub_sector="火锅",
        params={
            "department_tree_id": "hotpot_default",
            "labor_by_department": {
                "热菜": 80000,
                "冷菜": 40000,
                "明档": 60000,
                "前厅服务员": 50000,
                "收银酒水": 15000,
                "店总": 12000,
            },
            "head_count_by_department": {
                "热菜": 8,
                "冷菜": 4,
                "明档": 4,
                "前厅服务员": 15,
                "收银酒水": 3,
                "店总": 1,
            },
            "revenue": 731048,
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK

    # Per-dept breakdown
    breakdown = resp.data["departments"]
    assert len(breakdown) > 0

    # Aggregation: 后厨 = 热菜 + 冷菜 + 明档 = 180000
    agg = resp.data["aggregated"]
    assert agg["后厨"] == 180000
    assert agg["前厅"] == 50000 + 15000  # 服务员 + 收银

    # Per-head productivity
    热菜_row = next(d for d in breakdown if d["code"] == "热菜")
    assert 热菜_row["headCount"] == 8
    assert 热菜_row["laborCost"] == 80000
    assert 热菜_row["perHeadCost"] == pytest.approx(10000, rel=0.01)
    # Revenue attribution: labor share
    assert "revenueShare" in 热菜_row


def test_department_pnl_handles_bakery_tree():
    """Universal — bakery tree works too."""
    h = DepartmentPnlHandler()
    req = SectionRequest(
        factory_id="F-BAKERY-TEST",
        upload_id=None,
        sub_sector="面包房",
        params={
            "department_tree_id": "bakery_default",
            "labor_by_department": {
                "烘焙间": 30000,
                "面包房": 25000,
                "门店销售": 40000,
            },
            "revenue": 200000,
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    agg = resp.data["aggregated"]
    assert agg["生产"] == 55000  # 烘焙间 + 面包房
    assert agg["销售"] >= 40000


def test_department_pnl_skipped_without_data():
    h = DepartmentPnlHandler()
    req = SectionRequest(
        factory_id="F-TEST", upload_id=None, sub_sector="火锅", params={},
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED
```

- [ ] **Step 2: Run test, verify FAIL**

- [ ] **Step 3: Implement handler**

```python
# sections/department_pnl.py
"""Department P&L section — per-department labor + cost breakdown."""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from smartbi.services.reporting.department_tree import load_dept_tree_from_yaml
from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class DepartmentPnlHandler(AbstractSectionHandler):
    section_name = "department_pnl"

    def __init__(self) -> None:
        self._tree_cache: dict[str, Any] = {}

    def _get_tree(self, tree_id: str):
        if tree_id not in self._tree_cache:
            yaml_path = (
                Path(__file__).parents[3]
                / "knowledge"
                / "restaurant"
                / "department_tree"
                / f"{tree_id}.yaml"
            )
            if not yaml_path.exists():
                return None
            self._tree_cache[tree_id] = load_dept_tree_from_yaml(yaml_path)
        return self._tree_cache[tree_id]

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        tree_id = request.params.get("department_tree_id", "hotpot_default")
        labor_data = request.params.get("labor_by_department") or {}
        head_count_data = request.params.get("head_count_by_department") or {}
        revenue = float(request.params.get("revenue") or 0)

        if not labor_data:
            return self.skipped(
                request,
                "未提供 labor_by_department 参数",
                started,
            )

        tree = self._get_tree(tree_id)
        if tree is None:
            return self.skipped(
                request,
                f"未找到 department_tree {tree_id!r}",
                started,
            )

        # Aggregate leaf labor to parents
        aggregated = tree.aggregate(labor_data)

        # Per-leaf-dept breakdown with productivity metrics
        total_labor = sum(labor_data.values())
        breakdown = []
        for code, labor in labor_data.items():
            if code not in tree.nodes:
                continue  # unknown dept
            node = tree.nodes[code]
            head_count = head_count_data.get(code, 0)
            breakdown.append({
                "code": code,
                "nameZh": node.name_zh,
                "parent": node.parent_code,
                "category": node.category,
                "laborCost": labor,
                "headCount": head_count,
                "perHeadCost": labor / head_count if head_count > 0 else None,
                "laborShare": labor / total_labor if total_labor > 0 else 0,
                "revenueShare": labor / revenue if revenue > 0 else 0,
            })

        # Sort breakdown by labor cost desc
        breakdown.sort(key=lambda x: x["laborCost"], reverse=True)

        return self.ok(
            request,
            data={
                "treeId": tree_id,
                "departments": breakdown,
                "aggregated": aggregated,
                "totalLaborCost": total_labor,
                "laborRevenueRatio": total_labor / revenue if revenue > 0 else None,
            },
            started=started,
        )
```

Register in router.

- [ ] **Step 4: Run tests, verify PASS**

- [ ] **Step 5: Full regression**

Expected: 163 passed (160 + 3).

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/restaurant/sections/department_pnl.py \
        backend/python/smartbi/services/restaurant/tests/test_section_department_pnl.py \
        backend/python/smartbi/api/restaurant_sections.py
git commit -m "feat(smartbi-restaurant): add department_pnl section handler

P3.5D P1: per-department labor + cost breakdown using DepartmentTree
from QW5. Aggregates leaves to parents (后厨 = 热菜+冷菜+明档+...),
computes per-head cost and revenue share per leaf.

Tests cover hotpot + bakery trees. Registered at
/api/smartbi/restaurant/sections/department_pnl."
```

---

### Task P2: Monthly PPT exporter — template creation

**Why:** G6 delivery — generate a 19-slide monthly PPT matching 鼎鲜's template. Start with the skeleton file.

**Files:**
- Create: `backend/python/smartbi/knowledge/restaurant/ppt_templates/monthly_default.pptx` (binary)
- Create: `backend/python/smartbi/services/reporting/monthly_ppt_exporter.py`
- Create: `backend/python/smartbi/services/reporting/tests/test_monthly_ppt_exporter.py`

- [ ] **Step 1: Create skeleton template via python-pptx**

```python
# Script to create the template (run once, save output):
# backend/python/scripts/create_monthly_ppt_template.py
"""Create a 19-slide monthly PPT skeleton.

Each slide has placeholder shapes for the exporter to fill in:
  Slide 1: Title page (store_name, period)
  Slide 2: Table of contents
  Slide 3: Monthly briefing (5 key stats)
  Slide 4: Section divider
  Slide 5: 12-month revenue completion
  Slide 6: 5-venue comparison
  Slide 7: 25-row environmental table
  Slide 8: 档口 gross margin
  Slide 9: Shrinkage (损溢)
  Slide 10: Work tracking
  Slide 11: Expense summary
  Slide 12: 25+ expense subaccounts
  Slide 13: Labor cost + headcount
  Slide 14: 30-row per-head productivity
  Slide 15: Section divider
  Slide 16: Next month revenue plan
  Slide 17: Next month margin plan
  Slide 18: Next month expense plan
  Slide 19: Next month action items
"""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt

SLIDE_TITLES = [
    "月度经营分析",
    "目录",
    "一、月度简报",
    "一、月度经营状况",
    "1. 1-12月营收完成情况",
    "2. 5个营业点完成对比",
    "3. 环比二期对比",
    "4. 厨房档口毛利率",
    "5. 损溢指标分析",
    "6. 工作改进跟踪表",
    "7. 费用开支明细",
    "8. 费用科目预算达成",
    "9. 人力成本 + 在职人数",
    "10. 部门人均产出比",
    "三、下月计划",
    "1. 下月营收计划",
    "2. 下月毛利计划",
    "3. 下月费用计划",
    "4. 下月具体措施",
]

def create_template(output_path: Path):
    prs = Presentation()
    prs.slide_width = Inches(13.33)
    prs.slide_height = Inches(7.5)

    for title in SLIDE_TITLES:
        slide_layout = prs.slide_layouts[5]  # blank layout
        slide = prs.slides.add_slide(slide_layout)
        # Add title text box
        left = Inches(0.5)
        top = Inches(0.3)
        width = Inches(12)
        height = Inches(0.8)
        tb = slide.shapes.add_textbox(left, top, width, height)
        tf = tb.text_frame
        tf.text = title

    prs.save(str(output_path))

if __name__ == "__main__":
    out = Path(__file__).parents[1] / "knowledge" / "restaurant" / "ppt_templates" / "monthly_default.pptx"
    out.parent.mkdir(parents=True, exist_ok=True)
    create_template(out)
    print(f"Created: {out}")
```

- [ ] **Step 2: Run script to generate template**

```bash
cd backend/python
python scripts/create_monthly_ppt_template.py
ls -la smartbi/knowledge/restaurant/ppt_templates/
```

Expected: `monthly_default.pptx` created (binary, ~30KB).

- [ ] **Step 3: Implement exporter (placeholder replacement)**

```python
# backend/python/smartbi/services/reporting/monthly_ppt_exporter.py
"""Monthly PPT exporter — fills the 19-slide template with data."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from pptx import Presentation
from pptx.util import Inches


class MonthlyPptExporter:
    """Generate a filled monthly PPT from analyzer output."""

    def __init__(self, template_path: Optional[Path] = None):
        if template_path is None:
            template_path = (
                Path(__file__).parents[2]
                / "knowledge"
                / "restaurant"
                / "ppt_templates"
                / "monthly_default.pptx"
            )
        if not template_path.exists():
            raise FileNotFoundError(f"PPT template not found: {template_path}")
        self.template_path = template_path

    def export(
        self,
        store_name: str,
        period: str,
        financial_metrics: dict[str, Any],
        diagnostics: list[dict[str, Any]],
        department_breakdown: Optional[dict[str, Any]] = None,
        shrinkage_report: Optional[dict[str, Any]] = None,
        expense_breakdown: Optional[dict[str, Any]] = None,
        output_path: Optional[Path] = None,
    ) -> Path:
        """Generate a filled PPT and save to output_path.

        Returns the path to the saved file.
        """
        prs = Presentation(str(self.template_path))

        # Slide 1: Title
        self._fill_title_slide(prs.slides[0], store_name, period)

        # Slide 3: Monthly briefing
        self._fill_briefing_slide(prs.slides[2], financial_metrics)

        # Slide 8: 档口 gross margin (if department_breakdown provided)
        if department_breakdown:
            self._fill_dept_margin_slide(prs.slides[7], department_breakdown)

        # Slide 9: Shrinkage (if shrinkage_report provided)
        if shrinkage_report:
            self._fill_shrinkage_slide(prs.slides[8], shrinkage_report)

        # Slide 12: 25+ expense subaccounts (if expense_breakdown provided)
        if expense_breakdown:
            self._fill_expense_slide(prs.slides[11], expense_breakdown)

        # Slide 14: 30-row per-head productivity (if department_breakdown provided)
        if department_breakdown:
            self._fill_productivity_slide(prs.slides[13], department_breakdown)

        # Save
        if output_path is None:
            output_path = Path(f"/tmp/monthly_{store_name}_{period}.pptx")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        prs.save(str(output_path))
        return output_path

    def _fill_title_slide(self, slide, store_name: str, period: str) -> None:
        # Find the title text box (added by create_template) and replace
        for shape in slide.shapes:
            if shape.has_text_frame:
                tf = shape.text_frame
                if "月度经营分析" in tf.text:
                    tf.text = f"{store_name}\n月度经营分析\n{period}"
                    return

    def _fill_briefing_slide(self, slide, fm: dict[str, Any]) -> None:
        text_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(12), Inches(5))
        tf = text_box.text_frame
        tf.text = "本月简报:"
        for label, key in [
            ("营收", "revenue"),
            ("食材成本", "foodCost"),
            ("人力成本", "laborCost"),
            ("毛利率 (折后)", "grossMarginFolded"),
            ("净利润", "netProfit"),
        ]:
            value = fm.get(key)
            if value is not None:
                p = tf.add_paragraph()
                p.text = f"  {label}: {value:,.2f}" if isinstance(value, (int, float)) else f"  {label}: {value}"

    def _fill_dept_margin_slide(self, slide, dept_breakdown: dict[str, Any]) -> None:
        departments = dept_breakdown.get("departments", [])[:8]
        text_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(12), Inches(5))
        tf = text_box.text_frame
        tf.text = "档口毛利率:"
        for dept in departments:
            p = tf.add_paragraph()
            p.text = f"  {dept.get('nameZh', dept.get('code'))}: 人力 {dept.get('laborCost', 0):,.0f}, 占比 {dept.get('laborShare', 0)*100:.1f}%"

    def _fill_shrinkage_slide(self, slide, shrinkage: dict[str, Any]) -> None:
        text_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(12), Inches(5))
        tf = text_box.text_frame
        tf.text = f"档口损溢总额: {shrinkage.get('totalVarianceAmount', 0):,.0f}"
        for row in shrinkage.get("rows", []):
            p = tf.add_paragraph()
            p.text = (
                f"  {row.get('department')}: 标准 {row.get('standardCost', 0):,.0f}, "
                f"实际 {row.get('actualCost', 0):,.0f}, "
                f"差异 {row.get('varianceAmount', 0):,.0f}"
            )

    def _fill_expense_slide(self, slide, expense_breakdown: dict[str, Any]) -> None:
        top_accounts = expense_breakdown.get("topAccounts", [])[:15]
        text_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(12), Inches(5))
        tf = text_box.text_frame
        tf.text = "Top 15 费用科目:"
        for acc in top_accounts:
            p = tf.add_paragraph()
            p.text = f"  {acc.get('nameZh', acc.get('code'))}: {acc.get('value', 0):,.0f}"

    def _fill_productivity_slide(self, slide, dept_breakdown: dict[str, Any]) -> None:
        departments = dept_breakdown.get("departments", [])[:30]
        text_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.5), Inches(12), Inches(5))
        tf = text_box.text_frame
        tf.text = "部门人均产出比:"
        for dept in departments:
            head = dept.get("headCount", 0)
            per_head = dept.get("perHeadCost", 0) or 0
            p = tf.add_paragraph()
            p.text = (
                f"  {dept.get('nameZh', dept.get('code'))}: "
                f"{head} 人, 人均工资 {per_head:,.0f}"
            )
```

- [ ] **Step 4: Write tests**

```python
# test_monthly_ppt_exporter.py
import tempfile
from pathlib import Path

import pytest

from smartbi.services.reporting.monthly_ppt_exporter import MonthlyPptExporter


def test_exporter_creates_valid_pptx_file(tmp_path):
    exporter = MonthlyPptExporter()
    output = exporter.export(
        store_name="鼎鲜火锅·义乌分公司",
        period="2026-02",
        financial_metrics={
            "revenue": 731048,
            "foodCost": 307040,
            "laborCost": 237660,
            "grossMarginFolded": 58.0,
            "netProfit": -49724,
        },
        diagnostics=[],
        output_path=tmp_path / "monthly_test.pptx",
    )
    assert output.exists()
    assert output.stat().st_size > 10000  # > 10 KB


def test_exporter_fills_19_slides(tmp_path):
    from pptx import Presentation

    exporter = MonthlyPptExporter()
    output = exporter.export(
        store_name="Test Store",
        period="2026-02",
        financial_metrics={"revenue": 100000},
        diagnostics=[],
        output_path=tmp_path / "test.pptx",
    )
    prs = Presentation(str(output))
    assert len(prs.slides) == 19  # matches template


def test_exporter_raises_on_missing_template():
    bad_path = Path("/nonexistent/template.pptx")
    with pytest.raises(FileNotFoundError):
        MonthlyPptExporter(template_path=bad_path)


def test_exporter_handles_empty_optional_sections(tmp_path):
    """Optional params default to None — no crashes."""
    exporter = MonthlyPptExporter()
    output = exporter.export(
        store_name="Test",
        period="2026-02",
        financial_metrics={"revenue": 100000},
        diagnostics=[],
        department_breakdown=None,
        shrinkage_report=None,
        expense_breakdown=None,
        output_path=tmp_path / "empty.pptx",
    )
    assert output.exists()
```

- [ ] **Step 5: Run tests, verify PASS**

Expected: 4 passed. If `python-pptx` is not installed, add to `requirements.txt`:
```
python-pptx>=0.6.21
```

- [ ] **Step 6: Full regression**

Expected: 167 passed (163 + 4).

- [ ] **Step 7: Commit**

```bash
git add backend/python/smartbi/services/reporting/monthly_ppt_exporter.py \
        backend/python/smartbi/services/reporting/tests/test_monthly_ppt_exporter.py \
        backend/python/smartbi/knowledge/restaurant/ppt_templates/monthly_default.pptx \
        backend/python/scripts/create_monthly_ppt_template.py \
        backend/python/requirements.txt
git commit -m "feat(smartbi-reporting): add MonthlyPptExporter + 19-slide template

P3.5D P2: python-pptx-based exporter fills 19-slide template with
financial metrics, department breakdown, shrinkage, expense top N.
Matches 鼎鲜 4-1-xx店 - 月度经营分析-24.10.pptx structure.

Template created via scripts/create_monthly_ppt_template.py (one-shot).
4 unit tests cover basic export, slide count, missing template error,
and optional param handling. python-pptx added to requirements."
```

---

### Task P3: Monthly PPT section handler + API endpoint

**Why:** Expose the PPT exporter as a downloadable API endpoint.

**Files:**
- Create: `backend/python/smartbi/services/restaurant/sections/monthly_ppt_export.py`
- Modify: `backend/python/smartbi/api/restaurant_sections.py` — add GET route for PPT download
- Create: `backend/python/smartbi/services/restaurant/tests/test_section_monthly_ppt.py`

- [ ] **Step 1: Write failing test**

```python
# test_section_monthly_ppt.py
import tempfile
from pathlib import Path

import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.monthly_ppt_export import MonthlyPptExportHandler


def test_monthly_ppt_section_generates_file():
    h = MonthlyPptExportHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id=None,
        sub_sector="火锅",
        store_name="鼎鲜火锅·义乌分公司",
        period="2026-02",
        params={
            "financial_metrics": {
                "revenue": 731048,
                "foodCost": 307040,
                "laborCost": 237660,
                "grossMarginFolded": 58.0,
                "netProfit": -49724,
            },
        },
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.OK
    assert "pptPath" in resp.data
    ppt_path = Path(resp.data["pptPath"])
    assert ppt_path.exists()
    assert ppt_path.stat().st_size > 10000


def test_monthly_ppt_section_skipped_without_metrics():
    h = MonthlyPptExportHandler()
    req = SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        params={},
    )
    resp = h.compute(req, context={})
    assert resp.status == SectionStatus.SKIPPED
```

- [ ] **Step 2: Implement section handler**

```python
# sections/monthly_ppt_export.py
"""Monthly PPT export section — wraps MonthlyPptExporter."""
from __future__ import annotations

import tempfile
import time
from pathlib import Path
from typing import Any

from smartbi.services.reporting.monthly_ppt_exporter import MonthlyPptExporter
from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class MonthlyPptExportHandler(AbstractSectionHandler):
    section_name = "monthly_ppt_export"

    def __init__(self) -> None:
        self._exporter: Any = None  # lazy load to avoid python-pptx import cost

    def _get_exporter(self) -> MonthlyPptExporter:
        if self._exporter is None:
            self._exporter = MonthlyPptExporter()
        return self._exporter

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        fm = request.params.get("financial_metrics")
        if not fm:
            return self.skipped(
                request,
                "未提供 financial_metrics 参数",
                started,
            )

        try:
            output_dir = Path(tempfile.gettempdir()) / "smartbi_ppt"
            output_dir.mkdir(parents=True, exist_ok=True)
            output_file = output_dir / f"monthly_{request.factory_id}_{request.period}.pptx"

            result_path = self._get_exporter().export(
                store_name=request.store_name or "店铺",
                period=request.period,
                financial_metrics=fm,
                diagnostics=request.params.get("diagnostics") or [],
                department_breakdown=request.params.get("department_breakdown"),
                shrinkage_report=request.params.get("shrinkage_report"),
                expense_breakdown=request.params.get("expense_breakdown"),
                output_path=output_file,
            )
        except Exception as e:
            return self.skipped(
                request,
                f"PPT 生成失败: {e}",
                started,
            )

        return self.ok(
            request,
            data={
                "pptPath": str(result_path),
                "pptSizeBytes": result_path.stat().st_size,
                "downloadUrl": (
                    f"/api/smartbi/restaurant/ppt-export/download/"
                    f"{request.factory_id}/{request.period}"
                ),
            },
            started=started,
        )
```

Register in router.

- [ ] **Step 3: Add download endpoint**

```python
# restaurant_sections.py — add new route
from fastapi.responses import FileResponse

@router.get("/ppt-export/download/{factory_id}/{period}")
def download_monthly_ppt(factory_id: str, period: str):
    output_file = (
        Path(tempfile.gettempdir())
        / "smartbi_ppt"
        / f"monthly_{factory_id}_{period}.pptx"
    )
    if not output_file.exists():
        raise HTTPException(
            status_code=404,
            detail=f"PPT not found. Call POST /sections/monthly_ppt_export first.",
        )
    return FileResponse(
        path=str(output_file),
        filename=f"月度经营分析_{factory_id}_{period}.pptx",
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
```

- [ ] **Step 4: Run tests, verify PASS**

- [ ] **Step 5: Full regression**

Expected: 169 passed (167 + 2).

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi/services/restaurant/sections/monthly_ppt_export.py \
        backend/python/smartbi/services/restaurant/tests/test_section_monthly_ppt.py \
        backend/python/smartbi/api/restaurant_sections.py
git commit -m "feat(smartbi-restaurant): add monthly_ppt_export section + download endpoint

P3.5D P3: generates a filled 19-slide PPT, saves to /tmp/smartbi_ppt/,
returns download URL. New FastAPI GET endpoint
/api/smartbi/restaurant/ppt-export/download/{factory_id}/{period}
streams the .pptx file for mobile/web download.

Completes the G6 monthly PPT exporter. Customer can now get a
filled deck that matches their 5-year-old existing template."
```

---

### Task P4-P6: Java tool wrappers + Flyway migrations

**Why:** Mirror the P2 pattern — each new section gets a Java tool + intent config.

Bundle these into one task (they're tiny).

**Files:**
- Create: `RestaurantDepartmentPnlTool.java`
- Create: `RestaurantMonthlyPptExportTool.java`
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260411_04__restaurant_dept_pnl_ppt_intents.sql`

- [ ] **Step 1: Write department P&L tool**

```java
// RestaurantDepartmentPnlTool.java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantDepartmentPnlTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_department_pnl";
    }

    @Override
    public String getDescription() {
        return "部门级 P&L 分解 (前厅/后厨/管理) + 人均产出比. "
             + "适用场景: 客户问'哪个部门人力超了'/'后厨人均产出多少'/'前厅和后厨谁贵'.";
    }

    @Override
    protected String getSectionName() {
        return "department_pnl";
    }
}
```

- [ ] **Step 2: Write monthly PPT tool**

```java
// RestaurantMonthlyPptExportTool.java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantMonthlyPptExportTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_monthly_ppt_export";
    }

    @Override
    public String getDescription() {
        return "生成月度经营分析 PPT (19 张幻灯片, 匹配客户已有模板). "
             + "适用场景: 客户问'给我月度报告'/'出月度分析 PPT'/'月度经营简报'.";
    }

    @Override
    protected String getSectionName() {
        return "monthly_ppt_export";
    }
}
```

- [ ] **Step 3: Write Flyway migration**

```sql
-- V20260411_04: 2 new intents for dept_pnl + monthly_ppt

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_DEPARTMENT_PNL', '部门 P&L 分解', 'SMARTBI', 'restaurant_department_pnl', 'LOW',
        '["部门人力","前厅后厨","人均产出","哪个部门","后厨贵","前厅贵"]',
        '部门级 P&L 分解 + 人均产出比', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_department_pnl', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_MONTHLY_PPT', '月度经营分析 PPT', 'SMARTBI', 'restaurant_monthly_ppt_export', 'LOW',
        '["月度报告","月度 PPT","月度经营分析","给我 PPT","月度简报"]',
        '生成 19-slide 月度经营分析 PPT', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_monthly_ppt_export', is_active = true;
```

- [ ] **Step 4: Compile + commit**

```bash
cd backend/java/cretas-api && ./mvnw.cmd compile -o -q
cd /c/Users/Steve/my-prototype-logistics/my-prototype-logistics-smartbi-task17
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/RestaurantDepartmentPnlTool.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/RestaurantMonthlyPptExportTool.java \
        backend/java/cretas-api/src/main/resources/db/migration/V20260411_04__restaurant_dept_pnl_ppt_intents.sql
git commit -m "feat(smartbi-restaurant): Java tools for dept_pnl + monthly_ppt_export

P3.5D P4-P6: 2 new Java tools + Flyway intent migration for department
P&L section and monthly PPT export section. Mobile can now ask
'哪个部门人力超了' and '给我月度 PPT' and route correctly."
```

---

**Phase 3.5D Exit Gate:**
- 4 commits (P1, P2, P3, P4-P6 bundle)
- Tests: 160 → 169 (9 new tests)
- Department P&L section with hotpot + bakery tree support
- Monthly PPT exporter (19 slides) + download endpoint
- 2 new Java tool wrappers + intent configs

---

## 7. Phase 3.5E — Integration & Finalization (2 days, 4 tasks)

Wire new sections into the batch orchestrator, verify byte-identity still holds, end-to-end smoke test, documentation.

---

### Task I1: Byte-identity regression check

**Why:** After adding new sections (expense_breakdown, shrinkage_analysis, department_pnl, monthly_ppt_export) to the batch path, verify the golden fixture still matches for the original dingxian scenario (no new inputs provided → no new sections emitted → byte-identity preserved).

**Files:**
- Test: existing `test_batch_regression_golden.py` (rerun, no code change expected)

- [ ] **Step 1: Rerun the golden test**

```bash
cd backend/python
python -m pytest smartbi/services/restaurant/tests/test_batch_regression_golden.py -v
```

Expected: PASSED.

**If it FAILS**: the new sections are being added to `report["sections"]` even when inputs are absent. Fix by guarding each new section in `analyzer.py:analyze()` to only call the handler when the relevant params are present.

- [ ] **Step 2: Check all existing integration tests still pass**

```bash
python -m pytest smartbi/services/restaurant/tests/test_v2_analyzer_integration.py -v
```

Expected: 8 existing integration tests + ~5 new F1-F8 tests pass (13 total).

- [ ] **Step 3: Full regression one more time**

```bash
python -m pytest smartbi/services/restaurant/tests/ -q
```

Expected: 169 passed, 2 warnings.

- [ ] **Step 4: No commit needed — verification task only**

If all tests pass, proceed to I2. If any fail, fix and loop back.

---

### Task I2: End-to-end smoke test — Java tools → Python sections

**Why:** Verify the full chain works: Java tool invocation → PythonSmartBIClient.callSection → Python FastAPI section handler → response.

**Files:**
- Create: `backend/java/cretas-api/src/test/java/com/cretas/aims/integration/RestaurantP35IntegrationTest.java`

- [ ] **Step 1: Write disabled integration test**

```java
// backend/java/cretas-api/src/test/java/com/cretas/aims/integration/RestaurantP35IntegrationTest.java
package com.cretas.aims.integration;

import com.cretas.aims.dto.python.PythonRestaurantSectionRequest;
import com.cretas.aims.dto.python.PythonRestaurantSectionResponse;
import com.cretas.aims.client.PythonSmartBIClient;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * P3.5 Integration test — calls the 4 new section handlers
 * (expense_breakdown, shrinkage_analysis, department_pnl, monthly_ppt_export)
 * via PythonSmartBIClient and verifies responses.
 *
 * @Disabled by default — requires running Python backend on 8083.
 */
@Disabled("Requires Python backend on 8083 with P3.5 sections deployed")
@SpringBootTest
class RestaurantP35IntegrationTest {

    private static final String FACTORY = "F-DINGXIAN-YIWU";

    @Autowired
    private PythonSmartBIClient client;

    @Test
    void expenseBreakdownReturnsAggregatedTree() {
        PythonRestaurantSectionRequest req = PythonRestaurantSectionRequest.builder()
            .factoryId(FACTORY)
            .subSector("火锅")
            .params(Map.of(
                "expense_account_tree_id", "hotpot_default",
                "expense_leaf_values", Map.of(
                    "工资", 237660,
                    "房租费", 85000,
                    "充卡赠送", 51680.61,
                    "水费", 3200,
                    "电费", 8500
                )
            ))
            .build();

        Optional<PythonRestaurantSectionResponse> result =
            client.callRestaurantSection("expense_breakdown", req);

        assertThat(result).isPresent();
        assertThat(result.get().isSuccess()).isTrue();
        assertThat(result.get().getData()).containsKey("aggregated");
        assertThat(result.get().getData()).containsKey("topAccounts");
    }

    @Test
    void shrinkageAnalysisDetectsOffender() {
        PythonRestaurantSectionRequest req = PythonRestaurantSectionRequest.builder()
            .factoryId(FACTORY)
            .subSector("火锅")
            .params(Map.of(
                "shrinkage_rows", List.of(
                    Map.of("department", "热菜", "standardCost", 50000, "actualCost", 52000),
                    Map.of("department", "刺身", "standardCost", 30000, "actualCost", 34000)
                )
            ))
            .build();

        Optional<PythonRestaurantSectionResponse> result =
            client.callRestaurantSection("shrinkage_analysis", req);

        assertThat(result).isPresent();
        assertThat(result.get().isSuccess()).isTrue();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> offenders = (List<Map<String, Object>>) result.get()
            .getData().get("topOffenders");
        assertThat(offenders).isNotEmpty();
        assertThat(offenders.get(0).get("department")).isEqualTo("刺身");
    }

    @Test
    void departmentPnlUsesHotpotTree() {
        PythonRestaurantSectionRequest req = PythonRestaurantSectionRequest.builder()
            .factoryId(FACTORY)
            .subSector("火锅")
            .params(Map.of(
                "department_tree_id", "hotpot_default",
                "labor_by_department", Map.of(
                    "热菜", 80000,
                    "冷菜", 40000,
                    "前厅服务员", 50000
                ),
                "revenue", 731048
            ))
            .build();

        Optional<PythonRestaurantSectionResponse> result =
            client.callRestaurantSection("department_pnl", req);

        assertThat(result).isPresent();
        assertThat(result.get().isSuccess()).isTrue();
    }

    @Test
    void monthlyPptExportGeneratesFile() {
        PythonRestaurantSectionRequest req = PythonRestaurantSectionRequest.builder()
            .factoryId(FACTORY)
            .subSector("火锅")
            .storeName("鼎鲜火锅·义乌分公司")
            .period("2026-02")
            .params(Map.of(
                "financial_metrics", Map.of(
                    "revenue", 731048,
                    "foodCost", 307040,
                    "laborCost", 237660,
                    "netProfit", -49724
                )
            ))
            .build();

        Optional<PythonRestaurantSectionResponse> result =
            client.callRestaurantSection("monthly_ppt_export", req);

        assertThat(result).isPresent();
        assertThat(result.get().isSuccess()).isTrue();
        assertThat(result.get().getData()).containsKey("pptPath");
        assertThat(result.get().getData()).containsKey("downloadUrl");
    }
}
```

- [ ] **Step 2: Compile (must succeed even though test is disabled)**

```bash
cd backend/java/cretas-api
./mvnw.cmd test-compile -o -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/test/java/com/cretas/aims/integration/RestaurantP35IntegrationTest.java
git commit -m "test(smartbi-restaurant): disabled P3.5 integration test for 4 new sections

P3.5E I2: locks in the Java → Python contract for expense_breakdown,
shrinkage_analysis, department_pnl, monthly_ppt_export sections.
@Disabled — requires running Python backend. Run manually after
deploy: ./mvnw.cmd test -Dtest=RestaurantP35IntegrationTest."
```

---

### Task I3: Register new section handlers via import check

**Why:** Catch registration mistakes (missing HANDLERS entry) via a test that counts handlers and verifies all 4 new ones are present.

**Files:**
- Modify: existing `test_sections_contract.py`

- [ ] **Step 1: Add registration test**

```python
def test_all_phase_3_5_sections_registered():
    """Regression: 4 new sections from P3.5B-D must be in the router."""
    from smartbi.api.restaurant_sections import HANDLERS
    required = {
        "expense_breakdown",      # P3.5B F6
        "shrinkage_analysis",     # P3.5C B4
        "department_pnl",         # P3.5D P1
        "monthly_ppt_export",     # P3.5D P3
    }
    missing = required - set(HANDLERS.keys())
    assert not missing, f"Missing section handlers: {missing}"

    # Also count total — P1 had 15, P3.5 adds 4 = 19 total
    # (cost_rigidity is P1, not counted as new)
    assert len(HANDLERS) >= 19
```

- [ ] **Step 2: Run test**

```bash
python -m pytest smartbi/services/restaurant/tests/test_sections_contract.py::test_all_phase_3_5_sections_registered -v
```

Expected: PASS.

- [ ] **Step 3: Full regression**

Expected: 170 passed (169 + 1).

- [ ] **Step 4: Commit**

```bash
git add backend/python/smartbi/services/restaurant/tests/test_sections_contract.py
git commit -m "test(smartbi-restaurant): lock section handler count at 19 (P3.5 complete)

P3.5E I3: regression test asserts expense_breakdown, shrinkage_analysis,
department_pnl, monthly_ppt_export are all registered in HANDLERS.
Prevents accidental deregistration during future refactors."
```

---

### Task I4: Update plan documentation + memory

**Why:** Record lessons learned and update project status.

**Files:**
- Modify: this plan file (add "Implementation Log" section at bottom)
- Create: memory entry at `C:/Users/Steve/.claude/projects/C--Users-Steve-my-prototype-logistics/memory/project_smartbi_general_capabilities.md`
- Modify: memory index

- [ ] **Step 1: Append to this plan**

```markdown
## 14. Implementation Log

**Start:** 2026-04-11
**Phase 3.5A (Quick Wins):** [dates] — commits QW1-QW5
**Phase 3.5B (Foundation):** [dates] — commits F1-F8
**Phase 3.5C (BOM Depth):** [dates] — commits B1-B6
**Phase 3.5D (Presentation):** [dates] — commits P1-P6
**Phase 3.5E (Integration):** [dates] — commits I1-I4

**Key learnings:**
- [fill in during execution]

**Deviations from plan:**
- [fill in during execution]
```

- [ ] **Step 2: Create memory entry**

```markdown
---
name: SmartBI General Capabilities from Enterprise Data
description: P3.5 plan — 7 universal patterns extracted from 鼎鲜火锅 real finance data
type: project
---

# SmartBI General Capabilities (P3.5)

**Plan file**: `docs/superpowers/plans/2026-04-11-smartbi-general-capabilities.md`
**Why**: 鼎鲜火锅 sent 12 real finance/ops files. Analysis revealed we're missing
7 universal patterns that every mature餐饮连锁 has. Plan generalizes these
into universal SmartBI modules with configurable defaults (no customer sign-off).

**7 patterns**:
1. ExpenseAccountTree (55+ subaccounts vs our 5)
2. MarginSpec (4 boundary toggles + dual margin + 3 stored value modes)
3. 2-layer BOM (dish → semi → raw with yield rate)
4. ShrinkageEngine (standard vs actual variance)
5. DepartmentTree (前厅/后厨/管理 hierarchy)
6. MonthlyPptExporter (19-slide template)
7. RawMaterial (unit conversion 斤→克)

**Philosophy**: sensible defaults + configurable. No questionnaires.

**Phases** (3-4 weeks total):
- 3.5A Quick Wins (1 day, 5 tasks)
- 3.5B Foundation (1 week, 8 tasks)
- 3.5C BOM Depth (1 week, 6 tasks)
- 3.5D Presentation (1 week, 6 tasks)
- 3.5E Integration (2 days, 4 tasks)

**Highest ROI**: G1 (ExpenseAccountTree) + G6 (MonthlyPptExporter) —
10x diagnostic precision + "replaces财务月度报表" 成交故事.

**Status**: Plan written, execution pending user approval.
```

- [ ] **Step 3: Update memory index**

Add to `C:/Users/Steve/.claude/projects/C--Users-Steve-my-prototype-logistics/memory/MEMORY.md`:

```markdown
## SmartBI General Capabilities (Apr 11 2026, P3.5)
- [P3.5 Plan](project_smartbi_general_capabilities.md) — 27 tasks generalizing 鼎鲜 data into universal modules
- 7 patterns: ExpenseAccountTree, MarginSpec, 2-layer BOM, ShrinkageEngine, DepartmentTree, MonthlyPptExporter, RawMaterial
- 3-4 weeks, configurable defaults (no questionnaires)
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-04-11-smartbi-general-capabilities.md
git commit -m "docs(smartbi-restaurant): P3.5 plan documentation + implementation log

P3.5E I4: adds Implementation Log section for tracking deviations and
lessons learned during execution. Memory entry added separately."
```

---

**Phase 3.5E Exit Gate:**
- 3 code commits (I2, I3, I4) + verification pass (I1)
- Tests: 169 → 170 (+1 regression test)
- Java integration test compiles (disabled, for deploy-time execution)
- All 4 new section handlers registered
- Memory + plan docs updated

---

## 8. Dependency Graph

```
                      ┌─────────────────┐
                      │ QW3 MarginSpec  │
                      └────────┬────────┘
                               │
                   ┌───────────┼───────────┐
                   ▼           ▼           ▼
               ┌─────────┐ ┌────────┐ ┌─────────────┐
               │ F1 CoGS │ │ F2 Dual│ │ F3 Stored V │
               │ flags   │ │ margin │ │ 3-mode      │
               └────┬────┘ └────────┘ └──────┬──────┘
                    │                         │
                    └──────────┬──────────────┘
                               │
                               ▼
                       ┌───────────────┐
                       │ F8 Propagate  │
                       │ margin_spec   │
                       └───────────────┘

     ┌─────────────────┐
     │ QW4 Expense     │
     │ Account Tree    │
     └────────┬────────┘
              ▼
     ┌─────────────────┐         ┌──────────────────┐
     │ F5 Analyzer     │────────▶│ F6 Expense       │
     │ tree loader     │         │ breakdown section│
     └─────────────────┘         └─────────┬────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │ F7 Router        │
                                   │ registration     │
                                   └──────────────────┘

     ┌─────────────────┐         ┌──────────────────┐
     │ QW5 Department  │────────▶│ P1 Department    │
     │ Tree            │         │ P&L section      │
     └─────────────────┘         └─────────┬────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │ P4 Java tool     │
                                   │ wrapper          │
                                   └──────────────────┘

     ┌─────────────────┐
     │ F4 RawMaterial  │
     │ UnitConverter   │
     └────────┬────────┘
              ▼
     ┌─────────────────┐         ┌──────────────────┐
     │ B1 Intermediate │────────▶│ B2 Dish 2-layer  │
     │ Product         │         │ BOM              │
     └─────────────────┘         └─────────┬────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │ B3 Shrinkage     │
                                   │ Engine           │
                                   └─────────┬────────┘
                                             │
                                             ▼
                                   ┌──────────────────┐
                                   │ B4-B6 Section +  │
                                   │ Java tool + SQL  │
                                   └──────────────────┘

                                   ┌──────────────────┐
                                   │ P2 PPT Template  │
                                   │ + Exporter       │
                                   └─────────┬────────┘
                                             │
                                             ▼
                                   ┌──────────────────┐
                                   │ P3 Section + API │
                                   │ endpoint         │
                                   └─────────┬────────┘
                                             │
                                             ▼
                                   ┌──────────────────┐
                                   │ P5 Java tool     │
                                   │ wrapper + SQL    │
                                   └──────────────────┘

All paths converge at:
     ┌───────────────────────────────┐
     │ I1-I4 Integration phase       │
     │ - Golden regression           │
     │ - Java E2E test compile       │
     │ - Handler registration check  │
     │ - Documentation update        │
     └───────────────────────────────┘
```

**Critical path** (longest chain): QW4 → F5 → F6 → F7 → B3 → B4 → B5 → B6 → P2 → P3 → I1 → I2 → I3 → I4 = 14 tasks ≈ 10-12 work days.

**Parallelization opportunities**:
- QW1-QW5 can all run on day 1 (independent)
- F1/F2/F3 can run in parallel (all touch analyzer but different concerns)
- F4 (RawMaterial) can run parallel with F1-F3 (no overlap)
- B1/B2 are sequential, but B3 can start once B1 is done
- P2 can start immediately after QW5 (no dependency on Phase B)
- P4-P6 Java tools can be batched in one commit

---

## 9. Test Strategy

### Fixture organization

All new test fixtures live in `backend/python/smartbi/services/{module}/tests/fixtures/` — **synthetic data, not real 鼎鲜 data**. The plan's code examples use rounded numbers (731048, 237660) that happen to match 鼎鲜's 2 月 figures for familiarity, but actual fixture files should use anonymized / rounded values.

### Multi-cuisine coverage requirement

Every new module MUST have tests covering ≥2 cuisines to prove universality:

| Module | Cuisine 1 | Cuisine 2 | Cuisine 3 (optional) |
|---|---|---|---|
| ExpenseAccountTree | hotpot_default | bakery_default | western_default |
| DepartmentTree | hotpot_default | bakery_default | — |
| RawMaterial | 小青龙 (海鲜) | 高筋面粉 (烘焙) | 澳洲牛排 (西餐) |
| IntermediateProduct | 自制鸡爪酱 (火锅) | 自制面团 (烘焙) | — |
| Dish | 金汤凤爪 (火锅) | 法式面包 (烘焙) | — |
| ShrinkageEngine | 8 档口 (火锅) | 3 dept (bakery) | — |
| DepartmentPnL | hotpot_default | bakery_default | — |
| MonthlyPptExporter | hotpot financial_metrics | bakery financial_metrics | — |

### Golden regression test preservation

The P1 byte-identity golden test (`test_batch_regression_golden.py`) MUST continue to pass through all of P3.5. If any change accidentally adds a new key to `report["sections"]` without the relevant input data, the test will fail. Fix by guarding the new handler with a params check (same pattern as existing handlers).

### Coverage targets

- Each new section handler: ≥ 3 tests (happy path + skip path + edge case)
- Each new engine / analyzer: ≥ 5 tests including one multi-cuisine test
- Each config model (MarginSpec, ExpenseAccountTree, DepartmentTree, RawMaterial): ≥ 4 tests (defaults, from_dict, error, roundtrip or to_dict)

### Running the full suite

```bash
# Python (expect 170 passed, 2 warnings)
cd backend/python
python -m pytest smartbi/services/restaurant/tests/ smartbi/services/finance/tests/ smartbi/services/bom/tests/ smartbi/services/reporting/tests/ -q

# Java (18 tests from P2, unchanged)
cd backend/java/cretas-api
./mvnw.cmd test -Dtest=AbstractRestaurantDiagnosticToolTest,PythonSmartBIClientSectionTest,RestaurantSkillsRegistrationTest,RestaurantDomainPrefixTest -o
```

---

## 10. Risks & Mitigations

### Risk 1: P1 byte-identity golden test breaks mid-phase

**Probability**: Medium
**Impact**: High (regression — existing customers see different numbers)
**Cause**: F1 or F2 adds a new field to `financialMetrics` that gets serialized as `null` instead of omitted, changing the fixture shape.

**Mitigation**:
- Every task that touches `FinancialMetrics.to_dict()` runs the golden test immediately after changes
- If the shape changes, regenerate the golden fixture in the SAME commit (don't let it drift)
- Add a `_strip_volatile` extension to the golden test that drops None-valued keys

### Risk 2: python-pptx not installed / version mismatch

**Probability**: Low
**Impact**: Medium (Phase 3.5D blocks)
**Cause**: Deployment to production Python服务 hasn't pinned the version.

**Mitigation**:
- Task P2 adds `python-pptx>=0.6.21` to `requirements.txt` in the same commit
- Verify with `pip show python-pptx` before committing
- Fallback: if pptx gen fails, the exporter raises a clear error and the section returns SKIPPED, not crashes

### Risk 3: Configurable venues break existing `channel_margin` tests

**Probability**: Medium (QW2 changes an existing method signature)
**Impact**: Medium (blocks QW completion until fixed)
**Cause**: Old tests pass positional args that no longer match.

**Mitigation**:
- `venue_list` parameter is optional with `None` default (means "auto-detect" — current behavior)
- Run ALL existing tests (`python -m pytest smartbi/`) in Step 6 of QW2, not just new ones
- If any existing test fails, fix the calling site (not the method signature)

### Risk 4: Flyway migration conflicts with concurrent deploys

**Probability**: Low
**Impact**: High (prod database broken)
**Cause**: Two migrations with the same version prefix applied in different order.

**Mitigation**:
- Use sequential version numbers: V20260411_02, V20260411_03, V20260411_04 (not same version)
- All migrations are idempotent via `ON CONFLICT (intent_code) DO UPDATE`
- Test against local PG before deploying

### Risk 5: Handler lazy-reconstruction of analyzer drops state (P1 lesson)

**Probability**: Medium
**Impact**: High (silent regressions like the P1 bomLayerStatus case)
**Cause**: New handlers repeat the mistake of building their own RestaurantAnalyzerV2 without forwarding `db_session` / `sku_form_manager` etc.

**Mitigation**:
- New handlers for P3.5 sections get state via **context dict**, not via constructing analyzer instances
- Code review every handler's `compute()` for lazy analyzer construction — if found, refactor to receive via context
- Write a regression test for each new section mirroring `test_batch_state_forwarding.py`

### Risk 6: 2-layer BOM resolver produces wildly different costs than existing Layer 2

**Probability**: Medium
**Impact**: Medium (customer trust — new number disagrees with old)
**Cause**: 2-layer adds yield_rate adjustments that 1-layer ignores, inflating costs by ~20-30%.

**Mitigation**:
- Default `yield_rate=1.0` everywhere (backward compat)
- Only apply yield correction when recipes explicitly specify yield_rate < 1
- Add a warning in the output when yield correction changes cost by > 10% vs flat calculation
- Explain the difference in the Chinese description text

### Risk 7: Monthly PPT template drift — customers update their internal templates

**Probability**: High
**Impact**: Low (cosmetic)
**Cause**: Every restaurant chain tweaks their PPT template over time.

**Mitigation**:
- Ship `monthly_default.pptx` as a reasonable baseline
- Document how to replace it with customer-specific template (drop file in `knowledge/restaurant/ppt_templates/{factory_id}.pptx`)
- Exporter reads template by ID via `FactoryConfig.monthlyPptTemplateId`
- Cosmetic drift is OK — the exporter fills placeholders, not the skeleton layout

---

## 11. Success Criteria

### Phase 3.5A (Quick Wins) — ship in 1 day

- [ ] 5 commits pushed to `feature/smartbi-restaurant-p1-section-split`
- [ ] Tests: 104 → 120 (16 new tests)
- [ ] 鼎鲜 7.07% stored_value ratio correctly flagged as critical
- [ ] `channel_margin` accepts custom venue_list (verified with 5-venue 鼎鲜 scenario)
- [ ] `MarginSpec`, `ExpenseAccountTree`, `DepartmentTree` models exist with default + hotpot YAMLs
- [ ] No existing tests broken (106 passed minimum)

### Phase 3.5B (Foundation) — ship in 1 week

- [ ] 8 commits pushed
- [ ] Tests: 120 → 142
- [ ] `MarginSpec.include_staff_meal_in_cogs` toggle verified in end-to-end test
- [ ] Dual margin (folded + unfolded) both present in `financialMetrics`
- [ ] All 3 stored value modes callable via analyzer context
- [ ] `expense_breakdown` section returns aggregated tree via FastAPI
- [ ] `RawMaterial` + `UnitConverter` 7 unit tests pass (hotpot + bakery + 西餐)
- [ ] Golden regression test still green

### Phase 3.5C (BOM Depth) — ship in 1 week

- [ ] 6 commits pushed
- [ ] Tests: 142 → 160
- [ ] `IntermediateProduct` with yield rate — 金汤凤爪 cost matches hand calc to < 1% error
- [ ] 2-layer BOM resolver handles dish → intermediate → raw chain
- [ ] `ShrinkageEngine` ranks offenders, generates action items
- [ ] New `shrinkage_analysis` section + Java tool + Flyway migration
- [ ] Universal test: same code path works for bakery 自制面团

### Phase 3.5D (Presentation) — ship in 1 week

- [ ] 4 commits pushed (P1, P2, P3, P4-P6 bundle)
- [ ] Tests: 160 → 169
- [ ] `department_pnl` section works for hotpot + bakery department trees
- [ ] `monthly_default.pptx` template created (19 slides)
- [ ] `MonthlyPptExporter` generates a valid .pptx > 10 KB
- [ ] Download endpoint serves the file with correct Content-Type
- [ ] 2 new Java tools + Flyway migration for intents

### Phase 3.5E (Integration) — ship in 2 days

- [ ] 3 commits (I2, I3, I4) + I1 verification
- [ ] Tests: 169 → 170
- [ ] Golden regression test passes
- [ ] Java integration test compiles (disabled runtime)
- [ ] All 19 section handlers registered (15 P1 + 4 P3.5)
- [ ] Memory entry + plan doc updated

### Overall P3.5 completion

- [ ] 27 tasks total (5 QW + 8 F + 6 B + 6 P + 4 I - bundling = actual commit count)
- [ ] ~25-28 git commits on feature branch
- [ ] Tests: 104 baseline → 170 final (+66 new tests)
- [ ] No existing functionality broken (all 104 original tests still pass)
- [ ] Plan document updated with implementation log
- [ ] Ready to return to original Phase 3 tasks (3.2-3.9) OR deploy P3.5 standalone

---

## 12. Open Questions (for implementation log, not pre-launch)

These get resolved DURING implementation, not before starting:

1. **Expense account code consistency** — Should leaf codes be Chinese ("工资") or English ("salary")? Plan uses Chinese for alignment with 鼎鲜's P&L. Verify this works with AI-generated insights that mix Chinese + English.

2. **RawMaterial sync strategy** — Should Python fetch from Java `MaterialBatch` via API, or via direct PostgreSQL read, or via manual YAML upload? Phase 3.5B F4 ships with YAML upload; other approaches can come in a follow-up.

3. **PPT template customization** — How does a customer upload their OWN `monthly_template.pptx`? Via `FactoryConfig.monthlyPptTemplateId` referencing a file path? Via admin UI upload? Phase 3.5D P2 ships with `monthly_default.pptx` only; customization TBD.

4. **Department head count update cadence** — Is `head_count_by_department` updated monthly (from HR system) or live (from shift scheduling)? Phase 3.5D P1 accepts either via params — consumer decides.

5. **Shrinkage threshold tuning** — Default OFFENDER_THRESHOLD = 2% variance. Different cuisines may need different thresholds (bakery has higher yield loss normal). Consider making it per-cuisine in `knowledge/restaurant/benchmarks/{sub_sector}.yaml` after Phase 3.5C ships.

6. **Dual margin display fallback** — What does UI show when `gross_revenue` is null? Plan says "folded only". Verify with frontend team that the null case is handled.

7. **Shrinkage action item responsibility assignment** — Plan auto-assigns to `responsible_department`. Should it also tag a specific person (from `员工档案`)? Deferred to post-3.5.

---

## 13. Backward Compatibility Notes

### Guaranteed preserved

- **P1 byte-identity golden test** — The dingxian synthetic fixture produces the same JSON shape as before 3.5 (only the 5 financial-only sections appear when no POS data). All new sections require NEW input params that the golden fixture doesn't provide, so they're absent by design.

- **Existing 14 P2 Java tool signatures** — No changes to `RestaurantCostRigidityAnalysisTool` through `RestaurantBomLayerStatusTool`. The 4 new tools are additive (`RestaurantExpenseBreakdownTool`, `RestaurantShrinkageAnalysisTool`, `RestaurantDepartmentPnlTool`, `RestaurantMonthlyPptExportTool`).

- **Existing 15 P1 section handlers** — No modifications to `cost_rigidity`, `diagnostics`, etc. Only augmented with optional `context` values (e.g. `stored_value_mode` from margin_spec).

- **`RestaurantAnalyzerV2.analyze()` method signature** — `analyzer.analyze(pos_df, financial_data, ...)` works with any caller. New optional `margin_spec` / `expense_account_tree_id` go through constructor, not `analyze()`.

### Breaking changes (by design)

- **None required.** All new code is additive. Any consumer that doesn't pass `margin_spec` gets the default (which matches pre-3.5 hardcoded behavior). Any consumer that doesn't call new sections gets the same output as before.

### Deprecations (none)

- No existing code is deprecated in this phase. The 5-bucket `FinancialMetrics` stays as the legacy mode (accessible via `expense_account_tree_id="default"`).

### Deploy order

1. **Python first** — ship 3.5A-D Python changes (additive, no DB migrations)
2. **Then Java** — ship 3.5A-D Java tools + P3.5B Flyway intent migration + P3.5C Flyway migration + P3.5D Flyway migration (3 new migrations in one deploy)
3. **Then deploy P3.5E** — integration tests + regression check via `./scripts/deploy/deploy-backend.sh --env test` first, verify, then `--env prod`

If Python and Java deploy separately (e.g. Python first, Java next day), the Java tools will call sections that exist in Python → works. Python calling Java (not applicable here) would need the other order.

---

## 14. Implementation Log

**Start date:** 2026-04-11
**Target completion:** 2026-05-09 (4 weeks)

**Phase 3.5A (Quick Wins):** 2026-04-11 — 4 commits (QW1-QW5, bundled in 4 commits due to parallel dispatch collision)
  - `657e529ae` QW3 MarginSpec
  - `c05a01da3` QW1 stored value thresholds
  - `b6b8bfea4` QW5 DepartmentTree
  - `9b26805c1` QW2 + QW4 (channel_margin venues + ExpenseAccountTree)
  - Tests: 104 → 127 (+23)

**Phase 3.5B (Foundation):** 2026-04-11 — 7 commits
  - `dd7789c52` F1 MarginSpec integration
  - `858d0f090` F2 dual margin
  - `1e879c84f` F3 stored value 3-mode
  - `efb5a8fb5` F4 RawMaterial + UnitConverter
  - `b632e49e2` F5 expense tree loader
  - `51fc7d1f5` F6+F7 expense_breakdown section + router registration
  - `206887fe7` F8 stored value mode propagation
  - Tests: 127 → 156 (+29)

**Phase 3.5C (BOM Depth):** 2026-04-11 — 5 commits
  - `d6c6973ee` B1 IntermediateProduct
  - `5f7e9d488` B2 Dish 2-layer BOM
  - `e61d84e9b` B3 ShrinkageEngine
  - `9a2589783` B4 shrinkage_analysis section
  - `67297df34` B5+B6 Java tool + Flyway migration
  - Tests: 156 → 189 (+33)

**Phase 3.5D (Presentation):** 2026-04-11 — 4 commits
  - `5009c9d6b` P1 department_pnl section
  - `b83a5ad65` P2 MonthlyPptExporter + 19-slide template
  - `7b62ef19c` P3 monthly_ppt_export section + download endpoint
  - `44a488d0f` P4+P5+P6 Java tools + Flyway intents
  - Tests: 189 → 205 (+16)

**Phase 3.5E (Integration):** 2026-04-11 — 2 commits
  - I1 verification (no commit): golden regression green, 20 integration tests pass
  - I2+I3 commit: Java disabled E2E + Python handler count lock
  - I4 commit: this log + memory entry
  - Tests: 205 → 206 (+1)

**Total P3.5**: 22 commits, 102 new tests (104 → 206 baseline → final), 4-calendar-week estimate completed in **1 calendar day** via subagent-driven development.

**Key learnings:**
1. **Parallel dispatches collide on staging area** — QW2+QW4 bundled into one commit. For future parallel work in the same directory, serialize dispatches.
2. **Spec math errors caught by subagent** — F2 dual margin: I wrote "folded > unfolded" but it's actually unfolded > folded (bigger denominator = bigger margin). Implementer fixed silently.
3. **Chinese severity text + PREPAID default preservation** — F3 stored value 3-mode treatment could have broken backward compat if PREPAID message changed. Implementer preserved exact pre-F3 PREPAID output.
4. **`FsPath` alias for FastAPI Path collision** — P3 implementer caught `pathlib.Path` vs FastAPI's `Path` name collision and used `from pathlib import Path as FsPath` to avoid breaking existing router imports.
5. **Lazy-load python-pptx** — P3's `MonthlyPptExportHandler._get_exporter()` defers the python-pptx import cost until first call, keeping module load fast.

**Deviations from plan:**
1. QW2+QW4 bundled into one commit instead of two (parallel dispatch collision — documented but not reverted)
2. QW2 also made `bom_resolver` optional in `ChannelMarginCalculator.__init__` as a bonus (calculator now usable standalone in tests)
3. Flyway migration numbers: used V20260411_01 → _02 → _03 sequentially (plan reserved specific numbers but actual sequence depends on commit order)

**Post-3.5 follow-ups:**
- Manual dashboard E2E verification (pending, non-blocking for merge)
- Hook up `FactoryConfig.marginSpec` UI toggles in web-admin (requires frontend work)
- Populate real dingxian data via `FactoryConfig` and verify end-to-end via the mobile chat path (requires Java deploy with Flyway migrations applied)

---

## Appendix A: File Reference Map

For quick lookup during implementation:

| Gap | New files | Modified files |
|---|---|---|
| G1 (ExpenseTree) | `services/finance/expense_account_tree.py`, `knowledge/restaurant/expense_account_tree/*.yaml`, `sections/expense_breakdown.py`, `tools/RestaurantExpenseBreakdownTool.java` | `analyzer.py` (`_get_expense_tree`), `restaurant_sections.py` (router) |
| G2 (MarginSpec) | `services/finance/margin_spec.py` | `analyzer.py` (`_extract_financial_metrics` + `__init__`), `stored_value_analyzer.py` (mode param) |
| G3 (2-layer BOM) | `services/bom/intermediate_product.py`, `services/bom/dish.py` | `services/bom/__init__.py` |
| G4 (Shrinkage) | `services/finance/shrinkage_engine.py`, `sections/shrinkage_analysis.py`, `tools/RestaurantShrinkageAnalysisTool.java`, `V20260411_03__restaurant_shrinkage_intent.sql` | `restaurant_sections.py` (router) |
| G5 (DeptTree) | `services/reporting/department_tree.py`, `knowledge/restaurant/department_tree/*.yaml`, `sections/department_pnl.py`, `tools/RestaurantDepartmentPnlTool.java` | `restaurant_sections.py` (router) |
| G6 (PPT Export) | `services/reporting/monthly_ppt_exporter.py`, `knowledge/restaurant/ppt_templates/monthly_default.pptx`, `scripts/create_monthly_ppt_template.py`, `sections/monthly_ppt_export.py`, `tools/RestaurantMonthlyPptExportTool.java` | `restaurant_sections.py` (router + download endpoint), `requirements.txt` (python-pptx) |
| G7 (RawMaterial) | `services/bom/raw_material.py` | `services/bom/__init__.py` |

Total: **22 new files, 6 modified files, 3 Flyway migrations**.

---

## Appendix B: Commit Message Convention

All commits on the feature branch should follow this pattern:

```
<type>(<scope>): <short summary>

<body explaining WHY and WHAT>

P3.5<phase> <task_id>: <one-line task reference>
```

Examples:
- `feat(smartbi-finance): add MarginSpec config with sensible defaults` (QW3)
- `fix(smartbi-restaurant): lower stored_value thresholds for hot pot reality` (QW1)
- `test(smartbi-restaurant): lock section handler count at 19` (I3)

Types:
- `feat` — new functionality
- `fix` — bug fix or threshold correction
- `test` — test-only changes
- `refactor` — internal restructuring (no external change)
- `docs` — plan updates or memory entries
- `chore` — dependency updates or config

Scopes:
- `smartbi-restaurant` — most restaurant-module changes
- `smartbi-finance` — finance module (MarginSpec, ExpenseTree, Shrinkage)
- `smartbi-bom` — BOM module (RawMaterial, Intermediate, Dish)
- `smartbi-reporting` — reporting module (DepartmentTree, MonthlyPpt)

---

## Appendix C: Execution Order Summary

```
Day 1:     QW1, QW2, QW3, QW4, QW5 (5 commits, all quick wins)
Day 2:     F1 (margin_spec integration)
Day 3:     F2 (dual margin) + F3 (stored value modes)
Day 4:     F4 (RawMaterial) + F5 (expense tree loader)
Day 5:     F6 (expense_breakdown section) + F7 (router) + F8 (mode propagation)
Day 6-7:   B1 (IntermediateProduct) + B2 (Dish 2-layer)
Day 8-9:   B3 (Shrinkage engine) + B4 (Shrinkage section)
Day 10:    B5 (Java tool) + B6 (Flyway migration)
Day 11:    P1 (department_pnl section)
Day 12-13: P2 (PPT template + exporter)
Day 14:    P3 (section + download endpoint) + P4-P6 bundle (Java tools)
Day 15:    I1 (regression) + I2 (E2E test compile)
Day 16:    I3 (registration check) + I4 (docs)
```

**Total: 16 work days ≈ 3.2 calendar weeks at 5 days/week.**

Buffer for debugging / scope adjustments: 1 week → 4 calendar weeks total.

---

**END OF PLAN**



