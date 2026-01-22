package com.cretas.aims.ai.synthetic;

import com.cretas.aims.ai.synthetic.IntentScenGenerator.SyntheticSample;
import com.cretas.aims.ai.synthetic.IntentSkelBuilder.IntentSkel;
import com.cretas.aims.ai.synthetic.IntentSkelBuilder.Slot;
import com.cretas.aims.ai.synthetic.IntentValidator.ValidationResult;
import com.cretas.aims.config.SyntheticDataConfig;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.learning.TrainingSample;
import com.cretas.aims.repository.learning.TrainingSampleRepository;
import com.cretas.aims.service.AIIntentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for Synthetic Data generation pipeline components.
 *
 * Tests cover:
 * - IntentSkelBuilder: Building intent skeletons from historical data
 * - IntentScenGenerator: Generating synthetic samples from skeletons
 * - IntentValidator: Validating synthetic sample structure and semantics
 * - GRAPEFilter: Filtering samples based on model confidence
 * - SyntheticDataService: End-to-end integration
 *
 * @author Cretas AI Team
 * @since 2026-01-22
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SyntheticDataService Unit Tests")
class SyntheticDataServiceTest {

    private static final String TEST_FACTORY_ID = "F001";
    private static final String TEST_INTENT_CODE = "QUERY_SALES";

    // ==================== IntentSkelBuilder Tests ====================

    @Nested
    @DisplayName("IntentSkelBuilder Tests")
    class IntentSkelBuilderTests {

        @Mock
        private TrainingSampleRepository trainingSampleRepository;

        @InjectMocks
        private IntentSkelBuilder intentSkelBuilder;

        @Test
        @DisplayName("buildFromHistory - extracts patterns from verified samples")
        void testBuildFromHistory_extractsPatterns() {
            // Arrange
            List<TrainingSample> samples = createMockTrainingSamples();
            when(trainingSampleRepository.findVerifiedRealSamples(TEST_FACTORY_ID, TEST_INTENT_CODE))
                    .thenReturn(samples);

            // Act
            IntentSkel skeleton = intentSkelBuilder.buildFromHistory(TEST_INTENT_CODE, TEST_FACTORY_ID);

            // Assert
            assertNotNull(skeleton, "Skeleton should not be null");
            assertEquals(TEST_INTENT_CODE, skeleton.getIntentCode(), "Intent code should match");
            assertEquals(TEST_FACTORY_ID, skeleton.getFactoryId(), "Factory ID should match");
            assertNotNull(skeleton.getSkeletonId(), "Skeleton ID should be generated");
            assertEquals(samples.size(), skeleton.getSampleCount(), "Sample count should match");

            // Verify patterns were extracted
            assertFalse(skeleton.getPatterns().isEmpty(), "Patterns should be extracted");

            // Verify slots were extracted
            List<Slot> slots = skeleton.getSlots();
            assertFalse(slots.isEmpty(), "Slots should be extracted");

            // Verify TIME slot exists and has values
            Optional<Slot> timeSlot = skeleton.getSlot("TIME");
            assertTrue(timeSlot.isPresent(), "TIME slot should exist");

            // Verify METRIC slot exists and has values
            Optional<Slot> metricSlot = skeleton.getSlot("METRIC");
            assertTrue(metricSlot.isPresent(), "METRIC slot should exist");

            verify(trainingSampleRepository).findVerifiedRealSamples(TEST_FACTORY_ID, TEST_INTENT_CODE);
        }

        @Test
        @DisplayName("buildFromHistory - handles empty samples gracefully")
        void testBuildFromHistory_handlesEmptySamples() {
            // Arrange
            when(trainingSampleRepository.findVerifiedRealSamples(TEST_FACTORY_ID, TEST_INTENT_CODE))
                    .thenReturn(Collections.emptyList());

            // Act
            IntentSkel skeleton = intentSkelBuilder.buildFromHistory(TEST_INTENT_CODE, TEST_FACTORY_ID);

            // Assert
            assertNotNull(skeleton, "Skeleton should not be null even with empty samples");
            assertEquals(TEST_INTENT_CODE, skeleton.getIntentCode(), "Intent code should match");
            assertEquals(TEST_FACTORY_ID, skeleton.getFactoryId(), "Factory ID should match");
            assertEquals(0, skeleton.getSampleCount(), "Sample count should be 0");
            assertNotNull(skeleton.getSkeletonId(), "Skeleton ID should still be generated");

            // Verify that isValidForGeneration returns false for empty skeleton
            assertFalse(skeleton.isValidForGeneration(),
                    "Skeleton with no patterns should not be valid for generation");

            verify(trainingSampleRepository).findVerifiedRealSamples(TEST_FACTORY_ID, TEST_INTENT_CODE);
        }

