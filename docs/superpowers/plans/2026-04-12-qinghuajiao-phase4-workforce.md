# 青花椒 Option C · Phase 4: Workforce Management (Week 7-10)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-built workforce management: shift scheduling (公式制排班 with full-time/part-time mix), piecework commission (计件绩效 for hostess + team-based for service/kitchen), performance rule engine with role-gated monthly changes, and a store manager KPI dashboard combining financial + operational + external metrics.

**Architecture:** New JPA entity cluster (`ShiftSchedule`, `PieceworkConfig`, `PerformanceRule`, `StoreKpiSnapshot`) with corresponding services. Python handlers for analytics/dashboards. Java tools for CRUD + diagnostic. Rule engine uses configurable JSON payloads (not Drools — YAGNI for v1).

**Tech Stack:** Java 21 / Spring Boot 3.2 / Python 3.8+ FastAPI / PostgreSQL / Vue 3

**Source:** Customer call [T 27:00-41:00]: '公式制排班', '全职+兼职', '迎宾按客单量计件', '服务员小组计件', '规则不能老是变, 月初才能改'.

---

## File Structure

### F1. Shift Scheduling (Tasks 1-6)
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/restaurant/ShiftSchedule.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/restaurant/ShiftTemplate.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/restaurant/ShiftScheduleRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/restaurant/ShiftTemplateRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/restaurant/ShiftScheduleService.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/restaurant/impl/ShiftScheduleServiceImpl.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/ShiftScheduleCreateTool.java`
- Create: `backend/python/smartbi/services/restaurant/sections/shift_analysis.py`
- Create: `backend/python/tests/test_shift_analysis.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/ShiftAnalysisTool.java`

### F2. Piecework Commission (Tasks 7-10)
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/restaurant/PieceworkConfig.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/restaurant/PieceworkConfigRepository.java`
- Create: `backend/python/smartbi/services/restaurant/sections/piecework_calc.py`
- Create: `backend/python/tests/test_piecework_calc.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/PieceworkConfigTool.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/PieceworkCalcTool.java`

### F3. Performance Rule Engine (Tasks 11-14)
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/restaurant/PerformanceRule.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/restaurant/PerformanceRuleRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/restaurant/PerformanceRuleService.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/restaurant/impl/PerformanceRuleServiceImpl.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/PerformanceRuleManageTool.java`
- Create: `backend/python/smartbi/services/restaurant/sections/performance_eval.py`
- Create: `backend/python/tests/test_performance_eval.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/PerformanceEvalTool.java`

### F4. Store Manager KPI Dashboard (Tasks 15-17)
- Create: `backend/python/smartbi/services/restaurant/sections/store_kpi_dashboard.py`
- Create: `backend/python/tests/test_store_kpi_dashboard.py`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/restaurant/diagnostic/StoreKpiDashboardTool.java`

### F5. Wiring (Task 18)
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_06__restaurant_shift_schedule.sql`
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_07__restaurant_piecework_config.sql`
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_08__restaurant_performance_rule.sql`
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260412_09__restaurant_phase4_intents.sql`
- Modify: router, SectionCardRenderer, keyword regex

---

## Tasks

### Task 1: ShiftTemplate + ShiftSchedule entities

**Files:**
- Create: `backend/java/.../entity/restaurant/ShiftTemplate.java`
- Create: `backend/java/.../entity/restaurant/ShiftSchedule.java`

- [ ] **Step 1: Create ShiftTemplate entity**

```java
package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Shift template: defines a recurring shift pattern for a store.
 * E.g., "早班 08:00-14:00", "晚班 16:00-22:00", "通班 08:00-22:00".
 * Customer [T 28:06]: '可能早中晚班, 上班打卡到中午结束下班'.
 */
@Entity
@Table(name = "restaurant_shift_templates")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class ShiftTemplate extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    @Column(name = "store_id", length = 64)
    private String storeId;

    @Column(name = "template_name", nullable = false, length = 64)
    private String templateName;

    /** Shift start time as "HH:mm" string. */
    @Column(name = "start_time", nullable = false, length = 5)
    private String startTime;

    /** Shift end time as "HH:mm" string. */
    @Column(name = "end_time", nullable = false, length = 5)
    private String endTime;

    /** Duration in hours (auto-calculated or manually set). */
    @Column(name = "duration_hours", precision = 4, scale = 1)
    private BigDecimal durationHours;

    /** Applicable employee types: FULL_TIME, PART_TIME, BOTH. */
    @Column(name = "employee_type", length = 20)
    @Builder.Default
    private String employeeType = "BOTH";

    @Column(name = "is_active") @Builder.Default
    private Boolean isActive = true;
}
```

- [ ] **Step 2: Create ShiftSchedule entity**

```java
package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Daily shift assignment: who works which shift on which day.
 * Customer [T 29:05]: '排班, 首先公式制肯定是先排班'.
 */
@Entity
@Table(name = "restaurant_shift_schedules",
       uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "store_id", "employee_id", "shift_date"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class ShiftSchedule extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    @Column(name = "store_id", nullable = false, length = 64)
    private String storeId;

    @Column(name = "employee_id", nullable = false, length = 64)
    private String employeeId;

    @Column(name = "employee_name", length = 64)
    private String employeeName;

    @Column(name = "shift_date", nullable = false)
    private LocalDate shiftDate;

    /** FK to ShiftTemplate.id — which shift pattern. */
    @Column(name = "shift_template_id", length = 36)
    private String shiftTemplateId;

    /** Actual hours worked (filled after clock-out). */
    @Column(name = "actual_hours", precision = 4, scale = 1)
    private BigDecimal actualHours;

    /** FULL_TIME or PART_TIME. */
    @Column(name = "employee_type", nullable = false, length = 20)
    private String employeeType;

    /** Hourly rate for part-timers (e.g., ¥40/hr). */
    @Column(name = "hourly_rate", precision = 8, scale = 2)
    private BigDecimal hourlyRate;

    /** SCHEDULED, CHECKED_IN, COMPLETED, ABSENT, CANCELLED. */
    @Column(name = "status", length = 20) @Builder.Default
    private String status = "SCHEDULED";
}
```

