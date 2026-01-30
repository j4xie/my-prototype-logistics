package com.cretas.aims.service.smartbi.util;

import com.cretas.aims.entity.smartbi.SmartBiDepartmentData;
import com.cretas.aims.entity.smartbi.SmartBiFinanceData;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.entity.smartbi.enums.RecordType;
import com.cretas.aims.entity.smartbi.postgres.SmartBiDynamicData;
import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Dynamic Data Parser Utility
 *
 * Parses JSONB row_data from SmartBiDynamicData into typed entity objects.
 * Supports flexible field name mapping with aliases for common Chinese and English variations.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Slf4j
public class DynamicDataParser {

    // Field aliases for flexible column name recognition
    private static final Map<String, List<String>> FIELD_ALIASES = new HashMap<>();

    static {
        // Sales data field aliases
        FIELD_ALIASES.put("orderDate", Arrays.asList("订单日期", "日期", "销售日期", "order_date", "date"));
        FIELD_ALIASES.put("salespersonId", Arrays.asList("销售员ID", "业务员ID", "salesperson_id"));
        FIELD_ALIASES.put("salespersonName", Arrays.asList("销售员", "业务员", "销售人员", "salesperson_name", "salesperson"));
        FIELD_ALIASES.put("department", Arrays.asList("部门", "部门名称", "所属部门", "department"));
        FIELD_ALIASES.put("region", Arrays.asList("区域", "销售区域", "大区", "region"));
        FIELD_ALIASES.put("province", Arrays.asList("省份", "省", "province"));
        FIELD_ALIASES.put("city", Arrays.asList("城市", "市", "city"));
        FIELD_ALIASES.put("customerName", Arrays.asList("客户名称", "客户", "customer_name", "customer"));
        FIELD_ALIASES.put("customerType", Arrays.asList("客户类型", "客户分类", "customer_type"));
        FIELD_ALIASES.put("productId", Arrays.asList("产品ID", "商品ID", "product_id"));
        FIELD_ALIASES.put("productName", Arrays.asList("产品名称", "商品名称", "产品", "product_name", "product"));
        FIELD_ALIASES.put("productCategory", Arrays.asList("产品分类", "商品分类", "品类", "product_category", "category"));
        FIELD_ALIASES.put("quantity", Arrays.asList("数量", "销售数量", "quantity"));
        FIELD_ALIASES.put("amount", Arrays.asList("金额", "销售额", "销售金额", "营业收入", "收入", "amount", "sales_amount"));
        FIELD_ALIASES.put("unitPrice", Arrays.asList("单价", "unit_price"));
        FIELD_ALIASES.put("cost", Arrays.asList("成本", "销售成本", "cost"));
        FIELD_ALIASES.put("profit", Arrays.asList("利润", "毛利", "profit"));
        FIELD_ALIASES.put("grossMargin", Arrays.asList("毛利率", "利润率", "gross_margin"));
        FIELD_ALIASES.put("monthlyTarget", Arrays.asList("月度目标", "销售目标", "目标", "target", "monthly_target"));

        // Finance data field aliases
        FIELD_ALIASES.put("recordDate", Arrays.asList("记录日期", "日期", "record_date", "date"));
        FIELD_ALIASES.put("recordType", Arrays.asList("记录类型", "类型", "record_type", "type"));
        FIELD_ALIASES.put("materialCost", Arrays.asList("材料成本", "原材料成本", "material_cost"));
        FIELD_ALIASES.put("laborCost", Arrays.asList("人工成本", "labor_cost"));
        FIELD_ALIASES.put("overheadCost", Arrays.asList("制造费用", "间接费用", "overhead_cost"));
        FIELD_ALIASES.put("totalCost", Arrays.asList("总成本", "成本合计", "total_cost"));
        FIELD_ALIASES.put("receivableAmount", Arrays.asList("应收金额", "应收款", "receivable_amount"));
        FIELD_ALIASES.put("collectionAmount", Arrays.asList("回款金额", "已收款", "collection_amount"));
        FIELD_ALIASES.put("agingDays", Arrays.asList("账龄", "账龄天数", "aging_days"));
        FIELD_ALIASES.put("payableAmount", Arrays.asList("应付金额", "应付款", "payable_amount"));
        FIELD_ALIASES.put("paymentAmount", Arrays.asList("付款金额", "已付款", "payment_amount"));
        FIELD_ALIASES.put("budgetAmount", Arrays.asList("预算金额", "预算", "budget_amount"));
        FIELD_ALIASES.put("actualAmount", Arrays.asList("实际金额", "实际", "actual_amount"));
        FIELD_ALIASES.put("varianceAmount", Arrays.asList("差异金额", "差异", "variance_amount"));
        FIELD_ALIASES.put("dueDate", Arrays.asList("到期日", "截止日期", "due_date"));
        FIELD_ALIASES.put("supplierName", Arrays.asList("供应商", "供应商名称", "supplier_name"));

        // Department data field aliases
        FIELD_ALIASES.put("departmentId", Arrays.asList("部门ID", "department_id"));
        FIELD_ALIASES.put("managerName", Arrays.asList("负责人", "主管", "经理", "manager_name"));
        FIELD_ALIASES.put("headcount", Arrays.asList("人数", "员工数", "headcount"));
        FIELD_ALIASES.put("salesAmount", Arrays.asList("销售额", "营业收入", "sales_amount"));
        FIELD_ALIASES.put("salesTarget", Arrays.asList("销售目标", "目标", "sales_target"));
        FIELD_ALIASES.put("costAmount", Arrays.asList("成本金额", "成本", "cost_amount"));
        FIELD_ALIASES.put("perCapitaSales", Arrays.asList("人均销售", "人均收入", "per_capita_sales"));
        FIELD_ALIASES.put("perCapitaCost", Arrays.asList("人均成本", "per_capita_cost"));
    }

