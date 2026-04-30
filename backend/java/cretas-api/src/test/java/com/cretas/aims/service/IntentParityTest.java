package com.cretas.aims.service;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.service.impl.AIIntentServiceImpl;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Phase 2B-α merge gate: Tier 1 50 goldens — Java legacy vs Python parity.
 *
 * <p>For each golden:
 * <ol>
 *   <li>Run with {@code usePythonMatcher=false} → record IntentMatchResult (legacy)</li>
 *   <li>Run with {@code usePythonMatcher=true}  → record IntentMatchResult (python)</li>
 *   <li>Assert intentCode matches, confidence within ±{@value #CONFIDENCE_TOLERANCE}</li>
 * </ol>
 *
 * <p>Run with: {@code mvn test -Dtest=IntentParityTest}
 *
 * <p><b>NOTE:</b> This skeleton requires the tier1 fixture file from Task 22
 * sampling + recording. Without it, {@link #loadGoldens()} returns an empty
 * list and the test class silently has no parameterized cases. After Task 22
 * produces the JSONL, re-run this test class to actually exercise parity.
 */
@Tag("parity")
@SpringBootTest
@ActiveProfiles("test")
class IntentParityTest {

    @Autowired
    private AIIntentServiceImpl service;

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final double CONFIDENCE_TOLERANCE = 0.05;

    static List<TestCase> loadGoldens() throws Exception {
        List<TestCase> cases = new ArrayList<>();
        try (InputStream in = IntentParityTest.class.getResourceAsStream(
                "/test-fixtures/java-intent-golden/intent-tier1-50.jsonl")) {
            if (in == null) {
                return cases;  // No fixture yet — test class skips silently
            }
            String content = new String(in.readAllBytes());
            for (String line : content.split("\n")) {
                if (line.trim().isEmpty()) continue;
                JsonNode node = MAPPER.readTree(line);
                cases.add(new TestCase(
                        node.get("id").asText(),
                        node.get("query").asText(),
                        node.get("factoryId").asText(),
                        node.get("userId").asText("22"),
                        node.get("role").asText("factory_super_admin"),
                        node.get("expectedIntentCode").asText()
                ));
            }
        }
        return cases;
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @MethodSource("loadGoldens")
    void parityCheck(TestCase tc) {
        // Legacy path
        ReflectionTestUtils.setField(service, "usePythonMatcher", false);
        IntentMatchResult legacy = invokeMatch(tc);

        // Python path
        ReflectionTestUtils.setField(service, "usePythonMatcher", true);
        IntentMatchResult python = invokeMatch(tc);

        assertNotNull(legacy, "Legacy returned null for: " + tc.query());
        assertNotNull(python, "Python returned null for: " + tc.query());

        // intentCode parity
        String legacyCode = legacy.getBestMatch() != null
                ? legacy.getBestMatch().getIntentCode() : null;
        String pythonCode = python.getBestMatch() != null
                ? python.getBestMatch().getIntentCode() : null;
        assertEquals(legacyCode, pythonCode,
                "intentCode mismatch for " + tc.query()
                        + " expected=" + tc.expectedIntentCode()
                        + " legacy=" + legacyCode + " python=" + pythonCode);

        // Confidence within tolerance
        if (legacy.getConfidence() != null && python.getConfidence() != null) {
            double diff = Math.abs(legacy.getConfidence() - python.getConfidence());
            assertTrue(diff <= CONFIDENCE_TOLERANCE,
                    "Confidence diff " + diff + " > " + CONFIDENCE_TOLERANCE);
        }
    }

    private IntentMatchResult invokeMatch(TestCase tc) {
        // Wire to actual AIIntentServiceImpl.recognizeIntentWithConfidence(...) —
        // canonical 6-arg overload (userInput, factoryId, topN, userId, userRole, sessionId)
        return service.recognizeIntentWithConfidence(
                tc.query(), tc.factoryId(), 5,
                Long.parseLong(tc.userId()), tc.role(), null
        );
    }

    record TestCase(
            String id, String query, String factoryId,
            String userId, String role, String expectedIntentCode
    ) {}
}
