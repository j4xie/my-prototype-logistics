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

    // 算法参数
    private static final double ALPHA = 1.5;  // 探索系数，越大越偏向探索
    private static final int USER_FEATURE_DIM = 24;  // 用户特征维度
    private static final int ITEM_FEATURE_DIM = 16;  // 商品特征维度
    private static final int TOTAL_FEATURE_DIM = USER_FEATURE_DIM + ITEM_FEATURE_DIM;  // 总特征维度
    private static final double DEFAULT_EXPLORATION_RATE = 0.2;  // 20% 探索率

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
     * 构建用户特征向量 (24维)
     * 维度分配:
     * - 0-4: 分类偏好 (top 5 categories one-hot)
     * - 5-9: 价格区间偏好 (5个区间)
     * - 10-14: 品牌偏好 (top 5 brands one-hot)
     * - 15-17: 用户状态 (cold_start/warming/mature)
     * - 18-20: 活跃时段 (早/中/晚)
     * - 21-23: 统计特征 (购买频次/平均消费/活跃度)
     */
    private double[] buildUserFeatureVector(String wxUserId) {
        double[] features = new double[USER_FEATURE_DIM];
        Arrays.fill(features, 0);

        try {
            // 获取用户兴趣标签
            List<UserInterestTag> tags = interestTagMapper.selectTopTags(wxUserId, 20);

            // 分类偏好 (0-4)
            List<UserInterestTag> categoryTags = tags.stream()
                    .filter(t -> "category".equals(t.getTagType()))
                    .limit(5)
                    .collect(Collectors.toList());
            for (int i = 0; i < categoryTags.size(); i++) {
                features[i] = categoryTags.get(i).getWeight().doubleValue();
            }

            // 价格区间偏好 (5-9)
            List<UserInterestTag> priceTags = tags.stream()
                    .filter(t -> "price_range".equals(t.getTagType()))
                    .limit(5)
                    .collect(Collectors.toList());
            for (int i = 0; i < priceTags.size(); i++) {
                features[5 + i] = priceTags.get(i).getWeight().doubleValue();
            }

            // 品牌偏好 (10-14)
            List<UserInterestTag> brandTags = tags.stream()
                    .filter(t -> "brand".equals(t.getTagType()))
                    .limit(5)
                    .collect(Collectors.toList());
            for (int i = 0; i < brandTags.size(); i++) {
                features[10 + i] = brandTags.get(i).getWeight().doubleValue();
            }

            // 用户状态 (15-17) - 根据标签数量判断
            int tagCount = tags.size();
            if (tagCount < 3) {
                features[15] = 1.0;  // cold_start
            } else if (tagCount < 10) {
                features[16] = 1.0;  // warming
            } else {
                features[17] = 1.0;  // mature
            }

            // 活跃时段 (18-20) - 根据当前时间
            int hour = java.time.LocalTime.now().getHour();
            if (hour >= 6 && hour < 12) {
                features[18] = 1.0;  // 早
            } else if (hour >= 12 && hour < 18) {
                features[19] = 1.0;  // 中
            } else {
                features[20] = 1.0;  // 晚
            }

            // 统计特征 (21-23) - 归一化
            double totalWeight = tags.stream()
                    .mapToDouble(t -> t.getWeight().doubleValue())
                    .sum();
            features[21] = Math.min(1.0, totalWeight / 5.0);  // 购买频次指标
            features[22] = Math.min(1.0, tagCount / 20.0);     // 活跃度指标
            features[23] = tags.isEmpty() ? 0 : tags.get(0).getWeight().doubleValue();  // 最强兴趣权重

        } catch (Exception e) {
            log.warn("构建用户特征向量失败: {}", e.getMessage());
        }

        return features;
    }

    /**
     * 构建分类特征向量 (16维)
     * 使用 one-hot + 统计特征
     */
    private double[] buildCategoryFeatureVector(String category, List<String> allCategories) {
        double[] features = new double[ITEM_FEATURE_DIM];
        Arrays.fill(features, 0);

        // One-hot 编码 (前10维)
        int index = allCategories.indexOf(category);
        if (index >= 0 && index < 10) {
            features[index] = 1.0;
        }

        // 分类热度特征 (10-15)
        try {
            // 获取分类下的商品统计
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getCategoryFirst, category)
                    .eq(GoodsSpu::getShelf, "1");
            Long count = goodsSpuMapper.selectCount(wrapper);
            features[10] = Math.min(1.0, count / 100.0);  // 商品数量归一化

            // 分类索引归一化
            features[11] = allCategories.isEmpty() ? 0 : (double) index / allCategories.size();

        } catch (Exception e) {
            log.warn("构建分类特征向量失败: {}", e.getMessage());
        }

        return features;
    }

    /**
     * 拼接用户和商品特征向量
     */
    private double[] concatenateFeatures(double[] userFeatures, double[] itemFeatures) {
        double[] combined = new double[TOTAL_FEATURE_DIM];
        System.arraycopy(userFeatures, 0, combined, 0,
                Math.min(userFeatures.length, USER_FEATURE_DIM));
        System.arraycopy(itemFeatures, 0, combined, USER_FEATURE_DIM,
                Math.min(itemFeatures.length, ITEM_FEATURE_DIM));
        return combined;
    }

    // ==================== 辅助方法 ====================

    /**
     * 获取或创建臂参数
     */
    private LinUCBArmParameter getOrCreateArmParameter(String armId, String armType) {
        // 先从缓存获取
        String cacheKey = LINUCB_PARAM_CACHE_PREFIX + armType + ":" + armId;
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return objectMapper.readValue(cached, LinUCBArmParameter.class);
            }
        } catch (Exception e) {
            log.warn("读取缓存失败: {}", e.getMessage());
        }

        // 从数据库获取
        LinUCBArmParameter param = armParameterMapper.selectByArmIdAndType(armId, armType);

        if (param == null) {
            // 创建新的臂参数
            param = new LinUCBArmParameter();
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
            param.setAlgorithmVersion("1.0");

            armParameterMapper.insert(param);
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
