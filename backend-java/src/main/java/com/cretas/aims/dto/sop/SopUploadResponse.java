package com.cretas.aims.dto.sop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * SOP 上传响应 DTO
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
     * 文件类型
     */
    private String fileType;

    /**
     * 解析状态 (PENDING, PROCESSING, COMPLETED, FAILED)
     */
    private String parseStatus;

    /**
     * 分析结果
     */
    private SopAnalysisResult analysisResult;
}
