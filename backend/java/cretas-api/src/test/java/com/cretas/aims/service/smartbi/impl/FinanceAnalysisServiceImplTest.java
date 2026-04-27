package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.client.GoldFinanceClient;
import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.entity.smartbi.SmartBiFinanceData;
import com.cretas.aims.entity.smartbi.enums.RecordType;
import com.cretas.aims.repository.smartbi.SmartBiFinanceDataRepository;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import com.cretas.aims.service.smartbi.GoldDashboardBuilder;
import com.cretas.aims.service.smartbi.MetricCalculatorService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * P0-1 finance bug fix coverage:
 *  - Bug B: cost negative (Excel write-layer Bug A residue) must be coerced via .abs()
 *           so revenue.subtract(cost) returns true gross profit (not revenue + |cost|).
 *  - Bug C: trendChart grossMargin must be capped to null when |grossMargin| > 100%
 *           (consistent with getProfitMetrics defensive cap at lines 403-405).
 */
@ExtendWith(MockitoExtension.class)
class FinanceAnalysisServiceImplTest {

    @Mock private SmartBiFinanceDataRepository financeDataRepository;
    @Mock private SmartBiSalesDataRepository salesDataRepository;
    @Mock private MetricCalculatorService metricCalculatorService;
    @Mock private GoldFinanceClient goldFinanceClient;
    @Mock private GoldDashboardBuilder goldDashboardBuilder;

    @InjectMocks
    private FinanceAnalysisServiceImpl service;

    private static final String FACTORY = "F001";
    private static final LocalDate START = LocalDate.of(2026, 4, 1);
    private static final LocalDate END = LocalDate.of(2026, 4, 30);

    /** Helper: build a finance row with given fields. */
    private SmartBiFinanceData costRow(BigDecimal totalCost) {
        SmartBiFinanceData d = new SmartBiFinanceData();
        d.setRecordType(RecordType.COST);
        d.setRecordDate(LocalDate.of(2026, 4, 15));
        d.setTotalCost(totalCost);
        d.setUploadId(1L);
        return d;
    }

    private SmartBiFinanceData revenueRow(BigDecimal amount, String category) {
        SmartBiFinanceData d = new SmartBiFinanceData();
        d.setRecordType(RecordType.REVENUE);
        d.setRecordDate(LocalDate.of(2026, 4, 15));
        d.setActualAmount(amount);
        d.setCategory(category);
        d.setUploadId(1L);
        return d;
    }

    private SmartBiFinanceData costStructureRow(BigDecimal material, BigDecimal labor, BigDecimal overhead) {
        SmartBiFinanceData d = new SmartBiFinanceData();
        d.setRecordType(RecordType.COST);
        d.setRecordDate(LocalDate.of(2026, 4, 15));
        d.setMaterialCost(material);
        d.setLaborCost(labor);
        d.setOverheadCost(overhead);
        d.setTotalCost(material.add(labor).add(overhead));
        d.setUploadId(1L);
        return d;
    }

    // ---------- Bug B: getProfitMetrics .abs() ----------

    @Test
    void getProfitMetrics_negativeCostFromExcel_isAbsolutized() {
        // 历史数据：cost 存为 -100 (Excel 写入层 Bug A)，revenue 200
        // 期望: cost 取 |−100|=100, grossProfit=100, grossMargin=50%
        // 旧 bug: grossProfit=200-(-100)=300, grossMargin=150% → null
        when(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                anyString(), any(RecordType.class), any(), any()))
                .thenAnswer(inv -> {
                    RecordType rt = inv.getArgument(1);
                    if (rt == RecordType.REVENUE) {
                        return List.of(revenueRow(new BigDecimal("200"), "营业收入"));
                    } else {
                        return List.of(costRow(new BigDecimal("-100")));
                    }
                });

        List<MetricResult> metrics = service.getProfitMetrics(FACTORY, START, END);

        MetricResult grossProfit = metrics.stream()
                .filter(m -> MetricCalculatorService.GROSS_PROFIT.equals(m.getMetricCode()))
                .findFirst().orElseThrow();
        MetricResult grossMargin = metrics.stream()
                .filter(m -> MetricCalculatorService.GROSS_MARGIN.equals(m.getMetricCode()))
                .findFirst().orElseThrow();

        // grossProfit must be 100 (revenue 200 - |cost| 100), not 300
        assertEquals(0, grossProfit.getValue().compareTo(new BigDecimal("100")),
                "grossProfit should be 100 after .abs() coerces cost; raw value=" + grossProfit.getValue());