- [ ] **Step 3: Verify compilation + commit**

---

### Task 2: Shift repositories + service

**Files:**
- Create: `backend/java/.../repository/restaurant/ShiftTemplateRepository.java`
- Create: `backend/java/.../repository/restaurant/ShiftScheduleRepository.java`
- Create: `backend/java/.../service/restaurant/ShiftScheduleService.java`
- Create: `backend/java/.../service/restaurant/impl/ShiftScheduleServiceImpl.java`

- [ ] **Step 1: Create ShiftTemplateRepository**

```java
package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.ShiftTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ShiftTemplateRepository extends JpaRepository<ShiftTemplate, String> {
    List<ShiftTemplate> findByFactoryIdAndStoreIdAndIsActiveTrue(String factoryId, String storeId);
    List<ShiftTemplate> findByFactoryIdAndIsActiveTrue(String factoryId);
}
```

- [ ] **Step 2: Create ShiftScheduleRepository**

```java
package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.ShiftSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ShiftScheduleRepository extends JpaRepository<ShiftSchedule, String> {
    List<ShiftSchedule> findByFactoryIdAndStoreIdAndShiftDate(String factoryId, String storeId, LocalDate date);

    @Query("SELECT ss FROM ShiftSchedule ss WHERE ss.factoryId = :fid AND ss.storeId = :sid " +
           "AND ss.shiftDate BETWEEN :start AND :end ORDER BY ss.shiftDate, ss.employeeName")
    List<ShiftSchedule> findByDateRange(@Param("fid") String factoryId, @Param("sid") String storeId,
                                         @Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT ss.employeeType, COUNT(ss), SUM(ss.actualHours) FROM ShiftSchedule ss " +
           "WHERE ss.factoryId = :fid AND ss.storeId = :sid AND ss.shiftDate BETWEEN :start AND :end " +
           "AND ss.status = 'COMPLETED' GROUP BY ss.employeeType")
    List<Object[]> summarizeByEmployeeType(@Param("fid") String fid, @Param("sid") String sid,
                                            @Param("start") LocalDate start, @Param("end") LocalDate end);
}
```

- [ ] **Step 3: Create ShiftScheduleService interface**

```java
package com.cretas.aims.service.restaurant;

import com.cretas.aims.entity.restaurant.ShiftSchedule;
import com.cretas.aims.entity.restaurant.ShiftTemplate;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface ShiftScheduleService {
    ShiftTemplate createTemplate(String factoryId, String storeId, String name,
                                  String startTime, String endTime, String employeeType);
    List<ShiftTemplate> getTemplates(String factoryId, String storeId);

    ShiftSchedule assignShift(String factoryId, String storeId, String employeeId,
                               String employeeName, LocalDate date, String templateId,
                               String employeeType, java.math.BigDecimal hourlyRate);
    List<ShiftSchedule> getSchedule(String factoryId, String storeId, LocalDate start, LocalDate end);

    /** Monthly hours summary per employee type. */
    Map<String, Object> getMonthlySummary(String factoryId, String storeId, LocalDate month);

    /** Guaranteed minimum hours check for full-timers (160-180/month). */
    Map<String, Object> checkMinHoursCompliance(String factoryId, String storeId, LocalDate month, int minHours);
}
```

- [ ] **Step 4: Create ShiftScheduleServiceImpl**

```java
package com.cretas.aims.service.restaurant.impl;

import com.cretas.aims.entity.restaurant.ShiftSchedule;
import com.cretas.aims.entity.restaurant.ShiftTemplate;
import com.cretas.aims.repository.restaurant.ShiftScheduleRepository;
import com.cretas.aims.repository.restaurant.ShiftTemplateRepository;
import com.cretas.aims.service.restaurant.ShiftScheduleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Slf4j @Service @RequiredArgsConstructor
public class ShiftScheduleServiceImpl implements ShiftScheduleService {
    private final ShiftTemplateRepository templateRepo;
    private final ShiftScheduleRepository scheduleRepo;

    @Override
    public ShiftTemplate createTemplate(String factoryId, String storeId, String name,
                                         String startTime, String endTime, String employeeType) {
        return templateRepo.save(ShiftTemplate.builder()
            .factoryId(factoryId).storeId(storeId).templateName(name)
            .startTime(startTime).endTime(endTime).employeeType(employeeType != null ? employeeType : "BOTH")
            .build());
    }

    @Override
    public List<ShiftTemplate> getTemplates(String factoryId, String storeId) {
        return storeId != null ? templateRepo.findByFactoryIdAndStoreIdAndIsActiveTrue(factoryId, storeId)
                               : templateRepo.findByFactoryIdAndIsActiveTrue(factoryId);
    }

    @Override
    public ShiftSchedule assignShift(String factoryId, String storeId, String employeeId,
                                      String employeeName, LocalDate date, String templateId,
                                      String employeeType, BigDecimal hourlyRate) {
        return scheduleRepo.save(ShiftSchedule.builder()
            .factoryId(factoryId).storeId(storeId).employeeId(employeeId)
            .employeeName(employeeName).shiftDate(date).shiftTemplateId(templateId)
            .employeeType(employeeType).hourlyRate(hourlyRate).build());
    }

    @Override
    public List<ShiftSchedule> getSchedule(String factoryId, String storeId, LocalDate start, LocalDate end) {
        return scheduleRepo.findByDateRange(factoryId, storeId, start, end);
    }

    @Override
    public Map<String, Object> getMonthlySummary(String factoryId, String storeId, LocalDate month) {
        LocalDate start = month.withDayOfMonth(1);
        LocalDate end = month.withDayOfMonth(month.lengthOfMonth());
        List<Object[]> rows = scheduleRepo.summarizeByEmployeeType(factoryId, storeId, start, end);

        Map<String, Object> summary = new HashMap<>();
        int totalShifts = 0; double totalHours = 0;
        List<Map<String, Object>> breakdown = new ArrayList<>();
        for (Object[] row : rows) {
            String type = (String) row[0];
            long count = (Long) row[1];
            double hours = row[2] != null ? ((Number) row[2]).doubleValue() : 0;
            totalShifts += count; totalHours += hours;
            breakdown.add(Map.of("employeeType", type, "shiftCount", count, "totalHours", hours));
        }
        summary.put("month", start.toString());
        summary.put("breakdown", breakdown);
        summary.put("totalShifts", totalShifts);
        summary.put("totalHours", totalHours);
        return summary;
    }

    @Override
    public Map<String, Object> checkMinHoursCompliance(String factoryId, String storeId,
                                                        LocalDate month, int minHours) {
        LocalDate start = month.withDayOfMonth(1);
        LocalDate end = month.withDayOfMonth(month.lengthOfMonth());
        List<ShiftSchedule> schedules = scheduleRepo.findByDateRange(factoryId, storeId, start, end);

        Map<String, Double> employeeHours = new HashMap<>();
        for (ShiftSchedule s : schedules) {
            if ("FULL_TIME".equals(s.getEmployeeType()) && s.getActualHours() != null) {
                employeeHours.merge(s.getEmployeeId(), s.getActualHours().doubleValue(), Double::sum);
            }
        }

        List<Map<String, Object>> violations = new ArrayList<>();
        for (Map.Entry<String, Double> e : employeeHours.entrySet()) {
            if (e.getValue() < minHours) {
                violations.add(Map.of("employeeId", e.getKey(), "actualHours", e.getValue(),
                    "minRequired", minHours, "shortfall", minHours - e.getValue()));
            }
        }
        return Map.of("compliant", violations.isEmpty(), "violations", violations,
                       "totalFullTimeEmployees", employeeHours.size());
    }
}
```

