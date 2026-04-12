# 青花椒 Option C · Phase 2: Operational Intelligence (Week 3-4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 4 operational intelligence features: seat configuration analysis, combo meal split statistics, supplier return anomaly detection, and review-based competitive analysis.

**Architecture:** Same pattern as Phase 1 — `AbstractSectionHandler` (Python) + `AbstractRestaurantDiagnosticTool` (Java). Seat configuration adds a `StoreSeatConfig` JPA entity for per-store table layout. All features route through the P5.6 keyword-gated Tool-Skill pipeline.

**Tech Stack:** Java 21 / Spring Boot 3.2 / Python 3.8+ FastAPI / PostgreSQL / Vue 3 + Element Plus

**Source:** Customer call transcript `[T mm:ss]` references.

---

## File Structure

### F1. Seat Configuration Analysis (Tasks 1-5)

- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/restaurant/StoreSeatConfig.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/restaurant/StoreSeatConfigRepository.java`
- Create: `backend/python/smartbi/services/restaurant/sections/seat_occupancy.py`
- Create: `backend/python/tests/test_seat_occupancy.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/SeatOccupancyTool.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/SeatConfigManageTool.java`

### F2. Combo Split Analysis (Tasks 6-8)

- Create: `backend/python/smartbi/services/restaurant/sections/combo_split.py`
- Create: `backend/python/tests/test_combo_split.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/ComboSplitTool.java`

### F3. Return Anomaly Attribution (Tasks 9-11)

- Create: `backend/python/smartbi/services/restaurant/sections/return_anomaly.py`
- Create: `backend/python/tests/test_return_anomaly.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/ReturnAnomalyTool.java`

### F4. Review Competitive Analysis (Tasks 12-14)

- Create: `backend/python/smartbi/services/restaurant/sections/review_competitive.py`
- Create: `backend/python/tests/test_review_competitive.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/ReviewCompetitiveTool.java`

### F5. Wiring (Tasks 15-16)

- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_03__restaurant_store_seat_config.sql`
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_04__restaurant_phase2_intents.sql`
- Modify: `backend/python/smartbi/api/restaurant_sections.py` (register 4 new handlers)
- Create: `web-admin/src/views/smart-bi/components/chat/cards/SeatOccupancyCard.vue`
- Create: `web-admin/src/views/smart-bi/components/chat/cards/ComboSplitCard.vue`
- Create: `web-admin/src/views/smart-bi/components/chat/cards/ReturnAnomalyCard.vue`
- Create: `web-admin/src/views/smart-bi/components/chat/cards/ReviewCompetitiveCard.vue`
- Modify: `web-admin/src/views/smart-bi/components/chat/SectionCardRenderer.vue`
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java` (keyword regex)

---

## Tasks

### Task 1: StoreSeatConfig JPA entity + repository

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/restaurant/StoreSeatConfig.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/restaurant/StoreSeatConfigRepository.java`

- [ ] **Step 1: Create entity**

```java
package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "store_seat_configs",
       uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "store_id", "table_number"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class StoreSeatConfig extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    @Column(name = "store_id", nullable = false, length = 64)
    private String storeId;

    /** Table number as seen on the POS (二维火 table ID). */
    @Column(name = "table_number", nullable = false, length = 32)
    private String tableNumber;

    /** Number of seats at this table (2/4/6/8/10/12). */
    @Column(name = "seat_count", nullable = false)
    private Integer seatCount;

    /** Table zone/area label, e.g. "大厅", "包间", "露台". */
    @Column(name = "zone", length = 64)
    private String zone;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}
```

- [ ] **Step 2: Create repository**

```java
package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.StoreSeatConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository
public interface StoreSeatConfigRepository extends JpaRepository<StoreSeatConfig, String> {

    List<StoreSeatConfig> findByFactoryIdAndStoreIdAndIsActiveTrue(String factoryId, String storeId);

