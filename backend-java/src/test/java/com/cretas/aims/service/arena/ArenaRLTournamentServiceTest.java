package com.cretas.aims.service.arena;

import com.alibaba.dashscope.aigc.generation.Generation;
import com.alibaba.dashscope.aigc.generation.GenerationOutput;
import com.alibaba.dashscope.aigc.generation.GenerationResult;
import com.alibaba.dashscope.common.Message;
import com.cretas.aims.config.ArenaRLConfig;
import com.cretas.aims.dto.arena.ComparisonRubric;
import com.cretas.aims.dto.arena.MatchResult;
import com.cretas.aims.dto.arena.TournamentResult;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.service.arena.impl.ArenaRLTournamentServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * ArenaRL 锦标赛服务单元测试
 *
 * 测试场景:
 * 1. 意图识别锦标赛
 * 2. 工具选择锦标赛
 * 3. 触发条件检查
 * 4. 边界情况处理
 *
 * @author Cretas Team
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ArenaRLTournamentService 单元测试")
class ArenaRLTournamentServiceTest {

    @Mock
    private ArenaRLConfig config;

    @Mock
    private Generation generation;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ArenaRLTournamentServiceImpl tournamentService;

    private static final String TEST_USER_INPUT = "查询今天的生产批次状态";

    @BeforeEach
    void setUp() {
        // 设置默认配置
        ArenaRLConfig.IntentDisambiguationConfig intentConfig = new ArenaRLConfig.IntentDisambiguationConfig();
        intentConfig.setEnabled(true);
        intentConfig.setAmbiguityThreshold(0.15);
        intentConfig.setMinTriggerConfidence(0.85);
        intentConfig.setMaxCandidates(4);

        ArenaRLConfig.ToolSelectionConfig toolConfig = new ArenaRLConfig.ToolSelectionConfig();
        toolConfig.setEnabled(true);
        toolConfig.setAmbiguityThreshold(0.10);
        toolConfig.setMinTriggerSimilarity(0.80);
        toolConfig.setMaxCandidates(4);

        ArenaRLConfig.LlmConfig llmConfig = new ArenaRLConfig.LlmConfig();
        llmConfig.setBidirectionalComparison(false); // 简化测试
        llmConfig.setComparisonTimeoutMs(5000);
        llmConfig.setTemperature(0.3);
        llmConfig.setMaxResponseTokens(500);

        ArenaRLConfig.PerformanceConfig perfConfig = new ArenaRLConfig.PerformanceConfig();
        perfConfig.setTotalTimeoutMs(15000);
        perfConfig.setMaxLlmCalls(10);
        perfConfig.setCacheEnabled(false);

        when(config.isIntentDisambiguationEnabled()).thenReturn(true);
        when(config.isToolSelectionEnabled()).thenReturn(true);
        when(config.getIntentDisambiguation()).thenReturn(intentConfig);
        when(config.getToolSelection()).thenReturn(toolConfig);
        when(config.getLlmConfig()).thenReturn(llmConfig);
        when(config.getPerformanceConfig()).thenReturn(perfConfig);
        when(config.getIntentMaxCandidates()).thenReturn(4);
        when(config.getToolMaxCandidates()).thenReturn(4);
    }

    // ==================== 触发条件测试 ====================

    @Test
    @DisplayName("shouldTriggerIntentTournament - 歧义候选应触发锦标赛")
    void shouldTriggerIntentTournament_AmbiguousCandidates_ShouldTrigger() {
        // Given: top1=0.72, top2=0.68, 差距=0.04 < 0.15
        List<IntentMatchResult.CandidateIntent> candidates = Arrays.asList(
                createCandidate("INTENT_A", 0.72),
                createCandidate("INTENT_B", 0.68),
                createCandidate("INTENT_C", 0.60)
        );

        when(config.shouldTriggerIntentTournament(0.72, 0.68)).thenReturn(true);

        // When
        boolean result = tournamentService.shouldTriggerIntentTournament(candidates);

        // Then
        assertTrue(result, "歧义候选应触发锦标赛");
    }

