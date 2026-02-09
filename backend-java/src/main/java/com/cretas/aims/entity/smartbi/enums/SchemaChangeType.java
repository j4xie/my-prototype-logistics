package com.cretas.aims.entity.smartbi.enums;

/**
 * Schema change type enumeration for SmartBI schema history
 * Tracks different types of schema modifications
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public enum SchemaChangeType {
    /**
     * Initial schema creation
     */
    CREATED,

    /**
     * Field added to schema
     */
    FIELD_ADDED,

    /**
     * Field removed from schema
     */
    FIELD_REMOVED,

    /**
     * Field type changed
     */
    FIELD_TYPE_CHANGED,

    /**
     * Field renamed
     */
    FIELD_RENAMED,

    /**
     * Schema migrated/upgraded
     */
    MIGRATED,

    /**
     * Schema rollback
     */
    ROLLBACK,

    /**
     * Field definition updated (alias, description, metric type, etc.)
     */
    FIELD_UPDATE,

    /**
     * Batch schema update from Excel re-upload
     */
    BATCH_UPDATE
}
