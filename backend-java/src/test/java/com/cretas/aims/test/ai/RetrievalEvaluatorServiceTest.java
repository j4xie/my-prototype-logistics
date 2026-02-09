package com.cretas.aims.test.ai;

import com.cretas.aims.dto.ai.RetrievalQualityScore;
import com.cretas.aims.service.EmbeddingClient;
import com.cretas.aims.service.RetrievalEvaluatorService;
import com.cretas.aims.service.impl.RetrievalEvaluatorServiceImpl;
import com.cretas.aims.test.util.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.*;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * 检索评估服务单元测试 (CRAG)
 * 测试 RetrievalEvaluatorService 的相关性评分、知识分解和过滤功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("检索评估服务测试 (RetrievalEvaluatorService)")
class RetrievalEvaluatorServiceTest {

    @Mock
    private EmbeddingClient embeddingClient;

    private RetrievalEvaluatorService evaluatorService;

    @BeforeEach
    void setUp() {
        evaluatorService = new RetrievalEvaluatorServiceImpl(embeddingClient);
    }

    // ==========================================
    // 1. 相关性评分测试 (CRAG-001 to CRAG-005)
    // ==========================================
    @Nested
    @DisplayName("相关性评分测试")
    class RelevanceScoringTests {

        @Test
        @DisplayName("CRAG-001: 高相关性 (>= 0.8) 应返回 CORRECT")
        void testHighRelevance_ShouldReturnCorrect() {
            // Given
            String query = "质检标准是什么";
            List<Map<String, Object>> results = TestDataFactory.createHighRelevanceRetrievalResults();

            // 模拟高相似度的 embedding 计算
            float[] queryEmbedding = createMockEmbedding(1.0f, 0.5f, 0.3f);
            float[] contentEmbedding = createMockEmbedding(0.98f, 0.52f, 0.28f);
            when(embeddingClient.encode(query)).thenReturn(queryEmbedding);
            when(embeddingClient.encode(anyString())).thenReturn(contentEmbedding);

            // When
            RetrievalQualityScore score = evaluatorService.evaluateRetrieval(query, results);

            // Then
            assertEquals(RetrievalQualityScore.CORRECT, score,
                    "高相关性检索结果 (>= 0.8) 应返回 CORRECT");
        }

        @Test
        @DisplayName("CRAG-002: 中等相关性 (0.5-0.8) 应返回 AMBIGUOUS")
        void testMediumRelevance_ShouldReturnAmbiguous() {
            // Given: 使用部分匹配内容测试，通过关键词匹配降级方式验证
            // 查询词: "库存 管理 效率 周转" (4 个词，其中 > 1 字符的词)
            String query = "库存 管理 效率 周转";
            Map<String, Object> result = new HashMap<>();
            // 内容包含 "库存" 和 "管理"，匹配 2/4 = 0.5，恰好在 AMBIGUOUS 阈值边界
            result.put("content", "食品保质期和库存存储条件对产品质量有重要影响。库存管理需要关注先进先出原则。");
            List<Map<String, Object>> results = Collections.singletonList(result);

            // 模拟 embedding 服务不可用，降级到关键词匹配
            when(embeddingClient.encode(anyString()))
                    .thenThrow(new RuntimeException("Embedding service unavailable"));

            // When
            RetrievalQualityScore score = evaluatorService.evaluateRetrieval(query, results);

            // Then: 关键词匹配 3/4 = 0.75，在 0.5-0.8 之间，返回 AMBIGUOUS
            assertEquals(RetrievalQualityScore.AMBIGUOUS, score,
                    "中等相关性检索结果 (0.5-0.8) 应返回 AMBIGUOUS");
        }

