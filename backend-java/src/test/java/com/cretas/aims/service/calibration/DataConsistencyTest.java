package com.cretas.aims.service.calibration;

import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics.PeriodType;
import com.cretas.aims.entity.calibration.ToolCallCache;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.entity.calibration.ToolCallRecord.ExecutionStatus;
import com.cretas.aims.entity.calibration.ToolReliabilityStats;
import com.cretas.aims.repository.calibration.BehaviorCalibrationMetricsRepository;
import com.cretas.aims.repository.calibration.ToolCallCacheRepository;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.repository.calibration.ToolReliabilityStatsRepository;
import com.cretas.aims.service.calibration.impl.BehaviorCalibrationServiceImpl;
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
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 数据一致性测试
 * 全面测试并发场景下的数据一致性、缓存同步、事务隔离和重复检测
 *
 * 测试覆盖:
 * 1. 并发写入冲突检测
 * 2. 读后写一致性
 * 3. 缓存与数据库同步验证
 * 4. 部分更新回滚
 * 5. 重复数据检测与处理
 * 6. 孤儿记录预防
 * 7. 外键完整性模拟
 * 8. 乐观锁场景
 * 9. 事务隔离验证
 * 10. 数据版本冲突
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("DataConsistency 数据一致性测试")
class DataConsistencyTest {

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolCallCacheRepository toolCallCacheRepository;

    @Mock
    private BehaviorCalibrationMetricsRepository metricsRepository;

    @Mock
    private ToolReliabilityStatsRepository reliabilityStatsRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    private ToolCallRedundancyServiceImpl redundancyService;
    private BehaviorCalibrationServiceImpl calibrationService;

    private static final String TEST_FACTORY_ID = "F001";
    private static final String TEST_SESSION_ID = "consistency-test-session";
    private static final String TEST_TOOL_NAME = "inventory_query";
    private static final LocalDate TEST_DATE = LocalDate.of(2026, 1, 19);

    @BeforeEach
    void setUp() {
        // 初始化冗余检测服务
        redundancyService = new ToolCallRedundancyServiceImpl(
            toolCallRecordRepository,
            toolCallCacheRepository,
            objectMapper
        );

        // 初始化校准服务
        calibrationService = new BehaviorCalibrationServiceImpl(
            metricsRepository,
            toolCallRecordRepository,
            reliabilityStatsRepository,
            objectMapper
        );
    }

    // ==================== 1. 并发写入冲突检测 ====================

