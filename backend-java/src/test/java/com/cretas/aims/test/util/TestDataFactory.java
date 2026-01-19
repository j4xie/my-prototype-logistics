package com.cretas.aims.test.util;

import com.cretas.aims.dto.ai.AnalysisContext;
import com.cretas.aims.dto.ai.AnalysisResult;
import com.cretas.aims.dto.ai.AnalysisTopic;
import com.cretas.aims.dto.ai.AgentMessage;
import com.cretas.aims.dto.ai.QueryFeatures;
import com.cretas.aims.entity.AIAnalysisResult;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 测试数据工厂类
 * 提供各种测试场景所需的模拟数据
 */
public class TestDataFactory {

    private static final String DEFAULT_FACTORY_ID = "F001";
    private static final Long DEFAULT_USER_ID = 1L;
    private static final String DEFAULT_USER_ROLE = "factory_super_admin";

    /**
     * 创建测试用 AnalysisContext
     */
    public static AnalysisContext createTestContext(String userInput, AnalysisTopic topic) {
        return AnalysisContext.builder()
                .userInput(userInput)
                .topic(topic)
                .factoryId(DEFAULT_FACTORY_ID)
                .userId(DEFAULT_USER_ID)
                .userRole(DEFAULT_USER_ROLE)
                .sessionId("test-session-" + UUID.randomUUID().toString().substring(0, 8))
                .parameters(new HashMap<>())
                .enableThinking(false)
                .thinkingBudget(0)
                .build();
    }

    /**
     * 创建带自定义参数的 AnalysisContext
     */
    public static AnalysisContext createTestContext(String userInput, AnalysisTopic topic,
                                                     String factoryId, Long userId) {
        return AnalysisContext.builder()
                .userInput(userInput)
                .topic(topic)
                .factoryId(factoryId)
                .userId(userId)
                .userRole(DEFAULT_USER_ROLE)
                .sessionId("test-session-" + UUID.randomUUID().toString().substring(0, 8))
                .parameters(new HashMap<>())
                .enableThinking(false)
                .thinkingBudget(0)
                .build();
    }

    /**
     * 创建模拟的 AIAnalysisResult
     */
    public static AIAnalysisResult createMockAnalysisResult(String factoryId, String text,
                                                             LocalDateTime createdAt) {
        AIAnalysisResult result = new AIAnalysisResult();
        result.setId((long) (Math.random() * 1000000));
        result.setFactoryId(factoryId);
        result.setAnalysisText(text);
        result.setCreatedAt(createdAt);
        result.setExpiresAt(createdAt.plusDays(30));
        return result;
    }

