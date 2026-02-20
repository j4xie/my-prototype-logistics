package com.cretas.aims.dto.aps;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * APS 全局仪表盘 DTO (增强版)
 *
 * 包含：
 * - 任务汇总统计
 * - 性能指标
 * - 产线状态概览
 * - 高风险任务列表
 * - 重排建议
 *
 * @author Cretas APS
 * @since 2026-01-21
 */
@Data
@Schema(description = "APS 全局实时仪表盘")
public class GlobalDashboard {

    @Schema(description = "数据更新时间")
    private LocalDateTime updateTime;

    @Schema(description = "任务汇总统计")
    private TaskSummary summary;

    @Schema(description = "性能指标")
    private PerformanceMetrics metrics;

    @Schema(description = "产线状态概览")
    private LinesSummary lines;

    @Schema(description = "高风险任务列表 (Top N)")
    private List<RiskTask> topRisks;

    @Schema(description = "重排建议")
    private RescheduleRecommendation rescheduleRecommendation;

    /**
     * 任务汇总统计
     */
    @Data
    @Schema(description = "任务汇总统计")
    public static class TaskSummary {

        @Schema(description = "总活跃任务数", example = "25")
        private int totalActiveTasks;

        @Schema(description = "正常进行任务数 (完成概率 >= 0.8)", example = "18")
        private int onTrackTasks;

        @Schema(description = "预警任务数 (0.5 <= 完成概率 < 0.8)", example = "5")
        private int atRiskTasks;

        @Schema(description = "高危任务数 (完成概率 < 0.5)", example = "2")
        private int delayedTasks;
    }

    /**
     * 性能指标
     */
    @Data
    @Schema(description = "性能指标")
    public static class PerformanceMetrics {

        @Schema(description = "总体准时率 (0-1)", example = "0.85")
        private double overallOnTimeRate;

        @Schema(description = "平均效率 (件/小时)", example = "120.5")
        private double averageEfficiency;

        @Schema(description = "平均完成概率 (0-1)", example = "0.78")
        private double averageCompletionProbability;

        @Schema(description = "换型时间占比 (0-1)", example = "0.12")
        private double changeoverTimeRatio;

        @Schema(description = "负载均衡系数 (CV值，越小越均衡)", example = "0.15")
        private double loadBalanceCV;
    }

    /**
     * 产线状态概览
     */
    @Data
    @Schema(description = "产线状态概览")
    public static class LinesSummary {

        @Schema(description = "产线总数", example = "10")
        private int total;

        @Schema(description = "活跃产线数", example = "8")
        private int active;

        @Schema(description = "空闲产线数", example = "1")
        private int idle;

        @Schema(description = "维护中产线数", example = "1")
        private int maintenance;

        @Schema(description = "故障产线数", example = "0")
        private int fault;
    }

    /**
     * 风险任务信息
     */
    @Data
    @Schema(description = "风险任务信息")
    public static class RiskTask {

        @Schema(description = "任务ID", example = "TASK-001")
        private String taskId;

        @Schema(description = "任务编号", example = "SCH-20260121-001")
        private String taskNo;

        @Schema(description = "产品名称", example = "红烧牛肉罐头")
        private String productName;

        @Schema(description = "产线名称", example = "1号包装线")
        private String lineName;

        @Schema(description = "完成概率 (0-1)", example = "0.45")
        private double completionProbability;

        @Schema(description = "预计延迟分钟数", example = "45")
        private int estimatedDelayMinutes;

        @Schema(description = "风险等级: low/medium/high/critical", example = "high")
        private String riskLevel;

        @Schema(description = "截止时间")
        private LocalDateTime deadline;

        @Schema(description = "建议动作列表")
        private List<String> suggestedActions;
    }

    /**
     * 重排建议
     */
    @Data
    @Schema(description = "重排建议")
    public static class RescheduleRecommendation {

        @Schema(description = "是否需要重排", example = "true")
        private boolean needReschedule;

        @Schema(description = "紧急程度: none/low/medium/high/critical", example = "medium")
        private String urgencyLevel;

        @Schema(description = "重排原因列表")
        private List<String> reasons;

        @Schema(description = "受影响的任务ID列表")
        private List<String> affectedTaskIds;

        @Schema(description = "预计改善幅度 (准时率提升百分比)", example = "0.15")
        private double expectedImprovement;
    }
}
