package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.smartbi.enums.UploadStatus;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;

/**
 * SmartBI Excel Upload Entity - Records for Excel file uploads
 *
 * Tracks:
 * - File metadata (name, size, row/column count)
 * - Processing status
 * - Field mappings resolved by AI
 * - Data features analyzed by AI
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_excel_uploads",
       indexes = {
           @Index(name = "idx_factory_id", columnList = "factory_id"),
           @Index(name = "idx_upload_status", columnList = "upload_status"),
           @Index(name = "idx_created_at", columnList = "created_at")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiExcelUpload extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Factory ID
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /**
     * Original file name
     */
    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    /**
     * OSS storage URL
     */
    @Column(name = "file_url", length = 500)
    private String fileUrl;

    /**
     * File size in bytes
     */
    @Column(name = "file_size")
    private Long fileSize;

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
     * Sheet name
     */
    @Column(name = "sheet_name", length = 100)
    private String sheetName;

    /**
     * Upload processing status
     */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "upload_status", length = 20)
    private UploadStatus uploadStatus = UploadStatus.PENDING;

    /**
     * Error message if failed
     */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /**
     * Resolved field mappings JSON
     * Structure: { "sourceColumn": "targetField", ... }
     */
    @Column(name = "field_mappings", columnDefinition = "JSON")
    private String fieldMappings;

    /**
     * Analyzed data features JSON
     * Structure: { "dataType": "sales", "timeRange": {...}, "dimensions": [...] }
     */
    @Column(name = "data_features", columnDefinition = "JSON")
    private String dataFeatures;

    /**
     * User ID who uploaded
     */
    @Column(name = "uploaded_by")
    private Long uploadedBy;
}
