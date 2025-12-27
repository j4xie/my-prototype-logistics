package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.*;
import com.joolun.mall.mapper.*;
import com.joolun.mall.service.BanditExplorer;
import com.joolun.mall.service.LinUCBExplorer;
import com.joolun.mall.service.ThompsonSamplingExplorer;
import com.joolun.mall.service.UserBehaviorTrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * 用户行为追踪服务实现
 * 记录用户行为并通过AI更新兴趣标签
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserBehaviorTrackingServiceImpl implements UserBehaviorTrackingService {

    private final UserBehaviorEventMapper behaviorEventMapper;
    private final UserInterestTagMapper interestTagMapper;
    private final UserRecommendationProfileMapper profileMapper;
    private final GoodsSpuMapper goodsSpuMapper;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;
    private final RestTemplate restTemplate;

    // 探索器依赖 (使用@Lazy避免循环依赖)
    private LinUCBExplorer linUCBExplorer;
    private ThompsonSamplingExplorer thompsonSamplingExplorer;

    @Autowired
    public void setLinUCBExplorer(@Lazy LinUCBExplorer linUCBExplorer) {
        this.linUCBExplorer = linUCBExplorer;
    }

    @Autowired
    public void setThompsonSamplingExplorer(@Lazy ThompsonSamplingExplorer thompsonSamplingExplorer) {
        this.thompsonSamplingExplorer = thompsonSamplingExplorer;
    }

    // Redis 探索标记前缀
    private static final String LINUCB_EXPLORATION_PREFIX = "linucb:exploration:";
    private static final String TS_EXPLORATION_PREFIX = "ts:exploration:";

    @Value("${ai.deepseek.api-key:}")
    private String deepseekApiKey;

    @Value("${ai.deepseek.base-url:https://api.deepseek.com}")
    private String deepseekBaseUrl;

    @Value("${ai.deepseek.model:deepseek-chat}")
    private String deepseekModel;

    // 权重配置
    private static final double VIEW_WEIGHT = 0.05;      // 浏览权重
    private static final double CLICK_WEIGHT = 0.1;       // 点击权重
    private static final double SEARCH_WEIGHT = 0.15;     // 搜索权重
    private static final double CART_WEIGHT = 0.2;        // 加购权重
    private static final double PURCHASE_WEIGHT = 0.3;    // 购买权重

    // 画像状态阈值
    private static final int COLD_START_THRESHOLD = 10;   // 冷启动阈值
    private static final int WARMING_THRESHOLD = 50;      // 预热阈值
    private static final int MATURE_THRESHOLD = 100;      // 成熟阈值

    // P1性能优化: AI调用频率限制
    private static final String AI_CALL_LIMIT_PREFIX = "ai:interest:last_call:";
    private static final long AI_CALL_INTERVAL_MINUTES = 5;  // 每用户5分钟内只调用一次AI

    @Override
    @Transactional
    public void trackEvent(UserBehaviorEvent event) {
        // 设置默认时间
        if (event.getEventTime() == null) {
            event.setEventTime(LocalDateTime.now());
        }
        if (event.getCreateTime() == null) {
            event.setCreateTime(LocalDateTime.now());
        }

        // 保存事件
        behaviorEventMapper.insert(event);
        log.info("记录用户行为: wxUserId={}, eventType={}, targetId={}",
                event.getWxUserId(), event.getEventType(), event.getTargetId());

        // 异步更新兴趣标签
        asyncUpdateInterests(event);
    }

    @Override
    @Transactional
    public void trackEvents(List<UserBehaviorEvent> events) {
        if (events == null || events.isEmpty()) {
            return;
        }

        // P0性能优化: 批量处理事件
        // 1. 设置默认时间
        LocalDateTime now = LocalDateTime.now();
        for (UserBehaviorEvent event : events) {
            if (event.getEventTime() == null) {
                event.setEventTime(now);
            }
            if (event.getCreateTime() == null) {
                event.setCreateTime(now);
            }
        }

        // 2. 批量插入事件（1次INSERT代替N次）
        behaviorEventMapper.insertBatch(events);
        log.info("批量记录用户行为: {} 条事件", events.size());

        // 3. 按用户分组，每个用户只触发一次异步更新
        Map<String, UserBehaviorEvent> userLastEvents = new HashMap<>();
        for (UserBehaviorEvent event : events) {
            // 保留每个用户的最后一个事件用于触发更新
            userLastEvents.put(event.getWxUserId(), event);
        }

        // 4. 每个用户只触发一次异步兴趣更新
        for (UserBehaviorEvent lastEvent : userLastEvents.values()) {
            asyncUpdateInterests(lastEvent);
        }
    }

    @Override
    public void trackProductView(String wxUserId, String productId, String productName,
                                  Map<String, Object> eventData) {
        UserBehaviorEvent event = new UserBehaviorEvent();
        event.setWxUserId(wxUserId);
        event.setEventType("view");
        event.setTargetType("product");
        event.setTargetId(productId);
        event.setTargetName(productName);
        event.setSourceType("view");

        try {
            event.setEventData(objectMapper.writeValueAsString(eventData));
        } catch (JsonProcessingException e) {
            log.warn("序列化事件数据失败", e);
        }

        trackEvent(event);

        // 处理探索推荐的反馈
        processExplorationFeedback(wxUserId, productId, true);
    }

    /**
     * 处理探索推荐的反馈
     * 当用户浏览/加购/购买了探索推荐的商品时，更新Bandit算法的奖励
     *
     * @param wxUserId 用户ID
     * @param productId 商品ID
     * @param isPositive 是否为正向反馈
     */
    private void processExplorationFeedback(String wxUserId, String productId, boolean isPositive) {
        try {
            // 检查是否是 LinUCB 探索推荐
            String linucbKey = LINUCB_EXPLORATION_PREFIX + wxUserId + ":" + productId;
            String linucbCategory = redisTemplate.opsForValue().get(linucbKey);
            if (linucbCategory != null && linUCBExplorer != null) {
                linUCBExplorer.handleExplorationFeedback(wxUserId, productId, isPositive);
                log.info("[LinUCB反馈] wxUserId={}, productId={}, isPositive={}, category={}",
                        wxUserId, productId, isPositive, linucbCategory);
                return;
            }

            // 检查是否是 Thompson Sampling 探索推荐
            String tsKey = TS_EXPLORATION_PREFIX + wxUserId + ":" + productId;
            String tsCategory = redisTemplate.opsForValue().get(tsKey);
            if (tsCategory != null && thompsonSamplingExplorer != null) {
                thompsonSamplingExplorer.handleExplorationFeedback(wxUserId, productId, isPositive);
                log.info("[TS反馈] wxUserId={}, productId={}, isPositive={}, category={}",
                        wxUserId, productId, isPositive, tsCategory);
            }
        } catch (Exception e) {
            log.warn("处理探索反馈失败: wxUserId={}, productId={}, error={}",
                    wxUserId, productId, e.getMessage());
        }
    }

    @Override
    public void trackSearch(String wxUserId, String keyword, int resultCount) {
        UserBehaviorEvent event = new UserBehaviorEvent();
        event.setWxUserId(wxUserId);
        event.setEventType("search");
        event.setTargetType("search");
        event.setTargetId(keyword);
        event.setTargetName(keyword);
        event.setSourceType("search");

        Map<String, Object> eventData = new HashMap<>();
        eventData.put("search_keyword", keyword);
        eventData.put("result_count", resultCount);

        try {
            event.setEventData(objectMapper.writeValueAsString(eventData));
        } catch (JsonProcessingException e) {
            log.warn("序列化搜索数据失败", e);
        }

        trackEvent(event);
    }

    @Override
    public void trackCartAdd(String wxUserId, String productId, String productName, int quantity) {
        UserBehaviorEvent event = new UserBehaviorEvent();
        event.setWxUserId(wxUserId);
        event.setEventType("cart_add");
        event.setTargetType("product");
        event.setTargetId(productId);
        event.setTargetName(productName);
        event.setSourceType("cart");

        Map<String, Object> eventData = new HashMap<>();
        eventData.put("quantity", quantity);

        try {
            event.setEventData(objectMapper.writeValueAsString(eventData));
        } catch (JsonProcessingException e) {
            log.warn("序列化加购数据失败", e);
        }

        trackEvent(event);

        // 处理探索推荐的反馈 (加购是更强的正向信号)
        processExplorationFeedback(wxUserId, productId, true);
    }

    @Override
    @Transactional
    public void trackPurchase(String wxUserId, List<String> productIds, Map<String, Object> orderInfo) {
        for (String productId : productIds) {
            UserBehaviorEvent event = new UserBehaviorEvent();
            event.setWxUserId(wxUserId);
            event.setEventType("purchase");
            event.setTargetType("product");
            event.setTargetId(productId);
            event.setSourceType("order");

            try {
                event.setEventData(objectMapper.writeValueAsString(orderInfo));
            } catch (JsonProcessingException e) {
                log.warn("序列化订单数据失败", e);
            }

            trackEvent(event);
        }

        // 更新用户画像购买次数
        updatePurchaseCount(wxUserId);
    }

    @Override
    public List<UserInterestTag> getUserInterestTags(String wxUserId, int limit) {
        return interestTagMapper.selectTopTags(wxUserId, limit);
    }

    @Override
    public UserRecommendationProfile getUserProfile(String wxUserId) {
        UserRecommendationProfile profile = profileMapper.selectByWxUserId(wxUserId);
        if (profile == null) {
            // 创建新的画像
            profile = createNewProfile(wxUserId);
        }
        return profile;
    }

    @Override
    @Transactional
    public void updateUserInterests(String wxUserId) {
        // 获取最近的行为数据
        List<UserBehaviorEvent> recentEvents = behaviorEventMapper.selectRecentEvents(wxUserId, 100);
        if (recentEvents.isEmpty()) {
            return;
        }

        // 通过AI分析用户兴趣
        analyzeInterestsWithAI(wxUserId, recentEvents);
    }

    @Override
    public List<String> getSearchHistory(String wxUserId, int limit) {
        return behaviorEventMapper.selectSearchHistory(wxUserId, limit);
    }

    @Override
    public List<String> getRecentViewedProducts(String wxUserId, int limit) {
        return behaviorEventMapper.selectViewedProductIds(wxUserId, limit);
    }

    /**
     * 异步更新兴趣标签
     */
    @Async
    protected void asyncUpdateInterests(UserBehaviorEvent event) {
        try {
            // 获取事件权重
            double weight = getEventWeight(event.getEventType());

            // 根据目标类型更新标签
            if ("product".equals(event.getTargetType()) && event.getTargetId() != null) {
                updateProductInterests(event.getWxUserId(), event.getTargetId(), weight);
            } else if ("search".equals(event.getTargetType())) {
                updateSearchInterests(event.getWxUserId(), event.getTargetId(), weight);
            }

            // 更新用户画像状态
            updateProfileStatus(event.getWxUserId());

        } catch (Exception e) {
            log.error("异步更新兴趣失败", e);
        }
    }

    /**
     * 更新商品相关兴趣
     */
    private void updateProductInterests(String wxUserId, String productId, double weight) {
        // 获取商品信息
        GoodsSpu product = goodsSpuMapper.selectById(productId);
        if (product == null) return;

        // 更新分类标签
        if (product.getCategoryFirst() != null) {
            updateOrInsertTag(wxUserId, "category", product.getCategoryFirst(), weight, 1);
        }
        if (product.getCategorySecond() != null) {
            updateOrInsertTag(wxUserId, "category", product.getCategorySecond(), weight * 0.8, 2);
        }

        // 更新品牌标签 (从商品名称提取)
        String brand = extractBrandFromName(product.getName());
        if (brand != null) {
            updateOrInsertTag(wxUserId, "brand", brand, weight * 0.6, 1);
        }

        // 更新价格区间标签
        if (product.getSalesPrice() != null) {
            String priceRange = getPriceRange(product.getSalesPrice().doubleValue());
            updateOrInsertTag(wxUserId, "price_range", priceRange, weight * 0.4, 1);
        }
    }

    /**
     * 更新搜索关键词兴趣
     */
    private void updateSearchInterests(String wxUserId, String keyword, double weight) {
        if (keyword == null || keyword.isEmpty()) return;
        updateOrInsertTag(wxUserId, "keyword", keyword, weight, 1);
    }

    /**
     * 更新或插入标签
     * P1性能优化: 使用原子性 UPSERT (INSERT ON DUPLICATE KEY UPDATE)
     * 一次数据库调用完成，无竞态条件
     */
    private void updateOrInsertTag(String wxUserId, String tagType, String tagValue,
                                    double weight, int level) {
        // P1性能优化: 使用原子性 UPSERT，避免 UPDATE→INSERT→冲突→重试 的多次调用
        double weightIncrement = weight * 0.5;  // 权重增量

        try {
            interestTagMapper.upsertTag(
                    wxUserId,
                    tagType,
                    tagValue,
                    level,
                    weight,           // 初始权重（仅新插入时使用）
                    0.5,              // 初始置信度
                    "behavior",       // 来源
                    weightIncrement   // 权重增量（已存在时使用）
            );
        } catch (Exception e) {
            log.warn("UPSERT标签失败: wxUserId={}, tag={}:{}, error={}",
                    wxUserId, tagType, tagValue, e.getMessage());
        }
    }

    /**
     * 更新用户画像状态
     */
    private void updateProfileStatus(String wxUserId) {
        int behaviorCount = behaviorEventMapper.countByWxUserId(wxUserId);
        String status;

        if (behaviorCount < COLD_START_THRESHOLD) {
            status = "cold_start";
        } else if (behaviorCount < WARMING_THRESHOLD) {
            status = "warming";
        } else if (behaviorCount < MATURE_THRESHOLD) {
            status = "mature";
        } else {
            status = "mature";
        }

        int updated = profileMapper.updateStatus(wxUserId, status, behaviorCount);
        if (updated == 0) {
            // 不存在则创建
            createNewProfile(wxUserId);
        }
    }

    /**
     * 创建新的用户画像
     */
    private UserRecommendationProfile createNewProfile(String wxUserId) {
        UserRecommendationProfile profile = new UserRecommendationProfile();
        profile.setWxUserId(wxUserId);
        profile.setProfileStatus("cold_start");
        profile.setBehaviorCount(0);
        profile.setPurchaseCount(0);
        profile.setColdStartStrategy("popular");
        profile.setFirstVisitTime(LocalDateTime.now());
        profile.setLastActiveTime(LocalDateTime.now());
        profile.setCreateTime(LocalDateTime.now());
        profile.setUpdateTime(LocalDateTime.now());

        profileMapper.insert(profile);
        return profile;
    }

    /**
     * 更新购买次数
     */
    private void updatePurchaseCount(String wxUserId) {
        UserRecommendationProfile profile = profileMapper.selectByWxUserId(wxUserId);
        if (profile != null) {
            profile.setPurchaseCount(profile.getPurchaseCount() + 1);
            profile.setLastActiveTime(LocalDateTime.now());
            profileMapper.updateById(profile);
        }
    }

    /**
     * 通过AI分析用户兴趣
     * P1性能优化: 添加频率限制，每用户5分钟内只调用一次AI
     */
    private void analyzeInterestsWithAI(String wxUserId, List<UserBehaviorEvent> events) {
        if (deepseekApiKey == null || deepseekApiKey.isEmpty()) {
            log.debug("AI服务未配置，跳过AI分析");
            return;
        }

        // P1性能优化: 检查频率限制
        String limitKey = AI_CALL_LIMIT_PREFIX + wxUserId;
        Boolean isLimited = redisTemplate.hasKey(limitKey);
        if (Boolean.TRUE.equals(isLimited)) {
            log.debug("AI分析频率限制: wxUserId={} 在{}分钟内已调用过", wxUserId, AI_CALL_INTERVAL_MINUTES);
            return;
        }

        try {
            // 设置频率限制标记（提前设置，防止并发调用）
            redisTemplate.opsForValue().set(limitKey, String.valueOf(System.currentTimeMillis()),
                    AI_CALL_INTERVAL_MINUTES, TimeUnit.MINUTES);
            // 构建行为摘要
            StringBuilder behaviorSummary = new StringBuilder();
            behaviorSummary.append("用户最近行为记录:\n");

            Map<String, Integer> eventTypeCounts = new HashMap<>();
            Set<String> viewedProducts = new HashSet<>();
            Set<String> searchKeywords = new HashSet<>();

            for (UserBehaviorEvent event : events) {
                eventTypeCounts.merge(event.getEventType(), 1, Integer::sum);

                if ("product".equals(event.getTargetType())) {
                    viewedProducts.add(event.getTargetName() != null ? event.getTargetName() : event.getTargetId());
                }
                if ("search".equals(event.getEventType())) {
                    searchKeywords.add(event.getTargetId());
                }
            }

            behaviorSummary.append("行为统计: ").append(eventTypeCounts).append("\n");
            behaviorSummary.append("浏览商品: ").append(String.join(", ", viewedProducts)).append("\n");
            behaviorSummary.append("搜索关键词: ").append(String.join(", ", searchKeywords)).append("\n");

            // 调用AI分析
            String prompt = String.format("""
                基于以下用户行为数据，分析用户的兴趣偏好，以JSON格式返回:

                %s

                请返回如下格式:
                {
                  "interests": [
                    {"type": "category", "value": "肉类", "confidence": 0.9},
                    {"type": "brand", "value": "科尔沁", "confidence": 0.7},
                    {"type": "feature", "value": "进口", "confidence": 0.6}
                  ],
                  "userProfile": {
                    "pricePreference": "medium",
                    "mainInterests": ["牛肉", "海鲜"],
                    "suggestions": ["可能对高端产品感兴趣"]
                  }
                }
                """, behaviorSummary);

            // 调用DashScope API
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(deepseekApiKey);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", deepseekModel);
            requestBody.put("messages", List.of(
                    Map.of("role", "system", "content", "你是一个用户行为分析专家，擅长从行为数据中提取用户兴趣标签。"),
                    Map.of("role", "user", "content", prompt)
            ));
            requestBody.put("temperature", 0.3);
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

                // 解析AI响应并更新标签
                parseAndUpdateAIInterests(wxUserId, content);
            }

        } catch (Exception e) {
            log.error("AI分析用户兴趣失败", e);
        }
    }

    /**
     * 解析AI响应并更新兴趣标签
     */
    private void parseAndUpdateAIInterests(String wxUserId, String aiResponse) {
        try {
            JsonNode root = objectMapper.readTree(aiResponse);
            JsonNode interests = root.path("interests");

            if (interests.isArray()) {
                for (JsonNode interest : interests) {
                    String type = interest.path("type").asText();
                    String value = interest.path("value").asText();
                    double confidence = interest.path("confidence").asDouble(0.5);

                    // 更新或插入AI分析的标签
                    updateAITag(wxUserId, type, value, confidence);
                }
            }

            // 更新用户画像
            JsonNode userProfile = root.path("userProfile");
            if (!userProfile.isMissingNode()) {
                updateProfileFromAI(wxUserId, userProfile);
            }

        } catch (Exception e) {
            log.error("解析AI响应失败", e);
        }
    }

    /**
     * 更新AI分析的标签
     */
    private void updateAITag(String wxUserId, String tagType, String tagValue, double confidence) {
        LambdaQueryWrapper<UserInterestTag> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserInterestTag::getWxUserId, wxUserId)
                .eq(UserInterestTag::getTagType, tagType)
                .eq(UserInterestTag::getTagValue, tagValue);

        UserInterestTag existing = interestTagMapper.selectOne(wrapper);

        if (existing != null) {
            // 更新置信度
            existing.setConfidence(new BigDecimal(confidence));
            existing.setSource("ai_analysis");
            existing.setUpdateTime(LocalDateTime.now());
            interestTagMapper.updateById(existing);
        } else {
            // 插入新标签
            UserInterestTag tag = new UserInterestTag();
            tag.setWxUserId(wxUserId);
            tag.setTagType(tagType);
            tag.setTagValue(tagValue);
            tag.setTagLevel(1);
            tag.setWeight(new BigDecimal(confidence * 0.5));
            tag.setConfidence(new BigDecimal(confidence));
            tag.setSource("ai_analysis");
            tag.setInteractionCount(0);
            tag.setDecayFactor(new BigDecimal("1.0"));
            tag.setCreateTime(LocalDateTime.now());
            tag.setUpdateTime(LocalDateTime.now());
            interestTagMapper.insert(tag);
        }
    }

    /**
     * 从AI分析结果更新用户画像
     */
    private void updateProfileFromAI(String wxUserId, JsonNode userProfile) {
        try {
            UserRecommendationProfile profile = profileMapper.selectByWxUserId(wxUserId);
            if (profile == null) return;

            // 更新偏好信息
            if (userProfile.has("pricePreference")) {
                Map<String, Object> pricePrefs = new HashMap<>();
                pricePrefs.put("range", userProfile.path("pricePreference").asText());
                profile.setPricePreferences(objectMapper.writeValueAsString(pricePrefs));
            }

            if (userProfile.has("mainInterests")) {
                Map<String, Double> categoryPrefs = new HashMap<>();
                for (JsonNode interest : userProfile.path("mainInterests")) {
                    categoryPrefs.put(interest.asText(), 0.8);
                }
                profile.setCategoryPreferences(objectMapper.writeValueAsString(categoryPrefs));
            }

            profile.setUpdateTime(LocalDateTime.now());
            profileMapper.updateById(profile);

        } catch (Exception e) {
            log.error("更新用户画像失败", e);
        }
    }

    /**
     * 获取事件权重
     */
    private double getEventWeight(String eventType) {
        return switch (eventType) {
            case "view" -> VIEW_WEIGHT;
            case "click" -> CLICK_WEIGHT;
            case "search" -> SEARCH_WEIGHT;
            case "cart_add" -> CART_WEIGHT;
            case "purchase" -> PURCHASE_WEIGHT;
            default -> VIEW_WEIGHT;
        };
    }

    /**
     * 从商品名称提取品牌
     */
    private String extractBrandFromName(String name) {
        if (name == null) return null;
        // 常见品牌关键词
        String[] brands = {"科尔沁", "恒都", "大庄园", "东来顺", "獐子岛", "正大"};
        for (String brand : brands) {
            if (name.contains(brand)) {
                return brand;
            }
        }
        return null;
    }

    /**
     * 获取价格区间
     */
    private String getPriceRange(double price) {
        if (price < 50) return "低价";
        if (price < 150) return "中低价";
        if (price < 300) return "中等";
        if (price < 500) return "中高价";
        return "高价";
    }

    /**
     * 完成冷启动
     * 用户首次使用时选择偏好后调用，保存初始偏好并标记冷启动已完成
     */
    @Override
    @Transactional
    public void completeColdStart(String wxUserId, Map<String, Object> preferences) {
        log.info("完成冷启动: wxUserId={}, preferences={}", wxUserId, preferences);

        // 获取或创建用户画像
        UserRecommendationProfile profile = profileMapper.selectByWxUserId(wxUserId);
        if (profile == null) {
            profile = createNewProfile(wxUserId);
        }

        try {
            // 1. 保存品类偏好
            @SuppressWarnings("unchecked")
            List<String> categories = (List<String>) preferences.get("categories");
            if (categories != null && !categories.isEmpty()) {
                Map<String, Double> categoryPrefs = new HashMap<>();
                for (String category : categories) {
                    categoryPrefs.put(category, 1.0);  // 初始权重1.0
                    // 同时创建兴趣标签
                    createOrUpdateInterestTag(wxUserId, "category", category, 1.0, "cold_start");
                }
                profile.setCategoryPreferences(objectMapper.writeValueAsString(categoryPrefs));
            }

            // 2. 保存价格偏好 (支持 String 或 Map 格式)
            Object priceRangeObj = preferences.get("priceRange");
            if (priceRangeObj != null) {
                String priceRangeValue;
                Map<String, Object> pricePrefs = new HashMap<>();

                if (priceRangeObj instanceof Map) {
                    // 前端发送对象格式: {range: "medium", label: "品质之选"}
                    @SuppressWarnings("unchecked")
                    Map<String, Object> priceRangeMap = (Map<String, Object>) priceRangeObj;
                    priceRangeValue = (String) priceRangeMap.get("range");
                    pricePrefs.put("range", priceRangeValue);
                    pricePrefs.put("label", priceRangeMap.get("label"));
                } else {
                    // 兼容简单字符串格式
                    priceRangeValue = (String) priceRangeObj;
                    pricePrefs.put("range", priceRangeValue);
                }

                if (priceRangeValue != null) {
                    profile.setPricePreferences(objectMapper.writeValueAsString(pricePrefs));
                    // 创建价格兴趣标签
                    createOrUpdateInterestTag(wxUserId, "price_range", priceRangeValue, 0.8, "cold_start");
                }
            }

            // 3. 保存品牌偏好
            @SuppressWarnings("unchecked")
            List<String> brands = (List<String>) preferences.get("brands");
            if (brands != null && !brands.isEmpty()) {
                Map<String, Double> brandPrefs = new HashMap<>();
                for (String brand : brands) {
                    brandPrefs.put(brand, 0.9);
                    createOrUpdateInterestTag(wxUserId, "brand", brand, 0.9, "cold_start");
                }
                profile.setBrandPreferences(objectMapper.writeValueAsString(brandPrefs));
            }

            // 4. 标记冷启动已完成
            profile.setColdStartCompleted(true);
            profile.setColdStartCompletedTime(LocalDateTime.now());
            profile.setProfileStatus("warming");  // 从cold_start转为warming
            profile.setColdStartStrategy("category_based");  // 更新策略
            profile.setUpdateTime(LocalDateTime.now());

            profileMapper.updateById(profile);

            log.info("冷启动完成: wxUserId={}, profileStatus=warming", wxUserId);

        } catch (JsonProcessingException e) {
            log.error("保存冷启动偏好失败", e);
            throw new RuntimeException("保存偏好失败", e);
        }
    }

    /**
     * 创建或更新兴趣标签
     */
    private void createOrUpdateInterestTag(String wxUserId, String tagType, String tagValue,
                                           double weight, String source) {
        LambdaQueryWrapper<UserInterestTag> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserInterestTag::getWxUserId, wxUserId)
                .eq(UserInterestTag::getTagType, tagType)
                .eq(UserInterestTag::getTagValue, tagValue);

        UserInterestTag existing = interestTagMapper.selectOne(wrapper);

        if (existing != null) {
            existing.setWeight(new BigDecimal(weight));
            existing.setConfidence(new BigDecimal(weight));
            existing.setSource(source);
            existing.setUpdateTime(LocalDateTime.now());
            interestTagMapper.updateById(existing);
        } else {
            UserInterestTag tag = new UserInterestTag();
            tag.setWxUserId(wxUserId);
            tag.setTagType(tagType);
            tag.setTagValue(tagValue);
            tag.setTagLevel(1);
            tag.setWeight(new BigDecimal(weight));
            tag.setConfidence(new BigDecimal(weight));
            tag.setSource(source);
            tag.setInteractionCount(1);
            tag.setDecayFactor(new BigDecimal("1.0"));
            tag.setCreateTime(LocalDateTime.now());
            tag.setUpdateTime(LocalDateTime.now());
            interestTagMapper.insert(tag);
        }
    }

    /**
     * 检查用户是否需要显示冷启动弹窗
     * 只有首次使用且未完成冷启动的用户才显示
     */
    @Override
    public boolean needsShowColdStart(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return false;
        }

        UserRecommendationProfile profile = profileMapper.selectByWxUserId(wxUserId);

        // 如果没有画像记录，说明是首次用户，需要显示
        if (profile == null) {
            return true;
        }

        // 如果已经完成冷启动，不显示
        if (Boolean.TRUE.equals(profile.getColdStartCompleted())) {
            return false;
        }

        // 如果是cold_start状态但还未完成，显示
        return "cold_start".equals(profile.getProfileStatus());
    }

    /**
     * 处理被忽略的推荐 (负向反馈)
     * 扫描 Redis 中该用户的所有探索标记，对未点击的发送负向反馈
     *
     * 使用场景：
     * 1. 用户请求新推荐时
     * 2. 用户刷新推荐列表时
     * 3. 用户离开页面时（前端调用）
     *
     * @param wxUserId 用户ID
     * @return 处理的负向反馈数量
     */
    @Override
    public int processIgnoredRecommendations(String wxUserId) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            return 0;
        }

        int processedCount = 0;

        try {
            // 1. 查找 LinUCB 探索标记
            String linucbPattern = LINUCB_EXPLORATION_PREFIX + wxUserId + ":*";
            Set<String> linucbKeys = redisTemplate.keys(linucbPattern);
            if (linucbKeys != null && !linucbKeys.isEmpty()) {
                for (String key : linucbKeys) {
                    String category = redisTemplate.opsForValue().get(key);
                    if (category != null && linUCBExplorer != null) {
                        // 提取 productId
                        String productId = key.substring(key.lastIndexOf(":") + 1);
                        // 发送负向反馈
                        linUCBExplorer.handleExplorationFeedback(wxUserId, productId, false);
                        // 删除已处理的标记
                        redisTemplate.delete(key);
                        processedCount++;
                        log.info("[LinUCB负向反馈] wxUserId={}, productId={}, category={}",
                                wxUserId, productId, category);
                    }
                }
            }

            // 2. 查找 Thompson Sampling 探索标记
            String tsPattern = TS_EXPLORATION_PREFIX + wxUserId + ":*";
            Set<String> tsKeys = redisTemplate.keys(tsPattern);
            if (tsKeys != null && !tsKeys.isEmpty()) {
                for (String key : tsKeys) {
                    String category = redisTemplate.opsForValue().get(key);
                    if (category != null && thompsonSamplingExplorer != null) {
                        String productId = key.substring(key.lastIndexOf(":") + 1);
                        thompsonSamplingExplorer.handleExplorationFeedback(wxUserId, productId, false);
                        redisTemplate.delete(key);
                        processedCount++;
                        log.info("[TS负向反馈] wxUserId={}, productId={}, category={}",
                                wxUserId, productId, category);
                    }
                }
            }

            if (processedCount > 0) {
                log.info("处理忽略的推荐: wxUserId={}, 负向反馈数量={}", wxUserId, processedCount);
            }

        } catch (Exception e) {
            log.warn("处理忽略推荐失败: wxUserId={}, error={}", wxUserId, e.getMessage());
        }

        return processedCount;
    }
}
