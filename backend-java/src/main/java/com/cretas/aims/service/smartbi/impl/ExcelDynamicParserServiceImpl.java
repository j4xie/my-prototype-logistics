package com.cretas.aims.service.smartbi.impl;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.context.AnalysisContext;
import com.alibaba.excel.event.AnalysisEventListener;
import com.alibaba.excel.read.metadata.ReadSheet;
import com.cretas.aims.config.smartbi.FieldMappingDictionary;
import com.cretas.aims.dto.smartbi.DataFeatureResult;
import com.cretas.aims.dto.smartbi.DataFeatureResult.DataType;
import com.cretas.aims.dto.smartbi.DataFeatureResult.NumericSubType;
import com.cretas.aims.dto.smartbi.ExcelParseRequest;
import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import com.cretas.aims.dto.smartbi.FieldMappingResult.MappingSource;
import com.cretas.aims.service.smartbi.ExcelDynamicParserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Excel 动态解析服务实现
 *
 * 使用 EasyExcel 实现动态 Excel 解析，支持：
 * - 动态读取任意格式的 Excel 文件
 * - 自动检测数据类型（日期、数值、分类、ID）
 * - 同义词映射到标准字段
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 * @see docs/architecture/smart-bi-ai-analysis-spec.md Section 4
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExcelDynamicParserServiceImpl implements ExcelDynamicParserService {

    private final FieldMappingDictionary fieldMappingDictionary;

    // ==================== 日期格式定义 ====================

    /**
     * 支持的日期格式列表
     */
    private static final List<DateTimeFormatter> DATE_FORMATTERS = Arrays.asList(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("yyyyMMdd"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("yyyy-M-d"),
            DateTimeFormatter.ofPattern("yyyy/M/d"),
            DateTimeFormatter.ofPattern("M/d/yyyy")
    );

    private static final List<String> DATE_FORMAT_PATTERNS = Arrays.asList(
            "yyyy-MM-dd",
            "yyyy/MM/dd",
            "yyyyMMdd",
            "MM/dd/yyyy"
    );

    // ==================== 数值识别正则表达式 ====================

    /**
     * 数值正则（含货币符号）
     */
    private static final Pattern NUMERIC_PATTERN = Pattern.compile(
            "^[¥$€£]?\\s*-?[\\d,]+\\.?\\d*[%]?$"
    );

    /**
     * 金额关键词
     */
    private static final List<String> AMOUNT_KEYWORDS = Arrays.asList(
            "金额", "成本", "收入", "费用", "价格", "单价", "总价", "利润", "营收",
            "amount", "cost", "revenue", "price", "profit", "fee"
    );

    /**
     * 百分比关键词
     */
    private static final List<String> PERCENTAGE_KEYWORDS = Arrays.asList(
            "率", "比例", "占比", "百分比",
            "rate", "ratio", "percentage", "percent"
    );

    /**
     * 数量关键词
     */
    private static final List<String> QUANTITY_KEYWORDS = Arrays.asList(
            "数量", "件数", "个数", "人数", "次数", "天数",
            "count", "quantity", "qty", "number"
    );

    /**
     * ID关键词
     */
    private static final List<String> ID_KEYWORDS = Arrays.asList(
            "id", "编号", "工号", "编码", "代码", "号码",
            "code", "no", "number"
    );

    // ==================== 阈值常量 ====================

    private static final double DATE_DETECTION_THRESHOLD = 0.90;      // 日期检测成功率阈值
    private static final double NUMERIC_DETECTION_THRESHOLD = 0.95;   // 数值检测成功率阈值
    private static final double CATEGORICAL_UNIQUE_RATIO = 0.20;      // 分类列唯一值比例阈值
    private static final int CATEGORICAL_MAX_UNIQUE = 50;             // 分类列最大唯一值数量
    private static final double CONFIDENCE_THRESHOLD = 70.0;          // 置信度阈值
    private static final int MAX_SAMPLE_VALUES = 5;                   // 样本值最大数量
    private static final int MAX_UNIQUE_VALUES = 50;                  // 存储的唯一值最大数量

    // ==================== 主要接口实现 ====================

    @Override
    public ExcelParseResponse parseExcel(InputStream inputStream, ExcelParseRequest request) {
        long startTime = System.currentTimeMillis();
        log.info("开始解析Excel文件: fileName={}, sheetIndex={}, headerRow={}, sampleSize={}",
                request.getFileName(), request.getSheetIndex(), request.getHeaderRow(), request.getSampleSize());

        try {
            // 1. 使用动态监听器读取Excel
            DynamicExcelListener listener = new DynamicExcelListener(
                    request.getHeaderRow(),
                    request.getSampleSize(),
                    request.getSkipEmptyRows()
            );

            EasyExcel.read(inputStream, listener)
                    .sheet(request.getSheetIndex())
                    .headRowNumber(request.getHeaderRow())
                    .doRead();

            // 2. 获取解析结果
            List<String> headers = listener.getHeaders();
            List<Map<String, Object>> sampleData = listener.getSampleData();
            int totalRowCount = listener.getTotalRowCount();
            String sheetName = listener.getSheetName();

            log.info("Excel读取完成: headers={}, sampleRows={}, totalRows={}",
                    headers.size(), sampleData.size(), totalRowCount);

            // 3. 分析每列的数据特征
            List<DataFeatureResult> dataFeatures = new ArrayList<>();
            for (int i = 0; i < headers.size(); i++) {
                String header = headers.get(i);
                List<Object> columnValues = extractColumnValues(sampleData, header);
                DataFeatureResult feature = analyzeColumn(header, columnValues);
                feature.setColumnIndex(i);
                dataFeatures.add(feature);
            }

            // 4. 映射字段
            List<FieldMappingResult> fieldMappings = mapFields(headers, dataFeatures);

            // 5. 检查必填字段
            Set<String> mappedStandardFields = fieldMappings.stream()
                    .filter(m -> m.getStandardField() != null)
                    .map(FieldMappingResult::getStandardField)
                    .collect(Collectors.toSet());
            List<String> missingRequiredFields = fieldMappingDictionary.getMissingRequiredFields(mappedStandardFields);

            // 6. 构建响应
            long parseTimeMs = System.currentTimeMillis() - startTime;
            ExcelParseResponse response = ExcelParseResponse.builder()
                    .success(true)
                    .headers(headers)
                    .rowCount(totalRowCount)
                    .columnCount(headers.size())
                    .fieldMappings(fieldMappings)
                    .dataFeatures(dataFeatures)
                    .previewData(sampleData)
                    .missingRequiredFields(missingRequiredFields)
                    .status(missingRequiredFields.isEmpty() ? "COMPLETE" : "MISSING_FIELDS")
                    .metadata(ExcelParseResponse.ParseMetadata.builder()
                            .sheetName(sheetName)
                            .originalColumnCount(headers.size())
                            .sampledRowCount(sampleData.size())
                            .parseTimeMs(parseTimeMs)
                            .build())
                    .build();

            log.info("Excel解析完成: parseTimeMs={}, mappedFields={}, missingFields={}",
                    parseTimeMs, mappedStandardFields.size(), missingRequiredFields.size());

            return response;

        } catch (Exception e) {
            log.error("Excel解析失败: fileName={}, error={}", request.getFileName(), e.getMessage(), e);
            return ExcelParseResponse.builder()
                    .success(false)
                    .errorMessage("Excel解析失败: " + e.getMessage())
                    .status("ERROR")
                    .build();
        }
    }

    @Override
    public DataFeatureResult analyzeColumn(String columnName, List<Object> values) {
        log.debug("分析列数据特征: columnName={}, valueCount={}", columnName, values.size());

        // 统计基础数据
        int nullCount = 0;
        Set<String> uniqueValues = new LinkedHashSet<>();
        List<String> sampleValues = new ArrayList<>();

        for (Object value : values) {
            if (value == null || value.toString().trim().isEmpty()) {
                nullCount++;
            } else {
                String strValue = value.toString().trim();
                uniqueValues.add(strValue);
                if (sampleValues.size() < MAX_SAMPLE_VALUES) {
                    sampleValues.add(strValue);
                }
            }
        }

        int nonNullCount = values.size() - nullCount;
        int uniqueCount = uniqueValues.size();

        // 尝试检测日期格式
        Optional<String> dateFormat = detectDateFormat(values);
        if (dateFormat.isPresent()) {
            return DataFeatureResult.builder()
                    .columnName(columnName)
                    .dataType(DataType.DATE)
                    .dateFormat(dateFormat.get())
                    .nonNullCount(nonNullCount)
                    .nullCount(nullCount)
                    .uniqueCount(uniqueCount)
                    .sampleValues(sampleValues)
                    .confidence(95.0)
                    .build();
        }

        // 检测是否为数值列
        if (isNumericColumn(values)) {
            NumericSubType subType = detectNumericSubType(columnName, values);
            NumericStats stats = calculateNumericStats(values);

            return DataFeatureResult.builder()
                    .columnName(columnName)
                    .dataType(DataType.NUMERIC)
                    .numericSubType(subType)
                    .nonNullCount(nonNullCount)
                    .nullCount(nullCount)
                    .uniqueCount(uniqueCount)
                    .sampleValues(sampleValues)
                    .minValue(stats.min)
                    .maxValue(stats.max)
                    .confidence(90.0)
                    .build();
        }

        // 检测是否为ID列
        if (isIdColumn(columnName, values, uniqueCount, nonNullCount)) {
            return DataFeatureResult.builder()
                    .columnName(columnName)
                    .dataType(DataType.ID)
                    .nonNullCount(nonNullCount)
                    .nullCount(nullCount)
                    .uniqueCount(uniqueCount)
                    .sampleValues(sampleValues)
                    .confidence(85.0)
                    .build();
        }

        // 检测是否为分类列
        if (isCategoricalColumn(uniqueCount, nonNullCount)) {
            List<String> limitedUniqueValues = uniqueValues.stream()
                    .limit(MAX_UNIQUE_VALUES)
                    .collect(Collectors.toList());

            return DataFeatureResult.builder()
                    .columnName(columnName)
                    .dataType(DataType.CATEGORICAL)
                    .nonNullCount(nonNullCount)
                    .nullCount(nullCount)
                    .uniqueCount(uniqueCount)
                    .uniqueValues(limitedUniqueValues)
                    .sampleValues(sampleValues)
                    .confidence(80.0)
                    .build();
        }

        // 默认为文本类型
        return DataFeatureResult.builder()
                .columnName(columnName)
                .dataType(DataType.TEXT)
                .nonNullCount(nonNullCount)
                .nullCount(nullCount)
                .uniqueCount(uniqueCount)
                .sampleValues(sampleValues)
                .confidence(70.0)
                .build();
    }

    @Override
    public Optional<String> detectDateFormat(List<Object> values) {
        if (values == null || values.isEmpty()) {
            return Optional.empty();
        }

        // 过滤非空值
        List<String> nonNullValues = values.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());

        if (nonNullValues.isEmpty()) {
            return Optional.empty();
        }

        // 尝试每种日期格式
        for (int i = 0; i < DATE_FORMATTERS.size(); i++) {
            DateTimeFormatter formatter = DATE_FORMATTERS.get(i);
            String pattern = DATE_FORMAT_PATTERNS.get(i);

            int successCount = 0;
            for (String value : nonNullValues) {
                if (tryParseDate(value, formatter)) {
                    successCount++;
                }
            }

            double successRate = (double) successCount / nonNullValues.size();
            if (successRate >= DATE_DETECTION_THRESHOLD) {
                log.debug("检测到日期格式: pattern={}, successRate={}", pattern, successRate);
                return Optional.of(pattern);
            }
        }

        return Optional.empty();
    }

    @Override
    public NumericSubType detectNumericSubType(String columnName, List<Object> values) {
        String lowerColumnName = columnName.toLowerCase();

        // 1. 根据列名关键词判断
        for (String keyword : AMOUNT_KEYWORDS) {
            if (lowerColumnName.contains(keyword.toLowerCase())) {
                return NumericSubType.AMOUNT;
            }
        }

        for (String keyword : PERCENTAGE_KEYWORDS) {
            if (lowerColumnName.contains(keyword.toLowerCase())) {
                return NumericSubType.PERCENTAGE;
            }
        }

        for (String keyword : QUANTITY_KEYWORDS) {
            if (lowerColumnName.contains(keyword.toLowerCase())) {
                return NumericSubType.QUANTITY;
            }
        }

        // 2. 根据数值特征判断
        List<BigDecimal> numericValues = parseNumericValues(values);
        if (numericValues.isEmpty()) {
            return NumericSubType.GENERAL;
        }

        // 检查是否包含货币符号
        boolean hasCurrencySymbol = values.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .anyMatch(s -> s.contains("¥") || s.contains("$") || s.contains("€") || s.contains("£"));
        if (hasCurrencySymbol) {
            return NumericSubType.AMOUNT;
        }

        // 检查是否为百分比（0-100 或 0-1）
        boolean allInPercentageRange = numericValues.stream()
                .allMatch(v -> (v.compareTo(BigDecimal.ZERO) >= 0 && v.compareTo(new BigDecimal("100")) <= 0) ||
                        (v.compareTo(BigDecimal.ZERO) >= 0 && v.compareTo(BigDecimal.ONE) <= 0));
        if (allInPercentageRange && values.stream().anyMatch(v -> v != null && v.toString().contains("%"))) {
            return NumericSubType.PERCENTAGE;
        }

        // 检查是否为整数为主（数量）
        long integerCount = numericValues.stream()
                .filter(v -> v.scale() == 0 || v.stripTrailingZeros().scale() <= 0)
                .count();
        if ((double) integerCount / numericValues.size() > 0.9) {
            return NumericSubType.QUANTITY;
        }

        return NumericSubType.GENERAL;
    }

    @Override
    public List<FieldMappingResult> mapFields(List<String> headers, List<DataFeatureResult> features) {
        log.info("开始映射字段: headerCount={}", headers.size());

        List<FieldMappingResult> results = new ArrayList<>();

        for (int i = 0; i < headers.size(); i++) {
            String header = headers.get(i);
            DataFeatureResult feature = i < features.size() ? features.get(i) : null;

            FieldMappingResult mapping = mapSingleField(header, i, feature);
            results.add(mapping);
        }

        return results;
    }

    @Override
    public List<String> getHeaders(InputStream inputStream, int sheetIndex, int headerRowIndex) {
        HeaderOnlyListener listener = new HeaderOnlyListener(headerRowIndex);

        EasyExcel.read(inputStream, listener)
                .sheet(sheetIndex)
                .headRowNumber(headerRowIndex)
                .doRead();

        return listener.getHeaders();
    }

    @Override
    public List<Map<String, Object>> getSampleData(
            InputStream inputStream,
            int sheetIndex,
            int headerRowIndex,
            int sampleRowCount,
            boolean skipEmptyRows) {

        DynamicExcelListener listener = new DynamicExcelListener(
                headerRowIndex, sampleRowCount, skipEmptyRows);

        EasyExcel.read(inputStream, listener)
                .sheet(sheetIndex)
                .headRowNumber(headerRowIndex)
                .doRead();

        return listener.getSampleData();
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 映射单个字段
     */
    private FieldMappingResult mapSingleField(String header, int columnIndex, DataFeatureResult feature) {
        FieldMappingResult.FieldMappingResultBuilder builder = FieldMappingResult.builder()
                .originalColumn(header)
                .columnIndex(columnIndex)
                .dataFeature(feature);

        // 1. 尝试同义词匹配
        Optional<String> standardField = fieldMappingDictionary.findStandardField(header);

        if (standardField.isPresent()) {
            String field = standardField.get();
            int confidence = fieldMappingDictionary.getMatchConfidence(header, field);
            String dataType = fieldMappingDictionary.getDataType(field);
            boolean isRequired = fieldMappingDictionary.isRequired(field);

            MappingSource source = confidence == 100 ? MappingSource.EXACT_MATCH : MappingSource.SYNONYM_MATCH;

            builder.standardField(field)
                    .standardFieldLabel(getFieldLabel(field))
                    .confidence((double) confidence)
                    .mappingSource(source)
                    .dataType(dataType)
                    .subType(getSubType(dataType, feature))
                    .isRequired(isRequired)
                    .requiresConfirmation(confidence < CONFIDENCE_THRESHOLD);

            if (feature != null && feature.getDataType() == DataType.CATEGORICAL) {
                builder.uniqueValues(feature.getUniqueValues());
            }

        } else {
            // 2. 无法匹配，根据特征推断
            builder.requiresConfirmation(true)
                    .mappingSource(MappingSource.FEATURE_INFER)
                    .confidence(0.0);

            if (feature != null) {
                builder.dataType(feature.getDataType().name());
                if (feature.getNumericSubType() != null) {
                    builder.subType(feature.getNumericSubType().name());
                }
                if (feature.getDataType() == DataType.CATEGORICAL) {
                    builder.uniqueValues(feature.getUniqueValues());
                }
            }

            // 提供候选字段建议
            List<FieldMappingResult.CandidateField> candidates = suggestCandidates(header, feature);
            builder.candidateFields(candidates);
        }

        return builder.build();
    }

    /**
     * 获取字段中文标签
     */
    private String getFieldLabel(String standardField) {
        List<String> synonyms = fieldMappingDictionary.getAllSynonyms(standardField);
        // 返回第一个中文同义词作为标签
        for (String synonym : synonyms) {
            if (isChinese(synonym)) {
                return synonym;
            }
        }
        return standardField;
    }

    /**
     * 判断是否包含中文
     */
    private boolean isChinese(String str) {
        return str != null && str.matches(".*[\\u4e00-\\u9fa5].*");
    }

    /**
     * 获取子类型
     */
    private String getSubType(String dataType, DataFeatureResult feature) {
        if (feature != null && feature.getNumericSubType() != null) {
            return feature.getNumericSubType().name();
        }
        if ("AMOUNT".equals(dataType) || "QUANTITY".equals(dataType) || "PERCENTAGE".equals(dataType)) {
            return dataType;
        }
        return null;
    }

    /**
     * 建议候选字段
     */
    private List<FieldMappingResult.CandidateField> suggestCandidates(String header, DataFeatureResult feature) {
        List<FieldMappingResult.CandidateField> candidates = new ArrayList<>();

        // 基于数据类型筛选候选字段
        String category = null;
        if (feature != null) {
            switch (feature.getDataType()) {
                case DATE:
                    // 日期类型候选
                    candidates.add(createCandidate("order_date", "订单日期", 60.0, "日期类型匹配"));
                    candidates.add(createCandidate("invoice_date", "开票日期", 50.0, "日期类型匹配"));
                    candidates.add(createCandidate("due_date", "到期日", 50.0, "日期类型匹配"));
                    break;
                case NUMERIC:
                    if (feature.getNumericSubType() == NumericSubType.AMOUNT) {
                        candidates.add(createCandidate("amount", "金额", 60.0, "金额类型匹配"));
                        candidates.add(createCandidate("cost", "成本", 50.0, "金额类型匹配"));
                        candidates.add(createCandidate("profit", "利润", 50.0, "金额类型匹配"));
                    } else if (feature.getNumericSubType() == NumericSubType.QUANTITY) {
                        candidates.add(createCandidate("quantity", "数量", 60.0, "数量类型匹配"));
                        candidates.add(createCandidate("headcount", "人数", 50.0, "数量类型匹配"));
                    } else if (feature.getNumericSubType() == NumericSubType.PERCENTAGE) {
                        candidates.add(createCandidate("gross_margin", "毛利率", 60.0, "百分比类型匹配"));
                        candidates.add(createCandidate("net_margin", "净利率", 50.0, "百分比类型匹配"));
                    }
                    break;
                case CATEGORICAL:
                    candidates.add(createCandidate("department", "部门", 60.0, "分类类型匹配"));
                    candidates.add(createCandidate("region", "区域", 50.0, "分类类型匹配"));
                    candidates.add(createCandidate("product_category", "产品类别", 50.0, "分类类型匹配"));
                    break;
                case ID:
                    candidates.add(createCandidate("salesperson_id", "销售员ID", 60.0, "ID类型匹配"));
                    candidates.add(createCandidate("product_id", "产品ID", 50.0, "ID类型匹配"));
                    break;
                default:
                    candidates.add(createCandidate("salesperson_name", "销售员姓名", 50.0, "文本类型匹配"));
                    candidates.add(createCandidate("product_name", "产品名称", 50.0, "文本类型匹配"));
                    break;
            }
        }

        return candidates.stream()
                .limit(5)
                .collect(Collectors.toList());
    }

    private FieldMappingResult.CandidateField createCandidate(String fieldName, String label, Double score, String reason) {
        return FieldMappingResult.CandidateField.builder()
                .fieldName(fieldName)
                .label(label)
                .score(score)
                .reason(reason)
                .build();
    }

    /**
     * 尝试解析日期
     */
    private boolean tryParseDate(String value, DateTimeFormatter formatter) {
        try {
            LocalDate.parse(value, formatter);
            return true;
        } catch (DateTimeParseException e1) {
            try {
                LocalDateTime.parse(value, formatter);
                return true;
            } catch (DateTimeParseException e2) {
                return false;
            }
        }
    }

    /**
     * 检测是否为数值列
     */
    private boolean isNumericColumn(List<Object> values) {
        if (values == null || values.isEmpty()) {
            return false;
        }

        long numericCount = values.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .filter(this::isNumericValue)
                .count();

        long nonNullCount = values.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .count();

        return nonNullCount > 0 && (double) numericCount / nonNullCount >= NUMERIC_DETECTION_THRESHOLD;
    }

    /**
     * 判断是否为数值
     */
    private boolean isNumericValue(String value) {
        if (value == null || value.trim().isEmpty()) {
            return false;
        }
        String cleaned = value.replaceAll("[¥$€£%,\\s]", "");
        try {
            new BigDecimal(cleaned);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /**
     * 检测是否为ID列
     */
    private boolean isIdColumn(String columnName, List<Object> values, int uniqueCount, int nonNullCount) {
        // 1. 列名包含ID关键词
        String lowerName = columnName.toLowerCase();
        for (String keyword : ID_KEYWORDS) {
            if (lowerName.contains(keyword.toLowerCase())) {
                return true;
            }
        }

        // 2. 唯一值数量约等于总行数
        if (nonNullCount > 0) {
            double uniqueRatio = (double) uniqueCount / nonNullCount;
            return uniqueRatio > 0.95;
        }

        return false;
    }

    /**
     * 检测是否为分类列
     */
    private boolean isCategoricalColumn(int uniqueCount, int nonNullCount) {
        if (nonNullCount == 0) {
            return false;
        }
        double uniqueRatio = (double) uniqueCount / nonNullCount;
        return uniqueRatio < CATEGORICAL_UNIQUE_RATIO && uniqueCount <= CATEGORICAL_MAX_UNIQUE;
    }

    /**
     * 解析数值列表
     */
    private List<BigDecimal> parseNumericValues(List<Object> values) {
        return values.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .map(s -> s.replaceAll("[¥$€£%,\\s]", ""))
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try {
                        return new BigDecimal(s);
                    } catch (NumberFormatException e) {
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    /**
     * 计算数值统计
     */
    private NumericStats calculateNumericStats(List<Object> values) {
        List<BigDecimal> numericValues = parseNumericValues(values);
        if (numericValues.isEmpty()) {
            return new NumericStats(null, null);
        }

        BigDecimal min = numericValues.stream().min(BigDecimal::compareTo).orElse(null);
        BigDecimal max = numericValues.stream().max(BigDecimal::compareTo).orElse(null);

        return new NumericStats(min, max);
    }

    /**
     * 提取指定列的值
     */
    private List<Object> extractColumnValues(List<Map<String, Object>> sampleData, String columnName) {
        return sampleData.stream()
                .map(row -> row.get(columnName))
                .collect(Collectors.toList());
    }

    /**
     * 数值统计结果
     */
    private static class NumericStats {
        final BigDecimal min;
        final BigDecimal max;

        NumericStats(BigDecimal min, BigDecimal max) {
            this.min = min;
            this.max = max;
        }
    }

    // ==================== 内部监听器类 ====================

    /**
     * 动态Excel读取监听器
     * 用于读取任意格式的Excel文件
     */
    private class DynamicExcelListener extends AnalysisEventListener<Map<Integer, Object>> {

        private final int headerRowIndex;
        private final int sampleRowCount;
        private final boolean skipEmptyRows;

        private List<String> headers = new ArrayList<>();
        private List<Map<String, Object>> sampleData = new ArrayList<>();
        private AtomicInteger rowCount = new AtomicInteger(0);
        private String sheetName;

        public DynamicExcelListener(int headerRowIndex, int sampleRowCount, boolean skipEmptyRows) {
            this.headerRowIndex = headerRowIndex;
            this.sampleRowCount = sampleRowCount;
            this.skipEmptyRows = skipEmptyRows;
        }

        @Override
        public void invokeHeadMap(Map<Integer, String> headMap, AnalysisContext context) {
            // 获取表头
            this.headers = new ArrayList<>();
            if (headMap != null) {
                int maxColumn = headMap.keySet().stream().mapToInt(Integer::intValue).max().orElse(-1);
                for (int i = 0; i <= maxColumn; i++) {
                    String header = headMap.get(i);
                    this.headers.add(header != null ? header.trim() : "Column_" + i);
                }
            }
            this.sheetName = context.readSheetHolder().getSheetName();
            log.debug("读取表头: headers={}, sheetName={}", headers, sheetName);
        }

        @Override
        public void invoke(Map<Integer, Object> data, AnalysisContext context) {
            rowCount.incrementAndGet();

            // 采样数据
            if (sampleData.size() < sampleRowCount) {
                // 检查是否为空行
                boolean isEmpty = data.values().stream()
                        .allMatch(v -> v == null || v.toString().trim().isEmpty());

                if (!skipEmptyRows || !isEmpty) {
                    Map<String, Object> rowData = new LinkedHashMap<>();
                    for (int i = 0; i < headers.size(); i++) {
                        Object value = data.get(i);
                        rowData.put(headers.get(i), value);
                    }
                    sampleData.add(rowData);
                }
            }
        }

        @Override
        public void doAfterAllAnalysed(AnalysisContext context) {
            log.debug("Excel读取完成: totalRows={}, sampledRows={}", rowCount.get(), sampleData.size());
        }

        public List<String> getHeaders() {
            return headers;
        }

        public List<Map<String, Object>> getSampleData() {
            return sampleData;
        }

        public int getTotalRowCount() {
            return rowCount.get();
        }

        public String getSheetName() {
            return sheetName;
        }
    }

    /**
     * 仅读取表头的监听器
     */
    private class HeaderOnlyListener extends AnalysisEventListener<Map<Integer, Object>> {

        private final int headerRowIndex;
        private List<String> headers = new ArrayList<>();

        public HeaderOnlyListener(int headerRowIndex) {
            this.headerRowIndex = headerRowIndex;
        }

        @Override
        public void invokeHeadMap(Map<Integer, String> headMap, AnalysisContext context) {
            if (headMap != null) {
                int maxColumn = headMap.keySet().stream().mapToInt(Integer::intValue).max().orElse(-1);
                for (int i = 0; i <= maxColumn; i++) {
                    String header = headMap.get(i);
                    headers.add(header != null ? header.trim() : "Column_" + i);
                }
            }
        }

        @Override
        public void invoke(Map<Integer, Object> data, AnalysisContext context) {
            // 只读取表头，不处理数据行
        }

        @Override
        public void doAfterAllAnalysed(AnalysisContext context) {
            // 完成
        }

        public List<String> getHeaders() {
            return headers;
        }
    }
}
