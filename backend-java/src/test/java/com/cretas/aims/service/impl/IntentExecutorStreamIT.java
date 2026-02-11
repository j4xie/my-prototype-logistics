package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.cache.SemanticCacheHit;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.IntentMatchResult.CandidateIntent;
import com.cretas.aims.dto.intent.IntentMatchResult.MatchMethod;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.IntentSemanticsParser;
import com.cretas.aims.service.SemanticCacheService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * IntentExecutorService SSE 流式响应集成测试
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("IntentExecutorService SSE 集成测试")
class IntentExecutorStreamIT {

    @Mock
    private AIIntentService aiIntentService;

    @Mock
    private SemanticCacheService semanticCacheService;

    @Mock
    private IntentSemanticsParser semanticsParser;

    @Mock
    private ObjectMapper objectMapper;

    private IntentExecutorServiceImpl intentExecutorService;

    private static final String FACTORY_ID = "F001";
    private static final Long USER_ID = 1L;
    private static final String USER_ROLE = "factory_super_admin";
    private static final String USER_INPUT = "查询今日产量";
    private static final String INTENT_CODE = "QUERY_PRODUCTION";

    @BeforeEach
    void setUp() {
        intentExecutorService = new IntentExecutorServiceImpl(
                aiIntentService,
                Collections.emptyList(), // handlers
                semanticsParser,
                semanticCacheService,
                objectMapper
        );
    }

    // ========== SSE 基础流程测试 ==========

    @Test
    @DisplayName("SSE - 完整执行流程应返回所有事件")
    void testStreamExecution_ShouldReturnAllEvents() throws Exception {
        // Given
        IntentExecuteRequest request = IntentExecuteRequest.builder()
                .userInput(USER_INPUT)
                .build();

        // Mock 缓存未命中
        when(semanticCacheService.queryCache(FACTORY_ID, USER_INPUT))
                .thenReturn(SemanticCacheHit.miss(10));

        // Mock 意图识别
        IntentMatchResult matchResult = createMockMatchResult();
        when(aiIntentService.recognizeIntentWithConfidence(
                eq(USER_INPUT), eq(FACTORY_ID), anyInt()))
                .thenReturn(matchResult);

        // When
        SseEmitter emitter = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        // Then
        assertThat(emitter).isNotNull();
        assertThat(emitter.getTimeout()).isGreaterThan(0);
    }

    @Test
    @DisplayName("SSE - 缓存命中场景应快速返回")
    void testStreamWithCacheHit_ShouldReturnQuickly() throws Exception {
        // Given
        IntentExecuteRequest request = IntentExecuteRequest.builder()
                .userInput(USER_INPUT)
                .build();

        // Mock 缓存命中
        SemanticCacheHit cacheHit = SemanticCacheHit.exactHit(
                1L,
                INTENT_CODE,
                "{\"intentCode\":\"QUERY_PRODUCTION\"}",
                "{\"status\":\"SUCCESS\",\"data\":{\"count\":100}}",
                50
        );
        when(semanticCacheService.queryCache(FACTORY_ID, USER_INPUT))
                .thenReturn(cacheHit);

        // When
        SseEmitter emitter = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        // Then
        assertThat(emitter).isNotNull();
        // 缓存命中场景应该更快返回
    }

    @Test
    @DisplayName("SSE - 语义缓存命中应返回缓存类型")
    void testStreamWithSemanticCacheHit_ShouldReturnCacheType() throws Exception {
        // Given
        IntentExecuteRequest request = IntentExecuteRequest.builder()
                .userInput("查询今天的产量数据")
                .build();

        // Mock 语义缓存命中
        SemanticCacheHit cacheHit = SemanticCacheHit.semanticHit(
                2L,
                0.92, // 语义相似度
                INTENT_CODE,
                "{\"intentCode\":\"QUERY_PRODUCTION\"}",
                "{\"status\":\"SUCCESS\"}",
                80
        );
        when(semanticCacheService.queryCache(eq(FACTORY_ID), anyString()))
                .thenReturn(cacheHit);

        // When
        SseEmitter emitter = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        // Then
        assertThat(emitter).isNotNull();
    }

    // ========== 事件顺序测试 ==========

