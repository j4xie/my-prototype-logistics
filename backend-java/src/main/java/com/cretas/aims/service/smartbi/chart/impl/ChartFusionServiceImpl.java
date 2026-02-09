package com.cretas.aims.service.smartbi.chart.impl;

import com.cretas.aims.dto.smartbi.chart.AdaptiveChartResponse;
import com.cretas.aims.service.smartbi.chart.ChartFusionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of ChartFusionService for fusing multiple charts into composite visualizations.
 * Supports various fusion strategies: PARALLEL, OVERLAY, LINKED, and COMPOSITE.
 */
@Slf4j
@Service
public class ChartFusionServiceImpl implements ChartFusionService {

    // Chart type compatibility for fusion - defines which types can overlay together
    private static final Map<String, Set<String>> FUSION_COMPATIBLE = Map.of(
        "bar", Set.of("line", "scatter", "area"),
        "line", Set.of("bar", "scatter", "area"),
        "area", Set.of("line", "bar", "scatter"),
        "pie", Set.of("pie"),  // Only fuse pies as nested donut
        "scatter", Set.of("line", "bar", "area"),
        "radar", Set.of("radar"),
        "gauge", Set.of("gauge")
    );

    // Chart types that use Cartesian coordinate system
    private static final Set<String> CARTESIAN_TYPES = Set.of("bar", "line", "scatter", "area");

    // Chart types that use polar or special coordinate system
    private static final Set<String> POLAR_TYPES = Set.of("pie", "radar", "gauge", "funnel");

    @Override
    public AdaptiveChartResponse.GeneratedChart fuseCharts(
            List<AdaptiveChartResponse.GeneratedChart> charts,
            FusionStrategy strategy) {

        if (charts == null || charts.size() < 2) {
            log.warn("Cannot fuse charts: need at least 2 charts, got {}",
                charts == null ? 0 : charts.size());
            return charts != null && !charts.isEmpty() ? charts.get(0) : null;
        }

        log.info("Fusing {} charts with strategy: {}", charts.size(), strategy);

        try {
            return switch (strategy) {
                case PARALLEL -> createParallelLayout(charts);
                case OVERLAY -> createOverlayChart(charts);
                case LINKED -> createLinkedCharts(charts);
                case COMPOSITE -> createCompositeChart(charts);
            };
        } catch (Exception e) {
            log.error("Error fusing charts with strategy {}: {}", strategy, e.getMessage(), e);
            // Fallback to parallel layout as it's the safest
            return createParallelLayout(charts);
        }
    }

    @Override
    public FusionStrategy recommendFusionStrategy(List<AdaptiveChartResponse.GeneratedChart> charts) {
        if (charts == null || charts.size() < 2) {
            return FusionStrategy.PARALLEL;
        }

        Set<String> chartTypes = charts.stream()
            .map(AdaptiveChartResponse.GeneratedChart::getType)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

        log.debug("Analyzing fusion strategy for chart types: {}", chartTypes);

        // If all charts are the same Cartesian type, OVERLAY works well
        if (chartTypes.size() == 1 && CARTESIAN_TYPES.containsAll(chartTypes)) {
            return FusionStrategy.OVERLAY;
        }

        // If chart types are overlay compatible (e.g., bar + line), use OVERLAY
        if (chartTypes.size() == 2 && areOverlayCompatible(chartTypes)) {
            return FusionStrategy.OVERLAY;
        }

        // Contains pie/radar/gauge -> PARALLEL (can't easily overlay with Cartesian)
        if (!Collections.disjoint(chartTypes, POLAR_TYPES)) {
            return FusionStrategy.PARALLEL;
        }

        // Many different chart types -> LINKED for interactive exploration
        if (chartTypes.size() > 2) {
            return FusionStrategy.LINKED;
        }

        // Default to COMPOSITE for combining into unified visualization
        return FusionStrategy.COMPOSITE;
    }