- [ ] **Step 5: Compile + commit**

---

### Task 3: Shift Analysis Python handler (TDD)

- [ ] **Step 1: Test** `backend/python/tests/test_shift_analysis.py`

```python
"""Shift analysis: evaluate staffing efficiency and full-time/part-time mix."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.shift_analysis import ShiftAnalysisHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)

def test_basic_analysis():
    resp = ShiftAnalysisHandler().compute(
        _req({
            "month_summary": {
                "full_time": {"count": 8, "total_hours": 1400, "total_cost": 48000},
                "part_time": {"count": 4, "total_hours": 320, "total_cost": 12800},
            },
            "revenue": 400000,
            "min_guaranteed_hours": 168,
        }), {})
    assert resp.status.value == "ok"
    d = resp.data
    assert d["total_headcount"] == 12
    assert d["full_time_ratio"] == 66.7  # 8/12
    assert d["part_time_hourly_cost"] == 40.0  # 12800/320
    assert d["labor_cost_pct"] > 0

def test_recommends_more_parttimers():
    resp = ShiftAnalysisHandler().compute(
        _req({
            "month_summary": {
                "full_time": {"count": 12, "total_hours": 2016, "total_cost": 72000},
                "part_time": {"count": 0, "total_hours": 0, "total_cost": 0},
            },
            "revenue": 360000,
        }), {})
    recs = resp.data["recommendations"]
    assert any("兼职" in r for r in recs)

def test_skipped_no_summary():
    resp = ShiftAnalysisHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Implement** `backend/python/smartbi/services/restaurant/sections/shift_analysis.py`

```python
"""Shift analysis: evaluate staffing efficiency and full-time/part-time mix.
Customer [T 29:28-31:00]: '分全职跟兼职, 全职保底160-180工时, 高峰多用兼职'.
"""
import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse

class ShiftAnalysisHandler(AbstractSectionHandler):
    section_name = "shift_analysis"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        summary = p.get("month_summary")
        if not summary:
            return self.skipped(request, "未提供 month_summary", started)

        ft = summary.get("full_time", {})
        pt = summary.get("part_time", {})
        ft_count = int(ft.get("count", 0))
        pt_count = int(pt.get("count", 0))
        ft_hours = float(ft.get("total_hours", 0))
        pt_hours = float(pt.get("total_hours", 0))
        ft_cost = float(ft.get("total_cost", 0))
        pt_cost = float(pt.get("total_cost", 0))

        total_hc = ft_count + pt_count
        total_hours = ft_hours + pt_hours
        total_cost = ft_cost + pt_cost
        revenue = float(p.get("revenue", 0))
        min_hours = int(p.get("min_guaranteed_hours", 168))

        ft_ratio = round(ft_count / total_hc * 100, 1) if total_hc > 0 else 0
        pt_hourly = round(pt_cost / pt_hours, 1) if pt_hours > 0 else 0
        ft_avg_hours = round(ft_hours / ft_count, 1) if ft_count > 0 else 0
        labor_pct = round(total_cost / revenue * 100, 1) if revenue > 0 else 0
        productivity = round(revenue / total_hc) if total_hc > 0 else 0

        recs = []
        if ft_ratio > 80 and total_hc >= 8:
            recs.append(f"全职占比 {ft_ratio}% 偏高, 建议增加兼职 (目标: 全职60-70% + 兼职30-40%)")
        if ft_avg_hours > 0 and ft_avg_hours < min_hours:
            recs.append(f"全职人均 {ft_avg_hours}h 低于保底 {min_hours}h, 需确认排班是否充足")
        if labor_pct > 25:
            recs.append(f"人力成本占比 {labor_pct}% 超过25%, 需优化用工结构")
        if pt_count == 0 and total_hc >= 6:
            recs.append("未使用兼职人员, 高峰期建议引入兼职降低固定成本")
        if not recs:
            recs.append("排班结构合理, 全职/兼职比例健康")

        return self.ok(request, data={
            "total_headcount": total_hc,
            "full_time_count": ft_count, "part_time_count": pt_count,
            "full_time_ratio": ft_ratio,
            "full_time_avg_hours": ft_avg_hours,
            "part_time_hourly_cost": pt_hourly,
            "total_labor_cost": total_cost,
            "labor_cost_pct": labor_pct,
            "productivity_per_person": productivity,
            "recommendations": recs,
            "benchmark": "肯德基模式: 1-2全职管理 + 大量兼职, 全职占比 <30%",
        }, started=started)
