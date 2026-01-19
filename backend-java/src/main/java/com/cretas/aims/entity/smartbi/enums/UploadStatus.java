package com.cretas.aims.entity.smartbi.enums;

/**
 * Excel upload processing status
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public enum UploadStatus {
    /**
     * File uploaded, waiting to be parsed
     */
    PENDING,

    /**
     * File is being parsed
     */
    PARSING,

    /**
     * Fields have been mapped
     */
    MAPPED,

    /**
     * Processing completed successfully
     */
    COMPLETED,

    /**
     * Processing failed
     */
    FAILED
}
