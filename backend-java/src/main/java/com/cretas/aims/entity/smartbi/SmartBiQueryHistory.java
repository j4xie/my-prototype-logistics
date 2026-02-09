package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;

/**
 * SmartBI Query History Entity - Natural language query history
 *
 * Purpose:
 * - Track conversation context
 * - Store user queries and AI responses
 * - Enable query learning and optimization
 * - Collect user feedback for model improvement
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_query_history",
       indexes = {
           @Index(name = "idx_factory_session", columnList = "factory_id, session_id"),
           @Index(name = "idx_intent", columnList = "intent"),
           @Index(name = "idx_created_at", columnList = "created_at")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiQueryHistory extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Factory ID
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /**
     * User who asked
     */
    @Column(name = "user_id")
    private Long userId;

    /**
     * Conversation session ID
     */
    @Column(name = "session_id", length = 100)
    private String sessionId;

    /**
     * User natural language query
     */
    @Column(name = "query_text", nullable = false, columnDefinition = "TEXT")
    private String queryText;

    /**
     * Detected intent
     */
    @Column(name = "intent", length = 100)
    private String intent;

    /**
     * Extracted parameters JSON
     * Structure: { "timeRange": "last_month", "department": "sales", ... }
     */
    @Column(name = "parameters", columnDefinition = "JSON")
    private String parameters;

    /**
     * Conversation context JSON
     * Structure: { "previousQueries": [...], "filters": {...} }
     */
    @Column(name = "context", columnDefinition = "JSON")
    private String context;

    /**
     * AI response text
     */
    @Column(name = "response_text", columnDefinition = "TEXT")
    private String responseText;

    /**
     * Generated chart config if any
     * Structure: { "type": "line", "data": {...}, "options": {...} }
     */
    @Column(name = "chart_config", columnDefinition = "JSON")
    private String chartConfig;

    /**
     * User feedback: 1-5 rating
     */
    @Column(name = "feedback_rating")
    private Integer feedbackRating;

    /**
     * User feedback text
     */
    @Column(name = "feedback_text", columnDefinition = "TEXT")
    private String feedbackText;

    /**
     * Check if user provided positive feedback
     */
    @Transient
    public boolean hasPositiveFeedback() {
        return feedbackRating != null && feedbackRating >= 4;
    }
}