    private static final List<DateTimeFormatter> DATE_FORMATTERS = Arrays.asList(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("yyyy年MM月dd日"),
            DateTimeFormatter.ofPattern("yyyyMMdd"),
            DateTimeFormatter.ofPattern("yyyy-M-d"),
            DateTimeFormatter.ofPattern("yyyy/M/d")
    );

    /**
     * Parse dynamic data into SmartBiSalesData
     */
    public static SmartBiSalesData parseSalesData(SmartBiDynamicData dynamicData) {
        if (dynamicData == null || dynamicData.getRowData() == null) {
            return null;
        }

        Map<String, Object> rowData = dynamicData.getRowData();

        try {
            return SmartBiSalesData.builder()
                    .factoryId(dynamicData.getFactoryId())
                    .uploadId(dynamicData.getUploadId())
                    .orderDate(parseDate(getFieldValue(rowData, "orderDate")))
                    .salespersonId(getString(rowData, "salespersonId"))
                    .salespersonName(getString(rowData, "salespersonName"))
                    .department(getString(rowData, "department"))
                    .region(getString(rowData, "region"))
                    .province(getString(rowData, "province"))
                    .city(getString(rowData, "city"))
                    .customerName(getString(rowData, "customerName"))
                    .customerType(getString(rowData, "customerType"))
                    .productId(getString(rowData, "productId"))
                    .productName(getString(rowData, "productName"))
                    .productCategory(getString(rowData, "productCategory"))
                    .quantity(getBigDecimal(rowData, "quantity"))
                    .amount(getBigDecimal(rowData, "amount"))
                    .unitPrice(getBigDecimal(rowData, "unitPrice"))
                    .cost(getBigDecimal(rowData, "cost"))
                    .profit(getBigDecimal(rowData, "profit"))
                    .grossMargin(getBigDecimal(rowData, "grossMargin"))
                    .monthlyTarget(getBigDecimal(rowData, "monthlyTarget"))
                    .build();
        } catch (Exception e) {
            log.warn("Failed to parse sales data from row: {}", rowData, e);
            return null;
        }
    }

    /**
     * Parse dynamic data into SmartBiFinanceData
     */
    public static SmartBiFinanceData parseFinanceData(SmartBiDynamicData dynamicData) {
        if (dynamicData == null || dynamicData.getRowData() == null) {
            return null;
        }

        Map<String, Object> rowData = dynamicData.getRowData();

        try {
            return SmartBiFinanceData.builder()
                    .factoryId(dynamicData.getFactoryId())
                    .uploadId(dynamicData.getUploadId())
                    .recordDate(parseDate(getFieldValue(rowData, "recordDate")))
                    .recordType(parseRecordType(getString(rowData, "recordType")))
                    .department(getString(rowData, "department"))
                    .category(getString(rowData, "productCategory"))
                    .customerName(getString(rowData, "customerName"))
                    .supplierName(getString(rowData, "supplierName"))
                    .materialCost(getBigDecimal(rowData, "materialCost"))
                    .laborCost(getBigDecimal(rowData, "laborCost"))
                    .overheadCost(getBigDecimal(rowData, "overheadCost"))
                    .totalCost(getBigDecimal(rowData, "totalCost"))
                    .receivableAmount(getBigDecimal(rowData, "receivableAmount"))
                    .collectionAmount(getBigDecimal(rowData, "collectionAmount"))
                    .agingDays(getInteger(rowData, "agingDays"))
                    .payableAmount(getBigDecimal(rowData, "payableAmount"))
                    .paymentAmount(getBigDecimal(rowData, "paymentAmount"))
                    .budgetAmount(getBigDecimal(rowData, "budgetAmount"))
                    .actualAmount(getBigDecimal(rowData, "actualAmount"))
                    .varianceAmount(getBigDecimal(rowData, "varianceAmount"))
                    .dueDate(parseDate(getFieldValue(rowData, "dueDate")))
                    .build();
        } catch (Exception e) {
            log.warn("Failed to parse finance data from row: {}", rowData, e);
            return null;
        }
    }

