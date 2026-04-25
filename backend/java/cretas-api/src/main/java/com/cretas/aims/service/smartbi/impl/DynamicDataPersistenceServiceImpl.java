package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.DataFeatureResult;
import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import com.cretas.aims.entity.smartbi.enums.UploadStatus;
import com.cretas.aims.entity.smartbi.postgres.AggStrategy;
import com.cretas.aims.entity.smartbi.postgres.SmartBiDynamicData;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgExcelUpload;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgFieldDefinition;
import com.cretas.aims.repository.smartbi.postgres.SmartBiDynamicDataRepository;
import com.cretas.aims.repository.smartbi.postgres.SmartBiPgExcelUploadRepository;
import com.cretas.aims.repository.smartbi.postgres.SmartBiPgFieldDefinitionRepository;
import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.service.smartbi.DynamicDataPersistenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Dynamic Data Persistence Service Implementation
 *
 * Stores Excel data to PostgreSQL using JSONB for flexible schema support.
 * Each row is stored as a complete JSON document.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "smartbi.postgres.enabled", havingValue = "true", matchIfMissing = false)
public class DynamicDataPersistenceServiceImpl implements DynamicDataPersistenceService {

    private final SmartBiPgExcelUploadRepository uploadRepository;
    private final SmartBiDynamicDataRepository dynamicDataRepository;
    private final SmartBiPgFieldDefinitionRepository fieldDefRepository;
    private final PythonSmartBIClient pythonSmartBIClient;

    @jakarta.persistence.PersistenceContext(unitName = "smartbiPostgres")
    private jakarta.persistence.EntityManager smartbiEntityManager;

    /**
     * Chunk size for batched persistence — 60MB+ uploads with 600K rows used to
     * accumulate the entire entity list in heap before saveAll, then Hibernate
     * held all entities in the first-level cache until commit, blowing -Xmx1280m
     * with OOM. 1000 rows per batch + flush+clear keeps the session small.
     */
    private static final int PERSIST_BATCH_SIZE = 1000;

    /**
     * Build SmartBiDynamicData rows in chunks of {@link #PERSIST_BATCH_SIZE},
     * save each batch, then flush + clear the JPA session so Hibernate releases
     * the entities. Returns the total non-empty rows persisted.
     */
    private int persistRowsInBatches(
            String factoryId,
            Long uploadId,
            String sheetName,
            String timeField,
            String categoryField,
            java.util.List<java.util.Map<String, Object>> previewData) {
        int rowIndex = 0;
        int saved = 0;
        java.util.List<SmartBiDynamicData> batch = new java.util.ArrayList<>(PERSIST_BATCH_SIZE);
        for (java.util.Map<String, Object> rowData : previewData) {
            if (rowData == null || rowData.isEmpty() ||
                rowData.values().stream().allMatch(java.util.Objects::isNull)) {
                continue;
            }
            String period = extractValue(rowData, timeField);
            String category = extractValue(rowData, categoryField);
            batch.add(SmartBiDynamicData.builder()
                    .factoryId(factoryId)
                    .uploadId(uploadId)
                    .sheetName(sheetName)
                    .rowIndex(rowIndex++)
                    .rowData(rowData)
                    .period(period)
                    .category(category)
                    .build());
            if (batch.size() >= PERSIST_BATCH_SIZE) {
                dynamicDataRepository.saveAll(batch);
                if (smartbiEntityManager != null) {
                    smartbiEntityManager.flush();
                    smartbiEntityManager.clear();
                }
                saved += batch.size();
                batch.clear();
            }
        }
        if (!batch.isEmpty()) {
            dynamicDataRepository.saveAll(batch);
            if (smartbiEntityManager != null) {
                smartbiEntityManager.flush();
                smartbiEntityManager.clear();
            }
            saved += batch.size();
        }
        return saved;
    }

    @Override
    @Transactional("smartbiPostgresTransactionManager")
    public DynamicPersistenceResult persistDynamic(String factoryId, ExcelParseResponse parseResponse) {
        return persistDynamic(factoryId, parseResponse, parseResponse.getFieldMappings(), null);
    }

