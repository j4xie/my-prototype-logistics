package com.cretas.aims.service;

import com.cretas.aims.event.SopUploadedEvent;

import java.util.Map;

/**
 * SOP Agent 编排服务接口
 *
 * <p>负责编排和执行 SOP 相关的 AI Agent 工作流，包括：
 * <ul>
 *   <li>监听 SOP 上传事件</li>
 *   <li>根据配置的规则执行工具链</li>
 *   <li>管理工具执行上下文</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
public interface SopAgentOrchestrator {

    /**
     * 处理 SOP 上传事件
     *
     * @param event SOP上传事件
     */
    void handleSopUpload(SopUploadedEvent event);

    /**
     * 执行工具链
     *
     * @param factoryId 工厂ID
     * @param triggerType 触发类型
     * @param context 执行上下文
     * @return 执行结果
     */
    Map<String, Object> executeToolChain(String factoryId, String triggerType, Map<String, Object> context);

    /**
     * 执行单个规则的工具链
     *
     * @param ruleId 规则ID
     * @param context 执行上下文
     * @return 执行结果
     */
    Map<String, Object> executeRuleToolChain(String ruleId, Map<String, Object> context);

    /**
     * 分析 SOP 文档并更新 SKU 复杂度
     *
     * @param factoryId 工厂ID
     * @param fileUrl 文件URL
     * @param skuCode SKU编码
     * @return 分析结果
     */
    Map<String, Object> analyzeSopAndUpdateComplexity(String factoryId, String fileUrl, String skuCode);
}
