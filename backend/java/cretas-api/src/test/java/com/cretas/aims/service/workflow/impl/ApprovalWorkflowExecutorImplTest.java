package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.dto.approval.ApprovalDecision;
import com.cretas.aims.dto.approval.ExecutionContext;
import com.cretas.aims.dto.approval.PendingApproval;
import com.cretas.aims.engine.SpelConditionEvaluator;
import com.cretas.aims.entity.config.ApprovalChainConfig.DecisionType;
import com.cretas.aims.entity.config.ApprovalWorkflow;
import com.cretas.aims.entity.config.ApprovalWorkflowEdge;
import com.cretas.aims.entity.config.ApprovalWorkflowNode;
import com.cretas.aims.exception.BusinessException;
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
 * ApprovalWorkflowExecutorImpl 单元测试 — Sprint 3 Track-I Day 4.
 *
 * <p>覆盖 4 种执行模式 + edge cases (≥ 10 cases per Day 4 gate):
 * 1. Sequential 1-step APPROVED → end APPROVED
 * 2. Sequential 1-step REJECTED → end REJECTED
 * 3. Sequential 3-step all APPROVED → end APPROVED
 * 4. Conditional amount &gt; 10000 走 high 分支
 * 5. Conditional amount &lt;= 10000 走 low 分支 (DEFAULT)
 * 6. Parallel + Join ALL: 2 branches both APPROVED → end
 * 7. Parallel + Join N_OF_M (2 of 3): 2 APPROVED → end (3rd in flight)
 * 8. Parallel + Join ANY: first APPROVED → end immediately
 * 9. Auto-approve SpEL condition met → 跳过 approver advance
 * 10. Cancel mid-flow → status=CANCELLED
 * 11. 会签 requiredApprovers=2 → 1 approve 仍 RUNNING, 2 approve advance
 *
 * @since 2026-05-16
 */
@DisplayName("ApprovalWorkflowExecutorImpl 单元测试 (Day 4)")
@ExtendWith(MockitoExtension.class)
class ApprovalWorkflowExecutorImplTest {

    @Mock
    private ApprovalWorkflowRepository workflowRepository;

    @Mock
    private WorkflowRuleRepository workflowRuleRepository;

    @Mock
    private UserRepository userRepository;

    private ApprovalWorkflowServiceImpl workflowService;
    private ApprovalWorkflowExecutorImpl executor;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String FACTORY_ID = "F001";
    private static final String WORKFLOW_ID = "wf-test-001";
    private static final Long INITIATOR_ID = 100L;
    private static final Long APPROVER_ID = 200L;

    @BeforeEach
    void setUp() {
        // 用真实 service 处理 serde + getById, repository mock 控制 workflow lookup
        workflowService = new ApprovalWorkflowServiceImpl(workflowRepository, objectMapper);
        // Sprint 4 W2 Chat J (C-WF-VAR-1) SEC-2 fix: executor now uses SandboxedSpelEvaluator.
        // Sprint 4 W1 Chat D (C-WF-RULE-1): WorkflowRuleEvaluator still on SpelConditionEvaluator
        // for SPEL_CUSTOM evaluation (separate SpEL sandbox layer, both real, no side effects).
        SandboxedSpelEvaluator sandboxedSpelEvaluator = new SandboxedSpelEvaluator();
        SpelConditionEvaluator spelConditionEvaluator = new SpelConditionEvaluator();
        WorkflowRuleEvaluator ruleEvaluator = new WorkflowRuleEvaluator(spelConditionEvaluator, objectMapper);
        // Default: no rules — Sprint 3 I edge-based path preserved.
        lenient().when(workflowRuleRepository
                .findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(anyString(), anyString()))
                .thenReturn(List.of());
        executor = new ApprovalWorkflowExecutorImpl(
                workflowService, sandboxedSpelEvaluator, workflowRuleRepository, ruleEvaluator, userRepository);
    }

    // ==================== fixtures ====================

    private ApprovalWorkflowNode node(String id, String type, Map<String, Object> config) {
        return ApprovalWorkflowNode.builder()
                .id(id).type(type).label(id)
                .config(config == null ? Map.of() : config)
                .build();
    }