    @Override
    @Transactional("smartbiPostgresTransactionManager")
    public DynamicPersistenceResult persistDynamic(String factoryId, ExcelParseResponse parseResponse, String fileName) {
        return persistDynamic(factoryId, parseResponse, parseResponse.getFieldMappings(), fileName);
    }

    @Override
    @Transactional("smartbiPostgresTransactionManager")
    public DynamicPersistenceResult persistDynamic(String factoryId, ExcelParseResponse parseResponse,
                                                    List<FieldMappingResult> confirmedMappings) {
        return persistDynamic(factoryId, parseResponse, confirmedMappings, null);
    }

    @Override
    @Transactional("smartbiPostgresTransactionManager")
    public DynamicPersistenceResult persistDynamic(String factoryId, ExcelParseResponse parseResponse,
                                                    List<FieldMappingResult> confirmedMappings, String fileName) {
        String sheetName = getSheetName(parseResponse);
        log.info("Persisting dynamic data: factoryId={}, sheetName={}, fileName={}, rowCount={}",
                factoryId, sheetName, fileName, parseResponse.getRowCount());

        List<Map<String, Object>> previewData = parseResponse.getPreviewData();
        if (previewData == null || previewData.isEmpty()) {
            return DynamicPersistenceResult.failure("No data rows to persist", null);
        }

        // Bug #42 fix (2026-04-18): defense-in-depth against upstream leak of
        // field mappings that aren't actually in the parsed row data. Seen during
        // Bug #25b multi-stacked-table testing where region 2 upload received
        // confirmedMappings containing region 1 column names from stale frontend
        // state. Row data was correct but field_definitions schema showed both
        // regions, polluting AI schema analysis. Filter any mapping whose
        // originalColumn is absent from previewData[0].keys().
        if (confirmedMappings != null && !confirmedMappings.isEmpty()) {
            java.util.Set<String> realCols = previewData.get(0).keySet();
            int beforeSize = confirmedMappings.size();
            confirmedMappings = confirmedMappings.stream()
                    .filter(m -> m.getOriginalColumn() != null && realCols.contains(m.getOriginalColumn()))
                    .collect(java.util.stream.Collectors.toList());
            if (confirmedMappings.size() < beforeSize) {
                log.warn("Bug #42 filter: dropped {} field mappings not in previewData (schema-leak defense). Kept {}/{}.",
                        beforeSize - confirmedMappings.size(), confirmedMappings.size(), beforeSize);
            }
        }

        SmartBiPgExcelUpload upload = null;
        try {
            // 1. Create upload record
            upload = createUploadRecord(factoryId, parseResponse, confirmedMappings, fileName);
            upload = uploadRepository.save(upload);
            Long uploadId = upload.getId();
            log.info("Created upload record: uploadId={}", uploadId);

            // 2. Save field definitions
            List<SmartBiPgFieldDefinition> fieldDefs = saveFieldDefinitions(uploadId, confirmedMappings);
            log.info("Saved {} field definitions", fieldDefs.size());

            // 3. Extract time and category fields for quick filtering
            String timeField = findTimeField(confirmedMappings);
            String categoryField = findCategoryField(confirmedMappings);

            // 4. Save data rows as JSONB — chunked to avoid OOM on large uploads
            int savedRows = persistRowsInBatches(
                    factoryId, uploadId, sheetName, timeField, categoryField, previewData);
            log.info("Saved {} data rows (batched)", savedRows);

            // 4.5 Backfill field definitions for row_data columns that semantic_mapper missed
            // (Apr 16 2026, BUG #11 fix): For CSV/Excel with many columns (POS 订单 232 cols),
            // semantic_mapper LLM only classifies ~13 cols → 营业额/实收额/应收金额 etc get dropped.
            // Scan actual row_data keys, auto-classify missing cols via Chinese keyword heuristics.
            try {
                if (savedRows > 0 && !previewData.isEmpty()) {
                    fieldDefs = backfillMissingFieldDefs(uploadId, fieldDefs, previewData.get(0));
                    log.info("After backfill: {} field definitions total", fieldDefs.size());
                }
            } catch (Exception e) {
                log.warn("Field definition backfill failed (non-blocking): {}", e.getMessage());
            }

            // 4.6 γ-1c (Apr 22 2026): delegate final classification to Python's unified
            // field_classifier so sync path matches async path. Fixes Java rule divergence
            // (bare 年|月|日 time false-positives, missing 账单号/商品结账总数/外部单号 overrides).
            //
            // Must fire AFTER the @Transactional commit — Python opens its own DB connection
            // and returns 404 on uploadId otherwise (uncommitted rows invisible). Use Spring's
            // TransactionSynchronizationManager to register an afterCommit hook.
            //
            // Non-blocking: if Python is down / returns non-2xx, keep Java-classified
            // definitions — user can manually POST /analytics/reclassify/{id} later.
            final Long uploadIdForHook = uploadId;
            final String factoryIdForHook = factoryId;
            if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
                org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                        new org.springframework.transaction.support.TransactionSynchronization() {
                            @Override
                            public void afterCommit() {
                                try {
                                    boolean ok = pythonSmartBIClient.reclassifyUpload(uploadIdForHook, factoryIdForHook);
                                    if (ok) {
                                        log.info("γ-1c: Python reclassify applied to upload {}", uploadIdForHook);
                                    } else {
                                        log.warn("γ-1c: Python reclassify skipped/failed for upload {}, keeping Java classification",
                                                uploadIdForHook);
                                    }
                                } catch (Exception e) {
                                    log.warn("γ-1c: Python reclassify threw for upload {} (non-blocking): {}",
                                            uploadIdForHook, e.getMessage());
                                }

                                // γ-2c (Apr 25 2026 / Task C / PROD-1 fix):
                                // pre-materialize enrichment_cache (KPI-only, no LLM) so
                                // the FE renders KPI cards in <1s on first visit instead
                                // of timing out at 120s on 200K-row POS uploads.
                                //
                                // Runs AFTER γ-1c so it sees the latest agg_strategy.
                                // Fully non-blocking: failures are logged, FE will fall
                                // back to running the full enrichment pipeline on first
                                // visit (same as pre-Task-C behaviour).
                                try {
                                    boolean precOk = pythonSmartBIClient.precomputeEnrichmentCache(
                                            uploadIdForHook, factoryIdForHook);
                                    if (precOk) {
                                        log.info("γ-2c: precompute-cache applied to upload {}",
                                                uploadIdForHook);
                                    } else {
                                        log.warn("γ-2c: precompute-cache skipped/failed for upload {} (non-blocking)",
                                                uploadIdForHook);
                                    }
                                } catch (Exception e) {
                                    log.warn("γ-2c: precompute-cache threw for upload {} (non-blocking): {}",
                                            uploadIdForHook, e.getMessage());
                                }
                            }
                        });
            } else {
                log.warn("γ-1c: no active transaction sync, skipping reclassify+precompute for upload {}", uploadId);
            }

