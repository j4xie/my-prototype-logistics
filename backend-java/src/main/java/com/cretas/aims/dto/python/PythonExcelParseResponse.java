package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python Excel 解析响应 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonExcelParseResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 错误消息 (失败时)
     */
    private String message;

    /**
     * 解析的 Sheet 列表
     */
    private List<SheetData> sheets;

    /**
     * 总行数
     */
    private Integer totalRows;

    /**
     * 总列数
     */
    private Integer totalColumns;

    /**
     * 检测到的数据类型
     */
    private String detectedDataType;

    /**
     * 处理时间 (毫秒)
     */
    private Long processingTimeMs;

    /**
     * Sheet 数据
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SheetData {

        /**
         * Sheet 名称
         */
        private String sheetName;

        /**
         * Sheet 索引
         */
        private Integer sheetIndex;

        /**
         * 表头列表
         */
        private List<String> headers;

        /**
         * 数据行列表 (每行是一个 Map，key 为列名)
         */
        private List<Map<String, Object>> rows;

        /**
         * 行数
         */
        private Integer rowCount;

        /**
         * 列数
         */
        private Integer columnCount;

        /**
         * 检测到的字段信息
         */
        private List<FieldInfo> fields;
    }

    /**
     * 字段信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FieldInfo {

        /**
         * 字段名称 (列名)
         */
        private String name;

        /**
         * 检测到的数据类型 (string, number, date, boolean)
         */
        private String dataType;

        /**
         * 非空值数量
         */
        private Integer nonNullCount;

        /**
         * 唯一值数量
         */
        private Integer uniqueCount;

        /**
         * 样本值
         */
        private List<Object> sampleValues;

        /**
         * 最小值 (数值类型)
         */
        private Object minValue;

        /**
         * 最大值 (数值类型)
         */
        private Object maxValue;

        /**
         * 平均值 (数值类型)
         */
        private Double avgValue;
    }
}
