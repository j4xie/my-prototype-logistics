package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import com.cretas.aims.entity.smartbi.enums.SchemaChangeType;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;

/**
 * SmartBI Schema History Entity - Tracks schema changes for datasources
 *
 * Provides audit trail for:
 * - Schema modifications (field adds/removes/changes)
 * - DDL statements executed
 * - Version history for rollback support
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Entity
@Table(name = "smart_bi_schema_history",
       indexes = {
           @Index(name = "idx_schema_datasource", columnList = "datasource_id"),
           @Index(name = "idx_schema_change_type", columnList = "change_type"),
           @Index(name = "idx_schema_created_at", columnList = "created_at")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiSchemaHistory extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Reference to the datasource
     */
    @Column(name = "datasource_id", nullable = false)
    private Long datasourceId;

    /**
     * Type of schema change
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "change_type", nullable = false, length = 30)
    private SchemaChangeType changeType;

    /**
     * Schema version before this change
     */
    @Column(name = "version_before")
    private Integer versionBefore;

    /**
     * Schema version after this change
     */
    @Column(name = "version_after")
    private Integer versionAfter;

    /**
     * Previous schema definition (JSON)
     * Structure: { "fields": [...], "config": {...} }
     */
    @Column(name = "old_schema", columnDefinition = "JSON")
    private String oldSchema;

    /**
     * New schema definition (JSON)
     * Structure: { "fields": [...], "config": {...} }
     */
    @Column(name = "new_schema", columnDefinition = "JSON")
    private String newSchema;

    /**
     * DDL statement that was executed (if applicable)
     * Example: "ALTER TABLE ... ADD COLUMN ..."
     */
    @Column(name = "ddl_executed", columnDefinition = "TEXT")
    private String ddlExecuted;

    /**
     * User who made the change
     */
    @Column(name = "created_by", length = 100)
    private String createdBy;

    /**
     * Change description/reason
     */
    @Column(name = "change_description", length = 500)
    private String changeDescription;

    /**
     * Whether this change can be rolled back
     */
    @Builder.Default
    @Column(name = "is_reversible", nullable = false)
    private Boolean isReversible = true;

    /**
     * Whether this change has been applied successfully
     */
    @Builder.Default
    @Column(name = "is_applied", nullable = false)
    private Boolean isApplied = true;

    /**
     * Error message if change failed
     */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
}
