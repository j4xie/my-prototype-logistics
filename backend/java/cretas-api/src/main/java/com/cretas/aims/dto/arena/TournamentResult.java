package com.cretas.aims.dto.arena;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * ArenaRL 锦标赛结果 DTO
 *
 * 包含锦标赛的完整信息：
 * - 获胜候选
 * - 比赛轮次历史
 * - 评估维度分数
 * - 总耗时和成本统计
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class TournamentResult {

    /**
     * 锦标赛唯一标识
     */
    private String tournamentId;

    /**
     * 锦标赛类型
     */
    private TournamentType type;

    /**
     * 获胜候选的标识 (intentCode 或 toolCode)
     */
    private String winnerId;

    /**
     * 获胜候选的名称
     */
    private String winnerName;

    /**
     * 获胜候选的最终置信度
     */
    private Double winnerConfidence;

    /**
     * 所有比赛结果列表 (按时间顺序)
     */
    private List<MatchResult> matches;

    /**
     * 种子排名列表 (初始排名)
     */
    private List<SeedRanking> seedRankings;

    /**
     * 总比较次数
     */
    private Integer totalComparisons;

    /**
     * LLM 调用次数
     */
    private Integer llmCalls;

    /**
     * 总耗时 (毫秒)
     */
    private Long totalLatencyMs;

    /**
     * 估算 Token 消耗
     */
    private Integer estimatedTokens;

    /**
     * 原始用户输入
     */
    private String userInput;

    /**
     * 锦标赛开始时间
     */
    private Instant startTime;

    /**
     * 锦标赛结束时间
     */
    private Instant endTime;

    /**
     * 是否成功完成
     */
    private Boolean success;

    /**
     * 错误信息 (如果失败)
     */
    private String errorMessage;

    /**
     * 锦标赛类型枚举
     */
    public enum TournamentType {
        /**
         * 意图识别锦标赛
         */
        INTENT_DISAMBIGUATION,

        /**
         * 工具选择锦标赛
         */
        TOOL_SELECTION,

        /**
         * Agent 分析候选锦标赛
         */
        AGENT_ANALYSIS
    }

    /**
     * 种子排名内部类
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SeedRanking {
        /**
         * 候选标识
         */
        private String candidateId;

        /**
         * 候选名称
         */
        private String candidateName;

        /**
         * 原始置信度/相似度
         */
        private Double originalScore;

        /**
         * 种子排名 (1 = 最高种子)
         */
        private Integer seedRank;
    }

    /**
     * 创建失败结果
     */
    public static TournamentResult failure(String tournamentId, TournamentType type,
                                           String userInput, String errorMessage) {
        return TournamentResult.builder()
                .tournamentId(tournamentId)
                .type(type)
                .userInput(userInput)
                .success(false)
                .errorMessage(errorMessage)
                .startTime(Instant.now())
                .endTime(Instant.now())
                .totalComparisons(0)
                .llmCalls(0)
                .totalLatencyMs(0L)
                .build();
    }
}