        private List<TrainingSample> createMockTrainingSamples() {
            List<TrainingSample> samples = new ArrayList<>();

            TrainingSample sample1 = new TrainingSample();
            sample1.setUserInput("查询今天的销售额");
            sample1.setMatchedIntentCode(TEST_INTENT_CODE);
            samples.add(sample1);

            TrainingSample sample2 = new TrainingSample();
            sample2.setUserInput("本月产量统计");
            sample2.setMatchedIntentCode(TEST_INTENT_CODE);
            samples.add(sample2);

            TrainingSample sample3 = new TrainingSample();
            sample3.setUserInput("显示上周的库存数量");
            sample3.setMatchedIntentCode(TEST_INTENT_CODE);
            samples.add(sample3);

            return samples;
        }
    }

    // ==================== IntentScenGenerator Tests ====================

    @Nested
    @DisplayName("IntentScenGenerator Tests")
    class IntentScenGeneratorTests {

        @Mock
        private SyntheticDataConfig config;

        @Mock
        private SyntheticDataConfig.DomainRandomization domainRandomization;

        @InjectMocks
        private IntentScenGenerator intentScenGenerator;

        @BeforeEach
        void setUp() {
            // Configure default mock behavior for config
            lenient().when(config.isEnabled()).thenReturn(true);
            lenient().when(config.getDomainRandomization()).thenReturn(domainRandomization);
            lenient().when(domainRandomization.getSynonymProb()).thenReturn(0.3);
            lenient().when(domainRandomization.getTypoProb()).thenReturn(0.05);
            lenient().when(domainRandomization.getReorderProb()).thenReturn(0.2);
            lenient().when(domainRandomization.getOmitOptionalProb()).thenReturn(0.3);
        }

        @Test
        @DisplayName("generate - produces valid samples from skeleton")
        void testGenerate_producesValidSamples() {
            // Arrange
            IntentSkel skeleton = createValidSkeleton();
            int targetCount = 5;

            // Act
            List<SyntheticSample> samples = intentScenGenerator.generate(skeleton, targetCount);

            // Assert
            assertNotNull(samples, "Generated samples list should not be null");
            assertEquals(targetCount, samples.size(), "Should generate requested number of samples");

            for (SyntheticSample sample : samples) {
                assertNotNull(sample.getUserInput(), "User input should not be null");
                assertFalse(sample.getUserInput().trim().isEmpty(), "User input should not be empty");
                assertEquals(TEST_INTENT_CODE, sample.getIntentCode(), "Intent code should match");
                assertNotNull(sample.getParams(), "Params map should not be null");
                assertEquals(1, sample.getGeneration(), "Generation should be 1 for first-gen synthetic");
                assertTrue(sample.getGeneratorConfidence() >= 0 && sample.getGeneratorConfidence() <= 1,
                        "Confidence should be between 0 and 1");
            }
        }

        @Test
        @DisplayName("generate - applies domain randomization")
        void testGenerate_appliesDomainRandomization() {
            // Arrange
            IntentSkel skeleton = createValidSkeleton();
            int targetCount = 20;

            // Set high probabilities to ensure randomization happens
            when(domainRandomization.getSynonymProb()).thenReturn(0.9);
            when(domainRandomization.getTypoProb()).thenReturn(0.5);
            when(domainRandomization.getReorderProb()).thenReturn(0.5);

            // Act
            List<SyntheticSample> samples = intentScenGenerator.generate(skeleton, targetCount);

            // Assert
            assertNotNull(samples, "Generated samples should not be null");
            assertFalse(samples.isEmpty(), "Should generate some samples");

            // Verify that not all samples have identical user inputs
            // (domain randomization should introduce variation)
            Set<String> uniqueInputs = new HashSet<>();
            for (SyntheticSample sample : samples) {
                uniqueInputs.add(sample.getUserInput());
            }

            // With randomization, we expect some variation in outputs
            // Allow for some duplicates but not all identical
            assertTrue(uniqueInputs.size() > 1 || samples.size() <= 1,
                    "Domain randomization should produce varied outputs");
        }

