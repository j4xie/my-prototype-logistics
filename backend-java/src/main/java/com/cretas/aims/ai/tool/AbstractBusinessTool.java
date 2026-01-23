package com.cretas.aims.ai.tool;

import com.cretas.aims.ai.dto.ToolCall;
import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 业务 Tool 抽象基类
 *
 * 为业务操作类 Tool 提供通用功能：
 * 1. 自动参数校验
 * 2. 缺失参数提示
 * 3. 标准化执行流程
 * 4. 类型转换工具方法
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
public abstract class AbstractBusinessTool extends AbstractTool {

    /**
     * 获取必需参数列表
     *
     * @return 必需参数名称列表
     */
    protected abstract List<String> getRequiredParameters();

    /**
     * 执行业务逻辑（子类实现）
     *
     * @param factoryId 工厂ID
     * @param params 已校验的参数
     * @param context 执行上下文
     * @return 执行结果（Map格式）
     * @throws Exception 执行异常
     */
    protected abstract Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception;

    /**
     * 统一执行入口
     */
    @Override
    public String execute(ToolCall toolCall, Map<String, Object> context) throws Exception {
        logExecutionStart(toolCall, context);
        validateContext(context);

        try {
            // 1. 解析参数
            Map<String, Object> params = parseArguments(toolCall);
            String factoryId = getFactoryId(context);

            // 2. 校验必需参数
            List<String> missingParams = validateRequiredParams(params);
            if (!missingParams.isEmpty()) {
                return buildNeedMoreInfoResult(missingParams);
            }

            // 3. 执行业务逻辑
            Map<String, Object> result = doExecute(factoryId, params, context);

            // 4. 构建成功响应
            String response = buildSuccessResult(result);
            logExecutionSuccess(toolCall, response);
            return response;

        } catch (IllegalArgumentException e) {
            log.warn("⚠️  参数验证失败: {}", e.getMessage());
            // 脱敏处理：只返回经过安全检查的消息
            String safeMessage = sanitizeErrorMessage(e.getMessage());
            return buildErrorResult("参数验证失败: " + safeMessage);
        } catch (Exception e) {
            logExecutionFailure(toolCall, e);
            // 脱敏处理：不暴露具体异常信息
            return buildSanitizedErrorResult(e);
        }
    }

    /**
     * 校验必需参数
     *
     * @param params 输入参数
     * @return 缺失的参数列表
     */
    protected List<String> validateRequiredParams(Map<String, Object> params) {
        List<String> required = getRequiredParameters();
        if (required == null || required.isEmpty()) {
            return new ArrayList<>();
        }

        return required.stream()
                .filter(p -> !params.containsKey(p) || params.get(p) == null ||
                             (params.get(p) instanceof String && ((String) params.get(p)).trim().isEmpty()))
                .collect(Collectors.toList());
    }

    /**
     * 构建需要更多信息的响应
     *
     * @param missingParams 缺失的参数列表
     * @return JSON响应
     */
    protected String buildNeedMoreInfoResult(List<String> missingParams) {
        try {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("status", "NEED_MORE_INFO");
            result.put("missingParameters", missingParams);
            result.put("message", "缺少必需参数: " + String.join(", ", missingParams));

            // 生成友好的提示问题
            List<String> questions = generateClarificationQuestions(missingParams);
            result.put("clarificationQuestions", questions);

            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.error("❌ 构建NEED_MORE_INFO结果失败", e);
            // 脱敏处理：不暴露序列化错误
            return buildErrorResult("响应处理失败");
        }
    }

    /**
     * 根据缺失参数生成澄清问题
     *
     * @param missingParams 缺失参数列表
     * @return 问题列表
     */
    protected List<String> generateClarificationQuestions(List<String> missingParams) {
        List<String> questions = new ArrayList<>();

        for (String param : missingParams) {
            String question = getParameterQuestion(param);
            if (question != null) {
                questions.add(question);
            } else {
                // 默认问题格式
                questions.add("请提供" + getParameterDisplayName(param));
            }
        }

        return questions;
    }

