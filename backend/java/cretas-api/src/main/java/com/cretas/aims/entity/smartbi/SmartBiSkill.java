package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;

/**
 * SmartBI Skill Entity - Defines AI skill capabilities for SmartBI
 *
 * Skills represent specific capabilities that the AI can execute:
 * - Each skill has triggers (phrases/intents that activate it)
 * - Tools define what actions the skill can perform
 * - Context specifies what data the skill needs
 * - Prompt template guides the AI response generation
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_skill",
       indexes = {
           @Index(name = "idx_skill_name", columnList = "name"),
           @Index(name = "idx_skill_enabled", columnList = "enabled"),
           @Index(name = "idx_skill_version", columnList = "version")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_skill_name", columnNames = {"name"})
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiSkill extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Unique skill identifier
     * Example: "sales_trend_analysis", "inventory_alert"
     */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /**
     * Human-readable display name
     * Example: "Sales Trend Analysis", "Inventory Alert"
     */
    @Column(name = "display_name", nullable = false, length = 200)
    private String displayName;

    /**
     * Detailed description of what this skill does
     */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * Skill version for tracking updates
     */
    @Builder.Default
    @Column(name = "version", nullable = false, length = 20)
    private String version = "1.0.0";

    /**
     * Trigger phrases/patterns that activate this skill (JSON array)
     * Example: ["show sales trend", "how are sales doing", "sales performance"]
     */
    @Column(name = "triggers", columnDefinition = "JSON")
    private String triggers;

    /**
     * Tools this skill can use (JSON array)
     * Example: ["query_database", "generate_chart", "calculate_metrics"]
     */
    @Column(name = "tools", columnDefinition = "JSON")
    private String tools;

    /**
     * Context data needed for this skill (JSON array)
     * Example: ["timeRange", "productCategory", "region"]
     */
    @Column(name = "context_needed", columnDefinition = "JSON")
    private String contextNeeded;

    /**
     * Prompt template for AI response generation
     * Can include placeholders: {{data}}, {{context}}, {{userQuery}}
     */
    @Column(name = "prompt_template", columnDefinition = "TEXT")
    private String promptTemplate;

    /**
     * Additional configuration (JSON object)
     * Structure: {
     *   "maxTokens": 500,
     *   "temperature": 0.7,
     *   "responseFormat": "markdown",
     *   "includeChart": true,
     *   "cacheTimeout": 3600
     * }
     */
    @Column(name = "config", columnDefinition = "JSON")
    private String config;

    /**
     * Whether this skill is enabled
     */
    @Builder.Default
    @Column(name = "enabled", nullable = false)
    private Boolean enabled = true;

    /**
     * Priority order (lower = higher priority)
     */
    @Builder.Default
    @Column(name = "priority")
    private Integer priority = 100;

    /**
     * Category for grouping skills
     * Example: "analytics", "alerting", "reporting"
     */
    @Column(name = "category", length = 50)
    private String category;

    /**
     * Required permission to use this skill
     */
    @Column(name = "required_permission", length = 100)
    private String requiredPermission;
}
