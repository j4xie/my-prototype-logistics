package com.cretas.aims.service.scheduling;

import com.cretas.aims.entity.FactorySchedulingConfig;

/**
 * 工厂调度配置服务接口
 * 管理工厂个性化调度参数
 */
public interface FactorySchedulingConfigService {

    /**
     * 获取工厂调度配置
     * 如果不存在则创建默认配置
     */
    FactorySchedulingConfig getOrCreateConfig(String factoryId);

    /**
     * 更新工厂配置
     */
    FactorySchedulingConfig updateConfig(String factoryId, FactorySchedulingConfig config);

    /**
     * 执行自适应学习调整
     * 根据反馈数据自动调整参数
     */
    void performAdaptiveLearning(String factoryId);

    /**
     * 检测并处理异常
     */
    void detectAndHandleAnomalies(String factoryId);

    /**
     * 获取针对特定工人的调整后配置
     * 根据工人是否为临时工等因素调整参数
     */
    EffectiveConfig getEffectiveConfig(String factoryId, Long workerId);

    /**
     * 有效配置 - 根据工人特征调整后的参数
     */
    class EffectiveConfig {
        private double linucbWeight;
        private double fairnessWeight;
        private double skillMaintenanceWeight;
        private double repetitionWeight;
        private int skillDecayDays;
        private int repetitionDays;
        private int maxConsecutiveDays;
        private boolean isTempWorker;
        private int workerSkillLevel;
        private double skuComplexityBonus;

        // Getters and Setters
        public double getLinucbWeight() { return linucbWeight; }
        public void setLinucbWeight(double linucbWeight) { this.linucbWeight = linucbWeight; }
        public double getFairnessWeight() { return fairnessWeight; }
        public void setFairnessWeight(double fairnessWeight) { this.fairnessWeight = fairnessWeight; }
        public double getSkillMaintenanceWeight() { return skillMaintenanceWeight; }
        public void setSkillMaintenanceWeight(double skillMaintenanceWeight) { this.skillMaintenanceWeight = skillMaintenanceWeight; }
        public double getRepetitionWeight() { return repetitionWeight; }
        public void setRepetitionWeight(double repetitionWeight) { this.repetitionWeight = repetitionWeight; }
        public int getSkillDecayDays() { return skillDecayDays; }
        public void setSkillDecayDays(int skillDecayDays) { this.skillDecayDays = skillDecayDays; }
        public int getRepetitionDays() { return repetitionDays; }
        public void setRepetitionDays(int repetitionDays) { this.repetitionDays = repetitionDays; }
        public int getMaxConsecutiveDays() { return maxConsecutiveDays; }
        public void setMaxConsecutiveDays(int maxConsecutiveDays) { this.maxConsecutiveDays = maxConsecutiveDays; }
        public boolean isTempWorker() { return isTempWorker; }
        public void setTempWorker(boolean tempWorker) { isTempWorker = tempWorker; }
        public int getWorkerSkillLevel() { return workerSkillLevel; }
        public void setWorkerSkillLevel(int workerSkillLevel) { this.workerSkillLevel = workerSkillLevel; }
        public double getSkuComplexityBonus() { return skuComplexityBonus; }
        public void setSkuComplexityBonus(double skuComplexityBonus) { this.skuComplexityBonus = skuComplexityBonus; }
    }
}