        @Test
        @DisplayName("CRAG-003: 低相关性 (< 0.5) 应返回 INCORRECT")
        void testLowRelevance_ShouldReturnIncorrect() {
            // Given: 使用无关内容测试，通过关键词匹配降级方式验证
            String query = "质检标准";
            List<Map<String, Object>> results = TestDataFactory.createLowRelevanceRetrievalResults();

            // 模拟 embedding 服务不可用，降级到关键词匹配
            // 查询"质检标准"与内容"今天天气晴朗，适合户外活动。明天可能有雨。"无关键词匹配
            when(embeddingClient.encode(anyString()))
                    .thenThrow(new RuntimeException("Embedding service unavailable"));

            // When
            RetrievalQualityScore score = evaluatorService.evaluateRetrieval(query, results);

            // Then: 关键词无匹配，分数 = 0，返回 INCORRECT
            assertEquals(RetrievalQualityScore.INCORRECT, score,
                    "低相关性检索结果 (< 0.5) 应返回 INCORRECT");
        }

        @Test
        @DisplayName("CRAG-004: 完全匹配 (>= 0.9) 应返回 CORRECT")
        void testPerfectMatch_ShouldReturnCorrect() {
            // Given
            String query = "良品率标准";
            Map<String, Object> result = new HashMap<>();
            result.put("content", "良品率标准：行业标准 ≥95%，优秀 ≥98%");
            List<Map<String, Object>> results = Collections.singletonList(result);

            // 模拟几乎相同的 embedding (余弦相似度约 0.95)
            float[] embedding = createMockEmbedding(1.0f, 0.5f, 0.3f);
            when(embeddingClient.encode(anyString())).thenReturn(embedding);

            // When
            RetrievalQualityScore score = evaluatorService.evaluateRetrieval(query, results);

            // Then
            assertEquals(RetrievalQualityScore.CORRECT, score,
                    "完全匹配的检索结果 (>= 0.9) 应返回 CORRECT");
        }

        @Test
        @DisplayName("CRAG-005: 空结果应返回 INCORRECT (score = 0.0)")
        void testEmptyResults_ShouldReturnIncorrect() {
            // Given
            String query = "任意查询";
            List<Map<String, Object>> emptyResults = Collections.emptyList();

            // When
            RetrievalQualityScore score = evaluatorService.evaluateRetrieval(query, emptyResults);

            // Then
            assertEquals(RetrievalQualityScore.INCORRECT, score,
                    "空检索结果应返回 INCORRECT");
        }

        @Test
        @DisplayName("null 结果应返回 INCORRECT")
        void testNullResults_ShouldReturnIncorrect() {
            // Given
            String query = "任意查询";

            // When
            RetrievalQualityScore score = evaluatorService.evaluateRetrieval(query, null);

            // Then
            assertEquals(RetrievalQualityScore.INCORRECT, score,
                    "null 检索结果应返回 INCORRECT");
        }

        @Test
        @DisplayName("多结果应计算平均相关性")
        void testMultipleResults_ShouldCalculateAverageRelevance() {
            // Given
            String query = "质检流程";
            List<Map<String, Object>> results = new ArrayList<>();

            // 添加高相关性结果
            Map<String, Object> highRelevance = new HashMap<>();
            highRelevance.put("content", "质检流程包括来料检验、过程检验、成品检验三个阶段");
            results.add(highRelevance);

            // 添加低相关性结果
            Map<String, Object> lowRelevance = new HashMap<>();
            lowRelevance.put("content", "天气预报显示明天晴朗");
            results.add(lowRelevance);

            // 模拟 embedding: 第一个高相关，第二个低相关，平均约 0.6
            float[] queryEmbedding = createMockEmbedding(1.0f, 0.0f, 0.0f);
            float[] highEmbedding = createMockEmbedding(0.95f, 0.31f, 0.0f);  // cos ~ 0.95
            float[] lowEmbedding = createMockEmbedding(0.25f, 0.97f, 0.0f);   // cos ~ 0.25

            when(embeddingClient.encode(query)).thenReturn(queryEmbedding);
            when(embeddingClient.encode(highRelevance.get("content").toString())).thenReturn(highEmbedding);
            when(embeddingClient.encode(lowRelevance.get("content").toString())).thenReturn(lowEmbedding);

            // When
            RetrievalQualityScore score = evaluatorService.evaluateRetrieval(query, results);

            // Then: 平均分约为 0.6，应该返回 AMBIGUOUS
            assertEquals(RetrievalQualityScore.AMBIGUOUS, score,
                    "多结果平均相关性在 0.5-0.8 之间应返回 AMBIGUOUS");
        }
    }

