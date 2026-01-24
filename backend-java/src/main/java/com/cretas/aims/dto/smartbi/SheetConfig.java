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

    /**
     * 是否自动确认字段映射（跳过用户确认步骤）
     * 设为 true 时，即使字段映射置信度不高也会直接保存数据
     */
    @Builder.Default
    private Boolean autoConfirm = false;

    /**
     * 是否转置数据（将列数据转换为行数据）
     *
     * 用于处理财务报表等「列方向」数据结构，例如利润表：
     * 原始格式（列方向）：
     * |          | 2025年1月 | 2025年2月 |
     * | 营业收入 |   100     |   110     |
     * | 营业成本 |    60     |    65     |
     *
     * 转置后（行方向）：
     * | 月份    | 项目     | 金额 |
     * | 2025-01 | 营业收入 | 100  |
     * | 2025-01 | 营业成本 |  60  |
     * | 2025-02 | 营业收入 | 110  |
     * | 2025-02 | 营业成本 |  65  |
     */
    @Builder.Default
    private Boolean transpose = false;

    /**
     * 转置时的行标签列索引（默认为 0，即第一列为项目名称）
     */
    @Builder.Default
    private Integer rowLabelColumn = 0;

    /**
     * 转置时的表头行数（默认为 1）
     * 例如：有两行表头时设为 2，如：
     * |          | 2025年1月      | 2025年2月      |
     * |          | 预算   | 实际  | 预算   | 实际  |
     */
    @Builder.Default
    private Integer headerRowCount = 1;
}
