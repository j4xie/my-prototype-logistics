package com.cretas.aims.service;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;

/**
 * AI意图执行服务接口
 *
 * 负责将识别到的意图路由到对应的业务模块执行:
 * - FORM: 表单字段生成 → FormTemplate/FormAssistant
 * - DATA_OP: 数据操作 → 对应业务Service
 * - ANALYSIS: 数据分析 → AI分析服务
 * - SCHEDULE: 排程操作 → Scheduling服务
 * - SYSTEM: 系统配置 → 配置服务
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
public interface IntentExecutorService {

    /**
     * 执行用户输入的AI意图
     *
     * 流程:
     * 1. 使用 AIIntentService 识别意图
     * 2. 检查用户权限
     * 3. 根据敏感度决定是否需要审批
     * 4. 路由到对应的 Handler 执行
     * 5. 返回执行结果
     *
     * @param factoryId 工厂ID
     * @param request 执行请求
     * @param userId 当前用户ID
     * @param userRole 当前用户角色
     * @return 执行响应
     */
    IntentExecuteResponse execute(String factoryId, IntentExecuteRequest request,
                                  Long userId, String userRole);

    /**
     * 预览执行结果 (不实际执行)
     *
     * @param factoryId 工厂ID
     * @param request 执行请求
     * @param userId 当前用户ID
     * @param userRole 当前用户角色
     * @return 预览响应
     */
    IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                  Long userId, String userRole);

    /**
     * 确认执行预览的操作
     *
     * @param factoryId 工厂ID
     * @param confirmToken 预览时返回的确认Token
     * @param userId 当前用户ID
     * @param userRole 当前用户角色
     * @return 执行响应
     */
    IntentExecuteResponse confirm(String factoryId, String confirmToken,
                                  Long userId, String userRole);
}
