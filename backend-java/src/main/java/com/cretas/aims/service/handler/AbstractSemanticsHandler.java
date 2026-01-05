package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.IntentSemantics;
import com.cretas.aims.entity.config.AIIntentConfig;
import lombok.extern.slf4j.Slf4j;

/**
 * 语义感知Handler基类
 *
 * 新的Handler可以继承此类以获得语义解析能力。
 * 提供了从IntentSemantics中提取各种类型值的辅助方法。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Slf4j
public abstract class AbstractSemanticsHandler implements IntentHandler {

    @Override
    public boolean supportsSemanticsMode() {
        return true;
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
            AIIntentConfig intentConfig, Long userId, String userRole) {
        // 语义感知Handler不应该直接调用此方法
        // 但为了兼容，创建一个基础语义对象
        IntentSemantics semantics = IntentSemantics.builder()
            .rawContext(request.getContext())
            .build();
        return handleWithSemantics(factoryId, semantics, intentConfig, userId, userRole);
    }

    @Override
    public abstract IntentExecuteResponse handleWithSemantics(String factoryId, IntentSemantics semantics,
            AIIntentConfig intentConfig, Long userId, String userRole);

    /**
     * 从语义中提取字符串值
     *
     * @param semantics 语义对象
     * @param field 字段名
     * @return 字符串值，如果不存在返回null
     */
    protected String getStringValue(IntentSemantics semantics, String field) {
        Object value = semantics.getConstraintValue(field);
        if (value != null) {
            return String.valueOf(value);
        }
        // 降级到rawContext
        if (semantics.getRawContext() != null) {
            Object rawValue = semantics.getRawContext().get(field);
            return rawValue != null ? String.valueOf(rawValue) : null;
        }
        return null;
    }

    /**
     * 从语义中提取Long值
     *
     * @param semantics 语义对象
     * @param field 字段名
     * @return Long值，如果不存在或无法转换返回null
     */
    protected Long getLongValue(IntentSemantics semantics, String field) {
        Object value = semantics.getConstraintValue(field);
        if (value == null && semantics.getRawContext() != null) {
            value = semantics.getRawContext().get(field);
        }
        if (value == null) return null;
        if (value instanceof Long) return (Long) value;
        if (value instanceof Number) return ((Number) value).longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException e) {
            log.warn("Failed to parse Long value for field '{}': {}", field, value);
            return null;
        }
    }

    /**
     * 从语义中提取Integer值
     *
     * @param semantics 语义对象
     * @param field 字段名
     * @return Integer值，如果不存在或无法转换返回null
     */
    protected Integer getIntValue(IntentSemantics semantics, String field) {
        Long longValue = getLongValue(semantics, field);
        return longValue != null ? longValue.intValue() : null;
    }

    /**
     * 从语义中提取Double值
     *
     * @param semantics 语义对象
     * @param field 字段名
     * @return Double值，如果不存在或无法转换返回null
     */
    protected Double getDoubleValue(IntentSemantics semantics, String field) {
        Object value = semantics.getConstraintValue(field);
        if (value == null && semantics.getRawContext() != null) {
            value = semantics.getRawContext().get(field);
        }
        if (value == null) return null;
        if (value instanceof Double) return (Double) value;
        if (value instanceof Number) return ((Number) value).doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException e) {
            log.warn("Failed to parse Double value for field '{}': {}", field, value);
            return null;
        }
    }

    /**
     * 从语义中提取Boolean值
     *
     * @param semantics 语义对象
     * @param field 字段名
     * @return Boolean值，如果不存在返回null
     */
    protected Boolean getBooleanValue(IntentSemantics semantics, String field) {
        Object value = semantics.getConstraintValue(field);
        if (value == null && semantics.getRawContext() != null) {
            value = semantics.getRawContext().get(field);
        }
        if (value == null) return null;
        if (value instanceof Boolean) return (Boolean) value;
        String strValue = String.valueOf(value).toLowerCase();
        return "true".equals(strValue) || "1".equals(strValue) || "yes".equals(strValue);
    }

    /**
     * 获取对象标识符
     *
     * @param semantics 语义对象
     * @return 对象ID
     */
    protected String getObjectId(IntentSemantics semantics) {
        return semantics.getObjectId();
    }

    /**
     * 获取对象辅助标识符
     *
     * @param semantics 语义对象
     * @return 辅助标识符
     */
    protected String getObjectIdentifier(IntentSemantics semantics) {
        return semantics.getObjectIdentifier();
    }
}