    @Query("SELECT s.seatCount as seatCount, COUNT(s) as tableCount FROM StoreSeatConfig s " +
           "WHERE s.factoryId = :fid AND s.storeId = :sid AND s.isActive = true " +
           "GROUP BY s.seatCount ORDER BY s.seatCount")
    List<Map<String, Object>> countTablesBySeatCount(@Param("fid") String factoryId, @Param("sid") String storeId);
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd backend/java/cretas-api && ./mvnw.cmd compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/entity/restaurant/StoreSeatConfig.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/repository/restaurant/StoreSeatConfigRepository.java
git commit -m "feat(seat-config): StoreSeatConfig entity + repository for per-store table layout"
```

---

### Task 2: Seat Occupancy Python handler (TDD)

**Files:**
- Create: `backend/python/tests/test_seat_occupancy.py`
- Create: `backend/python/smartbi/services/restaurant/sections/seat_occupancy.py`

- [ ] **Step 1: Write the failing tests**

```python
"""Seat occupancy: analyze table utilization by seat count.
Customer [T 11:20-14:00]: '我想看桌子的占有率... 两人位是不是太少了'.
"""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.seat_occupancy import SeatOccupancyHandler


def _req(params: dict) -> SectionRequest:
    return SectionRequest(
        factory_id="F-TEST", upload_id=None, sub_sector="火锅",
        store_id="S-001", store_name="青花椒测试店", params=params,
    )


def test_basic_occupancy():
    handler = SeatOccupancyHandler()
    resp = handler.compute(
        _req({
            "seat_layout": {"2人位": 5, "4人位": 10, "6人位": 3, "8人位": 2},
            "party_distribution": {"1人": 20, "2人": 150, "3人": 40, "4人": 60, "5人": 15, "6人": 10, "8人": 5},
        }),
        context={},
    )
    assert resp.status.value == "ok"
    d = resp.data
    assert "seat_analysis" in d
    assert "recommendations" in d
    assert len(d["seat_analysis"]) == 4  # 4 seat types


def test_recommends_more_2_seaters_when_dominated():
    handler = SeatOccupancyHandler()
    resp = handler.compute(
        _req({
            "seat_layout": {"2人位": 2, "4人位": 15},
            "party_distribution": {"1人": 50, "2人": 200, "3人": 10, "4人": 20},
        }),
        context={},
    )
    assert resp.status.value == "ok"
    recs = resp.data["recommendations"]
    assert any("2人位" in r for r in recs)


def test_skipped_when_no_layout():
    handler = SeatOccupancyHandler()
    resp = handler.compute(_req({}), context={})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Implement handler**

```python
"""Seat occupancy analysis: match party sizes to table layout for optimal seating.

Customer [T 11:20-14:00] wants to know if current 2/4/6/8-seater mix is optimal.
Core logic: compare % of parties that fit each seat type vs % of tables available.
If 70% of parties are 1-2 people but only 25% of tables are 2-seaters → mismatch.
"""
import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class SeatOccupancyHandler(AbstractSectionHandler):
    section_name = "seat_occupancy"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}

        seat_layout = p.get("seat_layout")
        party_dist = p.get("party_distribution")

        if not seat_layout:
            return self.skipped(request, "未提供 seat_layout (桌位配置: {\"2人位\": 5, \"4人位\": 10, ...})", started)
        if not party_dist:
            return self.skipped(request, "未提供 party_distribution (客群分布: {\"2人\": 150, ...})", started)

        total_tables = sum(int(v) for v in seat_layout.values())
        total_parties = sum(int(v) for v in party_dist.values())

        if total_tables == 0 or total_parties == 0:
            return self.skipped(request, "桌位或客群数据为零", started)

        # Map party sizes to best-fit seat count (smallest seat that fits)
        seat_sizes = sorted(set(int(k.replace("人位", "")) for k in seat_layout.keys()))

        def best_fit_seat(party_size: int) -> int:
            for s in seat_sizes:
                if s >= party_size:
                    return s
            return seat_sizes[-1]  # largest available

        # Count demand per seat type
        demand = {s: 0 for s in seat_sizes}
        for party_key, count in party_dist.items():
            psize = int(party_key.replace("人", ""))
            fit = best_fit_seat(psize)
            demand[fit] += int(count)

        # Build analysis
        seat_analysis = []
        recommendations = []

        for seat_key, table_count in seat_layout.items():
            size = int(seat_key.replace("人位", ""))
            tc = int(table_count)
            table_pct = round(tc / total_tables * 100, 1)
            demand_count = demand.get(size, 0)
            demand_pct = round(demand_count / total_parties * 100, 1)
            gap = round(demand_pct - table_pct, 1)

            seat_analysis.append({
                "seat_type": seat_key,
                "seat_count": size,
                "table_count": tc,
                "table_pct": table_pct,
                "demand_count": demand_count,
                "demand_pct": demand_pct,
                "gap": gap,
                "status": "SHORTAGE" if gap > 10 else "SURPLUS" if gap < -10 else "BALANCED",
            })

            if gap > 10:
                recommendations.append(f"{seat_key} 供不应求 (需求 {demand_pct}% vs 供给 {table_pct}%), 建议增加")
            elif gap < -10:
                recommendations.append(f"{seat_key} 供过于求 (需求 {demand_pct}% vs 供给 {table_pct}%), 可考虑拆分为更小桌位")

        if not recommendations:
            recommendations.append("当前桌位配置基本匹配客群分布, 无需调整")

        return self.ok(request, data={
            "seat_analysis": seat_analysis,
            "recommendations": recommendations,
            "total_tables": total_tables,
            "total_parties": total_parties,
            "methodology": "best_fit_seat_matching",
        }, started=started)
```

- [ ] **Step 3: Run tests**

Run: `cd backend/python && python -m pytest tests/test_seat_occupancy.py -v`
Expected: 3/3 PASS

- [ ] **Step 4: Commit**

```bash
git add backend/python/smartbi/services/restaurant/sections/seat_occupancy.py \
        backend/python/tests/test_seat_occupancy.py
git commit -m "feat(seat-occupancy): handler matching party sizes to table layout"
```

---

### Task 3: Seat Occupancy Java tool + Seat Config manage tool

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/SeatOccupancyTool.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/SeatConfigManageTool.java`

- [ ] **Step 1: Create SeatOccupancyTool (diagnostic, reads via Python)**

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class SeatOccupancyTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() { return "restaurant_seat_occupancy"; }

    @Override
    public String getDescription() {
        return "桌位配置分析 — 对比实际客群人数分布与桌位配置, 识别 2/4/6/8 人位是否匹配. "
             + "客户 [T 11:20] '我想看桌子占有率, 两人位是不是太少了'.";
    }

    @Override
    protected String getSectionName() { return "seat_occupancy"; }

    @Override
    protected List<String> buildFollowUps(String sectionName, Map<String, Object> data) {
        return Arrays.asList(
            "各门店桌位利用率对比",
            "高峰时段的等位情况分析",
            "按时段拆分客群人数分布"
        );
    }
}
```

- [ ] **Step 2: Create SeatConfigManageTool (write tool for CRUD)**

```java
package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.restaurant.StoreSeatConfig;
import com.cretas.aims.repository.restaurant.StoreSeatConfigRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class SeatConfigManageTool extends AbstractBusinessTool {

    @Autowired
    private StoreSeatConfigRepository repository;

    @Override
    public String getToolName() { return "restaurant_seat_config_manage"; }

    @Override
    public String getDescription() {
        return "管理门店桌位配置 — 录入每张桌子的桌位大小 (2/4/6/8人位), 用于桌位占有率分析.";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "store_id", Map.of("type", "string", "description", "门店ID"),
                "tables", Map.of("type", "array", "description", "桌位列表 [{table_number, seat_count, zone}]")
            ),
            "required", List.of("store_id", "tables")
        );
    }

    @Override
    protected List<String> getRequiredParameters() { return List.of("store_id", "tables"); }

    @Override
    public boolean supportsPreview() { return true; }

    @Override
    @SuppressWarnings("unchecked")
    protected Map<String, Object> doExecute(String factoryId,
            Map<String, Object> params, Map<String, Object> context) throws Exception {
        String storeId = getString(params, "store_id");
        List<Map<String, Object>> tables = (List<Map<String, Object>>) params.get("tables");

        int created = 0, updated = 0;
        for (Map<String, Object> t : tables) {
            String tableNumber = String.valueOf(t.get("table_number"));
            int seatCount = Integer.parseInt(String.valueOf(t.get("seat_count")));
            String zone = t.get("zone") != null ? String.valueOf(t.get("zone")) : null;

            StoreSeatConfig existing = repository
                .findByFactoryIdAndStoreIdAndIsActiveTrue(factoryId, storeId)
                .stream()
                .filter(s -> s.getTableNumber().equals(tableNumber))
                .findFirst()
                .orElse(null);

            if (existing != null) {
                existing.setSeatCount(seatCount);
                existing.setZone(zone);
                repository.save(existing);
                updated++;
            } else {
                repository.save(StoreSeatConfig.builder()
                    .factoryId(factoryId)
                    .storeId(storeId)
                    .tableNumber(tableNumber)
                    .seatCount(seatCount)
                    .zone(zone)
                    .build());
                created++;
            }
        }

        return buildSimpleResult(
            String.format("桌位配置已更新: 新增 %d, 更新 %d", created, updated),
            Map.of("created", created, "updated", updated, "total", tables.size())
        );
    }
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd backend/java/cretas-api && ./mvnw.cmd compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/SeatOccupancyTool.java \
        backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/SeatConfigManageTool.java
git commit -m "feat(seat-config): diagnostic + management Java tools"
```

---

### Task 4: Combo Split Python handler (TDD)

**Files:**
- Create: `backend/python/tests/test_combo_split.py`
- Create: `backend/python/smartbi/services/restaurant/sections/combo_split.py`

- [ ] **Step 1: Write tests**

```python
"""Combo split: decompose set menu sales into constituent dishes.
Customer [T 04:55-05:50]: '套餐现在默认是一个商品, 需要拆分出来'.
"""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.combo_split import ComboSplitHandler


def _req(params: dict) -> SectionRequest:
    return SectionRequest(
        factory_id="F-TEST", upload_id=None, sub_sector="火锅",
        store_id=None, store_name=None, params=params,
    )


def test_basic_split():
    handler = ComboSplitHandler()
    resp = handler.compute(
        _req({
            "combos": [
                {
                    "combo_name": "双人套餐A",
                    "combo_sales": 80,
                    "dishes": [
                        {"dish": "麻辣牛肉", "qty_per_combo": 1},
                        {"dish": "酸菜鱼", "qty_per_combo": 1},
                        {"dish": "米饭", "qty_per_combo": 2},
                    ],
                },
            ],
            "single_sales": {
                "麻辣牛肉": 120,
                "酸菜鱼": 50,
                "米饭": 300,
            },
        }),
        context={},
    )
    assert resp.status.value == "ok"
    dishes = resp.data["dish_breakdown"]
    beef = next(d for d in dishes if d["dish"] == "麻辣牛肉")
    assert beef["single_sales"] == 120
    assert beef["combo_sales"] == 80  # 80 combos × 1 per combo
    assert beef["total_sales"] == 200
    assert beef["combo_pct"] == 40.0  # 80/200


def test_multi_combo():
    handler = ComboSplitHandler()
    resp = handler.compute(
        _req({
            "combos": [
                {"combo_name": "套餐A", "combo_sales": 50,
                 "dishes": [{"dish": "鱼头", "qty_per_combo": 1}]},
                {"combo_name": "套餐B", "combo_sales": 30,
                 "dishes": [{"dish": "鱼头", "qty_per_combo": 2}]},
            ],
            "single_sales": {"鱼头": 100},
        }),
        context={},
    )
    fish = next(d for d in resp.data["dish_breakdown"] if d["dish"] == "鱼头")
    assert fish["combo_sales"] == 110  # 50*1 + 30*2
    assert fish["total_sales"] == 210


def test_skipped_no_combos():
    handler = ComboSplitHandler()
    resp = handler.compute(_req({}), context={})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Implement handler**

```python
"""Combo split: decompose set menu sales into constituent dish-level statistics."""
import time
from collections import defaultdict
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class ComboSplitHandler(AbstractSectionHandler):
    section_name = "combo_split"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}

        combos = p.get("combos")
        if not combos or not isinstance(combos, list):
            return self.skipped(request, "未提供 combos (套餐列表)", started)

        single_sales = p.get("single_sales", {})

        # Aggregate combo contributions per dish
        combo_qty = defaultdict(int)
        combo_detail = []

        for combo in combos:
            name = combo.get("combo_name", "未命名套餐")
            sales = int(combo.get("combo_sales", 0))
            dishes = combo.get("dishes", [])

            for d in dishes:
                dish_name = d.get("dish", "")
                qty = int(d.get("qty_per_combo", 1))
                combo_qty[dish_name] += sales * qty

            combo_detail.append({
                "combo_name": name,
                "combo_sales": sales,
                "dish_count": len(dishes),
            })

        # Merge with single sales
        all_dishes = set(combo_qty.keys()) | set(single_sales.keys())
        dish_breakdown = []

        for dish in sorted(all_dishes):
            single = int(single_sales.get(dish, 0))
            combo = combo_qty.get(dish, 0)
            total = single + combo
            combo_pct = round(combo / total * 100, 1) if total > 0 else 0.0

            dish_breakdown.append({
                "dish": dish,
                "single_sales": single,
                "combo_sales": combo,
                "total_sales": total,
                "combo_pct": combo_pct,
            })

        dish_breakdown.sort(key=lambda x: x["total_sales"], reverse=True)

        return self.ok(request, data={
            "dish_breakdown": dish_breakdown,
            "combo_summary": combo_detail,
            "total_dishes_tracked": len(dish_breakdown),
            "avg_combo_pct": round(
                sum(d["combo_pct"] for d in dish_breakdown) / len(dish_breakdown), 1
            ) if dish_breakdown else 0.0,
        }, started=started)
