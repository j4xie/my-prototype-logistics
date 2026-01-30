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

    /**
     * LLM Reranking 配置
     * 用于中置信度区间 (0.58-0.85) 的二次确认
     */
    private LlmRerankingConfig llmReranking = new LlmRerankingConfig();

    /**
     * v6.0 语义优先架构配置
     * 将语义匹配从"并行评分因子"提升为"第一优先级路由"
     */
    private SemanticFirstConfig semanticFirst = new SemanticFirstConfig();

    /**
     * v21.0 歧义检测配置
     * 用于 PhraseMatch 置信度校准
     */
    private AmbiguityDetectionConfig ambiguityDetection = new AmbiguityDetectionConfig();

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
         * v5.0: 降低至0.58，让更多中等置信度匹配走LLM验证，提高准确率
         */
        @Min(0) @Max(1)
        private double confidenceThreshold = 0.58;

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
     * LLM Reranking 配置
     * 用于中置信度区间的语义评分 + LLM 双保险机制
     */
    @Data
    public static class LlmRerankingConfig {
        /**
         * 是否启用 LLM Reranking
         * 启用后，中置信度区间 (confidenceLowerBound - confidenceUpperBound) 会触发 LLM 重排序
         */
        private boolean enabled = true;

        /**
         * Reranking 触发的置信度下限
         * 低于此值走 LLM Fallback (完整分类)
         */
        @Min(0) @Max(1)
        private double confidenceLowerBound = 0.58;

        /**
         * Reranking 触发的置信度上限
         * 高于此值直接返回语义评分结果
         */
        @Min(0) @Max(1)
        private double confidenceUpperBound = 0.85;

        /**
         * Reranking 时传递给 LLM 的候选数量
         * 默认传递 Top-3 候选意图
         */
        @Positive
        private int topCandidatesCount = 3;

        /**
         * LLM Reranking 超时时间 (ms)
         */
        @Positive
        private int timeout = 8000;

        /**
         * 是否在 Reranking 时包含意图示例
         * 启用后会将 example_queries 传给 LLM 作为参考
         */
        private boolean includeExamples = true;

        /**
         * Reranking 成功后的最小置信度提升阈值
         * LLM 确认的意图，置信度至少提升此值
         */
        @Min(0) @Max(1)
        private double confidenceBoostMin = 0.1;
    }

    /**
     * v6.0 语义优先架构配置
     * 核心改革: 将语义匹配从"并行评分因子"提升为"第一优先级路由"
     */
    @Data
    public static class SemanticFirstConfig {
        /**
         * 是否启用语义优先架构
         * 启用后使用语义路由+精确验证模式，替代并行评分模式
         */
        private boolean enabled = true;

        /**
         * 高置信度阈值 - 语义路由直接返回的置信度门槛
         * 语义分数 >= 此值时直接返回，不经过精确验证层
         */
        @Min(0) @Max(1)
        private double highConfidenceThreshold = 0.85;

        /**
         * 短语验证加分 - 语义结果被短语匹配确认时的加分
         */
        @Min(0) @Max(1)
        private double phraseVerificationBonus = 0.15;

        /**
         * 关键词验证加分 - 语义结果命中意图特征词时的加分
         */
        @Min(0) @Max(1)
        private double keywordVerificationBonus = 0.10;

        /**
         * 粒度不匹配惩罚 - 用户输入粒度与意图粒度不一致时的扣分
         */
        @Min(0) @Max(1)
        private double granularityMismatchPenalty = 0.20;

        /**
         * 域不匹配惩罚 - 用户输入领域与意图领域不一致时的扣分
         */
        @Min(0) @Max(1)
        private double domainMismatchPenalty = 0.25;

        /**
         * 域匹配加分 - 用户输入领域与意图领域一致时的加分
         */
        @Min(0) @Max(1)
        private double domainMatchBonus = 0.05;
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

    /**
     * v21.0 歧义检测配置
     * 用于检测 PhraseMatch 可能出错的情况，并进行置信度校准
     */
    @Data
    public static class AmbiguityDetectionConfig {
        /**
         * 是否启用歧义检测
         */
        private boolean enabled = true;

        /**
         * ActionType 冲突时的置信度惩罚
         * 例如：检测到 CREATE 动作但匹配到 LIST 意图
         */
        @Min(0) @Max(1)
        private double actionConflictPenalty = 0.25;

        /**
         * 时间修饰词 + LIST 意图时的置信度惩罚
         * 例如："最近的发货记录" 可能需要 STATS 而非 LIST
         */
        @Min(0) @Max(1)
        private double timeWithListPenalty = 0.15;

        /**
         * 疑问句 + 非查询意图时的置信度惩罚
         * 例如："能修改吗" 是查询而非实际的修改操作
         */
        @Min(0) @Max(1)
        private double questionWithNonQueryPenalty = 0.20;

        /**
         * 多个语气词时的置信度惩罚
         * 表示用户表达可能不够清晰
         */
        @Min(0) @Max(1)
        private double modalParticlesPenalty = 0.10;

        /**
         * 校准后的最小置信度
         * 即使有多个歧义信号，置信度也不会低于此值
         */
        @Min(0) @Max(1)
        private double minCalibratedConfidence = 0.55;

        /**
         * 高置信度阈值
         * 校准后置信度 >= 此值时，直接返回 PhraseMatch 结果
         * 校准后置信度 < 此值时，触发 LLM Reranking
         */
        @Min(0) @Max(1)
        private double highConfidenceThreshold = 0.85;
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

    // ==================== LLM Reranking 便捷方法 ====================

    /**
     * 检查 LLM Reranking 是否启用
     */
    public boolean isLlmRerankingEnabled() {
        return llmReranking.isEnabled();
    }

    /**
     * 获取 Reranking 置信度下限
     */
    public double getLlmRerankingLowerBound() {
        return llmReranking.getConfidenceLowerBound();
    }

    /**
     * 获取 Reranking 置信度上限
     */
    public double getLlmRerankingUpperBound() {
        return llmReranking.getConfidenceUpperBound();
    }

    /**
     * 获取 Reranking 候选数量
     */
    public int getLlmRerankingTopCandidates() {
        return llmReranking.getTopCandidatesCount();
    }

    /**
     * 判断置信度是否在 Reranking 区间内
     * @param confidence 置信度
     * @return true 如果在 [lowerBound, upperBound) 区间内
     */
    public boolean isInRerankingRange(double confidence) {
        return confidence >= llmReranking.getConfidenceLowerBound()
                && confidence < llmReranking.getConfidenceUpperBound();
    }

    /**
     * 获取 Reranking 配置
     */
    public LlmRerankingConfig getLlmRerankingConfig() {
        return llmReranking;
    }

    // ==================== v6.0 语义优先配置访问器 ====================

    /**
     * 判断是否启用语义优先架构
     */
    public boolean isSemanticFirstEnabled() {
        return semanticFirst.isEnabled();
    }

    /**
     * 获取语义优先高置信度阈值
     */
    public double getSemanticFirstHighThreshold() {
        return semanticFirst.getHighConfidenceThreshold();
    }

    /**
     * 获取语义优先配置
     */
    public SemanticFirstConfig getSemanticFirstConfig() {
        return semanticFirst;
    }

    // ==================== v21.0 歧义检测便捷方法 ====================

    /**
     * 检查歧义检测是否启用
     */
    public boolean isAmbiguityDetectionEnabled() {
        return ambiguityDetection.isEnabled();
    }

    /**
     * 获取 ActionType 冲突惩罚值
     */
    public double getActionConflictPenalty() {
        return ambiguityDetection.getActionConflictPenalty();
    }

    /**
     * 获取歧义检测的最小校准置信度
     */
    public double getMinCalibratedConfidence() {
        return ambiguityDetection.getMinCalibratedConfidence();
    }

    /**
     * 获取歧义检测高置信度阈值
     */
    public double getAmbiguityHighConfidenceThreshold() {
        return ambiguityDetection.getHighConfidenceThreshold();
    }

    /**
     * 获取歧义检测配置
     */
    public AmbiguityDetectionConfig getAmbiguityDetectionConfig() {
        return ambiguityDetection;
    }
}
