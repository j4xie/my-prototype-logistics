package com.cretas.aims.dto.sop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * SOP 上传响应 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SopUploadResponse {

    /**
     * SOP 配置ID
     */
    private String sopId;

    /**
     * 文件名
     */
    private String fileName;

    /**
     * 文件URL
     */
    private String fileUrl;

    /**
     * 文件类型 (PDF, EXCEL, IMAGE)
     */
    private String fileType;

    /**
     * 原始文件名
     */
    private String originalFileName;

    /**
     * 关联的 SKU 编码
     */
    private String skuCode;

    /**
     * 产品类型ID
     */
    private String productTypeId;

    /**
     * 解析状态 (PENDING, PROCESSING, COMPLETED, FAILED)
     */
    private String parseStatus;

    /**
     * 是否已触发自动分析
     */
    private Boolean autoAnalyzeTriggered;

    /**
     * 分析结果（兼容旧格式）
     */
    private SopAnalysisResult analysisResult;

    /**
     * 分析结果（Map 格式，用于灵活数据）
     */
    private Map<String, Object> analysisResultMap;

    /**
     * 上传时间
     */
    private LocalDateTime uploadedAt;

    /**
     * 上传者用户ID
     */
    private Long uploadedBy;
}
