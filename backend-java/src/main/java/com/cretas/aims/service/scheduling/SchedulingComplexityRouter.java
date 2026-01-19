package com.cretas.aims.service.scheduling;

/**
 * 调度复杂度路由
 * 根据场景复杂度选择不同的调度算法
 *
 * 复用现有 ComplexityRouter 的设计模式
 */
public interface SchedulingComplexityRouter {

    /**
     * 调度模式枚举
     */
    enum SchedulingMode {
        RULE_BASED,      // 简单场景: 规则引擎 (< 10工人)
        LINUCB_FAIR,     // 中等场景: LinUCB + Fair-MAB (10-50工人)
        HIERARCHICAL_RL  // 复杂场景: 分层强化学习 (> 50工人)
    }

    /**
     * 评估调度复杂度
     */
    SchedulingComplexity evaluateComplexity(String factoryId, SchedulingContext context);

    /**
     * 路由到合适的调度算法
     */
    SchedulingMode routeToAlgorithm(SchedulingComplexity complexity);

    /**
     * 直接获取推荐的调度模式
     */
    SchedulingMode getRecommendedMode(String factoryId, SchedulingContext context);

    /**
     * 调度上下文
     */
    class SchedulingContext {
        private int pendingTaskCount;       // 待分配任务数
        private int availableWorkerCount;   // 可用工人数
        private int processTypeCount;       // 工序类型数
        private int tempWorkerCount;        // 临时工数
        private double urgentTaskRatio;     // 紧急任务比例
        private boolean hasSkuConstraints;  // 是否有SKU约束
        private boolean hasTimeConstraints; // 是否有时间约束

        // Getters/Setters with builder pattern
        public static SchedulingContext builder() { return new SchedulingContext(); }
        public SchedulingContext pendingTasks(int count) { this.pendingTaskCount = count; return this; }
        public SchedulingContext availableWorkers(int count) { this.availableWorkerCount = count; return this; }
        public SchedulingContext processTypes(int count) { this.processTypeCount = count; return this; }
        public SchedulingContext tempWorkers(int count) { this.tempWorkerCount = count; return this; }
        public SchedulingContext urgentRatio(double ratio) { this.urgentTaskRatio = ratio; return this; }
        public SchedulingContext skuConstraints(boolean has) { this.hasSkuConstraints = has; return this; }
        public SchedulingContext timeConstraints(boolean has) { this.hasTimeConstraints = has; return this; }

        // Getters
        public int getPendingTaskCount() { return pendingTaskCount; }
        public int getAvailableWorkerCount() { return availableWorkerCount; }
        public int getProcessTypeCount() { return processTypeCount; }
        public int getTempWorkerCount() { return tempWorkerCount; }
        public double getUrgentTaskRatio() { return urgentTaskRatio; }
        public boolean hasSkuConstraints() { return hasSkuConstraints; }
        public boolean hasTimeConstraints() { return hasTimeConstraints; }
    }

    /**
     * 复杂度评估结果
     */
    class SchedulingComplexity {
        private double workerComplexity;     // 工人复杂度 (0-1)
        private double taskComplexity;       // 任务复杂度 (0-1)
        private double constraintComplexity; // 约束复杂度 (0-1)
        private double dynamismScore;        // 动态变化程度 (0-1)
        private double overallScore;         // 综合复杂度分数
        private SchedulingMode recommendedMode;
        private String explanation;          // 决策解释

        // Getters and Setters
        public double getWorkerComplexity() { return workerComplexity; }
        public void setWorkerComplexity(double v) { this.workerComplexity = v; }
        public double getTaskComplexity() { return taskComplexity; }
        public void setTaskComplexity(double v) { this.taskComplexity = v; }
        public double getConstraintComplexity() { return constraintComplexity; }
        public void setConstraintComplexity(double v) { this.constraintComplexity = v; }
        public double getDynamismScore() { return dynamismScore; }
        public void setDynamismScore(double v) { this.dynamismScore = v; }
        public double getOverallScore() { return overallScore; }
        public void setOverallScore(double v) { this.overallScore = v; }
        public SchedulingMode getRecommendedMode() { return recommendedMode; }
        public void setRecommendedMode(SchedulingMode v) { this.recommendedMode = v; }
        public String getExplanation() { return explanation; }
        public void setExplanation(String v) { this.explanation = v; }
    }
}
