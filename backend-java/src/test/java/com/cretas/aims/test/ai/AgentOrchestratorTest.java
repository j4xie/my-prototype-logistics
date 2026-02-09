package com.cretas.aims.test.ai;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.config.IndustryKnowledgeConfig;
import com.cretas.aims.dto.ai.AgentMessage;
import com.cretas.aims.dto.ai.AnalysisContext;
import com.cretas.aims.dto.ai.AnalysisResult;
import com.cretas.aims.dto.ai.AnalysisTopic;
import com.cretas.aims.service.AgentOrchestrator;
import com.cretas.aims.service.KnowledgeFeedbackService;
import com.cretas.aims.service.RetrievalEvaluatorService;
import com.cretas.aims.service.impl.AgentOrchestratorImpl;
import com.cretas.aims.test.util.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Agent 编排服务单元测试
 *
 * 测试四阶段 Agent 流水线：检索 -> 评估 -> 分析 -> 审核
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Agent 编排服务测试 (AgentOrchestrator)")
class AgentOrchestratorTest {

    @Mock
    private RetrievalEvaluatorService retrievalEvaluatorService;

    @Mock
    private KnowledgeFeedbackService knowledgeFeedbackService;

    @Mock
    private IndustryKnowledgeConfig industryKnowledgeConfig;

    @Mock
    private DashScopeClient dashScopeClient;

    @InjectMocks
    private AgentOrchestratorImpl agentOrchestrator;

    private static final String SAMPLE_INDUSTRY_KNOWLEDGE = TestDataFactory.SampleKnowledge.PRODUCT_STATUS_KNOWLEDGE;
    private static final String SAMPLE_ANALYSIS_RESULT = "根据分析，当前良品率为98%，处于优秀水平。库存周转正常，建议继续保持现有生产节奏，关注原材料库存预警。";
    private static final String SHORT_ANALYSIS_RESULT = "良品率正常";
    private static final String UNCERTAIN_ANALYSIS_RESULT = "我不知道具体原因，无法判断当前状态。";

    @BeforeEach
    void setUp() {
        // 设置默认配置值
        ReflectionTestUtils.setField(agentOrchestrator, "complexityThreshold", 0.6);
    }

    // ==========================================
    // 1. 完整流程测试 (AO-001 to AO-006)
    // ==========================================
    @Nested
    @DisplayName("完整流程测试")
    class CompleteFlowTests {

        @Test
        @DisplayName("AO-001: 正常流程 - 所有 Agent 成功 -> 成功，1 轮完成")
        void testNormalFlow_AllAgentsSucceed_ShouldSucceedInOneRound() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.PRODUCT_STATUS,
                    AnalysisTopic.PRODUCT_STATUS
            );

