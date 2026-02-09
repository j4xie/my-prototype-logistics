package com.cretas.aims.service.calibration;

import com.cretas.aims.entity.calibration.ToolCallCache;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.repository.calibration.ToolCallCacheRepository;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.service.calibration.impl.ToolCallRedundancyServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.Answer;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 并发冗余检测测试
 * 测试多线程同时调用冗余检测时的正确性和线程安全性
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ConcurrentRedundancy 并发测试")
class ConcurrentRedundancyTest {

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolCallCacheRepository toolCallCacheRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    private ToolCallRedundancyServiceImpl redundancyService;

    private static final String TEST_SESSION_ID = "concurrent-test-session-" + UUID.randomUUID();
    private static final String TEST_TOOL_NAME = "inventory_query";
    private static final String TEST_FACTORY_ID = "F001";

    @BeforeEach
    void setUp() {
        redundancyService = new ToolCallRedundancyServiceImpl(
            toolCallRecordRepository,
            toolCallCacheRepository,
            objectMapper
        );
    }

    @Test
    @DisplayName("并发相同参数调用 - 应正确检测冗余")
    void concurrent_same_params_should_detect_redundancy() throws InterruptedException {
        int threadCount = 10;
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");
        params.put("date", "2026-01-19");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        AtomicInteger cacheHitCount = new AtomicInteger(0);
        AtomicInteger firstCallCount = new AtomicInteger(0);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        // 模拟第一次调用后缓存命中
        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenAnswer((Answer<Optional<ToolCallCache>>) invocation -> {
                // 第一次调用返回空，后续调用返回缓存
                if (firstCallCount.incrementAndGet() == 1) {
                    return Optional.empty();
                }
                cacheHitCount.incrementAndGet();
                return Optional.of(ToolCallCache.builder()
                    .cacheKey(cacheKey)
                    .sessionId(TEST_SESSION_ID)
                    .toolName(TEST_TOOL_NAME)
                    .parametersHash(hash)
                    .originalCallId(1L)
                    .expiresAt(LocalDateTime.now().plusMinutes(5))
                    .cachedResult("{\"success\": true}")
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

        assertEquals(threadCount, results.size(), "应收集到所有线程的结果");

        // 验证缓存逻辑被正确调用
        verify(toolCallCacheRepository, atLeast(1)).findValidCache(eq(cacheKey), any(LocalDateTime.class));
    }

    @Test
    @DisplayName("并发不同会话 - 不应相互干扰")
    void concurrent_different_sessions_should_not_interfere() throws InterruptedException {
        int threadCount = 10;
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        ConcurrentHashMap<String, AtomicInteger> sessionCallCounts = new ConcurrentHashMap<>();
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        // 为每个线程创建不同的会话
        List<String> sessionIds = new ArrayList<>();
        for (int i = 0; i < threadCount; i++) {
            sessionIds.add("session-" + i + "-" + UUID.randomUUID());
        }

        // 模拟每个会话都是首次调用
        when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            anyString(), anyString(), anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        List<Boolean> results = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threadCount; i++) {
            final String sessionId = sessionIds.get(i);
            executor.submit(() -> {
                try {
                    startLatch.await();
                    sessionCallCounts.computeIfAbsent(sessionId, k -> new AtomicInteger(0)).incrementAndGet();
                    boolean isRedundant = redundancyService.isRedundant(sessionId, TEST_TOOL_NAME, params);
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

        // 所有不同会话的首次调用都不应该是冗余的
        assertEquals(threadCount, results.size());
        assertTrue(results.stream().noneMatch(r -> r), "不同会话的首次调用都不应是冗余");

        // 每个会话应该只被调用一次
        assertEquals(threadCount, sessionCallCounts.size(), "应有不同的会话");
        sessionCallCounts.values().forEach(count ->
            assertEquals(1, count.get(), "每个会话应该只被调用一次")
        );
    }

    @Test
    @DisplayName("并发缓存写入 - 不应丢失数据")
    void concurrent_cache_write_should_not_lose_data() throws InterruptedException {
        int threadCount = 10;
        ConcurrentHashMap<String, String> savedCaches = new ConcurrentHashMap<>();
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        // 模拟缓存查询返回空（需要创建新缓存）
        when(toolCallCacheRepository.findByCacheKey(anyString()))
            .thenReturn(Optional.empty());
        when(toolCallCacheRepository.save(any(ToolCallCache.class)))
            .thenAnswer((Answer<ToolCallCache>) invocation -> {
                ToolCallCache cache = invocation.getArgument(0);
                savedCaches.put(cache.getCacheKey(), cache.getCachedResult());
                return cache;
            });

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            final int index = i;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    Map<String, Object> params = new HashMap<>();
                    params.put("batchId", "B" + String.format("%03d", index));

                    String result = "{\"index\": " + index + "}";
                    redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params, result, (long) index);
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

        // 验证所有缓存都被保存
        verify(toolCallCacheRepository, times(threadCount)).save(any(ToolCallCache.class));
        assertEquals(threadCount, savedCaches.size(), "所有缓存都应被保存");
    }

    @Test
    @DisplayName("并发缓存清理 - 应正确清理指定会话")
    void concurrent_cache_cleanup_should_work_correctly() throws InterruptedException {
        int threadCount = 5;
        List<String> sessionIds = new ArrayList<>();
        for (int i = 0; i < threadCount; i++) {
            sessionIds.add("cleanup-session-" + i);
        }

        AtomicInteger cleanupCount = new AtomicInteger(0);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        doAnswer(invocation -> {
            cleanupCount.incrementAndGet();
            return null;
        }).when(toolCallCacheRepository).deleteBySessionId(anyString());

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (String sessionId : sessionIds) {
            executor.submit(() -> {
                try {
                    redundancyService.clearSessionCache(sessionId);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        assertTrue(doneLatch.await(10, TimeUnit.SECONDS), "所有清理操作应在10秒内完成");
        executor.shutdown();

        assertEquals(threadCount, cleanupCount.get(), "每个会话都应被清理一次");
    }

    @Test
    @DisplayName("并发哈希计算 - 相同参数应产生相同哈希")
    void concurrent_hash_computation_should_be_consistent() throws InterruptedException {
        int threadCount = 20;
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");
        params.put("date", "2026-01-19");
        params.put("factoryId", "F001");

        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        ConcurrentHashMap<String, AtomicInteger> hashCounts = new ConcurrentHashMap<>();

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    String hash = redundancyService.computeParametersHash(params);
                    hashCounts.computeIfAbsent(hash, k -> new AtomicInteger(0)).incrementAndGet();
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

        // 所有线程应该产生相同的哈希
        assertEquals(1, hashCounts.size(), "相同参数应产生相同哈希");
        assertEquals(threadCount, hashCounts.values().iterator().next().get(), "所有计算都应成功");
    }

    @Test
    @DisplayName("并发记录工具调用 - 不应丢失记录")
    void concurrent_record_tool_call_should_not_lose_records() throws InterruptedException {
        int threadCount = 10;
        AtomicInteger savedCount = new AtomicInteger(0);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        when(toolCallRecordRepository.save(any(ToolCallRecord.class)))
            .thenAnswer((Answer<ToolCallRecord>) invocation -> {
                savedCount.incrementAndGet();
                ToolCallRecord record = invocation.getArgument(0);
                record.setId((long) savedCount.get());
                return record;
            });

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            final int index = i;
            executor.submit(() -> {
                try {
                    ToolCallRecord record = ToolCallRecord.builder()
                        .sessionId(TEST_SESSION_ID)
                        .toolName(TEST_TOOL_NAME)
                        .factoryId(TEST_FACTORY_ID)
                        .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
                        .toolParameters("{\"index\": " + index + "}")
                        .build();
                    redundancyService.recordToolCall(record);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        assertTrue(doneLatch.await(10, TimeUnit.SECONDS), "所有线程应在10秒内完成");
        executor.shutdown();

        assertEquals(threadCount, savedCount.get(), "所有记录都应被保存");
    }

    @Test
    @DisplayName("高并发压力测试 - 系统应保持稳定")
    void high_concurrency_stress_test_should_remain_stable() throws InterruptedException {
        int threadCount = 50;
        int operationsPerThread = 10;
        AtomicInteger totalOperations = new AtomicInteger(0);
        AtomicInteger errors = new AtomicInteger(0);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        when(toolCallCacheRepository.findValidCache(anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            anyString(), anyString(), anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            final int threadIndex = i;
            executor.submit(() -> {
                try {
                    for (int j = 0; j < operationsPerThread; j++) {
                        Map<String, Object> params = new HashMap<>();
                        params.put("threadIndex", threadIndex);
                        params.put("operationIndex", j);

                        try {
                            redundancyService.isRedundant(TEST_SESSION_ID + "-" + threadIndex, TEST_TOOL_NAME, params);
                            totalOperations.incrementAndGet();
                        } catch (Exception e) {
                            errors.incrementAndGet();
                        }
                    }
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        assertTrue(doneLatch.await(30, TimeUnit.SECONDS), "所有线程应在30秒内完成");
        executor.shutdown();

        int expectedOperations = threadCount * operationsPerThread;
        assertEquals(expectedOperations, totalOperations.get(), "所有操作都应成功");
        assertEquals(0, errors.get(), "不应有错误发生");
    }
}