```

- [ ] **Step 3: Run tests**

Run: `cd backend/python && python -m pytest tests/test_combo_split.py -v`
Expected: 3/3 PASS

- [ ] **Step 4: Commit**

```bash
git add backend/python/smartbi/services/restaurant/sections/combo_split.py \
        backend/python/tests/test_combo_split.py
git commit -m "feat(combo-split): handler decomposing set menus into dish-level stats"
```

---

### Task 5: Combo Split Java tool

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/ComboSplitTool.java`

- [ ] **Step 1: Create tool**

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class ComboSplitTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() { return "restaurant_combo_split"; }

    @Override
    public String getDescription() {
        return "套餐拆单统计 — 把套餐商品拆分成实际菜品, 区分单点销量 vs 套餐内销量. "
             + "客户 [T 04:55] '套餐默认是一个商品, 需要拆分出来把它框到实际菜品上'.";
    }

    @Override
    protected String getSectionName() { return "combo_split"; }

    @Override
    protected List<String> buildFollowUps(String sectionName, Map<String, Object> data) {
        return Arrays.asList(
            "哪些菜品主要靠套餐带动销量",
            "套餐定价是否合理 (拆单后毛利)",
            "建议新增或调整哪些套餐组合"
        );
    }
}
```

- [ ] **Step 2: Verify compilation + commit**

Run: `cd backend/java/cretas-api && ./mvnw.cmd compile -q`

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/ComboSplitTool.java
git commit -m "feat(combo-split): Java tool wrapping Python combo split handler"
```

