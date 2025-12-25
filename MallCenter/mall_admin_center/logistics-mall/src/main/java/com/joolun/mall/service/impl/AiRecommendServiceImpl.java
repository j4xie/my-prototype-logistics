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
import com.joolun.mall.service.SearchKeywordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
 * 集成DeepSeek API进行语义理解和商品推荐
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiRecommendServiceImpl extends ServiceImpl<AiDemandRecordMapper, AiDemandRecord>
        implements AiRecommendService {

    private final GoodsSpuMapper goodsSpuMapper;
    private final SearchKeywordService searchKeywordService;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${ai.deepseek.api-key:}")
    private String deepseekApiKey;

    @Value("${ai.deepseek.base-url:https://api.deepseek.com}")
    private String deepseekBaseUrl;

    @Value("${ai.deepseek.model:deepseek-chat}")
    private String deepseekModel;

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
            // 1. 调用DeepSeek API分析用户意图
            Map<String, Object> analysis = analyzeMessage(message);
            String intent = (String) analysis.getOrDefault("intent", "other");
            List<String> keywords = (List<String>) analysis.getOrDefault("keywords", new ArrayList<>());
            String aiResponse = (String) analysis.getOrDefault("response", "抱歉，我没有理解您的问题");
            double confidence = (double) analysis.getOrDefault("confidence", 0.5);

            // 2. 根据关键词搜索商品
            List<GoodsSpu> matchedProducts = new ArrayList<>();
            if (!keywords.isEmpty()) {
                matchedProducts = semanticSearch(String.join(" ", keywords), 5);
            }

            // 3. 构建响应
            result.put("sessionId", sessionId);
            result.put("response", aiResponse);
            result.put("intent", intent);
            result.put("keywords", keywords);
            result.put("products", matchedProducts);
            result.put("hasProducts", !matchedProducts.isEmpty());

            // 4. 记录需求
            List<String> productIds = matchedProducts.stream()
                    .map(GoodsSpu::getId)
                    .collect(Collectors.toList());
            recordDemand(sessionId, userId, merchantId, message, aiResponse, keywords,
                    intent, confidence, productIds, intent);

            // 5. 如果是产品咨询且无结果，记录搜索关键词
            if ("product_inquiry".equals(intent) && matchedProducts.isEmpty()) {
                for (String keyword : keywords) {
                    searchKeywordService.recordSearch(keyword, userId, merchantId, null, 0, "ai_chat");
                }
            }

        } catch (Exception e) {
            log.error("AI chat error", e);
            result.put("response", "抱歉，系统暂时无法处理您的请求，请稍后重试。");
            result.put("error", e.getMessage());
        }

        return result;
    }

    @Override
    public List<GoodsSpu> semanticSearch(String query, int limit) {
        if (query == null || query.trim().isEmpty()) {
            return new ArrayList<>();
        }

        // 简单的关键词匹配搜索
        // 实际生产环境可以使用Elasticsearch或向量搜索
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.and(w -> {
            String[] words = query.split("\\s+");
            for (String word : words) {
                w.or(q -> q.like(GoodsSpu::getName, word)
                          .or().like(GoodsSpu::getDescription, word));
            }
        });
        wrapper.eq(GoodsSpu::getShelf, 1) // 上架商品
               .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
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
     * 调用DeepSeek API分析用户消息
     */
    private Map<String, Object> analyzeMessage(String message) {
        if (deepseekApiKey == null || deepseekApiKey.isEmpty()) {
            // 无API Key时使用简单的关键词提取
            return fallbackAnalysis(message);
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(deepseekApiKey);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", deepseekModel);
            requestBody.put("messages", List.of(
                Map.of("role", "system", "content", SYSTEM_PROMPT),
                Map.of("role", "user", "content", message)
            ));
            requestBody.put("temperature", 0.7);
            requestBody.put("response_format", Map.of("type", "json_object"));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    deepseekBaseUrl + "/v1/chat/completions",
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String content = root.path("choices").path(0).path("message").path("content").asText();
                return objectMapper.readValue(content, Map.class);
            }
        } catch (Exception e) {
            log.error("DeepSeek API调用失败", e);
        }

        return fallbackAnalysis(message);
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
            if (deepseekApiKey != null && !deepseekApiKey.isEmpty()) {
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
            headers.setBearerAuth(deepseekApiKey);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", deepseekModel);
            requestBody.put("messages", List.of(
                Map.of("role", "user", "content", prompt)
            ));
            requestBody.put("max_tokens", 150);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    deepseekBaseUrl + "/v1/chat/completions",
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
