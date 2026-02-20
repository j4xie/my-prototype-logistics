package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.AlternativeDimension;
import com.cretas.aims.dto.smartbi.DynamicChartConfig;
import com.cretas.aims.dto.smartbi.DynamicChartConfig.*;
import com.cretas.aims.dto.smartbi.FieldMappingWithChartRole;
import com.cretas.aims.dto.smartbi.FieldMappingWithChartRole.ChartAxisRole;
import com.cretas.aims.dto.smartbi.FieldMappingWithChartRole.FieldRole;
import com.cretas.aims.service.smartbi.DynamicChartConfigBuilderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 动态图表配置构建器
 *
 * 根据字段的 chartAxis 角色自动生成 ECharts 配置：
 * 1. 找到 X 轴字段（优先级最高的 X_AXIS）
 * 2. 找到 Series 字段（用于图例分组）
 * 3. 找到 Y 轴字段（度量值）
 * 4. 生成可切换的维度选项
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Slf4j
@Service
public class DynamicChartConfigBuilder implements DynamicChartConfigBuilderService {

    // ==================== 图表类型常量 ====================

    private static final String CHART_LINE = "LINE";
    private static final String CHART_BAR = "BAR";
    private static final String CHART_PIE = "PIE";
    private static final String CHART_SCATTER = "SCATTER";

    // ==================== 主要构建方法 ====================

    /**
     * 根据字段映射和聚合数据构建图表配置
     *
     * @param fields         带图表角色的字段映射列表
     * @param aggregatedData 聚合数据（可以是 List 或包含 data 的 Map）
     * @return 动态图表配置
     */
    @Override
    public DynamicChartConfig buildConfig(List<FieldMappingWithChartRole> fields,
                                           Map<String, Object> aggregatedData) {
        if (fields == null || fields.isEmpty()) {
            log.warn("字段映射列表为空，返回空配置");
            return DynamicChartConfig.builder().build();
        }

        // 1. 提取数据列表
        List<Map<String, Object>> dataList = extractDataList(aggregatedData);
        if (dataList.isEmpty()) {
            log.warn("聚合数据为空，返回基础配置");
            return buildEmptyConfig(fields);
        }

        // 2. 找到各角色字段
        FieldMappingWithChartRole xAxisField = findXAxisField(fields);
        FieldMappingWithChartRole seriesField = findSeriesField(fields);
        List<FieldMappingWithChartRole> yAxisFields = findYAxisFields(fields);

        if (xAxisField == null) {
            log.warn("未找到 X 轴字段，尝试使用第一个维度字段");
            xAxisField = findFirstDimensionField(fields);
        }

        if (yAxisFields.isEmpty()) {
            log.warn("未找到 Y 轴字段，尝试使用第一个度量字段");
            FieldMappingWithChartRole metric = findFirstMetricField(fields);
            if (metric != null) {
                yAxisFields = List.of(metric);
            }
        }

        // 3. 推断图表类型
        String chartType = inferChartType(xAxisField, seriesField, yAxisFields, dataList.size());

        // 4. 构建配置
        DynamicChartConfig config = DynamicChartConfig.builder()
                .chartType(chartType)
                .title(buildTitle(yAxisFields, xAxisField))
                .xAxis(buildXAxis(xAxisField, dataList))
                .yAxis(buildYAxis(yAxisFields))
                .legend(buildLegend(seriesField, yAxisFields, dataList))
                .series(buildSeries(chartType, seriesField, yAxisFields, dataList, xAxisField))
                .tooltip(buildTooltip(chartType))
                .alternativeXAxis(buildAlternativeXAxis(fields, xAxisField))
                .alternativeSeries(buildAlternativeSeries(fields, seriesField))
                .alternativeMeasures(buildAlternativeMeasures(fields, yAxisFields))
                .rawData(dataList)
                .totalRows(dataList.size())
                .fieldMappings(fields)
                .build();

        log.info("成功构建图表配置: chartType={}, xAxis={}, series={}, yAxis={}",
                chartType,
                xAxisField != null ? xAxisField.getStandardField() : "null",
                seriesField != null ? seriesField.getStandardField() : "null",
                yAxisFields.stream().map(FieldMappingWithChartRole::getStandardField)
                        .collect(Collectors.joining(",")));

        return config;
    }

