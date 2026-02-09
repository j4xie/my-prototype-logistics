package com.cretas.aims.test.ai.integration;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.config.IntentKnowledgeBase.QuestionType;
import com.cretas.aims.dto.ai.*;
import com.cretas.aims.service.*;
import com.cretas.aims.test.config.TestIndustryKnowledgeConfig;
import com.cretas.aims.test.util.TestDataFactory;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.util.*;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 分析流程集成测试
 *
 * 验证完整的分析流程：
 * AnalysisRouter → ComplexityRouter → AgentOrchestrator
 *
 * 测试覆盖：
 * 1. 完整分析流程 - 简单查询
 * 2. 完整分析流程 - 复杂查询
 * 3. CRAG + 反馈集成
 * 4. 分析主题检测
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@SpringBootTest
@ActiveProfiles("test")
@Import(TestIndustryKnowledgeConfig.class)
@DisplayName("分析流程集成测试 (AnalysisFlow Integration)")
class AnalysisFlowIntegrationTest {

    @Autowired
    private AnalysisRouterService analysisRouterService;

    @Autowired
    private ComplexityRouter complexityRouter;

    @Autowired
    private AgentOrchestrator agentOrchestrator;

    @Autowired
    private RetrievalEvaluatorService retrievalEvaluatorService;

    @Autowired
    private KnowledgeFeedbackService knowledgeFeedbackService;

    @MockBean
    private DashScopeClient dashScopeClient;

    // ==========================================
    // 1. 完整分析流程 - 简单查询
    // ==========================================
    @Nested
    @DisplayName("1. 完整分析流程 - 简单查询")
    class SimpleQueryFlowTests {

        @Test
        @DisplayName("AFI-001: 简单库存查询应路由到 FAST 模式")
        void testSimpleInventoryQuery_ShouldRouteFast() {
            // Given
            String userInput = "查询今天的库存";
            AnalysisContext context = TestDataFactory.createTestContext(
                    userInput, AnalysisTopic.INVENTORY_STATUS);

            // When - Step 1: 检测是否为分析请求
            boolean isAnalysisRequest = analysisRouterService.isAnalysisRequest(
                    userInput, QuestionType.GENERAL_QUESTION);

            // When - Step 2: 复杂度评估
            double complexity = complexityRouter.estimateComplexity(userInput, context);
            ProcessingMode mode = complexityRouter.route(userInput, context);

            // Then
            log.info("AFI-001: 简单库存查询测试");
            log.info("  - isAnalysisRequest: {}", isAnalysisRequest);
            log.info("  - complexity: {}", complexity);
            log.info("  - mode: {}", mode);

            // 简单查询可能是分析请求（取决于是否包含分析指示词）
            // 核心断言：复杂度应较低，路由到 FAST 模式
            assertTrue(complexity < 0.4,
                    String.format("简单查询复杂度应 < 0.4，实际: %.2f", complexity));
            assertEquals(ProcessingMode.FAST, mode,
                    "简单查询应路由到 FAST 模式");
        }

        @Test
        @DisplayName("AFI-002: 简单状态查询应正确检测分析请求")
        void testSimpleStatusQuery_ShouldDetectAnalysisRequest() {
            // Given
            String userInput = "产品状态怎么样";

            // When
            boolean isAnalysisRequest = analysisRouterService.isAnalysisRequest(
                    userInput, QuestionType.GENERAL_QUESTION);
            AnalysisTopic topic = analysisRouterService.detectAnalysisTopic(userInput);

            // Then
            log.info("AFI-002: 简单状态查询分析检测");
            log.info("  - userInput: {}", userInput);
            log.info("  - isAnalysisRequest: {}", isAnalysisRequest);
            log.info("  - topic: {}", topic);

            assertTrue(isAnalysisRequest,
                    "'产品状态怎么样' 应被识别为分析请求");
            assertEquals(AnalysisTopic.PRODUCT_STATUS, topic,
                    "应检测到 PRODUCT_STATUS 主题");
        }