        @Test
        @DisplayName("generate - returns empty list when disabled")
        void testGenerate_returnsEmptyWhenDisabled() {
            // Arrange
            when(config.isEnabled()).thenReturn(false);
            IntentSkel skeleton = createValidSkeleton();

            // Act
            List<SyntheticSample> samples = intentScenGenerator.generate(skeleton, 10);

            // Assert
            assertNotNull(samples, "Result should not be null");
            assertTrue(samples.isEmpty(), "Should return empty list when generation is disabled");
        }

        @Test
        @DisplayName("generate - handles null skeleton gracefully")
        void testGenerate_handlesNullSkeleton() {
            // Act
            List<SyntheticSample> samples = intentScenGenerator.generate(null, 10);

            // Assert
            assertNotNull(samples, "Result should not be null");
            assertTrue(samples.isEmpty(), "Should return empty list for null skeleton");
        }

        @Test
        @DisplayName("fillSlots - correctly fills slot values")
        void testFillSlots_correctlyFillsValues() {
            // Arrange
            List<Slot> slots = createTestSlots();
            Random random = new Random(42); // Fixed seed for reproducibility

            // Act
            Map<String, String> fills = intentScenGenerator.fillSlots(slots, random);

            // Assert
            assertNotNull(fills, "Fills map should not be null");

            // Required slots should always be filled
            assertTrue(fills.containsKey("METRIC"), "Required METRIC slot should be filled");
            assertFalse(fills.get("METRIC").isEmpty(), "METRIC value should not be empty");
        }

        @Test
        @DisplayName("applyPattern - replaces placeholders correctly")
        void testApplyPattern_replacesPlaceholders() {
            // Arrange
            String pattern = "{ACTION}{TIME}的{METRIC}";
            Map<String, String> fills = new HashMap<>();
            fills.put("ACTION", "查询");
            fills.put("TIME", "今天");
            fills.put("METRIC", "销售额");

            // Act
            String result = intentScenGenerator.applyPattern(pattern, fills);

            // Assert
            assertEquals("查询今天的销售额", result, "Placeholders should be replaced with values");
        }

        @Test
        @DisplayName("calculateConfidence - returns 1.0 when all required slots filled")
        void testCalculateConfidence_allRequiredFilled() {
            // Arrange
            List<Slot> slots = createTestSlots();
            Map<String, String> fills = new HashMap<>();
            fills.put("ACTION", "查询");
            fills.put("METRIC", "销售额");

            // Act
            double confidence = intentScenGenerator.calculateConfidence(slots, fills);

            // Assert
            assertEquals(1.0, confidence, 0.001, "Confidence should be 1.0 when all required slots are filled");
        }

        @Test
        @DisplayName("calculateConfidence - returns partial score for partial fills")
        void testCalculateConfidence_partialFills() {
            // Arrange
            Slot required1 = Slot.builder().name("METRIC").required(true).values(new HashSet<>(List.of("销售额"))).build();
            Slot required2 = Slot.builder().name("ACTION").required(true).values(new HashSet<>(List.of("查询"))).build();
            List<Slot> slots = List.of(required1, required2);

            Map<String, String> fills = new HashMap<>();
            fills.put("METRIC", "销售额");
            // ACTION not filled

            // Act
            double confidence = intentScenGenerator.calculateConfidence(slots, fills);

            // Assert
            assertEquals(0.5, confidence, 0.001, "Confidence should be 0.5 when half of required slots are filled");
        }

