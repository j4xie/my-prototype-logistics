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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 行为校准服务单元测试
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("BehaviorCalibrationService 单元测试")
class BehaviorCalibrationServiceTest {

    @Mock
    private BehaviorCalibrationMetricsRepository metricsRepository;

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolReliabilityStatsRepository reliabilityStatsRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    private BehaviorCalibrationServiceImpl calibrationService;

    private static final String TEST_FACTORY_ID = "F001";
    private static final LocalDate TEST_DATE = LocalDate.of(2026, 1, 18);

    @BeforeEach
    void setUp() {
        // 手动创建服务实例，避免 Mockito @Spy 兼容性问题
        calibrationService = new BehaviorCalibrationServiceImpl(
            metricsRepository,
            toolCallRecordRepository,
            reliabilityStatsRepository,
            objectMapper
        );
    }

    @Test
    @DisplayName("计算日指标 - 有数据时应正确计算")
    void calculateDailyMetrics_WithData_ShouldCalculateCorrectly() {
        LocalDateTime startOfDay = TEST_DATE.atStartOfDay();
        LocalDateTime endOfDay = TEST_DATE.plusDays(1).atStartOfDay();

        // Mock 仓库方法
        when(toolCallRecordRepository.countByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(100L);
        when(toolCallRecordRepository.countSuccessfulByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(95L);
        when(toolCallRecordRepository.countRedundantByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(5L);
        when(toolCallRecordRepository.countRecoveredByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(3L);
        when(toolCallRecordRepository.countFailedByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(5L);
        when(toolCallRecordRepository.sumInputTokensByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(50000L);
        when(toolCallRecordRepository.sumOutputTokensByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(30000L);
        when(toolCallRecordRepository.avgExecutionTimeByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(250.0);
        when(toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(Collections.emptyList());
        when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(TEST_FACTORY_ID, TEST_DATE, PeriodType.DAILY))
            .thenReturn(Optional.empty());
        when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        BehaviorCalibrationMetrics result = calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, TEST_DATE);

        assertNotNull(result);
        assertEquals(100, result.getTotalCalls());
        assertEquals(95, result.getSuccessfulCalls());
        assertEquals(5, result.getRedundantCalls());

        // 验证指标计算
        // 简洁性 = (100 - 5) / 100 * 100 = 95%
        assertEquals(0, result.getConcisenessScore().compareTo(new BigDecimal("95.00")));
        // 成功率 = 95 / 100 * 100 = 95%
        assertEquals(0, result.getSuccessRate().compareTo(new BigDecimal("95.00")));

        verify(metricsRepository).save(any(BehaviorCalibrationMetrics.class));
    }

    @Test
    @DisplayName("计算日指标 - 无数据时应返回零值")
    void calculateDailyMetrics_NoData_ShouldReturnZeros() {
        when(toolCallRecordRepository.countByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(0L);
        when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(TEST_FACTORY_ID, TEST_DATE, PeriodType.DAILY))
            .thenReturn(Optional.empty());
        when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        BehaviorCalibrationMetrics result = calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, TEST_DATE);

        assertNotNull(result);
        assertEquals(0, result.getTotalCalls());
        assertEquals(BigDecimal.ZERO, result.getConcisenessScore());
        assertEquals(BigDecimal.ZERO, result.getSuccessRate());
    }

    @Test
    @DisplayName("获取指标趋势 - 应返回日期范围内的数据")
    void getMetricsTrend_ShouldReturnDataInRange() {
        LocalDate startDate = TEST_DATE.minusDays(7);
        LocalDate endDate = TEST_DATE;

        List<BehaviorCalibrationMetrics> mockData = Arrays.asList(
            createMockMetrics(startDate, 90.0),
            createMockMetrics(startDate.plusDays(1), 91.0),
            createMockMetrics(startDate.plusDays(2), 92.0)
        );

        when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            TEST_FACTORY_ID, startDate, endDate, PeriodType.DAILY))
            .thenReturn(mockData);

        List<BehaviorCalibrationMetrics> result = calibrationService.getMetricsTrend(
            TEST_FACTORY_ID, startDate, endDate, PeriodType.DAILY);

        assertNotNull(result);
        assertEquals(3, result.size());
        verify(metricsRepository).findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            TEST_FACTORY_ID, startDate, endDate, PeriodType.DAILY);
    }

    @Test
    @DisplayName("获取工具可靠性排名 - 应按成功率排序")
    void getToolReliabilityRanking_ShouldSortBySuccessRate() {
        List<ToolReliabilityStats> mockStats = Arrays.asList(
            createMockToolStats("tool_a", 99.5),
            createMockToolStats("tool_b", 95.0),
            createMockToolStats("tool_c", 85.0)
        );

        when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(TEST_FACTORY_ID, TEST_DATE))
            .thenReturn(mockStats);

        List<ToolReliabilityStats> result = calibrationService.getToolReliabilityRanking(TEST_FACTORY_ID, TEST_DATE);

        assertNotNull(result);
        assertEquals(3, result.size());
        assertEquals("tool_a", result.get(0).getToolName());
        assertTrue(result.get(0).getSuccessRate().compareTo(result.get(1).getSuccessRate()) > 0);
    }

    @Test
    @DisplayName("获取仪表盘数据 - 应包含所有必要组件")
    void getDashboardData_ShouldContainAllComponents() {
        // Mock 当前指标
        BehaviorCalibrationMetrics currentMetrics = createMockMetrics(LocalDate.now(), 92.0);
        when(metricsRepository.findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(TEST_FACTORY_ID, PeriodType.DAILY))
            .thenReturn(Optional.of(currentMetrics));

        // Mock 趋势数据
        when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            eq(TEST_FACTORY_ID), any(), any(), eq(PeriodType.DAILY)))
            .thenReturn(Collections.singletonList(currentMetrics));

        // Mock 工具排名
        when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(eq(TEST_FACTORY_ID), any()))
            .thenReturn(Collections.emptyList());

