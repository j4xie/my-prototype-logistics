package com.cretas.aims.service.smartbi.chart;

import com.cretas.aims.dto.smartbi.chart.*;
import java.util.*;

/**
 * Interface for evaluating chart sufficiency via LLM.
 * Determines if a chart type adequately represents the data.
 */
public interface ChartSufficiencyEvaluator {

    /**
     * Evaluate if current chart type sufficiently displays the data
     * @param data List of row data
     * @param features Extracted data features
     * @param currentChartType The chart type being evaluated
     * @return ChartSufficiencyResult with evaluation details
     */
    ChartSufficiencyResult evaluate(
        List<Map<String, Object>> data,
        DataFeatures features,
        String currentChartType
    );

    /**
     * Evaluate without existing chart (initial analysis)
     * @param data List of row data
     * @param features Extracted data features
     * @return ChartSufficiencyResult with recommended chart types
     */
    ChartSufficiencyResult evaluateInitial(
        List<Map<String, Object>> data,
        DataFeatures features
    );
}