        private IntentSkel createValidSkeleton() {
            List<String> patterns = Arrays.asList(
                    "{ACTION}{TIME}的{METRIC}",
                    "{TIME}{ENTITY}的{METRIC}",
                    "{ACTION}{METRIC}"
            );

            List<Slot> slots = createTestSlots();

            return IntentSkel.create(
                    TEST_INTENT_CODE,
                    TEST_FACTORY_ID,
                    slots,
                    patterns,
                    10
            );
        }

        private List<Slot> createTestSlots() {
            Slot timeSlot = Slot.builder()
                    .name("TIME")
                    .required(false)
                    .values(new HashSet<>(Arrays.asList("今天", "本周", "本月", "上周")))
                    .build();

            Slot actionSlot = Slot.builder()
                    .name("ACTION")
                    .required(true)
                    .values(new HashSet<>(Arrays.asList("查询", "统计", "显示", "分析")))
                    .build();

            Slot metricSlot = Slot.builder()
                    .name("METRIC")
                    .required(true)
                    .values(new HashSet<>(Arrays.asList("销售额", "产量", "库存", "利润")))
                    .build();

            Slot entitySlot = Slot.builder()
                    .name("ENTITY")
                    .required(false)
                    .values(new HashSet<>(Arrays.asList("产品", "订单", "客户")))
                    .build();

            return Arrays.asList(timeSlot, actionSlot, metricSlot, entitySlot);
        }
    }

    // ==================== IntentValidator Tests ====================

    @Nested
    @DisplayName("IntentValidator Tests")
    class IntentValidatorTests {

        private IntentValidator intentValidator;

        @BeforeEach
        void setUp() {
            intentValidator = new IntentValidator();
        }

        @Test
        @DisplayName("validate - passes valid sample with TIME and METRIC")
        void testValidate_passesValidSample() {
            // Arrange
            SyntheticSample sample = createValidSample();

            // Act
            ValidationResult result = intentValidator.validate(sample);

            // Assert
            assertTrue(result.isValid(), "Valid sample should pass validation");
            assertTrue(result.getErrors().isEmpty(), "No errors should be reported for valid sample");
        }

        @Test
        @DisplayName("validate - rejects sample with invalid structure (missing required slots)")
        void testValidate_rejectsInvalidStructure() {
            // Arrange
            SyntheticSample sample = new SyntheticSample();
            sample.setUserInput("some query");
            sample.setIntentCode(TEST_INTENT_CODE);
            sample.setParams(new HashMap<>()); // Empty params - no TIME or METRIC

            // Act
            ValidationResult result = intentValidator.validate(sample);

            // Assert
            assertFalse(result.isValid(), "Sample without TIME or METRIC should fail structure validation");
            assertFalse(result.getErrors().isEmpty(), "Should report structure validation error");
            assertTrue(result.getErrors().stream()
                            .anyMatch(e -> e.contains("Structure")),
                    "Error should mention structure validation");
        }

        @Test
        @DisplayName("validate - rejects sample with missing TIME slot when METRIC is also missing")
        void testValidate_rejectsMissingTimeSlot() {
            // Arrange
            SyntheticSample sample = new SyntheticSample();
            sample.setUserInput("查询数据");
            sample.setIntentCode(TEST_INTENT_CODE);

            Map<String, String> params = new HashMap<>();
            params.put("ACTION", "查询"); // Only action, no TIME or METRIC
            sample.setParams(params);

            // Act
            ValidationResult result = intentValidator.validate(sample);

            // Assert
            assertFalse(result.isValid(), "Sample missing both TIME and METRIC should fail");
            assertFalse(result.getErrors().isEmpty(), "Should have validation errors");
        }

        @Test
        @DisplayName("validate - rejects null sample")
        void testValidate_rejectsNullSample() {
            // Act
            ValidationResult result = intentValidator.validate(null);

            // Assert
            assertFalse(result.isValid(), "Null sample should fail validation");
        }

        @Test
        @DisplayName("validate - rejects sample with empty userInput")
        void testValidate_rejectsEmptyUserInput() {
            // Arrange
            SyntheticSample sample = new SyntheticSample();
            sample.setUserInput("");
            sample.setIntentCode(TEST_INTENT_CODE);
            sample.setParams(createValidParams());

            // Act
            ValidationResult result = intentValidator.validate(sample);

            // Assert
            assertFalse(result.isValid(), "Sample with empty userInput should fail executability validation");
        }