    /**
     * 构建简化配置（当数据为空时）
     */
    private DynamicChartConfig buildEmptyConfig(List<FieldMappingWithChartRole> fields) {
        FieldMappingWithChartRole xAxisField = findXAxisField(fields);
        List<FieldMappingWithChartRole> yAxisFields = findYAxisFields(fields);

        return DynamicChartConfig.builder()
                .chartType(CHART_BAR)
                .title("暂无数据")
                .xAxis(AxisConfig.builder()
                        .type("category")
                        .name(xAxisField != null ? xAxisField.getAlias() : "")
                        .data(Collections.emptyList())
                        .build())
                .yAxis(List.of(AxisConfig.builder()
                        .type("value")
                        .name(yAxisFields.isEmpty() ? "" : yAxisFields.get(0).getAlias())
                        .build()))
                .series(Collections.emptyList())
                .rawData(Collections.emptyList())
                .totalRows(0)
                .fieldMappings(fields)
                .alternativeXAxis(buildAlternativeXAxis(fields, xAxisField))
                .alternativeSeries(buildAlternativeSeries(fields, null))
                .alternativeMeasures(buildAlternativeMeasures(fields, yAxisFields))
                .build();
    }

    // ==================== 字段查找方法 ====================

    /**
     * 找到 X 轴字段（优先级最高的 X_AXIS）
     * 优先选择时间字段，其次选择优先级最高的维度字段
     */
    private FieldMappingWithChartRole findXAxisField(List<FieldMappingWithChartRole> fields) {
        // 首先找 chartAxis = X_AXIS 的字段，按优先级排序
        List<FieldMappingWithChartRole> xAxisCandidates = fields.stream()
                .filter(f -> f.getChartAxis() == ChartAxisRole.X_AXIS)
                .sorted(Comparator.comparingInt(f -> f.getAxisPriority() != null ? f.getAxisPriority() : 100))
                .collect(Collectors.toList());

        if (!xAxisCandidates.isEmpty()) {
            // 优先选择时间字段
            Optional<FieldMappingWithChartRole> timeField = xAxisCandidates.stream()
                    .filter(FieldMappingWithChartRole::isDateType)
                    .findFirst();
            return timeField.orElse(xAxisCandidates.get(0));
        }

        return null;
    }

    /**
     * 找到 Series 字段（用于图例分组）
     */
    private FieldMappingWithChartRole findSeriesField(List<FieldMappingWithChartRole> fields) {
        return fields.stream()
                .filter(f -> f.getChartAxis() == ChartAxisRole.SERIES)
                .filter(FieldMappingWithChartRole::isSuitableForSeries)
                .sorted(Comparator.comparingInt(f -> f.getAxisPriority() != null ? f.getAxisPriority() : 100))
                .findFirst()
                .orElse(null);
    }

    /**
     * 找到 Y 轴字段（度量值）
     */
    private List<FieldMappingWithChartRole> findYAxisFields(List<FieldMappingWithChartRole> fields) {
        return fields.stream()
                .filter(f -> f.getChartAxis() == ChartAxisRole.Y_AXIS ||
                             f.getRole() == FieldRole.METRIC)
                .sorted(Comparator.comparingInt(f -> f.getAxisPriority() != null ? f.getAxisPriority() : 100))
                .collect(Collectors.toList());
    }

    /**
     * 找到第一个维度字段（备用 X 轴）
     */
    private FieldMappingWithChartRole findFirstDimensionField(List<FieldMappingWithChartRole> fields) {
        return fields.stream()
                .filter(f -> f.getRole() == FieldRole.DIMENSION || f.getRole() == FieldRole.TIME)
                .findFirst()
                .orElse(null);
    }

    /**
     * 找到第一个度量字段（备用 Y 轴）
     */
    private FieldMappingWithChartRole findFirstMetricField(List<FieldMappingWithChartRole> fields) {
        return fields.stream()
                .filter(f -> f.getRole() == FieldRole.METRIC || f.isNumeric())
                .findFirst()
                .orElse(null);
    }

    // ==================== 图表类型推断 ====================

