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

        List<SmartBiSalesData> entities = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            try {
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
                        .amount(getDecimalValue(row, fieldMap, "amount"))
                        .unitPrice(getDecimalValue(row, fieldMap, "unit_price"))
                        .cost(getDecimalValue(row, fieldMap, "cost"))
                        .profit(getDecimalValue(row, fieldMap, "profit"))
                        .grossMargin(getDecimalValue(row, fieldMap, "gross_margin"))
                        .monthlyTarget(getDecimalValue(row, fieldMap, "monthly_target"))
                        .build();

                // 设置默认日期（如果没有订单日期）
                if (entity.getOrderDate() == null) {
                    entity.setOrderDate(LocalDate.now());
                }

                entities.add(entity);
            } catch (Exception e) {
                log.warn("解析销售数据行失败: {}", e.getMessage());
            }
        }

        if (!entities.isEmpty()) {
            salesDataRepository.saveAll(entities);
        }

        return entities.size();
    }

    private int persistFinanceData(String factoryId, Long uploadId,
                                    List<Map<String, Object>> rows, Map<String, String> fieldMap) {
        if (rows == null || rows.isEmpty()) {
            return 0;
        }

        List<SmartBiFinanceData> entities = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            try {
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
                        .totalCost(getDecimalValue(row, fieldMap, "total_cost"))
                        .receivableAmount(getDecimalValue(row, fieldMap, "receivable_amount"))
                        .collectionAmount(getDecimalValue(row, fieldMap, "collection_amount"))
                        .agingDays(getIntValue(row, fieldMap, "aging_days"))
                        .payableAmount(getDecimalValue(row, fieldMap, "payable_amount"))
                        .paymentAmount(getDecimalValue(row, fieldMap, "payment_amount"))
                        .budgetAmount(getDecimalValue(row, fieldMap, "budget_amount"))
                        .actualAmount(getDecimalValue(row, fieldMap, "actual_amount"))
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

                entities.add(entity);
            } catch (Exception e) {
                log.warn("解析财务数据行失败: {}", e.getMessage());
            }
        }

        if (!entities.isEmpty()) {
            financeDataRepository.saveAll(entities);
        }

        return entities.size();
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
