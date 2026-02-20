package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.DataFeatureResult;
import com.cretas.aims.dto.smartbi.ExcelParseRequest;
import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import com.cretas.aims.dto.smartbi.SheetInfo;

import java.io.InputStream;
import java.util.List;
import java.util.Optional;

/**
 * Excel 动态解析服务接口
 *
 * 提供动态解析任意格式 Excel 文件的能力，包括：
 * - 表头读取（支持自定义表头行索引）
 * - 采样数据提取
 * - 数据类型自动检测（日期、数值、分类、ID）
 * - 字段自动映射（同义词匹配）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 * @see docs/architecture/smart-bi-ai-analysis-spec.md Section 4
 */
public interface ExcelDynamicParserService {

    /**
     * 解析 Excel 文件并返回完整的解析结果
     *
     * 处理流程：
     * 1. 读取表头行
     * 2. 提取采样数据（默认100行）
     * 3. 分析每列的数据特征
     * 4. 映射列名到标准字段
     * 5. 检查必填字段
     *
     * @param inputStream Excel 文件输入流
     * @param request     解析请求参数
     * @return 解析响应结果
     */
    ExcelParseResponse parseExcel(InputStream inputStream, ExcelParseRequest request);

    /**
     * 分析单列的数据特征
     *
     * 根据列数据自动检测：
     * - 日期类型：尝试多种格式解析，成功率>90%判定为日期
     * - 数值类型：数值占比>95%，进一步判断子类型（金额、百分比、数量）
     * - 分类类型：唯一值<20%总行数 且 唯一值<50
     * - ID类型：唯一值≈总行数 或 字段名含"ID/编号/工号"
     *
     * @param columnName 列名
     * @param values     该列的值列表
     * @return 数据特征分析结果
     */
    DataFeatureResult analyzeColumn(String columnName, List<Object> values);

    /**
     * 检测日期格式
     *
     * 支持的格式：
     * - yyyy-MM-dd
     * - yyyy/MM/dd
     * - yyyyMMdd
     * - MM/dd/yyyy
     *
     * @param values 值列表
     * @return 检测到的日期格式，成功率>90%时返回格式字符串
     */
    Optional<String> detectDateFormat(List<Object> values);

    /**
     * 检测数值列的子类型
     *
     * 子类型判断规则：
     * - AMOUNT：包含¥/$符号，或字段名含"金额/成本/收入"
     * - PERCENTAGE：值在0-100或0-1之间，或字段名含"率"
     * - QUANTITY：整数为主，字段名含"数量/件数"
     * - GENERAL：普通数值
     *
     * @param columnName 列名（用于辅助判断）
     * @param values     数值列表
     * @return 数值子类型
     */
    DataFeatureResult.NumericSubType detectNumericSubType(String columnName, List<Object> values);

    /**
     * 将表头列名映射到标准字段
     *
     * 映射策略优先级：
     * 1. 精确匹配同义词表
     * 2. 同义词匹配
     * 3. 根据数据特征推断
     *
     * 当置信度<70%时，设置 requiresConfirmation=true
     *
     * @param headers  表头列名列表
     * @param features 各列的数据特征列表
     * @return 字段映射结果列表
     */
    List<FieldMappingResult> mapFields(List<String> headers, List<DataFeatureResult> features);

    /**
     * 获取表头列表
     *
     * @param inputStream   Excel 文件输入流
     * @param sheetIndex    Sheet 索引
     * @param headerRowIndex 表头所在行索引
     * @return 表头列名列表
     */
    List<String> getHeaders(InputStream inputStream, int sheetIndex, int headerRowIndex);

    /**
     * 读取采样数据
     *
     * @param inputStream    Excel 文件输入流
     * @param sheetIndex     Sheet 索引
     * @param headerRowIndex 表头所在行索引
     * @param sampleRowCount 采样行数
     * @param skipEmptyRows  是否跳过空行
     * @return 采样数据列表，每行为一个 Map（key为列名，value为单元格值）
     */
    List<java.util.Map<String, Object>> getSampleData(
            InputStream inputStream,
            int sheetIndex,
            int headerRowIndex,
            int sampleRowCount,
            boolean skipEmptyRows
    );

    /**
     * 获取 Excel 文件中所有 Sheet 的基本信息
     *
     * 用于批量处理前的预览，让用户选择需要处理的 Sheet。
     *
     * @param inputStream Excel 文件输入流
     * @return Sheet 信息列表
     */
    List<SheetInfo> listSheets(InputStream inputStream);
}
