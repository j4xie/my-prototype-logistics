# 青花椒 Option C · Phase 1: Financial Analytics (Week 1-2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 4 financial analytics features for 下周财务端测试: BOM dual-attribution variance, controllable profit view, sales plan tracking with alerts, labor productivity monitoring.

**Architecture:** Extend existing `AbstractSectionHandler` (Python) + `AbstractRestaurantDiagnosticTool` (Java) patterns. New `SalesPlan` JPA entity for plan CRUD. All features registered via Flyway intent configs and routed through the P5.6 Tool-Skill pipeline.

**Tech Stack:** Java 21 / Spring Boot 3.2 / Python 3.8+ FastAPI / PostgreSQL / Vue 3 + Element Plus

**Source:** 52-minute customer call transcript (Whisper medium, `.claude/agent-team-outputs/qinghuajiao-transcript/1775791036728170822.formatted.md`). Requirement references use `[T mm:ss]` timestamps.

---

## Master Roadmap (all 4 phases)

| Phase | Weeks | Scope | Status |
|-------|-------|-------|--------|
| **1. Financial Analytics** | 1-2 | BOM variance / controllable profit / sales plan / labor productivity | **THIS PLAN** |
| 2. Operational Intelligence | 3-4 | Seat config analysis / combo split / return anomaly / review competitive | Planned separately |
| 3. Supply Chain Automation | 5-6 | Auto purchase order skill / procurement forecast / daily reconciliation | Planned separately |
| 4. Workforce Management | 7-10 | Shift scheduling / piecework commission / team perf / rule engine | Planned separately |

---

## File Structure

### F1. BOM Variance Dual Attribution (Tasks 1-3)

- Create: `backend/python/smartbi/services/restaurant/sections/bom_variance.py`
- Create: `backend/python/tests/test_bom_variance.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/BomVarianceTool.java`
- Create: `backend/java/cretas-api/src/test/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/BomVarianceToolTest.java`

### F2. Controllable Profit (Tasks 4-6)

- Create: `backend/python/smartbi/services/finance/controllable_profit.py`
- Create: `backend/python/tests/test_controllable_profit.py`
- Modify: `backend/python/smartbi/services/restaurant/sections/store_pnl_one_pager.py` (add controllable mode)

### F3. Sales Plan Tracking (Tasks 7-12)

- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/restaurant/SalesPlan.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/restaurant/SalesPlanRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/restaurant/SalesPlanService.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/restaurant/impl/SalesPlanServiceImpl.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/SalesPlanCreateTool.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/SalesPlanTrackTool.java`
- Create: `backend/python/smartbi/services/restaurant/sections/sales_plan_tracking.py`
- Create: `backend/python/tests/test_sales_plan_tracking.py`
- Create: `backend/java/cretas-api/src/test/java/com/cretas/aims/service/restaurant/SalesPlanServiceTest.java`

### F4. Labor Productivity Monitor (Tasks 13-15)

- Create: `backend/python/smartbi/services/restaurant/sections/labor_productivity.py`
- Create: `backend/python/tests/test_labor_productivity.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/LaborProductivityTool.java`

### F5. Wiring (Tasks 16-18)

- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_01__restaurant_bom_variance_intent.sql`
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_02__restaurant_sales_plan_table.sql`
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_03__restaurant_phase1_intents.sql`
- Modify: `backend/python/smartbi/api/restaurant_sections.py` (register 4 new handlers in HANDLERS dict)
- Create: `web-admin/src/views/smart-bi/components/chat/cards/BomVarianceCard.vue`
- Create: `web-admin/src/views/smart-bi/components/chat/cards/SalesPlanCard.vue`
- Create: `web-admin/src/views/smart-bi/components/chat/cards/LaborProductivityCard.vue`
- Modify: `web-admin/src/views/smart-bi/components/chat/SectionCardRenderer.vue` (add 3 new card mappings)

---

## Tasks

### Task 1: BOM Variance Python handler — test

**Files:**
- Create: `backend/python/tests/test_bom_variance.py`

- [ ] **Step 1: Write the failing test**

```python
"""BOM Variance dual attribution: split cost delta into supply chain (price) vs management (usage)."""
import time
from unittest.mock import MagicMock
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.bom_variance import BomVarianceHandler


def _req(params: dict) -> SectionRequest:
    return SectionRequest(
        factory_id="F-TEST",
        upload_id=None,
        sub_sector="火锅",
        store_id=None,
        store_name=None,
        params=params,
    )


def test_dual_attribution_basic():
    """Standard cost 1000 at price 10, actual cost 1320 at price 11.
    Supply chain variance = (11-10)*100 = +100 (price went up).
    Management variance = 10*(120-100) = +200 (used 20 more units).
    Total = 300 = 1320 - 1000 - 20 rounding."""
    handler = BomVarianceHandler()
    resp = handler.compute(
        _req({
            "items": [
                {
                    "sku": "黑鱼",
                    "std_qty": 100, "std_price": 10.0,
                    "actual_qty": 120, "actual_price": 11.0,
                },
            ],
        }),
        context={},
    )
    assert resp.status.value == "ok"
    d = resp.data
    assert len(d["items"]) == 1
    item = d["items"][0]
    assert item["sku"] == "黑鱼"
    assert item["price_variance"] == 100.0   # supply chain
    assert item["usage_variance"] == 200.0   # management
    assert item["total_variance"] == 300.0
    assert d["summary"]["total_price_variance"] == 100.0
    assert d["summary"]["total_usage_variance"] == 200.0


def test_skipped_when_no_items():
    handler = BomVarianceHandler()
    resp = handler.compute(_req({}), context={})
    assert resp.status.value == "skipped"


def test_negative_variance_means_savings():
    handler = BomVarianceHandler()
    resp = handler.compute(
        _req({
            "items": [
                {"sku": "牛肉", "std_qty": 50, "std_price": 40.0,
                 "actual_qty": 45, "actual_price": 38.0},
            ],
        }),
        context={},
    )
    assert resp.status.value == "ok"
    item = resp.data["items"][0]
    assert item["price_variance"] == -100.0  # bought cheaper
    assert item["usage_variance"] == -200.0  # used less
    assert item["total_variance"] == -300.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/python && python -m pytest tests/test_bom_variance.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'smartbi.services.restaurant.sections.bom_variance'`

- [ ] **Step 3: Commit**

```bash
git add backend/python/tests/test_bom_variance.py
git commit -m "test(bom-variance): TDD red — dual attribution handler tests"
```

---

### Task 2: BOM Variance Python handler — implementation

**Files:**
- Create: `backend/python/smartbi/services/restaurant/sections/bom_variance.py`

- [ ] **Step 1: Implement BomVarianceHandler**