            // 5. Update upload status
            upload.setUploadStatus(UploadStatus.COMPLETED);
            upload.setRowCount(savedRows);
            uploadRepository.save(upload);

            return DynamicPersistenceResult.success(uploadId,
                    upload.getDetectedTableType(), savedRows, fieldDefs);

        } catch (Exception e) {
            log.error("Failed to persist dynamic data: {}", e.getMessage(), e);
            // Mark upload as FAILED in a separate transaction so it survives rollback
            if (upload != null && upload.getId() != null) {
                try {
                    markUploadFailed(upload.getId(), e.getMessage());
                } catch (Exception markErr) {
                    log.error("Failed to mark upload as FAILED: {}", markErr.getMessage());
                }
            }
            DynamicPersistenceResult failResult = DynamicPersistenceResult.failure(
                    "Persistence failed: " + e.getMessage(),
                    Collections.singletonList(e.getMessage()));
            // Include uploadId in failure result so frontend can retry
            if (upload != null && upload.getId() != null) {
                failResult.setUploadId(upload.getId());
            }
            return failResult;
        }
    }

    @Override
    @Transactional("smartbiPostgresTransactionManager")
    public List<SmartBiPgFieldDefinition> saveFieldDefinitions(Long uploadId,
                                                                List<FieldMappingResult> fieldMappings) {
        if (fieldMappings == null || fieldMappings.isEmpty()) {
            return Collections.emptyList();
        }

        // Delete existing definitions
        fieldDefRepository.deleteByUploadId(uploadId);

        // Create new definitions
        List<SmartBiPgFieldDefinition> definitions = new ArrayList<>();
        int order = 0;

        // Deduplicate original_name to prevent unique constraint violation
        Map<String, Integer> nameCount = new HashMap<>();

        for (FieldMappingResult mapping : fieldMappings) {
            String originalName = mapping.getOriginalColumn();
            if (originalName == null || originalName.trim().isEmpty()) {
                originalName = "unnamed";
            }

            // Track duplicates and append suffix: "1月" → "1月", "1月_2", "1月_3"
            int count = nameCount.getOrDefault(originalName, 0) + 1;
            nameCount.put(originalName, count);
            String uniqueName = count > 1 ? originalName + "_" + count : originalName;

            // Get sample values from dataFeature if available
            List<Object> sampleValues = getSampleValues(mapping);

            SmartBiPgFieldDefinition def = SmartBiPgFieldDefinition.builder()
                    .uploadId(uploadId)
                    .originalName(uniqueName)
                    .standardName(mapping.getStandardField())
                    .fieldType(mapping.getDataType())
                    .semanticType(inferSemanticType(mapping))
                    .chartRole(inferChartRole(mapping))
                    .isDimension(isDimension(mapping))
                    .isMeasure(isMeasure(mapping))
                    .isTime(isTimeField(mapping))
                    .sampleValues(sampleValues)
                    .displayOrder(order++)
                    .formatPattern(determineFormatPattern(mapping))
                    .aggStrategy(AggStrategy.SUM)  // Python /reclassify γ-1c hook will refine post-commit
                    .build();

            definitions.add(def);
        }

        return fieldDefRepository.saveAll(definitions);
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", readOnly = true)
    public List<SmartBiPgFieldDefinition> getFieldDefinitions(Long uploadId) {
        return fieldDefRepository.findByUploadIdOrderByDisplayOrder(uploadId);
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", readOnly = true)
    public List<SmartBiDynamicData> getDataRows(String factoryId, Long uploadId) {
        return dynamicDataRepository.findByFactoryIdAndUploadId(factoryId, uploadId);
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", readOnly = true)
    public SmartBiPgExcelUpload getUploadRecord(Long uploadId) {
        return uploadRepository.findById(uploadId).orElse(null);
    }

    @Override
    @Transactional("smartbiPostgresTransactionManager")
    public int deleteByUploadId(Long uploadId) {
        int deleted = 0;

        // Delete field definitions
        fieldDefRepository.deleteByUploadId(uploadId);

        // Count and delete data rows
        long count = dynamicDataRepository.countByUploadId(uploadId);
        dynamicDataRepository.deleteByUploadId(uploadId);
        deleted = (int) count;

        // Delete upload record
        uploadRepository.deleteById(uploadId);

        log.info("Deleted uploadId={}: {} data rows", uploadId, deleted);
        return deleted;
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", propagation = Propagation.REQUIRES_NEW)
    public void markUploadFailed(Long uploadId, String errorMessage) {
        log.info("Marking upload {} as FAILED: {}", uploadId, errorMessage);
        uploadRepository.findById(uploadId).ifPresent(upload -> {
            upload.setUploadStatus(UploadStatus.FAILED);
            upload.setLastError(errorMessage != null && errorMessage.length() > 2000
                    ? errorMessage.substring(0, 2000) : errorMessage);
            upload.setUpdatedAt(LocalDateTime.now());
            uploadRepository.save(upload);
        });
    }

    @Override
    @Transactional("smartbiPostgresTransactionManager")
    public void clearDataByUploadId(Long uploadId) {
        log.info("Clearing data for uploadId={} (keeping upload record)", uploadId);
        fieldDefRepository.deleteByUploadId(uploadId);
        dynamicDataRepository.deleteByUploadId(uploadId);
        log.info("Cleared field definitions and dynamic data for uploadId={}", uploadId);
    }

    @Override
    @Transactional("smartbiPostgresTransactionManager")
    public DynamicPersistenceResult retryPersistDynamic(Long existingUploadId, String factoryId,
                                                          ExcelParseResponse parseResponse, String fileName) {
        log.info("Retrying persistence for uploadId={}, factoryId={}", existingUploadId, factoryId);

        SmartBiPgExcelUpload upload = uploadRepository.findById(existingUploadId).orElse(null);
        if (upload == null) {
            return DynamicPersistenceResult.failure("Upload record not found: " + existingUploadId, null);
        }

        String sheetName = getSheetName(parseResponse);
        List<Map<String, Object>> previewData = parseResponse.getPreviewData();
        if (previewData == null || previewData.isEmpty()) {
            markUploadFailed(existingUploadId, "No data rows to persist on retry");
            return DynamicPersistenceResult.failure("No data rows to persist", null);
        }

        try {
            // Clear old data
            clearDataByUploadId(existingUploadId);

            // Update upload status to RETRYING
            upload.setUploadStatus(UploadStatus.RETRYING);
            upload.setRetryCount((upload.getRetryCount() != null ? upload.getRetryCount() : 0) + 1);
            upload.setUpdatedAt(LocalDateTime.now());
            uploadRepository.save(upload);

            // Re-save field definitions
            List<FieldMappingResult> fieldMappings = parseResponse.getFieldMappings();
            List<SmartBiPgFieldDefinition> fieldDefs = saveFieldDefinitions(existingUploadId, fieldMappings);
            log.info("Re-saved {} field definitions", fieldDefs.size());

            // Extract time and category fields
            String timeField = findTimeField(fieldMappings);
            String categoryField = findCategoryField(fieldMappings);

            // Re-save data rows — chunked to avoid OOM on large uploads
            int savedRows = persistRowsInBatches(
                    factoryId, existingUploadId, sheetName, timeField, categoryField, previewData);
            log.info("Retry saved {} data rows (batched)", savedRows);

            // Update upload status to COMPLETED
            upload.setUploadStatus(UploadStatus.COMPLETED);
            upload.setRowCount(savedRows);
            upload.setLastError(null);
            upload.setUpdatedAt(LocalDateTime.now());
            uploadRepository.save(upload);

            return DynamicPersistenceResult.success(existingUploadId,
                    upload.getDetectedTableType(), savedRows, fieldDefs);

        } catch (Exception e) {
            log.error("Retry persistence failed for uploadId={}: {}", existingUploadId, e.getMessage(), e);
            try {
                markUploadFailed(existingUploadId, "Retry failed: " + e.getMessage());
            } catch (Exception markErr) {
                log.error("Failed to mark retry as FAILED: {}", markErr.getMessage());
            }
            return DynamicPersistenceResult.failure("Retry persistence failed: " + e.getMessage(),
                    Collections.singletonList(e.getMessage()));
        }
    }

    // ==================== Private Helper Methods ====================

    private String getSheetName(ExcelParseResponse parseResponse) {
        if (parseResponse.getMetadata() != null) {
            return parseResponse.getMetadata().getSheetName();
        }
        return null;
    }

    private SmartBiPgExcelUpload createUploadRecord(String factoryId, ExcelParseResponse parseResponse,
                                                     List<FieldMappingResult> fieldMappings, String fileName) {
        // Build field mappings map
        Map<String, String> mappingsMap = new HashMap<>();
        if (fieldMappings != null) {
            for (FieldMappingResult mapping : fieldMappings) {
                if (mapping.getOriginalColumn() != null && mapping.getStandardField() != null) {
                    mappingsMap.put(mapping.getOriginalColumn(), mapping.getStandardField());
                }
            }
        }

        // Table type defaults to "general"
        String tableType = "general";

        // Build context info from data features
        Map<String, Object> contextInfo = new HashMap<>();
        if (parseResponse.getDataFeatures() != null) {
            List<Map<String, Object>> features = parseResponse.getDataFeatures().stream()
                    .map(this::featureToMap)
                    .collect(Collectors.toList());
            contextInfo.put("dataFeatures", features);
        }

        String sheetName = getSheetName(parseResponse);

        // Apr 23 2026: fieldMappings 改为 String 存原始 JSONB (hypersistence-utils
        // 对 Object 字段在 List-shape 数据上误推类型导致 LinkedHashMap<String,String>
        // deserialize 崩溃). 这里先序列化为 JSON string 再写入.
        String fieldMappingsJson;
        try {
            fieldMappingsJson = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(mappingsMap);
        } catch (Exception e) {
            fieldMappingsJson = "{}";
        }

        return SmartBiPgExcelUpload.builder()
                .factoryId(factoryId)
                .fileName(fileName)
                .sheetName(sheetName)
                .detectedTableType(tableType)
                .fieldMappings(fieldMappingsJson)
                .contextInfo(contextInfo)
                .rowCount(parseResponse.getRowCount())
                .columnCount(parseResponse.getHeaders() != null ? parseResponse.getHeaders().size() : 0)
                .uploadStatus(UploadStatus.PARSING)
                .build();
    }

    private Map<String, Object> featureToMap(DataFeatureResult feature) {
        Map<String, Object> map = new HashMap<>();
        if (feature != null) {
            map.put("columnName", feature.getColumnName());
            map.put("dataType", feature.getDataType() != null ? feature.getDataType().name() : null);
            if (feature.getNumericSubType() != null) {
                map.put("numericSubType", feature.getNumericSubType().name());
            }
            map.put("sampleValues", feature.getSampleValues());
        }
        return map;
    }

    private List<Object> getSampleValues(FieldMappingResult mapping) {
        // First try uniqueValues
        if (mapping.getUniqueValues() != null && !mapping.getUniqueValues().isEmpty()) {
            return new ArrayList<>(mapping.getUniqueValues());
        }
        // Then try dataFeature.sampleValues
        if (mapping.getDataFeature() != null && mapping.getDataFeature().getSampleValues() != null) {
            return new ArrayList<>(mapping.getDataFeature().getSampleValues());
        }
        return null;
    }

    private String inferSemanticType(FieldMappingResult mapping) {
        String standardField = mapping.getStandardField();
        String dataType = mapping.getDataType();

        if (standardField != null) {
            String lower = standardField.toLowerCase();
            if (lower.contains("revenue") || lower.contains("income") || lower.contains("收入")) {
                return "revenue";
            }
            if (lower.contains("cost") || lower.contains("expense") || lower.contains("成本") || lower.contains("费用")) {
                return "cost";
            }
            if (lower.contains("profit") || lower.contains("利润")) {
                return "profit";
            }
            if (lower.contains("date") || lower.contains("time") || lower.contains("日期") || lower.contains("时间")) {
                return "time";
            }
            if (lower.contains("department") || lower.contains("部门")) {
                return "department";
            }
            if (lower.contains("region") || lower.contains("区域") || lower.contains("地区")) {
                return "region";
            }
        }

        // Infer from data type
        if ("DATE".equalsIgnoreCase(dataType)) {
            return "time";
        }
        if ("NUMERIC".equalsIgnoreCase(dataType)) {
            return "measure";
        }
        if ("CATEGORICAL".equalsIgnoreCase(dataType)) {
            return "dimension";
        }

        return null;
    }

    private String inferChartRole(FieldMappingResult mapping) {
        String dataType = mapping.getDataType();
        String semanticType = inferSemanticType(mapping);

        // Apr 24 2026 — semantic-type takes priority over raw dataType.
        // ID fields are NUMERIC (e.g. 评价ID = 9144294805) but should NOT be
        // y_axis measures — auto-aggregating them gives "评价ID = 383,816 亿"
        // KPI cards (user screenshot bug). Mark them as series/grouping role.
        // Rating fields detected by Python heuristic; here we just guard IDs.
        if ("id".equalsIgnoreCase(semanticType)) {
            return "series";
        }
        if ("DATE".equalsIgnoreCase(dataType)) {
            return "x_axis";
        }
        if ("NUMERIC".equalsIgnoreCase(dataType)) {
            return "y_axis";
        }
        if ("CATEGORICAL".equalsIgnoreCase(dataType)) {
            return "series";
        }

        return null;
    }

    private String findTimeField(List<FieldMappingResult> mappings) {
        if (mappings == null) return null;
        return mappings.stream()
                .filter(this::isTimeField)
                .map(FieldMappingResult::getOriginalColumn)
                .findFirst()
                .orElse(null);
    }

    private String findCategoryField(List<FieldMappingResult> mappings) {
        if (mappings == null) return null;
        return mappings.stream()
                .filter(m -> isDimension(m) && !isTimeField(m))
                .map(FieldMappingResult::getOriginalColumn)
                .findFirst()
                .orElse(null);
    }

    private String extractValue(Map<String, Object> rowData, String fieldName) {
        if (fieldName == null || !rowData.containsKey(fieldName)) {
            return null;
        }
        Object value = rowData.get(fieldName);
        return value != null ? value.toString() : null;
    }

    /**
     * FIX-11 (Apr 16 2026): Backfill field definitions for columns semantic_mapper missed.
     *
     * semantic_mapper's LLM-based classification only handles ~10-20 cols reliably before
     * timing out or hallucinating. 订单明细 CSV has 232 cols (营业额/实收额/客流量/人均消费 etc
     * all crucial for Dashboard KPIs). After initial saveFieldDefinitions, scan actual row_data
     * keys and append missing cols with keyword-based isMeasure/isDimension/isTime.
     *
     * Safe: only ADDS missing field defs, never modifies existing ones.
     */
    private List<SmartBiPgFieldDefinition> backfillMissingFieldDefs(
            Long uploadId,
            List<SmartBiPgFieldDefinition> existingDefs,
            Map<String, Object> sampleRow) {
        java.util.Set<String> existingNames = existingDefs.stream()
                .map(SmartBiPgFieldDefinition::getOriginalName)
                .collect(java.util.stream.Collectors.toSet());

        List<SmartBiPgFieldDefinition> toAdd = new ArrayList<>();
        int order = existingDefs.size();
        int skippedEmpty = 0;

        for (String colName : sampleRow.keySet()) {
            if (colName == null || colName.trim().isEmpty()) { skippedEmpty++; continue; }
            if (existingNames.contains(colName)) continue;  // skip already-mapped

            Object sampleValue = sampleRow.get(colName);
            String inferredType = inferTypeFromValue(sampleValue);
            boolean isTime = isTimeFieldByName(colName);
            boolean isMeasure = !isTime && isMeasureByName(colName, inferredType);
            boolean isDimension = !isTime && !isMeasure && isDimensionByName(colName, inferredType);

            SmartBiPgFieldDefinition def = SmartBiPgFieldDefinition.builder()
                    .uploadId(uploadId)
                    .originalName(colName)
                    .standardName(colName)  // preserve Chinese name; no rename
                    .fieldType(inferredType)
                    .isDimension(isDimension)
                    .isMeasure(isMeasure)
                    .isTime(isTime)
                    .displayOrder(order++)
                    .sampleValues(sampleValue != null ? java.util.List.of(sampleValue) : java.util.Collections.emptyList())
                    .aggStrategy(AggStrategy.SUM)  // Python /reclassify γ-1c hook will refine post-commit
                    .build();
            toAdd.add(def);
        }

        if (!toAdd.isEmpty()) {
            fieldDefRepository.saveAll(toAdd);
            log.info("Backfilled {} field definitions (measures: {}, dimensions: {}, times: {}); skipped {} empty names",
                    toAdd.size(),
                    toAdd.stream().filter(f -> Boolean.TRUE.equals(f.getIsMeasure())).count(),
                    toAdd.stream().filter(f -> Boolean.TRUE.equals(f.getIsDimension())).count(),
                    toAdd.stream().filter(f -> Boolean.TRUE.equals(f.getIsTime())).count(),
                    skippedEmpty);
            List<SmartBiPgFieldDefinition> combined = new ArrayList<>(existingDefs);
            combined.addAll(toAdd);
            return combined;
        }
        return existingDefs;
    }

    private String inferTypeFromValue(Object v) {
        if (v == null) return "TEXT";
        if (v instanceof Number) return "NUMERIC";
        String s = v.toString().trim();
        if (s.isEmpty()) return "TEXT";
        // Numeric check
        if (s.matches("^-?\\d+(\\.\\d+)?$")) return "NUMERIC";
        // Date check (yyyy-MM-dd or yyyy/MM/dd or contains 年/月/日)
        if (s.matches("^\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}.*") || s.contains("年") || s.contains("月")) return "DATE";
        return "TEXT";
    }

    /** Chinese business keyword → isMeasure */
    private boolean isMeasureByName(String colName, String inferredType) {
        if (colName == null) return false;
        String n = colName.toLowerCase();
        // Skip payment method lists that mimic money (支付宝/美团/微信) — those are dimension-like
        // Strong measure keywords: 营业/实收/应收/金额/营收/销售额/利润/成本/客流/人数/数量/份数/单价
        if (n.matches(".*(营业额|实收额|实收|应收金额|应收|销售额|营业|收款金额|实收金额|营收|利润|" +
                "毛利|成本|单价|原价|客流量|客流|人数|份数|销量|数量|产量|总额|合计|折扣额|优惠额).*")) {
            return true;
        }
        // Numeric + contains 额/率/金/count/amount — likely measure
        if ("NUMERIC".equals(inferredType) &&
            n.matches(".*(额|率|金|rate|amount|count|revenue|profit|sum|total).*")) {
            return true;
        }
        return false;
    }

    private boolean isDimensionByName(String colName, String inferredType) {
        if (colName == null) return false;
        String n = colName.toLowerCase();
        if (n.matches(".*(门店|店铺|区域|省份|城市|大区|品牌|类别|分类|状态|类型|" +
                "服务员|销售员|收银员|班次|桌位|账单号|订单|区域|部门|编号|名称|store|region|category|type|status).*")) {
            return true;
        }
        // Non-numeric + not a time column → likely dimension
        return !"NUMERIC".equals(inferredType) && !"DATE".equals(inferredType);
    }

    private boolean isTimeFieldByName(String colName) {
        if (colName == null) return false;
        String n = colName.toLowerCase();
        return n.matches(".*(时间|日期|period|date|time|year|month|年|月|日).*");
    }

    private boolean isDimension(FieldMappingResult mapping) {
        String dataType = mapping.getDataType();
        String standardField = mapping.getStandardField();

        if ("CATEGORICAL".equalsIgnoreCase(dataType)) {
            return true;
        }
        if (standardField != null) {
            String lower = standardField.toLowerCase();
            return lower.matches(".*(department|region|category|product|name|部门|区域|类别|产品|名称).*");
        }
        return false;
    }

    private boolean isMeasure(FieldMappingResult mapping) {
        String dataType = mapping.getDataType();
        String subType = mapping.getSubType();

        if ("NUMERIC".equalsIgnoreCase(dataType) || "NUMBER".equalsIgnoreCase(dataType) ||
            "INTEGER".equalsIgnoreCase(dataType) || "FLOAT".equalsIgnoreCase(dataType) ||
            "DECIMAL".equalsIgnoreCase(dataType) || "DOUBLE".equalsIgnoreCase(dataType)) {
            return true;
        }
        if ("AMOUNT".equalsIgnoreCase(subType) || "CURRENCY".equalsIgnoreCase(subType) ||
            "PERCENT".equalsIgnoreCase(subType) || "RATE".equalsIgnoreCase(subType)) {
            return true;
        }
        // Fallback: check field name for measure-like keywords
        String standardField = mapping.getStandardField();
        if (standardField != null) {
            String lower = standardField.toLowerCase();
            if (lower.matches(".*(amount|revenue|sales|cost|profit|price|quantity|total|sum|count|rate|ratio|" +
                    "费用|成本|利润|收入|金额|数量|合计|销售额|营业额|" +
                    "实收|实付|折后|优惠|单价|原价|折扣|退款|" +
                    "人数|笔数|单数|份数|销量|产量|库存|周转).*")) {
                return true;
            }
        }
        return false;
    }

    private boolean isTimeField(FieldMappingResult mapping) {
        String dataType = mapping.getDataType();
        String standardField = mapping.getStandardField();

        if ("DATE".equalsIgnoreCase(dataType)) {
            return true;
        }
        if (standardField != null) {
            String lower = standardField.toLowerCase();
            return lower.matches(".*(date|time|period|year|month|日期|时间|期间|年|月).*");
        }
        return false;
    }

    private String determineFormatPattern(FieldMappingResult mapping) {
        String dataType = mapping.getDataType();
        String subType = mapping.getSubType();

        if (dataType == null) return null;

        switch (dataType.toUpperCase()) {
            case "NUMERIC":
                if ("AMOUNT".equalsIgnoreCase(subType) || "CURRENCY".equalsIgnoreCase(subType)) {
                    return "#,##0.00";
                }
                if ("PERCENTAGE".equalsIgnoreCase(subType)) {
                    return "0.00%";
                }
                return "#,##0.##";
            case "DATE":
                return "yyyy-MM-dd";
            default:
                return null;
        }
    }
}
