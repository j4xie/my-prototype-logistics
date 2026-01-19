package com.cretas.aims.service.calibration.integration;

import com.cretas.aims.dto.calibration.CalibrationDashboardDTO;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics.PeriodType;
import com.cretas.aims.entity.calibration.CorrectionRecord;
import com.cretas.aims.entity.calibration.CorrectionRecord.CorrectionStrategy;
import com.cretas.aims.entity.calibration.CorrectionRecord.ErrorCategory;
import com.cretas.aims.entity.calibration.ToolCallCache;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.entity.calibration.ToolReliabilityStats;
import com.cretas.aims.repository.calibration.BehaviorCalibrationMetricsRepository;
import com.cretas.aims.repository.calibration.CorrectionRecordRepository;
import com.cretas.aims.repository.calibration.ToolCallCacheRepository;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.repository.calibration.ToolReliabilityStatsRepository;
import com.cretas.aims.service.calibration.BehaviorCalibrationService;
import com.cretas.aims.service.calibration.SelfCorrectionService;
import com.cretas.aims.service.calibration.ToolCallRedundancyService;
import com.cretas.aims.service.calibration.impl.BehaviorCalibrationServiceImpl;
import com.cretas.aims.service.calibration.impl.SelfCorrectionServiceImpl;
import com.cretas.aims.service.calibration.impl.ToolCallRedundancyServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.Answer;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 行为校准集成测试
 * 测试完整的校准流程，包括工具调用记录、冗余检测、自我纠错、指标计算的完整流程
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("BehaviorCalibrationIntegration 完整校准流程集成测试")
class BehaviorCalibrationIntegrationTest {

    // Calibration Service dependencies
    @Mock
    private BehaviorCalibrationMetricsRepository metricsRepository;

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolReliabilityStatsRepository reliabilityStatsRepository;

    // Redundancy Service dependencies
    @Mock
    private ToolCallCacheRepository toolCallCacheRepository;

    // Correction Service dependencies
    @Mock
    private CorrectionRecordRepository correctionRecordRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    // Services under test
    private BehaviorCalibrationServiceImpl calibrationService;
    private ToolCallRedundancyServiceImpl redundancyService;
    private SelfCorrectionServiceImpl selfCorrectionService;

    private static final String TEST_FACTORY_ID = "F001";
    private static final String TEST_SESSION_ID = "integration-test-session-" + UUID.randomUUID();
    private static final String TEST_TOOL_NAME = "inventory_query";
    private static final LocalDate TEST_DATE = LocalDate.of(2026, 1, 19);

    @BeforeEach
    void setUp() {
        calibrationService = new BehaviorCalibrationServiceImpl(
            metricsRepository,
            toolCallRecordRepository,
            reliabilityStatsRepository,
            objectMapper
        );

        redundancyService = new ToolCallRedundancyServiceImpl(
            toolCallRecordRepository,
            toolCallCacheRepository,
            objectMapper
        );

        selfCorrectionService = new SelfCorrectionServiceImpl(
            correctionRecordRepository
        );
    }

