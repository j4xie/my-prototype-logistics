package com.cretas.aims.service.impl;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.IntentMatchResult.CandidateIntent;
import com.cretas.aims.dto.intent.IntentMatchResult.MatchMethod;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.LlmIntentFallbackClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

/**
 * LLM 意图识别 Fallback 客户端实现
 *
 * 调用 Python AI 服务的 /api/ai/intent/classify 端点进行 LLM 意图分类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@Service
public class LlmIntentFallbackClientImpl implements LlmIntentFallbackClient {

    @Value("${cretas.ai.service.url:http://localhost:8085}")
    private String aiServiceUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // 连接超时: 10秒
    private static final int CONNECT_TIMEOUT = 10_000;
    // 读取超时: 30秒 (LLM 调用可能较慢)
    private static final int READ_TIMEOUT = 30_000;

    @Override
    public IntentMatchResult classifyIntent(String userInput, List<AIIntentConfig> availableIntents, String factoryId) {
        log.info("Calling LLM fallback for intent classification: factoryId={}, input='{}'",
                 factoryId, truncate(userInput, 50));

        try {
            // 构建请求体
            Map<String, Object> requestBody = buildClassifyRequest(userInput, availableIntents, factoryId);

            // 调用 Python 端点
            String responseJson = callPythonEndpoint("/api/ai/intent/classify", requestBody);

            // 解析响应
            return parseClassifyResponse(responseJson, userInput, availableIntents);

        } catch (Exception e) {
            log.error("LLM intent classification failed: {}", e.getMessage(), e);
            // 返回空结果，不阻断流程
            return IntentMatchResult.empty(userInput);
        }
    }

    @Override
    public String generateClarificationQuestion(String userInput,
                                                  List<CandidateIntent> candidateIntents,
                                                  String factoryId) {
        log.info("Generating clarification question: factoryId={}, candidates={}",
                 factoryId, candidateIntents.size());

        try {
            // 构建请求体
            Map<String, Object> requestBody = buildClarifyRequest(userInput, candidateIntents, factoryId);

            // 调用 Python 端点
            String responseJson = callPythonEndpoint("/api/ai/intent/clarify", requestBody);

            // 解析响应
            return parseClarifyResponse(responseJson);

        } catch (Exception e) {
            log.error("Clarification question generation failed: {}", e.getMessage(), e);
            // 返回默认问题
            return generateDefaultClarificationQuestion(candidateIntents);
        }
    }

    @Override
    public boolean isHealthy() {
        try {
            String url = aiServiceUrl + "/api/ai/intent/health";
            URL urlObj = new URL(url);
            HttpURLConnection connection = (HttpURLConnection) urlObj.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5_000);
            connection.setReadTimeout(5_000);

            int responseCode = connection.getResponseCode();
            connection.disconnect();

            return responseCode == 200;
        } catch (Exception e) {
            log.warn("LLM service health check failed: {}", e.getMessage());
            return false;
        }
    }

    // ==================== 请求构建 ====================

    private Map<String, Object> buildClassifyRequest(String userInput,
                                                       List<AIIntentConfig> availableIntents,
                                                       String factoryId) {
        Map<String, Object> request = new HashMap<>();
        request.put("user_input", userInput);
        request.put("factory_id", factoryId);

        // 将意图配置转换为简化格式供 LLM 理解
        List<Map<String, Object>> intents = availableIntents.stream()
                .map(this::simplifyIntentConfig)
                .collect(Collectors.toList());
        request.put("available_intents", intents);

        return request;
    }

    private Map<String, Object> simplifyIntentConfig(AIIntentConfig config) {
        Map<String, Object> simplified = new HashMap<>();
        simplified.put("intent_code", config.getIntentCode());
        simplified.put("intent_name", config.getIntentName());
        simplified.put("intent_category", config.getIntentCategory());
        simplified.put("description", config.getDescription());
        // sampleQuestions field does not exist in AIIntentConfig, using keywords instead
        simplified.put("keywords", config.getKeywords());
        return simplified;
    }

    private Map<String, Object> buildClarifyRequest(String userInput,
                                                      List<CandidateIntent> candidateIntents,
                                                      String factoryId) {
        Map<String, Object> request = new HashMap<>();
        request.put("user_input", userInput);
        request.put("factory_id", factoryId);

        // 候选意图信息
        List<Map<String, Object>> candidates = candidateIntents.stream()
                .map(c -> {
                    Map<String, Object> candidate = new HashMap<>();
                    candidate.put("intent_code", c.getIntentCode());
                    candidate.put("intent_name", c.getIntentName());
                    candidate.put("description", c.getDescription());
                    candidate.put("confidence", c.getConfidence());
                    return candidate;
                })
                .collect(Collectors.toList());
        request.put("candidate_intents", candidates);

        return request;
    }

    // ==================== HTTP 调用 ====================

    private String callPythonEndpoint(String endpoint, Map<String, Object> requestBody) throws IOException {
        String url = aiServiceUrl + endpoint;
        log.debug("Calling Python endpoint: {}", url);

        URL urlObj = new URL(url);
        HttpURLConnection connection = (HttpURLConnection) urlObj.openConnection();

        try {
            // 设置请求属性
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Accept", "application/json");
            connection.setDoOutput(true);
            connection.setConnectTimeout(CONNECT_TIMEOUT);
            connection.setReadTimeout(READ_TIMEOUT);

            // 写入请求体
            String jsonBody = objectMapper.writeValueAsString(requestBody);
            log.debug("Request body: {}", truncate(jsonBody, 500));

            try (OutputStream os = connection.getOutputStream()) {
                byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            // 获取响应
            int responseCode = connection.getResponseCode();
            log.debug("Response code: {}", responseCode);

            if (responseCode >= 200 && responseCode < 300) {
                try (BufferedReader br = new BufferedReader(
                        new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                    StringBuilder response = new StringBuilder();
                    String responseLine;
                    while ((responseLine = br.readLine()) != null) {
                        response.append(responseLine.trim());
                    }
                    String result = response.toString();
                    log.debug("Response: {}", truncate(result, 500));
                    return result;
                }
            } else {
                // 读取错误响应
                try (BufferedReader br = new BufferedReader(
                        new InputStreamReader(connection.getErrorStream(), StandardCharsets.UTF_8))) {
                    StringBuilder errorResponse = new StringBuilder();
                    String responseLine;
                    while ((responseLine = br.readLine()) != null) {
                        errorResponse.append(responseLine.trim());
                    }
                    throw new IOException("HTTP error " + responseCode + ": " + errorResponse);
                }
            }
        } finally {
            connection.disconnect();
        }
    }

    // ==================== 响应解析 ====================

    @SuppressWarnings("unchecked")
    private IntentMatchResult parseClassifyResponse(String responseJson,
                                                     String userInput,
                                                     List<AIIntentConfig> availableIntents) throws IOException {
        Map<String, Object> response = objectMapper.readValue(responseJson,
                new TypeReference<Map<String, Object>>() {});

        // 检查响应状态
        Boolean success = (Boolean) response.get("success");
        if (success == null || !success) {
            String message = (String) response.getOrDefault("message", "Unknown error");
            log.warn("LLM classification returned failure: {}", message);
            return IntentMatchResult.empty(userInput);
        }

        Map<String, Object> data = (Map<String, Object>) response.get("data");
        if (data == null) {
            return IntentMatchResult.empty(userInput);
        }

        // 提取匹配的意图代码
        String matchedIntentCode = (String) data.get("matched_intent_code");
        Double confidence = ((Number) data.getOrDefault("confidence", 0.0)).doubleValue();
        String reasoning = (String) data.get("reasoning");

        // 查找对应的意图配置
        AIIntentConfig matchedConfig = null;
        if (matchedIntentCode != null) {
            matchedConfig = availableIntents.stream()
                    .filter(c -> matchedIntentCode.equals(c.getIntentCode()))
                    .findFirst()
                    .orElse(null);
        }

        if (matchedConfig == null) {
            log.warn("LLM returned unknown intent code: {}", matchedIntentCode);
            return IntentMatchResult.empty(userInput);
        }

        // 构建候选意图列表
        List<CandidateIntent> candidates = new ArrayList<>();
        candidates.add(CandidateIntent.builder()
                .intentCode(matchedConfig.getIntentCode())
                .intentName(matchedConfig.getIntentName())
                .intentCategory(matchedConfig.getIntentCategory())
                .confidence(confidence)
                .matchScore((int) (confidence * 100))
                .matchedKeywords(List.of())
                .matchMethod(MatchMethod.LLM)
                .description(matchedConfig.getDescription())
                .build());

        // 提取其他候选（如果有）
        List<Map<String, Object>> otherCandidates = (List<Map<String, Object>>) data.get("other_candidates");
        if (otherCandidates != null) {
            for (Map<String, Object> candidate : otherCandidates) {
                String code = (String) candidate.get("intent_code");
                Double candConfidence = ((Number) candidate.getOrDefault("confidence", 0.0)).doubleValue();

                AIIntentConfig candConfig = availableIntents.stream()
                        .filter(c -> code.equals(c.getIntentCode()))
                        .findFirst()
                        .orElse(null);

                if (candConfig != null) {
                    candidates.add(CandidateIntent.builder()
                            .intentCode(candConfig.getIntentCode())
                            .intentName(candConfig.getIntentName())
                            .intentCategory(candConfig.getIntentCategory())
                            .confidence(candConfidence)
                            .matchScore((int) (candConfidence * 100))
                            .matchedKeywords(List.of())
                            .matchMethod(MatchMethod.LLM)
                            .description(candConfig.getDescription())
                            .build());
                }
            }
        }

        // 判断是否为强信号 (LLM置信度 >= 0.8 视为强信号)
        boolean isStrongSignal = confidence >= 0.8;

        // 判断是否需要确认 (LLM置信度 < 0.7 或敏感操作需要确认)
        // sensitivityLevel is a String field, not an enum
        String sensitivityLevel = matchedConfig.getSensitivityLevel();
        boolean requiresConfirmation = confidence < 0.7
                || "HIGH".equals(sensitivityLevel)
                || "CRITICAL".equals(sensitivityLevel);

        return IntentMatchResult.builder()
                .bestMatch(matchedConfig)
                .topCandidates(candidates)
                .confidence(confidence)
                .matchMethod(MatchMethod.LLM)
                .matchedKeywords(List.of())
                .isStrongSignal(isStrongSignal)
                .requiresConfirmation(requiresConfirmation)
                .userInput(userInput)
                .clarificationQuestion(reasoning)  // LLM 的推理可作为说明
                .build();
    }

    @SuppressWarnings("unchecked")
    private String parseClarifyResponse(String responseJson) throws IOException {
        Map<String, Object> response = objectMapper.readValue(responseJson,
                new TypeReference<Map<String, Object>>() {});

        Boolean success = (Boolean) response.get("success");
        if (success == null || !success) {
            return null;
        }

        Map<String, Object> data = (Map<String, Object>) response.get("data");
        if (data == null) {
            return null;
        }

        return (String) data.get("clarification_question");
    }

    // ==================== 工具方法 ====================

    private String generateDefaultClarificationQuestion(List<CandidateIntent> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return "请问您具体想要执行什么操作？";
        }

        StringBuilder sb = new StringBuilder("请问您想要：\n");
        for (int i = 0; i < Math.min(candidates.size(), 3); i++) {
            CandidateIntent candidate = candidates.get(i);
            sb.append(String.format("%d. %s (%s)\n", i + 1, candidate.getIntentName(), candidate.getDescription()));
        }
        sb.append("\n请选择或描述您的需求。");
        return sb.toString();
    }

    private String truncate(String str, int maxLength) {
        if (str == null) return "null";
        if (str.length() <= maxLength) return str;
        return str.substring(0, maxLength) + "...";
    }
}