---

### Task 6: Return Anomaly Python handler (TDD)

**Files:**
- Create: `backend/python/tests/test_return_anomaly.py`
- Create: `backend/python/smartbi/services/restaurant/sections/return_anomaly.py`

- [ ] **Step 1: Write tests**

```python
"""Return anomaly: detect stores with abnormal return rates per supplier/batch.
Customer [T 06:40-08:00]: '四家门店叫了同一个供应商的货, 三家正常验收,
一家反复退货 — 要识别这个异常'.
"""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.return_anomaly import ReturnAnomalyHandler


def _req(params: dict) -> SectionRequest:
    return SectionRequest(
        factory_id="F-TEST", upload_id=None, sub_sector="火锅",
        store_id=None, store_name=None, params=params,
    )


def test_detects_anomaly():
    handler = ReturnAnomalyHandler()
    resp = handler.compute(
        _req({
            "deliveries": [
                {"store": "门店A", "supplier": "鲜鱼供应", "batch": "B001", "ordered": 100, "returned": 2},
                {"store": "门店B", "supplier": "鲜鱼供应", "batch": "B001", "ordered": 100, "returned": 3},
                {"store": "门店C", "supplier": "鲜鱼供应", "batch": "B001", "ordered": 100, "returned": 25},
                {"store": "门店D", "supplier": "鲜鱼供应", "batch": "B001", "ordered": 100, "returned": 1},
            ],
        }),
        context={},
    )
    assert resp.status.value == "ok"
    anomalies = resp.data["anomalies"]
    assert len(anomalies) == 1
    assert anomalies[0]["store"] == "门店C"
    assert anomalies[0]["return_pct"] == 25.0


def test_no_anomaly_when_all_normal():
    handler = ReturnAnomalyHandler()
    resp = handler.compute(
        _req({
            "deliveries": [
                {"store": "A", "supplier": "S1", "batch": "B1", "ordered": 100, "returned": 3},
                {"store": "B", "supplier": "S1", "batch": "B1", "ordered": 100, "returned": 4},
            ],
        }),
        context={},
    )
    assert resp.status.value == "ok"
    assert len(resp.data["anomalies"]) == 0


def test_skipped_no_deliveries():
    handler = ReturnAnomalyHandler()
    resp = handler.compute(_req({}), context={})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Implement handler**

```python
"""Return anomaly: flag stores with abnormal return rates vs peers on same batch."""
import time
from collections import defaultdict
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class ReturnAnomalyHandler(AbstractSectionHandler):
    section_name = "return_anomaly"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}

        deliveries = p.get("deliveries")
        if not deliveries or not isinstance(deliveries, list):
            return self.skipped(request, "未提供 deliveries (配送记录列表)", started)

        threshold_multiplier = float(p.get("threshold_multiplier", 3.0))

        # Group by (supplier, batch)
        groups = defaultdict(list)
        for d in deliveries:
            key = (d.get("supplier", ""), d.get("batch", ""))
            ordered = float(d.get("ordered", 0))
            returned = float(d.get("returned", 0))
            return_pct = round(returned / ordered * 100, 1) if ordered > 0 else 0.0
            groups[key].append({
                "store": d.get("store", ""),
                "ordered": ordered,
                "returned": returned,
                "return_pct": return_pct,
            })

        anomalies = []
        batch_summaries = []

        for (supplier, batch), records in groups.items():
            pcts = [r["return_pct"] for r in records]
            avg_pct = sum(pcts) / len(pcts) if pcts else 0
            std_threshold = max(avg_pct * threshold_multiplier, 10.0)

            batch_anomalies = [r for r in records if r["return_pct"] > std_threshold]

            for a in batch_anomalies:
                anomalies.append({
                    "store": a["store"],
                    "supplier": supplier,
                    "batch": batch,
                    "return_pct": a["return_pct"],
                    "peer_avg_pct": round(avg_pct, 1),
                    "threshold": round(std_threshold, 1),
                    "severity": "HIGH" if a["return_pct"] > std_threshold * 2 else "MEDIUM",
                    "action": "总部介入调查",
                })

            batch_summaries.append({
                "supplier": supplier,
                "batch": batch,
                "store_count": len(records),
                "avg_return_pct": round(avg_pct, 1),
                "anomaly_count": len(batch_anomalies),
            })

        return self.ok(request, data={
            "anomalies": anomalies,
            "batch_summaries": batch_summaries,
            "total_deliveries": len(deliveries),
            "total_anomalies": len(anomalies),
        }, started=started)
