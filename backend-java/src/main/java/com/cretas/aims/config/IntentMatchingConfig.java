package com.cretas.aims.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.Positive;

/**
 * AI意图匹配配置
 * 统一管理所有意图匹配相关的配置参数
 *
 * <p>配置前缀: cretas.ai.intent</p>
 *
 * <p>使用示例（application.properties）:</p>
 * <pre>
 * cretas.ai.intent.llm-fallback.enabled=true
 * cretas.ai.intent.llm-fallback.confidence-threshold=0.3
 * cretas.ai.intent.auto-learn.enabled=true
 * cretas.ai.intent.semantic.high-threshold=0.85
 * </pre>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Configuration
@ConfigurationProperties(prefix = "cretas.ai.intent")
@Data
@Validated
public class IntentMatchingConfig {

    /**
     * LLM Fallback 配置
     */
    private LlmFallbackConfig llmFallback = new LlmFallbackConfig();

    /**
     * LLM 澄清问题配置
     */
    private LlmClarificationConfig llmClarification = new LlmClarificationConfig();

    /**
     * 意图匹配记录配置
     */
    private RecordingConfig recording = new RecordingConfig();

    /**
     * 自动学习配置
     */
    private AutoLearnConfig autoLearn = new AutoLearnConfig();

    /**
     * 语义匹配配置
     */
    private SemanticMatchConfig semantic = new SemanticMatchConfig();

    /**
     * 匹配权重配置
     */
    private MatchingWeightConfig weight = new MatchingWeightConfig();

    /**
     * 并行评分权重配置
     */
    private ParallelScoreConfig parallelScore = new ParallelScoreConfig();

    // ==================== 内部配置类 ====================

    /**
     * LLM Fallback 配置
     */
    @Data
    public static class LlmFallbackConfig {
        /**
         * 是否启用 LLM 降级
         */
        private boolean enabled = true;

        /**
         * LLM 触发的置信度阈值（低于此值触发 LLM）
         * v4.2: 提高至0.65，让更多低置信度匹配走LLM验证
         */
        @Min(0) @Max(1)
        private double confidenceThreshold = 0.65;

        /**
         * LLM 服务超时时间(ms)
         */
        @Positive
        private int timeout = 10000;

        /**
         * 是否启用两阶段分类（粗分类 + 细分类）
         *
         * 当意图数量较多（如 90+）时，启用两阶段分类可以提高准确率：
         * - 第一阶段：从 15 个 Category 中选择粗分类
         * - 第二阶段：在选中的 Category 内进行细分类
         *
         * 默认启用，适用于意图数量超过 50 的场景
         */
        private boolean twoPhaseClassificationEnabled = true;

        /**
         * 触发两阶段分类的意图数量阈值
         * 当可用意图数量超过此值时，自动启用两阶段分类
         * 默认值：50（低于此值使用单阶段分类即可）
         */
        @Positive
        private int twoPhaseThreshold = 50;
    }

    /**
     * LLM 澄清问题配置
     */
    @Data
    public static class LlmClarificationConfig {
        /**
         * 是否使用 LLM 生成澄清问题
         */
        private boolean enabled = true;
    }

    /**
     * 意图匹配记录配置
     */
    @Data
    public static class RecordingConfig {
        /**
         * 是否启用意图匹配记录
         */
        private boolean enabled = true;
    }

    /**
     * 自动学习配置
     */
    @Data
    public static class AutoLearnConfig {
        /**
         * 是否启用自动关键词学习
         */
        private boolean enabled = true;

        /**
         * 高置信度阈值（>= 此值学习关键词+表达）
         */
        @Min(0) @Max(1)
        private double confidenceThreshold = 0.85;

        /**
         * 中置信度阈值（>= 此值只学习表达，不学关键词）
         */
        @Min(0) @Max(1)
        private double expressionThreshold = 0.70;

        /**
         * 样本收集配置
         */
        private SampleCollectionConfig sampleCollection = new SampleCollectionConfig();

        /**
         * 每个意图最大关键词数量
         */
        @Positive
        private int maxKeywordsPerIntent = 50;

        /**
         * 每次学习的最大新关键词数量
         */
        @Positive
        private int maxNewKeywordsPerInput = 3;

        /**
         * 关键词最小长度
         */
        @Positive
        private int minKeywordLength = 2;

        /**
         * 关键词最大长度
         */
        @Positive
        private int maxKeywordLength = 20;
    }

    /**
     * 样本收集配置
     */
    @Data
    public static class SampleCollectionConfig {
        /**
         * 是否收集训练样本（用于未来模型微调）
         */
        private boolean enabled = true;
    }

    /**
     * 语义匹配配置
     */
    @Data
    public static class SemanticMatchConfig {
        /**
         * 是否启用语义匹配
         */
        private boolean enabled = true;

        /**
         * 语义匹配高置信度阈值（>= 此值直接使用语义结果）
         */
        @Min(0) @Max(1)
        private double highThreshold = 0.85;

        /**
         * 语义匹配中置信度阈值（此值到高阈值之间使用融合评分）
         */
        @Min(0) @Max(1)
        private double mediumThreshold = 0.72;

        /**
         * 语义匹配低置信度阈值
         */
        @Min(0) @Max(1)
        private double lowThreshold = 0.60;

        /**
         * 融合评分中语义权重（默认60%）
         */
        @Min(0) @Max(1)
        private double fusionSemanticWeight = 0.6;

        /**
         * 融合评分中关键词权重（默认40%）
         */
        @Min(0) @Max(1)
        private double fusionKeywordWeight = 0.4;

        /**
         * embedding 维度
         */
        @Positive
        private int embeddingDimension = 768;

        /**
         * 是否启用语义缓存
         */
        private boolean cacheEnabled = true;
    }

    /**
     * 匹配权重配置
     */
    @Data
    public static class MatchingWeightConfig {
        /**
         * 正则匹配基础分数 (最高优先级)
         */
        @Positive
        private int regexMatchScore = 100;

        /**
         * 每个关键词匹配的分数
         */
        @Positive
        private int keywordMatchScore = 10;

        /**
         * 操作类型匹配加分
         */
        @Positive
        private int operationTypeMatchBonus = 25;

        /**
         * 操作类型不匹配减分
         */
        @Positive
        private int operationTypeMismatchPenalty = 20;

        /**
         * 精确匹配权重系数（用于归一化计算）
         */
        @Min(0) @Max(1)
        private double exactMatchWeight = 1.0;

        /**
         * 正则匹配权重系数
         */
        @Min(0) @Max(1)
        private double regexMatchWeight = 0.95;

        /**
         * 关键词匹配权重系数
         */
        @Min(0) @Max(1)
        private double keywordMatchWeight = 0.85;

        /**
         * 语义匹配权重系数
         */
        @Min(0) @Max(1)
        private double semanticMatchWeight = 0.75;
    }

    /**
     * 并行评分权重配置
     */
    @Data
    public static class ParallelScoreConfig {
        /**
         * 短语精确匹配权重
         */
        @Min(0) @Max(2)
        private double phraseWeight = 1.0;

        /**
         * 语义向量匹配权重
         */
        @Min(0) @Max(2)
        private double semanticWeight = 0.6;

        /**
         * 关键词匹配权重
         */
        @Min(0) @Max(2)
        private double keywordWeight = 0.25;

        /**
         * 领域匹配加分
         */
        @Min(0) @Max(1)
        private double domainBonus = 0.15;

        /**
         * 操作类型匹配加分
         */
        @Min(0) @Max(1)
        private double operationTypeBonus = 0.10;

        /**
         * 负向关键词惩罚
         */
        @Min(0) @Max(1)
        private double negativeKeywordPenalty = 0.15;

        /**
         * 关键词递减收益权重数组
         */
        private double[] keywordDiminishingWeights = {0.30, 0.25, 0.20, 0.15, 0.10};

        /**
         * 递减收益后续关键词的固定权重
         */
        @Min(0) @Max(1)
        private double keywordTailWeight = 0.05;
    }

    // ==================== 便捷方法 ====================

    /**
     * 检查 LLM Fallback 是否启用
     */
    public boolean isLlmFallbackEnabled() {
        return llmFallback.isEnabled();
    }

    /**
     * 获取 LLM Fallback 置信度阈值
     */
    public double getLlmFallbackConfidenceThreshold() {
        return llmFallback.getConfidenceThreshold();
    }

    /**
     * 检查 LLM 澄清问题生成是否启用
     */
    public boolean isLlmClarificationEnabled() {
        return llmClarification.isEnabled();
    }

    /**
     * 检查意图匹配记录是否启用
     */
    public boolean isRecordingEnabled() {
        return recording.isEnabled();
    }

    /**
     * 检查自动学习是否启用
     */
    public boolean isAutoLearnEnabled() {
        return autoLearn.isEnabled();
    }

    /**
     * 获取自动学习高置信度阈值
     */
    public double getAutoLearnConfidenceThreshold() {
        return autoLearn.getConfidenceThreshold();
    }

    /**
     * 获取自动学习表达阈值
     */
    public double getAutoLearnExpressionThreshold() {
        return autoLearn.getExpressionThreshold();
    }

    /**
     * 检查样本收集是否启用
     */
    public boolean isSampleCollectionEnabled() {
        return autoLearn.getSampleCollection().isEnabled();
    }

    /**
     * 获取每个意图最大关键词数量
     */
    public int getMaxKeywordsPerIntent() {
        return autoLearn.getMaxKeywordsPerIntent();
    }

    /**
     * 检查语义匹配是否启用
     */
    public boolean isSemanticMatchEnabled() {
        return semantic.isEnabled();
    }

    /**
     * 获取语义高阈值
     */
    public double getSemanticHighThreshold() {
        return semantic.getHighThreshold();
    }

    /**
     * 获取语义中阈值
     */
    public double getSemanticMediumThreshold() {
        return semantic.getMediumThreshold();
    }

    /**
     * 获取融合评分语义权重
     */
    public double getFusionSemanticWeight() {
        return semantic.getFusionSemanticWeight();
    }

    /**
     * 获取融合评分关键词权重
     */
    public double getFusionKeywordWeight() {
        return semantic.getFusionKeywordWeight();
    }

    /**
     * 获取正则匹配分数
     */
    public int getRegexMatchScore() {
        return weight.getRegexMatchScore();
    }

    /**
     * 获取关键词匹配分数
     */
    public int getKeywordMatchScore() {
        return weight.getKeywordMatchScore();
    }

    /**
     * 获取操作类型匹配加分
     */
    public int getOperationTypeMatchBonus() {
        return weight.getOperationTypeMatchBonus();
    }

    /**
     * 获取操作类型不匹配减分
     */
    public int getOperationTypeMismatchPenalty() {
        return weight.getOperationTypeMismatchPenalty();
    }

    /**
     * 检查两阶段分类是否启用
     */
    public boolean isTwoPhaseClassificationEnabled() {
        return llmFallback.isTwoPhaseClassificationEnabled();
    }

    /**
     * 获取触发两阶段分类的意图数量阈值
     */
    public int getTwoPhaseThreshold() {
        return llmFallback.getTwoPhaseThreshold();
    }
}