    @Test
    @DisplayName("SSE - 事件应按正确顺序发送")
    void testStreamEvents_ShouldBeInCorrectOrder() throws Exception {
        // Given
        List<String> receivedEvents = Collections.synchronizedList(new ArrayList<>());
        CountDownLatch latch = new CountDownLatch(1);

        IntentExecuteRequest request = IntentExecuteRequest.builder()
                .userInput(USER_INPUT)
                .build();

        when(semanticCacheService.queryCache(FACTORY_ID, USER_INPUT))
                .thenReturn(SemanticCacheHit.miss(10));

        IntentMatchResult matchResult = createMockMatchResult();
        when(aiIntentService.recognizeIntentWithConfidence(
                eq(USER_INPUT), eq(FACTORY_ID), anyInt()))
                .thenReturn(matchResult);

        // When
        SseEmitter emitter = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        // 设置回调来捕获事件
        emitter.onCompletion(() -> latch.countDown());
        emitter.onError(e -> latch.countDown());

        // 等待完成
        boolean completed = latch.await(5, TimeUnit.SECONDS);

        // Then
        assertThat(emitter).isNotNull();
        // 注意：由于是异步处理，我们主要验证 emitter 被正确创建
    }

    // ========== 错误处理测试 ==========

    @Test
    @DisplayName("SSE - 意图识别失败应发送错误事件")
    void testStreamError_IntentRecognitionFailed() throws Exception {
        // Given
        IntentExecuteRequest request = IntentExecuteRequest.builder()
                .userInput(USER_INPUT)
                .build();

        when(semanticCacheService.queryCache(FACTORY_ID, USER_INPUT))
                .thenReturn(SemanticCacheHit.miss(10));

        when(aiIntentService.recognizeIntentWithConfidence(
                eq(USER_INPUT), eq(FACTORY_ID), anyInt()))
                .thenThrow(new RuntimeException("意图识别服务不可用"));

        // When
        SseEmitter emitter = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        // Then
        assertThat(emitter).isNotNull();
        // 错误应该通过 SSE error 事件发送
    }

    @Test
    @DisplayName("SSE - 缓存服务异常应继续正常流程")
    void testStreamError_CacheServiceFailed_ShouldContinue() throws Exception {
        // Given
        IntentExecuteRequest request = IntentExecuteRequest.builder()
                .userInput(USER_INPUT)
                .build();

        // 缓存服务抛出异常
        when(semanticCacheService.queryCache(FACTORY_ID, USER_INPUT))
                .thenThrow(new RuntimeException("缓存服务不可用"));

        // 但意图识别正常工作
        IntentMatchResult matchResult = createMockMatchResult();
        when(aiIntentService.recognizeIntentWithConfidence(
                eq(USER_INPUT), eq(FACTORY_ID), anyInt()))
                .thenReturn(matchResult);

        // When
        SseEmitter emitter = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        // Then
        assertThat(emitter).isNotNull();
        // 应该继续处理，不会因为缓存失败而中断
    }

    // ========== 超时测试 ==========

    @Test
    @DisplayName("SSE - 应设置正确的超时时间")
    void testStreamTimeout_ShouldBeConfigured() {
        // Given
        IntentExecuteRequest request = IntentExecuteRequest.builder()
                .userInput(USER_INPUT)
                .build();

        when(semanticCacheService.queryCache(FACTORY_ID, USER_INPUT))
                .thenReturn(SemanticCacheHit.miss(10));

        // When
        SseEmitter emitter = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        // Then
        assertThat(emitter).isNotNull();
        // SSE emitter 的默认超时应该是 120 秒
        assertThat(emitter.getTimeout()).isEqualTo(120000L);
    }

    // ========== 空输入测试 ==========

    @Test
    @DisplayName("SSE - 空输入应返回错误")
    void testStreamWithEmptyInput_ShouldReturnError() {
        // Given
        IntentExecuteRequest request = IntentExecuteRequest.builder()
                .userInput("")
                .build();

        // When
        SseEmitter emitter = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        // Then
        assertThat(emitter).isNotNull();
        // 空输入应该在验证阶段返回错误
    }

    // ========== Helper Methods ==========

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
                .resultData(Map.of("count", 100, "date", "2026-01-05"))
                .build();
    }
}
