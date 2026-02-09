package com.cretas.aims.service.impl;

import com.cretas.aims.config.IndustryKnowledgeConfig;
import com.cretas.aims.config.IntentKnowledgeBase;
import com.cretas.aims.config.IntentKnowledgeBase.QuestionType;
import com.cretas.aims.dto.ai.AnalysisContext;
import com.cretas.aims.dto.ai.AnalysisResult;
import com.cretas.aims.dto.ai.AnalysisTopic;
import com.cretas.aims.service.AnalysisRouterService;
import com.cretas.aims.service.ToolRouterService;
import com.cretas.aims.ai.client.DashScopeClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 分析路由服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnalysisRouterServiceImpl implements AnalysisRouterService {

    private final ToolRouterService toolRouterService;
    private final DashScopeClient dashScopeClient;
    private final IndustryKnowledgeConfig industryKnowledgeConfig;
    private final IntentKnowledgeBase knowledgeBase;

    // 业务领域关键词
    private static final Map<AnalysisTopic, List<String>> TOPIC_KEYWORDS = new HashMap<>();

    // 分析指示词
    private static final List<String> ANALYSIS_INDICATORS = Arrays.asList(
            "怎么样", "状态", "情况", "分析", "报告", "总结", "概况", "概览", "汇总"
    );

    static {
        TOPIC_KEYWORDS.put(AnalysisTopic.PRODUCT_STATUS, Arrays.asList(
                "产品", "生产", "批次", "加工", "产出", "成品"
        ));
        TOPIC_KEYWORDS.put(AnalysisTopic.INVENTORY_STATUS, Arrays.asList(
                "库存", "存货", "原料", "物料", "材料", "储备"
        ));
        TOPIC_KEYWORDS.put(AnalysisTopic.SHIPMENT_STATUS, Arrays.asList(
                "出货", "发货", "配送", "物流", "运输", "订单"
        ));
        TOPIC_KEYWORDS.put(AnalysisTopic.QUALITY_ANALYSIS, Arrays.asList(
                "质检", "质量", "品质", "检测", "合格", "不良"
        ));
        TOPIC_KEYWORDS.put(AnalysisTopic.PERSONNEL_ANALYSIS, Arrays.asList(
                "人员", "考勤", "排班", "员工", "出勤", "工人"
        ));
        TOPIC_KEYWORDS.put(AnalysisTopic.OVERALL_BUSINESS, Arrays.asList(
                "整体", "全部", "总体", "综合", "全面", "今天", "今日"
        ));
    }

    @Override
    public boolean isAnalysisRequest(String userInput, QuestionType questionType) {
        if (questionType != QuestionType.GENERAL_QUESTION) {
            return false;
        }

        if (userInput == null || userInput.trim().isEmpty()) {
            return false;
        }

        String normalizedInput = userInput.toLowerCase().trim();

        // 检查是否包含业务关键词
        boolean hasBusinessKeyword = TOPIC_KEYWORDS.values().stream()
                .flatMap(List::stream)
                .anyMatch(normalizedInput::contains);

        // 检查是否包含分析指示词
        boolean hasAnalysisIndicator = ANALYSIS_INDICATORS.stream()
                .anyMatch(normalizedInput::contains);

        boolean isAnalysis = hasBusinessKeyword && hasAnalysisIndicator;

        log.debug("分析请求检测: input='{}', hasBusinessKeyword={}, hasAnalysisIndicator={}, isAnalysis={}",
                userInput, hasBusinessKeyword, hasAnalysisIndicator, isAnalysis);

        return isAnalysis;
    }

    @Override
    public AnalysisTopic detectAnalysisTopic(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return AnalysisTopic.GENERAL;
        }

        String normalizedInput = userInput.toLowerCase().trim();

        // 计算每个主题的匹配分数
        AnalysisTopic bestTopic = AnalysisTopic.GENERAL;
        int bestScore = 0;

        for (Map.Entry<AnalysisTopic, List<String>> entry : TOPIC_KEYWORDS.entrySet()) {
            int score = 0;
            for (String keyword : entry.getValue()) {
                if (normalizedInput.contains(keyword)) {
                    score++;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestTopic = entry.getKey();
            }
        }

        log.debug("分析主题检测: input='{}', topic={}, score={}", userInput, bestTopic, bestScore);

        return bestTopic;
    }

    @Override
    public AnalysisResult executeAnalysis(AnalysisContext context) {
        log.info("🔍 开始执行分析: topic={}, userInput='{}'",
                context.getTopic(), context.getUserInput());

        try {
            // 1. 获取分析主题的相关工具
            List<String> toolCodes = context.getTopic().getRelatedTools();
            log.debug("分析使用的工具: {}", toolCodes);

            // 2. 获取工厂数据上下文
            String dataContext = getDataContext(context, toolCodes);

            // 3. 获取行业知识
            String industryKnowledge = industryKnowledgeConfig.getKnowledgeForTopic(
                    context.getTopic().name());

            // 4. 构建分析 Prompt
            String analysisPrompt = buildAnalysisPrompt(
                    context.getUserInput(),
                    dataContext,
                    industryKnowledge,
                    context.getTopic()
            );

            // 5. 调用 LLM 生成分析
            String analysisText;
            if (Boolean.TRUE.equals(context.getEnableThinking())) {
                int budget = context.getThinkingBudget() != null ? context.getThinkingBudget() : 30;
                var response = dashScopeClient.chatWithThinking(
                        buildSystemPrompt(context.getTopic()),
                        analysisPrompt,
                        budget
                );
                analysisText = response.getContent();
            } else {
                analysisText = dashScopeClient.chat(
                        buildSystemPrompt(context.getTopic()),
                        analysisPrompt
                );
            }

            log.info("✅ 分析完成: topic={}, responseLength={}",
                    context.getTopic(), analysisText != null ? analysisText.length() : 0);

            return AnalysisResult.builder()
                    .success(true)
                    .formattedAnalysis(analysisText)
                    .topic(context.getTopic())
                    .toolsUsed(toolCodes)
                    .dataSummary(new HashMap<>())
                    .build();

        } catch (Exception e) {
            log.error("❌ 分析执行失败: topic={}, error={}", context.getTopic(), e.getMessage(), e);

            return AnalysisResult.builder()
                    .success(false)
                    .errorMessage("分析执行失败: " + e.getMessage())
                    .topic(context.getTopic())
                    .build();
        }
    }

    /**
     * 获取数据上下文
     */
    private String getDataContext(AnalysisContext context, List<String> toolCodes) {
        // TODO: 在后续版本中，这里将调用 ToolRouterService 执行工具获取数据
        // 当前版本使用占位符，后续集成多 Agent 系统时完善

        if (toolCodes.isEmpty()) {
            return "当前暂无可用的具体数据，请基于食品行业通用知识进行分析。";
        }

        return String.format(
                "系统将查询以下数据源: %s\n" +
                "工厂ID: %s\n" +
                "（注：完整数据查询功能将在后续版本中集成）",
                String.join(", ", toolCodes),
                context.getFactoryId()
        );
    }

    /**
     * 构建系统提示词
     */
    private String buildSystemPrompt(AnalysisTopic topic) {
        return String.format("""
                你是白垩纪食品溯源系统的智能分析助手。

                当前分析主题: %s (%s)

                请根据以下原则进行分析：
                1. **数据驱动**: 基于提供的数据进行分析，不要编造数据
                2. **行业专业**: 结合食品行业的专业知识和标准
                3. **可操作性**: 提供具体可执行的建议
                4. **风险意识**: 特别关注食品安全相关的风险点
                5. **简洁明了**: 回答控制在 500 字以内

                使用中文回答。
                """,
                topic.getDisplayName(),
                topic.name()
        );
    }

    /**
     * 构建分析 Prompt
     */
    private String buildAnalysisPrompt(String userInput, String dataContext,
                                        String industryKnowledge, AnalysisTopic topic) {
        StringBuilder prompt = new StringBuilder();

        prompt.append("用户问题: ").append(userInput).append("\n\n");

        if (dataContext != null && !dataContext.isEmpty()) {
            prompt.append("--- 数据上下文 ---\n");
            prompt.append(dataContext).append("\n\n");
        }

        if (industryKnowledge != null && !industryKnowledge.isEmpty()) {
            prompt.append("--- 行业知识参考 ---\n");
            prompt.append(industryKnowledge).append("\n\n");
        }

        prompt.append("请根据以上信息，针对用户的问题提供专业的分析和建议。");

        return prompt.toString();
    }
}
