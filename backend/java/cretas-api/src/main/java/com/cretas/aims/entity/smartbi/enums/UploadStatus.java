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
    FAILED,

    /**
     * Retrying a previously failed upload
     */
    RETRYING,

    /**
     * File is being parsed/processing (DB 实际存在, Apr 22 enum drift 补回).
     * 与 PARSING 语义近似 — 历史 Python 侧也写 PROCESSING, 不合并以免破坏既有记录.
     */
    PROCESSING,

    /**
     * Upload archived (不再活跃, 从 Get upload history 默认列表排除).
     * Apr 22 2026 enum drift: DB 有 ARCHIVED 值但 Java enum 缺, 导致
     * findAll 反序列化时抛 IllegalArgumentException → history 列表整体 500.
     */
    ARCHIVED
}