    @Test
    @DisplayName("shouldTriggerIntentTournament - 高置信度不应触发锦标赛")
    void shouldTriggerIntentTournament_HighConfidence_ShouldNotTrigger() {
        // Given: top1=0.92, top2=0.65, top1 > 0.85
        List<IntentMatchResult.CandidateIntent> candidates = Arrays.asList(
                createCandidate("INTENT_A", 0.92),
                createCandidate("INTENT_B", 0.65)
        );

        when(config.shouldTriggerIntentTournament(0.92, 0.65)).thenReturn(false);

        // When
        boolean result = tournamentService.shouldTriggerIntentTournament(candidates);

        // Then
        assertFalse(result, "高置信度不应触发锦标赛");
    }

    @Test
    @DisplayName("shouldTriggerIntentTournament - 差距足够大不应触发锦标赛")
    void shouldTriggerIntentTournament_LargeGap_ShouldNotTrigger() {
        // Given: top1=0.75, top2=0.50, 差距=0.25 > 0.15
        List<IntentMatchResult.CandidateIntent> candidates = Arrays.asList(
                createCandidate("INTENT_A", 0.75),
                createCandidate("INTENT_B", 0.50)
        );

        when(config.shouldTriggerIntentTournament(0.75, 0.50)).thenReturn(false);

        // When
        boolean result = tournamentService.shouldTriggerIntentTournament(candidates);

        // Then
        assertFalse(result, "差距足够大不应触发锦标赛");
    }

    @Test
    @DisplayName("shouldTriggerIntentTournament - 单个候选不应触发锦标赛")
    void shouldTriggerIntentTournament_SingleCandidate_ShouldNotTrigger() {
        // Given: 只有一个候选
        List<IntentMatchResult.CandidateIntent> candidates = Collections.singletonList(
                createCandidate("INTENT_A", 0.72)
        );

        // When
        boolean result = tournamentService.shouldTriggerIntentTournament(candidates);

        // Then
        assertFalse(result, "单个候选不应触发锦标赛");
    }

    @Test
    @DisplayName("shouldTriggerIntentTournament - 空列表不应触发锦标赛")
    void shouldTriggerIntentTournament_EmptyList_ShouldNotTrigger() {
        // When
        boolean result = tournamentService.shouldTriggerIntentTournament(Collections.emptyList());

        // Then
        assertFalse(result, "空列表不应触发锦标赛");
    }

    @Test
    @DisplayName("shouldTriggerIntentTournament - null不应触发锦标赛")
    void shouldTriggerIntentTournament_Null_ShouldNotTrigger() {
        // When
        boolean result = tournamentService.shouldTriggerIntentTournament(null);

        // Then
        assertFalse(result, "null不应触发锦标赛");
    }

    // ==================== 工具选择触发条件测试 ====================

    @Test
    @DisplayName("shouldTriggerToolTournament - 歧义工具应触发锦标赛")
    void shouldTriggerToolTournament_AmbiguousTools_ShouldTrigger() {
        // Given: top1=0.75, top2=0.72, 差距=0.03 < 0.10
        List<ArenaRLTournamentService.ToolCandidate> candidates = Arrays.asList(
                createToolCandidate("tool_a", 0.75),
                createToolCandidate("tool_b", 0.72)
        );

        when(config.shouldTriggerToolTournament(0.75, 0.72)).thenReturn(true);

        // When
        boolean result = tournamentService.shouldTriggerToolTournament(candidates);

        // Then
        assertTrue(result, "歧义工具应触发锦标赛");
    }

    // ==================== ComparisonRubric 测试 ====================

    @Test
    @DisplayName("intentDisambiguationRubric - 应包含正确的维度")
    void intentDisambiguationRubric_ShouldHaveCorrectDimensions() {
        // When
        ComparisonRubric rubric = ComparisonRubric.intentDisambiguationRubric();

        // Then
        assertNotNull(rubric, "量规不应为null");
        assertEquals("Intent Disambiguation Rubric", rubric.getName());
        assertNotNull(rubric.getDimensions());
        assertEquals(5, rubric.getDimensions().size(), "应有5个评估维度");

        // 验证维度ID
        List<String> dimensionIds = rubric.getDimensions().stream()
                .map(ComparisonRubric.Dimension::getId)
                .toList();
        assertTrue(dimensionIds.contains("semantic_alignment"));
        assertTrue(dimensionIds.contains("parameter_coverage"));
        assertTrue(dimensionIds.contains("domain_match"));
        assertTrue(dimensionIds.contains("action_type_match"));
        assertTrue(dimensionIds.contains("ambiguity_resolution"));

        // 验证权重总和接近1
        double totalWeight = rubric.getDimensions().stream()
                .mapToDouble(ComparisonRubric.Dimension::getWeight)
                .sum();
        assertEquals(1.0, totalWeight, 0.01, "权重总和应为1");
    }

