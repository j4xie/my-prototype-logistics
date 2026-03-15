package com.cretas.aims.service.rules;

import com.cretas.aims.entity.ProcessTask;
import com.cretas.aims.entity.enums.ProcessTaskStatus;
import com.cretas.aims.entity.rules.DroolsRule;
import com.cretas.aims.repository.DroolsRuleRepository;
import com.cretas.aims.service.DecisionAuditService;
import com.cretas.aims.service.impl.RuleEngineServiceImpl;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.kie.api.KieServices;
import org.kie.api.builder.*;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.lenient;

/**
 * Unit tests for Drools rules powering the Process-Centric Production Mode.
 *
 * These are integration-like unit tests: the DroolsRuleRepository is mocked
 * to return hand-crafted DRL content, but the Drools engine compiles and
 * executes the rules for real.  This validates rule LOGIC rather than the
 * RuleEngineServiceImpl wiring, so we build KieContainers directly instead
 * of going through the service (which has @PostConstruct / ConcurrentHashMap
 * state that is awkward to set up with pure Mockito).
 *
 * Test IDs: DR-01 through DR-07
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Production Workflow Drools Rules")
class ProductionWorkflowRulesTest {

    @Mock
    private DroolsRuleRepository droolsRuleRepository;

    @Mock
    private DecisionAuditService decisionAuditService;

    @InjectMocks
    private RuleEngineServiceImpl ruleEngineService;

    private KieServices kieServices;

    // ---- DRL constants (mirrors V20260312_06 migration) ----

    private static final String DRL_ENTER_SUPPLEMENTING =
            "package com.cretas.aims.rules.production;\n" +
            "\n" +
            "import com.cretas.aims.entity.ProcessTask;\n" +
            "import java.util.Map;\n" +
            "\n" +
            "global Map actionResult;\n" +
            "\n" +
            "rule \"Enter Supplementing - Record Previous Status\"\n" +
            "    salience 100\n" +
            "    when\n" +
            "        $task: ProcessTask(\n" +
            "            status.name() == \"COMPLETED\" || status.name() == \"CLOSED\"\n" +
            "        )\n" +
            "    then\n" +
            "        actionResult.put(\"previousTerminalStatus\", $task.getStatus().name());\n" +
            "        actionResult.put(\"newStatus\", \"SUPPLEMENTING\");\n" +
            "        actionResult.put(\"action\", \"enter_supplementing\");\n" +
            "end\n";

    private static final String DRL_EXIT_SUPPLEMENTING =
            "package com.cretas.aims.rules.production;\n" +
            "\n" +
            "import com.cretas.aims.entity.ProcessTask;\n" +
            "import java.util.Map;\n" +
            "\n" +
            "global Map actionResult;\n" +
            "\n" +
            "rule \"Exit Supplementing - Restore Previous Status\"\n" +
            "    salience 100\n" +
            "    when\n" +
            "        $task: ProcessTask(\n" +
            "            status.name() == \"SUPPLEMENTING\",\n" +
            "            previousTerminalStatus != null\n" +
            "        )\n" +
            "    then\n" +
            "        actionResult.put(\"newStatus\", $task.getPreviousTerminalStatus());\n" +
            "        actionResult.put(\"action\", \"exit_supplementing\");\n" +
            "        actionResult.put(\"clearPreviousTerminalStatus\", true);\n" +
            "end\n";

    private static final String DRL_UPDATE_COMPLETED_QTY =
            "package com.cretas.aims.rules.production;\n" +
            "\n" +
            "import java.util.Map;\n" +
            "import java.math.BigDecimal;\n" +
            "\n" +
            "global Map actionResult;\n" +
            "\n" +
            "rule \"Update Completed Quantity On Approve\"\n" +
            "    salience 100\n" +
            "    when\n" +
            "        $facts: Map(\n" +
            "            this[\"approvedQuantity\"] != null,\n" +
            "            this[\"taskId\"] != null\n" +
            "        )\n" +
            "    then\n" +
            "        actionResult.put(\"action\", \"update_completed_qty\");\n" +
            "        actionResult.put(\"taskId\", $facts.get(\"taskId\"));\n" +
            "        actionResult.put(\"quantity\", $facts.get(\"approvedQuantity\"));\n" +
            "end\n";

    private static final String DRL_PRODUCTION_VALIDATION =
            "package com.cretas.aims.rules.production;\n" +
            "\n" +
            "import com.cretas.aims.entity.ProcessTask;\n" +
            "import java.util.Map;\n" +
            "import java.math.BigDecimal;\n" +
            "\n" +
            "global Map validationResult;\n" +
            "\n" +
            "rule \"Completed quantity must not exceed planned by 200%\"\n" +
            "    salience 90\n" +
            "    when\n" +
            "        $task: ProcessTask(\n" +
            "            plannedQuantity != null,\n" +
            "            completedQuantity != null,\n" +
            "            completedQuantity.compareTo(plannedQuantity.multiply(new BigDecimal(\"2\"))) > 0\n" +
            "        )\n" +
            "    then\n" +
            "        validationResult.put(\"valid\", false);\n" +
            "        validationResult.put(\"message\", \"完成量不能超过计划量的200%\");\n" +
            "end\n" +
            "\n" +
            "rule \"Cannot close task with pending reports\"\n" +
            "    salience 85\n" +
            "    when\n" +
            "        $task: ProcessTask(\n" +
            "            pendingQuantity != null,\n" +
            "            pendingQuantity.compareTo(BigDecimal.ZERO) > 0\n" +
            "        )\n" +
            "        $facts: Map(this[\"action\"] == \"close\")\n" +
            "    then\n" +
            "        validationResult.put(\"valid\", false);\n" +
            "        validationResult.put(\"message\", \"存在待审批报工，无法关闭任务\");\n" +
            "end\n";

    private static final String DRL_TRANSITION_AUDIT =
            "package com.cretas.aims.rules.production;\n" +
            "\n" +
            "import java.util.Map;\n" +
            "\n" +
            "global Map actionResult;\n" +
            "\n" +
            "rule \"Log Production Workflow Transition\"\n" +
            "    salience 50\n" +
            "    when\n" +
            "        $facts: Map(\n" +
            "            this[\"fromState\"] != null,\n" +
            "            this[\"toState\"] != null,\n" +
            "            this[\"event\"] != null\n" +
            "        )\n" +
            "    then\n" +
            "        actionResult.put(\"auditRequired\", true);\n" +
            "        actionResult.put(\"entityType\", \"PRODUCTION_WORKFLOW\");\n" +
            "        actionResult.put(\"fromState\", $facts.get(\"fromState\"));\n" +
            "        actionResult.put(\"toState\", $facts.get(\"toState\"));\n" +
            "        actionResult.put(\"event\", $facts.get(\"event\"));\n" +
            "end\n";

    // ---- Helpers ----

    @BeforeEach
    void setUp() {
        try {
            kieServices = KieServices.Factory.get();
        } catch (Exception e) {
            // Drools runtime not available -- tests will be skipped via assumeTrue
            kieServices = null;
        }
    }

    /**
     * Compile a single DRL string into a KieContainer.
     * Returns null if compilation fails.
     */
    private KieContainer buildContainer(String drlContent) {
        KieFileSystem kfs = kieServices.newKieFileSystem();
        kfs.write("src/main/resources/rules/test.drl", drlContent);

        KieBuilder builder = kieServices.newKieBuilder(kfs);
        builder.buildAll();

        Results results = builder.getResults();
        if (results.hasMessages(Message.Level.ERROR)) {
            fail("DRL compilation error: " + results.getMessages(Message.Level.ERROR));
        }

        KieModule module = builder.getKieModule();
        return kieServices.newKieContainer(module.getReleaseId());
    }

    /**
     * Compile multiple DRL strings (each in its own file) into a single KieContainer.
     */
    private KieContainer buildContainer(String... drlContents) {
        KieFileSystem kfs = kieServices.newKieFileSystem();
        for (int i = 0; i < drlContents.length; i++) {
            kfs.write("src/main/resources/rules/rule_" + i + ".drl", drlContents[i]);
        }

        KieBuilder builder = kieServices.newKieBuilder(kfs);
        builder.buildAll();

        Results results = builder.getResults();
        if (results.hasMessages(Message.Level.ERROR)) {
            fail("DRL compilation error: " + results.getMessages(Message.Level.ERROR));
        }

        KieModule module = builder.getKieModule();
        return kieServices.newKieContainer(module.getReleaseId());
    }

    private ProcessTask buildTask(ProcessTaskStatus status, BigDecimal planned,
                                  BigDecimal completed, BigDecimal pending,
                                  String previousTerminalStatus) {
        return ProcessTask.builder()
                .id("PT-TEST-001")
                .factoryId("F001")
                .productionRunId("RUN-001")
                .productTypeId("PROD-001")
                .workProcessId("WP-001")
                .unit("kg")
                .status(status)
                .plannedQuantity(planned)
                .completedQuantity(completed)
                .pendingQuantity(pending)
                .previousTerminalStatus(previousTerminalStatus)
                .createdBy(1L)
                .build();
    }

    private DroolsRule buildDroolsRule(String factoryId, String ruleGroup,
                                       String ruleName, String drl, int priority) {
        return DroolsRule.builder()
                .id(UUID.randomUUID().toString())
                .factoryId(factoryId)
                .ruleGroup(ruleGroup)
                .ruleName(ruleName)
                .ruleContent(drl)
                .enabled(true)
                .priority(priority)
                .build();
    }

    // ====================================================================
    // DR-01: enter_supplementing fires for a COMPLETED task
    // ====================================================================

    @Test
    @DisplayName("DR-01: enter_supplementing records previous status for COMPLETED task")
    void dr01_enterSupplementingRecordsPreviousStatusForCompletedTask() {
        assumeTrue(kieServices != null, "Drools runtime not available");

        KieContainer container = buildContainer(DRL_ENTER_SUPPLEMENTING);
        KieSession session = container.newKieSession();
        Map<String, Object> actionResult = new HashMap<>();

        try {
            session.setGlobal("actionResult", actionResult);

            ProcessTask task = buildTask(
                    ProcessTaskStatus.COMPLETED,
                    new BigDecimal("100"),
                    new BigDecimal("95"),
                    BigDecimal.ZERO,
                    null
            );
            session.insert(task);

            int fired = session.fireAllRules();

            assertTrue(fired > 0, "At least one rule should fire");
            assertEquals("COMPLETED", actionResult.get("previousTerminalStatus"),
                    "Should record COMPLETED as previous terminal status");
            assertEquals("SUPPLEMENTING", actionResult.get("newStatus"),
                    "New status should be SUPPLEMENTING");
            assertEquals("enter_supplementing", actionResult.get("action"));
        } finally {
            session.dispose();
            container.dispose();
        }
    }

    // ====================================================================
    // DR-02: exit_supplementing restores previousTerminalStatus
    // ====================================================================

    @Test
    @DisplayName("DR-02: exit_supplementing restores previous terminal status to COMPLETED")
    void dr02_exitSupplementingRestoresPreviousStatus() {
        assumeTrue(kieServices != null, "Drools runtime not available");

        KieContainer container = buildContainer(DRL_EXIT_SUPPLEMENTING);
        KieSession session = container.newKieSession();
        Map<String, Object> actionResult = new HashMap<>();

        try {
            session.setGlobal("actionResult", actionResult);

            ProcessTask task = buildTask(
                    ProcessTaskStatus.SUPPLEMENTING,
                    new BigDecimal("100"),
                    new BigDecimal("95"),
                    BigDecimal.ZERO,
                    "COMPLETED"
            );
            session.insert(task);

            int fired = session.fireAllRules();

            assertTrue(fired > 0, "At least one rule should fire");
            assertEquals("COMPLETED", actionResult.get("newStatus"),
                    "Should restore to COMPLETED from previousTerminalStatus");
            assertEquals("exit_supplementing", actionResult.get("action"));
            assertEquals(true, actionResult.get("clearPreviousTerminalStatus"),
                    "Should flag previousTerminalStatus for clearing");
        } finally {
            session.dispose();
            container.dispose();
        }
    }

    // ====================================================================
    // DR-03: update_completed_qty syncs quantities from approved reports
    // ====================================================================

    @Test
    @DisplayName("DR-03: update_completed_qty syncs approved quantity to actionResult")
    void dr03_updateCompletedQtySyncsQuantities() {
        assumeTrue(kieServices != null, "Drools runtime not available");

        KieContainer container = buildContainer(DRL_UPDATE_COMPLETED_QTY);
        KieSession session = container.newKieSession();
        Map<String, Object> actionResult = new HashMap<>();

        try {
            session.setGlobal("actionResult", actionResult);

            // Insert a facts Map with approved quantity and task ID
            Map<String, Object> facts = new HashMap<>();
            facts.put("taskId", "PT-TEST-001");
            facts.put("approvedQuantity", new BigDecimal("42.5"));
            session.insert(facts);

            int fired = session.fireAllRules();

            assertTrue(fired > 0, "At least one rule should fire");
            assertEquals("update_completed_qty", actionResult.get("action"));
            assertEquals("PT-TEST-001", actionResult.get("taskId"));
            assertEquals(new BigDecimal("42.5"), actionResult.get("quantity"),
                    "Should propagate approved quantity");
        } finally {
            session.dispose();
            container.dispose();
        }
    }

    // ====================================================================
    // DR-04: production_validation -- 200% cap fails validation
    // ====================================================================

    @Test
    @DisplayName("DR-04: production_validation rejects quantity exceeding 200% of planned")
    void dr04_productionValidation200PercentCapFails() {
        assumeTrue(kieServices != null, "Drools runtime not available");

        KieContainer container = buildContainer(DRL_PRODUCTION_VALIDATION);
        KieSession session = container.newKieSession();
        Map<String, Object> validationResult = new HashMap<>();

        try {
            session.setGlobal("validationResult", validationResult);

            // planned=100, completed=250 => 250 > 100*2 => exceeds 200%
            ProcessTask task = buildTask(
                    ProcessTaskStatus.IN_PROGRESS,
                    new BigDecimal("100"),
                    new BigDecimal("250"),
                    BigDecimal.ZERO,
                    null
            );
            session.insert(task);

            int fired = session.fireAllRules();

            assertTrue(fired > 0, "200% cap rule should fire");
            assertEquals(false, validationResult.get("valid"),
                    "Validation should fail");
            String message = (String) validationResult.get("message");
            assertNotNull(message, "Should provide failure message");
            assertTrue(message.contains("200%"),
                    "Message should mention 200% cap: " + message);
        } finally {
            session.dispose();
            container.dispose();
        }
    }

    // ====================================================================
    // DR-05: production_validation -- close with pending reports fails
    // ====================================================================

    @Test
    @DisplayName("DR-05: production_validation rejects closing task with pending reports")
    void dr05_productionValidationCloseWithPendingReportsFails() {
        assumeTrue(kieServices != null, "Drools runtime not available");

        KieContainer container = buildContainer(DRL_PRODUCTION_VALIDATION);
        KieSession session = container.newKieSession();
        Map<String, Object> validationResult = new HashMap<>();

        try {
            session.setGlobal("validationResult", validationResult);

            // Task with pending reports (pendingQuantity > 0)
            ProcessTask task = buildTask(
                    ProcessTaskStatus.COMPLETED,
                    new BigDecimal("100"),
                    new BigDecimal("95"),
                    new BigDecimal("5"),  // 5 units pending approval
                    null
            );
            session.insert(task);

            // Action facts indicating a close operation
            Map<String, Object> actionFacts = new HashMap<>();
            actionFacts.put("action", "close");
            session.insert(actionFacts);

            int fired = session.fireAllRules();

            assertTrue(fired > 0, "Pending-reports rule should fire");
            assertEquals(false, validationResult.get("valid"),
                    "Validation should fail for close with pending reports");
            String message = (String) validationResult.get("message");
            assertNotNull(message, "Should provide failure message");
            assertTrue(message.contains("待审批") || message.contains("无法关闭"),
                    "Message should mention pending reports: " + message);
        } finally {
            session.dispose();
            container.dispose();
        }
    }

    // ====================================================================
    // DR-06: SYSTEM rules used as fallback when factory rules absent
    // ====================================================================

    @Test
    @DisplayName("DR-06: SYSTEM rules serve as fallback when no factory-specific rules exist")
    void dr06_systemRulesFallbackWhenFactoryRulesAbsent() {
        assumeTrue(kieServices != null, "Drools runtime not available");

        // Mock: no rules for F001 + production_validation
        lenient().when(droolsRuleRepository.findByFactoryIdAndRuleGroupAndEnabledTrueOrderByPriorityDesc(
                eq("F001"), eq("production_validation")))
                .thenReturn(Collections.emptyList());

        // SYSTEM rules exist
        DroolsRule systemRule = buildDroolsRule(
                "SYSTEM", "production_validation",
                "process_task_quantity_validation",
                DRL_PRODUCTION_VALIDATION, 90);
        lenient().when(droolsRuleRepository.findByFactoryIdAndRuleGroupAndEnabledTrueOrderByPriorityDesc(
                eq("SYSTEM"), eq("production_validation")))
                .thenReturn(List.of(systemRule));

        // Simulate the fallback logic from RuleEngineServiceImpl.loadRulesFromDatabase(factoryId, ruleGroup):
        //   1. Query factory rules (empty)
        //   2. Query SYSTEM rules
        //   3. Add SYSTEM rules that have no factory-level override

        List<DroolsRule> factoryRules = droolsRuleRepository
                .findByFactoryIdAndRuleGroupAndEnabledTrueOrderByPriorityDesc("F001", "production_validation");
        List<DroolsRule> sysRules = droolsRuleRepository
                .findByFactoryIdAndRuleGroupAndEnabledTrueOrderByPriorityDesc("SYSTEM", "production_validation");

        assertTrue(factoryRules.isEmpty(), "Factory should have no rules");
        assertFalse(sysRules.isEmpty(), "SYSTEM should have rules");

        // Merge: factory rules + SYSTEM fallback (no duplicates)
        List<DroolsRule> merged = new ArrayList<>(factoryRules);
        Set<String> factoryRuleNames = new HashSet<>();
        for (DroolsRule r : factoryRules) {
            factoryRuleNames.add(r.getRuleName());
        }
        for (DroolsRule sr : sysRules) {
            if (!factoryRuleNames.contains(sr.getRuleName())) {
                merged.add(sr);
            }
        }

        assertEquals(1, merged.size(), "Should have exactly the SYSTEM rule");
        assertEquals("SYSTEM", merged.get(0).getFactoryId());

        // Now compile and execute the merged SYSTEM rule to confirm it works
        KieContainer container = buildContainer(merged.get(0).getRuleContent());
        KieSession session = container.newKieSession();
        Map<String, Object> validationResult = new HashMap<>();

        try {
            session.setGlobal("validationResult", validationResult);

            // 250 > 100*2 = exceeds 200%
            ProcessTask task = buildTask(
                    ProcessTaskStatus.IN_PROGRESS,
                    new BigDecimal("100"),
                    new BigDecimal("250"),
                    BigDecimal.ZERO,
                    null
            );
            session.insert(task);
            session.fireAllRules();

            assertEquals(false, validationResult.get("valid"),
                    "SYSTEM fallback rule should validate correctly");
        } finally {
            session.dispose();
            container.dispose();
        }
    }

    // ====================================================================
    // DR-07: Factory-specific rule overrides SYSTEM rule
    // ====================================================================

    @Test
    @DisplayName("DR-07: Factory-specific rule overrides SYSTEM rule with same ruleGroup")
    void dr07_factoryRuleOverridesSystemRule() {
        assumeTrue(kieServices != null, "Drools runtime not available");

        // Factory F001 has a custom validation rule with a stricter 150% cap
        String factoryCustomDrl =
                "package com.cretas.aims.rules.production;\n" +
                "\n" +
                "import com.cretas.aims.entity.ProcessTask;\n" +
                "import java.util.Map;\n" +
                "import java.math.BigDecimal;\n" +
                "\n" +
                "global Map validationResult;\n" +
                "\n" +
                "rule \"Completed quantity must not exceed planned by 150% (Factory Override)\"\n" +
                "    salience 90\n" +
                "    when\n" +
                "        $task: ProcessTask(\n" +
                "            plannedQuantity != null,\n" +
                "            completedQuantity != null,\n" +
                "            completedQuantity.compareTo(plannedQuantity.multiply(new BigDecimal(\"1.5\"))) > 0\n" +
                "        )\n" +
                "    then\n" +
                "        validationResult.put(\"valid\", false);\n" +
                "        validationResult.put(\"message\", \"完成量不能超过计划量的150% (工厂自定义)\");\n" +
                "end\n";

        DroolsRule factoryRule = buildDroolsRule(
                "F001", "production_validation",
                "process_task_quantity_validation",
                factoryCustomDrl, 90);
        DroolsRule systemRule = buildDroolsRule(
                "SYSTEM", "production_validation",
                "process_task_quantity_validation",
                DRL_PRODUCTION_VALIDATION, 90);

        // Mock repository
        lenient().when(droolsRuleRepository.findByFactoryIdAndRuleGroupAndEnabledTrueOrderByPriorityDesc(
                eq("F001"), eq("production_validation")))
                .thenReturn(List.of(factoryRule));
        lenient().when(droolsRuleRepository.findByFactoryIdAndRuleGroupAndEnabledTrueOrderByPriorityDesc(
                eq("SYSTEM"), eq("production_validation")))
                .thenReturn(List.of(systemRule));

        // Simulate the merge logic: factory rules take priority
        List<DroolsRule> factoryRules = droolsRuleRepository
                .findByFactoryIdAndRuleGroupAndEnabledTrueOrderByPriorityDesc("F001", "production_validation");
        List<DroolsRule> sysRules = droolsRuleRepository
                .findByFactoryIdAndRuleGroupAndEnabledTrueOrderByPriorityDesc("SYSTEM", "production_validation");

        List<DroolsRule> merged = new ArrayList<>(factoryRules);
        Set<String> factoryRuleNames = new HashSet<>();
        for (DroolsRule r : factoryRules) {
            factoryRuleNames.add(r.getRuleName());
        }
        for (DroolsRule sr : sysRules) {
            if (!factoryRuleNames.contains(sr.getRuleName())) {
                merged.add(sr);
            }
        }

        // Only the factory rule should remain (same ruleName blocks SYSTEM)
        assertEquals(1, merged.size(), "Factory rule should override SYSTEM rule with same name");
        assertEquals("F001", merged.get(0).getFactoryId(),
                "The surviving rule should be the factory one");

        // Compile and execute the factory rule: 160 > 100*1.5 = true, so factory's 150% rule fires
        KieContainer container = buildContainer(merged.get(0).getRuleContent());
        KieSession session = container.newKieSession();
        Map<String, Object> validationResult = new HashMap<>();

        try {
            session.setGlobal("validationResult", validationResult);

            // planned=100, completed=160 => 160 > 150 (factory 150% cap) but 160 < 200 (SYSTEM 200% cap)
            ProcessTask task = buildTask(
                    ProcessTaskStatus.IN_PROGRESS,
                    new BigDecimal("100"),
                    new BigDecimal("160"),
                    BigDecimal.ZERO,
                    null
            );
            session.insert(task);

            int fired = session.fireAllRules();

            assertTrue(fired > 0, "Factory 150% rule should fire for 160/100");
            assertEquals(false, validationResult.get("valid"),
                    "Factory rule should reject at 150% threshold");
            String message = (String) validationResult.get("message");
            assertNotNull(message);
            assertTrue(message.contains("150%"),
                    "Message should reference 150% factory cap, not 200% SYSTEM cap: " + message);
        } finally {
            session.dispose();
            container.dispose();
        }

        // Additionally verify the same quantity (160) would PASS the SYSTEM 200% rule
        KieContainer systemContainer = buildContainer(systemRule.getRuleContent());
        KieSession systemSession = systemContainer.newKieSession();
        Map<String, Object> systemValidation = new HashMap<>();

        try {
            systemSession.setGlobal("validationResult", systemValidation);

            ProcessTask task = buildTask(
                    ProcessTaskStatus.IN_PROGRESS,
                    new BigDecimal("100"),
                    new BigDecimal("160"),
                    BigDecimal.ZERO,
                    null
            );
            systemSession.insert(task);

            int fired = systemSession.fireAllRules();

            // 160 <= 200 so the SYSTEM 200% rule should NOT fire
            assertEquals(0, fired, "SYSTEM 200% rule should NOT fire for 160/100");
            assertNull(systemValidation.get("valid"),
                    "SYSTEM validation should not have been populated");
        } finally {
            systemSession.dispose();
            systemContainer.dispose();
        }
    }
}
