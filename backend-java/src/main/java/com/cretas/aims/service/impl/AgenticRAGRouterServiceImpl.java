package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.ConsultationType;
import com.cretas.aims.dto.ai.RAGRouteResult;
import com.cretas.aims.service.AgenticRAGRouterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Agentic RAG 路由服务实现
 *
 * 实现 GENERAL_QUESTION 类型的细分路由逻辑。
 * 通过关键词匹配和规则引擎确定最优处理路径。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgenticRAGRouterServiceImpl implements AgenticRAGRouterService {

    // 追溯意图映射：关键词 -> 建议意图代码
    private static final Map<String, String> TRACEABILITY_INTENT_MAPPING = new HashMap<>();

    // 批次号正则模式
    private static final Pattern BATCH_PATTERN = Pattern.compile(
            "(?:批次号?|batch[\\s_-]?(?:no|number)?)[：:]*\\s*([A-Za-z0-9\\-_]+)",
            Pattern.CASE_INSENSITIVE
    );

    // 产品/原料名称正则模式
    private static final Pattern PRODUCT_PATTERN = Pattern.compile(
            "(?:产品|原料|物料|材料)[：:]*\\s*([\\u4e00-\\u9fa5A-Za-z0-9]+)"
    );

    // 追溯码/二维码模式
    private static final Pattern TRACE_CODE_PATTERN = Pattern.compile(
            "(?:追溯码|溯源码|二维码)[：:]*\\s*([A-Za-z0-9\\-_]+)"
    );

    static {
        // 初始化追溯意图映射
        TRACEABILITY_INTENT_MAPPING.put("追溯", "TRACEABILITY_QUERY");
        TRACEABILITY_INTENT_MAPPING.put("溯源", "TRACEABILITY_QUERY");
        TRACEABILITY_INTENT_MAPPING.put("追踪", "TRACEABILITY_QUERY");
        TRACEABILITY_INTENT_MAPPING.put("来源", "MATERIAL_BATCH_QUERY");
        TRACEABILITY_INTENT_MAPPING.put("产地", "MATERIAL_BATCH_QUERY");
        TRACEABILITY_INTENT_MAPPING.put("原产地", "MATERIAL_BATCH_QUERY");
        TRACEABILITY_INTENT_MAPPING.put("供应商", "SUPPLIER_QUERY");
        TRACEABILITY_INTENT_MAPPING.put("哪里来", "MATERIAL_BATCH_QUERY");
        TRACEABILITY_INTENT_MAPPING.put("谁供应", "SUPPLIER_QUERY");
        TRACEABILITY_INTENT_MAPPING.put("批次", "PROCESSING_BATCH_DETAIL");
    }

    @Override
    public RAGRouteResult route(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            log.debug("用户输入为空，返回 GENERAL 类型");
            return RAGRouteResult.general(userInput);
        }

        String normalizedInput = userInput.trim().toLowerCase();
        log.info("🔀 RAG路由开始: input='{}'",
                userInput.length() > 50 ? userInput.substring(0, 50) + "..." : userInput);

        // 计算各类型的匹配分数
        Map<ConsultationType, Integer> scores = new EnumMap<>(ConsultationType.class);
        Map<ConsultationType, List<String>> matchedKeywordsMap = new EnumMap<>(ConsultationType.class);

        for (ConsultationType type : ConsultationType.values()) {
            if (type == ConsultationType.GENERAL) {
                continue; // GENERAL 是默认类型，不参与评分
            }

            List<String> matchedKeywords = type.getKeywords().stream()
                    .filter(keyword -> normalizedInput.contains(keyword.toLowerCase()))
                    .collect(Collectors.toList());

            scores.put(type, matchedKeywords.size());
            matchedKeywordsMap.put(type, matchedKeywords);
        }

        // 找出最高分的类型
        ConsultationType bestType = ConsultationType.GENERAL;
        int maxScore = 0;

        for (Map.Entry<ConsultationType, Integer> entry : scores.entrySet()) {
            if (entry.getValue() > maxScore) {
                maxScore = entry.getValue();
                bestType = entry.getKey();
            }
        }

        // 计算置信度
        double confidence = calculateConfidence(maxScore, normalizedInput.length());

        // 构建路由结果
        RAGRouteResult.RAGRouteResultBuilder resultBuilder = RAGRouteResult.builder()
                .consultationType(bestType)
                .confidence(confidence)
                .matchedKeywords(matchedKeywordsMap.getOrDefault(bestType, Collections.emptyList()));

        // 根据类型添加额外信息
        switch (bestType) {
            case KNOWLEDGE_SEARCH:
                resultBuilder
                        .suggestedSearchQuery(generateSearchQuery(userInput, bestType))
                        .routingReason(String.format(
                                "检测到知识库检索关键词: %s",
                                matchedKeywordsMap.get(bestType)
                        ));
                break;

            case WEB_SEARCH:
                resultBuilder
                        .suggestedSearchQuery(generateSearchQuery(userInput, bestType))
                        .routingReason(String.format(
                                "检测到网络搜索关键词: %s",
                                matchedKeywordsMap.get(bestType)
                        ));
                break;

            case TRACEABILITY:
                Map<String, String> params = extractTraceabilityParams(userInput);
                String suggestedIntent = determineSuggestedIntent(
                        matchedKeywordsMap.get(bestType), params);
                resultBuilder
                        .suggestedIntent(suggestedIntent)
                        .extractedParams(params)
                        .routingReason(String.format(
                                "检测到追溯查询关键词: %s, 建议意图: %s",
                                matchedKeywordsMap.get(bestType), suggestedIntent
                        ));

                // 如果缺少必要参数，标记需要澄清
                if (params.isEmpty() || !params.containsKey("batchNumber")) {
                    resultBuilder
                            .needsClarification(true)
                            .clarificationQuestion("请提供要追溯的批次号或产品名称");
                }
                break;

            default:
                resultBuilder.routingReason("未匹配到特定咨询类型关键词，使用通用对话模式");
        }

        RAGRouteResult result = resultBuilder.build();

        log.info("✅ RAG路由完成: type={}, confidence={:.2f}, reason='{}'",
                result.getConsultationType(),
                result.getConfidence(),
                result.getRoutingReason());

        return result;
    }

    @Override
    public ConsultationType detectConsultationType(String userInput) {
        RAGRouteResult result = route(userInput);
        return result.getConsultationType();
    }

    @Override
    public String executeKnowledgeSearch(String userInput, RAGRouteResult routeResult) {
        log.info("📚 执行知识库检索: query='{}'", routeResult.getSuggestedSearchQuery());

        // TODO: 集成向量知识库检索
        // 当前返回占位符响应，后续集成 Elasticsearch 或向量数据库

        String searchQuery = routeResult.getSuggestedSearchQuery();
        if (searchQuery == null || searchQuery.isEmpty()) {
            searchQuery = userInput;
        }

        // 模拟知识库检索结果
        return String.format("""
                【知识库检索结果】

                查询: %s

                相关标准/规范:
                1. GB 14881-2013 《食品安全国家标准 食品生产通用卫生规范》
                2. GB/T 27306 《食品安全管理体系 餐饮业要求》
                3. HACCP 危害分析与关键控制点体系

                注意：以上为示例数据，实际检索功能待集成向量知识库。
                如需查询具体标准内容，请提供更详细的查询条件。
                """, searchQuery);
    }

    @Override
    public String executeWebSearch(String userInput, RAGRouteResult routeResult) {
        log.info("🌐 执行网络搜索: query='{}'", routeResult.getSuggestedSearchQuery());

        // TODO: 集成网络搜索 API (如 SerpAPI, Google Custom Search 等)
        // 当前返回占位符响应

        String searchQuery = routeResult.getSuggestedSearchQuery();
        if (searchQuery == null || searchQuery.isEmpty()) {
            searchQuery = userInput;
        }

        return String.format("""
                【网络搜索提示】

                您的查询: %s

                此类实时信息查询需要调用网络搜索API获取最新数据。
                当前系统暂未集成网络搜索功能，建议您:
                1. 访问食品安全相关政府网站查询最新政策
                2. 查看行业协会发布的市场报告
                3. 关注权威媒体的行业资讯

                后续版本将集成实时搜索功能。
                """, searchQuery);
    }

    @Override
    public Map<String, String> extractTraceabilityParams(String userInput) {
        Map<String, String> params = new HashMap<>();

        if (userInput == null || userInput.isEmpty()) {
            return params;
        }

        // 提取批次号
        Matcher batchMatcher = BATCH_PATTERN.matcher(userInput);
        if (batchMatcher.find()) {
            params.put("batchNumber", batchMatcher.group(1).trim());
        }

        // 提取产品名称
        Matcher productMatcher = PRODUCT_PATTERN.matcher(userInput);
        if (productMatcher.find()) {
            params.put("productName", productMatcher.group(1).trim());
        }

        // 提取追溯码
        Matcher traceMatcher = TRACE_CODE_PATTERN.matcher(userInput);
        if (traceMatcher.find()) {
            params.put("traceCode", traceMatcher.group(1).trim());
        }

        // 如果没有匹配到格式化的参数，尝试提取可能的标识符
        if (params.isEmpty()) {
            // 查找可能的批次号格式（字母数字混合）
            Pattern genericIdPattern = Pattern.compile("([A-Z]{2,4}[\\-_]?\\d{6,})", Pattern.CASE_INSENSITIVE);
            Matcher genericMatcher = genericIdPattern.matcher(userInput);
            if (genericMatcher.find()) {
                params.put("possibleId", genericMatcher.group(1));
            }
        }

        log.debug("提取的追溯参数: {}", params);
        return params;
    }

    @Override
    public String generateSearchQuery(String userInput, ConsultationType consultationType) {
        if (userInput == null || userInput.isEmpty()) {
            return "";
        }

        // 移除常见的疑问词和语气词
        String cleanedInput = userInput
                .replaceAll("(?i)(请问|请告诉我|我想知道|能不能|可以吗|吗|呢|啊|的)", "")
                .replaceAll("\\s+", " ")
                .trim();

        switch (consultationType) {
            case KNOWLEDGE_SEARCH:
                // 添加食品行业相关限定词
                return String.format("食品行业 %s 标准规范", cleanedInput);

            case WEB_SEARCH:
                // 添加时间限定词
                return String.format("%s 最新 2024", cleanedInput);

            default:
                return cleanedInput;
        }
    }

    /**
     * 计算路由置信度
     *
     * @param matchScore 关键词匹配数量
     * @param inputLength 输入长度
     * @return 置信度 (0.0 - 1.0)
     */
    private double calculateConfidence(int matchScore, int inputLength) {
        if (matchScore == 0) {
            return 0.0;
        }

        // 基础置信度
        double baseConfidence = Math.min(matchScore * 0.25, 0.9);

        // 输入长度修正因子（较长的输入可能包含更多上下文）
        double lengthFactor = Math.min(inputLength / 50.0, 1.0);

        // 最终置信度
        double confidence = baseConfidence * (0.7 + 0.3 * lengthFactor);

        return Math.min(confidence, 0.95);
    }

    /**
     * 确定建议的意图代码
     *
     * @param matchedKeywords 匹配的关键词
     * @param extractedParams 提取的参数
     * @return 建议的意图代码
     */
    private String determineSuggestedIntent(List<String> matchedKeywords, Map<String, String> extractedParams) {
        // 默认追溯意图
        String suggestedIntent = "TRACEABILITY_QUERY";

        // 根据匹配的关键词确定更具体的意图
        for (String keyword : matchedKeywords) {
            String intent = TRACEABILITY_INTENT_MAPPING.get(keyword);
            if (intent != null) {
                suggestedIntent = intent;
                break;
            }
        }

        // 如果提取到了批次号，使用批次详情意图
        if (extractedParams.containsKey("batchNumber")) {
            suggestedIntent = "PROCESSING_BATCH_DETAIL";
        }

        // 如果提取到了追溯码，使用追溯查询意图
        if (extractedParams.containsKey("traceCode")) {
            suggestedIntent = "TRACEABILITY_QUERY";
        }

        return suggestedIntent;
    }
}
