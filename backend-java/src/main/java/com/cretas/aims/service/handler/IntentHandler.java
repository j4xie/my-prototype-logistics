package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
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
}
