package com.cretas.aims.service;

import com.cretas.aims.entity.ml.LinUCBModel;
import com.cretas.aims.entity.ml.WorkerAllocationFeedback;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * LinUCB人员分配算法服务接口
 *
 * LinUCB (Linear Upper Confidence Bound) 是一种上下文老虎机算法，
 * 用于在动态人员分配场景中平衡探索与利用。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
public interface LinUCBService {

    // ==================== 核心推荐算法 ====================

    /**
     * 推荐最优工人分配
     *
     * @param factoryId 工厂ID
     * @param taskFeatures 任务特征 (6维)
     * @param candidateWorkerIds 候选工人ID列表
     * @return 按UCB值降序排列的工人推荐列表 (workerId -> UCB分数)
     */
    List<WorkerRecommendation> recommendWorkers(
            String factoryId,
            double[] taskFeatures,
            List<Long> candidateWorkerIds);

    /**
     * 获取带多样性调整的工人推荐
     * 在LinUCB打分基础上应用公平性、技能维护、重复惩罚
     *
     * 调整公式:
     * FinalScore = 0.6 × LinUCB_Score
     *            + 0.15 × FairnessBonus
     *            + 0.15 × SkillMaintenanceBonus
     *            - 0.1 × RepetitionPenalty
     *
     * @param factoryId 工厂ID
     * @param taskInfo 任务信息 (包含 taskType/processType/stageType)
     * @param candidateWorkerIds 候选工人ID列表
     * @param enableDiversity 是否启用多样性调整
     * @return 推荐列表 (已按调整后分数排序)
     */
    List<WorkerRecommendation> getRecommendationsWithDiversity(
            String factoryId,
            Map<String, Object> taskInfo,
            List<Long> candidateWorkerIds,
            boolean enableDiversity);

    /**
     * 计算单个工人的UCB值
     * UCB = θ^T * x + α * sqrt(x^T * A^(-1) * x)
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param context 上下文特征向量 (12维: 6任务 + 6工人)
     * @return UCB分数
     */
    BigDecimal computeUCB(String factoryId, Long workerId, double[] context);

    // ==================== 模型更新 ====================

    /**
     * 更新工人的LinUCB模型参数
     * 任务完成后调用，用于在线学习
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param context 分配时的上下文特征
     * @param reward 实际奖励值 (0-1)
     */
    void updateModel(String factoryId, Long workerId, double[] context, double reward);

    /**
     * 批量处理未处理的反馈，更新模型
     *
     * @param factoryId 工厂ID
     * @return 处理的反馈数量
     */
    int processUnprocessedFeedbacks(String factoryId);

    // ==================== 模型管理 ====================

    /**
     * 获取或创建工人的LinUCB模型
     * 如果模型不存在，创建初始化模型 (A=I, b=0)
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @return LinUCB模型
     */
    LinUCBModel getOrCreateModel(String factoryId, Long workerId);

    /**
     * 获取工厂所有工人的模型
     *
     * @param factoryId 工厂ID
     * @return 模型列表
     */
    List<LinUCBModel> getFactoryModels(String factoryId);

    /**
     * 重置工人的模型（重新开始学习）
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     */
    void resetModel(String factoryId, Long workerId);

    /**
     * 重置工厂所有模型
     *
     * @param factoryId 工厂ID
     */
    void resetAllModels(String factoryId);

    // ==================== 反馈记录 ====================

    /**
     * 记录工人分配上下文（分配时调用）
     *
     * @param factoryId 工厂ID
     * @param taskId 任务ID
     * @param taskType 任务类型
     * @param workerId 工人ID
     * @param workerCode 工号
     * @param context 上下文特征
     * @param predictedScore 预测的UCB分数
     * @param plannedQuantity 计划产量
     * @param plannedHours 计划工时
     * @return 反馈记录ID
     */
    String recordAllocation(
            String factoryId,
            String taskId,
            String taskType,
            Long workerId,
            String workerCode,
            double[] context,
            BigDecimal predictedScore,
            BigDecimal plannedQuantity,
            BigDecimal plannedHours);

    /**
     * 完成分配反馈（任务完成时调用）
     *
     * @param feedbackId 反馈记录ID
     * @param actualQuantity 实际产量
     * @param actualHours 实际工时
     * @param qualityScore 质量分数 (0-1)
     * @return 计算的奖励值
     */
    BigDecimal completeFeedback(
            String feedbackId,
            BigDecimal actualQuantity,
            BigDecimal actualHours,
            BigDecimal qualityScore);

    /**
     * 完成分配反馈并立即更新模型 (实时反馈闭环)
     * 基于抖音推荐系统"实时反馈闭环飞轮"设计
     *
     * 相比于批量更新的优势:
     * - 模型能够立即学习到最新的工人表现
     * - 下一次推荐立即反映最新数据
     * - 适用于对实时性要求高的场景
     *
     * @param feedbackId 反馈记录ID
     * @param actualQuantity 实际产量
     * @param actualHours 实际工时
     * @param qualityScore 质量分数 (0-1)
     * @return 计算的奖励值
     */
    BigDecimal completeFeedbackWithImmediateUpdate(
            String feedbackId,
            BigDecimal actualQuantity,
            BigDecimal actualHours,
            BigDecimal qualityScore);

    // ==================== 统计分析 ====================

