package com.cretas.aims.dto.smartbi.chart;

import lombok.*;
import java.util.*;

/**
 * Response with generated charts from adaptive chart generation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdaptiveChartResponse {
    private ChartSufficiencyResult evaluation;
    private List<GeneratedChart> charts;
    private DataFeatures dataFeatures;

    /**
     * A generated chart with its ECharts configuration.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GeneratedChart {
        private String id;
        private String type;
        private String purpose;
        private String priority;
        private Map<String, Object> echartsOption;
        private List<String> fusedFrom; // if this is a composite chart
    }
}
