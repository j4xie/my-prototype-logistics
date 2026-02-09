package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.smartbi.enums.AggregationType;
import com.cretas.aims.entity.smartbi.enums.FieldType;
import com.cretas.aims.entity.smartbi.enums.MetricType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;

/**
 * SmartBI Field Definition Entity - Defines schema fields for a datasource
 *
 * Each field has:
 * - Basic metadata (name, alias, type)
 * - Analytics classification (metric type, aggregation)
 * - Visualization hints (KPI flag, compatible chart types)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_field_definition",
       indexes = {
           @Index(name = "idx_field_datasource", columnList = "datasource_id"),
           @Index(name = "idx_field_metric_type", columnList = "metric_type"),
           @Index(name = "idx_field_is_kpi", columnList = "is_kpi")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_datasource_field", columnNames = {"datasource_id", "field_name"})
       })
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = {"datasource"})
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiFieldDefinition extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Reference to parent datasource
     */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "datasource_id", nullable = false)
    private SmartBiDatasource datasource;

    /**
     * Datasource ID (for direct access without join)
     */
    @Column(name = "datasource_id", insertable = false, updatable = false)
    private Long datasourceId;

    /**
     * Original field name in the data source
     */
    @Column(name = "field_name", nullable = false, length = 100)
    private String fieldName;

    /**
     * User-friendly display name
     */
    @Column(name = "field_alias", length = 100)
    private String fieldAlias;

    /**
     * Data type of the field
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "field_type", nullable = false, length = 20)
    private FieldType fieldType;

    /**
     * Analytics metric type classification
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "metric_type", nullable = false, length = 20)
    private MetricType metricType;

    /**
     * Default aggregation method for measure fields
     */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "aggregation", length = 20)
    private AggregationType aggregation = AggregationType.NONE;

    /**
     * Whether this field is a key performance indicator
     */
    @Builder.Default
    @Column(name = "is_kpi", nullable = false)
    private Boolean isKpi = false;

    /**
     * Compatible chart types for this field (JSON array)
     * Example: ["line", "bar", "pie", "kpi_card"]
     */
    @Column(name = "chart_types", columnDefinition = "JSON")
    private String chartTypes;

    /**
     * Field description for AI context
     */
    @Column(name = "description", length = 500)
    private String description;

    /**
     * Display order in UI
     */
    @Builder.Default
    @Column(name = "display_order")
    private Integer displayOrder = 0;

    /**
     * Whether this field is visible in UI
     */
    @Builder.Default
    @Column(name = "is_visible", nullable = false)
    private Boolean isVisible = true;

    /**
     * Format pattern for display (e.g., "#,##0.00", "yyyy-MM-dd")
     */
    @Column(name = "format_pattern", length = 50)
    private String formatPattern;

    /**
     * Get display name (alias or field name)
     */
    @Transient
    public String getDisplayName() {
        return fieldAlias != null && !fieldAlias.isEmpty() ? fieldAlias : fieldName;
    }
}
