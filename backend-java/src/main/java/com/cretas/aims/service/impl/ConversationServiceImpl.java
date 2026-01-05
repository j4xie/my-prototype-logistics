package com.cretas.aims.service.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.conversation.ConversationSession;
import com.cretas.aims.entity.conversation.ConversationSession.CandidateIntent;
import com.cretas.aims.entity.conversation.ConversationSession.SessionStatus;
import com.cretas.aims.entity.learning.LearnedExpression;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.repository.conversation.ConversationSessionRepository;
import com.cretas.aims.service.ConversationService;
import com.cretas.aims.service.ExpressionLearningService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 多轮对话服务实现
 *
 * 实现 Layer 5 的多轮对话流程:
 * 1. 当 Layer 1-4 置信度 < 30% 时触发
 * 2. 最多进行 5 轮对话
 * 3. 每轮生成澄清问题或确认结果
 * 4. 成功后学习表达和关键词
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@Slf4j
@Service
public class ConversationServiceImpl implements ConversationService {

    private final ConversationSessionRepository sessionRepository;
    private final AIIntentConfigRepository intentConfigRepository;
    private final ExpressionLearningService learningService;
    private final DashScopeClient dashScopeClient;
    private final ObjectMapper objectMapper;

    @Value("${cretas.ai.conversation.max-rounds:5}")
    private int maxRounds;

    @Value("${cretas.ai.conversation.timeout-minutes:10}")
    private int timeoutMinutes;

    @Value("${cretas.ai.conversation.confidence-threshold:0.7}")
    private double confidenceThreshold;