```

- [ ] **Step 3: Run tests + commit**

Run: `cd backend/python && python -m pytest tests/test_return_anomaly.py -v`
Expected: 3/3 PASS

```bash
git add backend/python/smartbi/services/restaurant/sections/return_anomaly.py \
        backend/python/tests/test_return_anomaly.py
git commit -m "feat(return-anomaly): handler detecting abnormal return rates per batch"
```

---

### Task 7: Return Anomaly Java tool

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/ReturnAnomalyTool.java`

- [ ] **Step 1: Create tool**

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class ReturnAnomalyTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() { return "restaurant_return_anomaly"; }

    @Override
    public String getDescription() {
        return "供应链反复退货异常检测 — 对比同一批次在各门店的退货率, 识别异常门店并通知总部. "
             + "客户 [T 06:40] '十家店九家正常验收, 唯独一家反复退货, 需要总部介入'.";
    }

    @Override
    protected String getSectionName() { return "return_anomaly"; }

    @Override
    protected List<String> buildFollowUps(String sectionName, Map<String, Object> data) {
        return Arrays.asList(
            "该供应商的历史退货趋势",
            "异常门店的其他供应商退货情况",
            "建议更换供应商还是调查门店"
        );
    }
}
```

- [ ] **Step 2: Verify compilation + commit**

```bash
cd backend/java/cretas-api && ./mvnw.cmd compile -q
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/ReturnAnomalyTool.java
git commit -m "feat(return-anomaly): Java tool wrapping Python anomaly handler"
```

---

### Task 8: Review Competitive Python handler (TDD)

**Files:**
- Create: `backend/python/tests/test_review_competitive.py`
- Create: `backend/python/smartbi/services/restaurant/sections/review_competitive.py`

- [ ] **Step 1: Write tests**

```python
"""Review competitive: compare own brand's reviews against competitors.
Customer [T 14:00-18:00]: '整个上海都在抖音卖券, 哪家销量最高, 为什么'.
"""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.review_competitive import ReviewCompetitiveHandler


