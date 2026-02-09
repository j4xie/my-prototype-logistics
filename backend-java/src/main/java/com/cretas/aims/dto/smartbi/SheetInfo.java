package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Excel Sheet 信息 DTO
 *
 * 用于返回 Excel 文件中所有 Sheet 的基本信息，
 * 支持用户预览和选择需要处理的 Sheet。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SheetInfo {

    /**
     * Sheet 索引（从 0 开始）
     */
    private Integer index;

    /**
     * Sheet 名称
     */
    private String name;

    /**
     * 数据行数（物理行数）
     */
    private Integer rowCount;

    /**
     * 列数（最大列数）
     */
    private Integer columnCount;

    /**
     * 是否为空 Sheet
     */
    @Builder.Default
    private Boolean empty = false;

    /**
     * 预览的表头列表（前几列）
     */
    private java.util.List<String> previewHeaders;

    /**
     * 检测到的表头行数（从 Python auto-parse 获取）
     * 用于多行表头的处理
     */
    private Integer headerRowCount;

    /**
     * 数据起始行（从 0 开始，从 Python auto-parse 获取）
     * 例如：headerRowCount=3 意味着 dataStartRow=3
     */
    private Integer dataStartRow;

    /**
     * 表格类型（index/data/summary/metadata，从 Python auto-parse 获取）
     */
    private String tableType;

    /**
     * 是否为索引页（目录页）
     */
    @Builder.Default
    private Boolean isIndex = false;
}
