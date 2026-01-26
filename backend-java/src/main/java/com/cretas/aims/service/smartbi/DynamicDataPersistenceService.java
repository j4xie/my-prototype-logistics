package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import com.cretas.aims.entity.smartbi.postgres.SmartBiDynamicData;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgExcelUpload;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgFieldDefinition;

import java.util.List;
import java.util.Map;

/**
 * Dynamic Data Persistence Service Interface
 *
 * Handles storage of dynamic Excel data to PostgreSQL using JSONB.
 * Unlike fixed-schema storage (MySQL), this service stores each row
 * as a complete JSONB document, allowing flexible schema per upload.
 *
 * Key features:
 * - Dynamic schema: no fixed columns, all data stored as JSONB
 * - Field definitions: tracks metadata for each field
 * - GIN index support: efficient JSON queries
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
public interface DynamicDataPersistenceService {

    /**
     * Persistence result containing upload metadata
     */
    class DynamicPersistenceResult {
        private boolean success;
        private Long uploadId;
        private String tableType;
        private int totalRows;
        private int savedRows;
        private int failedRows;
        private String message;
        private List<SmartBiPgFieldDefinition> fieldDefinitions;
        private List<String> errors;

        // Getters and setters
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public Long getUploadId() { return uploadId; }
        public void setUploadId(Long uploadId) { this.uploadId = uploadId; }
        public String getTableType() { return tableType; }
        public void setTableType(String tableType) { this.tableType = tableType; }
        public int getTotalRows() { return totalRows; }
        public void setTotalRows(int totalRows) { this.totalRows = totalRows; }
        public int getSavedRows() { return savedRows; }
        public void setSavedRows(int savedRows) { this.savedRows = savedRows; }
        public int getFailedRows() { return failedRows; }
        public void setFailedRows(int failedRows) { this.failedRows = failedRows; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public List<SmartBiPgFieldDefinition> getFieldDefinitions() { return fieldDefinitions; }
        public void setFieldDefinitions(List<SmartBiPgFieldDefinition> fieldDefinitions) { this.fieldDefinitions = fieldDefinitions; }
        public List<String> getErrors() { return errors; }
        public void setErrors(List<String> errors) { this.errors = errors; }

        public static DynamicPersistenceResult success(Long uploadId, String tableType,
                                                        int savedRows, List<SmartBiPgFieldDefinition> fields) {
            DynamicPersistenceResult result = new DynamicPersistenceResult();
            result.setSuccess(true);
            result.setUploadId(uploadId);
            result.setTableType(tableType);
            result.setSavedRows(savedRows);
            result.setTotalRows(savedRows);
            result.setFieldDefinitions(fields);
            result.setMessage(String.format("Successfully saved %d rows to dynamic storage", savedRows));
            return result;
        }

        public static DynamicPersistenceResult failure(String message, List<String> errors) {
            DynamicPersistenceResult result = new DynamicPersistenceResult();
            result.setSuccess(false);
            result.setMessage(message);
            result.setErrors(errors);
            return result;
        }
    }

    /**
     * Persist parsed Excel data to PostgreSQL dynamic storage
     *
     * @param factoryId Factory ID for tenant isolation
     * @param parseResponse Parsed Excel data with field mappings
     * @return Persistence result with uploadId and field definitions
     */
    DynamicPersistenceResult persistDynamic(String factoryId, ExcelParseResponse parseResponse);

    /**
     * Persist data with confirmed field mappings
     *
     * @param factoryId Factory ID
     * @param parseResponse Parsed Excel data
     * @param confirmedMappings User-confirmed field mappings
     * @return Persistence result
     */
    DynamicPersistenceResult persistDynamic(String factoryId, ExcelParseResponse parseResponse,
                                             List<FieldMappingResult> confirmedMappings);

    /**
     * Save field definitions for an upload
     *
     * @param uploadId Upload record ID
     * @param fieldMappings Field mapping results
     * @return Saved field definitions
     */
    List<SmartBiPgFieldDefinition> saveFieldDefinitions(Long uploadId, List<FieldMappingResult> fieldMappings);

    /**
     * Get field definitions for an upload
     *
     * @param uploadId Upload record ID
     * @return Field definitions
     */
    List<SmartBiPgFieldDefinition> getFieldDefinitions(Long uploadId);

    /**
     * Get all data rows for an upload
     *
     * @param factoryId Factory ID
     * @param uploadId Upload record ID
     * @return List of dynamic data rows
     */
    List<SmartBiDynamicData> getDataRows(String factoryId, Long uploadId);

    /**
     * Get upload record
     *
     * @param uploadId Upload record ID
     * @return Upload record or null
     */
    SmartBiPgExcelUpload getUploadRecord(Long uploadId);

    /**
     * Delete all data for an upload
     *
     * @param uploadId Upload record ID
     * @return Number of deleted rows
     */
    int deleteByUploadId(Long uploadId);
}
