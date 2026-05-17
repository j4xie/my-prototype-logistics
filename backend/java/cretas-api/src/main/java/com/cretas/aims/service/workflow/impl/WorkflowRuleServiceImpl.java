package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.dto.workflow.WorkflowRuleRequest;
import com.cretas.aims.entity.config.WorkflowRule;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.config.WorkflowRuleRepository;
import com.cretas.aims.service.workflow.WorkflowRuleService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * WorkflowRule CRUD service impl — Sprint 4 Wave 1 (C-WF-RULE-1).
 *
 * @since 2026-05-16
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class WorkflowRuleServiceImpl implements WorkflowRuleService {

    private final WorkflowRuleRepository ruleRepository;
    private final ObjectMapper objectMapper;

    private static final Set<String> AMOUNT_OPS = Set.of(">", ">=", "<", "<=", "==", "!=");

    @Override
    @Transactional
    public WorkflowRule create(String factoryId, WorkflowRuleRequest req) {
        log.info("创建 WorkflowRule - factoryId={}, workflowId={}, nodeId={}, ruleType={}",
                factoryId, req.getWorkflowId(), req.getNodeId(), req.getRuleType());
        validateExpression(req.getRuleType(), req.getExpression());

        WorkflowRule rule = WorkflowRule.builder()
                .factoryId(factoryId)
                .workflowId(req.getWorkflowId())
                .nodeId(req.getNodeId())
                .edgeId(req.getEdgeId())
                .ruleType(req.getRuleType())
                .expression(serialize(req.getExpression()))
                .trueTargetNodeId(req.getTrueTargetNodeId())
                .falseTargetNodeId(req.getFalseTargetNodeId())
                .priority(req.getPriority() == null ? 0 : req.getPriority())
                .enabled(req.getEnabled() == null ? Boolean.TRUE : req.getEnabled())
                .description(req.getDescription())
                .build();
        return ruleRepository.save(rule);
    }

    @Override
    @Transactional
    public WorkflowRule update(String factoryId, String id, WorkflowRuleRequest req) {
        WorkflowRule existing = getRequired(factoryId, id);
        log.info("更新 WorkflowRule - id={}, factoryId={}", id, factoryId);
        validateExpression(req.getRuleType(), req.getExpression());

        existing.setWorkflowId(req.getWorkflowId());
        existing.setNodeId(req.getNodeId());
        existing.setEdgeId(req.getEdgeId());
        existing.setRuleType(req.getRuleType());
        existing.setExpression(serialize(req.getExpression()));
        existing.setTrueTargetNodeId(req.getTrueTargetNodeId());
        existing.setFalseTargetNodeId(req.getFalseTargetNodeId());
        if (req.getPriority() != null) existing.setPriority(req.getPriority());
        if (req.getEnabled() != null) existing.setEnabled(req.getEnabled());
        existing.setDescription(req.getDescription());
        return ruleRepository.save(existing);
    }

    @Override
    @Transactional
    public void delete(String factoryId, String id) {
        WorkflowRule rule = getRequired(factoryId, id);
        log.info("软删除 WorkflowRule - id={}, factoryId={}", id, factoryId);
        rule.softDelete();
        ruleRepository.save(rule);
    }

    @Override
    public WorkflowRule getRequired(String factoryId, String id) {
        return ruleRepository.findByIdAndFactoryId(id, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowRule", "id", id));
    }

    @Override
    public List<WorkflowRule> listByWorkflow(String factoryId, String workflowId) {
        return ruleRepository.findByWorkflowIdAndFactoryIdOrderByNodeIdAscPriorityAsc(workflowId, factoryId);
    }

    @Override
    public List<WorkflowRule> findActiveByNode(String workflowId, String nodeId) {
        return ruleRepository.findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(workflowId, nodeId);
    }

    // ==================== Helpers ====================

    /**
     * 校验 expression 符合 ruleType schema. Fail-fast — 拒绝写入坏 rule.
     */
    private void validateExpression(WorkflowRule.RuleType ruleType, Map<String, Object> expr) {
        if (expr == null) {
            throw new BusinessException(400, "expression 不能为空");
        }
        switch (ruleType) {
            case AMOUNT_THRESHOLD -> {
                Object op = expr.get("op");
                Object value = expr.get("value");
                if (op == null || value == null) {
                    throw new BusinessException(400,
                            "AMOUNT_THRESHOLD 需要 op 和 value, 当前: " + expr);
                }
                if (!(op instanceof String s) || !AMOUNT_OPS.contains(s)) {
                    throw new BusinessException(400,
                            "AMOUNT_THRESHOLD op 必须是 " + AMOUNT_OPS + ", 当前: " + op);
                }
            }
            case DEPT_MATCH, ROLE_MATCH -> {
                Object in = expr.get("in");
                if (!(in instanceof java.util.Collection<?> coll) || coll.isEmpty()) {
                    throw new BusinessException(400,
                            ruleType + " 需要非空 in 数组, 当前: " + expr);
                }
            }
            case SPEL_CUSTOM -> {
                Object spel = expr.get("spel");
                if (!(spel instanceof String s) || s.isBlank()) {
                    throw new BusinessException(400,
                            "SPEL_CUSTOM 需要非空 spel 字段, 当前: " + expr);
                }
                if (s.length() > 1000) {
                    throw new BusinessException(400,
                            "SPEL_CUSTOM spel 长度不能超过 1000 字符 (当前 " + s.length() + ")");
                }
            }
        }
    }

    private String serialize(Map<String, Object> expr) {
        try {
            return objectMapper.writeValueAsString(expr);
        } catch (JsonProcessingException e) {
            throw new BusinessException(500, "expression 序列化失败: " + e.getMessage());
        }
    }
}
