package com.cretas.aims.dto.smartbi.chart;

import lombok.*;
import java.util.*;

/**
 * Result of LLM chart sufficiency evaluation.
 * Determines if current chart(s) adequately display the data.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChartSufficiencyResult {
    private boolean sufficient;
    private int sufficiencyScore; // 0-100
    private List<String> displayedInfo;
    private List<String> missingInfo;
    private String recommendation;
    private List<SuggestedChart> suggestedCharts;

    /**
     * A suggested chart type with its purpose and priority.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SuggestedChart {
        private String type;
        private String purpose;
        private String priority; // high, medium, low
    }
}
