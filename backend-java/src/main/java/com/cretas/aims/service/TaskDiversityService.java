package com.cretas.aims.service;

import java.util.List;
import java.util.Map;

/**
 * 任务多样性控制服务接口
 * 基于抖音推荐系统"MMR多样性控制"设计
 *
 * 核心公式:
 * MMR_dispatch = λ × 匹配分数 - (1-λ) × 历史重复度
 *
 * 目标:
 * - 避免同一工人总做同一工序
 * - 给工人分配一些不熟悉但可学习的任务 (技能培养)
 * - 提升公平性，避免"好活"都给高绩效工人
 */
public interface TaskDiversityService {

    /**
     * 计算任务与工人历史任务的相似度
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param taskInfo 当前任务信息
     * @param days 查看历史多少天
     * @return 相似度 (0-1)
     */
    double calculateTaskHistorySimilarity(String factoryId, Long workerId,
                                          Map<String, Object> taskInfo, int days);

    /**
     * 应用任务多样性重排序
     * 在原有推荐基础上考虑工人的任务历史，避免重复分配
     *
     * @param recommendations 原始推荐列表
     * @param factoryId 工厂ID
     * @param taskInfo 当前任务信息
     * @param lambda 多样性系数 (0-1)
     * @return 重排序后的推荐列表
     */
    List<LinUCBService.WorkerRecommendation> applyDiversityReranking(
            List<LinUCBService.WorkerRecommendation> recommendations,
            String factoryId,
            Map<String, Object> taskInfo,
            double lambda);

    /**
     * 获取工人任务多样性分析
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param days 分析天数
     * @return 多样性分析结果
     */
    TaskDiversityAnalysis getWorkerTaskDiversityAnalysis(String factoryId, Long workerId, int days);

    /**
     * 检查工人是否需要任务轮换
     * 如果连续多天做同一工序，建议轮换
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param processType 当前工序类型
     * @return 是否需要轮换
     */
    boolean shouldRotateTask(String factoryId, Long workerId, String processType);

    /**
     * 推荐适合技能培养的任务类型
     * 找出工人不太熟悉但有能力学习的工序
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param limit 返回数量
     * @return 推荐的工序类型列表
     */
    List<String> recommendSkillDevelopmentTasks(String factoryId, Long workerId, int limit);

    /**
     * 计算公平性加分
     * 基于工人近期分配数与平均分配数的差异
     * FairnessBonus = max(0, (平均分配数 - 该工人分配数) / 平均分配数)
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param days 统计天数
     * @return 公平性加分 (0-1)
     */
    double calculateFairnessBonus(String factoryId, Long workerId, int days);

    /**
     * 计算技能维护加分
     * 基于工人距离上次执行该工序的天数
     * SkillMaintenanceBonus = min(1.0, days_since_last / 30)
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param taskType 工序类型
     * @return 技能维护加分 (0-1)
     */
    double calculateSkillMaintenanceBonus(String factoryId, Long workerId, String taskType);

    /**
     * 计算重复惩罚
     * 近3天做过相同工序返回0.5，否则返回0
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param taskType 工序类型
     * @return 重复惩罚 (0 or 0.5)
     */
    double calculateRepetitionPenalty(String factoryId, Long workerId, String taskType);

    /**
     * 计算综合多样性调整分数
     * FinalScore = 0.6 × LinUCB_Score
     *            + 0.15 × FairnessBonus
     *            + 0.15 × SkillMaintenanceBonus
     *            - 0.1 × RepetitionPenalty
     *
     * @param factoryId 工厂ID
     * @param workerId 工人ID
     * @param taskType 工序类型
     * @param linucbScore 原始LinUCB分数
     * @return 调整后的分数
     */
    double calculateDiversityAdjustedScore(String factoryId, Long workerId, String taskType, double linucbScore);

    /**
     * 获取需要技能维护的工人列表
     * 找出30天内未执行特定工序的工人
     *
     * @param factoryId 工厂ID
     * @param taskType 工序类型
     * @return 需要维护该技能的工人ID列表
     */
    List<Long> getWorkersNeedingSkillMaintenance(String factoryId, String taskType);

    /**
     * 任务多样性分析结果
     */
    class TaskDiversityAnalysis {
        private Long workerId;
        private int totalTasks;
        private int uniqueProcessTypes;
        private Map<String, Integer> processTypeDistribution;
        private double diversityScore; // 0-1, 越高越多样
        private String dominantProcessType;
        private double dominantProcessRatio;
        private boolean needsRotation;

        // Getters and Setters
        public Long getWorkerId() { return workerId; }
        public void setWorkerId(Long workerId) { this.workerId = workerId; }
        public int getTotalTasks() { return totalTasks; }
        public void setTotalTasks(int totalTasks) { this.totalTasks = totalTasks; }
        public int getUniqueProcessTypes() { return uniqueProcessTypes; }
        public void setUniqueProcessTypes(int uniqueProcessTypes) { this.uniqueProcessTypes = uniqueProcessTypes; }
        public Map<String, Integer> getProcessTypeDistribution() { return processTypeDistribution; }
        public void setProcessTypeDistribution(Map<String, Integer> processTypeDistribution) {
            this.processTypeDistribution = processTypeDistribution;
        }
        public double getDiversityScore() { return diversityScore; }
        public void setDiversityScore(double diversityScore) { this.diversityScore = diversityScore; }
        public String getDominantProcessType() { return dominantProcessType; }
        public void setDominantProcessType(String dominantProcessType) { this.dominantProcessType = dominantProcessType; }
        public double getDominantProcessRatio() { return dominantProcessRatio; }
        public void setDominantProcessRatio(double dominantProcessRatio) { this.dominantProcessRatio = dominantProcessRatio; }
        public boolean isNeedsRotation() { return needsRotation; }
        public void setNeedsRotation(boolean needsRotation) { this.needsRotation = needsRotation; }
    }
}
