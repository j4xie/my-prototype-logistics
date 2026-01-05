package com.cretas.aims.service.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.config.DashScopeConfig;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.IntentMatchResult.CandidateIntent;
import com.cretas.aims.dto.intent.IntentMatchResult.MatchMethod;
import com.cretas.aims.dto.intent.LlmIntentClassifyResponse;
import com.cretas.aims.dto.intent.LlmIntentClassifyResponse.CandidateResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.intent.IntentOptimizationSuggestion;
import com.cretas.aims.entity.intent.IntentOptimizationSuggestion.SuggestionStatus;
import com.cretas.aims.exception.LlmSchemaValidationException;
import com.cretas.aims.exception.LlmSchemaValidationException.ValidationFailureType;
import com.cretas.aims.repository.IntentOptimizationSuggestionRepository;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.ConversationService;
import com.cretas.aims.service.LlmIntentFallbackClient;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * LLM 意图识别 Fallback 客户端实现
 *
 * 支持两种模式：
 * 1. Python 服务调用 (legacy) - 调用 /api/ai/intent/classify 端点
 * 2. DashScope 直接调用 (new) - 直接调用阿里云 DashScope API
 *
 * 通过配置开关 cretas.ai.dashscope.migration.intent-classify 控制
 *
 * 优化：使用 OkHttp 连接池提升性能
 * - 连接复用减少 TCP 握手开销
 * - 连接池管理提升并发性能
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2026-01-02
 */
@Slf4j
@Service
public class LlmIntentFallbackClientImpl implements LlmIntentFallbackClient {

    @Value("${cretas.ai.service.url:http://localhost:8085}")
    private String aiServiceUrl;

    @Value("${cretas.ai.intent.auto-create.enabled:true}")
    private boolean autoCreateIntentEnabled;

    @Value("${cretas.ai.intent.auto-create.min-confidence:0.6}")
    private double autoCreateMinConfidence;

    /**
     * 工厂级意图自动审批开关
     * 当开启时，工厂级别的 CREATE_INTENT 建议会自动通过并创建意图，无需手动审批
     * 平台级意图（factoryId 为 PLATFORM 或 null）仍需手动审批
     */
    @Value("${cretas.ai.intent.auto-create.factory-auto-approve:true}")
    private boolean factoryAutoApproveEnabled;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final OkHttpClient httpClient;

    private final DashScopeClient dashScopeClient;

    private final DashScopeConfig dashScopeConfig;

    private final IntentOptimizationSuggestionRepository suggestionRepository;

    private final AIIntentConfigRepository intentConfigRepository;

    private final ConversationService conversationService;

    private static final MediaType JSON_MEDIA_TYPE = MediaType.parse("application/json; charset=utf-8");

    @Value("${cretas.ai.conversation.threshold:0.3}")
    private double conversationThreshold;

