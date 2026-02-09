package com.cretas.aims.service.smartbi.chart;

import com.cretas.aims.dto.smartbi.chart.*;
import java.util.*;

/**
 * Interface for fusing multiple charts into composite visualizations.
 * Supports various fusion strategies for combining related charts.
 */
public interface ChartFusionService {

    /**
     * Fusion strategies for combining charts
     */
    enum FusionStrategy {
        /** Side by side display */
        PARALLEL,
        /** Same coordinate system overlay */
        OVERLAY,
        /** Interactive linking between charts */
        LINKED,
        /** Combined into new chart type */
        COMPOSITE
    }

    /**
     * Fuse multiple charts into one composite chart
     * @param charts List of charts to fuse
     * @param strategy Fusion strategy to apply
     * @return Fused composite chart
     */
    AdaptiveChartResponse.GeneratedChart fuseCharts(
        List<AdaptiveChartResponse.GeneratedChart> charts,
        FusionStrategy strategy
    );

    /**
     * Determine best fusion strategy for given charts
     * @param charts List of charts to analyze
     * @return Recommended fusion strategy
     */
    FusionStrategy recommendFusionStrategy(
        List<AdaptiveChartResponse.GeneratedChart> charts
    );
}