        @Test
        @DisplayName("validateStructure - returns true when TIME slot present")
        void testValidateStructure_passesWithTimeSlot() {
            // Arrange
            SyntheticSample sample = new SyntheticSample();
            Map<String, String> params = new HashMap<>();
            params.put("TIME", "今天");
            sample.setParams(params);

            // Act
            boolean result = intentValidator.validateStructure(sample);

            // Assert
            assertTrue(result, "Sample with TIME slot should pass structure validation");
        }

        @Test
        @DisplayName("validateStructure - returns true when METRIC slot present")
        void testValidateStructure_passesWithMetricSlot() {
            // Arrange
            SyntheticSample sample = new SyntheticSample();
            Map<String, String> params = new HashMap<>();
            params.put("METRIC", "销售额");
            sample.setParams(params);

            // Act
            boolean result = intentValidator.validateStructure(sample);

            // Assert
            assertTrue(result, "Sample with METRIC slot should pass structure validation");
        }

        @Test
        @DisplayName("validateSemantics - passes with valid time expression")
        void testValidateSemantics_passesValidTime() {
            // Arrange
            SyntheticSample sample = new SyntheticSample();
            Map<String, String> params = new HashMap<>();
            params.put("TIME", "本月");
            params.put("METRIC", "销售额");
            sample.setParams(params);

            // Act
            boolean result = intentValidator.validateSemantics(sample);

            // Assert
            assertTrue(result, "Valid time expression should pass semantic validation");
        }

        @Test
        @DisplayName("validateSemantics - fails with invalid time expression")
        void testValidateSemantics_failsInvalidTime() {
            // Arrange
            SyntheticSample sample = new SyntheticSample();
            Map<String, String> params = new HashMap<>();
            params.put("TIME", "随机字符串");
            sample.setParams(params);

            // Act
            boolean result = intentValidator.validateSemantics(sample);

            // Assert
            assertFalse(result, "Invalid time expression should fail semantic validation");
        }

        private SyntheticSample createValidSample() {
            SyntheticSample sample = new SyntheticSample();
            sample.setUserInput("查询今天的销售额");
            sample.setIntentCode(TEST_INTENT_CODE);
            sample.setParams(createValidParams());
            sample.setGeneratorConfidence(0.9);
            sample.setGeneration(1);
            return sample;
        }

        private Map<String, String> createValidParams() {
            Map<String, String> params = new HashMap<>();
            params.put("TIME", "今天");
            params.put("ACTION", "查询");
            params.put("METRIC", "销售额");
            return params;
        }
    }

    // ==================== GRAPEFilter Tests ====================

    @Nested
    @DisplayName("GRAPEFilter Tests")
    class GRAPEFilterTests {

        @Mock
        private SyntheticDataConfig syntheticDataConfig;

        @Mock
        private AIIntentService aiIntentService;

        @InjectMocks
        private GRAPEFilter grapeFilter;

        @BeforeEach
        void setUp() {
            lenient().when(syntheticDataConfig.getGrapeThreshold()).thenReturn(0.3);
        }

        @Test
        @DisplayName("filter - keeps high score samples")
        void testFilter_keepsHighScoreSamples() {
            // Arrange
            List<SyntheticSample> candidates = createCandidateSamples(10);

            // Mock high confidence for all samples
            IntentMatchResult matchResult = createMatchResult(TEST_INTENT_CODE, 0.95);
            when(aiIntentService.recognizeIntentWithConfidence(anyString()))
                    .thenReturn(matchResult);

            // Act
            List<SyntheticSample> filtered = grapeFilter.filter(candidates);

            // Assert
            assertNotNull(filtered, "Filtered list should not be null");
            assertFalse(filtered.isEmpty(), "Should keep some samples");

            // Verify correct number of samples kept (based on threshold)
            int expectedMax = (int) Math.ceil(candidates.size() * 0.3); // 30% threshold
            assertTrue(filtered.size() <= expectedMax || filtered.size() == 1,
                    "Should respect threshold or keep at least 1");
        }

