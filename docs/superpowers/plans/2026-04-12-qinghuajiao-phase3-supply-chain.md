# 青花椒 Option C · Phase 3: Supply Chain Automation (Week 5-6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 3 supply chain features: smart auto-reorder based on forecast + BOM, daily inventory reconciliation (日清日结), and enhanced procurement suggestion with holiday awareness.

**Architecture:** Cross-module orchestration — forecast (existing) + BOM (existing) + new inventory reconciliation handler. New `SmartReorderSkill` uses the Skill architecture to chain forecast → BOM expand → generate order. Python handlers + Java tools following Phase 1/2 patterns.

**Tech Stack:** Java 21 / Spring Boot 3.2 / Python 3.8+ FastAPI / PostgreSQL / Vue 3

**Source:** Customer call [T 08:50-09:30, 50:00-52:00]: '根据历史销量生成叫货单', '做了一段时间可以自动下单', '日清日结'.

---

## File Structure

### F1. Smart Reorder (Tasks 1-4)
- Create: `backend/python/smartbi/services/restaurant/sections/smart_reorder.py`
- Create: `backend/python/tests/test_smart_reorder.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/SmartReorderTool.java`

### F2. Daily Inventory Reconciliation (Tasks 5-7)
- Create: `backend/python/smartbi/services/restaurant/sections/daily_reconciliation.py`
- Create: `backend/python/tests/test_daily_reconciliation.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/DailyReconciliationTool.java`

### F3. Holiday-Aware Procurement (Tasks 8-10)
- Create: `backend/python/smartbi/services/restaurant/sections/procurement_forecast.py`
- Create: `backend/python/tests/test_procurement_forecast.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/ProcurementForecastTool.java`

### F4. Wiring (Task 11)
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_05__restaurant_phase3_intents.sql`
- Modify: `backend/python/smartbi/api/restaurant_sections.py`
- Create: 3 Vue cards
- Modify: `SectionCardRenderer.vue` + `SmartBIServiceImpl.java` regex

---

## Tasks

### Task 1: Smart Reorder Python handler — test

**Files:**
- Create: `backend/python/tests/test_smart_reorder.py`

- [ ] **Step 1: Write tests**

```python
"""Smart reorder: generate purchase order from forecast + BOM + current stock.
Customer [T 50:00]: '做了一段时间以后可以自动下单, 知道周一到周日每天大概下多少'.
"""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.smart_reorder import SmartReorderHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)

def test_basic_reorder():
    resp = SmartReorderHandler().compute(
        _req({
            "forecast_daily_revenue": 30000,
            "forecast_daily_covers": 100,
            "bom_recipes": [
                {"dish": "麻辣牛肉", "ingredient": "牛肉", "qty_per_dish": 0.3, "unit": "kg",
                 "daily_sales_estimate": 40},
                {"dish": "麻辣牛肉", "ingredient": "辣椒", "qty_per_dish": 0.05, "unit": "kg",
                 "daily_sales_estimate": 40},
                {"dish": "酸菜鱼", "ingredient": "黑鱼", "qty_per_dish": 0.5, "unit": "kg",
                 "daily_sales_estimate": 25},
            ],
            "current_stock": {"牛肉": 5.0, "辣椒": 3.0, "黑鱼": 2.0},
            "lead_days": 1,
            "safety_factor": 1.2,
        }),
        context={},
    )
    assert resp.status.value == "ok"
    orders = resp.data["suggested_orders"]
    assert len(orders) == 3
    beef = next(o for o in orders if o["ingredient"] == "牛肉")
    # daily need = 40 * 0.3 = 12kg, lead_days=1, safety=1.2 → need 14.4, stock 5 → order 9.4
    assert beef["daily_need"] == 12.0
    assert beef["order_qty"] > 0

def test_no_order_when_stock_sufficient():
    resp = SmartReorderHandler().compute(
        _req({
            "bom_recipes": [
                {"dish": "米饭", "ingredient": "大米", "qty_per_dish": 0.2, "unit": "kg",
                 "daily_sales_estimate": 50},
            ],
            "current_stock": {"大米": 100.0},
            "lead_days": 1,
            "safety_factor": 1.0,
        }),
        context={},
    )
    assert resp.status.value == "ok"
    rice = next(o for o in resp.data["suggested_orders"] if o["ingredient"] == "大米")
    assert rice["order_qty"] == 0  # 100 in stock, only need 10

