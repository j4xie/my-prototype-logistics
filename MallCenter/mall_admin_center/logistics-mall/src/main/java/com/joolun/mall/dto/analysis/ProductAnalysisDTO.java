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
public class ProductAnalysisDTO {
    private ProductInfo product;
    private List<MetricItem> coreMetrics;
    private List<QualityMetric> qualityMetrics;
    private List<ComparisonItem> comparison;
    private List<ReviewItem> reviews;
    private List<String> tags;
    private AiSuggestion aiSuggestion;
    private String status;
    private String errorMessage;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductInfo {
        private String id;
        private String name;
        private String category;
        private String image;
        private String stars;
        private String score;
        private String reviewCount;
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
    public static class QualityMetric {
        private String label;
        private Integer score;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ComparisonItem {
        private String metric;
        private String value;
        private String arrow;
        private String average;
        private boolean better;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReviewItem {
        private Integer id;
        private String user;
        private String date;
        private String stars;
        private String content;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AiSuggestion {
        private List<String> strengths;
        private List<String> improvements;
    }
}
