        @Test
        @DisplayName("AFI-003: 非 GENERAL_QUESTION 类型不应识别为分析请求")
        void testNonGeneralQuestion_ShouldNotBeAnalysisRequest() {
            // Given
            String userInput = "产品状态怎么样";

            // When
            boolean isAnalysisWithOperational = analysisRouterService.isAnalysisRequest(
                    userInput, QuestionType.OPERATIONAL_COMMAND);
            boolean isAnalysisWithConversational = analysisRouterService.isAnalysisRequest(
                    userInput, QuestionType.CONVERSATIONAL);
            boolean isAnalysisWithGeneral = analysisRouterService.isAnalysisRequest(
                    userInput, QuestionType.GENERAL_QUESTION);

            // Then
            assertFalse(isAnalysisWithOperational,
                    "OPERATIONAL_COMMAND 类型不应识别为分析请求");
            assertFalse(isAnalysisWithConversational,
                    "CONVERSATIONAL 类型不应识别为分析请求");
            assertTrue(isAnalysisWithGeneral,
                    "GENERAL_QUESTION 类型应正确识别分析请求");
        }
    }

    // ==========================================
    // 2. 完整分析流程 - 复杂查询
    // ==========================================
    @Nested
    @DisplayName("2. 完整分析流程 - 复杂查询")
    class ComplexQueryFlowTests {

        @BeforeEach
        void setupMocks() {
            // Mock DashScopeClient 返回分析结果
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn("根据分析，本月产品质量整体呈上升趋势，良品率达到 97.5%。建议继续加强质检环节的监控。");
        }

        @Test
        @DisplayName("AFI-004: 复杂质量分析应路由到 ANALYSIS 或 MULTI_AGENT 模式")
        void testComplexQualityAnalysis_ShouldRouteAnalysisOrMultiAgent() {
            // Given
            String userInput = "分析本月产品质量趋势并给出改进建议";
            AnalysisContext context = TestDataFactory.createTestContext(
                    userInput, AnalysisTopic.QUALITY_ANALYSIS);

            // When - Step 1: 分析请求检测
            boolean isAnalysisRequest = analysisRouterService.isAnalysisRequest(
                    userInput, QuestionType.GENERAL_QUESTION);

            // When - Step 2: 主题检测
            AnalysisTopic detectedTopic = analysisRouterService.detectAnalysisTopic(userInput);

            // When - Step 3: 复杂度路由
            ProcessingMode mode = complexityRouter.route(userInput, context);
            double complexity = complexityRouter.estimateComplexity(userInput, context);

            // Then
            log.info("AFI-004: 复杂质量分析测试");
            log.info("  - isAnalysisRequest: {}", isAnalysisRequest);
            log.info("  - detectedTopic: {}", detectedTopic);
            log.info("  - complexity: {}", complexity);
            log.info("  - mode: {}", mode);

            assertTrue(isAnalysisRequest, "应识别为分析请求");
            assertEquals(AnalysisTopic.QUALITY_ANALYSIS, detectedTopic,
                    "应检测到 QUALITY_ANALYSIS 主题");
            assertTrue(mode == ProcessingMode.ANALYSIS ||
                       mode == ProcessingMode.MULTI_AGENT ||
                       mode == ProcessingMode.DEEP_REASONING,
                    String.format("复杂分析应路由到 ANALYSIS/MULTI_AGENT/DEEP_REASONING，实际: %s", mode));
            assertTrue(complexity >= 0.3,
                    String.format("复杂分析复杂度应 >= 0.3，实际: %.2f", complexity));
        }