    private ApprovalWorkflowEdge edge(String id, String source, String target, String condition, Integer priority) {
        return ApprovalWorkflowEdge.builder()
                .id(id).source(source).target(target)
                .condition(condition).priority(priority == null ? 0 : priority)
                .build();
    }

    private ApprovalWorkflow buildWorkflow(List<ApprovalWorkflowNode> nodes,
                                            List<ApprovalWorkflowEdge> edges,
                                            String startNodeId) {
        ApprovalWorkflow w = ApprovalWorkflow.builder()
                .decisionType(DecisionType.QUALITY_RELEASE)
                .name("test-" + UUID.randomUUID())
                .startNodeId(startNodeId)
                .build();
        w.setId(WORKFLOW_ID);
        w.setFactoryId(FACTORY_ID);
        w.setNodesJson(workflowService.serializeNodes(nodes));
        w.setEdgesJson(workflowService.serializeEdges(edges));
        // executor.lookupWorkflowOrFail uses workflowService.getById which hits repository.
        // lenient() because some tests terminate before submit/cancel (which trigger lookup).
        lenient().when(workflowRepository.findById(WORKFLOW_ID)).thenReturn(Optional.of(w));
        return w;
    }

    private Map<String, Object> approvalConfig(int requiredApprovers, List<String> roles) {
        Map<String, Object> m = new HashMap<>();
        m.put("requiredApprovers", requiredApprovers);
        m.put("approverRoles", roles);
        return m;
    }

    // ==================== Cases 1-3: Sequential ====================

    @Test
    @DisplayName("Case 1: Sequential 1-step APPROVED → status=APPROVED")
    void sequential_approve_endsApproved() {
        ApprovalWorkflow w = buildWorkflow(
                List.of(
                        node("start", "start", null),
                        node("approve1", "approval", approvalConfig(1, List.of("factory_admin"))),
                        node("end_ok", "end", Map.of("outcome", "APPROVED"))),
                List.of(
                        edge("e1", "start", "approve1", null, 0),
                        edge("e2", "approve1", "end_ok", null, 0)),
                "start");

        ExecutionContext ctx = executor.start(w, "biz-001", Map.of(), INITIATOR_ID);
        assertEquals(ExecutionContext.Status.RUNNING, ctx.getStatus());
        assertEquals(Set.of("approve1"), ctx.getActiveNodeIds());

        executor.submit(ctx, "approve1", ApprovalDecision.APPROVED, APPROVER_ID, "factory_admin", "ok");

        assertEquals(ExecutionContext.Status.APPROVED, ctx.getStatus());
        assertEquals("APPROVED", ctx.getFinalOutcome());
        assertTrue(ctx.getActiveNodeIds().isEmpty());
    }

    @Test
    @DisplayName("Case 2: Sequential 1-step REJECTED → status=REJECTED")
    void sequential_reject_endsRejected() {
        ApprovalWorkflow w = buildWorkflow(
                List.of(
                        node("start", "start", null),
                        node("approve1", "approval", approvalConfig(1, List.of("factory_admin"))),
                        node("end_ok", "end", Map.of("outcome", "APPROVED"))),
                List.of(
                        edge("e1", "start", "approve1", null, 0),
                        edge("e2", "approve1", "end_ok", null, 0)),
                "start");

        ExecutionContext ctx = executor.start(w, "biz-002", Map.of(), INITIATOR_ID);
        executor.submit(ctx, "approve1", ApprovalDecision.REJECTED, APPROVER_ID, "factory_admin", "nope");

        assertEquals(ExecutionContext.Status.REJECTED, ctx.getStatus());
        assertEquals("REJECTED", ctx.getFinalOutcome());
    }

