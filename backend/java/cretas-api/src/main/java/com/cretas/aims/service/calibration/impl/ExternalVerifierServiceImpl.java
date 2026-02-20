package com.cretas.aims.service.calibration.impl;

import com.cretas.aims.service.calibration.ExternalVerifierService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 外部验证器服务实现
 *
 * 基于 CRITIC 论文的核心思想，提供外部工具验证功能。
 * 通过查询数据库等外部数据源，为纠错 Agent 提供可靠的反馈信息。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExternalVerifierServiceImpl implements ExternalVerifierService {

    private final JdbcTemplate jdbcTemplate;

    // 支持的表名白名单（防止 SQL 注入）
    private static final List<String> ALLOWED_TABLES = List.of(
            "material_batches",
            "quality_inspections",
            "production_plans",
            "inventory_records",
            "shipment_records",
            "equipment_status",
            "worker_schedules"
    );

    // 日期格式
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final Pattern DATE_PATTERN = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");

    @Override
    public VerificationResult verifyDataAvailability(String factoryId, String tableName, Map<String, Object> conditions) {
        log.info("验证数据可用性: factoryId={}, table={}, conditions={}", factoryId, tableName, conditions);

        if (!ALLOWED_TABLES.contains(tableName.toLowerCase())) {
            return VerificationResult.empty("INVALID_TABLE: " + tableName);
        }

        try {
            // 构建安全的 SQL 查询
            StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM " + tableName + " WHERE factory_id = ?");
            List<Object> params = new java.util.ArrayList<>();
            params.add(factoryId);

            // 添加其他条件（仅支持简单等值条件）
            if (conditions != null) {
                for (Map.Entry<String, Object> entry : conditions.entrySet()) {
                    String column = sanitizeColumnName(entry.getKey());
                    if (column != null) {
                        sql.append(" AND ").append(column).append(" = ?");
                        params.add(entry.getValue());
                    }
                }
            }

            Integer count = jdbcTemplate.queryForObject(sql.toString(), Integer.class, params.toArray());
            int recordCount = count != null ? count : 0;

            if (recordCount > 0) {
                Map<String, Object> context = new HashMap<>();
                context.put("tableName", tableName);
                context.put("recordCount", recordCount);
                context.put("queryConditions", conditions);

                return VerificationResult.withData(recordCount, context,
                        String.format("找到 %d 条符合条件的记录", recordCount));
            } else {
                return VerificationResult.empty("NO_DATA_FOUND");
            }

        } catch (Exception e) {
            log.error("数据可用性验证失败: {}", e.getMessage());
            return VerificationResult.empty("VERIFICATION_ERROR: " + e.getMessage());
        }
    }

    @Override
    public VerificationResult verifyTimeRangeData(String factoryId, String tableName, LocalDate startDate, LocalDate endDate) {
        log.info("验证时间范围数据: factoryId={}, table={}, range={} to {}",
                factoryId, tableName, startDate, endDate);

        if (!ALLOWED_TABLES.contains(tableName.toLowerCase())) {
            return VerificationResult.empty("INVALID_TABLE: " + tableName);
        }

        try {
            // 查询指定时间范围内的记录数
            String sql = "SELECT COUNT(*) FROM " + tableName +
                    " WHERE factory_id = ? AND created_at BETWEEN ? AND ?";

            Integer count = jdbcTemplate.queryForObject(sql, Integer.class,
                    factoryId, startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay());
            int recordCount = count != null ? count : 0;

            Map<String, Object> context = new HashMap<>();
            context.put("tableName", tableName);
            context.put("requestedStartDate", startDate.toString());
            context.put("requestedEndDate", endDate.toString());
            context.put("recordCount", recordCount);

            if (recordCount > 0) {
                return VerificationResult.withData(recordCount, context,
                        String.format("时间范围 %s 至 %s 内有 %d 条记录", startDate, endDate, recordCount));
            }

            // 如果没有数据，尝试找出有数据的时间范围
            String suggestSql = "SELECT MIN(created_at) as min_date, MAX(created_at) as max_date, COUNT(*) as total " +
                    "FROM " + tableName + " WHERE factory_id = ?";

            Map<String, Object> suggestion = jdbcTemplate.queryForMap(suggestSql, factoryId);

            if (suggestion.get("total") != null && ((Number) suggestion.get("total")).intValue() > 0) {
                Object minDate = suggestion.get("min_date");
                Object maxDate = suggestion.get("max_date");
                context.put("availableMinDate", minDate != null ? minDate.toString() : null);
                context.put("availableMaxDate", maxDate != null ? maxDate.toString() : null);
                context.put("totalRecords", suggestion.get("total"));

                return new VerificationResult(false, 0, "NO_DATA_IN_RANGE", context,
                        String.format("指定时间范围内无数据，但该表有数据 (最早: %s, 最晚: %s，共 %s 条)，建议调整查询范围",
                                minDate, maxDate, suggestion.get("total")));
            }

            return new VerificationResult(false, 0, "TABLE_EMPTY", context,
                    "该表在当前工厂下没有任何数据");

        } catch (Exception e) {
            log.error("时间范围验证失败: {}", e.getMessage());
            return VerificationResult.empty("VERIFICATION_ERROR: " + e.getMessage());
        }
    }

    @Override
    public VerificationResult verifyParameterFormat(String paramName, Object paramValue, String expectedFormat) {
        log.info("验证参数格式: param={}, value={}, expectedFormat={}", paramName, paramValue, expectedFormat);

        if (paramValue == null) {
            return new VerificationResult(false, 0, "NULL_VALUE",
                    Map.of("paramName", paramName, "expectedFormat", expectedFormat),
                    "参数值为空，请提供有效的 " + paramName);
        }

        String valueStr = paramValue.toString();
        Map<String, Object> context = new HashMap<>();
        context.put("paramName", paramName);
        context.put("providedValue", valueStr);
        context.put("expectedFormat", expectedFormat);

        switch (expectedFormat.toLowerCase()) {
            case "date":
                if (DATE_PATTERN.matcher(valueStr).matches()) {
                    try {
                        LocalDate.parse(valueStr, DATE_FORMATTER);
                        return VerificationResult.withData(1, context, "日期格式正确");
                    } catch (DateTimeParseException e) {
                        context.put("correctFormat", "yyyy-MM-dd");
                        return new VerificationResult(false, 0, "INVALID_DATE", context,
                                "日期格式无效，请使用 yyyy-MM-dd 格式，如 2026-01-19");
                    }
                } else {
                    context.put("correctFormat", "yyyy-MM-dd");
                    return new VerificationResult(false, 0, "INVALID_DATE_FORMAT", context,
                            "日期格式错误，请使用 yyyy-MM-dd 格式，如 2026-01-19");
                }

            case "number":
                try {
                    Double.parseDouble(valueStr);
                    return VerificationResult.withData(1, context, "数字格式正确");
                } catch (NumberFormatException e) {
                    return new VerificationResult(false, 0, "INVALID_NUMBER", context,
                            "数字格式无效，请提供有效的数字");
                }

            case "positive_number":
                try {
                    double num = Double.parseDouble(valueStr);
                    if (num > 0) {
                        return VerificationResult.withData(1, context, "正数格式正确");
                    } else {
                        return new VerificationResult(false, 0, "NOT_POSITIVE", context,
                                "请提供大于0的正数");
                    }
                } catch (NumberFormatException e) {
                    return new VerificationResult(false, 0, "INVALID_NUMBER", context,
                            "数字格式无效，请提供有效的正数");
                }

            default:
                return VerificationResult.withData(1, context, "格式验证通过");
        }
    }

    @Override
    public Map<String, Object> collectContextInfo(String factoryId, String toolName, Map<String, Object> params) {
        log.info("收集上下文信息: factoryId={}, tool={}", factoryId, toolName);

        Map<String, Object> context = new HashMap<>();
        context.put("factoryId", factoryId);
        context.put("toolName", toolName);
        context.put("collectedAt", LocalDateTime.now().toString());

        try {
            // 根据工具名收集相关上下文
            switch (toolName.toLowerCase()) {
                case "materialbatchquerytool":
                case "material_batch_query":
                    collectMaterialBatchContext(factoryId, context);
                    break;

                case "qualityinspectiontool":
                case "quality_inspection_query":
                    collectQualityInspectionContext(factoryId, context);
                    break;

                case "inventoryquerytool":
                case "inventory_query":
                    collectInventoryContext(factoryId, context);
                    break;

                case "productionplanquerytool":
                case "production_plan_query":
                    collectProductionPlanContext(factoryId, context);
                    break;

                default:
                    context.put("note", "通用上下文，无特定工具信息");
            }

        } catch (Exception e) {
            log.warn("收集上下文信息时出错: {}", e.getMessage());
            context.put("contextError", e.getMessage());
        }

        return context;
    }

    @Override
    public VerificationResult verifyToolCall(String factoryId, String toolName, Map<String, Object> params, String errorMessage) {
        log.info("综合验证工具调用: factoryId={}, tool={}, error={}", factoryId, toolName, errorMessage);

        Map<String, Object> context = collectContextInfo(factoryId, toolName, params);
        context.put("originalError", errorMessage);
        context.put("originalParams", params);

        // 分析错误类型并提供建议
        String suggestion = analyzeErrorAndSuggest(errorMessage, toolName, params, context);
        context.put("suggestion", suggestion);

        // 判断是否有可用数据
        boolean hasData = context.containsKey("totalRecords") &&
                ((Number) context.get("totalRecords")).intValue() > 0;

        return new VerificationResult(
                hasData,
                hasData ? ((Number) context.get("totalRecords")).intValue() : 0,
                hasData ? "DATA_AVAILABLE" : "NO_DATA",
                context,
                suggestion
        );
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 收集物料批次相关上下文
     */
    private void collectMaterialBatchContext(String factoryId, Map<String, Object> context) {
        try {
            // 统计总批次数
            Integer totalBatches = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM material_batches WHERE factory_id = ?",
                    Integer.class, factoryId);
            context.put("totalRecords", totalBatches);

            // 获取最近的批次信息
            List<Map<String, Object>> recentBatches = jdbcTemplate.queryForList(
                    "SELECT batch_number, created_at FROM material_batches " +
                            "WHERE factory_id = ? ORDER BY created_at DESC LIMIT 5",
                    factoryId);
            context.put("recentBatches", recentBatches);

            // 获取时间范围
            Map<String, Object> dateRange = jdbcTemplate.queryForMap(
                    "SELECT MIN(created_at) as earliest, MAX(created_at) as latest " +
                            "FROM material_batches WHERE factory_id = ?",
                    factoryId);
            context.put("dateRange", dateRange);

        } catch (Exception e) {
            log.warn("收集物料批次上下文失败: {}", e.getMessage());
        }
    }

    /**
     * 收集质检相关上下文
     */
    private void collectQualityInspectionContext(String factoryId, Map<String, Object> context) {
        try {
            Integer total = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM quality_inspections WHERE factory_id = ?",
                    Integer.class, factoryId);
            context.put("totalRecords", total);
        } catch (Exception e) {
            log.warn("收集质检上下文失败: {}", e.getMessage());
        }
    }

    /**
     * 收集库存相关上下文
     */
    private void collectInventoryContext(String factoryId, Map<String, Object> context) {
        try {
            Integer total = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM inventory_records WHERE factory_id = ?",
                    Integer.class, factoryId);
            context.put("totalRecords", total);
        } catch (Exception e) {
            log.warn("收集库存上下文失败: {}", e.getMessage());
        }
    }

    /**
     * 收集生产计划相关上下文
     */
    private void collectProductionPlanContext(String factoryId, Map<String, Object> context) {
        try {
            Integer total = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM production_plans WHERE factory_id = ?",
                    Integer.class, factoryId);
            context.put("totalRecords", total);
        } catch (Exception e) {
            log.warn("收集生产计划上下文失败: {}", e.getMessage());
        }
    }

    /**
     * 分析错误并生成建议
     */
    private String analyzeErrorAndSuggest(String errorMessage, String toolName, Map<String, Object> params, Map<String, Object> context) {
        if (errorMessage == null) {
            return "无错误信息，请检查工具实现";
        }

        String lowerError = errorMessage.toLowerCase();

        // 数据不足类错误
        if (lowerError.contains("not found") || lowerError.contains("no data") ||
                lowerError.contains("empty") || lowerError.contains("未找到") ||
                lowerError.contains("数据为空")) {

            if (context.containsKey("dateRange")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> dateRange = (Map<String, Object>) context.get("dateRange");
                return String.format("数据未找到。建议：1) 检查查询条件是否过于严格；2) 数据时间范围为 %s 至 %s，请调整日期参数",
                        dateRange.get("earliest"), dateRange.get("latest"));
            }
            return "数据未找到。建议：放宽查询条件或检查数据是否存在";
        }

        // 格式错误
        if (lowerError.contains("format") || lowerError.contains("parse") ||
                lowerError.contains("invalid") || lowerError.contains("格式")) {
            return "参数格式错误。建议：检查日期格式(yyyy-MM-dd)、数字格式等是否正确";
        }

        // 权限错误
        if (lowerError.contains("permission") || lowerError.contains("access") ||
                lowerError.contains("denied") || lowerError.contains("权限")) {
            return "权限不足。建议：检查用户是否有访问该数据的权限";
        }

        // 超时错误
        if (lowerError.contains("timeout") || lowerError.contains("超时")) {
            return "执行超时。建议：缩小查询范围或简化查询条件";
        }

        return "执行出错，请检查参数是否正确或联系管理员";
    }

    /**
     * 清理列名（防止 SQL 注入）
     */
    private String sanitizeColumnName(String columnName) {
        if (columnName == null) return null;
        // 只允许字母、数字和下划线
        if (columnName.matches("^[a-zA-Z_][a-zA-Z0-9_]*$")) {
            return columnName;
        }
        log.warn("不安全的列名被拒绝: {}", columnName);
        return null;
    }
}