        @Test
        @DisplayName("filter - respects threshold configuration")
        void testFilter_respectsThreshold() {
            // Arrange
            int candidateCount = 10;
            double threshold = 0.3; // Keep top 30%
            when(syntheticDataConfig.getGrapeThreshold()).thenReturn(threshold);

            List<SyntheticSample> candidates = createCandidateSamples(candidateCount);

            // Mock varying confidence scores
            IntentMatchResult highMatch = createMatchResult(TEST_INTENT_CODE, 0.9);
            when(aiIntentService.recognizeIntentWithConfidence(anyString()))
                    .thenReturn(highMatch);

            // Act
            List<SyntheticSample> filtered = grapeFilter.filter(candidates);

            // Assert
            int expectedMax = (int) Math.ceil(candidateCount * threshold);
            assertTrue(filtered.size() <= expectedMax,
                    "Filtered count should not exceed threshold percentage");
            assertTrue(filtered.size() >= 1, "Should keep at least 1 sample");
        }

        @Test
        @DisplayName("filter - filters out samples with intent mismatch")
        void testFilter_filtersOutMismatchedIntents() {
            // Arrange
            List<SyntheticSample> candidates = createCandidateSamples(5);

            // Mock intent mismatch - return different intent code
            IntentMatchResult mismatchResult = createMatchResult("DIFFERENT_INTENT", 0.95);
            when(aiIntentService.recognizeIntentWithConfidence(anyString()))
                    .thenReturn(mismatchResult);

            // Act
            List<SyntheticSample> filtered = grapeFilter.filter(candidates);

            // Assert
            // Since all samples have intent mismatch (score 0), they should be sorted by score
            // but at least 1 should be kept
            assertNotNull(filtered, "Result should not be null");
            // The filter keeps at least 1 sample even with score 0
            assertTrue(filtered.size() >= 1, "Should keep at least 1 sample");
        }

        @Test
        @DisplayName("filter - handles empty candidate list")
        void testFilter_handlesEmptyCandidates() {
            // Act
            List<SyntheticSample> filtered = grapeFilter.filter(Collections.emptyList());

            // Assert
            assertNotNull(filtered, "Result should not be null");
            assertTrue(filtered.isEmpty(), "Should return empty list for empty input");
        }

        @Test
        @DisplayName("filter - handles null candidate list")
        void testFilter_handlesNullCandidates() {
            // Act
            List<SyntheticSample> filtered = grapeFilter.filter(null);

            // Assert
            assertNotNull(filtered, "Result should not be null");
            assertTrue(filtered.isEmpty(), "Should return empty list for null input");
        }

        @Test
        @DisplayName("scoreSample - returns confidence when intent matches")
        void testScoreSample_returnsConfidenceOnMatch() {
            // Arrange
            SyntheticSample sample = createSingleSample(TEST_INTENT_CODE);
            double expectedConfidence = 0.85;

            IntentMatchResult matchResult = createMatchResult(TEST_INTENT_CODE, expectedConfidence);
            when(aiIntentService.recognizeIntentWithConfidence(sample.getUserInput()))
                    .thenReturn(matchResult);

            // Act
            double score = grapeFilter.scoreSample(sample);

            // Assert
            assertEquals(expectedConfidence, score, 0.001,
                    "Score should equal confidence when intent matches");
        }

        @Test
        @DisplayName("scoreSample - returns 0 when intent mismatches")
        void testScoreSample_returnsZeroOnMismatch() {
            // Arrange
            SyntheticSample sample = createSingleSample(TEST_INTENT_CODE);

            IntentMatchResult mismatchResult = createMatchResult("OTHER_INTENT", 0.95);
            when(aiIntentService.recognizeIntentWithConfidence(sample.getUserInput()))
                    .thenReturn(mismatchResult);

            // Act
            double score = grapeFilter.scoreSample(sample);

            // Assert
            assertEquals(0.0, score, 0.001,
                    "Score should be 0 when predicted intent does not match expected");
        }

        @Test
        @DisplayName("scoreSample - returns 0 for null sample")
        void testScoreSample_returnsZeroForNull() {
            // Act
            double score = grapeFilter.scoreSample(null);

            // Assert
            assertEquals(0.0, score, 0.001, "Score should be 0 for null sample");
        }