    @Test
    @DisplayName("Case 3: Sequential 3-step all APPROVED → end APPROVED")
    void sequential_threeStep_allApproved() {
        ApprovalWorkflow w = buildWorkflow(
                List.of(
                        node("start", "start", null),
                        node("a", "approval", approvalConfig(1, List.of("r1"))),
                        node("b", "approval", approvalConfig(1, List.of("r2"))),
                        node("c", "approval", approvalConfig(1, List.of("r3"))),
                        node("end_ok", "end", Map.of("outcome", "APPROVED"))),
                List.of(
                        edge("e1", "start", "a", null, 0),
                        edge("e2", "a", "b", null, 0),
                        edge("e3", "b", "c", null, 0),
                        edge("e4", "c", "end_ok", null, 0)),
                "start");

        ExecutionContext ctx = executor.start(w, "biz-003", Map.of(), INITIATOR_ID);
        assertEquals(Set.of("a"), ctx.getActiveNodeIds());

        executor.submit(ctx, "a", ApprovalDecision.APPROVED, 1L, "r1", "");
        assertEquals(Set.of("b"), ctx.getActiveNodeIds());

        executor.submit(ctx, "b", ApprovalDecision.APPROVED, 2L, "r2", "");
        assertEquals(Set.of("c"), ctx.getActiveNodeIds());

        executor.submit(ctx, "c", ApprovalDecision.APPROVED, 3L, "r3", "");
        assertEquals(ExecutionContext.Status.APPROVED, ctx.getStatus());
    }

    // ==================== Cases 4-5: Conditional ====================

    @Test
    @DisplayName("Case 4: Conditional amount > 10000 走 high 分支")
    void conditional_amountHigh_takesHighBranch() {
        ApprovalWorkflow w = buildWorkflow(
                List.of(
                        node("start", "start", null),
                        node("check", "condition", null),
                        node("approve_high", "approval", approvalConfig(1, List.of("manager"))),
                        node("approve_low", "approval", approvalConfig(1, List.of("staff"))),
                        node("end_ok", "end", Map.of("outcome", "APPROVED"))),
                List.of(
                        edge("e1", "start", "check", null, 0),
                        edge("e_hi", "check", "approve_high", "#amount > 10000", 0),
                        edge("e_lo", "check", "approve_low", null, 1), // DEFAULT (no condition)
                        edge("e_hi_end", "approve_high", "end_ok", null, 0),
                        edge("e_lo_end", "approve_low", "end_ok", null, 0)),
                "start");

        Map<String, Object> biz = new HashMap<>();
        biz.put("amount", 15000);
        ExecutionContext ctx = executor.start(w, "biz-hi", biz, INITIATOR_ID);

        assertEquals(Set.of("approve_high"), ctx.getActiveNodeIds());
        executor.submit(ctx, "approve_high", ApprovalDecision.APPROVED, APPROVER_ID, "manager", "");
        assertEquals(ExecutionContext.Status.APPROVED, ctx.getStatus());
    }

    @Test
    @DisplayName("Case 5: Conditional amount <= 10000 走 low 分支 (DEFAULT fallback)")
    void conditional_amountLow_takesLowBranch() {
        ApprovalWorkflow w = buildWorkflow(
                List.of(
                        node("start", "start", null),
                        node("check", "condition", null),
                        node("approve_high", "approval", approvalConfig(1, List.of("manager"))),
                        node("approve_low", "approval", approvalConfig(1, List.of("staff"))),
                        node("end_ok", "end", Map.of("outcome", "APPROVED"))),
                List.of(
                        edge("e1", "start", "check", null, 0),
                        edge("e_hi", "check", "approve_high", "#amount > 10000", 0),
                        edge("e_lo", "check", "approve_low", null, 1),
                        edge("e_hi_end", "approve_high", "end_ok", null, 0),
                        edge("e_lo_end", "approve_low", "end_ok", null, 0)),
                "start");

        Map<String, Object> biz = new HashMap<>();
        biz.put("amount", 5000);
        ExecutionContext ctx = executor.start(w, "biz-lo", biz, INITIATOR_ID);

        assertEquals(Set.of("approve_low"), ctx.getActiveNodeIds());
    }

    // ==================== Cases 6-8: Parallel + Join ====================

