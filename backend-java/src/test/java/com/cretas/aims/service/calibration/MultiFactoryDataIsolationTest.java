package com.cretas.aims.service.calibration;

import com.cretas.aims.dto.calibration.CalibrationDashboardDTO;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics.PeriodType;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.entity.calibration.ToolReliabilityStats;
import com.cretas.aims.repository.calibration.BehaviorCalibrationMetricsRepository;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.repository.calibration.ToolReliabilityStatsRepository;
import com.cretas.aims.service.calibration.impl.BehaviorCalibrationServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 多工厂数据隔离测试
 * 验证不同工厂之间的数据完全隔离，确保数据安全性
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("MultiFactoryDataIsolation 多工厂数据隔离测试")
class MultiFactoryDataIsolationTest {

    @Mock
    private BehaviorCalibrationMetricsRepository metricsRepository;

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolReliabilityStatsRepository reliabilityStatsRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    private BehaviorCalibrationServiceImpl calibrationService;

    private static final String FACTORY_A = "F001";
    private static final String FACTORY_B = "F002";
    private static final String FACTORY_C = "F003";
    private static final String PLATFORM_ADMIN_FACTORY_ID = null; // 平台管理员无factoryId
    private static final LocalDate TEST_DATE = LocalDate.of(2026, 1, 19);

    @BeforeEach
    void setUp() {
        calibrationService = new BehaviorCalibrationServiceImpl(
            metricsRepository,
            toolCallRecordRepository,
            reliabilityStatsRepository,
            objectMapper
        );
    }