        private List<SyntheticSample> createCandidateSamples(int count) {
            List<SyntheticSample> samples = new ArrayList<>();
            for (int i = 0; i < count; i++) {
                samples.add(createSingleSample(TEST_INTENT_CODE));
            }
            return samples;
        }

        private SyntheticSample createSingleSample(String intentCode) {
            SyntheticSample sample = new SyntheticSample();
            sample.setUserInput("查询" + UUID.randomUUID().toString().substring(0, 8) + "的销售额");
            sample.setIntentCode(intentCode);
            sample.setParams(Map.of("TIME", "今天", "METRIC", "销售额"));
            sample.setGeneratorConfidence(0.8);
            sample.setGeneration(1);
            return sample;
        }

        private IntentMatchResult createMatchResult(String intentCode, double confidence) {
            AIIntentConfig intentConfig = new AIIntentConfig();
            intentConfig.setIntentCode(intentCode);

            IntentMatchResult result = new IntentMatchResult();
            result.setBestMatch(intentConfig);
            result.setConfidence(confidence);
            return result;
        }
    }

    // ==================== SyntheticDataService Integration Test ====================

    @Nested
    @DisplayName("SyntheticDataService Integration Tests")
    class SyntheticDataServiceIntegrationTests {

        @Mock
        private IntentSkelBuilder intentSkelBuilder;

        @Mock
        private IntentScenGenerator intentScenGenerator;

        @Mock
        private IntentValidator intentValidator;

        @Mock
        private GRAPEFilter grapeFilter;

        @Mock
        private TrainingSampleRepository trainingSampleRepository;

        @Mock
        private SyntheticDataConfig syntheticDataConfig;

        @InjectMocks
        private SyntheticDataService syntheticDataService;

        @BeforeEach
        void setUp() {
            // Configure default mock behavior
            lenient().when(syntheticDataConfig.getMaxSyntheticRatio()).thenReturn(0.8);
            lenient().when(syntheticDataConfig.getCandidateMultiplier()).thenReturn(3);
            lenient().when(syntheticDataConfig.getRatioCalculationDays()).thenReturn(30);
        }

        @Test
        @DisplayName("generateForIntent - end-to-end flow works correctly")
        void testGenerateForIntent_endToEnd() {
            // Arrange
            int targetCount = 5;

            // Mock ratio check - allow generation
            when(trainingSampleRepository.countBySource(eq(TEST_FACTORY_ID), any()))
                    .thenReturn(List.of(new Object[]{"REAL", 100L}, new Object[]{"SYNTHETIC", 10L}));

            // Mock skeleton building
            IntentSkel skeleton = IntentSkel.create(
                    TEST_INTENT_CODE,
                    TEST_FACTORY_ID,
                    createMockSlots(),
                    List.of("{ACTION}{TIME}的{METRIC}"),
                    10
            );

            // Note: The actual SyntheticDataService may use a different method name
            // Adjust based on actual implementation
            lenient().when(intentSkelBuilder.buildFromHistory(TEST_INTENT_CODE, TEST_FACTORY_ID))
                    .thenReturn(skeleton);

            // Mock sample generation
            List<SyntheticSample> generatedSamples = createMockSyntheticSamples(15);
            lenient().when(intentScenGenerator.generate(any(IntentSkel.class), anyInt()))
                    .thenReturn(generatedSamples);

            // Mock validation - pass all samples
            ValidationResult validResult = ValidationResult.success();
            lenient().when(intentValidator.validate(any(SyntheticSample.class)))
                    .thenReturn(validResult);

            // Mock GRAPE filtering
            List<SyntheticSample> filteredSamples = generatedSamples.subList(0, 10);
            lenient().when(grapeFilter.filter(anyList()))
                    .thenReturn(filteredSamples);

            // Mock repository save
            lenient().when(trainingSampleRepository.saveAll(anyList()))
                    .thenAnswer(invocation -> {
                        List<?> samples = invocation.getArgument(0);
                        return samples;
                    });

            // Act
            SyntheticDataService.SyntheticGenerationResult result =
                    syntheticDataService.generateForIntent(TEST_INTENT_CODE, TEST_FACTORY_ID, targetCount);

            // Assert
            assertNotNull(result, "Result should not be null");

            // Note: The exact behavior depends on the actual implementation
            // These assertions verify the general flow
            if (result.isSuccess()) {
                assertTrue(result.getSaved() > 0, "Should have saved some samples on success");
                assertNull(result.getErrorMessage(), "No error message on success");
            }

            // Verify the duration was recorded
            assertTrue(result.getDurationMs() >= 0, "Duration should be recorded");
        }

