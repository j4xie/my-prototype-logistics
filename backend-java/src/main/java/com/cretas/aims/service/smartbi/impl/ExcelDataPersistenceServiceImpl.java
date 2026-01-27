package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.DataFeatureResult;
import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import com.cretas.aims.entity.smartbi.SmartBiExcelUpload;
import com.cretas.aims.entity.smartbi.SmartBiFinanceData;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.entity.smartbi.enums.RecordType;
import com.cretas.aims.entity.smartbi.enums.UploadStatus;
import com.cretas.aims.repository.smartbi.SmartBiExcelUploadRepository;
import com.cretas.aims.repository.smartbi.SmartBiFinanceDataRepository;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import com.cretas.aims.service.smartbi.ExcelDataPersistenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Excel 数据持久化服务实现
 *
 * 实现 Excel 数据解析后的持久化逻辑：
 * 1. 自动检测数据类型（销售/财务/部门）
 * 2. 根据字段映射转换数据
 * 3. 批量保存到相应的数据表
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExcelDataPersistenceServiceImpl implements ExcelDataPersistenceService {

    private final SmartBiSalesDataRepository salesDataRepository;
    private final SmartBiFinanceDataRepository financeDataRepository;
    private final SmartBiExcelUploadRepository uploadRepository;

    // 销售数据关键字段
    private static final Set<String> SALES_KEYWORDS = Set.of(
            "销售额", "销售金额", "订单金额", "销售员", "销售日期", "客户", "产品",
            "sales", "amount", "salesperson", "order", "customer", "product"
    );

    // 财务数据关键字段
    private static final Set<String> FINANCE_KEYWORDS = Set.of(
            "成本", "费用", "预算", "应收", "应付", "收入", "利润", "毛利",
            "cost", "expense", "budget", "receivable", "payable", "revenue", "profit"
    );

    // 日期格式
    private static final List<DateTimeFormatter> DATE_FORMATTERS = Arrays.asList(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("yyyyMMdd"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("yyyy-M-d"),
            DateTimeFormatter.ofPattern("yyyy/M/d")
    );

    @Override
    public DataType detectDataType(ExcelParseResponse parseResponse) {
        if (parseResponse == null || parseResponse.getHeaders() == null) {
            return DataType.UNKNOWN;
        }

        Set<String> headerLower = parseResponse.getHeaders().stream()
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        // 计算匹配分数
        long salesScore = headerLower.stream()
                .filter(h -> SALES_KEYWORDS.stream().anyMatch(k -> h.contains(k.toLowerCase())))
                .count();

        long financeScore = headerLower.stream()
                .filter(h -> FINANCE_KEYWORDS.stream().anyMatch(k -> h.contains(k.toLowerCase())))
                .count();

        log.debug("数据类型检测 - salesScore: {}, financeScore: {}", salesScore, financeScore);

        if (salesScore > financeScore && salesScore >= 2) {
            return DataType.SALES;
        } else if (financeScore > salesScore && financeScore >= 2) {
            return DataType.FINANCE;
        }

        // 通过字段映射结果判断
        if (parseResponse.getFieldMappings() != null) {
            long salesMappings = parseResponse.getFieldMappings().stream()
                    .filter(m -> m.getStandardField() != null)
                    .filter(m -> isSalesField(m.getStandardField()))
                    .count();

            long financeMappings = parseResponse.getFieldMappings().stream()
                    .filter(m -> m.getStandardField() != null)
                    .filter(m -> isFinanceField(m.getStandardField()))
                    .count();

            if (salesMappings > financeMappings) {
                return DataType.SALES;
            } else if (financeMappings > salesMappings) {
                return DataType.FINANCE;
            }
        }

        return DataType.UNKNOWN;
    }

    @Override
    @Transactional
    public PersistenceResult persistData(String factoryId, ExcelParseResponse parseResponse, DataType dataType) {
        return persistData(factoryId, parseResponse, parseResponse.getFieldMappings(), dataType);
    }

    @Override
    @Transactional
    public PersistenceResult persistData(String factoryId,
                                          ExcelParseResponse parseResponse,
                                          List<FieldMappingResult> confirmedMappings,
                                          DataType dataType) {
        log.info("开始持久化 Excel 数据: factoryId={}, dataType={}, rows={}",
                factoryId, dataType, parseResponse.getRowCount());

        // 自动检测数据类型（如果未指定）
        if (dataType == null || dataType == DataType.UNKNOWN) {
            dataType = detectDataType(parseResponse);
            log.info("自动检测数据类型: {}", dataType);
        }

        if (dataType == DataType.UNKNOWN) {
            return PersistenceResult.failure("无法识别数据类型，请手动指定", null);
        }

        try {
            // 创建上传记录
            SmartBiExcelUpload upload = createUploadRecord(factoryId, parseResponse, dataType);
            Long uploadId = upload.getId();

            // 构建字段映射 Map
            Map<String, String> fieldMap = buildFieldMap(confirmedMappings);
            log.debug("字段映射: {}", fieldMap);

            // 根据数据类型保存数据
            int savedRows;
            switch (dataType) {
                case SALES:
                    savedRows = persistSalesData(factoryId, uploadId, parseResponse.getPreviewData(), fieldMap);
                    break;
                case FINANCE:
                    savedRows = persistFinanceData(factoryId, uploadId, parseResponse.getPreviewData(), fieldMap);
                    break;
                default:
                    return PersistenceResult.failure("不支持的数据类型: " + dataType, null);
            }

            // 更新上传记录状态
            upload.setUploadStatus(UploadStatus.COMPLETED);
            upload.setRowCount(savedRows);
            uploadRepository.save(upload);

            log.info("数据持久化完成: uploadId={}, savedRows={}", uploadId, savedRows);
            return PersistenceResult.success(dataType, savedRows, uploadId);

        } catch (Exception e) {
            log.error("数据持久化失败: {}", e.getMessage(), e);
            return PersistenceResult.failure("保存失败: " + e.getMessage(), List.of(e.getMessage()));
        }
    }

    @Override
    @Transactional
    public int deleteByUploadId(Long uploadId) {
        log.info("删除上传数据: uploadId={}", uploadId);
        salesDataRepository.deleteByUploadId(uploadId);
        financeDataRepository.deleteByUploadId(uploadId);
        return 0; // 返回实际删除数量需要修改 repository 方法
    }

    @Override
    public List<String> getStandardFields(DataType dataType) {
        switch (dataType) {
            case SALES:
                return Arrays.asList(
                        "order_date", "salesperson_id", "salesperson_name", "department",
                        "region", "province", "city", "customer_name", "customer_type",
                        "product_id", "product_name", "product_category",
                        "quantity", "amount", "unit_price", "cost", "profit", "gross_margin", "monthly_target"
                );
            case FINANCE:
                return Arrays.asList(
                        "record_date", "record_type", "department", "category",
                        "customer_name", "supplier_name",
                        "material_cost", "labor_cost", "overhead_cost", "total_cost",
                        "receivable_amount", "collection_amount", "aging_days",
                        "payable_amount", "payment_amount",
                        "budget_amount", "actual_amount", "variance_amount", "due_date"
                );
            default:
                return Collections.emptyList();
        }
    }

    // ==================== 私有方法 ====================

    private SmartBiExcelUpload createUploadRecord(String factoryId, ExcelParseResponse parseResponse, DataType dataType) {
        SmartBiExcelUpload upload = SmartBiExcelUpload.builder()
                .factoryId(factoryId)
                .fileName(parseResponse.getMetadata() != null ? parseResponse.getMetadata().getSheetName() : "unknown")
                .uploadStatus(UploadStatus.PARSING)
                .rowCount(parseResponse.getRowCount())
                .columnCount(parseResponse.getColumnCount())
                .dataFeatures("{\"dataType\": \"" + dataType.name() + "\"}")
                .build();

        return uploadRepository.save(upload);
    }

    private Map<String, String> buildFieldMap(List<FieldMappingResult> mappings) {
        if (mappings == null) {
            return Collections.emptyMap();
        }

        return mappings.stream()
                .filter(m -> m.getStandardField() != null && !m.getStandardField().isEmpty())
                .collect(Collectors.toMap(
                        FieldMappingResult::getOriginalColumn,
                        FieldMappingResult::getStandardField,
                        (a, b) -> a
                ));
    }

    private int persistSalesData(String factoryId, Long uploadId,
                                  List<Map<String, Object>> rows, Map<String, String> fieldMap) {
        if (rows == null || rows.isEmpty()) {
            return 0;
        }

        // 检测是否为宽格式数据
        boolean isWideFormat = isWideFormatData(fieldMap);
        log.debug("销售数据格式检测: isWideFormat={}", isWideFormat);

        List<SmartBiSalesData> entities = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            try {
                if (isWideFormat) {
                    // 宽格式：每个月份列创建一条记录
                    entities.addAll(persistWideFormatSalesRow(factoryId, uploadId, row, fieldMap));
                } else {
                    // 标准格式：直接映射
                    SmartBiSalesData entity = persistStandardSalesRow(factoryId, uploadId, row, fieldMap);
                    if (entity != null) {
                        entities.add(entity);
                    }
                }
            } catch (Exception e) {
                log.warn("解析销售数据行失败: {}", e.getMessage());
            }
        }

        if (!entities.isEmpty()) {
            salesDataRepository.saveAll(entities);
        }

        return entities.size();
    }

    /**
     * 标准格式销售数据处理
     */
    private SmartBiSalesData persistStandardSalesRow(String factoryId, Long uploadId,
                                                      Map<String, Object> row, Map<String, String> fieldMap) {
        // 如果标准字段都是0，尝试聚合所有数值列
        BigDecimal amount = getDecimalValue(row, fieldMap, "amount");
        if (amount.compareTo(BigDecimal.ZERO) == 0) {
            amount = aggregateNumericValues(row, fieldMap);
        }

        SmartBiSalesData entity = SmartBiSalesData.builder()
                .factoryId(factoryId)
                .uploadId(uploadId)
                .orderDate(parseDateValue(getFieldValue(row, fieldMap, "order_date")))
                .salespersonId(getStringValue(row, fieldMap, "salesperson_id"))
                .salespersonName(getStringValue(row, fieldMap, "salesperson_name"))
                .department(getStringValue(row, fieldMap, "department"))
                .region(getStringValue(row, fieldMap, "region"))
                .province(getStringValue(row, fieldMap, "province"))
                .city(getStringValue(row, fieldMap, "city"))
                .customerName(getStringValue(row, fieldMap, "customer_name"))
                .customerType(getStringValue(row, fieldMap, "customer_type"))
                .productId(getStringValue(row, fieldMap, "product_id"))
                .productName(getStringValue(row, fieldMap, "product_name"))
                .productCategory(getStringValue(row, fieldMap, "product_category"))
                .quantity(getDecimalValue(row, fieldMap, "quantity"))
                .amount(amount)
                .unitPrice(getDecimalValue(row, fieldMap, "unit_price"))
                .cost(getDecimalValue(row, fieldMap, "cost"))
                .profit(getDecimalValue(row, fieldMap, "profit"))
                .grossMargin(getDecimalValue(row, fieldMap, "gross_margin"))
                .monthlyTarget(getDecimalValue(row, fieldMap, "monthly_target"))
                .build();

        // 设置默认日期
        if (entity.getOrderDate() == null) {
            entity.setOrderDate(LocalDate.now());
        }

        return entity;
    }

    /**
     * 宽格式销售数据处理
     */
    private List<SmartBiSalesData> persistWideFormatSalesRow(String factoryId, Long uploadId,
                                                              Map<String, Object> row, Map<String, String> fieldMap) {
        List<SmartBiSalesData> results = new ArrayList<>();

        // 提取维度字段
        String region = getStringValue(row, fieldMap, "region");
        String department = getStringValue(row, fieldMap, "department");
        String productName = getStringValue(row, fieldMap, "product_name");
        String customerName = getStringValue(row, fieldMap, "customer_name");

        // 如果没有找到，尝试从行数据获取
        if ((region == null || region.isEmpty()) && (department == null || department.isEmpty())) {
            String dimension = findDimensionValue(row, fieldMap);
            if (dimension != null) {
                region = dimension;
            }
        }

        int currentYear = LocalDate.now().getYear();

        // 遍历所有列
        for (Map.Entry<String, Object> rowEntry : row.entrySet()) {
            String columnName = rowEntry.getKey();
            Object valueObj = rowEntry.getValue();

            if (!isNumericValue(valueObj)) {
                continue;
            }

            BigDecimal amount = parseDecimal(valueObj);
            if (amount.compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }

            // 尝试从列名解析月份
            LocalDate orderDate = null;
            String productCategory = null;

            // 中文月份格式
            java.util.regex.Pattern monthPattern = java.util.regex.Pattern.compile(".*[_]?(1[0-2]|[1-9])月[_]?(.*)");
            java.util.regex.Matcher matcher = monthPattern.matcher(columnName);
            if (matcher.find()) {
                int month = Integer.parseInt(matcher.group(1));
                orderDate = LocalDate.of(currentYear, month, 1);
                String typeStr = matcher.group(2);
                if (typeStr != null && !typeStr.isEmpty()) {
                    productCategory = typeStr.replaceAll("^[_]", "").trim();
                }
            }

            // 检查 fieldMap 格式
            String standardField = fieldMap.get(columnName);
            if (standardField != null && standardField.matches("(value|amount)_\\d{6}")) {
                String yearMonth = standardField.substring(standardField.length() - 6);
                orderDate = parseYearMonth(yearMonth);
            }

            if (orderDate == null) {
                continue;
            }

            SmartBiSalesData entity = SmartBiSalesData.builder()
                    .factoryId(factoryId)
                    .uploadId(uploadId)
                    .orderDate(orderDate)
                    .region(region)
                    .department(department)
                    .productName(productName)
                    .productCategory(productCategory)
                    .customerName(customerName)
                    .amount(amount)
                    .build();

            results.add(entity);
        }

        return results;
    }

    private int persistFinanceData(String factoryId, Long uploadId,
                                    List<Map<String, Object>> rows, Map<String, String> fieldMap) {
        if (rows == null || rows.isEmpty()) {
            return 0;
        }

        // 检测是否为宽格式数据（多个 value_YYYYMM 列）
        boolean isWideFormat = isWideFormatData(fieldMap);
        log.debug("财务数据格式检测: isWideFormat={}, fieldMap={}", isWideFormat, fieldMap);

        List<SmartBiFinanceData> entities = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            try {
                if (isWideFormat) {
                    // 宽格式：每个月份列创建一条记录
                    entities.addAll(persistWideFormatRow(factoryId, uploadId, row, fieldMap));
                } else {
                    // 标准格式：直接映射
                    SmartBiFinanceData entity = persistStandardFormatRow(factoryId, uploadId, row, fieldMap);
                    if (entity != null) {
                        entities.add(entity);
                    }
                }
            } catch (Exception e) {
                log.warn("解析财务数据行失败: {}", e.getMessage());
            }
        }

        if (!entities.isEmpty()) {
            financeDataRepository.saveAll(entities);
        }

        return entities.size();
    }

    /**
     * 检测是否为宽格式数据（如利润表，每列是一个月份）
     * 支持两种格式：
     * 1. standardField 格式: value_YYYYMM, profit_YYYYMM
     * 2. 原始列名格式: 1月_预算收入, 2月_实际收入 等中文月份
     */
    private boolean isWideFormatData(Map<String, String> fieldMap) {
        if (fieldMap == null || fieldMap.isEmpty()) {
            return false;
        }

        // 模式1: 检测 standardField 格式 (支持多种时间索引字段)
        // 格式: {metric_type}_YYYYMM 或 {metric_type}_YYYY
        long valueFieldCount = fieldMap.values().stream()
                .filter(v -> v != null && (
                        v.matches("(value|profit|amount|budget|actual|revenue|cost|yoy_prior|budget_amount|actual_amount|last_year_actual|net_profit)_\\d{6}") ||
                        v.matches("(annual_total|ytd_actual|ytd_budget)_\\d{4}")
                ))
                .count();

        if (valueFieldCount >= 3) {
            return true;
        }

        // 模式2: 检测原始列名中的中文月份格式 (1月_, 2月_, ... 12月_)
        long monthColumnCount = fieldMap.keySet().stream()
                .filter(k -> k != null && k.matches(".*[_]?(1[0-2]|[1-9])月[_]?.*"))
                .count();

        // 如果有3个以上的月份列，认为是宽格式
        return monthColumnCount >= 3;
    }

    /**
     * 处理宽格式行数据（如利润表的一行）
     * 每个月份值创建一条财务记录
     * 支持：
     * 1. standardField 格式: value_YYYYMM
     * 2. 原始列名中文月份: 1月_预算收入, 2月_实际收入
     */
    private List<SmartBiFinanceData> persistWideFormatRow(String factoryId, Long uploadId,
                                                          Map<String, Object> row, Map<String, String> fieldMap) {
        List<SmartBiFinanceData> results = new ArrayList<>();

        // 提取维度字段（部门、区域等）
        String department = getStringValue(row, fieldMap, "department");
        String region = getStringValue(row, fieldMap, "region");
        String category = getStringValue(row, fieldMap, "category");

        // 如果没有找到 department，尝试从第一列获取
        if ((department == null || department.isEmpty()) && (region == null || region.isEmpty())) {
            department = findDimensionValue(row, fieldMap);
        }
        // 如果有 region 但没有 department，用 region 作为 department
        if (department == null || department.isEmpty()) {
            department = region;
        }

        // 当前年份（用于中文月份解析）
        int currentYear = LocalDate.now().getYear();

        // 遍历所有列（包括原始列名和 fieldMap）
        for (Map.Entry<String, Object> rowEntry : row.entrySet()) {
            String columnName = rowEntry.getKey();
            Object valueObj = rowEntry.getValue();

            // 跳过非数值列
            if (!isNumericValue(valueObj)) {
                continue;
            }

            BigDecimal amount = parseDecimal(valueObj);
            if (amount.compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }

            // 尝试从列名解析月份信息
            LocalDate recordDate = null;
            String columnCategory = null;

            // 模式1: 中文月份格式 (如 "1月_预算收入", "12月_实际收入")
            java.util.regex.Pattern monthPattern = java.util.regex.Pattern.compile(".*[_]?(1[0-2]|[1-9])月[_]?(.*)");
            java.util.regex.Matcher matcher = monthPattern.matcher(columnName);
            if (matcher.find()) {
                int month = Integer.parseInt(matcher.group(1));
                recordDate = LocalDate.of(currentYear, month, 1);
                // 提取类型（预算收入、实际收入等）
                String typeStr = matcher.group(2);
                if (typeStr != null && !typeStr.isEmpty()) {
                    columnCategory = typeStr.replaceAll("^[_]", "").trim();
                }
            }

            // 模式2: 检查 fieldMap 中的 standardField
            String standardField = fieldMap.get(columnName);
            if (standardField != null) {
                // value_YYYYMM / budget_YYYYMM / actual_YYYYMM 等格式
                // 支持: budget, actual, revenue, cost, profit, amount, value, yoy_prior
                if (standardField.matches("(value|profit|amount|budget|actual|revenue|cost|yoy_prior|budget_amount|actual_amount|last_year_actual|net_profit)_\\d{6}")) {
                    String yearMonth = standardField.substring(standardField.length() - 6);
                    recordDate = parseYearMonth(yearMonth);
                    // 提取指标类型作为类别
                    columnCategory = standardField.substring(0, standardField.length() - 7);
                }
                // annual_total_YYYY / ytd_actual / ytd_budget 格式
                else if (standardField.matches("(annual_total|ytd_actual|ytd_budget)_\\d{4}")) {
                    String year = standardField.substring(standardField.length() - 4);
                    recordDate = LocalDate.of(Integer.parseInt(year), 12, 31);
                    columnCategory = "年度合计";
                }
            }

            // 如果无法解析月份，跳过
            if (recordDate == null) {
                continue;
            }

            // 构建实体
            SmartBiFinanceData entity = SmartBiFinanceData.builder()
                    .factoryId(factoryId)
                    .uploadId(uploadId)
                    .recordDate(recordDate)
                    .recordType(RecordType.COST)
                    .department(department)
                    .category(columnCategory != null ? columnCategory : category)
                    .totalCost(amount)
                    .actualAmount(amount)
                    .build();

            results.add(entity);
        }

        return results;
    }

    /**
     * 处理标准格式行数据
     */
    private SmartBiFinanceData persistStandardFormatRow(String factoryId, Long uploadId,
                                                         Map<String, Object> row, Map<String, String> fieldMap) {
        // 如果没有标准字段映射，尝试聚合所有数值
        BigDecimal totalCost = getDecimalValue(row, fieldMap, "total_cost");
        BigDecimal actualAmount = getDecimalValue(row, fieldMap, "actual_amount");

        // 如果标准字段都是0，尝试聚合所有数值列
        if (totalCost.compareTo(BigDecimal.ZERO) == 0 && actualAmount.compareTo(BigDecimal.ZERO) == 0) {
            BigDecimal aggregatedValue = aggregateNumericValues(row, fieldMap);
            if (aggregatedValue.compareTo(BigDecimal.ZERO) > 0) {
                totalCost = aggregatedValue;
                actualAmount = aggregatedValue;
            }
        }

        SmartBiFinanceData entity = SmartBiFinanceData.builder()
                .factoryId(factoryId)
                .uploadId(uploadId)
                .recordDate(parseDateValue(getFieldValue(row, fieldMap, "record_date")))
                .recordType(parseRecordType(getStringValue(row, fieldMap, "record_type")))
                .department(getStringValue(row, fieldMap, "department"))
                .category(getStringValue(row, fieldMap, "category"))
                .customerName(getStringValue(row, fieldMap, "customer_name"))
                .supplierName(getStringValue(row, fieldMap, "supplier_name"))
                .materialCost(getDecimalValue(row, fieldMap, "material_cost"))
                .laborCost(getDecimalValue(row, fieldMap, "labor_cost"))
                .overheadCost(getDecimalValue(row, fieldMap, "overhead_cost"))
                .totalCost(totalCost)
                .receivableAmount(getDecimalValue(row, fieldMap, "receivable_amount"))
                .collectionAmount(getDecimalValue(row, fieldMap, "collection_amount"))
                .agingDays(getIntValue(row, fieldMap, "aging_days"))
                .payableAmount(getDecimalValue(row, fieldMap, "payable_amount"))
                .paymentAmount(getDecimalValue(row, fieldMap, "payment_amount"))
                .budgetAmount(getDecimalValue(row, fieldMap, "budget_amount"))
                .actualAmount(actualAmount)
                .varianceAmount(getDecimalValue(row, fieldMap, "variance_amount"))
                .dueDate(parseDateValue(getFieldValue(row, fieldMap, "due_date")))
                .build();

        // 设置默认值
        if (entity.getRecordDate() == null) {
            entity.setRecordDate(LocalDate.now());
        }
        if (entity.getRecordType() == null) {
            entity.setRecordType(RecordType.COST);
        }

        return entity;
    }

    /**
     * 从行数据中找到维度值（第一个非数值列）
     */
    private String findDimensionValue(Map<String, Object> row, Map<String, String> fieldMap) {
        // 尝试常见的维度字段名
        for (String dimName : Arrays.asList("分部", "部门", "区域", "类别", "项目", "name", "department", "region")) {
            Object value = row.get(dimName);
            if (value != null && !value.toString().isEmpty()) {
                return value.toString().trim();
            }
        }

        // 取第一个非数值字段
        for (Map.Entry<String, Object> entry : row.entrySet()) {
            Object value = entry.getValue();
            if (value != null && !isNumericValue(value)) {
                return value.toString().trim();
            }
        }

        return null;
    }

    /**
     * 判断值是否为数值
     */
    private boolean isNumericValue(Object value) {
        if (value == null) return false;
        if (value instanceof Number) return true;

        String str = value.toString().replaceAll("[¥$€£,\\s%]", "").trim();
        try {
            Double.parseDouble(str);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /**
     * 解析 YYYYMM 格式为 LocalDate (月初)
     */
    private LocalDate parseYearMonth(String yearMonth) {
        try {
            int year = Integer.parseInt(yearMonth.substring(0, 4));
            int month = Integer.parseInt(yearMonth.substring(4, 6));
            return LocalDate.of(year, month, 1);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 解析数值
     */
    private BigDecimal parseDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;

        try {
            String strValue = value.toString()
                    .replaceAll("[¥$€£,\\s%]", "")
                    .trim();

            if (strValue.isEmpty()) return BigDecimal.ZERO;
            return new BigDecimal(strValue);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    /**
     * 聚合所有数值列的值
     */
    private BigDecimal aggregateNumericValues(Map<String, Object> row, Map<String, String> fieldMap) {
        BigDecimal total = BigDecimal.ZERO;

        for (Map.Entry<String, Object> entry : row.entrySet()) {
            Object value = entry.getValue();
            if (isNumericValue(value)) {
                total = total.add(parseDecimal(value));
            }
        }

        return total;
    }

    // ==================== 值提取辅助方法 ====================

    private Object getFieldValue(Map<String, Object> row, Map<String, String> fieldMap, String standardField) {
        // 先通过映射找原始列名
        for (Map.Entry<String, String> entry : fieldMap.entrySet()) {
            if (standardField.equals(entry.getValue())) {
                Object value = row.get(entry.getKey());
                if (value != null) {
                    return value;
                }
            }
        }
        // 直接查找
        return row.get(standardField);
    }

    private String getStringValue(Map<String, Object> row, Map<String, String> fieldMap, String standardField) {
        Object value = getFieldValue(row, fieldMap, standardField);
        return value != null ? value.toString().trim() : null;
    }

    private BigDecimal getDecimalValue(Map<String, Object> row, Map<String, String> fieldMap, String standardField) {
        Object value = getFieldValue(row, fieldMap, standardField);
        if (value == null) {
            return BigDecimal.ZERO;
        }

        try {
            String strValue = value.toString()
                    .replaceAll("[¥$€£,\\s%]", "")
                    .trim();

            if (strValue.isEmpty()) {
                return BigDecimal.ZERO;
            }
            return new BigDecimal(strValue);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private Integer getIntValue(Map<String, Object> row, Map<String, String> fieldMap, String standardField) {
        BigDecimal decimal = getDecimalValue(row, fieldMap, standardField);
        return decimal.intValue();
    }

    private LocalDate parseDateValue(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof LocalDate) {
            return (LocalDate) value;
        }

        if (value instanceof java.util.Date) {
            return ((java.util.Date) value).toInstant()
                    .atZone(java.time.ZoneId.systemDefault())
                    .toLocalDate();
        }

        String strValue = value.toString().trim();
        if (strValue.isEmpty()) {
            return null;
        }

        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return LocalDate.parse(strValue, formatter);
            } catch (DateTimeParseException ignored) {
            }
        }

        log.debug("无法解析日期: {}", strValue);
        return null;
    }

    private RecordType parseRecordType(String value) {
        if (value == null || value.isEmpty()) {
            return RecordType.COST;
        }

        String upper = value.toUpperCase();
        if (upper.contains("COST") || upper.contains("成本")) {
            return RecordType.COST;
        } else if (upper.contains("AR") || upper.contains("应收") || upper.contains("RECEIVABLE")) {
            return RecordType.AR;
        } else if (upper.contains("AP") || upper.contains("应付") || upper.contains("PAYABLE")) {
            return RecordType.AP;
        } else if (upper.contains("BUDGET") || upper.contains("预算")) {
            return RecordType.BUDGET;
        }

        try {
            return RecordType.valueOf(upper);
        } catch (IllegalArgumentException e) {
            return RecordType.COST;
        }
    }

    private boolean isSalesField(String field) {
        return field != null && (
                field.contains("sales") || field.contains("order") ||
                field.contains("customer") || field.contains("product") ||
                field.contains("salesperson") || field.contains("region")
        );
    }

    private boolean isFinanceField(String field) {
        return field != null && (
                field.contains("cost") || field.contains("budget") ||
                field.contains("receivable") || field.contains("payable") ||
                field.contains("expense") || field.contains("profit")
        );
    }
}
