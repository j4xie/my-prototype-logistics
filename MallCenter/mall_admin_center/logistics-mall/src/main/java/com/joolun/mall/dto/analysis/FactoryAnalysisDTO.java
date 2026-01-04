package com.joolun.mall.dto.analysis;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FactoryAnalysisDTO {
    private FactoryInfo factory;
    private String reportDate;
    private String overallScore;
    private String scoreLevel;
    private String percentile;
    private List<MetricItem> keyMetrics;
    private List<MonthlyDataItem> monthlyData;
    private List<String> strengths;
    private List<String> weaknesses;
    private List<InsightItem> insights;
    private String status;
    private String errorMessage;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FactoryInfo {
        private String id;
        private String name;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MetricItem {
        private String label;
        private String value;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthlyDataItem {
        private String month;
        private Integer percent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InsightItem {
        private String icon;
        private String title;
        private String desc;
    }
}




