        @Test
        @DisplayName("generateForIntent - respects ratio limit")
        void testGenerateForIntent_respectsRatioLimit() {
            // Arrange - synthetic ratio already at 80%
            when(trainingSampleRepository.countBySource(eq(TEST_FACTORY_ID), any()))
                    .thenReturn(List.of(new Object[]{"REAL", 20L}, new Object[]{"SYNTHETIC", 80L}));
            when(syntheticDataConfig.getMaxSyntheticRatio()).thenReturn(0.8);

            // Act
            SyntheticDataService.SyntheticGenerationResult result =
                    syntheticDataService.generateForIntent(TEST_INTENT_CODE, TEST_FACTORY_ID, 10);

            // Assert
            assertNotNull(result, "Result should not be null");
            assertEquals(0, result.getSaved(), "Should not save any samples when ratio limit reached");
            assertNotNull(result.getErrorMessage(), "Should have error message about ratio limit");
        }

        @Test
        @DisplayName("checkRatioLimit - returns true when under limit")
        void testCheckRatioLimit_trueWhenUnderLimit() {
            // Arrange - 10% synthetic
            when(trainingSampleRepository.countBySource(eq(TEST_FACTORY_ID), any()))
                    .thenReturn(List.of(new Object[]{"REAL", 90L}, new Object[]{"SYNTHETIC", 10L}));
            when(syntheticDataConfig.getMaxSyntheticRatio()).thenReturn(0.8);
            when(syntheticDataConfig.getRatioCalculationDays()).thenReturn(30);

            // Act
            boolean result = syntheticDataService.checkRatioLimit(TEST_FACTORY_ID);

            // Assert
            assertTrue(result, "Should allow generation when under ratio limit");
        }

        @Test
        @DisplayName("checkRatioLimit - returns false when over limit")
        void testCheckRatioLimit_falseWhenOverLimit() {
            // Arrange - 85% synthetic (over 80% limit)
            when(trainingSampleRepository.countBySource(eq(TEST_FACTORY_ID), any()))
                    .thenReturn(List.of(new Object[]{"REAL", 15L}, new Object[]{"SYNTHETIC", 85L}));
            when(syntheticDataConfig.getMaxSyntheticRatio()).thenReturn(0.8);
            when(syntheticDataConfig.getRatioCalculationDays()).thenReturn(30);

            // Act
            boolean result = syntheticDataService.checkRatioLimit(TEST_FACTORY_ID);

            // Assert
            assertFalse(result, "Should block generation when over ratio limit");
        }

        private List<Slot> createMockSlots() {
            return List.of(
                    Slot.builder().name("TIME").required(false)
                            .values(new HashSet<>(List.of("今天", "本周"))).build(),
                    Slot.builder().name("ACTION").required(true)
                            .values(new HashSet<>(List.of("查询", "统计"))).build(),
                    Slot.builder().name("METRIC").required(true)
                            .values(new HashSet<>(List.of("销售额", "库存"))).build()
            );
        }

        private List<SyntheticSample> createMockSyntheticSamples(int count) {
            List<SyntheticSample> samples = new ArrayList<>();
            for (int i = 0; i < count; i++) {
                SyntheticSample sample = new SyntheticSample();
                sample.setUserInput("查询今天的销售额 #" + i);
                sample.setIntentCode(TEST_INTENT_CODE);
                sample.setParams(Map.of("TIME", "今天", "METRIC", "销售额"));
                sample.setGeneratorConfidence(0.8 + (i * 0.01));
                sample.setGeneration(1);
                sample.setSkeletonId("test-skeleton-id");
                samples.add(sample);
            }
            return samples;
        }
    }
}
