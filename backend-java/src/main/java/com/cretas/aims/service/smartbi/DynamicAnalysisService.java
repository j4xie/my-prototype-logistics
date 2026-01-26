package com.cretas.aims.service.smartbi;

import com.cretas.aims.entity.smartbi.postgres.SmartBiPgFieldDefinition;

import java.util.List;
import java.util.Map;

/**
 * Dynamic Analysis Service Interface
 *
 * Provides analysis capabilities for dynamically stored Excel data.
 * Works with PostgreSQL JSONB data for flexible aggregation and querying.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
public interface DynamicAnalysisService {

    /**
     * Aggregation function types
     */
    enum AggregateFunction {
        SUM, AVG, COUNT, MIN, MAX
    }

    /**
     * Aggregation result
     */
    class AggregationResult {
        private String groupField;
        private String measureField;
        private AggregateFunction function;
        private List<Map<String, Object>> data;
        private Double total;

        // Getters and setters
        public String getGroupField() { return groupField; }
        public void setGroupField(String groupField) { this.groupField = groupField; }
        public String getMeasureField() { return measureField; }
        public void setMeasureField(String measureField) { this.measureField = measureField; }
        public AggregateFunction getFunction() { return function; }
        public void setFunction(AggregateFunction function) { this.function = function; }
        public List<Map<String, Object>> getData() { return data; }
        public void setData(List<Map<String, Object>> data) { this.data = data; }
        public Double getTotal() { return total; }
        public void setTotal(Double total) { this.total = total; }

        public static AggregationResult of(String groupField, String measureField,
                                           AggregateFunction function, List<Map<String, Object>> data) {
            AggregationResult result = new AggregationResult();
            result.setGroupField(groupField);
            result.setMeasureField(measureField);
            result.setFunction(function);
            result.setData(data);
            if (data != null && !data.isEmpty()) {
                double total = data.stream()
                        .mapToDouble(m -> {
                            Object v = m.get("value");
                            return v instanceof Number ? ((Number) v).doubleValue() : 0;
                        })
                        .sum();
                result.setTotal(total);
            }
            return result;
        }
    }

    /**
     * Dashboard response with KPIs, charts, and insights
     */
    class DashboardResponse {
        private Long uploadId;
        private String tableType;
        private List<Map<String, Object>> kpiCards;
        private List<Map<String, Object>> charts;
        private List<String> insights;
        private List<FieldDefinitionDTO> fieldDefinitions;

        // Getters and setters
        public Long getUploadId() { return uploadId; }
        public void setUploadId(Long uploadId) { this.uploadId = uploadId; }
        public String getTableType() { return tableType; }
        public void setTableType(String tableType) { this.tableType = tableType; }
        public List<Map<String, Object>> getKpiCards() { return kpiCards; }
        public void setKpiCards(List<Map<String, Object>> kpiCards) { this.kpiCards = kpiCards; }
        public List<Map<String, Object>> getCharts() { return charts; }
        public void setCharts(List<Map<String, Object>> charts) { this.charts = charts; }
        public List<String> getInsights() { return insights; }
        public void setInsights(List<String> insights) { this.insights = insights; }
        public List<FieldDefinitionDTO> getFieldDefinitions() { return fieldDefinitions; }
        public void setFieldDefinitions(List<FieldDefinitionDTO> fieldDefinitions) { this.fieldDefinitions = fieldDefinitions; }
    }

    /**
     * Field definition DTO for frontend
     */
    class FieldDefinitionDTO {
        private String originalName;
        private String standardName;
        private String fieldType;
        private String semanticType;
        private String chartRole;
        private Boolean isDimension;
        private Boolean isMeasure;
        private Boolean isTime;
        private String formatPattern;

        // Getters and setters
        public String getOriginalName() { return originalName; }
        public void setOriginalName(String originalName) { this.originalName = originalName; }
        public String getStandardName() { return standardName; }
        public void setStandardName(String standardName) { this.standardName = standardName; }
        public String getFieldType() { return fieldType; }
        public void setFieldType(String fieldType) { this.fieldType = fieldType; }
        public String getSemanticType() { return semanticType; }
        public void setSemanticType(String semanticType) { this.semanticType = semanticType; }
        public String getChartRole() { return chartRole; }
        public void setChartRole(String chartRole) { this.chartRole = chartRole; }
        public Boolean getIsDimension() { return isDimension; }
        public void setIsDimension(Boolean isDimension) { this.isDimension = isDimension; }
        public Boolean getIsMeasure() { return isMeasure; }
        public void setIsMeasure(Boolean isMeasure) { this.isMeasure = isMeasure; }
        public Boolean getIsTime() { return isTime; }
        public void setIsTime(Boolean isTime) { this.isTime = isTime; }
        public String getFormatPattern() { return formatPattern; }
        public void setFormatPattern(String formatPattern) { this.formatPattern = formatPattern; }

        public static FieldDefinitionDTO fromEntity(SmartBiPgFieldDefinition entity) {
            FieldDefinitionDTO dto = new FieldDefinitionDTO();
            dto.setOriginalName(entity.getOriginalName());
            dto.setStandardName(entity.getStandardName());
            dto.setFieldType(entity.getFieldType());
            dto.setSemanticType(entity.getSemanticType());
            dto.setChartRole(entity.getChartRole());
            dto.setIsDimension(entity.getIsDimension());
            dto.setIsMeasure(entity.getIsMeasure());
            dto.setIsTime(entity.getIsTime());
            dto.setFormatPattern(entity.getFormatPattern());
            return dto;
        }
    }

    /**
     * Analyze dynamic data and return dashboard response
     *
     * @param factoryId Factory ID
     * @param uploadId Upload record ID
     * @param analysisType Analysis type (auto, finance, sales, etc.)
     * @return Dashboard response with KPIs, charts, insights
     */
    DashboardResponse analyzeDynamic(String factoryId, Long uploadId, String analysisType);

    /**
     * Aggregate data by a dimension field
     *
     * @param factoryId Factory ID
     * @param uploadId Upload record ID
     * @param groupByField Field to group by
     * @param measureField Field to aggregate
     * @param function Aggregation function
     * @return Aggregation result
     */
    AggregationResult aggregate(String factoryId, Long uploadId,
                                 String groupByField, String measureField,
                                 AggregateFunction function);

    /**
     * Get field definitions for an upload (for frontend rendering)
     *
     * @param uploadId Upload record ID
     * @return List of field definition DTOs
     */
    List<FieldDefinitionDTO> getFieldDefinitions(Long uploadId);

    /**
     * Get distinct values for a field (for filter dropdowns)
     *
     * @param factoryId Factory ID
     * @param uploadId Upload record ID
     * @param fieldName Field name
     * @return List of distinct values
     */
    List<String> getDistinctValues(String factoryId, Long uploadId, String fieldName);

    /**
     * Calculate sum for a field
     *
     * @param factoryId Factory ID
     * @param uploadId Upload record ID
     * @param measureField Field to sum
     * @return Sum value
     */
    Double sumField(String factoryId, Long uploadId, String measureField);

    /**
     * Get time series aggregation
     *
     * @param factoryId Factory ID
     * @param uploadId Upload record ID
     * @param measureField Field to aggregate
     * @return Time series data
     */
    List<Map<String, Object>> getTimeSeries(String factoryId, Long uploadId, String measureField);
}
