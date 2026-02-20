package com.cretas.aims.entity.smartbi.postgres;

import com.vladmihalcea.hibernate.type.json.JsonBinaryType;
import lombok.*;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.TypeDef;

import javax.persistence.*;
import java.util.List;
import java.util.Map;

/**
 * SmartBI Field Definition Entity (PostgreSQL)
 *
 * Stores field metadata for each upload, defining the schema
 * for dynamic data stored in smart_bi_dynamic_data.
 *
 * Each field has:
 * - Original name from Excel
 * - Standardized semantic name
 * - Type classification (dimension/measure/time)
 * - Chart role for visualization
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Entity
@Table(name = "smart_bi_pg_field_definitions",
       indexes = {
           @Index(name = "idx_pg_field_upload", columnList = "upload_id")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_pg_field_upload_name",
                             columnNames = {"upload_id", "original_name"})
       })
@TypeDef(name = "jsonb", typeClass = JsonBinaryType.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiPgFieldDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Reference to parent upload record
     */
    @Column(name = "upload_id", nullable = false)
    private Long uploadId;

    /**
     * Original field name from Excel
     */
    @Column(name = "original_name", length = 255)
    private String originalName;

    /**
     * Standardized semantic field name
     * Mapped by AI to common business terms
     */
    @Column(name = "standard_name", length = 100)
    private String standardName;

    /**
     * Data type of the field
     * Values: STRING, NUMBER, DATE, BOOLEAN, PERCENTAGE, CURRENCY
     */
    @Column(name = "field_type", length = 50)
    private String fieldType;

    /**
     * Semantic type classification
     * Examples: revenue, cost, profit, quantity, department, region
     */
    @Column(name = "semantic_type", length = 50)
    private String semanticType;

    /**
     * Role in chart visualization
     * Values: x_axis, y_axis, series, filter, tooltip
     */
    @Column(name = "chart_role", length = 50)
    private String chartRole;

    /**
     * Whether this field is a dimension (for grouping)
     */
    @Builder.Default
    @Column(name = "is_dimension")
    private Boolean isDimension = false;

    /**
     * Whether this field is a measure (for aggregation)
     */
    @Builder.Default
    @Column(name = "is_measure")
    private Boolean isMeasure = false;

    /**
     * Whether this field represents time
     */
    @Builder.Default
    @Column(name = "is_time")
    private Boolean isTime = false;

    /**
     * Sample values from the data (JSONB array)
     * Used for display hints and validation
     */
    @Type(type = "jsonb")
    @Column(name = "sample_values", columnDefinition = "jsonb")
    private List<Object> sampleValues;

    /**
     * Field statistics (JSONB)
     * Contains: min, max, mean, nullCount, distinctCount
     */
    @Type(type = "jsonb")
    @Column(name = "statistics", columnDefinition = "jsonb")
    private Map<String, Object> statistics;

    /**
     * Display order in UI
     */
    @Builder.Default
    @Column(name = "display_order")
    private Integer displayOrder = 0;

    /**
     * Format pattern for display (e.g., "#,##0.00")
     */
    @Column(name = "format_pattern", length = 50)
    private String formatPattern;
}
