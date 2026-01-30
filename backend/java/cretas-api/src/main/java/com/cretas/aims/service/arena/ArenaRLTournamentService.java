package com.cretas.aims.service.arena;

import com.cretas.aims.dto.arena.ComparisonRubric;
import com.cretas.aims.dto.arena.MatchResult;
import com.cretas.aims.dto.arena.TournamentResult;
import com.cretas.aims.dto.intent.IntentMatchResult;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * ArenaRL 锦标赛服务接口
 *
 * 实现基于 ArenaRL 论文的锦标赛算法：
 * - 种子单淘汰制 (Seeded Single Elimination)
 * - 两两比较 (Pairwise Comparison)
 * - LLM Judge 评估
 *
 * <p>核心功能:</p>
 * <ul>
 *   <li>意图识别歧义裁决</li>
 *   <li>工具选择歧义裁决</li>
 *   <li>Agent 分析结果比较</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface ArenaRLTournamentService {

    /**
     * 执行意图识别锦标赛
     *
     * 当多个意图候选置信度接近时，通过两两比较裁决最佳匹配
     *
     * @param userInput 用户输入
     * @param candidates 候选意图列表 (按初始置信度降序)
     * @return 锦标赛结果
     */
    TournamentResult runIntentTournament(String userInput,
                                         List<IntentMatchResult.CandidateIntent> candidates);

    /**
     * 异步执行意图识别锦标赛
     *
     * @param userInput 用户输入
     * @param candidates 候选意图列表
     * @return CompletableFuture 异步结果
     */
    CompletableFuture<TournamentResult> runIntentTournamentAsync(String userInput,
                                                                  List<IntentMatchResult.CandidateIntent> candidates);

    /**
     * 执行工具选择锦标赛
     *
     * 当多个工具候选相似度接近时，通过两两比较裁决最佳工具
     *
     * @param userQuery 用户查询
     * @param toolCandidates 候选工具列表 (key: toolCode, value: 工具信息)
     * @return 锦标赛结果
     */
    TournamentResult runToolTournament(String userQuery,
                                       List<ToolCandidate> toolCandidates);

    /**
     * 异步执行工具选择锦标赛
     *
     * @param userQuery 用户查询
     * @param toolCandidates 候选工具列表
     * @return CompletableFuture 异步结果
     */
    CompletableFuture<TournamentResult> runToolTournamentAsync(String userQuery,
                                                                List<ToolCandidate> toolCandidates);

    /**
     * 执行 Agent 分析结果锦标赛
     *
     * 比较多个 Agent 生成的分析结果，选出最优
     *
     * @param userQuestion 用户问题
     * @param analysisResults 分析结果列表
     * @return 锦标赛结果
     */
    TournamentResult runAnalysisTournament(String userQuestion,
                                           List<AnalysisCandidate> analysisResults);

    /**
     * 执行单次两两比较
     *
     * 使用 LLM Judge 比较两个候选，返回获胜方
     *
     * @param userInput 用户输入
     * @param candidateA 候选 A
     * @param candidateB 候选 B
     * @param rubric 评估量规
     * @return 比赛结果
     */
    MatchResult compareTwo(String userInput,
                           TournamentCandidate candidateA,
                           TournamentCandidate candidateB,
                           ComparisonRubric rubric);

    /**
     * 异步执行单次两两比较
     *
     * @param userInput 用户输入
     * @param candidateA 候选 A
     * @param candidateB 候选 B
     * @param rubric 评估量规
     * @return CompletableFuture 异步结果
     */
    CompletableFuture<MatchResult> compareTwoAsync(String userInput,
                                                   TournamentCandidate candidateA,
                                                   TournamentCandidate candidateB,
                                                   ComparisonRubric rubric);

    /**
     * 检查是否应该触发意图锦标赛
     *
     * @param topCandidates 候选列表 (按置信度降序)
     * @return true 如果满足触发条件
     */
    boolean shouldTriggerIntentTournament(List<IntentMatchResult.CandidateIntent> topCandidates);

    /**
     * 检查是否应该触发工具锦标赛
     *
     * @param toolCandidates 工具候选列表 (按相似度降序)
     * @return true 如果满足触发条件
     */
    boolean shouldTriggerToolTournament(List<ToolCandidate> toolCandidates);

    // ==================== 候选数据类 ====================

    /**
     * 通用锦标赛候选接口
     */
    interface TournamentCandidate {
        String getId();
        String getName();
        String getDescription();
        Double getScore();
        Map<String, Object> getMetadata();
    }

    /**
     * 工具候选数据类
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    class ToolCandidate implements TournamentCandidate {
        private String id;
        private String name;
        private String description;
        private Double score; // 相似度
        private List<String> requiredParams;
        private List<String> optionalParams;
        private String returnType;
        private Map<String, Object> metadata;

        @Override
        public String getId() { return id; }
        @Override
        public String getName() { return name; }
        @Override
        public String getDescription() { return description; }
        @Override
        public Double getScore() { return score; }
        @Override
        public Map<String, Object> getMetadata() { return metadata; }
    }

    /**
     * 分析候选数据类
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    class AnalysisCandidate implements TournamentCandidate {
        private String id;
        private String name;
        private String description;
        private Double score;
        private String analysisContent;
        private List<String> dataPoints;
        private List<String> recommendations;
        private Map<String, Object> metadata;

        @Override
        public String getId() { return id; }
        @Override
        public String getName() { return name; }
        @Override
        public String getDescription() { return description; }
        @Override
        public Double getScore() { return score; }
        @Override
        public Map<String, Object> getMetadata() { return metadata; }
    }
}
