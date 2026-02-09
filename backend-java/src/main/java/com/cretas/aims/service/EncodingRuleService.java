package com.cretas.aims.service;

import com.cretas.aims.entity.config.EncodingRule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 编码规则服务接口
 *
 * 提供:
 * - 编码规则 CRUD
 * - 根据规则生成编码
 * - 序列号管理
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
public interface EncodingRuleService {

    /**
     * 根据规则生成下一个编码
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 生成的编码
     */
    String generateCode(String factoryId, String entityType);

    /**
     * 根据规则生成下一个编码（带上下文变量）
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @param context 上下文变量（如：部门代码、产品类型等）
     * @return 生成的编码
     */
    String generateCode(String factoryId, String entityType, Map<String, String> context);

    /**
     * 预览编码（不消耗序号）
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 预览的编码
     */
    String previewCode(String factoryId, String entityType);

    /**
     * 获取编码规则
     *
     * @param ruleId 规则ID
     * @return 编码规则
     */
    Optional<EncodingRule> getRule(String ruleId);

    /**
     * 获取工厂的编码规则
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 编码规则（如果存在）
     */
    Optional<EncodingRule> getRule(String factoryId, String entityType);

    /**
     * 获取工厂的所有编码规则
     *
     * @param factoryId 工厂ID
     * @return 编码规则列表
     */
    List<EncodingRule> getRules(String factoryId);

    /**
     * 分页获取工厂的编码规则
     *
     * @param factoryId 工厂ID
     * @param pageable 分页参数
     * @return 分页编码规则列表
     */
    Page<EncodingRule> getRules(String factoryId, Pageable pageable);

    /**
     * 获取系统默认编码规则
     *
     * @return 系统默认编码规则列表
     */
    List<EncodingRule> getSystemDefaultRules();

    /**
     * 创建编码规则
     *
     * @param rule 编码规则
     * @param userId 创建者用户ID
     * @return 创建的编码规则
     */
    EncodingRule createRule(EncodingRule rule, Long userId);

    /**
     * 更新编码规则
     *
     * @param ruleId 规则ID
     * @param rule 更新的编码规则
     * @param userId 更新者用户ID
     * @return 更新后的编码规则
     */
    EncodingRule updateRule(String ruleId, EncodingRule rule, Long userId);

    /**
     * 启用/禁用编码规则
     *
     * @param ruleId 规则ID
     * @param enabled 是否启用
     * @return 更新后的编码规则
     */
    EncodingRule toggleEnabled(String ruleId, boolean enabled);

    /**
     * 删除编码规则
     *
     * @param ruleId 规则ID
     */
    void deleteRule(String ruleId);

    /**
     * 重置序列号
     *
     * @param ruleId 规则ID
     */
    void resetSequence(String ruleId);

    /**
     * 验证编码模板格式
     *
     * @param pattern 编码模板
     * @return 验证结果
     */
    Map<String, Object> validatePattern(String pattern);

    /**
     * 获取支持的占位符列表
     *
     * @return 占位符列表
     */
    List<Map<String, String>> getSupportedPlaceholders();

    /**
     * 获取编码规则统计
     *
     * @param factoryId 工厂ID
     * @return 统计信息
     */
    Map<String, Object> getStatistics(String factoryId);
}
