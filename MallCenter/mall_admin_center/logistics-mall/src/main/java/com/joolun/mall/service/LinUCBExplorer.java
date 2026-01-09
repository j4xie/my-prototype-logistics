package com.joolun.mall.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.LinUCBArmParameter;
import com.joolun.mall.entity.LinUCBExplorationLog;
import com.joolun.mall.entity.UserInterestTag;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.mapper.LinUCBArmParameterMapper;
import com.joolun.mall.mapper.LinUCBExplorationLogMapper;
import com.joolun.mall.mapper.UserInterestTagMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * LinUCB (Linear Upper Confidence Bound) 上下文感知探索器
 *
 * 核心算法:
 * - UCB_a(t) = x^T * theta_a + alpha * sqrt(x^T * A_a^{-1} * x)
 * - 其中:
 *   - x: 上下文特征向量 (用户特征 + 商品特征)
 *   - theta_a = A_a^{-1} * b_a: 臂a的预测参数
 *   - alpha: 探索系数 (控制探索vs利用的平衡)
 *   - A_a: 协方差矩阵 (d x d)
 *   - b_a: 奖励累积向量 (d)
 *
 * 更新规则:
 * - 观察到奖励 r 后:
 *   - A_a = A_a + x * x^T
 *   - b_a = b_a + r * x
 *
 * 参考论文: Li et al., "A Contextual-Bandit Approach to Personalized News Article Recommendation", WWW 2010
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LinUCBExplorer implements BanditExplorer {

    private final LinUCBArmParameterMapper armParameterMapper;
    private final LinUCBExplorationLogMapper explorationLogMapper;
    private final UserInterestTagMapper interestTagMapper;
    private final GoodsSpuMapper goodsSpuMapper;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * 特征工程服务 - 提供 128 维特征向量
     * 使用 @Lazy 注入避免循环依赖
     */
    @Autowired
    @Lazy
    private FeatureEngineeringService featureEngineeringService;

    // 算法参数
    private static final double ALPHA = 1.5;  // 探索系数，越大越偏向探索

    /**
     * 特征维度配置 - 已升级到 128 维
     *
     * 用户特征 (64维):
     * - 基础属性 (0-7): 用户等级、注册天数、最近活跃度等
     * - 行为序列 (8-31): 最近浏览、收藏、购买商品的embedding均值
     * - 偏好特征 (32-47): 价格敏感度、品牌偏好、品类偏好
     * - 时间特征 (48-63): 周几、时段、节假日
     *
     * 商品特征 (64维):
     * - 基础属性 (0-7): 价格归一化、库存状态、上架时间
     * - 向量嵌入 (8-39): 商品文本embedding压缩
     * - 统计特征 (40-55): 销量、评分、浏览量
     * - 上下文特征 (56-63): 分类热度、竞品数量
     */
    private static final int USER_FEATURE_DIM = 64;  // 用户特征维度 (从24维升级)
    private static final int ITEM_FEATURE_DIM = 64;  // 商品特征维度 (从16维升级)
    private static final int TOTAL_FEATURE_DIM = USER_FEATURE_DIM + ITEM_FEATURE_DIM;  // 总特征维度 = 128

    // 向后兼容：旧版特征维度（用于迁移）
    private static final int LEGACY_TOTAL_FEATURE_DIM = 40;

    private static final double DEFAULT_EXPLORATION_RATE = 0.2;  // 20% 探索率
    private static final String ALGORITHM_VERSION = "2.0";  // 算法版本号

    // Redis 缓存前缀
    private static final String LINUCB_EXPLORATION_PREFIX = "linucb:exploration:";
    private static final String LINUCB_PARAM_CACHE_PREFIX = "linucb:param:";
    private static final long EXPLORATION_MARK_TTL_HOURS = 24;
    private static final long PARAM_CACHE_TTL_MINUTES = 10;

    private final Random random = new Random();

    @Override
    public String getAlgorithmName() {
        return "LinUCB";
    }

    @Override
    public boolean shouldExplore(double explorationRate) {
        return random.nextDouble() < explorationRate;
    }

    @Override
    public List<GoodsSpu> getExplorationRecommendations(String wxUserId,
                                                         Set<String> knownCategories,
                                                         int limit) {
        log.debug("LinUCB 探索推荐: wxUserId={}, knownCategories={}", wxUserId, knownCategories);

        try {
            // 1. 获取所有活跃分类
            List<String> allCategories = getAllActiveCategories();
            if (allCategories.isEmpty()) {
                log.warn("没有活跃分类可供探索");
                return Collections.emptyList();
            }

            // 2. 过滤出候选分类 (优先未知分类)
            List<String> candidateCategories = allCategories.stream()
                    .filter(cat -> !knownCategories.contains(cat))
                    .collect(Collectors.toList());

            if (candidateCategories.isEmpty()) {
                candidateCategories = allCategories;  // 所有分类都已知，使用全部
            }

            // 3. 构建用户特征向量
            double[] userFeatures = buildUserFeatureVector(wxUserId);

            // 4. 使用 LinUCB 选择最佳分类
            String selectedCategory = selectCategoryByLinUCB(candidateCategories, userFeatures);
            if (selectedCategory == null) {
                log.warn("LinUCB 未能选择分类");
                return Collections.emptyList();
            }

            log.info("LinUCB 选择分类: {}", selectedCategory);

            // 5. 获取该分类的热门商品
            List<GoodsSpu> products = getPopularInCategory(selectedCategory, limit);

            // 6. 记录探索日志和标记
            for (GoodsSpu product : products) {
                markAsExploration(wxUserId, product.getId(), selectedCategory);
                logExploration(wxUserId, selectedCategory, userFeatures, product);
            }

            return products;

        } catch (Exception e) {
            log.error("LinUCB 探索推荐失败: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    /**
     * 使用 LinUCB 算法选择分类
     */
    private String selectCategoryByLinUCB(List<String> categories, double[] userFeatures) {
        String bestCategory = null;
        double bestUCB = Double.NEGATIVE_INFINITY;

        for (String category : categories) {
            // 获取或初始化该分类的臂参数
            LinUCBArmParameter armParam = getOrCreateArmParameter(category, "category");

            // 构建分类特征向量 (简化版: 使用 one-hot 编码)
            double[] itemFeatures = buildCategoryFeatureVector(category, categories);

            // 拼接特征向量
            double[] context = concatenateFeatures(userFeatures, itemFeatures);

            // 计算 UCB 值
            double ucb = computeUCB(context, armParam);

            log.debug("分类 {} UCB值: {}", category, ucb);

            if (ucb > bestUCB) {
                bestUCB = ucb;
                bestCategory = category;
            }
        }

        return bestCategory;
    }

    /**
     * 计算 UCB 值
     * UCB = x^T * theta + alpha * sqrt(x^T * A^{-1} * x)
     */
    private double computeUCB(double[] context, LinUCBArmParameter armParam) {
        try {
            double[][] A = parseMatrix(armParam.getAMatrix(), armParam.getFeatureDimension());
            double[] b = parseVector(armParam.getBVector());
            double[] theta = parseVector(armParam.getThetaVector());

            // 确保维度一致
            int d = Math.min(context.length, armParam.getFeatureDimension());

            // 计算预期奖励: x^T * theta
            double expectedReward = 0;
            for (int i = 0; i < d; i++) {
                expectedReward += context[i] * theta[i];
            }

            // 计算 A 的逆矩阵
            double[][] AInv = invertMatrix(A);

            // 计算探索奖励: alpha * sqrt(x^T * A^{-1} * x)
            double uncertainty = 0;
            for (int i = 0; i < d; i++) {
                double temp = 0;
                for (int j = 0; j < d; j++) {
                    temp += context[j] * AInv[j][i];
                }
                uncertainty += context[i] * temp;
            }
            double explorationBonus = ALPHA * Math.sqrt(Math.max(0, uncertainty));

            return expectedReward + explorationBonus;

        } catch (Exception e) {
            log.warn("计算UCB失败: {}", e.getMessage());
            return 0.5 + random.nextDouble() * 0.1;  // 返回随机值作为降级
        }
    }

    @Override
    public void updateReward(String wxUserId, String itemId, boolean isPositive) {
        try {
            // 获取探索来源
            String category = getExplorationSource(wxUserId, itemId);
            if (category == null) {
                log.debug("商品 {} 不是 LinUCB 探索推荐", itemId);
                return;
            }

            double reward = isPositive ? 1.0 : 0.0;

            // 获取用户特征
            double[] userFeatures = buildUserFeatureVector(wxUserId);

            // 获取所有分类用于构建特征
            List<String> allCategories = getAllActiveCategories();
            double[] itemFeatures = buildCategoryFeatureVector(category, allCategories);
            double[] context = concatenateFeatures(userFeatures, itemFeatures);

            // 更新臂参数
            updateArmParameters(category, "category", context, reward);

            // 更新反馈计数
            armParameterMapper.updateFeedback(
                    category, "category",
                    isPositive ? 1 : 0,
                    isPositive ? 0 : 1,
                    reward
            );

            // 更新探索日志
            updateExplorationLog(wxUserId, itemId, reward, isPositive);

            log.info("LinUCB 更新奖励: category={}, reward={}", category, reward);

        } catch (Exception e) {
            log.error("LinUCB 更新奖励失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 更新臂参数
     * A = A + x * x^T
     * b = b + r * x
     * theta = A^{-1} * b
     */
    private void updateArmParameters(String armId, String armType, double[] context, double reward) {
        LinUCBArmParameter armParam = getOrCreateArmParameter(armId, armType);
        int d = armParam.getFeatureDimension();

        try {
            double[][] A = parseMatrix(armParam.getAMatrix(), d);
            double[] b = parseVector(armParam.getBVector());

            // A = A + x * x^T (外积)
            for (int i = 0; i < d; i++) {
                for (int j = 0; j < d; j++) {
                    A[i][j] += context[i] * context[j];
                }
            }

            // b = b + r * x
            for (int i = 0; i < d; i++) {
                b[i] += reward * context[i];
            }

            // theta = A^{-1} * b
            double[][] AInv = invertMatrix(A);
            double[] theta = new double[d];
            for (int i = 0; i < d; i++) {
                theta[i] = 0;
                for (int j = 0; j < d; j++) {
                    theta[i] += AInv[i][j] * b[j];
                }
            }

            // 保存更新后的参数
            armParameterMapper.updateParameters(
                    armId, armType,
                    serializeMatrix(A),
                    serializeVector(b),
                    serializeVector(theta)
            );

            // 清除缓存
            String cacheKey = LINUCB_PARAM_CACHE_PREFIX + armType + ":" + armId;
            redisTemplate.delete(cacheKey);

        } catch (Exception e) {
            log.error("更新臂参数失败: {}", e.getMessage(), e);
        }
    }

    @Override
    public String getExplorationSource(String wxUserId, String productId) {
        String key = LINUCB_EXPLORATION_PREFIX + wxUserId + ":" + productId;
        try {
            return redisTemplate.opsForValue().get(key);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public void handleExplorationFeedback(String wxUserId, String productId, boolean isPositive) {
        updateReward(wxUserId, productId, isPositive);
    }

    // ==================== 特征构建 ====================

    /**
     * 构建用户特征向量 (64维)
     *
     * 维度分配:
     * - 0-7: 基础属性 (用户等级、注册天数、最近活跃度等)
     * - 8-31: 行为序列 (最近浏览、收藏、购买商品的embedding均值)
     * - 32-47: 偏好特征 (价格敏感度、品牌偏好、品类偏好)
     * - 48-63: 时间特征 (周几、时段、节假日)
     *
     * @param wxUserId 用户ID
     * @return 64维用户特征向量
     */
    private double[] buildUserFeatureVector(String wxUserId) {
        // 优先使用特征工程服务（提供更丰富的128维中的64维用户特征）
        if (featureEngineeringService != null && featureEngineeringService.isAvailable()) {
            try {
                double[] features = featureEngineeringService.buildUserFeatureVector(wxUserId);
                if (features != null && features.length == USER_FEATURE_DIM) {
                    return features;
                }
            } catch (Exception e) {
                log.warn("特征工程服务构建用户特征失败，降级到旧版实现: {}", e.getMessage());
            }
        }

        // 降级：使用旧版简化实现
        return buildUserFeatureVectorLegacy(wxUserId);
    }

    /**
     * 旧版用户特征构建（降级用）
     * 将24维扩展到64维，保持向后兼容
     */
    private double[] buildUserFeatureVectorLegacy(String wxUserId) {
        double[] features = new double[USER_FEATURE_DIM];
        Arrays.fill(features, 0);

        try {
            // 获取用户兴趣标签
            List<UserInterestTag> tags = interestTagMapper.selectTopTags(wxUserId, 20);

            // 分类偏好 (0-7) - 扩展到8维
            List<UserInterestTag> categoryTags = tags.stream()
                    .filter(t -> "category".equals(t.getTagType()))
                    .limit(8)
                    .collect(Collectors.toList());
            for (int i = 0; i < categoryTags.size(); i++) {
                features[i] = categoryTags.get(i).getWeight().doubleValue();
            }

            // 价格区间偏好 (8-15) - 扩展到8维
            List<UserInterestTag> priceTags = tags.stream()
                    .filter(t -> "price_range".equals(t.getTagType()))
                    .limit(8)
                    .collect(Collectors.toList());
            for (int i = 0; i < priceTags.size(); i++) {
                features[8 + i] = priceTags.get(i).getWeight().doubleValue();
            }

            // 品牌偏好 (16-23) - 扩展到8维
            List<UserInterestTag> brandTags = tags.stream()
                    .filter(t -> "brand".equals(t.getTagType()))
                    .limit(8)
                    .collect(Collectors.toList());
            for (int i = 0; i < brandTags.size(); i++) {
                features[16 + i] = brandTags.get(i).getWeight().doubleValue();
            }

            // 用户状态 (24-31) - 扩展到8维
            int tagCount = tags.size();
            if (tagCount < 3) {
                features[24] = 1.0;  // cold_start
            } else if (tagCount < 10) {
                features[25] = 1.0;  // warming
            } else if (tagCount < 20) {
                features[26] = 1.0;  // mature
            } else {
                features[27] = 1.0;  // expert
            }
            features[28] = Math.min(1.0, tagCount / 30.0);  // 标签丰富度

            // 活跃时段 (32-39) - 扩展到8维
            int hour = java.time.LocalTime.now().getHour();
            if (hour >= 6 && hour < 9) {
                features[32] = 1.0;  // 早晨
            } else if (hour >= 9 && hour < 12) {
                features[33] = 1.0;  // 上午
            } else if (hour >= 12 && hour < 14) {
                features[34] = 1.0;  // 午间
            } else if (hour >= 14 && hour < 18) {
                features[35] = 1.0;  // 下午
            } else if (hour >= 18 && hour < 21) {
                features[36] = 1.0;  // 晚间
            } else {
                features[37] = 1.0;  // 夜间
            }

            // 统计特征 (40-47) - 扩展到8维
            double totalWeight = tags.stream()
                    .mapToDouble(t -> t.getWeight().doubleValue())
                    .sum();
            features[40] = Math.min(1.0, totalWeight / 5.0);  // 购买频次指标
            features[41] = Math.min(1.0, tagCount / 20.0);     // 活跃度指标
            features[42] = tags.isEmpty() ? 0 : tags.get(0).getWeight().doubleValue();  // 最强兴趣权重
            features[43] = tags.isEmpty() ? 0 : tags.stream()
                    .mapToDouble(t -> t.getWeight().doubleValue())
                    .average().orElse(0);  // 平均兴趣权重

            // 周几特征 (48-54) - 7维
            int dayOfWeek = java.time.LocalDate.now().getDayOfWeek().getValue();
            features[47 + dayOfWeek] = 1.0;

            // 保留空间 (55-63) - 未来扩展用

        } catch (Exception e) {
            log.warn("构建用户特征向量失败: {}", e.getMessage());
        }

        return features;
    }

    /**
     * 构建分类特征向量 (64维)
     *
     * 维度分配:
     * - 0-15: One-hot 分类编码
     * - 16-23: 分类热度特征
     * - 24-31: 分类位置特征
     * - 32-47: 分类统计特征
     * - 48-55: 时间相关特征
     * - 56-63: 保留
     *
     * @param category 分类ID
     * @param allCategories 所有活跃分类列表
     * @return 64维分类特征向量
     */
    private double[] buildCategoryFeatureVector(String category, List<String> allCategories) {
        // 优先使用特征工程服务
        if (featureEngineeringService != null && featureEngineeringService.isAvailable()) {
            try {
                double[] features = featureEngineeringService.buildCategoryFeatureVector(category, allCategories);
                if (features != null && features.length == ITEM_FEATURE_DIM) {
                    return features;
                }
            } catch (Exception e) {
                log.warn("特征工程服务构建分类特征失败，降级到旧版实现: {}", e.getMessage());
            }
        }

        // 降级：使用旧版简化实现
        return buildCategoryFeatureVectorLegacy(category, allCategories);
    }

    /**
     * 旧版分类特征构建（降级用）
     * 将16维扩展到64维，保持向后兼容
     */
    private double[] buildCategoryFeatureVectorLegacy(String category, List<String> allCategories) {
        double[] features = new double[ITEM_FEATURE_DIM];
        Arrays.fill(features, 0);

        int index = allCategories.indexOf(category);

        // One-hot 编码 (0-15): 16维
        if (index >= 0 && index < 16) {
            features[index] = 1.0;
        } else if (index >= 16) {
            // 超过16个分类使用hash编码
            features[index % 16] = 1.0;
        }

        // 分类热度特征 (16-23): 8维
        try {
            // 获取分类下的商品统计
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getCategoryFirst, category)
                    .eq(GoodsSpu::getShelf, "1");
            List<GoodsSpu> products = goodsSpuMapper.selectList(wrapper);
            long count = products.size();

            features[16] = Math.min(1.0, count / 100.0);  // 商品数量归一化
            features[17] = allCategories.isEmpty() ? 0 : (double) index / allCategories.size();  // 分类索引归一化
            features[18] = count > 20 ? 1.0 : 0;  // 热门分类标记
            features[19] = count < 5 ? 1.0 : 0;   // 稀缺分类标记

            // 计算分类内的销量总和
            int totalSales = products.stream()
                    .filter(p -> p.getSaleNum() != null)
                    .mapToInt(GoodsSpu::getSaleNum)
                    .sum();
            features[20] = Math.min(1.0, totalSales / 10000.0);

            // 计算平均价格
            double avgPrice = products.stream()
                    .filter(p -> p.getSalesPrice() != null)
                    .mapToDouble(p -> p.getSalesPrice().doubleValue())
                    .average()
                    .orElse(0);
            features[21] = Math.min(1.0, avgPrice / 1000.0);

            // 有库存商品比例
            long inStockCount = products.stream()
                    .filter(p -> p.getStock() != null && p.getStock() > 0)
                    .count();
            features[22] = count > 0 ? (double) inStockCount / count : 0;

            // 新品比例
            java.time.LocalDateTime thirtyDaysAgo = java.time.LocalDateTime.now().minusDays(30);
            long newCount = products.stream()
                    .filter(p -> p.getCreateTime() != null && p.getCreateTime().isAfter(thirtyDaysAgo))
                    .count();
            features[23] = count > 0 ? (double) newCount / count : 0;

        } catch (Exception e) {
            log.warn("构建分类特征向量失败: {}", e.getMessage());
        }

        // 分类位置特征 (24-31): 8维
        features[24] = index < allCategories.size() / 3 ? 1.0 : 0;  // 热门分类（前1/3）
        features[25] = index >= allCategories.size() * 2 / 3 ? 1.0 : 0;  // 冷门分类（后1/3）
        features[26] = allCategories.size() > 10 && index < 10 ? 1.0 : 0;  // top10分类
        features[27] = Math.max(0, 1.0 - (double) index / Math.max(1, allCategories.size()));  // 排名分数

        // 时间特征 (32-39): 8维
        int hour = java.time.LocalTime.now().getHour();
        int dayOfWeek = java.time.LocalDate.now().getDayOfWeek().getValue();
        features[32] = (hour >= 9 && hour < 21) ? 1.0 : 0;  // 营业时间
        features[33] = (dayOfWeek <= 5) ? 1.0 : 0;  // 工作日
        features[34] = (dayOfWeek > 5) ? 1.0 : 0;   // 周末
        features[35] = (hour >= 11 && hour < 14) || (hour >= 17 && hour < 20) ? 1.0 : 0;  // 用餐时段

        // 保留空间 (40-63): 24维 - 未来扩展用

        return features;
    }

    /**
     * 拼接用户和商品特征向量
     * 总维度: 128 = 64(用户) + 64(商品)
     *
     * @param userFeatures 64维用户特征向量
     * @param itemFeatures 64维商品/分类特征向量
     * @return 128维组合特征向量
     */
    private double[] concatenateFeatures(double[] userFeatures, double[] itemFeatures) {
        // 优先使用特征工程服务
        if (featureEngineeringService != null) {
            try {
                return featureEngineeringService.concatenateFeatures(userFeatures, itemFeatures);
            } catch (Exception e) {
                log.debug("特征工程服务拼接特征失败，使用默认实现: {}", e.getMessage());
            }
        }

        // 默认实现
        double[] combined = new double[TOTAL_FEATURE_DIM];
        Arrays.fill(combined, 0);

        if (userFeatures != null) {
            System.arraycopy(userFeatures, 0, combined, 0,
                    Math.min(userFeatures.length, USER_FEATURE_DIM));
        }
        if (itemFeatures != null) {
            System.arraycopy(itemFeatures, 0, combined, USER_FEATURE_DIM,
                    Math.min(itemFeatures.length, ITEM_FEATURE_DIM));
        }

        return combined;
    }

    // ==================== 辅助方法 ====================

    /**
     * 获取或创建臂参数
     * 支持从旧版40维自动迁移到新版128维
     */
    private LinUCBArmParameter getOrCreateArmParameter(String armId, String armType) {
        // 先从缓存获取
        String cacheKey = LINUCB_PARAM_CACHE_PREFIX + armType + ":" + armId;
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                LinUCBArmParameter cachedParam = objectMapper.readValue(cached, LinUCBArmParameter.class);
                // 检查是否需要迁移
                if (cachedParam.getFeatureDimension() == TOTAL_FEATURE_DIM) {
                    return cachedParam;
                }
                // 需要迁移，清除缓存
                redisTemplate.delete(cacheKey);
            }
        } catch (Exception e) {
            log.warn("读取缓存失败: {}", e.getMessage());
        }

        // 从数据库获取
        LinUCBArmParameter param = armParameterMapper.selectByArmIdAndType(armId, armType);

        if (param == null) {
            // 创建新的臂参数（128维）
            param = createNewArmParameter(armId, armType);
            armParameterMapper.insert(param);
            log.info("创建新的LinUCB臂参数: armId={}, armType={}, dim={}", armId, armType, TOTAL_FEATURE_DIM);
        } else if (param.getFeatureDimension() != TOTAL_FEATURE_DIM) {
            // 需要迁移旧版参数到新版
            param = migrateArmParameter(param);
            log.info("迁移LinUCB臂参数: armId={}, oldDim={}, newDim={}",
                    armId, param.getFeatureDimension(), TOTAL_FEATURE_DIM);
        }

        // 存入缓存
        try {
            redisTemplate.opsForValue().set(cacheKey,
                    objectMapper.writeValueAsString(param),
                    PARAM_CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.warn("写入缓存失败: {}", e.getMessage());
        }

        return param;
    }

    /**
     * 创建新的臂参数（128维）
     */
    private LinUCBArmParameter createNewArmParameter(String armId, String armType) {
        LinUCBArmParameter param = new LinUCBArmParameter();
        param.setArmId(armId);
        param.setArmType(armType);
        param.setFeatureDimension(TOTAL_FEATURE_DIM);
        param.setAMatrix(serializeMatrix(identityMatrix(TOTAL_FEATURE_DIM)));
        param.setBVector(serializeVector(new double[TOTAL_FEATURE_DIM]));
        param.setThetaVector(serializeVector(new double[TOTAL_FEATURE_DIM]));
        param.setSelectionCount(0);
        param.setPositiveFeedbackCount(0);
        param.setNegativeFeedbackCount(0);
        param.setCumulativeReward(BigDecimal.ZERO);
        param.setExpectedCtr(BigDecimal.ZERO);
        param.setAlgorithmVersion(ALGORITHM_VERSION);
        return param;
    }

    /**
     * 迁移旧版臂参数到新版128维
     * 保留已学习的模式，扩展到新维度
     */
    private LinUCBArmParameter migrateArmParameter(LinUCBArmParameter oldParam) {
        int oldDim = oldParam.getFeatureDimension();

        try {
            // 解析旧的矩阵和向量
            double[][] oldA = parseMatrix(oldParam.getAMatrix(), oldDim);
            double[] oldB = parseVector(oldParam.getBVector());
            double[] oldTheta = parseVector(oldParam.getThetaVector());

            // 创建新的128维矩阵和向量
            double[][] newA = identityMatrix(TOTAL_FEATURE_DIM);
            double[] newB = new double[TOTAL_FEATURE_DIM];
            double[] newTheta = new double[TOTAL_FEATURE_DIM];

            // 复制旧值到新矩阵（保留已学习的模式）
            int copyDim = Math.min(oldDim, TOTAL_FEATURE_DIM);
            for (int i = 0; i < copyDim; i++) {
                for (int j = 0; j < copyDim; j++) {
                    newA[i][j] = oldA[i][j];
                }
                newB[i] = oldB[i];
                newTheta[i] = oldTheta[i];
            }

            // 更新参数
            oldParam.setFeatureDimension(TOTAL_FEATURE_DIM);
            oldParam.setAMatrix(serializeMatrix(newA));
            oldParam.setBVector(serializeVector(newB));
            oldParam.setThetaVector(serializeVector(newTheta));
            oldParam.setAlgorithmVersion(ALGORITHM_VERSION);

            // 保存更新
            armParameterMapper.updateParameters(
                    oldParam.getArmId(),
                    oldParam.getArmType(),
                    oldParam.getAMatrix(),
                    oldParam.getBVector(),
                    oldParam.getThetaVector()
            );

            // 更新维度（如果有这个字段的更新方法）
            // armParameterMapper.updateDimension(oldParam.getArmId(), oldParam.getArmType(), TOTAL_FEATURE_DIM);

        } catch (Exception e) {
            log.error("迁移臂参数失败，重置为新参数: armId={}, error={}",
                    oldParam.getArmId(), e.getMessage());
            // 迁移失败，创建全新参数
            return createNewArmParameter(oldParam.getArmId(), oldParam.getArmType());
        }

        return oldParam;
    }

    /**
     * 标记商品为探索推荐
     */
    private void markAsExploration(String wxUserId, String productId, String category) {
        String key = LINUCB_EXPLORATION_PREFIX + wxUserId + ":" + productId;
        try {
            redisTemplate.opsForValue().set(key, category, EXPLORATION_MARK_TTL_HOURS, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("标记探索商品失败: {}", e.getMessage());
        }
    }

    /**
     * 记录探索日志
     */
    private void logExploration(String wxUserId, String category, double[] userFeatures, GoodsSpu product) {
        try {
            LinUCBExplorationLog log = new LinUCBExplorationLog();
            log.setWxUserId(wxUserId);
            log.setArmId(category);
            log.setArmType("category");
            log.setContextVector(serializeVector(userFeatures));
            log.setAlphaValue(BigDecimal.valueOf(ALPHA));

            explorationLogMapper.insert(log);
        } catch (Exception e) {
            LinUCBExplorer.log.warn("记录探索日志失败: {}", e.getMessage());
        }
    }

    /**
     * 更新探索日志反馈
     */
    private void updateExplorationLog(String wxUserId, String productId, double reward, boolean isClicked) {
        try {
            String category = getExplorationSource(wxUserId, productId);
            if (category != null) {
                LinUCBExplorationLog log = explorationLogMapper.selectPendingFeedback(wxUserId, category);
                if (log != null) {
                    explorationLogMapper.updateFeedback(log.getId(), reward, isClicked, false);
                }
            }
        } catch (Exception e) {
            log.warn("更新探索日志失败: {}", e.getMessage());
        }
    }

    /**
     * 获取所有活跃分类
     */
    private List<String> getAllActiveCategories() {
        String cacheKey = "linucb:active_categories";
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return Arrays.asList(cached.split(","));
            }
        } catch (Exception e) {
            // ignore
        }

        List<String> categories = goodsSpuMapper.selectDistinctCategories();
        if (categories != null && !categories.isEmpty()) {
            try {
                redisTemplate.opsForValue().set(cacheKey, String.join(",", categories), 1, TimeUnit.HOURS);
            } catch (Exception e) {
                // ignore
            }
        }
        return categories != null ? categories : Collections.emptyList();
    }

    /**
     * 获取分类内的热门商品
     */
    private List<GoodsSpu> getPopularInCategory(String category, int limit) {
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(GoodsSpu::getCategoryFirst, category)
                .eq(GoodsSpu::getShelf, "1")
                .orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit);

        return goodsSpuMapper.selectList(wrapper);
    }

    // ==================== 矩阵运算工具 ====================

    /**
     * 创建单位矩阵
     */
    private double[][] identityMatrix(int d) {
        double[][] I = new double[d][d];
        for (int i = 0; i < d; i++) {
            I[i][i] = 1.0;
        }
        return I;
    }

    /**
     * 矩阵求逆 (Gauss-Jordan 消元法)
     * 注意: 这是简化版实现，实际生产环境建议使用 Apache Commons Math
     */
    private double[][] invertMatrix(double[][] matrix) {
        int n = matrix.length;
        double[][] augmented = new double[n][2 * n];

        // 构建增广矩阵 [A | I]
        for (int i = 0; i < n; i++) {
            System.arraycopy(matrix[i], 0, augmented[i], 0, n);
            augmented[i][n + i] = 1.0;
        }

        // Gauss-Jordan 消元
        for (int i = 0; i < n; i++) {
            // 找主元
            int maxRow = i;
            for (int k = i + 1; k < n; k++) {
                if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
                    maxRow = k;
                }
            }

            // 交换行
            double[] temp = augmented[i];
            augmented[i] = augmented[maxRow];
            augmented[maxRow] = temp;

            // 主元为0时添加正则化
            if (Math.abs(augmented[i][i]) < 1e-10) {
                augmented[i][i] = 1e-10;
            }

            // 归一化主行
            double pivot = augmented[i][i];
            for (int j = 0; j < 2 * n; j++) {
                augmented[i][j] /= pivot;
            }

            // 消去其他行
            for (int k = 0; k < n; k++) {
                if (k != i) {
                    double factor = augmented[k][i];
                    for (int j = 0; j < 2 * n; j++) {
                        augmented[k][j] -= factor * augmented[i][j];
                    }
                }
            }
        }

        // 提取逆矩阵
        double[][] inverse = new double[n][n];
        for (int i = 0; i < n; i++) {
            System.arraycopy(augmented[i], n, inverse[i], 0, n);
        }

        return inverse;
    }

    /**
     * 序列化矩阵为 JSON
     */
    private String serializeMatrix(double[][] matrix) {
        try {
            return objectMapper.writeValueAsString(matrix);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    /**
     * 反序列化矩阵
     */
    private double[][] parseMatrix(String json, int d) {
        if (json == null || json.isEmpty() || "[]".equals(json)) {
            return identityMatrix(d);
        }
        try {
            return objectMapper.readValue(json, new TypeReference<double[][]>() {});
        } catch (Exception e) {
            return identityMatrix(d);
        }
    }

    /**
     * 序列化向量为 JSON
     */
    private String serializeVector(double[] vector) {
        try {
            return objectMapper.writeValueAsString(vector);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    /**
     * 反序列化向量
     */
    private double[] parseVector(String json) {
        if (json == null || json.isEmpty() || "[]".equals(json)) {
            return new double[TOTAL_FEATURE_DIM];
        }
        try {
            return objectMapper.readValue(json, new TypeReference<double[]>() {});
        } catch (Exception e) {
            return new double[TOTAL_FEATURE_DIM];
        }
    }
}