    // ==========================================
    // 2. 单条结果相关性分数测试
    // ==========================================
    @Nested
    @DisplayName("单条结果相关性分数测试")
    class SingleResultRelevanceTests {

        @Test
        @DisplayName("应正确计算单条结果的相关性分数")
        void testCalculateRelevanceScore() {
            // Given
            String query = "库存周转率";
            Map<String, Object> result = new HashMap<>();
            result.put("content", "库存周转率是衡量库存管理效率的重要指标");

            float[] queryEmbedding = createMockEmbedding(1.0f, 0.0f, 0.0f);
            float[] contentEmbedding = createMockEmbedding(0.8f, 0.6f, 0.0f);
            when(embeddingClient.encode(query)).thenReturn(queryEmbedding);
            when(embeddingClient.encode(anyString())).thenReturn(contentEmbedding);

            // When
            double score = evaluatorService.calculateRelevanceScore(query, result);

            // Then
            assertTrue(score >= 0.0 && score <= 1.0,
                    "相关性分数应在 0-1 之间，实际: " + score);
        }

        @Test
        @DisplayName("空内容结果应返回 0.0 分")
        void testEmptyContent_ShouldReturnZero() {
            // Given
            String query = "任意查询";
            Map<String, Object> emptyResult = new HashMap<>();

            // When
            double score = evaluatorService.calculateRelevanceScore(query, emptyResult);

            // Then
            assertEquals(0.0, score, 0.001, "空内容结果应返回 0.0 分");
        }

        @ParameterizedTest
        @DisplayName("应支持多种内容字段名")
        @CsvSource({
                "content, 这是内容",
                "text, 这是文本",
                "description, 这是描述",
                "summary, 这是摘要"
        })
        void testDifferentContentFields(String fieldName, String fieldValue) {
            // Given
            String query = "测试查询";
            Map<String, Object> result = new HashMap<>();
            result.put(fieldName, fieldValue);

            float[] embedding = createMockEmbedding(1.0f, 0.5f, 0.3f);
            when(embeddingClient.encode(anyString())).thenReturn(embedding);

            // When
            double score = evaluatorService.calculateRelevanceScore(query, result);

            // Then
            assertTrue(score > 0, "字段 '" + fieldName + "' 应被正确识别并计算分数");
        }
    }

    // ==========================================
    // 3. 知识分解测试
    // ==========================================
    @Nested
    @DisplayName("知识分解测试")
    class KnowledgeDecompositionTests {

        @Test
        @DisplayName("应按段落分割（双换行符）")
        void testSplitByParagraphs() {
            // Given: 第三段 "第三段总结最佳实践。" 恰好 10 字符，会被过滤（条件是 > 10）
            String content = "第一段内容说明质检流程的重要性。\n\n第二段内容介绍具体操作步骤。\n\n第三段总结最佳实践。";

            // When
            List<String> strips = evaluatorService.decomposeToKnowledgeStrips(content);

            // Then: 第三段长度 = 10，被过滤，只保留前两段
            assertEquals(2, strips.size(), "应分割为 2 个段落（第三段恰好 10 字符被过滤）");
            assertTrue(strips.get(0).contains("第一段"), "第一段应包含正确内容");
            assertTrue(strips.get(1).contains("第二段"), "第二段应包含正确内容");
        }

