package com.cretas.aims.service.smartbi.chart;

import com.cretas.aims.dto.smartbi.chart.DataFeatures;
import java.util.*;

/**
 * Interface for extracting data features from parsed Excel/CSV data.
 * Used to analyze data patterns for adaptive chart generation.
 */
public interface DataFeatureExtractor {

    /**
     * Extract features from parsed data
     * @param data List of row data as maps
     * @param headers Column headers
     * @return DataFeatures containing all extracted characteristics
     */
    DataFeatures extract(List<Map<String, Object>> data, List<String> headers);

    /**
     * Detect if data has time series pattern
     * @param data List of row data
     * @param headers Column headers
     * @return true if time series pattern detected
     */
    boolean detectTimeSeries(List<Map<String, Object>> data, List<String> headers);

    /**
     * Detect if data has proportion/percentage pattern
     * @param data List of row data
     * @return true if proportion pattern detected
     */
    boolean detectProportion(List<Map<String, Object>> data);

    /**
     * Detect if data has comparison pattern (YoY, MoM, budget vs actual)
     * @param data List of row data
     * @param headers Column headers
     * @return true if comparison pattern detected
     */
    boolean detectComparison(List<Map<String, Object>> data, List<String> headers);

    /**
     * Detect hierarchical data structure
     * @param data List of row data
     * @param headers Column headers
     * @return true if hierarchical structure detected
     */
    boolean detectHierarchy(List<Map<String, Object>> data, List<String> headers);
}
