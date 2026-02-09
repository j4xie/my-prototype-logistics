package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 数据特征分析结果 DTO
 * 用于描述 Excel 列的统计特征
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataFeatureResult {

    /**
     * 列名
     */
    private String columnName;

    /**
     * 列索引（从0开始）
     */
    private Integer columnIndex;

    /**
     * 数据类型
     * DATE - 日期类型
     * NUMERIC - 数值类型
     * CATEGORICAL - 分类类型
     * ID - 唯一标识类型
     * TEXT - 普通文本类型
     */
    private DataType dataType;

    /**
     * 数值子类型（仅当dataType为NUMERIC时有效）
     * AMOUNT - 金额（包含货币符号或字段名含"金额/成本/收入"）
     * PERCENTAGE - 百分比（0-100或0-1，或字段名含"率"）
     * QUANTITY - 数量（整数为主，字段名含"数量/件数"）
     * GENERAL - 普通数值
     */
    private NumericSubType numericSubType;

    /**
     * 样本值（取前5个非空值）
     */
    private List<String> sampleValues;

    /**
     * 唯一值数量
     */
    private Integer uniqueCount;

    /**
     * 非空值数量
     */
    private Integer nonNullCount;

    /**
     * 空值数量
     */
    private Integer nullCount;

    /**
     * 最小值 (数值类型)
     */
    private Object minValue;

    /**
     * 最大值 (数值类型)
     */
    private Object maxValue;

    /**
     * 日期格式 (仅当dataType为DATE时有效)
     */
    private String dateFormat;

    /**
     * 唯一值列表（仅当dataType为CATEGORICAL时有效，最多50个）
     */
    private List<String> uniqueValues;

    /**
     * 检测置信度（0-100）
     */
    private Double confidence;

    /**
     * 数据类型枚举
     */
    public enum DataType {
        DATE,
        NUMERIC,
        CATEGORICAL,
        ID,
        TEXT
    }

    /**
     * 数值子类型枚举
     */
    public enum NumericSubType {
        AMOUNT,
        PERCENTAGE,
        QUANTITY,
        GENERAL
    }
}
