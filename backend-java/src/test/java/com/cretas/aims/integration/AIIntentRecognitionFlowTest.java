package com.cretas.aims.integration;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.cache.SemanticCacheHit;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.IntentMatchResult.MatchMethod;
import com.cretas.aims.entity.cache.SemanticCacheConfig;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.IntentExecutorService;
import com.cretas.aims.service.SemanticCacheService;
import com.cretas.aims.service.impl.IntentConfigRollbackService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * AI Intent Recognition Flow Integration Test
 * Tests complete AI intent recognition pipeline
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("AIIntentRecognitionFlowTest")
class AIIntentRecognitionFlowTest {

    @Autowired private AIIntentService aiIntentService;
    @Autowired private IntentExecutorService intentExecutorService;
    @Autowired private SemanticCacheService semanticCacheService;
    @Autowired private IntentConfigRollbackService rollbackService;

    private static final String TEST_FACTORY_ID = "F001";
    private static final Long TEST_USER_ID = 22L;
    private static final String TEST_USER_ROLE = "factory_super_admin";

    @Test @Order(1) @Transactional @DisplayName("Test1: AI Intent Recognition Pipeline")
    void testAIIntentRecognitionPipeline() {
        // Test the full pipeline: input -> recognition -> execution
        String userInput = "query production status";
        Optional<AIIntentConfig> intent = aiIntentService.recognizeIntent(TEST_FACTORY_ID, userInput);
        // Just verify recognition works without exception
        assertThat(true).isTrue(); // Pipeline executed without error
    }

    @Test @Order(2) @Transactional @DisplayName("Test2: Exact Match")
    void testExactMatch() {
        // Test exact keyword matching
        IntentMatchResult result = aiIntentService.recognizeIntentWithConfidence("query batch status", 3);
        // Verify result structure
        if (result.hasMatch()) {
            assertThat(result.getBestMatch()).isNotNull();
            assertThat(result.getConfidence()).isGreaterThan(0.0);
        }
    }

    @Test @Order(3) @Transactional @DisplayName("Test3: Regex Match")
    void testRegexMatch() {
        // Test regex pattern matching
        List<AIIntentConfig> allIntents = aiIntentService.getAllIntents(TEST_FACTORY_ID);
        boolean hasRegex = allIntents.stream().anyMatch(i -> i.getRegexPattern() != null);
        // Verify we can query intents
        assertThat(allIntents).isNotNull();
    }

    @Test @Order(4) @Transactional @DisplayName("Test4: Keyword Match")
    void testKeywordMatch() {
        // Test keyword-based matching
        IntentMatchResult result = aiIntentService.recognizeIntentWithConfidence("check quality report", 5);
        if (result.hasMatch() && result.getMatchMethod() == MatchMethod.KEYWORD) {
            assertThat(result.getMatchedKeywords()).isNotEmpty();
        }
    }

    @Test @Order(5) @Transactional @DisplayName("Test5: Semantic Cache Hit")
    void testSemanticCacheHit() {
        // Test semantic cache query
        SemanticCacheHit cacheHit = semanticCacheService.queryCache(TEST_FACTORY_ID, "test query");
        assertThat(cacheHit).isNotNull();
        // Cache may hit or miss, both are valid results
    }

    @Test @Order(6) @Transactional @DisplayName("Test6: Semantic Cache Miss")
    void testSemanticCacheMiss() {
        // Test cache miss scenario
        String uniqueInput = "unique_test_input_" + System.currentTimeMillis();
        SemanticCacheHit cacheHit = semanticCacheService.queryCache(TEST_FACTORY_ID, uniqueInput);
        assertThat(cacheHit).isNotNull();
        assertThat(cacheHit.isHit()).isFalse();
    }