    @Autowired
    public LlmIntentFallbackClientImpl(
            @Qualifier("aiServiceHttpClient") @Autowired(required = false) OkHttpClient aiServiceHttpClient,
            @Autowired(required = false) DashScopeClient dashScopeClient,
            @Autowired(required = false) DashScopeConfig dashScopeConfig,
            @Autowired(required = false) IntentOptimizationSuggestionRepository suggestionRepository,
            @Autowired(required = false) AIIntentConfigRepository intentConfigRepository,
            @Autowired(required = false) ConversationService conversationService) {
        // OkHttp 客户端
        if (aiServiceHttpClient != null) {
            this.httpClient = aiServiceHttpClient;
            log.info("Using configured aiServiceHttpClient with connection pool");
        } else {
            this.httpClient = new OkHttpClient.Builder()
                    .connectTimeout(10, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(10, TimeUnit.SECONDS)
                    .build();
            log.info("Using default OkHttpClient (no connection pool configured)");
        }

        // DashScope 客户端
        this.dashScopeClient = dashScopeClient;
        this.dashScopeConfig = dashScopeConfig;

        // 建议仓库
        this.suggestionRepository = suggestionRepository;

        // 意图配置仓库 (用于自动创建工厂级意图)
        this.intentConfigRepository = intentConfigRepository;

        // 多轮对话服务
        this.conversationService = conversationService;

        if (dashScopeConfig != null && dashScopeConfig.shouldUseDirect("intent-classify")) {
            log.info("DashScope direct intent classification ENABLED");
        } else {
            log.info("Using Python service for intent classification (DashScope direct: disabled)");
        }

        if (autoCreateIntentEnabled && suggestionRepository != null) {
            log.info("Auto-create intent suggestion ENABLED (minConfidence={})", autoCreateMinConfidence);
            if (factoryAutoApproveEnabled && intentConfigRepository != null) {
                log.info("Factory-level intent AUTO-APPROVE ENABLED - factory intents will be created directly without review");
            } else {
                log.info("Factory-level intent auto-approve DISABLED - all intents require manual review");
            }
        }

        if (conversationService != null) {
            log.info("Multi-turn conversation support ENABLED (threshold={})", 0.3);
        }
    }

    @Override
    public IntentMatchResult classifyIntent(String userInput, List<AIIntentConfig> availableIntents, String factoryId) {
        log.info("Calling LLM fallback for intent classification: factoryId={}, input='{}'",
                 factoryId, truncate(userInput, 50));

        // 根据配置选择调用方式
        if (shouldUseDashScopeDirect()) {
            return classifyIntentDirect(userInput, availableIntents, factoryId);
        } else {
            return classifyIntentViaPython(userInput, availableIntents, factoryId);
        }
    }

    /**
     * 带多轮对话支持的意图分类
     *
     * 当单次分类的置信度低于阈值 (默认30%) 时，启动多轮对话模式:
     * 1. 检查是否有活跃的对话会话
     * 2. 如果有，继续对话
     * 3. 如果没有，创建新会话并开始对话
     * 4. 返回对话状态和澄清问题
     *
     * @param userInput 用户输入
     * @param availableIntents 可用意图列表
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @return 增强的意图识别结果
     */
    @Override
    public EnhancedIntentResult classifyIntentWithConversation(
            String userInput,
            List<AIIntentConfig> availableIntents,
            String factoryId,
            Long userId) {

        log.info("Classifying intent with conversation support: factory={}, user={}, input='{}'",
                factoryId, userId, truncate(userInput, 50));

        // 先尝试单次分类
        IntentMatchResult singleResult = classifyIntent(userInput, availableIntents, factoryId);

        // 检查是否需要多轮对话
        if (!needsMultiTurnConversation(singleResult)) {
            log.debug("Single classification sufficient: confidence={}", singleResult.getConfidence());
            return EnhancedIntentResult.fromMatchResult(singleResult);
        }

        // 多轮对话服务不可用时，返回单次结果
        if (conversationService == null) {
            log.warn("Conversation service not available, returning single result");
            return EnhancedIntentResult.fromMatchResult(singleResult);
        }

        // 检查是否有活跃会话
        var activeSession = conversationService.getActiveSession(factoryId, userId);

        if (activeSession.isPresent()) {
            // 继续已有对话
            log.info("Continuing active conversation: session={}", activeSession.get().getSessionId());
            ConversationService.ConversationResponse response =
                    conversationService.continueConversation(activeSession.get().getSessionId(), userInput);

            return convertToEnhancedResult(response, singleResult);
        } else {
            // 开始新对话
            log.info("Starting new multi-turn conversation for low confidence result: {}",
                    singleResult.getConfidence());
            ConversationService.ConversationResponse response =
                    conversationService.startConversation(factoryId, userId, userInput);

            return convertToEnhancedResult(response, singleResult);
        }
    }

    /**
     * 将对话响应转换为增强结果
     */
    private EnhancedIntentResult convertToEnhancedResult(
            ConversationService.ConversationResponse response,
            IntentMatchResult fallbackResult) {

        if (response.isCompleted()) {
            // 对话完成，构建完整的匹配结果
            IntentMatchResult completedResult = IntentMatchResult.builder()
                    .userInput(fallbackResult != null ? fallbackResult.getUserInput() : "")
                    .confidence(response.getConfidence() != null ? response.getConfidence() : 0.9)
                    .matchMethod(MatchMethod.LLM)
                    .isStrongSignal(true)
                    .requiresConfirmation(false)
                    .clarificationQuestion(response.getMessage())
                    .build();

            return EnhancedIntentResult.builder()
                    .matchResult(completedResult)
                    .needsConversation(false)
                    .conversationSessionId(response.getSessionId())
                    .currentRound(response.getCurrentRound())
                    .build();
        }

        // 对话进行中，需要用户继续回复
        List<CandidateOption> options = null;
        if (response.getCandidates() != null) {
            options = response.getCandidates().stream()
                    .map(c -> CandidateOption.builder()
                            .intentCode(c.getIntentCode())
                            .intentName(c.getIntentName())
                            .confidence(c.getConfidence() != null ? c.getConfidence() : 0.5)
                            .description(c.getDescription())
                            .build())
                    .collect(java.util.stream.Collectors.toList());
        }

        return EnhancedIntentResult.needsConversation(
                response.getSessionId(),
                response.getCurrentRound(),
                response.getMessage(),
                options
        );
    }

    @Override
    public boolean needsMultiTurnConversation(IntentMatchResult matchResult) {
        if (matchResult == null) {
            return true;
        }
        // 置信度低于阈值且没有明确匹配时需要多轮对话
        return matchResult.getConfidence() < conversationThreshold && matchResult.getBestMatch() == null;
    }

    @Override
    public double getConversationThreshold() {
        return conversationThreshold;
    }

    /**
     * 检查是否应该使用 DashScope 直接调用
     */
    private boolean shouldUseDashScopeDirect() {
        return dashScopeConfig != null
                && dashScopeClient != null
                && dashScopeConfig.shouldUseDirect("intent-classify")
                && dashScopeClient.isAvailable();
    }

    /**
     * 使用 DashScope 直接进行意图分类 (新方式)
     */
    private IntentMatchResult classifyIntentDirect(String userInput, List<AIIntentConfig> availableIntents, String factoryId) {
        log.debug("Using DashScope direct intent classification");

        try {
            // 构建系统提示词
            String systemPrompt = buildIntentClassifyPrompt(availableIntents);

            // 调用 DashScope
            String responseJson = dashScopeClient.classifyIntent(systemPrompt, userInput);

            // 解析响应
            return parseDirectClassifyResponse(responseJson, userInput, availableIntents, factoryId);

        } catch (Exception e) {
            log.error("DashScope direct intent classification failed: {}", e.getMessage(), e);

            // 降级到 Python 服务
            if (isPythonServiceHealthy()) {
                log.info("Falling back to Python service due to DashScope error");
                return classifyIntentViaPython(userInput, availableIntents, factoryId);
            }

            return IntentMatchResult.empty(userInput);
        }
    }

    /**
     * 使用 Python 服务进行意图分类 (旧方式)
     */
    private IntentMatchResult classifyIntentViaPython(String userInput, List<AIIntentConfig> availableIntents, String factoryId) {
        log.debug("Using Python service for intent classification");

        try {
            // 构建请求体
            Map<String, Object> requestBody = buildClassifyRequest(userInput, availableIntents, factoryId);

            // 调用 Python 端点
            String responseJson = callPythonEndpoint("/api/ai/intent/classify", requestBody);

            // 解析响应
            return parseClassifyResponse(responseJson, userInput, availableIntents, factoryId);

        } catch (Exception e) {
            log.error("LLM intent classification failed: {}", e.getMessage(), e);
            // 返回空结果，不阻断流程
            return IntentMatchResult.empty(userInput);
        }
    }

    /**
     * 构建意图分类系统提示词
     */
    private String buildIntentClassifyPrompt(List<AIIntentConfig> availableIntents) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个意图识别助手。根据用户输入，从以下意图列表中选择最匹配的意图。\n\n");
        sb.append("## 可用意图列表\n\n");

        for (AIIntentConfig intent : availableIntents) {
            sb.append(String.format("- **%s** (%s): %s\n",
                    intent.getIntentCode(),
                    intent.getIntentName(),
                    intent.getDescription() != null ? intent.getDescription() : ""));
            if (intent.getKeywords() != null && !intent.getKeywords().isEmpty()) {
                sb.append(String.format("  关键词: %s\n", String.join(", ", intent.getKeywords())));
            }
        }

        sb.append("\n## 输出格式\n\n");
        sb.append("请以 JSON 格式返回，包含以下字段：\n");
        sb.append("```json\n");
        sb.append("{\n");
        sb.append("  \"intent_code\": \"匹配的意图代码，如果无法匹配返回 UNKNOWN\",\n");
        sb.append("  \"confidence\": 0.0-1.0 之间的置信度,\n");
        sb.append("  \"reasoning\": \"判断理由\",\n");
        sb.append("  \"other_candidates\": [\n");
        sb.append("    {\"intent_code\": \"其他可能的意图\", \"confidence\": 0.0-1.0}\n");
        sb.append("  ]\n");
        sb.append("}\n");
        sb.append("```\n\n");
        sb.append("仅返回 JSON，不要包含其他文字。");

        return sb.toString();
    }

