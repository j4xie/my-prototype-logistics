package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * SmartBI Analysis Cache Entity - Caches analysis results
 *
 * Purpose:
 * - Reduce repeated AI calls for same queries
 * - Store pre-computed dashboard data
 * - Cache chart configurations and KPI data
 * - Track token usage for cost optimization
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_analysis_cache",
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_cache_key", columnNames = {"factory_id", "cache_key"})
       },
       indexes = {
           @Index(name = "idx_factory_type", columnList = "factory_id, analysis_type"),
           @Index(name = "idx_expires_at", columnList = "expires_at")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiAnalysisCache extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Factory ID
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /**
     * Analysis type: DASHBOARD, SALES, DEPARTMENT, REGION, FINANCE
     */
    @Column(name = "analysis_type", nullable = false, length = 50)
    private String analysisType;

    /**
     * Unique cache key (hash of params)
     */
    @Column(name = "cache_key", nullable = false, length = 255)
    private String cacheKey;

    /**
     * Analysis date
     */
    @Column(name = "analysis_date", nullable = false)
    private LocalDate analysisDate;

    /**
     * Chart configuration and data JSON
     * Structure: { "type": "bar", "data": {...}, "options": {...} }
     */
    @Column(name = "chart_data", columnDefinition = "JSON")
    private String chartData;

    /**
     * KPI metrics JSON
     * Structure: { "totalSales": 1000000, "growth": 0.15, ... }
     */
    @Column(name = "kpi_data", columnDefinition = "JSON")
    private String kpiData;

    /**
     * AI generated insights text
     */
    @Column(name = "ai_insights", columnDefinition = "TEXT")
    private String aiInsights;

    /**
     * Prompt template used for AI
     */
    @Column(name = "prompt_used", columnDefinition = "TEXT")
    private String promptUsed;

    /**
     * LLM tokens consumed
     */
    @Builder.Default
    @Column(name = "token_count")
    private Integer tokenCount = 0;

    /**
     * Cache expiration time
     */
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    /**
     * Check if cache has expired
     */
    @Transient
    public boolean isExpired() {
        return expiresAt != null && LocalDateTime.now().isAfter(expiresAt);
    }
}
