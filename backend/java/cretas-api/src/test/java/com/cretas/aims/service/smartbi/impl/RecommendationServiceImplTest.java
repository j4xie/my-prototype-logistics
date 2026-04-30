package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.Alert;
import com.cretas.aims.entity.smartbi.SmartBiDepartmentData;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.repository.smartbi.SmartBiDepartmentDataRepository;
import com.cretas.aims.repository.smartbi.SmartBiFinanceDataRepository;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import com.cretas.aims.util.DateRangeUtils;
import com.cretas.aims.util.DateRangeUtils.DateRange;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Task A2: TDD unit tests verifying that generateSalesAlerts and
 * generateDepartmentAlerts produce alerts in stable alphabetical order,
 * not HashMap-arbitrary iteration order.
 *
 * Red → fix → Green for each test, then full class regression.
 */
@ExtendWith(MockitoExtension.class)
class RecommendationServiceImplTest {

    @Mock private SmartBiSalesDataRepository salesDataRepository;
    @Mock private SmartBiFinanceDataRepository financeDataRepository;
    @Mock private SmartBiDepartmentDataRepository departmentDataRepository;
    @Mock private ObjectMapper objectMapper;

    @InjectMocks
    private RecommendationServiceImpl service;

    private static final String FACTORY = "F999";
    private static final DateRange RANGE = DateRangeUtils.range(
            LocalDate.of(2026, 4, 1),
            LocalDate.of(2026, 4, 30));

    /** Helper: build a sales row with salesperson below RED threshold (0% completion). */
    private SmartBiSalesData salesRow(String salesperson, BigDecimal amount, BigDecimal target) {
        SmartBiSalesData d = new SmartBiSalesData();
        d.setFactoryId(FACTORY);
        d.setOrderDate(LocalDate.of(2026, 4, 15));
        d.setSalespersonName(salesperson);
        d.setAmount(amount);
        d.setMonthlyTarget(target);
        return d;
    }

    /** Helper: build a department row with per-capita below YELLOW threshold. */
    private SmartBiDepartmentData deptRow(String dept, BigDecimal sales, int headcount) {
        SmartBiDepartmentData d = new SmartBiDepartmentData();
        d.setFactoryId(FACTORY);
        d.setRecordDate(LocalDate.of(2026, 4, 15));
        d.setDepartment(dept);
        d.setSalesAmount(sales);
        d.setHeadcount(headcount);
        return d;
    }

    @BeforeEach
    void setUp() {
        // Ensure thresholds are at defaults (loadAlertThresholds uses ClassPathResource,
        // which returns exists()=false in plain Mockito context → falls back to defaults).
        // No extra setup needed; @PostConstruct is NOT invoked by MockitoExtension.
    }

    /**
     * Task A2 — Sales sort TDD.
     *
     * Fixture: 3 salespeople inserted in reverse-alpha order (王五 / 李四 / 张三).
     * All have 0% completion vs target → all below RED threshold (60%).
     * Expected: alerts ordered by salesperson name ascending (张三 → 李四 → 王五).
     *
     * PRE-FIX: fails because groupingBy(::salespersonName) produces HashMap →
     *          iteration order non-deterministic (may accidentally pass once but
     *          consistently fails under JVM hash-map seed changes / repeated runs).
     * POST-FIX: passes because TreeMap::new supplier guarantees sorted keys.
     */
    @Test
    void salesAlertsAreSortedBySalespersonName() {
        // Arrange — insert in reverse-alpha order to expose HashMap non-determinism
        BigDecimal target = new BigDecimal("100000");
        BigDecimal amount = new BigDecimal("10000"); // 10% < 60% RED threshold

        List<SmartBiSalesData> fixture = List.of(
                salesRow("王五", amount, target),  // Unicode: 29579
                salesRow("李四", amount, target),  // Unicode: 26446
                salesRow("张三", amount, target)   // Unicode: 24352
        );

        when(salesDataRepository.findByFactoryIdAndOrderDateBetween(
                eq(FACTORY), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(fixture);

        // Act
        List<Alert> alerts = service.generateSalesAlerts(FACTORY, RANGE);

        // Assert — filter to per-salesperson alerts only (skip overall completion + growth alerts)
        List<Alert> salespersonAlerts = alerts.stream()
                .filter(a -> "sales".equals(a.getCategory()) && a.getRelatedEntityName() != null)
                .toList();

        assertThat(salespersonAlerts).hasSize(3);
        assertThat(salespersonAlerts)
                .extracting(Alert::getRelatedEntityName)
                .containsExactly("张三", "李四", "王五");  // Unicode ascending: 24352 < 26446 < 29579
    }

    /**
     * Task A2 — Department sort TDD.
     *
     * Fixture: 3 departments inserted in reverse-alpha order (研发部 / 销售部 / 行政部).
     * All have per-capita < 80000 (YELLOW threshold) but > 50000 (RED threshold),
     * so each emits a YELLOW alert.
     * Expected: alerts ordered by department name ascending (研发部 → 行政部 → 销售部).
     *
     * Chinese Unicode order: 研 (30740) < 行 (34892) < 销 (38144).
     *
     * PRE-FIX: fails because groupingBy(::department) produces HashMap.
     * POST-FIX: passes because TreeMap::new supplier guarantees sorted keys.
     */
    @Test
    void departmentAlertsAreSortedByDepartmentName() {
        // Arrange — per-capita = 70000 → below YELLOW (80000) but above RED (50000)
        // headcount=1, salesAmount=70000 → perCapita=70000
        BigDecimal sales = new BigDecimal("70000");
        int headcount = 1;

        List<SmartBiDepartmentData> fixture = List.of(
                deptRow("研发部", sales, headcount),  // Unicode 研: 30740
                deptRow("销售部", sales, headcount),  // Unicode 销: 38144
                deptRow("行政部", sales, headcount)   // Unicode 行: 34892
        );

        when(departmentDataRepository.findByFactoryIdAndRecordDateBetween(
                eq(FACTORY), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(fixture);

        // Act
        List<Alert> alerts = service.generateDepartmentAlerts(FACTORY, RANGE);

        // Assert — all 3 should be YELLOW department alerts
        // departmentAlert() factory does not set relatedEntityName; extract dept name from title
        // title format: "%s 人均产出偏低" (YELLOW) or "%s 人均产出过低" (RED)
        assertThat(alerts).hasSize(3);
        List<String> deptNames = alerts.stream()
                .map(a -> a.getTitle().split(" ")[0])  // first token before space is the dept name
                .toList();
        assertThat(deptNames)
                .containsExactly("研发部", "行政部", "销售部");  // Unicode: 30740 < 34892 < 38144
    }
}
