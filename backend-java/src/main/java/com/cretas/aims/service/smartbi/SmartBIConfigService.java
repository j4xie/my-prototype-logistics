package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ConfigOperationResult;
import com.cretas.aims.entity.smartbi.*;

import java.util.List;
import java.util.Map;

/**
 * SmartBI 配置管理服务接口
 *
 * <p>提供统一的配置管理功能，包括：
 * <ul>
 *   <li>意图配置管理（CRUD + reload）</li>
 *   <li>告警阈值管理（CRUD + reload）</li>
 *   <li>激励规则管理（CRUD + reload）</li>
 *   <li>字段映射管理（CRUD + reload）</li>
 *   <li>指标公式管理（CRUD + reload）</li>
 *   <li>全局配置重载</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
public interface SmartBIConfigService {

    // ==================== 意图配置 ====================

    /**
     * 获取意图配置列表
     *
     * @param category 意图分类（可选，null 表示获取所有）
     * @return 意图配置列表
     */
    List<AiIntentConfig> listIntents(String category);

    /**
     * 创建意图配置
     *
     * @param config 意图配置
     * @return 创建结果
     */
    ConfigOperationResult createIntent(AiIntentConfig config);

    /**
     * 更新意图配置
     *
     * @param id     配置ID
     * @param config 意图配置
     * @return 更新结果
     */
    ConfigOperationResult updateIntent(String id, AiIntentConfig config);

    /**
     * 删除意图配置（软删除）
     *
     * @param id 配置ID
     * @return 删除结果
     */
    ConfigOperationResult deleteIntent(String id);

    /**
     * 重载意图配置缓存
     *
     * @return 重载结果
     */
    ConfigOperationResult reloadIntents();

    // ==================== 告警阈值 ====================

    /**
     * 获取告警阈值列表
     *
     * @param type 阈值类型（可选，null 表示获取所有）
     * @return 阈值配置列表
     */
    List<SmartBiAlertThreshold> listThresholds(String type);

    /**
     * 创建告警阈值
     *
     * @param threshold 阈值配置
     * @return 创建结果
     */
    ConfigOperationResult createThreshold(SmartBiAlertThreshold threshold);

    /**
     * 更新告警阈值
     *
     * @param id        配置ID
     * @param threshold 阈值配置
     * @return 更新结果
     */
    ConfigOperationResult updateThreshold(Long id, SmartBiAlertThreshold threshold);

    /**
     * 删除告警阈值（软删除）
     *
     * @param id 配置ID
     * @return 删除结果
     */
    ConfigOperationResult deleteThreshold(Long id);

    /**
     * 重载告警阈值缓存
     *
     * @return 重载结果
     */
    ConfigOperationResult reloadThresholds();

    // ==================== 激励规则 ====================

    /**
     * 获取激励规则列表
     *
     * @param ruleCode 规则代码（可选，null 表示获取所有）
     * @return 激励规则列表
     */
    List<SmartBiIncentiveRule> listIncentiveRules(String ruleCode);

    /**
     * 创建激励规则
     *
     * @param rule 激励规则
     * @return 创建结果
     */
    ConfigOperationResult createIncentiveRule(SmartBiIncentiveRule rule);

    /**
     * 更新激励规则
     *
     * @param id   配置ID
     * @param rule 激励规则
     * @return 更新结果
     */
    ConfigOperationResult updateIncentiveRule(Long id, SmartBiIncentiveRule rule);

    /**
     * 删除激励规则（软删除）
     *
     * @param id 配置ID
     * @return 删除结果
     */
    ConfigOperationResult deleteIncentiveRule(Long id);

    /**
     * 重载激励规则缓存
     *
     * @return 重载结果
     */
    ConfigOperationResult reloadIncentiveRules();

    // ==================== 字段映射 ====================

    /**
     * 获取字段映射列表
     *
     * @param dictType 字典类型（可选，null 表示获取所有）
     * @return 字段映射列表
     */
    List<SmartBiDictionary> listFieldMappings(String dictType);

    /**
     * 创建字段映射
     *
     * @param mapping 字段映射
     * @return 创建结果
     */
    ConfigOperationResult createFieldMapping(SmartBiDictionary mapping);

    /**
     * 更新字段映射
     *
     * @param id      配置ID
     * @param mapping 字段映射
     * @return 更新结果
     */
    ConfigOperationResult updateFieldMapping(Long id, SmartBiDictionary mapping);

    /**
     * 删除字段映射（软删除）
     *
     * @param id 配置ID
     * @return 删除结果
     */
    ConfigOperationResult deleteFieldMapping(Long id);

    /**
     * 重载字段映射缓存
     *
     * @return 重载结果
     */
    ConfigOperationResult reloadFieldMappings();

    // ==================== 指标公式 ====================

    /**
     * 获取指标公式列表
     *
     * @param formulaType 公式类型（可选，null 表示获取所有）
     * @return 指标公式列表
     */
    List<SmartBiMetricFormula> listMetricFormulas(String formulaType);

    /**
     * 创建指标公式
     *
     * @param formula 指标公式
     * @return 创建结果
     */
    ConfigOperationResult createMetricFormula(SmartBiMetricFormula formula);

    /**
     * 更新指标公式
     *
     * @param id      配置ID
     * @param formula 指标公式
     * @return 更新结果
     */
    ConfigOperationResult updateMetricFormula(Long id, SmartBiMetricFormula formula);

    /**
     * 删除指标公式（软删除）
     *
     * @param id 配置ID
     * @return 删除结果
     */
    ConfigOperationResult deleteMetricFormula(Long id);

    /**
     * 重载指标公式缓存
     *
     * @return 重载结果
     */
    ConfigOperationResult reloadMetricFormulas();

    // ==================== 全局操作 ====================

    /**
     * 重载所有配置缓存
     *
     * @return 重载结果
     */
    ConfigOperationResult reloadAll();

    /**
     * 获取配置状态摘要
     *
     * @return 配置状态信息（各类型配置数量、最后更新时间等）
     */
    Map<String, Object> getConfigStatus();
}
