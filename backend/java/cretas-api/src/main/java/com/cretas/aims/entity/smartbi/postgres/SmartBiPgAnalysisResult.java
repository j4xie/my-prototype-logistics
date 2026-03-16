package com.cretas.aims.entity.smartbi.postgres;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import lombok.*;
import org.hibernate.annotations.Type;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * SmartBI Analysis Result Entity (PostgreSQL)
 *
 * Stores AI-generated analysis results for uploaded Excel data.
 * Caches insights, forecasts, and chart configurations.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Entity
@Table(name = "smart_bi_pg_analysis_results",
       indexes = {
           @Index(name = "idx_pg_analysis_upload", columnList = "upload_id"),
           @Index(name = "idx_pg_analysis_factory", columnList = "factory_id"),
           @Index(name = "idx_pg_analysis_type", columnList = "analysis_type")
       })
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiPgAnalysisResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Reference to parent upload record
     */
    @Column(name = "upload_id", nullable = false)
    private Long uploadId;

    /**
     * Factory ID for multi-tenant isolation
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /**
     * Type of analysis
     * Values: insight, forecast, benchmark, comparison, trend
     */
    @Column(name = "analysis_type", length = 50)
    private String analysisType;

    /**
     * Complete analysis result (JSONB)
     * Structure varies by analysis_type:
     * - insight: { summary, keyFindings, recommendations }
     * - forecast: { predictions, confidence, methodology }
     * - benchmark: { industryComparison, rankings }
     */
    @Type(JsonBinaryType.class)
    @Column(name = "analysis_result", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> analysisResult;

    /**
     * Chart configurations (JSONB array)
     * Contains ready-to-render chart specs
     */
    @Type(JsonBinaryType.class)
    @Column(name = "chart_configs", columnDefinition = "jsonb")
    private List<Map<String, Object>> chartConfigs;

    /**
     * KPI values extracted/calculated (JSONB)
     * Example: { "totalRevenue": 1500000, "yoyGrowth": 0.15 }
     */
    @Type(JsonBinaryType.class)
    @Column(name = "kpi_values", columnDefinition = "jsonb")
    private Map<String, Object> kpiValues;

    /**
     * AI-generated insights (JSONB array)
     */
    @Type(JsonBinaryType.class)
    @Column(name = "insights", columnDefinition = "jsonb")
    private List<Map<String, Object>> insights;

    /**
     * Request parameters used for this analysis
     */
    @Type(JsonBinaryType.class)
    @Column(name = "request_params", columnDefinition = "jsonb")
    private Map<String, Object> requestParams;

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
