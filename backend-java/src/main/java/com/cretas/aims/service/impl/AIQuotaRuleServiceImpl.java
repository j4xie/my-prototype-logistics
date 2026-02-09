package com.cretas.aims.service.impl;

import com.cretas.aims.dto.platform.AIQuotaRuleDTO;
import com.cretas.aims.dto.platform.CreateAIQuotaRuleRequest;
import com.cretas.aims.dto.platform.UpdateAIQuotaRuleRequest;
import com.cretas.aims.entity.AIQuotaRule;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.AIQuotaRuleRepository;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.service.AIQuotaRuleService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * AI配额规则服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Service
@RequiredArgsConstructor
public class AIQuotaRuleServiceImpl implements AIQuotaRuleService {
    private static final Logger log = LoggerFactory.getLogger(AIQuotaRuleServiceImpl.class);

    private final AIQuotaRuleRepository quotaRuleRepository;
    private final FactoryRepository factoryRepository;
    private final ObjectMapper objectMapper;

    @Override
    public List<AIQuotaRuleDTO> getAllRules() {
        log.info("获取所有AI配额规则");
        List<AIQuotaRule> rules = quotaRuleRepository.findAll();
        return rules.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Override
    public AIQuotaRuleDTO getRuleByFactory(String factoryId) {
        log.info("获取工厂配额规则: factoryId={}", factoryId);

        AIQuotaRule rule = quotaRuleRepository.findByFactoryIdAndEnabledTrue(factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("工厂配额规则不存在: " + factoryId));

        return convertToDTO(rule);
    }

    @Override
    public AIQuotaRuleDTO getEffectiveRuleByFactory(String factoryId) {
        log.info("获取工厂有效配额规则: factoryId={}", factoryId);

        // 1. 尝试获取工厂特定规则
        AIQuotaRule rule = quotaRuleRepository.findByFactoryIdAndEnabledTrue(factoryId)
                .orElse(null);

        if (rule != null) {
            log.debug("使用工厂特定规则: factoryId={}, weeklyQuota={}", factoryId, rule.getWeeklyQuota());
            return convertToDTO(rule);
        }

        // 2. 使用全局默认规则
        rule = quotaRuleRepository.findByFactoryIdIsNullAndEnabledTrue()
                .orElse(null);

        if (rule != null) {
            log.debug("使用全局默认规则: weeklyQuota={}", rule.getWeeklyQuota());
            return convertToDTO(rule);
        }

        // 3. 返回硬编码的默认值（向后兼容）
        log.warn("未找到配额规则，使用硬编码默认值: factoryId={}", factoryId);
        return AIQuotaRuleDTO.builder()
                .factoryId(factoryId)
                .weeklyQuota(20)
                .resetDayOfWeek(1)
                .enabled(true)
                .priority(0)
                .description("系统默认配额（硬编码）")
                .roleMultipliers(new HashMap<>())
                .build();
    }

    @Override
    @Transactional
    public AIQuotaRuleDTO createRule(CreateAIQuotaRuleRequest request) {
        log.info("创建AI配额规则: factoryId={}, weeklyQuota={}",
                request.getFactoryId(), request.getWeeklyQuota());

        // 验证工厂存在（如果不是全局规则）
        if (request.getFactoryId() != null) {
            factoryRepository.findById(request.getFactoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("工厂不存在: " + request.getFactoryId()));

            // 检查是否已存在规则
            if (quotaRuleRepository.existsByFactoryId(request.getFactoryId())) {
                throw new BusinessException("工厂已存在配额规则，请使用更新接口: " + request.getFactoryId());
            }
        }

        AIQuotaRule rule = AIQuotaRule.builder()
                .factoryId(request.getFactoryId())
                .weeklyQuota(request.getWeeklyQuota() != null ? request.getWeeklyQuota() : 20)
                .resetDayOfWeek(request.getResetDayOfWeek() != null ? request.getResetDayOfWeek() : 1)
                .enabled(request.getEnabled() != null ? request.getEnabled() : true)
                .priority(request.getPriority() != null ? request.getPriority() : 0)
                .description(request.getDescription())
                .build();

        // 设置角色系数
        if (request.getRoleMultipliers() != null && !request.getRoleMultipliers().isEmpty()) {
            rule.setRoleMultipliersMap(request.getRoleMultipliers());
        }

        rule = quotaRuleRepository.save(rule);
        log.info("AI配额规则创建成功: id={}, factoryId={}", rule.getId(), rule.getFactoryId());

        return convertToDTO(rule);
    }

    @Override
    @Transactional
    public AIQuotaRuleDTO updateRule(Long ruleId, UpdateAIQuotaRuleRequest request) {
        log.info("更新AI配额规则: ruleId={}", ruleId);

        AIQuotaRule rule = quotaRuleRepository.findById(ruleId)
                .orElseThrow(() -> new ResourceNotFoundException("配额规则不存在: " + ruleId));

        // 更新字段（只更新非null的字段）
        if (request.getWeeklyQuota() != null) {
            rule.setWeeklyQuota(request.getWeeklyQuota());
        }
        if (request.getResetDayOfWeek() != null) {
            rule.setResetDayOfWeek(request.getResetDayOfWeek());
        }
        if (request.getEnabled() != null) {
            rule.setEnabled(request.getEnabled());
        }
        if (request.getPriority() != null) {
            rule.setPriority(request.getPriority());
        }
        if (request.getDescription() != null) {
            rule.setDescription(request.getDescription());
        }
        if (request.getRoleMultipliers() != null) {
            rule.setRoleMultipliersMap(request.getRoleMultipliers());
        }

        rule = quotaRuleRepository.save(rule);
        log.info("AI配额规则更新成功: id={}, factoryId={}", rule.getId(), rule.getFactoryId());

        return convertToDTO(rule);
    }

    @Override
    @Transactional
    public void deleteRule(Long ruleId) {
        log.info("删除AI配额规则: ruleId={}", ruleId);

        if (!quotaRuleRepository.existsById(ruleId)) {
            throw new ResourceNotFoundException("配额规则不存在: " + ruleId);
        }

        quotaRuleRepository.deleteById(ruleId);
        log.info("AI配额规则删除成功: ruleId={}", ruleId);
    }

    @Override
    public Integer calculateQuotaForUser(String factoryId, String role) {
        log.debug("计算用户配额: factoryId={}, role={}", factoryId, role);

        AIQuotaRuleDTO rule = getEffectiveRuleByFactory(factoryId);

        // 计算角色配额
        Map<String, Double> multipliers = rule.getRoleMultipliers();
        if (multipliers == null || multipliers.isEmpty()) {
            return rule.getWeeklyQuota();
        }

        Double multiplier = multipliers.getOrDefault(role, 1.0);
        Integer quota = (int) Math.ceil(rule.getWeeklyQuota() * multiplier);

        log.debug("用户配额计算完成: factoryId={}, role={}, baseQuota={}, multiplier={}, finalQuota={}",
                factoryId, role, rule.getWeeklyQuota(), multiplier, quota);

        return quota;
    }

    @Override
    public AIQuotaRuleDTO getGlobalDefaultRule() {
        log.info("获取全局默认配额规则");

        AIQuotaRule rule = quotaRuleRepository.findByFactoryIdIsNullAndEnabledTrue()
                .orElse(null);

        if (rule == null) {
            // 返回硬编码的默认值
            return AIQuotaRuleDTO.builder()
                    .weeklyQuota(20)
                    .resetDayOfWeek(1)
                    .enabled(true)
                    .priority(0)
                    .description("系统默认配额（未配置）")
                    .roleMultipliers(new HashMap<>())
                    .build();
        }

        return convertToDTO(rule);
    }

    @Override
    @Transactional
    public AIQuotaRuleDTO createOrUpdateGlobalDefaultRule(CreateAIQuotaRuleRequest request) {
        log.info("创建或更新全局默认配额规则: weeklyQuota={}", request.getWeeklyQuota());

        // 设置factoryId为null（全局规则）
        request.setFactoryId(null);

        // 查找现有全局规则
        AIQuotaRule existingRule = quotaRuleRepository.findByFactoryIdIsNullAndEnabledTrue()
                .orElse(null);

        if (existingRule != null) {
            // 更新现有规则
            UpdateAIQuotaRuleRequest updateRequest = UpdateAIQuotaRuleRequest.builder()
                    .weeklyQuota(request.getWeeklyQuota())
                    .resetDayOfWeek(request.getResetDayOfWeek())
                    .enabled(request.getEnabled())
                    .priority(request.getPriority())
                    .description(request.getDescription())
                    .roleMultipliers(request.getRoleMultipliers())
                    .build();

            return updateRule(existingRule.getId(), updateRequest);
        } else {
            // 创建新规则
            return createRule(request);
        }
    }

    /**
     * 转换Entity为DTO
     */
    private AIQuotaRuleDTO convertToDTO(AIQuotaRule rule) {
        AIQuotaRuleDTO.AIQuotaRuleDTOBuilder builder = AIQuotaRuleDTO.builder()
                .id(rule.getId())
                .factoryId(rule.getFactoryId())
                .weeklyQuota(rule.getWeeklyQuota())
                .resetDayOfWeek(rule.getResetDayOfWeek())
                .enabled(rule.getEnabled())
                .priority(rule.getPriority())
                .description(rule.getDescription())
                .createdAt(rule.getCreatedAt())
                .updatedAt(rule.getUpdatedAt());

        // 添加工厂名称
        if (rule.getFactoryId() != null) {
            factoryRepository.findById(rule.getFactoryId())
                    .ifPresent(factory -> builder.factoryName(factory.getName()));
        } else {
            builder.factoryName("全局默认规则");
        }

        // 解析角色系数
        Map<String, Double> roleMultipliers = rule.getRoleMultipliersMap();
        builder.roleMultipliers(roleMultipliers != null ? roleMultipliers : new HashMap<>());

        return builder.build();
    }
}
