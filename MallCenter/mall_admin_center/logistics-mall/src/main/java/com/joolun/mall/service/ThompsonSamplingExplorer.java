package com.joolun.mall.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.UserInterestTag;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.mapper.UserInterestTagMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Thompson Sampling 强化学习探索器
 *
 * 核心概念:
 * - 贝塔分布 Beta(α, β): 用于建模"成功概率"的不确定性
 * - α: 正向反馈数 (点击、购买)
 * - β: 负向反馈数 (曝光未互动)
 *
 * 算法流程:
 * 1. 为每个候选分类从Beta分布采样
 * 2. 选择采样值最高的分类
 * 3. 观察用户反馈，更新分布参数
 *
 * 借鉴抖音的20%探索内容策略
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ThompsonSamplingExplorer implements BanditExplorer {

    private final UserInterestTagMapper interestTagMapper;
    private final GoodsSpuMapper goodsSpuMapper;
    private final StringRedisTemplate redisTemplate;

    // Redis 缓存前缀
    private static final String CATEGORY_BETA_PREFIX = "ts:category:beta:";  // 分类的Beta参数
    private static final String EXPLORATION_MARK_PREFIX = "ts:exploration:";  // 探索标记
    private static final long BETA_CACHE_TTL_DAYS = 30;

    // 默认探索率
    private static final double DEFAULT_EXPLORATION_RATE = 0.2;  // 20%

    private final Random random = new Random();

    @Override
    public String getAlgorithmName() {
        return "ThompsonSampling";
    }

    /**
     * 决定是否进行探索
     * @param explorationRate 探索率（0.0-1.0）
     * @return true表示应该探索新内容
     */
    @Override
    public boolean shouldExplore(double explorationRate) {
        return random.nextDouble() < explorationRate;
    }

    /**
     * 使用默认探索率决定是否探索
     */
    @Override
    public boolean shouldExplore() {
        return shouldExplore(DEFAULT_EXPLORATION_RATE);
    }

    /**
     * 获取探索性推荐（用户从未/很少接触的分类）
     *
     * @param wxUserId 用户ID
     * @param knownCategories 用户已知兴趣的分类集合
     * @param limit 返回数量限制
     * @return 探索性推荐的商品列表
     */
    @Override
    public List<GoodsSpu> getExplorationRecommendations(String wxUserId,
                                                         Set<String> knownCategories,
                                                         int limit) {
        log.debug("开始探索推荐: wxUserId={}, knownCategories={}", wxUserId, knownCategories);

        // 1. 获取所有活跃分类
        List<String> allCategories = getAllActiveCategories();
        if (allCategories.isEmpty()) {
            return Collections.emptyList();
        }

        // 2. 过滤出用户未接触或接触较少的分类
        List<String> candidateCategories = allCategories.stream()
                .filter(cat -> !knownCategories.contains(cat))
                .collect(Collectors.toList());

        // 如果所有分类都已知，使用所有分类（可能发现新偏好）
        if (candidateCategories.isEmpty()) {
            candidateCategories = allCategories;
        }

        // 3. 用 Thompson Sampling 选择分类
        String selectedCategory = selectCategoryByThompsonSampling(candidateCategories);
        if (selectedCategory == null) {
            return Collections.emptyList();
        }

        log.info("Thompson Sampling 选择分类: {}", selectedCategory);

        // 4. 返回该分类的热门商品
        List<GoodsSpu> products = getPopularInCategory(selectedCategory, limit);

        // 5. 标记为探索商品（用于后续反馈）
        for (GoodsSpu product : products) {
            markAsExploration(wxUserId, product.getId(), selectedCategory);
        }

        return products;
    }

    /**
     * 使用 Thompson Sampling 算法选择分类
     * 基于贝塔分布采样，平衡探索与利用
     */
    private String selectCategoryByThompsonSampling(List<String> categories) {
        if (categories.isEmpty()) {
            return null;
        }

        String bestCategory = null;
        double bestSample = -1;

        for (String category : categories) {
            // 获取该分类的 Beta 参数
            double[] betaParams = getCategoryBetaParams(category);
            double alpha = betaParams[0];
            double beta = betaParams[1];

            // 从 Beta(α, β) 分布采样
            double sample = sampleFromBeta(alpha, beta);

            log.debug("分类 {} 的 Beta({}, {}) 采样值: {}", category, alpha, beta, sample);

            if (sample > bestSample) {
                bestSample = sample;
                bestCategory = category;
            }
        }

        return bestCategory;
    }

    /**
     * 获取分类的 Beta 分布参数
     * @return [alpha, beta] 数组
     */
    private double[] getCategoryBetaParams(String category) {
        String key = CATEGORY_BETA_PREFIX + category;
        try {
            String cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                String[] parts = cached.split(",");
                return new double[]{Double.parseDouble(parts[0]), Double.parseDouble(parts[1])};
            }
        } catch (Exception e) {
            log.warn("读取分类Beta参数失败: {}", category, e);
        }
        // 默认先验: Beta(1, 1) = 均匀分布
        return new double[]{1.0, 1.0};
    }

    /**
     * 保存分类的 Beta 分布参数
     */
    private void saveCategoryBetaParams(String category, double alpha, double beta) {
        String key = CATEGORY_BETA_PREFIX + category;
        try {
            redisTemplate.opsForValue().set(key, alpha + "," + beta, BETA_CACHE_TTL_DAYS, TimeUnit.DAYS);
        } catch (Exception e) {
            log.warn("保存分类Beta参数失败: {}", category, e);
        }
    }

    /**
     * 实现 BanditExplorer 接口的 updateReward 方法
     * 根据用户ID和商品ID更新奖励
     */
    @Override
    public void updateReward(String wxUserId, String itemId, boolean isPositive) {
        String category = getExplorationSource(wxUserId, itemId);
        if (category != null) {
            updateCategoryReward(category, isPositive);
            log.info("TS更新奖励: wxUserId={}, itemId={}, category={}, positive={}",
                    wxUserId, itemId, category, isPositive);
        }
    }

    /**
     * 更新分类的强化学习奖励
     * 当用户对推荐内容产生正向/负向行为时调用
     *
     * @param category 分类
     * @param isPositive 是否正向反馈 (点击/购买=true, 曝光未互动=false)
     */
    public void updateCategoryReward(String category, boolean isPositive) {
        double[] params = getCategoryBetaParams(category);
        double alpha = params[0];
        double beta = params[1];

        if (isPositive) {
            // 正向反馈: α += 1
            alpha += 1.0;
        } else {
            // 负向反馈: β += 1
            beta += 1.0;
        }

        saveCategoryBetaParams(category, alpha, beta);

        double expectedCTR = alpha / (alpha + beta);
        log.info("RL更新 - 分类:{}, α={}, β={}, 预期CTR={}", category, alpha, beta, expectedCTR);
    }

    /**
     * 批量更新奖励（用于曝光未点击的情况）
     */
    public void updateNegativeRewards(List<String> categories) {
        for (String category : categories) {
            updateCategoryReward(category, false);
        }
    }

    /**
     * 标记商品为探索推荐（用于后续追踪反馈）
     */
    private void markAsExploration(String wxUserId, String productId, String category) {
        String key = EXPLORATION_MARK_PREFIX + wxUserId + ":" + productId;
        try {
            redisTemplate.opsForValue().set(key, category, 24, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("标记探索商品失败", e);
        }
    }

    /**
     * 检查商品是否为探索推荐
     * @return 探索来源分类，如果不是探索推荐则返回 null
     */
    public String getExplorationSource(String wxUserId, String productId) {
        String key = EXPLORATION_MARK_PREFIX + wxUserId + ":" + productId;
        try {
            return redisTemplate.opsForValue().get(key);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 处理探索商品的用户反馈
     * 当用户对探索商品产生行为时调用
     */
    public void handleExplorationFeedback(String wxUserId, String productId, boolean isPositive) {
        String category = getExplorationSource(wxUserId, productId);
        if (category != null) {
            updateCategoryReward(category, isPositive);
            log.info("处理探索反馈: wxUserId={}, productId={}, category={}, positive={}",
                    wxUserId, productId, category, isPositive);
        }
    }

    /**
     * 从 Beta 分布采样
     * 使用 Gamma 分布的性质: Beta(α,β) = Gamma(α,1) / (Gamma(α,1) + Gamma(β,1))
     */
    private double sampleFromBeta(double alpha, double beta) {
        // P0修复: 确保参数至少为1，防止edge case
        alpha = Math.max(alpha, 1.0);
        beta = Math.max(beta, 1.0);

        double x = sampleGamma(alpha);
        double y = sampleGamma(beta);

        // P0修复: 防止除零（当x和y都极小时）
        double sum = x + y;
        if (sum < 1e-10) {
            return 0.5;  // 返回均匀分布的期望值
        }
        return x / sum;
    }

    /**
     * 从 Gamma 分布采样 (Marsaglia and Tsang's method)
     * P2修复: 添加边界保护，防止 shape <= 0 导致的数学错误
     */
    private double sampleGamma(double shape) {
        // P2修复: 确保 shape 至少为极小正数，防止除零和无穷大
        if (shape <= 0.01) {
            shape = 0.01;
        }

        if (shape < 1) {
            // P2修复: 当 shape 很小时，避免 1/shape 过大导致溢出
            double invShape = 1.0 / shape;
            if (invShape > 100) {
                invShape = 100;  // 限制指数大小
            }
            double base = random.nextDouble();
            if (base < 1e-10) {
                base = 1e-10;  // 防止 base^invShape 过小
            }
            return sampleGamma(1 + shape) * Math.pow(base, invShape);
        }

        double d = shape - 1.0 / 3.0;
        double c = 1.0 / Math.sqrt(9.0 * d);

        // P2修复: 添加最大迭代次数，防止极端情况下的无限循环
        int maxIterations = 1000;
        for (int i = 0; i < maxIterations; i++) {
            double x, v;
            do {
                x = random.nextGaussian();
                v = 1.0 + c * x;
            } while (v <= 0);

            v = v * v * v;
            double u = random.nextDouble();

            if (u < 1 - 0.0331 * x * x * x * x ||
                    Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
                return d * v;
            }
        }

        // P2修复: 如果达到最大迭代次数，返回期望值
        log.warn("Gamma采样达到最大迭代次数, shape={}", shape);
        return shape;  // Gamma分布的期望值
    }

    /**
     * 获取所有活跃分类（有上架商品的分类）
     */
    private List<String> getAllActiveCategories() {
        // 使用缓存
        String cacheKey = "ts:active_categories";
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return Arrays.asList(cached.split(","));
            }
        } catch (Exception e) {
            // ignore
        }

        // 查询数据库
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

    /**
     * 获取分类的预期点击率 (用于调试/监控)
     * P2修复: 添加除零保护
     */
    public Map<String, Double> getCategoryExpectedCTRs() {
        Map<String, Double> result = new HashMap<>();
        List<String> categories = getAllActiveCategories();

        for (String category : categories) {
            double[] params = getCategoryBetaParams(category);
            double sum = params[0] + params[1];
            // P2修复: 防止除零
            double expectedCTR = sum > 0 ? params[0] / sum : 0.5;
            result.put(category, expectedCTR);
        }

        return result;
    }
}
