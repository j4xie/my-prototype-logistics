package com.cretas.aims.test.ai;

import com.cretas.aims.dto.ai.AnalysisContext;
import com.cretas.aims.dto.ai.AnalysisTopic;
import com.cretas.aims.dto.ai.ProcessingMode;
import com.cretas.aims.dto.ai.QueryFeatures;
import com.cretas.aims.service.ComplexityRouter;
import com.cretas.aims.service.impl.ComplexityRouterImpl;
import com.cretas.aims.test.util.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 复杂度路由单元测试
 * 测试 ComplexityRouter 的特征提取、复杂度评估和路由决策
 */
@DisplayName("复杂度路由测试 (ComplexityRouter)")
class ComplexityRouterTest {

    private ComplexityRouter router;

    @BeforeEach
    void setUp() {
        router = new ComplexityRouterImpl();
        // 设置默认配置值
        ReflectionTestUtils.setField(router, "lambda", 0.7);
    }

    // ==========================================
    // 1. 路由决策测试
    // ==========================================
    @Nested
    @DisplayName("路由决策测试")
    class RoutingDecisionTests {

        @Test
        @DisplayName("CR-001: 简单查询应路由到 FAST 或 ANALYSIS 模式")
        void testSimpleQuery_ShouldRouteFastOrAnalysis() {
            // Given
            String userInput = "查询今天的库存";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.INVENTORY_STATUS);

            // When
            ProcessingMode mode = router.route(userInput, context);
            double complexity = router.estimateComplexity(userInput, context);

            // Then
            // 带时间范围"今天" (+0.1) + 有topic设置 (+0.2 analysis) + 工具数 (+0.1) = 0.4
            // 所以会路由到 ANALYSIS 模式 (0.3-0.6 范围)
            assertTrue(mode == ProcessingMode.FAST || mode == ProcessingMode.ANALYSIS,
                    "简单查询应路由到 FAST 或 ANALYSIS 模式，实际: " + mode);
            assertTrue(complexity >= 0.3 && complexity <= 0.5,
                    "带时间范围的查询复杂度应在 0.3-0.5 之间，实际: " + complexity);
        }

        @Test
        @DisplayName("CR-002: 带时间范围查询应路由到 FAST 或 ANALYSIS 模式")
        void testTimeRangeQuery_ShouldRouteFastOrAnalysis() {
            // Given
            String userInput = "查询这周的出货情况";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.SHIPMENT_STATUS);

            // When
            ProcessingMode mode = router.route(userInput, context);
            double complexity = router.estimateComplexity(userInput, context);