    @Test
    @DisplayName("toolSelectionRubric - 应包含正确的维度")
    void toolSelectionRubric_ShouldHaveCorrectDimensions() {
        // When
        ComparisonRubric rubric = ComparisonRubric.toolSelectionRubric();

        // Then
        assertNotNull(rubric);
        assertEquals("Tool Selection Rubric", rubric.getName());
        assertEquals(4, rubric.getDimensions().size(), "应有4个评估维度");
    }

    @Test
    @DisplayName("agentAnalysisRubric - 应包含正确的维度")
    void agentAnalysisRubric_ShouldHaveCorrectDimensions() {
        // When
        ComparisonRubric rubric = ComparisonRubric.agentAnalysisRubric();

        // Then
        assertNotNull(rubric);
        assertEquals("Agent Analysis Rubric", rubric.getName());
        assertEquals(4, rubric.getDimensions().size(), "应有4个评估维度");
    }

    // ==================== TournamentResult 测试 ====================

    @Test
    @DisplayName("TournamentResult.failure - 应正确创建失败结果")
    void tournamentResultFailure_ShouldCreateCorrectly() {
        // When
        TournamentResult result = TournamentResult.failure(
                "test-id",
                TournamentResult.TournamentType.INTENT_DISAMBIGUATION,
                TEST_USER_INPUT,
                "Test error"
        );

        // Then
        assertNotNull(result);
        assertEquals("test-id", result.getTournamentId());
        assertEquals(TournamentResult.TournamentType.INTENT_DISAMBIGUATION, result.getType());
        assertEquals(TEST_USER_INPUT, result.getUserInput());
        assertFalse(result.getSuccess());
        assertEquals("Test error", result.getErrorMessage());
        assertEquals(0, result.getTotalComparisons());
    }

    // ==================== MatchResult 测试 ====================

    @Test
    @DisplayName("MatchResult.failure - 应正确创建失败结果")
    void matchResultFailure_ShouldCreateCorrectly() {
        // When
        MatchResult result = MatchResult.failure(
                "match-id", 1, 0,
                "A", "B", "Match error"
        );

        // Then
        assertNotNull(result);
        assertEquals("match-id", result.getMatchId());
        assertEquals(1, result.getRound());
        assertEquals(0, result.getMatchIndex());
        assertEquals("A", result.getCandidateAId());
        assertEquals("B", result.getCandidateBId());
        assertFalse(result.getSuccess());
        assertEquals("Match error", result.getErrorMessage());
    }

    @Test
    @DisplayName("MatchResult.isTie - 应正确判断平局")
    void matchResultIsTie_ShouldJudgeCorrectly() {
        // Given: winConfidence = 0.5 (平局)
        MatchResult tieResult = MatchResult.builder()
                .winConfidence(0.5)
                .build();

        // Given: winConfidence = 0.8 (非平局)
        MatchResult winResult = MatchResult.builder()
                .winConfidence(0.8)
                .build();

        // Then
        assertTrue(tieResult.isTie(), "0.5置信度应判定为平局");
        assertFalse(winResult.isTie(), "0.8置信度不应判定为平局");
    }

    // ==================== 辅助方法 ====================

    private IntentMatchResult.CandidateIntent createCandidate(String intentCode, double confidence) {
        return IntentMatchResult.CandidateIntent.builder()
                .intentCode(intentCode)
                .intentName(intentCode + "_name")
                .confidence(confidence)
                .description("Test intent: " + intentCode)
                .build();
    }

    private ArenaRLTournamentService.ToolCandidate createToolCandidate(String toolName, double similarity) {
        return ArenaRLTournamentService.ToolCandidate.builder()
                .id(toolName)
                .name(toolName)
                .description("Test tool: " + toolName)
                .score(similarity)
                .build();
    }
}