def test_skipped_no_bom():
    resp = SmartReorderHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Commit test**

```bash
git add backend/python/tests/test_smart_reorder.py
git commit -m "test(smart-reorder): TDD red — forecast-based auto purchase order"
```

---

### Task 2: Smart Reorder Python handler — implementation

**Files:**
- Create: `backend/python/smartbi/services/restaurant/sections/smart_reorder.py`

- [ ] **Step 1: Implement**

```python
"""Smart reorder: forecast-driven purchase order generation.

Algorithm:
1. For each BOM recipe line: daily_need = daily_sales_estimate × qty_per_dish
2. Aggregate by ingredient across all dishes
3. total_need = daily_need × lead_days × safety_factor
4. order_qty = max(0, total_need - current_stock)
5. Sort by order_qty descending (highest priority first)
"""
import time
from collections import defaultdict
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class SmartReorderHandler(AbstractSectionHandler):
    section_name = "smart_reorder"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}

        bom = p.get("bom_recipes")
        if not bom or not isinstance(bom, list):
            return self.skipped(request, "未提供 bom_recipes", started)

        current_stock = p.get("current_stock", {})
        lead_days = max(int(p.get("lead_days", 1)), 1)
        safety = float(p.get("safety_factor", 1.2))

        # Aggregate daily need per ingredient
        ingredient_need = defaultdict(lambda: {"daily_need": 0.0, "unit": "", "dishes": []})
        for line in bom:
            ingredient = line.get("ingredient", "")
            qty_per = float(line.get("qty_per_dish", 0))
            daily_sales = float(line.get("daily_sales_estimate", 0))
            daily_need = qty_per * daily_sales

            entry = ingredient_need[ingredient]
            entry["daily_need"] += daily_need
            entry["unit"] = line.get("unit", "")
            entry["dishes"].append({"dish": line.get("dish", ""), "qty_per_dish": qty_per,
                                     "daily_sales": daily_sales, "contribution": round(daily_need, 2)})

        suggested = []
        total_order_value = 0.0

        for ingredient, info in ingredient_need.items():
            daily = round(info["daily_need"], 2)
            total_need = round(daily * lead_days * safety, 2)
            stock = float(current_stock.get(ingredient, 0))
            order = round(max(0, total_need - stock), 2)

            suggested.append({
                "ingredient": ingredient,
                "unit": info["unit"],
                "daily_need": daily,
                "lead_days": lead_days,
                "safety_factor": safety,
                "total_need": total_need,
                "current_stock": stock,
                "order_qty": order,
                "priority": "HIGH" if order > daily * 2 else "MEDIUM" if order > 0 else "LOW",
                "contributing_dishes": info["dishes"],
            })

        suggested.sort(key=lambda x: x["order_qty"], reverse=True)

        return self.ok(request, data={
            "suggested_orders": suggested,
            "total_ingredients": len(suggested),
            "ingredients_to_order": sum(1 for s in suggested if s["order_qty"] > 0),
            "lead_days": lead_days,
            "safety_factor": safety,
            "note": "特殊活动或爆单情况请手动补单",
        }, started=started)
```

- [ ] **Step 2: Run tests**

Run: `cd backend/python && python -m pytest tests/test_smart_reorder.py -v`
Expected: 3/3 PASS

- [ ] **Step 3: Commit**

```bash
git add backend/python/smartbi/services/restaurant/sections/smart_reorder.py
git commit -m "feat(smart-reorder): forecast-based auto purchase order handler"
```

---

### Task 3: Smart Reorder Java tool

- [ ] **Step 1: Create** `backend/java/.../diagnostic/SmartReorderTool.java`

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class SmartReorderTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_smart_reorder"; }
    @Override public String getDescription() {
        return "智能叫货单 — 基于历史销量预测+BOM展开+当前库存, 自动生成采购建议. "
             + "客户 [T 50:00] '做了一段时间可以自动下单, 特殊情况人工补单'.";
    }
    @Override protected String getSectionName() { return "smart_reorder"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("查看各食材的消耗趋势", "对比上周的叫货量", "调整安全库存系数");
    }
}
```

- [ ] **Step 2: Compile + commit**

---

### Task 4: Daily Reconciliation Python handler (TDD)

- [ ] **Step 1: Write test** `backend/python/tests/test_daily_reconciliation.py`

```python
"""Daily reconciliation: compare BOM-expected usage vs actual inventory.
Customer [T 48:00-50:00]: '日清日结, 一天的量, 到月底就不用盘了'.
"""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.daily_reconciliation import DailyReconciliationHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)

