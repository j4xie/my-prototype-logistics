package com.cretas.aims.service.workflow;

import com.cretas.aims.engine.SpelConditionEvaluator;
import com.cretas.aims.entity.config.WorkflowRule;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * {@link WorkflowRuleEvaluator} 单元测试 — Sprint 4 Wave 1 (C-WF-RULE-1).
 *
 * <p>覆盖 4 ruleType × 多 op × edge cases (fail-closed / parse fail / sandbox reject).
 * 共 ≥ 20 case per spec §5.1.
 *
 * <p>使用真实 {@link SpelConditionEvaluator} + 真实 {@link ObjectMapper} —
 * 无 Spring context, 纯 POJO 单测.
 */
@DisplayName("WorkflowRuleEvaluator 4 类 ruleType 求值")
class WorkflowRuleEvaluatorTest {

    private WorkflowRuleEvaluator evaluator;
    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new ObjectMapper();
        evaluator = new WorkflowRuleEvaluator(new SpelConditionEvaluator(), mapper);
    }

    private WorkflowRule rule(WorkflowRule.RuleType type, String exprJson) {
        return WorkflowRule.builder()
                .id("rule-1")
                .ruleType(type)
                .expression(exprJson)
                .build();
    }

    // ==================== AMOUNT_THRESHOLD (7 case) ====================

    @Nested
    @DisplayName("AMOUNT_THRESHOLD")
    class AmountThreshold {

        @Test
        @DisplayName("case 1: amount > 10000, ctx=20000 → true")
        void case1_gt_match() {
            var r = rule(WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                    "{\"field\":\"amount\",\"op\":\">\",\"value\":10000}");
            assertTrue(evaluator.evaluate(r, Map.of("amount", 20000)));
        }

        @Test
        @DisplayName("case 2: amount > 10000, ctx=10000 → false (strict)")
        void case2_gt_boundary() {
            var r = rule(WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                    "{\"field\":\"amount\",\"op\":\">\",\"value\":10000}");
            assertFalse(evaluator.evaluate(r, Map.of("amount", 10000)));
        }

        @Test
        @DisplayName("case 3: amount >= 10000, ctx=10000 → true")
        void case3_gte_boundary() {
            var r = rule(WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                    "{\"field\":\"amount\",\"op\":\">=\",\"value\":10000}");
            assertTrue(evaluator.evaluate(r, Map.of("amount", 10000)));
        }

        @Test
        @DisplayName("case 4: amount < 5000, ctx=4999.99 → true (Decimal)")
        void case4_lt_decimal() {
            var r = rule(WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                    "{\"field\":\"amount\",\"op\":\"<\",\"value\":5000}");
            assertTrue(evaluator.evaluate(r, Map.of("amount", new BigDecimal("4999.99"))));
        }

        @Test
        @DisplayName("case 5: amount == 10000 (string vs string '10000.00') → true (Decimal compareTo)")
        void case5_eq_string_decimal() {
            var r = rule(WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                    "{\"field\":\"amount\",\"op\":\"==\",\"value\":\"10000.00\"}");
            assertTrue(evaluator.evaluate(r, Map.of("amount", "10000")));
        }

        @Test
        @DisplayName("case 6: missing op → false (fail-closed)")
        void case6_missing_op() {
            var r = rule(WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                    "{\"field\":\"amount\",\"value\":10000}");
            assertFalse(evaluator.evaluate(r, Map.of("amount", 10000)));
        }

        @Test
        @DisplayName("case 7: ctx missing field → false (fail-closed)")
        void case7_missing_ctx() {
            var r = rule(WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                    "{\"field\":\"amount\",\"op\":\">\",\"value\":10000}");
            assertFalse(evaluator.evaluate(r, Map.of()));
        }
    }

    // ==================== DEPT_MATCH (4 case) ====================

    @Nested
    @DisplayName("DEPT_MATCH")
    class DeptMatch {

        @Test
        @DisplayName("case 8: department in [finance,purchasing], ctx=finance → true")
        void case8_in_list() {
            var r = rule(WorkflowRule.RuleType.DEPT_MATCH,
                    "{\"in\":[\"finance\",\"purchasing\"]}");
            assertTrue(evaluator.evaluate(r, Map.of("department", "finance")));
        }

        @Test
        @DisplayName("case 9: department in [finance], ctx=sales → false")
        void case9_not_in_list() {
            var r = rule(WorkflowRule.RuleType.DEPT_MATCH,
                    "{\"in\":[\"finance\",\"purchasing\"]}");
            assertFalse(evaluator.evaluate(r, Map.of("department", "sales")));
        }

        @Test
        @DisplayName("case 10: custom field 'customDept' → true")
        void case10_custom_field() {
            var r = rule(WorkflowRule.RuleType.DEPT_MATCH,
                    "{\"field\":\"customDept\",\"in\":[\"X\",\"Y\"]}");
            assertTrue(evaluator.evaluate(r, Map.of("customDept", "Y")));
        }

        @Test
        @DisplayName("case 11: empty in list → false (fail-closed)")
        void case11_empty_list() {
            var r = rule(WorkflowRule.RuleType.DEPT_MATCH,
                    "{\"in\":[]}");
            assertFalse(evaluator.evaluate(r, Map.of("department", "finance")));
        }
    }

    // ==================== ROLE_MATCH (2 case) ====================

    @Nested
    @DisplayName("ROLE_MATCH")
    class RoleMatch {

        @Test
        @DisplayName("case 12: role in [FACTORY_SUPER_ADMIN] → true")
        void case12_role_match() {
            var r = rule(WorkflowRule.RuleType.ROLE_MATCH,
                    "{\"in\":[\"FACTORY_SUPER_ADMIN\"]}");
            assertTrue(evaluator.evaluate(r, Map.of("role", "FACTORY_SUPER_ADMIN")));
        }

        @Test
        @DisplayName("case 13: role in [FACTORY_SUPER_ADMIN], ctx=OPERATOR → false")
        void case13_role_no_match() {
            var r = rule(WorkflowRule.RuleType.ROLE_MATCH,
                    "{\"in\":[\"FACTORY_SUPER_ADMIN\"]}");
            assertFalse(evaluator.evaluate(r, Map.of("role", "OPERATOR")));
        }
    }

    // ==================== SPEL_CUSTOM (6 case incl. sandbox tests) ====================

    @Nested
    @DisplayName("SPEL_CUSTOM")
    class SpelCustom {

        @Test
        @DisplayName("case 14: SpEL '#amount > 10000', ctx=20000 → true")
        void case14_simple_spel() {
            var r = rule(WorkflowRule.RuleType.SPEL_CUSTOM,
                    "{\"spel\":\"#amount > 10000\"}");
            assertTrue(evaluator.evaluate(r, Map.of("amount", 20000)));
        }

        @Test
        @DisplayName("case 15: SpEL 复合表达式 amount > 10000 && dept='finance' → true")
        void case15_compound_spel() {
            var r = rule(WorkflowRule.RuleType.SPEL_CUSTOM,
                    "{\"spel\":\"#amount > 10000 && #department == 'finance'\"}");
            assertTrue(evaluator.evaluate(r,
                    Map.of("amount", 20000, "department", "finance")));
        }

        @Test
        @DisplayName("case 16: sandbox reject T(Runtime).getRuntime().exec(...) → false")
        void case16_sandbox_reject_runtime() {
            var r = rule(WorkflowRule.RuleType.SPEL_CUSTOM,
                    "{\"spel\":\"T(Runtime).getRuntime().exec('calc')\"}");
            assertFalse(evaluator.evaluate(r, Map.of()));
        }

        @Test
        @DisplayName("case 17: sandbox reject new java.io.File(...) → false")
        void case17_sandbox_reject_new() {
            var r = rule(WorkflowRule.RuleType.SPEL_CUSTOM,
                    "{\"spel\":\"new java.io.File('/').delete()\"}");
            assertFalse(evaluator.evaluate(r, Map.of()));
        }

        @Test
        @DisplayName("case 18: 超长 SpEL 表达式 (>1000 chars) → false")
        void case18_oversize_spel() {
            String longSpel = "#amount > " + "0".repeat(1100);
            var r = rule(WorkflowRule.RuleType.SPEL_CUSTOM,
                    "{\"spel\":\"" + longSpel + "\"}");
            assertFalse(evaluator.evaluate(r, Map.of("amount", 100)));
        }

        @Test
        @DisplayName("case 19: malformed SpEL '#amount >>' → false (parse fail)")
        void case19_malformed_spel() {
            var r = rule(WorkflowRule.RuleType.SPEL_CUSTOM,
                    "{\"spel\":\"#amount >>\"}");
            assertFalse(evaluator.evaluate(r, Map.of("amount", 100)));
        }
    }

    // ==================== 通用 edge cases (3 case) ====================

    @Nested
    @DisplayName("通用 edge cases")
    class EdgeCases {

        @Test
        @DisplayName("case 20: 坏的 expression JSON → false (parse fail)")
        void case20_malformed_json() {
            var r = rule(WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                    "{this is not valid json");
            assertFalse(evaluator.evaluate(r, Map.of("amount", 100)));
        }

        @Test
        @DisplayName("case 21: null rule → false")
        void case21_null_rule() {
            assertFalse(evaluator.evaluate(null, Map.of()));
        }

        @Test
        @DisplayName("case 22: null context → 不抛, fail-closed")
        void case22_null_context() {
            var r = rule(WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                    "{\"field\":\"amount\",\"op\":\">\",\"value\":100}");
            assertFalse(evaluator.evaluate(r, null));
        }

        @Test
        @DisplayName("case 23: unknown op '><' → false")
        void case23_unknown_op() {
            var r = rule(WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                    "{\"field\":\"amount\",\"op\":\"><\",\"value\":100}");
            assertFalse(evaluator.evaluate(r, Map.of("amount", 200)));
        }
    }
}
