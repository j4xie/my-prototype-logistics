package com.cretas.aims.entity.smartbi.postgres;

import com.cretas.aims.entity.smartbi.enums.UploadStatus;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import lombok.*;
import org.hibernate.annotations.Type;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * SmartBI Excel Upload Entity (PostgreSQL)
 *
 * Records metadata for Excel file uploads with dynamic schema detection.
 * Stores detected structure and field mappings as JSONB for flexibility.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Entity
@Table(name = "smart_bi_pg_excel_uploads",
       indexes = {
           @Index(name = "idx_pg_upload_factory", columnList = "factory_id"),
           @Index(name = "idx_pg_upload_status", columnList = "upload_status"),
           @Index(name = "idx_pg_upload_table_type", columnList = "detected_table_type")
       })
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiPgExcelUpload {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Factory ID for multi-tenant isolation
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /**
     * Original file name
     */
    @Column(name = "file_name", length = 255)
    private String fileName;

    /**
     * Sheet name from Excel
     */
    @Column(name = "sheet_name", length = 100)
    private String sheetName;

    /**
     * Auto-detected table type
     * Examples: "profit_loss", "sales_by_region", "balance_sheet"
     */
    @Column(name = "detected_table_type", length = 50)
    private String detectedTableType;

    /**
     * Detected table structure (JSONB)
     * Contains: headerRows, dataStartRow, orientation, mergedCells
     */
    @Type(JsonBinaryType.class)
    @Column(name = "detected_structure", columnDefinition = "jsonb")
    private Map<String, Object> detectedStructure;

    /**
     * Field mappings resolved by AI (JSONB).
     *
     * Shape drift: excel_async.py writes a Map<original, standard> dict,
     * but older excel.py legacy path writes a List<Map<source, dataType,
     * standardField, originalColumn, confidence>>. Declare as Object and
     * let callers normalize via {@link #getFieldMappingsAsMap()}.
     *
     * Upload 3970 (qhj) and other legacy uploads have the array shape and
     * were crashing Hibernate when the field was Map-typed.
     */
    @Type(JsonBinaryType.class)
    @Column(name = "field_mappings", columnDefinition = "jsonb")
    private Object fieldMappings;

    /**
     * Normalize both JSONB shapes into a Map<original, standard>.
     * Returns empty map if field is null or in an unrecognized shape.
     */
    @SuppressWarnings("unchecked")
    public Map<String, String> getFieldMappingsAsMap() {
        Object raw = this.fieldMappings;
        if (raw == null) return java.util.Collections.emptyMap();
        if (raw instanceof Map) {
            Map<String, String> out = new java.util.HashMap<>();
            ((Map<Object, Object>) raw).forEach((k, v) ->
                out.put(String.valueOf(k), v == null ? null : String.valueOf(v)));
            return out;
        }
        if (raw instanceof List) {
            Map<String, String> out = new java.util.HashMap<>();
            for (Object item : (List<Object>) raw) {
                if (item instanceof Map) {
                    Map<String, Object> m = (Map<String, Object>) item;
                    Object orig = m.get("originalColumn");
                    Object std  = m.get("standardField");
                    if (orig != null) {
                        out.put(String.valueOf(orig),
                                std == null ? String.valueOf(orig) : String.valueOf(std));
                    }
                }
            }
            return out;
        }
        return java.util.Collections.emptyMap();
    }

    /**
     * Additional context info (JSONB)
     * Contains: industry, timeRange, primaryDimension, etc.
     */
    @Type(JsonBinaryType.class)
    @Column(name = "context_info", columnDefinition = "jsonb")
    private Map<String, Object> contextInfo;

    /**
     * Number of data rows
     */
    @Column(name = "row_count")
    private Integer rowCount;

    /**
     * Number of columns
     */
    @Column(name = "column_count")
    private Integer columnCount;

    /**
     * Processing status
     */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "upload_status", length = 20)
    private UploadStatus uploadStatus = UploadStatus.PENDING;

    /**
     * Error message if processing failed
     */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /**
     * Path to stored Excel file on disk for retry capability
     */
    @Column(name = "stored_file_path", length = 500)
    private String storedFilePath;

    /**
     * Number of retry attempts
     */
    @Builder.Default
    @Column(name = "retry_count")
    private Integer retryCount = 0;

    /**
     * Last error message (persisted even on transaction rollback)
     */
    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    /**
     * User who uploaded
     */
    @Column(name = "uploaded_by")
    private Long uploadedBy;

    /**
     * Record creation timestamp
     */
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    /**
     * Last update timestamp
     */
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
