package com.cretas.aims.service.handler;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.config.DashScopeConfig;
import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 食品知识库意图处理器
 *
 * 处理 FOOD_KNOWLEDGE 分类的意图:
 * - FOOD_KNOWLEDGE_QUERY: 通用食品安全知识查询
 *
 * 流程: 用户查询 → NER实体提取 → RAG向量检索 → 格式化回答
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-12
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FoodKnowledgeIntentHandler implements IntentHandler {

    private final PythonSmartBIClient pythonClient;

    private DashScopeClient dashScopeClient;
    private DashScopeConfig dashScopeConfig;

    @Autowired(required = false)
    public void setDashScopeClient(DashScopeClient client) {
        this.dashScopeClient = client;
    }

    @Autowired(required = false)
    public void setDashScopeConfig(DashScopeConfig config) {
        this.dashScopeConfig = config;
    }

    @Override
    public String getSupportedCategory() {
        return "FOOD_KNOWLEDGE";
    }

    private static final String FALLBACK_MESSAGE = "食品知识库服务暂时不可用，请稍后再试。" +
            "您也可以参考国家食品安全标准(GB标准)获取相关信息。";

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {
        String userInput = request.getUserInput();
        log.info("FoodKnowledgeIntentHandler处理: query='{}', factoryId={}, userId={}",
                userInput, factoryId, userId);

        long startTime = System.currentTimeMillis();

        // Pre-check: Python 服务是否可用
        if (!pythonClient.isAvailable()) {
            log.warn("食品知识库Python服务不可用，返回降级响应: query='{}'", userInput);
            return buildFallbackResponse(intentConfig, userInput);
        }

        try {
            // Step 1: NER实体提取 (非阻塞，用于增强检索)
            Map<String, Object> nerResult = null;
            try {
                nerResult = pythonClient.extractFoodEntities(userInput);
                if (nerResult != null && Boolean.TRUE.equals(nerResult.get("success"))) {
                    log.debug("NER提取到 {} 个实体", nerResult.get("entity_count"));
                }
            } catch (Exception e) {
                log.debug("NER提取失败（非致命）: {}", e.getMessage());
            }

            // Step 2: RAG向量检索
            Map<String, Object> ragResult = pythonClient.queryFoodKnowledge(userInput, null, 5);
            if (ragResult == null || !Boolean.TRUE.equals(ragResult.get("success"))) {
                String errorMsg = ragResult != null ? String.valueOf(ragResult.get("message")) : "服务不可用";
                log.warn("RAG查询失败: {}", errorMsg);
                return buildFallbackResponse(intentConfig, userInput);
            }

            // Step 3: 提取检索结果
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> documents = (List<Map<String, Object>>) ragResult.get("data");
            int docCount = documents != null ? documents.size() : 0;

            if (docCount == 0) {
                return buildNoResultResponse(intentConfig, userInput);
            }

            // Step 4: 构建格式化回答
            String formattedAnswer = buildFormattedAnswer(userInput, documents, nerResult);
            List<Map<String, Object>> citations = buildCitations(documents);

            long latency = System.currentTimeMillis() - startTime;
            log.info("食品知识库查询完成: query='{}', docs={}, latency={}ms", userInput, docCount, latency);

            // 构建响应数据
            Map<String, Object> responseData = new LinkedHashMap<>();
            responseData.put("answer", formattedAnswer);
            responseData.put("citations", citations);
            responseData.put("documentCount", docCount);
            responseData.put("query", userInput);
            responseData.put("latencyMs", latency);
            if (nerResult != null && nerResult.get("entities") != null) {
                responseData.put("entities", nerResult.get("entities"));
            }

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("FOOD_KNOWLEDGE")
                    .status("SUCCESS")
                    .message(formattedAnswer)
                    .resultData(responseData)
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("食品知识库处理异常: query='{}', error={}", userInput, e.getMessage(), e);
            return buildFallbackResponse(intentConfig, userInput);
        }
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        return handle(factoryId, request, intentConfig, userId, userRole);
    }

    /**
     * 构建格式化回答
     */
    @SuppressWarnings("unchecked")
    private String buildFormattedAnswer(String query, List<Map<String, Object>> documents,
                                         Map<String, Object> nerResult) {
        StringBuilder sb = new StringBuilder();

        // 主回答：基于检索到的文档内容
        Map<String, Object> topDoc = documents.get(0);
        double topScore = getDoubleValue(topDoc, "similarity");

        if (topScore >= 0.80) {
            // 高相似度：直接使用文档内容作为核心回答
            sb.append(getStringValue(topDoc, "content"));
        } else {
            // 中等相似度：综合多文档生成回答
            sb.append("根据食品安全知识库的相关资料：\n\n");
            for (int i = 0; i < Math.min(documents.size(), 3); i++) {
                Map<String, Object> doc = documents.get(i);
                String title = getStringValue(doc, "title");
                String content = getStringValue(doc, "content");
                // 截取前500字
                if (content.length() > 500) {
                    content = content.substring(0, 500) + "...";
                }
                sb.append("**[文档").append(i + 1).append("] ").append(title).append("**\n");
                sb.append(content).append("\n\n");
            }
        }

        // 添加引用来源
        sb.append("\n---\n**参考来源：**\n");
        for (int i = 0; i < Math.min(documents.size(), 5); i++) {
            Map<String, Object> doc = documents.get(i);
            String title = getStringValue(doc, "title");
            String source = getStringValue(doc, "source");
            String category = getStringValue(doc, "category");
            double score = getDoubleValue(doc, "similarity");
            sb.append(String.format("- [%d] %s", i + 1, title));
            if (!source.isEmpty()) {
                sb.append(" (").append(source).append(")");
            }
            sb.append(String.format(" [相似度: %.0f%%]", score * 100));
            sb.append("\n");
        }

        return sb.toString();
    }

    /**
     * 构建引用列表
     */
    private List<Map<String, Object>> buildCitations(List<Map<String, Object>> documents) {
        List<Map<String, Object>> citations = new ArrayList<>();
        for (int i = 0; i < Math.min(documents.size(), 5); i++) {
            Map<String, Object> doc = documents.get(i);
            Map<String, Object> citation = new LinkedHashMap<>();
            citation.put("index", i + 1);
            citation.put("title", getStringValue(doc, "title"));
            citation.put("source", getStringValue(doc, "source"));
            citation.put("category", getStringValue(doc, "category"));
            citation.put("similarity", getDoubleValue(doc, "similarity"));
            citations.add(citation);
        }
        return citations;
    }

    private IntentExecuteResponse buildErrorResponse(AIIntentConfig intentConfig, String errorMsg) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("FOOD_KNOWLEDGE")
                .status("FAILED")
                .message("食品知识库查询失败: " + errorMsg)
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse buildFallbackResponse(AIIntentConfig intentConfig, String query) {
        Map<String, Object> responseData = new LinkedHashMap<>();
        responseData.put("query", query);
        responseData.put("fallback", true);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("FOOD_KNOWLEDGE")
                .status("FALLBACK")
                .message(FALLBACK_MESSAGE)
                .resultData(responseData)
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse buildNoResultResponse(AIIntentConfig intentConfig, String query) {
        // 尝试 LLM 兜底：RAG 无匹配时，用通用 LLM 回答食品知识问题
        if (dashScopeClient != null && dashScopeConfig != null && dashScopeConfig.isAvailable()) {
            try {
                String systemPrompt = "你是一名资深食品安全专家和食品工程师。请根据中国食品安全标准(GB标准)和行业最佳实践，"
                        + "专业、准确、实用地回答用户的食品相关问题。回答应包含：\n"
                        + "1. 核心工艺要点或安全要求\n"
                        + "2. 关键参数(温度、时间、浓度等)\n"
                        + "3. 相关标准或法规依据(如有)\n"
                        + "回答控制在500字以内，使用markdown格式。";
                String llmAnswer = dashScopeClient.chat(systemPrompt, query);
                if (llmAnswer != null && !llmAnswer.isBlank()) {
                    log.info("RAG无结果，LLM兜底回答: query='{}', answerLen={}", query, llmAnswer.length());

                    Map<String, Object> responseData = new LinkedHashMap<>();
                    responseData.put("answer", llmAnswer);
                    responseData.put("query", query);
                    responseData.put("source", "LLM_FALLBACK");
                    responseData.put("note", "此回答由AI生成，非知识库检索结果，仅供参考");

                    return IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentConfig.getIntentCode())
                            .intentName(intentConfig.getIntentName())
                            .intentCategory("FOOD_KNOWLEDGE")
                            .status("SUCCESS")
                            .message(llmAnswer + "\n\n> *注：此回答由AI生成，仅供参考。建议结合相关国标和行业规范使用。*")
                            .resultData(responseData)
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            } catch (Exception e) {
                log.warn("LLM兜底回答失败: query='{}', error={}", query, e.getMessage());
            }
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("FOOD_KNOWLEDGE")
                .status("SUCCESS")
                .message("抱歉，知识库中暂未找到与\"" + query + "\"相关的内容。您可以尝试换一种表述方式，或联系食品安全管理员获取帮助。")
                .executedAt(LocalDateTime.now())
                .build();
    }

    private String getStringValue(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : "";
    }

    private double getDoubleValue(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val instanceof Number) {
            return ((Number) val).doubleValue();
        }
        return 0.0;
    }
}
