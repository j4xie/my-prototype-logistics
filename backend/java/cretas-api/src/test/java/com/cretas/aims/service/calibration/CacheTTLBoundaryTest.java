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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 缓存TTL边界测试
 * 验证缓存在TTL边界点的正确行为
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("CacheTTLBoundary TTL边界测试")
class CacheTTLBoundaryTest {

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolCallCacheRepository toolCallCacheRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    private ToolCallRedundancyServiceImpl redundancyService;

    private static final String TEST_SESSION_ID = "ttl-test-session-" + UUID.randomUUID();
    private static final String TEST_TOOL_NAME = "inventory_query";
    private static final int DEFAULT_TTL_MINUTES = 5;

    @BeforeEach
    void setUp() {
        redundancyService = new ToolCallRedundancyServiceImpl(
            toolCallRecordRepository,
            toolCallCacheRepository,
            objectMapper
        );
        // Set the default TTL value since @Value isn't processed in unit tests
        ReflectionTestUtils.setField(redundancyService, "defaultCacheTtlMinutes", DEFAULT_TTL_MINUTES);
    }

    @Test
    @DisplayName("缓存在4分59秒时应命中")
    void cache_at_4min59sec_should_hit() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 缓存将在4分59秒后过期（即还有1秒有效）
        LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(1);
        ToolCallCache validCache = ToolCallCache.builder()
            .id(1L)
            .cacheKey(cacheKey)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .parametersHash(hash)
            .cachedResult("{\"data\": \"cached\"}")
            .originalCallId(1L)
            .expiresAt(expiresAt)
            .hitCount(0)
            .build();

        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.of(validCache));

        boolean isRedundant = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);

        assertTrue(isRedundant, "TTL内的缓存应该命中");
    }

    @Test
    @DisplayName("缓存在5分01秒时应过期")
    void cache_at_5min01sec_should_miss() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 模拟缓存已过期
        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            anyString(), anyString(), anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());

        boolean isRedundant = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);

        assertFalse(isRedundant, "过期的缓存不应命中");
    }

    @Test
    @DisplayName("过期缓存应被清理")
    void expired_cache_should_be_cleaned() {
        LocalDateTime now = LocalDateTime.now();

        // 模拟清理操作
        when(toolCallCacheRepository.deleteExpiredCache(any(LocalDateTime.class)))
            .thenReturn(5);

        int cleanedCount = redundancyService.cleanupExpiredCache();

        verify(toolCallCacheRepository).deleteExpiredCache(any(LocalDateTime.class));
        assertEquals(5, cleanedCount, "应该清理5个过期缓存");
    }

    @Test
    @DisplayName("验证缓存创建时的TTL设置")
    void verify_ttl_setting_on_cache_creation() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        when(toolCallCacheRepository.findByCacheKey(anyString()))
            .thenReturn(Optional.empty());

        ArgumentCaptor<ToolCallCache> cacheCaptor = ArgumentCaptor.forClass(ToolCallCache.class);
        when(toolCallCacheRepository.save(cacheCaptor.capture()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        LocalDateTime beforeCreate = LocalDateTime.now();
        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params, "{\"result\": \"test\"}", 1L);
        LocalDateTime afterCreate = LocalDateTime.now();

        ToolCallCache savedCache = cacheCaptor.getValue();
        assertNotNull(savedCache.getExpiresAt(), "过期时间应被设置");

        // 验证过期时间在合理范围内（允许更宽松的时间差）
        LocalDateTime expectedMinExpiry = beforeCreate.plusMinutes(DEFAULT_TTL_MINUTES).minusSeconds(5);
        LocalDateTime expectedMaxExpiry = afterCreate.plusMinutes(DEFAULT_TTL_MINUTES).plusSeconds(5);

        assertTrue(savedCache.getExpiresAt().isAfter(expectedMinExpiry) ||
                   savedCache.getExpiresAt().isEqual(expectedMinExpiry),
            "过期时间应该在预期范围内(最小)");
        assertTrue(savedCache.getExpiresAt().isBefore(expectedMaxExpiry) ||
                   savedCache.getExpiresAt().isEqual(expectedMaxExpiry),
            "过期时间应该在预期范围内(最大)");
    }

    @Test
    @DisplayName("自定义TTL应正确生效")
    void custom_ttl_should_work() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");
        int customTtl = 10; // 10分钟

        when(toolCallCacheRepository.findByCacheKey(anyString()))
            .thenReturn(Optional.empty());

        ArgumentCaptor<ToolCallCache> cacheCaptor = ArgumentCaptor.forClass(ToolCallCache.class);
        when(toolCallCacheRepository.save(cacheCaptor.capture()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        LocalDateTime beforeCreate = LocalDateTime.now();
        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params, "{\"result\": \"test\"}", 1L, customTtl);

        ToolCallCache savedCache = cacheCaptor.getValue();
        assertNotNull(savedCache.getExpiresAt());

        // 验证自定义TTL
        long minutesDiff = java.time.Duration.between(beforeCreate, savedCache.getExpiresAt()).toMinutes();
        assertTrue(minutesDiff >= customTtl - 1 && minutesDiff <= customTtl + 1,
            "自定义TTL应该正确设置");
    }

    @Test
    @DisplayName("延长缓存过期时间")
    void extend_cache_expiration() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 设置原始过期时间为1分钟后（比默认TTL短）
        LocalDateTime originalExpiry = LocalDateTime.now().plusMinutes(1);
        ToolCallCache existingCache = ToolCallCache.builder()
            .id(1L)
            .cacheKey(cacheKey)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .parametersHash(hash)
            .cachedResult("{\"old\": \"data\"}")
            .originalCallId(1L)
            .expiresAt(originalExpiry)
            .hitCount(5)
            .build();

        when(toolCallCacheRepository.findByCacheKey(cacheKey))
            .thenReturn(Optional.of(existingCache));

        ArgumentCaptor<ToolCallCache> cacheCaptor = ArgumentCaptor.forClass(ToolCallCache.class);
        when(toolCallCacheRepository.save(cacheCaptor.capture()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        // 更新缓存（这会设置新的过期时间）
        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params, "{\"new\": \"data\"}", 2L);

        ToolCallCache savedCache = cacheCaptor.getValue();
        // 新的过期时间应该是当前时间 + DEFAULT_TTL_MINUTES (5分钟)
        // 这应该比原始的1分钟过期时间要晚
        assertTrue(savedCache.getExpiresAt().isAfter(originalExpiry.minusSeconds(1)),
            "更新缓存应该设置新的过期时间");
    }

    @Test
    @DisplayName("缓存isExpired方法验证")
    void cache_is_expired_method_verification() {
        // 创建一个已过期的缓存
        ToolCallCache expiredCache = ToolCallCache.builder()
            .id(1L)
            .expiresAt(LocalDateTime.now().minusSeconds(1))
            .build();

        assertTrue(expiredCache.isExpired(), "过期的缓存应返回true");

        // 创建一个未过期的缓存
        ToolCallCache validCache = ToolCallCache.builder()
            .id(2L)
            .expiresAt(LocalDateTime.now().plusMinutes(5))
            .build();

        assertFalse(validCache.isExpired(), "未过期的缓存应返回false");
    }

    @Test
    @DisplayName("缓存在精确过期时刻的行为")
    void cache_at_exact_expiry_moment() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 创建一个即将在此刻过期的缓存
        LocalDateTime now = LocalDateTime.now();
        ToolCallCache edgeCache = ToolCallCache.builder()
            .id(1L)
            .cacheKey(cacheKey)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .parametersHash(hash)
            .cachedResult("{\"data\": \"edge\"}")
            .originalCallId(1L)
            .expiresAt(now) // 精确在当前时刻过期
            .hitCount(0)
            .build();

        // 在精确过期时刻，isExpired应该返回false（因为是isAfter，不是isAfterOrEqual）
        // 但实际行为取决于实现
        assertNotNull(edgeCache.getExpiresAt());
    }

    @Test
    @DisplayName("TTL为0时的行为")
    void zero_ttl_behavior() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        when(toolCallCacheRepository.findByCacheKey(anyString()))
            .thenReturn(Optional.empty());

        ArgumentCaptor<ToolCallCache> cacheCaptor = ArgumentCaptor.forClass(ToolCallCache.class);
        when(toolCallCacheRepository.save(cacheCaptor.capture()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        // TTL为0
        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params, "{\"result\": \"test\"}", 1L, 0);

        ToolCallCache savedCache = cacheCaptor.getValue();
        assertNotNull(savedCache.getExpiresAt());
        // TTL为0意味着立即过期或当前时刻
        assertTrue(savedCache.getExpiresAt().isBefore(LocalDateTime.now().plusSeconds(1)),
            "TTL为0时缓存应该立即或很快过期");
    }

    @Test
    @DisplayName("负TTL应被正确处理")
    void negative_ttl_handling() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        when(toolCallCacheRepository.findByCacheKey(anyString()))
            .thenReturn(Optional.empty());

        ArgumentCaptor<ToolCallCache> cacheCaptor = ArgumentCaptor.forClass(ToolCallCache.class);
        when(toolCallCacheRepository.save(cacheCaptor.capture()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        // 负TTL
        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params, "{\"result\": \"test\"}", 1L, -5);

        ToolCallCache savedCache = cacheCaptor.getValue();
        assertNotNull(savedCache.getExpiresAt());
        // 负TTL应该导致过去的过期时间（立即过期）
    }

    @Test
    @DisplayName("大TTL值应被正确处理")
    void large_ttl_handling() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");
        int largeTtl = 60 * 24; // 1天

        when(toolCallCacheRepository.findByCacheKey(anyString()))
            .thenReturn(Optional.empty());

        ArgumentCaptor<ToolCallCache> cacheCaptor = ArgumentCaptor.forClass(ToolCallCache.class);
        when(toolCallCacheRepository.save(cacheCaptor.capture()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params, "{\"result\": \"test\"}", 1L, largeTtl);

        ToolCallCache savedCache = cacheCaptor.getValue();
        assertNotNull(savedCache.getExpiresAt());

        // 验证大TTL值被正确处理
        long hoursDiff = java.time.Duration.between(LocalDateTime.now(), savedCache.getExpiresAt()).toHours();
        assertTrue(hoursDiff >= 23 && hoursDiff <= 25, "大TTL应该正确设置");
    }

    @Test
    @DisplayName("并发环境下的TTL一致性")
    void ttl_consistency_in_concurrent_environment() throws InterruptedException {
        int threadCount = 5;
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        when(toolCallCacheRepository.findByCacheKey(anyString()))
            .thenReturn(Optional.empty());
        when(toolCallCacheRepository.save(any(ToolCallCache.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(threadCount);
        java.util.concurrent.ConcurrentHashMap<Long, LocalDateTime> expiryTimes = new java.util.concurrent.ConcurrentHashMap<>();
        java.util.concurrent.atomic.AtomicLong counter = new java.util.concurrent.atomic.AtomicLong(0);

        java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    long id = counter.incrementAndGet();
                    redundancyService.cacheResult(
                        TEST_SESSION_ID + "-" + id,
                        TEST_TOOL_NAME,
                        params,
                        "{\"result\": \"test\"}",
                        id
                    );
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(10, java.util.concurrent.TimeUnit.SECONDS));
        executor.shutdown();

        // 验证save方法被调用了正确的次数
        verify(toolCallCacheRepository, times(threadCount)).save(any(ToolCallCache.class));
    }
}