    /**
     * Create parallel (side-by-side) layout with multiple charts in a grid.
     * Each chart maintains its own coordinate system.
     */
    private AdaptiveChartResponse.GeneratedChart createParallelLayout(
            List<AdaptiveChartResponse.GeneratedChart> charts) {

        Map<String, Object> fusedOption = new LinkedHashMap<>();

        int count = charts.size();
        int cols = count <= 2 ? count : (count <= 4 ? 2 : 3);
        int rows = (int) Math.ceil((double) count / cols);

        List<Map<String, Object>> grids = new ArrayList<>();
        List<Map<String, Object>> xAxes = new ArrayList<>();
        List<Map<String, Object>> yAxes = new ArrayList<>();
        List<Map<String, Object>> series = new ArrayList<>();
        List<Map<String, Object>> titles = new ArrayList<>();

        // Main title
        titles.add(Map.of(
            "text", "Comprehensive Analysis Dashboard",
            "left", "center",
            "top", "2%",
            "textStyle", Map.of("fontSize", 18, "fontWeight", "bold")
        ));

        double cellWidth = 100.0 / cols;
        double cellHeight = 85.0 / rows;
        double topOffset = 12.0;
        double padding = 8.0;

        for (int i = 0; i < count; i++) {
            AdaptiveChartResponse.GeneratedChart chart = charts.get(i);
            int col = i % cols;
            int row = i / cols;

            double left = col * cellWidth + padding;
            double top = topOffset + row * cellHeight + padding;
            double width = cellWidth - padding * 2;
            double height = cellHeight - padding * 2;

            Map<String, Object> chartOption = chart.getEchartsOption();
            if (chartOption == null) {
                chartOption = new HashMap<>();
            }

            String chartType = chart.getType();

            // Handle Cartesian coordinate charts
            if (CARTESIAN_TYPES.contains(chartType)) {
                // Add grid for this chart
                grids.add(Map.of(
                    "left", left + "%",
                    "top", top + "%",
                    "width", width + "%",
                    "height", height + "%",
                    "containLabel", true
                ));

                int gridIndex = grids.size() - 1;

                // Add xAxis with grid index
                Map<String, Object> xAxis = new HashMap<>(getAxisConfig(chartOption, "xAxis"));
                xAxis.put("gridIndex", gridIndex);
                xAxes.add(xAxis);

                // Add yAxis with grid index
                Map<String, Object> yAxis = new HashMap<>(getAxisConfig(chartOption, "yAxis"));
                yAxis.put("gridIndex", gridIndex);
                yAxes.add(yAxis);

                // Add series with axis indices
                List<Map<String, Object>> chartSeries = getSeriesFromOption(chartOption);
                for (Map<String, Object> s : chartSeries) {
                    Map<String, Object> newSeries = new HashMap<>(s);
                    newSeries.put("xAxisIndex", gridIndex);
                    newSeries.put("yAxisIndex", gridIndex);
                    series.add(newSeries);
                }

            } else if (POLAR_TYPES.contains(chartType)) {
                // Handle pie/radar/gauge - position them directly
                List<Map<String, Object>> chartSeries = getSeriesFromOption(chartOption);
                for (Map<String, Object> s : chartSeries) {
                    Map<String, Object> newSeries = new HashMap<>(s);

                    // Calculate center position for pie/radar
                    double centerX = left + width / 2;
                    double centerY = top + height / 2;

                    if ("pie".equals(chartType)) {
                        newSeries.put("center", List.of(centerX + "%", centerY + "%"));
                        double radius = Math.min(width, height) * 0.35;
                        newSeries.put("radius", List.of("30%", radius + "%"));
                    } else if ("radar".equals(chartType)) {
                        // Radar needs polar coordinate
                        newSeries.put("center", List.of(centerX + "%", centerY + "%"));
                    } else if ("gauge".equals(chartType)) {
                        newSeries.put("center", List.of(centerX + "%", centerY + "%"));
                        newSeries.put("radius", (Math.min(width, height) * 0.4) + "%");
                    }

                    series.add(newSeries);
                }

                // Handle radar's indicator config
                if ("radar".equals(chartType) && chartOption.containsKey("radar")) {
                    if (!fusedOption.containsKey("radar")) {
                        fusedOption.put("radar", new ArrayList<>());
                    }
                    @SuppressWarnings("unchecked")
                    List<Object> radarConfigs = (List<Object>) fusedOption.get("radar");
                    Map<String, Object> radarConfig = new HashMap<>(asMap(chartOption.get("radar")));
                    double centerX = left + width / 2;
                    double centerY = top + height / 2;
                    radarConfig.put("center", List.of(centerX + "%", centerY + "%"));
                    radarConfigs.add(radarConfig);
                }
            }

            // Add sub-title for each chart
            String chartPurpose = chart.getPurpose() != null ? chart.getPurpose() : chartType;
            titles.add(Map.of(
                "text", chartPurpose,
                "left", (left + width / 2) + "%",
                "top", (top - 3) + "%",
                "textAlign", "center",
                "textStyle", Map.of("fontSize", 12, "fontWeight", "normal", "color", "#666")
            ));
        }

        // Build the fused option
        fusedOption.put("title", titles);
        fusedOption.put("tooltip", Map.of(
            "trigger", "axis",
            "axisPointer", Map.of("type", "cross")
        ));

        if (!grids.isEmpty()) {
            fusedOption.put("grid", grids);
        }
        if (!xAxes.isEmpty()) {
            fusedOption.put("xAxis", xAxes);
        }
        if (!yAxes.isEmpty()) {
            fusedOption.put("yAxis", yAxes);
        }

        fusedOption.put("series", series);

        // Collect all legend items
        Set<String> legendItems = new LinkedHashSet<>();
        for (Map<String, Object> s : series) {
            if (s.containsKey("name")) {
                legendItems.add(String.valueOf(s.get("name")));
            }
        }
        if (!legendItems.isEmpty()) {
            fusedOption.put("legend", Map.of(
                "data", new ArrayList<>(legendItems),
                "top", "bottom",
                "type", "scroll"
            ));
        }

        // Add toolbox for interactivity
        fusedOption.put("toolbox", Map.of(
            "feature", Map.of(
                "saveAsImage", Map.of("title", "Save"),
                "dataView", Map.of("title", "Data View", "readOnly", true),
                "restore", Map.of("title", "Restore")
            ),
            "right", "20"
        ));

        return AdaptiveChartResponse.GeneratedChart.builder()
            .id("chart_fused_parallel_" + System.currentTimeMillis())
            .type("composite")
            .purpose("Comprehensive Analysis Dashboard - Parallel Layout")
            .priority("high")
            .echartsOption(fusedOption)
            .fusedFrom(charts.stream()
                .map(AdaptiveChartResponse.GeneratedChart::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList()))
            .build();
    }

