package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.smartbi.enums.ActionType;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.math.BigDecimal;

/**
 * SmartBI Usage Record Entity - Usage tracking for billing
 *
 * Tracks:
 * - All user actions (upload, query, drilldown, export)
 * - Token consumption
 * - Cost calculation
 * - Cache hit ratio
 * - Response performance
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_usage_records",
       indexes = {
           @Index(name = "idx_factory_date", columnList = "factory_id, created_at"),
           @Index(name = "idx_action_type", columnList = "action_type"),
           @Index(name = "idx_created_at", columnList = "created_at")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiUsageRecord extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Factory ID
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /**
     * User who triggered the action
     */
    @Column(name = "user_id")
    private Long userId;

    /**
     * Action type
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 20)
    private ActionType actionType;

    /**
     * Analysis type if applicable
     */
    @Column(name = "analysis_type", length = 50)
    private String analysisType;

    /**
     * Natural language query if QUERY type
     */
    @Column(name = "query_text", columnDefinition = "TEXT")
    private String queryText;

    /**
     * Detected intent for query
     */
    @Column(name = "intent_detected", length = 100)
    private String intentDetected;

    /**
     * LLM tokens consumed
     */
    @Builder.Default
    @Column(name = "token_count")
    private Integer tokenCount = 0;

    /**
     * Cost in CNY
     */
    @Builder.Default
    @Column(name = "cost_amount", precision = 10, scale = 4)
    private BigDecimal costAmount = BigDecimal.ZERO;

    /**
     * Whether cache was used
     */
    @Builder.Default
    @Column(name = "cache_hit")
    private Boolean cacheHit = false;

    /**
     * Response time in milliseconds
     */
    @Column(name = "response_time_ms")
    private Integer responseTimeMs;

    /**
     * Whether action succeeded
     */
    @Builder.Default
    @Column(name = "success")
    private Boolean success = true;

    /**
     * Error message if failed
     */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
}
