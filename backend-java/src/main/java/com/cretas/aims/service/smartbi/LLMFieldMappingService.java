package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.FieldMappingWithChartRole;

import java.util.List;
import java.util.Map;

/**
 * LLM 字段映射服务接口
 *
 * 使用 LLM 理解未知字段并自动映射到标准字段，同时分析字段在图表中的角色
 * 支持自动学习并保存映射结果到字典数据库
 *
 * 主要功能：
 * 1. 使用 LLM 理解字段语义并映射到标准字段
 * 2. 分析字段在图表中的角色（X_AXIS/SERIES/Y_AXIS）
 * 3. 根据数据特征推荐聚合方式
 * 4. 自动保存映射结果到字典数据库
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 * @see FieldMappingWithChartRole
 */
public interface LLMFieldMappingService {

    /**
     * 分析单个字段并返回完整的映射信息（含图表角色）
     *
     * 输入信息包括：
     * - 列名
     * - 数据类型
     * - 样本值（用于理解字段含义）
     * - 唯一值数量（用于判断是否适合作为系列）
     *
     * @param columnName       列名
     * @param dataType         检测到的数据类型 (NUMBER/STRING/DATE/BOOLEAN)
     * @param sampleValues     样本值列表（通常取前5-10个不同的值）
     * @param uniqueValueCount 唯一值数量
     * @return 字段映射结果（含图表角色）
     */
    FieldMappingWithChartRole analyzeField(String columnName, String dataType,
                                            List<Object> sampleValues, int uniqueValueCount);

    /**
     * 批量分析多个字段并返回映射结果列表
     *
     * LLM 会综合考虑所有字段的关系，提供更准确的映射：
     * - 识别时间字段优先作为 X 轴
     * - 识别少量唯一值的分类字段作为系列
     * - 识别数值字段作为 Y 轴
     *
     * @param fieldInfoList 字段信息列表，每个元素包含:
     *                      - columnName: 列名
     *                      - dataType: 数据类型
     *                      - sampleValues: 样本值列表
     *                      - uniqueValueCount: 唯一值数量
     * @return 字段映射结果列表
     */
    List<FieldMappingWithChartRole> analyzeFields(List<FieldInfo> fieldInfoList);

    /**
     * 分析字段并自动保存映射结果到字典数据库
     *
     * 当 LLM 成功推断出高置信度的映射时，自动保存到数据库，
     * 下次遇到相同列名时可直接使用，无需再次调用 LLM
     *
     * @param columnName       列名
     * @param dataType         数据类型
     * @param sampleValues     样本值列表
     * @param uniqueValueCount 唯一值数量
     * @param factoryId        工厂ID（null 表示全局映射）
     * @return 字段映射结果
     */
    FieldMappingWithChartRole analyzeAndSave(String columnName, String dataType,
                                              List<Object> sampleValues, int uniqueValueCount,
                                              String factoryId);

    /**
     * 批量分析并保存映射结果
     *
     * @param fieldInfoList 字段信息列表
     * @param factoryId     工厂ID（null 表示全局映射）
     * @return 字段映射结果列表
     */
    List<FieldMappingWithChartRole> analyzeAndSaveAll(List<FieldInfo> fieldInfoList, String factoryId);

    /**
     * 为自动图表生成推荐字段配置
     *
     * 根据分析结果，推荐最佳的图表字段配置：
     * - 选择最合适的 X 轴字段（优先时间）
     * - 选择最合适的系列字段（2-10个唯一值的分类）
     * - 选择最合适的 Y 轴字段（数值类型）
     *
     * @param mappings 字段映射结果列表
     * @return 推荐配置 Map:
     *         - xAxisField: 推荐的 X 轴字段
     *         - seriesField: 推荐的系列字段（可能为 null）
     *         - yAxisFields: 推荐的 Y 轴字段列表
     *         - chartType: 推荐的图表类型
     */
    Map<String, Object> recommendChartConfig(List<FieldMappingWithChartRole> mappings);

    /**
     * 检查 LLM 服务是否可用
     *
     * @return true 如果 LLM 服务可用
     */
    boolean isAvailable();

    /**
     * 保存用户确认的字段映射到字典数据库
     *
     * 当用户手动确认字段映射后，将其保存到数据库，
     * 下次遇到相同列名时可直接使用，无需再次调用 LLM
     *
     * @param factoryId     工厂ID（null 表示全局映射）
     * @param standardField 标准字段名
     * @param originalColumn 原始列名
     * @param source        来源标识（如 "USER", "AI", "SYSTEM"）
     */
    void saveUserMapping(String factoryId, String standardField, String originalColumn, String source);

    /**
     * 字段信息封装类
     */
    class FieldInfo {
        private String columnName;
        private String dataType;
        private List<Object> sampleValues;
        private int uniqueValueCount;

        public FieldInfo() {}

        public FieldInfo(String columnName, String dataType, List<Object> sampleValues, int uniqueValueCount) {
            this.columnName = columnName;
            this.dataType = dataType;
            this.sampleValues = sampleValues;
            this.uniqueValueCount = uniqueValueCount;
        }

        public String getColumnName() {
            return columnName;
        }

        public void setColumnName(String columnName) {
            this.columnName = columnName;
        }

        public String getDataType() {
            return dataType;
        }

        public void setDataType(String dataType) {
            this.dataType = dataType;
        }

        public List<Object> getSampleValues() {
            return sampleValues;
        }

        public void setSampleValues(List<Object> sampleValues) {
            this.sampleValues = sampleValues;
        }

        public int getUniqueValueCount() {
            return uniqueValueCount;
        }

        public void setUniqueValueCount(int uniqueValueCount) {
            this.uniqueValueCount = uniqueValueCount;
        }

        /**
         * 便捷构造方法
         */
        public static FieldInfo of(String columnName, String dataType,
                                    List<Object> sampleValues, int uniqueValueCount) {
            return new FieldInfo(columnName, dataType, sampleValues, uniqueValueCount);
        }
    }
}
