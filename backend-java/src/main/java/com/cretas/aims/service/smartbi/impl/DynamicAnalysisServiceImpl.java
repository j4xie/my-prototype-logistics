package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.dto.smartbi.BackfillResult;
import com.cretas.aims.dto.smartbi.BatchBackfillResult;
import com.cretas.aims.entity.smartbi.postgres.SmartBiDynamicData;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgExcelUpload;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgFieldDefinition;
import com.cretas.aims.repository.smartbi.postgres.SmartBiDynamicDataRepository;
import com.cretas.aims.repository.smartbi.postgres.SmartBiPgExcelUploadRepository;
import com.cretas.aims.repository.smartbi.postgres.SmartBiPgFieldDefinitionRepository;
import com.cretas.aims.service.smartbi.DynamicAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Dynamic Analysis Service Implementation
 *
 * Provides analysis for dynamically stored JSONB data.
 * Leverages PostgreSQL's native JSONB operators for efficient queries.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "smartbi.postgres.enabled", havingValue = "true", matchIfMissing = false)
public class DynamicAnalysisServiceImpl implements DynamicAnalysisService {

    private final SmartBiDynamicDataRepository dynamicDataRepository;
    private final SmartBiPgExcelUploadRepository uploadRepository;
    private final SmartBiPgFieldDefinitionRepository fieldDefRepository;
    private final PythonSmartBIClient pythonClient;

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", readOnly = true)
    public DashboardResponse analyzeDynamic(String factoryId, Long uploadId, String analysisType) {
        log.info("Analyzing dynamic data: factoryId={}, uploadId={}, type={}",
                factoryId, uploadId, analysisType);

        DashboardResponse response = new DashboardResponse();
        response.setUploadId(uploadId);

        // Get upload metadata
        SmartBiPgExcelUpload upload = uploadRepository.findById(uploadId).orElse(null);
        if (upload == null) {
            log.warn("Upload not found: {}", uploadId);
            return response;
        }
        response.setTableType(upload.getDetectedTableType());

        // Get field definitions
        List<SmartBiPgFieldDefinition> fields = fieldDefRepository.findByUploadIdOrderByDisplayOrder(uploadId);
        response.setFieldDefinitions(fields.stream()
                .map(FieldDefinitionDTO::fromEntity)
                .collect(Collectors.toList()));

        // Get data rows
        List<SmartBiDynamicData> dataRows = dynamicDataRepository.findByFactoryIdAndUploadId(factoryId, uploadId);
        if (dataRows.isEmpty()) {
            log.warn("No data found for uploadId={}", uploadId);
            return response;
        }

        // Find measure and dimension fields
        List<SmartBiPgFieldDefinition> measures = fields.stream()
                .filter(f -> Boolean.TRUE.equals(f.getIsMeasure()))
                .collect(Collectors.toList());
        List<SmartBiPgFieldDefinition> dimensions = fields.stream()
                .filter(f -> Boolean.TRUE.equals(f.getIsDimension()))
                .collect(Collectors.toList());

        // Generate KPIs
        response.setKpiCards(generateKPIs(factoryId, uploadId, measures));

        // Generate charts
        response.setCharts(generateCharts(factoryId, uploadId, measures, dimensions));

        // Generate insights from PostgreSQL data
        response.setInsights(generateInsights(factoryId, uploadId, upload.getDetectedTableType(),
                dataRows, measures, dimensions));

        return response;
    }

