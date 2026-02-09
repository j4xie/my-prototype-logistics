package com.cretas.aims.service;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 置信度校准服务接口
 *
 * 实现多源置信度融合:
 * - LLM 自评估置信度 (权重 0.4)
 * - 语义相似度分数 (权重 0.3)
 * - 关键词匹配度 (权重 0.2)
 * - 历史意图转移概率 (权重 0.1)
 *
 * 使用 Laplace 平滑计算意图转移概率矩阵
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
public interface ConfidenceCalibrationService {

    /**
     * 计算融合后的置信度
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param intentCode 意图代码
     * @param confidenceInputs 多源置信度输入
     * @return 融合后的置信度结果
     */
    CalibratedConfidence calibrate(String factoryId, Long userId, String intentCode,
                                    ConfidenceInputs confidenceInputs);

    /**
     * 批量计算候选意图的融合置信度
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param candidates 候选意图列表
     * @param userInput 用户输入
     * @param previousIntentCode 上一轮的意图代码 (用于转移概率)
     * @return 校准后的候选列表
     */
    List<CalibratedCandidate> calibrateCandidates(String factoryId, Long userId,
                                                   List<IntentMatchResult.CandidateIntent> candidates,
                                                   String userInput, String previousIntentCode);

    /**
     * 获取意图转移概率
     *
     * @param factoryId 工厂ID
     * @param fromIntent 来源意图代码
     * @param toIntent 目标意图代码
     * @return 转移概率 (0.0 - 1.0)
     */
    double getTransitionProbability(String factoryId, String fromIntent, String toIntent);

    /**
     * 刷新转移概率矩阵
     *
     * @param factoryId 工厂ID
     */
    void refreshTransitionMatrix(String factoryId);

    /**
     * 获取转移概率矩阵统计信息
     *
     * @param factoryId 工厂ID
     * @return 统计信息
     */
    TransitionMatrixStats getTransitionMatrixStats(String factoryId);

    // ==================== 数据类型定义 ====================

    /**
     * 多源置信度输入
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class ConfidenceInputs {
        /**
         * LLM 自评估置信度 (0.0 - 1.0)
         */
        private Double llmConfidence;

        /**
         * 语义相似度分数 (0.0 - 1.0)
         */
        private Double semanticSimilarity;

        /**
         * 关键词匹配度 (0.0 - 1.0)
         * 计算方式: 匹配关键词数 / 总关键词数
         */
        private Double keywordMatchScore;

        /**
         * 历史转移概率 (0.0 - 1.0)
         * 从上一轮意图转移到当前意图的概率
         */
        private Double transitionProbability;

        /**
         * LLM 推理文本 (用于调试)
         */
        private String llmReasoning;

        /**
         * 匹配到的关键词列表
         */
        private List<String> matchedKeywords;
    }

    /**
     * 校准后的置信度结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class CalibratedConfidence {
        /**
         * 融合后的最终置信度
         */
        private double finalConfidence;

        /**
         * 各分量贡献值
         */
        private Map<String, Double> componentContributions;

        /**
         * 置信度变化 (相对于原始 LLM 置信度)
         */
        private double confidenceAdjustment;

        /**
         * 是否强信号 (finalConfidence >= 0.8)
         */
        private boolean isStrongSignal;

        /**
         * 推荐的行动
         */
        private RecommendedAction recommendedAction;

        /**
         * 校准详情说明
         */
        private String calibrationDetails;
    }

    /**
     * 校准后的候选
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class CalibratedCandidate {
        private String intentCode;
        private String intentName;
        private double originalConfidence;
        private double calibratedConfidence;
        private double llmContribution;
        private double semanticContribution;
        private double keywordContribution;
        private double transitionContribution;
        private boolean isStrongSignal;
    }

    /**
     * 转移概率矩阵统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class TransitionMatrixStats {
        /**
         * 工厂ID
         */
        private String factoryId;

        /**
         * 矩阵中的意图数量
         */
        private int intentCount;

        /**
         * 记录的转移总数
         */
        private long totalTransitions;

        /**
         * 最后更新时间
         */
        private String lastUpdated;

        /**
         * Laplace 平滑参数
         */
        private double smoothingAlpha;

        /**
         * 最常见的转移对
         */
        private List<TransitionPair> topTransitions;
    }

    /**
     * 转移对
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class TransitionPair {
        private String fromIntent;
        private String toIntent;
        private long count;
        private double probability;
    }

    /**
     * 推荐行动
     */
    enum RecommendedAction {
        EXECUTE_DIRECTLY,     // 直接执行 (置信度 >= 0.85)
        CONFIRM_AND_EXECUTE,  // 确认后执行 (0.6 <= 置信度 < 0.85)
        SHOW_CANDIDATES,      // 显示候选列表 (0.4 <= 置信度 < 0.6)
        REQUEST_CLARIFICATION // 请求澄清 (置信度 < 0.4)
    }
}