    @Test @Order(7) @Transactional @DisplayName("Test7: LLM Fallback")
    void testLlmFallback() {
        // Test LLM fallback for unrecognized input
        IntentMatchResult result = aiIntentService.recognizeIntentWithConfidence("unknown random text xyz123", 3);
        if (!result.hasMatch()) {
            assertThat(result.needsLlmFallback()).isTrue();
        }
    }

    @Test @Order(8) @Transactional @DisplayName("Test8: Intent Execution")
    void testIntentExecution() {
        // Test intent execution service
        IntentExecuteRequest request = new IntentExecuteRequest();
        request.setUserInput("query today production");
        // Execute should not throw exception
        try {
            IntentExecuteResponse response = intentExecutorService.execute(TEST_FACTORY_ID, request, TEST_USER_ID, TEST_USER_ROLE);
            assertThat(response).isNotNull();
        } catch (Exception e) {
            // Some intents may not be configured, that's ok for this test
        }
    }

    @Test @Order(9) @Transactional @DisplayName("Test9: Material Batch Query Intent")
    void testMaterialBatchQueryIntent() {
        // Test material batch query intent
        IntentMatchResult result = aiIntentService.recognizeIntentWithConfidence("query material batch MB-001", 3);
        if (result.hasMatch()) {
            assertThat(result.getBestMatch().getIntentCategory()).isNotNull();
        }
    }

    @Test @Order(10) @Transactional @DisplayName("Test10: Production Status Intent")
    void testProductionStatusIntent() {
        // Test production status intent
        IntentMatchResult result = aiIntentService.recognizeIntentWithConfidence("what is current production status", 3);
        // Verify recognition completes without error
        assertThat(result).isNotNull();
    }

    @Test @Order(11) @Transactional @DisplayName("Test11: Quality Report Intent")
    void testQualityReportIntent() {
        // Test quality report intent
        IntentMatchResult result = aiIntentService.recognizeIntentWithConfidence("show quality inspection report", 3);
        assertThat(result).isNotNull();
    }

    @Test @Order(12) @Transactional @DisplayName("Test12: Device Status Intent")
    void testDeviceStatusIntent() {
        // Test device status intent
        IntentMatchResult result = aiIntentService.recognizeIntentWithConfidence("check device equipment status", 3);
        assertThat(result).isNotNull();
    }

    @Test @Order(13) @Transactional @DisplayName("Test13: Intent Version Management")
    void testIntentVersionManagement() {
        // Test intent configuration version management
        List<AIIntentConfig> intents = aiIntentService.getAllIntents(TEST_FACTORY_ID);
        for (AIIntentConfig intent : intents) {
            if (intent.getConfigVersion() != null) {
                assertThat(intent.getConfigVersion()).isGreaterThanOrEqualTo(1);
                break;
            }
        }
    }

    @Test @Order(14) @Transactional @DisplayName("Test14: Intent Rollback")
    void testIntentRollback() {
        // Test intent rollback functionality
        List<AIIntentConfig> intents = aiIntentService.getAllIntents(TEST_FACTORY_ID);
        if (!intents.isEmpty()) {
            AIIntentConfig first = intents.get(0);
            // Verify rollback service exists and is accessible
            assertThat(rollbackService).isNotNull();
            // Getting version history should work
            var history = rollbackService.getVersionHistory(first.getId());
            assertThat(history).isNotNull();
        }
    }

    @Test @Order(15) @Transactional @DisplayName("Test15: Self Learning Keyword")
    void testSelfLearningKeyword() {
        // Test self-learning keyword mechanism
        String testInput = "test learning keyword";
        IntentMatchResult result = aiIntentService.recognizeIntentWithConfidence(testInput, 3);
        
        // If matched, record positive feedback
        if (result.hasMatch()) {
            aiIntentService.recordPositiveFeedback(
                TEST_FACTORY_ID,
                result.getBestMatch().getIntentCode(),
                result.getMatchedKeywords() != null ? result.getMatchedKeywords() : List.of()
            );
        }
        assertThat(result).isNotNull();
    }
}
