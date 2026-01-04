package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.IntentMatchResult;
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

        // 1. 识别意图 (使用带 LLM Fallback 的方法)
        IntentMatchResult matchResult = aiIntentService.recognizeIntentWithConfidence(
                request.getUserInput(), factoryId, 3);

        // 2. 检查是否需要二次确认（低置信度或有歧义）
        if (matchResult.hasMatch() && Boolean.TRUE.equals(matchResult.getRequiresConfirmation())
                && !Boolean.TRUE.equals(request.getForceExecute())) {
            AIIntentConfig matchedIntent = matchResult.getBestMatch();
            log.info("需要二次确认: intentCode={}, confidence={}, isStrongSignal={}",
                    matchedIntent.getIntentCode(), matchResult.getConfidence(), matchResult.getIsStrongSignal());

            // 构建候选意图列表供用户选择
            List<IntentExecuteResponse.SuggestedAction> candidateActions = buildCandidateActions(matchResult, factoryId);

            String clarificationMessage = matchResult.getClarificationQuestion();
            if (clarificationMessage == null || clarificationMessage.isEmpty()) {
                clarificationMessage = "您的请求可能匹配多个操作，请确认您想要执行的操作：";
            }

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(matchedIntent.getIntentCode())
                    .intentName(matchedIntent.getIntentName())
                    .intentCategory(matchedIntent.getIntentCategory())
                    .status("NEED_CLARIFICATION")
                    .message(clarificationMessage)
                    .confidence(matchResult.getConfidence())
                    .matchMethod(matchResult.getMatchMethod() != null ? matchResult.getMatchMethod().name() : null)
                    .suggestedActions(candidateActions)
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 3. 处理无匹配但有候选意图的情况（弱信号）
        if (!matchResult.hasMatch()) {
            // 检查是否有候选意图可供选择
            if (matchResult.getTopCandidates() != null && !matchResult.getTopCandidates().isEmpty()) {
                log.info("弱信号匹配，提供候选选择: userInput={}, candidateCount={}",
                        request.getUserInput(), matchResult.getTopCandidates().size());

                List<IntentExecuteResponse.SuggestedAction> candidateActions = buildCandidateActions(matchResult, factoryId);

                return IntentExecuteResponse.builder()
                        .intentRecognized(false)
                        .status("NEED_CLARIFICATION")
                        .message("我不太确定您想执行什么操作，请从以下选项中选择或更详细地描述您的需求：")
                        .suggestedActions(candidateActions)
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            log.info("未识别到意图 (规则+LLM均未匹配): userInput={}", request.getUserInput());
            // 即使没有候选意图，也返回 NEED_CLARIFICATION 状态，提供常用操作建议
            List<IntentExecuteResponse.SuggestedAction> defaultSuggestions = buildDefaultSuggestions(factoryId);
            return IntentExecuteResponse.builder()
                    .intentRecognized(false)
                    .status("NEED_CLARIFICATION")
                    .message("我没有理解您的意图，请从以下常用操作中选择，或更详细地描述您的需求：")
                    .executedAt(LocalDateTime.now())
                    .suggestedActions(defaultSuggestions)
                    .build();
        }

        AIIntentConfig intent = matchResult.getBestMatch();
        log.info("识别到意图: code={}, category={}, sensitivity={}, matchMethod={}, confidence={}",
                intent.getIntentCode(), intent.getIntentCategory(), intent.getSensitivityLevel(),
                matchResult.getMatchMethod(), matchResult.getConfidence());

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

    /**
     * 构建候选意图的建议操作列表
     */
    private List<IntentExecuteResponse.SuggestedAction> buildCandidateActions(
            IntentMatchResult matchResult, String factoryId) {

        List<IntentExecuteResponse.SuggestedAction> actions = new java.util.ArrayList<>();

        // 添加候选意图作为可选操作
        if (matchResult.getTopCandidates() != null) {
            for (IntentMatchResult.CandidateIntent candidate : matchResult.getTopCandidates()) {
                // 最多显示3个候选
                if (actions.size() >= 3) break;

                Map<String, Object> params = new HashMap<>();
                params.put("intentCode", candidate.getIntentCode());
                params.put("forceExecute", true);

                actions.add(IntentExecuteResponse.SuggestedAction.builder()
                        .actionCode("SELECT_INTENT")
                        .actionName(candidate.getIntentName())
                        .description(candidate.getDescription() != null ? candidate.getDescription() :
                                String.format("置信度: %.0f%%", candidate.getConfidence() * 100))
                        .endpoint("/api/mobile/" + factoryId + "/ai-intents/execute")
                        .parameters(params)
                        .build());
            }
        }

        // 添加重新描述选项
        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("REPHRASE")
                .actionName("重新描述")
                .description("请更详细地描述您想要执行的操作")
                .build());

        // 添加查看所有意图选项
        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("SHOW_INTENTS")
                .actionName("查看所有可用操作")
                .description("查看系统支持的所有意图类型")
                .endpoint("/api/mobile/" + factoryId + "/ai-intents")
                .build());

        return actions;
    }

    /**
     * 构建默认的常用操作建议列表
     * 当规则和LLM都无法识别意图时，提供常用操作供用户选择
     */
    private List<IntentExecuteResponse.SuggestedAction> buildDefaultSuggestions(String factoryId) {
        List<IntentExecuteResponse.SuggestedAction> actions = new java.util.ArrayList<>();

        // 常用查询操作
        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("MATERIAL_BATCH_QUERY")
                .actionName("查询原料库存")
                .description("查看原材料批次的库存情况")
                .endpoint("/api/mobile/" + factoryId + "/material-batches")
                .build());

        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("PROCESSING_BATCH_LIST")
                .actionName("查询生产批次")
                .description("查看当前的生产批次列表")
                .endpoint("/api/mobile/" + factoryId + "/processing/batches")
                .build());

        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("QUALITY_CHECK_LIST")
                .actionName("质检任务")
                .description("查看待处理的质检任务")
                .endpoint("/api/mobile/" + factoryId + "/quality-checks")
                .build());

        // 添加重新描述选项
        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("REPHRASE")
                .actionName("重新描述")
                .description("请更详细地描述您想要执行的操作")
                .build());

        // 添加查看所有意图选项
        actions.add(IntentExecuteResponse.SuggestedAction.builder()
                .actionCode("SHOW_INTENTS")
                .actionName("查看所有可用操作")
                .description("查看系统支持的所有意图类型")
                .endpoint("/api/mobile/" + factoryId + "/ai-intents")
                .build());

        return actions;
    }
}