    /**
     * 推断合适的图表类型
     */
    private String inferChartType(FieldMappingWithChartRole xAxisField,
                                   FieldMappingWithChartRole seriesField,
                                   List<FieldMappingWithChartRole> yAxisFields,
                                   int dataPointCount) {
        // 1. 时间维度通常用折线图
        if (xAxisField != null && xAxisField.isDateType()) {
            return CHART_LINE;
        }

        // 2. 有系列字段且数据点较多，使用堆叠柱状图
        if (seriesField != null && dataPointCount > 5) {
            return CHART_BAR;
        }

        // 3. 数据点较少适合饼图
        if (dataPointCount <= 6 && yAxisFields.size() == 1 && seriesField == null) {
            return CHART_PIE;
        }

        // 4. 默认使用柱状图
        return CHART_BAR;
    }

    // ==================== 配置构建方法 ====================

    /**
     * 构建图表标题
     */
    private String buildTitle(List<FieldMappingWithChartRole> yAxisFields,
                               FieldMappingWithChartRole xAxisField) {
        if (yAxisFields.isEmpty()) {
            return "数据分析";
        }

        String yName = yAxisFields.get(0).getAlias();
        if (yName == null) {
            yName = yAxisFields.get(0).getStandardField();
        }

        if (xAxisField != null) {
            String xName = xAxisField.getAlias();
            if (xName == null) {
                xName = xAxisField.getStandardField();
            }
            return yName + "按" + xName + "分析";
        }

        return yName + "分析";
    }

    /**
     * 构建 X 轴配置
     */
    private AxisConfig buildXAxis(FieldMappingWithChartRole xAxisField,
                                   List<Map<String, Object>> dataList) {
        if (xAxisField == null) {
            return AxisConfig.builder()
                    .type("category")
                    .data(Collections.emptyList())
                    .build();
        }

        String fieldName = xAxisField.getOriginalField() != null
                ? xAxisField.getOriginalField()
                : xAxisField.getStandardField();

        // 提取 X 轴数据
        List<String> xData = dataList.stream()
                .map(row -> {
                    Object value = row.get(fieldName);
                    if (value == null) {
                        value = row.get(xAxisField.getStandardField());
                    }
                    return value != null ? String.valueOf(value) : "";
                })
                .distinct()
                .collect(Collectors.toList());

        String axisType = xAxisField.isDateType() ? "time" : "category";

        return AxisConfig.builder()
                .type(axisType)
                .name(xAxisField.getAlias() != null ? xAxisField.getAlias() : xAxisField.getStandardField())
                .data("category".equals(axisType) ? xData : null)
                .axisLabel(Map.of(
                        "rotate", xData.size() > 10 ? 45 : 0,
                        "interval", 0
                ))
                .build();
    }

    /**
     * 构建 Y 轴配置
     */
    private List<AxisConfig> buildYAxis(List<FieldMappingWithChartRole> yAxisFields) {
        if (yAxisFields.isEmpty()) {
            return List.of(AxisConfig.builder()
                    .type("value")
                    .build());
        }

        // 支持双 Y 轴
        List<AxisConfig> yAxisList = new ArrayList<>();

        for (int i = 0; i < Math.min(yAxisFields.size(), 2); i++) {
            FieldMappingWithChartRole field = yAxisFields.get(i);
            yAxisList.add(AxisConfig.builder()
                    .type("value")
                    .name(field.getAlias() != null ? field.getAlias() : field.getStandardField())
                    .position(i == 0 ? "left" : "right")
                    .build());
        }

        return yAxisList;
    }

    /**
     * 构建图例配置
     */
    private LegendConfig buildLegend(FieldMappingWithChartRole seriesField,
                                      List<FieldMappingWithChartRole> yAxisFields,
                                      List<Map<String, Object>> dataList) {
        List<String> legendData = new ArrayList<>();

        if (seriesField != null) {
            // 按系列字段分组
            String fieldName = seriesField.getOriginalField() != null
                    ? seriesField.getOriginalField()
                    : seriesField.getStandardField();

            legendData = dataList.stream()
                    .map(row -> {
                        Object value = row.get(fieldName);
                        if (value == null) {
                            value = row.get(seriesField.getStandardField());
                        }
                        return value != null ? String.valueOf(value) : "";
                    })
                    .distinct()
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toList());
        } else if (yAxisFields.size() > 1) {
            // 多个度量作为图例
            legendData = yAxisFields.stream()
                    .map(f -> f.getAlias() != null ? f.getAlias() : f.getStandardField())
                    .collect(Collectors.toList());
        }