    /**
     * AUDIT-052: Lightweight KPI-only query.
     * Skips chart generation and AI insights for faster dashboard loading.
     */
    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", readOnly = true)
    public List<Map<String, Object>> getKPIsOnly(String factoryId, Long uploadId) {
        log.info("Get KPIs only: factoryId={}, uploadId={}", factoryId, uploadId);

        // Get field definitions
        List<SmartBiPgFieldDefinition> fields = fieldDefRepository.findByUploadIdOrderByDisplayOrder(uploadId);
        List<SmartBiPgFieldDefinition> measures = fields.stream()
                .filter(f -> Boolean.TRUE.equals(f.getIsMeasure()))
                .collect(Collectors.toList());

        if (measures.isEmpty()) {
            log.warn("No measure fields found for uploadId={}", uploadId);
            return java.util.Collections.emptyList();
        }

        return generateKPIs(factoryId, uploadId, measures);
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", readOnly = true)
    public AggregationResult aggregate(String factoryId, Long uploadId,
                                         String groupByField, String measureField,
                                         AggregateFunction function) {
        log.info("Aggregating: groupBy={}, measure={}, function={}",
                groupByField, measureField, function);

        List<Object[]> results = dynamicDataRepository.aggregateByField(
                factoryId, uploadId, groupByField, measureField);

        List<Map<String, Object>> data = new ArrayList<>();
        for (Object[] row : results) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("group", row[0]);
            item.put("value", row[1] != null ? ((Number) row[1]).doubleValue() : 0);
            data.add(item);
        }

        return AggregationResult.of(groupByField, measureField, function, data);
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", readOnly = true)
    public List<FieldDefinitionDTO> getFieldDefinitions(Long uploadId) {
        List<SmartBiPgFieldDefinition> fields = fieldDefRepository.findByUploadIdOrderByDisplayOrder(uploadId);
        return fields.stream()
                .map(FieldDefinitionDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", readOnly = true)
    public List<String> getDistinctValues(String factoryId, Long uploadId, String fieldName) {
        return dynamicDataRepository.getDistinctFieldValues(factoryId, uploadId, fieldName);
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", readOnly = true)
    public Double sumField(String factoryId, Long uploadId, String measureField) {
        return dynamicDataRepository.sumField(factoryId, uploadId, measureField);
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", readOnly = true)
    public List<Map<String, Object>> getTimeSeries(String factoryId, Long uploadId, String measureField) {
        List<Object[]> results = dynamicDataRepository.aggregateByPeriod(factoryId, uploadId, measureField);

        List<Map<String, Object>> timeSeries = new ArrayList<>();
        for (Object[] row : results) {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("period", row[0]);
            point.put("value", row[1] != null ? ((Number) row[1]).doubleValue() : 0);
            timeSeries.add(point);
        }
        return timeSeries;
    }

    // ==================== Private Helper Methods ====================

    private List<Map<String, Object>> generateKPIs(String factoryId, Long uploadId,
                                                    List<SmartBiPgFieldDefinition> measures) {
        List<Map<String, Object>> kpis = new ArrayList<>();

        for (SmartBiPgFieldDefinition measure : measures) {
            String fieldName = measure.getOriginalName();
            String displayName = measure.getStandardName() != null ?
                    measure.getStandardName() : fieldName;

            // Calculate sum
            Double sum = dynamicDataRepository.sumField(factoryId, uploadId, fieldName);
            if (sum == null) continue;

            // Get min/max for trend
            List<Object[]> minMax = dynamicDataRepository.minMaxField(factoryId, uploadId, fieldName);
            Double min = null, max = null;
            if (minMax != null && !minMax.isEmpty() && minMax.get(0) != null) {
                Object[] mm = minMax.get(0);
                min = mm[0] != null ? ((Number) mm[0]).doubleValue() : null;
                max = mm[1] != null ? ((Number) mm[1]).doubleValue() : null;
            }

            Map<String, Object> kpi = new LinkedHashMap<>();
            kpi.put("title", displayName);
            kpi.put("value", formatNumber(sum, measure.getFormatPattern()));
            kpi.put("rawValue", sum);
            kpi.put("type", measure.getSemanticType());
            kpi.put("formatPattern", measure.getFormatPattern());

            if (min != null && max != null) {
                kpi.put("min", min);
                kpi.put("max", max);
            }

            kpis.add(kpi);
        }

        return kpis;
    }

    private List<Map<String, Object>> generateCharts(String factoryId, Long uploadId,
                                                       List<SmartBiPgFieldDefinition> measures,
                                                       List<SmartBiPgFieldDefinition> dimensions) {
        List<Map<String, Object>> charts = new ArrayList<>();

        if (measures.isEmpty()) return charts;

        // Primary measure for charts
        SmartBiPgFieldDefinition primaryMeasure = measures.get(0);
        String measureField = primaryMeasure.getOriginalName();
        String measureName = primaryMeasure.getStandardName() != null ?
                primaryMeasure.getStandardName() : measureField;

        // Generate chart for each dimension
        for (SmartBiPgFieldDefinition dimension : dimensions) {
            String dimField = dimension.getOriginalName();
            String dimName = dimension.getStandardName() != null ?
                    dimension.getStandardName() : dimField;

            // Aggregate by this dimension
            List<Object[]> aggResults = dynamicDataRepository.aggregateByField(
                    factoryId, uploadId, dimField, measureField);

            if (aggResults.isEmpty()) continue;

            List<String> labels = new ArrayList<>();
            List<Double> values = new ArrayList<>();

            for (Object[] row : aggResults) {
                String label = row[0] != null ? row[0].toString() : "Unknown";
                Double value = row[1] != null ? ((Number) row[1]).doubleValue() : 0;
                labels.add(label);
                values.add(value);
            }

            // Determine chart type
            String chartType = Boolean.TRUE.equals(dimension.getIsTime()) ? "line" : "bar";
            if (labels.size() <= 6 && !Boolean.TRUE.equals(dimension.getIsTime())) {
                chartType = "pie";
            }

            Map<String, Object> chart = new LinkedHashMap<>();
            chart.put("type", chartType);
            chart.put("title", measureName + " by " + dimName);
            chart.put("xAxisLabel", dimName);
            chart.put("yAxisLabel", measureName);
            chart.put("data", Map.of(
                    "labels", labels,
                    "datasets", Collections.singletonList(Map.of(
                            "label", measureName,
                            "data", values
                    ))
            ));

            charts.add(chart);
        }

        // Time series chart if period data exists
        List<Map<String, Object>> timeSeries = getTimeSeries(factoryId, uploadId, measureField);
        if (!timeSeries.isEmpty()) {
            List<String> labels = timeSeries.stream()
                    .map(p -> p.get("period").toString())
                    .collect(Collectors.toList());
            List<Double> values = timeSeries.stream()
                    .map(p -> ((Number) p.get("value")).doubleValue())
                    .collect(Collectors.toList());

            Map<String, Object> trendChart = new LinkedHashMap<>();
            trendChart.put("type", "line");
            trendChart.put("title", measureName + " Trend");
            trendChart.put("xAxisLabel", "Period");
            trendChart.put("yAxisLabel", measureName);
            trendChart.put("data", Map.of(
                    "labels", labels,
                    "datasets", Collections.singletonList(Map.of(
                            "label", measureName,
                            "data", values
                    ))
            ));

            charts.add(0, trendChart); // Put trend chart first
        }

        return charts;
    }

    private List<String> generateInsights(String factoryId, Long uploadId, String tableType,
                                           List<SmartBiDynamicData> dataRows,
                                           List<SmartBiPgFieldDefinition> measures,
                                           List<SmartBiPgFieldDefinition> dimensions) {
        List<String> insights = new ArrayList<>();

        // Basic insights from data
        insights.add(String.format("Data contains %d records", dataRows.size()));

        if (measures.isEmpty()) {
            insights.add("No numeric measures detected");
            return insights;
        }

        // Top performer insight
        if (!dimensions.isEmpty()) {
            SmartBiPgFieldDefinition primaryDim = dimensions.get(0);
            SmartBiPgFieldDefinition primaryMeasure = measures.get(0);

            List<Object[]> aggResults = dynamicDataRepository.aggregateByField(
                    factoryId, uploadId, primaryDim.getOriginalName(),
                    primaryMeasure.getOriginalName());

            if (!aggResults.isEmpty()) {
                Object[] top = aggResults.get(0);
                String topName = top[0] != null ? top[0].toString() : "Unknown";
                Double topValue = top[1] != null ? ((Number) top[1]).doubleValue() : 0;

                String measureName = primaryMeasure.getStandardName() != null ?
                        primaryMeasure.getStandardName() : primaryMeasure.getOriginalName();
                String dimName = primaryDim.getStandardName() != null ?
                        primaryDim.getStandardName() : primaryDim.getOriginalName();

                insights.add(String.format("Top %s by %s: %s (%.2f)",
                        dimName, measureName, topName, topValue));
            }
        }

        // Measure totals
        for (SmartBiPgFieldDefinition measure : measures) {
            Double sum = dynamicDataRepository.sumField(factoryId, uploadId, measure.getOriginalName());
            if (sum != null && sum > 0) {
                String name = measure.getStandardName() != null ?
                        measure.getStandardName() : measure.getOriginalName();
                insights.add(String.format("Total %s: %s", name,
                        formatNumber(sum, measure.getFormatPattern())));
            }
        }

        return insights;
    }

    private String formatNumber(Double value, String pattern) {
        if (value == null) return "0";

        if (pattern != null) {
            if (pattern.contains("%")) {
                return String.format("%.2f%%", value * 100);
            }
            if (pattern.contains("#,##0")) {
                return String.format("%,.2f", value);
            }
        }

        // Default formatting
        if (Math.abs(value) >= 1_000_000) {
            return String.format("%.2fM", value / 1_000_000);
        } else if (Math.abs(value) >= 1_000) {
            return String.format("%.2fK", value / 1_000);
        } else {
            return String.format("%.2f", value);
        }
    }

    // ==================== Phase 5: Data Preview & Backfill ====================

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", readOnly = true)
    public Page<SmartBiDynamicData> getDataPage(String factoryId, Long uploadId, int page, int size) {
        log.info("Getting data page: factoryId={}, uploadId={}, page={}, size={}",
                factoryId, uploadId, page, size);
        return dynamicDataRepository.findByFactoryIdAndUploadIdOrderByRowIndex(
                factoryId, uploadId, PageRequest.of(page, size));
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", readOnly = true)
    public long getFieldCount(Long uploadId) {
        return fieldDefRepository.countByUploadId(uploadId);
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager")
    public BackfillResult backfillFieldDefinitions(String factoryId, Long uploadId) {
        log.info("Backfilling field definitions: factoryId={}, uploadId={}", factoryId, uploadId);

        // 1. Check if upload exists
        Optional<SmartBiPgExcelUpload> uploadOpt = uploadRepository.findById(uploadId);
        if (uploadOpt.isEmpty()) {
            return BackfillResult.failed(uploadId, "Upload record not found");
        }
        SmartBiPgExcelUpload upload = uploadOpt.get();

        // 2. Check if factory matches
        if (!factoryId.equals(upload.getFactoryId())) {
            return BackfillResult.failed(uploadId, "Factory ID mismatch");
        }

        // 3. Check if already has field definitions
        long existingCount = fieldDefRepository.countByUploadId(uploadId);
        if (existingCount > 0) {
            return BackfillResult.skipped(uploadId, "Already has " + existingCount + " field definitions");
        }

        // 4. Try to rebuild from field_mappings
        Map<String, String> fieldMappings = upload.getFieldMappings();
        if (fieldMappings == null || fieldMappings.isEmpty()) {
            // Try to infer from data if no mappings
            return backfillFromData(factoryId, uploadId);
        }

        // 5. Create field definitions from mappings
        List<SmartBiPgFieldDefinition> fields = new ArrayList<>();
        int order = 0;
        for (Map.Entry<String, String> entry : fieldMappings.entrySet()) {
            SmartBiPgFieldDefinition field = SmartBiPgFieldDefinition.builder()
                    .uploadId(uploadId)
                    .originalName(entry.getKey())
                    .standardName(entry.getValue())
                    .fieldType(inferFieldType(entry.getValue()))
                    .semanticType(entry.getValue())
                    .isDimension(isDimension(entry.getValue()))
                    .isMeasure(isMeasure(entry.getValue()))
                    .isTime(isTimeField(entry.getValue()))
                    .displayOrder(order++)
                    .build();
            fields.add(field);
        }

        fieldDefRepository.saveAll(fields);
        log.info("Created {} field definitions for upload {}", fields.size(), uploadId);

        return BackfillResult.success(uploadId, fields.size());
    }

    private BackfillResult backfillFromData(String factoryId, Long uploadId) {
        // Get sample data to infer field types
        List<SmartBiDynamicData> sampleData = dynamicDataRepository.findByFactoryIdAndUploadId(factoryId, uploadId);
        if (sampleData.isEmpty()) {
            return BackfillResult.failed(uploadId, "No data rows found to infer schema");
        }

        // Get all field names from first row
        Map<String, Object> firstRow = sampleData.get(0).getRowData();
        if (firstRow == null || firstRow.isEmpty()) {
            return BackfillResult.failed(uploadId, "First row has no data");
        }

        List<SmartBiPgFieldDefinition> fields = new ArrayList<>();
        int order = 0;
        for (String fieldName : firstRow.keySet()) {
            // Infer type from value
            Object value = firstRow.get(fieldName);
            String fieldType = inferFieldTypeFromValue(value);
            boolean isMeasure = "NUMBER".equals(fieldType) || "CURRENCY".equals(fieldType);
            boolean isDimension = "STRING".equals(fieldType);

            SmartBiPgFieldDefinition field = SmartBiPgFieldDefinition.builder()
                    .uploadId(uploadId)
                    .originalName(fieldName)
                    .standardName(fieldName)
                    .fieldType(fieldType)
                    .isDimension(isDimension)
                    .isMeasure(isMeasure)
                    .isTime(isTimeField(fieldName))
                    .displayOrder(order++)
                    .build();
            fields.add(field);
        }

        fieldDefRepository.saveAll(fields);
        log.info("Inferred and created {} field definitions for upload {}", fields.size(), uploadId);

        return BackfillResult.success(uploadId, fields.size());
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager")
    public BatchBackfillResult batchBackfillFieldDefinitions(String factoryId, int limit) {
        log.info("Batch backfilling field definitions: factoryId={}, limit={}", factoryId, limit);

        // Find uploads without field definitions
        List<SmartBiPgExcelUpload> uploads = uploadRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId);

        List<BackfillResult> details = new ArrayList<>();
        int processed = 0, success = 0, skipped = 0, failed = 0;

        for (SmartBiPgExcelUpload upload : uploads) {
            if (processed >= limit) break;

            // Check if needs backfill
            long fieldCount = fieldDefRepository.countByUploadId(upload.getId());
            if (fieldCount > 0) {
                continue; // Already has fields, skip
            }

            processed++;
            BackfillResult result = backfillFieldDefinitions(factoryId, upload.getId());
            details.add(result);

            switch (result.getStatus()) {
                case "success":
                    success++;
                    break;
                case "skipped":
                    skipped++;
                    break;
                case "failed":
                    failed++;
                    break;
            }
        }

        return BatchBackfillResult.builder()
                .totalProcessed(processed)
                .successCount(success)
                .skippedCount(skipped)
                .failedCount(failed)
                .details(details)
                .build();
    }

    // Helper methods for type inference
    private String inferFieldType(String standardName) {
        if (standardName == null) return "STRING";
        String lower = standardName.toLowerCase();

        if (lower.contains("date") || lower.contains("time") || lower.contains("日期") || lower.contains("时间")) {
            return "DATE";
        }
        if (lower.contains("rate") || lower.contains("率") || lower.contains("percentage") || lower.contains("%")) {
            return "PERCENTAGE";
        }
        if (lower.contains("revenue") || lower.contains("cost") || lower.contains("profit") ||
            lower.contains("price") || lower.contains("amount") || lower.contains("金额") ||
            lower.contains("收入") || lower.contains("成本") || lower.contains("利润")) {
            return "CURRENCY";
        }
        if (lower.contains("count") || lower.contains("quantity") || lower.contains("数量") ||
            lower.contains("num") || lower.contains("total")) {
            return "NUMBER";
        }
        return "STRING";
    }

    private String inferFieldTypeFromValue(Object value) {
        if (value == null) return "STRING";
        if (value instanceof Number) {
            return "NUMBER";
        }
        String strValue = value.toString();
        try {
            Double.parseDouble(strValue.replace(",", "").replace("¥", "").replace("$", ""));
            return "NUMBER";
        } catch (NumberFormatException e) {
            // Not a number
        }
        return "STRING";
    }

    private boolean isDimension(String standardName) {
        if (standardName == null) return false;
        String lower = standardName.toLowerCase();
        return lower.contains("department") || lower.contains("region") || lower.contains("product") ||
               lower.contains("customer") || lower.contains("category") || lower.contains("部门") ||
               lower.contains("区域") || lower.contains("产品") || lower.contains("客户") ||
               lower.contains("分类") || lower.contains("类别");
    }

    private boolean isMeasure(String standardName) {
        if (standardName == null) return false;
        String lower = standardName.toLowerCase();
        return lower.contains("revenue") || lower.contains("cost") || lower.contains("profit") ||
               lower.contains("amount") || lower.contains("price") || lower.contains("quantity") ||
               lower.contains("total") || lower.contains("sum") || lower.contains("收入") ||
               lower.contains("成本") || lower.contains("利润") || lower.contains("金额") ||
               lower.contains("数量") || lower.contains("合计");
    }

    private boolean isTimeField(String fieldName) {
        if (fieldName == null) return false;
        String lower = fieldName.toLowerCase();
        return lower.contains("date") || lower.contains("time") || lower.contains("year") ||
               lower.contains("month") || lower.contains("日期") || lower.contains("时间") ||
               lower.contains("年") || lower.contains("月") || lower.contains("期间") ||
               lower.contains("period");
    }
}