        // grossMargin must be 50% (within sane bounds), not 150% which would be capped to null
        assertNotNull(grossMargin.getValue(), "grossMargin should be 50% — non-null because within ±100%");
        assertEquals(0, grossMargin.getValue().compareTo(new BigDecimal("50.00")),
                "grossMargin should be 50.00; raw=" + grossMargin.getValue());
    }

    @Test
    void getProfitMetrics_grossMarginAbove100_isCappedToNull() {
        // revenue 100, cost 0 → grossProfit=100, grossMargin=100% (boundary, should still be valid)
        // Use revenue 100, cost -10 (becomes |10|): grossProfit=90, grossMargin=90% → valid
        // Force >100%: revenue 100 cost -200 → after abs cost=200, grossProfit=-100, grossMargin=-100% (boundary)
        // To trigger >100%: impossible mathematically when cost>=0 (grossProfit/revenue = (rev-cost)/rev <=1).
        // Reproduce by mocking only revenue sum without "收入" category match keeping totalRevenue=0?
        // Simpler: directly assert getProfitMetrics:403-405 cap branch — revenue 100, cost -300:
        // After .abs() cost=300 → grossProfit=-200 → grossMargin=-200% → must be null.
        when(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                anyString(), any(RecordType.class), any(), any()))
                .thenAnswer(inv -> {
                    RecordType rt = inv.getArgument(1);
                    if (rt == RecordType.REVENUE) {
                        return List.of(revenueRow(new BigDecimal("100"), "营业收入"));
                    } else {
                        return List.of(costRow(new BigDecimal("-300")));
                    }
                });

        List<MetricResult> metrics = service.getProfitMetrics(FACTORY, START, END);

        MetricResult grossMargin = metrics.stream()
                .filter(m -> MetricCalculatorService.GROSS_MARGIN.equals(m.getMetricCode()))
                .findFirst().orElseThrow();

        // grossMargin = (100 - 300) / 100 * 100 = -200% → must be null per cap
        assertNull(grossMargin.getValue(), "grossMargin -200% must be capped to null");
        assertEquals("N/A", grossMargin.getFormattedValue(), "formattedValue should be N/A when null");
    }

    // ---------- Bug B: getCostStructureChart .abs() per component ----------

    @Test
    void getCostStructureChart_negativeComponents_areAbsolutized() {
        // Excel 历史 — material=-50, labor=-30, overhead=-20 (Bug A residue)
        // 期望 totalCost = 100 (50+30+20), 不是 -100
        when(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                anyString(), any(RecordType.class), any(), any()))
                .thenReturn(List.of(costStructureRow(
                        new BigDecimal("-50"), new BigDecimal("-30"), new BigDecimal("-20"))));

        ChartConfig chart = service.getCostStructureChart(FACTORY, START, END);

        assertNotNull(chart);
        assertEquals(3, chart.getData().size(), "should have 3 cost categories");
        // Each pie slice's "value" should be the |raw| component, not raw or 0
        for (Map<String, Object> slice : chart.getData()) {
            BigDecimal value = (BigDecimal) slice.get("value");
            assertTrue(value.compareTo(BigDecimal.ZERO) > 0,
                    "Each cost slice value must be positive after .abs(); got " + value + " for " + slice.get("name"));
        }
    }

    // ---------- Bug C: trendChart grossMargin > 100% capped to null ----------

    @Test
    void getProfitTrendChart_grossMarginOutOfRange_isCappedToNull() {
        // Same scenario as P0-1 Bug C: trendChart has historical data where
        // |grossMargin| > 100% should yield null (consistent with getProfitMetrics).
        // revenue 100 (收入), cost -300 → after .abs() cost=300 → grossMargin = -200% → null
        when(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                anyString(), any(RecordType.class), any(), any()))
                .thenAnswer(inv -> {
                    RecordType rt = inv.getArgument(1);
                    if (rt == RecordType.REVENUE) {
                        return List.of(revenueRow(new BigDecimal("100"), "营业收入"));
                    } else {
                        return List.of(costRow(new BigDecimal("-300")));
                    }
                });

        ChartConfig chart = service.getProfitTrendChart(FACTORY, START, END, "MONTH");

        assertNotNull(chart);
        assertFalse(chart.getData().isEmpty(), "trendChart should have at least one period");
        Map<String, Object> point = chart.getData().get(0);

        // After P0-1 fix:
        //   cost = |-300| = 300 (not -300)
        //   grossProfit = 100 - 300 = -100 (not 100 - (-300) = 400)
        //   grossMargin = -100 / 100 * 100 = -100% (boundary, NOT capped to null because <=−100)
        // Strictness: spec says "<-100" for cap, so -100% exactly is NOT capped. Verify cost first.
        BigDecimal cost = (BigDecimal) point.get("cost");
        assertEquals(0, cost.compareTo(new BigDecimal("300.00")),
                "trendChart cost should be |−300|=300 after Bug B fix; got " + cost);

        BigDecimal grossProfit = (BigDecimal) point.get("grossProfit");
        assertEquals(0, grossProfit.compareTo(new BigDecimal("-200.00")),
                "trendChart grossProfit should be 100 - 300 = -200; got " + grossProfit);

        // grossProfit/revenue = -200/100 * 100 = -200% → must be null per Bug C cap
        Object grossMargin = point.get("grossMargin");
        assertNull(grossMargin, "trendChart grossMargin -200% must be capped to null per Bug C fix");
    }

    @Test
    void getProfitTrendChart_normalGrossMargin_unchanged() {
        // Sanity: 50% grossMargin must NOT be capped.
        when(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                anyString(), any(RecordType.class), any(), any()))
                .thenAnswer(inv -> {
                    RecordType rt = inv.getArgument(1);
                    if (rt == RecordType.REVENUE) {
                        return List.of(revenueRow(new BigDecimal("200"), "营业收入"));
                    } else {
                        return List.of(costRow(new BigDecimal("100")));
                    }
                });

        ChartConfig chart = service.getProfitTrendChart(FACTORY, START, END, "MONTH");

        Map<String, Object> point = chart.getData().get(0);
        BigDecimal grossMargin = (BigDecimal) point.get("grossMargin");
        assertNotNull(grossMargin, "50% grossMargin must NOT be capped");
        assertEquals(0, grossMargin.compareTo(new BigDecimal("50.00")),
                "grossMargin should be 50.00; got " + grossMargin);
    }
}
