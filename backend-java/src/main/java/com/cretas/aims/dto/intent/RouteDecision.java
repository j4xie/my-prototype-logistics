package com.cretas.aims.dto.intent;

import com.cretas.aims.entity.config.AIIntentConfig;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 语义路由决策 DTO
 *
 * 用于 SemanticRouterService 的路由决策结果，包含:
 * - 路由类型 (DirectExecute / NeedReranking / NeedFullLLM)
 * - 匹配的意图配置
 * - 相似度分数
 * - 候选意图列表
 *
 * 路由策略:
 * - score >= 0.92: DirectExecute - 直接执行，跳过LLM
 * - score >= 0.75: NeedReranking - 走关键词+LLM Reranking
 * - score < 0.75: NeedFullLLM - 走完整LLM Fallback
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RouteDecision {

    /**
     * 路由类型
     */
    private RouteType routeType;

    /**
     * 最佳匹配的意图配置
     * 当 routeType 为 DirectExecute 或 NeedReranking 时有值
     */
    private AIIntentConfig bestMatchIntent;

    /**
     * 最佳匹配的意图代码
     */
    private String bestMatchIntentCode;

    /**
     * 最高相似度分数 (0.0 - 1.0)
     */
    private double topScore;

    /**
     * 候选意图列表 (按相似度降序)
     * 包含 Top-N 个候选，用于 Reranking
     */
    private List<CandidateMatch> candidates;

    /**
     * 用户输入
     */
    private String userInput;

    /**
     * 路由耗时 (毫秒)
     */
    private long routeLatencyMs;

    /**
     * 是否使用了缓存
     */
    @Builder.Default
    private boolean cacheHit = false;

    /**
     * 路由类型枚举
     */
    public enum RouteType {
        /**
         * 直接执行 (score >= 0.92)
         * 高置信度，跳过LLM，直接返回意图
         */
        DIRECT_EXECUTE,

        /**
         * 需要 Reranking (0.75 <= score < 0.92)
         * 中等置信度，需要关键词匹配或LLM Reranking 确认
         */
        NEED_RERANKING,

        /**
         * 需要完整 LLM (score < 0.75)
         * 低置信度，需要走完整 LLM Fallback 流程
         */
        NEED_FULL_LLM
    }

    /**
     * 候选匹配内部类
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CandidateMatch {
        /**
         * 意图代码
         */
        private String intentCode;

        /**
         * 意图名称
         */
        private String intentName;

        /**
         * 意图描述
         */
        private String description;

        /**
         * 相似度分数 (0.0 - 1.0)
         */
        private double score;

        /**
         * 意图配置 (可选)
         */
        private AIIntentConfig intentConfig;

        /**
         * 从 AIIntentConfig 创建候选匹配
         */
        public static CandidateMatch fromConfig(AIIntentConfig config, double score) {
            return CandidateMatch.builder()
                    .intentCode(config.getIntentCode())
                    .intentName(config.getIntentName())
                    .description(config.getDescription())
                    .score(score)
                    .intentConfig(config)
                    .build();
        }
    }

    /**
     * 创建直接执行的路由决策
     */
    public static RouteDecision directExecute(AIIntentConfig intent, double score,
                                               List<CandidateMatch> candidates,
                                               String userInput, long latencyMs) {
        return RouteDecision.builder()
                .routeType(RouteType.DIRECT_EXECUTE)
                .bestMatchIntent(intent)
                .bestMatchIntentCode(intent.getIntentCode())
                .topScore(score)
                .candidates(candidates)
                .userInput(userInput)
                .routeLatencyMs(latencyMs)
                .build();
    }

    /**
     * 创建需要 Reranking 的路由决策
     */
    public static RouteDecision needReranking(AIIntentConfig intent, double score,
                                               List<CandidateMatch> candidates,
                                               String userInput, long latencyMs) {
        return RouteDecision.builder()
                .routeType(RouteType.NEED_RERANKING)
                .bestMatchIntent(intent)
                .bestMatchIntentCode(intent != null ? intent.getIntentCode() : null)
                .topScore(score)
                .candidates(candidates)
                .userInput(userInput)
                .routeLatencyMs(latencyMs)
                .build();
    }

    /**
     * 创建需要完整 LLM 的路由决策
     */
    public static RouteDecision needFullLLM(double topScore, List<CandidateMatch> candidates,
                                             String userInput, long latencyMs) {
        return RouteDecision.builder()
                .routeType(RouteType.NEED_FULL_LLM)
                .bestMatchIntent(null)
                .bestMatchIntentCode(null)
                .topScore(topScore)
                .candidates(candidates)
                .userInput(userInput)
                .routeLatencyMs(latencyMs)
                .build();
    }

    /**
     * 判断是否可以直接执行
     */
    public boolean canDirectExecute() {
        return routeType == RouteType.DIRECT_EXECUTE && bestMatchIntent != null;
    }

    /**
     * 判断是否需要 Reranking
     */
    public boolean needsReranking() {
        return routeType == RouteType.NEED_RERANKING;
    }

    /**
     * 判断是否需要完整 LLM
     */
    public boolean needsFullLLM() {
        return routeType == RouteType.NEED_FULL_LLM;
    }

    /**
     * 获取路由类型的中文描述
     */
    public String getRouteTypeDescription() {
        if (routeType == null) {
            return "未知";
        }
        switch (routeType) {
            case DIRECT_EXECUTE:
                return "直接执行";
            case NEED_RERANKING:
                return "需要Reranking";
            case NEED_FULL_LLM:
                return "需要完整LLM";
            default:
                return "未知";
        }
    }
}