    /**
     * 获取工人的AI评分排行
     *
     * @param factoryId 工厂ID
     * @param limit 返回数量限制
     * @return 排行列表
     */
    List<WorkerPerformanceRank> getWorkerPerformanceRanking(String factoryId, int limit);

    /**
     * 获取模型训练统计
     *
     * @param factoryId 工厂ID
     * @return 统计信息
     */
    ModelTrainingStats getTrainingStats(String factoryId);

    // ==================== 特征工程 ====================

    /**
     * 提取任务特征 (6维)
     * [任务量, 截止时间, 产品类型编码, 优先级, 复杂度, 车间编码]
     */
    double[] extractTaskFeatures(Map<String, Object> taskInfo);

    /**
     * 提取工人特征 (6维)
     * [技能等级, 经验天数, 近期效率, 是否临时工, 今日工时, 疲劳度]
     */
    double[] extractWorkerFeatures(Map<String, Object> workerInfo);

    /**
     * 合并任务和工人特征为上下文向量 (12维)
     */
    double[] combineFeatures(double[] taskFeatures, double[] workerFeatures);

    // ==================== 内部类定义 ====================

    /**
     * 工人推荐结果
     */
    class WorkerRecommendation {
        private Long workerId;
        private String workerCode;
        private String workerName;
        private BigDecimal ucbScore;
        private BigDecimal expectedEfficiency;
        private BigDecimal confidenceWidth;
        private String recommendation;

        public WorkerRecommendation() {}

        public WorkerRecommendation(Long workerId, BigDecimal ucbScore) {
            this.workerId = workerId;
            this.ucbScore = ucbScore;
        }

        // Getters and Setters
        public Long getWorkerId() { return workerId; }
        public void setWorkerId(Long workerId) { this.workerId = workerId; }
        public String getWorkerCode() { return workerCode; }
        public void setWorkerCode(String workerCode) { this.workerCode = workerCode; }
        public String getWorkerName() { return workerName; }
        public void setWorkerName(String workerName) { this.workerName = workerName; }
        public BigDecimal getUcbScore() { return ucbScore; }
        public void setUcbScore(BigDecimal ucbScore) { this.ucbScore = ucbScore; }
        public BigDecimal getExpectedEfficiency() { return expectedEfficiency; }
        public void setExpectedEfficiency(BigDecimal expectedEfficiency) { this.expectedEfficiency = expectedEfficiency; }
        public BigDecimal getConfidenceWidth() { return confidenceWidth; }
        public void setConfidenceWidth(BigDecimal confidenceWidth) { this.confidenceWidth = confidenceWidth; }
        public String getRecommendation() { return recommendation; }
        public void setRecommendation(String recommendation) { this.recommendation = recommendation; }
    }

    /**
     * 工人绩效排名
     */
    class WorkerPerformanceRank {
        private int rank;
        private Long workerId;
        private String workerCode;
        private String workerName;
        private BigDecimal avgReward;
        private BigDecimal avgEfficiency;
        private BigDecimal avgQuality;
        private int taskCount;

        // Getters and Setters
        public int getRank() { return rank; }
        public void setRank(int rank) { this.rank = rank; }
        public Long getWorkerId() { return workerId; }
        public void setWorkerId(Long workerId) { this.workerId = workerId; }
        public String getWorkerCode() { return workerCode; }
        public void setWorkerCode(String workerCode) { this.workerCode = workerCode; }
        public String getWorkerName() { return workerName; }
        public void setWorkerName(String workerName) { this.workerName = workerName; }
        public BigDecimal getAvgReward() { return avgReward; }
        public void setAvgReward(BigDecimal avgReward) { this.avgReward = avgReward; }
        public BigDecimal getAvgEfficiency() { return avgEfficiency; }
        public void setAvgEfficiency(BigDecimal avgEfficiency) { this.avgEfficiency = avgEfficiency; }
        public BigDecimal getAvgQuality() { return avgQuality; }
        public void setAvgQuality(BigDecimal avgQuality) { this.avgQuality = avgQuality; }
        public int getTaskCount() { return taskCount; }
        public void setTaskCount(int taskCount) { this.taskCount = taskCount; }
    }

    /**
     * 模型训练统计
     */
    class ModelTrainingStats {
        private int totalModels;
        private int activeModels;
        private long totalUpdates;
        private long unprocessedFeedbacks;
        private BigDecimal avgReward;
        private String lastTrainingTime;

        // Getters and Setters
        public int getTotalModels() { return totalModels; }
        public void setTotalModels(int totalModels) { this.totalModels = totalModels; }
        public int getActiveModels() { return activeModels; }
        public void setActiveModels(int activeModels) { this.activeModels = activeModels; }
        public long getTotalUpdates() { return totalUpdates; }
        public void setTotalUpdates(long totalUpdates) { this.totalUpdates = totalUpdates; }
        public long getUnprocessedFeedbacks() { return unprocessedFeedbacks; }
        public void setUnprocessedFeedbacks(long unprocessedFeedbacks) { this.unprocessedFeedbacks = unprocessedFeedbacks; }
        public BigDecimal getAvgReward() { return avgReward; }
        public void setAvgReward(BigDecimal avgReward) { this.avgReward = avgReward; }
        public String getLastTrainingTime() { return lastTrainingTime; }
        public void setLastTrainingTime(String lastTrainingTime) { this.lastTrainingTime = lastTrainingTime; }
    }
}