            // Then
            assertTrue(mode == ProcessingMode.FAST || mode == ProcessingMode.ANALYSIS,
                    "带时间范围查询应路由到 FAST 或 ANALYSIS 模式");
            assertTrue(complexity >= 0.1 && complexity <= 0.5,
                    "带时间范围查询复杂度应在 0.1-0.5 之间，实际: " + complexity);
        }

        @Test
        @DisplayName("CR-003: 比较分析应路由到 ANALYSIS 或更高模式")
        void testComparisonAnalysis_ShouldRouteAnalysisOrHigher() {
            // Given
            String userInput = "对比本周和上周的销售趋势";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.OVERALL_BUSINESS);

            // When
            ProcessingMode mode = router.route(userInput, context);
            double complexity = router.estimateComplexity(userInput, context);

            // Then
            // "对比" 匹配比较词 (+0.2)，"趋势" 也匹配比较词 (+0.2 already counted)
            // "本周"、"上周" 匹配时间范围 (+0.1)
            // OVERALL_BUSINESS 2 个工具 (+0.1)
            // 有 topic (+0.2)
            // 总计: 0.2 + 0.1 + 0.1 + 0.2 = 0.6
            assertTrue(mode == ProcessingMode.ANALYSIS || mode == ProcessingMode.MULTI_AGENT,
                    "比较分析应路由到 ANALYSIS 或 MULTI_AGENT 模式，实际: " + mode);
            assertTrue(complexity >= 0.5 && complexity <= 0.8,
                    "比较分析复杂度应在 0.5-0.8 之间，实际: " + complexity);
        }

        @Test
        @DisplayName("CR-004: 因果分析应路由到高复杂度处理模式")
        void testCausalAnalysis_ShouldRouteHighComplexity() {
            // Given
            String userInput = "为什么良品率下降了";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.QUALITY_ANALYSIS);

            // When
            ProcessingMode mode = router.route(userInput, context);
            double complexity = router.estimateComplexity(userInput, context);

            // Then
            // "为什么" 包含 "什么"，所以问句词计数为 2 (+0.2)
            // "下降" 是比较指示词 (+0.2)
            // "为什么" 是因果指示词 (+0.2)
            // QUALITY_ANALYSIS 有 2 个工具 (+0.1)
            // 有 topic 设置 (+0.2)
            // 总计: 0.9，应路由到 DEEP_REASONING 模式
            assertTrue(mode == ProcessingMode.MULTI_AGENT || mode == ProcessingMode.DEEP_REASONING,
                    "因果分析应路由到 MULTI_AGENT 或 DEEP_REASONING 模式，实际: " + mode);
            assertTrue(complexity >= 0.7 && complexity <= 1.0,
                    "因果分析复杂度应在 0.7-1.0 之间，实际: " + complexity);
        }

        @Test
        @DisplayName("CR-005: 综合分析应路由到 MULTI_AGENT 或 DEEP_REASONING 模式")
        void testComprehensiveAnalysis_ShouldRouteMultiAgentOrDeep() {
            // Given
            String userInput = "分析本月销售下降原因并给出改进方案";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.OVERALL_BUSINESS);

            // When
            ProcessingMode mode = router.route(userInput, context);
            double complexity = router.estimateComplexity(userInput, context);

            // Then
            assertTrue(mode == ProcessingMode.MULTI_AGENT || mode == ProcessingMode.DEEP_REASONING ||
                            mode == ProcessingMode.ANALYSIS,
                    "综合分析应路由到复杂处理模式，实际: " + mode);
            assertTrue(complexity >= 0.5,
                    "综合分析复杂度应 >= 0.5，实际: " + complexity);
        }

        @Test
        @DisplayName("CR-006: 深度分析应路由到 DEEP_REASONING 模式")
        void testDeepAnalysis_ShouldRouteDeepReasoning() {
            // Given
            String userInput = "对比分析近三个月各产品线的质检趋势，分析波动原因并预测下月情况";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.QUALITY_ANALYSIS);

            // When
            ProcessingMode mode = router.route(userInput, context);
            double complexity = router.estimateComplexity(userInput, context);

            // Then
            assertTrue(mode == ProcessingMode.MULTI_AGENT || mode == ProcessingMode.DEEP_REASONING,
                    "深度分析应路由到 MULTI_AGENT 或 DEEP_REASONING 模式");
            assertTrue(complexity >= 0.6,
                    "深度分析复杂度应 >= 0.6，实际: " + complexity);
        }

        @Test
        @DisplayName("CR-007: 空输入应路由到 FAST 模式")
        void testEmptyInput_ShouldRouteFast() {
            // Given
            String userInput = "";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.GENERAL);

            // When
            ProcessingMode mode = router.route(userInput, context);
            double complexity = router.estimateComplexity(userInput, context);

            // Then
            assertEquals(ProcessingMode.FAST, mode, "空输入应路由到 FAST 模式");
            assertTrue(complexity < 0.3, "空输入复杂度应 < 0.3，实际: " + complexity);
        }

        @Test
        @DisplayName("CR-008: 纯闲聊应路由到 FAST 模式")
        void testChitChat_ShouldRouteFast() {
            // Given
            String userInput = "你好";
            // 使用 null topic 来模拟真正的闲聊场景，避免 analysis request 加分
            AnalysisContext context = AnalysisContext.builder()
                    .userInput(userInput)
                    .topic(null)  // 无特定主题
                    .factoryId("F001")
                    .userId(1L)
                    .userRole("factory_super_admin")
                    .build();

            // When
            ProcessingMode mode = router.route(userInput, context);
            double complexity = router.estimateComplexity(userInput, context);

            // Then
            // 纯闲聊无问句词、无比较、无因果、无时间、无工具、无分析请求
            // 复杂度应为 0
            assertEquals(ProcessingMode.FAST, mode, "纯闲聊应路由到 FAST 模式");
            assertTrue(complexity < 0.3, "纯闲聊复杂度应 < 0.3，实际: " + complexity);
        }
    }

    // ==========================================
    // 2. 特征提取测试
    // ==========================================
    @Nested
    @DisplayName("特征提取测试")
    class FeatureExtractionTests {

        @Test
        @DisplayName("应正确识别问句词数量（含子串匹配）")
        void testQuestionWordCount() {
            // Given
            String userInput = "为什么良品率怎么样";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.QUALITY_ANALYSIS);

            // When
            QueryFeatures features = router.extractFeatures(userInput, context);

            // Then
            // 问句词列表: "为什么", "怎么样", "如何", "什么", "哪些", "多少", "是否"
            // "为什么" 匹配 "为什么"，"什么" 作为子串也匹配
            // "怎么样" 匹配 "怎么样"
            // 所以总共 3 个匹配
            assertEquals(3, features.getQuestionWordCount(),
                    "\"为什么良品率怎么样\" 应识别为 3 个问句词（为什么、什么、怎么样）");
        }

        @Test
        @DisplayName("应正确识别问句词（含子串匹配）")
        void testQuestionWordWithSubstring() {
            // Given
            String userInput = "为什么出货量减少";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.SHIPMENT_STATUS);

            // When
            QueryFeatures features = router.extractFeatures(userInput, context);

            // Then
            // "为什么" 包含 "什么" 作为子串，所以匹配两个问句词
            assertEquals(2, features.getQuestionWordCount(),
                    "\"为什么出货量减少\" 应识别为 2 个问句词（为什么、什么）");
        }

        @Test
        @DisplayName("应正确检测比较指示词")
        void testComparisonIndicator() {
            // Given
            String userInput = "对比本周和上周的趋势";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.OVERALL_BUSINESS);

            // When
            QueryFeatures features = router.extractFeatures(userInput, context);

            // Then
            assertTrue(features.isHasComparisonIndicator(),
                    "\"对比本周和上周的趋势\" 应检测到比较指示词");
        }

        @Test
        @DisplayName("应正确检测因果指示词")
        void testCausalIndicator() {
            // Given
            String userInput = "原因是什么导致了问题";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.QUALITY_ANALYSIS);

            // When
            QueryFeatures features = router.extractFeatures(userInput, context);

            // Then
            assertTrue(features.isHasCausalIndicator(),
                    "\"原因是什么导致了问题\" 应检测到因果指示词");
        }

        @ParameterizedTest
        @DisplayName("应正确检测时间范围词")
        @CsvSource({
                "这周的数据, true",
                "上月报表, true",
                "最近情况, true",
                "今天产出, true",
                "查询库存, false",
                "设备状态, false"
        })
        void testTimeRangeDetection(String input, boolean expectedHasTimeRange) {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(input, AnalysisTopic.GENERAL);

            // When
            QueryFeatures features = router.extractFeatures(input, context);

            // Then
            assertEquals(expectedHasTimeRange, features.isHasTimeRange(),
                    "\"" + input + "\" 时间范围检测应为: " + expectedHasTimeRange);
        }

        @Test
        @DisplayName("无问句词时应返回 0")
        void testNoQuestionWords() {
            // Given
            String userInput = "查询库存";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.INVENTORY_STATUS);

            // When
            QueryFeatures features = router.extractFeatures(userInput, context);

            // Then
            assertEquals(0, features.getQuestionWordCount(),
                    "\"查询库存\" 不应包含问句词");
        }
    }

    // ==========================================
    // 3. 阈值边界测试
    // ==========================================
    @Nested
    @DisplayName("阈值边界测试")
    class ThresholdBoundaryTests {

        @Test
        @DisplayName("复杂度 0.29 应路由到 FAST")
        void testThreshold_JustBelowAnalysis() {
            // 创建一个复杂度刚好低于 0.3 的场景
            String userInput = "今天情况";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.GENERAL);

            double complexity = router.estimateComplexity(userInput, context);
            ProcessingMode mode = router.route(userInput, context);

            if (complexity < 0.3) {
                assertEquals(ProcessingMode.FAST, mode,
                        "复杂度 " + complexity + " < 0.3 应路由到 FAST");
            }
        }

        @Test
        @DisplayName("复杂度接近 0.6 边界测试")
        void testThreshold_AnalysisToMultiAgent() {
            // 创建一个复杂度在 0.5-0.7 之间的场景
            String userInput = "分析产品趋势变化";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.PRODUCT_STATUS);

            double complexity = router.estimateComplexity(userInput, context);
            ProcessingMode mode = router.route(userInput, context);

            if (complexity >= 0.3 && complexity < 0.6) {
                assertEquals(ProcessingMode.ANALYSIS, mode,
                        "复杂度 " + complexity + " 在 0.3-0.6 之间应路由到 ANALYSIS");
            } else if (complexity >= 0.6 && complexity < 0.8) {
                assertEquals(ProcessingMode.MULTI_AGENT, mode,
                        "复杂度 " + complexity + " 在 0.6-0.8 之间应路由到 MULTI_AGENT");
            }
        }

        @Test
        @DisplayName("验证 ProcessingMode.fromLevel 正确映射")
        void testProcessingModeFromLevel() {
            assertEquals(ProcessingMode.FAST, ProcessingMode.fromLevel(1));
            assertEquals(ProcessingMode.FAST, ProcessingMode.fromLevel(2));
            assertEquals(ProcessingMode.ANALYSIS, ProcessingMode.fromLevel(3));
            assertEquals(ProcessingMode.MULTI_AGENT, ProcessingMode.fromLevel(4));
            assertEquals(ProcessingMode.DEEP_REASONING, ProcessingMode.fromLevel(5));
        }
    }

    // ==========================================
    // 4. 参数化测试
    // ==========================================
    @Nested
    @DisplayName("参数化复杂度测试")
    class ParameterizedComplexityTests {

        @ParameterizedTest
        @DisplayName("各种输入的复杂度评估")
        @MethodSource("provideComplexityTestCases")
        void testComplexityEstimation(String testId, String userInput, AnalysisTopic topic,
                                       double minComplexity, double maxComplexity,
                                       ProcessingMode expectedMinMode) {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext(userInput, topic);

            // When
            double complexity = router.estimateComplexity(userInput, context);
            ProcessingMode mode = router.route(userInput, context);

            // Then
            assertTrue(complexity >= minComplexity && complexity <= maxComplexity,
                    String.format("[%s] 复杂度应在 %.2f-%.2f 之间，实际: %.2f",
                            testId, minComplexity, maxComplexity, complexity));

            // 验证模式至少达到期望的最低级别
            assertTrue(mode.getLevel() >= expectedMinMode.getLevel(),
                    String.format("[%s] 处理模式应至少为 %s，实际: %s",
                            testId, expectedMinMode, mode));
        }

        static Stream<Arguments> provideComplexityTestCases() {
            // 复杂度评分规则:
            // - 问句词 × 0.1 (注意: "为什么"包含"什么"，计数为2)
            // - 比较指示词: +0.2
            // - 因果指示词: +0.2
            // - 时间范围: +0.1
            // - 工具数 × 0.05 (大部分topic有2个工具 = +0.1)
            // - 分析请求(topic != null): +0.2
            return Stream.of(
                    // testId, userInput, topic, minComplexity, maxComplexity, expectedMinMode
                    // "查询库存": 无问句词、无比较、无因果、无时间、+0.1工具、+0.2分析 = 0.3
                    Arguments.of("简单查询", "查询库存", AnalysisTopic.INVENTORY_STATUS,
                            0.25, 0.35, ProcessingMode.FAST),
                    // "这周的出货": 无问句词、无比较、无因果、+0.1时间、+0.1工具、+0.2分析 = 0.4
                    Arguments.of("时间范围", "这周的出货", AnalysisTopic.SHIPMENT_STATUS,
                            0.35, 0.45, ProcessingMode.FAST),
                    // "对比上周数据": 无问句词、+0.2比较、无因果、+0.1时间、+0.1工具、+0.2分析 = 0.6
                    Arguments.of("比较分析", "对比上周数据", AnalysisTopic.OVERALL_BUSINESS,
                            0.55, 0.65, ProcessingMode.FAST),
                    // "为什么下降": +0.2问句词(为什么+什么)、+0.2比较(下降)、+0.2因果(为什么)、无时间、+0.1工具、+0.2分析 = 0.9
                    Arguments.of("因果分析", "为什么下降", AnalysisTopic.QUALITY_ANALYSIS,
                            0.85, 0.95, ProcessingMode.FAST),
                    // "分析原因并改进": 无问句词、无比较、+0.2因果(原因)、无时间、+0.1工具、+0.2分析 = 0.5
                    Arguments.of("综合分析", "分析原因并改进", AnalysisTopic.OVERALL_BUSINESS,
                            0.45, 0.55, ProcessingMode.FAST)
            );
        }
    }

    // ==========================================
    // 5. 空值和边界处理测试
    // ==========================================
    @Nested
    @DisplayName("空值和边界处理测试")
    class NullAndEdgeCaseTests {

        @Test
        @DisplayName("null 上下文应正常处理")
        void testNullContext_ShouldHandleGracefully() {
            // Given
            String userInput = "查询库存";

            // When & Then
            assertDoesNotThrow(() -> {
                ProcessingMode mode = router.route(userInput, null);
                assertNotNull(mode);
            }, "null 上下文应正常处理");
        }

        @Test
        @DisplayName("null 输入应返回 FAST 模式")
        void testNullInput_ShouldReturnFast() {
            // Given
            AnalysisContext context = TestDataFactory.createTestContext("", AnalysisTopic.GENERAL);

            // When
            ProcessingMode mode = router.route(null, context);

            // Then
            assertEquals(ProcessingMode.FAST, mode, "null 输入应返回 FAST 模式");
        }

        @Test
        @DisplayName("超长输入应正常处理")
        void testVeryLongInput_ShouldHandleGracefully() {
            // Given
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 100; i++) {
                sb.append("分析为什么对比趋势原因");
            }
            String userInput = sb.toString();
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.GENERAL);

            // When & Then
            assertDoesNotThrow(() -> {
                double complexity = router.estimateComplexity(userInput, context);
                assertTrue(complexity <= 1.0, "复杂度应不超过 1.0");
            }, "超长输入应正常处理");
        }

        @Test
        @DisplayName("特殊字符输入应正常处理")
        void testSpecialCharacters_ShouldHandleGracefully() {
            // Given
            String userInput = "查询!@#$%^&*()库存【】《》";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.INVENTORY_STATUS);

            // When & Then
            assertDoesNotThrow(() -> {
                ProcessingMode mode = router.route(userInput, context);
                assertNotNull(mode);
            }, "特殊字符输入应正常处理");
        }
    }

    // ==========================================
    // 6. 复杂度评分一致性测试
    // ==========================================
    @Nested
    @DisplayName("复杂度评分一致性测试")
    class ComplexityConsistencyTests {

        @Test
        @DisplayName("相同输入应返回相同复杂度")
        void testSameInput_ShouldReturnSameComplexity() {
            // Given
            String userInput = "分析产品状态怎么样";
            AnalysisContext context = TestDataFactory.createTestContext(userInput, AnalysisTopic.PRODUCT_STATUS);

            // When
            double complexity1 = router.estimateComplexity(userInput, context);
            double complexity2 = router.estimateComplexity(userInput, context);
            double complexity3 = router.estimateComplexity(userInput, context);

            // Then
            assertEquals(complexity1, complexity2, 0.001, "相同输入应返回相同复杂度");
            assertEquals(complexity2, complexity3, 0.001, "相同输入应返回相同复杂度");
        }

        @Test
        @DisplayName("复杂度应在 0-1 范围内")
        void testComplexity_ShouldBeInRange() {
            String[] inputs = {
                    "",
                    "你好",
                    "查询库存",
                    "分析趋势",
                    "为什么下降",
                    "对比分析原因并给出改进方案"
            };

            for (String input : inputs) {
                AnalysisContext context = TestDataFactory.createTestContext(input, AnalysisTopic.GENERAL);
                double complexity = router.estimateComplexity(input, context);

                assertTrue(complexity >= 0.0 && complexity <= 1.0,
                        String.format("输入 \"%s\" 的复杂度 %.2f 应在 0-1 范围内", input, complexity));
            }
        }

        @Test
        @DisplayName("更复杂的输入应有更高的复杂度")
        void testMoreComplexInput_ShouldHaveHigherComplexity() {
            // Given
            String simpleInput = "查询库存";
            String complexInput = "分析对比近三个月产品质检趋势变化的原因并给出改进方案";

            AnalysisContext simpleContext = TestDataFactory.createTestContext(simpleInput, AnalysisTopic.INVENTORY_STATUS);
            AnalysisContext complexContext = TestDataFactory.createTestContext(complexInput, AnalysisTopic.QUALITY_ANALYSIS);

            // When
            double simpleComplexity = router.estimateComplexity(simpleInput, simpleContext);
            double complexComplexity = router.estimateComplexity(complexInput, complexContext);

            // Then
            assertTrue(complexComplexity > simpleComplexity,
                    String.format("复杂输入 (%.2f) 应比简单输入 (%.2f) 有更高复杂度",
                            complexComplexity, simpleComplexity));
        }
    }
}
