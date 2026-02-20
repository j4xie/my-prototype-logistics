package com.cretas.aims.service.impl;

import com.cretas.aims.config.IndustryKnowledgeConfig;
import com.cretas.aims.dto.ai.*;
import com.cretas.aims.service.*;
import com.cretas.aims.ai.client.DashScopeClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Agent 编排服务实现
 *
 * 协调检索、评估、分析、审核四个 Agent 完成复杂分析任务。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentOrchestratorImpl implements AgentOrchestrator {

    private final RetrievalEvaluatorService retrievalEvaluatorService;
    private final KnowledgeFeedbackService knowledgeFeedbackService;
    private final IndustryKnowledgeConfig industryKnowledgeConfig;
    private final DashScopeClient dashScopeClient;

    // 最大重试轮次
    private static final int MAX_RETRY_ROUNDS = 3;

    // 复杂度阈值
    @Value("${ai.agent.complexity-threshold:0.6}")
    private double complexityThreshold;

    @Override
    public AnalysisResult executeCollaborativeAnalysis(AnalysisContext context) {
        log.info("🤖 开始多 Agent 协作分析: topic={}, userInput='{}'",
                context.getTopic(),
                context.getUserInput().length() > 30 ?
                        context.getUserInput().substring(0, 30) + "..." : context.getUserInput());

        AgentMessage message = AgentMessage.create(context);
        int round = 0;

        try {
            while (round < MAX_RETRY_ROUNDS) {
                round++;
                log.debug("Agent 协作第 {} 轮", round);

                // Agent 1: 检索
                message = executeRetrievalAgent(message);
                if (message.getErrorMessage() != null) {
                    break;
                }

                // Agent 2: 评估
                EvaluationResult evaluation = executeEvaluatorAgent(message);
                if (evaluation.needsMoreData()) {
                    log.info("评估 Agent 请求补充数据: missingInfo={}", evaluation.getMissingInfo());
                    continue;  // 回到检索
                }

                // Agent 3: 分析
                message = executeAnalysisAgent(message);
                if (message.getErrorMessage() != null) {
                    break;
                }

                // Agent 4: 审核
                ReviewResult review = executeReviewerAgent(message);
                if (review.isApproved()) {
                    log.info("✅ 审核 Agent 通过，分析完成");

                    // 记录反馈
                    knowledgeFeedbackService.recordFeedback(
                            context.getSessionId(),
                            context.getUserInput(),
                            message.getAnalysisResult(),
                            KnowledgeFeedbackService.FeedbackType.AUTO_APPROVED
                    );

                    message.setCurrentStage(AgentMessage.AgentStage.COMPLETED);
                    return message.toAnalysisResult();
                }

                // 审核不通过，添加评论继续
                log.info("审核 Agent 退回修改: comments={}", review.getComments());
                message.addReviewComments(review.getComments());
            }

            // 达到最大轮次
            if (round >= MAX_RETRY_ROUNDS) {
                log.warn("⚠️ 达到最大重试轮次，标记需人工审核");
                return message.toAnalysisResult().markForHumanReview();
            }

            return message.toAnalysisResult();

        } catch (Exception e) {
            log.error("❌ Agent 协作分析失败: {}", e.getMessage(), e);
            return AnalysisResult.builder()
                    .success(false)
                    .errorMessage("Agent 协作分析失败: " + e.getMessage())
                    .topic(context.getTopic())
                    .build();
        }
    }

    @Override
    public boolean requiresMultiAgentCollaboration(AnalysisContext context) {
        // 当前使用简单规则判断，后续可扩展为 ComplexityRouter
        if (context == null || context.getTopic() == null) {
            return false;
        }

        // 复杂主题需要多 Agent 协作
        return context.getTopic() == AnalysisTopic.OVERALL_BUSINESS ||
               context.getTopic() == AnalysisTopic.QUALITY_ANALYSIS;
    }

    /**
     * 执行检索 Agent
     */
    private AgentMessage executeRetrievalAgent(AgentMessage message) {
        log.debug("📥 检索 Agent 执行中...");
        message.setCurrentStage(AgentMessage.AgentStage.RETRIEVAL);

        try {
            // 获取行业知识
            String industryKnowledge = industryKnowledgeConfig.getKnowledgeForTopic(
                    message.getContext().getTopic().name());

            Map<String, Object> data = new HashMap<>();
            data.put("industryKnowledge", industryKnowledge);
            data.put("topic", message.getContext().getTopic().getDisplayName());
            data.put("relatedTools", message.getContext().getTopic().getRelatedTools());

            // TODO: 后续集成实际的工具调用

            message.setRetrievedData(data);
            log.debug("检索 Agent 完成: dataKeys={}", data.keySet());

        } catch (Exception e) {
            message.setErrorMessage("检索失败: " + e.getMessage());
            log.error("检索 Agent 失败: {}", e.getMessage());
        }

        return message;
    }

    /**
     * 执行评估 Agent
     */
    private EvaluationResult executeEvaluatorAgent(AgentMessage message) {
        log.debug("🔍 评估 Agent 执行中...");
        message.setCurrentStage(AgentMessage.AgentStage.EVALUATION);

        // 评估检索数据的质量
        Map<String, Object> data = message.getRetrievedData();

        // 简单评估：检查必要字段
        boolean hasIndustryKnowledge = data.containsKey("industryKnowledge") &&
                data.get("industryKnowledge") != null;

        if (!hasIndustryKnowledge) {
            return EvaluationResult.needsMore(Arrays.asList("行业知识"));
        }

        return EvaluationResult.passed();
    }

    /**
     * 执行分析 Agent
     */
    private AgentMessage executeAnalysisAgent(AgentMessage message) {
        log.debug("📊 分析 Agent 执行中...");
        message.setCurrentStage(AgentMessage.AgentStage.ANALYSIS);

        try {
            AnalysisContext context = message.getContext();
            String industryKnowledge = (String) message.getRetrievedData().get("industryKnowledge");

            // 构建分析 Prompt
            String systemPrompt = String.format("""
                    你是白垩纪食品溯源系统的智能分析助手。
                    当前分析主题: %s

                    请根据以下原则进行分析：
                    1. 基于提供的行业知识进行专业分析
                    2. 回答简洁明了，控制在 500 字以内
                    3. 使用中文回答
                    """, context.getTopic().getDisplayName());

            String userPrompt = String.format("""
                    用户问题: %s

                    行业知识参考:
                    %s

                    %s

                    请提供专业的分析和建议。
                    """,
                    context.getUserInput(),
                    industryKnowledge,
                    message.getReviewComments().isEmpty() ? "" :
                            "审核意见（请在分析中改进这些问题）:\n" + String.join("\n", message.getReviewComments())
            );

            String analysis = dashScopeClient.chat(systemPrompt, userPrompt);
            message.setAnalysisResult(analysis);

            log.debug("分析 Agent 完成: resultLength={}", analysis != null ? analysis.length() : 0);

        } catch (Exception e) {
            message.setErrorMessage("分析失败: " + e.getMessage());
            log.error("分析 Agent 失败: {}", e.getMessage());
        }

        return message;
    }

    /**
     * 执行审核 Agent
     */
    private ReviewResult executeReviewerAgent(AgentMessage message) {
        log.debug("✅ 审核 Agent 执行中...");
        message.setCurrentStage(AgentMessage.AgentStage.REVIEW);

        String analysis = message.getAnalysisResult();
        if (analysis == null || analysis.isEmpty()) {
            return ReviewResult.reject(Arrays.asList("分析结果为空"));
        }

        List<String> issues = new ArrayList<>();

        // 简单审核规则
        if (analysis.length() < 50) {
            issues.add("分析内容过短，请提供更详细的分析");
        }

        if (analysis.contains("我不知道") || analysis.contains("无法判断")) {
            issues.add("请避免使用不确定的表述，提供更明确的建议");
        }

        if (issues.isEmpty()) {
            return ReviewResult.approve();
        } else {
            return ReviewResult.reject(issues);
        }
    }

    /**
     * 评估结果
     */
    @lombok.Data
    @lombok.Builder
    private static class EvaluationResult {
        private boolean passed;
        private List<String> missingInfo;

        boolean needsMoreData() {
            return !passed && missingInfo != null && !missingInfo.isEmpty();
        }

        static EvaluationResult passed() {
            return EvaluationResult.builder().passed(true).build();
        }

        static EvaluationResult needsMore(List<String> missing) {
            return EvaluationResult.builder().passed(false).missingInfo(missing).build();
        }
    }

    /**
     * 审核结果
     */
    @lombok.Data
    @lombok.Builder
    private static class ReviewResult {
        private boolean approved;
        private List<String> comments;

        static ReviewResult approve() {
            return ReviewResult.builder().approved(true).build();
        }

        static ReviewResult reject(List<String> comments) {
            return ReviewResult.builder().approved(false).comments(comments).build();
        }
    }
}