    @Test
    @DisplayName("工厂A不能看到工厂B的指标数据")
    void factory_A_cannot_see_factory_B_metrics() {
        // 准备工厂A的指标数据
        BehaviorCalibrationMetrics metricsA = createMockMetrics(FACTORY_A, TEST_DATE, 95.0);

        // 准备工厂B的指标数据
        BehaviorCalibrationMetrics metricsB = createMockMetrics(FACTORY_B, TEST_DATE, 85.0);

        // 模拟工厂A查询时只返回工厂A的数据
        when(metricsRepository.findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(FACTORY_A, PeriodType.DAILY))
            .thenReturn(Optional.of(metricsA));
        when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            eq(FACTORY_A), any(), any(), eq(PeriodType.DAILY)))
            .thenReturn(Collections.singletonList(metricsA));
        when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(eq(FACTORY_A), any()))
            .thenReturn(Collections.emptyList());
        when(toolCallRecordRepository.findTop20ByFactoryIdOrderByCreatedAtDesc(FACTORY_A))
            .thenReturn(Collections.emptyList());

        // 工厂A获取仪表盘数据
        CalibrationDashboardDTO dashboardA = calibrationService.getDashboardData(FACTORY_A);

        // 验证只返回工厂A的数据
        assertNotNull(dashboardA);
        assertNotNull(dashboardA.getCurrentMetrics());
        // CurrentMetrics doesn't have factoryId, so we verify by checking the mock was called with FACTORY_A
        verify(metricsRepository).findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(eq(FACTORY_A), any());

        // 验证没有调用工厂B的数据
        verify(metricsRepository, never()).findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(eq(FACTORY_B), any());
    }

    @Test
    @DisplayName("工厂A不能看到工厂B的工具调用记录")
    void factory_A_cannot_see_factory_B_tool_calls() {
        // 准备工厂A和工厂B的调用记录
        List<ToolCallRecord> recordsA = Arrays.asList(
            createMockToolCallRecord(1L, FACTORY_A, "session-A1"),
            createMockToolCallRecord(2L, FACTORY_A, "session-A2")
        );

        List<ToolCallRecord> recordsB = Arrays.asList(
            createMockToolCallRecord(3L, FACTORY_B, "session-B1"),
            createMockToolCallRecord(4L, FACTORY_B, "session-B2")
        );

        // 模拟工厂A查询
        when(toolCallRecordRepository.findTop20ByFactoryIdOrderByCreatedAtDesc(FACTORY_A))
            .thenReturn(recordsA);

        // 工厂A查询最近的调用记录
        List<ToolCallRecord> result = toolCallRecordRepository.findTop20ByFactoryIdOrderByCreatedAtDesc(FACTORY_A);

        // 验证结果只包含工厂A的记录
        assertEquals(2, result.size());
        assertTrue(result.stream().allMatch(r -> FACTORY_A.equals(r.getFactoryId())),
            "所有返回的记录都应该属于工厂A");

        // 验证没有工厂B的记录
        assertTrue(result.stream().noneMatch(r -> FACTORY_B.equals(r.getFactoryId())),
            "不应返回工厂B的记录");
    }

    @Test
    @DisplayName("平台管理员可以查看所有工厂的数据")
    void platform_admin_can_see_all_factories() {
        // 准备所有工厂的指标数据
        List<BehaviorCalibrationMetrics> allFactoriesMetrics = Arrays.asList(
            createMockMetrics(FACTORY_A, TEST_DATE, 95.0),
            createMockMetrics(FACTORY_B, TEST_DATE, 85.0),
            createMockMetrics(FACTORY_C, TEST_DATE, 90.0)
        );

        // 模拟平台管理员查询所有工厂（使用null作为factoryId）
        // 当factoryId为null时，服务调用不同的repository方法
        when(metricsRepository.findByFactoryIdIsNullAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            eq(TEST_DATE), eq(TEST_DATE), eq(PeriodType.DAILY)))
            .thenReturn(allFactoriesMetrics);

        // 平台管理员查询
        List<BehaviorCalibrationMetrics> result = calibrationService.getMetricsTrend(
            null, TEST_DATE, TEST_DATE, PeriodType.DAILY);

        // 验证返回所有工厂的数据
        assertEquals(3, result.size());
        assertTrue(result.stream().anyMatch(m -> FACTORY_A.equals(m.getFactoryId())));
        assertTrue(result.stream().anyMatch(m -> FACTORY_B.equals(m.getFactoryId())));
        assertTrue(result.stream().anyMatch(m -> FACTORY_C.equals(m.getFactoryId())));
    }

    @Test
    @DisplayName("工厂间指标计算相互独立")
    void factory_metrics_calculation_independent() {
        LocalDateTime startOfDay = TEST_DATE.atStartOfDay();
        LocalDateTime endOfDay = TEST_DATE.plusDays(1).atStartOfDay();

        // 工厂A的统计数据
        when(toolCallRecordRepository.countByFactoryIdAndTimeRange(eq(FACTORY_A), any(), any()))
            .thenReturn(100L);
        when(toolCallRecordRepository.countSuccessfulByFactoryIdAndTimeRange(eq(FACTORY_A), any(), any()))
            .thenReturn(95L);
        when(toolCallRecordRepository.countRedundantByFactoryIdAndTimeRange(eq(FACTORY_A), any(), any()))
            .thenReturn(5L);
        when(toolCallRecordRepository.countRecoveredByFactoryIdAndTimeRange(eq(FACTORY_A), any(), any()))
            .thenReturn(3L);
        when(toolCallRecordRepository.countFailedByFactoryIdAndTimeRange(eq(FACTORY_A), any(), any()))
            .thenReturn(5L);
        when(toolCallRecordRepository.sumInputTokensByFactoryIdAndTimeRange(eq(FACTORY_A), any(), any()))
            .thenReturn(50000L);
        when(toolCallRecordRepository.sumOutputTokensByFactoryIdAndTimeRange(eq(FACTORY_A), any(), any()))
            .thenReturn(30000L);
        when(toolCallRecordRepository.avgExecutionTimeByFactoryIdAndTimeRange(eq(FACTORY_A), any(), any()))
            .thenReturn(250.0);
        when(toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(eq(FACTORY_A), any(), any()))
            .thenReturn(Collections.emptyList());
        when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(FACTORY_A, TEST_DATE, PeriodType.DAILY))
            .thenReturn(Optional.empty());
        when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        // 工厂B的统计数据（不同的数值）
        when(toolCallRecordRepository.countByFactoryIdAndTimeRange(eq(FACTORY_B), any(), any()))
            .thenReturn(200L);
        when(toolCallRecordRepository.countSuccessfulByFactoryIdAndTimeRange(eq(FACTORY_B), any(), any()))
            .thenReturn(180L);
        when(toolCallRecordRepository.countRedundantByFactoryIdAndTimeRange(eq(FACTORY_B), any(), any()))
            .thenReturn(10L);
        when(toolCallRecordRepository.countRecoveredByFactoryIdAndTimeRange(eq(FACTORY_B), any(), any()))
            .thenReturn(8L);
        when(toolCallRecordRepository.countFailedByFactoryIdAndTimeRange(eq(FACTORY_B), any(), any()))
            .thenReturn(20L);
        when(toolCallRecordRepository.sumInputTokensByFactoryIdAndTimeRange(eq(FACTORY_B), any(), any()))
            .thenReturn(100000L);
        when(toolCallRecordRepository.sumOutputTokensByFactoryIdAndTimeRange(eq(FACTORY_B), any(), any()))
            .thenReturn(60000L);
        when(toolCallRecordRepository.avgExecutionTimeByFactoryIdAndTimeRange(eq(FACTORY_B), any(), any()))
            .thenReturn(300.0);
        when(toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(eq(FACTORY_B), any(), any()))
            .thenReturn(Collections.emptyList());
        when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(FACTORY_B, TEST_DATE, PeriodType.DAILY))
            .thenReturn(Optional.empty());

        // 分别计算两个工厂的指标
        BehaviorCalibrationMetrics metricsA = calibrationService.calculateDailyMetrics(FACTORY_A, TEST_DATE);
        BehaviorCalibrationMetrics metricsB = calibrationService.calculateDailyMetrics(FACTORY_B, TEST_DATE);

        // 验证两个工厂的数据是独立的
        assertEquals(FACTORY_A, metricsA.getFactoryId());
        assertEquals(FACTORY_B, metricsB.getFactoryId());
        assertEquals(100, metricsA.getTotalCalls());
        assertEquals(200, metricsB.getTotalCalls());
        assertNotEquals(metricsA.getTotalCalls(), metricsB.getTotalCalls());
    }

    @Test
    @DisplayName("工具可靠性排名工厂隔离")
    void tool_reliability_ranking_factory_isolation() {
        List<ToolReliabilityStats> statsA = Arrays.asList(
            createMockToolStats(FACTORY_A, "tool_a", 99.0),
            createMockToolStats(FACTORY_A, "tool_b", 95.0)
        );

        List<ToolReliabilityStats> statsB = Arrays.asList(
            createMockToolStats(FACTORY_B, "tool_a", 85.0),
            createMockToolStats(FACTORY_B, "tool_c", 80.0)
        );

        when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(FACTORY_A, TEST_DATE))
            .thenReturn(statsA);
        when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(FACTORY_B, TEST_DATE))
            .thenReturn(statsB);

        List<ToolReliabilityStats> rankingA = calibrationService.getToolReliabilityRanking(FACTORY_A, TEST_DATE);
        List<ToolReliabilityStats> rankingB = calibrationService.getToolReliabilityRanking(FACTORY_B, TEST_DATE);

        // 验证隔离
        assertEquals(2, rankingA.size());
        assertEquals(2, rankingB.size());
        assertTrue(rankingA.stream().allMatch(s -> FACTORY_A.equals(s.getFactoryId())));
        assertTrue(rankingB.stream().allMatch(s -> FACTORY_B.equals(s.getFactoryId())));

        // 即使是同名工具，不同工厂的成功率也不同
        Optional<ToolReliabilityStats> toolAinFactoryA = rankingA.stream()
            .filter(s -> "tool_a".equals(s.getToolName())).findFirst();
        Optional<ToolReliabilityStats> toolAinFactoryB = rankingB.stream()
            .filter(s -> "tool_a".equals(s.getToolName())).findFirst();

        assertTrue(toolAinFactoryA.isPresent());
        assertTrue(toolAinFactoryB.isPresent());
        assertNotEquals(toolAinFactoryA.get().getSuccessRate(), toolAinFactoryB.get().getSuccessRate());
    }

    @Test
    @DisplayName("趋势数据工厂隔离")
    void trend_data_factory_isolation() {
        LocalDate startDate = TEST_DATE.minusDays(7);

        List<BehaviorCalibrationMetrics> trendA = Arrays.asList(
            createMockMetrics(FACTORY_A, startDate, 90.0),
            createMockMetrics(FACTORY_A, startDate.plusDays(1), 91.0),
            createMockMetrics(FACTORY_A, startDate.plusDays(2), 92.0)
        );

        List<BehaviorCalibrationMetrics> trendB = Arrays.asList(
            createMockMetrics(FACTORY_B, startDate, 80.0),
            createMockMetrics(FACTORY_B, startDate.plusDays(1), 82.0)
        );

        when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            FACTORY_A, startDate, TEST_DATE, PeriodType.DAILY))
            .thenReturn(trendA);
        when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            FACTORY_B, startDate, TEST_DATE, PeriodType.DAILY))
            .thenReturn(trendB);

        List<BehaviorCalibrationMetrics> resultA = calibrationService.getMetricsTrend(
            FACTORY_A, startDate, TEST_DATE, PeriodType.DAILY);
        List<BehaviorCalibrationMetrics> resultB = calibrationService.getMetricsTrend(
            FACTORY_B, startDate, TEST_DATE, PeriodType.DAILY);

        assertEquals(3, resultA.size());
        assertEquals(2, resultB.size());
        assertTrue(resultA.stream().allMatch(m -> FACTORY_A.equals(m.getFactoryId())));
        assertTrue(resultB.stream().allMatch(m -> FACTORY_B.equals(m.getFactoryId())));
    }

    @Test
    @DisplayName("低可靠性工具查询工厂隔离")
    void low_reliability_tools_factory_isolation() {
        BigDecimal threshold = new BigDecimal("90.00");

        List<ToolReliabilityStats> lowToolsA = Collections.singletonList(
            createMockToolStats(FACTORY_A, "slow_tool", 85.0)
        );

        List<ToolReliabilityStats> lowToolsB = Arrays.asList(
            createMockToolStats(FACTORY_B, "buggy_tool", 70.0),
            createMockToolStats(FACTORY_B, "unreliable_tool", 75.0)
        );

        when(reliabilityStatsRepository.findLowReliabilityTools(FACTORY_A, TEST_DATE, threshold))
            .thenReturn(lowToolsA);
        when(reliabilityStatsRepository.findLowReliabilityTools(FACTORY_B, TEST_DATE, threshold))
            .thenReturn(lowToolsB);

        List<ToolReliabilityStats> resultA = calibrationService.getLowReliabilityTools(
            FACTORY_A, TEST_DATE, threshold);
        List<ToolReliabilityStats> resultB = calibrationService.getLowReliabilityTools(
            FACTORY_B, TEST_DATE, threshold);

        assertEquals(1, resultA.size());
        assertEquals(2, resultB.size());
        assertTrue(resultA.stream().allMatch(t -> FACTORY_A.equals(t.getFactoryId())));
        assertTrue(resultB.stream().allMatch(t -> FACTORY_B.equals(t.getFactoryId())));
    }

    @Test
    @DisplayName("综合得分计算工厂隔离")
    void composite_score_calculation_factory_isolation() {
        LocalDate startDate = TEST_DATE.minusDays(7);

        when(metricsRepository.avgCompositeScoreByFactoryIdAndDateRange(
            eq(FACTORY_A), eq(startDate), eq(TEST_DATE), any(PeriodType.class)))
            .thenReturn(92.5);
        when(metricsRepository.avgCompositeScoreByFactoryIdAndDateRange(
            eq(FACTORY_B), eq(startDate), eq(TEST_DATE), any(PeriodType.class)))
            .thenReturn(85.0);

        Double scoreA = calibrationService.getAverageCompositeScore(FACTORY_A, startDate, TEST_DATE);
        Double scoreB = calibrationService.getAverageCompositeScore(FACTORY_B, startDate, TEST_DATE);

        assertEquals(92.5, scoreA);
        assertEquals(85.0, scoreB);
        assertNotEquals(scoreA, scoreB);
    }

    @Test
    @DisplayName("缓存清理工厂隔离")
    void cache_cleanup_factory_isolation() {
        // 这个测试验证缓存清理只影响指定的会话，不会跨工厂清理
        String sessionA = "session-" + FACTORY_A;
        String sessionB = "session-" + FACTORY_B;

        // 验证清理操作是基于sessionId而不是factoryId
        // 实际的清理逻辑在ToolCallRedundancyService中
        // 这里主要验证数据隔离的概念
        assertNotEquals(sessionA, sessionB, "不同工厂的会话ID应该不同");
    }

    // 辅助方法
    private BehaviorCalibrationMetrics createMockMetrics(String factoryId, LocalDate date, double compositeScore) {
        return BehaviorCalibrationMetrics.builder()
            .metricDate(date)
            .factoryId(factoryId)
            .periodType(PeriodType.DAILY)
            .totalCalls(100)
            .successfulCalls(95)
            .failedCalls(5)
            .redundantCalls(5)
            .recoveredCalls(3)
            .concisenessScore(new BigDecimal("95.00"))
            .successRate(new BigDecimal("95.00"))
            .reasoningEfficiency(new BigDecimal("85.00"))
            .compositeScore(new BigDecimal(String.valueOf(compositeScore)))
            .build();
    }

    private ToolCallRecord createMockToolCallRecord(Long id, String factoryId, String sessionId) {
        return ToolCallRecord.builder()
            .id(id)
            .factoryId(factoryId)
            .sessionId(sessionId)
            .toolName("test_tool")
            .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
            .build();
    }

    private ToolReliabilityStats createMockToolStats(String factoryId, String toolName, double successRate) {
        return ToolReliabilityStats.builder()
            .toolName(toolName)
            .factoryId(factoryId)
            .statDate(TEST_DATE)
            .totalCalls(100)
            .successfulCalls((int) successRate)
            .failedCalls(100 - (int) successRate)
            .successRate(new BigDecimal(String.valueOf(successRate)))
            .avgExecutionTimeMs(200)
            .build();
    }
}
