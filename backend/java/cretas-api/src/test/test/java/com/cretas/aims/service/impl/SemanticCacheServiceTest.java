package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.cache.SemanticCacheHit;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.IntentMatchResult.CandidateIntent;
import com.cretas.aims.dto.intent.IntentMatchResult.MatchMethod;
import com.cretas.aims.entity.cache.SemanticCache;
import com.cretas.aims.entity.cache.SemanticCacheConfig;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.SemanticCacheConfigRepository;
import com.cretas.aims.repository.SemanticCacheRepository;
import com.cretas.aims.service.EmbeddingClient;
import com.cretas.aims.service.SemanticCacheService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 语义缓存服务单元测试
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SemanticCacheService 单元测试")
class SemanticCacheServiceTest {

    @Mock
    private SemanticCacheRepository cacheRepository;

    @Mock
    private SemanticCacheConfigRepository configRepository;

    @Mock
    private EmbeddingClient embeddingClient;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private SemanticCacheServiceImpl semanticCacheService;

    private static final String FACTORY_ID = "F001";
    private static final String USER_INPUT = "查询今日产量";
    private static final String NORMALIZED_INPUT = "查询今日产量";
    private static final String INTENT_CODE = "QUERY_PRODUCTION";

    private SemanticCacheConfig defaultConfig;
    private SemanticCache testCache;

    @BeforeEach
    void setUp() {
        // 设置默认配置
        defaultConfig = new SemanticCacheConfig();
        defaultConfig.setFactoryId(FACTORY_ID);
        defaultConfig.setEnabled(true);
        defaultConfig.setSimilarityThreshold(new BigDecimal("0.85"));
        defaultConfig.setCacheTtlHours(24);
        defaultConfig.setMaxCacheEntries(10000);

        // 设置测试缓存条目
        testCache = SemanticCache.builder()
                .id(1L)
                .factoryId(FACTORY_ID)
                .normalizedInput(NORMALIZED_INPUT)
                .originalInput(USER_INPUT)
                .inputHash("abc123hash")
                .intentCode(INTENT_CODE)
                .intentResult("{\"intentCode\":\"QUERY_PRODUCTION\"}")
                .executionResult("{\"status\":\"SUCCESS\"}")
                .confidence(new BigDecimal("0.95"))
                .hitCount(0)
                .expiresAt(LocalDateTime.now().plusHours(24))
                .build();
    }

    // ========== 精确匹配测试 ==========

