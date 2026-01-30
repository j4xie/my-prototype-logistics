package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.service.ResultFormatterService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * 结果格式化服务实现
 * 根据意图类型将 resultData 转换为自然语言文本
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
public class ResultFormatterServiceImpl implements ResultFormatterService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MM月dd日");
    private static final DateTimeFormatter DATETIME_FORMATTER = DateTimeFormatter.ofPattern("MM月dd日 HH:mm");
    private static final DecimalFormat AMOUNT_FORMATTER = new DecimalFormat("#,##0.00");
    private static final DecimalFormat QUANTITY_FORMATTER = new DecimalFormat("#,##0.##");

    @Override
    public String format(IntentExecuteResponse response) {
        if (response == null || response.getResultData() == null) {
            return response != null ? response.getMessage() : null;
        }

        String intentCode = response.getIntentCode();
        String intentCategory = response.getIntentCategory();
        Object resultData = response.getResultData();

        try {
            // 根据意图分类选择格式化器
            return switch (intentCategory) {
                case "SHIPMENT" -> formatShipmentResult(intentCode, resultData);
                case "MATERIAL" -> formatMaterialResult(intentCode, resultData);
                case "QUALITY" -> formatQualityResult(intentCode, resultData);
                case "PRODUCTION" -> formatProductionResult(intentCode, resultData);
                case "REPORT" -> formatReportResult(intentCode, resultData);
                case "HR" -> formatHRResult(intentCode, resultData);
                case "CRM" -> formatCRMResult(intentCode, resultData);
                case "ALERT" -> formatAlertResult(intentCode, resultData);
                default -> formatGenericResult(resultData);
            };
        } catch (Exception e) {
            log.warn("格式化结果失败: intentCode={}, error={}", intentCode, e.getMessage());
            return response.getMessage();
        }
    }

    // ==================== 出货/发货 格式化 ====================

    private String formatShipmentResult(String intentCode, Object resultData) {
        Map<String, Object> data = asMap(resultData);
        if (data == null) return null;

        return switch (intentCode) {
            case "SHIPMENT_QUERY", "SHIPMENT_BY_DATE", "SHIPMENT_BY_CUSTOMER" -> formatShipmentList(data);
            case "SHIPMENT_CREATE" -> formatShipmentCreated(data);
            case "SHIPMENT_STATS" -> formatShipmentStats(data);
            case "TRACE_BATCH", "TRACE_FULL" -> formatTraceResult(data);
            default -> formatGenericList(data);
        };
    }

    private String formatShipmentList(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder();

        List<Map<String, Object>> content = getList(data, "content");
        Integer total = getInteger(data, "totalElements");
        Integer currentPage = getInteger(data, "currentPage");
        Integer totalPages = getInteger(data, "totalPages");

        if (content == null || content.isEmpty()) {
            return "暂无出货记录";
        }

        sb.append(String.format("查询到 %d 条出货记录", total != null ? total : content.size()));
        if (totalPages != null && totalPages > 1) {
            sb.append(String.format("（第 %d/%d 页）", (currentPage != null ? currentPage + 1 : 1), totalPages));
        }
        sb.append("：\n\n");

        int count = 0;
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (Map<String, Object> item : content) {
            if (count >= 5) {
                sb.append(String.format("\n... 还有 %d 条记录", content.size() - 5));
                break;
            }

            String shipmentNumber = getString(item, "shipmentNumber");
            String productName = getString(item, "productName");
            BigDecimal quantity = getBigDecimal(item, "quantity");
            String unit = getString(item, "unit");
            String status = translateStatus(getString(item, "status"));
            LocalDate shipmentDate = getLocalDate(item, "shipmentDate");
            BigDecimal amount = getBigDecimal(item, "totalAmount");

            sb.append(String.format("%d. %s | %s %s%s | %s",
                    ++count,
                    shipmentNumber != null ? shipmentNumber : "无单号",
                    productName != null ? productName : "未知产品",
                    quantity != null ? QUANTITY_FORMATTER.format(quantity) : "?",
                    unit != null ? unit : "",
                    status));

            if (shipmentDate != null) {
                sb.append(" | ").append(shipmentDate.format(DATE_FORMATTER));
            }
            sb.append("\n");

            if (amount != null) {
                totalAmount = totalAmount.add(amount);
            }
        }

        if (totalAmount.compareTo(BigDecimal.ZERO) > 0) {
            sb.append(String.format("\n合计金额：¥%s", AMOUNT_FORMATTER.format(totalAmount)));
        }

        return sb.toString();
    }

    private String formatShipmentCreated(Map<String, Object> data) {
        String shipmentNumber = getString(data, "shipmentNumber");
        String status = translateStatus(getString(data, "status"));
        return String.format("出货单创建成功！单号：%s，状态：%s", shipmentNumber, status);
    }

    private String formatShipmentStats(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder("出货统计：\n");

        Integer totalCount = getInteger(data, "totalCount");
        BigDecimal totalAmount = getBigDecimal(data, "totalAmount");
        BigDecimal totalQuantity = getBigDecimal(data, "totalQuantity");

        if (totalCount != null) sb.append(String.format("• 总出货单数：%d 单\n", totalCount));
        if (totalQuantity != null) sb.append(String.format("• 总出货数量：%s\n", QUANTITY_FORMATTER.format(totalQuantity)));
        if (totalAmount != null) sb.append(String.format("• 总金额：¥%s", AMOUNT_FORMATTER.format(totalAmount)));

        return sb.toString();
    }

    private String formatTraceResult(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder("溯源信息：\n");
        // 简化溯源结果展示
        String batchNumber = getString(data, "batchNumber");
        if (batchNumber != null) {
            sb.append(String.format("批次号：%s\n", batchNumber));
        }
        return sb.toString();
    }

    // ==================== 原料/库存 格式化 ====================

    private String formatMaterialResult(String intentCode, Object resultData) {
        Map<String, Object> data = asMap(resultData);
        if (data == null) return null;

        return switch (intentCode) {
            case "MATERIAL_BATCH_QUERY", "MATERIAL_STOCK_QUERY" -> formatMaterialList(data);
            case "MATERIAL_BATCH_CREATE" -> formatMaterialCreated(data);
            case "MATERIAL_LOW_STOCK_ALERT" -> formatLowStockAlert(data);
            default -> formatGenericList(data);
        };
    }

    private String formatMaterialList(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder();

        List<Map<String, Object>> content = getList(data, "content");
        Integer total = getInteger(data, "totalElements");

        if (content == null || content.isEmpty()) {
            return "暂无原料批次记录";
        }

        sb.append(String.format("查询到 %d 条原料记录：\n\n", total != null ? total : content.size()));

        int count = 0;
        for (Map<String, Object> item : content) {
            if (count >= 5) {
                sb.append(String.format("\n... 还有 %d 条记录", content.size() - 5));
                break;
            }

            String batchNumber = getString(item, "batchNumber");
            String materialName = getString(item, "materialName");
            BigDecimal quantity = getBigDecimal(item, "quantity");
            String unit = getString(item, "unit");
            String status = translateStatus(getString(item, "status"));

            sb.append(String.format("%d. %s | %s %s%s | %s\n",
                    ++count,
                    batchNumber != null ? batchNumber : "无批号",
                    materialName != null ? materialName : "未知原料",
                    quantity != null ? QUANTITY_FORMATTER.format(quantity) : "?",
                    unit != null ? unit : "",
                    status));
        }

        return sb.toString();
    }

    private String formatMaterialCreated(Map<String, Object> data) {
        String batchNumber = getString(data, "batchNumber");
        return String.format("原料批次创建成功！批次号：%s", batchNumber);
    }

    private String formatLowStockAlert(Map<String, Object> data) {
        List<Map<String, Object>> alerts = getList(data, "alerts");
        if (alerts == null || alerts.isEmpty()) {
            return "当前没有库存预警";
        }

        StringBuilder sb = new StringBuilder(String.format("发现 %d 项库存预警：\n\n", alerts.size()));
        for (Map<String, Object> alert : alerts) {
            String materialName = getString(alert, "materialName");
            BigDecimal currentStock = getBigDecimal(alert, "currentStock");
            BigDecimal minStock = getBigDecimal(alert, "minStock");
            sb.append(String.format("• %s：当前 %s，低于最低库存 %s\n",
                    materialName,
                    currentStock != null ? QUANTITY_FORMATTER.format(currentStock) : "?",
                    minStock != null ? QUANTITY_FORMATTER.format(minStock) : "?"));
        }
        return sb.toString();
    }

    // ==================== 质量 格式化 ====================

    private String formatQualityResult(String intentCode, Object resultData) {
        Map<String, Object> data = asMap(resultData);
        if (data == null) return null;

        return switch (intentCode) {
            case "QUALITY_CHECK_QUERY" -> formatQualityCheckList(data);
            case "QUALITY_STATS" -> formatQualityStats(data);
            default -> formatGenericList(data);
        };
    }

    private String formatQualityCheckList(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder();

        List<Map<String, Object>> content = getList(data, "content");
        Integer total = getInteger(data, "totalElements");
        String message = getString(data, "message");

        if (message != null) {
            sb.append(message).append("\n\n");
        } else if (content == null || content.isEmpty()) {
            return "暂无质检记录";
        } else {
            sb.append(String.format("查询到 %d 条质检记录：\n\n", total != null ? total : content.size()));
        }

        if (content != null) {
            int count = 0;
            for (Map<String, Object> item : content) {
                if (count >= 5) break;

                String result = translateQualityResult(getString(item, "result"));
                String grade = getString(item, "qualityGrade");
                Double passRate = getDouble(item, "passRate");
                LocalDate inspectionDate = getLocalDate(item, "inspectionDate");

                sb.append(String.format("%d. %s", ++count, result));
                if (grade != null) sb.append(String.format(" | 等级 %s", grade));
                if (passRate != null) sb.append(String.format(" | 合格率 %.1f%%", passRate));
                if (inspectionDate != null) sb.append(String.format(" | %s", inspectionDate.format(DATE_FORMATTER)));
                sb.append("\n");
            }
        }

        return sb.toString();
    }

    private String formatQualityStats(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder("质量统计：\n");

        Double avgPassRate = getDouble(data, "avgPassRate");
        Integer totalChecks = getInteger(data, "totalChecks");
        Integer passCount = getInteger(data, "passCount");
        Integer failCount = getInteger(data, "failCount");

        if (totalChecks != null) sb.append(String.format("• 总检验次数：%d 次\n", totalChecks));
        if (passCount != null) sb.append(String.format("• 合格批次：%d 批\n", passCount));
        if (failCount != null) sb.append(String.format("• 不合格批次：%d 批\n", failCount));
        if (avgPassRate != null) sb.append(String.format("• 平均合格率：%.1f%%", avgPassRate));

        return sb.toString();
    }

    // ==================== 生产 格式化 ====================

    private String formatProductionResult(String intentCode, Object resultData) {
        Map<String, Object> data = asMap(resultData);
        if (data == null) return null;
        return formatGenericList(data);
    }

    // ==================== 报表 格式化 ====================

    private String formatReportResult(String intentCode, Object resultData) {
        Map<String, Object> data = asMap(resultData);
        if (data == null) return null;

        return switch (intentCode) {
            case "REPORT_INVENTORY" -> formatInventoryReport(data);
            case "REPORT_PRODUCTION" -> formatProductionReport(data);
            default -> formatGenericList(data);
        };
    }

    private String formatInventoryReport(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder("库存报表：\n\n");

        List<Map<String, Object>> items = getList(data, "items");
        if (items != null) {
            for (Map<String, Object> item : items) {
                String name = getString(item, "materialName");
                BigDecimal stock = getBigDecimal(item, "currentStock");
                String unit = getString(item, "unit");
                sb.append(String.format("• %s：%s %s\n",
                        name != null ? name : "未知",
                        stock != null ? QUANTITY_FORMATTER.format(stock) : "?",
                        unit != null ? unit : ""));
            }
        }

        BigDecimal totalValue = getBigDecimal(data, "totalValue");
        if (totalValue != null) {
            sb.append(String.format("\n库存总价值：¥%s", AMOUNT_FORMATTER.format(totalValue)));
        }

        return sb.toString();
    }

    private String formatProductionReport(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder("生产报表：\n");

        Integer totalBatches = getInteger(data, "totalBatches");
        BigDecimal totalOutput = getBigDecimal(data, "totalOutput");
        Double avgEfficiency = getDouble(data, "avgEfficiency");

        if (totalBatches != null) sb.append(String.format("• 生产批次：%d 批\n", totalBatches));
        if (totalOutput != null) sb.append(String.format("• 总产量：%s\n", QUANTITY_FORMATTER.format(totalOutput)));
        if (avgEfficiency != null) sb.append(String.format("• 平均效率：%.1f%%", avgEfficiency));

        return sb.toString();
    }

    // ==================== HR 格式化 ====================

    private String formatHRResult(String intentCode, Object resultData) {
        Map<String, Object> data = asMap(resultData);
        if (data == null) return null;

        return switch (intentCode) {
            case "ATTENDANCE_TODAY", "ATTENDANCE_QUERY" -> formatAttendanceResult(data);
            case "WORKER_QUERY" -> formatWorkerList(data);
            default -> formatGenericList(data);
        };
    }

    private String formatAttendanceResult(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder();

        Integer total = getInteger(data, "totalWorkers");
        Integer present = getInteger(data, "presentCount");
        Integer absent = getInteger(data, "absentCount");
        Integer late = getInteger(data, "lateCount");
        Double attendanceRate = getDouble(data, "attendanceRate");
        String message = getString(data, "message");

        if (message != null) {
            sb.append(message).append("\n\n");
        } else {
            sb.append("今日出勤情况：\n\n");
        }

        if (total != null) sb.append(String.format("• 应到人数：%d 人\n", total));
        if (present != null) sb.append(String.format("• 实到人数：%d 人\n", present));
        if (absent != null && absent > 0) sb.append(String.format("• 缺勤人数：%d 人\n", absent));
        if (late != null && late > 0) sb.append(String.format("• 迟到人数：%d 人\n", late));
        if (attendanceRate != null) sb.append(String.format("• 出勤率：%.1f%%", attendanceRate));

        return sb.toString();
    }

    private String formatWorkerList(Map<String, Object> data) {
        List<Map<String, Object>> content = getList(data, "content");
        if (content == null || content.isEmpty()) {
            return "暂无员工信息";
        }

        StringBuilder sb = new StringBuilder(String.format("查询到 %d 名员工：\n\n", content.size()));
        int count = 0;
        for (Map<String, Object> worker : content) {
            if (count >= 5) break;
            String name = getString(worker, "name");
            String position = getString(worker, "position");
            String department = getString(worker, "department");
            sb.append(String.format("%d. %s | %s | %s\n", ++count,
                    name != null ? name : "未知",
                    position != null ? position : "-",
                    department != null ? department : "-"));
        }
        return sb.toString();
    }

    // ==================== CRM 格式化 ====================

    private String formatCRMResult(String intentCode, Object resultData) {
        Map<String, Object> data = asMap(resultData);
        if (data == null) return null;

        return switch (intentCode) {
            case "CUSTOMER_ACTIVE", "CUSTOMER_QUERY" -> formatCustomerList(data);
            default -> formatGenericList(data);
        };
    }

    private String formatCustomerList(Map<String, Object> data) {
        List<Map<String, Object>> content = getList(data, "content");
        Integer total = getInteger(data, "totalElements");
        String message = getString(data, "message");

        if (content == null || content.isEmpty()) {
            return message != null ? message : "暂无客户信息";
        }

        StringBuilder sb = new StringBuilder();
        if (message != null) {
            sb.append(message).append("\n\n");
        } else {
            sb.append(String.format("查询到 %d 位客户：\n\n", total != null ? total : content.size()));
        }

        int count = 0;
        for (Map<String, Object> customer : content) {
            if (count >= 5) break;
            String name = getString(customer, "name");
            String contact = getString(customer, "contactPerson");
            String phone = getString(customer, "phone");
            sb.append(String.format("%d. %s", ++count, name != null ? name : "未知客户"));
            if (contact != null) sb.append(String.format(" | 联系人：%s", contact));
            if (phone != null) sb.append(String.format(" | %s", phone));
            sb.append("\n");
        }
        return sb.toString();
    }

    // ==================== 告警 格式化 ====================

    private String formatAlertResult(String intentCode, Object resultData) {
        Map<String, Object> data = asMap(resultData);
        if (data == null) return null;

        List<Map<String, Object>> alerts = getList(data, "content");
        if (alerts == null) alerts = getList(data, "alerts");

        if (alerts == null || alerts.isEmpty()) {
            return "当前没有未处理的告警";
        }

        StringBuilder sb = new StringBuilder(String.format("发现 %d 条告警：\n\n", alerts.size()));
        int count = 0;
        for (Map<String, Object> alert : alerts) {
            if (count >= 5) break;
            String type = getString(alert, "alertType");
            String message = getString(alert, "message");
            String level = getString(alert, "level");
            sb.append(String.format("%d. [%s] %s", ++count,
                    level != null ? level : "INFO",
                    message != null ? message : type));
            sb.append("\n");
        }
        return sb.toString();
    }

    // ==================== 通用格式化 ====================

    private String formatGenericResult(Object resultData) {
        Map<String, Object> data = asMap(resultData);
        if (data == null) return null;
        return formatGenericList(data);
    }

    private String formatGenericList(Map<String, Object> data) {
        List<Map<String, Object>> content = getList(data, "content");
        Integer total = getInteger(data, "totalElements");
        String message = getString(data, "message");

        if (message != null) {
            return message;
        }

        if (content == null || content.isEmpty()) {
            return "查询完成，暂无数据";
        }

        return String.format("查询到 %d 条记录", total != null ? total : content.size());
    }

    // ==================== 工具方法 ====================

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object obj) {
        if (obj instanceof Map) {
            return (Map<String, Object>) obj;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getList(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value instanceof List) {
            return (List<Map<String, Object>>) value;
        }
        return null;
    }

    private String getString(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value != null ? value.toString() : null;
    }

    private Integer getInteger(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        return null;
    }

    private Double getDouble(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        return null;
    }

    private BigDecimal getBigDecimal(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value instanceof BigDecimal) {
            return (BigDecimal) value;
        } else if (value instanceof Number) {
            return BigDecimal.valueOf(((Number) value).doubleValue());
        }
        return null;
    }

    private LocalDate getLocalDate(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value instanceof LocalDate) {
            return (LocalDate) value;
        } else if (value instanceof LocalDateTime) {
            return ((LocalDateTime) value).toLocalDate();
        } else if (value instanceof String) {
            try {
                return LocalDate.parse((String) value);
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    private String translateStatus(String status) {
        if (status == null) return "未知";
        return switch (status.toLowerCase()) {
            case "pending" -> "待处理";
            case "shipped" -> "已发货";
            case "delivered" -> "已送达";
            case "completed" -> "已完成";
            case "cancelled" -> "已取消";
            case "in_stock" -> "在库";
            case "consumed" -> "已消耗";
            case "expired" -> "已过期";
            default -> status;
        };
    }

    private String translateQualityResult(String result) {
        if (result == null) return "未检验";
        return switch (result.toLowerCase()) {
            case "pass", "passed" -> "合格";
            case "fail", "failed" -> "不合格";
            case "pending" -> "待检验";
            default -> result;
        };
    }
}