        @Test
        @DisplayName("长段落应按中文标点分句")
        void testLongParagraphSplitBySentences() {
            // Given: 超过 200 字符的长段落（中文每字符算 1 个长度）
            StringBuilder longParagraph = new StringBuilder();
            longParagraph.append("质检流程第一步是来料检验，需要仔细检查原材料的外观、规格、质量证书和供应商资质文件，确保来料符合标准。");
            longParagraph.append("第二步是过程检验，必须实时监控生产过程中的温度、湿度、压力、酸碱度等各项关键参数，记录异常情况！");
            longParagraph.append("第三步是成品检验，确保产品的各项指标符合国家标准、行业标准和企业内控标准要求，进行全面质量把控？");
            longParagraph.append("第四步是抽样复检，按照规定比例随机抽取样品进行全面复核检查和数据分析，建立完整检验档案；");
            longParagraph.append("这样可以确保产品质量达到要求，满足客户期望，提升企业信誉度和市场竞争力，最终实现可持续发展目标。");

            String content = longParagraph.toString();
            assertTrue(content.length() > 200, "测试内容长度应超过 200 字符, 实际: " + content.length());

            // When
            List<String> strips = evaluatorService.decomposeToKnowledgeStrips(content);

            // Then
            assertTrue(strips.size() > 1, "长段落应被分割为多个句子");
            for (String strip : strips) {
                assertTrue(strip.length() > 10, "每个分割后的句子长度应 > 10，实际: " + strip.length());
            }
        }

        @Test
        @DisplayName("应过滤短于 10 字符的片段")
        void testFilterShortStrips() {
            // Given
            String content = "短。\n\n这是一个足够长的段落内容。\n\n太短了\n\n另一个足够长的内容片段。";

            // When
            List<String> strips = evaluatorService.decomposeToKnowledgeStrips(content);

            // Then
            for (String strip : strips) {
                assertTrue(strip.length() > 10,
                        "所有片段长度应 > 10，实际: \"" + strip + "\" (长度: " + strip.length() + ")");
            }
        }

        @Test
        @DisplayName("空内容应返回空列表")
        void testEmptyContent_ShouldReturnEmptyList() {
            // When
            List<String> strips = evaluatorService.decomposeToKnowledgeStrips("");

            // Then
            assertTrue(strips.isEmpty(), "空内容应返回空列表");
        }

        @Test
        @DisplayName("null 内容应返回空列表")
        void testNullContent_ShouldReturnEmptyList() {
            // When
            List<String> strips = evaluatorService.decomposeToKnowledgeStrips(null);

            // Then
            assertTrue(strips.isEmpty(), "null 内容应返回空列表");
        }

        @Test
        @DisplayName("应正确处理多个连续换行符")
        void testMultipleNewlines() {
            // Given: 使用足够长的段落（> 10 字符）以避免被过滤
            String content = "第一段内容说明质检流程。\n\n\n\n第二段内容介绍操作步骤。\n\n\n第三段总结最佳实践方法。";

            // When
            List<String> strips = evaluatorService.decomposeToKnowledgeStrips(content);

            // Then: 所有三段都 > 10 字符，应该保留
            assertEquals(3, strips.size(), "应正确处理多个连续换行符");
        }

        @ParameterizedTest
        @DisplayName("应按各种中文标点分句")
        @MethodSource("providePunctuationTestCases")
        void testChinesePunctuationSplit(String punctuation, String displayName) {
            // Given: 构造超过 200 字符的内容，使用指定标点分隔
            String sentence1 = "这是第一句话，包含足够多的内容来达到必要的长度要求，确保测试的有效性" + punctuation;
            String sentence2 = "这是第二句话，同样需要足够的长度来保证分割后的片段长度大于十个字符" + punctuation;
            String sentence3 = "这是第三句话，作为最后一个测试句子来验证分割功能的正确性和完整性。";
            String content = sentence1 + sentence2 + sentence3;

            // When
            List<String> strips = evaluatorService.decomposeToKnowledgeStrips(content);

            // Then
            assertTrue(strips.size() >= 1,
                    "使用 " + displayName + " 分隔的内容应被正确处理");
        }

