package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.IntentSemantics;
import com.cretas.aims.entity.config.AIIntentConfig;

/**
 * AI意图处理器接口
 *
 * 每个意图分类(FORM, DATA_OP, ANALYSIS等)需要实现此接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
public interface IntentHandler {

    /**
     * 获取处理器支持的意图分类
     *
     * @return 意图分类 (FORM, DATA_OP, ANALYSIS, SCHEDULE, SYSTEM)
     */
    String getSupportedCategory();

    /**
     * 执行意图
     *
     * @param factoryId 工厂ID
     * @param request 执行请求
     * @param intentConfig 意图配置
     * @param userId 用户ID
     * @param userRole 用户角色
     * @return 执行响应
     */
    IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                 AIIntentConfig intentConfig, Long userId, String userRole);

    /**
     * 预览执行结果
     *
     * @param factoryId 工厂ID
     * @param request 执行请求
     * @param intentConfig 意图配置
     * @param userId 用户ID
     * @param userRole 用户角色
     * @return 预览响应
     */
    IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                  AIIntentConfig intentConfig, Long userId, String userRole);

    /**
     * 使用语义模式执行意图
     *
     * 默认实现委托到原handle方法，保持向后兼容。
     * 支持语义模式的Handler应该覆盖此方法。
     *
     * @param factoryId 工厂ID
     * @param semantics 语义解析结果
     * @param intentConfig 意图配置
     * @param userId 用户ID
     * @param userRole 用户角色
     * @return 执行响应
     */
    default IntentExecuteResponse handleWithSemantics(String factoryId, IntentSemantics semantics,
            AIIntentConfig intentConfig, Long userId, String userRole) {
        // 默认委托到原handle方法，保持向后兼容
        // 合并 rawContext 和 constraints 到 context
        java.util.Map<String, Object> mergedContext = new java.util.HashMap<>();
        if (semantics.getRawContext() != null) {
            mergedContext.putAll(semantics.getRawContext());
        }
        // 将 constraints 转换到 context 中
        if (semantics.getConstraints() != null) {
            for (com.cretas.aims.dto.intent.Constraint c : semantics.getConstraints()) {
                if (c.getField() != null && c.getValue() != null) {
                    mergedContext.put(c.getField(), c.getValue());
                }
            }
        }
        // 添加 objectId 和 objectIdentifier
        if (semantics.getObjectId() != null) {
            mergedContext.put("batchId", semantics.getObjectId());
            mergedContext.put("objectId", semantics.getObjectId());
        }
        if (semantics.getObjectIdentifier() != null) {
            mergedContext.put("batchNumber", semantics.getObjectIdentifier());
        }
        // 获取 userInput（从 rawContext 或保持原样）
        String userInput = "";
        if (semantics.getRawContext() != null && semantics.getRawContext().containsKey("userInput")) {
            userInput = (String) semantics.getRawContext().get("userInput");
        }
        IntentExecuteRequest request = IntentExecuteRequest.builder()
            .userInput(userInput != null ? userInput : "")
            .context(mergedContext)
            .build();
        return handle(factoryId, request, intentConfig, userId, userRole);
    }

    /**
     * 检查处理器是否支持语义模式
     *
     * 返回true的Handler应该覆盖handleWithSemantics方法以提供语义感知的处理逻辑。
     *
     * @return 是否支持语义模式
     */
    default boolean supportsSemanticsMode() {
        return false;
    }
}
