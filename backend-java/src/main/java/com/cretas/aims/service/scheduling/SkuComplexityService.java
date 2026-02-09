package com.cretas.aims.service.scheduling;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * SKU复杂度管理服务
 * 根据SKU复杂度自动匹配合适的工人
 */
public interface SkuComplexityService {

    /**
     * 获取SKU复杂度
     * 优先使用人工设置，其次使用学习得到的复杂度
     */
    int getSkuComplexity(String factoryId, String skuCode);

    /**
     * 获取SKU详细信息
     */
    Optional<SkuProfile> getSkuProfile(String factoryId, String skuCode);

    /**
     * 设置SKU复杂度 (人工设置)
     */
    void setSkuComplexity(String factoryId, String skuCode, int complexityLevel);

    /**
     * 从历史数据学习SKU复杂度
     * 基于处理时间、失败率、效率分布等
     */
    double learnSkuComplexity(String factoryId, String skuCode);

    /**
     * 计算工人-SKU匹配分数
     * 考虑技能等级 vs SKU复杂度
     */
    double calculateMatchScore(String factoryId, Long workerId, String skuCode, int workerSkillLevel);

    /**
     * 获取适合SKU的工人列表
     */
    List<Long> getQualifiedWorkers(String factoryId, String skuCode);

    /**
     * 获取适合新人练习的SKU列表
     */
    List<String> getTrainingSkus(String factoryId);

    /**
     * 获取需要专家处理的SKU列表
     */
    List<String> getExpertSkus(String factoryId);

    /**
     * 更新SKU统计 (任务完成后调用)
     */
    void updateSkuStats(String factoryId, String skuCode, double efficiency, int processTimeMinutes, boolean success);

    /**
     * 批量检测SKU复杂度漂移
     */
    List<SkuComplexityDrift> detectComplexityDrift(String factoryId);

    // DTO classes
    class SkuProfile {
        private String skuCode;
        private String skuName;
        private int manualComplexity;      // 人工设置的复杂度
        private double learnedComplexity;  // 学习得到的复杂度
        private int effectiveComplexity;   // 实际使用的复杂度
        private int minSkillRequired;
        private String preferredWorkerType; // ANY/EXPERIENCED/TRAINEE
        private int avgProcessTimeMinutes;
        private double avgEfficiency;
        private double failureRate;
        private int sampleCount;
        private Map<String, Double> processComplexity; // 各工序复杂度

        // Getters and Setters
        public String getSkuCode() {
            return skuCode;
        }

        public void setSkuCode(String skuCode) {
            this.skuCode = skuCode;
        }

        public String getSkuName() {
            return skuName;
        }

        public void setSkuName(String skuName) {
            this.skuName = skuName;
        }

        public int getManualComplexity() {
            return manualComplexity;
        }

        public void setManualComplexity(int manualComplexity) {
            this.manualComplexity = manualComplexity;
        }

        public double getLearnedComplexity() {
            return learnedComplexity;
        }

        public void setLearnedComplexity(double learnedComplexity) {
            this.learnedComplexity = learnedComplexity;
        }

        public int getEffectiveComplexity() {
            return effectiveComplexity;
        }

        public void setEffectiveComplexity(int effectiveComplexity) {
            this.effectiveComplexity = effectiveComplexity;
        }

        public int getMinSkillRequired() {
            return minSkillRequired;
        }

        public void setMinSkillRequired(int minSkillRequired) {
            this.minSkillRequired = minSkillRequired;
        }

        public String getPreferredWorkerType() {
            return preferredWorkerType;
        }

        public void setPreferredWorkerType(String preferredWorkerType) {
            this.preferredWorkerType = preferredWorkerType;
        }

        public int getAvgProcessTimeMinutes() {
            return avgProcessTimeMinutes;
        }

        public void setAvgProcessTimeMinutes(int avgProcessTimeMinutes) {
            this.avgProcessTimeMinutes = avgProcessTimeMinutes;
        }

        public double getAvgEfficiency() {
            return avgEfficiency;
        }

        public void setAvgEfficiency(double avgEfficiency) {
            this.avgEfficiency = avgEfficiency;
        }

        public double getFailureRate() {
            return failureRate;
        }

        public void setFailureRate(double failureRate) {
            this.failureRate = failureRate;
        }

        public int getSampleCount() {
            return sampleCount;
        }

        public void setSampleCount(int sampleCount) {
            this.sampleCount = sampleCount;
        }

        public Map<String, Double> getProcessComplexity() {
            return processComplexity;
        }

        public void setProcessComplexity(Map<String, Double> processComplexity) {
            this.processComplexity = processComplexity;
        }
    }

    class SkuComplexityDrift {
        private String skuCode;
        private double previousComplexity;
        private double currentComplexity;
        private double driftMagnitude;
        private String driftDirection; // UP/DOWN
        private String suggestedAction;

        // Getters and Setters
        public String getSkuCode() {
            return skuCode;
        }

        public void setSkuCode(String skuCode) {
            this.skuCode = skuCode;
        }

        public double getPreviousComplexity() {
            return previousComplexity;
        }

        public void setPreviousComplexity(double previousComplexity) {
            this.previousComplexity = previousComplexity;
        }

        public double getCurrentComplexity() {
            return currentComplexity;
        }

        public void setCurrentComplexity(double currentComplexity) {
            this.currentComplexity = currentComplexity;
        }

        public double getDriftMagnitude() {
            return driftMagnitude;
        }

        public void setDriftMagnitude(double driftMagnitude) {
            this.driftMagnitude = driftMagnitude;
        }

        public String getDriftDirection() {
            return driftDirection;
        }

        public void setDriftDirection(String driftDirection) {
            this.driftDirection = driftDirection;
        }

        public String getSuggestedAction() {
            return suggestedAction;
        }

        public void setSuggestedAction(String suggestedAction) {
            this.suggestedAction = suggestedAction;
        }
    }
}