def _req(params: dict) -> SectionRequest:
    return SectionRequest(
        factory_id="F-TEST", upload_id=None, sub_sector="火锅",
        store_id=None, store_name=None, params=params,
    )


def test_competitive_ranking():
    handler = ReviewCompetitiveHandler()
    resp = handler.compute(
        _req({
            "own_brand": {"name": "青花椒", "rating": 4.2, "review_count": 850, "avg_ticket": 128},
            "competitors": [
                {"name": "海底捞", "rating": 4.6, "review_count": 5200, "avg_ticket": 155},
                {"name": "小龙坎", "rating": 4.3, "review_count": 2100, "avg_ticket": 118},
                {"name": "大龙燚", "rating": 4.1, "review_count": 1200, "avg_ticket": 110},
            ],
        }),
        context={},
    )
    assert resp.status.value == "ok"
    ranking = resp.data["ranking"]
    assert ranking[0]["name"] == "海底捞"  # highest rated
    own = next(r for r in ranking if r["name"] == "青花椒")
    assert own["rank"] > 0
    assert "insights" in resp.data


def test_own_brand_only():
    handler = ReviewCompetitiveHandler()
    resp = handler.compute(
        _req({"own_brand": {"name": "青花椒", "rating": 4.2, "review_count": 500, "avg_ticket": 120}}),
        context={},
    )
    assert resp.status.value == "ok"
    assert resp.data["ranking"][0]["name"] == "青花椒"


def test_skipped_no_brand():
    handler = ReviewCompetitiveHandler()
    resp = handler.compute(_req({}), context={})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Implement handler**

```python
"""Review competitive: rank own brand against competitors on review metrics."""
import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler, SectionRequest, SectionResponse,
)


class ReviewCompetitiveHandler(AbstractSectionHandler):
    section_name = "review_competitive"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}

        own = p.get("own_brand")
        if not own:
            return self.skipped(request, "未提供 own_brand (自家品牌数据)", started)

        competitors = p.get("competitors", [])

        # Build unified list
        all_brands = [own] + competitors
        all_brands.sort(key=lambda b: float(b.get("rating", 0)), reverse=True)

        ranking = []
        for i, brand in enumerate(all_brands, 1):
            is_own = brand.get("name") == own.get("name")
            ranking.append({
                "rank": i,
                "name": brand.get("name", ""),
                "rating": float(brand.get("rating", 0)),
                "review_count": int(brand.get("review_count", 0)),
                "avg_ticket": float(brand.get("avg_ticket", 0)),
                "is_own": is_own,
            })

        # Generate insights
        own_rank = next((r["rank"] for r in ranking if r["is_own"]), len(ranking))
        own_rating = float(own.get("rating", 0))
        insights = []

        if own_rank == 1:
            insights.append("恭喜! 在对比品牌中评分排名第一")
        elif own_rank <= 3:
            leader = ranking[0]
            gap = round(leader["rating"] - own_rating, 1)
            insights.append(f"评分排名第 {own_rank}, 与第一名 {leader['name']} 差 {gap} 分")
        else:
            insights.append(f"评分排名第 {own_rank}/{len(ranking)}, 需要重点关注服务质量提升")

        # Price positioning
        own_ticket = float(own.get("avg_ticket", 0))
        if competitors:
            avg_competitor_ticket = sum(float(c.get("avg_ticket", 0)) for c in competitors) / len(competitors)
            if own_ticket > avg_competitor_ticket * 1.15:
                insights.append(f"客单价 ¥{own_ticket:.0f} 高于竞品均值 ¥{avg_competitor_ticket:.0f} — 需确保服务和品质匹配定价")
            elif own_ticket < avg_competitor_ticket * 0.85:
                insights.append(f"客单价 ¥{own_ticket:.0f} 低于竞品均值 ¥{avg_competitor_ticket:.0f} — 有提价空间或可推高价套餐")

        # Review volume
        own_reviews = int(own.get("review_count", 0))
        if competitors:
            avg_reviews = sum(int(c.get("review_count", 0)) for c in competitors) / len(competitors)
            if own_reviews < avg_reviews * 0.5:
                insights.append(f"评论数 {own_reviews} 远低于竞品均值 {avg_reviews:.0f} — 建议鼓励顾客留评")

        return self.ok(request, data={
            "ranking": ranking,
            "own_rank": own_rank,
            "total_brands": len(ranking),
            "insights": insights,
        }, started=started)
```

