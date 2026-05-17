package com.cretas.aims.service.impl;

import com.cretas.aims.entity.config.WorkflowVariableDef;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.config.WorkflowVariableDefRepository;
import com.cretas.aims.service.WorkflowVariableService;
import com.cretas.aims.service.workflow.SandboxedSpelEvaluator;
import com.cretas.aims.service.workflow.SandboxedSpelEvaluator.SpelEvaluationFailure;
import com.cretas.aims.service.workflow.WorkflowVariableContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@Slf4j
@RequiredArgsConstructor
public class WorkflowVariableServiceImpl implements WorkflowVariableService {

    private final WorkflowVariableDefRepository repository;
    private final SandboxedSpelEvaluator spelEvaluator;

    private static final Set<String> VALID_TYPES =
            Set.of("STRING", "NUMBER", "DECIMAL", "BOOLEAN", "DATE", "DATETIME");
    private static final Set<String> VALID_CATEGORIES =
            Set.of("OWN", "ORDER", "CUSTOMER", "BUSINESS", "CUSTOM");

    @Override
    public List<WorkflowVariableDef> listAvailable(String factoryId) {
        return repository.findAvailableForFactory(factoryId);
    }

    @Override
    public List<WorkflowVariableDef> listByFactory(String factoryId) {
        requireFactoryId(factoryId);
        return repository.findByFactoryIdAndIsActiveTrueOrderByCategoryAscVarNameAsc(factoryId);
    }

    @Override
    public List<WorkflowVariableDef> listSystemPresets() {
        return repository.findByFactoryIdIsNullAndIsActiveTrueOrderByCategoryAscVarNameAsc();
    }

    @Override
    public Optional<WorkflowVariableDef> getById(String factoryId, String id) {
        return repository.findById(id)
                .filter(v -> v.getFactoryId() == null || v.getFactoryId().equals(factoryId));
    }

    @Override
    @Transactional
    public WorkflowVariableDef create(String factoryId, WorkflowVariableDef def) {
        requireFactoryId(factoryId);
        if (!StringUtils.hasText(def.getVarName())) {
            throw new BusinessException(400, "varName 不能为空").withHintTarget("varName");
        }
        if (def.getVarName().length() > 100) {
            throw new BusinessException(400, "varName 长度不能超过 100 字").withHintTarget("varName");
        }
        validateType(def.getVarType());
        validateCategory(def.getCategory());

        def.setFactoryId(factoryId);
        if (def.getCategory() == null) def.setCategory("CUSTOM");
        if (def.getIsActive() == null) def.setIsActive(true);

        WorkflowVariableDef saved = repository.save(def);
        log.info("WorkflowVariableDef created - id={}, factoryId={}, varName={}",
                saved.getId(), factoryId, saved.getVarName());
        return saved;
    }

    @Override
    @Transactional
    public WorkflowVariableDef update(String factoryId, String id, WorkflowVariableDef partial) {
        requireFactoryId(factoryId);
        WorkflowVariableDef existing = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("工作流变量定义", "id", id));

        if (existing.getFactoryId() == null) {
            throw new BusinessException(403, "系统预设变量不可修改")
                    .withHint("如需扩展, 请新建工厂自定义变量");
        }
        if (!existing.getFactoryId().equals(factoryId)) {
            throw new BusinessException(403, "无权修改其他工厂的变量定义");
        }

        if (partial.getVarName() != null) {
            if (partial.getVarName().length() > 100) {
                throw new BusinessException(400, "varName 长度不能超过 100 字").withHintTarget("varName");
            }
            existing.setVarName(partial.getVarName());
        }
        if (partial.getVarType() != null) {
            validateType(partial.getVarType());
            existing.setVarType(partial.getVarType());
        }
        if (partial.getCategory() != null) {
            validateCategory(partial.getCategory());
            existing.setCategory(partial.getCategory());
        }
        if (partial.getDescription() != null) existing.setDescription(partial.getDescription());
        if (partial.getSampleValue() != null) existing.setSampleValue(partial.getSampleValue());
        if (partial.getIsActive() != null) existing.setIsActive(partial.getIsActive());

