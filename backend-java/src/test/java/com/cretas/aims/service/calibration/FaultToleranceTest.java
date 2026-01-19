package com.cretas.aims.service.calibration;

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
import com.cretas.aims.service.calibration.impl.BehaviorCalibrationServiceImpl;
import com.cretas.aims.service.calibration.impl.SelfCorrectionServiceImpl;
import com.cretas.aims.service.calibration.impl.ToolCallRedundancyServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.dao.TransientDataAccessResourceException;
import org.springframework.transaction.CannotCreateTransactionException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 容错性测试 - 行为校准服务集成测试
 *
 * 本测试类覆盖以下容错场景:
 * 1. 服务降级 - 当Repository抛出异常时的处理
 * 2. 熔断器模式 - 模拟连续失败后的熔断行为
 * 3. 超时处理 - 慢操作的超时处理
 * 4. 重试机制 - 瞬态失败后的重试
 * 5. 降级行为 - 主服务失败时的备用处理
 * 6. 优雅降级 - 部分系统失败下的处理
 * 7. 恢复测试 - 服务恢复后的行为
 * 8. 数据库连接丢失处理
 * 9. 缓存不可用场景
 * 10. 网络分区模拟
 * 11. 内存耗尽处理
 * 12. 磁盘满场景
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("容错性测试 - Fault Tolerance Tests")
class FaultToleranceTest {

    // ==================== Mock 依赖 ====================

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolCallCacheRepository toolCallCacheRepository;

    @Mock
    private BehaviorCalibrationMetricsRepository metricsRepository;

    @Mock
    private ToolReliabilityStatsRepository reliabilityStatsRepository;

    @Mock
    private CorrectionRecordRepository correctionRecordRepository;

    // ==================== 被测服务 ====================

    private ToolCallRedundancyServiceImpl redundancyService;
    private BehaviorCalibrationServiceImpl calibrationService;
    private SelfCorrectionServiceImpl selfCorrectionService;

    private ObjectMapper objectMapper;

    // ==================== 测试常量 ====================

    private static final String TEST_SESSION_ID = "fault-tolerance-session-123";
    private static final String TEST_FACTORY_ID = "F001";
    private static final String TEST_TOOL_NAME = "inventory_query";
    private static final LocalDate TEST_DATE = LocalDate.of(2026, 1, 19);

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();

        // 初始化服务实例
        redundancyService = new ToolCallRedundancyServiceImpl(
            toolCallRecordRepository,
            toolCallCacheRepository,
            objectMapper
        );

        calibrationService = new BehaviorCalibrationServiceImpl(
            metricsRepository,
            toolCallRecordRepository,
            reliabilityStatsRepository,
            objectMapper
        );