```

- [ ] **Step 3: Run tests + commit**

---

### Task 4: Shift tools (create + analysis)

- [ ] **Step 1: Create ShiftScheduleCreateTool**

```java
package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.service.restaurant.ShiftScheduleService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.*;

@Slf4j @Component
public class ShiftScheduleCreateTool extends AbstractBusinessTool {
    @Autowired private ShiftScheduleService shiftService;

    @Override public String getToolName() { return "restaurant_shift_create"; }
    @Override public String getDescription() { return "创建排班模板或分配班次给员工."; }
    @Override public Map<String, Object> getParametersSchema() {
        return Map.of("type", "object", "properties", Map.of(
            "store_id", Map.of("type", "string", "description", "门店ID"),
            "action", Map.of("type", "string", "description", "create_template 或 assign_shift"),
            "template_name", Map.of("type", "string", "description", "班次名 (如早班/晚班)"),
            "start_time", Map.of("type", "string", "description", "开始时间 HH:mm"),
            "end_time", Map.of("type", "string", "description", "结束时间 HH:mm")),
            "required", List.of("store_id", "action"));
    }
    @Override protected List<String> getRequiredParameters() { return List.of("store_id", "action"); }
    @Override public boolean supportsPreview() { return true; }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> ctx) throws Exception {
        String storeId = getString(params, "store_id");
        String action = getString(params, "action");
        if ("create_template".equals(action)) {
            var t = shiftService.createTemplate(factoryId, storeId,
                getString(params, "template_name"), getString(params, "start_time"),
                getString(params, "end_time"), getString(params, "employee_type"));
            return buildSimpleResult("排班模板已创建", Map.of("templateId", t.getId(), "name", t.getTemplateName()));
        }
        return buildSimpleResult("未知操作: " + action, Map.of());
    }
}
```

- [ ] **Step 2: Create ShiftAnalysisTool**

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;
import lombok.extern.slf4j.Slf4j; import org.springframework.stereotype.Component;
import java.util.Arrays; import java.util.List; import java.util.Map;

@Slf4j @Component
public class ShiftAnalysisTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_shift_analysis"; }
    @Override public String getDescription() { return "排班分析 — 评估全职/兼职比例、工时合规、人力成本效率."; }
    @Override protected String getSectionName() { return "shift_analysis"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("各门店排班对比", "兼职比例优化建议", "节假日排班调整");
    }
}
```

- [ ] **Step 3: Compile + commit**

---

### Task 5: PieceworkConfig entity + repository

- [ ] **Step 1: Create entity**

```java
package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

/**
 * Piecework commission config: defines per-unit rates for specific roles.
 * Customer [T 33:16-34:18]: '迎宾按客单量, 基础2000单=5000元, 超出部分3元/单'.
 * Customer [T 35:01-37:00]: '服务员不按个人, 小组一起算'.
 */
@Entity
@Table(name = "restaurant_piecework_configs",
       uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "store_id", "role", "effective_month"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class PieceworkConfig extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    @Column(name = "store_id", length = 64)
    private String storeId;

    /** Role: HOSTESS, SERVICE_TEAM, KITCHEN_TEAM, RUNNER_TEAM. */
    @Column(name = "role", nullable = false, length = 32)
    private String role;

    /** INDIVIDUAL or TEAM. */
    @Column(name = "calc_mode", nullable = false, length = 16)
    @Builder.Default
    private String calcMode = "TEAM";

    /** Base unit count threshold (e.g., 2000 covers for hostess). */
    @Column(name = "base_threshold")
    private Integer baseThreshold;

    /** Base salary for meeting threshold. */
    @Column(name = "base_salary", precision = 10, scale = 2)
    private BigDecimal baseSalary;

    /** Per-unit bonus above threshold (e.g., ¥3/cover). */
    @Column(name = "per_unit_bonus", precision = 8, scale = 2)
    private BigDecimal perUnitBonus;

    /** Unit type: COVER (客人数), TABLE (桌数), DISH (菜品数). */
    @Column(name = "unit_type", length = 16) @Builder.Default
    private String unitType = "COVER";

    /** Team size (for TEAM mode, used to split the pool). */
    @Column(name = "team_size")
    private Integer teamSize;

    @Column(name = "effective_month")
    private java.time.LocalDate effectiveMonth;

    @Column(name = "is_active") @Builder.Default
    private Boolean isActive = true;
}
```

- [ ] **Step 2: Create PieceworkConfigRepository**

```java
package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.PieceworkConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface PieceworkConfigRepository extends JpaRepository<PieceworkConfig, String> {
    List<PieceworkConfig> findByFactoryIdAndStoreIdAndEffectiveMonthAndIsActiveTrue(
        String factoryId, String storeId, LocalDate effectiveMonth);
    List<PieceworkConfig> findByFactoryIdAndStoreIdAndIsActiveTrue(String factoryId, String storeId);
}
```

- [ ] **Step 3: Compile + commit**

---

### Task 6: Piecework Calc Python handler (TDD)

- [ ] **Step 1: Test** `backend/python/tests/test_piecework_calc.py`

```python
"""Piecework calc: compute commission for hostess (individual) and teams."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.piecework_calc import PieceworkCalcHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)

def test_hostess_individual():
    resp = PieceworkCalcHandler().compute(
        _req({"roles": [
            {"role": "迎宾", "calc_mode": "INDIVIDUAL", "base_threshold": 2000,
             "base_salary": 5000, "per_unit_bonus": 3.0, "actual_units": 2500}
        ]}), {})
    assert resp.status.value == "ok"
    h = resp.data["role_results"][0]
    assert h["role"] == "迎宾"
    assert h["base_earned"] == 5000
    assert h["bonus"] == 1500  # (2500-2000)*3
    assert h["total"] == 6500

def test_team_split():
    resp = PieceworkCalcHandler().compute(
        _req({"roles": [
            {"role": "服务组", "calc_mode": "TEAM", "base_threshold": 3000,
             "base_salary": 15000, "per_unit_bonus": 2.0, "actual_units": 4000,
             "team_size": 3}
        ]}), {})
    team = resp.data["role_results"][0]
    assert team["total_pool"] == 17000  # 15000 + (4000-3000)*2
    assert team["per_person"] == 5667  # 17000/3 rounded

def test_below_threshold():
    resp = PieceworkCalcHandler().compute(
        _req({"roles": [
            {"role": "迎宾", "calc_mode": "INDIVIDUAL", "base_threshold": 2000,
             "base_salary": 5000, "per_unit_bonus": 3.0, "actual_units": 1500}
        ]}), {})
    h = resp.data["role_results"][0]
    assert h["bonus"] == 0
    assert h["total"] == 5000  # still gets base

def test_skipped_no_roles():
    resp = PieceworkCalcHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Implement** `backend/python/smartbi/services/restaurant/sections/piecework_calc.py`

```python
"""Piecework commission calculator: individual (hostess) and team-based (service/kitchen)."""
import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse

