package com.joolun.mall.service.impl;

import com.joolun.mall.config.StrategyInterventionConfig;
import com.joolun.mall.entity.Coupon;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.entity.ProductFeatureTag;
import com.joolun.mall.mapper.CouponMapper;
import com.joolun.mall.mapper.MerchantMapper;
import com.joolun.mall.mapper.ProductFeatureTagMapper;
import com.joolun.mall.service.StrategyInterventionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 策略干预服务实现
 * 基于抖音推荐系统"商业与生态博弈"设计
 *
 * 支持的策略:
 * 1. 新商家扶持 - 入驻30天内加权
 * 2. 新品推广 - 上架7天内加权
 * 3. 促销加权 - 打折或有优惠券
 * 4. 库存调控 - 高库存加权，低库存降权
 * 5. 高毛利加权 - 利润率高的商品
 * 6. 溯源完整度 - 有完整溯源的商品
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StrategyInterventionServiceImpl implements StrategyInterventionService {

    private final StrategyInterventionConfig config;
    private final MerchantMapper merchantMapper;
    private final CouponMapper couponMapper;
    private final ProductFeatureTagMapper productFeatureTagMapper;
    private final StringRedisTemplate redisTemplate;

    private static final String MERCHANT_CACHE_PREFIX = "strategy:merchant:";
    private static final String PROMOTION_CACHE_PREFIX = "strategy:promotion:";
    private static final long CACHE_TTL_MINUTES = 60;

    @Override
    public double calculateStrategyBoost(GoodsSpu product) {
        return calculateStrategyBoost(product, new HashMap<>());
    }

    @Override
    public double calculateStrategyBoost(GoodsSpu product, Map<Long, Merchant> merchantCache) {
        if (!config.isEnabled() || product == null) {
            return 0.0;
        }

        double totalBoost = 0.0;

        try {
            // 1. 新商家扶持
            totalBoost += calculateNewMerchantBoost(product, merchantCache);

            // 2. 高评分商家加权
            totalBoost += calculateHighRatingMerchantBoost(product, merchantCache);

            // 3. 新品推广
            totalBoost += calculateNewProductBoost(product);

            // 4. 促销加权
            totalBoost += calculatePromotionBoost(product);

            // 5. 库存调控
            totalBoost += calculateInventoryBoost(product);

            // 6. 高毛利加权
            totalBoost += calculateMarginBoost(product);

            // 7. 溯源完整度
            totalBoost += calculateTraceabilityBoost(product);

            log.debug("商品 {} 策略干预总分: {}", product.getId(), totalBoost);
        } catch (Exception e) {
            log.warn("计算策略干预分数失败: productId={}, error={}", product.getId(), e.getMessage());
        }

        return totalBoost;
    }

    @Override
    public Map<String, Double> calculateStrategyBoosts(List<GoodsSpu> products) {
        if (products == null || products.isEmpty()) {
            return Collections.emptyMap();
        }

        // 批量查询商家信息
        Set<Long> merchantIds = products.stream()
                .map(GoodsSpu::getMerchantId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<Long, Merchant> merchantCache = new HashMap<>();
        if (!merchantIds.isEmpty()) {
            List<Merchant> merchants = merchantMapper.selectBatchIds(merchantIds);
            for (Merchant m : merchants) {
                merchantCache.put(m.getId(), m);
            }
        }

        // 计算每个商品的策略加分
        Map<String, Double> boosts = new HashMap<>();
        for (GoodsSpu product : products) {
            boosts.put(product.getId(), calculateStrategyBoost(product, merchantCache));
        }

        return boosts;
    }

    @Override
    public List<GoodsSpu> applyStrategyReranking(List<GoodsSpu> products, Map<String, Double> baseScores) {
        if (products == null || products.isEmpty()) {
            return products;
        }

        // 计算策略加分
        Map<String, Double> strategyBoosts = calculateStrategyBoosts(products);

        // 组合基础分和策略加分
        List<ScoredProduct> scoredProducts = products.stream()
                .map(p -> {
                    double base = baseScores.getOrDefault(p.getId(), 0.0);
                    double strategy = strategyBoosts.getOrDefault(p.getId(), 0.0);
                    return new ScoredProduct(p, base + strategy);
                })
                .sorted((a, b) -> Double.compare(b.score, a.score))
                .collect(Collectors.toList());

        log.info("策略重排序完成: {} 件商品", products.size());

        return scoredProducts.stream()
                .map(sp -> sp.product)
                .collect(Collectors.toList());
    }

    @Override
    public Map<String, Double> getStrategyBreakdown(GoodsSpu product) {
        Map<String, Double> breakdown = new LinkedHashMap<>();
        Map<Long, Merchant> merchantCache = new HashMap<>();

        if (product.getMerchantId() != null) {
            Merchant merchant = merchantMapper.selectById(product.getMerchantId());
            if (merchant != null) {
                merchantCache.put(merchant.getId(), merchant);
            }
        }

        breakdown.put("newMerchant", calculateNewMerchantBoost(product, merchantCache));
        breakdown.put("highRatingMerchant", calculateHighRatingMerchantBoost(product, merchantCache));
        breakdown.put("newProduct", calculateNewProductBoost(product));
        breakdown.put("promotion", calculatePromotionBoost(product));
        breakdown.put("inventory", calculateInventoryBoost(product));
        breakdown.put("margin", calculateMarginBoost(product));
        breakdown.put("traceability", calculateTraceabilityBoost(product));

        double total = breakdown.values().stream().mapToDouble(Double::doubleValue).sum();
        breakdown.put("total", total);

        return breakdown;
    }

    @Override
    public boolean hasActivePromotion(GoodsSpu product) {
        // 1. 检查价格折扣
        if (hasPriceDiscount(product)) {
            return true;
        }

        // 2. 检查是否有关联优惠券
        return hasActiveCoupon(product);
    }

    @Override
    public double getTraceabilityScore(String productId) {
        // 查询商品的溯源标签
        List<ProductFeatureTag> tags = productFeatureTagMapper.selectByProductIdAndType(productId, "traceability");

        if (tags == null || tags.isEmpty()) {
            return 0.0;
        }

        // 计算溯源完整度 (基于标签数量和权重)
        double totalWeight = 0.0;
        for (ProductFeatureTag tag : tags) {
            if (tag.getWeight() != null) {
                totalWeight += tag.getWeight().doubleValue();
            }
        }

        // 归一化到 0-1
        return Math.min(1.0, totalWeight);
    }

    // ==================== 私有方法 ====================

    /**
     * 从缓存获取商家信息 (提取的公共方法)
     */
    private Merchant getMerchantFromCache(Long merchantId, Map<Long, Merchant> merchantCache) {
        if (merchantId == null) return null;
        Merchant merchant = merchantCache.get(merchantId);
        if (merchant == null) {
            merchant = getMerchantFromCacheOrDb(merchantId);
            if (merchant != null) {
                merchantCache.put(merchant.getId(), merchant);
            }
        }
        return merchant;
    }

    /**
     * 计算新商家扶持加分
     */
    private double calculateNewMerchantBoost(GoodsSpu product, Map<Long, Merchant> merchantCache) {
        Merchant merchant = getMerchantFromCache(product.getMerchantId(), merchantCache);
        if (merchant == null || merchant.getCreateTime() == null) {
            return 0.0;
        }

        long daysSinceCreation = ChronoUnit.DAYS.between(merchant.getCreateTime(), LocalDateTime.now());
        if (daysSinceCreation <= config.getNewMerchantDays()) {
            // 线性衰减: 第1天加满分，第30天加0分
            double decayFactor = 1.0 - (double) daysSinceCreation / config.getNewMerchantDays();
            return config.getNewMerchantWeight() * decayFactor;
        }

        return 0.0;
    }

    /**
     * 计算高评分商家加权
     */
    private double calculateHighRatingMerchantBoost(GoodsSpu product, Map<Long, Merchant> merchantCache) {
        Merchant merchant = getMerchantFromCache(product.getMerchantId(), merchantCache);
        if (merchant == null || merchant.getRating() == null) {
            return 0.0;
        }

        double rating = merchant.getRating().doubleValue();
        if (rating >= config.getHighRatingThreshold()) {
            // 评分越高，加分越多 (4.5分加0分，5分加满分)
            double ratingBonus = (rating - config.getHighRatingThreshold()) / (5.0 - config.getHighRatingThreshold());
            return config.getHighRatingMerchantWeight() * ratingBonus;
        }

        return 0.0;
    }

    /**
     * 计算新品推广加分
     */
    private double calculateNewProductBoost(GoodsSpu product) {
        if (product.getCreateTime() == null) {
            return 0.0;
        }

        long daysSinceCreation = ChronoUnit.DAYS.between(product.getCreateTime(), LocalDateTime.now());
        if (daysSinceCreation <= config.getNewProductDays()) {
            // 线性衰减: 第1天加满分，第7天加0分
            double decayFactor = 1.0 - (double) daysSinceCreation / config.getNewProductDays();
            return config.getNewProductWeight() * decayFactor;
        }

        return 0.0;
    }

    /**
     * 计算促销加权
     */
    private double calculatePromotionBoost(GoodsSpu product) {
        if (hasActivePromotion(product)) {
            // 计算折扣力度，折扣越大加分越多
            double discountRate = calculateDiscountRate(product);
            if (discountRate < config.getPromotionDiscountThreshold()) {
                double discountBonus = (config.getPromotionDiscountThreshold() - discountRate) /
                        config.getPromotionDiscountThreshold();
                return config.getPromotionWeight() * (0.5 + 0.5 * discountBonus);
            }
            return config.getPromotionWeight() * 0.5; // 基础促销加分
        }
        return 0.0;
    }

    /**
     * 计算库存调控加分
     */
    private double calculateInventoryBoost(GoodsSpu product) {
        if (product.getStock() == null) {
            return 0.0;
        }

        int stock = product.getStock();

        // 低库存降权
        if (stock < config.getLowInventoryThreshold()) {
            return config.getLowInventoryPenalty();
        }

        // 高库存加权
        if (stock > config.getHighInventoryThreshold()) {
            // 库存越高加分越多，但有上限
            double stockBonus = Math.min(1.0, (double) stock / (config.getHighInventoryThreshold() * 5));
            return config.getInventoryWeight() * stockBonus;
        }

        return 0.0;
    }

    /**
     * 计算高毛利加权
     */
    private double calculateMarginBoost(GoodsSpu product) {
        if (product.getSalesPrice() == null || product.getCostPrice() == null) {
            return 0.0;
        }

        double salesPrice = product.getSalesPrice().doubleValue();
        double costPrice = product.getCostPrice().doubleValue();

        if (salesPrice <= 0) {
            return 0.0;
        }

        double marginRate = (salesPrice - costPrice) / salesPrice;
        if (marginRate > config.getHighMarginThreshold()) {
            // 毛利率越高加分越多
            double marginBonus = Math.min(1.0, (marginRate - config.getHighMarginThreshold()) /
                    (1.0 - config.getHighMarginThreshold()));
            return config.getHighMarginWeight() * marginBonus;
        }

        return 0.0;
    }

    /**
     * 计算溯源完整度加分
     */
    private double calculateTraceabilityBoost(GoodsSpu product) {
        double traceabilityScore = getTraceabilityScore(product.getId());
        return config.getTraceabilityWeight() * traceabilityScore;
    }

    /**
     * 检查是否有价格折扣
     */
    private boolean hasPriceDiscount(GoodsSpu product) {
        if (product.getMarketPrice() == null || product.getSalesPrice() == null) {
            return false;
        }
        return product.getSalesPrice().compareTo(product.getMarketPrice()) < 0;
    }

    /**
     * 检查是否有活跃优惠券
     */
    private boolean hasActiveCoupon(GoodsSpu product) {
        String cacheKey = PROMOTION_CACHE_PREFIX + product.getId();

        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return "1".equals(cached);
            }

            // 查询适用于该商品的优惠券
            List<Coupon> coupons = couponMapper.selectActiveByProductId(product.getId());
            boolean hasCoupon = coupons != null && !coupons.isEmpty();

            // 缓存结果
            redisTemplate.opsForValue().set(cacheKey, hasCoupon ? "1" : "0",
                    CACHE_TTL_MINUTES, TimeUnit.MINUTES);

            return hasCoupon;
        } catch (Exception e) {
            log.warn("检查优惠券失败: productId={}", product.getId(), e);
            return false;
        }
    }

    /**
     * 计算折扣率
     */
    private double calculateDiscountRate(GoodsSpu product) {
        if (product.getMarketPrice() == null || product.getSalesPrice() == null) {
            return 1.0;
        }

        double marketPrice = product.getMarketPrice().doubleValue();
        double salesPrice = product.getSalesPrice().doubleValue();

        if (marketPrice <= 0) {
            return 1.0;
        }

        return salesPrice / marketPrice;
    }

    /**
     * 从缓存或数据库获取商家信息
     */
    private Merchant getMerchantFromCacheOrDb(Long merchantId) {
        String cacheKey = MERCHANT_CACHE_PREFIX + merchantId;

        try {
            // 这里简化处理，实际应该从Redis缓存读取完整Merchant对象
            // 直接查询数据库
            return merchantMapper.selectById(merchantId);
        } catch (Exception e) {
            log.warn("获取商家信息失败: merchantId={}", merchantId, e);
            return null;
        }
    }

    /**
     * 带得分的商品封装
     */
    private static class ScoredProduct {
        GoodsSpu product;
        double score;

        ScoredProduct(GoodsSpu product, double score) {
            this.product = product;
            this.score = score;
        }
    }
}
