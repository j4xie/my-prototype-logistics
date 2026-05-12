package com.cretas.aims.service.smartbi.impl;

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
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
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

    // Shared pool for parallel aggregate queries; 8 workers match DB connection
    // pool headroom while keeping N+1 loops fast even at 12-16 measures.
    private static final ExecutorService AGG_POOL = Executors.newFixedThreadPool(
            8, r -> {
                Thread t = new Thread(r, "smartbi-agg-" + System.nanoTime());
                t.setDaemon(true);
                return t;
            });

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

        // Get data rows — cap at 1K (insight prompt context only; 200K × 231 JSONB
        // cols would need ~2GB heap). KPI/chart math runs at SQL level. 1K ≈
        // 30-50MB materialized even for wide POS tables.
        final int SAMPLE_CAP = 1000;
        List<SmartBiDynamicData> dataRows = dynamicDataRepository
                .findByFactoryIdAndUploadIdOrderByRowIndex(factoryId, uploadId,
                        org.springframework.data.domain.PageRequest.of(0, SAMPLE_CAP))
                .getContent();
        if (dataRows.isEmpty()) {
            log.warn("No data found for uploadId={}", uploadId);
            return response;
        }
        if (dataRows.size() == SAMPLE_CAP) {
            log.info("Dynamic analysis sampled {} rows (cap) for uploadId={}", SAMPLE_CAP, uploadId);
        }

        // Find measure and dimension fields
        List<SmartBiPgFieldDefinition> measures = fields.stream()
                .filter(f -> Boolean.TRUE.equals(f.getIsMeasure()))
                .collect(Collectors.toList());
        List<SmartBiPgFieldDefinition> dimensions = fields.stream()
                .filter(f -> Boolean.TRUE.equals(f.getIsDimension()))
                .collect(Collectors.toList());

        // Generate KPIs
        long tKpi = System.currentTimeMillis();
        response.setKpiCards(generateKPIs(factoryId, uploadId, measures));
        log.info("KPI phase done in {}ms", System.currentTimeMillis() - tKpi);

        // Generate charts
        long tChart = System.currentTimeMillis();
        response.setCharts(generateCharts(factoryId, uploadId, measures, dimensions));
        log.info("Chart phase done in {}ms", System.currentTimeMillis() - tChart);

        // Skip insights on large datasets (> 30K rows) — generateInsights
        // makes additional per-dim SQL aggregates + a Python HTTP call that
        // together triple the response time. On 200K POS data this pushes
        // total > 3 min. Users can get richer insight via AI 问答 which has
        // its own parallel LLM pipeline.
        long realRowCount = upload.getRowCount() != null ? upload.getRowCount() : dataRows.size();
        if (realRowCount <= 30000) {
            long tIns = System.currentTimeMillis();
            response.setInsights(generateInsights(factoryId, uploadId, upload.getDetectedTableType(),
                    dataRows, measures, dimensions));
            log.info("Insight phase done in {}ms", System.currentTimeMillis() - tIns);
        } else {
            response.setInsights(java.util.Collections.singletonList(
                    "数据量较大 (" + realRowCount + " 行)，洞察请使用 AI 问答获取详细分析"));
        }

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
        // Cap at 12 measures; each triggers 2 full-table JSONB scans so unbounded
        // loops on wide POS tables (100+ measures) take minutes.
        List<SmartBiPgFieldDefinition> capped = measures.size() > 12 ? measures.subList(0, 12) : measures;

        long t0 = System.currentTimeMillis();
        // Parallel fan-out: each measure's sum + minMax run concurrently. The
        // query threads share a daemon pool of 8 workers (matches DB connection
        // pool headroom). Sequential baseline ~4-8s per measure; parallel ~2 waves.
        List<CompletableFuture<Map<String, Object>>> futures = capped.stream()
                .map(measure -> CompletableFuture.supplyAsync(() -> {
                    try {
                        String fieldName = measure.getOriginalName();
                        Double sum = dynamicDataRepository.sumField(factoryId, uploadId, fieldName);
                        if (sum == null) return null;
                        List<Object[]> minMax = dynamicDataRepository.minMaxField(factoryId, uploadId, fieldName);
                        Double min = null, max = null;
                        if (minMax != null && !minMax.isEmpty() && minMax.get(0) != null) {
                            Object[] mm = minMax.get(0);
                            min = mm[0] != null ? ((Number) mm[0]).doubleValue() : null;
                            max = mm[1] != null ? ((Number) mm[1]).doubleValue() : null;
                        }
                        String displayName = measure.getStandardName() != null ?
                                measure.getStandardName() : fieldName;
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
                        return kpi;
                    } catch (Exception e) {
                        log.warn("KPI compute failed for {}: {}", measure.getOriginalName(), e.getMessage());
                        return null;
                    }
                }, AGG_POOL))
                .collect(Collectors.toList());

        List<Map<String, Object>> kpis = futures.stream()
                .map(f -> {
                    try {
                        return f.get(90, TimeUnit.SECONDS);
                    } catch (Exception e) {
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        log.info("generateKPIs: {} measures in {}ms (parallel)", capped.size(),
                System.currentTimeMillis() - t0);
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

        // Cap dimensions to 5 (FE renders 4-5 chart slots). Sequential loop over
        // dimensions would be N full-table GROUP BY scans; parallelize instead.
        List<SmartBiPgFieldDefinition> cappedDims = dimensions.size() > 5 ? dimensions.subList(0, 5) : dimensions;
        final String fMeasureName = measureName;
        long tChart0 = System.currentTimeMillis();

        List<CompletableFuture<Map<String, Object>>> chartFutures = cappedDims.stream()
                .map(dimension -> CompletableFuture.supplyAsync(() -> {
                    try {
                        String dimField = dimension.getOriginalName();
                        String dimName = dimension.getStandardName() != null ?
                                dimension.getStandardName() : dimField;
                        List<Object[]> aggResults = dynamicDataRepository.aggregateByField(
                                factoryId, uploadId, dimField, measureField);
                        if (aggResults.isEmpty()) return null;
                        List<String> labels = new ArrayList<>();
                        List<Double> values = new ArrayList<>();
                        for (Object[] row : aggResults) {
                            labels.add(row[0] != null ? row[0].toString() : "Unknown");
                            values.add(row[1] != null ? ((Number) row[1]).doubleValue() : 0);
                        }
                        String chartType = Boolean.TRUE.equals(dimension.getIsTime()) ? "line" : "bar";
                        if (labels.size() <= 6 && !Boolean.TRUE.equals(dimension.getIsTime())) {
                            chartType = "pie";
                        }
                        Map<String, Object> chart = new LinkedHashMap<>();
                        chart.put("type", chartType);
                        chart.put("title", fMeasureName + " by " + dimName);
                        chart.put("xAxisLabel", dimName);
                        chart.put("yAxisLabel", fMeasureName);
                        chart.put("data", Map.of(
                                "labels", labels,
                                "datasets", Collections.singletonList(Map.of(
                                        "label", fMeasureName,
                                        "data", values
                                ))
                        ));
                        return chart;
                    } catch (Exception e) {
                        log.warn("Chart compute failed for dim {}: {}",
                                dimension.getOriginalName(), e.getMessage());
                        return null;
                    }
                }, AGG_POOL))
                .collect(Collectors.toList());

        for (CompletableFuture<Map<String, Object>> f : chartFutures) {
            try {
                Map<String, Object> chart = f.get(90, TimeUnit.SECONDS);
                if (chart != null) charts.add(chart);
            } catch (Exception e) {
                log.warn("chart future failed: {}", e.getMessage());
            }
        }
        log.info("generateCharts: {} dims in {}ms (parallel)", cappedDims.size(),
                System.currentTimeMillis() - tChart0);

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
        insights.add(String.format("数据包含 %d 条记录", dataRows.size()));

        if (measures.isEmpty()) {
            insights.add("未检测到数值型指标字段，请检查数据源是否包含数值列");
            return insights;
        }

        // Top performer insight — skip when top value ≤ 0 (avoids "revenue 最高 Z加点料 (0.00)" noise)
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

                // FIX (Apr 16 2026): suppress zero/negligible top-performer insights —
                // the "revenue 最高 Z加点料 (0.00)" pattern was misleading老板 who saw
                // "0.00" next to 最高 and lost trust. Hide the whole line instead.
                if (Math.abs(topValue) >= 0.01) {
                    String measureName = primaryMeasure.getStandardName() != null ?
                            primaryMeasure.getStandardName() : primaryMeasure.getOriginalName();
                    String dimName = primaryDim.getStandardName() != null ?
                            primaryDim.getStandardName() : primaryDim.getOriginalName();
                    insights.add(String.format("%s 最高的%s: %s (%.2f)",
                            measureName, dimName, topName, topValue));
                }
            }
        }

        // Measure totals — already skips 0 via sum > 0 guard
        int nonZeroMeasures = 0;
        for (SmartBiPgFieldDefinition measure : measures) {
            Double sum = dynamicDataRepository.sumField(factoryId, uploadId, measure.getOriginalName());
            if (sum != null && sum > 0) {
                String name = measure.getStandardName() != null ?
                        measure.getStandardName() : measure.getOriginalName();
                insights.add(String.format("%s 合计: %s", name,
                        formatNumber(sum, measure.getFormatPattern())));
                nonZeroMeasures++;
            }
        }

        // FIX (Apr 16 2026): if only "X 条记录" shows (all measures 0 / no top performer),
        // append actionable guidance so the老板 knows why the dashboard看起来空
        if (insights.size() == 1 && nonZeroMeasures == 0) {
            insights.add("所有数值列合计均为 0, 请确认上传的文件包含有效金额 (如 营业额/实收额/金额)");
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

        // 4. Try to rebuild from field_mappings. Use getFieldMappingsAsMap()
        //    to normalize both dict and array-of-objects JSONB shapes —
        //    older uploads (e.g. upload 3970/qhj 200k) stored arrays and
        //    would otherwise crash Hibernate's Map<String,String> hydration.
        Map<String, String> fieldMappings = upload.getFieldMappingsAsMap();
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
        // Get sample data to infer field types — only need first row, use PageRequest cap
        List<SmartBiDynamicData> sampleData = dynamicDataRepository
                .findByFactoryIdAndUploadIdOrderByRowIndex(factoryId, uploadId,
                        org.springframework.data.domain.PageRequest.of(0, 5))
                .getContent();
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
               lower.contains("total") || lower.contains("sum") || lower.contains("rate") ||
               lower.contains("count") || lower.contains("ratio") ||
               lower.contains("收入") || lower.contains("成本") || lower.contains("利润") ||
               lower.contains("金额") || lower.contains("数量") || lower.contains("合计") ||
               lower.contains("销售额") || lower.contains("营业额") || lower.contains("销量") ||
               lower.contains("实收") || lower.contains("实付") || lower.contains("折后") ||
               lower.contains("优惠") || lower.contains("单价") || lower.contains("原价") ||
               lower.contains("折扣") || lower.contains("退款") || lower.contains("费用") ||
               lower.contains("人数") || lower.contains("笔数") || lower.contains("单数") ||
               lower.contains("份数") || lower.contains("产量") || lower.contains("库存") ||
               lower.contains("周转");
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