    /**
     * 解析 DashScope 直接调用的响应
     */
    private IntentMatchResult parseDirectClassifyResponse(String responseJson,
                                                           String userInput,
                                                           List<AIIntentConfig> availableIntents,
                                                           String factoryId) {
        try {
            // 提取 JSON 部分
            Pattern pattern = Pattern.compile("\\{[\\s\\S]*\\}");
            Matcher matcher = pattern.matcher(responseJson);

            if (!matcher.find()) {
                log.warn("Could not extract JSON from DashScope response: {}", truncate(responseJson, 100));
                return IntentMatchResult.empty(userInput);
            }

            JsonNode json = objectMapper.readTree(matcher.group());

            // 提取字段
            String intentCode = json.has("intent_code") ? json.get("intent_code").asText() : "UNKNOWN";
            double confidence = json.has("confidence") ? json.get("confidence").asDouble() : 0.5;
            String reasoning = json.has("reasoning") ? json.get("reasoning").asText() : null;

            // Clamp confidence
            confidence = Math.max(0.0, Math.min(1.0, confidence));

            // 查找匹配的意图配置
            AIIntentConfig matchedConfig = null;
            if (!"UNKNOWN".equalsIgnoreCase(intentCode)) {
                matchedConfig = availableIntents.stream()
                        .filter(c -> intentCode.equalsIgnoreCase(c.getIntentCode()))
                        .findFirst()
                        .orElse(null);
            }

            if (matchedConfig == null) {
                log.warn("DashScope returned unknown intent code: '{}'", intentCode);

                // 尝试生成「创建新意图」建议 (自学习核心功能)
                if (autoCreateIntentEnabled && factoryId != null) {
                    if (!"UNKNOWN".equalsIgnoreCase(intentCode)) {
                        // 情况1: LLM返回了一个具体的新意图代码 (不在已知列表中)
                        log.info("[CREATE_INTENT] LLM suggested new intent code: {} for input: {}",
                                intentCode, truncate(userInput, 50));
                        tryCreateIntentSuggestion(factoryId, userInput, intentCode, null, reasoning, confidence);
                    } else if (reasoning != null && !reasoning.isEmpty()) {
                        // 情况2: LLM返回UNKNOWN，但提供了有价值的推理说明
                        String generatedCode = generateIntentCodeFromInput(userInput);
                        String generatedName = generateIntentNameFromInput(userInput);
                        log.info("[CREATE_INTENT] LLM returned UNKNOWN with reasoning, generating suggestion: {} ({})",
                                generatedCode, generatedName);
                        tryCreateIntentSuggestion(factoryId, userInput, generatedCode, generatedName, reasoning, 0.5);
                    }
                }

                return IntentMatchResult.empty(userInput);
            }

            // 构建候选列表
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

            // 处理其他候选
            if (json.has("other_candidates") && json.get("other_candidates").isArray()) {
                for (JsonNode candidate : json.get("other_candidates")) {
                    String code = candidate.has("intent_code") ? candidate.get("intent_code").asText() : null;
                    double candConf = candidate.has("confidence") ? candidate.get("confidence").asDouble() : 0.3;

                    if (code != null) {
                        AIIntentConfig candConfig = availableIntents.stream()
                                .filter(c -> code.equalsIgnoreCase(c.getIntentCode()))
                                .findFirst()
                                .orElse(null);

                        if (candConfig != null) {
                            candidates.add(CandidateIntent.builder()
                                    .intentCode(candConfig.getIntentCode())
                                    .intentName(candConfig.getIntentName())
                                    .intentCategory(candConfig.getIntentCategory())
                                    .confidence(candConf)
                                    .matchScore((int) (candConf * 100))
                                    .matchedKeywords(List.of())
                                    .matchMethod(MatchMethod.LLM)
                                    .description(candConfig.getDescription())
                                    .build());
                        }
                    }
                }
            }

            // 判断信号强度
            boolean isStrongSignal = confidence >= 0.8;
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
                    .clarificationQuestion(reasoning)
                    .build();

        } catch (Exception e) {
            log.error("Failed to parse DashScope response: {}", e.getMessage(), e);
            return IntentMatchResult.empty(userInput);
        }
    }

