package com.cretas.aims.service.smartbi.chart;

import com.cretas.aims.dto.smartbi.chart.*;
import java.util.*;

/**
 * Main interface for adaptive chart generation.
 * Orchestrates the full flow from data analysis to chart generation.
 */
public interface AdaptiveChartGenerator {

    /**
     * Generate optimal charts based on data features and evaluation
     * @param data List of row data
     * @param features Extracted data features
     * @param evaluation Sufficiency evaluation result
     * @param maxCharts Maximum number of charts to generate
     * @return List of generated charts
     */
    List<AdaptiveChartResponse.GeneratedChart> generateOptimalCharts(
        List<Map<String, Object>> data,
        DataFeatures features,
        ChartSufficiencyResult evaluation,
        int maxCharts
    );

    /**
     * Generate a single chart of specific type
     * @param data List of row data
     * @param features Extracted data features
     * @param chartType The type of chart to generate
     * @param purpose Description of chart purpose
     * @return Generated chart configuration
     */
    AdaptiveChartResponse.GeneratedChart generateChart(
        List<Map<String, Object>> data,
        DataFeatures features,
        String chartType,
        String purpose
    );

    /**
     * Full adaptive chart generation flow
     * @param uploadId The upload session ID
     * @param request Adaptive chart generation request
     * @return Complete adaptive chart response
     */
    AdaptiveChartResponse generateAdaptive(
        Long uploadId,
        AdaptiveChartRequest request
    );
}