    @Test
    @DisplayName("完整校准流程 - 工具调用 -> 记录 -> 指标计算")
    void full_calibration_flow_tool_call_to_metrics() {
        // 1. 模拟工具调用
        AtomicLong idGenerator = new AtomicLong(1);
        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer((Answer<ToolCallRecord>) invocation -> {
                ToolCallRecord record = invocation.getArgument(0);
                record.setId(idGenerator.getAndIncrement());
                return record;
            });

        // 记录多个工具调用
        ToolCallRecord record1 = createAndSaveToolCallRecord(
            TEST_TOOL_NAME, ToolCallRecord.ExecutionStatus.SUCCESS, false);
        ToolCallRecord record2 = createAndSaveToolCallRecord(
            TEST_TOOL_NAME, ToolCallRecord.ExecutionStatus.SUCCESS, false);
        ToolCallRecord record3 = createAndSaveToolCallRecord(
            "batch_query", ToolCallRecord.ExecutionStatus.FAILED, false);

        assertNotNull(record1.getId());
        assertNotNull(record2.getId());
        assertNotNull(record3.getId());

        // 2. 模拟指标计算
        setupMetricsCalculationMocks();

        // 3. 计算指标
        when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
            TEST_FACTORY_ID, TEST_DATE, PeriodType.DAILY))
            .thenReturn(Optional.empty());
        when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        BehaviorCalibrationMetrics metrics = calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, TEST_DATE);

        // 4. 验证指标
        assertNotNull(metrics);
        assertEquals(TEST_FACTORY_ID, metrics.getFactoryId());
        assertEquals(100, metrics.getTotalCalls());
    }

    @Test
    @DisplayName("完整校准流程 - 冗余检测 -> 标记 -> 统计")
    void full_calibration_flow_redundancy_detection() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 1. 首次调用 - 不冗余
        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            anyString(), anyString(), anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());

        boolean firstCallRedundant = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
        assertFalse(firstCallRedundant, "首次调用不应是冗余的");

        // 2. 缓存结果
        when(toolCallCacheRepository.findByCacheKey(cacheKey))
            .thenReturn(Optional.empty());
        when(toolCallCacheRepository.save(any(ToolCallCache.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params, "{\"result\": \"success\"}", 1L);

        verify(toolCallCacheRepository).save(any(ToolCallCache.class));

        // 3. 第二次调用 - 应该冗余（缓存命中）
        ToolCallCache cachedEntry = ToolCallCache.builder()
            .cacheKey(cacheKey)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .parametersHash(hash)
            .originalCallId(1L)
            .expiresAt(LocalDateTime.now().plusMinutes(5))
            .cachedResult("{\"result\": \"success\"}")
            .build();

        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.of(cachedEntry));

        boolean secondCallRedundant = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
        assertTrue(secondCallRedundant, "第二次调用应该是冗余的");
    }

    @Test
    @DisplayName("完整校准流程 - 错误发生 -> 分类 -> 纠正 -> 重试")
    void full_calibration_flow_error_correction() {
        Long toolCallId = 1L;

        // 1. 模拟第一次错误
        String errorMessage1 = "数据不完整";
        ErrorCategory category1 = selfCorrectionService.classifyError(errorMessage1, null);
        assertEquals(ErrorCategory.DATA_INSUFFICIENT, category1);

        CorrectionStrategy strategy1 = selfCorrectionService.determineStrategy(category1);
        assertEquals(CorrectionStrategy.RE_RETRIEVE, strategy1);

        // 2. 创建纠错记录
        CorrectionRecord record1 = CorrectionRecord.builder()
            .id(1L)
            .toolCallId(toolCallId)
            .factoryId(TEST_FACTORY_ID)
            .sessionId(TEST_SESSION_ID)
            .errorCategory(category1)
            .correctionStrategy(strategy1)
            .correctionRounds(1)
            .correctionSuccess(false)
            .build();

        when(correctionRecordRepository.save(any(CorrectionRecord.class))).thenReturn(record1);
        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(toolCallId))
            .thenReturn(List.of(record1));

        CorrectionRecord savedRecord1 = selfCorrectionService.createCorrectionRecord(
            toolCallId, TEST_FACTORY_ID, TEST_SESSION_ID, "DATA_ERROR", errorMessage1);
        assertNotNull(savedRecord1);

        // 3. 检查是否应重试
        boolean shouldRetry = selfCorrectionService.shouldRetry(toolCallId);
        assertTrue(shouldRetry, "第一次失败后应该重试");

        // 4. 模拟第二次也失败
        CorrectionRecord record2 = CorrectionRecord.builder()
            .id(2L)
            .toolCallId(toolCallId)
            .correctionRounds(2)
            .correctionSuccess(false)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(toolCallId))
            .thenReturn(List.of(record2, record1));

        shouldRetry = selfCorrectionService.shouldRetry(toolCallId);
        assertTrue(shouldRetry, "第二次失败后应该重试");

        // 5. 模拟第三次失败 - 达到最大重试次数
        CorrectionRecord record3 = CorrectionRecord.builder()
            .id(3L)
            .toolCallId(toolCallId)
            .correctionRounds(3)
            .correctionSuccess(false)
            .build();

        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(toolCallId))
            .thenReturn(List.of(record3, record2, record1));

        shouldRetry = selfCorrectionService.shouldRetry(toolCallId);
        assertFalse(shouldRetry, "第三次失败后不应该重试");

        int remaining = selfCorrectionService.getRemainingRetries(toolCallId);
        assertEquals(0, remaining, "剩余重试次数应为0");
    }

    @Test
    @DisplayName("仪表盘数据完整性测试")
    void dashboard_data_completeness() {
        // 模拟当前指标
        BehaviorCalibrationMetrics currentMetrics = createMockMetrics(TEST_FACTORY_ID, TEST_DATE, 92.0);
        when(metricsRepository.findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(TEST_FACTORY_ID, PeriodType.DAILY))
            .thenReturn(Optional.of(currentMetrics));

        // 模拟趋势数据
        when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            eq(TEST_FACTORY_ID), any(), any(), eq(PeriodType.DAILY)))
            .thenReturn(Collections.singletonList(currentMetrics));

        // 模拟工具排名
        List<ToolReliabilityStats> toolRanking = Arrays.asList(
            createMockToolStats("tool_a", 99.0),
            createMockToolStats("tool_b", 95.0)
        );
        when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(eq(TEST_FACTORY_ID), any()))
            .thenReturn(toolRanking);

        // 模拟最近调用
        List<ToolCallRecord> recentCalls = Arrays.asList(
            createToolCallRecord(1L, TEST_TOOL_NAME, ToolCallRecord.ExecutionStatus.SUCCESS),
            createToolCallRecord(2L, "batch_query", ToolCallRecord.ExecutionStatus.FAILED)
        );
        when(toolCallRecordRepository.findTop20ByFactoryIdOrderByCreatedAtDesc(TEST_FACTORY_ID))
            .thenReturn(recentCalls);

        // 获取仪表盘数据
        CalibrationDashboardDTO dashboard = calibrationService.getDashboardData(TEST_FACTORY_ID);

        // 验证仪表盘数据完整性
        assertNotNull(dashboard, "仪表盘数据不应为空");
        assertNotNull(dashboard.getCurrentMetrics(), "当前指标不应为空");
        assertNotNull(dashboard.getTrendData(), "趋势数据不应为空");
        assertNotNull(dashboard.getToolReliabilityRanking(), "工具排名不应为空");
        assertNotNull(dashboard.getRecentToolCalls(), "最近调用不应为空");

        // 验证数据正确性
        // CurrentMetrics doesn't have factoryId, verify through mock calls
        verify(metricsRepository).findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(eq(TEST_FACTORY_ID), any());
        assertFalse(dashboard.getToolReliabilityRanking().isEmpty());
    }

    @Test
    @DisplayName("端到端场景 - 正常工具调用流程")
    void end_to_end_normal_tool_call_flow() {
        Map<String, Object> params = new HashMap<>();
        params.put("factoryId", TEST_FACTORY_ID);
        params.put("date", "2026-01-19");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 1. 检查冗余（首次调用）
        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            anyString(), anyString(), anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());

        boolean isRedundant = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
        assertFalse(isRedundant);

        // 2. 执行工具调用并记录
        ToolCallRecord record = ToolCallRecord.builder()
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .factoryId(TEST_FACTORY_ID)
            .parametersHash(hash)
            .toolParameters("{\"factoryId\":\"F001\",\"date\":\"2026-01-19\"}")
            .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
            .executionTimeMs(150)
            .inputTokens(500)
            .outputTokens(300)
            .build();

        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer(invocation -> {
                ToolCallRecord r = invocation.getArgument(0);
                r.setId(1L);
                return r;
            });

        ToolCallRecord savedRecord = redundancyService.recordToolCall(record);
        assertNotNull(savedRecord.getId());

        // 3. 缓存结果
        when(toolCallCacheRepository.findByCacheKey(cacheKey))
            .thenReturn(Optional.empty());
        when(toolCallCacheRepository.save(any(ToolCallCache.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        String result = "{\"data\": [{\"item\": \"test\"}]}";
        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params, result, savedRecord.getId());

        verify(toolCallCacheRepository).save(argThat(cache ->
            cache.getCachedResult().equals(result) &&
            cache.getOriginalCallId().equals(savedRecord.getId())
        ));
    }

    @Test
    @DisplayName("端到端场景 - 失败恢复流程")
    void end_to_end_failure_recovery_flow() {
        Long toolCallId = 1L;

        // 1. 工具调用失败
        ToolCallRecord failedRecord = ToolCallRecord.builder()
            .id(toolCallId)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .factoryId(TEST_FACTORY_ID)
            .executionStatus(ToolCallRecord.ExecutionStatus.FAILED)
            .errorType("CONNECTION_ERROR")
            .errorMessage("连接超时")
            .build();

        // 2. 分类错误
        ErrorCategory category = selfCorrectionService.classifyError("连接超时", null);
        // 由于没有特定关键词，可能被分类为UNKNOWN
        assertNotNull(category);

        // 3. 确定纠正策略
        CorrectionStrategy strategy = selfCorrectionService.determineStrategy(category);
        assertNotNull(strategy);

        // 4. 创建纠错记录
        CorrectionRecord correctionRecord = CorrectionRecord.builder()
            .id(1L)
            .toolCallId(toolCallId)
            .factoryId(TEST_FACTORY_ID)
            .sessionId(TEST_SESSION_ID)
            .errorCategory(category)
            .correctionStrategy(strategy)
            .correctionRounds(1)
            .build();

        when(correctionRecordRepository.save(any(CorrectionRecord.class))).thenReturn(correctionRecord);

        CorrectionRecord saved = selfCorrectionService.createCorrectionRecord(
            toolCallId, TEST_FACTORY_ID, TEST_SESSION_ID, "CONNECTION_ERROR", "连接超时");
        assertNotNull(saved);

        // 5. 生成纠正提示
        String prompt = selfCorrectionService.generateCorrectionPrompt(category, "连接超时");
        assertNotNull(prompt);
        assertTrue(prompt.length() > 0);
    }

    @Test
    @DisplayName("多工具调用场景测试")
    void multi_tool_call_scenario() {
        List<String> tools = Arrays.asList("inventory_query", "batch_query", "production_plan_query");
        Map<Long, ToolCallRecord> savedRecords = new HashMap<>();
        AtomicLong idGen = new AtomicLong(1);

        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer(invocation -> {
                ToolCallRecord r = invocation.getArgument(0);
                r.setId(idGen.getAndIncrement());
                savedRecords.put(r.getId(), r);
                return r;
            });

        // 模拟多个工具调用
        for (String tool : tools) {
            ToolCallRecord record = ToolCallRecord.builder()
                .sessionId(TEST_SESSION_ID)
                .toolName(tool)
                .factoryId(TEST_FACTORY_ID)
                .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
                .build();

            redundancyService.recordToolCall(record);
        }

        assertEquals(3, savedRecords.size(), "应该记录3个工具调用");
        verify(toolCallRecordRepository, times(3)).save(any(ToolCallRecord.class));
    }

    // 辅助方法
    private ToolCallRecord createAndSaveToolCallRecord(String toolName,
                                                        ToolCallRecord.ExecutionStatus status,
                                                        boolean isRedundant) {
        ToolCallRecord record = ToolCallRecord.builder()
            .sessionId(TEST_SESSION_ID)
            .toolName(toolName)
            .factoryId(TEST_FACTORY_ID)
            .executionStatus(status)
            .isRedundant(isRedundant)
            .build();

        return redundancyService.recordToolCall(record);
    }

    private void setupMetricsCalculationMocks() {
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
    }

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

    private ToolCallRecord createToolCallRecord(Long id, String toolName, ToolCallRecord.ExecutionStatus status) {
        return ToolCallRecord.builder()
            .id(id)
            .sessionId(TEST_SESSION_ID)
            .toolName(toolName)
            .factoryId(TEST_FACTORY_ID)
            .executionStatus(status)
            .build();
    }
}
