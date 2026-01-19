package com.cretas.aims.dto.metrics;

import com.cretas.aims.entity.enums.ProcessingStageType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 排班指标DTO集合
 * 用于监控排班系统性能指标
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public class SchedulingMetricsDTO {

    /**
     * 排班总览指标
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SchedulingOverview {
        /**
         * 总分配数
         */
        private Long totalAllocations;

        /**
         * 平均效率 (0-1)
         */
        private BigDecimal avgEfficiency;

        /**
         * 预测准确率 (0-1)
         */
        private BigDecimal predictionAccuracy;

        /**
         * 活跃工人数
         */
        private Integer activeWorkers;

        /**
         * 任务多样性分数 (0-1)
         */
        private BigDecimal taskDiversityScore;

        /**
         * 接受率 (工人接受任务的比率)
         */
        private BigDecimal acceptanceRate;

        /**
         * 完成率 (任务完成比率)
         */
        private BigDecimal completionRate;

        /**
         * 统计周期 (天)
         */
        private Integer periodDays;

        /**
         * 未处理反馈数
         */
        private Long pendingFeedbacks;
    }

    /**
     * 排班趋势数据
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SchedulingTrend {
        /**
         * 日期
         */
        private LocalDate date;

        /**
         * 当日分配数
         */
        private Integer allocations;

        /**
         * 当日平均效率
         */
        private BigDecimal avgEfficiency;

        /**
         * 当日预测误差 (实际效率 - 预测分数)
         */
        private BigDecimal predictionError;

        /**
         * 当日活跃工人数
         */
        private Integer activeWorkers;

        /**
         * 当日完成任务数
         */
        private Integer completedTasks;

        /**
         * 当日平均质量分
         */
        private BigDecimal avgQuality;
    }

    /**
     * 预测准确率详情
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PredictionAccuracyDTO {
        /**
         * 整体准确率 (0-1)
         */
        private BigDecimal overallAccuracy;

        /**
         * 样本数量
         */
        private Long sampleCount;

        /**
         * 按工艺类型的准确率分解
         */
        private Map<ProcessingStageType, StageAccuracy> byStageType;

        /**
         * 准确率趋势 (近期变化)
         */
        private List<AccuracyTrend> trend;

        /**
         * 平均预测误差
         */
        private BigDecimal avgPredictionError;

        /**
         * 预测误差标准差
         */
        private BigDecimal predictionErrorStdDev;
    }

    /**
     * 工艺类型准确率
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StageAccuracy {
        /**
         * 工艺类型
         */
        private ProcessingStageType stageType;

        /**
         * 准确率
         */
        private BigDecimal accuracy;

        /**
         * 样本数
         */
        private Long sampleCount;

        /**
         * 平均效率
         */
        private BigDecimal avgEfficiency;
    }

    /**
     * 准确率趋势
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AccuracyTrend {
        /**
         * 日期
         */
        private LocalDate date;

        /**
         * 准确率
         */
        private BigDecimal accuracy;

        /**
         * 样本数
         */
        private Integer sampleCount;
    }

    /**
     * 多样性指标
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DiversityMetricsDTO {
        /**
         * 工厂整体多样性分数 (0-1)
         */
        private BigDecimal factoryDiversityScore;

        /**
         * 需要轮换的工人数
         */
        private Integer workersNeedingRotation;

        /**
         * 总工人数
         */
        private Integer totalWorkers;

        /**
         * 技能覆盖率 (工人覆盖的工序比例)
         */
        private BigDecimal skillCoverage;

        /**
         * 工序覆盖统计
         */
        private Map<String, ProcessCoverage> processCoverageStats;

        /**
         * 轮换建议列表
         */
        private List<RotationSuggestion> rotationSuggestions;

        /**
         * 多样性分数分布 (分数区间 -> 工人数)
         */
        private Map<String, Integer> diversityDistribution;
    }

    /**
     * 工序覆盖统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProcessCoverage {
        /**
         * 工序类型
         */
        private String processType;

        /**
         * 熟练工人数
         */
        private Integer skilledWorkers;

        /**
         * 总分配次数
         */
        private Integer totalAllocations;

        /**
         * 平均效率
         */
        private BigDecimal avgEfficiency;
    }

    /**
     * 轮换建议
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RotationSuggestion {
        /**
         * 工人ID
         */
        private Long workerId;

        /**
         * 工人工号
         */
        private String workerCode;

        /**
         * 当前主要工序
         */
        private String dominantProcess;

        /**
         * 占比
         */
        private BigDecimal dominantRatio;

        /**
         * 建议尝试的工序
         */
        private List<String> suggestedProcesses;

        /**
         * 连续天数
         */
        private Integer consecutiveDays;
    }
}