    /**
     * Create overlay chart with multiple series on the same coordinate system.
     * Best for combining bar + line or multiple lines.
     */
    private AdaptiveChartResponse.GeneratedChart createOverlayChart(
            List<AdaptiveChartResponse.GeneratedChart> charts) {

        Map<String, Object> fusedOption = new LinkedHashMap<>();

        // Collect all series and determine axis configuration
        List<Map<String, Object>> allSeries = new ArrayList<>();
        Set<Object> allXAxisData = new LinkedHashSet<>();
        List<String> yAxisNames = new ArrayList<>();
        boolean hasDualYAxis = false;

        // Analyze if we need dual Y axis (different data scales)
        List<Double> allValues = new ArrayList<>();
        for (AdaptiveChartResponse.GeneratedChart chart : charts) {
            Map<String, Object> option = chart.getEchartsOption();
            if (option == null) continue;

            List<Map<String, Object>> chartSeries = getSeriesFromOption(option);
            for (Map<String, Object> s : chartSeries) {
                @SuppressWarnings("unchecked")
                List<Object> data = (List<Object>) s.get("data");
                if (data != null) {
                    for (Object d : data) {
                        if (d instanceof Number) {
                            allValues.add(((Number) d).doubleValue());
                        } else if (d instanceof Map) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> point = (Map<String, Object>) d;
                            Object value = point.get("value");
                            if (value instanceof Number) {
                                allValues.add(((Number) value).doubleValue());
                            }
                        }
                    }
                }
            }
        }

        // Check if data range varies significantly (more than 10x difference)
        if (!allValues.isEmpty()) {
            double min = allValues.stream().mapToDouble(Double::doubleValue).min().orElse(0);
            double max = allValues.stream().mapToDouble(Double::doubleValue).max().orElse(0);
            hasDualYAxis = min > 0 && max / min > 10;
        }