    /**
     * 获取参数的提示问题（子类可覆盖）
     *
     * @param paramName 参数名
     * @return 提示问题
     */
    protected String getParameterQuestion(String paramName) {
        // 通用参数问题映射
        Map<String, String> commonQuestions = Map.of(
            "batchId", "请问您要操作哪个批次？请提供批次ID或批次号。",
            "batchNumber", "请问您要操作哪个批次？请提供批次号。",
            "quantity", "请问数量是多少？",
            "materialTypeId", "请问是哪种原材料类型？",
            "productionPlanId", "请问是哪个生产计划？",
            "reason", "请说明原因。",
            "status", "请问要设置为什么状态？"
        );

        return commonQuestions.get(paramName);
    }

    /**
     * 获取参数显示名称（子类可覆盖）
     *
     * @param paramName 参数名
     * @return 显示名称
     */
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.ofEntries(
            Map.entry("batchId", "批次ID"),
            Map.entry("batchNumber", "批次号"),
            Map.entry("quantity", "数量"),
            Map.entry("materialTypeId", "原材料类型ID"),
            Map.entry("productionPlanId", "生产计划ID"),
            Map.entry("reason", "原因"),
            Map.entry("status", "状态"),
            Map.entry("supplierId", "供应商ID"),
            Map.entry("warningDays", "预警天数"),
            Map.entry("page", "页码"),
            Map.entry("size", "每页数量")
        );

        return displayNames.getOrDefault(paramName, paramName);
    }

    // ==================== 类型转换工具方法 ====================

    /**
     * 获取String参数
     */
    protected String getString(Map<String, Object> params, String key) {
        Object value = params.get(key);
        return value != null ? value.toString() : null;
    }

    /**
     * 获取String参数（带默认值）
     */
    protected String getString(Map<String, Object> params, String key, String defaultValue) {
        Object value = params.get(key);
        return value != null ? value.toString() : defaultValue;
    }

    /**
     * 获取Integer参数
     */
    protected Integer getInteger(Map<String, Object> params, String key) {
        Object value = params.get(key);
        if (value == null) return null;
        if (value instanceof Number) return ((Number) value).intValue();
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 获取Integer参数（带默认值）
     */
    protected Integer getInteger(Map<String, Object> params, String key, Integer defaultValue) {
        Integer value = getInteger(params, key);
        return value != null ? value : defaultValue;
    }

    /**
     * 获取Long参数
     */
    protected Long getLong(Map<String, Object> params, String key) {
        Object value = params.get(key);
        if (value == null) return null;
        if (value instanceof Number) return ((Number) value).longValue();
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 获取BigDecimal参数
     */
    protected BigDecimal getBigDecimal(Map<String, Object> params, String key) {
        Object value = params.get(key);
        if (value == null) return null;
        if (value instanceof BigDecimal) return (BigDecimal) value;
        if (value instanceof Number) return BigDecimal.valueOf(((Number) value).doubleValue());
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 获取Boolean参数
     */
    protected Boolean getBoolean(Map<String, Object> params, String key) {
        Object value = params.get(key);
        if (value == null) return null;
        if (value instanceof Boolean) return (Boolean) value;
        return Boolean.parseBoolean(value.toString());
    }

    /**
     * 获取Boolean参数（带默认值）
     */
    protected Boolean getBoolean(Map<String, Object> params, String key, Boolean defaultValue) {
        Boolean value = getBoolean(params, key);
        return value != null ? value : defaultValue;
    }

    /**
     * 获取List参数
     */
    @SuppressWarnings("unchecked")
    protected <T> List<T> getList(Map<String, Object> params, String key) {
        Object value = params.get(key);
        if (value == null) return null;
        if (value instanceof List) return (List<T>) value;
        return null;
    }

    // ==================== 结果构建工具方法 ====================

    /**
     * 构建分页结果
     */
    protected Map<String, Object> buildPageResult(List<?> content, long totalElements, int totalPages, int currentPage) {
        Map<String, Object> result = new HashMap<>();
        result.put("content", content);
        result.put("totalElements", totalElements);
        result.put("totalPages", totalPages);
        result.put("currentPage", currentPage);
        result.put("hasMore", currentPage < totalPages);
        return result;
    }

    /**
     * 构建简单成功结果
     */
    protected Map<String, Object> buildSimpleResult(String message, Object data) {
        Map<String, Object> result = new HashMap<>();
        result.put("message", message);
        result.put("data", data);
        return result;
    }
}