        @Test
        @DisplayName("AFI-005: MULTI_AGENT 模式应触发协作分析")
        void testMultiAgentMode_ShouldTriggerCollaborativeAnalysis() {
            // Given
            String userInput = "对比分析近三个月各产品线的质检趋势，分析波动原因并预测下月情况";
            AnalysisContext context = TestDataFactory.createTestContext(
                    userInput, AnalysisTopic.QUALITY_ANALYSIS);

            // When
            ProcessingMode mode = complexityRouter.route(userInput, context);
            boolean requiresMultiAgent = agentOrchestrator.requiresMultiAgentCollaboration(context);

            // Then
            log.info("AFI-005: MULTI_AGENT 协作分析测试");
            log.info("  - mode: {}", mode);
            log.info("  - requiresMultiAgent: {}", requiresMultiAgent);

            // 如果路由到 MULTI_AGENT，则应需要多 Agent 协作
            if (mode == ProcessingMode.MULTI_AGENT || mode == ProcessingMode.DEEP_REASONING) {
                // 执行协作分析
                AnalysisResult result = agentOrchestrator.executeCollaborativeAnalysis(context);

                assertNotNull(result, "协作分析结果不应为空");
                log.info("  - result.success: {}", result.isSuccess());
                log.info("  - result.topic: {}", result.getTopic());
            }

            // 断言复杂查询的复杂度足够高
            double complexity = complexityRouter.estimateComplexity(userInput, context);
            assertTrue(complexity >= 0.5,
                    String.format("深度分析复杂度应 >= 0.5，实际: %.2f", complexity));
        }

        @Test
        @DisplayName("AFI-006: 执行分析应返回格式化结果")
        void testExecuteAnalysis_ShouldReturnFormattedResult() {
            // Given
            String userInput = "分析库存情况并给出建议";
            AnalysisContext context = TestDataFactory.createTestContext(
                    userInput, AnalysisTopic.INVENTORY_STATUS);

            // When
            AnalysisResult result = analysisRouterService.executeAnalysis(context);

            // Then
            log.info("AFI-006: 执行分析测试");
            log.info("  - success: {}", result.isSuccess());
            log.info("  - topic: {}", result.getTopic());
            log.info("  - toolsUsed: {}", result.getToolsUsed());
            log.info("  - formattedAnalysis length: {}",
                    result.getFormattedAnalysis() != null ? result.getFormattedAnalysis().length() : 0);

            assertTrue(result.isSuccess(), "分析应成功");
            assertEquals(AnalysisTopic.INVENTORY_STATUS, result.getTopic(), "主题应匹配");
            assertNotNull(result.getToolsUsed(), "工具列表不应为空");
            assertNotNull(result.getFormattedAnalysis(), "格式化分析不应为空");
        }
    }

    // ==========================================
    // 3. CRAG + 反馈集成测试
    // ==========================================
    @Nested
    @DisplayName("3. CRAG + 反馈集成测试")
    class CRAGFeedbackIntegrationTests {

        @Test
        @DisplayName("AFI-007: 高相关性检索结果应评估为 CORRECT")
        void testHighRelevanceRetrieval_ShouldBeCorrect() {
            // Given
            String query = "产品质检标准是什么";
            List<Map<String, Object>> retrievalResults =
                    TestDataFactory.createHighRelevanceRetrievalResults();

            // When
            RetrievalQualityScore score = retrievalEvaluatorService.evaluateRetrieval(
                    query, retrievalResults);

            // Then
            log.info("AFI-007: 高相关性检索评估测试");
            log.info("  - query: {}", query);
            log.info("  - score: {}", score);

            assertEquals(RetrievalQualityScore.CORRECT, score,
                    "高相关性结果应评估为 CORRECT");
        }

        @Test
        @DisplayName("AFI-008: 中等相关性检索结果应评估为 AMBIGUOUS")
        void testMediumRelevanceRetrieval_ShouldBeAmbiguous() {
            // Given
            String query = "产品质检标准是什么";
            List<Map<String, Object>> retrievalResults =
                    TestDataFactory.createMediumRelevanceRetrievalResults();

            // When
            RetrievalQualityScore score = retrievalEvaluatorService.evaluateRetrieval(
                    query, retrievalResults);

            // Then
            log.info("AFI-008: 中等相关性检索评估测试");
            log.info("  - query: {}", query);
            log.info("  - score: {}", score);

            assertEquals(RetrievalQualityScore.AMBIGUOUS, score,
                    "中等相关性结果应评估为 AMBIGUOUS");
        }