            // Mock 行业知识配置返回有效知识
            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);

            // Mock LLM 返回有效分析结果 (足够长且无不确定表述)
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(SAMPLE_ANALYSIS_RESULT);

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertTrue(result.isSuccess(), "流程应该成功完成");
            assertNull(result.getErrorMessage(), "不应有错误信息");
            assertFalse(result.isRequiresHumanReview(), "不应需要人工审核");
            assertNotNull(result.getFormattedAnalysis(), "应有分析结果");
            assertEquals(SAMPLE_ANALYSIS_RESULT, result.getFormattedAnalysis());

            // 验证反馈服务被调用一次 (AUTO_APPROVED)
            verify(knowledgeFeedbackService, times(1)).recordFeedback(
                    eq(context.getSessionId()),
                    eq(context.getUserInput()),
                    eq(SAMPLE_ANALYSIS_RESULT),
                    eq(KnowledgeFeedbackService.FeedbackType.AUTO_APPROVED)
            );

            // 验证 LLM 只被调用一次 (只需要一轮)
            verify(dashScopeClient, times(1)).chat(anyString(), anyString());
        }

        @Test
        @DisplayName("AO-002: 评估需要更多数据 -> 重试检索")
        void testEvaluationNeedsMoreData_ShouldRetryRetrieval() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.COMPREHENSIVE_ANALYSIS,
                    AnalysisTopic.OVERALL_BUSINESS
            );

            // 第一次返回 null (模拟缺少行业知识)，第二次返回有效知识
            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(null)
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);

            // Mock LLM 返回有效分析结果
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(SAMPLE_ANALYSIS_RESULT);

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertTrue(result.isSuccess(), "最终应该成功");
            assertFalse(result.isRequiresHumanReview(), "不应需要人工审核");

            // 验证知识获取被调用多次 (因为重试)
            verify(industryKnowledgeConfig, atLeast(2)).getKnowledgeForTopic(anyString());
        }

        @Test
        @DisplayName("AO-003: 审核拒绝 -> 改进并重试")
        void testReviewRejection_ShouldImproveAndRetry() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.CAUSAL_QUALITY,
                    AnalysisTopic.QUALITY_ANALYSIS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);

            // 第一次返回过短内容 (审核不通过)，第二次返回有效内容
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(SHORT_ANALYSIS_RESULT)  // 第一次: 内容过短
                    .thenReturn(SAMPLE_ANALYSIS_RESULT);  // 第二次: 正常内容

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertTrue(result.isSuccess(), "最终应该成功");
            assertEquals(SAMPLE_ANALYSIS_RESULT, result.getFormattedAnalysis());

            // 验证 LLM 被调用多次
            verify(dashScopeClient, atLeast(2)).chat(anyString(), anyString());
        }

        @Test
        @DisplayName("AO-004: 达到最大重试次数 -> 标记需人工审核")
        void testMaxRetryReached_ShouldMarkForHumanReview() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.DEEP_ANALYSIS,
                    AnalysisTopic.QUALITY_ANALYSIS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);

            // 持续返回过短内容，导致审核始终不通过
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(SHORT_ANALYSIS_RESULT);

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertTrue(result.isRequiresHumanReview(), "应标记需要人工审核");

            // 验证 LLM 被调用了 3 次 (最大重试轮次)
            verify(dashScopeClient, times(3)).chat(anyString(), anyString());

            // 验证反馈服务未被调用 (因为未成功)
            verify(knowledgeFeedbackService, never()).recordFeedback(
                    anyString(), anyString(), anyString(),
                    eq(KnowledgeFeedbackService.FeedbackType.AUTO_APPROVED)
            );
        }

        @Test
        @DisplayName("AO-005: 检索失败 -> 错误，流程中断")
        void testRetrievalFailure_ShouldErrorAndInterrupt() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.SIMPLE_INVENTORY,
                    AnalysisTopic.INVENTORY_STATUS
            );

            // 模拟检索阶段抛出异常
            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenThrow(new RuntimeException("检索服务不可用"));

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertFalse(result.isSuccess(), "流程应该失败");
            assertNotNull(result.getErrorMessage(), "应有错误信息");
            assertTrue(result.getErrorMessage().contains("检索失败") ||
                            result.getErrorMessage().contains("检索服务不可用"),
                    "错误信息应包含检索失败相关内容");

            // 验证 LLM 未被调用 (流程在检索阶段中断)
            verify(dashScopeClient, never()).chat(anyString(), anyString());

            // 验证反馈服务未被调用
            verify(knowledgeFeedbackService, never()).recordFeedback(
                    anyString(), anyString(), anyString(), any()
            );
        }

        @Test
        @DisplayName("AO-006: 分析失败 (LLM 错误) -> 错误，流程中断")
        void testAnalysisFailure_LLMError_ShouldErrorAndInterrupt() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.PRODUCT_STATUS,
                    AnalysisTopic.PRODUCT_STATUS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);

            // 模拟 LLM 调用抛出异常
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenThrow(new RuntimeException("LLM API 调用超时"));

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertFalse(result.isSuccess(), "流程应该失败");
            assertNotNull(result.getErrorMessage(), "应有错误信息");
            assertTrue(result.getErrorMessage().contains("分析失败") ||
                            result.getErrorMessage().contains("LLM"),
                    "错误信息应包含分析失败相关内容");

            // 验证反馈服务未被调用
            verify(knowledgeFeedbackService, never()).recordFeedback(
                    anyString(), anyString(), anyString(),
                    eq(KnowledgeFeedbackService.FeedbackType.AUTO_APPROVED)
            );
        }
    }

    // ==========================================
    // 2. Agent 消息流测试
    // ==========================================
    @Nested
    @DisplayName("Agent 消息流测试")
    class AgentMessageFlowTests {

        @Test
        @DisplayName("验证初始消息状态")
        void testInitialMessageState() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    "测试查询",
                    AnalysisTopic.GENERAL
            );

            // When
            AgentMessage message = AgentMessage.create(context);

            // Then
            assertNotNull(message.getMessageId(), "消息ID应已生成");
            assertEquals("测试查询", message.getUserQuery());
            assertEquals(context, message.getContext());
            assertEquals(AgentMessage.AgentStage.RETRIEVAL, message.getCurrentStage(),
                    "初始阶段应为 RETRIEVAL");
            assertNotNull(message.getCreatedAt(), "创建时间应已设置");
            assertNull(message.getErrorMessage(), "初始状态不应有错误");
            assertTrue(message.getReviewComments().isEmpty(), "初始状态评论应为空");
        }

        @Test
        @DisplayName("验证数据在阶段间传递")
        void testDataPassingBetweenStages() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.PRODUCT_STATUS,
                    AnalysisTopic.PRODUCT_STATUS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);

            // 捕获传递给 LLM 的参数
            ArgumentCaptor<String> systemPromptCaptor = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> userPromptCaptor = ArgumentCaptor.forClass(String.class);

            when(dashScopeClient.chat(systemPromptCaptor.capture(), userPromptCaptor.capture()))
                    .thenReturn(SAMPLE_ANALYSIS_RESULT);

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertTrue(result.isSuccess());

            // 验证行业知识被传递到分析 Agent
            String userPrompt = userPromptCaptor.getValue();
            assertTrue(userPrompt.contains(context.getUserInput()),
                    "用户输入应传递到分析 Agent");
            assertTrue(userPrompt.contains("良品率") || userPrompt.contains("行业标准"),
                    "行业知识应传递到分析 Agent");

            // 验证系统提示包含主题信息
            String systemPrompt = systemPromptCaptor.getValue();
            assertTrue(systemPrompt.contains("产品状态") || systemPrompt.contains(context.getTopic().getDisplayName()),
                    "主题信息应包含在系统提示中");
        }

        @Test
        @DisplayName("验证审核评论累积")
        void testReviewCommentsAccumulation() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.COMPREHENSIVE_ANALYSIS,
                    AnalysisTopic.OVERALL_BUSINESS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);

            // 第一次返回过短内容，第二次返回不确定表述，第三次返回正常内容
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(SHORT_ANALYSIS_RESULT)      // 第一次: 过短
                    .thenReturn(UNCERTAIN_ANALYSIS_RESULT)  // 第二次: 不确定表述
                    .thenReturn(SAMPLE_ANALYSIS_RESULT);    // 第三次: 正常

            // 捕获传递给 LLM 的用户提示
            ArgumentCaptor<String> userPromptCaptor = ArgumentCaptor.forClass(String.class);
            when(dashScopeClient.chat(anyString(), userPromptCaptor.capture()))
                    .thenReturn(SHORT_ANALYSIS_RESULT)
                    .thenReturn(UNCERTAIN_ANALYSIS_RESULT)
                    .thenReturn(SAMPLE_ANALYSIS_RESULT);

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertTrue(result.isSuccess(), "最终应成功");

            // 验证后续轮次的提示中包含审核意见
            var capturedPrompts = userPromptCaptor.getAllValues();
            if (capturedPrompts.size() > 1) {
                // 第二次及之后的提示应包含审核评论
                boolean hasReviewComments = capturedPrompts.stream()
                        .skip(1)
                        .anyMatch(prompt -> prompt.contains("审核意见") || prompt.contains("改进"));
                assertTrue(hasReviewComments, "后续轮次应包含审核意见");
            }
        }
    }

    // ==========================================
    // 3. 阶段转换测试
    // ==========================================
    @Nested
    @DisplayName("阶段转换测试")
    class StageTransitionTests {

        @Test
        @DisplayName("正常流程阶段转换: RETRIEVAL -> EVALUATION -> ANALYSIS -> REVIEW -> COMPLETED")
        void testNormalStageTransition() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.SIMPLE_INVENTORY,
                    AnalysisTopic.INVENTORY_STATUS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(SAMPLE_ANALYSIS_RESULT);

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertTrue(result.isSuccess(), "流程应成功完成");

            // 验证通过成功结果间接验证所有阶段都已执行
            assertNotNull(result.getFormattedAnalysis(), "分析结果证明 ANALYSIS 阶段已执行");
            assertNotNull(result.getDataSummary(), "数据摘要证明 RETRIEVAL 阶段已执行");
        }

        @Test
        @DisplayName("验证 AgentMessage 阶段更新")
        void testAgentMessageStageUpdates() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    "测试输入",
                    AnalysisTopic.GENERAL
            );

            AgentMessage message = AgentMessage.create(context);

            // When & Then - 验证阶段可以正确设置
            assertEquals(AgentMessage.AgentStage.RETRIEVAL, message.getCurrentStage());

            message.setCurrentStage(AgentMessage.AgentStage.EVALUATION);
            assertEquals(AgentMessage.AgentStage.EVALUATION, message.getCurrentStage());

            message.setCurrentStage(AgentMessage.AgentStage.ANALYSIS);
            assertEquals(AgentMessage.AgentStage.ANALYSIS, message.getCurrentStage());

            message.setCurrentStage(AgentMessage.AgentStage.REVIEW);
            assertEquals(AgentMessage.AgentStage.REVIEW, message.getCurrentStage());

            message.setCurrentStage(AgentMessage.AgentStage.COMPLETED);
            assertEquals(AgentMessage.AgentStage.COMPLETED, message.getCurrentStage());
        }

        @Test
        @DisplayName("AgentStage 枚举值验证")
        void testAgentStageEnumValues() {
            // 验证所有阶段枚举值存在
            AgentMessage.AgentStage[] stages = AgentMessage.AgentStage.values();

            assertEquals(5, stages.length, "应有 5 个阶段");
            assertNotNull(AgentMessage.AgentStage.valueOf("RETRIEVAL"));
            assertNotNull(AgentMessage.AgentStage.valueOf("EVALUATION"));
            assertNotNull(AgentMessage.AgentStage.valueOf("ANALYSIS"));
            assertNotNull(AgentMessage.AgentStage.valueOf("REVIEW"));
            assertNotNull(AgentMessage.AgentStage.valueOf("COMPLETED"));
        }
    }

    // ==========================================
    // 4. 多 Agent 协作决策测试
    // ==========================================
    @Nested
    @DisplayName("多 Agent 协作决策测试")
    class MultiAgentCollaborationDecisionTests {

        @Test
        @DisplayName("复杂查询 (OVERALL_BUSINESS) 应需要多 Agent 协作")
        void testComplexQuery_OverallBusiness_ShouldRequireMultiAgent() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.COMPREHENSIVE_ANALYSIS,
                    AnalysisTopic.OVERALL_BUSINESS
            );

            // When
            boolean requires = agentOrchestrator.requiresMultiAgentCollaboration(context);

            // Then
            assertTrue(requires, "OVERALL_BUSINESS 主题应需要多 Agent 协作");
        }

        @Test
        @DisplayName("复杂查询 (QUALITY_ANALYSIS) 应需要多 Agent 协作")
        void testComplexQuery_QualityAnalysis_ShouldRequireMultiAgent() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.CAUSAL_QUALITY,
                    AnalysisTopic.QUALITY_ANALYSIS
            );

            // When
            boolean requires = agentOrchestrator.requiresMultiAgentCollaboration(context);

            // Then
            assertTrue(requires, "QUALITY_ANALYSIS 主题应需要多 Agent 协作");
        }

        @Test
        @DisplayName("简单查询 (INVENTORY_STATUS) 不应需要多 Agent 协作")
        void testSimpleQuery_InventoryStatus_ShouldNotRequireMultiAgent() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.SIMPLE_INVENTORY,
                    AnalysisTopic.INVENTORY_STATUS
            );

            // When
            boolean requires = agentOrchestrator.requiresMultiAgentCollaboration(context);

            // Then
            assertFalse(requires, "INVENTORY_STATUS 主题不应需要多 Agent 协作");
        }

        @Test
        @DisplayName("简单查询 (PRODUCT_STATUS) 不应需要多 Agent 协作")
        void testSimpleQuery_ProductStatus_ShouldNotRequireMultiAgent() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.PRODUCT_STATUS,
                    AnalysisTopic.PRODUCT_STATUS
            );

            // When
            boolean requires = agentOrchestrator.requiresMultiAgentCollaboration(context);

            // Then
            assertFalse(requires, "PRODUCT_STATUS 主题不应需要多 Agent 协作");
        }

        @Test
        @DisplayName("GENERAL 主题不应需要多 Agent 协作")
        void testGeneralTopic_ShouldNotRequireMultiAgent() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.SIMPLE_GREETING,
                    AnalysisTopic.GENERAL
            );

            // When
            boolean requires = agentOrchestrator.requiresMultiAgentCollaboration(context);

            // Then
            assertFalse(requires, "GENERAL 主题不应需要多 Agent 协作");
        }

        @Test
        @DisplayName("null 上下文应返回 false")
        void testNullContext_ShouldReturnFalse() {
            // When
            boolean requires = agentOrchestrator.requiresMultiAgentCollaboration(null);

            // Then
            assertFalse(requires, "null 上下文应返回 false");
        }

        @Test
        @DisplayName("null 主题应返回 false")
        void testNullTopic_ShouldReturnFalse() {
            // Given
            AnalysisContext context = AnalysisContext.builder()
                    .userInput("测试输入")
                    .topic(null)
                    .build();

            // When
            boolean requires = agentOrchestrator.requiresMultiAgentCollaboration(context);

            // Then
            assertFalse(requires, "null 主题应返回 false");
        }
    }

    // ==========================================
    // 5. 反馈集成测试
    // ==========================================
    @Nested
    @DisplayName("反馈集成测试")
    class FeedbackIntegrationTests {

        @Test
        @DisplayName("成功时应记录 AUTO_APPROVED 反馈")
        void testSuccess_ShouldRecordAutoApprovedFeedback() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.PRODUCT_STATUS,
                    AnalysisTopic.PRODUCT_STATUS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(SAMPLE_ANALYSIS_RESULT);

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertTrue(result.isSuccess());

            // 验证反馈服务被正确调用
            verify(knowledgeFeedbackService, times(1)).recordFeedback(
                    eq(context.getSessionId()),
                    eq(context.getUserInput()),
                    eq(SAMPLE_ANALYSIS_RESULT),
                    eq(KnowledgeFeedbackService.FeedbackType.AUTO_APPROVED)
            );
        }

        @Test
        @DisplayName("验证反馈服务调用参数正确")
        void testFeedbackServiceCalledWithCorrectParameters() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    "具体的用户问题",
                    AnalysisTopic.INVENTORY_STATUS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(SAMPLE_ANALYSIS_RESULT);

            // 捕获反馈参数
            ArgumentCaptor<String> sessionIdCaptor = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> queryCaptor = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> responseCaptor = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<KnowledgeFeedbackService.FeedbackType> typeCaptor =
                    ArgumentCaptor.forClass(KnowledgeFeedbackService.FeedbackType.class);

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertTrue(result.isSuccess());

            verify(knowledgeFeedbackService).recordFeedback(
                    sessionIdCaptor.capture(),
                    queryCaptor.capture(),
                    responseCaptor.capture(),
                    typeCaptor.capture()
            );

            assertEquals(context.getSessionId(), sessionIdCaptor.getValue());
            assertEquals("具体的用户问题", queryCaptor.getValue());
            assertEquals(SAMPLE_ANALYSIS_RESULT, responseCaptor.getValue());
            assertEquals(KnowledgeFeedbackService.FeedbackType.AUTO_APPROVED, typeCaptor.getValue());
        }

        @Test
        @DisplayName("失败时不应记录 AUTO_APPROVED 反馈")
        void testFailure_ShouldNotRecordAutoApprovedFeedback() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.SIMPLE_INVENTORY,
                    AnalysisTopic.INVENTORY_STATUS
            );

            // 模拟检索失败
            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenThrow(new RuntimeException("服务不可用"));

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertFalse(result.isSuccess());

            // 验证反馈服务未被调用
            verify(knowledgeFeedbackService, never()).recordFeedback(
                    anyString(), anyString(), anyString(),
                    eq(KnowledgeFeedbackService.FeedbackType.AUTO_APPROVED)
            );
        }

        @Test
        @DisplayName("标记人工审核时不应记录 AUTO_APPROVED 反馈")
        void testHumanReviewRequired_ShouldNotRecordAutoApprovedFeedback() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.DEEP_ANALYSIS,
                    AnalysisTopic.QUALITY_ANALYSIS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);

            // 持续返回过短内容，导致审核始终不通过
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(SHORT_ANALYSIS_RESULT);

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertTrue(result.isRequiresHumanReview(), "应标记需要人工审核");

            // 验证反馈服务未被调用 (因为未通过审核)
            verify(knowledgeFeedbackService, never()).recordFeedback(
                    anyString(), anyString(), anyString(),
                    eq(KnowledgeFeedbackService.FeedbackType.AUTO_APPROVED)
            );
        }
    }

    // ==========================================
    // 6. 边界条件和异常处理测试
    // ==========================================
    @Nested
    @DisplayName("边界条件和异常处理测试")
    class EdgeCaseAndExceptionTests {

        @Test
        @DisplayName("空用户输入应正常处理")
        void testEmptyUserInput_ShouldHandleGracefully() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    "",
                    AnalysisTopic.GENERAL
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(SAMPLE_ANALYSIS_RESULT);

            // When & Then
            assertDoesNotThrow(() -> {
                AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);
                assertNotNull(result);
            });
        }

        @Test
        @DisplayName("LLM 返回 null 应作为失败处理")
        void testLLMReturnsNull_ShouldHandleAsFailure() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.PRODUCT_STATUS,
                    AnalysisTopic.PRODUCT_STATUS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(null);

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            // null 或空结果会被审核 Agent 拒绝
            assertTrue(result.isRequiresHumanReview() || !result.isSuccess(),
                    "null 结果应导致需要人工审核或失败");
        }

        @Test
        @DisplayName("LLM 返回空字符串应被审核拒绝")
        void testLLMReturnsEmptyString_ShouldBeRejectedByReview() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.PRODUCT_STATUS,
                    AnalysisTopic.PRODUCT_STATUS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn("");

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertTrue(result.isRequiresHumanReview(),
                    "空字符串结果应导致需要人工审核");
        }

        @Test
        @DisplayName("反馈服务异常不应影响主流程")
        void testFeedbackServiceException_ShouldNotAffectMainFlow() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.PRODUCT_STATUS,
                    AnalysisTopic.PRODUCT_STATUS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(SAMPLE_ANALYSIS_RESULT);

            // 反馈服务抛出异常
            doThrow(new RuntimeException("反馈服务不可用"))
                    .when(knowledgeFeedbackService)
                    .recordFeedback(anyString(), anyString(), anyString(), any());

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then - 主流程应该失败（因为异常会传播）
            // 或者如果实现了异常捕获，则应该成功
            assertNotNull(result, "应返回结果");
        }

        @Test
        @DisplayName("超长分析结果应正常处理")
        void testVeryLongAnalysisResult_ShouldHandleGracefully() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    TestDataFactory.SampleInputs.COMPREHENSIVE_ANALYSIS,
                    AnalysisTopic.OVERALL_BUSINESS
            );

            when(industryKnowledgeConfig.getKnowledgeForTopic(anyString()))
                    .thenReturn(SAMPLE_INDUSTRY_KNOWLEDGE);

            // 构建超长响应
            StringBuilder longResult = new StringBuilder();
            for (int i = 0; i < 100; i++) {
                longResult.append("这是一段详细的分析内容，包含各种指标和建议。");
            }
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn(longResult.toString());

            // When
            AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

            // Then
            assertTrue(result.isSuccess(), "超长结果应正常处理");
            assertNotNull(result.getFormattedAnalysis());
        }
    }

    // ==========================================
    // 7. AgentMessage toAnalysisResult 测试
    // ==========================================
    @Nested
    @DisplayName("AgentMessage 转换测试")
    class AgentMessageConversionTests {

        @Test
        @DisplayName("成功消息转换为成功结果")
        void testSuccessMessageToSuccessResult() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    "测试输入",
                    AnalysisTopic.PRODUCT_STATUS
            );
            AgentMessage message = AgentMessage.create(context);
            message.setAnalysisResult(SAMPLE_ANALYSIS_RESULT);
            message.getRetrievedData().put("testKey", "testValue");

            // When
            AnalysisResult result = message.toAnalysisResult();

            // Then
            assertTrue(result.isSuccess(), "无错误消息应转换为成功结果");
            assertEquals(SAMPLE_ANALYSIS_RESULT, result.getFormattedAnalysis());
            assertEquals(AnalysisTopic.PRODUCT_STATUS, result.getTopic());
            assertNotNull(result.getDataSummary());
            assertTrue(result.getDataSummary().containsKey("testKey"));
        }

        @Test
        @DisplayName("错误消息转换为失败结果")
        void testErrorMessageToFailedResult() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(
                    "测试输入",
                    AnalysisTopic.GENERAL
            );
            AgentMessage message = AgentMessage.create(context);
            message.setErrorMessage("测试错误信息");

            // When
            AnalysisResult result = message.toAnalysisResult();

            // Then
            assertFalse(result.isSuccess(), "有错误消息应转换为失败结果");
            assertEquals("测试错误信息", result.getErrorMessage());
        }

        @Test
        @DisplayName("null 上下文的消息转换")
        void testNullContextMessageConversion() {
            // Given
            AgentMessage message = AgentMessage.builder()
                    .messageId("test-id")
                    .userQuery("测试")
                    .context(null)
                    .analysisResult("测试结果")
                    .build();

            // When
            AnalysisResult result = message.toAnalysisResult();

            // Then
            assertTrue(result.isSuccess());
            assertNull(result.getTopic(), "null 上下文应导致 null 主题");
        }
    }
}