        // Process each chart
        int seriesIndex = 0;
        for (int i = 0; i < charts.size(); i++) {
            AdaptiveChartResponse.GeneratedChart chart = charts.get(i);
            Map<String, Object> option = chart.getEchartsOption();
            if (option == null) continue;

            // Collect x-axis categories
            Map<String, Object> xAxisConfig = getAxisConfig(option, "xAxis");
            if (xAxisConfig.containsKey("data")) {
                @SuppressWarnings("unchecked")
                List<Object> xData = (List<Object>) xAxisConfig.get("data");
                allXAxisData.addAll(xData);
            }

            // Collect y-axis name
            Map<String, Object> yAxisConfig = getAxisConfig(option, "yAxis");
            if (yAxisConfig.containsKey("name")) {
                yAxisNames.add(String.valueOf(yAxisConfig.get("name")));
            }

            // Collect and modify series
            List<Map<String, Object>> chartSeries = getSeriesFromOption(option);
            for (Map<String, Object> s : chartSeries) {
                Map<String, Object> newSeries = new HashMap<>(s);

                // Assign to second y-axis for line charts when overlaying with bar
                if (hasDualYAxis && "line".equals(s.get("type"))) {
                    newSeries.put("yAxisIndex", 1);
                }

                // Ensure unique name
                if (!newSeries.containsKey("name") || newSeries.get("name") == null) {
                    newSeries.put("name", "Series " + (seriesIndex + 1));
                }

                allSeries.add(newSeries);
                seriesIndex++;
            }
        }

        // Build title
        String title = charts.stream()
            .map(AdaptiveChartResponse.GeneratedChart::getPurpose)
            .filter(Objects::nonNull)
            .collect(Collectors.joining(" & "));
        fusedOption.put("title", Map.of(
            "text", title.isEmpty() ? "Combined Analysis" : title,
            "left", "center"
        ));

        // Build tooltip
        fusedOption.put("tooltip", Map.of(
            "trigger", "axis",
            "axisPointer", Map.of(
                "type", "cross",
                "crossStyle", Map.of("color", "#999")
            )
        ));

        // Build legend
        Set<String> legendItems = new LinkedHashSet<>();
        for (Map<String, Object> s : allSeries) {
            if (s.containsKey("name")) {
                legendItems.add(String.valueOf(s.get("name")));
            }
        }
        fusedOption.put("legend", Map.of(
            "data", new ArrayList<>(legendItems),
            "top", "bottom"
        ));

        // Build x-axis
        fusedOption.put("xAxis", List.of(Map.of(
            "type", "category",
            "data", new ArrayList<>(allXAxisData),
            "axisPointer", Map.of("type", "shadow")
        )));

        // Build y-axis (single or dual)
        List<Map<String, Object>> yAxes = new ArrayList<>();
        yAxes.add(Map.of(
            "type", "value",
            "name", yAxisNames.isEmpty() ? "" : yAxisNames.get(0),
            "position", "left"
        ));

        if (hasDualYAxis) {
            yAxes.add(Map.of(
                "type", "value",
                "name", yAxisNames.size() > 1 ? yAxisNames.get(1) : "",
                "position", "right",
                "splitLine", Map.of("show", false)
            ));
        }
        fusedOption.put("yAxis", yAxes);

        // Add series
        fusedOption.put("series", allSeries);

        // Add grid
        fusedOption.put("grid", Map.of(
            "left", "3%",
            "right", hasDualYAxis ? "8%" : "4%",
            "bottom", "15%",
            "containLabel", true
        ));

        // Add toolbox
        fusedOption.put("toolbox", Map.of(
            "feature", Map.of(
                "saveAsImage", Map.of("title", "Save"),
                "magicType", Map.of(
                    "type", List.of("line", "bar", "stack"),
                    "title", Map.of("line", "Line", "bar", "Bar", "stack", "Stack")
                ),
                "restore", Map.of("title", "Restore")
            ),
            "right", "20"
        ));