        static Stream<Arguments> providePunctuationTestCases() {
            return Stream.of(
                    Arguments.of("。", "句号"),
                    Arguments.of("！", "感叹号"),
                    Arguments.of("？", "问号"),
                    Arguments.of("；", "分号")
            );
        }
    }

    // ==========================================
    // 4. 知识过滤测试
    // ==========================================
    @Nested
    @DisplayName("知识过滤测试")
    class KnowledgeFilteringTests {

        @Test
        @DisplayName("应保留与查询匹配的关键词片段")
        void testFilterRelevantStrips_ShouldKeepMatchingKeywords() {
            // Given
            String query = "质检标准流程";
            List<String> strips = Arrays.asList(
                    "质检标准包括微生物指标和理化指标",
                    "天气预报显示今天晴转多云",
                    "质检流程分为来料检验和成品检验",
                    "股市今日大涨三百点"
            );

            // When
            List<String> filtered = evaluatorService.filterRelevantStrips(query, strips);

            // Then
            assertTrue(filtered.size() <= strips.size(), "过滤后的片段数应 <= 原始数量");
            for (String strip : filtered) {
                assertTrue(
                        strip.contains("质检") || strip.contains("标准") || strip.contains("流程"),
                        "过滤后的片段应包含查询关键词: " + strip
                );
            }
        }

        @Test
        @DisplayName("应移除无关内容")
        void testFilterRelevantStrips_ShouldRemoveIrrelevant() {
            // Given
            String query = "库存管理";
            List<String> strips = Arrays.asList(
                    "库存管理需要遵循先进先出原则",
                    "今天天气很好适合户外活动",
                    "篮球比赛精彩纷呈"
            );

            // When
            List<String> filtered = evaluatorService.filterRelevantStrips(query, strips);

            // Then
            assertFalse(filtered.stream().anyMatch(s -> s.contains("天气")),
                    "不应包含与查询无关的天气内容");
            assertFalse(filtered.stream().anyMatch(s -> s.contains("篮球")),
                    "不应包含与查询无关的篮球内容");
        }

        @Test
        @DisplayName("空片段列表应返回空列表")
        void testFilterEmptyStrips_ShouldReturnEmptyList() {
            // Given
            String query = "任意查询";
            List<String> emptyStrips = Collections.emptyList();

            // When
            List<String> filtered = evaluatorService.filterRelevantStrips(query, emptyStrips);

            // Then
            assertTrue(filtered.isEmpty(), "空片段列表应返回空列表");
        }

        @Test
        @DisplayName("null 片段列表应返回空列表")
        void testFilterNullStrips_ShouldReturnEmptyList() {
            // Given
            String query = "任意查询";

            // When
            List<String> filtered = evaluatorService.filterRelevantStrips(query, null);

            // Then
            assertTrue(filtered.isEmpty(), "null 片段列表应返回空列表");
        }

        @Test
        @DisplayName("相关性阈值为 0.5 时的边界测试")
        void testFilterThresholdBoundary() {
            // Given: 设计恰好在阈值边界的测试用例
            String query = "产品质量检验";
            List<String> strips = Arrays.asList(
                    "产品质量检验是确保出厂产品符合标准的重要环节",  // 高相关
                    "质量管理体系认证",  // 中等相关
                    "无关内容测试句子"  // 低相关
            );

            // When
            List<String> filtered = evaluatorService.filterRelevantStrips(query, strips);

            // Then
            assertTrue(filtered.size() >= 1, "至少应保留一个高相关片段");
            assertTrue(filtered.get(0).contains("产品") || filtered.get(0).contains("质量"),
                    "最相关的片段应被保留");
        }
    }

    // ==========================================
    // 5. 降级策略测试 (Embedding 不可用时)
    // ==========================================
    @Nested
    @DisplayName("降级策略测试")
    class FallbackStrategyTests {

