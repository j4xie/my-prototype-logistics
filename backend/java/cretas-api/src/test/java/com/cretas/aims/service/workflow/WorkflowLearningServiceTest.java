package com.cretas.aims.service.workflow;

import com.cretas.aims.entity.rules.StateMachine;
import com.cretas.aims.repository.StateMachineRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * WorkflowLearningService unit tests
 *
 * Tests pattern extraction (analyzeAndIndex) and cross-factory similarity detection
 * (findSimilarWorkflows) using Jaccard similarity on state codes.
 *
 * UT-WLS-01 ~ UT-WLS-06
 *
 * @author Cretas Team
 * @since 2026-03-12
 */
@ExtendWith(MockitoExtension.class)
class WorkflowLearningServiceTest {

    @Mock
    private StateMachineRepository stateMachineRepository;

    private WorkflowLearningService learningService;

    private static final String FACTORY_A = "F001";
    private static final String FACTORY_B = "F002";
    private static final String FACTORY_C = "F003";
    private static final String ENTITY_TYPE = "PRODUCTION_WORKFLOW";

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = new ObjectMapper();
        learningService = new WorkflowLearningService(stateMachineRepository, objectMapper);
    }

    // ────────────────────────────────────────────────────────────────
    // UT-WLS-01: analyzeAndIndex() extracts stateCount, transitionCount, stateCodes
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-WLS-01: analyzeAndIndex() extracts stateCount, transitionCount, stateCodes correctly")
    void analyzeAndIndexExtractsBasicFeatures() {
        StateMachine sm = buildStateMachine(FACTORY_A, ENTITY_TYPE, 1,
                STATES_BASIC, TRANSITIONS_BASIC);

        Map<String, Object> features = learningService.analyzeAndIndex(sm);

        assertFalse(features.containsKey("error"), "Should not contain error");
        assertEquals(FACTORY_A, features.get("factoryId"));
        assertEquals(ENTITY_TYPE, features.get("entityType"));
        assertEquals(1, features.get("version"));
        assertEquals(4, features.get("stateCount"));
        assertEquals(2, features.get("transitionCount"));

        @SuppressWarnings("unchecked")
        List<String> stateCodes = (List<String>) features.get("stateCodes");
        assertEquals(4, stateCodes.size());
        assertTrue(stateCodes.contains("plan_created"));
        assertTrue(stateCodes.contains("in_progress"));
        assertTrue(stateCodes.contains("completed"));
        assertTrue(stateCodes.contains("closed"));
    }

    // ────────────────────────────────────────────────────────────────
    // UT-WLS-02: analyzeAndIndex() detects hasSupplementing
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-WLS-02: analyzeAndIndex() detects supplementing state correctly")
    void analyzeAndIndexDetectsSupplementing() {
        // With supplementing
        StateMachine smWithSup = buildStateMachine(FACTORY_A, ENTITY_TYPE, 1,
                STATES_WITH_SUPPLEMENTING, TRANSITIONS_BASIC);
        Map<String, Object> features = learningService.analyzeAndIndex(smWithSup);
        assertTrue((boolean) features.get("hasSupplementing"),
                "Should detect supplementing state");

        // Without supplementing
        StateMachine smWithout = buildStateMachine(FACTORY_A, ENTITY_TYPE, 1,
                STATES_BASIC, TRANSITIONS_BASIC);
        Map<String, Object> featuresNoSup = learningService.analyzeAndIndex(smWithout);
        assertFalse((boolean) featuresNoSup.get("hasSupplementing"),
                "Should not detect supplementing when absent");
    }

    // ────────────────────────────────────────────────────────────────
    // UT-WLS-03: analyzeAndIndex() generates knowledgeDocument text
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-WLS-03: analyzeAndIndex() generates human-readable knowledgeDocument")
    void analyzeAndIndexGeneratesKnowledgeDocument() {
        StateMachine sm = buildStateMachine(FACTORY_A, ENTITY_TYPE, 2,
                STATES_WITH_SUPPLEMENTING, TRANSITIONS_WITH_GUARDS);

        Map<String, Object> features = learningService.analyzeAndIndex(sm);

        String doc = (String) features.get("knowledgeDocument");
        assertNotNull(doc, "knowledgeDocument should not be null");

        // Document should contain factory ID
        assertTrue(doc.contains(FACTORY_A));
        // Document should mention entity type
        assertTrue(doc.contains(ENTITY_TYPE));
        // Document should mention version
        assertTrue(doc.contains("v2"));
        // Document should contain state names (arrow-separated)
        assertTrue(doc.contains("计划创建"));
        assertTrue(doc.contains("进行中"));
        // Document should mention guard count
        assertTrue(doc.contains("守卫条件"));
        // Document should mention supplementing feature
        assertTrue(doc.contains("补报"));
    }

    // ────────────────────────────────────────────────────────────────
    // UT-WLS-04: analyzeAndIndex() returns error map on parse failure
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-WLS-04: analyzeAndIndex() returns error map on malformed JSON")
    void analyzeAndIndexReturnsErrorOnParseFailure() {
        StateMachine sm = StateMachine.builder()
                .id("sm-bad")
                .factoryId(FACTORY_A)
                .entityType(ENTITY_TYPE)
                .machineName("Bad")
                .initialState("plan_created")
                .statesJson("NOT VALID JSON {{{{")
                .transitionsJson("[]")
                .version(1)
                .publishStatus("published")
                .build();

        Map<String, Object> features = learningService.analyzeAndIndex(sm);

        assertTrue(features.containsKey("error"), "Should contain error key");
        assertNotNull(features.get("error"));
        // Should NOT contain normal feature keys
        assertFalse(features.containsKey("stateCount"));
    }

    // ────────────────────────────────────────────────────────────────
    // UT-WLS-05: findSimilarWorkflows() Jaccard similarity correct, filters < 0.5
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-WLS-05: findSimilarWorkflows() calculates Jaccard and filters < 0.5")
    void findSimilarWorkflowsJaccardCorrect() {
        // Reference: F001 with states {plan_created, in_progress, completed, closed}
        StateMachine refSm = buildStateMachine(FACTORY_A, ENTITY_TYPE, 1,
                STATES_BASIC, TRANSITIONS_BASIC);
        refSm.setPublishStatus("published");

        // F002: high similarity {plan_created, in_progress, completed, closed, supplementing}
        // Jaccard = 4 / 5 = 0.80 (should be included)
        StateMachine similarSm = buildStateMachine(FACTORY_B, ENTITY_TYPE, 1,
                STATES_WITH_SUPPLEMENTING, TRANSITIONS_BASIC);
        similarSm.setPublishStatus("published");

        // F003: low similarity {plan_created, mixing, fermenting, bottled}
        // Intersection with ref = {plan_created}, union = {plan_created, in_progress, completed, closed, mixing, fermenting, bottled} = 7
        // Jaccard = 1/7 = 0.14 (should be filtered out)
        StateMachine dissimilarSm = buildStateMachine(FACTORY_C, ENTITY_TYPE, 1,
                STATES_COMPLETELY_DIFFERENT, TRANSITIONS_BASIC);
        dissimilarSm.setPublishStatus("published");

        // Mock repository
        when(stateMachineRepository.findAll())
                .thenReturn(List.of(refSm, similarSm, dissimilarSm));
        when(stateMachineRepository.findByFactoryIdAndEntityTypeAndPublishStatus(
                FACTORY_A, ENTITY_TYPE, "published"))
                .thenReturn(Optional.of(refSm));

        List<Map<String, Object>> results = learningService.findSimilarWorkflows(FACTORY_A, ENTITY_TYPE);

        // Only F002 should be returned (Jaccard >= 0.5)
        assertEquals(1, results.size());
        assertEquals(FACTORY_B, results.get(0).get("factoryId"));

        // Jaccard = 4/5 = 0.80 -> 80%
        long similarity = (long) results.get(0).get("similarity");
        assertEquals(80, similarity, "Jaccard similarity should be 80%");
    }

    // ────────────────────────────────────────────────────────────────
    // UT-WLS-06: findSimilarWorkflows() excludes same factoryId
    // ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("UT-WLS-06: findSimilarWorkflows() excludes the queried factory from results")
    void findSimilarWorkflowsExcludesSameFactory() {
        // Only one factory published
        StateMachine refSm = buildStateMachine(FACTORY_A, ENTITY_TYPE, 1,
                STATES_BASIC, TRANSITIONS_BASIC);
        refSm.setPublishStatus("published");

        when(stateMachineRepository.findAll()).thenReturn(List.of(refSm));
        when(stateMachineRepository.findByFactoryIdAndEntityTypeAndPublishStatus(
                FACTORY_A, ENTITY_TYPE, "published"))
                .thenReturn(Optional.of(refSm));

        List<Map<String, Object>> results = learningService.findSimilarWorkflows(FACTORY_A, ENTITY_TYPE);

        // F001 should not appear in its own similarity results
        assertTrue(results.isEmpty(), "Same factory should be excluded from results");

        // Also test with multiple factories where reference is same as one of the "others"
        StateMachine anotherSm = buildStateMachine(FACTORY_A, ENTITY_TYPE, 2,
                STATES_BASIC, TRANSITIONS_BASIC);
        anotherSm.setPublishStatus("published");

        when(stateMachineRepository.findAll()).thenReturn(List.of(refSm, anotherSm));

        results = learningService.findSimilarWorkflows(FACTORY_A, ENTITY_TYPE);
        // Both are F001, both should be excluded
        assertTrue(results.isEmpty(), "All entries from same factory should be excluded");
    }

    // ────────────────────────────────────────────────────────────────
    // Test data constants (JSON strings)
    // ────────────────────────────────────────────────────────────────

    /** 4 states: plan_created, in_progress, completed, closed */
    private static final String STATES_BASIC =
            "[{\"code\":\"plan_created\",\"name\":\"计划创建\",\"type\":\"initial\"}," +
            "{\"code\":\"in_progress\",\"name\":\"进行中\"}," +
            "{\"code\":\"completed\",\"name\":\"已完成\",\"type\":\"final\"}," +
            "{\"code\":\"closed\",\"name\":\"已关闭\",\"type\":\"final\"}]";

    /** 5 states: basic + supplementing */
    private static final String STATES_WITH_SUPPLEMENTING =
            "[{\"code\":\"plan_created\",\"name\":\"计划创建\",\"type\":\"initial\"}," +
            "{\"code\":\"in_progress\",\"name\":\"进行中\"}," +
            "{\"code\":\"completed\",\"name\":\"已完成\",\"type\":\"final\"}," +
            "{\"code\":\"closed\",\"name\":\"已关闭\",\"type\":\"final\"}," +
            "{\"code\":\"supplementing\",\"name\":\"补报中\"}]";

    /** 4 states completely different from basic (except plan_created) */
    private static final String STATES_COMPLETELY_DIFFERENT =
            "[{\"code\":\"plan_created\",\"name\":\"计划创建\",\"type\":\"initial\"}," +
            "{\"code\":\"mixing\",\"name\":\"混料\"}," +
            "{\"code\":\"fermenting\",\"name\":\"发酵\"}," +
            "{\"code\":\"bottled\",\"name\":\"灌装\",\"type\":\"final\"}]";

    /** 2 transitions, no guards or actions */
    private static final String TRANSITIONS_BASIC =
            "[{\"sourceState\":\"plan_created\",\"targetState\":\"in_progress\",\"event\":\"start\",\"guard\":\"\"}," +
            "{\"sourceState\":\"in_progress\",\"targetState\":\"completed\",\"event\":\"complete\",\"guard\":\"\"}]";

    /** 2 transitions with guards and actions */
    private static final String TRANSITIONS_WITH_GUARDS =
            "[{\"sourceState\":\"plan_created\",\"targetState\":\"in_progress\",\"event\":\"start\",\"guard\":\"\",\"action\":\"\"}," +
            "{\"sourceState\":\"in_progress\",\"targetState\":\"completed\",\"event\":\"complete\",\"guard\":\"#isCompletedGtePlanned\",\"action\":\"action:notify_supervisor\"}]";

    // ────────────────────────────────────────────────────────────────
    // Helper methods
    // ────────────────────────────────────────────────────────────────

    private StateMachine buildStateMachine(String factoryId, String entityType,
            int version, String statesJson, String transitionsJson) {
        return StateMachine.builder()
                .id("sm-" + factoryId + "-" + version)
                .factoryId(factoryId)
                .entityType(entityType)
                .machineName(entityType + " for " + factoryId)
                .initialState("plan_created")
                .statesJson(statesJson)
                .transitionsJson(transitionsJson)
                .version(version)
                .publishStatus("published")
                .enabled(true)
                .build();
    }
}
