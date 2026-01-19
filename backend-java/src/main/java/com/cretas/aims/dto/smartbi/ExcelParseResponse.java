package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Excel 解析响应 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExcelParseResponse {

    /**
     * 是否解析成功
     */
    private boolean success;

    /**
     * 错误信息（解析失败时）
     */
    private String errorMessage;

    /**
     * 上传 ID
     */
    private Long uploadId;

    /**
     * 表头列表（原始列名）
     */
    private List<String> headers;

    /**
     * 行数
     */
    private Integer rowCount;

    /**
     * 列数
     */
    private Integer columnCount;

    /**
     * 字段映射结果列表
     */
    private List<FieldMappingResult> fieldMappings;

    /**
     * 数据特征结果列表
     */
    private List<DataFeatureResult> dataFeatures;

    /**
     * 预览数据（采样数据）
     */
    private List<Map<String, Object>> previewData;

    /**
     * 必需字段缺失列表
     */
    private List<String> missingRequiredFields;

    /**
     * 解析状态
     */
    private String status;

    /**
     * 解析元信息
     */
    private ParseMetadata metadata;

    /**
     * 解析元信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ParseMetadata {
        /**
         * Sheet名称
         */
        private String sheetName;

        /**
         * 原始列数
         */
        private Integer originalColumnCount;

        /**
         * 采样行数
         */
        private Integer sampledRowCount;

        /**
         * 解析耗时（毫秒）
         */
        private Long parseTimeMs;
    }
}
