package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.dto.approval.ExecutionContext;
import com.cretas.aims.engine.SpelConditionEvaluator;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.config.ApprovalChainConfig.DecisionType;
import com.cretas.aims.entity.config.ApprovalWorkflow;
import com.cretas.aims.entity.config.ApprovalWorkflowEdge;
import com.cretas.aims.entity.config.ApprovalWorkflowNode;
import com.cretas.aims.entity.config.WorkflowRule;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.repository.config.ApprovalWorkflowRepository;
import com.cretas.aims.repository.config.WorkflowRuleRepository;
import com.cretas.aims.service.impl.ApprovalWorkflowServiceImpl;
import com.cretas.aims.service.workflow.SandboxedSpelEvaluator;
import com.cretas.aims.service.workflow.WorkflowRuleEvaluator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Rule-first dispatch integration tests — Sprint 4 Wave 1 (C-WF-RULE-1).
 *
 * <p>验证 {@link ApprovalWorkflowExecutorImpl#advanceFromCondition} 先评估 WorkflowRule
 * 再 fall through 到 edge.condition (Sprint 3 I 逻辑).
 *
 * <p>覆盖 spec §5.2 8 cases:
 * I-1: 1 rule matched=true, 走 trueTarget
 * I-2: 1 rule matched=false + falseTarget, 走 falseTarget
 * I-3: 1 rule unmatched + no falseTarget, fall through 到 edge
 * I-4: 2 rule priority 0+1, rule#0 matched 优先
 * I-5: 2 rule priority 0+1, rule#0 unmatched, rule#1 matched 走 rule#1
 * I-6: rule disabled — repository 已 filter (mock 直接返不含)
 * I-7: rule + edge 全 unmatched, edge label=DEFAULT 存在 → 走 DEFAULT
 * I-8: rule + edge 全 unmatched, no DEFAULT → terminate REJECTED
 */
@DisplayName("Rule-first dispatch integration — C-WF-RULE-1")
@ExtendWith(MockitoExtension.class)
class ApprovalWorkflowExecutorRuleIntegrationTest {

    @Mock private ApprovalWorkflowRepository workflowRepository;
    @Mock private WorkflowRuleRepository workflowRuleRepository;
    @Mock private UserRepository userRepository;

    private ApprovalWorkflowExecutorImpl executor;
    private ApprovalWorkflowServiceImpl workflowService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String FACTORY_ID = "F001";
    private static final String WORKFLOW_ID = "wf-rule-test";
    private static final Long INITIATOR_ID = 100L;

    @BeforeEach
    void setUp() {
        workflowService = new ApprovalWorkflowServiceImpl(workflowRepository, objectMapper);
        // Sprint 4 W2 Chat J (C-WF-VAR-1) SEC-2 fix: executor uses SandboxedSpelEvaluator now.
        // WorkflowRuleEvaluator still on SpelConditionEvaluator for SPEL_CUSTOM rule body.
        SandboxedSpelEvaluator sandboxedSpelEvaluator = new SandboxedSpelEvaluator();
        SpelConditionEvaluator spelConditionEvaluator = new SpelConditionEvaluator();
        WorkflowRuleEvaluator ruleEvaluator = new WorkflowRuleEvaluator(spelConditionEvaluator, objectMapper);
        executor = new ApprovalWorkflowExecutorImpl(
                workflowService, sandboxedSpelEvaluator, workflowRuleRepository, ruleEvaluator, userRepository);

        // Initiator user 默认 mock: role=OPERATOR, department=finance
        User u = new User();
        u.setId(INITIATOR_ID);
        u.setRoleCode("OPERATOR");
        u.setDepartment("finance");
        u.setUsername("initiator-test");
        lenient().when(userRepository.findById(INITIATOR_ID)).thenReturn(Optional.of(u));
    }

    // ==================== fixtures ====================

    /**
     * Condition-node workflow: start → cond → (high / low / default) → end.
     * High/low/default 三个 end 节点对应 不同 outcome 区分.
     */
    private ApprovalWorkflow buildConditionWorkflow(String defaultLabel, boolean hasDefaultEdge) {
        List<ApprovalWorkflowNode> nodes = List.of(
                node("start", "start"),
                node("cond", "condition"),
                node("end_high", "end", Map.of("outcome", "APPROVED")),
                node("end_low", "end", Map.of("outcome", "REJECTED")),
                node("end_default", "end", Map.of("outcome", "TIMEOUT"))
        );
        List<ApprovalWorkflowEdge> edges = new ArrayList<>();
        edges.add(edge("e0", "start", "cond", null, 0, null));
        edges.add(edge("e1", "cond", "end_high", "#amount > 50000", 0, null));
        edges.add(edge("e2", "cond", "end_low", "#amount > 10000", 1, null));
        if (hasDefaultEdge) {
            edges.add(edge("e3", "cond", "end_default", null, 99, defaultLabel));
        }

        ApprovalWorkflow w = ApprovalWorkflow.builder()
                .decisionType(DecisionType.QUALITY_RELEASE)
                .name("test-" + UUID.randomUUID())
                .startNodeId("start")
                .build();
        w.setId(WORKFLOW_ID);
        w.setFactoryId(FACTORY_ID);
        w.setNodesJson(workflowService.serializeNodes(nodes));
        w.setEdgesJson(workflowService.serializeEdges(edges));
        lenient().when(workflowRepository.findById(WORKFLOW_ID)).thenReturn(Optional.of(w));
        return w;
    }

    private ApprovalWorkflowNode node(String id, String type) { return node(id, type, Map.of()); }
    private ApprovalWorkflowNode node(String id, String type, Map<String, Object> config) {
        return ApprovalWorkflowNode.builder().id(id).type(type).label(id).config(config).build();
    }
    private ApprovalWorkflowEdge edge(String id, String src, String tgt, String cond, int prio, String label) {
        return ApprovalWorkflowEdge.builder()
                .id(id).source(src).target(tgt).condition(cond).priority(prio).label(label).build();
    }

    private WorkflowRule rule(String id, WorkflowRule.RuleType type, String expr,
                               String trueT, String falseT, int prio) {
        return WorkflowRule.builder()
                .id(id).factoryId(FACTORY_ID).workflowId(WORKFLOW_ID).nodeId("cond")
                .ruleType(type).expression(expr)
                .trueTargetNodeId(trueT).falseTargetNodeId(falseT)
                .priority(prio).enabled(true)
                .build();
    }

    private ExecutionContext start(ApprovalWorkflow w, Map<String, Object> businessCtx) {
        return executor.start(w, "biz-rule-" + UUID.randomUUID(), businessCtx, INITIATOR_ID);
    }

    // ==================== I-1: rule matched=true → trueTarget ====================

    @Test
    @DisplayName("I-1: 1 rule matched=true → 走 trueTargetNodeId (end_high)")
    void i1_rule_match_true() {
        ApprovalWorkflow w = buildConditionWorkflow(null, false);
        when(workflowRuleRepository
                .findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(WORKFLOW_ID, "cond"))
                .thenReturn(List.of(rule("r1", WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                        "{\"field\":\"amount\",\"op\":\">\",\"value\":50000}",
                        "end_high", null, 0)));

        ExecutionContext ctx = start(w, Map.of("amount", 60000));
        assertEquals(ExecutionContext.Status.APPROVED, ctx.getStatus());
        assertEquals("APPROVED", ctx.getFinalOutcome());
    }

    // ==================== I-2: matched=false + falseTarget → falseTarget ====================

    @Test
    @DisplayName("I-2: matched=false + falseTarget → 走 falseTargetNodeId (end_low)")
    void i2_rule_false_target() {
        ApprovalWorkflow w = buildConditionWorkflow(null, false);
        when(workflowRuleRepository
                .findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(WORKFLOW_ID, "cond"))
                .thenReturn(List.of(rule("r1", WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                        "{\"field\":\"amount\",\"op\":\">\",\"value\":50000}",
                        "end_high", "end_low", 0)));

        ExecutionContext ctx = start(w, Map.of("amount", 1000));
        assertEquals(ExecutionContext.Status.REJECTED, ctx.getStatus());
        assertEquals("REJECTED", ctx.getFinalOutcome());
    }

    // ==================== I-3: rule unmatched + no falseTarget → fall through to edges ====================

    @Test
    @DisplayName("I-3: rule unmatched 无 falseTarget → fall through edge.condition match (end_low)")
    void i3_fall_through_edge() {
        ApprovalWorkflow w = buildConditionWorkflow(null, false);
        // rule 不匹配且无 falseTarget — 走 edge: amount=20000 命中 #amount>10000 (e2)
        when(workflowRuleRepository
                .findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(WORKFLOW_ID, "cond"))
                .thenReturn(List.of(rule("r1", WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                        "{\"field\":\"amount\",\"op\":\">\",\"value\":50000}",
                        "end_high", null, 0)));

        ExecutionContext ctx = start(w, Map.of("amount", 20000));
        // 走 edge e2 → end_low (REJECTED outcome)
        assertEquals(ExecutionContext.Status.REJECTED, ctx.getStatus());
    }

    // ==================== I-4: 2 rule priority — rule#0 matched 优先 ====================

    @Test
    @DisplayName("I-4: 2 rule priority 0+1, rule#0 matched → 走 rule#0 target (skip rule#1)")
    void i4_priority_first_match() {
        ApprovalWorkflow w = buildConditionWorkflow(null, false);
        when(workflowRuleRepository
                .findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(WORKFLOW_ID, "cond"))
                .thenReturn(List.of(
                        rule("r0", WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                                "{\"field\":\"amount\",\"op\":\">\",\"value\":1000}",
                                "end_high", null, 0),
                        rule("r1", WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                                "{\"field\":\"amount\",\"op\":\"<\",\"value\":99999}",
                                "end_low", null, 1)));

        ExecutionContext ctx = start(w, Map.of("amount", 5000));
        // 两个都会匹配, 但 priority 0 优先 → end_high
        assertEquals("APPROVED", ctx.getFinalOutcome());
    }

    // ==================== I-5: rule#0 unmatched no false, rule#1 matched ====================

    @Test
    @DisplayName("I-5: rule#0 unmatched 无 falseTarget, rule#1 matched → 走 rule#1 target")
    void i5_priority_second_match() {
        ApprovalWorkflow w = buildConditionWorkflow(null, false);
        when(workflowRuleRepository
                .findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(WORKFLOW_ID, "cond"))
                .thenReturn(List.of(
                        rule("r0", WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                                "{\"field\":\"amount\",\"op\":\">\",\"value\":99999}",
                                "end_high", null, 0),
                        rule("r1", WorkflowRule.RuleType.DEPT_MATCH,
                                "{\"in\":[\"finance\"]}",
                                "end_low", null, 1)));

        ExecutionContext ctx = start(w, Map.of("amount", 1000));
        // rule#0 不匹配, 无 falseTarget → 继续; rule#1 dept=finance (来自 initiator) 匹配 → end_low
        assertEquals("REJECTED", ctx.getFinalOutcome());
    }

    // ==================== I-6: rule disabled (mock 不返回) ====================

    @Test
    @DisplayName("I-6: 仅 enabled rule 被 repository 返回 — disabled rule 自动跳过")
    void i6_repository_filters_disabled() {
        ApprovalWorkflow w = buildConditionWorkflow(null, false);
        // 模拟 repository 已 filter disabled — 仅返回 enabled rule
        when(workflowRuleRepository
                .findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(WORKFLOW_ID, "cond"))
                .thenReturn(List.of(
                        rule("r-enabled", WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                                "{\"field\":\"amount\",\"op\":\">\",\"value\":100}",
                                "end_high", null, 0)));

        ExecutionContext ctx = start(w, Map.of("amount", 200));
        // 只有 enabled rule 被求值, 命中 → end_high
        assertEquals("APPROVED", ctx.getFinalOutcome());
    }

    // ==================== I-7: rule + edge 全不匹配, DEFAULT edge 存在 ====================

    @Test
    @DisplayName("I-7: rule 不匹配 + edge.condition 也不匹配, label=DEFAULT edge 存在 → 走 DEFAULT")
    void i7_default_edge_fallback() {
        ApprovalWorkflow w = buildConditionWorkflow("DEFAULT", true);
        when(workflowRuleRepository
                .findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(WORKFLOW_ID, "cond"))
                .thenReturn(List.of(rule("r1", WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                        "{\"field\":\"amount\",\"op\":\">\",\"value\":99999}",
                        "end_high", null, 0)));

        ExecutionContext ctx = start(w, Map.of("amount", 100));
        // rule 不匹配 + edge e1/e2 condition 也不匹配 → DEFAULT edge → end_default (TIMEOUT outcome)
        assertEquals(ExecutionContext.Status.TIMEOUT, ctx.getStatus());
    }

    // ==================== I-8: 全不匹配, 无 DEFAULT → terminate REJECTED ====================

    @Test
    @DisplayName("I-8: rule + edge 全不匹配, 无 DEFAULT → terminate REJECTED (CONDITION_NO_MATCH)")
    void i8_no_match_no_default() {
        ApprovalWorkflow w = buildConditionWorkflow(null, false);
        when(workflowRuleRepository
                .findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(WORKFLOW_ID, "cond"))
                .thenReturn(List.of(rule("r1", WorkflowRule.RuleType.AMOUNT_THRESHOLD,
                        "{\"field\":\"amount\",\"op\":\">\",\"value\":99999}",
                        "end_high", null, 0)));

        ExecutionContext ctx = start(w, Map.of("amount", 100));
        // rule 不匹配, edge e1 (>50000) e2 (>10000) 也不匹配, 无 DEFAULT → REJECTED CONDITION_NO_MATCH
        assertEquals(ExecutionContext.Status.REJECTED, ctx.getStatus());
        assertEquals("CONDITION_NO_MATCH", ctx.getFinalOutcome());
    }

    // ==================== SEC-2 fix verification ====================

    @Test
    @DisplayName("SEC-2: edge.condition with T(Runtime).getRuntime().exec(...) sandboxed → false → fall through")
    void sec2_edge_condition_sandboxed() {
        // 用一个会用 edge.condition 的 workflow: rule 不存在 (空), edge 含 sandbox-reject SpEL
        ApprovalWorkflow w = buildSecTestWorkflow();
        when(workflowRuleRepository
                .findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(eq(WORKFLOW_ID), anyString()))
                .thenReturn(List.of());

        ExecutionContext ctx = start(w, Map.of());
        // 恶意 SpEL 被 sandboxed false → fall through DEFAULT → end_default
        assertEquals(ExecutionContext.Status.TIMEOUT, ctx.getStatus());
    }

    private ApprovalWorkflow buildSecTestWorkflow() {
        List<ApprovalWorkflowNode> nodes = List.of(
                node("start", "start"),
                node("cond", "condition"),
                node("end_high", "end", Map.of("outcome", "APPROVED")),
                node("end_default", "end", Map.of("outcome", "TIMEOUT")));
        List<ApprovalWorkflowEdge> edges = List.of(
                edge("e0", "start", "cond", null, 0, null),
                edge("e1", "cond", "end_high", "T(Runtime).getRuntime().exec('calc') != null", 0, null),
                edge("e2", "cond", "end_default", null, 99, "DEFAULT"));
        ApprovalWorkflow w = ApprovalWorkflow.builder()
                .decisionType(DecisionType.QUALITY_RELEASE).name("sec-test")
                .startNodeId("start").build();
        w.setId(WORKFLOW_ID);
        w.setFactoryId(FACTORY_ID);
        w.setNodesJson(workflowService.serializeNodes(nodes));
        w.setEdgesJson(workflowService.serializeEdges(edges));
        lenient().when(workflowRepository.findById(WORKFLOW_ID)).thenReturn(Optional.of(w));
        return w;
    }
}
