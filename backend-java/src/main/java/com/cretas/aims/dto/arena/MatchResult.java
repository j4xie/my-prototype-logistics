package com.cretas.aims.dto.arena;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

/**
 * ArenaRL 单场比赛结果 DTO
 *
 * 记录两两比较的详细信息：
 * - 参赛双方
 * - 获胜方
 * - 评估维度分数
 * - LLM 推理过程
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class MatchResult {

    /**
     * 比赛唯一标识
     */
    private String matchId;

    /**
     * 比赛轮次 (0 = 种子轮, 1+ = 淘汰轮)
     */
    private Integer round;

    /**
     * 比赛序号 (同轮次内的顺序)
     */
    private Integer matchIndex;

    /**
     * 候选A的标识
     */
    private String candidateAId;

    /**
     * 候选A的名称
     */
    private String candidateAName;

    /**
     * 候选B的标识
     */
    private String candidateBId;

    /**
     * 候选B的名称
     */
    private String candidateBName;

    /**
     * 获胜方标识
     */
    private String winnerId;

    /**
     * 获胜置信度 (0.5-1.0, 0.5=平局)
     */
    private Double winConfidence;

    /**
     * A相对于B的各维度分数
     * key: 维度名称, value: A的分数 (0-1)
     */
    private Map<String, Double> dimensionScores;

    /**
     * LLM 生成的推理过程
     */
    private String reasoning;

    /**
     * 是否为正向比较 (A vs B)
     * 为减少位置偏见，会进行双向比较
     */
    private Boolean isForwardComparison;

    /**
     * 比较耗时 (毫秒)
     */
    private Long latencyMs;

    /**
     * 比赛开始时间
     */
    private Instant startTime;

    /**
     * 比赛结束时间
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
     * 判断 A 是否获胜
     */
    public boolean isAWinner() {
        return candidateAId != null && candidateAId.equals(winnerId);
    }

    /**
     * 判断 B 是否获胜
     */
    public boolean isBWinner() {
        return candidateBId != null && candidateBId.equals(winnerId);
    }

    /**
     * 判断是否平局
     */
    public boolean isTie() {
        return winConfidence != null && Math.abs(winConfidence - 0.5) < 0.05;
    }

    /**
     * 创建失败结果
     */
    public static MatchResult failure(String matchId, int round, int matchIndex,
                                      String candidateAId, String candidateBId,
                                      String errorMessage) {
        return MatchResult.builder()
                .matchId(matchId)
                .round(round)
                .matchIndex(matchIndex)
                .candidateAId(candidateAId)
                .candidateBId(candidateBId)
                .success(false)
                .errorMessage(errorMessage)
                .startTime(Instant.now())
                .endTime(Instant.now())
                .build();
    }
}
