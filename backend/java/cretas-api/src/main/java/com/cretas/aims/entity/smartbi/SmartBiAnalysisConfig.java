package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.smartbi.enums.AnalysisConfigType;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;

/**
 * SmartBI Analysis Config Entity - Configuration for different analysis types
 *
 * Supports configuration types:
 * - KPI: Key performance indicator definitions and thresholds
 * - CHART: Default chart configurations and visualization rules
 * - RANKING: Top-N analysis and comparison settings
 * - INSIGHT: AI insight generation rules and patterns
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_analysis_config",
       indexes = {
           @Index(name = "idx_config_datasource", columnList = "datasource_id"),
           @Index(name = "idx_config_type", columnList = "config_type"),
           @Index(name = "idx_config_active", columnList = "is_active")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_datasource_config_type", columnNames = {"datasource_id", "config_type", "config_name"})
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiAnalysisConfig extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Reference to the datasource
     */
    @Column(name = "datasource_id", nullable = false)
    private Long datasourceId;

    /**
     * Configuration name for identification
     */
    @Column(name = "config_name", length = 100)
    private String configName;

    /**
     * Type of analysis configuration
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "config_type", nullable = false, length = 20)
    private AnalysisConfigType configType;

    /**
     * Configuration details (JSON)
     * Structure varies by config type:
     *
     * KPI: {
     *   "field": "revenue",
     *   "thresholds": { "warning": 80, "critical": 50 },
     *   "target": 100000,
     *   "unit": "CNY"
     * }
     *
     * CHART: {
     *   "chartType": "line",
     *   "xAxis": "date",
     *   "yAxis": ["revenue", "cost"],
     *   "options": { "stacked": false }
     * }
     *
     * RANKING: {
     *   "field": "sales",
     *   "dimension": "product",
     *   "topN": 10,
     *   "sortOrder": "DESC"
     * }
     *
     * INSIGHT: {
     *   "patterns": ["trend", "anomaly", "comparison"],
     *   "sensitivity": 0.8,
     *   "minConfidence": 0.7
     * }
     */
    @Column(name = "config_json", nullable = false, columnDefinition = "JSON")
    private String configJson;

    /**
     * Prompt template for AI analysis
     * Can include placeholders like {{field}}, {{timeRange}}, {{threshold}}
     */
    @Column(name = "prompt_template", columnDefinition = "TEXT")
    private String promptTemplate;

    /**
     * Whether this configuration is active
     */
    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    /**
     * Display order for UI presentation
     */
    @Builder.Default
    @Column(name = "display_order")
    private Integer displayOrder = 0;

    /**
     * Description of this configuration
     */
    @Column(name = "description", length = 500)
    private String description;
}