    /**
     * Parse dynamic data into SmartBiDepartmentData
     */
    public static SmartBiDepartmentData parseDepartmentData(SmartBiDynamicData dynamicData) {
        if (dynamicData == null || dynamicData.getRowData() == null) {
            return null;
        }

        Map<String, Object> rowData = dynamicData.getRowData();

        try {
            return SmartBiDepartmentData.builder()
                    .factoryId(dynamicData.getFactoryId())
                    .uploadId(dynamicData.getUploadId())
                    .recordDate(parseDate(getFieldValue(rowData, "recordDate")))
                    .department(getString(rowData, "department"))
                    .departmentId(getString(rowData, "departmentId"))
                    .managerName(getString(rowData, "managerName"))
                    .headcount(getInteger(rowData, "headcount"))
                    .salesAmount(getBigDecimal(rowData, "salesAmount"))
                    .salesTarget(getBigDecimal(rowData, "salesTarget"))
                    .costAmount(getBigDecimal(rowData, "costAmount"))
                    .perCapitaSales(getBigDecimal(rowData, "perCapitaSales"))
                    .perCapitaCost(getBigDecimal(rowData, "perCapitaCost"))
                    .build();
        } catch (Exception e) {
            log.warn("Failed to parse department data from row: {}", rowData, e);
            return null;
        }
    }

    /**
     * Get field value using field aliases
     */
    private static Object getFieldValue(Map<String, Object> rowData, String fieldKey) {
        // Try direct field key first
        if (rowData.containsKey(fieldKey)) {
            return rowData.get(fieldKey);
        }

        // Try aliases
        List<String> aliases = FIELD_ALIASES.get(fieldKey);
        if (aliases != null) {
            for (String alias : aliases) {
                if (rowData.containsKey(alias)) {
                    return rowData.get(alias);
                }
            }
        }

        return null;
    }

    private static String getString(Map<String, Object> rowData, String fieldKey) {
        Object value = getFieldValue(rowData, fieldKey);
        if (value == null) {
            return null;
        }
        return value.toString().trim();
    }

    private static BigDecimal getBigDecimal(Map<String, Object> rowData, String fieldKey) {
        Object value = getFieldValue(rowData, fieldKey);
        if (value == null) {
            return BigDecimal.ZERO;
        }

        try {
            if (value instanceof Number) {
                return BigDecimal.valueOf(((Number) value).doubleValue());
            }
            String strValue = value.toString().trim().replaceAll("[,，]", "");
            if (strValue.isEmpty() || strValue.equals("-")) {
                return BigDecimal.ZERO;
            }
            return new BigDecimal(strValue);
        } catch (NumberFormatException e) {
            log.trace("Cannot parse BigDecimal from value: {}", value);
            return BigDecimal.ZERO;
        }
    }

    private static Integer getInteger(Map<String, Object> rowData, String fieldKey) {
        Object value = getFieldValue(rowData, fieldKey);
        if (value == null) {
            return 0;
        }

        try {
            if (value instanceof Number) {
                return ((Number) value).intValue();
            }
            String strValue = value.toString().trim().replaceAll("[,，]", "");
            if (strValue.isEmpty() || strValue.equals("-")) {
                return 0;
            }
            return Integer.parseInt(strValue);
        } catch (NumberFormatException e) {
            log.trace("Cannot parse Integer from value: {}", value);
            return 0;
        }
    }

    private static LocalDate parseDate(Object value) {
        if (value == null) {
            return LocalDate.now();
        }

        if (value instanceof LocalDate) {
            return (LocalDate) value;
        }

        String dateStr = value.toString().trim();
        if (dateStr.isEmpty()) {
            return LocalDate.now();
        }

        // Try each formatter
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return LocalDate.parse(dateStr, formatter);
            } catch (DateTimeParseException ignored) {
                // Try next formatter
            }
        }

        // Try to extract year-month
        if (dateStr.matches(".*\\d{4}.*")) {
            try {
                // Extract year and month from strings like "2024年" or "2024-01"
                String cleaned = dateStr.replaceAll("[年月日]", "-").replaceAll("-+$", "");
                String[] parts = cleaned.split("-");
                if (parts.length >= 1) {
                    int year = Integer.parseInt(parts[0]);
                    int month = parts.length >= 2 ? Integer.parseInt(parts[1]) : 1;
                    int day = parts.length >= 3 ? Integer.parseInt(parts[2]) : 1;
                    return LocalDate.of(year, month, day);
                }
            } catch (Exception ignored) {
            }
        }

        log.trace("Cannot parse date from value: {}", value);
        return LocalDate.now();
    }

    private static RecordType parseRecordType(String value) {
        if (value == null || value.isEmpty()) {
            return RecordType.COST;
        }

        String upper = value.toUpperCase();
        if (upper.contains("AR") || upper.contains("应收")) {
            return RecordType.AR;
        } else if (upper.contains("AP") || upper.contains("应付")) {
            return RecordType.AP;
        } else if (upper.contains("BUDGET") || upper.contains("预算")) {
            return RecordType.BUDGET;
        } else {
            return RecordType.COST;
        }
    }
}
