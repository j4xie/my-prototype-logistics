package com.cretas.aims.service.calibration.integration;

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
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * API契约测试
 * 验证校准服务的API契约，确保输入输出格式符合预期
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("CalibrationAPIContract API契约测试")
class CalibrationAPIContractTest {

    @Mock
    private BehaviorCalibrationMetricsRepository metricsRepository;

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolReliabilityStatsRepository reliabilityStatsRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    private BehaviorCalibrationServiceImpl calibrationService;

    private static final String TEST_FACTORY_ID = "F001";
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

    // ==================== Dashboard API Contract Tests ====================

    @Nested
    @DisplayName("Dashboard API 契约测试")
    class DashboardAPIContract {

        @Test
        @DisplayName("Dashboard响应应包含所有必需字段")
        void dashboard_response_should_contain_all_required_fields() {
            setupDashboardMocks();

            CalibrationDashboardDTO dashboard = calibrationService.getDashboardData(TEST_FACTORY_ID);

            assertNotNull(dashboard);
            assertNotNull(dashboard.getCurrentMetrics(), "currentMetrics不应为空");
            assertNotNull(dashboard.getTrendData(), "trendData不应为空");
            assertNotNull(dashboard.getToolReliabilityRanking(), "toolReliabilityRanking不应为空");
            assertNotNull(dashboard.getRecentToolCalls(), "recentToolCalls不应为空");
        }

        @Test
        @DisplayName("CurrentMetrics应包含四大核心指标")
        void current_metrics_should_contain_core_indicators() {
            setupDashboardMocks();

            CalibrationDashboardDTO dashboard = calibrationService.getDashboardData(TEST_FACTORY_ID);
            CalibrationDashboardDTO.CurrentMetrics metrics = dashboard.getCurrentMetrics();

            assertNotNull(metrics.getConcisenessScore(), "简洁性得分不应为空");
            assertNotNull(metrics.getSuccessRate(), "成功率不应为空");
            assertNotNull(metrics.getReasoningEfficiency(), "推理效率不应为空");
            assertNotNull(metrics.getCompositeScore(), "综合得分不应为空");
        }

        @Test
        @DisplayName("指标得分应在0-100范围内")
        void metrics_scores_should_be_in_valid_range() {
            setupDashboardMocks();

            CalibrationDashboardDTO dashboard = calibrationService.getDashboardData(TEST_FACTORY_ID);
            CalibrationDashboardDTO.CurrentMetrics metrics = dashboard.getCurrentMetrics();

            assertScoreInRange(metrics.getConcisenessScore(), "简洁性得分");
            assertScoreInRange(metrics.getSuccessRate(), "成功率");
            assertScoreInRange(metrics.getReasoningEfficiency(), "推理效率");
            assertScoreInRange(metrics.getCompositeScore(), "综合得分");
        }

        private void assertScoreInRange(BigDecimal score, String scoreName) {
            if (score != null) {
                assertTrue(score.compareTo(BigDecimal.ZERO) >= 0,
                    scoreName + "不应小于0");
                assertTrue(score.compareTo(new BigDecimal("100")) <= 0,
                    scoreName + "不应大于100");
            }
        }
    }

    // ==================== Metrics Trend API Contract Tests ====================

    @Nested
    @DisplayName("Metrics Trend API 契约测试")
    class MetricsTrendAPIContract {

        @ParameterizedTest
        @DisplayName("支持所有周期类型")
        @EnumSource(PeriodType.class)
        void should_support_all_period_types(PeriodType periodType) {
            LocalDate startDate = TEST_DATE.minusDays(7);
            LocalDate endDate = TEST_DATE;

            when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
                eq(TEST_FACTORY_ID), eq(startDate), eq(endDate), eq(periodType)))
                .thenReturn(Collections.emptyList());

            List<BehaviorCalibrationMetrics> result = calibrationService.getMetricsTrend(
                TEST_FACTORY_ID, startDate, endDate, periodType);