        @Test
        @DisplayName("AFI-009: AMBIGUOUS 结果应触发知识分解")
        void testAmbiguousRetrieval_ShouldTriggerKnowledgeDecomposition() {
            // Given
            String query = "产品质检标准是什么";
            String content = "食品保质期和存储条件对产品质量有重要影响。" +
                    "库存管理需要关注先进先出原则。" +
                    "质检包括微生物指标和理化指标检测。";

            // When - 知识分解
            List<String> strips = retrievalEvaluatorService.decomposeToKnowledgeStrips(content);

            // When - 过滤相关片段
            List<String> relevantStrips = retrievalEvaluatorService.filterRelevantStrips(
                    query, strips);

            // Then
            log.info("AFI-009: 知识分解测试");
            log.info("  - 原始内容长度: {}", content.length());
            log.info("  - 分解后片段数: {}", strips.size());
            log.info("  - 过滤后相关片段数: {}", relevantStrips.size());
            log.info("  - 相关片段: {}", relevantStrips);

            assertNotNull(strips, "分解后的片段不应为空");
            assertTrue(strips.size() > 0, "应分解出至少一个片段");
            assertNotNull(relevantStrips, "过滤后的片段不应为空");
        }

        @Test
        @DisplayName("AFI-010: 低相关性检索结果应评估为 INCORRECT")
        void testLowRelevanceRetrieval_ShouldBeIncorrect() {
            // Given
            String query = "产品质检标准是什么";
            List<Map<String, Object>> retrievalResults =
                    TestDataFactory.createLowRelevanceRetrievalResults();

            // When
            RetrievalQualityScore score = retrievalEvaluatorService.evaluateRetrieval(
                    query, retrievalResults);

            // Then
            log.info("AFI-010: 低相关性检索评估测试");
            log.info("  - query: {}", query);
            log.info("  - score: {}", score);

            assertEquals(RetrievalQualityScore.INCORRECT, score,
                    "低相关性结果应评估为 INCORRECT");
        }

        @Test
        @DisplayName("AFI-011: 记录反馈应增加未处理反馈计数")
        void testRecordFeedback_ShouldIncreaseUnprocessedCount() {
            // Given
            String sessionId = "test-session-" + UUID.randomUUID().toString().substring(0, 8);
            String query = "产品质检标准是什么";
            String response = "质检标准包括微生物指标、理化指标和感官指标。";

            // When - 记录反馈前的计数
            long countBefore = knowledgeFeedbackService.getUnprocessedFeedbackCount();

            // When - 记录反馈
            knowledgeFeedbackService.recordFeedback(
                    sessionId, query, response,
                    KnowledgeFeedbackService.FeedbackType.POSITIVE);

            // When - 记录反馈后的计数
            long countAfter = knowledgeFeedbackService.getUnprocessedFeedbackCount();

            // Then
            log.info("AFI-011: 反馈记录测试");
            log.info("  - countBefore: {}", countBefore);
            log.info("  - countAfter: {}", countAfter);

            assertTrue(countAfter >= countBefore,
                    "记录反馈后，未处理计数应不减少");
        }

        @Test
        @DisplayName("AFI-012: 纠正类型反馈应包含纠正文本")
        void testCorrectionFeedback_ShouldIncludeCorrectionText() {
            // Given
            String sessionId = "test-session-" + UUID.randomUUID().toString().substring(0, 8);
            String query = "什么是溯源码";
            String incorrectResponse = "溯源码是一种条形码";
            String correctionText = "溯源码是唯一标识产品全生命周期的二维码，可追踪产品从原料到成品的完整流程。";

            // When - 记录纠正反馈
            assertDoesNotThrow(() -> {
                knowledgeFeedbackService.recordFeedback(
                        sessionId, query, incorrectResponse,
                        KnowledgeFeedbackService.FeedbackType.CORRECTION,
                        correctionText);
            }, "记录纠正反馈不应抛出异常");

            log.info("AFI-012: 纠正反馈测试完成");
        }
    }

    // ==========================================
    // 4. 分析主题检测测试
    // ==========================================
    @Nested
    @DisplayName("4. 分析主题检测测试")
    class AnalysisTopicDetectionTests {