    @Autowired
    public ConversationServiceImpl(
            ConversationSessionRepository sessionRepository,
            AIIntentConfigRepository intentConfigRepository,
            @Autowired(required = false) ExpressionLearningService learningService,
            @Autowired(required = false) DashScopeClient dashScopeClient) {
        this.sessionRepository = sessionRepository;
        this.intentConfigRepository = intentConfigRepository;
        this.learningService = learningService;
        this.dashScopeClient = dashScopeClient;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    @Transactional
    public ConversationResponse startConversation(String factoryId, Long userId, String userInput) {
        log.info("开始多轮对话: factory={}, user={}, input={}",
                factoryId, userId, truncate(userInput, 50));

        // 取消之前的活跃会话
        sessionRepository.cancelActiveSessionsForUser(factoryId, userId, LocalDateTime.now());

        // 创建新会话
        ConversationSession session = ConversationSession.create(factoryId, userId, userInput);
        session.setMaxRounds(maxRounds);
        session.setTimeoutMinutes(timeoutMinutes);

        // 获取可用意图列表
        List<AIIntentConfig> availableIntents = getAvailableIntents(factoryId);

        // 调用 LLM 生成初始响应
        LlmConversationResult llmResult = callLlmForConversation(session, userInput, availableIntents);

        // 更新会话
        session.addAssistantMessage(llmResult.getMessage());
        session.setCandidates(llmResult.getCandidates());
        session.setLastConfidence(llmResult.getConfidence());

        // 检查是否已经可以确定意图
        if (llmResult.isIntentConfirmed() && llmResult.getConfidence() >= confidenceThreshold) {
            session.complete(llmResult.getIntentCode(), llmResult.getConfidence());
            log.info("首轮对话即确定意图: session={}, intent={}, confidence={}",
                    session.getSessionId(), llmResult.getIntentCode(), llmResult.getConfidence());
        }

        sessionRepository.save(session);

        return buildResponse(session, llmResult);
    }

    @Override
    @Transactional
    public ConversationResponse continueConversation(String sessionId, String userReply) {
        log.info("继续多轮对话: session={}, reply={}", sessionId, truncate(userReply, 50));

        Optional<ConversationSession> optSession = sessionRepository.findById(sessionId);
        if (optSession.isEmpty()) {
            log.warn("会话不存在: {}", sessionId);
            return ConversationResponse.builder()
                    .sessionId(sessionId)
                    .status(SessionStatus.CANCELLED)
                    .completed(false)
                    .message("会话不存在或已过期")
                    .build();
        }

        ConversationSession session = optSession.get();

        // 检查会话状态
        if (session.isExpired()) {
            session.timeout();
            sessionRepository.save(session);
            return ConversationResponse.builder()
                    .sessionId(sessionId)
                    .status(SessionStatus.TIMEOUT)
                    .completed(false)
                    .message("会话已超时，请重新开始")
                    .build();
        }

        if (!session.canContinue()) {
            return ConversationResponse.builder()
                    .sessionId(sessionId)
                    .status(session.getStatus())
                    .completed(session.getStatus() == SessionStatus.COMPLETED)
                    .message(getStatusMessage(session.getStatus()))
                    .build();
        }

        // 添加用户消息
        session.addUserMessage(userReply);

        // 检查是否是直接确认 (用户选择了候选意图)
        String confirmedIntent = checkDirectConfirmation(userReply, session.getCandidates());
        if (confirmedIntent != null) {
            session.complete(confirmedIntent, 0.95);
            sessionRepository.save(session);

            // 触发学习
            learnFromSession(session);

            return buildConfirmedResponse(session, confirmedIntent);
        }

        // 进入下一轮
        if (!session.nextRound()) {
            session.maxRoundsReached();
            sessionRepository.save(session);
            return ConversationResponse.builder()
                    .sessionId(sessionId)
                    .currentRound(session.getCurrentRound())
                    .maxRounds(session.getMaxRounds())
                    .status(SessionStatus.MAX_ROUNDS_REACHED)
                    .completed(false)
                    .message("对话已达最大轮次，无法确定您的意图。请尝试更清晰地描述您的需求。")
                    .build();
        }

        // 获取可用意图
        List<AIIntentConfig> availableIntents = getAvailableIntents(session.getFactoryId());

        // 调用 LLM 继续对话
        LlmConversationResult llmResult = callLlmForConversation(session, userReply, availableIntents);

        // 更新会话
        session.addAssistantMessage(llmResult.getMessage());
        session.setCandidates(llmResult.getCandidates());
        session.setLastConfidence(llmResult.getConfidence());

        // 检查是否确定意图
        if (llmResult.isIntentConfirmed() && llmResult.getConfidence() >= confidenceThreshold) {
            session.complete(llmResult.getIntentCode(), llmResult.getConfidence());
            log.info("多轮对话确定意图: session={}, round={}, intent={}, confidence={}",
                    session.getSessionId(), session.getCurrentRound(),
                    llmResult.getIntentCode(), llmResult.getConfidence());

            // 触发学习
            learnFromSession(session);
        }

        sessionRepository.save(session);

        return buildResponse(session, llmResult);
    }

    @Override
    @Transactional
    public boolean endConversation(String sessionId, String intentCode) {
        log.info("结束对话: session={}, intent={}", sessionId, intentCode);

        Optional<ConversationSession> optSession = sessionRepository.findById(sessionId);
        if (optSession.isEmpty()) {
            return false;
        }

        ConversationSession session = optSession.get();
        session.complete(intentCode, 1.0); // 用户确认置信度为1
        sessionRepository.save(session);

        // 触发学习
        learnFromSession(session);

        return true;
    }

    @Override
    @Transactional
    public boolean cancelConversation(String sessionId) {
        log.info("取消对话: session={}", sessionId);

        Optional<ConversationSession> optSession = sessionRepository.findById(sessionId);
        if (optSession.isEmpty()) {
            return false;
        }

        ConversationSession session = optSession.get();
        session.cancel();
        sessionRepository.save(session);

        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ConversationSession> getActiveSession(String factoryId, Long userId) {
        return sessionRepository.findLatestActiveSession(factoryId, userId);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ConversationSession> getSession(String sessionId) {
        return sessionRepository.findById(sessionId);
    }

    @Override
    @Transactional
    @Scheduled(fixedRate = 60000) // 每分钟执行一次
    public int processExpiredSessions() {
        LocalDateTime expireTime = LocalDateTime.now().minusMinutes(timeoutMinutes);
        int count = sessionRepository.expireInactiveSessions(expireTime, LocalDateTime.now());
        if (count > 0) {
            log.info("处理过期会话: count={}", count);
        }
        return count;
    }

    @Override
    @Transactional(readOnly = true)
    public ConversationStatistics getStatistics(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);

        ConversationStatistics stats = new ConversationStatistics();

        // 获取成功率数据
        List<Object[]> rateData = sessionRepository.getSuccessRate(since);
        if (!rateData.isEmpty()) {
            Object[] row = rateData.get(0);
            long completed = ((Number) row[0]).longValue();
            long timeout = ((Number) row[1]).longValue();
            long cancelled = ((Number) row[2]).longValue();
            long maxRounds = ((Number) row[3]).longValue();
            long total = ((Number) row[4]).longValue();

            stats.setCompletedCount(completed);
            stats.setTimeoutCount(timeout);
            stats.setCancelledCount(cancelled);
            stats.setMaxRoundsCount(maxRounds);
            stats.setTotalSessions(total);
            stats.setSuccessRate(total > 0 ? (double) completed / total : 0);
        }

        // 获取平均轮次
        Double avgRounds = sessionRepository.getAverageRoundsForCompleted(since);
        stats.setAverageRounds(avgRounds != null ? avgRounds : 0);

        // 活跃会话数
        stats.setActiveSessions(sessionRepository.findByStatus(SessionStatus.ACTIVE).size());

        return stats;
    }

    // ========== 私有方法 ==========

    /**
     * 获取可用意图列表
     */
    private List<AIIntentConfig> getAvailableIntents(String factoryId) {
        return intentConfigRepository.findActiveByFactoryIdWithPriority(factoryId);
    }

    /**
     * 调用 LLM 进行对话
     */
    private LlmConversationResult callLlmForConversation(ConversationSession session,
                                                          String userInput,
                                                          List<AIIntentConfig> availableIntents) {
        if (dashScopeClient == null || !dashScopeClient.isAvailable()) {
            log.warn("DashScope 不可用，使用默认响应");
            return generateDefaultResponse(availableIntents);
        }

        try {
            // 构建系统提示词
            String systemPrompt = buildConversationSystemPrompt(availableIntents, session);

            // 构建对话历史
            String conversationHistory = session.buildConversationHistory();
            String userMessage = conversationHistory.isEmpty()
                    ? userInput
                    : conversationHistory + "用户: " + userInput;

            // 调用 DashScope
            String response = dashScopeClient.chat(systemPrompt, userMessage);

            // 解析响应
            return parseLlmResponse(response, availableIntents);

        } catch (Exception e) {
            log.error("LLM 对话调用失败: {}", e.getMessage(), e);
            return generateDefaultResponse(availableIntents);
        }
    }

    /**
     * 构建对话系统提示词
     */
    private String buildConversationSystemPrompt(List<AIIntentConfig> availableIntents,
                                                  ConversationSession session) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个意图识别助手，正在进行多轮对话来澄清用户的真实意图。\n\n");

        sb.append("## 当前对话状态\n");
        sb.append("- 轮次: ").append(session.getCurrentRound()).append("/").append(session.getMaxRounds()).append("\n");
        sb.append("- 原始输入: ").append(session.getOriginalInput()).append("\n\n");

        sb.append("## 可用意图列表\n\n");
        for (AIIntentConfig intent : availableIntents) {
            sb.append(String.format("- **%s** (%s): %s\n",
                    intent.getIntentCode(),
                    intent.getIntentName(),
                    intent.getDescription() != null ? intent.getDescription() : ""));
        }

        sb.append("\n## 你的任务\n\n");
        sb.append("1. 分析用户的输入和对话历史\n");
        sb.append("2. 如果能确定用户意图（置信度 >= 0.7），返回确认结果\n");
        sb.append("3. 如果不确定，生成一个澄清问题来帮助确定意图\n");
        sb.append("4. 澄清问题应该简洁明了，并提供选项供用户选择\n\n");

        sb.append("## 输出格式 (JSON)\n\n");
        sb.append("```json\n");
        sb.append("{\n");
        sb.append("  \"is_confirmed\": true/false,\n");
        sb.append("  \"intent_code\": \"意图代码 (如果确定)\",\n");
        sb.append("  \"confidence\": 0.0-1.0,\n");
        sb.append("  \"message\": \"给用户的回复 (澄清问题或确认消息)\",\n");
        sb.append("  \"candidates\": [\n");
        sb.append("    {\"intent_code\": \"...\", \"intent_name\": \"...\", \"confidence\": 0.5}\n");
        sb.append("  ],\n");
        sb.append("  \"reasoning\": \"判断理由\"\n");
        sb.append("}\n");
        sb.append("```\n\n");
        sb.append("仅返回 JSON，不要包含其他文字。");

        return sb.toString();
    }

    /**
     * 解析 LLM 响应
     */
    private LlmConversationResult parseLlmResponse(String response, List<AIIntentConfig> availableIntents) {
        try {
            // 提取 JSON
            Pattern pattern = Pattern.compile("\\{[\\s\\S]*\\}");
            Matcher matcher = pattern.matcher(response);

            if (!matcher.find()) {
                log.warn("无法从 LLM 响应中提取 JSON: {}", truncate(response, 100));
                return generateDefaultResponse(availableIntents);
            }

            JsonNode json = objectMapper.readTree(matcher.group());

            boolean isConfirmed = json.has("is_confirmed") && json.get("is_confirmed").asBoolean();
            String intentCode = json.has("intent_code") ? json.get("intent_code").asText() : null;
            double confidence = json.has("confidence") ? json.get("confidence").asDouble() : 0.5;
            String message = json.has("message") ? json.get("message").asText() : "请问您想要执行什么操作？";
            String reasoning = json.has("reasoning") ? json.get("reasoning").asText() : null;

            // Clamp confidence
            confidence = Math.max(0.0, Math.min(1.0, confidence));

            // 解析候选
            List<CandidateIntent> candidates = new ArrayList<>();
            if (json.has("candidates") && json.get("candidates").isArray()) {
                for (JsonNode candNode : json.get("candidates")) {
                    String code = candNode.has("intent_code") ? candNode.get("intent_code").asText() : null;
                    String name = candNode.has("intent_name") ? candNode.get("intent_name").asText() : code;
                    double candConf = candNode.has("confidence") ? candNode.get("confidence").asDouble() : 0.3;

                    if (code != null && !code.isEmpty()) {
                        candidates.add(CandidateIntent.builder()
                                .intentCode(code)
                                .intentName(name)
                                .confidence(candConf)
                                .build());
                    }
                }
            }

            // 验证意图代码
            if (isConfirmed && intentCode != null) {
                boolean validIntent = availableIntents.stream()
                        .anyMatch(i -> intentCode.equalsIgnoreCase(i.getIntentCode()));
                if (!validIntent) {
                    log.warn("LLM 返回无效意图代码: {}", intentCode);
                    isConfirmed = false;
                }
            }

            return LlmConversationResult.builder()
                    .intentConfirmed(isConfirmed)
                    .intentCode(intentCode)
                    .confidence(confidence)
                    .message(message)
                    .candidates(candidates)
                    .reasoning(reasoning)
                    .build();

        } catch (Exception e) {
            log.error("解析 LLM 响应失败: {}", e.getMessage(), e);
            return generateDefaultResponse(availableIntents);
        }
    }

    /**
     * 生成默认响应
     */
    private LlmConversationResult generateDefaultResponse(List<AIIntentConfig> availableIntents) {
        List<CandidateIntent> candidates = availableIntents.stream()
                .limit(5)
                .map(i -> CandidateIntent.builder()
                        .intentCode(i.getIntentCode())
                        .intentName(i.getIntentName())
                        .confidence(0.3)
                        .build())
                .collect(Collectors.toList());

        StringBuilder message = new StringBuilder("请问您想要执行以下哪个操作？\n");
        for (int i = 0; i < Math.min(candidates.size(), 5); i++) {
            CandidateIntent c = candidates.get(i);
            message.append(String.format("%d. %s\n", i + 1, c.getIntentName()));
        }
        message.append("\n请输入数字或描述您的需求。");

        return LlmConversationResult.builder()
                .intentConfirmed(false)
                .confidence(0.3)
                .message(message.toString())
                .candidates(candidates)
                .build();
    }

    /**
     * 检查用户是否直接确认了某个候选意图
     */
    private String checkDirectConfirmation(String userReply, List<CandidateIntent> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }

        String reply = userReply.trim().toLowerCase();

        // 检查数字选择 (1, 2, 3...)
        if (reply.matches("\\d+")) {
            int index = Integer.parseInt(reply) - 1;
            if (index >= 0 && index < candidates.size()) {
                return candidates.get(index).getIntentCode();
            }
        }

        // 检查意图名称匹配
        for (CandidateIntent candidate : candidates) {
            if (reply.contains(candidate.getIntentName().toLowerCase()) ||
                reply.contains(candidate.getIntentCode().toLowerCase())) {
                return candidate.getIntentCode();
            }
        }

        // 检查确认词
        if (reply.matches(".*(是的?|对|确认|好的?|没错|正确).*") && candidates.size() == 1) {
            return candidates.get(0).getIntentCode();
        }

        return null;
    }