- [ ] **Step 3: Run tests + commit**

Run: `cd backend/python && python -m pytest tests/test_review_competitive.py -v`
Expected: 3/3 PASS

```bash
git add backend/python/smartbi/services/restaurant/sections/review_competitive.py \
        backend/python/tests/test_review_competitive.py
git commit -m "feat(review-competitive): handler ranking own brand vs competitors"
```

---

### Task 9: Review Competitive Java tool

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/ReviewCompetitiveTool.java`

- [ ] **Step 1: Create tool**

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class ReviewCompetitiveTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() { return "restaurant_review_competitive"; }

    @Override
    public String getDescription() {
        return "评论竞品分析 — 对比自家品牌与竞品在点评平台的评分/评论数/客单价. "
             + "客户 [T 14:00] '哪家销量最高, 为什么, 分析是价位问题还是其他'.";
    }

    @Override
    protected String getSectionName() { return "review_competitive"; }

    @Override
    protected List<String> buildFollowUps(String sectionName, Map<String, Object> data) {
        return Arrays.asList(
            "分析差评关键词和竞品差异",
            "竞品的热销套餐结构",
            "提升评分的具体建议"
        );
    }
}
```

- [ ] **Step 2: Compile + commit**

```bash
cd backend/java/cretas-api && ./mvnw.cmd compile -q
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/ReviewCompetitiveTool.java
git commit -m "feat(review-competitive): Java tool wrapping Python competitive handler"
```

---

### Task 10: Flyway migrations + router + Vue cards + keyword regex

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_03__restaurant_store_seat_config.sql`
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_04__restaurant_phase2_intents.sql`
- Modify: `backend/python/smartbi/api/restaurant_sections.py`
- Create: 4 Vue card files
- Modify: `web-admin/src/views/smart-bi/components/chat/SectionCardRenderer.vue`
- Modify: `SmartBIServiceImpl.java` keyword regex

- [ ] **Step 1: Create seat config table migration**

```sql
-- V20260412_03: Store seat configuration table for seat occupancy analysis

CREATE TABLE IF NOT EXISTS store_seat_configs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL,
    store_id VARCHAR(64) NOT NULL,
    table_number VARCHAR(32) NOT NULL,
    seat_count INTEGER NOT NULL,
    zone VARCHAR(64),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_store_table UNIQUE (factory_id, store_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_seat_config_store
    ON store_seat_configs (factory_id, store_id) WHERE deleted_at IS NULL;
```

- [ ] **Step 2: Create Phase 2 intents migration**

```sql
-- V20260412_04: Register Phase 2 operational intelligence intents

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_SEAT_OCCUPANCY', '桌位配置分析', 'SMARTBI', 'restaurant_seat_occupancy', 'LOW',
        '["桌位","占有率","餐位","几人位","两人位","四人位","桌子利用","座位配置"]',
        '分析桌位配置是否匹配客群人数分布, 建议优化座位组合', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_seat_occupancy', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_SEAT_CONFIG_MANAGE', '桌位配置管理', 'SMARTBI', 'restaurant_seat_config_manage', 'LOW',
        '["录入桌位","配置桌位","设置桌位","几号桌","桌位管理"]',
        '录入或更新门店桌位配置 (桌号→人数)', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_seat_config_manage', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_COMBO_SPLIT', '套餐拆单统计', 'SMARTBI', 'restaurant_combo_split', 'LOW',
        '["套餐拆","拆单","套餐统计","套餐销量","单点还是套餐","拆分菜品"]',
        '把套餐商品拆分为实际菜品统计, 区分单点销量和套餐内销量', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_combo_split', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_RETURN_ANOMALY', '退货异常检测', 'SMARTBI', 'restaurant_return_anomaly', 'LOW',
        '["退货异常","反复退货","供应商退货","验收异常","退货率","退货归因"]',
        '检测同一批次在各门店的退货率, 识别异常门店并通知总部', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_return_anomaly', is_active = true;

INSERT INTO ai_intent_configs (id, intent_code, intent_name, intent_category, tool_name, sensitivity_level, keywords, description, priority, is_active)
VALUES (gen_random_uuid(), 'RESTAURANT_REVIEW_COMPETITIVE', '评论竞品分析', 'SMARTBI', 'restaurant_review_competitive', 'LOW',
        '["竞品分析","竞品对比","别家做得好","竞争对手","同行对比","评分对比","点评对比"]',
        '对比自家与竞品在点评平台的评分/评论数/客单价, 生成竞争洞察', 85, true)
ON CONFLICT (intent_code) DO UPDATE SET tool_name = 'restaurant_review_competitive', is_active = true;
```