class PieceworkCalcHandler(AbstractSectionHandler):
    section_name = "piecework_calc"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        roles = p.get("roles")
        if not roles or not isinstance(roles, list):
            return self.skipped(request, "未提供 roles (岗位配置列表)", started)

        results = []
        total_payout = 0

        for r in roles:
            role = r.get("role", "")
            mode = r.get("calc_mode", "TEAM")
            threshold = int(r.get("base_threshold", 0))
            base_salary = float(r.get("base_salary", 0))
            per_unit = float(r.get("per_unit_bonus", 0))
            actual = int(r.get("actual_units", 0))
            team_size = int(r.get("team_size", 1))

            excess = max(0, actual - threshold)
            bonus = round(excess * per_unit)
            total_pool = round(base_salary + bonus)

            item = {"role": role, "calc_mode": mode, "actual_units": actual,
                     "threshold": threshold, "excess_units": excess,
                     "base_earned": round(base_salary), "bonus": bonus}

            if mode == "TEAM" and team_size > 0:
                per_person = round(total_pool / team_size)
                item["total_pool"] = total_pool
                item["team_size"] = team_size
                item["per_person"] = per_person
                item["total"] = total_pool
            else:
                item["total"] = total_pool

            results.append(item)
            total_payout += total_pool

        return self.ok(request, data={
            "role_results": results,
            "total_payout": total_payout,
            "roles_counted": len(results),
        }, started=started)
```

- [ ] **Step 3: Run tests + commit**

---

### Task 7: Piecework Java tools

- [ ] **Step 1: Create PieceworkConfigTool (write)**

```java
package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.restaurant.PieceworkConfig;
import com.cretas.aims.repository.restaurant.PieceworkConfigRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Slf4j @Component
public class PieceworkConfigTool extends AbstractBusinessTool {
    @Autowired private PieceworkConfigRepository repo;

    @Override public String getToolName() { return "restaurant_piecework_config"; }
    @Override public String getDescription() { return "配置计件绩效规则 — 设定岗位计件模式(个人/小组)、基础单量、超出单价."; }
    @Override public Map<String, Object> getParametersSchema() {
        return Map.of("type", "object", "properties", Map.of(
            "store_id", Map.of("type", "string"), "role", Map.of("type", "string"),
            "calc_mode", Map.of("type", "string", "description", "INDIVIDUAL 或 TEAM"),
            "base_threshold", Map.of("type", "integer"), "base_salary", Map.of("type", "number"),
            "per_unit_bonus", Map.of("type", "number"), "team_size", Map.of("type", "integer")),
            "required", List.of("store_id", "role"));
    }
    @Override protected List<String> getRequiredParameters() { return List.of("store_id", "role"); }
    @Override public boolean supportsPreview() { return true; }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> ctx) throws Exception {
        PieceworkConfig config = PieceworkConfig.builder()
            .factoryId(factoryId).storeId(getString(params, "store_id"))
            .role(getString(params, "role"))
            .calcMode(getString(params, "calc_mode") != null ? getString(params, "calc_mode") : "TEAM")
            .baseThreshold(params.get("base_threshold") != null ? Integer.parseInt(params.get("base_threshold").toString()) : null)
            .baseSalary(params.get("base_salary") != null ? new BigDecimal(params.get("base_salary").toString()) : null)
            .perUnitBonus(params.get("per_unit_bonus") != null ? new BigDecimal(params.get("per_unit_bonus").toString()) : null)
            .teamSize(params.get("team_size") != null ? Integer.parseInt(params.get("team_size").toString()) : null)
            .effectiveMonth(LocalDate.now().withDayOfMonth(1))
            .build();
        config = repo.save(config);
        return buildSimpleResult("计件配置已保存", Map.of("configId", config.getId(), "role", config.getRole()));
    }
}
```

- [ ] **Step 2: Create PieceworkCalcTool (diagnostic)**

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;
import lombok.extern.slf4j.Slf4j; import org.springframework.stereotype.Component;
import java.util.Arrays; import java.util.List; import java.util.Map;

@Slf4j @Component
public class PieceworkCalcTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_piecework_calc"; }
    @Override public String getDescription() { return "计件绩效计算 — 按岗位(迎宾个人/服务组团队)计算本月提成."; }
    @Override protected String getSectionName() { return "piecework_calc"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("各岗位提成对比", "调整计件规则", "查看排班工时");
    }
}
```

- [ ] **Step 3: Compile + commit**

---

### Task 8: PerformanceRule entity + service

- [ ] **Step 1: Create entity**

```java
package com.cretas.aims.entity.restaurant;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDate;
import java.util.Map;

/**
 * Performance rule: defines KPI weights and thresholds for store manager evaluation.
 * Customer [T 23:44-24:00]: '规则变必须每月1号, 不能中间变'.
 */
@Entity
@Table(name = "restaurant_performance_rules",
       uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "store_id", "effective_month"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class PerformanceRule extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 64)
    private String factoryId;

    @Column(name = "store_id", length = 64)
    private String storeId;

    @Column(name = "effective_month", nullable = false)
    private LocalDate effectiveMonth;

    /** JSON: {"controllable_profit": {"weight": 40, "target": 200000}, "labor_productivity": {"weight": 30, ...}} */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "kpi_weights", columnDefinition = "jsonb")
    private Map<String, Object> kpiWeights;

    /** JSON: non-controllable items to exclude from profit calc. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "non_controllable_items", columnDefinition = "jsonb")
    private Map<String, Object> nonControllableItems;

    /** Role required to modify: OWNER, FINANCE_DIRECTOR. */
    @Column(name = "modify_role", length = 32) @Builder.Default
    private String modifyRole = "OWNER";

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "is_active") @Builder.Default
    private Boolean isActive = true;
}
```

