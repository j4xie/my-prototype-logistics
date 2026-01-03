package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.IntentExecutorService;
import com.cretas.aims.service.handler.IntentHandler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * AI意图执行服务实现
 *
 * 负责编排意图识别、权限校验和处理器路由
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@Service
public class IntentExecutorServiceImpl implements IntentExecutorService {

    private final AIIntentService aiIntentService;
    private final List<IntentHandler> handlers;

    // 处理器映射表: category -> handler
    private final Map<String, IntentHandler> handlerMap = new HashMap<>();

    @Autowired
    public IntentExecutorServiceImpl(AIIntentService aiIntentService,
                                     List<IntentHandler> handlers) {
        this.aiIntentService = aiIntentService;
        this.handlers = handlers;
    }

    @PostConstruct
    public void init() {
        // 初始化处理器映射
        for (IntentHandler handler : handlers) {
            String category = handler.getSupportedCategory();
            handlerMap.put(category, handler);
            log.info("注册意图处理器: category={}, handler={}", category, handler.getClass().getSimpleName());
        }
        log.info("意图执行器初始化完成，共注册 {} 个处理器", handlerMap.size());
    }

    @Override
    public IntentExecuteResponse execute(String factoryId, IntentExecuteRequest request,
                                         Long userId, String userRole) {

        log.info("执行意图: factoryId={}, userInput={}, userId={}, role={}",
                factoryId,
                request.getUserInput().length() > 50 ?
                        request.getUserInput().substring(0, 50) + "..." : request.getUserInput(),
                userId, userRole);

        // 1. 识别意图
        Optional<AIIntentConfig> intentOpt = aiIntentService.recognizeIntent(request.getUserInput());

        if (intentOpt.isEmpty()) {
            log.info("未识别到意图: userInput={}", request.getUserInput());
            return IntentExecuteResponse.builder()
                    .intentRecognized(false)
                    .status("NOT_RECOGNIZED")
                    .message("未能识别您的意图，请尝试更具体的描述。例如：'给原材料表单添加一个温度字段'")
                    .executedAt(LocalDateTime.now())
                    .suggestedActions(List.of(
                            IntentExecuteResponse.SuggestedAction.builder()
                                    .actionCode("SHOW_INTENTS")
                                    .actionName("查看支持的意图")
                                    .description("查看系统支持的所有意图类型")
                                    .endpoint("/api/mobile/" + factoryId + "/ai-intents")
                                    .build()
                    ))
                    .build();
        }

        AIIntentConfig intent = intentOpt.get();
        log.info("识别到意图: code={}, category={}, sensitivity={}",
                intent.getIntentCode(), intent.getIntentCategory(), intent.getSensitivityLevel());

        // 2. 权限检查
        if (!aiIntentService.hasPermission(intent.getIntentCode(), userRole)) {
            log.warn("权限不足: intentCode={}, userRole={}", intent.getIntentCode(), userRole);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .sensitivityLevel(intent.getSensitivityLevel())
                    .status("NO_PERMISSION")
                    .message("您没有权限执行此操作。需要角色: " + intent.getRequiredRoles())
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 3. 审批检查
        if (intent.needsApproval() && !Boolean.TRUE.equals(request.getForceExecute())) {
            log.info("需要审批: intentCode={}", intent.getIntentCode());
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(intent.getIntentCategory())
                    .sensitivityLevel(intent.getSensitivityLevel())
                    .status("PENDING_APPROVAL")
                    .message("此操作需要审批，已提交审批请求")
                    .requiresApproval(true)
                    .approvalChainId(intent.getApprovalChainId())
                    // TODO: 创建审批请求并返回ID
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 4. 路由到处理器
        String category = intent.getIntentCategory();
        IntentHandler handler = handlerMap.get(category);

        if (handler == null) {
            log.warn("未找到处理器: category={}", category);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intent.getIntentCode())
                    .intentName(intent.getIntentName())
                    .intentCategory(category)
                    .status("FAILED")
                    .message("暂不支持此类型的意图执行: " + category)
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 5. 预览模式
        if (Boolean.TRUE.equals(request.getPreviewOnly())) {
            return handler.preview(factoryId, request, intent, userId, userRole);
        }

        // 6. 执行
        return handler.handle(factoryId, request, intent, userId, userRole);
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         Long userId, String userRole) {
        // 强制设置预览模式
        request.setPreviewOnly(true);
        return execute(factoryId, request, userId, userRole);
    }

    @Override
    public IntentExecuteResponse confirm(String factoryId, String confirmToken,
                                         Long userId, String userRole) {
        // TODO: 从缓存中获取预览数据，执行确认操作
        log.info("确认执行: factoryId={}, confirmToken={}", factoryId, confirmToken);

        return IntentExecuteResponse.builder()
                .status("FAILED")
                .message("确认功能暂未实现，请直接执行")
                .executedAt(LocalDateTime.now())
                .build();
    }
}
