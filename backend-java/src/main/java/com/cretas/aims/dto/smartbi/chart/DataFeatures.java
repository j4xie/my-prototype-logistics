package com.cretas.aims.dto.smartbi.chart;

import lombok.*;
import java.util.*;

/**
 * Data features extracted from uploaded data for adaptive chart generation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataFeatures {
    private int rowCount;
    private int columnCount;
    private List<String> columns;
    private List<String> numericColumns;
    private List<String> categoricalColumns;
    private List<String> timeColumns;
    private boolean hasTimeSeries;
    private boolean hasProportion;
    private boolean hasComparison;
    private boolean hasHierarchy;
    private boolean hasBudgetActual;
    private boolean hasYoYMoM;
    private Map<String, ValueRange> valueRanges;
    private Map<String, List<Object>> sampleValues;

    /**
     * Value range statistics for a numeric column.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ValueRange {
        private Double min;
        private Double max;
        private Double avg;
        private Double sum;
    }
}