        return AdaptiveChartResponse.GeneratedChart.builder()
            .id("chart_fused_overlay_" + System.currentTimeMillis())
            .type("composite")
            .purpose("Combined Analysis - Overlay")
            .priority("high")
            .echartsOption(fusedOption)
            .fusedFrom(charts.stream()
                .map(AdaptiveChartResponse.GeneratedChart::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList()))
            .build();
    }

    /**
     * Create linked charts with dataZoom connecting them for synchronized browsing.
     * Great for time-series data where you want to zoom into the same period across charts.
     */
    private AdaptiveChartResponse.GeneratedChart createLinkedCharts(
            List<AdaptiveChartResponse.GeneratedChart> charts) {

        Map<String, Object> fusedOption = new LinkedHashMap<>();

        int count = charts.size();
        List<Map<String, Object>> grids = new ArrayList<>();
        List<Map<String, Object>> xAxes = new ArrayList<>();
        List<Map<String, Object>> yAxes = new ArrayList<>();
        List<Map<String, Object>> series = new ArrayList<>();
        List<Map<String, Object>> dataZooms = new ArrayList<>();
        List<Map<String, Object>> titles = new ArrayList<>();

        // Main title
        titles.add(Map.of(
            "text", "Linked Analysis View",
            "left", "center",
            "top", "1%"
        ));

        double heightPerChart = 75.0 / count;
        double topOffset = 8.0;
        double bottomMargin = 15.0; // Space for dataZoom

        for (int i = 0; i < count; i++) {
            AdaptiveChartResponse.GeneratedChart chart = charts.get(i);
            Map<String, Object> option = chart.getEchartsOption();
            if (option == null) {
                option = new HashMap<>();
            }

            double top = topOffset + i * heightPerChart;

            // Add grid
            grids.add(Map.of(
                "left", "8%",
                "right", "8%",
                "top", top + "%",
                "height", (heightPerChart - 5) + "%"
            ));

            // Add xAxis linked to grid
            Map<String, Object> xAxis = new HashMap<>(getAxisConfig(option, "xAxis"));
            xAxis.put("gridIndex", i);
            // Only show axis labels on the bottom chart
            if (i < count - 1) {
                xAxis.put("axisLabel", Map.of("show", false));
                xAxis.put("axisTick", Map.of("show", false));
            }
            xAxes.add(xAxis);

            // Add yAxis linked to grid
            Map<String, Object> yAxis = new HashMap<>(getAxisConfig(option, "yAxis"));
            yAxis.put("gridIndex", i);
            yAxis.put("name", chart.getPurpose() != null ? chart.getPurpose() : "");
            yAxis.put("nameLocation", "middle");
            yAxis.put("nameGap", 50);
            yAxes.add(yAxis);

            // Add series linked to axes
            List<Map<String, Object>> chartSeries = getSeriesFromOption(option);
            for (Map<String, Object> s : chartSeries) {
                Map<String, Object> newSeries = new HashMap<>(s);
                newSeries.put("xAxisIndex", i);
                newSeries.put("yAxisIndex", i);
                series.add(newSeries);
            }
        }

        // Create linked dataZoom controls
        List<Integer> xAxisIndices = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            xAxisIndices.add(i);
        }

        // Slider dataZoom at the bottom
        dataZooms.add(Map.of(
            "type", "slider",
            "xAxisIndex", xAxisIndices,
            "bottom", "3%",
            "height", "20",
            "start", 0,
            "end", 100
        ));

        // Inside dataZoom for scroll/pinch interaction
        dataZooms.add(Map.of(
            "type", "inside",
            "xAxisIndex", xAxisIndices,
            "start", 0,
            "end", 100
        ));

        fusedOption.put("title", titles);
        fusedOption.put("grid", grids);
        fusedOption.put("xAxis", xAxes);
        fusedOption.put("yAxis", yAxes);
        fusedOption.put("series", series);
        fusedOption.put("dataZoom", dataZooms);

        fusedOption.put("tooltip", Map.of(
            "trigger", "axis",
            "axisPointer", Map.of(
                "type", "line",
                "link", List.of(Map.of("xAxisIndex", "all"))
            )
        ));

        // Collect all legend items
        Set<String> legendItems = new LinkedHashSet<>();
        for (Map<String, Object> s : series) {
            if (s.containsKey("name")) {
                legendItems.add(String.valueOf(s.get("name")));
            }
        }
        if (!legendItems.isEmpty()) {
            fusedOption.put("legend", Map.of(
                "data", new ArrayList<>(legendItems),
                "top", "4%",
                "type", "scroll"
            ));
        }

        // Add toolbox
        fusedOption.put("toolbox", Map.of(
            "feature", Map.of(
                "saveAsImage", Map.of("title", "Save"),
                "dataZoom", Map.of("title", Map.of("zoom", "Zoom", "back", "Reset")),
                "restore", Map.of("title", "Restore")
            ),
            "right", "20"
        ));

        return AdaptiveChartResponse.GeneratedChart.builder()
            .id("chart_fused_linked_" + System.currentTimeMillis())
            .type("composite")
            .purpose("Linked Analysis - Synchronized Zoom")
            .priority("high")
            .echartsOption(fusedOption)
            .fusedFrom(charts.stream()
                .map(AdaptiveChartResponse.GeneratedChart::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList()))
            .build();
    }

    /**
     * Create a composite chart that combines data into a new visualization type.
     * Examples: nested donut from multiple pies, or combining metrics into a single complex view.
     */
    private AdaptiveChartResponse.GeneratedChart createCompositeChart(
            List<AdaptiveChartResponse.GeneratedChart> charts) {

        Map<String, Object> fusedOption = new LinkedHashMap<>();

        Set<String> chartTypes = charts.stream()
            .map(AdaptiveChartResponse.GeneratedChart::getType)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

        // If all pies, create nested donut
        if (chartTypes.size() == 1 && chartTypes.contains("pie")) {
            return createNestedDonut(charts);
        }

        // For mixed types or other cases, create a sophisticated multi-axis chart
        List<Map<String, Object>> series = new ArrayList<>();
        List<Map<String, Object>> yAxes = new ArrayList<>();
        Set<Object> allXAxisData = new LinkedHashSet<>();

        // Collect all x-axis data first
        for (AdaptiveChartResponse.GeneratedChart chart : charts) {
            Map<String, Object> option = chart.getEchartsOption();
            if (option == null) continue;

            Map<String, Object> xAxisConfig = getAxisConfig(option, "xAxis");
            if (xAxisConfig.containsKey("data")) {
                @SuppressWarnings("unchecked")
                List<Object> xData = (List<Object>) xAxisConfig.get("data");
                allXAxisData.addAll(xData);
            }
        }

        // Process each chart and assign to different y-axes
        int yAxisIndex = 0;
        String[] positions = {"left", "right"};
        int[] offsets = {0, 0};

        for (AdaptiveChartResponse.GeneratedChart chart : charts) {
            Map<String, Object> option = chart.getEchartsOption();
            if (option == null) continue;

            String chartType = chart.getType();
            String position = positions[yAxisIndex % 2];

            // Create y-axis for this chart's data
            Map<String, Object> yAxisConfig = getAxisConfig(option, "yAxis");
            Map<String, Object> newYAxis = new HashMap<>(yAxisConfig);
            newYAxis.put("position", position);
            newYAxis.put("offset", offsets[yAxisIndex % 2]);
            newYAxis.put("name", chart.getPurpose() != null ? chart.getPurpose() : chartType);

            // Style alternating axes
            if (yAxisIndex % 2 == 1) {
                newYAxis.put("splitLine", Map.of("show", false));
            }

            yAxes.add(newYAxis);

            // Increase offset for next axis on same side
            offsets[yAxisIndex % 2] += 60;

            // Add series with y-axis reference
            List<Map<String, Object>> chartSeries = getSeriesFromOption(option);
            for (Map<String, Object> s : chartSeries) {
                Map<String, Object> newSeries = new HashMap<>(s);
                newSeries.put("yAxisIndex", yAxisIndex);

                // Add visual distinction
                if (yAxisIndex > 0) {
                    // Use different style for secondary data
                    if ("bar".equals(s.get("type"))) {
                        newSeries.put("barGap", "30%");
                    }
                }

                series.add(newSeries);
            }

            yAxisIndex++;
        }

        // Build title
        String title = charts.stream()
            .map(AdaptiveChartResponse.GeneratedChart::getPurpose)
            .filter(Objects::nonNull)
            .limit(3)
            .collect(Collectors.joining(", "));

        fusedOption.put("title", Map.of(
            "text", "Composite Analysis",
            "subtext", title,
            "left", "center"
        ));

        fusedOption.put("tooltip", Map.of(
            "trigger", "axis",
            "axisPointer", Map.of("type", "cross")
        ));

        // Legend
        Set<String> legendItems = new LinkedHashSet<>();
        for (Map<String, Object> s : series) {
            if (s.containsKey("name")) {
                legendItems.add(String.valueOf(s.get("name")));
            }
        }
        fusedOption.put("legend", Map.of(
            "data", new ArrayList<>(legendItems),
            "top", "bottom",
            "type", "scroll"
        ));

        // X-axis
        fusedOption.put("xAxis", List.of(Map.of(
            "type", "category",
            "data", new ArrayList<>(allXAxisData),
            "axisPointer", Map.of("type", "shadow")
        )));

        // Y-axes
        fusedOption.put("yAxis", yAxes);

        // Series
        fusedOption.put("series", series);

        // Grid with space for multiple y-axes
        int leftPadding = 3 + Math.max(0, (yAxes.size() / 2 - 1) * 6);
        int rightPadding = 3 + Math.max(0, ((yAxes.size() + 1) / 2 - 1) * 6);
        fusedOption.put("grid", Map.of(
            "left", leftPadding + "%",
            "right", rightPadding + "%",
            "bottom", "15%",
            "containLabel", true
        ));

        // Toolbox
        fusedOption.put("toolbox", Map.of(
            "feature", Map.of(
                "saveAsImage", Map.of("title", "Save"),
                "magicType", Map.of(
                    "type", List.of("line", "bar"),
                    "title", Map.of("line", "Line", "bar", "Bar")
                ),
                "dataView", Map.of("title", "Data View", "readOnly", true),
                "restore", Map.of("title", "Restore")
            ),
            "right", "20"
        ));

        return AdaptiveChartResponse.GeneratedChart.builder()
            .id("chart_fused_composite_" + System.currentTimeMillis())
            .type("composite")
            .purpose("Composite Multi-Metric Analysis")
            .priority("high")
            .echartsOption(fusedOption)
            .fusedFrom(charts.stream()
                .map(AdaptiveChartResponse.GeneratedChart::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList()))
            .build();
    }

    /**
     * Create a nested donut chart from multiple pie charts.
     */
    private AdaptiveChartResponse.GeneratedChart createNestedDonut(
            List<AdaptiveChartResponse.GeneratedChart> charts) {

        Map<String, Object> fusedOption = new LinkedHashMap<>();
        List<Map<String, Object>> series = new ArrayList<>();

        int count = charts.size();
        double innerRadiusStep = 60.0 / count;
        double outerRadiusBase = 25.0;

        for (int i = 0; i < count; i++) {
            AdaptiveChartResponse.GeneratedChart chart = charts.get(i);
            Map<String, Object> option = chart.getEchartsOption();
            if (option == null) continue;

            List<Map<String, Object>> chartSeries = getSeriesFromOption(option);
            for (Map<String, Object> s : chartSeries) {
                Map<String, Object> newSeries = new HashMap<>(s);

                // Calculate radius for this ring
                double innerRadius = outerRadiusBase + i * innerRadiusStep;
                double outerRadius = innerRadius + innerRadiusStep - 3;

                newSeries.put("radius", List.of(innerRadius + "%", outerRadius + "%"));
                newSeries.put("center", List.of("50%", "50%"));

                // Label configuration based on ring position
                if (i == count - 1) {
                    // Outermost ring - show labels outside
                    newSeries.put("label", Map.of(
                        "show", true,
                        "position", "outside",
                        "formatter", "{b}: {d}%"
                    ));
                    newSeries.put("labelLine", Map.of("show", true));
                } else {
                    // Inner rings - show labels inside or hide
                    newSeries.put("label", Map.of(
                        "show", true,
                        "position", "inside",
                        "formatter", "{d}%",
                        "fontSize", 10
                    ));
                    newSeries.put("labelLine", Map.of("show", false));
                }

                // Ensure name is set for legend
                if (!newSeries.containsKey("name") || newSeries.get("name") == null) {
                    newSeries.put("name", chart.getPurpose() != null ? chart.getPurpose() : "Ring " + (i + 1));
                }

                series.add(newSeries);
            }
        }

        fusedOption.put("title", Map.of(
            "text", "Distribution Analysis",
            "subtext", "Nested Donut View",
            "left", "center"
        ));

        fusedOption.put("tooltip", Map.of(
            "trigger", "item",
            "formatter", "{a} <br/>{b}: {c} ({d}%)"
        ));

        // Collect all legend items from all pie data
        Set<String> legendItems = new LinkedHashSet<>();
        for (Map<String, Object> s : series) {
            @SuppressWarnings("unchecked")
            List<Object> data = (List<Object>) s.get("data");
            if (data != null) {
                for (Object d : data) {
                    if (d instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> item = (Map<String, Object>) d;
                        if (item.containsKey("name")) {
                            legendItems.add(String.valueOf(item.get("name")));
                        }
                    }
                }
            }
        }

        fusedOption.put("legend", Map.of(
            "data", new ArrayList<>(legendItems),
            "orient", "vertical",
            "left", "left",
            "top", "middle",
            "type", "scroll"
        ));

        fusedOption.put("series", series);

        fusedOption.put("toolbox", Map.of(
            "feature", Map.of(
                "saveAsImage", Map.of("title", "Save")
            ),
            "right", "20"
        ));

        return AdaptiveChartResponse.GeneratedChart.builder()
            .id("chart_fused_nested_donut_" + System.currentTimeMillis())
            .type("pie")
            .purpose("Distribution Analysis - Nested Donut")
            .priority("high")
            .echartsOption(fusedOption)
            .fusedFrom(charts.stream()
                .map(AdaptiveChartResponse.GeneratedChart::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList()))
            .build();
    }

    // ========== Helper Methods ==========

    /**
     * Check if given chart types can be overlaid on the same coordinate system.
     */
    private boolean areOverlayCompatible(Set<String> chartTypes) {
        if (chartTypes.isEmpty()) {
            return false;
        }

        // All types must be in Cartesian system
        if (!CARTESIAN_TYPES.containsAll(chartTypes)) {
            return false;
        }

        // Check pairwise compatibility
        List<String> typeList = new ArrayList<>(chartTypes);
        for (int i = 0; i < typeList.size(); i++) {
            for (int j = i + 1; j < typeList.size(); j++) {
                String type1 = typeList.get(i);
                String type2 = typeList.get(j);

                Set<String> compatible1 = FUSION_COMPATIBLE.getOrDefault(type1, Set.of());
                if (!compatible1.contains(type2)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Extract axis configuration from chart option.
     */
    private Map<String, Object> getAxisConfig(Map<String, Object> option, String axisKey) {
        if (option == null || !option.containsKey(axisKey)) {
            return getDefaultAxisConfig(axisKey);
        }

        Object axis = option.get(axisKey);
        if (axis instanceof List) {
            @SuppressWarnings("unchecked")
            List<Object> axisList = (List<Object>) axis;
            if (!axisList.isEmpty() && axisList.get(0) instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> firstAxis = (Map<String, Object>) axisList.get(0);
                return new HashMap<>(firstAxis);
            }
        } else if (axis instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> axisMap = (Map<String, Object>) axis;
            return new HashMap<>(axisMap);
        }

        return getDefaultAxisConfig(axisKey);
    }

    /**
     * Get default axis configuration.
     */
    private Map<String, Object> getDefaultAxisConfig(String axisKey) {
        Map<String, Object> defaultConfig = new HashMap<>();
        if ("xAxis".equals(axisKey)) {
            defaultConfig.put("type", "category");
            defaultConfig.put("data", new ArrayList<>());
        } else if ("yAxis".equals(axisKey)) {
            defaultConfig.put("type", "value");
        }
        return defaultConfig;
    }

    /**
     * Extract series list from chart option.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getSeriesFromOption(Map<String, Object> option) {
        if (option == null || !option.containsKey("series")) {
            return new ArrayList<>();
        }

        Object series = option.get("series");
        if (series instanceof List) {
            List<Object> seriesList = (List<Object>) series;
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object s : seriesList) {
                if (s instanceof Map) {
                    result.add(new HashMap<>((Map<String, Object>) s));
                }
            }
            return result;
        }

        return new ArrayList<>();
    }

    /**
     * Safely convert object to Map.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object obj) {
        if (obj instanceof Map) {
            return new HashMap<>((Map<String, Object>) obj);
        }
        return new HashMap<>();
    }
}