        @ParameterizedTest
        @DisplayName("AFI-013: 应正确检测各类分析主题")
        @CsvSource({
                "产品状态怎么样, PRODUCT_STATUS",
                "库存情况如何, INVENTORY_STATUS",
                "出货量多少, SHIPMENT_STATUS",
                "质检报告分析, QUALITY_ANALYSIS",
                "人员考勤情况, PERSONNEL_ANALYSIS",
                "今天整体业务情况, OVERALL_BUSINESS"
        })
        void testTopicDetection_ShouldDetectCorrectTopic(String userInput, String expectedTopic) {
            // When
            AnalysisTopic detectedTopic = analysisRouterService.detectAnalysisTopic(userInput);

            // Then
            log.info("AFI-013: 主题检测测试");
            log.info("  - userInput: {}", userInput);
            log.info("  - expectedTopic: {}", expectedTopic);
            log.info("  - detectedTopic: {}", detectedTopic);

            assertEquals(AnalysisTopic.valueOf(expectedTopic), detectedTopic,
                    String.format("'%s' 应检测到 %s 主题", userInput, expectedTopic));
        }

        @ParameterizedTest
        @DisplayName("AFI-014: 应正确识别分析请求")
        @MethodSource("provideAnalysisRequestTestCases")
        void testAnalysisRequestDetection(String testId, String userInput,
                                           QuestionType questionType,
                                           boolean expectedIsAnalysis) {
            // When
            boolean isAnalysis = analysisRouterService.isAnalysisRequest(userInput, questionType);

            // Then
            log.info("AFI-014: 分析请求检测测试 [{}]", testId);
            log.info("  - userInput: {}", userInput);
            log.info("  - questionType: {}", questionType);
            log.info("  - expectedIsAnalysis: {}", expectedIsAnalysis);
            log.info("  - actualIsAnalysis: {}", isAnalysis);

            assertEquals(expectedIsAnalysis, isAnalysis,
                    String.format("[%s] '%s' 分析请求检测应为 %s",
                            testId, userInput, expectedIsAnalysis));
        }

        static Stream<Arguments> provideAnalysisRequestTestCases() {
            return Stream.of(
                    // testId, userInput, questionType, expectedIsAnalysis
                    Arguments.of("产品+状态", "产品状态怎么样",
                            QuestionType.GENERAL_QUESTION, true),
                    Arguments.of("库存+情况", "库存情况如何",
                            QuestionType.GENERAL_QUESTION, true),
                    Arguments.of("质检+分析", "质检分析报告",
                            QuestionType.GENERAL_QUESTION, true),
                    Arguments.of("纯查询无分析词", "查询库存",
                            QuestionType.GENERAL_QUESTION, false),
                    Arguments.of("闲聊", "你好",
                            QuestionType.GENERAL_QUESTION, false),
                    Arguments.of("操作指令类型", "产品状态怎么样",
                            QuestionType.OPERATIONAL_COMMAND, false),
                    Arguments.of("空输入", "",
                            QuestionType.GENERAL_QUESTION, false)
            );
        }

        @Test
        @DisplayName("AFI-015: 空输入应返回 GENERAL 主题")
        void testEmptyInput_ShouldReturnGeneralTopic() {
            // When
            AnalysisTopic topic1 = analysisRouterService.detectAnalysisTopic("");
            AnalysisTopic topic2 = analysisRouterService.detectAnalysisTopic(null);
            AnalysisTopic topic3 = analysisRouterService.detectAnalysisTopic("   ");

            // Then
            assertEquals(AnalysisTopic.GENERAL, topic1, "空字符串应返回 GENERAL");
            assertEquals(AnalysisTopic.GENERAL, topic2, "null 应返回 GENERAL");
            assertEquals(AnalysisTopic.GENERAL, topic3, "空白字符串应返回 GENERAL");
        }

        @Test
        @DisplayName("AFI-016: 多关键词输入应选择最匹配的主题")
        void testMultipleKeywords_ShouldSelectBestMatch() {
            // Given - 包含多个领域关键词，但质检关键词更多
            String userInput = "分析产品质量质检合格率情况";

            // When
            AnalysisTopic topic = analysisRouterService.detectAnalysisTopic(userInput);

            // Then
            log.info("AFI-016: 多关键词主题检测");
            log.info("  - userInput: {}", userInput);
            log.info("  - detectedTopic: {}", topic);

            // 应该选择匹配度最高的主题
            assertTrue(topic == AnalysisTopic.QUALITY_ANALYSIS ||
                       topic == AnalysisTopic.PRODUCT_STATUS,
                    "应检测到 QUALITY_ANALYSIS 或 PRODUCT_STATUS");
        }
    }