    /**
     * 从会话中学习
     */
    private void learnFromSession(ConversationSession session) {
        if (learningService == null) {
            log.debug("学习服务不可用，跳过学习");
            return;
        }

        String intentCode = session.getFinalIntentCode();
        if (intentCode == null || intentCode.isEmpty()) {
            return;
        }

        try {
            // 学习原始表达
            String originalInput = session.getOriginalInput();
            learningService.learnExpression(
                    session.getFactoryId(),
                    intentCode,
                    originalInput,
                    session.getLastConfidence() != null ? session.getLastConfidence() : 0.8,
                    LearnedExpression.SourceType.USER_FEEDBACK
            );

            log.info("从多轮对话学习表达: session={}, intent={}, expr={}",
                    session.getSessionId(), intentCode, truncate(originalInput, 50));

            // 提取并学习关键词 (可选)
            // 这里可以添加更复杂的关键词提取逻辑

        } catch (Exception e) {
            log.error("从会话学习失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 构建响应
     */
    private ConversationResponse buildResponse(ConversationSession session, LlmConversationResult llmResult) {
        List<CandidateInfo> candidateInfos = llmResult.getCandidates().stream()
                .map(c -> CandidateInfo.builder()
                        .intentCode(c.getIntentCode())
                        .intentName(c.getIntentName())
                        .confidence(c.getConfidence())
                        .build())
                .collect(Collectors.toList());

        String intentName = null;
        if (llmResult.isIntentConfirmed() && llmResult.getIntentCode() != null) {
            intentName = intentConfigRepository.findByIntentCode(llmResult.getIntentCode())
                    .map(AIIntentConfig::getIntentName)
                    .orElse(llmResult.getIntentCode());
        }

        return ConversationResponse.builder()
                .sessionId(session.getSessionId())
                .currentRound(session.getCurrentRound())
                .maxRounds(session.getMaxRounds())
                .status(session.getStatus())
                .completed(session.getStatus() == SessionStatus.COMPLETED)
                .message(llmResult.getMessage())
                .intentCode(llmResult.isIntentConfirmed() ? llmResult.getIntentCode() : null)
                .intentName(intentName)
                .confidence(llmResult.getConfidence())
                .candidates(candidateInfos)
                .requiresConfirmation(!llmResult.isIntentConfirmed() ||
                        llmResult.getConfidence() < confidenceThreshold)
                .build();
    }

    /**
     * 构建确认响应
     */
    private ConversationResponse buildConfirmedResponse(ConversationSession session, String intentCode) {
        String intentName = intentConfigRepository.findByIntentCode(intentCode)
                .map(AIIntentConfig::getIntentName)
                .orElse(intentCode);

        return ConversationResponse.builder()
                .sessionId(session.getSessionId())
                .currentRound(session.getCurrentRound())
                .maxRounds(session.getMaxRounds())
                .status(SessionStatus.COMPLETED)
                .completed(true)
                .message(String.format("已确认您的意图: %s", intentName))
                .intentCode(intentCode)
                .intentName(intentName)
                .confidence(0.95)
                .requiresConfirmation(false)
                .build();
    }

    /**
     * 获取状态消息
     */
    private String getStatusMessage(SessionStatus status) {
        switch (status) {
            case COMPLETED:
                return "对话已完成";
            case TIMEOUT:
                return "对话已超时";
            case CANCELLED:
                return "对话已取消";
            case MAX_ROUNDS_REACHED:
                return "对话已达最大轮次";
            default:
                return "对话状态异常";
        }
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "...";
    }

    // ========== 内部类 ==========

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    private static class LlmConversationResult {
        private boolean intentConfirmed;
        private String intentCode;
        private double confidence;
        private String message;
        private List<CandidateIntent> candidates;
        private String reasoning;
    }
}
