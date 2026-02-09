package com.cretas.aims.entity.smartbi.postgres;

import com.cretas.aims.entity.smartbi.enums.UploadStatus;
import com.vladmihalcea.hibernate.type.json.JsonBinaryType;
import lombok.*;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.TypeDef;

import javax.persistence.*;
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
@TypeDef(name = "jsonb", typeClass = JsonBinaryType.class)
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
    @Type(type = "jsonb")
    @Column(name = "detected_structure", columnDefinition = "jsonb")
    private Map<String, Object> detectedStructure;

    /**
     * Field mappings resolved by AI (JSONB)
     * Maps original column names to semantic field names
     */
    @Type(type = "jsonb")
    @Column(name = "field_mappings", columnDefinition = "jsonb")
    private Map<String, String> fieldMappings;

    /**
     * Additional context info (JSONB)
     * Contains: industry, timeRange, primaryDimension, etc.
     */
    @Type(type = "jsonb")
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