        // Mock 最近调用
        when(toolCallRecordRepository.findTop20ByFactoryIdOrderByCreatedAtDesc(TEST_FACTORY_ID))
            .thenReturn(Collections.emptyList());

        CalibrationDashboardDTO result = calibrationService.getDashboardData(TEST_FACTORY_ID);

        assertNotNull(result);
        assertNotNull(result.getCurrentMetrics());
        assertNotNull(result.getTrendData());
        assertNotNull(result.getToolReliabilityRanking());
        assertNotNull(result.getRecentToolCalls());
    }

    @Test
    @DisplayName("计算工具可靠性统计 - 应正确聚合数据")
    void calculateToolReliabilityStats_ShouldAggregateCorrectly() {
        // Mock 工具调用统计
        Object[] tool1Stats = new Object[]{"inventory_query", 100L};
        Object[] tool2Stats = new Object[]{"batch_query", 50L};

        when(toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(Arrays.asList(tool1Stats, tool2Stats));
        when(reliabilityStatsRepository.findByFactoryIdAndToolNameAndStatDate(any(), any(), any()))
            .thenReturn(Optional.empty());
        when(reliabilityStatsRepository.save(any(ToolReliabilityStats.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        calibrationService.calculateToolReliabilityStats(TEST_FACTORY_ID, TEST_DATE);

        verify(reliabilityStatsRepository, atLeast(1)).save(any(ToolReliabilityStats.class));
    }

    @Test
    @DisplayName("获取低可靠性工具 - 应返回低于阈值的工具")
    void getLowReliabilityTools_ShouldReturnToolsBelowThreshold() {
        BigDecimal threshold = new BigDecimal("90.00");
        List<ToolReliabilityStats> lowReliabilityTools = Arrays.asList(
            createMockToolStats("slow_tool", 85.0),
            createMockToolStats("buggy_tool", 75.0)
        );

        when(reliabilityStatsRepository.findLowReliabilityTools(TEST_FACTORY_ID, TEST_DATE, threshold))
            .thenReturn(lowReliabilityTools);

        List<ToolReliabilityStats> result = calibrationService.getLowReliabilityTools(
            TEST_FACTORY_ID, TEST_DATE, threshold);

        assertNotNull(result);
        assertEquals(2, result.size());
        assertTrue(result.stream().allMatch(t -> t.getSuccessRate().compareTo(threshold) < 0));
    }

    @Test
    @DisplayName("获取平均综合得分 - 应计算日期范围内平均值")
    void getAverageCompositeScore_ShouldCalculateAverage() {
        LocalDate startDate = TEST_DATE.minusDays(7);
        Double expectedAverage = 91.5;

        when(metricsRepository.avgCompositeScoreByFactoryIdAndDateRange(
            eq(TEST_FACTORY_ID), eq(startDate), eq(TEST_DATE), any(PeriodType.class)))
            .thenReturn(expectedAverage);

        Double result = calibrationService.getAverageCompositeScore(
            TEST_FACTORY_ID, startDate, TEST_DATE);

        assertEquals(expectedAverage, result);
    }

    // 辅助方法：创建模拟指标数据
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

    // 辅助方法：创建模拟工具统计数据
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