    @Test
    @DisplayName("Case 6: Parallel + Join ALL: 2 branches both APPROVED → end")
    void parallel_joinAll_bothApproved() {
        ApprovalWorkflow w = buildWorkflow(
                List.of(
                        node("start", "start", null),
                        node("par", "parallel", null),
                        node("br_a", "approval", approvalConfig(1, List.of("r_a"))),
                        node("br_b", "approval", approvalConfig(1, List.of("r_b"))),
                        node("join", "join", Map.of("mode", "ALL")),
                        node("end_ok", "end", Map.of("outcome", "APPROVED"))),
                List.of(
                        edge("e1", "start", "par", null, 0),
                        edge("e_a", "par", "br_a", null, 0),
                        edge("e_b", "par", "br_b", null, 0),
                        edge("ea_j", "br_a", "join", null, 0),
                        edge("eb_j", "br_b", "join", null, 0),
                        edge("ej_end", "join", "end_ok", null, 0)),
                "start");

        ExecutionContext ctx = executor.start(w, "biz-par", Map.of(), INITIATOR_ID);
        assertEquals(Set.of("br_a", "br_b"), ctx.getActiveNodeIds());

        executor.submit(ctx, "br_a", ApprovalDecision.APPROVED, 1L, "r_a", "");
        // br_a arrives at join, but waits for br_b — workflow still RUNNING
        assertEquals(ExecutionContext.Status.RUNNING, ctx.getStatus());
        assertEquals(Set.of("br_b"), ctx.getActiveNodeIds());

        executor.submit(ctx, "br_b", ApprovalDecision.APPROVED, 2L, "r_b", "");
        // 现在 ALL incoming arrived → join 推进到 end
        assertEquals(ExecutionContext.Status.APPROVED, ctx.getStatus());
    }

    @Test
    @DisplayName("Case 7: Parallel + Join N_OF_M (2 of 3) → 2 APPROVED → end")
    void parallel_joinNofM_twoOfThree() {
        ApprovalWorkflow w = buildWorkflow(
                List.of(
                        node("start", "start", null),
                        node("par", "parallel", null),
                        node("br_a", "approval", approvalConfig(1, List.of("r_a"))),
                        node("br_b", "approval", approvalConfig(1, List.of("r_b"))),
                        node("br_c", "approval", approvalConfig(1, List.of("r_c"))),
                        node("join", "join", Map.of("mode", "N_OF_M", "n", 2)),
                        node("end_ok", "end", Map.of("outcome", "APPROVED"))),
                List.of(
                        edge("e1", "start", "par", null, 0),
                        edge("ea", "par", "br_a", null, 0),
                        edge("eb", "par", "br_b", null, 0),
                        edge("ec", "par", "br_c", null, 0),
                        edge("eaj", "br_a", "join", null, 0),
                        edge("ebj", "br_b", "join", null, 0),
                        edge("ecj", "br_c", "join", null, 0),
                        edge("eend", "join", "end_ok", null, 0)),
                "start");

        ExecutionContext ctx = executor.start(w, "biz-nofm", Map.of(), INITIATOR_ID);
        executor.submit(ctx, "br_a", ApprovalDecision.APPROVED, 1L, "r_a", "");
        assertEquals(ExecutionContext.Status.RUNNING, ctx.getStatus());

        executor.submit(ctx, "br_b", ApprovalDecision.APPROVED, 2L, "r_b", "");
        // 2 of 3 arrived → join 推进
        assertEquals(ExecutionContext.Status.APPROVED, ctx.getStatus());
    }

    @Test
    @DisplayName("Case 8: Parallel + Join ANY → first APPROVED → end immediately")
    void parallel_joinAny_firstWins() {
        ApprovalWorkflow w = buildWorkflow(
                List.of(
                        node("start", "start", null),
                        node("par", "parallel", null),
                        node("br_a", "approval", approvalConfig(1, List.of("r_a"))),
                        node("br_b", "approval", approvalConfig(1, List.of("r_b"))),
                        node("join", "join", Map.of("mode", "ANY")),
                        node("end_ok", "end", Map.of("outcome", "APPROVED"))),
                List.of(
                        edge("e1", "start", "par", null, 0),
                        edge("ea", "par", "br_a", null, 0),
                        edge("eb", "par", "br_b", null, 0),
                        edge("eaj", "br_a", "join", null, 0),
                        edge("ebj", "br_b", "join", null, 0),
                        edge("eend", "join", "end_ok", null, 0)),
                "start");

        ExecutionContext ctx = executor.start(w, "biz-any", Map.of(), INITIATOR_ID);
        executor.submit(ctx, "br_a", ApprovalDecision.APPROVED, 1L, "r_a", "");
        assertEquals(ExecutionContext.Status.APPROVED, ctx.getStatus());
    }

