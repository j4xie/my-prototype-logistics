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
     * 采样数量 (0 = no limit, use Python max_rows)
     */
    @Builder.Default
    private Integer sampleSize = 0;

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

    /**
     * 最大表头行数 (用于多层表头检测，默认为 3)
     * 当检测到合并单元格或多层表头时，会扫描前 N 行进行智能合并
     */
    @Builder.Default
    private Integer maxHeaderRows = 3;

    /**
     * 是否自动检测多层表头
     * 启用后会使用 Apache POI 检测合并单元格并智能合并表头
     * 默认为 true
     */
    @Builder.Default
    private Boolean autoDetectMultiHeader = true;

    /**
     * 是否转置数据（将列数据转换为行数据）
     *
     * 用于处理财务报表等「列方向」数据结构，例如：
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
     *
     * 值说明：
     * - null: 未指定，将根据 autoDetectOrientation 自动检测
     * - true: 强制转置
     * - false: 强制不转置
     */
    private Boolean transpose;

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

    /**
     * 是否自动检测数据方向（默认为 true）
     *
     * 当 transpose 参数未指定（null）且 autoDetectOrientation=true 时，
     * 系统会自动分析数据结构来判断是否需要转置：
     *
     * - 列方向数据特征（需要转置）：
     *   1. 第一列是文本标签（项目名），后续列是数值
     *   2. 表头包含时间信息（2025年1月、Q1、Jan等）
     *   3. 数值列数 > 数据行数（宽表）
     *   4. 第一行有日期格式的列名
     *
     * - 行方向数据特征（不需要转置）：
     *   1. 每行是一条完整记录
     *   2. 有日期列作为数据列（不是表头）
     *   3. 数据行数 > 数值列数（长表）
     */
    @Builder.Default
    private Boolean autoDetectOrientation = true;
}