def test_normal_day():
    resp = DailyReconciliationHandler().compute(
        _req({
            "date": "2026-04-11",
            "opening_stock": {"牛肉": 20.0, "黑鱼": 15.0},
            "deliveries": {"牛肉": 10.0, "黑鱼": 8.0},
            "bom_expected_usage": {"牛肉": 12.0, "黑鱼": 10.0},
            "closing_stock": {"牛肉": 17.5, "黑鱼": 12.0},
        }),
        context={},
    )
    assert resp.status.value == "ok"
    items = resp.data["reconciliation"]
    beef = next(i for i in items if i["ingredient"] == "牛肉")
    # expected closing = 20 + 10 - 12 = 18, actual = 17.5, variance = -0.5
    assert beef["expected_closing"] == 18.0
    assert beef["actual_closing"] == 17.5
    assert beef["variance"] == -0.5
    assert beef["within_tolerance"]

def test_over_tolerance():
    resp = DailyReconciliationHandler().compute(
        _req({
            "date": "2026-04-11",
            "opening_stock": {"牛肉": 20.0},
            "deliveries": {"牛肉": 10.0},
            "bom_expected_usage": {"牛肉": 12.0},
            "closing_stock": {"牛肉": 10.0},
            "tolerance_pct": 5.0,
        }),
        context={},
    )
    items = resp.data["reconciliation"]
    beef = next(i for i in items if i["ingredient"] == "牛肉")
    # expected 18, actual 10, variance -8 = 44% of expected usage → over 5% tolerance
    assert not beef["within_tolerance"]
    assert beef["severity"] == "HIGH"

def test_skipped_no_stock():
    resp = DailyReconciliationHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Implement** `backend/python/smartbi/services/restaurant/sections/daily_reconciliation.py`

```python
"""Daily inventory reconciliation: opening + deliveries - BOM usage = expected closing vs actual.

Tolerance default 1.5% of expected usage (customer [T 43:49]: '成本率的1到1.5%').
"""
import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse

class DailyReconciliationHandler(AbstractSectionHandler):
    section_name = "daily_reconciliation"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}

        opening = p.get("opening_stock")
        if not opening:
            return self.skipped(request, "未提供 opening_stock", started)

        deliveries = p.get("deliveries", {})
        expected_usage = p.get("bom_expected_usage", {})
        closing = p.get("closing_stock", {})
        tolerance_pct = float(p.get("tolerance_pct", 1.5))
        date = p.get("date", "unknown")

        all_ingredients = set(opening.keys()) | set(deliveries.keys()) | set(closing.keys())
        reconciliation = []
        alerts = []

        for ing in sorted(all_ingredients):
            op = float(opening.get(ing, 0))
            deliv = float(deliveries.get(ing, 0))
            usage = float(expected_usage.get(ing, 0))
            expected_close = round(op + deliv - usage, 2)
            actual_close = float(closing.get(ing, 0))
            variance = round(actual_close - expected_close, 2)
            variance_pct = round(abs(variance) / usage * 100, 1) if usage > 0 else 0.0
            within = variance_pct <= tolerance_pct

            severity = "OK" if within else "HIGH" if variance_pct > tolerance_pct * 3 else "MEDIUM"

            item = {"ingredient": ing, "opening": op, "deliveries": deliv,
                     "expected_usage": usage, "expected_closing": expected_close,
                     "actual_closing": actual_close, "variance": variance,
                     "variance_pct": variance_pct, "within_tolerance": within,
                     "severity": severity}
            reconciliation.append(item)

            if not within:
                direction = "损耗" if variance < 0 else "结余偏多 (可能少给了客人)"
                alerts.append(f"{ing}: 差异 {variance:+.2f} ({variance_pct}%), {direction}")

        return self.ok(request, data={
            "date": date,
            "reconciliation": reconciliation,
            "alerts": alerts,
            "tolerance_pct": tolerance_pct,
            "total_ingredients": len(reconciliation),
            "within_tolerance_count": sum(1 for r in reconciliation if r["within_tolerance"]),
        }, started=started)
```

