package com.cretas.aims.dto.smartbi.chart;

import lombok.*;

/**
 * Request for adaptive chart generation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdaptiveChartRequest {
    private Long uploadId;
    private boolean evaluateFirst;
    private Integer maxCharts;
    private boolean fusionEnabled;
    private String preferredChartType; // optional hint
}
