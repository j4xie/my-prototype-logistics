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
import com.cretas.aims.repository.calibration.*;
import com.cretas.aims.service.calibration.impl.BehaviorCalibrationServiceImpl;
import com.cretas.aims.service.calibration.impl.SelfCorrectionServiceImpl;
import com.cretas.aims.service.calibration.impl.ToolCallRedundancyServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.mockito.stubbing.Answer;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 校准服务性能压力测试
 *
 * 测试覆盖:
 * - 高并发场景 (50-100 线程)
 * - 大批量数据处理 (1000+ 记录)
 * - 内存压力测试
 * - 缓存性能测试
 * - 仓库查询性能模拟
 * - 吞吐量测量
 *
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的行为校准系统
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("校准服务性能压力测试")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PerformanceStressTest {

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

    private ObjectMapper objectMapper;

    // 测试服务实例
    private ToolCallRedundancyServiceImpl redundancyService;
    private BehaviorCalibrationServiceImpl calibrationService;
    private SelfCorrectionServiceImpl selfCorrectionService;

    // ==================== 测试常量 ====================

    private static final String TEST_FACTORY_ID = "F001";
    private static final LocalDate TEST_DATE = LocalDate.of(2026, 1, 19);

    /** 高并发测试线程数 */
    private static final int HIGH_CONCURRENCY_THREADS = 100;

    /** 中等并发测试线程数 */
    private static final int MEDIUM_CONCURRENCY_THREADS = 50;

    /** 大批量数据记录数 */
    private static final int LARGE_BATCH_SIZE = 1000;

    /** 超大批量数据记录数 */
    private static final int EXTRA_LARGE_BATCH_SIZE = 5000;

    /** 性能测试超时时间（秒） */
    private static final int PERFORMANCE_TEST_TIMEOUT_SECONDS = 60;

    /** 缓存压力测试迭代次数 */
    private static final int CACHE_STRESS_ITERATIONS = 10000;

    // ==================== 测试生命周期 ====================

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

    @AfterEach
    void tearDown() {
        // 清理线程池资源
        System.gc();
    }

    // ==================== 高并发测试 ====================

    @Test
    @Order(1)
    @DisplayName("高并发冗余检测 - 100线程同时检测")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_HighConcurrencyRedundancyCheck_100Threads() throws Exception {
        // 准备: 模拟缓存未命中的情况
        when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            anyString(), anyString(), anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());

        ExecutorService executor = Executors.newFixedThreadPool(HIGH_CONCURRENCY_THREADS);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(HIGH_CONCURRENCY_THREADS);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        AtomicLong totalExecutionTime = new AtomicLong(0);

        // 执行: 100个线程同时进行冗余检测
        for (int i = 0; i < HIGH_CONCURRENCY_THREADS; i++) {
            final int threadId = i;
            executor.submit(() -> {
                try {
                    startLatch.await(); // 等待所有线程就绪

                    long startTime = System.nanoTime();
                    String sessionId = "session-" + threadId;
                    String toolName = "tool_" + (threadId % 10);
                    Map<String, Object> params = createTestParameters(threadId);

                    boolean result = redundancyService.isRedundant(sessionId, toolName, params);

                    long endTime = System.nanoTime();
                    totalExecutionTime.addAndGet(endTime - startTime);

                    assertFalse(result, "首次调用不应该是冗余的");
                    successCount.incrementAndGet();
                } catch (Exception e) {
                    failureCount.incrementAndGet();
                } finally {
                    endLatch.countDown();
                }
            });
        }

        // 启动所有线程
        startLatch.countDown();
        boolean completed = endLatch.await(PERFORMANCE_TEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

        executor.shutdown();

        // 验证
        assertTrue(completed, "所有线程应在超时前完成");
        assertEquals(HIGH_CONCURRENCY_THREADS, successCount.get(), "所有线程应成功完成");
        assertEquals(0, failureCount.get(), "不应有失败的线程");

        double avgExecutionTimeMs = totalExecutionTime.get() / (double) HIGH_CONCURRENCY_THREADS / 1_000_000;
        System.out.printf("高并发冗余检测 - 平均执行时间: %.2f ms%n", avgExecutionTimeMs);
        assertTrue(avgExecutionTimeMs < 500, "平均执行时间应小于500ms");
    }

    @Test
    @Order(2)
    @DisplayName("高并发参数哈希计算 - 100线程同时计算")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_HighConcurrencyHashComputation_100Threads() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(HIGH_CONCURRENCY_THREADS);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(HIGH_CONCURRENCY_THREADS);
        ConcurrentHashMap<String, String> hashResults = new ConcurrentHashMap<>();
        AtomicLong totalExecutionTime = new AtomicLong(0);

        // 执行: 100个线程同时计算哈希（每个线程使用不同的参数）
        for (int i = 0; i < HIGH_CONCURRENCY_THREADS; i++) {
            final int threadId = i;
            executor.submit(() -> {
                try {
                    startLatch.await();

                    long startTime = System.nanoTime();
                    Map<String, Object> params = createTestParameters(threadId);
                    String hash = redundancyService.computeParametersHash(params);
                    long endTime = System.nanoTime();

                    totalExecutionTime.addAndGet(endTime - startTime);
                    hashResults.put("thread-" + threadId, hash);
                } catch (Exception e) {
                    fail("哈希计算不应抛出异常: " + e.getMessage());
                } finally {
                    endLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean completed = endLatch.await(PERFORMANCE_TEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        executor.shutdown();

        // 验证
        assertTrue(completed, "所有线程应在超时前完成");
        assertEquals(HIGH_CONCURRENCY_THREADS, hashResults.size(), "所有哈希应计算成功");

        // 验证所有哈希都是有效的SHA-256格式（64字符十六进制）
        assertTrue(hashResults.values().stream().allMatch(h -> h != null && h.length() == 64),
            "所有哈希应为有效的SHA-256格式");

        // 验证不同参数应产生不同哈希（每个线程使用不同的threadId参数）
        Set<String> uniqueHashes = new HashSet<>(hashResults.values());
        assertEquals(HIGH_CONCURRENCY_THREADS, uniqueHashes.size(),
            "不同参数应产生不同的哈希值");

        double avgExecutionTimeMs = totalExecutionTime.get() / (double) HIGH_CONCURRENCY_THREADS / 1_000_000;
        System.out.printf("高并发哈希计算 - 平均执行时间: %.2f ms%n", avgExecutionTimeMs);
        assertTrue(avgExecutionTimeMs < 200, "哈希计算平均时间应小于200ms");
    }

    @Test
    @Order(3)
    @DisplayName("高并发错误分类 - 50线程同时分类")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_HighConcurrencyErrorClassification_50Threads() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(MEDIUM_CONCURRENCY_THREADS);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(MEDIUM_CONCURRENCY_THREADS);
        AtomicInteger correctClassifications = new AtomicInteger(0);
        AtomicLong totalExecutionTime = new AtomicLong(0);

        String[] errorMessages = {
            "数据不完整，需要更多信息",
            "格式错误，JSON解析失败",
            "分析错误，统计失败",
            "逻辑错误，规则冲突",
            "未知错误类型"
        };
        ErrorCategory[] expectedCategories = {
            ErrorCategory.DATA_INSUFFICIENT,
            ErrorCategory.FORMAT_ERROR,
            ErrorCategory.ANALYSIS_ERROR,
            ErrorCategory.LOGIC_ERROR,
            ErrorCategory.UNKNOWN
        };

        for (int i = 0; i < MEDIUM_CONCURRENCY_THREADS; i++) {
            final int threadId = i;
            executor.submit(() -> {
                try {
                    startLatch.await();

                    long startTime = System.nanoTime();
                    int msgIndex = threadId % errorMessages.length;
                    ErrorCategory result = selfCorrectionService.classifyError(errorMessages[msgIndex], null);
                    long endTime = System.nanoTime();

                    totalExecutionTime.addAndGet(endTime - startTime);

                    if (result == expectedCategories[msgIndex]) {
                        correctClassifications.incrementAndGet();
                    }
                } catch (Exception e) {
                    fail("错误分类不应抛出异常: " + e.getMessage());
                } finally {
                    endLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean completed = endLatch.await(PERFORMANCE_TEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        executor.shutdown();

        // 验证
        assertTrue(completed, "所有线程应在超时前完成");
        assertEquals(MEDIUM_CONCURRENCY_THREADS, correctClassifications.get(), "所有分类应正确");

        double avgExecutionTimeMs = totalExecutionTime.get() / (double) MEDIUM_CONCURRENCY_THREADS / 1_000_000;
        System.out.printf("高并发错误分类 - 平均执行时间: %.2f ms%n", avgExecutionTimeMs);
        assertTrue(avgExecutionTimeMs < 50, "错误分类平均时间应小于50ms");
    }

    // ==================== 大批量数据处理测试 ====================

    @Test
    @Order(4)
    @DisplayName("大批量工具调用记录 - 1000条记录保存")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_LargeBatchToolCallRecords_1000Records() {
        // 准备: 模拟保存操作
        AtomicLong idGenerator = new AtomicLong(1);
        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer((Answer<ToolCallRecord>) invocation -> {
                ToolCallRecord record = invocation.getArgument(0);
                if (record.getId() == null) {
                    record.setId(idGenerator.getAndIncrement());
                }
                return record;
            });

        long startTime = System.nanoTime();

        // 执行: 批量保存1000条记录
        List<ToolCallRecord> savedRecords = new ArrayList<>(LARGE_BATCH_SIZE);
        for (int i = 0; i < LARGE_BATCH_SIZE; i++) {
            ToolCallRecord record = createTestToolCallRecord(i);
            ToolCallRecord saved = redundancyService.recordToolCall(record);
            savedRecords.add(saved);
        }

        long endTime = System.nanoTime();
        double totalTimeMs = (endTime - startTime) / 1_000_000.0;
        double avgTimeMs = totalTimeMs / LARGE_BATCH_SIZE;

        // 验证
        assertEquals(LARGE_BATCH_SIZE, savedRecords.size(), "应保存所有记录");
        verify(toolCallRecordRepository, times(LARGE_BATCH_SIZE)).save(any(ToolCallRecord.class));

        System.out.printf("大批量记录保存 - 总时间: %.2f ms, 平均: %.4f ms/条%n", totalTimeMs, avgTimeMs);
        assertTrue(totalTimeMs < 10000, "1000条记录保存应在10秒内完成");
    }

    @Test
    @Order(5)
    @DisplayName("大批量缓存结果写入 - 1000次缓存写入")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_LargeBatchCacheWrites_1000Writes() {
        // 准备: 模拟缓存操作
        when(toolCallCacheRepository.findByCacheKey(anyString()))
            .thenReturn(Optional.empty());
        when(toolCallCacheRepository.save(any(ToolCallCache.class)))
            .thenAnswer((Answer<ToolCallCache>) invocation -> invocation.getArgument(0));

        long startTime = System.nanoTime();

        // 执行: 批量缓存1000次结果
        for (int i = 0; i < LARGE_BATCH_SIZE; i++) {
            String sessionId = "batch-session-" + (i % 100);
            String toolName = "tool_" + (i % 20);
            Map<String, Object> params = createTestParameters(i);
            String result = "{\"batchId\": " + i + ", \"success\": true}";

            redundancyService.cacheResult(sessionId, toolName, params, result, (long) i);
        }

        long endTime = System.nanoTime();
        double totalTimeMs = (endTime - startTime) / 1_000_000.0;

        // 验证
        verify(toolCallCacheRepository, times(LARGE_BATCH_SIZE)).save(any(ToolCallCache.class));

        System.out.printf("大批量缓存写入 - 总时间: %.2f ms%n", totalTimeMs);
        assertTrue(totalTimeMs < 15000, "1000次缓存写入应在15秒内完成");
    }

    @Test
    @Order(6)
    @DisplayName("超大批量日指标计算 - 模拟5000条调用记录")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_ExtraLargeBatchMetricsCalculation_5000Records() {
        // 准备: 模拟大量统计数据
        when(toolCallRecordRepository.countByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn((long) EXTRA_LARGE_BATCH_SIZE);
        when(toolCallRecordRepository.countSuccessfulByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn((long) (EXTRA_LARGE_BATCH_SIZE * 0.95));
        when(toolCallRecordRepository.countFailedByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn((long) (EXTRA_LARGE_BATCH_SIZE * 0.03));
        when(toolCallRecordRepository.countRedundantByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn((long) (EXTRA_LARGE_BATCH_SIZE * 0.05));
        when(toolCallRecordRepository.countRecoveredByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn((long) (EXTRA_LARGE_BATCH_SIZE * 0.02));
        when(toolCallRecordRepository.sumInputTokensByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn((long) EXTRA_LARGE_BATCH_SIZE * 500);
        when(toolCallRecordRepository.sumOutputTokensByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn((long) EXTRA_LARGE_BATCH_SIZE * 300);
        when(toolCallRecordRepository.avgExecutionTimeByFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(250.0);
        when(toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(Collections.emptyList());
        when(toolCallRecordRepository.countByStatusAndFactoryIdAndTimeRange(eq(TEST_FACTORY_ID), any(), any()))
            .thenReturn(Collections.emptyList());
        when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(TEST_FACTORY_ID, TEST_DATE, PeriodType.DAILY))
            .thenReturn(Optional.empty());
        when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
            .thenAnswer((Answer<BehaviorCalibrationMetrics>) invocation -> invocation.getArgument(0));

        long startTime = System.nanoTime();

        // 执行: 计算日指标
        BehaviorCalibrationMetrics metrics = calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, TEST_DATE);

        long endTime = System.nanoTime();
        double totalTimeMs = (endTime - startTime) / 1_000_000.0;

        // 验证
        assertNotNull(metrics, "应返回指标结果");
        assertEquals(EXTRA_LARGE_BATCH_SIZE, metrics.getTotalCalls(), "总调用数应正确");
        assertNotNull(metrics.getCompositeScore(), "综合得分应已计算");
        assertTrue(metrics.getCompositeScore().compareTo(BigDecimal.ZERO) > 0, "综合得分应大于0");

        System.out.printf("超大批量指标计算 - 总时间: %.2f ms%n", totalTimeMs);
        assertTrue(totalTimeMs < 5000, "5000条记录指标计算应在5秒内完成");
    }

    // ==================== 内存压力测试 ====================

    @Test
    @Order(7)
    @DisplayName("内存压力测试 - 大量参数哈希计算")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_MemoryPressureHashComputation() {
        Runtime runtime = Runtime.getRuntime();
        long initialMemory = runtime.totalMemory() - runtime.freeMemory();

        // 执行: 创建大量参数并计算哈希
        List<String> hashes = new ArrayList<>(CACHE_STRESS_ITERATIONS);
        for (int i = 0; i < CACHE_STRESS_ITERATIONS; i++) {
            Map<String, Object> largeParams = createLargeTestParameters(i);
            String hash = redundancyService.computeParametersHash(largeParams);
            hashes.add(hash);
        }

        long finalMemory = runtime.totalMemory() - runtime.freeMemory();
        long memoryUsedMB = (finalMemory - initialMemory) / (1024 * 1024);

        // 验证
        assertEquals(CACHE_STRESS_ITERATIONS, hashes.size(), "所有哈希应计算成功");
        // 验证哈希是有效的SHA-256
        assertTrue(hashes.stream().allMatch(h -> h != null && h.length() == 64), "所有哈希应为64字符");

        System.out.printf("内存压力测试 - 使用内存: %d MB%n", memoryUsedMB);
        assertTrue(memoryUsedMB < 500, "内存使用应小于500MB");
    }

    @Test
    @Order(8)
    @DisplayName("内存压力测试 - 大量纠错提示生成")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_MemoryPressureCorrectionPromptGeneration() {
        Runtime runtime = Runtime.getRuntime();
        System.gc();
        long initialMemory = runtime.totalMemory() - runtime.freeMemory();

        ErrorCategory[] categories = ErrorCategory.values();
        List<String> prompts = new ArrayList<>(LARGE_BATCH_SIZE);

        // 执行: 生成大量纠错提示
        for (int i = 0; i < LARGE_BATCH_SIZE; i++) {
            ErrorCategory category = categories[i % categories.length];
            String errorMessage = "测试错误消息 #" + i + " - 这是一段较长的错误描述用于测试内存压力";
            String prompt = selfCorrectionService.generateCorrectionPrompt(category, errorMessage);
            prompts.add(prompt);
        }

        long finalMemory = runtime.totalMemory() - runtime.freeMemory();
        long memoryUsedMB = (finalMemory - initialMemory) / (1024 * 1024);

        // 验证
        assertEquals(LARGE_BATCH_SIZE, prompts.size(), "所有提示应生成成功");
        assertTrue(prompts.stream().allMatch(p -> p != null && p.length() > 100), "所有提示应为有效文本");

        System.out.printf("纠错提示内存压力测试 - 使用内存: %d MB%n", memoryUsedMB);
        assertTrue(memoryUsedMB < 200, "内存使用应小于200MB");
    }

    // ==================== 缓存性能测试 ====================

    @Test
    @Order(9)
    @DisplayName("缓存读写性能 - 10000次混合操作")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_CacheReadWritePerformance_10000Operations() {
        // 准备: 模拟缓存行为
        ConcurrentHashMap<String, ToolCallCache> mockCacheStore = new ConcurrentHashMap<>();

        when(toolCallCacheRepository.findByCacheKey(anyString()))
            .thenAnswer((Answer<Optional<ToolCallCache>>) invocation -> {
                String key = invocation.getArgument(0);
                return Optional.ofNullable(mockCacheStore.get(key));
            });

        when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
            .thenAnswer((Answer<Optional<ToolCallCache>>) invocation -> {
                String key = invocation.getArgument(0);
                ToolCallCache cache = mockCacheStore.get(key);
                if (cache != null && cache.getExpiresAt().isAfter(LocalDateTime.now())) {
                    return Optional.of(cache);
                }
                return Optional.empty();
            });

        when(toolCallCacheRepository.save(any(ToolCallCache.class)))
            .thenAnswer((Answer<ToolCallCache>) invocation -> {
                ToolCallCache cache = invocation.getArgument(0);
                mockCacheStore.put(cache.getCacheKey(), cache);
                return cache;
            });

        long startTime = System.nanoTime();
        AtomicInteger cacheHits = new AtomicInteger(0);
        AtomicInteger cacheMisses = new AtomicInteger(0);

        // 执行: 混合读写操作
        for (int i = 0; i < CACHE_STRESS_ITERATIONS; i++) {
            String sessionId = "cache-session-" + (i % 50);
            String toolName = "tool_" + (i % 10);
            Map<String, Object> params = createTestParameters(i % 100); // 重用部分参数以产生缓存命中

            if (i % 3 == 0) {
                // 写入操作
                redundancyService.cacheResult(sessionId, toolName, params,
                    "{\"iteration\": " + i + "}", (long) i);
            } else {
                // 读取操作
                Optional<String> result = redundancyService.getCachedResult(sessionId, toolName, params);
                if (result.isPresent()) {
                    cacheHits.incrementAndGet();
                } else {
                    cacheMisses.incrementAndGet();
                }
            }
        }

        long endTime = System.nanoTime();
        double totalTimeMs = (endTime - startTime) / 1_000_000.0;
        double opsPerSecond = CACHE_STRESS_ITERATIONS / (totalTimeMs / 1000);

        // 验证
        System.out.printf("缓存混合操作 - 总时间: %.2f ms, 吞吐量: %.0f ops/s%n", totalTimeMs, opsPerSecond);
        System.out.printf("缓存命中: %d, 缓存未命中: %d%n", cacheHits.get(), cacheMisses.get());

        assertTrue(opsPerSecond > 1000, "缓存操作吞吐量应大于1000 ops/s");
    }

    @Test
    @Order(10)
    @DisplayName("缓存清理性能 - 大量会话清理")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_CacheCleanupPerformance() {
        // 准备: 模拟删除操作
        doNothing().when(toolCallCacheRepository).deleteBySessionId(anyString());

        long startTime = System.nanoTime();

        // 执行: 清理500个会话的缓存
        int sessionCount = 500;
        for (int i = 0; i < sessionCount; i++) {
            String sessionId = "cleanup-session-" + i;
            redundancyService.clearSessionCache(sessionId);
        }

        long endTime = System.nanoTime();
        double totalTimeMs = (endTime - startTime) / 1_000_000.0;

        // 验证
        verify(toolCallCacheRepository, times(sessionCount)).deleteBySessionId(anyString());

        System.out.printf("缓存清理性能 - 清理 %d 个会话, 总时间: %.2f ms%n", sessionCount, totalTimeMs);
        assertTrue(totalTimeMs < 5000, "500个会话缓存清理应在5秒内完成");
    }

    // ==================== 仓库查询性能模拟测试 ====================

    @Test
    @Order(11)
    @DisplayName("仓库查询性能 - 模拟大量趋势数据查询")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_RepositoryQueryTrendData() {
        // 准备: 模拟30天趋势数据
        List<BehaviorCalibrationMetrics> mockTrendData = IntStream.range(0, 30)
            .mapToObj(i -> createMockMetrics(TEST_DATE.minusDays(i), 85.0 + (i % 10)))
            .collect(Collectors.toList());

        when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            eq(TEST_FACTORY_ID), any(LocalDate.class), any(LocalDate.class), eq(PeriodType.DAILY)))
            .thenReturn(mockTrendData);

        long startTime = System.nanoTime();

        // 执行: 多次查询趋势数据
        int queryCount = 100;
        for (int i = 0; i < queryCount; i++) {
            LocalDate startDate = TEST_DATE.minusDays(30 + i);
            LocalDate endDate = TEST_DATE.minusDays(i);
            List<BehaviorCalibrationMetrics> result = calibrationService.getMetricsTrend(
                TEST_FACTORY_ID, startDate, endDate, PeriodType.DAILY);
            assertEquals(30, result.size(), "应返回30天数据");
        }

        long endTime = System.nanoTime();
        double totalTimeMs = (endTime - startTime) / 1_000_000.0;
        double avgTimeMs = totalTimeMs / queryCount;

        // 验证
        verify(metricsRepository, times(queryCount))
            .findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
                eq(TEST_FACTORY_ID), any(LocalDate.class), any(LocalDate.class), eq(PeriodType.DAILY));

        System.out.printf("趋势数据查询 - %d 次查询, 总时间: %.2f ms, 平均: %.2f ms%n",
            queryCount, totalTimeMs, avgTimeMs);
        assertTrue(avgTimeMs < 50, "单次查询平均时间应小于50ms");
    }

    @Test
    @Order(12)
    @DisplayName("仓库查询性能 - 模拟工具可靠性排名查询")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_RepositoryQueryToolReliability() {
        // 准备: 模拟20个工具的可靠性数据
        List<ToolReliabilityStats> mockStats = IntStream.range(0, 20)
            .mapToObj(i -> createMockToolStats("tool_" + i, 99.0 - i * 0.5))
            .collect(Collectors.toList());

        when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(
            eq(TEST_FACTORY_ID), any(LocalDate.class)))
            .thenReturn(mockStats);

        long startTime = System.nanoTime();

        // 执行: 多次查询工具排名
        int queryCount = 200;
        for (int i = 0; i < queryCount; i++) {
            List<ToolReliabilityStats> result = calibrationService.getToolReliabilityRanking(
                TEST_FACTORY_ID, TEST_DATE.minusDays(i % 30));
            assertEquals(20, result.size(), "应返回20个工具的数据");
        }

        long endTime = System.nanoTime();
        double totalTimeMs = (endTime - startTime) / 1_000_000.0;

        // 验证
        System.out.printf("工具排名查询 - %d 次查询, 总时间: %.2f ms%n", queryCount, totalTimeMs);
        assertTrue(totalTimeMs < 10000, "200次查询应在10秒内完成");
    }

    // ==================== 吞吐量测量测试 ====================

    @Test
    @Order(13)
    @DisplayName("吞吐量测试 - 纠错记录创建")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_ThroughputCorrectionRecordCreation() {
        // 准备
        AtomicLong idGenerator = new AtomicLong(1);
        when(correctionRecordRepository.save(any(CorrectionRecord.class)))
            .thenAnswer((Answer<CorrectionRecord>) invocation -> {
                CorrectionRecord record = invocation.getArgument(0);
                if (record.getId() == null) {
                    record.setId(idGenerator.getAndIncrement());
                }
                return record;
            });
        when(correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(anyLong()))
            .thenReturn(Collections.emptyList());

        String[] errorMessages = {
            "数据不足需要更多信息",
            "格式解析失败",
            "分析计算错误",
            "业务逻辑冲突"
        };

        long startTime = System.nanoTime();
        int recordCount = LARGE_BATCH_SIZE;

        // 执行: 创建大量纠错记录
        for (int i = 0; i < recordCount; i++) {
            selfCorrectionService.createCorrectionRecord(
                (long) i,
                TEST_FACTORY_ID,
                "session-" + (i % 100),
                "ERROR_TYPE_" + (i % 5),
                errorMessages[i % errorMessages.length]
            );
        }

        long endTime = System.nanoTime();
        double totalTimeSeconds = (endTime - startTime) / 1_000_000_000.0;
        double recordsPerSecond = recordCount / totalTimeSeconds;

        // 验证
        verify(correctionRecordRepository, times(recordCount)).save(any(CorrectionRecord.class));

        System.out.printf("纠错记录吞吐量 - %d 条记录, %.2f 秒, %.0f 条/秒%n",
            recordCount, totalTimeSeconds, recordsPerSecond);
        assertTrue(recordsPerSecond > 100, "吞吐量应大于100条/秒");
    }

    @Test
    @Order(14)
    @DisplayName("吞吐量测试 - 仪表盘数据获取")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS, unit = TimeUnit.SECONDS)
    void stressTest_ThroughputDashboardDataRetrieval() {
        // 准备: 模拟完整的仪表盘数据
        BehaviorCalibrationMetrics currentMetrics = createMockMetrics(LocalDate.now(), 92.0);
        when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(eq(TEST_FACTORY_ID), any(), eq(PeriodType.DAILY)))
            .thenReturn(Optional.of(currentMetrics));
        when(metricsRepository.findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(eq(TEST_FACTORY_ID), eq(PeriodType.DAILY)))
            .thenReturn(Optional.of(currentMetrics));
        when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            eq(TEST_FACTORY_ID), any(), any(), eq(PeriodType.DAILY)))
            .thenReturn(Collections.singletonList(currentMetrics));
        when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(eq(TEST_FACTORY_ID), any()))
            .thenReturn(Collections.emptyList());
        when(toolCallRecordRepository.findTop20ByFactoryIdOrderByCreatedAtDesc(TEST_FACTORY_ID))
            .thenReturn(Collections.emptyList());

        long startTime = System.nanoTime();
        int requestCount = 100;

        // 执行: 多次获取仪表盘数据
        for (int i = 0; i < requestCount; i++) {
            CalibrationDashboardDTO dashboard = calibrationService.getDashboardData(TEST_FACTORY_ID);
            assertNotNull(dashboard, "仪表盘数据不应为空");
            assertNotNull(dashboard.getCurrentMetrics(), "当前指标不应为空");
        }

        long endTime = System.nanoTime();
        double totalTimeMs = (endTime - startTime) / 1_000_000.0;
        double requestsPerSecond = requestCount / (totalTimeMs / 1000);

        // 验证
        System.out.printf("仪表盘数据获取 - %d 次请求, %.2f ms, %.0f req/s%n",
            requestCount, totalTimeMs, requestsPerSecond);
        assertTrue(requestsPerSecond > 10, "仪表盘请求吞吐量应大于10 req/s");
    }

    @Test
    @Order(15)
    @DisplayName("综合压力测试 - 多服务并发操作")
    @Timeout(value = PERFORMANCE_TEST_TIMEOUT_SECONDS * 2, unit = TimeUnit.SECONDS)
    void stressTest_ComprehensiveMultiServiceConcurrency() throws Exception {
        // 准备: 配置所有Mock
        setupComprehensiveMocks();

        ExecutorService executor = Executors.newFixedThreadPool(MEDIUM_CONCURRENCY_THREADS);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(MEDIUM_CONCURRENCY_THREADS * 3);

        AtomicInteger redundancyOps = new AtomicInteger(0);
        AtomicInteger calibrationOps = new AtomicInteger(0);
        AtomicInteger correctionOps = new AtomicInteger(0);
        AtomicInteger failures = new AtomicInteger(0);

        // 执行: 三种类型的并发操作

        // 冗余检测操作
        for (int i = 0; i < MEDIUM_CONCURRENCY_THREADS; i++) {
            final int threadId = i;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    for (int j = 0; j < 10; j++) {
                        redundancyService.isRedundant(
                            "concurrent-session-" + threadId,
                            "tool_" + (j % 5),
                            createTestParameters(threadId * 10 + j)
                        );
                        redundancyOps.incrementAndGet();
                    }
                } catch (Exception e) {
                    failures.incrementAndGet();
                } finally {
                    endLatch.countDown();
                }
            });
        }

        // 校准指标操作
        for (int i = 0; i < MEDIUM_CONCURRENCY_THREADS; i++) {
            final int threadId = i;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    for (int j = 0; j < 5; j++) {
                        calibrationService.getMetricsTrend(
                            TEST_FACTORY_ID,
                            TEST_DATE.minusDays(30),
                            TEST_DATE,
                            PeriodType.DAILY
                        );
                        calibrationOps.incrementAndGet();
                    }
                } catch (Exception e) {
                    failures.incrementAndGet();
                } finally {
                    endLatch.countDown();
                }
            });
        }

        // 纠错服务操作
        for (int i = 0; i < MEDIUM_CONCURRENCY_THREADS; i++) {
            final int threadId = i;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    for (int j = 0; j < 10; j++) {
                        selfCorrectionService.classifyError(
                            "并发测试错误消息 #" + (threadId * 10 + j),
                            null
                        );
                        correctionOps.incrementAndGet();
                    }
                } catch (Exception e) {
                    failures.incrementAndGet();
                } finally {
                    endLatch.countDown();
                }
            });
        }

        long startTime = System.nanoTime();
        startLatch.countDown();
        boolean completed = endLatch.await(PERFORMANCE_TEST_TIMEOUT_SECONDS * 2, TimeUnit.SECONDS);
        long endTime = System.nanoTime();

        executor.shutdown();
        executor.awaitTermination(5, TimeUnit.SECONDS);

        // 验证
        assertTrue(completed, "所有操作应在超时前完成");
        assertEquals(0, failures.get(), "不应有失败的操作");

        int totalOps = redundancyOps.get() + calibrationOps.get() + correctionOps.get();
        double totalTimeSeconds = (endTime - startTime) / 1_000_000_000.0;
        double opsPerSecond = totalOps / totalTimeSeconds;

        System.out.printf("综合压力测试 - 总操作: %d (冗余: %d, 校准: %d, 纠错: %d)%n",
            totalOps, redundancyOps.get(), calibrationOps.get(), correctionOps.get());
        System.out.printf("总时间: %.2f 秒, 吞吐量: %.0f ops/s%n", totalTimeSeconds, opsPerSecond);

        assertTrue(opsPerSecond > 500, "综合吞吐量应大于500 ops/s");
    }

    // ==================== 辅助方法 ====================

    /**
     * 创建测试参数
     */
    private Map<String, Object> createTestParameters(int index) {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "BATCH-" + index);
        params.put("factoryId", TEST_FACTORY_ID);
        params.put("timestamp", System.currentTimeMillis());
        params.put("index", index);
        return params;
    }

    /**
     * 创建大型测试参数（用于内存压力测试）
     */
    private Map<String, Object> createLargeTestParameters(int index) {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "LARGE-BATCH-" + index);
        params.put("factoryId", TEST_FACTORY_ID);
        params.put("timestamp", System.currentTimeMillis());
        params.put("index", index);
        // 添加更多字段增加数据量
        params.put("description", "这是一段较长的描述文本用于测试内存压力 #" + index);
        params.put("metadata", createNestedMetadata(index));
        params.put("tags", Arrays.asList("tag1-" + index, "tag2-" + index, "tag3-" + index));
        return params;
    }

    /**
     * 创建嵌套元数据
     */
    private Map<String, Object> createNestedMetadata(int index) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("level1", "value-" + index);
        metadata.put("level2", Map.of("nested", "data-" + index));
        metadata.put("array", Arrays.asList(1, 2, 3, 4, 5));
        return metadata;
    }

    /**
     * 创建测试工具调用记录
     */
    private ToolCallRecord createTestToolCallRecord(int index) {
        return ToolCallRecord.builder()
            .factoryId(TEST_FACTORY_ID)
            .sessionId("batch-session-" + (index % 100))
            .toolName("tool_" + (index % 20))
            .toolParameters("{\"index\": " + index + "}")
            .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
            .executionTimeMs(100 + (index % 200))
            .inputTokens(500 + (index % 500))
            .outputTokens(300 + (index % 300))
            .build();
    }

    /**
     * 创建模拟指标数据
     */
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

    /**
     * 创建模拟工具统计数据
     */
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

    /**
     * 配置综合测试的所有Mock
     */
    private void setupComprehensiveMocks() {
        // 冗余检测Mock
        when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            anyString(), anyString(), anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());

        // 校准指标Mock
        List<BehaviorCalibrationMetrics> trendData = IntStream.range(0, 30)
            .mapToObj(i -> createMockMetrics(TEST_DATE.minusDays(i), 85.0 + (i % 10)))
            .collect(Collectors.toList());
        when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            eq(TEST_FACTORY_ID), any(LocalDate.class), any(LocalDate.class), eq(PeriodType.DAILY)))
            .thenReturn(trendData);
    }
}
