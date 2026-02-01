package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.DataFeatureResult;
import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import com.cretas.aims.entity.smartbi.enums.UploadStatus;
import com.cretas.aims.entity.smartbi.postgres.SmartBiDynamicData;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgExcelUpload;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgFieldDefinition;
import com.cretas.aims.repository.smartbi.postgres.SmartBiDynamicDataRepository;
import com.cretas.aims.repository.smartbi.postgres.SmartBiPgExcelUploadRepository;
import com.cretas.aims.repository.smartbi.postgres.SmartBiPgFieldDefinitionRepository;
import com.cretas.aims.service.smartbi.DynamicDataPersistenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
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

    @Override
    @Transactional("smartbiPostgresTransactionManager")
    public DynamicPersistenceResult persistDynamic(String factoryId, ExcelParseResponse parseResponse) {
        return persistDynamic(factoryId, parseResponse, parseResponse.getFieldMappings(), null);
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public DynamicPersistenceResult persistDynamic(String factoryId, ExcelParseResponse parseResponse,
                                                    List<FieldMappingResult> confirmedMappings) {
        return persistDynamic(factoryId, parseResponse, confirmedMappings, null);
    }

    @Override
    @Transactional(value = "smartbiPostgresTransactionManager", propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public DynamicPersistenceResult persistDynamic(String factoryId, ExcelParseResponse parseResponse,
                                                    List<FieldMappingResult> confirmedMappings, String fileName) {
        String sheetName = getSheetName(parseResponse);
        log.info("Persisting dynamic data: factoryId={}, fileName={}, sheetName={}, rowCount={}",
                factoryId, fileName, sheetName, parseResponse.getRowCount());

        List<Map<String, Object>> previewData = parseResponse.getPreviewData();
        if (previewData == null || previewData.isEmpty()) {
            return DynamicPersistenceResult.failure("No data rows to persist", null);
        }

        try {
            // 1. Create upload record with fileName for multi-sheet grouping
            SmartBiPgExcelUpload upload = createUploadRecord(factoryId, parseResponse, confirmedMappings, fileName);
            upload = uploadRepository.save(upload);
            Long uploadId = upload.getId();
            log.info("Created upload record: uploadId={}", uploadId);

            // 2. Save field definitions
            List<SmartBiPgFieldDefinition> fieldDefs = saveFieldDefinitions(uploadId, confirmedMappings);
            log.info("Saved {} field definitions", fieldDefs.size());

            // 3. Extract time and category fields for quick filtering
            String timeField = findTimeField(confirmedMappings);
            String categoryField = findCategoryField(confirmedMappings);

            // 4. Save data rows as JSONB
            List<SmartBiDynamicData> dynamicDataList = new ArrayList<>();
            int rowIndex = 0;

            for (Map<String, Object> rowData : previewData) {
                // Skip empty rows
                if (rowData == null || rowData.isEmpty() ||
                    rowData.values().stream().allMatch(Objects::isNull)) {
                    continue;
                }

                // Extract period and category for quick filtering
                String period = extractValue(rowData, timeField);
                String category = extractValue(rowData, categoryField);

                SmartBiDynamicData dynamicData = SmartBiDynamicData.builder()
                        .factoryId(factoryId)
                        .uploadId(uploadId)
                        .sheetName(sheetName)
                        .rowIndex(rowIndex++)
                        .rowData(rowData)
                        .period(period)
                        .category(category)
                        .build();

                dynamicDataList.add(dynamicData);
            }

            // Batch save
            dynamicDataRepository.saveAll(dynamicDataList);
            int savedRows = dynamicDataList.size();
            log.info("Saved {} data rows", savedRows);

            // 5. Update upload status
            upload.setUploadStatus(UploadStatus.COMPLETED);
            upload.setRowCount(savedRows);
            uploadRepository.save(upload);

            return DynamicPersistenceResult.success(uploadId,
                    upload.getDetectedTableType(), savedRows, fieldDefs);

        } catch (Exception e) {
            log.error("Failed to persist dynamic data: {}", e.getMessage(), e);
            return DynamicPersistenceResult.failure("Persistence failed: " + e.getMessage(),
                    Collections.singletonList(e.getMessage()));
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

        for (FieldMappingResult mapping : fieldMappings) {
            // Get sample values from dataFeature if available
            List<Object> sampleValues = getSampleValues(mapping);

            SmartBiPgFieldDefinition def = SmartBiPgFieldDefinition.builder()
                    .uploadId(uploadId)
                    .originalName(mapping.getOriginalColumn())
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

        return SmartBiPgExcelUpload.builder()
                .factoryId(factoryId)
                .fileName(fileName)  // Store original file name for multi-sheet grouping
                .sheetName(sheetName)
                .detectedTableType(tableType)
                .fieldMappings(mappingsMap)
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

        if ("NUMERIC".equalsIgnoreCase(dataType)) {
            return true;
        }
        if ("AMOUNT".equalsIgnoreCase(subType) || "CURRENCY".equalsIgnoreCase(subType)) {
            return true;
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