    /**
     * 创建历史分析结果列表
     */
    public static List<AIAnalysisResult> createMockAnalysisHistory(String factoryId, int count) {
        List<AIAnalysisResult> history = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            LocalDateTime createdAt = LocalDateTime.now().minusDays(i + 1);
            String text = "分析报告 #" + (i + 1) + ": 良品率 " + (95 + i % 5) + "%，库存周转正常";
            history.add(createMockAnalysisResult(factoryId, text, createdAt));
        }
        return history;
    }

    /**
     * 创建成功的 AnalysisResult
     */
    public static AnalysisResult createSuccessfulAnalysisResult(AnalysisTopic topic) {
        return AnalysisResult.builder()
                .success(true)
                .formattedAnalysis("测试分析结果：当前状态良好，良品率达到98%")
                .dataSummary(Map.of(
                        "qualityRate", 98.0,
                        "inventoryTurnover", 10,
                        "status", "正常"
                ))
                .topic(topic)
                .toolsUsed(topic.getRelatedTools())
                .requiresHumanReview(false)
                .build();
    }

    /**
     * 创建需要人工审核的 AnalysisResult
     */
    public static AnalysisResult createHumanReviewRequiredResult(AnalysisTopic topic) {
        return AnalysisResult.builder()
                .success(true)
                .formattedAnalysis("复杂分析结果，建议人工审核")
                .dataSummary(new HashMap<>())
                .topic(topic)
                .toolsUsed(topic.getRelatedTools())
                .requiresHumanReview(true)
                .build();
    }

    /**
     * 创建失败的 AnalysisResult
     */
    public static AnalysisResult createFailedAnalysisResult(String errorMessage) {
        return AnalysisResult.builder()
                .success(false)
                .errorMessage(errorMessage)
                .requiresHumanReview(false)
                .build();
    }

    /**
     * 创建 AgentMessage
     */
    public static AgentMessage createAgentMessage(AnalysisContext context) {
        return AgentMessage.create(context);
    }

    /**
     * 创建带检索数据的 AgentMessage
     */
    public static AgentMessage createAgentMessageWithRetrievedData(AnalysisContext context,
                                                                    Map<String, Object> retrievedData) {
        AgentMessage message = AgentMessage.create(context);
        message.setRetrievedData(retrievedData);
        return message;
    }

    /**
     * 创建模拟的检索结果
     */
    public static List<Map<String, Object>> createMockRetrievalResults(String content, double score) {
        List<Map<String, Object>> results = new ArrayList<>();
        Map<String, Object> result = new HashMap<>();
        result.put("content", content);
        result.put("score", score);
        result.put("source", "test-knowledge-base");
        results.add(result);
        return results;
    }

    /**
     * 创建高相关性检索结果
     */
    public static List<Map<String, Object>> createHighRelevanceRetrievalResults() {
        return createMockRetrievalResults(
                "质检标准包括微生物指标（大肠杆菌、沙门氏菌）、理化指标（水分、灰分）、感官指标（色泽、气味）。" +
                        "良品率行业标准≥95%，优秀≥98%。",
                0.9
        );
    }

    /**
     * 创建中等相关性检索结果
     */
    public static List<Map<String, Object>> createMediumRelevanceRetrievalResults() {
        return createMockRetrievalResults(
                "食品保质期和存储条件对产品质量有重要影响。库存管理需要关注先进先出原则。",
                0.65
        );
    }

    /**
     * 创建低相关性检索结果
     */
    public static List<Map<String, Object>> createLowRelevanceRetrievalResults() {
        return createMockRetrievalResults(
                "今天天气晴朗，适合户外活动。明天可能有雨。",
                0.2
        );
    }

    /**
     * 创建 QueryFeatures（简单查询）
     */
    public static QueryFeatures createSimpleQueryFeatures() {
        return QueryFeatures.builder()
                .questionWordCount(0)
                .hasComparisonIndicator(false)
                .hasTimeRange(true)
                .hasCausalIndicator(false)
                .intentCategory("QUERY")
                .requiredToolCount(1)
                .isAnalysisRequest(false)
                .conversationDepth(1)
                .hasPriorContext(false)
                .build();
    }

    /**
     * 创建 QueryFeatures（复杂分析）
     */
    public static QueryFeatures createComplexQueryFeatures() {
        return QueryFeatures.builder()
                .questionWordCount(2)
                .hasComparisonIndicator(true)
                .hasTimeRange(true)
                .hasCausalIndicator(true)
                .intentCategory("ANALYSIS")
                .requiredToolCount(4)
                .isAnalysisRequest(true)
                .conversationDepth(3)
                .hasPriorContext(true)
                .build();
    }

    /**
     * 测试用户输入样本
     */
    public static class SampleInputs {
        // 简单查询
        public static final String SIMPLE_INVENTORY = "查询今天的库存";
        public static final String SIMPLE_STATUS = "设备状态";
        public static final String SIMPLE_GREETING = "你好";

        // 带时间范围
        public static final String WEEKLY_SHIPMENT = "查询这周的出货情况";
        public static final String MONTHLY_REPORT = "上月报表";
        public static final String RECENT_STATUS = "最近情况";

        // 比较分析
        public static final String COMPARE_SALES = "对比本周和上周的销售趋势";
        public static final String TREND_ANALYSIS = "分析产量变化趋势";

        // 因果分析
        public static final String CAUSAL_QUALITY = "为什么良品率下降了";
        public static final String REASON_ANALYSIS = "原因是什么导致了问题";

        // 综合分析
        public static final String COMPREHENSIVE_ANALYSIS = "分析本月销售下降原因并给出改进方案";
        public static final String PRODUCT_STATUS = "产品状态怎么样";

        // 深度分析
        public static final String DEEP_ANALYSIS = "对比分析近三个月各产品线的质检趋势，分析波动原因并预测下月情况";

        // 空输入
        public static final String EMPTY_INPUT = "";
    }

    /**
     * 测试用行业知识样本
     */
    public static class SampleKnowledge {
        public static final String PRODUCT_STATUS_KNOWLEDGE = """
                食品生产行业关键指标：
                - 良品率：行业标准 ≥95%，优秀 ≥98%
                - 库存周转：建议 7-14 天
                - 质检合格率：法规要求 100%
                - 保质期预警：建议提前 30% 时间预警
                """;

        public static final String QUALITY_ANALYSIS_KNOWLEDGE = """
                质检分析要点：
                - 微生物指标：大肠杆菌、沙门氏菌等
                - 理化指标：水分、灰分、重金属
                - 感官指标：色泽、气味、口感
                """;

        public static final String INVENTORY_STATUS_KNOWLEDGE = """
                库存管理要点：
                - 先进先出原则
                - 安全库存设置
                - 周转率监控
                - 临期预警机制
                """;
    }
}