    @Test
    @DisplayName("精确匹配 - 相同输入应命中缓存")
    void testExactMatch_SameInput_ShouldHitCache() {
        // Given
        when(configRepository.findByFactoryId(FACTORY_ID))
                .thenReturn(Optional.of(defaultConfig));
        when(cacheRepository.findByFactoryIdAndInputHashAndExpiresAtAfter(
                eq(FACTORY_ID), anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.of(testCache));

        // When
        SemanticCacheHit result = semanticCacheService.queryCache(FACTORY_ID, USER_INPUT);

        // Then
        assertThat(result.isHit()).isTrue();
        assertThat(result.isExactMatch()).isTrue();
        assertThat(result.getSimilarity()).isEqualTo(1.0);
        assertThat(result.getIntentCode()).isEqualTo(INTENT_CODE);
        assertThat(result.getLatencyMs()).isNotNull();
    }

    @Test
    @DisplayName("精确匹配 - 命中后应更新命中计数")
    void testExactMatch_ShouldIncrementHitCount() {
        // Given
        when(configRepository.findByFactoryId(FACTORY_ID))
                .thenReturn(Optional.of(defaultConfig));
        when(cacheRepository.findByFactoryIdAndInputHashAndExpiresAtAfter(
                eq(FACTORY_ID), anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.of(testCache));

        // When
        semanticCacheService.queryCache(FACTORY_ID, USER_INPUT);

        // Then
        verify(cacheRepository).save(argThat(cache ->
                cache.getHitCount() == 1 &&
                cache.getLastHitAt() != null
        ));
    }

    @Test
    @DisplayName("精确匹配 - 过期条目不应命中")
    void testExactMatch_ExpiredEntry_ShouldNotHit() {
        // Given
        when(configRepository.findByFactoryId(FACTORY_ID))
                .thenReturn(Optional.of(defaultConfig));
        when(cacheRepository.findByFactoryIdAndInputHashAndExpiresAtAfter(
                eq(FACTORY_ID), anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
        when(embeddingClient.isAvailable()).thenReturn(false);

        // When
        SemanticCacheHit result = semanticCacheService.queryCache(FACTORY_ID, USER_INPUT);

        // Then
        assertThat(result.isHit()).isFalse();
        assertThat(result.getHitType()).isEqualTo(SemanticCacheHit.HitType.MISS);
    }

    // ========== 语义匹配测试 ==========

    @Test
    @DisplayName("语义匹配 - 高相似度输入应命中缓存")
    void testSemanticMatch_HighSimilarity_ShouldHitCache() {
        // Given
        float[] queryEmbedding = {0.1f, 0.2f, 0.3f, 0.4f};
        float[] cacheEmbedding = {0.1f, 0.2f, 0.3f, 0.4f}; // 完全相同，相似度=1.0

        testCache.setEmbeddingVector(serializeEmbedding(cacheEmbedding));

        when(configRepository.findByFactoryId(FACTORY_ID))
                .thenReturn(Optional.of(defaultConfig));
        when(cacheRepository.findByFactoryIdAndInputHashAndExpiresAtAfter(
                eq(FACTORY_ID), anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty()); // 精确匹配未命中
        when(embeddingClient.isAvailable()).thenReturn(true);
        when(embeddingClient.encode(anyString())).thenReturn(queryEmbedding);
        when(cacheRepository.findValidCachesByFactoryId(eq(FACTORY_ID), any(LocalDateTime.class)))
                .thenReturn(Collections.singletonList(testCache));

        // When
        SemanticCacheHit result = semanticCacheService.queryCache(FACTORY_ID, "查询今天产量");

        // Then
        assertThat(result.isHit()).isTrue();
        assertThat(result.isSemanticMatch()).isTrue();
        assertThat(result.getSimilarity()).isGreaterThanOrEqualTo(0.85);
    }

    @Test
    @DisplayName("语义匹配 - 低相似度输入不应命中")
    void testSemanticMatch_LowSimilarity_ShouldNotHit() {
        // Given
        float[] queryEmbedding = {0.1f, 0.2f, 0.3f, 0.4f};
        float[] cacheEmbedding = {-0.5f, -0.6f, -0.7f, -0.8f}; // 完全不同

        testCache.setEmbeddingVector(serializeEmbedding(cacheEmbedding));

        when(configRepository.findByFactoryId(FACTORY_ID))
                .thenReturn(Optional.of(defaultConfig));
        when(cacheRepository.findByFactoryIdAndInputHashAndExpiresAtAfter(
                eq(FACTORY_ID), anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
        when(embeddingClient.isAvailable()).thenReturn(true);
        when(embeddingClient.encode(anyString())).thenReturn(queryEmbedding);
        when(cacheRepository.findValidCachesByFactoryId(eq(FACTORY_ID), any(LocalDateTime.class)))
                .thenReturn(Collections.singletonList(testCache));

        // When
        SemanticCacheHit result = semanticCacheService.queryCache(FACTORY_ID, "完全不相关的输入");

        // Then
        assertThat(result.isHit()).isFalse();
    }

    @Test
    @DisplayName("语义匹配 - Embedding 服务不可用时跳过")
    void testSemanticMatch_EmbeddingUnavailable_ShouldSkip() {
        // Given
        when(configRepository.findByFactoryId(FACTORY_ID))
                .thenReturn(Optional.of(defaultConfig));
        when(cacheRepository.findByFactoryIdAndInputHashAndExpiresAtAfter(
                eq(FACTORY_ID), anyString(), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
        when(embeddingClient.isAvailable()).thenReturn(false);

        // When
        SemanticCacheHit result = semanticCacheService.queryCache(FACTORY_ID, USER_INPUT);

        // Then
        assertThat(result.isHit()).isFalse();
        verify(embeddingClient, never()).encode(anyString());
    }

    // ========== 缓存存储测试 ==========

    @Test
    @DisplayName("缓存结果 - 应正确存储意图结果和执行结果")
    void testCacheResult_ShouldStoreCorrectly() throws Exception {
        // Given
        IntentMatchResult matchResult = createMockMatchResult();
        IntentExecuteResponse executeResponse = createMockExecuteResponse();

        when(configRepository.findByFactoryId(FACTORY_ID))
                .thenReturn(Optional.of(defaultConfig));
        when(cacheRepository.findByFactoryIdAndInputHash(eq(FACTORY_ID), anyString()))
                .thenReturn(Optional.empty());
        when(embeddingClient.isAvailable()).thenReturn(true);
        when(embeddingClient.encode(anyString()))
                .thenReturn(new float[]{0.1f, 0.2f, 0.3f, 0.4f});
        when(objectMapper.writeValueAsString(any()))
                .thenReturn("{\"mock\":\"json\"}");

        // When
        semanticCacheService.cacheResult(FACTORY_ID, USER_INPUT, matchResult, executeResponse);

        // Then
        ArgumentCaptor<SemanticCache> cacheCaptor = ArgumentCaptor.forClass(SemanticCache.class);
        verify(cacheRepository).save(cacheCaptor.capture());

        SemanticCache savedCache = cacheCaptor.getValue();
        assertThat(savedCache.getFactoryId()).isEqualTo(FACTORY_ID);
        assertThat(savedCache.getOriginalInput()).isEqualTo(USER_INPUT);
        assertThat(savedCache.getIntentCode()).isEqualTo(INTENT_CODE);
        assertThat(savedCache.getEmbeddingVector()).isNotNull();
        assertThat(savedCache.getExpiresAt()).isAfter(LocalDateTime.now());
    }

    @Test
    @DisplayName("缓存结果 - 已存在时应更新而非创建")
    void testCacheResult_ExistingEntry_ShouldUpdate() throws Exception {
        // Given
        IntentMatchResult matchResult = createMockMatchResult();
        IntentExecuteResponse executeResponse = createMockExecuteResponse();

        when(configRepository.findByFactoryId(FACTORY_ID))
                .thenReturn(Optional.of(defaultConfig));
        when(cacheRepository.findByFactoryIdAndInputHash(eq(FACTORY_ID), anyString()))
                .thenReturn(Optional.of(testCache));
        when(objectMapper.writeValueAsString(any()))
                .thenReturn("{\"updated\":\"json\"}");

        // When
        semanticCacheService.cacheResult(FACTORY_ID, USER_INPUT, matchResult, executeResponse);

        // Then
        verify(cacheRepository, times(1)).save(testCache);
        assertThat(testCache.getIntentResult()).isEqualTo("{\"updated\":\"json\"}");
    }

    // ========== 缓存失效测试 ==========

    @Test
    @DisplayName("按意图代码失效 - 应删除匹配的缓存条目")
    void testInvalidateByIntentCode_ShouldDeleteMatchingEntries() {
        // Given
        when(cacheRepository.deleteByFactoryIdAndIntentCode(FACTORY_ID, INTENT_CODE))
                .thenReturn(5);

        // When
        int count = semanticCacheService.invalidateByIntentCode(FACTORY_ID, INTENT_CODE);

        // Then
        assertThat(count).isEqualTo(5);
        verify(cacheRepository).deleteByFactoryIdAndIntentCode(FACTORY_ID, INTENT_CODE);
    }

    @Test
    @DisplayName("按工厂失效 - 应删除所有工厂缓存")
    void testInvalidateByFactory_ShouldDeleteAllFactoryCaches() {
        // Given
        when(cacheRepository.deleteByFactoryId(FACTORY_ID))
                .thenReturn(100);

        // When
        int count = semanticCacheService.invalidateByFactory(FACTORY_ID);

        // Then
        assertThat(count).isEqualTo(100);
        verify(cacheRepository).deleteByFactoryId(FACTORY_ID);
    }

    // ========== 配置测试 ==========

    @Test
    @DisplayName("缓存禁用时 - 应直接返回未命中")
    void testCacheDisabled_ShouldReturnMiss() {
        // Given
        defaultConfig.setEnabled(false);
        when(configRepository.findByFactoryId(FACTORY_ID))
                .thenReturn(Optional.of(defaultConfig));

        // When
        SemanticCacheHit result = semanticCacheService.queryCache(FACTORY_ID, USER_INPUT);

        // Then
        assertThat(result.isHit()).isFalse();
        verify(cacheRepository, never()).findByFactoryIdAndInputHashAndExpiresAtAfter(
                any(), any(), any());
    }

    @Test
    @DisplayName("无配置时 - 应使用默认配置")
    void testNoConfig_ShouldUseDefault() {
        // Given
        when(configRepository.findByFactoryId(FACTORY_ID))
                .thenReturn(Optional.empty());
        when(configRepository.findGlobalConfig())
                .thenReturn(Optional.empty());

        // When
        SemanticCacheConfig config = semanticCacheService.getConfig(FACTORY_ID);

        // Then
        assertThat(config).isNotNull();
        assertThat(config.isEnabled()).isTrue();
        assertThat(config.getSimilarityThresholdAsDouble()).isEqualTo(0.85);
    }

    // ========== 统计测试 ==========

    @Test
    @DisplayName("获取统计 - 应返回正确的缓存统计信息")
    void testGetStats_ShouldReturnCorrectStats() {
        // Given
        when(cacheRepository.countByFactoryId(FACTORY_ID)).thenReturn(100L);
        when(cacheRepository.countValidByFactoryId(eq(FACTORY_ID), any(LocalDateTime.class)))
                .thenReturn(80L);

        // When
        SemanticCacheService.CacheStats stats = semanticCacheService.getStats(FACTORY_ID);

        // Then
        assertThat(stats.getTotalEntries()).isEqualTo(100);
        assertThat(stats.getValidEntries()).isEqualTo(80);
    }

    // ========== Helper Methods ==========

    private byte[] serializeEmbedding(float[] embedding) {
        java.nio.ByteBuffer buffer = java.nio.ByteBuffer.allocate(embedding.length * 4);
        buffer.order(java.nio.ByteOrder.LITTLE_ENDIAN);
        for (float f : embedding) {
            buffer.putFloat(f);
        }
        return buffer.array();
    }

    private IntentMatchResult createMockMatchResult() {
        AIIntentConfig bestMatch = new AIIntentConfig();
        bestMatch.setIntentCode(INTENT_CODE);
        bestMatch.setIntentName("查询产量");
        bestMatch.setIntentCategory("QUERY");

        CandidateIntent candidate = CandidateIntent.builder()
                .intentCode(INTENT_CODE)
                .intentName("查询产量")
                .confidence(0.95)
                .matchMethod(MatchMethod.KEYWORD)
                .build();

        return IntentMatchResult.builder()
                .bestMatch(bestMatch)
                .confidence(0.95)
                .matchMethod(MatchMethod.KEYWORD)
                .topCandidates(Collections.singletonList(candidate))
                .isStrongSignal(true)
                .requiresConfirmation(false)
                .build();
    }

    private IntentExecuteResponse createMockExecuteResponse() {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .status("COMPLETED")
                .message("查询成功")
                .intentCode(INTENT_CODE)
                .build();
    }
}
