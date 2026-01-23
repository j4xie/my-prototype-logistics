package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Sheet 处理配置 DTO
 *
 * 用于指定单个 Sheet 的解析配置。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SheetConfig {

    /**
     * Sheet 索引（从 0 开始）
     */
    private Integer sheetIndex;

    /**
     * 表头所在行索引（从 0 开始，默认为 0）
     */
    @Builder.Default
    private Integer headerRow = 0;

    /**
     * 数据类型（可选，null 则自动检测）
     * 可选值：SALES, FINANCE, INVENTORY, PRODUCTION, QUALITY, PROCUREMENT
     */
    private String dataType;

    /**
     * 是否跳过空行
     */
    @Builder.Default
    private Boolean skipEmptyRows = true;

    /**
     * 采样行数（默认 100）
     */
    @Builder.Default
    private Integer sampleSize = 100;
}