- [ ] **Step 3: Run tests + commit**

Run: `cd backend/python && python -m pytest tests/test_daily_reconciliation.py -v`

```bash
git add backend/python/smartbi/services/restaurant/sections/daily_reconciliation.py \
        backend/python/tests/test_daily_reconciliation.py
git commit -m "feat(daily-reconciliation): handler comparing BOM-expected vs actual stock"
```

---

### Task 5: Daily Reconciliation Java tool

- [ ] **Step 1: Create** `backend/java/.../diagnostic/DailyReconciliationTool.java`

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class DailyReconciliationTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_daily_reconciliation"; }
    @Override public String getDescription() {
        return "日清日结库存对账 — 对比 BOM 预期用量 vs 实际盘点, 找出差异超标的食材. "
             + "客户 [T 48:00] '日清日结, 到月底就不用盘了'.";
    }
    @Override protected String getSectionName() { return "daily_reconciliation"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("哪些食材差异最大", "本周差异趋势", "追溯差异原因 (损耗还是少给)");
    }
}
```

- [ ] **Step 2: Compile + commit**

---

### Task 6: Procurement Forecast Python handler (TDD)

- [ ] **Step 1: Write test** `backend/python/tests/test_procurement_forecast.py`

```python
"""Procurement forecast: holiday-aware purchase planning.
Customer [T 09:20-09:40]: '考虑节假日, 去年同期, 给到参考值'.
"""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.procurement_forecast import ProcurementForecastHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id=None, store_name=None, params=params)

def test_weekday_vs_weekend():
    resp = ProcurementForecastHandler().compute(
        _req({
            "historical_daily": [
                {"day": "周一", "avg_revenue": 25000, "avg_covers": 80},
                {"day": "周二", "avg_revenue": 22000, "avg_covers": 70},
                {"day": "周五", "avg_revenue": 40000, "avg_covers": 130},
                {"day": "周六", "avg_revenue": 50000, "avg_covers": 160},
                {"day": "周日", "avg_revenue": 45000, "avg_covers": 145},
            ],
            "next_days": 3,
            "next_day_names": ["周五", "周六", "周日"],
        }),
        context={},
    )
    assert resp.status.value == "ok"
    plan = resp.data["daily_plan"]
    assert len(plan) == 3
    assert plan[0]["day"] == "周五"
    assert plan[0]["forecast_revenue"] == 40000

def test_holiday_multiplier():
    resp = ProcurementForecastHandler().compute(
        _req({
            "historical_daily": [{"day": "周六", "avg_revenue": 50000, "avg_covers": 160}],
            "next_days": 1,
            "next_day_names": ["周六"],
            "holiday_multiplier": 1.5,
        }),
        context={},
    )
    plan = resp.data["daily_plan"]
    assert plan[0]["forecast_revenue"] == 75000  # 50000 * 1.5

def test_skipped_no_history():
    resp = ProcurementForecastHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Implement** `backend/python/smartbi/services/restaurant/sections/procurement_forecast.py`