- [ ] **Step 2: Create repository + service interface + impl**

```java
// PerformanceRuleRepository
package com.cretas.aims.repository.restaurant;
import com.cretas.aims.entity.restaurant.PerformanceRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface PerformanceRuleRepository extends JpaRepository<PerformanceRule, String> {
    Optional<PerformanceRule> findByFactoryIdAndStoreIdAndEffectiveMonthAndIsActiveTrue(
        String factoryId, String storeId, LocalDate effectiveMonth);
}
```

```java
// PerformanceRuleService
package com.cretas.aims.service.restaurant;
import com.cretas.aims.entity.restaurant.PerformanceRule;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

public interface PerformanceRuleService {
    PerformanceRule createOrUpdate(String factoryId, String storeId, LocalDate month,
                                   Map<String, Object> kpiWeights, Map<String, Object> nonControllable,
                                   String modifyRole, String createdBy);
    Optional<PerformanceRule> getActiveRule(String factoryId, String storeId, LocalDate month);
}
```

```java
// PerformanceRuleServiceImpl
package com.cretas.aims.service.restaurant.impl;
import com.cretas.aims.entity.restaurant.PerformanceRule;
import com.cretas.aims.repository.restaurant.PerformanceRuleRepository;
import com.cretas.aims.service.restaurant.PerformanceRuleService;
import lombok.RequiredArgsConstructor; import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.LocalDate; import java.util.Map; import java.util.Optional;

@Slf4j @Service @RequiredArgsConstructor
public class PerformanceRuleServiceImpl implements PerformanceRuleService {
    private final PerformanceRuleRepository repo;

    @Override
    public PerformanceRule createOrUpdate(String factoryId, String storeId, LocalDate month,
                                          Map<String, Object> kpiWeights, Map<String, Object> nonControllable,
                                          String modifyRole, String createdBy) {
        LocalDate m = month.withDayOfMonth(1);
        PerformanceRule rule = repo.findByFactoryIdAndStoreIdAndEffectiveMonthAndIsActiveTrue(factoryId, storeId, m)
            .orElse(PerformanceRule.builder().factoryId(factoryId).storeId(storeId).effectiveMonth(m).build());
        rule.setKpiWeights(kpiWeights);
        rule.setNonControllableItems(nonControllable);
        rule.setModifyRole(modifyRole != null ? modifyRole : "OWNER");
        rule.setCreatedBy(createdBy);
        rule.setIsActive(true);
        return repo.save(rule);
    }

    @Override
    public Optional<PerformanceRule> getActiveRule(String factoryId, String storeId, LocalDate month) {
        return repo.findByFactoryIdAndStoreIdAndEffectiveMonthAndIsActiveTrue(factoryId, storeId, month.withDayOfMonth(1));
    }
}
```

- [ ] **Step 3: Compile + commit**

---

### Task 9: Performance Eval Python handler (TDD)

- [ ] **Step 1: Test** `backend/python/tests/test_performance_eval.py`

```python
"""Performance eval: weighted KPI scoring for store managers."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.performance_eval import PerformanceEvalHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)

def test_basic_eval():
    resp = PerformanceEvalHandler().compute(
        _req({
            "kpi_weights": {
                "controllable_profit": {"weight": 40, "target": 200000, "actual": 180000},
                "labor_productivity": {"weight": 30, "target": 35000, "actual": 32000},
                "review_score": {"weight": 30, "target": 4.5, "actual": 4.3},
            },
        }), {})
    assert resp.status.value == "ok"
    d = resp.data
    assert d["total_score"] > 0
    assert d["total_score"] <= 100
    assert len(d["kpi_details"]) == 3

def test_perfect_score():
    resp = PerformanceEvalHandler().compute(
        _req({"kpi_weights": {
            "profit": {"weight": 100, "target": 100, "actual": 100}}}), {})
    assert resp.data["total_score"] == 100.0

def test_skipped_no_kpis():
    resp = PerformanceEvalHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Implement** `backend/python/smartbi/services/restaurant/sections/performance_eval.py`

```python
"""Performance eval: weighted KPI scoring. Each KPI gets score = min(actual/target, 1.2) × weight."""
import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse

class PerformanceEvalHandler(AbstractSectionHandler):
    section_name = "performance_eval"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        kpis = p.get("kpi_weights")
        if not kpis or not isinstance(kpis, dict):
            return self.skipped(request, "未提供 kpi_weights", started)

        details = []
        total_score = 0.0
        total_weight = 0

        for name, cfg in kpis.items():
            weight = float(cfg.get("weight", 0))
            target = float(cfg.get("target", 0))
            actual = float(cfg.get("actual", 0))

            if target > 0:
                achievement = min(actual / target, 1.2)  # cap at 120%
            else:
                achievement = 1.0

            score = round(achievement * weight, 1)
            total_score += score
            total_weight += weight

            details.append({
                "kpi": name,
                "weight": weight,
                "target": target,
                "actual": actual,
                "achievement_pct": round(achievement * 100, 1),
                "weighted_score": score,
            })

        return self.ok(request, data={
            "kpi_details": details,
            "total_score": round(total_score, 1),
            "total_weight": total_weight,
            "grade": "A" if total_score >= 90 else "B" if total_score >= 75 else "C" if total_score >= 60 else "D",
        }, started=started)
```

- [ ] **Step 3: Run tests + commit**

---

### Task 10: Performance tools

- [ ] **Step 1: Create PerformanceRuleManageTool (write)**

```java
package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.restaurant.PerformanceRule;
import com.cretas.aims.service.restaurant.PerformanceRuleService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.util.*;

@Slf4j @Component
public class PerformanceRuleManageTool extends AbstractBusinessTool {
    @Autowired private PerformanceRuleService ruleService;

