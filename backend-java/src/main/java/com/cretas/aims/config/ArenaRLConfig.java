package com.cretas.aims.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.Positive;

/**
 * ArenaRL 锦标赛配置
 * 统一管理 ArenaRL 相关的配置参数
 *
 * <p>配置前缀: cretas.ai.arena-rl</p>
 *
 * <p>使用示例（application.properties）:</p>
 * <pre>
 * cretas.ai.arena-rl.enabled=true
 * cretas.ai.arena-rl.intent-disambiguation.enabled=true
 * cretas.ai.arena-rl.intent-disambiguation.ambiguity-threshold=0.15
 * </pre>
 *
 * <p>ArenaRL 触发条件:</p>
 * <ul>
 *   <li>意图识别: top1-top2 置信度差 &lt; 0.15</li>
 *   <li>工具选择: top1-top2 相似度差 &lt; 0.10</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Configuration
@ConfigurationProperties(prefix = "cretas.ai.arena-rl")
@Data
@Validated
public class ArenaRLConfig {

    /**
     * 是否全局启用 ArenaRL
     */
    private boolean enabled = true;

    // ==================== v13.0: 混淆对配置 ====================

    /**
     * 混淆意图对及其最小置信度差距要求
     * 当检测到这些意图对时，需要更严格的置信度差距才能确定意图
     */
    private static final java.util.Map<java.util.Set<String>, Double> CONFUSING_PAIRS_MIN_GAP;
    static {
        CONFUSING_PAIRS_MIN_GAP = new java.util.HashMap<>();
        CONFUSING_PAIRS_MIN_GAP.put(java.util.Set.of("PROCESSING_BATCH_LIST", "PROCESSING_BATCH_TIMELINE"), 0.20);
        CONFUSING_PAIRS_MIN_GAP.put(java.util.Set.of("MATERIAL_EXPIRING_ALERT", "MATERIAL_EXPIRED_QUERY"), 0.25);
        CONFUSING_PAIRS_MIN_GAP.put(java.util.Set.of("QUALITY_STATS", "REPORT_QUALITY"), 0.15);
        CONFUSING_PAIRS_MIN_GAP.put(java.util.Set.of("PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY"), 0.18);
        CONFUSING_PAIRS_MIN_GAP.put(java.util.Set.of("SUPPLIER_LIST", "SUPPLIER_QUERY"), 0.15);
    }

    /**
     * 检查是否为混淆意图对
     *
     * @param intent1 意图1
     * @param intent2 意图2
     * @return true 如果是混淆对
     */
    public boolean isConfusingPair(String intent1, String intent2) {
        if (intent1 == null || intent2 == null) return false;
        java.util.Set<String> pair = java.util.Set.of(intent1, intent2);
        return CONFUSING_PAIRS_MIN_GAP.containsKey(pair);
    }

    /**
     * 获取混淆对的最小置信度差距要求
     *
     * @param intent1 意图1
     * @param intent2 意图2
     * @return 最小差距要求，如果不是混淆对返回默认阈值
     */
    public double getConfusingPairMinGap(String intent1, String intent2) {
        if (intent1 == null || intent2 == null) {
            return intentDisambiguation.getAmbiguityThreshold();
        }
        java.util.Set<String> pair = java.util.Set.of(intent1, intent2);
        return CONFUSING_PAIRS_MIN_GAP.getOrDefault(pair, intentDisambiguation.getAmbiguityThreshold());
    }

    /**
     * 判断混淆对是否需要强制 ArenaRL 裁决
     *
     * @param intent1 意图1
     * @param intent2 意图2
     * @param confidenceGap 当前置信度差距
     * @return true 如果需要强制 ArenaRL
     */
    public boolean shouldForceArenaRL(String intent1, String intent2, double confidenceGap) {
        if (!isConfusingPair(intent1, intent2)) {
            return false;
        }
        double minGap = getConfusingPairMinGap(intent1, intent2);
        return confidenceGap < minGap;
    }

    /**
     * 意图识别锦标赛配置
     */
    private IntentDisambiguationConfig intentDisambiguation = new IntentDisambiguationConfig();

    /**
     * 工具选择锦标赛配置
     */
    private ToolSelectionConfig toolSelection = new ToolSelectionConfig();

    /**
     * Agent 分析锦标赛配置
     */
    private AgentAnalysisConfig agentAnalysis = new AgentAnalysisConfig();

    /**
     * LLM 调用配置
     */
    private LlmConfig llm = new LlmConfig();

    /**
     * 性能配置
     */
    private PerformanceConfig performance = new PerformanceConfig();

    // ==================== 内部配置类 ====================

    /**
     * 意图识别锦标赛配置
     */
    @Data
    public static class IntentDisambiguationConfig {
        /**
         * 是否启用意图识别锦标赛
         */
        private boolean enabled = true;

        /**
         * 歧义检测阈值
         * 当 top1-top2 置信度差 < 此值时触发锦标赛
         */
        @Min(0) @Max(1)
        private double ambiguityThreshold = 0.15;

        /**
         * 最小触发置信度
         * 当 top1 置信度 < 此值时才考虑触发锦标赛
         * 高于此值说明已经足够确定，不需要锦标赛
         */
        @Min(0) @Max(1)
        private double minTriggerConfidence = 0.85;

        /**
         * 最大候选数量
         * 参与锦标赛的最大候选意图数量
         */
        @Positive
        private int maxCandidates = 4;

        /**
         * 锦标赛模式
         */
        private TournamentMode mode = TournamentMode.SEEDED_SINGLE_ELIMINATION;
    }

    /**
     * 工具选择锦标赛配置
     */
    @Data
    public static class ToolSelectionConfig {
        /**
         * 是否启用工具选择锦标赛
         */
        private boolean enabled = true;

        /**
         * 歧义检测阈值
         * 当 top1-top2 相似度差 < 此值时触发锦标赛
         */
        @Min(0) @Max(1)
        private double ambiguityThreshold = 0.10;

        /**
         * 最小触发相似度
         * 当 top1 相似度 < 此值时才考虑触发锦标赛
         */
        @Min(0) @Max(1)
        private double minTriggerSimilarity = 0.80;

        /**
         * 最大候选数量
         */
        @Positive
        private int maxCandidates = 4;

        /**
         * 锦标赛模式
         */
        private TournamentMode mode = TournamentMode.SEEDED_SINGLE_ELIMINATION;
    }

    /**
     * Agent 分析锦标赛配置
     */
    @Data
    public static class AgentAnalysisConfig {
        /**
         * 是否启用 Agent 分析锦标赛
         */
        private boolean enabled = false;

        /**
         * 最大候选数量
         */
        @Positive
        private int maxCandidates = 3;

        /**
         * 锦标赛模式
         */
        private TournamentMode mode = TournamentMode.SEEDED_SINGLE_ELIMINATION;
    }

    /**
     * LLM 配置
     */
    @Data
    public static class LlmConfig {
        /**
         * 使用的模型名称
         * 推荐: qwen-turbo (快速) 或 qwen-plus (准确)
         */
        private String model = "qwen-turbo";

        /**
         * 单次比较超时时间 (毫秒)
         */
        @Positive
        private int comparisonTimeoutMs = 10000;

        /**
         * 是否启用双向比较 (减少位置偏见)
         * 启用后每对候选会比较两次: A vs B 和 B vs A
         * 注意: 会使 LLM 调用次数翻倍
         */
        private boolean bidirectionalComparison = false;

        /**
         * 双向比较置信度差异阈值
         * 如果两次比较结果差异 > 此值，使用更保守的估计
         */
        @Min(0) @Max(1)
        private double bidirectionalDiscrepancyThreshold = 0.2;

        /**
         * 比较 Prompt 的最大 Token 数
         */
        @Positive
        private int maxPromptTokens = 2000;

        /**
         * 响应的最大 Token 数
         */
        @Positive
        private int maxResponseTokens = 500;

        /**
         * LLM 温度参数
         */
        @Min(0) @Max(2)
        private double temperature = 0.3;
    }

    /**
     * 性能配置
     */
    @Data
    public static class PerformanceConfig {
        /**
         * 整体超时时间 (毫秒)
         */
        @Positive
        private int totalTimeoutMs = 15000;

        /**
         * 最大 LLM 调用次数
         */
        @Positive
        private int maxLlmCalls = 10;

        /**
         * 是否启用结果缓存
         * 相同候选对的比较结果可复用
         */
        private boolean cacheEnabled = true;

        /**
         * 缓存过期时间 (秒)
         */
        @Positive
        private int cacheTtlSeconds = 300;

        /**
         * 是否启用异步执行
         */
        private boolean asyncEnabled = true;
    }

    /**
     * 锦标赛模式枚举
     */
    public enum TournamentMode {
        /**
         * 种子单淘汰制
         * 按初始分数排种子，种子赛+淘汰赛
         * 复杂度: O(N-1) 次比较
         */
        SEEDED_SINGLE_ELIMINATION,

        /**
         * 简单单淘汰制
         * 随机配对，直接淘汰
         * 复杂度: O(N-1) 次比较
         */
        SIMPLE_SINGLE_ELIMINATION,

        /**
         * 瑞士轮制
         * 多轮积分，不完全淘汰
         * 复杂度: O(N log N) 次比较
         */
        SWISS_SYSTEM,

        /**
         * 全配对制 (Round Robin)
         * 所有候选两两比较
         * 复杂度: O(N²) 次比较
         */
        ROUND_ROBIN
    }

    // ==================== 便捷方法 ====================

    /**
     * 检查意图识别锦标赛是否启用
     */
    public boolean isIntentDisambiguationEnabled() {
        return enabled && intentDisambiguation.isEnabled();
    }

    /**
     * 检查工具选择锦标赛是否启用
     */
    public boolean isToolSelectionEnabled() {
        return enabled && toolSelection.isEnabled();
    }

    /**
     * 检查 Agent 分析锦标赛是否启用
     */
    public boolean isAgentAnalysisEnabled() {
        return enabled && agentAnalysis.isEnabled();
    }

    /**
     * 判断意图识别是否需要触发锦标赛
     *
     * @param top1Confidence top1 置信度
     * @param top2Confidence top2 置信度
     * @return true 如果需要锦标赛
     */
    public boolean shouldTriggerIntentTournament(double top1Confidence, double top2Confidence) {
        if (!isIntentDisambiguationEnabled()) {
            return false;
        }
        // top1 已经很高，不需要锦标赛
        if (top1Confidence >= intentDisambiguation.getMinTriggerConfidence()) {
            return false;
        }
        // 差距足够大，不需要锦标赛
        double gap = top1Confidence - top2Confidence;
        return gap < intentDisambiguation.getAmbiguityThreshold();
    }

    /**
     * 判断工具选择是否需要触发锦标赛
     *
     * @param top1Similarity top1 相似度
     * @param top2Similarity top2 相似度
     * @return true 如果需要锦标赛
     */
    public boolean shouldTriggerToolTournament(double top1Similarity, double top2Similarity) {
        if (!isToolSelectionEnabled()) {
            return false;
        }
        if (top1Similarity >= toolSelection.getMinTriggerSimilarity()) {
            return false;
        }
        double gap = top1Similarity - top2Similarity;
        return gap < toolSelection.getAmbiguityThreshold();
    }

    /**
     * 获取意图锦标赛最大候选数
     */
    public int getIntentMaxCandidates() {
        return intentDisambiguation.getMaxCandidates();
    }

    /**
     * 获取工具锦标赛最大候选数
     */
    public int getToolMaxCandidates() {
        return toolSelection.getMaxCandidates();
    }

    /**
     * 获取 LLM 配置
     */
    public LlmConfig getLlmConfig() {
        return llm;
    }

    /**
     * 获取性能配置
     */
    public PerformanceConfig getPerformanceConfig() {
        return performance;
    }
}