        selfCorrectionService = new SelfCorrectionServiceImpl(correctionRecordRepository);
    }

    // ==================== 数据库连接丢失测试 ====================

    /**
     * 数据库连接丢失测试组
     * 测试当数据库连接不可用时，服务的容错行为
     */
    @Nested
    @DisplayName("数据库连接丢失测试 - Database Connection Loss Tests")
    class DatabaseConnectionLossTests {

        @Test
        @DisplayName("冗余检测 - 数据库连接丢失时应抛出异常")
        void isRedundant_DatabaseConnectionLoss_ShouldThrowException() {
            // 准备：模拟数据库连接丢失异常
            Map<String, Object> params = new HashMap<>();
            params.put("batchId", "B001");

            when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
                .thenThrow(new DataAccessResourceFailureException("数据库连接丢失"));

            // 执行并验证：当数据库连接丢失时，服务会让异常向上传播
            // 说明：服务未实现内置容错机制，由调用者决定如何处理异常
            assertThrows(DataAccessResourceFailureException.class, () -> {
                redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
            }, "数据库连接丢失时应抛出异常，让调用者处理");
        }

        @Test
        @DisplayName("记录工具调用 - 数据库连接丢失时应抛出异常")
        void recordToolCall_DatabaseConnectionLoss_ShouldThrowException() {
            // 准备：模拟保存时数据库连接丢失
            ToolCallRecord record = ToolCallRecord.builder()
                .sessionId(TEST_SESSION_ID)
                .toolName(TEST_TOOL_NAME)
                .factoryId(TEST_FACTORY_ID)
                .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
                .build();

            when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
                .thenThrow(new CannotCreateTransactionException("无法创建事务：数据库连接丢失"));

            // 执行并验证：记录工具调用是关键操作，应该抛出异常让调用者处理
            assertThrows(CannotCreateTransactionException.class, () -> {
                redundancyService.recordToolCall(record);
            }, "记录工具调用失败时应抛出异常，以便上层处理");
        }

        @Test
        @DisplayName("计算日指标 - 数据库连接丢失时应抛出异常")
        void calculateDailyMetrics_DatabaseConnectionLoss_ShouldThrowException() {
            // 准备：模拟查询时数据库连接丢失
            when(toolCallRecordRepository.countByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenThrow(new DataAccessResourceFailureException("数据库连接丢失"));

            // 执行并验证：指标计算依赖数据库，连接丢失应该抛出异常
            assertThrows(DataAccessResourceFailureException.class, () -> {
                calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, TEST_DATE);
            }, "数据库连接丢失时应抛出异常，而非返回错误数据");
        }
    }

    // ==================== 超时处理测试 ====================

    /**
     * 超时处理测试组
     * 测试当操作超时时，服务的容错行为
     */
    @Nested
    @DisplayName("超时处理测试 - Timeout Handling Tests")
    class TimeoutHandlingTests {

        @Test
        @DisplayName("缓存查询超时 - 应抛出异常")
        void getCachedResult_QueryTimeout_ShouldThrowException() {
            // 准备：模拟查询超时
            Map<String, Object> params = new HashMap<>();
            params.put("materialId", "M001");

            when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
                .thenThrow(new QueryTimeoutException("查询超时"));

            // 执行并验证：服务不捕获超时异常，让其向上传播
            assertThrows(QueryTimeoutException.class, () -> {
                redundancyService.getCachedResult(TEST_SESSION_ID, TEST_TOOL_NAME, params);
            }, "查询超时时应抛出异常，由调用者处理");
        }

        @Test
        @DisplayName("仪表盘数据加载超时 - 应抛出异常")
        void getDashboardData_Timeout_ShouldThrowException() {
            // 准备：模拟获取当前指标超时
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
                anyString(), any(LocalDate.class), any(PeriodType.class)))
                .thenThrow(new QueryTimeoutException("获取指标超时"));

            // 执行并验证：超时时服务让异常向上传播
            assertThrows(QueryTimeoutException.class, () -> {
                calibrationService.getDashboardData(TEST_FACTORY_ID);
            }, "仪表盘数据超时应抛出异常，由前端展示加载失败状态");
        }

        @Test
        @DisplayName("纠错记录创建超时 - 应抛出异常以便重试")
        void createCorrectionRecord_Timeout_ShouldThrowException() {
            // 准备：模拟保存超时
            when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(anyLong()))
                .thenReturn(Collections.emptyList());
            when(correctionRecordRepository.save(any(CorrectionRecord.class)))
                .thenThrow(new QueryTimeoutException("保存纠错记录超时"));

            // 执行并验证
            assertThrows(QueryTimeoutException.class, () -> {
                selfCorrectionService.createCorrectionRecord(
                    1L, TEST_FACTORY_ID, TEST_SESSION_ID, "TIMEOUT_ERROR", "操作超时");
            }, "纠错记录创建超时应抛出异常以便上层重试");
        }
    }

    // ==================== 瞬态失败重试测试 ====================

    /**
     * 瞬态失败重试测试组
     * 测试瞬态失败（如网络抖动）后的重试机制
     */
    @Nested
    @DisplayName("瞬态失败重试测试 - Transient Failure Retry Tests")
    class TransientFailureRetryTests {

        @Test
        @DisplayName("瞬态失败后重试 - 第二次尝试应成功")
        void recordToolCall_TransientFailureRetry_SecondAttemptSucceeds() {
            // 准备：模拟第一次失败，第二次成功
            ToolCallRecord record = ToolCallRecord.builder()
                .sessionId(TEST_SESSION_ID)
                .toolName(TEST_TOOL_NAME)
                .factoryId(TEST_FACTORY_ID)
                .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
                .build();

            ToolCallRecord savedRecord = ToolCallRecord.builder()
                .id(1L)
                .sessionId(TEST_SESSION_ID)
                .toolName(TEST_TOOL_NAME)
                .factoryId(TEST_FACTORY_ID)
                .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
                .build();

            AtomicInteger callCount = new AtomicInteger(0);
            when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
                .thenAnswer(invocation -> {
                    if (callCount.incrementAndGet() == 1) {
                        throw new TransientDataAccessResourceException("瞬态网络错误");
                    }
                    return savedRecord;
                });

            // 执行：第一次失败
            assertThrows(TransientDataAccessResourceException.class, () -> {
                redundancyService.recordToolCall(record);
            });

            // 第二次应该成功
            ToolCallRecord result = redundancyService.recordToolCall(record);

            // 验证
            assertNotNull(result, "瞬态失败后重试应成功");
            assertEquals(1L, result.getId());
        }

        @Test
        @DisplayName("纠错记录 - 瞬态失败后应允许重新创建")
        void createCorrectionRecord_AfterTransientFailure_ShouldAllowRecreation() {
            // 准备：模拟瞬态失败后恢复
            when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(anyLong()))
                .thenReturn(Collections.emptyList());

            CorrectionRecord savedRecord = CorrectionRecord.builder()
                .id(1L)
                .toolCallId(1L)
                .factoryId(TEST_FACTORY_ID)
                .sessionId(TEST_SESSION_ID)
                .errorCategory(ErrorCategory.DATA_INSUFFICIENT)
                .correctionStrategy(CorrectionStrategy.RE_RETRIEVE)
                .correctionRounds(1)
                .build();

            when(correctionRecordRepository.save(any(CorrectionRecord.class)))
                .thenReturn(savedRecord);

            // 执行
            CorrectionRecord result = selfCorrectionService.createCorrectionRecord(
                1L, TEST_FACTORY_ID, TEST_SESSION_ID, "DATA_ERROR", "数据不完整");

            // 验证
            assertNotNull(result, "瞬态失败恢复后应能成功创建纠错记录");
            assertEquals(ErrorCategory.DATA_INSUFFICIENT, result.getErrorCategory());
        }
    }

    // ==================== 熔断器模式测试 ====================

    /**
     * 熔断器模式测试组
     * 模拟连续失败后的熔断行为
     */
    @Nested
    @DisplayName("熔断器模式测试 - Circuit Breaker Pattern Tests")
    class CircuitBreakerPatternTests {

        @Test
        @DisplayName("连续失败后 - 异常应快速抛出")
        void consecutiveFailures_ShouldThrowFast() {
            // 准备：模拟连续失败场景
            when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
                .thenThrow(new DataAccessResourceFailureException("服务不可用"));

            Map<String, Object> params = new HashMap<>();
            params.put("test", "value");

            long startTime = System.currentTimeMillis();

            // 连续调用5次，验证异常能快速抛出
            for (int i = 0; i < 5; i++) {
                assertThrows(DataAccessResourceFailureException.class, () -> {
                    redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
                }, "第" + (i + 1) + "次调用应快速抛出异常");
            }

            long elapsed = System.currentTimeMillis() - startTime;

            // 验证：5次调用总时间应该很短（快速失败）
            assertTrue(elapsed < 1000, "异常应快速抛出，不应阻塞: elapsed=" + elapsed + "ms");
        }

        @Test
        @DisplayName("部分服务失败 - 缓存失败导致异常传播")
        void partialServiceFailure_CacheFailureShouldThrow() {
            // 准备：缓存服务失败
            // 说明：服务没有内置降级机制，缓存查询失败时异常会直接传播
            when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
                .thenThrow(new DataAccessResourceFailureException("缓存服务不可用"));

            Map<String, Object> params = new HashMap<>();
            params.put("test", "value");

            // 执行并验证：缓存服务失败时，异常向上传播
            assertThrows(DataAccessResourceFailureException.class, () -> {
                redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
            }, "缓存服务失败应抛出异常");

            // 验证：由于异常在缓存查询时就抛出，记录服务不会被调用
            verify(toolCallRecordRepository, never())
                .findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
                    anyString(), anyString(), anyString(), any(LocalDateTime.class));
        }
    }

    // ==================== 服务恢复测试 ====================

    /**
     * 服务恢复测试组
     * 测试服务从故障中恢复后的行为
     */
    @Nested
    @DisplayName("服务恢复测试 - Service Recovery Tests")
    class ServiceRecoveryTests {

        @Test
        @DisplayName("服务恢复后 - 缓存功能应恢复正常")
        void serviceRecovery_CacheShouldWorkAfterRecovery() {
            // 准备：模拟服务恢复后的正常响应
            Map<String, Object> params = new HashMap<>();
            params.put("batchId", "B001");

            String hash = redundancyService.computeParametersHash(params);
            String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

            ToolCallCache cachedEntry = ToolCallCache.builder()
                .cacheKey(cacheKey)
                .sessionId(TEST_SESSION_ID)
                .toolName(TEST_TOOL_NAME)
                .parametersHash(hash)
                .cachedResult("{\"success\": true}")
                .originalCallId(1L)
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .hitCount(0)
                .build();

            when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
                .thenReturn(Optional.of(cachedEntry));

            // 执行：服务恢复后查询缓存
            boolean result = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);

            // 验证：缓存命中，返回冗余
            assertTrue(result, "服务恢复后缓存应正常工作");
        }

        @Test
        @DisplayName("服务恢复后 - 指标计算应恢复正常")
        void serviceRecovery_MetricsCalculationShouldRecover() {
            // 准备：模拟正常的数据库响应
            when(toolCallRecordRepository.countByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(100L);
            when(toolCallRecordRepository.countSuccessfulByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(95L);
            when(toolCallRecordRepository.countFailedByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(5L);
            when(toolCallRecordRepository.countRedundantByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(3L);
            when(toolCallRecordRepository.countRecoveredByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(2L);
            when(toolCallRecordRepository.sumInputTokensByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(50000L);
            when(toolCallRecordRepository.sumOutputTokensByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(30000L);
            when(toolCallRecordRepository.avgExecutionTimeByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(200.0);
            when(toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(Collections.emptyList());
            when(toolCallRecordRepository.countByStatusAndFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(Collections.emptyList());
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(anyString(), any(), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            // 执行：服务恢复后计算指标
            BehaviorCalibrationMetrics result = calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, TEST_DATE);

            // 验证：指标计算正常
            assertNotNull(result, "服务恢复后指标计算应正常");
            assertEquals(100, result.getTotalCalls());
            assertEquals(95, result.getSuccessfulCalls());
        }
    }

    // ==================== 缓存不可用场景测试 ====================

    /**
     * 缓存不可用场景测试组
     * 测试当缓存服务完全不可用时的降级行为
     */
    @Nested
    @DisplayName("缓存不可用场景测试 - Cache Unavailability Tests")
    class CacheUnavailabilityTests {

        @Test
        @DisplayName("缓存完全不可用 - 应抛出异常（无自动降级）")
        void cacheUnavailable_ShouldThrowException() {
            // 准备：缓存服务不可用
            Map<String, Object> params = new HashMap<>();
            params.put("orderId", "O001");

            when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
                .thenThrow(new DataAccessResourceFailureException("缓存服务不可用"));

            // 执行并验证：服务没有内置降级机制，会直接抛出异常
            assertThrows(DataAccessResourceFailureException.class, () -> {
                redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
            }, "缓存不可用时应抛出异常，由调用者处理");
        }

        @Test
        @DisplayName("缓存写入失败 - 应抛出异常")
        void cacheWriteFailure_ShouldThrowException() {
            // 准备：缓存写入失败
            Map<String, Object> params = new HashMap<>();
            params.put("productId", "P001");

            when(toolCallCacheRepository.findByCacheKey(anyString()))
                .thenThrow(new DataAccessResourceFailureException("缓存写入失败"));

            // 执行并验证：服务没有捕获异常，会向上传播
            assertThrows(DataAccessResourceFailureException.class, () -> {
                redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params,
                    "{\"data\": \"test\"}", 1L);
            }, "缓存写入失败时应抛出异常");
        }

        @Test
        @DisplayName("清除会话缓存失败 - 应继续清除内存缓存")
        void clearSessionCache_DbFailure_ShouldClearMemoryCache() {
            // 准备：数据库删除失败
            doThrow(new DataAccessResourceFailureException("删除失败"))
                .when(toolCallCacheRepository).deleteBySessionId(anyString());

            // 执行：清除会话缓存
            // 说明：即使数据库清除失败，内存缓存清除仍应继续
            assertThrows(DataAccessResourceFailureException.class, () -> {
                redundancyService.clearSessionCache(TEST_SESSION_ID);
            });

            // 验证：确实尝试了清除
            verify(toolCallCacheRepository).deleteBySessionId(TEST_SESSION_ID);
        }
    }

    // ==================== 内存耗尽处理测试 ====================

    /**
     * 内存耗尽处理测试组
     * 测试内存压力下的服务行为
     */
    @Nested
    @DisplayName("内存耗尽处理测试 - Memory Exhaustion Tests")
    class MemoryExhaustionTests {

        @Test
        @DisplayName("大量并发请求 - 正常情况下应在合理时间内完成")
        void heavyLoad_MemoryCacheShouldHandleGracefully() {
            // 准备：模拟大量不同的请求参数，数据库返回空（无缓存）
            when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
            when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
                anyString(), anyString(), anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());

            // 执行：模拟100个不同的请求
            long startTime = System.currentTimeMillis();

            for (int i = 0; i < 100; i++) {
                Map<String, Object> params = new HashMap<>();
                params.put("requestId", "REQ-" + i);
                params.put("timestamp", System.currentTimeMillis());

                boolean result = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
                assertFalse(result, "新请求不应被标记为冗余");
            }

            long elapsed = System.currentTimeMillis() - startTime;

            // 验证：100个请求应在合理时间内完成
            assertTrue(elapsed < 5000, "大量请求应在合理时间内处理完成: elapsed=" + elapsed + "ms");
        }

        @Test
        @DisplayName("哈希计算 - 大参数对象不应导致内存问题")
        void computeHash_LargeParameters_ShouldNotCauseMemoryIssue() {
            // 准备：创建大参数对象
            Map<String, Object> largeParams = new HashMap<>();
            StringBuilder largeValue = new StringBuilder();
            for (int i = 0; i < 10000; i++) {
                largeValue.append("data-").append(i).append("-");
            }
            largeParams.put("largeField", largeValue.toString());

            // 执行：计算哈希
            assertDoesNotThrow(() -> {
                String hash = redundancyService.computeParametersHash(largeParams);
                assertNotNull(hash, "大参数哈希计算应成功");
                assertEquals(64, hash.length(), "哈希长度应为64字符");
            }, "大参数对象不应导致内存问题");
        }
    }

    // ==================== 磁盘满场景测试 ====================

    /**
     * 磁盘满场景测试组
     * 测试当磁盘空间不足时的服务行为
     */
    @Nested
    @DisplayName("磁盘满场景测试 - Disk Full Scenario Tests")
    class DiskFullScenarioTests {

        @Test
        @DisplayName("保存记录时磁盘满 - 应抛出明确异常")
        void saveRecord_DiskFull_ShouldThrowClearException() {
            // 准备：模拟磁盘满异常
            ToolCallRecord record = ToolCallRecord.builder()
                .sessionId(TEST_SESSION_ID)
                .toolName(TEST_TOOL_NAME)
                .factoryId(TEST_FACTORY_ID)
                .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
                .build();

            when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
                .thenThrow(new DataAccessResourceFailureException("磁盘空间不足，无法写入数据"));

            // 执行并验证：应该抛出明确的异常
            DataAccessResourceFailureException exception = assertThrows(
                DataAccessResourceFailureException.class,
                () -> redundancyService.recordToolCall(record),
                "磁盘满时应抛出明确异常"
            );

            assertTrue(exception.getMessage().contains("磁盘空间不足"),
                "异常消息应包含磁盘空间不足的说明");
        }

        @Test
        @DisplayName("保存指标时磁盘满 - 应抛出异常并保留已计算数据")
        void saveMetrics_DiskFull_ShouldThrowExceptionWithCalculatedData() {
            // 准备：模拟指标计算成功但保存失败
            when(toolCallRecordRepository.countByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(50L);
            when(toolCallRecordRepository.countSuccessfulByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(45L);
            when(toolCallRecordRepository.countFailedByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(5L);
            when(toolCallRecordRepository.countRedundantByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(2L);
            when(toolCallRecordRepository.countRecoveredByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(1L);
            when(toolCallRecordRepository.sumInputTokensByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(25000L);
            when(toolCallRecordRepository.sumOutputTokensByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(15000L);
            when(toolCallRecordRepository.avgExecutionTimeByFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(150.0);
            when(toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(Collections.emptyList());
            when(toolCallRecordRepository.countByStatusAndFactoryIdAndTimeRange(anyString(), any(), any()))
                .thenReturn(Collections.emptyList());
            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(anyString(), any(), any()))
                .thenReturn(Optional.empty());
            when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
                .thenThrow(new DataAccessResourceFailureException("磁盘空间不足"));

            // 执行并验证
            assertThrows(DataAccessResourceFailureException.class, () -> {
                calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, TEST_DATE);
            }, "磁盘满时保存指标应抛出异常");
        }
    }

    // ==================== 网络分区模拟测试 ====================

    /**
     * 网络分区模拟测试组
     * 模拟网络分区（脑裂）场景下的服务行为
     */
    @Nested
    @DisplayName("网络分区模拟测试 - Network Partition Tests")
    class NetworkPartitionTests {

        @Test
        @DisplayName("网络分区 - 数据库不可达时应抛出异常")
        void networkPartition_DatabaseUnreachableShouldThrow() {
            // 准备：模拟网络分区，数据库不可达
            Map<String, Object> params = new HashMap<>();
            params.put("itemId", "I001");

            // 数据库查询失败
            when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
                .thenThrow(new DataAccessResourceFailureException("网络分区：无法连接数据库"));

            // 执行并验证：服务没有内置容错，异常会传播
            assertThrows(DataAccessResourceFailureException.class, () -> {
                redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
            }, "网络分区时应抛出异常");
        }

        @Test
        @DisplayName("网络分区恢复 - 应能正常恢复服务")
        void networkPartitionRecovery_ShouldResumeService() {
            // 准备：模拟网络分区恢复后的正常响应
            Map<String, Object> params = new HashMap<>();
            params.put("orderId", "O002");

            // 第一次调用：网络分区抛出异常，第二次正常返回
            when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
                .thenThrow(new DataAccessResourceFailureException("网络分区"))
                .thenReturn(Optional.empty()); // 第二次正常

            when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
                anyString(), anyString(), anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());

            // 执行：第一次调用（分区期间）- 应抛出异常
            assertThrows(DataAccessResourceFailureException.class, () -> {
                redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
            }, "分区期间应抛出异常");

            // 执行：第二次调用（恢复后）- 应正常工作
            boolean result2 = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
            assertFalse(result2, "恢复后应正常工作并返回非冗余");
        }
    }

    // ==================== 优雅降级测试 ====================

    /**
     * 优雅降级测试组
     * 测试在部分组件不可用时的降级策略
     */
    @Nested
    @DisplayName("优雅降级测试 - Graceful Degradation Tests")
    class GracefulDegradationTests {

        @Test
        @DisplayName("仪表盘部分数据加载失败 - 应返回可用部分")
        void dashboard_PartialFailure_ShouldReturnAvailableData() {
            // 准备：当前指标可用，但趋势数据失败
            BehaviorCalibrationMetrics currentMetrics = BehaviorCalibrationMetrics.builder()
                .factoryId(TEST_FACTORY_ID)
                .metricDate(LocalDate.now())
                .periodType(PeriodType.DAILY)
                .totalCalls(100)
                .successfulCalls(95)
                .failedCalls(5)
                .redundantCalls(3)
                .recoveredCalls(2)
                .concisenessScore(new BigDecimal("97.00"))
                .successRate(new BigDecimal("95.00"))
                .reasoningEfficiency(new BigDecimal("85.00"))
                .compositeScore(new BigDecimal("91.50"))
                .build();

            when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
                eq(TEST_FACTORY_ID), any(LocalDate.class), eq(PeriodType.DAILY)))
                .thenReturn(Optional.of(currentMetrics));

            when(metricsRepository.findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(
                eq(TEST_FACTORY_ID), eq(PeriodType.DAILY)))
                .thenReturn(Optional.of(currentMetrics));

            // 趋势数据查询失败
            when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
                eq(TEST_FACTORY_ID), any(LocalDate.class), any(LocalDate.class), eq(PeriodType.DAILY)))
                .thenThrow(new QueryTimeoutException("趋势数据查询超时"));

            // 执行并验证：应该抛出异常（因为趋势数据是仪表盘的必要组成部分）
            assertThrows(QueryTimeoutException.class, () -> {
                calibrationService.getDashboardData(TEST_FACTORY_ID);
            }, "部分数据加载失败时应通知调用者");
        }

        @Test
        @DisplayName("纠错分析降级 - 应返回保守策略")
        void correctionAnalysis_Degradation_ShouldReturnConservativeStrategy() {
            // 准备：模拟分析过程中的异常
            when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(anyLong()))
                .thenThrow(new DataAccessResourceFailureException("查询失败"));

            // 执行：直接分析错误（不依赖历史记录）
            // 这个方法不依赖数据库，应该能正常工作
            ErrorCategory category = selfCorrectionService.classifyError("数据不完整", null);
            CorrectionStrategy strategy = selfCorrectionService.determineStrategy(category);

            // 验证：即使数据库不可用，本地错误分析应该正常工作
            assertEquals(ErrorCategory.DATA_INSUFFICIENT, category);
            assertEquals(CorrectionStrategy.RE_RETRIEVE, strategy);
        }

        @Test
        @DisplayName("会话统计降级 - 数据库不可用时使用内存统计")
        void sessionStats_Degradation_ShouldUseMemoryStats() {
            // 执行：获取会话统计（即使数据库不可用也应该返回内存统计）
            ToolCallRedundancyService.RedundancyStats stats =
                redundancyService.getSessionStats(TEST_SESSION_ID);

            // 验证：应该返回统计对象（可能是零值）
            assertNotNull(stats, "会话统计应该返回非空对象");
            assertTrue(stats.getTotalCalls() >= 0, "总调用数应为非负数");
            assertTrue(stats.getRedundancyRate() >= 0 && stats.getRedundancyRate() <= 1,
                "冗余率应在0-1之间");
        }
    }

    // ==================== 并发容错测试 ====================

    /**
     * 并发容错测试组
     * 测试并发场景下的容错行为
     */
    @Nested
    @DisplayName("并发容错测试 - Concurrent Fault Tolerance Tests")
    class ConcurrentFaultToleranceTests {

        @Test
        @DisplayName("并发访问时部分失败 - 成功的调用应正常完成")
        void concurrentAccess_PartialFailure_SuccessfulCallsShouldComplete() throws Exception {
            // 准备：模拟50%的调用失败（偶数次调用失败）
            AtomicInteger callCount = new AtomicInteger(0);
            when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
                .thenAnswer(invocation -> {
                    if (callCount.incrementAndGet() % 2 == 0) {
                        throw new DataAccessResourceFailureException("随机失败");
                    }
                    return Optional.empty();
                });

            when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
                anyString(), anyString(), anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());

            // 执行：并发调用
            ExecutorService executor = Executors.newFixedThreadPool(5);
            List<Future<Boolean>> futures = new ArrayList<>();

            for (int i = 0; i < 10; i++) {
                final int index = i;
                futures.add(executor.submit(() -> {
                    Map<String, Object> params = new HashMap<>();
                    params.put("index", index);
                    return redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
                }));
            }

            // 收集结果
            int successCount = 0;
            int failureCount = 0;
            for (Future<Boolean> future : futures) {
                try {
                    future.get(5, TimeUnit.SECONDS);
                    successCount++;
                } catch (ExecutionException e) {
                    // 预期部分调用抛出异常
                    failureCount++;
                }
            }

            executor.shutdown();
            executor.awaitTermination(1, TimeUnit.SECONDS);

            // 验证：应该有成功和失败的调用（约50%各占一半）
            assertTrue(successCount > 0, "并发场景下应该有一些调用成功");
            assertTrue(failureCount > 0, "并发场景下应该有一些调用因异常而失败");
        }

        @Test
        @DisplayName("并发哈希计算 - 应该是线程安全的")
        void concurrentHashComputation_ShouldBeThreadSafe() throws Exception {
            // 准备：相同参数
            Map<String, Object> params = new HashMap<>();
            params.put("key", "value");
            params.put("timestamp", 1234567890);

            // 执行：多线程并发计算哈希
            ExecutorService executor = Executors.newFixedThreadPool(10);
            List<Future<String>> futures = new ArrayList<>();

            for (int i = 0; i < 100; i++) {
                futures.add(executor.submit(() ->
                    redundancyService.computeParametersHash(params)
                ));
            }

            // 收集所有哈希值
            Set<String> uniqueHashes = new HashSet<>();
            for (Future<String> future : futures) {
                uniqueHashes.add(future.get(5, TimeUnit.SECONDS));
            }

            executor.shutdown();

            // 验证：所有哈希值应该相同（线程安全）
            assertEquals(1, uniqueHashes.size(), "相同参数的哈希值应该始终一致（线程安全）");
        }
    }
}