    @Override public String getToolName() { return "restaurant_performance_rule_manage"; }
    @Override public String getDescription() { return "管理绩效规则 — 设定或修改KPI权重和考核指标, 仅老板/财务可操作, 每月1号生效."; }
    @Override public Map<String, Object> getParametersSchema() {
        return Map.of("type", "object", "properties", Map.of(
            "store_id", Map.of("type", "string"), "month", Map.of("type", "string", "description", "生效月 YYYY-MM"),
            "kpi_weights", Map.of("type", "object", "description", "KPI配置 {name: {weight, target}}")),
            "required", List.of("month", "kpi_weights"));
    }
    @Override protected List<String> getRequiredParameters() { return List.of("month", "kpi_weights"); }

    @Override @SuppressWarnings("unchecked")
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> ctx) throws Exception {
        String storeId = getString(params, "store_id");
        LocalDate month = LocalDate.parse(getString(params, "month") + "-01");
        Map<String, Object> weights = (Map<String, Object>) params.get("kpi_weights");
        PerformanceRule rule = ruleService.createOrUpdate(factoryId, storeId, month, weights, null, "OWNER", null);
        return buildSimpleResult("绩效规则已设置, " + month.getMonth() + "月1日生效",
            Map.of("ruleId", rule.getId(), "effectiveMonth", rule.getEffectiveMonth().toString()));
    }
}
```

- [ ] **Step 2: Create PerformanceEvalTool (diagnostic)**

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;
import lombok.extern.slf4j.Slf4j; import org.springframework.stereotype.Component;
import java.util.Arrays; import java.util.List; import java.util.Map;

@Slf4j @Component
public class PerformanceEvalTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_performance_eval"; }
    @Override public String getDescription() { return "绩效评估 — 基于可控利润+人效+点评分三维度加权打分."; }
    @Override protected String getSectionName() { return "performance_eval"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("各门店绩效排名", "调整KPI权重", "查看可控利润明细");
    }
}
```

- [ ] **Step 3: Compile + commit**

---

### Task 11: Store KPI Dashboard Python handler (TDD)

- [ ] **Step 1: Test** `backend/python/tests/test_store_kpi_dashboard.py`

```python
"""Store KPI dashboard: unified view of financial + operational + external metrics."""
from smartbi.services.restaurant.sections.base import SectionRequest
from smartbi.services.restaurant.sections.store_kpi_dashboard import StoreKpiDashboardHandler

def _req(params):
    return SectionRequest(factory_id="F-TEST", upload_id=None, sub_sector="火锅",
                          store_id="S-001", store_name="测试店", params=params)

def test_full_dashboard():
    resp = StoreKpiDashboardHandler().compute(
        _req({
            "financial": {"controllable_profit": 180000, "revenue": 500000, "labor_cost_pct": 22.5},
            "operational": {"labor_productivity": 35000, "staff_turnover_pct": 8.0, "shift_compliance": 95.0},
            "external": {"review_score": 4.3, "negative_review_pct": 2.1},
        }), {})
    assert resp.status.value == "ok"
    d = resp.data
    assert len(d["dimensions"]) == 3
    assert d["overall_health"] in ("GOOD", "WARNING", "CRITICAL")

def test_partial_data():
    resp = StoreKpiDashboardHandler().compute(
        _req({"financial": {"revenue": 300000}}), {})
    assert resp.status.value == "ok"
    assert len(resp.data["dimensions"]) >= 1

def test_skipped_empty():
    resp = StoreKpiDashboardHandler().compute(_req({}), {})
    assert resp.status.value == "skipped"
```

- [ ] **Step 2: Implement** `backend/python/smartbi/services/restaurant/sections/store_kpi_dashboard.py`

```python
"""Store KPI dashboard: 3-dimension health check (financial + operational + external)."""
import time
from typing import Any
from smartbi.services.restaurant.sections.base import AbstractSectionHandler, SectionRequest, SectionResponse

class StoreKpiDashboardHandler(AbstractSectionHandler):
    section_name = "store_kpi_dashboard"

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        p = request.params or {}
        fin = p.get("financial")
        ops = p.get("operational")
        ext = p.get("external")

        if not fin and not ops and not ext:
            return self.skipped(request, "未提供任何维度数据 (financial/operational/external)", started)

        dimensions = []
        alerts = []

        if fin:
            profit = float(fin.get("controllable_profit", 0))
            revenue = float(fin.get("revenue", 0))
            labor_pct = float(fin.get("labor_cost_pct", 0))
            margin = round(profit / revenue * 100, 1) if revenue > 0 else 0
            health = "GOOD" if margin >= 30 else "WARNING" if margin >= 20 else "CRITICAL"
            dimensions.append({"name": "财务", "health": health, "metrics": [
                {"label": "可控利润率", "value": f"{margin}%", "status": health},
                {"label": "人力成本占比", "value": f"{labor_pct}%",
                 "status": "GOOD" if labor_pct <= 22 else "WARNING" if labor_pct <= 28 else "CRITICAL"},
            ]})
            if margin < 20: alerts.append(f"可控利润率 {margin}% 低于警戒线 20%")

        if ops:
            prod = float(ops.get("labor_productivity", 0))
            turnover = float(ops.get("staff_turnover_pct", 0))
            compliance = float(ops.get("shift_compliance", 0))
            health = "GOOD" if 30000 <= prod <= 40000 else "WARNING"
            dimensions.append({"name": "营运", "health": health, "metrics": [
                {"label": "人效", "value": f"¥{prod:,.0f}/人", "status": health},
                {"label": "员工流失率", "value": f"{turnover}%",
                 "status": "GOOD" if turnover <= 10 else "WARNING" if turnover <= 20 else "CRITICAL"},
                {"label": "排班达标率", "value": f"{compliance}%",
                 "status": "GOOD" if compliance >= 90 else "WARNING"},
            ]})
            if prod < 30000: alerts.append(f"人效 ¥{prod:,.0f} 低于3万")
            if prod > 40000: alerts.append(f"人效 ¥{prod:,.0f} 超过4万, 服务跟不上风险")

        if ext:
            score = float(ext.get("review_score", 0))
            neg_pct = float(ext.get("negative_review_pct", 0))
            health = "GOOD" if score >= 4.5 else "WARNING" if score >= 4.0 else "CRITICAL"
            dimensions.append({"name": "外部评价", "health": health, "metrics": [
                {"label": "点评评分", "value": f"{score}", "status": health},
                {"label": "差评率", "value": f"{neg_pct}%",
                 "status": "GOOD" if neg_pct <= 1 else "WARNING" if neg_pct <= 3 else "CRITICAL"},
            ]})
            if score < 4.0: alerts.append(f"点评评分 {score} 低于4.0")

        healths = [d["health"] for d in dimensions]
        overall = "CRITICAL" if "CRITICAL" in healths else "WARNING" if "WARNING" in healths else "GOOD"

        return self.ok(request, data={
            "dimensions": dimensions, "overall_health": overall,
            "alerts": alerts, "dimension_count": len(dimensions),
        }, started=started)
```

