package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.OrderInfo;
import com.joolun.mall.entity.OrderItem;
import com.joolun.mall.entity.ShoppingCart;
import com.joolun.mall.entity.UserBehaviorEvent;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.mapper.OrderInfoMapper;
import com.joolun.mall.mapper.OrderItemMapper;
import com.joolun.mall.mapper.ShoppingCartMapper;
import com.joolun.mall.mapper.UserBehaviorEventMapper;
import com.joolun.mall.service.CollaborativeFilteringService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 协同过滤推荐服务实现
 * 基于Item-Based协同过滤算法
 *
 * 核心实现:
 * 1. 用户-商品交互矩阵构建
 * 2. 余弦相似度计算
 * 3. Redis缓存相似度矩阵
 * 4. 定时全量更新 (每天凌晨2点)
 *
 * @author MallCenter
 * @date 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CollaborativeFilteringServiceImpl implements CollaborativeFilteringService {

    private final UserBehaviorEventMapper behaviorEventMapper;
    private final ShoppingCartMapper shoppingCartMapper;
    private final OrderItemMapper orderItemMapper;
    private final OrderInfoMapper orderInfoMapper;
    private final GoodsSpuMapper goodsSpuMapper;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    // Redis缓存Key前缀
    private static final String SIMILARITY_CACHE_PREFIX = "cf:item:similarity:";
    private static final String MATRIX_STATUS_KEY = "cf:matrix:status";
    private static final String USER_INTERACTIONS_PREFIX = "cf:user:interactions:";

    // 缓存过期时间 (25小时，确保每日更新前仍有效)
    private static final long SIMILARITY_CACHE_TTL_HOURS = 25;
    private static final long USER_INTERACTIONS_CACHE_TTL_MINUTES = 30;

    // 交互类型权重
    private static final double WEIGHT_PURCHASE = 1.0;
    private static final double WEIGHT_CART_ADD = 0.5;
    private static final double WEIGHT_FAVORITE = 0.4;
    private static final double WEIGHT_VIEW = 0.1;

    // 相似度计算阈值
    private static final int MIN_CO_RATERS = 2;  // 最少共同评价用户数
    private static final int MAX_SIMILAR_ITEMS = 50;  // 每个商品最多存储的相似商品数
    private static final int RECENT_DAYS_FOR_BEHAVIOR = 90;  // 取最近90天的行为数据

    // 内存缓存 (用于批量计算时减少Redis访问)
    private final Map<String, Map<String, Double>> localSimilarityCache = new ConcurrentHashMap<>();

    @Override
    public List<GoodsSpu> getItemBasedRecommendations(String wxUserId, int limit) {
        if (wxUserId == null || wxUserId.isEmpty()) {
            log.debug("用户ID为空，返回空推荐");
            return Collections.emptyList();
        }

        log.info("Item-Based CF推荐: wxUserId={}, limit={}", wxUserId, limit);

        // 1. 获取用户历史交互商品及权重
        Map<String, Double> userInteractions = getUserInteractionRatings(wxUserId);
        if (userInteractions.isEmpty()) {
            log.debug("用户无历史交互数据: wxUserId={}", wxUserId);
            return Collections.emptyList();
        }

        // 2. 获取候选商品 (排除已交互商品)
        Set<String> interactedIds = userInteractions.keySet();
        List<GoodsSpu> candidates = getCandidateProducts(interactedIds, limit * 5);
        if (candidates.isEmpty()) {
            log.debug("无候选商品");
            return Collections.emptyList();
        }

        // 3. 计算每个候选商品的CF得分
        List<String> candidateIds = candidates.stream()
                .map(GoodsSpu::getId)
                .collect(Collectors.toList());
        Map<String, Double> cfScores = calculateCFScores(userInteractions, candidateIds);

        // 4. 按得分排序并返回
        return candidates.stream()
                .filter(p -> cfScores.containsKey(p.getId()) && cfScores.get(p.getId()) > 0)
                .sorted((a, b) -> Double.compare(
                        cfScores.getOrDefault(b.getId(), 0.0),
                        cfScores.getOrDefault(a.getId(), 0.0)))
                .limit(limit)
                .collect(Collectors.toList());
    }

    @Override
    public double calculateItemSimilarity(String productId1, String productId2) {
        if (productId1 == null || productId2 == null || productId1.equals(productId2)) {
            return 0.0;
        }

        // 尝试从缓存获取
        String cachedSimilarity = redisTemplate.opsForHash()
                .get(SIMILARITY_CACHE_PREFIX + productId1, productId2) + "";
        if (cachedSimilarity != null && !"null".equals(cachedSimilarity)) {
            try {
                return Double.parseDouble(cachedSimilarity);
            } catch (NumberFormatException e) {
                // 忽略解析错误
            }
        }

        // 实时计算 (仅在缓存未命中时)
        return computeCosineSimilarity(productId1, productId2);
    }

    @Override
    public List<String> getSimilarItems(String productId, int limit) {
        if (productId == null) {
            return Collections.emptyList();
        }

        String cacheKey = SIMILARITY_CACHE_PREFIX + productId;

        try {
            // 从Redis Hash获取所有相似商品
            Map<Object, Object> similarities = redisTemplate.opsForHash().entries(cacheKey);
            if (similarities.isEmpty()) {
                log.debug("商品相似度缓存为空: productId={}", productId);
                return Collections.emptyList();
            }

            // 按相似度降序排序
            return similarities.entrySet().stream()
                    .filter(e -> !"_meta".equals(e.getKey().toString()))
                    .map(e -> new AbstractMap.SimpleEntry<>(
                            e.getKey().toString(),
                            parseDouble(e.getValue().toString())))
                    .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                    .limit(limit)
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("获取相似商品失败: productId={}, error={}", productId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 定时任务: 每天凌晨2点更新相似度矩阵
     */
    @Override
    @Scheduled(cron = "0 0 2 * * ?")
    public void updateSimilarityMatrix() {
        log.info("开始更新商品相似度矩阵...");
        long startTime = System.currentTimeMillis();

        try {
            // 1. 构建用户-商品交互矩阵
            Map<String, Map<String, Double>> userItemMatrix = buildUserItemMatrix();
            log.info("用户-商品矩阵构建完成: {} 用户, {} 商品",
                    userItemMatrix.size(), countUniqueItems(userItemMatrix));

            // 2. 转置为商品-用户矩阵 (便于计算商品相似度)
            Map<String, Map<String, Double>> itemUserMatrix = transposeMatrix(userItemMatrix);

            // 3. 计算并缓存每个商品的相似商品
            int processedCount = 0;
            int totalItems = itemUserMatrix.size();

            for (String productId : itemUserMatrix.keySet()) {
                Map<String, Double> similarities = computeItemSimilarities(productId, itemUserMatrix);
                cacheItemSimilarities(productId, similarities);
                processedCount++;

                if (processedCount % 100 == 0) {
                    log.info("相似度计算进度: {}/{}", processedCount, totalItems);
                }
            }

            // 4. 更新状态信息
            updateMatrixStatus(totalItems, startTime);

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("商品相似度矩阵更新完成: {} 商品, 耗时 {}ms", totalItems, elapsed);

        } catch (Exception e) {
            log.error("更新相似度矩阵失败", e);
        }
    }

    @Override
    public Map<String, Double> getUserCFScores(String wxUserId, List<String> candidateIds) {
        if (wxUserId == null || candidateIds == null || candidateIds.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, Double> userInteractions = getUserInteractionRatings(wxUserId);
        if (userInteractions.isEmpty()) {
            return Collections.emptyMap();
        }

        return calculateCFScores(userInteractions, candidateIds);
    }

    @Override
    public List<GoodsSpu> getSimilarProductRecommendations(String productId, String wxUserId, int limit) {
        if (productId == null) {
            return Collections.emptyList();
        }

        log.info("获取相似商品推荐: productId={}, wxUserId={}, limit={}", productId, wxUserId, limit);

        // 获取相似商品ID
        List<String> similarIds = getSimilarItems(productId, limit * 2);
        if (similarIds.isEmpty()) {
            // 回退到基于分类的相似推荐
            return getFallbackSimilarProducts(productId, limit);
        }

        // 查询商品详情
        List<GoodsSpu> products = goodsSpuMapper.selectBatchIds(similarIds);
        if (products.isEmpty()) {
            return Collections.emptyList();
        }

        // 过滤下架商品
        products = products.stream()
                .filter(p -> "1".equals(p.getShelf()))
                .collect(Collectors.toList());

        // 如果有用户ID，结合用户偏好排序
        if (wxUserId != null && !wxUserId.isEmpty()) {
            Map<String, Double> cfScores = getUserCFScores(wxUserId,
                    products.stream().map(GoodsSpu::getId).collect(Collectors.toList()));
            products.sort((a, b) -> Double.compare(
                    cfScores.getOrDefault(b.getId(), 0.0),
                    cfScores.getOrDefault(a.getId(), 0.0)));
        }

        return products.stream().limit(limit).collect(Collectors.toList());
    }

    @Override
    public void refreshItemSimilarityCache(String productId) {
        if (productId == null) {
            return;
        }

        log.info("刷新商品相似度缓存: productId={}", productId);

        try {
            // 删除旧缓存
            redisTemplate.delete(SIMILARITY_CACHE_PREFIX + productId);

            // 重新计算并缓存
            Map<String, Map<String, Double>> userItemMatrix = buildUserItemMatrix();
            Map<String, Map<String, Double>> itemUserMatrix = transposeMatrix(userItemMatrix);

            if (itemUserMatrix.containsKey(productId)) {
                Map<String, Double> similarities = computeItemSimilarities(productId, itemUserMatrix);
                cacheItemSimilarities(productId, similarities);
            }

            // 清理本地缓存
            localSimilarityCache.remove(productId);

        } catch (Exception e) {
            log.error("刷新商品相似度缓存失败: productId={}", productId, e);
        }
    }

    @Override
    public Map<String, Object> getSimilarityMatrixStatus() {
        Map<String, Object> status = new HashMap<>();

        try {
            String statusJson = redisTemplate.opsForValue().get(MATRIX_STATUS_KEY);
            if (statusJson != null) {
                Map<String, Object> cached = objectMapper.readValue(statusJson,
                        new TypeReference<Map<String, Object>>() {});
                status.putAll(cached);
            }
        } catch (Exception e) {
            log.warn("获取相似度矩阵状态失败", e);
        }

        status.putIfAbsent("lastUpdateTime", "未更新");
        status.putIfAbsent("totalItems", 0);
        status.putIfAbsent("status", "unknown");

        return status;
    }

    // ==================== 私有方法 ====================

    /**
     * 获取用户的交互评分
     * 合并购买、加购、收藏、浏览行为并加权
     */
    private Map<String, Double> getUserInteractionRatings(String wxUserId) {
        String cacheKey = USER_INTERACTIONS_PREFIX + wxUserId;

        // 尝试从缓存获取
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return objectMapper.readValue(cached, new TypeReference<Map<String, Double>>() {});
            }
        } catch (Exception e) {
            log.debug("缓存读取失败，将重新计算");
        }

        Map<String, Double> ratings = new HashMap<>();
        LocalDateTime since = LocalDateTime.now().minusDays(RECENT_DAYS_FOR_BEHAVIOR);

        // 1. 购买行为 (权重最高)
        addPurchaseRatings(wxUserId, ratings, since);

        // 2. 加购行为
        addCartRatings(wxUserId, ratings);

        // 3. 浏览和收藏行为
        addBehaviorRatings(wxUserId, ratings, since);

        // 缓存结果
        try {
            String json = objectMapper.writeValueAsString(ratings);
            redisTemplate.opsForValue().set(cacheKey, json,
                    USER_INTERACTIONS_CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.warn("缓存用户交互数据失败: wxUserId={}", wxUserId);
        }

        return ratings;
    }

    /**
     * 添加购买评分
     */
    private void addPurchaseRatings(String wxUserId, Map<String, Double> ratings, LocalDateTime since) {
        try {
            // 查询用户已完成的订单
            LambdaQueryWrapper<OrderInfo> orderWrapper = new LambdaQueryWrapper<>();
            orderWrapper.eq(OrderInfo::getUserId, wxUserId)
                    .eq(OrderInfo::getStatus, "3")  // 已完成
                    .ge(OrderInfo::getCreateTime, since);
            List<OrderInfo> orders = orderInfoMapper.selectList(orderWrapper);

            if (orders.isEmpty()) {
                return;
            }

            // 获取订单商品
            List<String> orderIds = orders.stream()
                    .map(OrderInfo::getId)
                    .collect(Collectors.toList());

            LambdaQueryWrapper<OrderItem> itemWrapper = new LambdaQueryWrapper<>();
            itemWrapper.in(OrderItem::getOrderId, orderIds);
            List<OrderItem> items = orderItemMapper.selectList(itemWrapper);

            for (OrderItem item : items) {
                if (item.getSpuId() != null) {
                    ratings.merge(item.getSpuId(), WEIGHT_PURCHASE, Double::max);
                }
            }
        } catch (Exception e) {
            log.warn("获取购买数据失败: wxUserId={}", wxUserId, e);
        }
    }

    /**
     * 添加加购评分
     */
    private void addCartRatings(String wxUserId, Map<String, Double> ratings) {
        try {
            LambdaQueryWrapper<ShoppingCart> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(ShoppingCart::getUserId, wxUserId)
                    .eq(ShoppingCart::getDelFlag, "0");
            List<ShoppingCart> carts = shoppingCartMapper.selectList(wrapper);

            for (ShoppingCart cart : carts) {
                if (cart.getSpuId() != null) {
                    ratings.merge(cart.getSpuId(), WEIGHT_CART_ADD, Double::max);
                }
            }
        } catch (Exception e) {
            log.warn("获取购物车数据失败: wxUserId={}", wxUserId, e);
        }
    }

    /**
     * 添加浏览和收藏评分
     */
    private void addBehaviorRatings(String wxUserId, Map<String, Double> ratings, LocalDateTime since) {
        try {
            List<UserBehaviorEvent> events = behaviorEventMapper.selectByTimeRange(
                    wxUserId, since, LocalDateTime.now());

            for (UserBehaviorEvent event : events) {
                if (!"product".equals(event.getTargetType()) || event.getTargetId() == null) {
                    continue;
                }

                String productId = event.getTargetId();
                double weight;

                switch (event.getEventType()) {
                    case "favorite":
                        weight = WEIGHT_FAVORITE;
                        break;
                    case "view":
                    case "click":
                        weight = WEIGHT_VIEW;
                        break;
                    default:
                        continue;
                }

                ratings.merge(productId, weight, Double::max);
            }
        } catch (Exception e) {
            log.warn("获取行为数据失败: wxUserId={}", wxUserId, e);
        }
    }

    /**
     * 构建用户-商品交互矩阵
     */
    private Map<String, Map<String, Double>> buildUserItemMatrix() {
        Map<String, Map<String, Double>> matrix = new HashMap<>();
        LocalDateTime since = LocalDateTime.now().minusDays(RECENT_DAYS_FOR_BEHAVIOR);

        // 1. 从订单获取购买数据
        LambdaQueryWrapper<OrderInfo> orderWrapper = new LambdaQueryWrapper<>();
        orderWrapper.eq(OrderInfo::getStatus, "3")
                .ge(OrderInfo::getCreateTime, since);
        List<OrderInfo> orders = orderInfoMapper.selectList(orderWrapper);

        if (!orders.isEmpty()) {
            List<String> orderIds = orders.stream()
                    .map(OrderInfo::getId)
                    .collect(Collectors.toList());

            Map<String, String> orderUserMap = orders.stream()
                    .collect(Collectors.toMap(OrderInfo::getId, OrderInfo::getUserId));

            LambdaQueryWrapper<OrderItem> itemWrapper = new LambdaQueryWrapper<>();
            itemWrapper.in(OrderItem::getOrderId, orderIds);
            List<OrderItem> items = orderItemMapper.selectList(itemWrapper);

            for (OrderItem item : items) {
                String userId = orderUserMap.get(item.getOrderId());
                if (userId != null && item.getSpuId() != null) {
                    matrix.computeIfAbsent(userId, k -> new HashMap<>())
                            .merge(item.getSpuId(), WEIGHT_PURCHASE, Double::max);
                }
            }
        }

        // 2. 从购物车获取加购数据
        LambdaQueryWrapper<ShoppingCart> cartWrapper = new LambdaQueryWrapper<>();
        cartWrapper.eq(ShoppingCart::getDelFlag, "0");
        List<ShoppingCart> carts = shoppingCartMapper.selectList(cartWrapper);

        for (ShoppingCart cart : carts) {
            if (cart.getUserId() != null && cart.getSpuId() != null) {
                matrix.computeIfAbsent(cart.getUserId(), k -> new HashMap<>())
                        .merge(cart.getSpuId(), WEIGHT_CART_ADD, Double::max);
            }
        }

        // 3. 从行为事件获取浏览和收藏数据 (采样，避免数据量过大)
        LambdaQueryWrapper<UserBehaviorEvent> eventWrapper = new LambdaQueryWrapper<>();
        eventWrapper.eq(UserBehaviorEvent::getTargetType, "product")
                .in(UserBehaviorEvent::getEventType, "view", "click", "favorite")
                .ge(UserBehaviorEvent::getEventTime, since)
                .last("LIMIT 100000");  // 限制数据量
        List<UserBehaviorEvent> events = behaviorEventMapper.selectList(eventWrapper);

        for (UserBehaviorEvent event : events) {
            if (event.getWxUserId() == null || event.getTargetId() == null) {
                continue;
            }

            double weight = "favorite".equals(event.getEventType()) ? WEIGHT_FAVORITE : WEIGHT_VIEW;
            matrix.computeIfAbsent(event.getWxUserId(), k -> new HashMap<>())
                    .merge(event.getTargetId(), weight, Double::max);
        }

        return matrix;
    }

    /**
     * 转置矩阵: 用户-商品 -> 商品-用户
     */
    private Map<String, Map<String, Double>> transposeMatrix(Map<String, Map<String, Double>> userItemMatrix) {
        Map<String, Map<String, Double>> itemUserMatrix = new HashMap<>();

        for (Map.Entry<String, Map<String, Double>> userEntry : userItemMatrix.entrySet()) {
            String userId = userEntry.getKey();
            for (Map.Entry<String, Double> itemEntry : userEntry.getValue().entrySet()) {
                String itemId = itemEntry.getKey();
                Double rating = itemEntry.getValue();
                itemUserMatrix.computeIfAbsent(itemId, k -> new HashMap<>())
                        .put(userId, rating);
            }
        }

        return itemUserMatrix;
    }

    /**
     * 计算指定商品与所有其他商品的相似度
     */
    private Map<String, Double> computeItemSimilarities(String productId,
            Map<String, Map<String, Double>> itemUserMatrix) {

        Map<String, Double> userRatings = itemUserMatrix.get(productId);
        if (userRatings == null || userRatings.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, Double> similarities = new HashMap<>();
        Set<String> users = userRatings.keySet();

        for (Map.Entry<String, Map<String, Double>> entry : itemUserMatrix.entrySet()) {
            String otherId = entry.getKey();
            if (otherId.equals(productId)) {
                continue;
            }

            Map<String, Double> otherRatings = entry.getValue();

            // 计算共同评价用户数
            Set<String> commonUsers = new HashSet<>(users);
            commonUsers.retainAll(otherRatings.keySet());

            if (commonUsers.size() < MIN_CO_RATERS) {
                continue;
            }

            // 计算余弦相似度
            double similarity = computeCosineSimilarity(userRatings, otherRatings, commonUsers);
            if (similarity > 0) {
                similarities.put(otherId, similarity);
            }
        }

        // 只保留Top N相似商品
        return similarities.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                .limit(MAX_SIMILAR_ITEMS)
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (a, b) -> a,
                        LinkedHashMap::new));
    }

    /**
     * 计算两个评分向量的余弦相似度
     */
    private double computeCosineSimilarity(Map<String, Double> ratings1,
            Map<String, Double> ratings2, Set<String> commonUsers) {

        double dotProduct = 0.0;
        double norm1 = 0.0;
        double norm2 = 0.0;

        for (String user : commonUsers) {
            double r1 = ratings1.getOrDefault(user, 0.0);
            double r2 = ratings2.getOrDefault(user, 0.0);
            dotProduct += r1 * r2;
            norm1 += r1 * r1;
            norm2 += r2 * r2;
        }

        if (norm1 == 0 || norm2 == 0) {
            return 0.0;
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    /**
     * 实时计算两个商品的相似度 (缓存未命中时使用)
     */
    private double computeCosineSimilarity(String productId1, String productId2) {
        // 获取两个商品的用户评分
        Map<String, Double> ratings1 = getItemUserRatings(productId1);
        Map<String, Double> ratings2 = getItemUserRatings(productId2);

        if (ratings1.isEmpty() || ratings2.isEmpty()) {
            return 0.0;
        }

        Set<String> commonUsers = new HashSet<>(ratings1.keySet());
        commonUsers.retainAll(ratings2.keySet());

        if (commonUsers.size() < MIN_CO_RATERS) {
            return 0.0;
        }

        return computeCosineSimilarity(ratings1, ratings2, commonUsers);
    }

    /**
     * 获取商品的用户评分 (实时查询)
     */
    private Map<String, Double> getItemUserRatings(String productId) {
        Map<String, Double> ratings = new HashMap<>();
        LocalDateTime since = LocalDateTime.now().minusDays(RECENT_DAYS_FOR_BEHAVIOR);

        // 购买
        LambdaQueryWrapper<OrderItem> itemWrapper = new LambdaQueryWrapper<>();
        itemWrapper.eq(OrderItem::getSpuId, productId);
        List<OrderItem> items = orderItemMapper.selectList(itemWrapper);

        if (!items.isEmpty()) {
            List<String> orderIds = items.stream()
                    .map(OrderItem::getOrderId)
                    .collect(Collectors.toList());

            LambdaQueryWrapper<OrderInfo> orderWrapper = new LambdaQueryWrapper<>();
            orderWrapper.in(OrderInfo::getId, orderIds)
                    .eq(OrderInfo::getStatus, "3")
                    .ge(OrderInfo::getCreateTime, since);
            List<OrderInfo> orders = orderInfoMapper.selectList(orderWrapper);

            for (OrderInfo order : orders) {
                ratings.merge(order.getUserId(), WEIGHT_PURCHASE, Double::max);
            }
        }

        // 加购
        LambdaQueryWrapper<ShoppingCart> cartWrapper = new LambdaQueryWrapper<>();
        cartWrapper.eq(ShoppingCart::getSpuId, productId)
                .eq(ShoppingCart::getDelFlag, "0");
        List<ShoppingCart> carts = shoppingCartMapper.selectList(cartWrapper);

        for (ShoppingCart cart : carts) {
            ratings.merge(cart.getUserId(), WEIGHT_CART_ADD, Double::max);
        }

        // 浏览和收藏
        LambdaQueryWrapper<UserBehaviorEvent> eventWrapper = new LambdaQueryWrapper<>();
        eventWrapper.eq(UserBehaviorEvent::getTargetId, productId)
                .eq(UserBehaviorEvent::getTargetType, "product")
                .in(UserBehaviorEvent::getEventType, "view", "click", "favorite")
                .ge(UserBehaviorEvent::getEventTime, since);
        List<UserBehaviorEvent> events = behaviorEventMapper.selectList(eventWrapper);

        for (UserBehaviorEvent event : events) {
            double weight = "favorite".equals(event.getEventType()) ? WEIGHT_FAVORITE : WEIGHT_VIEW;
            ratings.merge(event.getWxUserId(), weight, Double::max);
        }

        return ratings;
    }

    /**
     * 缓存商品的相似度数据
     */
    private void cacheItemSimilarities(String productId, Map<String, Double> similarities) {
        if (similarities.isEmpty()) {
            return;
        }

        String cacheKey = SIMILARITY_CACHE_PREFIX + productId;

        try {
            // 清除旧数据
            redisTemplate.delete(cacheKey);

            // 写入新数据
            Map<String, String> hashData = new HashMap<>();
            for (Map.Entry<String, Double> entry : similarities.entrySet()) {
                hashData.put(entry.getKey(), String.valueOf(entry.getValue()));
            }
            // 添加元数据
            hashData.put("_meta", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

            redisTemplate.opsForHash().putAll(cacheKey, hashData);
            redisTemplate.expire(cacheKey, SIMILARITY_CACHE_TTL_HOURS, TimeUnit.HOURS);

            // 更新本地缓存
            localSimilarityCache.put(productId, similarities);

        } catch (Exception e) {
            log.warn("缓存商品相似度失败: productId={}", productId, e);
        }
    }

    /**
     * 计算CF推荐分数
     * score(u, i) = Σ(sim(i, j) × rating(u, j)) / Σ|sim(i, j)|
     */
    private Map<String, Double> calculateCFScores(Map<String, Double> userInteractions,
            List<String> candidateIds) {

        Map<String, Double> scores = new HashMap<>();

        for (String candidateId : candidateIds) {
            double numerator = 0.0;
            double denominator = 0.0;

            for (Map.Entry<String, Double> interaction : userInteractions.entrySet()) {
                String interactedId = interaction.getKey();
                double rating = interaction.getValue();

                double similarity = calculateItemSimilarity(candidateId, interactedId);
                if (similarity > 0) {
                    numerator += similarity * rating;
                    denominator += Math.abs(similarity);
                }
            }

            if (denominator > 0) {
                scores.put(candidateId, numerator / denominator);
            }
        }

        return scores;
    }

    /**
     * 获取候选商品 (排除已交互商品)
     */
    private List<GoodsSpu> getCandidateProducts(Set<String> excludeIds, int limit) {
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getShelf, "1")
                .eq(GoodsSpu::getDelFlag, "0");

        if (!excludeIds.isEmpty()) {
            wrapper.notIn(GoodsSpu::getId, excludeIds);
        }

        wrapper.orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    /**
     * 回退方案: 基于分类的相似商品
     */
    private List<GoodsSpu> getFallbackSimilarProducts(String productId, int limit) {
        GoodsSpu product = goodsSpuMapper.selectById(productId);
        if (product == null) {
            return Collections.emptyList();
        }

        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.ne(GoodsSpu::getId, productId)
                .eq(GoodsSpu::getShelf, "1");

        if (product.getCategoryFirst() != null) {
            wrapper.eq(GoodsSpu::getCategoryFirst, product.getCategoryFirst());
        }

        wrapper.orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    /**
     * 更新矩阵状态信息
     */
    private void updateMatrixStatus(int totalItems, long startTime) {
        try {
            Map<String, Object> status = new HashMap<>();
            status.put("lastUpdateTime", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            status.put("totalItems", totalItems);
            status.put("elapsedMs", System.currentTimeMillis() - startTime);
            status.put("status", "completed");

            String json = objectMapper.writeValueAsString(status);
            redisTemplate.opsForValue().set(MATRIX_STATUS_KEY, json,
                    SIMILARITY_CACHE_TTL_HOURS, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("更新矩阵状态失败", e);
        }
    }

    /**
     * 统计矩阵中的唯一商品数
     */
    private int countUniqueItems(Map<String, Map<String, Double>> userItemMatrix) {
        return userItemMatrix.values().stream()
                .flatMap(m -> m.keySet().stream())
                .collect(Collectors.toSet())
                .size();
    }

    /**
     * 安全解析double
     */
    private double parseDouble(String value) {
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }
}
