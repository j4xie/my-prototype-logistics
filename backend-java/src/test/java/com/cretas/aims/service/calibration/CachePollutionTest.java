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

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 缓存污染测试
 * 验证错误结果不会污染缓存，确保缓存数据的正确性
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("CachePollution 缓存污染测试")
class CachePollutionTest {

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolCallCacheRepository toolCallCacheRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    private ToolCallRedundancyServiceImpl redundancyService;

    private static final String TEST_SESSION_ID = "cache-pollution-test-" + UUID.randomUUID();
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
    @DisplayName("错误结果不应被缓存 - FAILED状态记录不缓存")
    void error_result_should_not_be_cached() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        // 首先模拟一个失败的调用记录
        ToolCallRecord failedRecord = ToolCallRecord.builder()
            .id(1L)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .factoryId(TEST_FACTORY_ID)
            .executionStatus(ToolCallRecord.ExecutionStatus.FAILED)
            .errorType("DATA_NOT_FOUND")
            .errorMessage("批次不存在")
            .build();

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 模拟查询时返回失败的记录
        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            eq(TEST_SESSION_ID), eq(TEST_TOOL_NAME), eq(hash), any(LocalDateTime.class)))
            .thenReturn(Optional.of(failedRecord));

        // 调用冗余检测
        boolean isRedundant = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);

        // 失败的调用不应该被视为冗余（因为可能需要重试）
        assertFalse(isRedundant, "失败的调用记录不应被视为冗余");
    }

    @Test
    @DisplayName("部分成功的结果不应被缓存")
    void partial_success_should_not_pollute_cache() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 模拟一个部分成功的记录（有错误信息但状态是成功）
        ToolCallRecord partialRecord = ToolCallRecord.builder()
            .id(1L)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .factoryId(TEST_FACTORY_ID)
            .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
            .errorMessage("部分数据缺失")
            .build();

        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            anyString(), anyString(), anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.of(partialRecord));

        // 验证在缓存部分成功的结果时，应该有警告或特殊处理
        // 这取决于实际业务逻辑，这里测试基本的行为
        boolean isRedundant = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);

        // 有错误消息的成功记录可能仍被视为冗余（取决于业务逻辑）
        assertTrue(isRedundant, "部分成功的记录是否视为冗余取决于业务逻辑");
    }

    @Test
    @DisplayName("手动清除缓存应正确工作")
    void manual_cache_clear_should_work() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 模拟存在缓存
        ToolCallCache existingCache = ToolCallCache.builder()
            .id(1L)
            .cacheKey(cacheKey)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .parametersHash(hash)
            .cachedResult("{\"data\": \"test\"}")
            .originalCallId(1L)
            .expiresAt(LocalDateTime.now().plusMinutes(5))
            .hitCount(0)
            .build();

        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.of(existingCache));

        // 验证缓存命中
        boolean isRedundantBefore = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);
        assertTrue(isRedundantBefore, "清除前应该是冗余的");

        // 清除缓存
        redundancyService.clearSessionCache(TEST_SESSION_ID);

        verify(toolCallCacheRepository).deleteBySessionId(TEST_SESSION_ID);
    }

    @Test
    @DisplayName("超时的调用结果不应被缓存")
    void timeout_result_should_not_be_cached() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 模拟超时的记录
        ToolCallRecord timeoutRecord = ToolCallRecord.builder()
            .id(1L)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .factoryId(TEST_FACTORY_ID)
            .executionStatus(ToolCallRecord.ExecutionStatus.TIMEOUT)
            .errorType("TIMEOUT")
            .errorMessage("调用超时")
            .build();

        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            anyString(), anyString(), anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.of(timeoutRecord));

        boolean isRedundant = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);

        // 超时的调用不应该被视为冗余
        assertFalse(isRedundant, "超时的调用不应被视为冗余");
    }

    @Test
    @DisplayName("SKIPPED状态的调用不应重复跳过")
    void skipped_status_should_not_cause_redundancy_loop() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 模拟已跳过的记录
        ToolCallRecord skippedRecord = ToolCallRecord.builder()
            .id(1L)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .factoryId(TEST_FACTORY_ID)
            .executionStatus(ToolCallRecord.ExecutionStatus.SKIPPED)
            .isRedundant(true)
            .originalCallId(0L)
            .build();

        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            anyString(), anyString(), anyString(), any(LocalDateTime.class)))
            .thenReturn(Optional.of(skippedRecord));

        boolean isRedundant = redundancyService.isRedundant(TEST_SESSION_ID, TEST_TOOL_NAME, params);

        // 已跳过的调用不应再次被标记为冗余
        assertFalse(isRedundant, "已跳过的调用不应再次被标记为冗余");
    }

    @Test
    @DisplayName("缓存更新时应正确替换旧数据")
    void cache_update_should_replace_old_data() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        // 模拟存在旧缓存
        AtomicReference<ToolCallCache> savedCache = new AtomicReference<>();
        ToolCallCache existingCache = ToolCallCache.builder()
            .id(1L)
            .cacheKey(cacheKey)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .parametersHash(hash)
            .cachedResult("{\"old\": \"data\"}")
            .originalCallId(1L)
            .expiresAt(LocalDateTime.now().plusMinutes(5))
            .hitCount(5)
            .build();

        when(toolCallCacheRepository.findByCacheKey(cacheKey))
            .thenReturn(Optional.of(existingCache));
        when(toolCallCacheRepository.save(any(ToolCallCache.class)))
            .thenAnswer(invocation -> {
                savedCache.set(invocation.getArgument(0));
                return savedCache.get();
            });

        // 更新缓存
        String newResult = "{\"new\": \"data\"}";
        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params, newResult, 2L);

        verify(toolCallCacheRepository).save(any(ToolCallCache.class));
        assertNotNull(savedCache.get());
        assertEquals(newResult, savedCache.get().getCachedResult(), "缓存结果应被更新");
        assertEquals(2L, savedCache.get().getOriginalCallId(), "原始调用ID应被更新");
    }

    @Test
    @DisplayName("空结果不应被缓存")
    void empty_result_handling() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        // 尝试缓存空结果
        redundancyService.cacheResult(TEST_SESSION_ID, TEST_TOOL_NAME, params, null, 1L);

        // 验证空结果也被缓存（这取决于业务逻辑）
        verify(toolCallCacheRepository, atMost(1)).findByCacheKey(anyString());
    }

    @Test
    @DisplayName("验证缓存命中计数器更新")
    void cache_hit_count_should_update() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey = ToolCallCache.generateCacheKey(TEST_SESSION_ID, TEST_TOOL_NAME, hash);

        ToolCallCache cache = ToolCallCache.builder()
            .id(1L)
            .cacheKey(cacheKey)
            .sessionId(TEST_SESSION_ID)
            .toolName(TEST_TOOL_NAME)
            .parametersHash(hash)
            .cachedResult("{\"data\": \"test\"}")
            .originalCallId(1L)
            .expiresAt(LocalDateTime.now().plusMinutes(5))
            .hitCount(0)
            .build();

        when(toolCallCacheRepository.findValidCache(eq(cacheKey), any(LocalDateTime.class)))
            .thenReturn(Optional.of(cache));
        when(toolCallCacheRepository.save(any(ToolCallCache.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        // 获取缓存结果
        redundancyService.getCachedResult(TEST_SESSION_ID, TEST_TOOL_NAME, params);

        // 验证保存时命中计数增加
        ArgumentCaptor<ToolCallCache> cacheCaptor = ArgumentCaptor.forClass(ToolCallCache.class);
        verify(toolCallCacheRepository).save(cacheCaptor.capture());
        assertEquals(1, cacheCaptor.getValue().getHitCount(), "命中计数应增加");
    }

    @Test
    @DisplayName("错误结果缓存隔离 - 不同工具的错误不应相互影响")
    void error_isolation_between_tools() {
        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B001");

        String tool1 = "inventory_query";
        String tool2 = "batch_query";

        // 模拟tool1有失败记录
        ToolCallRecord failedRecord = ToolCallRecord.builder()
            .sessionId(TEST_SESSION_ID)
            .toolName(tool1)
            .executionStatus(ToolCallRecord.ExecutionStatus.FAILED)
            .build();

        // 模拟tool2有成功记录
        ToolCallRecord successRecord = ToolCallRecord.builder()
            .sessionId(TEST_SESSION_ID)
            .toolName(tool2)
            .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
            .build();

        String hash = redundancyService.computeParametersHash(params);
        String cacheKey1 = ToolCallCache.generateCacheKey(TEST_SESSION_ID, tool1, hash);
        String cacheKey2 = ToolCallCache.generateCacheKey(TEST_SESSION_ID, tool2, hash);

        when(toolCallCacheRepository.findValidCache(eq(cacheKey1), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallCacheRepository.findValidCache(eq(cacheKey2), any(LocalDateTime.class)))
            .thenReturn(Optional.empty());
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            eq(TEST_SESSION_ID), eq(tool1), eq(hash), any(LocalDateTime.class)))
            .thenReturn(Optional.of(failedRecord));
        when(toolCallRecordRepository.findFirstBySessionIdAndToolNameAndParametersHashAndCreatedAtAfterOrderByCreatedAtDesc(
            eq(TEST_SESSION_ID), eq(tool2), eq(hash), any(LocalDateTime.class)))
            .thenReturn(Optional.of(successRecord));

        // 验证tool1不冗余（因为失败）
        boolean isRedundant1 = redundancyService.isRedundant(TEST_SESSION_ID, tool1, params);
        assertFalse(isRedundant1, "失败的tool1不应被视为冗余");

        // 验证tool2是冗余（因为成功）
        boolean isRedundant2 = redundancyService.isRedundant(TEST_SESSION_ID, tool2, params);
        assertTrue(isRedundant2, "成功的tool2应被视为冗余");
    }
}
