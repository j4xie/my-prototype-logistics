package com.cretas.aims.entity.smartbi.postgres;

import com.vladmihalcea.hibernate.type.json.JsonBinaryType;
import lombok.*;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.TypeDef;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * SmartBI Dynamic Data Entity (PostgreSQL)
 *
 * Stores Excel data rows as JSONB for flexible schema storage.
 * Each row is stored as a single JSONB document containing all columns.
 *
 * Benefits:
 * - No fixed schema required
 * - GIN index support for efficient JSON queries
 * - Dynamic aggregation using PostgreSQL JSON operators
 *
 * Example row_data:
 * {
 *   "部门": "江苏分部",
 *   "营业收入": 1500000.00,
 *   "净利润": 250000.00,
 *   "期间": "2024年"
 * }
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Entity
@Table(name = "smart_bi_dynamic_data",
       indexes = {
           @Index(name = "idx_dynamic_factory_upload", columnList = "factory_id, upload_id"),
           @Index(name = "idx_dynamic_period", columnList = "factory_id, period"),
           @Index(name = "idx_dynamic_category", columnList = "factory_id, category")
       })
@TypeDef(name = "jsonb", typeClass = JsonBinaryType.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiDynamicData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Factory ID for multi-tenant isolation
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /**
     * Reference to the Excel upload record
     */
    @Column(name = "upload_id", nullable = false)
    private Long uploadId;

    /**
     * Sheet name from Excel file
     */
    @Column(name = "sheet_name", length = 100)
    private String sheetName;

    /**
     * Row index in original Excel (0-based)
     */
    @Column(name = "row_index")
    private Integer rowIndex;

    /**
     * Complete row data as JSONB
     * Contains all columns with their original field names
     * Example: {"营业收入": 1500000, "部门": "江苏分部"}
     */
    @Type(type = "jsonb")
    @Column(name = "row_data", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> rowData;

    /**
     * Extracted period value (for quick filtering)
     * Auto-extracted from detected time dimension field
     */
    @Column(name = "period", length = 50)
    private String period;

    /**
     * Extracted category value (for quick filtering)
     * Auto-extracted from primary dimension field
     */
    @Column(name = "category", length = 100)
    private String category;

    /**
     * Record creation timestamp
     */
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
