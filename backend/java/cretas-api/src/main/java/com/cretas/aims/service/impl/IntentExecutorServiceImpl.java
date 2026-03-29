package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.service.IntentExecutorService;
import com.cretas.aims.service.execution.IntentExecutionOrchestrator;
import com.cretas.aims.service.execution.MultiIntentExecutionService;
import com.cretas.aims.service.execution.SseStreamingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * AI意图执行服务实现 — Facade
 *
 * 保持 {@link IntentExecutorService} 接口完全不变，
 * 将实际工作委托给 5 个专注子服务：
 * <ul>
 *   <li>{@link IntentExecutionOrchestrator} — 核心 execute() 路由</li>
 *   <li>{@link com.cretas.aims.service.execution.ToolDispatchService} — 直接 Tool 执行</li>
 *   <li>{@link com.cretas.aims.service.execution.DynamicToolSelectionService} — 动态 Tool 选择 + Skill 路由</li>
 *   <li>{@link SseStreamingService} — SSE 流式执行</li>
 *   <li>{@link MultiIntentExecutionService} — 多意图拆分/合并</li>
 * </ul>
 *
 * @author Cretas Team
 * @since 2026-01-02
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IntentExecutorServiceImpl implements IntentExecutorService {

    private final IntentExecutionOrchestrator orchestrator;
    private final SseStreamingService sseStreamingService;
    private final MultiIntentExecutionService multiIntentExecutionService;

    @Override
    public IntentExecuteResponse execute(String factoryId, IntentExecuteRequest request,
                                         Long userId, String userRole) {
        return orchestrator.execute(factoryId, request, userId, userRole);
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         Long userId, String userRole) {
        request.setPreviewOnly(true);
        return orchestrator.execute(factoryId, request, userId, userRole);
    }

    @Override
    public IntentExecuteResponse confirm(String factoryId, String confirmToken,
                                         Long userId, String userRole) {
        return orchestrator.confirm(factoryId, confirmToken, userId, userRole);
    }

    @Override
    public SseEmitter executeStream(String factoryId, IntentExecuteRequest request,
                                     Long userId, String userRole) {
        return sseStreamingService.executeStream(factoryId, request, userId, userRole);
    }

    @Override
    public IntentExecuteResponse executeMultiIntent(String factoryId, IntentExecuteRequest request,
                                                     Long userId, String userRole) {
        return multiIntentExecutionService.executeMultiIntent(factoryId, request, userId, userRole);
    }
}