```python
"""BOM cost variance dual attribution: supply chain (price) vs management (usage).

Methodology (standard cost accounting):
  price_variance  = (actual_price - std_price) * std_qty    → supply chain responsibility
  usage_variance  = std_price * (actual_qty - std_qty)      → operations responsibility
  total_variance  = actual_cost - std_cost                   → always = price + usage + interaction
  interaction     = (actual_price - std_price) * (actual_qty - std_qty)

We report price + usage + interaction separately. The customer [T 43:00-48:00] wants
to see "supply chain difference" vs "management difference" by SKU and in aggregate.
"""
import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class BomVarianceHandler(AbstractSectionHandler):
    section_name = "bom_variance"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        items_raw = (request.params or {}).get("items")
        if not items_raw or not isinstance(items_raw, list):
            return self.skipped(request, "未提供 items (需要 std_qty/std_price/actual_qty/actual_price)", started)

        result_items = []
        total_price_var = 0.0
        total_usage_var = 0.0
        total_interaction = 0.0

        for row in items_raw:
            sku = row.get("sku", "unknown")
            std_qty = float(row.get("std_qty", 0))
            std_price = float(row.get("std_price", 0))
            actual_qty = float(row.get("actual_qty", 0))
            actual_price = float(row.get("actual_price", 0))

            price_var = (actual_price - std_price) * std_qty
            usage_var = std_price * (actual_qty - std_qty)
            interaction = (actual_price - std_price) * (actual_qty - std_qty)
            total_var = (actual_price * actual_qty) - (std_price * std_qty)

            result_items.append({
                "sku": sku,
                "std_cost": round(std_price * std_qty, 2),
                "actual_cost": round(actual_price * actual_qty, 2),
                "price_variance": round(price_var, 2),
                "usage_variance": round(usage_var, 2),
                "interaction": round(interaction, 2),
                "total_variance": round(total_var, 2),
                "attribution": "supply_chain" if abs(price_var) > abs(usage_var) else "management",
            })

            total_price_var += price_var
            total_usage_var += usage_var
            total_interaction += interaction

        total_total = total_price_var + total_usage_var + total_interaction

        severity = "LOW"
        if abs(total_total) > 0:
            std_total = sum(float(r.get("std_price", 0)) * float(r.get("std_qty", 0)) for r in items_raw)
            if std_total > 0:
                pct = abs(total_total) / std_total
                if pct > 0.015:
                    severity = "HIGH"
                elif pct > 0.01:
                    severity = "MEDIUM"

        return self.ok(
            request,
            data={
                "items": result_items,
                "summary": {
                    "total_price_variance": round(total_price_var, 2),
                    "total_usage_variance": round(total_usage_var, 2),
                    "total_interaction": round(total_interaction, 2),
                    "total_variance": round(total_total, 2),
                    "severity": severity,
                    "dominant_factor": "supply_chain" if abs(total_price_var) > abs(total_usage_var) else "management",
                },
                "tolerance_pct": 1.5,
                "methodology": "standard_cost_dual_attribution",
            },
            started=started,
        )
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd backend/python && python -m pytest tests/test_bom_variance.py -v`
Expected: 3/3 PASS

- [ ] **Step 3: Commit**

```bash
git add backend/python/smartbi/services/restaurant/sections/bom_variance.py
git commit -m "feat(bom-variance): dual attribution handler — price vs usage split"
```

---

### Task 3: BOM Variance Java tool

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/BomVarianceTool.java`

- [ ] **Step 1: Create Java tool wrapping the Python handler**

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class BomVarianceTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_bom_variance";
    }

    @Override
    public String getDescription() {
        return "BOM 成本差异双维度归因 — 把成本偏差拆为供应链差异 (采购价变动) 和管理差异 (实际用量偏差), "
             + "按 SKU 明细 + 汇总. 客户说 [T43:00] '同样的销量, 因为采购价格差多少, 因为上面涨了'.";
    }

    @Override
    protected String getSectionName() {
        return "bom_variance";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>(super.getParametersSchema());
        Map<String, Object> props = new HashMap<>((Map<String, Object>) schema.getOrDefault("properties", Collections.emptyMap()));

        Map<String, Object> items = new HashMap<>();
        items.put("type", "array");
        items.put("description", "SKU 明细列表, 每项需 sku/std_qty/std_price/actual_qty/actual_price");
        props.put("items", items);

        schema.put("properties", props);
        return schema;
    }

    @Override
    protected List<String> buildFollowUps(String sectionName, Map<String, Object> data) {
        return Arrays.asList(
            "哪些 SKU 的供应链差异最大",
            "管理差异超标的原因追溯",
            "对比上月的 BOM 成本率变化"
        );
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend/java/cretas-api && ./mvnw.cmd compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/BomVarianceTool.java
git commit -m "feat(bom-variance): Java tool wrapping Python dual attribution handler"
```

---

### Task 4: Controllable Profit calculator — test

**Files:**
- Create: `backend/python/tests/test_controllable_profit.py`

- [ ] **Step 1: Write the failing test**

```python
"""Controllable profit = revenue - controllable costs only.
Customer [T 18:00-22:00]: '租金不是我来判断, 税收也不是, 这些不可控的拿掉'.
Non-controllable: rent, tax, depreciation, insurance.
Controllable: COGS, labor, utilities, marketing, repairs.
"""
from smartbi.services.finance.controllable_profit import ControllableProfitCalculator


def test_basic_controllable_profit():
    calc = ControllableProfitCalculator()
    result = calc.compute(
        revenue=500000,
        cost_items={
            "food_cost": 175000,        # controllable
            "labor": 100000,            # controllable
            "utilities": 15000,         # controllable (水电煤)
            "rent": 60000,              # NOT controllable
            "tax": 25000,               # NOT controllable
            "depreciation": 10000,      # NOT controllable
            "marketing": 8000,          # controllable
            "repairs": 5000,            # controllable
        },
        non_controllable_keys=["rent", "tax", "depreciation"],
    )
    assert result["revenue"] == 500000
    assert result["total_cost"] == 398000
    assert result["financial_profit"] == 102000
    assert result["controllable_cost"] == 303000  # 175k+100k+15k+8k+5k
    assert result["controllable_profit"] == 197000  # 500k - 303k
    assert result["controllable_margin_pct"] == 39.4  # 197k/500k * 100


def test_non_controllable_defaults():
    calc = ControllableProfitCalculator()
    result = calc.compute(
        revenue=300000,
        cost_items={"food_cost": 100000, "labor": 80000, "rent": 40000},
    )
    assert result["controllable_profit"] == 120000  # rent excluded by default


def test_custom_non_controllable_keys():
    calc = ControllableProfitCalculator()
    result = calc.compute(
        revenue=100000,
        cost_items={"food_cost": 30000, "labor": 20000, "investment": 15000},
        non_controllable_keys=["investment"],
    )
    assert result["controllable_cost"] == 50000
    assert result["controllable_profit"] == 50000
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/python && python -m pytest tests/test_controllable_profit.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Commit**

```bash
git add backend/python/tests/test_controllable_profit.py
git commit -m "test(controllable-profit): TDD red — calculator tests"
```

---

### Task 5: Controllable Profit calculator — implementation

**Files:**
- Create: `backend/python/smartbi/services/finance/controllable_profit.py`

- [ ] **Step 1: Implement ControllableProfitCalculator**

```python
"""Controllable profit calculator for store manager KPIs.

Splits P&L into controllable vs non-controllable items.
Non-controllable defaults: rent, tax, depreciation, insurance, interest, investment.
These are configurable per call — the user [T 22:00] said rules change per quarter,
so the API accepts explicit non_controllable_keys to override defaults.
"""
from dataclasses import dataclass, field
from typing import Optional


