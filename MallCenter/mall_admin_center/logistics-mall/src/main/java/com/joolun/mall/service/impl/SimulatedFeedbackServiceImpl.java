package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.*;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.mapper.RecommendationLogMapper;
import com.joolun.mall.mapper.UserInterestTagMapper;
import com.joolun.mall.mapper.UserRecommendationProfileMapper;
import com.joolun.mall.service.CTRPredictionService;
import com.joolun.mall.service.SimulatedFeedbackService;
import com.joolun.mall.service.UserClusterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * 模拟反馈服务实现
 *
 * 基于研究最佳实践，采用群组引导 + 概率模型方式生成反馈:
 * P(click|user, item) = base_ctr × cluster_affinity × category_match × price_match × recency_boost
 *
 * 聚类亲和度矩阵:
 * | 聚类 | 高亲和品类 (2.0x) | 中亲和 (1.0x) | 低亲和 (0.3x) |
 * |------|------------------|---------------|---------------|
 * | 火锅店采购 | 肉类、火锅底料、蔬菜 | 调味品、冰块 | 烘焙、乳制品 |
 * | 快餐店采购 | 速食、调味品、粮油 | 肉类、蔬菜 | 海鲜、进口 |
 * | 烘焙店采购 | 烘焙原料、乳制品、糖类 | 鸡蛋、油脂 | 火锅、速食 |
 * | 高端餐厅 | 进口食材、海鲜、高端肉类 | 蔬菜、调味品 | 速食、粮油 |
 * | 社区团购 | 蔬菜、水果、日用品 | 肉类、粮油 | 进口、高端 |
 * | 新用户群 | 热门商品 | 全品类 | - |
 *
 * @author Recommendation Enhancement
 * @since 2026-01-20
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SimulatedFeedbackServiceImpl implements SimulatedFeedbackService {

    private final RecommendationLogMapper recommendationLogMapper;
    private final GoodsSpuMapper goodsSpuMapper;
    private final UserClusterService userClusterService;
    private final UserInterestTagMapper userInterestTagMapper;
    private final UserRecommendationProfileMapper userProfileMapper;
    private final CTRPredictionService ctrPredictionService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    // 随机数生成器
    private final Random random = new Random();

    // 统计信息
    private final AtomicLong totalSimulated = new AtomicLong(0);
    private volatile LocalDateTime lastSimulatedTime;

    // Redis 缓存键
    private static final String SIMULATION_STATS_KEY = "feedback:simulation:stats";
    private static final String EXPOSURE_COUNT_PREFIX = "simfeedback:exposure:";

    // ==================== V3.0 优化点1: 增强模拟反馈真实性 ====================

    /**
     * 高斯噪声标准差 (用于增加随机性)
     */
    private static final double NOISE_STDDEV = 0.1;

    // V4.0: 时段系数已移至applyTimePattern方法内部
    // private static final double TIME_BOOST_EVENING_PEAK = 1.20;
    // private static final double TIME_BOOST_LUNCH = 1.15;
    // private static final double TIME_PENALTY_LATE_NIGHT = 0.70;

    /**
     * 疲劳衰减因子 (曝光超过3次后每次衰减30%)
     */
    private static final double FATIGUE_DECAY_FACTOR = 0.7;
    private static final int FATIGUE_THRESHOLD = 3;
    private static final int FATIGUE_CACHE_HOURS = 1;

    // 聚类亲和度配置
    private static final Map<String, Map<String, Double>> CLUSTER_CATEGORY_AFFINITY = new HashMap<>();
    static {
        // 火锅店采购
        Map<String, Double> hotpotAffinity = new HashMap<>();
        hotpotAffinity.put("肉类", 2.0);
        hotpotAffinity.put("火锅底料", 2.0);
        hotpotAffinity.put("火锅食材", 2.0);
        hotpotAffinity.put("蔬菜", 1.5);
        hotpotAffinity.put("调味品", 1.0);
        hotpotAffinity.put("冷冻食品", 1.0);
        hotpotAffinity.put("烘焙", 0.3);
        hotpotAffinity.put("乳制品", 0.3);
        hotpotAffinity.put("烘焙原料", 0.3);
        CLUSTER_CATEGORY_AFFINITY.put("火锅店采购", hotpotAffinity);

        // 快餐店采购
        Map<String, Double> fastfoodAffinity = new HashMap<>();
        fastfoodAffinity.put("速食", 2.0);
        fastfoodAffinity.put("调味品", 2.0);
        fastfoodAffinity.put("粮油", 1.5);
        fastfoodAffinity.put("肉类", 1.0);
        fastfoodAffinity.put("蔬菜", 1.0);
        fastfoodAffinity.put("海鲜", 0.3);
        fastfoodAffinity.put("进口食材", 0.3);
        fastfoodAffinity.put("高端", 0.3);
        CLUSTER_CATEGORY_AFFINITY.put("快餐店采购", fastfoodAffinity);

        // 烘焙店采购
        Map<String, Double> bakeryAffinity = new HashMap<>();
        bakeryAffinity.put("烘焙原料", 2.0);
        bakeryAffinity.put("乳制品", 2.0);
        bakeryAffinity.put("糖类", 1.5);
        bakeryAffinity.put("鸡蛋", 1.5);
        bakeryAffinity.put("油脂", 1.0);
        bakeryAffinity.put("火锅", 0.3);
        bakeryAffinity.put("速食", 0.3);
        bakeryAffinity.put("火锅底料", 0.3);
        CLUSTER_CATEGORY_AFFINITY.put("烘焙店采购", bakeryAffinity);

        // 高端餐厅
        Map<String, Double> highendAffinity = new HashMap<>();
        highendAffinity.put("进口食材", 2.0);
        highendAffinity.put("海鲜", 2.0);
        highendAffinity.put("高端肉类", 2.0);
        highendAffinity.put("蔬菜", 1.0);
        highendAffinity.put("调味品", 1.0);
        highendAffinity.put("速食", 0.3);
        highendAffinity.put("粮油", 0.5);
        CLUSTER_CATEGORY_AFFINITY.put("高端餐厅", highendAffinity);

        // 社区团购
        Map<String, Double> communityAffinity = new HashMap<>();
        communityAffinity.put("蔬菜", 2.0);
        communityAffinity.put("水果", 2.0);
        communityAffinity.put("日用品", 1.5);
        communityAffinity.put("肉类", 1.0);
        communityAffinity.put("粮油", 1.0);
        communityAffinity.put("进口", 0.3);
        communityAffinity.put("高端", 0.3);
        communityAffinity.put("海鲜", 0.5);
        CLUSTER_CATEGORY_AFFINITY.put("社区团购", communityAffinity);

        // 新用户群 (默认均匀分布)
        Map<String, Double> newUserAffinity = new HashMap<>();
        newUserAffinity.put("热门商品", 1.5);
        newUserAffinity.put("新品推荐", 1.3);
        CLUSTER_CATEGORY_AFFINITY.put("新用户群", newUserAffinity);
    }

    @Override
    @Transactional
    public Map<String, Object> generateSimulatedFeedback(int days) {
        log.info("开始生成模拟反馈: days={}", days);
        long startTime = System.currentTimeMillis();

        Map<String, Object> stats = new LinkedHashMap<>();
        int processedCount = 0;
        int clickedCount = 0;
        int purchasedCount = 0;

        try {
            // 1. 获取最近N天的推荐日志（无反馈的）
            LocalDateTime cutoffTime = LocalDateTime.now().minusDays(days);
            LambdaQueryWrapper<RecommendationLog> wrapper = new LambdaQueryWrapper<>();
            wrapper.ge(RecommendationLog::getCreateTime, cutoffTime)
                    .and(w -> w.isNull(RecommendationLog::getIsClicked)
                            .or().eq(RecommendationLog::getIsClicked, false));

            List<RecommendationLog> logs = recommendationLogMapper.selectList(wrapper);
            log.info("获取到待处理推荐日志: {} 条", logs.size());

            if (logs.isEmpty()) {
                stats.put("processed", 0);
                stats.put("clicked", 0);
                stats.put("purchased", 0);
                stats.put("message", "没有需要处理的推荐日志");
                return stats;
            }

            // 2. 缓存商品信息
            Set<String> productIds = logs.stream()
                    .map(RecommendationLog::getProductId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            List<GoodsSpu> products = goodsSpuMapper.selectBatchIds(productIds);
            Map<String, GoodsSpu> productMap = products.stream()
                    .collect(Collectors.toMap(GoodsSpu::getId, p -> p, (a, b) -> a));

            // 3. 处理每条日志
            List<RecommendationLog> updateLogs = new ArrayList<>();
            List<CTRPredictionService.CTRFeedback> trainingData = new ArrayList<>();

            for (RecommendationLog logItem : logs) {
                String wxUserId = logItem.getWxUserId();
                String productId = logItem.getProductId();
                GoodsSpu product = productMap.get(productId);

                if (wxUserId == null || product == null) {
                    continue;
                }

                // 计算点击概率
                double clickProb = calculateClickProbability(wxUserId, product, logItem);

                // 随机决定是否点击
                boolean clicked = random.nextDouble() < clickProb;

                // 如果点击，计算购买概率
                boolean purchased = false;
                if (clicked) {
                    double purchaseProb = calculatePurchaseProbabilityInternal(wxUserId, product, true);
                    purchased = random.nextDouble() < purchaseProb;
                }

                // 更新日志
                if (clicked || purchased) {
                    logItem.setIsClicked(clicked);
                    logItem.setIsPurchased(purchased);
                    logItem.setFeedbackTime(LocalDateTime.now());
                    updateLogs.add(logItem);

                    if (clicked) clickedCount++;
                    if (purchased) purchasedCount++;
                }

                // 添加到训练数据 (包括未点击的负样本)
                trainingData.add(new CTRPredictionService.CTRFeedback(wxUserId, productId, clicked));
                processedCount++;
            }

            // 4. 批量更新数据库
            if (!updateLogs.isEmpty()) {
                for (RecommendationLog updateLog : updateLogs) {
                    recommendationLogMapper.updateById(updateLog);
                }
                log.info("更新推荐日志: {} 条", updateLogs.size());
            }

            // 5. 训练CTR模型
            if (!trainingData.isEmpty()) {
                ctrPredictionService.batchUpdateModel(trainingData);
                log.info("CTR模型训练完成: {} 条样本", trainingData.size());
            }

            // 更新统计
            totalSimulated.addAndGet(processedCount);
            lastSimulatedTime = LocalDateTime.now();

            long elapsed = System.currentTimeMillis() - startTime;
            double clickRate = processedCount > 0 ? (double) clickedCount / processedCount : 0;
            double purchaseRate = clickedCount > 0 ? (double) purchasedCount / clickedCount : 0;

            stats.put("processed", processedCount);
            stats.put("clicked", clickedCount);
            stats.put("purchased", purchasedCount);
            stats.put("clickRate", String.format("%.4f", clickRate));
            stats.put("purchaseRate", String.format("%.4f", purchaseRate));
            stats.put("trainingSamples", trainingData.size());
            stats.put("elapsedMs", elapsed);

            log.info("模拟反馈生成完成: processed={}, clicked={}, purchased={}, clickRate={:.2%}, elapsed={}ms",
                    processedCount, clickedCount, purchasedCount, clickRate, elapsed);

            return stats;

        } catch (Exception e) {
            log.error("生成模拟反馈失败", e);
            stats.put("error", e.getMessage());
            stats.put("processed", processedCount);
            stats.put("clicked", clickedCount);
            stats.put("purchased", purchasedCount);
            return stats;
        }
    }

    @Override
    public Map<String, Object> trainCTRModelFromFeedback() {
        log.info("开始从反馈数据训练CTR模型");
        Map<String, Object> stats = new LinkedHashMap<>();

        try {
            // 获取有反馈的推荐日志
            LambdaQueryWrapper<RecommendationLog> wrapper = new LambdaQueryWrapper<>();
            wrapper.isNotNull(RecommendationLog::getIsClicked)
                    .ge(RecommendationLog::getCreateTime, LocalDateTime.now().minusDays(30));

            List<RecommendationLog> feedbackLogs = recommendationLogMapper.selectList(wrapper);
            log.info("获取到反馈日志: {} 条", feedbackLogs.size());

            if (feedbackLogs.isEmpty()) {
                stats.put("samples", 0);
                stats.put("success", true);
                stats.put("message", "没有反馈数据");
                return stats;
            }

            // 构建训练数据
            List<CTRPredictionService.CTRFeedback> trainingData = feedbackLogs.stream()
                    .map(log -> new CTRPredictionService.CTRFeedback(
                            log.getWxUserId(),
                            log.getProductId(),
                            Boolean.TRUE.equals(log.getIsClicked())))
                    .collect(Collectors.toList());

            // 批量训练
            ctrPredictionService.batchUpdateModel(trainingData);

            // 计算正样本率
            long positiveCount = feedbackLogs.stream()
                    .filter(log -> Boolean.TRUE.equals(log.getIsClicked()))
                    .count();
            double positiveRate = (double) positiveCount / feedbackLogs.size();

            stats.put("samples", trainingData.size());
            stats.put("positiveSamples", positiveCount);
            stats.put("positiveRate", String.format("%.4f", positiveRate));
            stats.put("success", true);

            log.info("CTR模型训练完成: samples={}, positiveRate={:.2%}", trainingData.size(), positiveRate);

            return stats;

        } catch (Exception e) {
            log.error("训练CTR模型失败", e);
            stats.put("success", false);
            stats.put("error", e.getMessage());
            return stats;
        }
    }

    @Override
    public double calculateClickProbability(String wxUserId, String productId) {
        if (wxUserId == null || productId == null) {
            return BASE_CTR;
        }

        GoodsSpu product = goodsSpuMapper.selectById(productId);
        if (product == null) {
            return BASE_CTR;
        }

        return calculateClickProbability(wxUserId, product, null);
    }

    /**
     * 计算点击概率（内部方法）
     * P(click|user, item) = base_ctr × cluster_affinity × category_match × price_match × recency_boost
     *
     * V3.0优化: 增加高斯噪声、时间模式、疲劳模型
     */
    private double calculateClickProbability(String wxUserId, GoodsSpu product, RecommendationLog logItem) {
        double baseCtr = BASE_CTR;

        // 1. 聚类亲和度
        double clusterAffinity = calculateClusterAffinity(wxUserId, product);

        // 2. 品类匹配度 (用户历史偏好)
        double categoryMatch = calculateCategoryMatch(wxUserId, product);

        // 3. 价格匹配度
        double priceMatch = calculatePriceMatch(wxUserId, product);

        // 4. 时间衰减 (推荐越新越可能点击)
        double recencyBoost = 1.0;
        if (logItem != null && logItem.getCreateTime() != null) {
            long daysSinceExposure = ChronoUnit.DAYS.between(logItem.getCreateTime(), LocalDateTime.now());
            recencyBoost = Math.exp(-daysSinceExposure * 0.1);
        }

        // 5. 位置因素 (位置越靠前越可能点击)
        double positionFactor = 1.0;
        if (logItem != null && logItem.getRecommendationPosition() != null) {
            int position = logItem.getRecommendationPosition();
            positionFactor = 1.0 / (1.0 + Math.log(position + 1));
        }

        // 计算基础概率
        double baseProb = baseCtr * clusterAffinity * categoryMatch * priceMatch * recencyBoost * positionFactor;

        // ==================== V3.0 优化点1: 增强模拟反馈真实性 ====================

        // 6. 添加高斯噪声 (增加随机性)
        double noise = random.nextGaussian() * NOISE_STDDEV;
        double clickProb = baseProb + noise;

        // 7. 应用时间模式 (不同时段不同活跃度)
        clickProb = applyTimePattern(clickProb);

        // 8. 应用疲劳模型 (同品类多次曝光后衰减)
        String categoryId = product.getCategoryFirst();
        if (categoryId != null && wxUserId != null) {
            clickProb = applyFatigueModel(wxUserId, categoryId, clickProb);
        }

        // 限制在合理范围 [0.01, 0.8]
        clickProb = Math.max(0.01, Math.min(0.8, clickProb));

        log.debug("点击概率计算: user={}, product={}, baseCtr={}, clusterAffinity={}, " +
                        "categoryMatch={}, priceMatch={}, recencyBoost={}, positionFactor={}, " +
                        "noise={:.4f}, finalProb={:.4f}",
                wxUserId, product.getId(), baseCtr, clusterAffinity, categoryMatch, priceMatch,
                recencyBoost, positionFactor, noise, clickProb);

        return clickProb;
    }

    /**
     * V4.0优化: 应用精细化时间模式
     * 考虑因素:
     * - 小时级时段活跃度
     * - 工作日/周末差异
     * - 月初/月末采购高峰
     */
    private double applyTimePattern(double probability) {
        LocalDateTime now = LocalDateTime.now();
        int hour = now.getHour();
        int dayOfWeek = now.getDayOfWeek().getValue();
        int dayOfMonth = now.getDayOfMonth();
        boolean isWeekend = dayOfWeek >= 6;

        // 1. 基础时段因子
        double timeFactor = 1.0;
        if (hour >= 18 && hour <= 21) {
            timeFactor = 1.20;      // 晚高峰
        } else if (hour >= 12 && hour <= 14) {
            timeFactor = 1.15;      // 午休
        } else if (hour >= 9 && hour <= 11) {
            timeFactor = 1.10;      // 上午工作时段
        } else if (hour >= 0 && hour <= 6) {
            timeFactor = 0.70;      // 深夜
        } else if (hour >= 7 && hour <= 8) {
            timeFactor = 0.85;      // 早间通勤
        } else if (hour >= 15 && hour <= 17) {
            timeFactor = 1.05;      // 下午工作时段
        } else if (hour >= 22 && hour <= 23) {
            timeFactor = 0.90;      // 晚间
        }

        // 2. 周末调整 (B2B场景周末活跃度降低)
        if (isWeekend) {
            timeFactor *= 0.85;
        }

        // 3. 特殊日期 (月初/月末采购高峰)
        if (dayOfMonth <= 5) {
            timeFactor *= 1.15;     // 月初采购高峰
        } else if (dayOfMonth >= 25) {
            timeFactor *= 1.12;     // 月末补货高峰
        }

        // 4. 周一效应 (周一通常订单量较高)
        if (dayOfWeek == 1 && !isWeekend) {
            timeFactor *= 1.08;
        }

        // 5. 周五效应 (周五下午采购备货)
        if (dayOfWeek == 5 && hour >= 14) {
            timeFactor *= 1.10;
        }

        return probability * timeFactor;
    }

    /**
     * V3.0优化: 应用疲劳模型
     * 用户对同一品类商品的曝光次数超过阈值后，点击概率衰减
     * 衰减公式: probability × 0.7^(count - threshold)
     */
    private double applyFatigueModel(String wxUserId, String categoryId, double probability) {
        try {
            String key = EXPOSURE_COUNT_PREFIX + wxUserId + ":" + categoryId;

            // 获取并增加曝光计数
            Long count = redisTemplate.opsForValue().increment(key, 1);
            if (count == null) {
                count = 1L;
            }

            // 设置过期时间
            redisTemplate.expire(key, FATIGUE_CACHE_HOURS, TimeUnit.HOURS);

            // 如果曝光次数超过阈值，应用指数衰减
            if (count > FATIGUE_THRESHOLD) {
                double decayPower = count - FATIGUE_THRESHOLD;
                double decayFactor = Math.pow(FATIGUE_DECAY_FACTOR, decayPower);
                log.debug("疲劳模型: user={}, category={}, count={}, decay={:.4f}",
                        wxUserId, categoryId, count, decayFactor);
                return probability * decayFactor;
            }

            return probability;

        } catch (Exception e) {
            log.debug("疲劳模型应用失败: {}", e.getMessage());
            return probability;
        }
    }

    @Override
    public double calculatePurchaseProbability(String wxUserId, String productId, boolean hasClicked) {
        if (!hasClicked) {
            return 0.0;  // 未点击不可能购买
        }

        GoodsSpu product = goodsSpuMapper.selectById(productId);
        if (product == null) {
            return 0.0;
        }

        return calculatePurchaseProbabilityInternal(wxUserId, product, hasClicked);
    }

    /**
     * 计算购买概率（内部方法）
     */
    private double calculatePurchaseProbabilityInternal(String wxUserId, GoodsSpu product, boolean hasClicked) {
        if (!hasClicked) {
            return 0.0;
        }

        double baseCvr = BASE_CVR;

        // 1. 价格因素 (低价更易转化)
        double priceFactor = 1.0;
        if (product.getSalesPrice() != null) {
            double price = product.getSalesPrice().doubleValue();
            if (price < 50) {
                priceFactor = 1.5;
            } else if (price < 100) {
                priceFactor = 1.3;
            } else if (price < 200) {
                priceFactor = 1.1;
            } else if (price > 500) {
                priceFactor = 0.7;
            }
        }

        // 2. 聚类亲和度加成
        double clusterAffinity = calculateClusterAffinity(wxUserId, product);
        double affinityBoost = 1.0 + (clusterAffinity - 1.0) * 0.5;  // 亲和度影响减半

        // 3. 库存因素
        double stockFactor = 1.0;
        if (product.getStock() != null && product.getStock() < 10) {
            stockFactor = 1.2;  // 紧俏商品加成
        }

        // 计算最终概率
        double purchaseProb = baseCvr * priceFactor * affinityBoost * stockFactor;

        // 限制在合理范围 [0.01, 0.5]
        purchaseProb = Math.max(0.01, Math.min(0.5, purchaseProb));

        return purchaseProb;
    }

    @Override
    public double getClusterAffinity(String wxUserId, String productId) {
        GoodsSpu product = goodsSpuMapper.selectById(productId);
        if (product == null) {
            return 1.0;
        }
        return calculateClusterAffinity(wxUserId, product);
    }

    /**
     * 计算聚类亲和度
     */
    private double calculateClusterAffinity(String wxUserId, GoodsSpu product) {
        if (wxUserId == null || product == null) {
            return 1.0;
        }

        try {
            // 获取用户聚类
            UserClusterAssignment assignment = userClusterService.getUserClusterAssignment(wxUserId);
            if (assignment == null) {
                return 1.0;
            }

            UserCluster cluster = userClusterService.getClusterById(assignment.getClusterId());
            if (cluster == null) {
                return 1.0;
            }

            String clusterName = cluster.getClusterName();
            Map<String, Double> categoryAffinity = CLUSTER_CATEGORY_AFFINITY.get(clusterName);

            if (categoryAffinity == null) {
                return 1.0;
            }

            // 获取商品品类
            String category = product.getCategoryFirst();
            if (category == null) {
                return 1.0;
            }

            // 查找匹配的亲和度
            for (Map.Entry<String, Double> entry : categoryAffinity.entrySet()) {
                if (category.contains(entry.getKey()) || entry.getKey().contains(category)) {
                    return entry.getValue();
                }
            }

            // 检查推荐品类
            String recommendCategories = cluster.getRecommendCategories();
            if (recommendCategories != null && !recommendCategories.isEmpty()) {
                try {
                    List<String> recCategories = objectMapper.readValue(recommendCategories,
                            new TypeReference<List<String>>() {});
                    for (String recCategory : recCategories) {
                        if (category.contains(recCategory) || recCategory.contains(category)) {
                            return 1.5;  // 推荐品类加成
                        }
                    }
                } catch (Exception e) {
                    // 忽略解析错误
                }
            }

            return 1.0;  // 默认无加成

        } catch (Exception e) {
            log.debug("计算聚类亲和度失败: {}", e.getMessage());
            return 1.0;
        }
    }

    /**
     * 计算品类匹配度 (基于用户历史偏好)
     */
    private double calculateCategoryMatch(String wxUserId, GoodsSpu product) {
        if (wxUserId == null || product == null) {
            return 1.0;
        }

        try {
            // 获取用户品类偏好
            List<UserInterestTag> categoryTags = userInterestTagMapper.selectByType(wxUserId, "category");
            if (categoryTags == null || categoryTags.isEmpty()) {
                return 1.0;
            }

            String productCategory = product.getCategoryFirst();
            if (productCategory == null) {
                return 1.0;
            }

            // 查找匹配的品类偏好
            for (UserInterestTag tag : categoryTags) {
                if (tag.getTagValue() != null && tag.getWeight() != null) {
                    if (productCategory.equals(tag.getTagValue()) ||
                            productCategory.contains(tag.getTagValue()) ||
                            tag.getTagValue().contains(productCategory)) {
                        // 偏好强度映射到 [1.0, 2.0]
                        double weight = tag.getWeight().doubleValue();
                        return 1.0 + Math.min(1.0, weight);
                    }
                }
            }

            return 1.0;

        } catch (Exception e) {
            log.debug("计算品类匹配度失败: {}", e.getMessage());
            return 1.0;
        }
    }

    /**
     * 计算价格匹配度
     */
    private double calculatePriceMatch(String wxUserId, GoodsSpu product) {
        if (wxUserId == null || product == null || product.getSalesPrice() == null) {
            return 1.0;
        }

        try {
            // 获取用户画像
            UserRecommendationProfile profile = userProfileMapper.selectByWxUserId(wxUserId);
            if (profile == null || profile.getPricePreferences() == null) {
                return 1.0;
            }

            // 解析价格偏好
            Map<String, Object> pricePrefs = objectMapper.readValue(
                    profile.getPricePreferences(),
                    new TypeReference<Map<String, Object>>() {});

            String preferredRange = (String) pricePrefs.getOrDefault("range", "medium");
            double productPrice = product.getSalesPrice().doubleValue();

            // 根据价格偏好计算匹配度
            switch (preferredRange) {
                case "low":
                    if (productPrice < 50) return 1.5;
                    if (productPrice < 100) return 1.2;
                    if (productPrice > 300) return 0.5;
                    return 1.0;

                case "medium":
                    if (productPrice >= 50 && productPrice <= 200) return 1.3;
                    return 1.0;

                case "high":
                    if (productPrice > 200) return 1.5;
                    if (productPrice > 100) return 1.2;
                    return 0.8;

                default:
                    return 1.0;
            }

        } catch (Exception e) {
            log.debug("计算价格匹配度失败: {}", e.getMessage());
            return 1.0;
        }
    }

    @Override
    public Map<String, Object> getSimulationStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalSimulated", totalSimulated.get());
        stats.put("lastSimulatedTime", lastSimulatedTime);

        // 从CTR服务获取模型统计
        Map<String, Object> ctrStats = ctrPredictionService.getModelStats();
        stats.put("ctrModelStats", ctrStats);

        // 计算最近反馈率
        try {
            LambdaQueryWrapper<RecommendationLog> wrapper = new LambdaQueryWrapper<>();
            wrapper.ge(RecommendationLog::getCreateTime, LocalDateTime.now().minusDays(7));
            List<RecommendationLog> recentLogs = recommendationLogMapper.selectList(wrapper);

            long totalRecent = recentLogs.size();
            long clickedRecent = recentLogs.stream()
                    .filter(log -> Boolean.TRUE.equals(log.getIsClicked()))
                    .count();
            long purchasedRecent = recentLogs.stream()
                    .filter(log -> Boolean.TRUE.equals(log.getIsPurchased()))
                    .count();

            stats.put("recentTotalLogs", totalRecent);
            stats.put("recentClickedLogs", clickedRecent);
            stats.put("recentPurchasedLogs", purchasedRecent);
            stats.put("recentClickRate", totalRecent > 0 ?
                    String.format("%.4f", (double) clickedRecent / totalRecent) : "0.0000");
            stats.put("recentPurchaseRate", clickedRecent > 0 ?
                    String.format("%.4f", (double) purchasedRecent / clickedRecent) : "0.0000");

        } catch (Exception e) {
            log.warn("获取最近统计失败: {}", e.getMessage());
        }

        return stats;
    }
}
