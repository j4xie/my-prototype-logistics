package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.AiDemandRecord;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.mapper.AiDemandRecordMapper;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.service.AiRecommendService;
import com.joolun.mall.service.ProductKnowledgeService;
import com.joolun.mall.service.SearchKeywordService;
import com.joolun.mall.service.VectorSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * AI推荐服务实现
 * 集成阿里云DashScope (通义千问Qwen) API进行语义理解和商品推荐
 * 注意: 配置变量名保持兼容性，实际使用的是 DashScope + Qwen 模型
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiRecommendServiceImpl extends ServiceImpl<AiDemandRecordMapper, AiDemandRecord>
        implements AiRecommendService {

    private final GoodsSpuMapper goodsSpuMapper;
    private final SearchKeywordService searchKeywordService;
    private final VectorSearchService vectorSearchService;
    private final ProductKnowledgeService productKnowledgeService;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final RedisTemplate<String, Object> redisTemplate;

    // 会话状态缓存key前缀
    private static final String SESSION_STATE_KEY = "mall:ai:session:state:";
    // 极速匹配服务状态
    private static final String STATE_AWAITING_EXPRESS_MATCH_CONFIRM = "awaiting_express_match_confirm";
    private static final String STATE_COLLECTING_REQUIREMENTS = "collecting_requirements";

    // LLM API Key (实际配置为 DashScope API Key)
    @Value("${ai.llm.api-key:}")
    private String llmApiKey;

    // LLM API Base URL (实际配置为 https://dashscope.aliyuncs.com/compatible-mode)
    @Value("${ai.llm.base-url:}")
    private String llmBaseUrl;

    // LLM Model (实际配置为 qwen-plus)
    @Value("${ai.llm.model:}")
    private String llmModel;

    // RAG 功能开关
    @Value("${ai.rag.enabled:true}")
    private boolean ragEnabled;

    // RAG 检索数量
    @Value("${ai.rag.topk:5}")
    private int ragTopK;

    private static final String SYSTEM_PROMPT = """
        你是白垩纪食品溯源商城的智能客服助手。你的任务是：
        1. 理解用户的商品需求
        2. 从用户消息中提取关键词
        3. 根据关键词推荐相关商品
        4. 回答用户关于商品、溯源、价格等问题

        请以JSON格式返回分析结果：
        {
            "intent": "用户意图(product_inquiry/price_inquiry/stock_inquiry/usage_inquiry/other)",
            "keywords": ["提取的关键词列表"],
            "response": "给用户的回复内容",
            "confidence": 0.95
        }
        """;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> chat(String sessionId, Long userId, Long merchantId, String message) {
        Map<String, Object> result = new HashMap<>();

        try {
            // 0. 检查会话状态 - 是否在极速匹配服务流程中
            Map<String, Object> sessionState = getSessionState(sessionId);
            String currentState = sessionState != null ? (String) sessionState.get("state") : null;

            // 处理极速匹配服务确认
            if (STATE_AWAITING_EXPRESS_MATCH_CONFIRM.equals(currentState)) {
                return handleExpressMatchConfirmation(sessionId, userId, merchantId, message, sessionState);
            }

            // 处理需求收集
            if (STATE_COLLECTING_REQUIREMENTS.equals(currentState)) {
                return handleRequirementCollection(sessionId, userId, merchantId, message, sessionState);
            }

            // 1. RAG: 先检索相关商品知识
            List<GoodsSpu> ragProducts = new ArrayList<>();
            String enhancedPrompt = null;
            if (ragEnabled && productKnowledgeService != null) {
                try {
                    ragProducts = productKnowledgeService.retrieveRelevantKnowledge(message, ragTopK);
                    if (!ragProducts.isEmpty()) {
                        enhancedPrompt = productKnowledgeService.enhancePromptWithKnowledge(message, ragProducts);
                        log.debug("RAG 检索到 {} 个相关商品，已增强提示", ragProducts.size());
                    }
                } catch (Exception ragEx) {
                    log.warn("RAG 知识检索失败，降级到普通模式: {}", ragEx.getMessage());
                }
            }

            // 2. 调用LLM API分析用户意图（使用RAG增强的提示或普通提示）
            Map<String, Object> analysis = analyzeMessageWithRag(message, enhancedPrompt);
            String intent = (String) analysis.getOrDefault("intent", "other");
            List<String> keywords = (List<String>) analysis.getOrDefault("keywords", new ArrayList<>());
            String aiResponse = (String) analysis.getOrDefault("response", "抱歉，我没有理解您的问题");
            double confidence = (double) analysis.getOrDefault("confidence", 0.5);
            boolean sourcedFromKnowledge = (boolean) analysis.getOrDefault("sourcedFromKnowledge", false);

            // 3. 根据关键词搜索商品 - 优先使用RAG结果，否则向量搜索
            List<GoodsSpu> matchedProducts = new ArrayList<>();
            if (!ragProducts.isEmpty()) {
                // 优先使用RAG检索的商品
                matchedProducts = ragProducts;
            } else if (!keywords.isEmpty()) {
                String query = String.join(" ", keywords);
                if (vectorSearchService.isAvailable()) {
                    matchedProducts = vectorSearchService.searchSimilarProducts(query, 5);
                }
                // 向量搜索无结果时降级到关键词搜索
                if (matchedProducts.isEmpty()) {
                    matchedProducts = semanticSearch(query, 5);
                }
            }

            // 4. 检查商品与关键词的相关性
            boolean hasRelevantProducts = hasRelevantProducts(matchedProducts, keywords);

            // 5. 构建响应
            result.put("sessionId", sessionId);
            result.put("response", aiResponse);
            result.put("ragEnabled", ragEnabled && !ragProducts.isEmpty());
            result.put("sourcedFromKnowledge", sourcedFromKnowledge);
            result.put("intent", intent);
            result.put("keywords", keywords);
            result.put("products", hasRelevantProducts ? matchedProducts : new ArrayList<>());
            result.put("hasProducts", hasRelevantProducts);

            // 6. 记录需求
            List<String> productIds = matchedProducts.stream()
                    .map(GoodsSpu::getId)
                    .collect(Collectors.toList());
            recordDemand(sessionId, userId, merchantId, message, aiResponse, keywords,
                    intent, confidence, productIds, intent);

            // 7. 极速匹配服务 - 当产品咨询无相关结果时主动询问
            // 支持英文和中文意图匹配
            boolean isProductInquiry = "product_inquiry".equals(intent)
                    || (intent != null && (intent.contains("商品") || intent.contains("查询") || intent.contains("推荐") || intent.contains("product")));
            if (isProductInquiry && !hasRelevantProducts) {
                // 记录搜索关键词（无结果）
                try {
                    for (String keyword : keywords) {
                        searchKeywordService.recordSearch(keyword, userId, merchantId, null, 0, "ai_chat");
                    }
                } catch (Exception keywordEx) {
                    log.warn("记录搜索关键词失败: {}", keywordEx.getMessage());
                }

                // 触发极速匹配服务询问
                String expressMatchPrompt = buildExpressMatchPrompt(keywords);
                result.put("response", expressMatchPrompt);
                result.put("showExpressMatchOption", true);
                result.put("expressMatchKeywords", keywords);

                // 保存会话状态 - 使用HashMap因为Map.of不允许null值
                Map<String, Object> stateData = new HashMap<>();
                stateData.put("keywords", keywords);
                stateData.put("originalMessage", message);
                stateData.put("userId", userId);
                if (merchantId != null) {
                    stateData.put("merchantId", merchantId);
                }
                saveSessionState(sessionId, STATE_AWAITING_EXPRESS_MATCH_CONFIRM, stateData);
            }

        } catch (Exception e) {
            log.error("AI chat error", e);
            result.put("response", "抱歉，系统暂时无法处理您的请求，请稍后重试。");
            result.put("error", e.getMessage());
        }

        return result;
    }

    /**
     * 构建极速匹配服务询问提示
     */
    private String buildExpressMatchPrompt(List<String> keywords) {
        String keywordStr = String.join("、", keywords);
        return String.format(
                "抱歉，我们暂时没有找到「%s」相关的商品。\n\n" +
                "🚀 需要极速匹配服务吗？\n" +
                "• 服务完全免费\n" +
                "• 当天响应，专人对接\n" +
                "• 为您寻找优质供应商\n\n" +
                "回复「需要」或「是」开启极速匹配服务",
                keywordStr
        );
    }

    /**
     * 处理极速匹配服务确认
     */
    private Map<String, Object> handleExpressMatchConfirmation(
            String sessionId, Long userId, Long merchantId, String message, Map<String, Object> sessionState) {

        Map<String, Object> result = new HashMap<>();
        result.put("sessionId", sessionId);

        String normalizedMessage = message.trim().toLowerCase();

        // 先检查拒绝模式（优先级高于确认，避免"不需要"被当作"需要"处理）
        boolean isRejected = normalizedMessage.contains("不需要") ||
                normalizedMessage.contains("不用") ||
                normalizedMessage.contains("算了") ||
                normalizedMessage.contains("不要") ||
                normalizedMessage.equals("不") ||
                normalizedMessage.equals("no");

        // 再检查确认模式
        boolean isConfirmed = !isRejected && (
                normalizedMessage.contains("需要") ||
                normalizedMessage.contains("是") ||
                normalizedMessage.contains("好") ||
                normalizedMessage.contains("可以") ||
                normalizedMessage.equals("yes") ||
                normalizedMessage.equals("ok"));

        if (isRejected) {
            // 用户拒绝
            result.put("response", "好的，没关系！如果之后有需要，随时可以找我帮忙寻找供应商。\n\n还有其他我能帮您的吗？");
            clearSessionState(sessionId);

        } else if (isConfirmed) {
            // 用户确认需要极速匹配服务，进入需求收集阶段
            List<String> keywords = (List<String>) sessionState.get("keywords");
            String keywordStr = keywords != null ? String.join("、", keywords) : "商品";

            result.put("response", String.format(
                    "好的，我来帮您对接「%s」的供应商！\n\n" +
                    "请简单描述您的需求：\n" +
                    "• 预计采购数量？\n" +
                    "• 有规格要求吗？（如：规格、品牌、产地）\n" +
                    "• 预算范围？\n" +
                    "• 期望交货时间？\n\n" +
                    "您可以一次性告诉我，也可以分开说~",
                    keywordStr
            ));
            result.put("showExpressMatchOption", false);
            result.put("collectingRequirements", true);

            // 更新状态为收集需求 - 使用HashMap因为Map.of不允许null值
            Map<String, Object> collectStateData = new HashMap<>();
            collectStateData.put("keywords", keywords != null ? keywords : List.of());
            collectStateData.put("userId", userId);
            if (merchantId != null) {
                collectStateData.put("merchantId", merchantId);
            }
            collectStateData.put("startTime", System.currentTimeMillis());
            saveSessionState(sessionId, STATE_COLLECTING_REQUIREMENTS, collectStateData);

        } else {
            // 用户回复了其他内容，当作新的查询处理
            clearSessionState(sessionId);
            return chat(sessionId, userId, merchantId, message);
        }

        return result;
    }

    /**
     * 处理需求收集
     */
    private Map<String, Object> handleRequirementCollection(
            String sessionId, Long userId, Long merchantId, String message, Map<String, Object> sessionState) {

        Map<String, Object> result = new HashMap<>();
        result.put("sessionId", sessionId);

        List<String> keywords = (List<String>) sessionState.get("keywords");
        String keywordStr = keywords != null ? String.join("、", keywords) : "商品";

        // 创建极速匹配需求工单
        try {
            AiDemandRecord demandRecord = new AiDemandRecord();
            demandRecord.setSessionId(sessionId);
            demandRecord.setMessageId(UUID.randomUUID().toString());
            demandRecord.setUserId(userId);
            demandRecord.setMerchantId(merchantId);
            demandRecord.setUserMessage(message);
            demandRecord.setAiResponse("极速匹配服务 - 需求已记录");
            demandRecord.setExtractedKeywords(objectMapper.writeValueAsString(keywords));
            demandRecord.setExtractedIntent("express_match_request");
            demandRecord.setConfidenceScore(BigDecimal.valueOf(1.0));
            demandRecord.setMatchCount(0);
            demandRecord.setDemandType("express_match");
            demandRecord.setDemandUrgency(2); // 高优先级
            demandRecord.setStatus(0); // 待处理
            demandRecord.setCreateTime(LocalDateTime.now());

            // 保存需求详情到备注字段（如有）
            Map<String, Object> demandDetails = new HashMap<>();
            demandDetails.put("searchKeywords", keywords);
            demandDetails.put("userRequirements", message);
            demandDetails.put("requestTime", LocalDateTime.now().toString());
            demandDetails.put("serviceType", "express_match");
            demandRecord.setMatchedProductIds(objectMapper.writeValueAsString(demandDetails));

            baseMapper.insert(demandRecord);

            // 记录到搜索关键词表（标记为极速匹配需求）
            if (keywords != null) {
                for (String keyword : keywords) {
                    searchKeywordService.recordSearch(keyword, userId, merchantId, null, 0, "express_match");
                }
            }

            result.put("response", String.format(
                    "✅ 已收到您的「%s」采购需求！\n\n" +
                    "📋 需求详情：\n%s\n\n" +
                    "⏰ 我们的专员会在当天与您联系\n" +
                    "📞 如有紧急需求，可拨打客服热线\n\n" +
                    "还有其他需要帮助的吗？",
                    keywordStr,
                    message.length() > 100 ? message.substring(0, 100) + "..." : message
            ));
            result.put("expressMatchSubmitted", true);
            result.put("demandRecordId", demandRecord.getId());

            log.info("极速匹配需求已创建: sessionId={}, userId={}, keywords={}", sessionId, userId, keywords);

        } catch (Exception e) {
            log.error("创建极速匹配需求失败", e);
            result.put("response", "抱歉，需求提交遇到问题，请稍后重试或联系客服。");
            result.put("error", e.getMessage());
        }

        // 清除会话状态
        clearSessionState(sessionId);

        return result;
    }

    /**
     * 获取会话状态
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> getSessionState(String sessionId) {
        Object state = redisTemplate.opsForValue().get(SESSION_STATE_KEY + sessionId);
        if (state instanceof Map) {
            return (Map<String, Object>) state;
        }
        return null;
    }

    /**
     * 保存会话状态
     */
    private void saveSessionState(String sessionId, String state, Map<String, Object> data) {
        Map<String, Object> sessionState = new HashMap<>(data);
        sessionState.put("state", state);
        redisTemplate.opsForValue().set(
                SESSION_STATE_KEY + sessionId,
                sessionState,
                30, // 30分钟过期
                java.util.concurrent.TimeUnit.MINUTES
        );
    }

    /**
     * 清除会话状态
     */
    private void clearSessionState(String sessionId) {
        redisTemplate.delete(SESSION_STATE_KEY + sessionId);
    }

    @Override
    public List<GoodsSpu> semanticSearch(String query, int limit) {
        if (query == null || query.trim().isEmpty()) {
            return new ArrayList<>();
        }

        // 1. 优先使用向量搜索（语义相似度匹配）
        if (vectorSearchService.isAvailable()) {
            try {
                List<GoodsSpu> vectorResults = vectorSearchService.searchSimilarProducts(query, limit);
                if (!vectorResults.isEmpty()) {
                    log.debug("语义搜索使用向量搜索，返回 {} 个结果", vectorResults.size());
                    return vectorResults;
                }
            } catch (Exception e) {
                log.warn("向量搜索失败，降级到关键词搜索: {}", e.getMessage());
            }
        }

        // 2. 降级到关键词搜索
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.and(w -> {
            String[] words = query.split("\\s+");
            for (String word : words) {
                if (word.length() >= 2) {  // 过滤太短的词
                    w.or(q -> q.like(GoodsSpu::getName, word)
                              .or().like(GoodsSpu::getDescription, word));
                }
            }
        });
        wrapper.eq(GoodsSpu::getShelf, "1") // 上架商品
               .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    /**
     * 检查商品列表是否与搜索关键词相关
     * 相关性判断: 商品名称必须包含至少一个关键词的核心部分
     * @param products 商品列表
     * @param keywords 搜索关键词
     * @return 是否有相关商品
     */
    private boolean hasRelevantProducts(List<GoodsSpu> products, List<String> keywords) {
        if (products == null || products.isEmpty()) {
            return false;
        }
        if (keywords == null || keywords.isEmpty()) {
            // 如果没有关键词，则认为所有商品都相关
            return true;
        }

        // 对于每个商品，检查其名称是否包含任一关键词
        for (GoodsSpu product : products) {
            String productName = product.getName();
            if (productName == null) continue;

            productName = productName.toLowerCase();
            for (String keyword : keywords) {
                if (keyword == null || keyword.length() < 2) continue;

                String normalizedKeyword = keyword.toLowerCase().trim();

                // 直接匹配：商品名包含完整关键词
                if (productName.contains(normalizedKeyword)) {
                    log.debug("商品 '{}' 匹配关键词 '{}'", product.getName(), keyword);
                    return true;
                }

                // 部分匹配：关键词长度>=3时，检查是否包含关键词的核心部分
                // 例如："牛肉丸" -> "牛肉" 或 "肉丸" 都算匹配
                if (normalizedKeyword.length() >= 3) {
                    // 检查关键词的前N-1个字符
                    String prefix = normalizedKeyword.substring(0, normalizedKeyword.length() - 1);
                    // 检查关键词的后N-1个字符
                    String suffix = normalizedKeyword.substring(1);

                    if (productName.contains(prefix) || productName.contains(suffix)) {
                        log.debug("商品 '{}' 部分匹配关键词 '{}' (prefix={}, suffix={})",
                                product.getName(), keyword, prefix, suffix);
                        return true;
                    }
                }
            }
        }

        log.debug("无相关商品匹配关键词: keywords={}, products={}",
                keywords, products.stream().map(GoodsSpu::getName).collect(Collectors.toList()));
        return false;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void recordDemand(String sessionId, Long userId, Long merchantId, String userMessage,
                              String aiResponse, List<String> keywords, String intent, double confidence,
                              List<String> matchedProductIds, String demandType) {
        AiDemandRecord record = new AiDemandRecord();
        record.setSessionId(sessionId);
        record.setMessageId(UUID.randomUUID().toString());
        record.setUserId(userId);
        record.setMerchantId(merchantId);
        record.setUserMessage(userMessage);
        record.setAiResponse(aiResponse);

        try {
            record.setExtractedKeywords(objectMapper.writeValueAsString(keywords));
            record.setMatchedProductIds(objectMapper.writeValueAsString(matchedProductIds));
        } catch (Exception e) {
            log.error("JSON序列化失败", e);
        }

        record.setExtractedIntent(intent);
        record.setConfidenceScore(BigDecimal.valueOf(confidence));
        record.setMatchCount(matchedProductIds != null ? matchedProductIds.size() : 0);
        record.setDemandType(demandType);
        record.setDemandUrgency(0);
        record.setStatus(0);
        record.setCreateTime(LocalDateTime.now());

        baseMapper.insert(record);
    }

    @Override
    public List<AiDemandRecord> getSessionHistory(String sessionId) {
        LambdaQueryWrapper<AiDemandRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AiDemandRecord::getSessionId, sessionId)
               .orderByAsc(AiDemandRecord::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public IPage<AiDemandRecord> pageDemands(IPage<AiDemandRecord> page, AiDemandRecord query) {
        return baseMapper.selectPage1(page, query);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateFeedback(Long id, Integer feedback) {
        AiDemandRecord record = baseMapper.selectById(id);
        if (record == null) {
            return false;
        }
        record.setUserFeedback(feedback);
        record.setFeedbackTime(LocalDateTime.now());
        record.setUpdateTime(LocalDateTime.now());
        return baseMapper.updateById(record) > 0;
    }

    @Override
    public Map<String, Integer> getDemandTypeDistribution(int days) {
        LocalDateTime startTime = LocalDateTime.now().minusDays(days);
        LambdaQueryWrapper<AiDemandRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.ge(AiDemandRecord::getCreateTime, startTime)
               .isNotNull(AiDemandRecord::getDemandType);
        List<AiDemandRecord> records = baseMapper.selectList(wrapper);

        return records.stream()
                .collect(Collectors.groupingBy(
                        r -> r.getDemandType() != null ? r.getDemandType() : "other",
                        Collectors.summingInt(r -> 1)
                ));
    }

    /**
     * 调用LLM API分析用户消息
     * 注意: 使用DashScope OpenAI兼容模式时，不支持 response_format 参数
     */
    private Map<String, Object> analyzeMessage(String message) {
        if (llmApiKey == null || llmApiKey.isEmpty()) {
            log.warn("AI API Key未配置，使用降级分析");
            return fallbackAnalysis(message);
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(llmApiKey);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", llmModel);
            requestBody.put("messages", List.of(
                Map.of("role", "system", "content", SYSTEM_PROMPT),
                Map.of("role", "user", "content", message)
            ));
            requestBody.put("temperature", 0.7);
            // 注意: DashScope的qwen模型不支持 response_format 参数，已移除

            String apiUrl = llmBaseUrl + "/v1/chat/completions";
            log.debug("调用AI API: url={}, model={}", apiUrl, llmModel);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl,
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String content = root.path("choices").path(0).path("message").path("content").asText();

                // 尝试解析JSON，如果失败则尝试从文本中提取JSON
                try {
                    // 先尝试直接解析
                    return objectMapper.readValue(content, Map.class);
                } catch (Exception jsonEx) {
                    // 如果直接解析失败，尝试提取JSON部分
                    log.warn("AI返回内容不是纯JSON，尝试提取: {}", content);
                    String jsonContent = extractJsonFromText(content);
                    if (jsonContent != null) {
                        return objectMapper.readValue(jsonContent, Map.class);
                    }
                    // 如果提取也失败，使用AI返回的文本作为response
                    Map<String, Object> result = new HashMap<>();
                    result.put("intent", "other");
                    result.put("keywords", extractKeywordsSimple(message));
                    result.put("response", content);
                    result.put("confidence", 0.7);
                    return result;
                }
            } else {
                log.warn("AI API返回非成功状态: {}", response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("AI API调用失败: {}", e.getMessage(), e);
        }

        return fallbackAnalysis(message);
    }

    /**
     * 使用RAG增强的提示分析用户消息
     * @param message 用户消息
     * @param ragEnhancedPrompt RAG增强的系统提示（可为null，null时使用默认提示）
     * @return 分析结果
     */
    private Map<String, Object> analyzeMessageWithRag(String message, String ragEnhancedPrompt) {
        if (llmApiKey == null || llmApiKey.isEmpty()) {
            log.warn("AI API Key未配置，使用降级分析");
            return fallbackAnalysis(message);
        }

        // 如果没有RAG增强的提示，使用默认提示
        String systemPrompt = (ragEnhancedPrompt != null && !ragEnhancedPrompt.isEmpty())
                ? ragEnhancedPrompt
                : SYSTEM_PROMPT;

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(llmApiKey);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", llmModel);
            requestBody.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", message)
            ));
            requestBody.put("temperature", 0.7);

            String apiUrl = llmBaseUrl + "/v1/chat/completions";
            log.debug("调用AI API (RAG模式={}): url={}, model={}",
                    ragEnhancedPrompt != null, apiUrl, llmModel);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl,
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String content = root.path("choices").path(0).path("message").path("content").asText();

                // 尝试解析JSON
                try {
                    Map<String, Object> result = objectMapper.readValue(content, Map.class);
                    // 标记是否使用了RAG知识
                    if (ragEnhancedPrompt != null) {
                        result.putIfAbsent("sourcedFromKnowledge", true);
                    }
                    return result;
                } catch (Exception jsonEx) {
                    log.warn("AI返回内容不是纯JSON，尝试提取: {}", content);
                    String jsonContent = extractJsonFromText(content);
                    if (jsonContent != null) {
                        Map<String, Object> result = objectMapper.readValue(jsonContent, Map.class);
                        if (ragEnhancedPrompt != null) {
                            result.putIfAbsent("sourcedFromKnowledge", true);
                        }
                        return result;
                    }
                    // 如果提取也失败，使用AI返回的文本作为response
                    Map<String, Object> result = new HashMap<>();
                    result.put("intent", "other");
                    result.put("keywords", extractKeywordsSimple(message));
                    result.put("response", content);
                    result.put("confidence", 0.7);
                    result.put("sourcedFromKnowledge", ragEnhancedPrompt != null);
                    return result;
                }
            } else {
                log.warn("AI API返回非成功状态: {}", response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("AI API调用失败 (RAG模式={}): {}", ragEnhancedPrompt != null, e.getMessage(), e);
        }

        Map<String, Object> fallback = fallbackAnalysis(message);
        fallback.put("sourcedFromKnowledge", false);
        return fallback;
    }

    /**
     * 从文本中提取JSON内容
     */
    private String extractJsonFromText(String text) {
        if (text == null) return null;

        // 尝试找到JSON对象的开始和结束
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');

        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return null;
    }

    /**
     * 简单关键词提取
     */
    private List<String> extractKeywordsSimple(String message) {
        return Arrays.stream(message.split("[，。？！、\\s]+"))
                .filter(s -> s.length() >= 2)
                .limit(5)
                .collect(Collectors.toList());
    }

    /**
     * 降级分析 - 简单关键词提取
     */
    private Map<String, Object> fallbackAnalysis(String message) {
        Map<String, Object> result = new HashMap<>();

        // 简单的意图识别
        String intent = "product_inquiry";
        if (message.contains("价格") || message.contains("多少钱")) {
            intent = "price_inquiry";
        } else if (message.contains("库存") || message.contains("有货")) {
            intent = "stock_inquiry";
        } else if (message.contains("怎么") || message.contains("如何")) {
            intent = "usage_inquiry";
        }

        // 提取关键词 (简单分词)
        List<String> keywords = Arrays.stream(message.split("[，。？！、\\s]+"))
                .filter(s -> s.length() >= 2)
                .collect(Collectors.toList());

        result.put("intent", intent);
        result.put("keywords", keywords);
        result.put("response", generateFallbackResponse(message, keywords));
        result.put("confidence", 0.6);

        return result;
    }

    /**
     * 生成降级回复
     */
    private String generateFallbackResponse(String message, List<String> keywords) {
        if (keywords.isEmpty()) {
            return "您好！请问您想了解什么商品？";
        }

        String keywordStr = String.join("、", keywords);
        return String.format("您好！我正在为您搜索与「%s」相关的商品，请稍候...", keywordStr);
    }

    @Override
    public Map<String, Object> getIndustryAnalysis(boolean forceRefresh) {
        Map<String, Object> result = new HashMap<>();

        try {
            // 1. 获取商品分类统计
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getShelf, 1);
            List<GoodsSpu> allProducts = goodsSpuMapper.selectList(wrapper);

            // 2. 统计商品数量
            int totalProducts = allProducts.size();

            // 3. 获取需求趋势 (最近30天)
            Map<String, Integer> demandTrend = getDemandTypeDistribution(30);

            // 4. 计算热门品类
            Map<String, Long> categoryCount = allProducts.stream()
                    .filter(p -> p.getCategoryFirst() != null)
                    .collect(Collectors.groupingBy(
                            p -> p.getCategoryFirst().toString(),
                            Collectors.counting()
                    ));

            // 5. 获取搜索热词
            List<String> hotKeywords = searchKeywordService.getHotKeywords(10).stream()
                    .map(stat -> stat.getKeyword())
                    .collect(Collectors.toList());

            // 构建响应
            result.put("totalProducts", totalProducts);
            result.put("demandTrend", demandTrend);
            result.put("categoryDistribution", categoryCount);
            result.put("hotKeywords", hotKeywords);
            result.put("period", "最近30天");
            result.put("generatedAt", LocalDateTime.now().toString());

            // 如果配置了AI，添加AI分析
            if (llmApiKey != null && !llmApiKey.isEmpty()) {
                String aiInsight = generateIndustryInsight(demandTrend, hotKeywords);
                result.put("aiInsight", aiInsight);
            }

        } catch (Exception e) {
            log.error("获取行业分析失败", e);
            result.put("error", "分析数据生成失败");
        }

        return result;
    }

    @Override
    public Map<String, Object> getProductAnalysis(String productId) {
        Map<String, Object> result = new HashMap<>();

        try {
            // 1. 获取产品信息
            GoodsSpu product = goodsSpuMapper.selectById(productId);
            if (product == null) {
                result.put("error", "产品不存在");
                return result;
            }

            result.put("product", product);
            result.put("productId", productId);
            result.put("productName", product.getName());

            // 2. 查询该产品的AI咨询记录
            LambdaQueryWrapper<AiDemandRecord> wrapper = new LambdaQueryWrapper<>();
            wrapper.like(AiDemandRecord::getMatchedProductIds, productId)
                   .ge(AiDemandRecord::getCreateTime, LocalDateTime.now().minusDays(30));
            List<AiDemandRecord> relatedDemands = baseMapper.selectList(wrapper);

            // 3. 统计咨询次数和意图分布
            result.put("inquiryCount", relatedDemands.size());
            Map<String, Long> intentDistribution = relatedDemands.stream()
                    .filter(r -> r.getExtractedIntent() != null)
                    .collect(Collectors.groupingBy(
                            AiDemandRecord::getExtractedIntent,
                            Collectors.counting()
                    ));
            result.put("intentDistribution", intentDistribution);

            // 4. 计算满意度
            long positiveCount = relatedDemands.stream()
                    .filter(r -> r.getUserFeedback() != null && r.getUserFeedback() == 1)
                    .count();
            long totalFeedback = relatedDemands.stream()
                    .filter(r -> r.getUserFeedback() != null && r.getUserFeedback() >= 0)
                    .count();
            double satisfaction = totalFeedback > 0 ? (double) positiveCount / totalFeedback * 100 : 0;
            result.put("satisfactionRate", String.format("%.1f%%", satisfaction));

            // 5. 提取相关关键词
            Set<String> relatedKeywords = new HashSet<>();
            for (AiDemandRecord demand : relatedDemands) {
                if (demand.getExtractedKeywords() != null) {
                    try {
                        List<String> keywords = objectMapper.readValue(
                                demand.getExtractedKeywords(), List.class);
                        relatedKeywords.addAll(keywords);
                    } catch (Exception ignored) {}
                }
            }
            result.put("relatedKeywords", new ArrayList<>(relatedKeywords));

            result.put("period", "最近30天");
            result.put("generatedAt", LocalDateTime.now().toString());

        } catch (Exception e) {
            log.error("获取产品分析失败: productId={}", productId, e);
            result.put("error", "产品分析生成失败");
        }

        return result;
    }

    @Override
    public Map<String, Object> getFactoryAnalysis(Long factoryId) {
        Map<String, Object> result = new HashMap<>();

        try {
            // 1. 获取该供应商/工厂的商品
            // 注意: 这里假设 GoodsSpu 有 supplierId 或类似字段
            // 如果没有，可以返回整体市场分析
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getShelf, 1);
            // 如果有供应商关联: wrapper.eq(GoodsSpu::getSupplierId, factoryId);
            List<GoodsSpu> products = goodsSpuMapper.selectList(wrapper);

            result.put("factoryId", factoryId);
            result.put("totalProducts", products.size());

            // 2. 统计产品分类
            Map<String, Long> categoryStats = products.stream()
                    .filter(p -> p.getCategoryFirst() != null)
                    .collect(Collectors.groupingBy(
                            p -> p.getCategoryFirst().toString(),
                            Collectors.counting()
                    ));
            result.put("categoryDistribution", categoryStats);

            // 3. 获取相关的需求记录 (按商户ID)
            LambdaQueryWrapper<AiDemandRecord> demandWrapper = new LambdaQueryWrapper<>();
            demandWrapper.eq(AiDemandRecord::getMerchantId, factoryId)
                        .ge(AiDemandRecord::getCreateTime, LocalDateTime.now().minusDays(30));
            List<AiDemandRecord> demands = baseMapper.selectList(demandWrapper);

            result.put("totalInquiries", demands.size());

            // 4. 需求类型统计
            Map<String, Long> demandTypes = demands.stream()
                    .filter(d -> d.getDemandType() != null)
                    .collect(Collectors.groupingBy(
                            AiDemandRecord::getDemandType,
                            Collectors.counting()
                    ));
            result.put("demandTypeDistribution", demandTypes);

            // 5. 计算平均置信度
            double avgConfidence = demands.stream()
                    .filter(d -> d.getConfidenceScore() != null)
                    .mapToDouble(d -> d.getConfidenceScore().doubleValue())
                    .average()
                    .orElse(0.0);
            result.put("avgMatchConfidence", String.format("%.2f", avgConfidence));

            // 6. 热门需求关键词
            Map<String, Integer> keywordFreq = new HashMap<>();
            for (AiDemandRecord demand : demands) {
                if (demand.getExtractedKeywords() != null) {
                    try {
                        List<String> keywords = objectMapper.readValue(
                                demand.getExtractedKeywords(), List.class);
                        for (String kw : keywords) {
                            keywordFreq.merge(kw, 1, Integer::sum);
                        }
                    } catch (Exception ignored) {}
                }
            }
            List<Map.Entry<String, Integer>> topKeywords = keywordFreq.entrySet().stream()
                    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                    .limit(10)
                    .collect(Collectors.toList());
            result.put("topDemandKeywords", topKeywords);

            result.put("period", "最近30天");
            result.put("generatedAt", LocalDateTime.now().toString());

        } catch (Exception e) {
            log.error("获取工厂分析失败: factoryId={}", factoryId, e);
            result.put("error", "工厂分析生成失败");
        }

        return result;
    }

    /**
     * 使用AI生成行业洞察
     */
    private String generateIndustryInsight(Map<String, Integer> demandTrend, List<String> hotKeywords) {
        try {
            String prompt = String.format(
                "根据以下数据生成简短的行业洞察（不超过100字）：\n需求趋势：%s\n热门关键词：%s",
                demandTrend.toString(),
                String.join("、", hotKeywords)
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(llmApiKey);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", llmModel);
            requestBody.put("messages", List.of(
                Map.of("role", "user", "content", prompt)
            ));
            requestBody.put("max_tokens", 150);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    llmBaseUrl + "/v1/chat/completions",
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                return root.path("choices").path(0).path("message").path("content").asText();
            }
        } catch (Exception e) {
            log.warn("AI洞察生成失败", e);
        }

        return "暂无AI分析";
    }
}
