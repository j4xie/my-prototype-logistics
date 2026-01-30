package com.cretas.aims.service;

import com.cretas.aims.dto.platform.AIQuotaRuleDTO;
import com.cretas.aims.dto.platform.CreateAIQuotaRuleRequest;
import com.cretas.aims.dto.platform.UpdateAIQuotaRuleRequest;

import java.util.List;

/**
 * AI配额规则服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
public interface AIQuotaRuleService {

    /**
     * 获取所有配额规则
     *
     * @return 规则列表
     */
    List<AIQuotaRuleDTO> getAllRules();

    /**
     * 获取指定工厂的配额规则
     *
     * @param factoryId 工厂ID
     * @return 配额规则
     */
    AIQuotaRuleDTO getRuleByFactory(String factoryId);

    /**
     * 获取工厂的有效配额规则（包括继承的全局规则）
     *
     * @param factoryId 工厂ID
     * @return 有效配额规则
     */
    AIQuotaRuleDTO getEffectiveRuleByFactory(String factoryId);

    /**
     * 创建配额规则
     *
     * @param request 创建请求
     * @return 创建的规则
     */
    AIQuotaRuleDTO createRule(CreateAIQuotaRuleRequest request);

    /**
     * 更新配额规则
     *
     * @param ruleId  规则ID
     * @param request 更新请求
     * @return 更新后的规则
     */
    AIQuotaRuleDTO updateRule(Long ruleId, UpdateAIQuotaRuleRequest request);

    /**
     * 删除配额规则
     *
     * @param ruleId 规则ID
     */
    void deleteRule(Long ruleId);

    /**
     * 计算用户的实际配额
     *
     * @param factoryId 工厂ID
     * @param role      用户角色
     * @return 实际配额
     */
    Integer calculateQuotaForUser(String factoryId, String role);

    /**
     * 获取全局默认规则
     *
     * @return 全局默认规则
     */
    AIQuotaRuleDTO getGlobalDefaultRule();

    /**
     * 创建或更新全局默认规则
     *
     * @param request 创建/更新请求
     * @return 全局默认规则
     */
    AIQuotaRuleDTO createOrUpdateGlobalDefaultRule(CreateAIQuotaRuleRequest request);
}