        WorkflowVariableDef saved = repository.save(existing);
        log.info("WorkflowVariableDef updated - id={}", saved.getId());
        return saved;
    }

    @Override
    @Transactional
    public void delete(String factoryId, String id) {
        requireFactoryId(factoryId);
        WorkflowVariableDef existing = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("工作流变量定义", "id", id));

        if (existing.getFactoryId() == null) {
            throw new BusinessException(403, "系统预设变量不可删除");
        }
        if (!existing.getFactoryId().equals(factoryId)) {
            throw new BusinessException(403, "无权删除其他工厂的变量定义");
        }
        repository.delete(existing);
        log.info("WorkflowVariableDef deleted - id={}", id);
    }

    @Override
    public Map<String, Object> testExpression(String factoryId, String spel,
                                              Map<String, Object> sampleContext) {
        if (!StringUtils.hasText(spel)) {
            throw new BusinessException(400, "spel 表达式不能为空").withHintTarget("spel");
        }
        WorkflowVariableContext ctx = buildContext(sampleContext);
        Map<String, Object> response = new LinkedHashMap<>();
        try {
            Object result = spelEvaluator.evaluate(spel, ctx.toSpelVariables());
            response.put("success", true);
            response.put("result", result);
            response.put("resultType", result == null ? "null" : result.getClass().getSimpleName());
        } catch (SpelEvaluationFailure e) {
            response.put("success", false);
            response.put("errorMessage", e.getUserMessage());
            response.put("actionHint", e.getActionHint()); // R5 友好提示
        }
        return response;
    }

    // ==================== helpers ====================

    /**
     * sampleContext 形如 {"own": {"role": "admin"}, "order": {"amount": 15000}}.
     * 转成 WorkflowVariableContext POJO.
     */
    @SuppressWarnings("unchecked")
    private WorkflowVariableContext buildContext(Map<String, Object> sampleContext) {
        WorkflowVariableContext ctx = new WorkflowVariableContext();
        if (sampleContext == null) return ctx;

        Object ownRaw = sampleContext.get("own");
        if (ownRaw instanceof Map<?, ?> ownMap) {
            ctx.setOwn(new WorkflowVariableContext.OwnContext(
                    asLong(ownMap.get("userId")),
                    asString(ownMap.get("username")),
                    asString(ownMap.get("role")),
                    asString(ownMap.get("department"))));
        }
        Object orderRaw = sampleContext.get("order");
        if (orderRaw instanceof Map<?, ?> orderMap) {
            ctx.setOrder(new WorkflowVariableContext.OrderContext(
                    asString(orderMap.get("orderNumber")),
                    asDecimal(orderMap.get("amount")),
                    asString(orderMap.get("type")),
                    asLong(orderMap.get("creatorId")),
                    asString(orderMap.get("status"))));
        }
        Object custRaw = sampleContext.get("customer");
        if (custRaw instanceof Map<?, ?> custMap) {
            ctx.setCustomer(new WorkflowVariableContext.CustomerContext(
                    asString(custMap.get("id")),
                    asString(custMap.get("name")),
                    asString(custMap.get("level")),
                    asDecimal(custMap.get("creditLimit"))));
        }
        Object bizRaw = sampleContext.get("businessEntity");
        if (bizRaw instanceof Map<?, ?> bizMap) {
            ctx.setBusinessEntity((Map<String, Object>) bizMap);
        }
        return ctx;
    }

    private void validateType(String type) {
        if (type == null || !VALID_TYPES.contains(type)) {
            throw new BusinessException(400,
                    "varType 非法: " + type + " (合法: " + VALID_TYPES + ")")
                    .withHintTarget("varType");
        }
    }

    private void validateCategory(String category) {
        if (category != null && !VALID_CATEGORIES.contains(category)) {
            throw new BusinessException(400,
                    "category 非法: " + category + " (合法: " + VALID_CATEGORIES + ")")
                    .withHintTarget("category");
        }
    }

    private void requireFactoryId(String factoryId) {
        if (!StringUtils.hasText(factoryId)) {
            throw new BusinessException(400, "factoryId 不能为空");
        }
    }

    private Long asLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        if (v instanceof String s) {
            try { return Long.parseLong(s); } catch (NumberFormatException ignored) { /* fall */ }
        }
        return null;
    }

    private String asString(Object v) { return v == null ? null : String.valueOf(v); }

    private BigDecimal asDecimal(Object v) {
        if (v == null) return null;
        if (v instanceof BigDecimal bd) return bd;
        if (v instanceof Number n) return new BigDecimal(n.toString());
        if (v instanceof String s) {
            try { return new BigDecimal(s); } catch (NumberFormatException ignored) { /* fall */ }
        }
        return null;
    }
}