    /**
     * 检查 Python 服务是否健康
     */
    private boolean isPythonServiceHealthy() {
        try {
            return isHealthy();
        } catch (Exception e) {
            return false;
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
        String url = aiServiceUrl + "/api/ai/intent/health";
        Request request = new Request.Builder()
                .url(url)
                .get()
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            return response.isSuccessful();
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

    // ==================== HTTP 调用 (OkHttp) ====================

    private String callPythonEndpoint(String endpoint, Map<String, Object> requestBody) throws IOException {
        String url = aiServiceUrl + endpoint;
        log.debug("Calling Python endpoint: {}", url);

        // 序列化请求体
        String jsonBody = objectMapper.writeValueAsString(requestBody);
        log.debug("Request body: {}", truncate(jsonBody, 500));

        // 构建 OkHttp 请求
        RequestBody body = RequestBody.create(jsonBody, JSON_MEDIA_TYPE);
        Request request = new Request.Builder()
                .url(url)
                .post(body)
                .addHeader("Accept", "application/json")
                .build();

        // 执行请求
        try (Response response = httpClient.newCall(request).execute()) {
            int responseCode = response.code();
            log.debug("Response code: {}", responseCode);

            ResponseBody responseBody = response.body();
            String result = responseBody != null ? responseBody.string() : "";

            if (response.isSuccessful()) {
                log.debug("Response: {}", truncate(result, 500));
                return result;
            } else {
                throw new IOException("HTTP error " + responseCode + ": " + result);
            }
        }
    }

    // ==================== 响应解析 (软 Schema 验证) ====================

    /**
     * 解析 LLM 分类响应 - 使用软 Schema 验证
     *
     * 软验证策略：
     * 1. 忽略未知字段（@JsonIgnoreProperties(ignoreUnknown = true)）
     * 2. 置信度自动 clamp 到 [0.0, 1.0]
     * 3. 缺失字段使用默认值
     * 4. 意图代码不存在时返回空结果（不抛异常）
     */
    private IntentMatchResult parseClassifyResponse(String responseJson,
                                                     String userInput,
                                                     List<AIIntentConfig> availableIntents,
                                                     String factoryId) throws IOException {
        // Step 1: 使用 DTO 反序列化（软 Schema 验证）
        LlmIntentClassifyResponse response;
        try {
            response = objectMapper.readValue(responseJson, LlmIntentClassifyResponse.class);
        } catch (JsonProcessingException e) {
            log.error("LLM response JSON parse failed: {}", e.getMessage());
            // 软验证：解析失败不抛异常，返回空结果
            return IntentMatchResult.empty(userInput);
        }

        // Step 2: 检查响应状态
        if (response.getSuccess() == null || !response.getSuccess()) {
            String message = response.getMessage() != null ? response.getMessage() : "Unknown error";
            log.warn("LLM classification returned failure: {}", message);
            return IntentMatchResult.empty(userInput);
        }

        // Step 3: 处理 data 包装（兼容两种格式）
        LlmIntentClassifyResponse data = response.getActualData();

        // Step 4: 使用安全 getter 提取字段（自动 clamp/default）
        String matchedIntentCode = data.getSafeIntentCode();
        Double confidence = data.getSafeConfidence();
        String reasoning = data.getReasoning();

        // Step 5: 业务验证 - 意图代码必须存在于已知列表
        AIIntentConfig matchedConfig = null;
        if (!"UNKNOWN".equals(matchedIntentCode)) {
            matchedConfig = availableIntents.stream()
                    .filter(c -> matchedIntentCode.equalsIgnoreCase(c.getIntentCode()))
                    .findFirst()
                    .orElse(null);
        }

        if (matchedConfig == null) {
            log.warn("LLM returned unknown/invalid intent code: '{}' (soft validation: returning empty result)",
                    matchedIntentCode);

            // 尝试生成「创建新意图」建议 (自学习核心功能)
            if (autoCreateIntentEnabled) {
                if (!"UNKNOWN".equalsIgnoreCase(matchedIntentCode) && confidence >= autoCreateMinConfidence) {
                    // 情况1: LLM返回了一个具体的新意图代码 (不在已知列表中)
                    // 使用LLM建议的意图代码创建建议
                    tryCreateIntentSuggestion(factoryId, userInput, matchedIntentCode,
                            null, reasoning, confidence);
                } else if ("UNKNOWN".equalsIgnoreCase(matchedIntentCode) && reasoning != null && !reasoning.isEmpty()) {
                    // 情况2: LLM返回UNKNOWN，但提供了有价值的推理说明
                    // 从用户输入生成建议的意图代码，捕获新的意图模式
                    String generatedCode = generateIntentCodeFromInput(userInput);
                    String generatedName = generateIntentNameFromInput(userInput);
                    log.info("LLM returned UNKNOWN with reasoning, generating intent suggestion: {} ({})",
                            generatedCode, generatedName);
                    tryCreateIntentSuggestion(factoryId, userInput, generatedCode,
                            generatedName, reasoning, 0.5); // 使用中等置信度
                }
            }

            // 软验证：不抛 LlmSchemaValidationException，返回空结果
            return IntentMatchResult.empty(userInput);
        }

        // Step 6: 构建候选意图列表
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

        // Step 7: 提取其他候选（使用 DTO 的 getMergedCandidates）
        List<LlmIntentClassifyResponse.CandidateResponse> otherCandidates = data.getMergedCandidates();
        if (otherCandidates != null) {
            for (LlmIntentClassifyResponse.CandidateResponse candidate : otherCandidates) {
                String code = candidate.getIntentCode();
                if (code == null || code.trim().isEmpty()) {
                    continue;  // 软验证：跳过无效候选
                }

                Double candConfidence = candidate.getSafeConfidence();

                AIIntentConfig candConfig = availableIntents.stream()
                        .filter(c -> code.equalsIgnoreCase(c.getIntentCode()))
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

        // Step 8: 判断信号强度和确认需求
        boolean isStrongSignal = confidence >= 0.8;

        String sensitivityLevel = matchedConfig.getSensitivityLevel();
        boolean requiresConfirmation = confidence < 0.7
                || "HIGH".equals(sensitivityLevel)
                || "CRITICAL".equals(sensitivityLevel);

        // Step 9: 记录软验证日志（用于监控异常模式）
        if (confidence > 0.99 && (otherCandidates == null || otherCandidates.isEmpty())) {
            log.warn("Suspicious LLM response: high confidence ({}) without alternatives for input: '{}'",
                    confidence, truncate(userInput, 30));
        }

        return IntentMatchResult.builder()
                .bestMatch(matchedConfig)
                .topCandidates(candidates)
                .confidence(confidence)
                .matchMethod(MatchMethod.LLM)
                .matchedKeywords(List.of())
                .isStrongSignal(isStrongSignal)
                .requiresConfirmation(requiresConfirmation)
                .userInput(userInput)
                .clarificationQuestion(reasoning)
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

    // ==================== 新意图建议生成 (自学习核心) ====================

    /**
     * 尝试创建「新意图」建议
     *
     * 当 LLM 返回的意图代码不在已有配置中时，说明 LLM 识别到了一个潜在的新意图模式。
     *
     * 差异化审批机制：
     * - 工厂级意图 (factoryId 不为 PLATFORM/null)：自动审批并创建，无需人工审核
     * - 平台级意图 (factoryId 为 PLATFORM 或晋升请求)：需要平台管理员审批
     *
     * 此方法会：
     * 1. 检查是否已存在相同 suggestedIntentCode 的待处理建议
     * 2. 如果存在，累加 frequency 并更新样例
     * 3. 如果不存在：
     *    a. 工厂级 + 自动审批开启 → 直接创建意图配置
     *    b. 否则 → 创建待审核的 CREATE_INTENT 建议
     *
     * @param factoryId       工厂ID
     * @param userInput       用户输入
     * @param suggestedCode   LLM 建议的意图代码
     * @param suggestedName   LLM 建议的意图名称 (可能为 null)
     * @param reasoning       LLM 推理说明
     * @param confidence      LLM 置信度
     */
    @Transactional
    protected void tryCreateIntentSuggestion(String factoryId,
                                              String userInput,
                                              String suggestedCode,
                                              String suggestedName,
                                              String reasoning,
                                              double confidence) {
        if (suggestionRepository == null) {
            log.debug("Suggestion repository not available, skipping CREATE_INTENT suggestion");
            return;
        }

        try {
            // 检查是否已有相同 suggestedIntentCode 的待处理建议
            List<IntentOptimizationSuggestion> existing = suggestionRepository
                    .findPendingCreateIntentSuggestion(factoryId, suggestedCode);

            if (!existing.isEmpty()) {
                // 已存在：累加频率
                IntentOptimizationSuggestion suggestion = existing.get(0);
                suggestion.incrementFrequency(userInput);
                suggestionRepository.save(suggestion);
                log.info("Updated existing CREATE_INTENT suggestion: code={}, frequency={}",
                        suggestedCode, suggestion.getFrequency());
            } else {
                // 不存在：根据工厂级/平台级决定处理方式
                String name = suggestedName != null ? suggestedName : suggestedCode;
                String category = inferCategory(suggestedCode);
                String keywords = extractKeywords(userInput);

                // 判断是否是工厂级意图 (可以自动审批)
                boolean isFactoryLevel = isFactoryLevelIntent(factoryId);
                boolean shouldAutoApprove = isFactoryLevel && factoryAutoApproveEnabled && intentConfigRepository != null;

                if (shouldAutoApprove) {
                    // 工厂级意图自动审批：直接创建意图配置
                    autoApproveAndCreateIntent(factoryId, suggestedCode, name, keywords, category,
                                                userInput, reasoning, confidence);
                } else {
                    // 平台级意图或自动审批关闭：创建待审核建议
                    IntentOptimizationSuggestion suggestion = IntentOptimizationSuggestion.createNewIntentSuggestion(
                            factoryId,
                            userInput,
                            suggestedCode,
                            name,
                            keywords,
                            category,
                            confidence,
                            reasoning != null ? reasoning : "LLM 自动识别的新意图模式"
                    );

                    suggestionRepository.save(suggestion);
                    log.info("Created new CREATE_INTENT suggestion (pending review): factoryId={}, code={}, confidence={}",
                            factoryId, suggestedCode, confidence);
                }
            }
        } catch (Exception e) {
            log.error("Failed to create intent suggestion: {}", e.getMessage(), e);
            // 不阻断主流程
        }
    }

    /**
     * 判断是否是工厂级意图
     * 工厂级意图的 factoryId 是具体的工厂ID (如 F001)，不是 PLATFORM 或 null
     */
    private boolean isFactoryLevelIntent(String factoryId) {
        if (factoryId == null || factoryId.trim().isEmpty()) {
            return false;
        }
        String fid = factoryId.trim().toUpperCase();
        return !fid.equals("PLATFORM") && !fid.equals("GLOBAL") && !fid.equals("SYSTEM");
    }

    /**
     * 自动审批并创建工厂级意图
     *
     * 当工厂级意图自动审批开启时，直接创建意图配置：
     * 1. 创建 AIIntentConfig 实体
     * 2. 保存到数据库
     * 3. 创建一个已审批的建议记录 (用于审计追踪)
     */
    private void autoApproveAndCreateIntent(String factoryId,
                                             String intentCode,
                                             String intentName,
                                             String keywords,
                                             String category,
                                             String userInput,
                                             String reasoning,
                                             double confidence) {
        try {
            // 1. 检查意图代码是否已存在
            if (intentConfigRepository.existsByFactoryIdAndIntentCode(factoryId, intentCode)) {
                log.warn("Intent code already exists, skipping auto-create: factoryId={}, code={}",
                        factoryId, intentCode);
                return;
            }

            // 2. 创建新的意图配置
            AIIntentConfig newIntent = AIIntentConfig.builder()
                    .factoryId(factoryId)
                    .intentCode(intentCode)
                    .intentName(intentName)
                    .keywords(parseKeywordsList(keywords))
                    .intentCategory(category)
                    .priority(50)  // 默认中等优先级
                    .isActive(true)
                    .description("由AI自学习机制自动创建 (工厂级自动审批)。LLM推理: " +
                                (reasoning != null ? reasoning : "自动识别的新意图模式"))
                    .build();

            intentConfigRepository.save(newIntent);
            log.info("[AUTO-APPROVED] Created factory-level intent: factoryId={}, code={}, name={}, confidence={}",
                    factoryId, intentCode, intentName, confidence);

            // 3. 创建已审批的建议记录 (用于审计追踪)
            IntentOptimizationSuggestion suggestion = IntentOptimizationSuggestion.createNewIntentSuggestion(
                    factoryId,
                    userInput,
                    intentCode,
                    intentName,
                    keywords,
                    category,
                    confidence,
                    reasoning != null ? reasoning : "LLM 自动识别的新意图模式"
            );
            suggestion.setStatus(SuggestionStatus.APPROVED);
            suggestion.setApprovalNotes("工厂级意图自动审批 - 由系统自动创建");
            suggestionRepository.save(suggestion);

        } catch (Exception e) {
            log.error("Failed to auto-approve and create intent: factoryId={}, code={}, error={}",
                    factoryId, intentCode, e.getMessage(), e);
            // 降级：创建待审核的建议
            log.info("Falling back to pending suggestion due to auto-approve failure");
            IntentOptimizationSuggestion fallbackSuggestion = IntentOptimizationSuggestion.createNewIntentSuggestion(
                    factoryId, userInput, intentCode, intentName, keywords, category, confidence,
                    reasoning != null ? reasoning : "LLM 自动识别的新意图模式 (自动审批失败，需人工审核)"
            );
            suggestionRepository.save(fallbackSuggestion);
        }
    }

    /**
     * 解析关键词 JSON 字符串为 List
     */
    private List<String> parseKeywordsList(String keywordsJson) {
        if (keywordsJson == null || keywordsJson.trim().isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(keywordsJson, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse keywords JSON: {}", keywordsJson);
            // 尝试将整个字符串作为单个关键词
            String cleaned = keywordsJson.replaceAll("[\\[\\]\"']", "").trim();
            return cleaned.isEmpty() ? new ArrayList<>() : List.of(cleaned);
        }
    }

    /**
     * 从意图代码推断分类
     */
    private String inferCategory(String intentCode) {
        if (intentCode == null) return "UNKNOWN";

        String code = intentCode.toUpperCase();
        if (code.contains("QUERY") || code.contains("LIST") || code.contains("GET") || code.contains("SEARCH")) {
            return "DATA_QUERY";
        } else if (code.contains("CREATE") || code.contains("ADD") || code.contains("NEW") || code.contains("SAVE")) {
            return "DATA_OP";
        } else if (code.contains("UPDATE") || code.contains("MODIFY") || code.contains("EDIT")) {
            return "DATA_OP";
        } else if (code.contains("DELETE") || code.contains("REMOVE")) {
            return "DATA_OP";
        } else if (code.contains("REPORT") || code.contains("ANALYSIS") || code.contains("STATS")) {
            return "ANALYSIS";
        } else if (code.contains("ALERT") || code.contains("WARN") || code.contains("NOTIFY")) {
            return "ALERT";
        } else if (code.contains("SCHEDULE") || code.contains("PLAN") || code.contains("TASK")) {
            return "SCHEDULE";
        } else if (code.contains("CONFIG") || code.contains("SETTING") || code.contains("SETUP")) {
            return "CONFIG";
        } else if (code.contains("FORM") || code.contains("INPUT") || code.contains("SUBMIT")) {
            return "FORM";
        } else {
            return "GENERAL";
        }
    }

    /**
     * 从用户输入提取关键词作为初始建议
     */
    private String extractKeywords(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return "[]";
        }

        // 简单实现：将整句作为一个关键词
        // 更复杂的实现可以使用分词
        String escaped = userInput.replace("\"", "\\\"").replace("\n", " ").trim();
        return "[\"" + escaped + "\"]";
    }

    // ==================== UNKNOWN 意图处理 (自学习增强) ====================

    /**
     * 从用户输入生成建议的意图代码
     * 用于 LLM 返回 UNKNOWN 时，自动生成一个候选意图代码
     *
     * 规则：
     * 1. 提取关键动词 (查询/分析/创建/更新/删除 等)
     * 2. 提取关键名词 (碳排放/能耗/环保 等)
     * 3. 组合成 UPPER_SNAKE_CASE 格式
     *
     * @param userInput 用户输入
     * @return 生成的意图代码，如 "CARBON_FOOTPRINT_QUERY"
     */
    private String generateIntentCodeFromInput(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return "NEW_INTENT_" + System.currentTimeMillis() % 10000;
        }

        String input = userInput.trim().toLowerCase();

        // 动词映射
        String action = "QUERY";  // 默认动作
        if (input.contains("分析") || input.contains("统计") || input.contains("报表")) {
            action = "ANALYSIS";
        } else if (input.contains("查询") || input.contains("查看") || input.contains("获取") || input.contains("看看")) {
            action = "QUERY";
        } else if (input.contains("创建") || input.contains("新建") || input.contains("添加") || input.contains("录入")) {
            action = "CREATE";
        } else if (input.contains("修改") || input.contains("更新") || input.contains("编辑") || input.contains("调整")) {
            action = "UPDATE";
        } else if (input.contains("删除") || input.contains("移除") || input.contains("取消")) {
            action = "DELETE";
        } else if (input.contains("导出") || input.contains("下载") || input.contains("生成")) {
            action = "EXPORT";
        } else if (input.contains("设置") || input.contains("配置") || input.contains("管理")) {
            action = "CONFIG";
        }

        // 主题提取 (简单规则，提取关键词)
        String subject = extractSubjectFromInput(input);

        return subject.toUpperCase() + "_" + action;
    }

    /**
     * 从用户输入提取主题名词
     */
    private String extractSubjectFromInput(String input) {
        // 常见主题词映射
        if (input.contains("碳排放") || input.contains("碳足迹") || input.contains("碳")) {
            return "CARBON_FOOTPRINT";
        } else if (input.contains("环保") || input.contains("合规") || input.contains("环境")) {
            return "ENVIRONMENTAL_COMPLIANCE";
        } else if (input.contains("能源") || input.contains("能耗") || input.contains("电")) {
            return "ENERGY_CONSUMPTION";
        } else if (input.contains("成本") || input.contains("费用") || input.contains("预算")) {
            return "COST";
        } else if (input.contains("供应商") || input.contains("供货商")) {
            return "SUPPLIER";
        } else if (input.contains("客户") || input.contains("顾客")) {
            return "CUSTOMER";
        } else if (input.contains("库存") || input.contains("存货")) {
            return "INVENTORY";
        } else if (input.contains("质量") || input.contains("品质")) {
            return "QUALITY";
        } else if (input.contains("安全") || input.contains("风险")) {
            return "SAFETY";
        } else if (input.contains("人员") || input.contains("员工") || input.contains("人力")) {
            return "HR";
        } else if (input.contains("设备") || input.contains("机器") || input.contains("机械")) {
            return "EQUIPMENT";
        } else if (input.contains("物流") || input.contains("运输") || input.contains("配送")) {
            return "LOGISTICS";
        } else if (input.contains("订单") || input.contains("采购")) {
            return "ORDER";
        } else if (input.contains("仓库") || input.contains("仓储")) {
            return "WAREHOUSE";
        } else {
            // 无法识别：使用时间戳生成唯一代码
            return "CUSTOM_" + (System.currentTimeMillis() % 100000);
        }
    }

    /**
     * 从用户输入生成建议的意图名称
     * 用于 CREATE_INTENT 建议的显示名称
     *
     * @param userInput 用户输入
     * @return 生成的意图名称，如 "碳排放足迹查询"
     */
    private String generateIntentNameFromInput(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return "新意图";
        }

        String input = userInput.trim();

        // 截取前20个字符作为名称基础
        String baseName = input.length() > 20 ? input.substring(0, 20) + "..." : input;

        // 清理特殊字符
        baseName = baseName.replaceAll("[\\[\\]{}\"'\\\\]", "").trim();

        return "新功能: " + baseName;
    }
}