        if (legendData.isEmpty()) {
            return LegendConfig.builder()
                    .show(false)
                    .build();
        }

        return LegendConfig.builder()
                .show(true)
                .data(legendData)
                .position("top")
                .orient("horizontal")
                .build();
    }

    /**
     * 构建系列配置
     */
    private List<SeriesConfig> buildSeries(String chartType,
                                            FieldMappingWithChartRole seriesField,
                                            List<FieldMappingWithChartRole> yAxisFields,
                                            List<Map<String, Object>> dataList,
                                            FieldMappingWithChartRole xAxisField) {
        List<SeriesConfig> seriesList = new ArrayList<>();

        if (CHART_PIE.equals(chartType)) {
            return buildPieSeries(yAxisFields, dataList, xAxisField);
        }

        String seriesType = CHART_LINE.equals(chartType) ? "line" : "bar";

        if (seriesField != null) {
            // 按系列字段分组
            seriesList = buildGroupedSeries(seriesType, seriesField, yAxisFields, dataList, xAxisField);
        } else if (yAxisFields.size() > 1) {
            // 多个度量作为多系列
            for (int i = 0; i < yAxisFields.size(); i++) {
                FieldMappingWithChartRole yField = yAxisFields.get(i);
                String yFieldName = yField.getOriginalField() != null
                        ? yField.getOriginalField()
                        : yField.getStandardField();

                List<Object> yData = dataList.stream()
                        .map(row -> {
                            Object value = row.get(yFieldName);
                            if (value == null) {
                                value = row.get(yField.getStandardField());
                            }
                            return value != null ? value : 0;
                        })
                        .collect(Collectors.toList());

                seriesList.add(SeriesConfig.builder()
                        .name(yField.getAlias() != null ? yField.getAlias() : yField.getStandardField())
                        .type(seriesType)
                        .data(yData)
                        .yAxisIndex(Math.min(i, 1))
                        .smooth(CHART_LINE.equals(chartType))
                        .build());
            }
        } else if (!yAxisFields.isEmpty()) {
            // 单系列
            FieldMappingWithChartRole yField = yAxisFields.get(0);
            String yFieldName = yField.getOriginalField() != null
                    ? yField.getOriginalField()
                    : yField.getStandardField();

            List<Object> yData = dataList.stream()
                    .map(row -> {
                        Object value = row.get(yFieldName);
                        if (value == null) {
                            value = row.get(yField.getStandardField());
                        }
                        return value != null ? value : 0;
                    })
                    .collect(Collectors.toList());

            seriesList.add(SeriesConfig.builder()
                    .name(yField.getAlias() != null ? yField.getAlias() : yField.getStandardField())
                    .type(seriesType)
                    .data(yData)
                    .smooth(CHART_LINE.equals(chartType))
                    .build());
        }

        return seriesList;
    }

    /**
     * 构建按系列字段分组的数据
     */
    private List<SeriesConfig> buildGroupedSeries(String seriesType,
                                                   FieldMappingWithChartRole seriesField,
                                                   List<FieldMappingWithChartRole> yAxisFields,
                                                   List<Map<String, Object>> dataList,
                                                   FieldMappingWithChartRole xAxisField) {
        List<SeriesConfig> seriesList = new ArrayList<>();

        String seriesFieldName = seriesField.getOriginalField() != null
                ? seriesField.getOriginalField()
                : seriesField.getStandardField();

        String xFieldName = xAxisField != null
                ? (xAxisField.getOriginalField() != null ? xAxisField.getOriginalField() : xAxisField.getStandardField())
                : null;

        // 获取所有系列值
        Set<String> seriesValues = dataList.stream()
                .map(row -> {
                    Object value = row.get(seriesFieldName);
                    if (value == null) {
                        value = row.get(seriesField.getStandardField());
                    }
                    return value != null ? String.valueOf(value) : "";
                })
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toCollection(LinkedHashSet::new));

        // 获取所有 X 轴值
        List<String> xValues = new ArrayList<>();
        if (xFieldName != null) {
            xValues = dataList.stream()
                    .map(row -> {
                        Object value = row.get(xFieldName);
                        if (value == null && xAxisField != null) {
                            value = row.get(xAxisField.getStandardField());
                        }
                        return value != null ? String.valueOf(value) : "";
                    })
                    .distinct()
                    .collect(Collectors.toList());
        }

        // 为每个系列值创建数据
        FieldMappingWithChartRole yField = yAxisFields.isEmpty() ? null : yAxisFields.get(0);
        String yFieldName = yField != null
                ? (yField.getOriginalField() != null ? yField.getOriginalField() : yField.getStandardField())
                : null;

        for (String seriesValue : seriesValues) {
            List<Object> seriesData = new ArrayList<>();

            for (String xValue : xValues) {
                // 查找匹配的数据行
                final String finalXFieldName = xFieldName;
                final String finalYFieldName = yFieldName;

                Optional<Map<String, Object>> matchingRow = dataList.stream()
                        .filter(row -> {
                            Object sv = row.get(seriesFieldName);
                            if (sv == null) {
                                sv = row.get(seriesField.getStandardField());
                            }
                            Object xv = row.get(finalXFieldName);
                            if (xv == null && xAxisField != null) {
                                xv = row.get(xAxisField.getStandardField());
                            }
                            return seriesValue.equals(String.valueOf(sv)) &&
                                   xValue.equals(String.valueOf(xv));
                        })
                        .findFirst();

                if (matchingRow.isPresent() && finalYFieldName != null) {
                    Object yValue = matchingRow.get().get(finalYFieldName);
                    if (yValue == null && yField != null) {
                        yValue = matchingRow.get().get(yField.getStandardField());
                    }
                    seriesData.add(yValue != null ? yValue : 0);
                } else {
                    seriesData.add(0);
                }
            }

            seriesList.add(SeriesConfig.builder()
                    .name(seriesValue)
                    .type(seriesType)
                    .data(seriesData)
                    .smooth("line".equals(seriesType))
                    .stack("bar".equals(seriesType) ? "total" : null)
                    .build());
        }

        return seriesList;
    }

    /**
     * 构建饼图系列
     */
    private List<SeriesConfig> buildPieSeries(List<FieldMappingWithChartRole> yAxisFields,
                                               List<Map<String, Object>> dataList,
                                               FieldMappingWithChartRole xAxisField) {
        if (yAxisFields.isEmpty() || xAxisField == null) {
            return Collections.emptyList();
        }

        FieldMappingWithChartRole yField = yAxisFields.get(0);
        String yFieldName = yField.getOriginalField() != null
                ? yField.getOriginalField()
                : yField.getStandardField();
        String xFieldName = xAxisField.getOriginalField() != null
                ? xAxisField.getOriginalField()
                : xAxisField.getStandardField();

        List<Object> pieData = dataList.stream()
                .map(row -> {
                    Object name = row.get(xFieldName);
                    if (name == null) {
                        name = row.get(xAxisField.getStandardField());
                    }
                    Object value = row.get(yFieldName);
                    if (value == null) {
                        value = row.get(yField.getStandardField());
                    }

                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("name", name != null ? String.valueOf(name) : "");
                    item.put("value", value != null ? value : 0);
                    return (Object) item;
                })
                .collect(Collectors.toList());

        return List.of(SeriesConfig.builder()
                .name(yField.getAlias() != null ? yField.getAlias() : yField.getStandardField())
                .type("pie")
                .data(pieData)
                .label(Map.of(
                        "show", true,
                        "formatter", "{b}: {c} ({d}%)"
                ))
                .build());
    }

    /**
     * 构建提示框配置
     */
    private TooltipConfig buildTooltip(String chartType) {
        return TooltipConfig.builder()
                .trigger(CHART_PIE.equals(chartType) ? "item" : "axis")
                .axisPointer(Map.of(
                        "type", CHART_LINE.equals(chartType) ? "cross" : "shadow"
                ))
                .build();
    }

    // ==================== 可切换维度构建 ====================

    /**
     * 构建可切换的 X 轴维度列表
     */
    private List<AlternativeDimension> buildAlternativeXAxis(List<FieldMappingWithChartRole> fields,
                                                              FieldMappingWithChartRole currentXAxis) {
        return fields.stream()
                .filter(f -> f.getRole() == FieldRole.DIMENSION ||
                             f.getRole() == FieldRole.TIME ||
                             f.getChartAxis() == ChartAxisRole.X_AXIS)
                .filter(f -> f.getChartAxis() != ChartAxisRole.Y_AXIS)
                .map(f -> {
                    boolean isSelected = currentXAxis != null &&
                            Objects.equals(f.getStandardField(), currentXAxis.getStandardField());

                    return AlternativeDimension.builder()
                            .fieldName(f.getOriginalField() != null ? f.getOriginalField() : f.getStandardField())
                            .displayName(f.getAlias() != null ? f.getAlias() : f.getStandardField())
                            .targetRole("X_AXIS")
                            .dataType(f.getDataType())
                            .timeDimension(f.isDateType())
                            .selected(isSelected)
                            .priority(f.getAxisPriority() != null ? f.getAxisPriority() : 100)
                            .distinctCount(f.getUniqueValueCount())
                            .build();
                })
                .sorted(Comparator.comparingInt(AlternativeDimension::getPriority))
                .collect(Collectors.toList());
    }

    /**
     * 构建可切换的 Series 维度列表
     */
    private List<AlternativeDimension> buildAlternativeSeries(List<FieldMappingWithChartRole> fields,
                                                               FieldMappingWithChartRole currentSeries) {
        return fields.stream()
                .filter(f -> f.getRole() == FieldRole.DIMENSION)
                .filter(f -> f.getChartAxis() != ChartAxisRole.Y_AXIS)
                .filter(f -> f.getUniqueValueCount() == null || f.getUniqueValueCount() <= 15)
                .map(f -> {
                    boolean isSelected = currentSeries != null &&
                            Objects.equals(f.getStandardField(), currentSeries.getStandardField());

                    return AlternativeDimension.builder()
                            .fieldName(f.getOriginalField() != null ? f.getOriginalField() : f.getStandardField())
                            .displayName(f.getAlias() != null ? f.getAlias() : f.getStandardField())
                            .targetRole("SERIES")
                            .dataType(f.getDataType())
                            .timeDimension(false)
                            .selected(isSelected)
                            .priority(f.getAxisPriority() != null ? f.getAxisPriority() : 100)
                            .distinctCount(f.getUniqueValueCount())
                            .build();
                })
                .sorted(Comparator.comparingInt(AlternativeDimension::getPriority))
                .collect(Collectors.toList());
    }

    /**
     * 构建可切换的度量列表
     */
    private List<AlternativeDimension> buildAlternativeMeasures(List<FieldMappingWithChartRole> fields,
                                                                 List<FieldMappingWithChartRole> currentMeasures) {
        Set<String> currentMeasureNames = currentMeasures.stream()
                .map(FieldMappingWithChartRole::getStandardField)
                .collect(Collectors.toSet());

        return fields.stream()
                .filter(f -> f.getRole() == FieldRole.METRIC ||
                             f.getChartAxis() == ChartAxisRole.Y_AXIS ||
                             f.isNumeric())
                .map(f -> {
                    boolean isSelected = currentMeasureNames.contains(f.getStandardField());

                    return AlternativeDimension.builder()
                            .fieldName(f.getOriginalField() != null ? f.getOriginalField() : f.getStandardField())
                            .displayName(f.getAlias() != null ? f.getAlias() : f.getStandardField())
                            .targetRole("Y_AXIS")
                            .dataType(f.getDataType())
                            .timeDimension(false)
                            .selected(isSelected)
                            .priority(f.getAxisPriority() != null ? f.getAxisPriority() : 100)
                            .build();
                })
                .sorted(Comparator.comparingInt(AlternativeDimension::getPriority))
                .collect(Collectors.toList());
    }

    // ==================== 辅助方法 ====================

    /**
     * 从聚合数据中提取数据列表
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractDataList(Map<String, Object> aggregatedData) {
        if (aggregatedData == null) {
            return Collections.emptyList();
        }

        // 尝试直接获取 data 字段
        Object data = aggregatedData.get("data");
        if (data instanceof List) {
            return (List<Map<String, Object>>) data;
        }

        // 尝试获取 content 字段（分页数据）
        Object content = aggregatedData.get("content");
        if (content instanceof List) {
            return (List<Map<String, Object>>) content;
        }

        // 尝试获取 rows 字段
        Object rows = aggregatedData.get("rows");
        if (rows instanceof List) {
            return (List<Map<String, Object>>) rows;
        }

        // 如果 aggregatedData 本身就是数据列表的包装
        if (aggregatedData.containsKey("xAxis") || aggregatedData.containsKey("series")) {
            // 已经是处理过的图表数据，尝试重构
            return Collections.emptyList();
        }

        // 返回空列表
        return Collections.emptyList();
    }

    // ==================== 扩展构建方法 ====================

    /**
     * 使用指定的字段构建图表配置
     *
     * @param fields         字段映射列表
     * @param aggregatedData 聚合数据
     * @param xAxisFieldName 指定的 X 轴字段名
     * @param seriesFieldName 指定的 Series 字段名（可为 null）
     * @param measureFieldNames 指定的度量字段名列表
     * @return 动态图表配置
     */
    @Override
    public DynamicChartConfig buildConfigWithFields(List<FieldMappingWithChartRole> fields,
                                                     Map<String, Object> aggregatedData,
                                                     String xAxisFieldName,
                                                     String seriesFieldName,
                                                     List<String> measureFieldNames) {
        // 调整字段角色
        List<FieldMappingWithChartRole> adjustedFields = fields.stream()
                .map(f -> {
                    FieldMappingWithChartRole adjusted = copyField(f);
                    String fieldName = f.getStandardField();

                    if (fieldName.equals(xAxisFieldName)) {
                        adjusted.setChartAxis(ChartAxisRole.X_AXIS);
                        adjusted.setAxisPriority(1);
                    } else if (fieldName.equals(seriesFieldName)) {
                        adjusted.setChartAxis(ChartAxisRole.SERIES);
                        adjusted.setAxisPriority(1);
                    } else if (measureFieldNames != null && measureFieldNames.contains(fieldName)) {
                        adjusted.setChartAxis(ChartAxisRole.Y_AXIS);
                        adjusted.setAxisPriority(measureFieldNames.indexOf(fieldName) + 1);
                    }

                    return adjusted;
                })
                .collect(Collectors.toList());

        return buildConfig(adjustedFields, aggregatedData);
    }

    /**
     * 复制字段映射
     */
    private FieldMappingWithChartRole copyField(FieldMappingWithChartRole original) {
        return FieldMappingWithChartRole.builder()
                .originalField(original.getOriginalField())
                .standardField(original.getStandardField())
                .alias(original.getAlias())
                .role(original.getRole())
                .chartAxis(original.getChartAxis())
                .aggregationType(original.getAggregationType())
                .axisPriority(original.getAxisPriority())
                .dataType(original.getDataType())
                .uniqueValueCount(original.getUniqueValueCount())
                .confidence(original.getConfidence())
                .reasoning(original.getReasoning())
                .requiresConfirmation(original.getRequiresConfirmation())
                .build();
    }

    /**
     * 指定图表类型构建配置
     */
    @Override
    public DynamicChartConfig buildConfigWithChartType(List<FieldMappingWithChartRole> fields,
                                                        Map<String, Object> aggregatedData,
                                                        String chartType) {
        DynamicChartConfig config = buildConfig(fields, aggregatedData);
        config.setChartType(chartType);

        // 根据图表类型调整系列类型
        if (config.getSeries() != null) {
            String seriesType = CHART_LINE.equals(chartType) ? "line"
                    : CHART_PIE.equals(chartType) ? "pie"
                    : CHART_SCATTER.equals(chartType) ? "scatter"
                    : "bar";

            config.getSeries().forEach(s -> {
                s.setType(seriesType);
                s.setSmooth(CHART_LINE.equals(chartType));
            });
        }

        return config;
    }
}
