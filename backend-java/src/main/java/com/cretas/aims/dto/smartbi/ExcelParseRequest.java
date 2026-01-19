package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Excel 解析请求 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExcelParseRequest {

    /**
     * 工厂 ID
     */
    private String factoryId;

    /**
     * 文件名
     */
    private String fileName;

    /**
     * Sheet 索引 (默认为 0)
     */
    @Builder.Default
    private Integer sheetIndex = 0;

    /**
     * 表头行索引 (默认为 0)
     */
    @Builder.Default
    private Integer headerRow = 0;

    /**
     * 采样数量 (默认为 100)
     */
    @Builder.Default
    private Integer sampleSize = 100;

    /**
     * 是否跳过空行
     */
    @Builder.Default
    private Boolean skipEmptyRows = true;

    /**
     * 业务场景，用于辅助字段映射
     * 可选值：SALES, FINANCE, AR_AP, BUDGET, ORG
     */
    private String businessScene;
}
