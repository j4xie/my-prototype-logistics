package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.service.execution.IntentExecutionOrchestrator;
import com.cretas.aims.service.execution.MultiIntentExecutionService;
import com.cretas.aims.service.execution.SseStreamingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * IntentExecutorService SSE 流式响应集成测试
 *
 * 注: IntentExecutorServiceImpl 已重构为 facade,
 * SSE 流式逻辑全部委托给 SseStreamingService。原测试基于 inline impl 已过时;
 * 这版测试 verify facade delegation behavior.
 *
 * @author Cretas Team
 * @version 1.1.0
 * @since 2026-01-05
 * @since 2026-05-09 — refactored for facade pattern (SseStreamingService delegation)
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("IntentExecutorService SSE 集成测试")
class IntentExecutorStreamIT {

    @Mock
    private IntentExecutionOrchestrator orchestrator;

    @Mock
    private SseStreamingService sseStreamingService;

    @Mock
    private MultiIntentExecutionService multiIntentExecutionService;

    @InjectMocks
    private IntentExecutorServiceImpl intentExecutorService;

    private static final String FACTORY_ID = "F001";
    private static final Long USER_ID = 1L;
    private static final String USER_ROLE = "factory_super_admin";
    private static final String USER_INPUT = "查询今日产量";

    // ========== Facade Delegation Tests ==========
    //
    // IntentExecutorServiceImpl.executeStream() is a one-line delegate to
    // SseStreamingService. Each test verifies that the delegation passes
    // arguments through unchanged and returns the inner emitter.

    private IntentExecuteRequest buildRequest(String userInput) {
        return IntentExecuteRequest.builder().userInput(userInput).build();
    }

    @Test
    @DisplayName("SSE - 正常输入应委托给 SseStreamingService")
    void testStreamExecution_ShouldReturnAllEvents() {
        IntentExecuteRequest request = buildRequest(USER_INPUT);
        SseEmitter expected = new SseEmitter(120_000L);
        when(sseStreamingService.executeStream(FACTORY_ID, request, USER_ID, USER_ROLE))
                .thenReturn(expected);

        SseEmitter result = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        assertThat(result).isSameAs(expected);
        verify(sseStreamingService).executeStream(FACTORY_ID, request, USER_ID, USER_ROLE);
    }

    @Test
    @DisplayName("SSE - 缓存命中场景应通过 SseStreamingService 路径")
    void testStreamWithCacheHit_ShouldReturnQuickly() {
        IntentExecuteRequest request = buildRequest(USER_INPUT);
        SseEmitter expected = new SseEmitter();
        when(sseStreamingService.executeStream(FACTORY_ID, request, USER_ID, USER_ROLE))
                .thenReturn(expected);

        SseEmitter result = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        assertThat(result).isSameAs(expected);
    }

    @Test
    @DisplayName("SSE - 语义缓存命中场景委托不变")
    void testStreamWithSemanticCacheHit_ShouldReturnCacheType() {
        IntentExecuteRequest request = buildRequest("查询今天的产量数据");
        SseEmitter expected = new SseEmitter();
        when(sseStreamingService.executeStream(FACTORY_ID, request, USER_ID, USER_ROLE))
                .thenReturn(expected);

        SseEmitter result = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        assertThat(result).isSameAs(expected);
    }

    @Test
    @DisplayName("SSE - 事件顺序由 SseStreamingService 内部保证")
    void testStreamEvents_ShouldBeInCorrectOrder() {
        IntentExecuteRequest request = buildRequest(USER_INPUT);
        SseEmitter expected = new SseEmitter();
        when(sseStreamingService.executeStream(FACTORY_ID, request, USER_ID, USER_ROLE))
                .thenReturn(expected);

        SseEmitter result = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        assertThat(result).isSameAs(expected);
        verify(sseStreamingService).executeStream(FACTORY_ID, request, USER_ID, USER_ROLE);
    }

    @Test
    @DisplayName("SSE - 意图识别失败由 SseStreamingService 处理")
    void testStreamError_IntentRecognitionFailed() {
        IntentExecuteRequest request = buildRequest(USER_INPUT);
        SseEmitter expected = new SseEmitter();
        when(sseStreamingService.executeStream(FACTORY_ID, request, USER_ID, USER_ROLE))
                .thenReturn(expected);

        SseEmitter result = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        assertThat(result).isSameAs(expected);
    }

    @Test
    @DisplayName("SSE - 缓存服务异常由 SseStreamingService 处理")
    void testStreamError_CacheServiceFailed_ShouldContinue() {
        IntentExecuteRequest request = buildRequest(USER_INPUT);
        SseEmitter expected = new SseEmitter();
        when(sseStreamingService.executeStream(FACTORY_ID, request, USER_ID, USER_ROLE))
                .thenReturn(expected);

        SseEmitter result = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        assertThat(result).isSameAs(expected);
    }

    @Test
    @DisplayName("SSE - 超时由 SseStreamingService 配置, facade 不修改")
    void testStreamTimeout_ShouldBeConfigured() {
        IntentExecuteRequest request = buildRequest(USER_INPUT);
        SseEmitter expected = new SseEmitter(120_000L);
        when(sseStreamingService.executeStream(FACTORY_ID, request, USER_ID, USER_ROLE))
                .thenReturn(expected);

        SseEmitter result = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        assertThat(result).isSameAs(expected);
        assertThat(result.getTimeout()).isEqualTo(120_000L);
    }

    @Test
    @DisplayName("SSE - 空输入也委托给 SseStreamingService（验证由它执行）")
    void testStreamWithEmptyInput_ShouldReturnError() {
        IntentExecuteRequest request = buildRequest("");
        SseEmitter expected = new SseEmitter();
        when(sseStreamingService.executeStream(FACTORY_ID, request, USER_ID, USER_ROLE))
                .thenReturn(expected);

        SseEmitter result = intentExecutorService.executeStream(
                FACTORY_ID, request, USER_ID, USER_ROLE);

        assertThat(result).isSameAs(expected);
    }
}
