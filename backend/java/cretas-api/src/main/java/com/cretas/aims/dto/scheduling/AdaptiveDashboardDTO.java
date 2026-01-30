package com.cretas.aims.dto.scheduling;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 自适应仪表盘 DTO
 */
@Data
public class AdaptiveDashboardDTO {
    private LocalDateTime updateTime;

    // 任务统计
    private SummaryStats summary;

    // 性能指标
    private PerformanceMetrics metrics;

    // 产线状态
    private LineStats lines;

    // 高风险任务
    private List<TaskRiskDTO> topRisks;

    // 重排建议
    private RescheduleRecommendationDTO rescheduleRecommendation;

    @Data
    public static class SummaryStats {
        private int totalActiveTasks;
        private int onTrackTasks;
        private int atRiskTasks;
        private int delayedTasks;
    }

    @Data
    public static class PerformanceMetrics {
        private double overallOnTimeRate;
        private double averageEfficiency;
        private double averageCompletionProbability;
    }

    @Data
    public static class LineStats {
        private int active;
        private int idle;
        private int maintenance;
    }
}