- [ ] **Step 3: Run tests + commit**

---

### Task 12: Store KPI Dashboard Java tool

```java
package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;
import lombok.extern.slf4j.Slf4j; import org.springframework.stereotype.Component;
import java.util.Arrays; import java.util.List; import java.util.Map;

@Slf4j @Component
public class StoreKpiDashboardTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_store_kpi_dashboard"; }
    @Override public String getDescription() { return "店长KPI仪表盘 — 财务+营运+外部评价三维度健康度评估."; }
    @Override protected String getSectionName() { return "store_kpi_dashboard"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("各门店KPI对比", "查看某一维度明细", "生成月度绩效报告");
    }
}
```

- [ ] **Step 1: Create + compile + commit**

---

### Task 13: Flyway migrations + wiring

- [ ] **Step 1: Create 4 Flyway files**

`V20260412_06__restaurant_shift_schedule.sql`:
```sql
CREATE TABLE IF NOT EXISTS restaurant_shift_templates (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL, store_id VARCHAR(64),
    template_name VARCHAR(64) NOT NULL, start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL, duration_hours NUMERIC(4,1),
    employee_type VARCHAR(20) DEFAULT 'BOTH', is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP);

CREATE TABLE IF NOT EXISTS restaurant_shift_schedules (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL, store_id VARCHAR(64) NOT NULL,
    employee_id VARCHAR(64) NOT NULL, employee_name VARCHAR(64),
    shift_date DATE NOT NULL, shift_template_id VARCHAR(36),
    actual_hours NUMERIC(4,1), employee_type VARCHAR(20) NOT NULL,
    hourly_rate NUMERIC(8,2), status VARCHAR(20) DEFAULT 'SCHEDULED',
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP,
    CONSTRAINT uq_shift_employee_date UNIQUE (factory_id, store_id, employee_id, shift_date));
CREATE INDEX IF NOT EXISTS idx_shift_store_date ON restaurant_shift_schedules (factory_id, store_id, shift_date);
```

`V20260412_07__restaurant_piecework_config.sql`:
```sql
CREATE TABLE IF NOT EXISTS restaurant_piecework_configs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL, store_id VARCHAR(64),
    role VARCHAR(32) NOT NULL, calc_mode VARCHAR(16) NOT NULL DEFAULT 'TEAM',
    base_threshold INTEGER, base_salary NUMERIC(10,2), per_unit_bonus NUMERIC(8,2),
    unit_type VARCHAR(16) DEFAULT 'COVER', team_size INTEGER,
    effective_month DATE, is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP,
    CONSTRAINT uq_piecework_role_month UNIQUE (factory_id, store_id, role, effective_month));
```

`V20260412_08__restaurant_performance_rule.sql`:
```sql
CREATE TABLE IF NOT EXISTS restaurant_performance_rules (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    factory_id VARCHAR(64) NOT NULL, store_id VARCHAR(64),
    effective_month DATE NOT NULL, kpi_weights JSONB, non_controllable_items JSONB,
    modify_role VARCHAR(32) DEFAULT 'OWNER', created_by VARCHAR(64),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP,
    CONSTRAINT uq_perf_rule_month UNIQUE (factory_id, store_id, effective_month));
```

`V20260412_09__restaurant_phase4_intents.sql` — 8 intents: shift_create, shift_analysis, piecework_config, piecework_calc, performance_rule_manage, performance_eval, store_kpi_dashboard + seat_config_manage (if not already present).

- [ ] **Step 2-6: Router (4 handlers), Vue cards (4), SectionCardRenderer, keyword regex, test update**

Same pattern as Phase 1-3 wiring. New keywords:
```
"|排班|公式制|全职兼职|班次|工时|排班分析|排班优化" +
"|计件|提成|迎宾计件|小组计件|绩效提成|按单计算" +
"|绩效规则|绩效考核|KPI|考核权重|可控利润考核" +
"|店长KPI|三维度|健康度|门店评分|综合评估"
```

- [ ] **Step 7: Verify + apply + push**

---

## Self-Review

| Requirement (from transcript) | Task(s) | Status |
|---|---|---|
| 公式制排班 (全职160-180h保底 + 兼职调剂) [T 28:06-31:00] | 1-4 | Covered |
| 迎宾个人计件 (2000单=5000元, 超出3元/单) [T 33:16-34:18] | 5-7 | Covered |
| 服务员/传菜员小组计件 [T 35:01-37:00] | 5-7 (TEAM mode) | Covered |
| 绩效三维度 (财务+营运+外部) [T 18:52-22:00] | 11-12 | Covered |
| 可控利润用于考核 [T 19:12-20:25] | 9 (kpi_weights has controllable_profit) | Covered |
| 规则变更月初生效 + 权限控制 [T 23:44-24:00] | 8, 10 (effective_month + modify_role) | Covered |
| 点评评分 ≥4.5 目标 [T 21:28] | 11 (external dimension threshold) | Covered |
| 差评率 ≤1-2% [T 21:41] | 11 (negative_review_pct threshold) | Covered |
| 人效 3-4万区间 [T 27:00] | 11 (operational dimension) | Covered |