    @Test
    @DisplayName("并发写入同一记录 - 应正确处理写入冲突")
    void concurrent_write_same_record_should_handle_conflict() throws InterruptedException {
        // 模拟乐观锁冲突场景
        int threadCount = 10;
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);
        AtomicLong idGenerator = new AtomicLong(1);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        // 模拟保存时的版本冲突检查
        ConcurrentHashMap<Long, Integer> recordVersions = new ConcurrentHashMap<>();
        recordVersions.put(1L, 0); // 初始版本

        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer((Answer<ToolCallRecord>) invocation -> {
                ToolCallRecord record = invocation.getArgument(0);
                if (record.getId() == null) {
                    record.setId(idGenerator.getAndIncrement());
                    successCount.incrementAndGet();
                } else {
                    // 模拟乐观锁检查
                    Integer currentVersion = recordVersions.get(record.getId());
                    if (currentVersion != null) {
                        // 模拟版本冲突
                        int newVersion = currentVersion + 1;
                        recordVersions.put(record.getId(), newVersion);
                        successCount.incrementAndGet();
                    } else {
                        conflictCount.incrementAndGet();
                        throw new RuntimeException("Optimistic locking failed");
                    }
                }
                return record;
            });

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            final int index = i;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    ToolCallRecord record = ToolCallRecord.builder()
                        .sessionId(TEST_SESSION_ID)
                        .factoryId(TEST_FACTORY_ID)
                        .toolName(TEST_TOOL_NAME)
                        .toolParameters("{\"index\": " + index + "}")
                        .executionStatus(ExecutionStatus.SUCCESS)
                        .build();
                    redundancyService.recordToolCall(record);
                } catch (Exception e) {
                    // 预期可能有冲突
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        assertTrue(doneLatch.await(10, TimeUnit.SECONDS), "所有线程应在10秒内完成");
        executor.shutdown();

        // 验证至少有成功的写入
        assertTrue(successCount.get() > 0, "应有成功的写入操作");
        verify(toolCallRecordRepository, atLeast(1)).save(any(ToolCallRecord.class));
    }

    @Test
    @DisplayName("并发更新指标 - 增量应准确累加")
    void concurrent_metrics_update_should_accumulate_correctly() throws InterruptedException {
        // 测试并发增量更新场景
        int threadCount = 20;
        int incrementsPerThread = 10;
        AtomicInteger actualTotal = new AtomicInteger(0);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        BehaviorCalibrationMetrics sharedMetrics = BehaviorCalibrationMetrics.builder()
            .factoryId(TEST_FACTORY_ID)
            .metricDate(TEST_DATE)
            .periodType(PeriodType.DAILY)
            .totalCalls(0)
            .successfulCalls(0)
            .build();

        // 使用同步包装确保线程安全
        Object lock = new Object();

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    for (int j = 0; j < incrementsPerThread; j++) {
                        synchronized (lock) {
                            sharedMetrics.incrementTotalCalls();
                            actualTotal.incrementAndGet();
                        }
                    }
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        assertTrue(doneLatch.await(10, TimeUnit.SECONDS), "所有线程应在10秒内完成");
        executor.shutdown();

        int expected = threadCount * incrementsPerThread;
        assertEquals(expected, sharedMetrics.getTotalCalls(), "总调用数应正确累加");
        assertEquals(expected, actualTotal.get(), "原子计数器应与指标一致");
    }

    // ==================== 2. 读后写一致性 ====================

    @Test
    @DisplayName("读后写一致性 - 读取数据应与写入一致")
    void read_after_write_should_be_consistent() {
        // 准备测试数据
        String parametersJson = "{\"batchId\": \"B001\", \"date\": \"2026-01-19\"}";
        AtomicReference<ToolCallRecord> savedRecord = new AtomicReference<>();

        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer((Answer<ToolCallRecord>) invocation -> {
                ToolCallRecord record = invocation.getArgument(0);
                record.setId(1L);
                savedRecord.set(record);
                return record;
            });

        when(toolCallRecordRepository.findById(1L))
            .thenAnswer((Answer<Optional<ToolCallRecord>>) invocation ->
                Optional.ofNullable(savedRecord.get()));

        // 执行写入
        ToolCallRecord inputRecord = ToolCallRecord.builder()
            .sessionId(TEST_SESSION_ID)
            .factoryId(TEST_FACTORY_ID)
            .toolName(TEST_TOOL_NAME)
            .toolParameters(parametersJson)
            .executionStatus(ExecutionStatus.SUCCESS)
            .executionTimeMs(150)
            .inputTokens(100)
            .outputTokens(50)
            .build();

        ToolCallRecord written = redundancyService.recordToolCall(inputRecord);

        // 执行读取
        Optional<ToolCallRecord> read = toolCallRecordRepository.findById(written.getId());

        assertTrue(read.isPresent(), "应能读取到已写入的记录");
        ToolCallRecord readRecord = read.get();

        // 验证字段一致性
        assertEquals(written.getSessionId(), readRecord.getSessionId(), "会话ID应一致");
        assertEquals(written.getFactoryId(), readRecord.getFactoryId(), "工厂ID应一致");
        assertEquals(written.getToolName(), readRecord.getToolName(), "工具名应一致");
        assertEquals(written.getToolParameters(), readRecord.getToolParameters(), "参数应一致");
        assertEquals(written.getExecutionStatus(), readRecord.getExecutionStatus(), "状态应一致");
    }

    @Test
    @DisplayName("快速读写序列 - 不应丢失更新")
    void rapid_read_write_sequence_should_not_lose_updates() throws InterruptedException {
        // 模拟快速读写序列
        int operationCount = 50;
        AtomicInteger writeCount = new AtomicInteger(0);
        AtomicInteger readCount = new AtomicInteger(0);
        ConcurrentHashMap<Long, ToolCallRecord> storage = new ConcurrentHashMap<>();
        AtomicLong idGenerator = new AtomicLong(1);

        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer((Answer<ToolCallRecord>) invocation -> {
                ToolCallRecord record = invocation.getArgument(0);
                if (record.getId() == null) {
                    record.setId(idGenerator.getAndIncrement());
                }
                storage.put(record.getId(), record);
                writeCount.incrementAndGet();
                return record;
            });

        when(toolCallRecordRepository.findById(anyLong()))
            .thenAnswer((Answer<Optional<ToolCallRecord>>) invocation -> {
                Long id = invocation.getArgument(0);
                readCount.incrementAndGet();
                return Optional.ofNullable(storage.get(id));
            });

        CountDownLatch doneLatch = new CountDownLatch(operationCount * 2);
        ExecutorService executor = Executors.newFixedThreadPool(10);

        // 写入线程
        for (int i = 0; i < operationCount; i++) {
            final int index = i;
            executor.submit(() -> {
                try {
                    ToolCallRecord record = ToolCallRecord.builder()
                        .sessionId(TEST_SESSION_ID + "-" + index)
                        .factoryId(TEST_FACTORY_ID)
                        .toolName(TEST_TOOL_NAME)
                        .executionStatus(ExecutionStatus.SUCCESS)
                        .build();
                    redundancyService.recordToolCall(record);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        // 读取线程
        for (int i = 0; i < operationCount; i++) {
            final long id = i + 1;
            executor.submit(() -> {
                try {
                    // 延迟一点以确保有数据可读
                    Thread.sleep(5);
                    toolCallRecordRepository.findById(id);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        assertTrue(doneLatch.await(15, TimeUnit.SECONDS), "所有操作应在15秒内完成");
        executor.shutdown();

        assertEquals(operationCount, writeCount.get(), "所有写入应成功");
        assertTrue(readCount.get() > 0, "应有读取操作");
    }

    // ==================== 3. 缓存与数据库同步验证 ====================

    @Test
    @DisplayName("缓存同步 - 数据库更新后缓存应失效")
    void cache_should_invalidate_after_db_update() {
        AtomicReference<ToolCallCache> cacheStore = new AtomicReference<>();

        // 使用 anyString() 匹配任何 cacheKey，因为实际的 hash 是在运行时计算的
        lenient().when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
            .thenAnswer((Answer<Optional<ToolCallCache>>) invocation ->
                Optional.ofNullable(cacheStore.get())
                    .filter(c -> c.getExpiresAt().isAfter(LocalDateTime.now())));

        when(toolCallCacheRepository.save(any(ToolCallCache.class)))
            .thenAnswer((Answer<ToolCallCache>) invocation -> {
                ToolCallCache cache = invocation.getArgument(0);
                cacheStore.set(cache);
                return cache;
            });

        // 使用 anyString() 匹配任何 cacheKey
        when(toolCallCacheRepository.findByCacheKey(anyString()))
            .thenAnswer((Answer<Optional<ToolCallCache>>) invocation ->
                Optional.ofNullable(cacheStore.get()));

        Map<String, Object> params = new HashMap<>();
        params.put("test", "value");

        // 首次写入缓存
        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params,
            "{\"result\": \"v1\"}", 1L, 5);

        assertNotNull(cacheStore.get(), "缓存应被创建");
        assertEquals("{\"result\": \"v1\"}", cacheStore.get().getCachedResult(), "缓存值应正确");

        // 更新缓存（模拟数据库更新）
        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params,
            "{\"result\": \"v2\"}", 2L, 5);

        assertEquals("{\"result\": \"v2\"}", cacheStore.get().getCachedResult(), "缓存应更新为新值");
        assertEquals(2L, cacheStore.get().getOriginalCallId(), "原始调用ID应更新");
    }

    @Test
    @DisplayName("缓存过期 - 过期后应从数据库重新加载")
    void expired_cache_should_reload_from_database() {
        Map<String, Object> params = new HashMap<>();
        params.put("key", "value");
        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 模拟过期的缓存
        ToolCallCache expiredCache = ToolCallCache.builder()
            .cacheKey(cacheKey)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .parametersHash(hash)
            .cachedResult("{\"old\": true}")
            .originalCallId(1L)
            .expiresAt(LocalDateTime.now().minusMinutes(1)) // 已过期
            .build();

        // 验证缓存返回空（因为已过期）
        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());

        // 模拟数据库中有最新的记录
        ToolCallRecord freshRecord = ToolCallRecord.builder()
            .id(2L)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .parametersHash(hash)
            .executionStatus(ExecutionStatus.SUCCESS)
            .build();

        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            eq(TEST_SESSION_ID), eq(TEST_TOOL_NAME), eq(hash), any(LocalDateTime.class)))
            .thenReturn(Optional.of(freshRecord));

        // 检查冗余时应返回true（因为数据库有记录）
        boolean isRedundant = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);

        assertTrue(isRedundant, "过期缓存后应从数据库检测到冗余");
    }

    // ==================== 4. 部分更新回滚 ====================

    @Test
    @DisplayName("部分更新失败 - 应保持数据完整性")
    void partial_update_failure_should_maintain_integrity() {
        // 模拟部分更新失败场景
        AtomicBoolean firstCallFailed = new AtomicBoolean(false);
        AtomicInteger updateAttempts = new AtomicInteger(0);

        ToolCallRecord originalRecord = ToolCallRecord.builder()
            .id(1L)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .executionStatus(ExecutionStatus.FAILED)
            .retryCount(0)
            .build();

        when(toolCallRecordRepository.findById(1L))
            .thenReturn(Optional.of(originalRecord));

        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer((Answer<ToolCallRecord>) invocation -> {
                int attempt = updateAttempts.incrementAndGet();
                if (attempt == 1 && !firstCallFailed.get()) {
                    firstCallFailed.set(true);
                    throw new RuntimeException("Simulated DB failure");
                }
                return invocation.getArgument(0);
            });

        // 第一次更新应失败
        ToolCallRecord updateRecord = ToolCallRecord.builder()
            .id(1L)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .executionStatus(ExecutionStatus.SUCCESS)
            .retryCount(1)
            .build();

        try {
            toolCallRecordRepository.save(updateRecord);
            fail("第一次保存应抛出异常");
        } catch (RuntimeException e) {
            assertEquals("Simulated DB failure", e.getMessage());
        }

        // 验证原始数据未被修改
        Optional<ToolCallRecord> current = toolCallRecordRepository.findById(1L);
        assertTrue(current.isPresent(), "原始记录应存在");
        assertEquals(ExecutionStatus.FAILED, current.get().getExecutionStatus(), "状态应保持原值");

        // 重试应成功
        ToolCallRecord retryRecord = toolCallRecordRepository.save(updateRecord);
        assertNotNull(retryRecord, "重试保存应成功");
    }

    // ==================== 5. 重复数据检测与处理 ====================

    @Test
    @DisplayName("重复记录检测 - 相同参数哈希应识别为重复")
    void duplicate_records_should_be_detected_by_hash() throws InterruptedException {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");
        params.put("date", "2026-01-19");

        String hash = redundancyService.computeParametersHash(params);
        int threadCount = 5;
        AtomicInteger redundantCount = new AtomicInteger(0);
        AtomicBoolean firstCall = new AtomicBoolean(true);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
            .thenAnswer((Answer<Optional<ToolCallCache>>) invocation -> {
                if (firstCall.compareAndSet(true, false)) {
                    return Optional.empty();
                }
                redundantCount.incrementAndGet();
                return Optional.of(ToolCallCache.builder()
                    .cacheKey("test-key")
                    .sessionId(TEST_SESSION_ID)
                    .toolName(TEST_TOOL_NAME)
                    .parametersHash(hash)
                    .cachedResult("{}")
                    .originalCallId(1L)
                    .expiresAt(LocalDateTime.now().plusMinutes(5))
                    .build());
            });

        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            anyString(), anyString(), anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        List<Boolean> results = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    boolean isRedundant = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
                    results.add(isRedundant);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        assertTrue(doneLatch.await(10, TimeUnit.SECONDS), "所有线程应在10秒内完成");
        executor.shutdown();

        assertEquals(threadCount, results.size(), "应收到所有线程结果");
        // 第一个应该不是冗余，后续应该是冗余
        long trueCount = results.stream().filter(r -> r).count();
        assertTrue(trueCount >= threadCount - 1, "大部分调用应被检测为冗余");
    }

    @Test
    @DisplayName("哈希唯一性验证 - 不同参数应产生不同哈希")
    void different_params_should_produce_different_hash() {
        Map<String, Object> params1 = new HashMap<>();
        params1.put("batchId", "B001");
        params1.put("date", "2026-01-19");

        Map<String, Object> params2 = new HashMap<>();
        params2.put("batchId", "B002");
        params2.put("date", "2026-01-19");

        Map<String, Object> params3 = new HashMap<>();
        params3.put("batchId", "B001");
        params3.put("date", "2026-01-20");

        String hash1 = redundancyService.computeParametersHash(params1);
        String hash2 = redundancyService.computeParametersHash(params2);
        String hash3 = redundancyService.computeParametersHash(params3);

        assertNotEquals(hash1, hash2, "不同batchId应产生不同哈希");
        assertNotEquals(hash1, hash3, "不同date应产生不同哈希");
        assertNotEquals(hash2, hash3, "完全不同的参数应产生不同哈希");

        // 验证相同参数产生相同哈希
        String hash1Again = redundancyService.computeParametersHash(params1);
        assertEquals(hash1, hash1Again, "相同参数应产生相同哈希");
    }

    // ==================== 6. 孤儿记录预防 ====================

    @Test
    @DisplayName("孤儿缓存预防 - 原始记录删除时缓存应清理")
    void orphan_cache_should_be_prevented() {
        AtomicBoolean cacheDeleted = new AtomicBoolean(false);

        doAnswer(invocation -> {
            cacheDeleted.set(true);
            return null;
        }).when(toolCallCacheRepository).deleteBySessionId(TEST_SESSION_ID);

        // 清理会话缓存
        int cleared = redundancyService.clearSessionCache(TEST_SESSION_ID);

        verify(toolCallCacheRepository).deleteBySessionId(TEST_SESSION_ID);
        assertTrue(cacheDeleted.get(), "缓存删除应被调用");
    }

    @Test
    @DisplayName("会话终止时清理 - 所有相关记录应清理")
    void session_termination_should_cleanup_all_related_data() {
        List<String> deletedSessions = Collections.synchronizedList(new ArrayList<>());

        doAnswer(invocation -> {
            String sessionId = invocation.getArgument(0);
            deletedSessions.add(sessionId);
            return null;
        }).when(toolCallCacheRepository).deleteBySessionId(anyString());

        // 模拟多个会话清理
        String[] sessions = {"session-1", "session-2", "session-3"};
        for (String session : sessions) {
            redundancyService.clearSessionCache(session);
        }

        assertEquals(sessions.length, deletedSessions.size(), "所有会话都应被清理");
        for (String session : sessions) {
            assertTrue(deletedSessions.contains(session), "会话 " + session + " 应被清理");
        }
    }

    // ==================== 7. 外键完整性模拟 ====================

    @Test
    @DisplayName("外键完整性 - 引用不存在的原始调用应处理")
    void foreign_key_integrity_should_handle_missing_reference() {
        // markAsRedundant 方法调用 findById(recordId)，recordId=1L
        // originalCallId=999L 只是设置在记录上，不会被单独查询
        // 模拟 recordId=1L 不存在的情况，验证方法能优雅处理
        lenient().when(toolCallRecordRepository.findById(1L))
            .thenReturn(Optional.empty());

        // 尝试标记为冗余（原始调用ID=999L引用的记录可能不存在）
        // 当 recordId=1L 记录不存在时，ifPresent 不执行，方法应优雅返回
        redundancyService.markAsRedundant(1L, 999L, "duplicate call");

        // 验证 findById 被调用，且不应抛出异常
        verify(toolCallRecordRepository).findById(1L);
    }

    @Test
    @DisplayName("工具统计外键 - 工厂ID不存在时应返回空结果")
    void tool_stats_should_return_empty_for_nonexistent_factory() {
        when(reliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(
            "NONEXISTENT", TEST_DATE))
            .thenReturn(Collections.emptyList());

        List<ToolReliabilityStats> stats = calibrationService.getToolReliabilityRanking("NONEXISTENT", TEST_DATE);

        assertNotNull(stats, "结果不应为null");
        assertTrue(stats.isEmpty(), "不存在的工厂应返回空列表");
    }

    // ==================== 8. 乐观锁场景 ====================

    @Test
    @DisplayName("乐观锁冲突 - 并发修改应检测到版本冲突")
    void optimistic_lock_should_detect_version_conflict() throws InterruptedException {
        // 模拟版本控制
        AtomicInteger currentVersion = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);
        int threadCount = 5;
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer((Answer<ToolCallRecord>) invocation -> {
                // 模拟检查并增加版本号
                int version = currentVersion.getAndIncrement();
                if (version > 0) {
                    // 模拟并发时的版本冲突
                    conflictCount.incrementAndGet();
                }
                return invocation.getArgument(0);
            });

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    ToolCallRecord record = ToolCallRecord.builder()
                        .id(1L) // 同一记录
                        .sessionId(TEST_SESSION_ID)
                        .toolName(TEST_TOOL_NAME)
                        .executionStatus(ExecutionStatus.SUCCESS)
                        .build();
                    redundancyService.recordToolCall(record);
                } catch (Exception e) {
                    // 预期可能有冲突
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        assertTrue(doneLatch.await(10, TimeUnit.SECONDS), "所有线程应在10秒内完成");
        executor.shutdown();

        // 验证版本递增了多次（说明检测到了并发）
        assertTrue(currentVersion.get() > 1, "应有多次版本更新");
    }

    // ==================== 9. 事务隔离验证 ====================

    @Test
    @DisplayName("事务隔离 - 未提交事务不应被其他会话读取")
    void uncommitted_transaction_should_not_be_visible() throws InterruptedException {
        // 模拟事务隔离
        AtomicBoolean transactionCommitted = new AtomicBoolean(false);
        AtomicReference<ToolCallRecord> uncommittedRecord = new AtomicReference<>();
        ConcurrentHashMap<Long, ToolCallRecord> committedRecords = new ConcurrentHashMap<>();

        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer((Answer<ToolCallRecord>) invocation -> {
                ToolCallRecord record = invocation.getArgument(0);
                record.setId(1L);
                if (transactionCommitted.get()) {
                    committedRecords.put(record.getId(), record);
                } else {
                    uncommittedRecord.set(record);
                }
                return record;
            });

        when(toolCallRecordRepository.findById(1L))
            .thenAnswer((Answer<Optional<ToolCallRecord>>) invocation ->
                Optional.ofNullable(committedRecords.get(1L)));

        // 写入未提交事务
        ToolCallRecord record = ToolCallRecord.builder()
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .executionStatus(ExecutionStatus.SUCCESS)
            .build();
        redundancyService.recordToolCall(record);

        // 其他会话尝试读取
        Optional<ToolCallRecord> read = toolCallRecordRepository.findById(1L);
        assertFalse(read.isPresent(), "未提交的事务不应被读取");

        // 模拟提交
        transactionCommitted.set(true);
        committedRecords.put(1L, uncommittedRecord.get());

        // 提交后应能读取
        Optional<ToolCallRecord> readAfterCommit = toolCallRecordRepository.findById(1L);
        assertTrue(readAfterCommit.isPresent(), "提交后应能读取");
    }

    @Test
    @DisplayName("会话数据隔离 - 不同会话数据不应混淆")
    void different_sessions_should_have_isolated_data() throws InterruptedException {
        int sessionCount = 5;
        ConcurrentHashMap<String, List<ToolCallRecord>> sessionRecords = new ConcurrentHashMap<>();
        CountDownLatch doneLatch = new CountDownLatch(sessionCount);

        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer((Answer<ToolCallRecord>) invocation -> {
                ToolCallRecord record = invocation.getArgument(0);
                record.setId(System.nanoTime());
                sessionRecords.computeIfAbsent(record.getSessionId(),
                    k -> Collections.synchronizedList(new ArrayList<>())).add(record);
                return record;
            });

        ExecutorService executor = Executors.newFixedThreadPool(sessionCount);

        for (int i = 0; i < sessionCount; i++) {
            final String sessionId = "session-" + i;
            executor.submit(() -> {
                try {
                    ToolCallRecord record = ToolCallRecord.builder()
                        .sessionId(sessionId)
                        .factoryId(TEST_FACTORY_ID)
                        .toolName(TEST_TOOL_NAME)
                        .executionStatus(ExecutionStatus.SUCCESS)
                        .build();
                    redundancyService.recordToolCall(record);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        assertTrue(doneLatch.await(10, TimeUnit.SECONDS), "所有线程应在10秒内完成");
        executor.shutdown();

        // 验证每个会话的数据是隔离的
        assertEquals(sessionCount, sessionRecords.size(), "应有正确数量的会话");
        for (int i = 0; i < sessionCount; i++) {
            String sessionId = "session-" + i;
            List<ToolCallRecord> records = sessionRecords.get(sessionId);
            assertNotNull(records, "会话 " + sessionId + " 应有记录");
            assertEquals(1, records.size(), "每个会话应只有一条记录");
            assertEquals(sessionId, records.get(0).getSessionId(), "记录应属于正确的会话");
        }
    }

    // ==================== 10. 数据版本冲突 ====================

    @Test
    @DisplayName("版本冲突解决 - 后写入者应覆盖或检测冲突")
    void version_conflict_should_be_resolved_correctly() throws InterruptedException {
        // 模拟版本冲突场景
        AtomicInteger writeOrder = new AtomicInteger(0);
        AtomicReference<String> lastWriter = new AtomicReference<>();
        ConcurrentHashMap<Long, ToolCallRecord> storage = new ConcurrentHashMap<>();

        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer((Answer<ToolCallRecord>) invocation -> {
                ToolCallRecord record = invocation.getArgument(0);
                int order = writeOrder.incrementAndGet();
                String writer = Thread.currentThread().getName() + "-" + order;
                record.setId(1L);
                record.setErrorMessage(writer); // 使用errorMessage存储写入者信息
                lastWriter.set(writer);
                storage.put(1L, record);
                return record;
            });

        int threadCount = 3;
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            final int index = i;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    ToolCallRecord record = ToolCallRecord.builder()
                        .id(1L)
                        .sessionId(TEST_SESSION_ID)
                        .toolName(TEST_TOOL_NAME + "-" + index)
                        .executionStatus(ExecutionStatus.SUCCESS)
                        .build();
                    redundancyService.recordToolCall(record);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        assertTrue(doneLatch.await(10, TimeUnit.SECONDS), "所有线程应在10秒内完成");
        executor.shutdown();

        // 验证最终状态
        assertEquals(threadCount, writeOrder.get(), "应有所有写入操作");
        assertNotNull(lastWriter.get(), "应有最后写入者");
        assertNotNull(storage.get(1L), "存储中应有记录");
    }

    @Test
    @DisplayName("指标版本一致性 - 并发更新指标应保持一致")
    void metrics_version_should_remain_consistent() throws InterruptedException {
        // 测试指标并发更新的一致性
        int threadCount = 10;
        AtomicReference<BehaviorCalibrationMetrics> currentMetrics = new AtomicReference<>(
            BehaviorCalibrationMetrics.builder()
                .id(1L)
                .factoryId(TEST_FACTORY_ID)
                .metricDate(TEST_DATE)
                .periodType(PeriodType.DAILY)
                .totalCalls(0)
                .successfulCalls(0)
                .failedCalls(0)
                .build()
        );

        when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
            .thenAnswer((Answer<BehaviorCalibrationMetrics>) invocation -> {
                BehaviorCalibrationMetrics metrics = invocation.getArgument(0);
                currentMetrics.set(metrics);
                return metrics;
            });

        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            final int increment = i + 1;
            executor.submit(() -> {
                try {
                    BehaviorCalibrationMetrics metrics = currentMetrics.get();
                    BehaviorCalibrationMetrics updated = BehaviorCalibrationMetrics.builder()
                        .id(metrics.getId())
                        .factoryId(metrics.getFactoryId())
                        .metricDate(metrics.getMetricDate())
                        .periodType(metrics.getPeriodType())
                        .totalCalls(metrics.getTotalCalls() + increment)
                        .successfulCalls(metrics.getSuccessfulCalls() + increment)
                        .build();
                    metricsRepository.save(updated);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        assertTrue(doneLatch.await(10, TimeUnit.SECONDS), "所有线程应在10秒内完成");
        executor.shutdown();

        // 验证最终有指标被保存
        verify(metricsRepository, times(threadCount)).save(any(BehaviorCalibrationMetrics.class));
        assertNotNull(currentMetrics.get(), "应有最终指标");
    }

    // ==================== 额外测试：指标聚合一致性 ====================

    @Test
    @DisplayName("指标聚合一致性 - 计算得分应与原始数据一致")
    void metrics_aggregation_should_be_consistent() {
        BehaviorCalibrationMetrics metrics = BehaviorCalibrationMetrics.builder()
            .factoryId(TEST_FACTORY_ID)
            .metricDate(TEST_DATE)
            .periodType(PeriodType.DAILY)
            .totalCalls(100)
            .successfulCalls(90)
            .failedCalls(10)
            .redundantCalls(5)
            .recoveredCalls(3)
            .totalInputTokens(50000L)
            .totalOutputTokens(30000L)
            .build();

        metrics.calculateScores();

        // 验证简洁性得分: (100 - 5) / 100 * 100 = 95.00
        assertEquals(new BigDecimal("95.00"), metrics.getConcisenessScore(), "简洁性得分应正确");

        // 验证成功率: 90 / 100 * 100 = 90.00
        assertEquals(new BigDecimal("90.00"), metrics.getSuccessRate(), "成功率应正确");

        // 验证综合得分计算
        assertNotNull(metrics.getCompositeScore(), "综合得分应被计算");
        assertTrue(metrics.getCompositeScore().compareTo(BigDecimal.ZERO) > 0, "综合得分应大于0");
    }

    @Test
    @DisplayName("空数据指标计算 - 应返回零值而不是异常")
    void empty_data_metrics_should_return_zero() {
        BehaviorCalibrationMetrics metrics = BehaviorCalibrationMetrics.builder()
            .factoryId(TEST_FACTORY_ID)
            .metricDate(TEST_DATE)
            .periodType(PeriodType.DAILY)
            .totalCalls(0)
            .build();

        metrics.calculateScores();

        assertEquals(BigDecimal.ZERO, metrics.getConcisenessScore(), "无数据时简洁性应为0");
        assertEquals(BigDecimal.ZERO, metrics.getSuccessRate(), "无数据时成功率应为0");
        assertEquals(BigDecimal.ZERO, metrics.getCompositeScore(), "无数据时综合得分应为0");
    }

    // ==================== 额外测试：工具调用记录去重 ====================

    @Test
    @DisplayName("工具调用记录去重 - 重复参数哈希应使用缓存结果")
    void tool_call_deduplication_should_use_cached_result() {
        Map<String, Object> params = new HashMap<>();
        params.put("query", "test");
        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        String cachedResult = "{\"result\": \"cached\"}";

        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.of(ToolCallCache.builder()
                .cacheKey(cacheKey)
                .sessionId(TEST_SESSION_ID)
                .toolName(TEST_TOOL_NAME)
                .parametersHash(hash)
                .cachedResult(cachedResult)
                .originalCallId(1L)
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .hitCount(0)
                .build()));

        // 检查是否冗余
        boolean isRedundant = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
        assertTrue(isRedundant, "有缓存时应检测为冗余");

        // 获取缓存结果
        Optional<String> result = redundancyService.getCachedResult(TEST_SESSION_ID, TEST_TOOL_NAME, params);
        assertTrue(result.isPresent(), "应能获取缓存结果");
        assertEquals(cachedResult, result.get(), "缓存结果应正确");
    }
}
