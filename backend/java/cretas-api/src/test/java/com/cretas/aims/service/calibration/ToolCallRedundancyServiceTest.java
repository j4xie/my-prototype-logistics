package com.cretas.aims.service.calibration;

import com.cretas.aims.entity.calibration.ToolCallCache;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.repository.calibration.ToolCallCacheRepository;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.service.calibration.impl.ToolCallRedundancyServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 工具调用冗余检测服务单元测试
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ToolCallRedundancyService 单元测试")
class ToolCallRedundancyServiceTest {

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolCallCacheRepository toolCallCacheRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    private ToolCallRedundancyServiceImpl redundancyService;

    private static final String TEST_SESSION_ID = "test-session-123";
    private static final String TEST_TOOL_NAME = "inventory_query";
    private static final String TEST_FACTORY_ID = "F001";

    @BeforeEach
    void setUp() {
        // 手动创建服务实例，避免 Mockito @Spy 兼容性问题
        redundancyService = new ToolCallRedundancyServiceImpl(
            toolCallRecordRepository,
            toolCallCacheRepository,
            objectMapper
        );
    }

    @Test
    @DisplayName("参数哈希计算 - 相同参数应生成相同哈希")
    void computeParametersHash_SameParameters_ShouldReturnSameHash() {
        Map<String, Object> params1 = new HashMap<>();
        params1.put("batchId", "B001");
        params1.put("date", "2026-01-18");

        Map<String, Object> params2 = new HashMap<>();
        params2.put("date", "2026-01-18");  // 不同顺序
        params2.put("batchId", "B001");

        String hash1 = redundancyService.computeParametersHash(params1);
        String hash2 = redundancyService.computeParametersHash(params2);

        assertEquals(hash1, hash2, "相同参数不同顺序应生成相同哈希");
        assertNotNull(hash1);
        assertEquals(64, hash1.length(), "SHA-256哈希应为64字符");
    }

    @Test
    @DisplayName("参数哈希计算 - 不同参数应生成不同哈希")
    void computeParametersHash_DifferentParameters_ShouldReturnDifferentHash() {
        Map<String, Object> params1 = new HashMap<>();
        params1.put("batchId", "B001");

        Map<String, Object> params2 = new HashMap<>();
        params2.put("batchId", "B002");

        String hash1 = redundancyService.computeParametersHash(params1);
        String hash2 = redundancyService.computeParametersHash(params2);

        assertNotEquals(hash1, hash2, "不同参数应生成不同哈希");
    }

    @Test
    @DisplayName("参数哈希计算 - 空参数应返回固定哈希")
    void computeParametersHash_EmptyParameters_ShouldReturnConsistentHash() {
        String hash1 = redundancyService.computeParametersHash(null);
        String hash2 = redundancyService.computeParametersHash(new HashMap<>());

        assertEquals(hash1, hash2, "null和空Map应生成相同哈希");
        assertNotNull(hash1);
    }

    @Test
    @DisplayName("冗余检测 - 缓存命中应返回true")
    void isRedundant_CacheHit_ShouldReturnTrue() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        ToolCallCache cachedEntry = ToolCallCache.builder()
            .cacheKey(cacheKey)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .parametersHash(hash)
            .originalCallId(1L)
            .expiresAt(LocalDateTime.now().plusMinutes(5))
            .cachedResult("{\"success\": true}")
            .build();

        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.of(cachedEntry));

        boolean result = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);

        assertTrue(result, "缓存命中时应返回冗余");
        verify(toolCallCacheRepository).findValidCache(eq(cacheKey), any(LocalDateTime.class));
    }

    @Test
    @DisplayName("冗余检测 - 无缓存且无历史记录应返回false")
    void isRedundant_NoCacheNoHistory_ShouldReturnFalse() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            eq(TEST_SESSION_ID), eq(TEST_TOOL_NAME), eq(hash), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());

        boolean result = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);

        assertFalse(result, "无缓存无历史时应返回非冗余");
    }

    @Test
    @DisplayName("记录工具调用 - 应正确保存记录")
    void recordToolCall_ShouldSaveRecord() {
        ToolCallRecord record = ToolCallRecord.builder()
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .factoryId(TEST_FACTORY_ID)
            .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
            .build();

        when(toolCallRecordRepository.save(any(ToolCallRecord.class))).thenReturn(record);

        redundancyService.recordToolCall(record);

        verify(toolCallRecordRepository).save(record);
    }

    @Test
    @DisplayName("缓存结果 - 应正确创建缓存条目")
    void cacheResult_ShouldCreateCacheEntry() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");
        String result = "{\"data\": \"test\"}";
        Long originalCallId = 1L;

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // Mock findByCacheKey to return empty (no existing cache)
        when(toolCallCacheRepository.findByCacheKey(cacheKey))
            .thenReturn(Optional.empty());
        when(toolCallCacheRepository.save(any(ToolCallCache.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params, result, originalCallId);

        verify(toolCallCacheRepository).save(argThat(cache ->
            cache.getSessionId().equals(TEST_SESSION_ID) &&
            cache.getToolName().equals(TEST_TOOL_NAME) &&
            cache.getOriginalCallId().equals(originalCallId) &&
            cache.getCachedResult().equals(result) &&
            cache.getExpiresAt() != null
        ));
    }

    @Test
    @DisplayName("获取缓存结果 - 缓存存在应返回结果")
    void getCachedResult_CacheExists_ShouldReturnResult() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");
        String expectedResult = "{\"success\": true}";

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        ToolCallCache cachedEntry = ToolCallCache.builder()
            .cacheKey(cacheKey)
            .cachedResult(expectedResult)
            .expiresAt(LocalDateTime.now().plusMinutes(5))
            .hitCount(0)
            .build();

        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.of(cachedEntry));

        Optional<String> result = redundancyService.getCachedResult(TEST_SESSION_ID, TEST_TOOL_NAME, params);

        assertTrue(result.isPresent());
        assertEquals(expectedResult, result.get());
    }

    @Test
    @DisplayName("清除会话缓存 - 应删除所有会话缓存")
    void clearSessionCache_ShouldDeleteAllSessionCache() {
        redundancyService.clearSessionCache(TEST_SESSION_ID);

        verify(toolCallCacheRepository).deleteBySessionId(TEST_SESSION_ID);
    }

    @Test
    @DisplayName("标记为冗余 - 应更新记录状态")
    void markAsRedundant_ShouldUpdateRecordStatus() {
        Long recordId = 1L;
        Long originalCallId = 2L;
        String reason = "相同参数在5分钟内已执行";

        ToolCallRecord record = ToolCallRecord.builder()
            .id(recordId)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
            .build();

        when(toolCallRecordRepository.findById(recordId)).thenReturn(Optional.of(record));
        when(toolCallRecordRepository.save(any(ToolCallRecord.class))).thenReturn(record);

        redundancyService.markAsRedundant(recordId, originalCallId, reason);

        verify(toolCallRecordRepository).save(argThat(r ->
            r.getIsRedundant() &&
            r.getOriginalCallId().equals(originalCallId) &&
            r.getRedundantReason().equals(reason) &&
            r.getExecutionStatus() == ToolCallRecord.ExecutionStatus.SKIPPED
        ));
    }
}
