package com.cretas.aims.service;

import com.cretas.aims.entity.config.AIIntentConfig;

import java.util.List;
import java.util.Optional;

/**
 * AI意图服务接口
 *
 * 提供AI请求的意图识别和配置管理:
 * - 意图识别：根据用户输入匹配意图
 * - 权限校验：检查用户角色是否允许执行
 * - 敏感度控制：根据敏感级别决定审批流程
 * - 配额管理：计算配额消耗
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
public interface AIIntentService {

    // ==================== 意图识别 ====================

    /**
     * 识别用户输入的意图
     *
     * @param userInput 用户输入文本
     * @return 匹配的意图配置 (按优先级排序，返回最高优先级)
     */
    Optional<AIIntentConfig> recognizeIntent(String userInput);

    /**
     * 识别所有可能的意图
     *
     * @param userInput 用户输入文本
     * @return 所有匹配的意图配置列表
     */
    List<AIIntentConfig> recognizeAllIntents(String userInput);

    /**
     * 根据意图代码获取配置
     *
     * @param intentCode 意图代码
     * @return 意图配置
     */
    Optional<AIIntentConfig> getIntentByCode(String intentCode);

    // ==================== 权限校验 ====================

    /**
     * 检查用户角色是否有权限执行意图
     *
     * @param intentCode 意图代码
     * @param userRole 用户角色
     * @return 是否有权限
     */
    boolean hasPermission(String intentCode, String userRole);

    /**
     * 检查意图是否需要审批
     *
     * @param intentCode 意图代码
     * @return 是否需要审批
     */
    boolean requiresApproval(String intentCode);

    /**
     * 获取意图的审批链ID
     *
     * @param intentCode 意图代码
     * @return 审批链ID (如果需要审批)
     */
    Optional<String> getApprovalChainId(String intentCode);

    // ==================== 配额管理 ====================

    /**
     * 获取意图的配额消耗
     *
     * @param intentCode 意图代码
     * @return 配额消耗值
     */
    int getQuotaCost(String intentCode);

    /**
     * 获取意图的缓存TTL
     *
     * @param intentCode 意图代码
     * @return 缓存有效期 (分钟)，0表示不缓存
     */
    int getCacheTtl(String intentCode);

    // ==================== 意图查询 ====================

    /**
     * 获取所有启用的意图配置
     *
     * @return 意图配置列表
     */
    List<AIIntentConfig> getAllIntents();

    /**
     * 根据分类获取意图配置
     *
     * @param category 意图分类
     * @return 意图配置列表
     */
    List<AIIntentConfig> getIntentsByCategory(String category);

    /**
     * 根据敏感度级别获取意图配置
     *
     * @param sensitivityLevel 敏感度级别 (LOW, MEDIUM, HIGH, CRITICAL)
     * @return 意图配置列表
     */
    List<AIIntentConfig> getIntentsBySensitivity(String sensitivityLevel);

    /**
     * 获取所有意图分类
     *
     * @return 分类列表
     */
    List<String> getAllCategories();

    // ==================== 意图管理 ====================

    /**
     * 创建意图配置
     *
     * @param intentConfig 意图配置
     * @return 创建的意图配置
     */
    AIIntentConfig createIntent(AIIntentConfig intentConfig);

    /**
     * 更新意图配置
     *
     * @param intentConfig 意图配置
     * @return 更新后的意图配置
     */
    AIIntentConfig updateIntent(AIIntentConfig intentConfig);

    /**
     * 删除意图配置 (软删除)
     *
     * @param intentCode 意图代码
     */
    void deleteIntent(String intentCode);

    /**
     * 启用/禁用意图
     *
     * @param intentCode 意图代码
     * @param active 是否启用
     */
    void setIntentActive(String intentCode, boolean active);

    // ==================== 缓存管理 ====================

    /**
     * 清除意图配置缓存
     */
    void clearCache();

    /**
     * 刷新意图配置缓存
     */
    void refreshCache();
}
