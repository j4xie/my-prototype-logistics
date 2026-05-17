package com.cretas.aims.service.workflow;

import com.cretas.aims.engine.SpelConditionEvaluator;
import com.cretas.aims.entity.config.WorkflowRule;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.Map;

/**
 * WorkflowRule 求值引擎 — 4 类 ruleType impl.
 *
 * <p>Sprint 4 Wave 1 (C-WF-RULE-1). 跟 {@link SpelConditionEvaluator} 配合:
 * 仅 {@code SPEL_CUSTOM} 走 SpEL sandbox, 其余 3 类直接 JSON 比对, 攻击面更小.
 *
 * <p><b>Fail-closed</b>: 任何异常 (JSON parse / missing field / SpEL parse fail)
 * 一律返 false. Caller (executor) 走 fall-through 逻辑. 不抛异常给上层.
 *
 * @since 2026-05-16
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowRuleEvaluator {

    private final SpelConditionEvaluator spelEvaluator;
    private final ObjectMapper objectMapper;

    /**
     * 求值单条 rule.
     *
     * @param rule 规则定义 (含 ruleType + expression JSON)
     * @param context 求值上下文 (key/value pairs, e.g. amount/department/role)
     * @return true if rule 命中, false otherwise (含 fail-closed)
     */
    public boolean evaluate(WorkflowRule rule, Map<String, Object> context) {
        if (rule == null || rule.getRuleType() == null) return false;
        if (context == null) context = Map.of();
        try {
            Map<String, Object> expr = parseExpression(rule.getExpression());
            return switch (rule.getRuleType()) {
                case AMOUNT_THRESHOLD -> evalAmountThreshold(expr, context);
                case DEPT_MATCH       -> evalInList(expr, context, "department");
                case ROLE_MATCH       -> evalInList(expr, context, "role");
                case SPEL_CUSTOM      -> evalSpel(expr, context);
            };
        } catch (Exception e) {
            log.warn("WorkflowRule {} ({}) evaluate failed: {}",
                    rule.getId(), rule.getRuleType(), e.getMessage());
            return false;
        }
    }

    // ==================== 4 类 ruleType ====================

    /**
     * AMOUNT_THRESHOLD: {@code {"field":"amount","op":">","value":10000}}
     * op ∈ {">", ">=", "<", "<=", "==", "!="}
     */
    private boolean evalAmountThreshold(Map<String, Object> expr, Map<String, Object> ctx) {
        String field = (String) expr.getOrDefault("field", "amount");
        String op = (String) expr.get("op");
        Object thresholdObj = expr.get("value");
        Object actualObj = ctx.get(field);
        if (op == null || thresholdObj == null || actualObj == null) return false;

        BigDecimal threshold = toBigDecimal(thresholdObj);
        BigDecimal actual = toBigDecimal(actualObj);
        if (threshold == null || actual == null) return false;

        int cmp = actual.compareTo(threshold);
        return switch (op) {
            case ">"  -> cmp > 0;
            case ">=" -> cmp >= 0;
            case "<"  -> cmp < 0;
            case "<=" -> cmp <= 0;
            case "==" -> cmp == 0;
            case "!=" -> cmp != 0;
            default -> {
                log.debug("AMOUNT_THRESHOLD unknown op: {}", op);
                yield false;
            }
        };
    }

    /**
     * DEPT_MATCH / ROLE_MATCH 共享 — {@code {"field":"department","in":["finance","..."]}}
     *
     * @param defaultField 当 expression 未指定 field 时的默认字段名
     */
    @SuppressWarnings("unchecked")
    private boolean evalInList(Map<String, Object> expr, Map<String, Object> ctx, String defaultField) {
        String field = (String) expr.getOrDefault("field", defaultField);
        Object listObj = expr.get("in");
        if (!(listObj instanceof Collection<?> list) || list.isEmpty()) return false;
        Object actual = ctx.get(field);
        if (actual == null) return false;
        String actualStr = String.valueOf(actual);
        return list.stream().anyMatch(v -> actualStr.equals(String.valueOf(v)));
    }

    /**
     * SPEL_CUSTOM: {@code {"spel":"#amount > 10000 && #department == 'finance'"}}
     * 走 {@link SpelConditionEvaluator#evaluateCondition} — SimpleEvaluationContext sandbox.
     */
    private boolean evalSpel(Map<String, Object> expr, Map<String, Object> ctx) {
        String spel = (String) expr.get("spel");
        if (spel == null || spel.isBlank()) return false;
        return spelEvaluator.evaluateCondition(spel, ctx);
    }

    // ==================== Helpers ====================

    private Map<String, Object> parseExpression(String json) throws IOException {
        if (json == null || json.isBlank()) return Map.of();
        return objectMapper.readValue(json, new TypeReference<>() {});
    }

    private BigDecimal toBigDecimal(Object v) {
        if (v == null) return null;
        if (v instanceof BigDecimal bd) return bd;
        if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        if (v instanceof CharSequence s) {
            try {
                return new BigDecimal(s.toString());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
