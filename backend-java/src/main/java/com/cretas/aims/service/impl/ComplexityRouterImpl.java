package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.AnalysisContext;
import com.cretas.aims.dto.ai.ProcessingMode;
import com.cretas.aims.dto.ai.QueryFeatures;
import com.cretas.aims.service.ComplexityClassifier;
import com.cretas.aims.service.ComplexityRouter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

/**
 * 复杂度路由服务实现
 *
 * 三层混合实现：
 * - Phase 1: 规则特征提取（基础）
 * - Phase 2a: GTE + 分类器（边界情况，优先）
 * - Phase 2b: LLM API 调用（备用，可禁用）
 *
 * @author Cretas Team
 * @version 3.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
public class ComplexityRouterImpl implements ComplexityRouter {

    /**
     * GTE + 分类器 (Phase 2a - 优先使用)
     */
    @Autowired(required = false)
    private ComplexityClassifier classifier;

    // 复杂度阈值
    private static final double FAST_THRESHOLD = 0.3;
    private static final double ANALYSIS_THRESHOLD = 0.6;
    private static final double MULTI_AGENT_THRESHOLD = 0.8;

    // 边界区间阈值 (用于判断是否需要 LLM 辅助)
    private static final double AMBIGUOUS_LOWER = 0.25;
    private static final double AMBIGUOUS_UPPER = 0.35;
    private static final double AMBIGUOUS_MID_LOWER = 0.55;
    private static final double AMBIGUOUS_MID_UPPER = 0.65;
    private static final double AMBIGUOUS_HIGH_LOWER = 0.75;
    private static final double AMBIGUOUS_HIGH_UPPER = 0.85;

    /**
     * 是否启用分类器辅助判断
     */
    @Value("${ai.complexity.classifier.enabled:true}")
    private boolean classifierEnabled;

    // 问句词
    private static final List<String> QUESTION_WORDS = Arrays.asList(
            "为什么", "怎么样", "如何", "什么", "哪些", "多少", "是否"
    );

    // 比较指示词
    private static final List<String> COMPARISON_INDICATORS = Arrays.asList(
            "对比", "比较", "趋势", "变化", "增长", "下降", "波动"
    );

    // 因果指示词
    private static final List<String> CAUSAL_INDICATORS = Arrays.asList(
            "为什么", "原因", "导致", "影响", "因为", "所以", "结果"
    );

    // 时间范围词
    private static final List<String> TIME_RANGE_WORDS = Arrays.asList(
            "这周", "上周", "本周", "上月", "本月", "今天", "昨天", "最近", "近期"
    );

    // 质量-成本权衡因子
    @Value("${ai.complexity.lambda:0.7}")
    private double lambda;

    @Override
    public ProcessingMode route(String userInput, AnalysisContext context) {
        // Step 1: 规则特征提取，快速估算复杂度
        double ruleComplexity = estimateComplexity(userInput, context);

        // Step 2: 检查是否在边界区间
        boolean isAmbiguous = isInAmbiguousZone(ruleComplexity);

        // Step 3: 边界情况使用 GTE 分类器判断 (Phase 2a)
        if (isAmbiguous && shouldUseClassifier()) {
            log.info("📊 复杂度在边界区间 ({})，启用分类器判断...",
                    String.format("%.2f", ruleComplexity));
            try {
                ProcessingMode classifierMode = classifier.predict(userInput);
                double classifierScore = classifier.predictScore(userInput);
                log.info("🎯 分类器判断: mode={}, score={} (规则: {})",
                        classifierMode, String.format("%.2f", classifierScore),
                        String.format("%.2f", ruleComplexity));
                return classifierMode;
            } catch (Exception e) {
                log.warn("分类器判断失败，降级到规则判断: {}", e.getMessage());
                // 降级到规则判断
            }
        }

        // Step 4: 规则判断 (Phase 1 - 兜底)
        ProcessingMode mode;
        if (ruleComplexity < FAST_THRESHOLD) {
            mode = ProcessingMode.FAST;
        } else if (ruleComplexity < ANALYSIS_THRESHOLD) {
            mode = ProcessingMode.ANALYSIS;
        } else if (ruleComplexity < MULTI_AGENT_THRESHOLD) {
            mode = ProcessingMode.MULTI_AGENT;
        } else {
            mode = ProcessingMode.DEEP_REASONING;
        }

        log.debug("复杂度路由(规则): complexity={}, mode={}, input='{}'",
                String.format("%.3f", ruleComplexity), mode,
                userInput != null && userInput.length() > 30 ? userInput.substring(0, 30) + "..." : userInput);

        return mode;
    }

    /**
     * 检查复杂度是否在边界区间
     * 边界区间是规则难以准确判断的灰色地带
     */
    private boolean isInAmbiguousZone(double complexity) {
        // FAST/ANALYSIS 边界
        if (complexity >= AMBIGUOUS_LOWER && complexity <= AMBIGUOUS_UPPER) {
            return true;
        }
        // ANALYSIS/MULTI_AGENT 边界
        if (complexity >= AMBIGUOUS_MID_LOWER && complexity <= AMBIGUOUS_MID_UPPER) {
            return true;
        }
        // MULTI_AGENT/DEEP_REASONING 边界
        if (complexity >= AMBIGUOUS_HIGH_LOWER && complexity <= AMBIGUOUS_HIGH_UPPER) {
            return true;
        }
        return false;
    }

    /**
     * 检查是否应该使用分类器辅助判断
     */
    private boolean shouldUseClassifier() {
        return classifierEnabled &&
               classifier != null &&
               classifier.isTrained();
    }

    @Override
    public double estimateComplexity(String userInput, AnalysisContext context) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return 0.0;
        }

        QueryFeatures features = extractFeatures(userInput, context);

        double score = 0.0;

        // 语言特征评分
        score += features.getQuestionWordCount() * 0.1;  // 每个问句词 +0.1
        score += features.isHasComparisonIndicator() ? 0.2 : 0;  // 比较指示词 +0.2
        score += features.isHasCausalIndicator() ? 0.2 : 0;  // 因果指示词 +0.2
        score += features.isHasTimeRange() ? 0.1 : 0;  // 时间范围 +0.1

        // 意图特征评分
        score += features.getRequiredToolCount() * 0.05;  // 每个工具 +0.05
        score += features.isAnalysisRequest() ? 0.2 : 0;  // 分析请求 +0.2

        // 上下文特征评分
        score += features.getConversationDepth() * 0.02;  // 对话深度每轮 +0.02

        // 上限为 1.0
        return Math.min(score, 1.0);
    }

    @Override
    public QueryFeatures extractFeatures(String userInput, AnalysisContext context) {
        String normalizedInput = userInput != null ? userInput.toLowerCase().trim() : "";

        return QueryFeatures.builder()
                // 语言特征
                .questionWordCount(countMatches(normalizedInput, QUESTION_WORDS))
                .hasComparisonIndicator(containsAny(normalizedInput, COMPARISON_INDICATORS))
                .hasCausalIndicator(containsAny(normalizedInput, CAUSAL_INDICATORS))
                .hasTimeRange(containsAny(normalizedInput, TIME_RANGE_WORDS))

                // 意图特征
                .intentCategory(context != null && context.getTopic() != null ?
                        context.getTopic().name() : null)
                .requiredToolCount(context != null && context.getTopic() != null ?
                        context.getTopic().getRelatedTools().size() : 0)
                .isAnalysisRequest(context != null && context.getTopic() != null)

                // 上下文特征
                .conversationDepth(0)  // TODO: 从会话服务获取
                .hasPriorContext(context != null && context.getSessionId() != null)
                .build();
    }

    /**
     * 统计匹配数量
     */
    private int countMatches(String input, List<String> words) {
        return (int) words.stream()
                .filter(input::contains)
                .count();
    }

    /**
     * 检查是否包含任一词
     */
    private boolean containsAny(String input, List<String> words) {
        return words.stream().anyMatch(input::contains);
    }
}