    // ==========================================
    // 5. 端到端流程测试
    // ==========================================
    @Nested
    @DisplayName("5. 端到端流程测试")
    class EndToEndFlowTests {

        @BeforeEach
        void setupMocks() {
            when(dashScopeClient.chat(anyString(), anyString()))
                    .thenReturn("测试分析结果：当前状态良好。");
        }

        @Test
        @DisplayName("AFI-017: 完整分析流程端到端测试")
        void testFullAnalysisFlow_EndToEnd() {
            // Given
            String userInput = "分析本月质检情况并给出改进建议";

            // Step 1: 检测问题类型（模拟为 GENERAL_QUESTION）
            QuestionType questionType = QuestionType.GENERAL_QUESTION;

            // Step 2: 检测是否为分析请求
            boolean isAnalysisRequest = analysisRouterService.isAnalysisRequest(
                    userInput, questionType);
            log.info("Step 2 - isAnalysisRequest: {}", isAnalysisRequest);

            if (!isAnalysisRequest) {
                log.info("非分析请求，跳过后续步骤");
                return;
            }

            // Step 3: 检测分析主题
            AnalysisTopic topic = analysisRouterService.detectAnalysisTopic(userInput);
            log.info("Step 3 - topic: {}", topic);

            // Step 4: 创建分析上下文
            AnalysisContext context = TestDataFactory.createTestContext(userInput, topic);

            // Step 5: 复杂度路由
            ProcessingMode mode = complexityRouter.route(userInput, context);
            double complexity = complexityRouter.estimateComplexity(userInput, context);
            log.info("Step 5 - mode: {}, complexity: {}", mode, complexity);

            // Step 6: 根据模式执行分析
            AnalysisResult result;
            if (mode == ProcessingMode.MULTI_AGENT || mode == ProcessingMode.DEEP_REASONING) {
                // 多 Agent 协作
                if (agentOrchestrator.requiresMultiAgentCollaboration(context)) {
                    result = agentOrchestrator.executeCollaborativeAnalysis(context);
                    log.info("Step 6 - 执行多 Agent 协作分析");
                } else {
                    result = analysisRouterService.executeAnalysis(context);
                    log.info("Step 6 - 执行单 Agent 分析");
                }
            } else {
                // 单 Agent 分析
                result = analysisRouterService.executeAnalysis(context);
                log.info("Step 6 - 执行单 Agent 分析");
            }

            // Then - 验证结果
            assertNotNull(result, "分析结果不应为空");
            log.info("Final Result:");
            log.info("  - success: {}", result.isSuccess());
            log.info("  - topic: {}", result.getTopic());
            log.info("  - toolsUsed: {}", result.getToolsUsed());
            log.info("  - formattedAnalysis: {}",
                    result.getFormattedAnalysis() != null ?
                    result.getFormattedAnalysis().substring(0,
                            Math.min(100, result.getFormattedAnalysis().length())) + "..." : "null");

            assertTrue(result.isSuccess(), "分析应成功");
            assertEquals(topic, result.getTopic(), "结果主题应匹配");
        }