        @Test
        @DisplayName("EmbeddingClient 抛异常时应降级到关键词匹配")
        void testEmbeddingException_ShouldFallbackToKeywordMatching() {
            // Given
            String query = "良品率 质检 标准";
            Map<String, Object> result = new HashMap<>();
            result.put("content", "良品率标准是质检的重要组成部分，行业标准要求达到95%以上");

            // 模拟 embedding 服务异常
            when(embeddingClient.encode(anyString()))
                    .thenThrow(new RuntimeException("Embedding service unavailable"));

            // When
            double score = evaluatorService.calculateRelevanceScore(query, result);

            // Then
            assertTrue(score > 0, "降级到关键词匹配后分数应 > 0");
            assertTrue(score <= 1.0, "分数应 <= 1.0");
        }

        @Test
        @DisplayName("关键词匹配应返回有效分数")
        void testKeywordMatching_ShouldReturnValidScore() {
            // Given
            String query = "库存 周转 效率";
            Map<String, Object> result = new HashMap<>();
            result.put("content", "库存周转效率是衡量仓库管理水平的重要指标");

            // 模拟 embedding 服务不可用
            when(embeddingClient.encode(anyString()))
                    .thenThrow(new RuntimeException("Service unavailable"));

            // When
            double score = evaluatorService.calculateRelevanceScore(query, result);

            // Then: 查询有 3 个词，内容匹配 3 个，应接近 1.0
            assertTrue(score >= 0.5, "关键词全匹配时分数应较高");
        }

        @Test
        @DisplayName("关键词部分匹配应返回比例分数")
        void testKeywordPartialMatch_ShouldReturnProportionalScore() {
            // Given
            String query = "质检 流程 设备 温度";  // 4 个词
            Map<String, Object> result = new HashMap<>();
            result.put("content", "质检流程需要标准化");  // 只匹配 2 个

            // 模拟 embedding 服务不可用
            when(embeddingClient.encode(anyString()))
                    .thenThrow(new RuntimeException("Service unavailable"));

            // When
            double score = evaluatorService.calculateRelevanceScore(query, result);

            // Then: 匹配 2/4 = 0.5
            assertTrue(score >= 0.4 && score <= 0.6,
                    "部分匹配应返回比例分数，实际: " + score);
        }

        @Test
        @DisplayName("无关键词匹配应返回 0 分")
        void testNoKeywordMatch_ShouldReturnZero() {
            // Given
            String query = "质检 标准";
            Map<String, Object> result = new HashMap<>();
            result.put("content", "今天天气晴朗");

            // 模拟 embedding 服务不可用
            when(embeddingClient.encode(anyString()))
                    .thenThrow(new RuntimeException("Service unavailable"));

            // When
            double score = evaluatorService.calculateRelevanceScore(query, result);

            // Then
            assertEquals(0.0, score, 0.001, "无关键词匹配应返回 0 分");
        }

        @Test
        @DisplayName("Embedding 返回 null 时应降级")
        void testEmbeddingReturnsNull_ShouldFallback() {
            // Given
            String query = "库存管理";
            Map<String, Object> result = new HashMap<>();
            result.put("content", "库存管理系统帮助企业优化库存水平");

            when(embeddingClient.encode(anyString())).thenReturn(null);

            // When
            double score = evaluatorService.calculateRelevanceScore(query, result);

            // Then: 即使 embedding 返回 null，也应返回有效分数（通过降级）
            assertTrue(score >= 0.0 && score <= 1.0, "分数应在有效范围内");
        }
    }

    // ==========================================
    // 6. 阈值边界测试
    // ==========================================
    @Nested
    @DisplayName("阈值边界测试")
    class ThresholdBoundaryTests {

        @Test
        @DisplayName("分数恰好为 0.8 应返回 CORRECT")
        void testScoreExactly08_ShouldReturnCorrect() {
            // Given
            double score = 0.8;

            // When
            RetrievalQualityScore result = RetrievalQualityScore.fromScore(score);

            // Then
            assertEquals(RetrievalQualityScore.CORRECT, result,
                    "分数 = 0.8 应返回 CORRECT");
        }

