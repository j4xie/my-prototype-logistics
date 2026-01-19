package com.cretas.aims.service.scheduling;

import com.cretas.aims.entity.FactoryTempWorker;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 临时工管理服务
 * 处理临时工的识别、培养策略和转正建议
 */
public interface TempWorkerService {

    /**
     * 判断工人是否为临时工
     * 条件: 标记为临时工 OR 入职未满N天
     */
    boolean isTempWorker(String factoryId, Long workerId);

    /**
     * 获取临时工记录
     */
    Optional<FactoryTempWorker> getTempWorkerRecord(String factoryId, Long workerId);

    /**
     * 注册临时工
     */
    FactoryTempWorker registerTempWorker(String factoryId, Long workerId, LocalDate hireDate, LocalDate expectedEndDate);

    /**
     * 转正临时工
     */
    FactoryTempWorker convertToPermanent(String factoryId, Long workerId);

    /**
     * 计算临时工参数调整因子
     * 返回用于调整 LinUCB/公平性等权重的因子
     */
    TempWorkerAdjustment calculateAdjustment(String factoryId, Long workerId);

    /**
     * 获取适合临时工的任务复杂度上限
     */
    int getMaxComplexityForTempWorker(String factoryId, Long workerId);

    /**
     * 检查临时工是否达到最低分配数保证
     */
    boolean meetsMinimumAssignments(String factoryId, Long workerId, int days);

    /**
     * 获取需要优先分配的临时工列表
     * (未达到最低分配数的临时工)
     */
    List<Long> getTempWorkersNeedingAssignment(String factoryId);

    /**
     * 获取建议转正的临时工
     * 条件: 效率达标 + 可靠性达标 + 入职超过N天
     */
    List<TempWorkerConversionCandidate> getConversionCandidates(String factoryId);

    /**
     * 更新临时工绩效统计
     */
    void updatePerformanceStats(String factoryId, Long workerId, double efficiency, boolean completed);

    /**
     * 获取工厂临时工统计
     */
    TempWorkerStats getFactoryTempWorkerStats(String factoryId);

    // DTO classes
    class TempWorkerAdjustment {
        private Long workerId;
        private double linucbFactor;        // LinUCB权重调整 (默认0.7)
        private double fairnessFactor;      // 公平性权重调整 (默认1.5)
        private int skillDecayDays;         // 技能遗忘天数 (默认14)
        private boolean preferLowComplexity; // 是否优先低复杂度
        private double learningBonus;       // 学习机会加成
        private int maxConsecutiveDays;     // 最大同工序连续天数 (默认3)

        public Long getWorkerId() {
            return workerId;
        }

        public void setWorkerId(Long workerId) {
            this.workerId = workerId;
        }

        public double getLinucbFactor() {
            return linucbFactor;
        }

        public void setLinucbFactor(double linucbFactor) {
            this.linucbFactor = linucbFactor;
        }

        public double getFairnessFactor() {
            return fairnessFactor;
        }

        public void setFairnessFactor(double fairnessFactor) {
            this.fairnessFactor = fairnessFactor;
        }

        public int getSkillDecayDays() {
            return skillDecayDays;
        }

        public void setSkillDecayDays(int skillDecayDays) {
            this.skillDecayDays = skillDecayDays;
        }

        public boolean isPreferLowComplexity() {
            return preferLowComplexity;
        }

        public void setPreferLowComplexity(boolean preferLowComplexity) {
            this.preferLowComplexity = preferLowComplexity;
        }

        public double getLearningBonus() {
            return learningBonus;
        }

        public void setLearningBonus(double learningBonus) {
            this.learningBonus = learningBonus;
        }

        public int getMaxConsecutiveDays() {
            return maxConsecutiveDays;
        }

        public void setMaxConsecutiveDays(int maxConsecutiveDays) {
            this.maxConsecutiveDays = maxConsecutiveDays;
        }
    }

    class TempWorkerConversionCandidate {
        private Long workerId;
        private double avgEfficiency;
        private double reliabilityScore;
        private long daysEmployed;
        private int totalAssignments;
        private double conversionScore; // 综合转正分数
        private String recommendation;  // 建议说明

        public Long getWorkerId() {
            return workerId;
        }

        public void setWorkerId(Long workerId) {
            this.workerId = workerId;
        }

        public double getAvgEfficiency() {
            return avgEfficiency;
        }

        public void setAvgEfficiency(double avgEfficiency) {
            this.avgEfficiency = avgEfficiency;
        }

        public double getReliabilityScore() {
            return reliabilityScore;
        }

        public void setReliabilityScore(double reliabilityScore) {
            this.reliabilityScore = reliabilityScore;
        }

        public long getDaysEmployed() {
            return daysEmployed;
        }

        public void setDaysEmployed(long daysEmployed) {
            this.daysEmployed = daysEmployed;
        }

        public int getTotalAssignments() {
            return totalAssignments;
        }

        public void setTotalAssignments(int totalAssignments) {
            this.totalAssignments = totalAssignments;
        }

        public double getConversionScore() {
            return conversionScore;
        }

        public void setConversionScore(double conversionScore) {
            this.conversionScore = conversionScore;
        }

        public String getRecommendation() {
            return recommendation;
        }

        public void setRecommendation(String recommendation) {
            this.recommendation = recommendation;
        }
    }

    class TempWorkerStats {
        private String factoryId;
        private int totalTempWorkers;
        private int totalPermanentWorkers;
        private double tempWorkerRatio;
        private double avgTempEfficiency;
        private double avgPermanentEfficiency;
        private int conversionCandidatesCount;
        private int expiringSoonCount; // 7天内到期

        public String getFactoryId() {
            return factoryId;
        }

        public void setFactoryId(String factoryId) {
            this.factoryId = factoryId;
        }

        public int getTotalTempWorkers() {
            return totalTempWorkers;
        }

        public void setTotalTempWorkers(int totalTempWorkers) {
            this.totalTempWorkers = totalTempWorkers;
        }

        public int getTotalPermanentWorkers() {
            return totalPermanentWorkers;
        }

        public void setTotalPermanentWorkers(int totalPermanentWorkers) {
            this.totalPermanentWorkers = totalPermanentWorkers;
        }

        public double getTempWorkerRatio() {
            return tempWorkerRatio;
        }

        public void setTempWorkerRatio(double tempWorkerRatio) {
            this.tempWorkerRatio = tempWorkerRatio;
        }

        public double getAvgTempEfficiency() {
            return avgTempEfficiency;
        }

        public void setAvgTempEfficiency(double avgTempEfficiency) {
            this.avgTempEfficiency = avgTempEfficiency;
        }

        public double getAvgPermanentEfficiency() {
            return avgPermanentEfficiency;
        }

        public void setAvgPermanentEfficiency(double avgPermanentEfficiency) {
            this.avgPermanentEfficiency = avgPermanentEfficiency;
        }

        public int getConversionCandidatesCount() {
            return conversionCandidatesCount;
        }

        public void setConversionCandidatesCount(int conversionCandidatesCount) {
            this.conversionCandidatesCount = conversionCandidatesCount;
        }

        public int getExpiringSoonCount() {
            return expiringSoonCount;
        }

        public void setExpiringSoonCount(int expiringSoonCount) {
            this.expiringSoonCount = expiringSoonCount;
        }
    }
}