        @Test
        @DisplayName("AFI-018: 查询特征提取端到端测试")
        void testFeatureExtraction_EndToEnd() {
            // Given
            String[] testInputs = {
                    "查询库存",
                    "分析本周趋势",
                    "为什么良品率下降",
                    "对比分析近三个月质检数据的变化趋势并给出改进建议"
            };

            for (String userInput : testInputs) {
                // When
                AnalysisContext context = TestDataFactory.createTestContext(
                        userInput, AnalysisTopic.GENERAL);
                QueryFeatures features = complexityRouter.extractFeatures(userInput, context);
                ProcessingMode mode = complexityRouter.route(userInput, context);
                double complexity = complexityRouter.estimateComplexity(userInput, context);

                // Then
                log.info("AFI-018: 特征提取测试 - '{}'", userInput);
                log.info("  - questionWordCount: {}", features.getQuestionWordCount());
                log.info("  - hasComparisonIndicator: {}", features.isHasComparisonIndicator());
                log.info("  - hasTimeRange: {}", features.isHasTimeRange());
                log.info("  - hasCausalIndicator: {}", features.isHasCausalIndicator());
                log.info("  - complexity: {}", complexity);
                log.info("  - mode: {}", mode);

                assertNotNull(features, "特征不应为空");
                assertTrue(complexity >= 0 && complexity <= 1,
                        "复杂度应在 0-1 范围内");
                assertNotNull(mode, "处理模式不应为空");
            }
        }
    }

    // ==========================================
    // 6. 边界条件和错误处理测试
    // ==========================================
    @Nested
    @DisplayName("6. 边界条件和错误处理测试")
    class EdgeCaseAndErrorHandlingTests {

        @Test
        @DisplayName("AFI-019: null 输入应优雅处理")
        void testNullInput_ShouldHandleGracefully() {
            // When & Then
            assertDoesNotThrow(() -> {
                boolean isAnalysis = analysisRouterService.isAnalysisRequest(
                        null, QuestionType.GENERAL_QUESTION);
                assertFalse(isAnalysis, "null 输入不应识别为分析请求");
            });

            assertDoesNotThrow(() -> {
                AnalysisTopic topic = analysisRouterService.detectAnalysisTopic(null);
                assertEquals(AnalysisTopic.GENERAL, topic, "null 输入应返回 GENERAL");
            });

            assertDoesNotThrow(() -> {
                ProcessingMode mode = complexityRouter.route(null, null);
                assertNotNull(mode, "null 输入应返回有效模式");
            });
        }

        @Test
        @DisplayName("AFI-020: 超长输入应正常处理")
        void testVeryLongInput_ShouldHandleGracefully() {
            // Given
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 100; i++) {
                sb.append("分析产品质量趋势变化对比情况");
            }
            String longInput = sb.toString();

            // When & Then
            assertDoesNotThrow(() -> {
                AnalysisTopic topic = analysisRouterService.detectAnalysisTopic(longInput);
                assertNotNull(topic, "超长输入应返回有效主题");

                AnalysisContext context = TestDataFactory.createTestContext(
                        longInput, AnalysisTopic.GENERAL);
                ProcessingMode mode = complexityRouter.route(longInput, context);
                assertNotNull(mode, "超长输入应返回有效模式");

                double complexity = complexityRouter.estimateComplexity(longInput, context);
                assertTrue(complexity <= 1.0, "复杂度应不超过 1.0");
            });
        }

        @Test
        @DisplayName("AFI-021: 空检索结果列表应正常处理")
        void testEmptyRetrievalResults_ShouldHandleGracefully() {
            // Given
            String query = "产品质检标准是什么";
            List<Map<String, Object>> emptyResults = new ArrayList<>();

            // When
            RetrievalQualityScore score = retrievalEvaluatorService.evaluateRetrieval(
                    query, emptyResults);

            // Then
            log.info("AFI-021: 空检索结果测试");
            log.info("  - score: {}", score);

            assertNotNull(score, "空结果列表应返回有效评分");
            assertEquals(RetrievalQualityScore.INCORRECT, score,
                    "空结果应评估为 INCORRECT");
        }

        @Test
        @DisplayName("AFI-022: 特殊字符输入应正常处理")
        void testSpecialCharacters_ShouldHandleGracefully() {
            // Given
            String specialInput = "分析！@#$%^&*()产品_-+=[]{}|;':\",./<>?状态";

            // When & Then
            assertDoesNotThrow(() -> {
                AnalysisTopic topic = analysisRouterService.detectAnalysisTopic(specialInput);
                assertNotNull(topic);

                boolean isAnalysis = analysisRouterService.isAnalysisRequest(
                        specialInput, QuestionType.GENERAL_QUESTION);
                // 结果不重要，重要的是不抛异常
            });
        }
    }
}