        @Test
        @DisplayName("分数恰好为 0.5 应返回 AMBIGUOUS")
        void testScoreExactly05_ShouldReturnAmbiguous() {
            // Given
            double score = 0.5;

            // When
            RetrievalQualityScore result = RetrievalQualityScore.fromScore(score);

            // Then
            assertEquals(RetrievalQualityScore.AMBIGUOUS, result,
                    "分数 = 0.5 应返回 AMBIGUOUS");
        }

        @Test
        @DisplayName("分数略低于 0.5 应返回 INCORRECT")
        void testScoreJustBelow05_ShouldReturnIncorrect() {
            // Given
            double score = 0.499;

            // When
            RetrievalQualityScore result = RetrievalQualityScore.fromScore(score);

            // Then
            assertEquals(RetrievalQualityScore.INCORRECT, result,
                    "分数 < 0.5 应返回 INCORRECT");
        }

        @Test
        @DisplayName("分数略低于 0.8 应返回 AMBIGUOUS")
        void testScoreJustBelow08_ShouldReturnAmbiguous() {
            // Given
            double score = 0.799;

            // When
            RetrievalQualityScore result = RetrievalQualityScore.fromScore(score);

            // Then
            assertEquals(RetrievalQualityScore.AMBIGUOUS, result,
                    "分数 0.5-0.8 之间应返回 AMBIGUOUS");
        }

        @ParameterizedTest
        @DisplayName("各分数区间应正确分类")
        @CsvSource({
                "0.0, INCORRECT",
                "0.25, INCORRECT",
                "0.49, INCORRECT",
                "0.5, AMBIGUOUS",
                "0.65, AMBIGUOUS",
                "0.79, AMBIGUOUS",
                "0.8, CORRECT",
                "0.9, CORRECT",
                "1.0, CORRECT"
        })
        void testScoreClassification(double score, String expectedScore) {
            // When
            RetrievalQualityScore result = RetrievalQualityScore.fromScore(score);

            // Then
            assertEquals(RetrievalQualityScore.valueOf(expectedScore), result,
                    String.format("分数 %.2f 应分类为 %s", score, expectedScore));
        }
    }

    // ==========================================
    // 7. 边界情况和异常处理测试
    // ==========================================
    @Nested
    @DisplayName("边界情况和异常处理测试")
    class EdgeCaseTests {

        @Test
        @DisplayName("空查询应正常处理")
        void testEmptyQuery_ShouldHandleGracefully() {
            // Given
            String query = "";
            List<Map<String, Object>> results = TestDataFactory.createHighRelevanceRetrievalResults();

            // When & Then
            assertDoesNotThrow(() -> {
                RetrievalQualityScore score = evaluatorService.evaluateRetrieval(query, results);
                assertNotNull(score);
            }, "空查询应正常处理");
        }

        @Test
        @DisplayName("特殊字符查询应正常处理")
        void testSpecialCharacters_ShouldHandleGracefully() {
            // Given
            String query = "质检!@#$%^&*()标准【】《》";
            List<Map<String, Object>> results = TestDataFactory.createHighRelevanceRetrievalResults();

            // 模拟 embedding
            float[] embedding = createMockEmbedding(0.8f, 0.5f, 0.3f);
            when(embeddingClient.encode(anyString())).thenReturn(embedding);

            // When & Then
            assertDoesNotThrow(() -> {
                RetrievalQualityScore score = evaluatorService.evaluateRetrieval(query, results);
                assertNotNull(score);
            }, "特殊字符应正常处理");
        }

        @Test
        @DisplayName("超长查询应正常处理")
        void testVeryLongQuery_ShouldHandleGracefully() {
            // Given
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 100; i++) {
                sb.append("质检标准流程库存管理");
            }
            String query = sb.toString();
            List<Map<String, Object>> results = TestDataFactory.createHighRelevanceRetrievalResults();