    // ==================== Cases 9-11: 特殊场景 ====================

    @Test
    @DisplayName("Case 9: Auto-approve SpEL condition met → 跳过 approver")
    void autoApprove_conditionMet_skipsApprover() {
        Map<String, Object> autoConfig = new HashMap<>(approvalConfig(1, List.of("manager")));
        autoConfig.put("autoApproveCondition", "#trusted == true");

        ApprovalWorkflow w = buildWorkflow(
                List.of(
                        node("start", "start", null),
                        node("approve1", "approval", autoConfig),
                        node("end_ok", "end", Map.of("outcome", "APPROVED"))),
                List.of(
                        edge("e1", "start", "approve1", null, 0),
                        edge("e2", "approve1", "end_ok", null, 0)),
                "start");

        Map<String, Object> biz = new HashMap<>();
        biz.put("trusted", true);
        ExecutionContext ctx = executor.start(w, "biz-auto", biz, INITIATOR_ID);

        // Auto-approve 触发, 不暂停, 直接 end
        assertEquals(ExecutionContext.Status.APPROVED, ctx.getStatus());
    }

    @Test
    @DisplayName("Case 10: Cancel mid-flow → status=CANCELLED")
    void cancel_midFlow_setsCancelled() {
        ApprovalWorkflow w = buildWorkflow(
                List.of(
                        node("start", "start", null),
                        node("approve1", "approval", approvalConfig(1, List.of("r1"))),
                        node("end_ok", "end", Map.of("outcome", "APPROVED"))),
                List.of(
                        edge("e1", "start", "approve1", null, 0),
                        edge("e2", "approve1", "end_ok", null, 0)),
                "start");

        ExecutionContext ctx = executor.start(w, "biz-cancel", Map.of(), INITIATOR_ID);
        assertEquals(ExecutionContext.Status.RUNNING, ctx.getStatus());

        executor.cancel(ctx, 999L, "客户撤回申请");
        assertEquals(ExecutionContext.Status.CANCELLED, ctx.getStatus());
        assertEquals("CANCELLED", ctx.getFinalOutcome());
        assertEquals("客户撤回申请", ctx.getCancelReason());

        // 取消后再 submit 应失败
        assertThrows(BusinessException.class,
                () -> executor.submit(ctx, "approve1", ApprovalDecision.APPROVED, 1L, "r1", ""));
    }

    @Test
    @DisplayName("Case 11: 会签 requiredApprovers=2 → 1 approve 仍 RUNNING, 2 approve advance")
    void coSign_twoOfTwo_advancesOnSecond() {
        ApprovalWorkflow w = buildWorkflow(
                List.of(
                        node("start", "start", null),
                        node("cosign", "approval", approvalConfig(2, List.of("r1", "r2"))),
                        node("end_ok", "end", Map.of("outcome", "APPROVED"))),
                List.of(
                        edge("e1", "start", "cosign", null, 0),
                        edge("e2", "cosign", "end_ok", null, 0)),
                "start");

        ExecutionContext ctx = executor.start(w, "biz-cosign", Map.of(), INITIATOR_ID);
        assertEquals(Set.of("cosign"), ctx.getActiveNodeIds());

        executor.submit(ctx, "cosign", ApprovalDecision.APPROVED, 1L, "r1", "");
        // 1 of 2 — 仍 RUNNING, 节点保持活跃
        assertEquals(ExecutionContext.Status.RUNNING, ctx.getStatus());
        assertEquals(Set.of("cosign"), ctx.getActiveNodeIds());

        List<PendingApproval> pending = executor.getPending(ctx);
        assertEquals(1, pending.size());
        assertEquals(2, pending.get(0).getRequiredApprovers());
        assertEquals(1, pending.get(0).getCurrentApprovers());

        executor.submit(ctx, "cosign", ApprovalDecision.APPROVED, 2L, "r2", "");
        // 2 of 2 — advance to end
        assertEquals(ExecutionContext.Status.APPROVED, ctx.getStatus());
    }
}