```python
"""Procurement forecast: predict next N days' revenue/covers using day-of-week history + holiday multiplier."""
import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse

class ProcurementForecastHandler(AbstractSectionHandler):
    section_name = "procurement_forecast"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}

        historical = p.get("historical_daily")
        if not historical or not isinstance(historical, list):
            return self.skipped(request, "未提供 historical_daily", started)

        next_days = int(p.get("next_days", 3))
        day_names = p.get("next_day_names", [])
        holiday_mult = float(p.get("holiday_multiplier", 1.0))
        yoy_adjustment = float(p.get("yoy_adjustment", 1.0))

        # Build lookup: day name → avg values
        day_lookup = {}
        for h in historical:
            day_lookup[h.get("day", "")] = {
                "avg_revenue": float(h.get("avg_revenue", 0)),
                "avg_covers": float(h.get("avg_covers", 0)),
            }

        daily_plan = []
        total_revenue = 0
        total_covers = 0

        for i in range(min(next_days, len(day_names) if day_names else next_days)):
            day = day_names[i] if i < len(day_names) else f"Day{i+1}"
            base = day_lookup.get(day, {"avg_revenue": 0, "avg_covers": 0})

            rev = round(base["avg_revenue"] * holiday_mult * yoy_adjustment)
            covers = round(base["avg_covers"] * holiday_mult * yoy_adjustment)

            daily_plan.append({
                "day": day,
                "forecast_revenue": rev,
                "forecast_covers": covers,
                "holiday_multiplier": holiday_mult,
                "yoy_adjustment": yoy_adjustment,
                "base_revenue": base["avg_revenue"],
            })
            total_revenue += rev
            total_covers += covers

        return self.ok(request, data={
            "daily_plan": daily_plan,
            "total_forecast_revenue": total_revenue,
            "total_forecast_covers": total_covers,
            "days_planned": len(daily_plan),
            "note": "节假日/特殊活动请手动调整 holiday_multiplier",
        }, started=started)
```

- [ ] **Step 3: Run tests + commit**

---

### Task 7: Procurement Forecast Java tool

- [ ] **Step 1: Create** `backend/java/.../diagnostic/ProcurementForecastTool.java`

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class ProcurementForecastTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_procurement_forecast"; }
    @Override public String getDescription() {
        return "采购预测 — 基于历史日销量+节假日调整, 预测未来N天营收和客流, 用于叫货参考. "
             + "客户 [T 09:20] '考虑节假日, 去年同期, 给到一个参考值'.";
    }
    @Override protected String getSectionName() { return "procurement_forecast"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("结合BOM生成叫货单", "调整节假日倍数", "对比去年同期实际值");
    }
}
```

- [ ] **Step 2: Compile + commit**

---

### Task 8: Wiring (Flyway + router + Vue cards + regex + push)

- [ ] **Step 1: Flyway migration** `V20260412_05__restaurant_phase3_intents.sql`

```sql
INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_SMART_REORDER', '智能叫货单', 'SMARTBI', 'restaurant_smart_reorder', 'LOW',
        '["叫货","自动下单","采购单","叫货单","补货","自动采购","智能下单"]',
        '基于预测+BOM+库存自动生成采购建议', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_smart_reorder', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_DAILY_RECONCILIATION', '日清日结', 'SMARTBI', 'restaurant_daily_reconciliation', 'LOW',
        '["日清日结","日盘","今日盘点","库存对账","每日对账","当日损耗"]',
        '对比BOM预期用量vs实际盘点, 找出差异超标食材', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_daily_reconciliation', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_PROCUREMENT_FORECAST', '采购预测', 'SMARTBI', 'restaurant_procurement_forecast', 'LOW',
        '["采购预测","明天需要多少","下周要多少","备货","节假日备货","采购参考"]',
        '基于历史日销量+节假日调整预测未来营收和客流', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_procurement_forecast', is_active = true;
```

- [ ] **Step 2: Router + Vue + regex + test**

Same pattern as Phase 1/2 wiring. Register 3 handlers, create 3 Vue cards (SmartReorderCard, DailyReconciliationCard, ProcurementForecastCard), update SectionCardRenderer, extend keyword regex.

New keywords:
```
"|叫货|自动下单|采购单|叫货单|补货|智能下单" +
"|日清日结|日盘|今日盘点|库存对账|每日对账|当日损耗" +
"|采购预测|明天需要多少|下周要多少|备货|节假日备货"
```

- [ ] **Step 3: Verify + apply migrations + push**

---

## Self-Review

| Requirement | Task(s) |
|---|---|
| 基于历史销量的自动叫货 [T 50:00] | 1-3 (SmartReorder) |
| BOM × 销量 → 原材料需求 [T 46:55] | 1-2 (bom_recipes aggregation) |
| 日清日结库存对账 [T 48:00] | 4-5 (DailyReconciliation) |
| 节假日调整采购 [T 09:20] | 6-7 (ProcurementForecast with holiday_multiplier) |
| 特殊情况人工补单 [T 50:34] | 1-2 (note in response: "特殊活动请手动补单") |
| 成本差异容忍度 1-1.5% [T 43:49] | 4 (tolerance_pct default 1.5) |