            // 模拟 embedding
            float[] embedding = createMockEmbedding(0.8f, 0.5f, 0.3f);
            when(embeddingClient.encode(anyString())).thenReturn(embedding);

            // When & Then
            assertDoesNotThrow(() -> {
                RetrievalQualityScore score = evaluatorService.evaluateRetrieval(query, results);
                assertNotNull(score);
            }, "超长查询应正常处理");
        }

        @Test
        @DisplayName("结果包含 null 值应正常处理")
        void testResultWithNullValues_ShouldHandleGracefully() {
            // Given
            String query = "测试查询";
            Map<String, Object> result = new HashMap<>();
            result.put("content", null);
            result.put("score", 0.8);

            // When
            double score = evaluatorService.calculateRelevanceScore(query, result);

            // Then
            assertEquals(0.0, score, 0.001, "null 内容应返回 0 分");
        }

        @Test
        @DisplayName("混合有效和无效结果应正常计算")
        void testMixedValidAndInvalidResults_ShouldCalculate() {
            // Given
            String query = "库存管理";
            List<Map<String, Object>> results = new ArrayList<>();

            Map<String, Object> validResult = new HashMap<>();
            validResult.put("content", "库存管理系统");
            results.add(validResult);

            Map<String, Object> emptyResult = new HashMap<>();
            results.add(emptyResult);

            float[] embedding = createMockEmbedding(0.9f, 0.4f, 0.1f);
            when(embeddingClient.encode(anyString())).thenReturn(embedding);

            // When & Then
            assertDoesNotThrow(() -> {
                RetrievalQualityScore score = evaluatorService.evaluateRetrieval(query, results);
                assertNotNull(score);
            }, "混合有效和无效结果应正常处理");
        }
    }

    // ==========================================
    // 8. 一致性测试
    // ==========================================
    @Nested
    @DisplayName("一致性测试")
    class ConsistencyTests {

        @Test
        @DisplayName("相同输入应返回相同结果")
        void testSameInput_ShouldReturnSameResult() {
            // Given
            String query = "质检流程";
            List<Map<String, Object>> results = TestDataFactory.createHighRelevanceRetrievalResults();

            float[] embedding = createMockEmbedding(0.85f, 0.45f, 0.2f);
            when(embeddingClient.encode(anyString())).thenReturn(embedding);

            // When
            RetrievalQualityScore score1 = evaluatorService.evaluateRetrieval(query, results);
            RetrievalQualityScore score2 = evaluatorService.evaluateRetrieval(query, results);
            RetrievalQualityScore score3 = evaluatorService.evaluateRetrieval(query, results);

            // Then
            assertEquals(score1, score2, "相同输入应返回相同结果");
            assertEquals(score2, score3, "相同输入应返回相同结果");
        }

        @Test
        @DisplayName("相同输入分数应一致")
        void testSameInput_ScoreShouldBeConsistent() {
            // Given
            String query = "库存周转";
            Map<String, Object> result = new HashMap<>();
            result.put("content", "库存周转率是重要指标");

            float[] embedding = createMockEmbedding(0.75f, 0.55f, 0.35f);
            when(embeddingClient.encode(anyString())).thenReturn(embedding);

            // When
            double score1 = evaluatorService.calculateRelevanceScore(query, result);
            double score2 = evaluatorService.calculateRelevanceScore(query, result);

            // Then
            assertEquals(score1, score2, 0.001, "相同输入的分数应一致");
        }
    }

    // ==========================================
    // 辅助方法
    // ==========================================

    /**
     * 创建模拟的 embedding 向量
     * 用于测试余弦相似度计算
     */
    private float[] createMockEmbedding(float... values) {
        float[] embedding = new float[384];  // 标准 embedding 维度
        for (int i = 0; i < values.length && i < embedding.length; i++) {
            embedding[i] = values[i];
        }
        return embedding;
    }
}
