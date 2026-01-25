package com.cretas.aims.service.smartbi.impl;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.context.AnalysisContext;
import com.alibaba.excel.event.AnalysisEventListener;
import com.alibaba.excel.read.metadata.ReadSheet;
import com.cretas.aims.config.smartbi.FieldMappingDictionary;
import com.cretas.aims.dto.smartbi.DataFeatureResult;
import com.cretas.aims.dto.smartbi.DataFeatureResult.DataType;
import com.cretas.aims.dto.smartbi.DataFeatureResult.NumericSubType;
import com.cretas.aims.entity.smartbi.enums.DataOrientation;
import com.cretas.aims.dto.smartbi.ExcelParseRequest;
import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import com.cretas.aims.dto.smartbi.FieldMappingResult.MappingSource;
import com.cretas.aims.dto.smartbi.FieldMappingWithChartRole;
import com.cretas.aims.dto.smartbi.SheetInfo;
import com.cretas.aims.service.smartbi.ExcelDynamicParserService;
import com.cretas.aims.service.smartbi.LLMFieldMappingService;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellRangeAddress;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
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

    /**
     * LLM 字段映射服务（可选注入）
     * 用于在字典无法匹配时调用 LLM 进行语义分析
     */
    @Autowired(required = false)
    private LLMFieldMappingService llmFieldMappingService;

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
            "MM/dd/yyyy",
            "yyyy-M-d",
            "yyyy/M/d",
            "M/d/yyyy"
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

    // ==================== 时间模式正则表达式（用于自动检测数据方向）====================

    /**
     * 时间模式正则表达式列表
     * 用于检测表头是否包含时间信息（列方向数据的典型特征）
     */
    private static final List<Pattern> TIME_PATTERNS = Arrays.asList(
            // 年月格式: 2025年1月, 2025年01月
            Pattern.compile("\\d{4}年\\d{1,2}月"),
            // 季度格式: 2025Q1, Q1 2025, 2025年Q1, 第一季度
            Pattern.compile("\\d{4}[Qq]\\d"),
            Pattern.compile("[Qq]\\d\\s*\\d{4}"),
            Pattern.compile("\\d{4}年[Qq]\\d"),
            Pattern.compile("第[一二三四]季度"),
            // 英文月份: Jan 2025, January 2025, Jan-25, 2025-Jan
            Pattern.compile("(?i)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s*[-/]?\\s*\\d{2,4}"),
            Pattern.compile("(?i)\\d{2,4}\\s*[-/]?\\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"),
            Pattern.compile("(?i)(January|February|March|April|May|June|July|August|September|October|November|December)\\s*\\d{2,4}"),
            // 年份范围: FY2025, 2025财年
            Pattern.compile("(?i)FY\\s*\\d{4}"),
            Pattern.compile("\\d{4}财年"),
            // 简单年月: 2025-01, 2025/01, 202501
            Pattern.compile("\\d{4}[-/]\\d{2}"),
            Pattern.compile("\\d{6}"),
            // 周格式: 第1周, W1, Week 1
            Pattern.compile("第\\d{1,2}周"),
            Pattern.compile("(?i)[Ww]\\d{1,2}"),
            Pattern.compile("(?i)Week\\s*\\d{1,2}"),
            // 预算/实际等财务术语组合时间
            Pattern.compile("\\d{4}年\\d{1,2}月[_-]?(预算|实际|计划|完成)"),
            Pattern.compile("(预算|实际|计划|完成)[_-]?\\d{4}年\\d{1,2}月")
    );

    // ==================== 主要接口实现 ====================

    @Override
    public ExcelParseResponse parseExcel(InputStream inputStream, ExcelParseRequest request) {
        long startTime = System.currentTimeMillis();
        log.info("开始解析Excel文件: fileName={}, sheetIndex={}, headerRow={}, sampleSize={}, autoDetectMultiHeader={}",
                request.getFileName(), request.getSheetIndex(), request.getHeaderRow(),
                request.getSampleSize(), request.getAutoDetectMultiHeader());

        try {
            // 将 InputStream 缓存到 byte array，以便多次读取
            byte[] excelBytes = toByteArray(inputStream);

            // 0. 多层表头检测（如果启用）
            MultiHeaderInfo multiHeaderInfo = null;
            List<String> overrideHeaders = null;
            int effectiveHeaderRow = request.getHeaderRow();
            int userProvidedHeaderRows = request.getHeaderRow() + 1; // 用户指定的表头行数

            if (Boolean.TRUE.equals(request.getAutoDetectMultiHeader())) {
                log.info("开始多层表头检测...");
                // 如果用户指定了较大的 headerRow，使用它作为 maxHeaderRows 的提示
                int maxHeaderRowsHint = Math.max(request.getMaxHeaderRows(), userProvidedHeaderRows);
                multiHeaderInfo = detectMultiHeader(
                        new ByteArrayInputStream(excelBytes),
                        request.getSheetIndex(),
                        maxHeaderRowsHint
                );

                if (multiHeaderInfo.isHasMultiHeader()) {
                    // 如果用户指定的 headerRow 大于检测到的行数，使用用户的值
                    int detectedRows = multiHeaderInfo.getHeaderRowCount();
                    int finalHeaderRows = Math.max(detectedRows, userProvidedHeaderRows);

                    log.info("多层表头检测: detected={}, userProvided={}, final={}",
                            detectedRows, userProvidedHeaderRows, finalHeaderRows);

                    // 如果需要使用更多行，重新合并表头
                    if (finalHeaderRows > detectedRows) {
                        log.info("使用用户指定的表头行数: {}", finalHeaderRows);
                        multiHeaderInfo.setHeaderRowCount(finalHeaderRows);
                        // 重新执行表头合并
                        List<String> mergedHeaders = mergeMultiRowHeaders(
                                WorkbookFactory.create(new ByteArrayInputStream(excelBytes)).getSheetAt(request.getSheetIndex()),
                                finalHeaderRows,
                                multiHeaderInfo.getMergedRegions());
                        multiHeaderInfo.setMergedHeaders(mergedHeaders);
                    }

                    log.info("检测到多层表头: rowCount={}, mergedHeaders={}",
                            multiHeaderInfo.getHeaderRowCount(),
                            multiHeaderInfo.getMergedHeaders());
                    overrideHeaders = multiHeaderInfo.getMergedHeaders();
                    // 调整 effectiveHeaderRow 为多层表头的最后一行
                    effectiveHeaderRow = multiHeaderInfo.getHeaderRowCount() - 1;
                }
            }

            // 1. 使用动态监听器读取Excel
            DynamicExcelListener listener = new DynamicExcelListener(
                    effectiveHeaderRow,
                    request.getSampleSize(),
                    request.getSkipEmptyRows(),
                    overrideHeaders  // 传入预合并的表头
            );

            EasyExcel.read(new ByteArrayInputStream(excelBytes), listener)
                    .sheet(request.getSheetIndex())
                    .headRowNumber(effectiveHeaderRow)
                    .doRead();

            // 2. 获取解析结果
            List<String> headers = listener.getHeaders();
            List<Map<String, Object>> sampleData = listener.getSampleData();
            int totalRowCount = listener.getTotalRowCount();
            String sheetName = listener.getSheetName();

            log.info("Excel读取完成: headers={}, sampleRows={}, totalRows={}",
                    headers.size(), sampleData.size(), totalRowCount);

            // 2.5 自动检测数据方向（如果启用且 transpose 未明确指定）
            Boolean shouldTranspose = request.getTranspose();
            if (shouldTranspose == null && Boolean.TRUE.equals(request.getAutoDetectOrientation())) {
                log.info("开始自动检测数据方向...");
                DataOrientation orientation = detectDataOrientation(headers, sampleData);
                log.info("数据方向检测结果: {}", orientation);

                if (orientation == DataOrientation.COLUMN_ORIENTED) {
                    shouldTranspose = true;
                    log.info("检测到列方向数据，将自动执行转置");
                } else {
                    shouldTranspose = false;
                    log.info("检测到行方向数据或无法确定，不执行转置");
                }
            }

            // 2.6 如果需要转置，执行数据转置（用于处理利润表等列方向数据）
            if (Boolean.TRUE.equals(shouldTranspose)) {
                log.info("执行数据转置: rowLabelColumn={}, headerRowCount={}",
                        request.getRowLabelColumn(), request.getHeaderRowCount());

                TransposeResult transposeResult = transposeData(
                        headers,
                        sampleData,
                        request.getRowLabelColumn() != null ? request.getRowLabelColumn() : 0,
                        request.getHeaderRowCount() != null ? request.getHeaderRowCount() : 1
                );

                headers = transposeResult.headers;
                sampleData = transposeResult.data;
                totalRowCount = sampleData.size();

                log.info("数据转置完成: newHeaders={}, newRowCount={}",
                        headers.size(), sampleData.size());
            }

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
            List<FieldMappingResult> fieldMappings = mapFields(headers, dataFeatures, request.getFactoryId());

            // 5. 检查字段（推荐字段，非强制）
            Set<String> mappedStandardFields = fieldMappings.stream()
                    .filter(m -> m.getStandardField() != null)
                    .map(FieldMappingResult::getStandardField)
                    .collect(Collectors.toSet());
            // 获取缺失的推荐字段（仅用于提示，不阻止保存）
            List<String> missingRecommendedFields = fieldMappingDictionary.getMissingRecommendedFields(mappedStandardFields);

            // 6. 构建响应
            long parseTimeMs = System.currentTimeMillis() - startTime;

            // 构建元信息，包含多层表头检测结果
            ExcelParseResponse.ParseMetadata.ParseMetadataBuilder metadataBuilder =
                    ExcelParseResponse.ParseMetadata.builder()
                            .sheetName(sheetName)
                            .originalColumnCount(headers.size())
                            .sampledRowCount(sampleData.size())
                            .parseTimeMs(parseTimeMs);

            // 添加多层表头信息
            if (multiHeaderInfo != null && multiHeaderInfo.isHasMultiHeader()) {
                metadataBuilder
                        .hasMultiHeader(true)
                        .headerRowCount(multiHeaderInfo.getHeaderRowCount());
                log.info("响应包含多层表头信息: headerRowCount={}", multiHeaderInfo.getHeaderRowCount());
            } else {
                metadataBuilder.hasMultiHeader(false);
            }

            // 系统动态适配任何 Excel 格式，状态始终为 COMPLETE
            // missingRequiredFields 保留缺失的推荐字段信息（仅用于提示）
            ExcelParseResponse response = ExcelParseResponse.builder()
                    .success(true)
                    .headers(headers)
                    .rowCount(totalRowCount)
                    .columnCount(headers.size())
                    .fieldMappings(fieldMappings)
                    .dataFeatures(dataFeatures)
                    .previewData(sampleData)
                    .missingRequiredFields(missingRecommendedFields)  // 显示推荐字段缺失（仅提示）
                    .status("COMPLETE")  // 动态适配，始终允许继续
                    .metadata(metadataBuilder.build())
                    .build();

            log.info("Excel解析完成: parseTimeMs={}, mappedFields={}, missingRecommendedFields={}",
                    parseTimeMs, mappedStandardFields.size(), missingRecommendedFields.size());

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
        return mapFields(headers, features, null);
    }

    /**
     * 映射字段（带工厂ID）- 两阶段批量优化版本
     *
     * 优化流程：
     * 1. 阶段1: 字典快速匹配（遍历所有字段，尝试字典/缓存匹配）
     * 2. 阶段2: 批量 LLM 分析（一次调用分析所有未匹配字段）
     * 3. 阶段3: 合并结果 + 保存高置信度映射
     *
     * 性能提升：从 N 次 LLM 调用优化为 1 次
     *
     * @param headers   列名列表
     * @param features  数据特征列表
     * @param factoryId 工厂ID（用于LLM保存映射）
     * @return 字段映射结果列表
     */
    public List<FieldMappingResult> mapFields(List<String> headers, List<DataFeatureResult> features, String factoryId) {
        long startTime = System.currentTimeMillis();
        log.info("开始映射字段(批量优化): headerCount={}, factoryId={}", headers.size(), factoryId);

        // 初始化结果数组（占位）
        FieldMappingResult[] results = new FieldMappingResult[headers.size()];

        // 收集需要 LLM 分析的字段
        List<UnmappedFieldInfo> unmappedFields = new ArrayList<>();

        // ========== 阶段1: 字典快速匹配 ==========
        for (int i = 0; i < headers.size(); i++) {
            String header = headers.get(i);
            DataFeatureResult feature = i < features.size() ? features.get(i) : null;

            // 尝试字典匹配
            FieldMappingResult dictResult = tryDictionaryMatch(header, i, feature);
            if (dictResult != null) {
                results[i] = dictResult;
                log.debug("字典匹配成功: {} -> {}", header, dictResult.getStandardField());
            } else {
                // 收集未匹配字段（占位为 null）
                unmappedFields.add(new UnmappedFieldInfo(i, header, feature));
            }
        }

        int dictMatchCount = headers.size() - unmappedFields.size();
        log.info("阶段1完成: 字典匹配={}, 待LLM分析={}", dictMatchCount, unmappedFields.size());

        // ========== 阶段2: 批量 LLM 分析 ==========
        if (!unmappedFields.isEmpty() && llmFieldMappingService != null
                && llmFieldMappingService.isAvailable()) {
            try {
                List<FieldMappingWithChartRole> llmResults = batchAnalyzeWithLLM(unmappedFields, factoryId);

                // ========== 阶段3: 合并结果（按 originalField 名称匹配，而非索引顺序）==========
                // 构建 LLM 结果映射表（按列名查找）
                Map<String, FieldMappingWithChartRole> llmResultMap = new HashMap<>();
                for (FieldMappingWithChartRole result : llmResults) {
                    if (result.getOriginalField() != null) {
                        llmResultMap.put(result.getOriginalField(), result);
                    }
                }

                for (UnmappedFieldInfo info : unmappedFields) {
                    FieldMappingWithChartRole llmResult = llmResultMap.get(info.header);
                    results[info.index] = convertLLMResultToMapping(info.header, info.index, info.feature, llmResult);
                }

                log.info("阶段2完成: LLM批量分析成功, 处理{}个字段", unmappedFields.size());
            } catch (Exception e) {
                log.warn("LLM批量分析失败，回退到特征推断: {}", e.getMessage());
                // 回退：为未匹配字段构建默认映射
                for (UnmappedFieldInfo info : unmappedFields) {
                    results[info.index] = buildFeatureInferMapping(info.header, info.index, info.feature);
                }
            }
        } else {
            // LLM 不可用：使用特征推断
            log.info("LLM不可用，使用特征推断处理{}个未匹配字段", unmappedFields.size());
            for (UnmappedFieldInfo info : unmappedFields) {
                results[info.index] = buildFeatureInferMapping(info.header, info.index, info.feature);
            }
        }

        // 填充任何剩余的 null 值（防御性编程）
        for (int i = 0; i < results.length; i++) {
            if (results[i] == null) {
                String header = headers.get(i);
                DataFeatureResult feature = i < features.size() ? features.get(i) : null;
                results[i] = buildFeatureInferMapping(header, i, feature);
            }
        }

        long elapsed = System.currentTimeMillis() - startTime;
        log.info("字段映射完成: 总耗时={}ms, 字典匹配={}, LLM分析={}",
                elapsed, dictMatchCount, unmappedFields.size());

        return Arrays.asList(results);
    }

    /**
     * 尝试字典匹配
     *
     * @return 匹配成功返回 FieldMappingResult，否则返回 null
     */
    private FieldMappingResult tryDictionaryMatch(String header, int columnIndex, DataFeatureResult feature) {
        Optional<String> standardField = fieldMappingDictionary.findStandardField(header);

        if (standardField.isPresent()) {
            String field = standardField.get();
            int confidence = fieldMappingDictionary.getMatchConfidence(header, field);
            String dataType = fieldMappingDictionary.getDataType(field);
            boolean isRequired = fieldMappingDictionary.isRequired(field);

            MappingSource source = confidence == 100 ? MappingSource.EXACT_MATCH : MappingSource.SYNONYM_MATCH;

            FieldMappingResult.FieldMappingResultBuilder builder = FieldMappingResult.builder()
                    .originalColumn(header)
                    .columnIndex(columnIndex)
                    .dataFeature(feature)
                    .standardField(field)
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

            return builder.build();
        }

        return null;
    }

    /**
     * 批量调用 LLM 分析未匹配字段
     */
    private List<FieldMappingWithChartRole> batchAnalyzeWithLLM(
            List<UnmappedFieldInfo> unmappedFields, String factoryId) {

        // 构建 FieldInfo 列表
        List<LLMFieldMappingService.FieldInfo> fieldInfoList = unmappedFields.stream()
                .map(f -> {
                    LLMFieldMappingService.FieldInfo info = new LLMFieldMappingService.FieldInfo();
                    info.setColumnName(f.header);
                    info.setDataType(f.feature != null ? f.feature.getDataType().name() : "TEXT");
                    info.setSampleValues(f.feature != null && f.feature.getSampleValues() != null
                            ? f.feature.getSampleValues().stream()
                                .map(s -> (Object) s).collect(Collectors.toList())
                            : Collections.emptyList());
                    info.setUniqueValueCount(f.feature != null ? f.feature.getUniqueCount() : 0);
                    return info;
                })
                .collect(Collectors.toList());

        log.info("调用LLM批量分析: fieldCount={}, factoryId={}", fieldInfoList.size(), factoryId);

        // 一次 LLM 调用分析所有字段
        return llmFieldMappingService.analyzeAndSaveAll(fieldInfoList, factoryId);
    }

    /**
     * 将 LLM 结果转换为 FieldMappingResult
     */
    private FieldMappingResult convertLLMResultToMapping(String header, int columnIndex,
            DataFeatureResult feature, FieldMappingWithChartRole llmResult) {

        if (llmResult == null || llmResult.getStandardField() == null) {
            return buildFeatureInferMapping(header, columnIndex, feature);
        }

        double confidencePercent = llmResult.getConfidence() != null
                ? llmResult.getConfidence() * 100
                : 90.0;

        String dataType = llmResult.getDataType() != null
                ? llmResult.getDataType()
                : (feature != null ? feature.getDataType().name() : "TEXT");

        return FieldMappingResult.builder()
                .originalColumn(header)
                .columnIndex(columnIndex)
                .dataFeature(feature)
                .standardField(llmResult.getStandardField())
                .standardFieldLabel(llmResult.getAlias())
                .mappingSource(MappingSource.AI_SEMANTIC)
                .confidence(confidencePercent)
                .requiresConfirmation(llmResult.getConfidence() != null && llmResult.getConfidence() < 0.8)
                .dataType(dataType)
                .uniqueValues(feature != null && feature.getDataType() == DataType.CATEGORICAL
                        ? feature.getUniqueValues() : null)
                .build();
    }

    /**
     * 构建特征推断映射（当字典和LLM都无法匹配时）
     */
    private FieldMappingResult buildFeatureInferMapping(String header, int columnIndex, DataFeatureResult feature) {
        FieldMappingResult.FieldMappingResultBuilder builder = FieldMappingResult.builder()
                .originalColumn(header)
                .columnIndex(columnIndex)
                .dataFeature(feature)
                .requiresConfirmation(true)
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

        return builder.build();
    }

    /**
     * 未匹配字段信息（内部类）
     */
    private static class UnmappedFieldInfo {
        final int index;
        final String header;
        final DataFeatureResult feature;

        UnmappedFieldInfo(int index, String header, DataFeatureResult feature) {
            this.index = index;
            this.header = header;
            this.feature = feature;
        }
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
     * 将 InputStream 转换为 byte array
     * 用于支持多次读取同一个输入流
     */
    private byte[] toByteArray(InputStream inputStream) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int len;
        while ((len = inputStream.read(buffer)) != -1) {
            baos.write(buffer, 0, len);
        }
        return baos.toByteArray();
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

    // ==================== 数据方向自动检测功能 ====================

    /**
     * 自动检测数据方向（是否需要转置）
     *
     * 判断逻辑：
     *
     * **列方向数据特征（需要转置）：**
     * 1. 第一列是文本标签（项目名），后续列是数值
     * 2. 表头包含时间信息（2025年1月、Q1、Jan等）
     * 3. 数值列数 > 数据行数（宽表）
     * 4. 第一行/前几行有日期格式的列名
     *
     * **行方向数据特征（不需要转置）：**
     * 1. 每行是一条完整记录
     * 2. 有日期列作为数据列（不是表头）
     * 3. 数据行数 > 数值列数（长表）
     *
     * @param headers 表头列表
     * @param sampleData 样本数据
     * @return 数据方向枚举
     */
    private DataOrientation detectDataOrientation(List<String> headers, List<Map<String, Object>> sampleData) {
        if (headers == null || headers.isEmpty() || sampleData == null || sampleData.isEmpty()) {
            log.warn("无法检测数据方向: headers或sampleData为空");
            return DataOrientation.UNKNOWN;
        }

        log.debug("开始检测数据方向: headerCount={}, sampleRowCount={}", headers.size(), sampleData.size());

        // 1. 检查表头是否包含时间模式
        int timePatternHeaderCount = countTimePatternHeaders(headers);
        double timePatternRatio = (double) timePatternHeaderCount / headers.size();

        // 2. 检查第一列是否全是文本标签
        String firstHeader = headers.isEmpty() ? null : headers.get(0);
        boolean firstColumnIsLabels = isLabelColumn(sampleData, firstHeader);

        // 3. 统计数值列数量和数据特征
        int numericColumnCount = countNumericColumns(headers, sampleData);
        int dataRowCount = sampleData.size();
        int totalColumnCount = headers.size();

        // 4. 检查数据列中是否存在日期列（行方向数据的特征）
        boolean hasDateColumnInData = hasDateColumnInData(headers, sampleData);

        // 5. 计算宽高比
        double widthHeightRatio = totalColumnCount > 0 ? (double) dataRowCount / totalColumnCount : 1.0;

        log.info("数据方向检测指标: timePatternHeaders={}/{} ({}%), firstColumnIsLabels={}, " +
                        "numericColumns={}, dataRows={}, totalColumns={}, widthHeightRatio={}, hasDateColumnInData={}",
                timePatternHeaderCount, totalColumnCount, String.format("%.1f", timePatternRatio * 100),
                firstColumnIsLabels, numericColumnCount, dataRowCount, totalColumnCount,
                String.format("%.2f", widthHeightRatio), hasDateColumnInData);

        // ========== 判断逻辑 ==========

        // 列方向数据的强信号：
        // - 表头中有多个时间模式（>= 2 个）
        // - 第一列是文本标签
        // - 宽表（列数 > 行数，或者时间列占比高）
        if (timePatternHeaderCount >= 2 && firstColumnIsLabels) {
            // 进一步确认：检查是否为宽表或时间列占比高
            if (numericColumnCount > dataRowCount || timePatternRatio >= 0.3) {
                log.info("判定为列方向数据: 时间表头多({}个), 第一列是标签, 宽表或时间列占比高({}%)",
                        timePatternHeaderCount, String.format("%.1f", timePatternRatio * 100));
                return DataOrientation.COLUMN_ORIENTED;
            }
        }

        // 列方向数据的中等信号：
        // - 表头中有时间模式
        // - 数值列数量较多（排除第一列后大部分是数值）
        if (timePatternHeaderCount >= 1 && firstColumnIsLabels) {
            int nonLabelColumns = totalColumnCount - 1;
            double numericRatioExcludingFirst = nonLabelColumns > 0
                    ? (double) (numericColumnCount - (isNumericColumn(extractColumnValues(sampleData, firstHeader)) ? 1 : 0)) / nonLabelColumns
                    : 0;

            if (numericRatioExcludingFirst >= 0.7 && dataRowCount < totalColumnCount * 2) {
                log.info("判定为列方向数据: 有时间表头, 第一列是标签, 非标签列大部分是数值({}%)",
                        String.format("%.1f", numericRatioExcludingFirst * 100));
                return DataOrientation.COLUMN_ORIENTED;
            }
        }

        // 行方向数据的信号：
        // - 数据中存在日期列
        // - 长表（行数明显多于列数）
        // - 表头不包含时间模式
        if (hasDateColumnInData && timePatternHeaderCount == 0) {
            log.info("判定为行方向数据: 数据中有日期列, 表头无时间模式");
            return DataOrientation.ROW_ORIENTED;
        }

        if (widthHeightRatio >= 2.0 && timePatternHeaderCount == 0) {
            log.info("判定为行方向数据: 长表(行/列比={}), 表头无时间模式", String.format("%.2f", widthHeightRatio));
            return DataOrientation.ROW_ORIENTED;
        }

        // 默认情况：如果无法明确判断
        if (timePatternHeaderCount == 0 && !firstColumnIsLabels) {
            log.info("判定为行方向数据: 默认（表头无时间模式，第一列非纯标签）");
            return DataOrientation.ROW_ORIENTED;
        }

        log.info("无法明确判定数据方向，返回 UNKNOWN");
        return DataOrientation.UNKNOWN;
    }

    /**
     * 统计表头中包含时间模式的数量
     */
    private int countTimePatternHeaders(List<String> headers) {
        if (headers == null) return 0;

        int count = 0;
        for (String header : headers) {
            if (header != null && isTimePattern(header)) {
                count++;
                log.debug("检测到时间模式表头: {}", header);
            }
        }
        return count;
    }

    /**
     * 判断字符串是否匹配时间模式
     */
    private boolean isTimePattern(String value) {
        if (value == null || value.trim().isEmpty()) {
            return false;
        }
        String trimmed = value.trim();
        for (Pattern pattern : TIME_PATTERNS) {
            if (pattern.matcher(trimmed).find()) {
                return true;
            }
        }
        return false;
    }

    /**
     * 检查指定列是否为标签列（非数值、非日期的文本列）
     *
     * 标签列特征：
     * - 大部分值是非空文本
     * - 不是数值
     * - 不是日期
     * - 唯一值数量与行数相近（每行一个不同的标签）
     */
    private boolean isLabelColumn(List<Map<String, Object>> sampleData, String columnName) {
        if (sampleData == null || sampleData.isEmpty() || columnName == null) {
            return false;
        }

        List<Object> values = extractColumnValues(sampleData, columnName);
        if (values.isEmpty()) {
            return false;
        }

        int textCount = 0;
        int numericCount = 0;
        int nonNullCount = 0;
        Set<String> uniqueValues = new HashSet<>();

        for (Object value : values) {
            if (value == null) continue;
            String strValue = value.toString().trim();
            if (strValue.isEmpty()) continue;

            nonNullCount++;
            uniqueValues.add(strValue);

            if (isNumericValue(strValue)) {
                numericCount++;
            } else {
                textCount++;
            }
        }

        if (nonNullCount == 0) {
            return false;
        }

        // 标签列条件：
        // 1. 文本占比超过 70%
        // 2. 唯一值占比超过 50%（每行有不同的标签）
        double textRatio = (double) textCount / nonNullCount;
        double uniqueRatio = (double) uniqueValues.size() / nonNullCount;

        boolean isLabel = textRatio >= 0.7 && uniqueRatio >= 0.5;

        log.debug("列[{}]标签检测: textRatio={}, uniqueRatio={}, isLabel={}",
                columnName, String.format("%.2f", textRatio), String.format("%.2f", uniqueRatio), isLabel);

        return isLabel;
    }

    /**
     * 统计数值列的数量
     */
    private int countNumericColumns(List<String> headers, List<Map<String, Object>> sampleData) {
        if (headers == null || sampleData == null) return 0;

        int numericCount = 0;
        for (String header : headers) {
            List<Object> values = extractColumnValues(sampleData, header);
            if (isNumericColumn(values)) {
                numericCount++;
            }
        }
        return numericCount;
    }

    /**
     * 检查数据中是否存在日期列（不是表头中的时间，而是数据值中的日期）
     */
    private boolean hasDateColumnInData(List<String> headers, List<Map<String, Object>> sampleData) {
        if (headers == null || sampleData == null) return false;

        for (String header : headers) {
            // 跳过表头本身就是时间模式的列
            if (isTimePattern(header)) {
                continue;
            }

            List<Object> values = extractColumnValues(sampleData, header);
            Optional<String> dateFormat = detectDateFormat(values);
            if (dateFormat.isPresent()) {
                log.debug("在数据列[{}]中检测到日期格式: {}", header, dateFormat.get());
                return true;
            }
        }
        return false;
    }

    // ==================== 数据转置功能 ====================

    /**
     * 转置结果
     */
    private static class TransposeResult {
        final List<String> headers;
        final List<Map<String, Object>> data;

        TransposeResult(List<String> headers, List<Map<String, Object>> data) {
            this.headers = headers;
            this.data = data;
        }
    }

    /**
     * 转置数据（将列方向数据转换为行方向数据）
     *
     * 原始格式示例（利润表）：
     * |          | 2025年1月 | 2025年2月 |
     * | 营业收入 |   100     |   110     |
     * | 营业成本 |    60     |    65     |
     *
     * 转置后格式：
     * | period  | item     | value |
     * | 2025年1月 | 营业收入 | 100   |
     * | 2025年1月 | 营业成本 |  60   |
     * | 2025年2月 | 营业收入 | 110   |
     * | 2025年2月 | 营业成本 |  65   |
     *
     * 支持多层表头（如预算/实际）：
     * |          | 2025年1月      | 2025年2月      |
     * |          | 预算   | 实际  | 预算   | 实际  |
     * | 营业收入 | 100    | 120   | 110    | 115   |
     *
     * 转置后：
     * | period    | item     | budget | actual |
     * | 2025年1月 | 营业收入 | 100    | 120    |
     * | 2025年2月 | 营业收入 | 110    | 115    |
     *
     * @param originalHeaders 原始表头（包含列标签如月份）
     * @param originalData    原始数据行
     * @param rowLabelColumn  行标签所在列索引（默认0，即第一列为项目名称）
     * @param headerRowCount  表头行数（1=单行表头，2=双层表头如预算/实际）
     * @return 转置后的结果
     */
    private TransposeResult transposeData(
            List<String> originalHeaders,
            List<Map<String, Object>> originalData,
            int rowLabelColumn,
            int headerRowCount) {

        log.info("开始数据转置: originalHeaders={}, dataRows={}, rowLabelColumn={}, headerRowCount={}",
                originalHeaders.size(), originalData.size(), rowLabelColumn, headerRowCount);

        if (originalHeaders.isEmpty() || originalData.isEmpty()) {
            log.warn("原始数据为空，跳过转置");
            return new TransposeResult(originalHeaders, originalData);
        }

        // 获取行标签列名（通常是第一列，如"项目"或空白）
        String rowLabelHeader = rowLabelColumn < originalHeaders.size()
                ? originalHeaders.get(rowLabelColumn)
                : "item";

        // 如果行标签列名为空或类似"Column_0"，使用默认名称
        if (rowLabelHeader == null || rowLabelHeader.isEmpty() || rowLabelHeader.startsWith("Column_")) {
            rowLabelHeader = "item";
        }

        // 解析表头结构
        List<ColumnInfo> columnInfos = parseColumnHeaders(originalHeaders, rowLabelColumn, headerRowCount);

        if (columnInfos.isEmpty()) {
            log.warn("无法解析列信息，跳过转置");
            return new TransposeResult(originalHeaders, originalData);
        }

        // 确定转置后的表头
        Set<String> subTypes = columnInfos.stream()
                .map(c -> c.subType)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<String> newHeaders = new ArrayList<>();
        newHeaders.add("period");
        newHeaders.add("item");

        if (subTypes.isEmpty()) {
            newHeaders.add("value");
        } else {
            newHeaders.addAll(subTypes);
        }

        log.debug("转置后表头: {}", newHeaders);

        // 执行转置
        List<Map<String, Object>> newData = new ArrayList<>();

        Set<String> periods = columnInfos.stream()
                .map(c -> c.period)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        for (Map<String, Object> originalRow : originalData) {
            String itemLabel = getRowLabelValue(originalRow, rowLabelColumn, originalHeaders);
            if (itemLabel == null || itemLabel.trim().isEmpty()) {
                continue;
            }

            for (String period : periods) {
                Map<String, Object> newRow = new LinkedHashMap<>();
                newRow.put("period", period);
                newRow.put("item", itemLabel);

                if (subTypes.isEmpty()) {
                    Object value = getValueForPeriod(originalRow, columnInfos, period, null, originalHeaders);
                    newRow.put("value", value);
                } else {
                    for (String subType : subTypes) {
                        Object value = getValueForPeriod(originalRow, columnInfos, period, subType, originalHeaders);
                        newRow.put(subType, value);
                    }
                }

                newData.add(newRow);
            }
        }

        log.info("数据转置完成: 原始{}行x{}列 -> 转置后{}行x{}列",
                originalData.size(), originalHeaders.size(),
                newData.size(), newHeaders.size());

        return new TransposeResult(newHeaders, newData);
    }

    /**
     * 列信息
     */
    private static class ColumnInfo {
        final int index;
        final String header;
        final String period;
        final String subType;

        ColumnInfo(int index, String header, String period, String subType) {
            this.index = index;
            this.header = header;
            this.period = period;
            this.subType = subType;
        }
    }

    /**
     * 解析列表头，提取期间和子类型信息
     */
    private List<ColumnInfo> parseColumnHeaders(List<String> headers, int rowLabelColumn, int headerRowCount) {
        List<ColumnInfo> result = new ArrayList<>();

        for (int i = 0; i < headers.size(); i++) {
            if (i == rowLabelColumn) {
                continue;
            }

            String header = headers.get(i);
            if (header == null || header.trim().isEmpty() || header.startsWith("Column_")) {
                continue;
            }

            String period;
            String subType = null;

            if (header.contains("_")) {
                String[] parts = header.split("_", 2);
                period = parts[0].trim();
                subType = parts.length > 1 ? parts[1].trim() : null;
            } else {
                period = header.trim();
            }

            result.add(new ColumnInfo(i, header, period, subType));
            log.debug("解析列[{}]: header={}, period={}, subType={}", i, header, period, subType);
        }

        return result;
    }

    /**
     * 获取行标签值
     */
    private String getRowLabelValue(Map<String, Object> row, int rowLabelColumn, List<String> headers) {
        if (rowLabelColumn < headers.size()) {
            String headerName = headers.get(rowLabelColumn);
            Object value = row.get(headerName);
            if (value != null) {
                return value.toString().trim();
            }
        }
        return null;
    }

    /**
     * 获取指定期间和子类型的值
     */
    private Object getValueForPeriod(
            Map<String, Object> row,
            List<ColumnInfo> columnInfos,
            String period,
            String subType,
            List<String> headers) {

        for (ColumnInfo col : columnInfos) {
            if (period.equals(col.period)) {
                if (subType == null || subType.equals(col.subType)) {
                    String headerName = col.index < headers.size() ? headers.get(col.index) : null;
                    if (headerName != null) {
                        return row.get(headerName);
                    }
                }
            }
        }
        return null;
    }

    // ==================== 多层表头检测与合并 ====================

    /**
     * 多层表头信息
     */
    public static class MultiHeaderInfo {
        private boolean hasMultiHeader;
        private int headerRowCount;
        private List<String> mergedHeaders;
        private List<CellRangeAddress> mergedRegions;

        public MultiHeaderInfo() {
            this.hasMultiHeader = false;
            this.headerRowCount = 1;
            this.mergedHeaders = new ArrayList<>();
            this.mergedRegions = new ArrayList<>();
        }

        public boolean isHasMultiHeader() { return hasMultiHeader; }
        public void setHasMultiHeader(boolean hasMultiHeader) { this.hasMultiHeader = hasMultiHeader; }
        public int getHeaderRowCount() { return headerRowCount; }
        public void setHeaderRowCount(int headerRowCount) { this.headerRowCount = headerRowCount; }
        public List<String> getMergedHeaders() { return mergedHeaders; }
        public void setMergedHeaders(List<String> mergedHeaders) { this.mergedHeaders = mergedHeaders; }
        public List<CellRangeAddress> getMergedRegions() { return mergedRegions; }
    }

    /**
     * 使用 Apache POI 检测多层表头结构
     *
     * 检测逻辑：
     * 1. 扫描前 N 行（maxHeaderRows）的合并单元格
     * 2. 如果存在跨多行的合并单元格，或前几行都是非数据行，则判定为多层表头
     * 3. 返回表头行数和合并单元格信息
     *
     * @param inputStream Excel 输入流
     * @param sheetIndex  Sheet 索引
     * @param maxHeaderRows 最大扫描行数
     * @return 多层表头检测结果
     */
    private MultiHeaderInfo detectMultiHeader(InputStream inputStream, int sheetIndex, int maxHeaderRows) {
        MultiHeaderInfo info = new MultiHeaderInfo();

        try (Workbook workbook = WorkbookFactory.create(inputStream)) {
            Sheet sheet = workbook.getSheetAt(sheetIndex);

            // 1. 收集所有影响表头区域的合并单元格
            List<CellRangeAddress> headerMergedRegions = new ArrayList<>();
            for (CellRangeAddress region : sheet.getMergedRegions()) {
                // 只关注表头区域内的合并单元格
                if (region.getFirstRow() < maxHeaderRows) {
                    headerMergedRegions.add(region);
                    log.debug("发现表头区域合并单元格: row[{}-{}], col[{}-{}]",
                            region.getFirstRow(), region.getLastRow(),
                            region.getFirstColumn(), region.getLastColumn());
                }
            }
            info.getMergedRegions().addAll(headerMergedRegions);

            // 2. 判断是否存在多层表头
            // 条件1: 存在跨行的合并单元格
            boolean hasRowSpanMerge = headerMergedRegions.stream()
                    .anyMatch(r -> r.getFirstRow() != r.getLastRow());

            // 条件2: 存在跨列的合并单元格（通常是顶层表头）
            boolean hasColSpanMerge = headerMergedRegions.stream()
                    .anyMatch(r -> r.getFirstColumn() != r.getLastColumn());

            // 条件3: 检查前几行是否都是文本（非数据行）
            int textOnlyRowCount = countTextOnlyRows(sheet, maxHeaderRows);

            // 综合判断
            if (hasRowSpanMerge || (hasColSpanMerge && textOnlyRowCount > 1)) {
                info.setHasMultiHeader(true);
                info.setHeaderRowCount(Math.max(2, textOnlyRowCount));
                log.info("检测到多层表头: headerRowCount={}, rowSpanMerge={}, colSpanMerge={}",
                        info.getHeaderRowCount(), hasRowSpanMerge, hasColSpanMerge);
            } else if (hasColSpanMerge) {
                // 只有跨列合并但没有跨行，可能是简单的分组表头
                info.setHasMultiHeader(true);
                info.setHeaderRowCount(textOnlyRowCount > 1 ? textOnlyRowCount : 2);
                log.info("检测到分组表头: headerRowCount={}", info.getHeaderRowCount());
            }

            // 3. 如果检测到多层表头，执行智能合并
            if (info.isHasMultiHeader()) {
                List<String> mergedHeaders = mergeMultiRowHeaders(sheet, info.getHeaderRowCount(), headerMergedRegions);
                info.setMergedHeaders(mergedHeaders);
                log.info("智能合并后的表头: {}", mergedHeaders);
            }

        } catch (Exception e) {
            log.warn("多层表头检测失败，将使用默认表头解析: {}", e.getMessage());
        }

        return info;
    }

    /**
     * 计算连续的文本行数量（非数据行）
     * 用于判断表头区域的行数
     */
    private int countTextOnlyRows(Sheet sheet, int maxRows) {
        int textOnlyCount = 0;

        for (int rowIdx = 0; rowIdx < Math.min(maxRows, sheet.getLastRowNum() + 1); rowIdx++) {
            Row row = sheet.getRow(rowIdx);
            if (row == null) {
                break; // 空行视为表头结束
            }

            // 统计该行的数值单元格比例
            int numericCount = 0;
            int nonEmptyCount = 0;

            for (int colIdx = 0; colIdx < row.getLastCellNum(); colIdx++) {
                Cell cell = row.getCell(colIdx);
                if (cell != null) {
                    String value = getCellValueAsString(cell);
                    if (value != null && !value.trim().isEmpty()) {
                        nonEmptyCount++;
                        if (isNumericValue(value)) {
                            numericCount++;
                        }
                    }
                }
            }

            // 如果数值占比超过 50%，认为是数据行
            if (nonEmptyCount > 0 && (double) numericCount / nonEmptyCount > 0.5) {
                break;
            }

            textOnlyCount++;
        }

        return Math.max(1, textOnlyCount);
    }

    /**
     * 智能合并多行表头为单行
     *
     * 合并策略：
     * 1. 对于合并单元格，将其值扩展到所有被合并的列
     * 2. 将多行表头按 "父级_子级" 的格式拼接
     * 3. 空值自动填充为上一行对应位置的值
     *
     * 示例：
     *   |   2025年1月   |   2025年2月   |
     *   | 预算数 | 实际数 | 预算数 | 实际数 |
     * 结果：
     *   2025年1月_预算数, 2025年1月_实际数, 2025年2月_预算数, 2025年2月_实际数
     *
     * @param sheet Sheet 对象
     * @param headerRowCount 表头行数
     * @param mergedRegions 合并单元格列表
     * @return 合并后的表头列表
     */
    private List<String> mergeMultiRowHeaders(Sheet sheet, int headerRowCount, List<CellRangeAddress> mergedRegions) {
        // 获取最大列数
        int maxCols = 0;
        for (int rowIdx = 0; rowIdx < headerRowCount; rowIdx++) {
            Row row = sheet.getRow(rowIdx);
            if (row != null && row.getLastCellNum() > maxCols) {
                maxCols = row.getLastCellNum();
            }
        }

        if (maxCols == 0) {
            log.warn("未能获取表头列数");
            return Collections.emptyList();
        }

        log.debug("开始合并多层表头: headerRowCount={}, maxCols={}", headerRowCount, maxCols);

        // 构建表头矩阵（行 x 列）
        String[][] headerMatrix = new String[headerRowCount][maxCols];

        // 1. 首先填充基础值
        for (int rowIdx = 0; rowIdx < headerRowCount; rowIdx++) {
            Row row = sheet.getRow(rowIdx);
            if (row != null) {
                for (int colIdx = 0; colIdx < maxCols; colIdx++) {
                    Cell cell = row.getCell(colIdx);
                    String value = (cell != null) ? getCellValueAsString(cell) : null;
                    headerMatrix[rowIdx][colIdx] = (value != null && !value.trim().isEmpty()) ? value.trim() : null;
                }
            }
        }

        // 2. 处理合并单元格 - 将合并区域的值填充到所有被合并的单元格
        for (CellRangeAddress region : mergedRegions) {
            if (region.getFirstRow() >= headerRowCount) continue;

            // 获取合并单元格的值（取左上角）
            Row firstRow = sheet.getRow(region.getFirstRow());
            String mergedValue = null;
            if (firstRow != null) {
                Cell firstCell = firstRow.getCell(region.getFirstColumn());
                if (firstCell != null) {
                    mergedValue = getCellValueAsString(firstCell);
                    if (mergedValue != null) {
                        mergedValue = mergedValue.trim();
                        if (mergedValue.isEmpty()) mergedValue = null;
                    }
                }
            }

            // 将值填充到合并区域的所有单元格
            if (mergedValue != null) {
                for (int r = region.getFirstRow(); r <= Math.min(region.getLastRow(), headerRowCount - 1); r++) {
                    for (int c = region.getFirstColumn(); c <= Math.min(region.getLastColumn(), maxCols - 1); c++) {
                        headerMatrix[r][c] = mergedValue;
                    }
                }
                log.debug("填充合并单元格 [{},{}] -> [{},{}]: {}",
                        region.getFirstRow(), region.getFirstColumn(),
                        region.getLastRow(), region.getLastColumn(), mergedValue);
            }
        }

        // 3. 向下填充空值（类似 Excel 的向下填充）
        for (int colIdx = 0; colIdx < maxCols; colIdx++) {
            String lastValue = null;
            for (int rowIdx = 0; rowIdx < headerRowCount; rowIdx++) {
                if (headerMatrix[rowIdx][colIdx] != null) {
                    lastValue = headerMatrix[rowIdx][colIdx];
                } else if (lastValue != null) {
                    headerMatrix[rowIdx][colIdx] = lastValue;
                }
            }
        }

        // 4. 合并多行为单个表头名
        List<String> result = new ArrayList<>();
        for (int colIdx = 0; colIdx < maxCols; colIdx++) {
            StringBuilder headerBuilder = new StringBuilder();
            Set<String> usedParts = new LinkedHashSet<>(); // 避免重复

            for (int rowIdx = 0; rowIdx < headerRowCount; rowIdx++) {
                String part = headerMatrix[rowIdx][colIdx];
                if (part != null && !part.isEmpty() && !usedParts.contains(part)) {
                    usedParts.add(part);
                }
            }

            // 用下划线连接各层级
            String mergedHeader = String.join("_", usedParts);

            // 如果合并后为空，使用默认列名
            if (mergedHeader.isEmpty()) {
                mergedHeader = "Column_" + colIdx;
            }

            result.add(mergedHeader);
            log.debug("列[{}] 合并结果: {} -> {}", colIdx, Arrays.toString(headerMatrix), mergedHeader);
        }

        return result;
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
        private final List<String> overrideHeaders; // 预合并的表头（可选）

        private List<String> headers = new ArrayList<>();
        private List<Map<String, Object>> sampleData = new ArrayList<>();
        private AtomicInteger rowCount = new AtomicInteger(0);
        private String sheetName;
        private boolean headersExtracted = false;
        private boolean firstRowIsHeader = false;

        public DynamicExcelListener(int headerRowIndex, int sampleRowCount, boolean skipEmptyRows) {
            this(headerRowIndex, sampleRowCount, skipEmptyRows, null);
        }

        public DynamicExcelListener(int headerRowIndex, int sampleRowCount, boolean skipEmptyRows, List<String> overrideHeaders) {
            this.headerRowIndex = headerRowIndex;
            this.sampleRowCount = sampleRowCount;
            this.skipEmptyRows = skipEmptyRows;
            this.overrideHeaders = overrideHeaders;

            // 如果有预合并的表头，直接使用
            if (overrideHeaders != null && !overrideHeaders.isEmpty()) {
                this.headers = new ArrayList<>(overrideHeaders);
                this.headersExtracted = true;
                log.info("使用预合并的多层表头: {}", this.headers);
            }
        }

        @Override
        public void invokeHeadMap(Map<Integer, String> headMap, AnalysisContext context) {
            log.info("invokeHeadMap 被调用: headMap={}, isEmpty={}, hasOverrideHeaders={}",
                    headMap, headMap == null || headMap.isEmpty(), overrideHeaders != null);

            // 如果已有预合并的表头，跳过默认提取
            if (headersExtracted && overrideHeaders != null && !overrideHeaders.isEmpty()) {
                this.sheetName = context.readSheetHolder().getSheetName();
                log.info("使用预合并表头，跳过 EasyExcel 表头提取: headers={}", headers);
                return;
            }

            // 获取表头
            this.headers = new ArrayList<>();
            if (headMap != null && !headMap.isEmpty()) {
                int maxColumn = headMap.keySet().stream().mapToInt(Integer::intValue).max().orElse(-1);
                for (int i = 0; i <= maxColumn; i++) {
                    String header = headMap.get(i);
                    this.headers.add(header != null ? header.trim() : "Column_" + i);
                }
                this.headersExtracted = true;
                log.info("从 headMap 提取表头成功: headers={}", headers);
            }
            this.sheetName = context.readSheetHolder().getSheetName();
            log.debug("读取表头: headers={}, sheetName={}", headers, sheetName);
        }

        @Override
        public void invoke(Map<Integer, Object> data, AnalysisContext context) {
            log.debug("invoke 被调用: rowNum={}, dataSize={}, headersSize={}",
                    rowCount.get(), data.size(), headers.size());

            // 如果 sheetName 还没获取，现在获取
            if (this.sheetName == null) {
                this.sheetName = context.readSheetHolder().getSheetName();
            }

            // 回退机制：如果 invokeHeadMap 没有提取到表头，从第一行数据提取
            if (!headersExtracted && headers.isEmpty() && !data.isEmpty()) {
                int maxColumn = data.keySet().stream().mapToInt(Integer::intValue).max().orElse(-1);
                log.info("Headers 为空，尝试从第一行数据提取。maxColumn={}, data={}", maxColumn, data);

                // 检查第一行是否看起来像表头（包含非纯数字的文本）
                boolean looksLikeHeader = data.values().stream()
                        .filter(Objects::nonNull)
                        .map(Object::toString)
                        .anyMatch(v -> !v.trim().isEmpty() && !isNumericValue(v));

                if (looksLikeHeader && headerRowIndex >= 0) {
                    // 第一行数据实际上是表头
                    for (int i = 0; i <= maxColumn; i++) {
                        Object value = data.get(i);
                        String header = value != null ? value.toString().trim() : "Column_" + i;
                        if (header.isEmpty()) {
                            header = "Column_" + i;
                        }
                        headers.add(header);
                    }
                    headersExtracted = true;
                    firstRowIsHeader = true;
                    log.info("从第一行数据提取表头: headers={}", headers);
                    // 跳过这一行，不计入数据行
                    return;
                } else {
                    // 使用默认列名
                    for (int i = 0; i <= maxColumn; i++) {
                        headers.add("Column_" + i);
                    }
                    headersExtracted = true;
                    log.warn("使用默认列名: headers={}", headers);
                }
            }

            rowCount.incrementAndGet();

            // 采样数据
            if (sampleData.size() < sampleRowCount) {
                // 检查是否为空行
                boolean isEmpty = data.values().stream()
                        .allMatch(v -> v == null || v.toString().trim().isEmpty());

                if (!skipEmptyRows || !isEmpty) {
                    Map<String, Object> rowData = new LinkedHashMap<>();
                    int maxDataColumn = data.keySet().stream().mapToInt(Integer::intValue).max().orElse(-1);

                    // 使用 headers 或 data 的列数，取较大者
                    int columnCount = Math.max(headers.size(), maxDataColumn + 1);

                    for (int i = 0; i < columnCount; i++) {
                        Object value = data.get(i);
                        String headerName = i < headers.size() ? headers.get(i) : "Column_" + i;
                        rowData.put(headerName, value);
                    }
                    sampleData.add(rowData);
                    log.debug("添加样本行: rowData={}", rowData);
                }
            }
        }

        @Override
        public void doAfterAllAnalysed(AnalysisContext context) {
            log.info("Excel读取完成: totalRows={}, sampledRows={}, headers={}",
                    rowCount.get(), sampleData.size(), headers);
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
        private boolean headersExtracted = false;

        public HeaderOnlyListener(int headerRowIndex) {
            this.headerRowIndex = headerRowIndex;
        }

        @Override
        public void invokeHeadMap(Map<Integer, String> headMap, AnalysisContext context) {
            log.info("HeaderOnlyListener.invokeHeadMap 被调用: headMap={}", headMap);
            if (headMap != null && !headMap.isEmpty()) {
                int maxColumn = headMap.keySet().stream().mapToInt(Integer::intValue).max().orElse(-1);
                for (int i = 0; i <= maxColumn; i++) {
                    String header = headMap.get(i);
                    headers.add(header != null ? header.trim() : "Column_" + i);
                }
                headersExtracted = true;
                log.info("HeaderOnlyListener 从 headMap 提取表头: headers={}", headers);
            }
        }

        @Override
        public void invoke(Map<Integer, Object> data, AnalysisContext context) {
            // 回退机制：如果 invokeHeadMap 没有提取到表头，从第一行数据提取
            if (!headersExtracted && headers.isEmpty() && !data.isEmpty()) {
                int maxColumn = data.keySet().stream().mapToInt(Integer::intValue).max().orElse(-1);
                for (int i = 0; i <= maxColumn; i++) {
                    Object value = data.get(i);
                    String header = value != null ? value.toString().trim() : "Column_" + i;
                    if (header.isEmpty()) {
                        header = "Column_" + i;
                    }
                    headers.add(header);
                }
                headersExtracted = true;
                log.info("HeaderOnlyListener 从第一行数据提取表头: headers={}", headers);
            }
        }

        @Override
        public void doAfterAllAnalysed(AnalysisContext context) {
            log.debug("HeaderOnlyListener 完成: headers={}", headers);
        }

        public List<String> getHeaders() {
            return headers;
        }
    }

    // ==================== Sheet 列表功能 ====================

    @Override
    public List<SheetInfo> listSheets(InputStream inputStream) {
        log.info("开始获取 Excel Sheet 列表");
        List<SheetInfo> sheetInfoList = new ArrayList<>();

        try (Workbook workbook = WorkbookFactory.create(inputStream)) {
            int numberOfSheets = workbook.getNumberOfSheets();
            log.info("Excel 文件包含 {} 个 Sheet", numberOfSheets);

            for (int i = 0; i < numberOfSheets; i++) {
                Sheet sheet = workbook.getSheetAt(i);
                String sheetName = sheet.getSheetName();
                int physicalRows = sheet.getPhysicalNumberOfRows();
                int maxColumnCount = getMaxColumnCount(sheet);
                boolean isEmpty = physicalRows == 0;

                // 获取预览表头（第一行）
                List<String> previewHeaders = new ArrayList<>();
                if (!isEmpty) {
                    Row firstRow = sheet.getRow(sheet.getFirstRowNum());
                    if (firstRow != null) {
                        int maxCols = Math.min(firstRow.getLastCellNum(), 10); // 最多预览10列
                        for (int j = 0; j < maxCols; j++) {
                            if (firstRow.getCell(j) != null) {
                                String cellValue = getCellValueAsString(firstRow.getCell(j));
                                previewHeaders.add(cellValue != null && !cellValue.isEmpty()
                                        ? cellValue : "Column_" + j);
                            } else {
                                previewHeaders.add("Column_" + j);
                            }
                        }
                    }
                }

                SheetInfo sheetInfo = SheetInfo.builder()
                        .index(i)
                        .name(sheetName)
                        .rowCount(physicalRows)
                        .columnCount(maxColumnCount)
                        .empty(isEmpty)
                        .previewHeaders(previewHeaders)
                        .build();

                sheetInfoList.add(sheetInfo);
                log.debug("Sheet[{}] {}: {} 行, {} 列, empty={}",
                        i, sheetName, physicalRows, maxColumnCount, isEmpty);
            }

            log.info("成功获取 {} 个 Sheet 的信息", sheetInfoList.size());
            return sheetInfoList;

        } catch (Exception e) {
            log.error("获取 Sheet 列表失败: {}", e.getMessage(), e);
            throw new RuntimeException("获取 Sheet 列表失败: " + e.getMessage(), e);
        }
    }

    /**
     * 获取 Sheet 的最大列数
     */
    private int getMaxColumnCount(Sheet sheet) {
        int maxCols = 0;
        for (int i = 0; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row != null) {
                int cols = row.getLastCellNum();
                if (cols > maxCols) {
                    maxCols = cols;
                }
            }
            // 只扫描前100行以提高性能
            if (i >= 100) break;
        }
        return maxCols;
    }

    /**
     * 获取单元格值（字符串形式）
     */
    private String getCellValueAsString(org.apache.poi.ss.usermodel.Cell cell) {
        if (cell == null) {
            return null;
        }
        try {
            switch (cell.getCellType()) {
                case STRING:
                    return cell.getStringCellValue();
                case NUMERIC:
                    if (org.apache.poi.ss.usermodel.DateUtil.isCellDateFormatted(cell)) {
                        return cell.getLocalDateTimeCellValue().toLocalDate().toString();
                    }
                    double numVal = cell.getNumericCellValue();
                    if (numVal == Math.floor(numVal)) {
                        return String.valueOf((long) numVal);
                    }
                    return String.valueOf(numVal);
                case BOOLEAN:
                    return String.valueOf(cell.getBooleanCellValue());
                case FORMULA:
                    try {
                        return cell.getStringCellValue();
                    } catch (Exception e) {
                        return String.valueOf(cell.getNumericCellValue());
                    }
                case BLANK:
                    return "";
                default:
                    return "";
            }
        } catch (Exception e) {
            log.warn("获取单元格值失败: {}", e.getMessage());
            return "";
        }
    }
}
