package com.cretas.aims.service.aps;

import java.time.LocalDate;

/**
 * APS排产性能指标计算服务
 *
 * 提供策略权重自适应调整所需的各类性能指标计算:
 * - 准时完成率 (影响 earliest_deadline 权重)
 * - 换型时间占比 (影响 min_changeover 权重)
 * - 产线负载均衡度 (影响 capacity_match 权重)
 * - 日吞吐量 (影响 shortest_process 权重)
 * - 物料等待时间占比 (影响 material_ready 权重)
 * - 紧急订单准时率 (影响 urgency_first 权重)
 *
 * @author Cretas APS Team
 * @since 2026-01-21
 */
public interface ApsSchedulingPerformanceMetricsService {

    /**
     * 计算准时完成率
     * 目标: > 85%
     *
     * 计算公式: 准时完成的任务数 / 总完成任务数
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 准时完成率 [0, 1]
     */
    double calculateOnTimeRate(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 计算换型时间占比
     * 目标: < 15%
     *
     * 计算公式: 总换型时间 / 总生产时间
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 换型时间占比 [0, 1]
     */
    double calculateChangeoverRatio(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 计算产线负载均衡度 (变异系数)
     * 目标: < 0.3
     *
     * 计算公式: 各产线负载的标准差 / 平均负载
     * 变异系数越低表示负载越均衡
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 变异系数 [0, ∞), 通常在 [0, 1] 范围内
     */
    double calculateLoadBalanceCV(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 计算吞吐量比率
     * 目标: >= 1.0
     *
     * 计算公式: 实际吞吐量 / 计划吞吐量
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 吞吐量比率 [0, ∞)
     */
    double calculateThroughputRatio(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 计算物料等待时间占比
     * 目标: < 10%
     *
     * 计算公式: 物料等待总时长 / 总生产时长
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 物料等待时间占比 [0, 1]
     */
    double calculateMaterialWaitRatio(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 计算紧急订单准时率
     * 目标: > 95%
     *
     * 计算公式: 准时完成的紧急订单数 / 总紧急订单数
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 紧急订单准时率 [0, 1]
     */
    double calculateUrgentOnTimeRate(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取综合性能报告
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 性能报告
     */
    PerformanceReport getPerformanceReport(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 性能报告
     */
    class PerformanceReport {
        private String factoryId;
        private LocalDate startDate;
        private LocalDate endDate;
        private double onTimeRate;
        private double changeoverRatio;
        private double loadBalanceCV;
        private double throughputRatio;
        private double materialWaitRatio;
        private double urgentOnTimeRate;
        private int totalTasks;
        private int completedTasks;
        private int urgentTasks;

        // Getters and setters
        public String getFactoryId() { return factoryId; }
        public void setFactoryId(String factoryId) { this.factoryId = factoryId; }
        public LocalDate getStartDate() { return startDate; }
        public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
        public LocalDate getEndDate() { return endDate; }
        public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
        public double getOnTimeRate() { return onTimeRate; }
        public void setOnTimeRate(double onTimeRate) { this.onTimeRate = onTimeRate; }
        public double getChangeoverRatio() { return changeoverRatio; }
        public void setChangeoverRatio(double changeoverRatio) { this.changeoverRatio = changeoverRatio; }
        public double getLoadBalanceCV() { return loadBalanceCV; }
        public void setLoadBalanceCV(double loadBalanceCV) { this.loadBalanceCV = loadBalanceCV; }
        public double getThroughputRatio() { return throughputRatio; }
        public void setThroughputRatio(double throughputRatio) { this.throughputRatio = throughputRatio; }
        public double getMaterialWaitRatio() { return materialWaitRatio; }
        public void setMaterialWaitRatio(double materialWaitRatio) { this.materialWaitRatio = materialWaitRatio; }
        public double getUrgentOnTimeRate() { return urgentOnTimeRate; }
        public void setUrgentOnTimeRate(double urgentOnTimeRate) { this.urgentOnTimeRate = urgentOnTimeRate; }
        public int getTotalTasks() { return totalTasks; }
        public void setTotalTasks(int totalTasks) { this.totalTasks = totalTasks; }
        public int getCompletedTasks() { return completedTasks; }
        public void setCompletedTasks(int completedTasks) { this.completedTasks = completedTasks; }
        public int getUrgentTasks() { return urgentTasks; }
        public void setUrgentTasks(int urgentTasks) { this.urgentTasks = urgentTasks; }
    }
}