            assertNotNull(result);
            verify(metricsRepository).findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
                eq(TEST_FACTORY_ID), eq(startDate), eq(endDate), eq(periodType));
        }

        @Test
        @DisplayName("趋势数据应按日期排序")
        void trend_data_should_be_sorted_by_date() {
            LocalDate startDate = TEST_DATE.minusDays(3);
            List<BehaviorCalibrationMetrics> mockData = Arrays.asList(
                createMockMetrics(startDate, 90.0),
                createMockMetrics(startDate.plusDays(1), 91.0),
                createMockMetrics(startDate.plusDays(2), 92.0)
            );

            when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
                eq(TEST_FACTORY_ID), any(), any(), any()))
                .thenReturn(mockData);

            List<BehaviorCalibrationMetrics> result = calibrationService.getMetricsTrend(
                TEST_FACTORY_ID, startDate, TEST_DATE, PeriodType.DAILY);

            assertEquals(3, result.size());
            for (int i = 0; i < result.size() - 1; i++) {
                assertTrue(result.get(i).getMetricDate().isBefore(result.get(i + 1).getMetricDate())
                    || result.get(i).getMetricDate().isEqual(result.get(i + 1).getMetricDate()),
                    "趋势数据应按日期升序排列");
            }
        }

        @Test
        @DisplayName("空日期范围应返回空列表")
        void empty_date_range_should_return_empty_list() {
            // 开始日期在结束日期之后
            when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
                any(), any(), any(), any()))
                .thenReturn(Collections.emptyList());

            List<BehaviorCalibrationMetrics> result = calibrationService.getMetricsTrend(
                TEST_FACTORY_ID, TEST_DATE, TEST_DATE.minusDays(7), PeriodType.DAILY);

            assertNotNull(result);
        }
    }

    // ==================== Tool Reliability API Contract Tests ====================

    @Nested
    @DisplayName("Tool Reliability API 契约测试")
    class ToolReliabilityAPIContract {

        @Test
        @DisplayName("工具可靠性排名应按成功率降序")
        void tool_reliability_should_be_sorted_by_success_rate_desc() {
            List<ToolReliabilityStats> mockStats = Arrays.asList(
                createMockToolStats("tool_a", 99.0),
                createMockToolStats("tool_b", 95.0),
                createMockToolStats("tool_c", 85.0)
            );

            when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(
                TEST_FACTORY_ID, TEST_DATE))
                .thenReturn(mockStats);

            List<ToolReliabilityStats> result = calibrationService.getToolReliabilityRanking(
                TEST_FACTORY_ID, TEST_DATE);

            assertEquals(3, result.size());
            for (int i = 0; i < result.size() - 1; i++) {
                assertTrue(result.get(i).getSuccessRate().compareTo(result.get(i + 1).getSuccessRate()) >= 0,
                    "工具排名应按成功率降序");
            }
        }

        @Test
        @DisplayName("ToolReliabilityStats应包含必需字段")
        void tool_stats_should_contain_required_fields() {
            ToolReliabilityStats stats = createMockToolStats("test_tool", 95.0);

            assertNotNull(stats.getToolName(), "工具名不应为空");
            assertNotNull(stats.getTotalCalls(), "总调用次数不应为空");
            assertNotNull(stats.getSuccessfulCalls(), "成功调用次数不应为空");
            assertNotNull(stats.getFailedCalls(), "失败调用次数不应为空");
            assertNotNull(stats.getSuccessRate(), "成功率不应为空");
        }
    }

    // ==================== Metrics Calculation API Contract Tests ====================

    @Nested
    @DisplayName("Metrics Calculation API 契约测试")
    class MetricsCalculationAPIContract {

        @Test
        @DisplayName("计算的指标应包含所有必需字段")
        void calculated_metrics_should_contain_all_required_fields() {
            setupMetricsCalculationMocks();
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(any(), any(), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            BehaviorCalibrationMetrics metrics = calibrationService.calculateDailyMetrics(
                TEST_FACTORY_ID, TEST_DATE);

            assertNotNull(metrics);
            assertEquals(TEST_FACTORY_ID, metrics.getFactoryId());
            assertEquals(TEST_DATE, metrics.getMetricDate());
            assertEquals(PeriodType.DAILY, metrics.getPeriodType());
            assertNotNull(metrics.getTotalCalls());
            assertNotNull(metrics.getSuccessfulCalls());
            assertNotNull(metrics.getFailedCalls());
            assertNotNull(metrics.getRedundantCalls());
        }

        @Test
        @DisplayName("无调用记录时应返回零值指标")
        void no_calls_should_return_zero_metrics() {
            when(toolCallRecordRepository.countByFactoryIdAndTimeRange(any(), any(), any()))
                .thenReturn(0L);
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(any(), any(), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            BehaviorCalibrationMetrics metrics = calibrationService.calculateDailyMetrics(
                TEST_FACTORY_ID, TEST_DATE);

            assertNotNull(metrics);
            assertEquals(0, metrics.getTotalCalls());
            assertEquals(BigDecimal.ZERO, metrics.getConcisenessScore());
            assertEquals(BigDecimal.ZERO, metrics.getSuccessRate());
        }
    }

    // ==================== Input Validation Contract Tests ====================

    @Nested
    @DisplayName("输入验证契约测试")
    class InputValidationContract {

        @ParameterizedTest
        @DisplayName("factoryId参数应支持各种格式")
        @ValueSource(strings = {"F001", "FACTORY_01", "factory-001", "F_001_TEST"})
        void factory_id_should_support_various_formats(String factoryId) {
            when(metricsRepository.findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(
                eq(factoryId), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
                eq(factoryId), any(), any(), any()))
                .thenReturn(Collections.emptyList());
            when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(
                eq(factoryId), any()))
                .thenReturn(Collections.emptyList());
            when(toolCallRecordRepository.findTop20ByFactoryIdOrderByCreatedAtDesc(factoryId))
                .thenReturn(Collections.emptyList());

            CalibrationDashboardDTO dashboard = calibrationService.getDashboardData(factoryId);

            assertNotNull(dashboard);
        }

        @Test
        @DisplayName("null factoryId应该能正常处理")
        void null_factory_id_should_be_handled() {
            lenient().when(metricsRepository.findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(
                isNull(), any()))
                .thenReturn(Optional.empty());
            lenient().when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
                isNull(), any(), any(), any()))
                .thenReturn(Collections.emptyList());
            lenient().when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(
                isNull(), any()))
                .thenReturn(Collections.emptyList());
            lenient().when(toolCallRecordRepository.findTop20ByFactoryIdOrderByCreatedAtDesc(isNull()))
                .thenReturn(Collections.emptyList());

            CalibrationDashboardDTO dashboard = calibrationService.getDashboardData(null);

            assertNotNull(dashboard);
        }
    }

    // ==================== Low Reliability Tools API Contract Tests ====================

    @Nested
    @DisplayName("Low Reliability Tools API 契约测试")
    class LowReliabilityToolsAPIContract {

        @ParameterizedTest
        @DisplayName("阈值参数应在有效范围内")
        @CsvSource({
            "0,true",
            "50,true",
            "80,true",
            "100,true"
        })
        void threshold_should_be_in_valid_range(int threshold, boolean isValid) {
            BigDecimal thresholdValue = new BigDecimal(threshold);

            when(reliabilityStatsRepository.findLowReliabilityTools(
                eq(TEST_FACTORY_ID), eq(TEST_DATE), eq(thresholdValue)))
                .thenReturn(Collections.emptyList());

            List<ToolReliabilityStats> result = calibrationService.getLowReliabilityTools(
                TEST_FACTORY_ID, TEST_DATE, thresholdValue);

            assertNotNull(result);
        }

        @Test
        @DisplayName("返回的工具成功率应低于阈值")
        void returned_tools_should_have_success_rate_below_threshold() {
            BigDecimal threshold = new BigDecimal("90.00");
            List<ToolReliabilityStats> lowTools = Arrays.asList(
                createMockToolStats("slow_tool", 85.0),
                createMockToolStats("buggy_tool", 70.0)
            );

            when(reliabilityStatsRepository.findLowReliabilityTools(
                TEST_FACTORY_ID, TEST_DATE, threshold))
                .thenReturn(lowTools);

            List<ToolReliabilityStats> result = calibrationService.getLowReliabilityTools(
                TEST_FACTORY_ID, TEST_DATE, threshold);

            assertTrue(result.stream().allMatch(
                t -> t.getSuccessRate().compareTo(threshold) < 0),
                "所有返回的工具成功率都应低于阈值");
        }
    }

    // ==================== Average Score API Contract Tests ====================

    @Nested
    @DisplayName("Average Score API 契约测试")
    class AverageScoreAPIContract {

        @Test
        @DisplayName("平均得分应在0-100范围内")
        void average_score_should_be_in_valid_range() {
            when(metricsRepository.avgCompositeScoreByFactoryIdAndDateRange(
                any(), any(), any(), any()))
                .thenReturn(85.5);

            Double avgScore = calibrationService.getAverageCompositeScore(
                TEST_FACTORY_ID, TEST_DATE.minusDays(7), TEST_DATE);

            assertNotNull(avgScore);
            assertTrue(avgScore >= 0 && avgScore <= 100,
                "平均得分应在0-100范围内");
        }

        @Test
        @DisplayName("无数据时平均得分应返回null或0")
        void no_data_should_return_null_or_zero() {
            when(metricsRepository.avgCompositeScoreByFactoryIdAndDateRange(
                any(), any(), any(), any()))
                .thenReturn(null);

            Double avgScore = calibrationService.getAverageCompositeScore(
                TEST_FACTORY_ID, TEST_DATE.minusDays(7), TEST_DATE);

            // 无数据时返回null是合理的
            assertNull(avgScore);
        }
    }

    // ==================== Helper Methods ====================

    private void setupDashboardMocks() {
        BehaviorCalibrationMetrics currentMetrics = createMockMetrics(TEST_DATE, 92.0);

        when(metricsRepository.findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(
            TEST_FACTORY_ID, PeriodType.DAILY))
            .thenReturn(Optional.of(currentMetrics));

        when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            eq(TEST_FACTORY_ID), any(), any(), eq(PeriodType.DAILY)))
            .thenReturn(Collections.singletonList(currentMetrics));

        when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(
            eq(TEST_FACTORY_ID), any()))
            .thenReturn(Collections.emptyList());

        when(toolCallRecordRepository.findTop20ByFactoryIdOrderByCreatedAtDesc(TEST_FACTORY_ID))
            .thenReturn(Collections.emptyList());
    }

    private void setupMetricsCalculationMocks() {
        when(toolCallRecordRepository.countByFactoryIdAndTimeRange(any(), any(), any()))
            .thenReturn(100L);
        when(toolCallRecordRepository.countSuccessfulByFactoryIdAndTimeRange(any(), any(), any()))
            .thenReturn(95L);
        when(toolCallRecordRepository.countRedundantByFactoryIdAndTimeRange(any(), any(), any()))
            .thenReturn(5L);
        when(toolCallRecordRepository.countRecoveredByFactoryIdAndTimeRange(any(), any(), any()))
            .thenReturn(3L);
        when(toolCallRecordRepository.countFailedByFactoryIdAndTimeRange(any(), any(), any()))
            .thenReturn(5L);
        when(toolCallRecordRepository.sumInputTokensByFactoryIdAndTimeRange(any(), any(), any()))
            .thenReturn(50000L);
        when(toolCallRecordRepository.sumOutputTokensByFactoryIdAndTimeRange(any(), any(), any()))
            .thenReturn(30000L);
        when(toolCallRecordRepository.avgExecutionTimeByFactoryIdAndTimeRange(any(), any(), any()))
            .thenReturn(250.0);
        when(toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(any(), any(), any()))
            .thenReturn(Collections.emptyList());
    }

    private BehaviorCalibrationMetrics createMockMetrics(LocalDate date, double compositeScore) {
        return BehaviorCalibrationMetrics.builder()
            .metricDate(date)
            .factoryId(TEST_FACTORY_ID)
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

    private ToolReliabilityStats createMockToolStats(String toolName, double successRate) {
        return ToolReliabilityStats.builder()
            .toolName(toolName)
            .factoryId(TEST_FACTORY_ID)
            .statDate(TEST_DATE)
            .totalCalls(100)
            .successfulCalls((int) successRate)
            .failedCalls(100 - (int) successRate)
            .successRate(new BigDecimal(String.valueOf(successRate)))
            .avgExecutionTimeMs(200)
            .build();
    }
}