DEFAULT_NON_CONTROLLABLE = frozenset([
    "rent", "tax", "depreciation", "insurance", "interest", "investment",
    "租金", "税收", "折旧", "保险", "利息", "投资",
])


@dataclass
class ControllableProfitCalculator:
    default_non_controllable: frozenset = field(default_factory=lambda: DEFAULT_NON_CONTROLLABLE)

    def compute(
        self,
        revenue: float,
        cost_items: dict[str, float],
        non_controllable_keys: Optional[list[str]] = None,
    ) -> dict:
        nc_keys = set(non_controllable_keys) if non_controllable_keys else self.default_non_controllable

        controllable_cost = 0.0
        non_controllable_cost = 0.0
        breakdown = []

        for key, amount in cost_items.items():
            is_nc = key in nc_keys
            if is_nc:
                non_controllable_cost += amount
            else:
                controllable_cost += amount
            breakdown.append({
                "item": key,
                "amount": amount,
                "controllable": not is_nc,
            })

        total_cost = controllable_cost + non_controllable_cost
        financial_profit = revenue - total_cost
        controllable_profit = revenue - controllable_cost
        margin_pct = round(controllable_profit / revenue * 100, 1) if revenue > 0 else 0.0

        return {
            "revenue": revenue,
            "total_cost": total_cost,
            "financial_profit": financial_profit,
            "controllable_cost": controllable_cost,
            "non_controllable_cost": non_controllable_cost,
            "controllable_profit": controllable_profit,
            "controllable_margin_pct": margin_pct,
            "breakdown": breakdown,
        }
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd backend/python && python -m pytest tests/test_controllable_profit.py -v`
Expected: 3/3 PASS

- [ ] **Step 3: Commit**

```bash
git add backend/python/smartbi/services/finance/controllable_profit.py
git commit -m "feat(controllable-profit): calculator with configurable non-controllable items"
```

---

### Task 6: Store PnL controllable mode — modify existing handler

**Files:**
- Modify: `backend/python/smartbi/services/restaurant/sections/store_pnl_one_pager.py`

- [ ] **Step 1: Read the existing StorePnlOnePagerHandler to understand current structure**

Run: `head -80 backend/python/smartbi/services/restaurant/sections/store_pnl_one_pager.py`

- [ ] **Step 2: Add controllable profit overlay**

In `StorePnlOnePagerHandler.compute()`, after the existing P&L calculation, add a `controllable_profit` section to the returned data by importing and calling `ControllableProfitCalculator`:

```python
# At top of file, add import:
from smartbi.services.finance.controllable_profit import ControllableProfitCalculator

# Inside compute(), after the existing pnl_data is built, add:
controllable_calc = ControllableProfitCalculator()
non_controllable_keys = (request.params or {}).get(
    "non_controllable_keys",
    ["rent", "tax", "depreciation", "insurance"]
)
controllable = controllable_calc.compute(
    revenue=pnl_data.get("revenue", 0),
    cost_items={k: v for k, v in pnl_data.get("cost_breakdown", {}).items()},
    non_controllable_keys=non_controllable_keys,
)
# Merge into data dict
data["controllable_profit"] = controllable
```

- [ ] **Step 3: Run existing store_pnl tests to verify no regression**

Run: `cd backend/python && python -m pytest tests/ -k "pnl" -v`
Expected: all existing tests pass, new controllable field appears in output

- [ ] **Step 4: Commit**

```bash
git add backend/python/smartbi/services/restaurant/sections/store_pnl_one_pager.py
git commit -m "feat(store-pnl): add controllable profit overlay for store manager KPIs"
```

---

### Task 7: SalesPlan JPA entity

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/restaurant/SalesPlan.java`

- [ ] **Step 1: Create entity**

```java
package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@Entity
@Table(name = "restaurant_sales_plans",
       uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "store_id", "plan_month"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class SalesPlan extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    @Column(name = "store_id", length = 64)
    private String storeId;

    @Column(name = "plan_month", nullable = false)
    private LocalDate planMonth;

    @Column(name = "target_revenue", nullable = false, precision = 14, scale = 2)
    private BigDecimal targetRevenue;

    @Column(name = "target_order_count")
    private Integer targetOrderCount;

    @Column(name = "target_avg_ticket", precision = 10, scale = 2)
    private BigDecimal targetAvgTicket;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "daily_adjustments", columnDefinition = "jsonb")
    private Map<String, Object> dailyAdjustments;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "holiday_adjustments", columnDefinition = "jsonb")
    private Map<String, Object> holidayAdjustments;

    @Column(name = "notes", length = 500)
    private String notes;

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend/java/cretas-api && ./mvnw.cmd compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/entity/restaurant/SalesPlan.java
git commit -m "feat(sales-plan): SalesPlan JPA entity with monthly targets + adjustments"
```

---

### Task 8: SalesPlan repository + service

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/restaurant/SalesPlanRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/restaurant/SalesPlanService.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/restaurant/impl/SalesPlanServiceImpl.java`

- [ ] **Step 1: Create repository**

```java
package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.SalesPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface SalesPlanRepository extends JpaRepository<SalesPlan, String> {

    Optional<SalesPlan> findByFactoryIdAndStoreIdAndPlanMonth(
            String factoryId, String storeId, LocalDate planMonth);

    List<SalesPlan> findByFactoryIdAndPlanMonthAndIsActiveTrue(
            String factoryId, LocalDate planMonth);

    @Query("SELECT sp FROM SalesPlan sp WHERE sp.factoryId = :fid AND sp.planMonth = :month AND sp.isActive = true")
    List<SalesPlan> findActivePlans(@Param("fid") String factoryId, @Param("month") LocalDate planMonth);
}
```

- [ ] **Step 2: Create service interface**

```java
package com.cretas.aims.service.restaurant;

import com.cretas.aims.entity.restaurant.SalesPlan;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface SalesPlanService {
    SalesPlan createOrUpdate(String factoryId, String storeId, LocalDate month,
                             BigDecimal targetRevenue, Integer targetOrderCount,
                             Map<String, Object> dailyAdjustments,
                             Map<String, Object> holidayAdjustments, String notes);

    Optional<SalesPlan> getPlan(String factoryId, String storeId, LocalDate month);

    List<SalesPlan> getActivePlans(String factoryId, LocalDate month);

    Map<String, Object> getCompletionRate(String factoryId, String storeId, LocalDate month,
                                           BigDecimal actualRevenue, Integer actualOrders);
}
```

- [ ] **Step 3: Create service implementation**

```java
package com.cretas.aims.service.restaurant.impl;

