package com.cretas.aims.entity.smartbi.enums;

/**
 * Field data type enumeration for SmartBI field definitions
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public enum FieldType {
    /**
     * String/text type
     */
    STRING,

    /**
     * Integer number
     */
    INTEGER,

    /**
     * Decimal number
     */
    DECIMAL,

    /**
     * Date type (without time)
     */
    DATE,

    /**
     * DateTime type (with time)
     */
    DATETIME,

    /**
     * Boolean type
     */
    BOOLEAN,

    /**
     * JSON object type
     */
    JSON,

    /**
     * Array/list type
     */
    ARRAY
}