- [ ] **Step 3: Register 4 new Python handlers in router**

Add to `backend/python/smartbi/api/restaurant_sections.py`:

```python
from smartbi.services.restaurant.sections.seat_occupancy import SeatOccupancyHandler
from smartbi.services.restaurant.sections.combo_split import ComboSplitHandler
from smartbi.services.restaurant.sections.return_anomaly import ReturnAnomalyHandler
from smartbi.services.restaurant.sections.review_competitive import ReviewCompetitiveHandler

# In HANDLERS dict:
"seat_occupancy": SeatOccupancyHandler(),
"combo_split": ComboSplitHandler(),
"return_anomaly": ReturnAnomalyHandler(),
"review_competitive": ReviewCompetitiveHandler(),
```

- [ ] **Step 4: Create 4 Vue cards**

Create `SeatOccupancyCard.vue`, `ComboSplitCard.vue`, `ReturnAnomalyCard.vue`, `ReviewCompetitiveCard.vue` in `web-admin/src/views/smart-bi/components/chat/cards/`.

Each card follows the established pattern: `defineProps<{ data: Record<string, unknown> }>()` + computed helpers + Element Plus components for tables/tags/charts.

**SeatOccupancyCard**: el-table with seat_type / table_count / demand_count / gap + color-coded status tags
**ComboSplitCard**: el-table with dish / single_sales / combo_sales / total_sales + combo_pct bar
**ReturnAnomalyCard**: anomalies list with severity tags + batch summaries table
**ReviewCompetitiveCard**: ranking table with own-brand highlighted + insights list

Then update SectionCardRenderer.vue with 4 new imports + mapping entries.

- [ ] **Step 5: Extend keyword regex**

In `SmartBIServiceImpl.java` RESTAURANT_DIAGNOSTIC_KEYWORDS, add:

```
"|桌位|占有率|餐位|几人位|两人位|四人位|座位配置" +
"|套餐拆|拆单|套餐统计|套餐销量|单点还是套餐" +
"|退货异常|反复退货|供应商退货|验收异常|退货率|退货归因" +
"|竞品分析|竞品对比|别家做得好|竞争对手|同行对比|评分对比|点评对比"
```

Update test file with 4 new positive samples.

- [ ] **Step 6: Verify all + commit**

```bash
cd backend/java/cretas-api && ./mvnw.cmd compile -q
cd backend/java/cretas-api && ./mvnw.cmd test -Dtest=SmartBIRestaurantRoutingTest -q
cd backend/python && python -c "from smartbi.api.restaurant_sections import HANDLERS; print(len(HANDLERS))"
```

Commit all wiring files in one commit.

- [ ] **Step 7: Apply migrations to local DB + push**

```bash
PGPASSWORD=cretas_pass "/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  -h localhost -U cretas_user -d cretas_db \
  -f backend/java/cretas-api/src/main/resources/db/migration/V20260412_03__restaurant_store_seat_config.sql

PGPASSWORD=cretas_pass "/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  -h localhost -U cretas_user -d cretas_db \
  -f backend/java/cretas-api/src/main/resources/db/migration/V20260412_04__restaurant_phase2_intents.sql

git push origin feature/smartbi-restaurant-p1-section-split
```

---

## Self-Review

### Spec coverage

| Requirement | Task(s) | Status |
|---|---|---|
| 桌位配置录入 (桌号→人数) [T 11:20] | 1, 3 (SeatConfigManageTool) | Covered |
| 桌位占有率分析 [T 12:00-14:00] | 2, 3 (SeatOccupancyTool) | Covered |
| 套餐拆单统计 [T 04:55-05:50] | 4-5 | Covered |
| 反复退货异常检测 [T 06:40-08:00] | 6-7 | Covered |
| 评论竞品分析 [T 14:00-18:00] | 8-9 | Covered |
| Flyway + router + Vue cards + regex | 10 | Covered |

### Placeholder scan

No "TBD", "TODO", or placeholder patterns found.

### Type consistency

- `SeatOccupancyHandler` uses `seat_layout` (dict) + `party_distribution` (dict) — matches test
- `ComboSplitHandler` uses `combos` (list) + `single_sales` (dict) — matches test
- `ReturnAnomalyHandler` uses `deliveries` (list) — matches test
- `ReviewCompetitiveHandler` uses `own_brand` (dict) + `competitors` (list) — matches test
- All Java tools use established `AbstractRestaurantDiagnosticTool` pattern
- `SeatConfigManageTool` extends `AbstractBusinessTool` (write path) with `supportsPreview()`