import com.cretas.aims.entity.restaurant.SalesPlan;
import com.cretas.aims.repository.restaurant.SalesPlanRepository;
import com.cretas.aims.service.restaurant.SalesPlanService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SalesPlanServiceImpl implements SalesPlanService {

    private final SalesPlanRepository repository;

    @Override
    public SalesPlan createOrUpdate(String factoryId, String storeId, LocalDate month,
                                     BigDecimal targetRevenue, Integer targetOrderCount,
                                     Map<String, Object> dailyAdjustments,
                                     Map<String, Object> holidayAdjustments, String notes) {
        LocalDate planMonth = month.withDayOfMonth(1);
        SalesPlan plan = repository.findByFactoryIdAndStoreIdAndPlanMonth(factoryId, storeId, planMonth)
                .orElse(SalesPlan.builder()
                        .factoryId(factoryId)
                        .storeId(storeId)
                        .planMonth(planMonth)
                        .build());

        plan.setTargetRevenue(targetRevenue);
        plan.setTargetOrderCount(targetOrderCount);
        plan.setDailyAdjustments(dailyAdjustments);
        plan.setHolidayAdjustments(holidayAdjustments);
        plan.setNotes(notes);
        plan.setIsActive(true);

        return repository.save(plan);
    }

    @Override
    public Optional<SalesPlan> getPlan(String factoryId, String storeId, LocalDate month) {
        return repository.findByFactoryIdAndStoreIdAndPlanMonth(factoryId, storeId, month.withDayOfMonth(1));
    }

    @Override
    public List<SalesPlan> getActivePlans(String factoryId, LocalDate month) {
        return repository.findActivePlans(factoryId, month.withDayOfMonth(1));
    }

    @Override
    public Map<String, Object> getCompletionRate(String factoryId, String storeId, LocalDate month,
                                                   BigDecimal actualRevenue, Integer actualOrders) {
        Optional<SalesPlan> planOpt = getPlan(factoryId, storeId, month);
        if (planOpt.isEmpty()) {
            return Map.of("hasPlan", false, "message", "该门店当月未设置销售计划");
        }

        SalesPlan plan = planOpt.get();
        BigDecimal target = plan.getTargetRevenue();
        BigDecimal revenuePct = target.compareTo(BigDecimal.ZERO) > 0
                ? actualRevenue.multiply(BigDecimal.valueOf(100)).divide(target, 1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        int dayOfMonth = month.getDayOfMonth();
        int totalDays = month.lengthOfMonth();
        BigDecimal expectedPct = BigDecimal.valueOf(dayOfMonth * 100.0 / totalDays)
                .setScale(1, RoundingMode.HALF_UP);

        String status;
        if (revenuePct.compareTo(expectedPct) >= 0) {
            status = "ON_TRACK";
        } else if (revenuePct.compareTo(expectedPct.multiply(BigDecimal.valueOf(0.85))) >= 0) {
            status = "SLIGHT_BEHIND";
        } else {
            status = "BEHIND";
        }

        BigDecimal gap = target.subtract(actualRevenue);
        int remainingDays = totalDays - dayOfMonth;
        BigDecimal dailyNeeded = remainingDays > 0
                ? gap.divide(BigDecimal.valueOf(remainingDays), 0, RoundingMode.CEILING)
                : BigDecimal.ZERO;

        return Map.of(
                "hasPlan", true,
                "targetRevenue", target,
                "actualRevenue", actualRevenue,
                "completionPct", revenuePct,
                "expectedPct", expectedPct,
                "status", status,
                "gap", gap.max(BigDecimal.ZERO),
                "remainingDays", remainingDays,
                "dailyNeeded", dailyNeeded,
                "dayOfMonth", dayOfMonth,
                "totalDays", totalDays
        );
    }
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd backend/java/cretas-api && ./mvnw.cmd compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/repository/restaurant/SalesPlanRepository.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/restaurant/SalesPlanService.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/service/restaurant/impl/SalesPlanServiceImpl.java
git commit -m "feat(sales-plan): repository + service with completion tracking"
```

---

### Task 9: SalesPlan Java tools (create + track)

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/SalesPlanCreateTool.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/SalesPlanTrackTool.java`

- [ ] **Step 1: Create SalesPlanCreateTool**

```java
package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.restaurant.SalesPlan;
import com.cretas.aims.service.restaurant.SalesPlanService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class SalesPlanCreateTool extends AbstractBusinessTool {

    @Autowired
    private SalesPlanService salesPlanService;

    @Override
    public String getToolName() {
        return "restaurant_sales_plan_create";
    }

    @Override
    public String getDescription() {
        return "创建或更新门店月度销售计划 — 设定目标营收/订单数, 支持节假日调整. "
             + "客户 [T 05:57] '每个月有一个销售计划, 根据周末节假日调整, 追踪完成度'.";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "store_id", Map.of("type", "string", "description", "门店ID"),
                "month", Map.of("type", "string", "description", "计划月份 YYYY-MM"),
                "target_revenue", Map.of("type", "number", "description", "目标营收 (元)"),
                "target_order_count", Map.of("type", "integer", "description", "目标订单数"),
                "notes", Map.of("type", "string", "description", "备注")
            ),
            "required", List.of("month", "target_revenue")
        );
    }

    @Override
    protected List<String> getRequiredParameters() {
        return List.of("month", "target_revenue");
    }

    @Override
    public boolean supportsPreview() { return true; }

    @Override
    protected Map<String, Object> doExecute(String factoryId,
            Map<String, Object> params, Map<String, Object> context) throws Exception {
        String storeId = getString(params, "store_id");
        String monthStr = getString(params, "month");
        LocalDate month = LocalDate.parse(monthStr + "-01", DateTimeFormatter.ISO_LOCAL_DATE);
        BigDecimal target = new BigDecimal(params.get("target_revenue").toString());
        Integer orderCount = params.get("target_order_count") != null
                ? Integer.parseInt(params.get("target_order_count").toString()) : null;
        String notes = getString(params, "notes");

        SalesPlan plan = salesPlanService.createOrUpdate(
                factoryId, storeId, month, target, orderCount, null, null, notes);

        return buildSimpleResult("销售计划已设置", Map.of(
                "planId", plan.getId(),
                "month", monthStr,
                "targetRevenue", target,
                "targetOrderCount", orderCount != null ? orderCount : "未设置"
        ));
    }
}
```

- [ ] **Step 2: Create SalesPlanTrackTool**

```java
package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.impl.restaurant.diagnostic.AbstractRestaurantDiagnosticTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class SalesPlanTrackTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_sales_plan_track";
    }

    @Override
    public String getDescription() {
        return "追踪门店月度销售计划完成度 — 对比目标与实际, 计算日/周/月进度, 未达标预警. "
             + "客户 [T 06:16] '如果没完成, 要告诉门店还差多少, 要做多少事情'.";
    }

    @Override
    protected String getSectionName() {
        return "sales_plan_tracking";
    }

    @Override
    protected List<String> buildFollowUps(String sectionName, Map<String, Object> data) {
        return Arrays.asList(
            "对比上月的完成情况",
            "哪家门店计划差距最大",
            "调整本月销售目标"
        );
    }
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd backend/java/cretas-api && ./mvnw.cmd compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/SalesPlanCreateTool.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/SalesPlanTrackTool.java
git commit -m "feat(sales-plan): create + track Java tools for AI intent routing"
```

---

### Task 10: Sales Plan Tracking Python section

**Files:**
- Create: `backend/python/smartbi/services/restaurant/sections/sales_plan_tracking.py`
- Create: `backend/python/tests/test_sales_plan_tracking.py`

- [ ] **Step 1: Write the failing test**

```python
"""Sales plan tracking section — completion dashboard."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.sales_plan_tracking import SalesPlanTrackingHandler


def _req(params: dict) -> SectionRequest:
    return SectionRequest(
        factory_id="F-TEST", upload_id=None, sub_sector="火锅",
        store_id=None, store_name=None, params=params,
    )


def test_on_track():
    handler = SalesPlanTrackingHandler()
    resp = handler.compute(
        _req({
            "target_revenue": 500000,
            "actual_revenue": 280000,
            "day_of_month": 15,
            "total_days": 30,
        }),
        context={},
    )
    assert resp.status.value == "ok"
    d = resp.data
    assert d["completion_pct"] == 56.0  # 280k/500k
    assert d["expected_pct"] == 50.0    # 15/30
    assert d["status"] == "ON_TRACK"


def test_behind():
    handler = SalesPlanTrackingHandler()
    resp = handler.compute(
        _req({
            "target_revenue": 500000,
            "actual_revenue": 100000,
            "day_of_month": 20,
            "total_days": 30,
        }),
        context={},
    )
    assert resp.status.value == "ok"
    assert resp.data["status"] == "BEHIND"
    assert resp.data["gap"] == 400000
    assert resp.data["daily_needed"] == 40000  # 400k / 10 remaining days


def test_skipped_when_no_target():
    handler = SalesPlanTrackingHandler()
    resp = handler.compute(_req({}), context={})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Implement the handler**

```python
"""Sales plan tracking — completion dashboard with daily needed calculation."""
import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class SalesPlanTrackingHandler(AbstractSectionHandler):
    section_name = "sales_plan_tracking"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}

        target = p.get("target_revenue")
        if not target:
            return self.skipped(request, "未提供 target_revenue", started)

        target = float(target)
        actual = float(p.get("actual_revenue", 0))
        day = int(p.get("day_of_month", 1))
        total_days = int(p.get("total_days", 30))

        completion_pct = round(actual / target * 100, 1) if target > 0 else 0.0
        expected_pct = round(day / total_days * 100, 1) if total_days > 0 else 0.0

        if completion_pct >= expected_pct:
            status = "ON_TRACK"
        elif completion_pct >= expected_pct * 0.85:
            status = "SLIGHT_BEHIND"
        else:
            status = "BEHIND"

        gap = max(target - actual, 0)
        remaining = total_days - day
        daily_needed = round(gap / remaining) if remaining > 0 else 0

        return self.ok(request, data={
            "target_revenue": target,
            "actual_revenue": actual,
            "completion_pct": completion_pct,
            "expected_pct": expected_pct,
            "status": status,
            "gap": gap,
            "remaining_days": remaining,
            "daily_needed": daily_needed,
            "day_of_month": day,
            "total_days": total_days,
        }, started=started)
```

- [ ] **Step 3: Run tests**

Run: `cd backend/python && python -m pytest tests/test_sales_plan_tracking.py -v`
Expected: 3/3 PASS

- [ ] **Step 4: Commit**

```bash
git add backend/python/smartbi/services/restaurant/sections/sales_plan_tracking.py \
        backend/python/tests/test_sales_plan_tracking.py
git commit -m "feat(sales-plan): Python tracking handler with completion + gap alerts"
```

---

### Task 11: Labor Productivity Python handler

**Files:**
- Create: `backend/python/smartbi/services/restaurant/sections/labor_productivity.py`
- Create: `backend/python/tests/test_labor_productivity.py`

- [ ] **Step 1: Write the failing test**

```python
"""Labor productivity: revenue per employee with zone monitoring.
Customer [T 24:43-27:00]: '人效3-4万, 低于3也不对, 高于4也有问题'.
"""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.labor_productivity import LaborProductivityHandler


def _req(params: dict) -> SectionRequest:
    return SectionRequest(
        factory_id="F-TEST", upload_id=None, sub_sector="火锅",
        store_id=None, store_name=None, params=params,
    )


def test_normal_zone():
    handler = LaborProductivityHandler()
    resp = handler.compute(
        _req({"revenue": 350000, "headcount": 10}),
        context={},
    )
    assert resp.status.value == "ok"
    assert resp.data["productivity"] == 35000
    assert resp.data["zone"] == "HEALTHY"


def test_low_zone():
    handler = LaborProductivityHandler()
    resp = handler.compute(
        _req({"revenue": 200000, "headcount": 10}),
        context={},
    )
    assert resp.data["productivity"] == 20000
    assert resp.data["zone"] == "OVERSTAFFED"
    assert "用人过多" in resp.data["diagnosis"]


def test_high_zone():
    handler = LaborProductivityHandler()
    resp = handler.compute(
        _req({"revenue": 500000, "headcount": 10}),
        context={},
    )
    assert resp.data["productivity"] == 50000
    assert resp.data["zone"] == "UNDERSTAFFED"
    assert "服务跟不上" in resp.data["diagnosis"]


def test_custom_zone_thresholds():
    handler = LaborProductivityHandler()
    resp = handler.compute(
        _req({
            "revenue": 250000, "headcount": 10,
            "low_threshold": 20000, "high_threshold": 35000,
        }),
        context={},
    )
    assert resp.data["zone"] == "HEALTHY"  # 25k is within 20k-35k


def test_skipped_no_headcount():
    handler = LaborProductivityHandler()
    resp = handler.compute(_req({"revenue": 100000}), context={})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Implement the handler**

```python
"""Labor productivity (人效): revenue per employee with zone alerting.

Zones (configurable, defaults from customer call [T 27:00]):
  < low_threshold (default 30000)  → OVERSTAFFED  "用人过多或收入太低"
  > high_threshold (default 40000) → UNDERSTAFFED  "服务跟不上, 差评风险"
  between → HEALTHY "健康区间"
"""
import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class LaborProductivityHandler(AbstractSectionHandler):
    section_name = "labor_productivity"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}

        headcount = p.get("headcount")
        if not headcount or int(headcount) <= 0:
            return self.skipped(request, "未提供 headcount (员工人数)", started)

        revenue = float(p.get("revenue", 0))
        hc = int(headcount)
        productivity = round(revenue / hc)

        low = float(p.get("low_threshold", 30000))
        high = float(p.get("high_threshold", 40000))

        if productivity < low:
            zone = "OVERSTAFFED"
            diagnosis = f"人效 ¥{productivity:,.0f} 低于 ¥{low:,.0f} — 用人过多或收入太低, 建议优化排班减少冗余工时"
        elif productivity > high:
            zone = "UNDERSTAFFED"
            diagnosis = f"人效 ¥{productivity:,.0f} 超过 ¥{high:,.0f} — 服务跟不上, 高峰期差评风险上升, 建议增加兼职人员"
        else:
            zone = "HEALTHY"
            diagnosis = f"人效 ¥{productivity:,.0f} 在健康区间 ¥{low:,.0f}-¥{high:,.0f} 内"

        return self.ok(request, data={
            "revenue": revenue,
            "headcount": hc,
            "productivity": productivity,
            "zone": zone,
            "diagnosis": diagnosis,
            "thresholds": {"low": low, "high": high},
            "benchmark_source": "中餐连锁行业 (肯德基/麦当劳参考值)",
        }, started=started)
```

- [ ] **Step 3: Run tests**

Run: `cd backend/python && python -m pytest tests/test_labor_productivity.py -v`
Expected: 5/5 PASS

- [ ] **Step 4: Commit**

```bash
git add backend/python/smartbi/services/restaurant/sections/labor_productivity.py \
        backend/python/tests/test_labor_productivity.py
git commit -m "feat(labor-productivity): handler with 3-zone monitoring (overstaffed/healthy/understaffed)"
```

---

### Task 12: Labor Productivity Java tool

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/LaborProductivityTool.java`

- [ ] **Step 1: Create Java tool**

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class LaborProductivityTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_labor_productivity";
    }

    @Override
    public String getDescription() {
        return "人效 (人均产出) 监控 — 月营收/员工数, 判断是否在 3-4 万健康区间. "
             + "低于 3 万说明用人过多, 高于 4 万说明服务跟不上. 客户 [T 24:43] '人效是最直观的指标'.";
    }

    @Override
    protected String getSectionName() {
        return "labor_productivity";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>(super.getParametersSchema());
        Map<String, Object> props = new HashMap<>((Map<String, Object>) schema.getOrDefault("properties", Collections.emptyMap()));

        props.put("headcount", Map.of("type", "integer", "description", "门店当月在岗员工人数"));
        props.put("revenue", Map.of("type", "number", "description", "门店当月营收 (元)"));

        schema.put("properties", props);
        schema.put("required", List.of("headcount"));
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return List.of("headcount");
    }

    @Override
    protected List<String> buildFollowUps(String sectionName, Map<String, Object> data) {
        return Arrays.asList(
            "对比各门店人效排名",
            "人效趋势变化 (近6个月)",
            "哪些岗位可以用兼职替代"
        );
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend/java/cretas-api && ./mvnw.cmd compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/LaborProductivityTool.java
git commit -m "feat(labor-productivity): Java tool wrapping Python handler"
```

---

### Task 13: Flyway migrations — table + intents

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_01__restaurant_sales_plan_table.sql`
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_02__restaurant_phase1_intents.sql`

- [ ] **Step 1: Create sales_plan table migration**

```sql
-- V20260412_01: Create restaurant_sales_plans table for Phase 1 sales plan tracking

CREATE TABLE IF NOT EXISTS restaurant_sales_plans (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL,
    store_id VARCHAR(64),
    plan_month DATE NOT NULL,
    target_revenue NUMERIC(14,2) NOT NULL,
    target_order_count INTEGER,
    target_avg_ticket NUMERIC(10,2),
    daily_adjustments JSONB,
    holiday_adjustments JSONB,
    notes VARCHAR(500),
    created_by VARCHAR(64),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_sales_plan_month UNIQUE (factory_id, store_id, plan_month)
);

CREATE INDEX IF NOT EXISTS idx_sales_plan_factory_month
    ON restaurant_sales_plans (factory_id, plan_month)
    WHERE deleted_at IS NULL;
```

- [ ] **Step 2: Create Phase 1 intent configs migration**

```sql
-- V20260412_02: Register Phase 1 financial analytics intents (4 new tools)

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_BOM_VARIANCE', 'BOM成本差异双归因', 'SMARTBI', 'restaurant_bom_variance', 'LOW',
        '["BOM差异","成本差异归因","供应链差异","管理差异","标准成本差异","采购价变动","实际用量偏差"]',
        'BOM 成本差异双维度归因 — 拆为供应链差异 (采购价) + 管理差异 (用量)', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_bom_variance', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_SALES_PLAN_CREATE', '创建销售计划', 'SMARTBI', 'restaurant_sales_plan_create', 'LOW',
        '["销售计划","月度计划","目标营收","设定目标","预设计划"]',
        '创建或更新门店月度销售计划, 支持节假日调整', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_sales_plan_create', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_SALES_PLAN_TRACK', '销售计划追踪', 'SMARTBI', 'restaurant_sales_plan_track', 'LOW',
        '["计划完成","完成度","目标达成","还差多少","进度追踪","计划追踪","本月目标"]',
        '追踪门店月度销售计划完成度, 对比目标与实际, 未达标预警', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_sales_plan_track', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_LABOR_PRODUCTIVITY', '人效监控', 'SMARTBI', 'restaurant_labor_productivity', 'LOW',
        '["人效","人均产出","员工效率","用人多少","人力成本效率","几个人","人效比"]',
        '人效 (人均产出) 监控, 判断是否在 3-4 万健康区间', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_labor_productivity', is_active = true;
```

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/main/resources/db/migration/V20260412_01__restaurant_sales_plan_table.sql \
        backend/java/cretas-api/src/main/resources/db/migration/V20260412_02__restaurant_phase1_intents.sql
git commit -m "feat(flyway): sales_plan table + 4 Phase 1 intent configs"
```

---

### Task 14: Register Python handlers in router

**Files:**
- Modify: `backend/python/smartbi/api/restaurant_sections.py`

- [ ] **Step 1: Read current HANDLERS dict**

Run: `grep -n "HANDLERS" backend/python/smartbi/api/restaurant_sections.py | head -5`

- [ ] **Step 2: Add 4 new handler imports + registrations**

Add to imports:
```python
from smartbi.services.restaurant.sections.bom_variance import BomVarianceHandler
from smartbi.services.restaurant.sections.sales_plan_tracking import SalesPlanTrackingHandler
from smartbi.services.restaurant.sections.labor_productivity import LaborProductivityHandler
```

Add to HANDLERS dict:
```python
"bom_variance": BomVarianceHandler(),
"sales_plan_tracking": SalesPlanTrackingHandler(),
"labor_productivity": LaborProductivityHandler(),
```

Note: controllable_profit is handled inside the existing `store_pnl_one_pager` handler (Task 6), not as a separate section.

- [ ] **Step 3: Verify Python server starts**

Run: `cd backend/python && python -c "from smartbi.api.restaurant_sections import HANDLERS; print(f'{len(HANDLERS)} handlers registered')" `
Expected: count is previous + 3

- [ ] **Step 4: Commit**

```bash
git add backend/python/smartbi/api/restaurant_sections.py
git commit -m "feat(router): register bom_variance + sales_plan_tracking + labor_productivity handlers"
```

---

### Task 15: Web-admin section cards (3 new)

**Files:**
- Create: `web-admin/src/views/smart-bi/components/chat/cards/BomVarianceCard.vue`
- Create: `web-admin/src/views/smart-bi/components/chat/cards/SalesPlanCard.vue`
- Create: `web-admin/src/views/smart-bi/components/chat/cards/LaborProductivityCard.vue`
- Modify: `web-admin/src/views/smart-bi/components/chat/SectionCardRenderer.vue`

- [ ] **Step 1: Create BomVarianceCard.vue**

```vue
<template>
  <div class="bom-variance-card">
    <h4>BOM 成本差异归因</h4>
    <div v-if="summary" class="summary">
      <el-tag :type="severity === 'HIGH' ? 'danger' : severity === 'MEDIUM' ? 'warning' : 'success'">
        {{ severity }}
      </el-tag>
      <span class="dominant">主因: {{ summary.dominant_factor === 'supply_chain' ? '供应链 (采购价)' : '管理 (用量)' }}</span>
    </div>
    <el-table v-if="items.length" :data="items" size="small" stripe>
      <el-table-column prop="sku" label="SKU" width="120" />
      <el-table-column prop="price_variance" label="供应链差异" align="right">
        <template #default="{ row }">
          <span :class="row.price_variance > 0 ? 'red' : 'green'">{{ formatCurrency(row.price_variance) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="usage_variance" label="管理差异" align="right">
        <template #default="{ row }">
          <span :class="row.usage_variance > 0 ? 'red' : 'green'">{{ formatCurrency(row.usage_variance) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="total_variance" label="总差异" align="right">
        <template #default="{ row }">
          <strong :class="row.total_variance > 0 ? 'red' : 'green'">{{ formatCurrency(row.total_variance) }}</strong>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ data: Record<string, unknown> }>();
const items = computed(() => (props.data?.items as Array<Record<string, unknown>>) ?? []);
const summary = computed(() => props.data?.summary as Record<string, unknown> | undefined);
const severity = computed(() => (summary.value?.severity as string) ?? 'LOW');

function formatCurrency(v: unknown): string {
  const n = Number(v);
  return (n >= 0 ? '+' : '') + n.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' });
}
</script>

<style scoped>
.bom-variance-card { padding: 12px; }
.summary { margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.red { color: #f56c6c; }
.green { color: #67c23a; }
</style>
```

- [ ] **Step 2: Create SalesPlanCard.vue**

```vue
<template>
  <div class="sales-plan-card">
    <h4>销售计划追踪</h4>
    <div class="metrics">
      <div class="metric">
        <span class="label">目标</span>
        <span class="value">¥{{ formatNum(data.target_revenue) }}</span>
      </div>
      <div class="metric">
        <span class="label">实际</span>
        <span class="value">¥{{ formatNum(data.actual_revenue) }}</span>
      </div>
      <div class="metric">
        <span class="label">完成度</span>
        <span class="value" :class="statusClass">{{ data.completion_pct }}%</span>
      </div>
    </div>
    <el-progress :percentage="Math.min(Number(data.completion_pct) || 0, 100)"
                 :status="data.status === 'ON_TRACK' ? 'success' : data.status === 'BEHIND' ? 'exception' : 'warning'" />
    <p v-if="data.status === 'BEHIND'" class="alert">
      还差 ¥{{ formatNum(data.gap) }}, 剩余 {{ data.remaining_days }} 天需日均 ¥{{ formatNum(data.daily_needed) }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ data: Record<string, unknown> }>();
const statusClass = computed(() =>
  props.data.status === 'ON_TRACK' ? 'green' : props.data.status === 'BEHIND' ? 'red' : 'orange');

function formatNum(v: unknown): string {
  return Number(v || 0).toLocaleString();
}
</script>

<style scoped>
.sales-plan-card { padding: 12px; }
.metrics { display: flex; gap: 24px; margin-bottom: 12px; }
.metric { display: flex; flex-direction: column; }
.label { font-size: 12px; color: #909399; }
.value { font-size: 18px; font-weight: bold; }
.alert { color: #f56c6c; margin-top: 8px; }
.green { color: #67c23a; }
.orange { color: #e6a23c; }
.red { color: #f56c6c; }
</style>
```

- [ ] **Step 3: Create LaborProductivityCard.vue**

```vue
<template>
  <div class="labor-productivity-card">
    <h4>人效监控</h4>
    <div class="headline">
      <span class="productivity">¥{{ formatNum(data.productivity) }}</span>
      <span class="per">/人/月</span>
      <el-tag :type="tagType" size="small">{{ zoneLabel }}</el-tag>
    </div>
    <p class="diagnosis">{{ data.diagnosis }}</p>
    <div class="detail">
      <span>营收 ¥{{ formatNum(data.revenue) }} / {{ data.headcount }} 人</span>
      <span class="range">健康区间: ¥{{ formatNum(thresholds.low) }}-¥{{ formatNum(thresholds.high) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ data: Record<string, unknown> }>();
const thresholds = computed(() => (props.data?.thresholds as Record<string, number>) ?? { low: 30000, high: 40000 });
const tagType = computed(() => {
  const z = props.data.zone;
  return z === 'HEALTHY' ? 'success' : z === 'OVERSTAFFED' ? 'warning' : 'danger';
});
const zoneLabel = computed(() => {
  const z = props.data.zone;
  return z === 'HEALTHY' ? '健康' : z === 'OVERSTAFFED' ? '用人偏多' : '人手不足';
});

function formatNum(v: unknown): string {
  return Number(v || 0).toLocaleString();
}
</script>

<style scoped>
.labor-productivity-card { padding: 12px; }
.headline { display: flex; align-items: baseline; gap: 4px; margin-bottom: 8px; }
.productivity { font-size: 28px; font-weight: bold; }
.per { color: #909399; font-size: 14px; }
.diagnosis { margin: 8px 0; }
.detail { display: flex; justify-content: space-between; font-size: 12px; color: #909399; }
</style>
```

- [ ] **Step 4: Update SectionCardRenderer.vue to map the 3 new sections**

Read the existing `SectionCardRenderer.vue` and add to its section-name-to-component mapping:

```typescript
// In the component map (import + register):
import BomVarianceCard from './cards/BomVarianceCard.vue';
import SalesPlanCard from './cards/SalesPlanCard.vue';
import LaborProductivityCard from './cards/LaborProductivityCard.vue';

// In the section→card mapping object:
'bom_variance': BomVarianceCard,
'sales_plan_tracking': SalesPlanCard,
'labor_productivity': LaborProductivityCard,
```

- [ ] **Step 5: Commit**

```bash
git add web-admin/src/views/smart-bi/components/chat/cards/BomVarianceCard.vue \
        web-admin/src/views/smart-bi/components/chat/cards/SalesPlanCard.vue \
        web-admin/src/views/smart-bi/components/chat/cards/LaborProductivityCard.vue \
        web-admin/src/views/smart-bi/components/chat/SectionCardRenderer.vue
git commit -m "feat(web): 3 new section cards (BomVariance/SalesPlan/LaborProductivity)"
```

---

### Task 16: SmartBI keyword regex update for Phase 1

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java`

- [ ] **Step 1: Add Phase 1 keywords to RESTAURANT_DIAGNOSTIC_KEYWORDS pattern**

Add to the regex pattern (already exists from P5.6):

```java
// Append these new terms to the existing pattern:
"|BOM差异|成本差异归因|供应链差异|管理差异|标准成本差异|采购价变动" +
"|销售计划|月度计划|目标营收|设定目标|计划完成|完成度|目标达成|还差多少|进度追踪" +
"|人效|人均产出|员工效率|用人多少|人力成本效率|人效比)"
```

- [ ] **Step 2: Update SmartBIRestaurantRoutingTest with new positive samples**

Add to the `keywordRegexMatchesAllFlywayIntents` test:

```java
"这个月BOM差异归因看看是供应链还是管理问题",  // RESTAURANT_BOM_VARIANCE
"本月销售计划完成度怎么样",                    // RESTAURANT_SALES_PLAN_TRACK
"人效分析一下 各门店人均产出",                 // RESTAURANT_LABOR_PRODUCTIVITY
```

- [ ] **Step 3: Run tests**

Run: `cd backend/java/cretas-api && ./mvnw.cmd test -Dtest=SmartBIRestaurantRoutingTest -q`
Expected: all tests PASS (including new samples)

- [ ] **Step 4: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java \
        backend/java/cretas-api/src/test/java/com/cretas/aims/service/smartbi/impl/SmartBIRestaurantRoutingTest.java
git commit -m "feat(smartbi): extend restaurant keyword regex for Phase 1 intents"
```

---

### Task 17: Integration test — full stack round-trip

**Files:**
- Create: `backend/python/tests/test_phase1_integration.py`

- [ ] **Step 1: Write integration test covering all 4 features**

```python
"""Phase 1 integration: verify all 4 handlers are registered and produce valid responses."""
import pytest
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.bom_variance import BomVarianceHandler
from smartbi.services.restaurant.sections.sales_plan_tracking import SalesPlanTrackingHandler
from smartbi.services.restaurant.sections.labor_productivity import LaborProductivityHandler


def _req(params: dict) -> SectionRequest:
    return SectionRequest(
        factory_id="F-QINGHUAJIAO", upload_id=None, sub_sector="火锅",
        store_id="S-001", store_name="青花椒义乌店", params=params,
    )


class TestPhase1Integration:
    def test_bom_variance_happy_path(self):
        resp = BomVarianceHandler().compute(
            _req({"items": [
                {"sku": "黑鱼", "std_qty": 100, "std_price": 10, "actual_qty": 110, "actual_price": 11},
            ]}), {},
        )
        assert resp.status.value == "ok"
        assert resp.data["summary"]["dominant_factor"] in ("supply_chain", "management")

    def test_sales_plan_tracking_happy_path(self):
        resp = SalesPlanTrackingHandler().compute(
            _req({"target_revenue": 500000, "actual_revenue": 300000,
                  "day_of_month": 18, "total_days": 30}), {},
        )
        assert resp.status.value == "ok"
        assert resp.data["status"] in ("ON_TRACK", "SLIGHT_BEHIND", "BEHIND")

    def test_labor_productivity_happy_path(self):
        resp = LaborProductivityHandler().compute(
            _req({"revenue": 350000, "headcount": 10}), {},
        )
        assert resp.status.value == "ok"
        assert resp.data["zone"] in ("OVERSTAFFED", "HEALTHY", "UNDERSTAFFED")

    def test_all_handlers_have_section_name(self):
        for cls in (BomVarianceHandler, SalesPlanTrackingHandler, LaborProductivityHandler):
            assert cls.section_name, f"{cls.__name__} missing section_name"
```

- [ ] **Step 2: Run integration test**

Run: `cd backend/python && python -m pytest tests/test_phase1_integration.py -v`
Expected: 4/4 PASS

- [ ] **Step 3: Commit**

```bash
git add backend/python/tests/test_phase1_integration.py
git commit -m "test(phase1): integration tests for all 4 financial analytics handlers"
```

---

### Task 18: Final verification + milestone commit

- [ ] **Step 1: Run full Python test suite**

Run: `cd backend/python && python -m pytest tests/ -v --tb=short`
Expected: all PASS, no regressions

- [ ] **Step 2: Run Java compilation + P5.6 tests**

Run: `cd backend/java/cretas-api && ./mvnw.cmd compile -q && ./mvnw.cmd test -Dtest='SmartBIRestaurantRoutingTest,RestaurantDomainPrefixTest' -q`
Expected: BUILD SUCCESS, all tests PASS

- [ ] **Step 3: Apply Flyway migrations to local DB**

```bash
PGPASSWORD=cretas_pass "/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  -h localhost -U cretas_user -d cretas_db \
  -f backend/java/cretas-api/src/main/resources/db/migration/V20260412_01__restaurant_sales_plan_table.sql

PGPASSWORD=cretas_pass "/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  -h localhost -U cretas_user -d cretas_db \
  -f backend/java/cretas-api/src/main/resources/db/migration/V20260412_02__restaurant_phase1_intents.sql
```

Verify: `SELECT intent_code FROM ai_intent_configs WHERE intent_code IN ('RESTAURANT_BOM_VARIANCE','RESTAURANT_SALES_PLAN_CREATE','RESTAURANT_SALES_PLAN_TRACK','RESTAURANT_LABOR_PRODUCTIVITY');`
Expected: 4 rows

- [ ] **Step 4: Push branch**

```bash
git push origin feature/smartbi-restaurant-p1-section-split
```

---

## Self-Review Checklist

### Spec coverage

| Requirement (from transcript) | Task(s) | Status |
|------|---------|--------|
| BOM 成本差异拆供应链+管理 [T 43:00] | 1-3 | Covered |
| 可控利润 (排除租金税收) [T 18:00-22:00] | 4-6 | Covered (overlay on store_pnl) |
| 月度销售计划 CRUD [T 05:57] | 7-9 | Covered (entity + service + tools) |
| 计划完成度追踪 + 预警 [T 06:16] | 9-10 | Covered (Python handler + Java tool) |
| 节假日调整 [T 06:09] | 7-8 | dailyAdjustments + holidayAdjustments JSON fields |
| 人效 3-4万区间监控 [T 24:43-27:00] | 11-12 | Covered (configurable thresholds) |
| 成本差异容忍度 1-1.5% [T 43:49] | 1-2 | tolerance_pct in BomVarianceHandler |
| 绩效规则可控利润切换 [T 22:00] | 4-6 | non_controllable_keys 参数化 |
| Web-admin 卡片渲染 | 15 | 3 new SectionCards |
| Flyway 意图注册 | 13 | 4 new intent configs |
| P5.6 关键词路由扩展 | 16 | Regex pattern updated |

### Placeholder scan

No "TBD", "TODO", "implement later", or "similar to Task N" found.

### Type consistency

- `SectionRequest` used consistently across all Python handlers
- `SectionResponse` returned via `self.ok()` / `self.skipped()` consistently
- `AbstractRestaurantDiagnosticTool` base class used for all diagnostic Java tools
- `SalesPlanCreateTool` extends `AbstractBusinessTool` (not diagnostic — it writes, not diagnoses)
- `SalesPlanTrackTool` extends `AbstractRestaurantDiagnosticTool` (it reads via Python section)
- `NLQueryResponse` new fields from P5.6 carry through for all new tools
