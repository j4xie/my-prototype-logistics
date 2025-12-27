package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.mapper.GoodsSpuMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 实时触发加成服务 (Trigger Interest Booster)
 *
 * 借鉴淘宝三塔模型的 Trigger Tower 设计:
 * - 当用户刚浏览/加购某商品后，相似商品获得临时加成
 * - 5分钟内有效，实现"即时兴趣强化"
 *
 * 加成规则:
 * - 同分类商品: +0.3 分
 * - 相近价格区间: +0.1 分
 * - 时间衰减: 5分钟内线性衰减
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TriggerInterestBooster {

    private final StringRedisTemplate redisTemplate;
    private final GoodsSpuMapper goodsSpuMapper;

    // Redis 缓存前缀
    private static final String TRIGGER_CACHE_PREFIX = "trigger:interest:";

    // 触发缓存有效期（分钟）
    private static final long TRIGGER_TTL_MINUTES = 5;

    // 加成权重
    private static final double CATEGORY_BOOST = 0.3;      // 同分类加成
    private static final double PRICE_RANGE_BOOST = 0.1;   // 价格区间加成
    private static final double VIEW_TRIGGER_WEIGHT = 1.0;  // 浏览触发权重
    private static final double CART_TRIGGER_WEIGHT = 1.5;  // 加购触发权重（更强）
    private static final double PURCHASE_TRIGGER_WEIGHT = 2.0;  // 购买触发权重（最强）

    /**
     * 记录触发事件（用户浏览商品时调用）
     */
    public void recordViewTrigger(String wxUserId, GoodsSpu product) {
        recordTrigger(wxUserId, product, "view", VIEW_TRIGGER_WEIGHT);
    }

    /**
     * 记录触发事件（用户加购时调用）
     */
    public void recordCartTrigger(String wxUserId, GoodsSpu product) {
        recordTrigger(wxUserId, product, "cart", CART_TRIGGER_WEIGHT);
    }

    /**
     * 记录触发事件（用户购买时调用）
     */
    public void recordPurchaseTrigger(String wxUserId, GoodsSpu product) {
        recordTrigger(wxUserId, product, "purchase", PURCHASE_TRIGGER_WEIGHT);
    }

    /**
     * 记录触发事件
     */
    private void recordTrigger(String wxUserId, GoodsSpu product, String triggerType, double weight) {
        if (product == null || wxUserId == null) {
            return;
        }

        String key = TRIGGER_CACHE_PREFIX + wxUserId;

        try {
            // 构建触发数据
            Map<String, String> triggerData = new HashMap<>();
            triggerData.put("productId", product.getId());
            triggerData.put("category", product.getCategoryFirst() != null ? product.getCategoryFirst() : "");
            triggerData.put("priceRange", getPriceRange(product.getSalesPrice()));
            triggerData.put("triggerType", triggerType);
            triggerData.put("weight", String.valueOf(weight));
            triggerData.put("timestamp", String.valueOf(System.currentTimeMillis()));

            // 存储到 Redis Hash
            redisTemplate.opsForHash().putAll(key, triggerData);
            redisTemplate.expire(key, TRIGGER_TTL_MINUTES, TimeUnit.MINUTES);

            log.debug("记录触发事件: wxUserId={}, productId={}, type={}, category={}",
                    wxUserId, product.getId(), triggerType, product.getCategoryFirst());

        } catch (Exception e) {
            log.warn("记录触发事件失败", e);
        }
    }

    /**
     * 计算候选商品的触发加成分数
     *
     * @param wxUserId 用户ID
     * @param candidate 候选商品
     * @return 加成分数（0.0 - 1.0）
     */
    public double calculateTriggerBoost(String wxUserId, GoodsSpu candidate) {
        String key = TRIGGER_CACHE_PREFIX + wxUserId;

        try {
            Map<Object, Object> triggerData = redisTemplate.opsForHash().entries(key);
            if (triggerData.isEmpty()) {
                return 0.0;
            }

            double boost = 0.0;

            // 同分类加成
            String triggerCategory = (String) triggerData.get("category");
            if (triggerCategory != null && !triggerCategory.isEmpty() &&
                    triggerCategory.equals(candidate.getCategoryFirst())) {
                boost += CATEGORY_BOOST;
            }

            // 相近价格区间加成
            String triggerPriceRange = (String) triggerData.get("priceRange");
            String candidatePriceRange = getPriceRange(candidate.getSalesPrice());
            if (triggerPriceRange != null && triggerPriceRange.equals(candidatePriceRange)) {
                boost += PRICE_RANGE_BOOST;
            }

            // 获取触发权重
            String weightStr = (String) triggerData.get("weight");
            double triggerWeight = weightStr != null ? Double.parseDouble(weightStr) : 1.0;

            // 时间衰减（5分钟内线性衰减）
            String timestampStr = (String) triggerData.get("timestamp");
            double timeDecay = 1.0;
            if (timestampStr != null) {
                long timestamp = Long.parseLong(timestampStr);
                long age = System.currentTimeMillis() - timestamp;
                long maxAge = TRIGGER_TTL_MINUTES * 60 * 1000;
                timeDecay = Math.max(0, 1.0 - (double) age / maxAge);
            }

            // 最终加成 = 基础加成 * 触发权重 * 时间衰减
            double finalBoost = boost * triggerWeight * timeDecay;

            if (finalBoost > 0) {
                log.debug("触发加成计算: candidateId={}, category={}, priceRange={}, boost={}, timeDecay={}, finalBoost={}",
                        candidate.getId(),
                        triggerCategory != null && triggerCategory.equals(candidate.getCategoryFirst()),
                        triggerPriceRange != null && triggerPriceRange.equals(candidatePriceRange),
                        boost, timeDecay, finalBoost);
            }

            return finalBoost;

        } catch (Exception e) {
            log.warn("计算触发加成失败", e);
            return 0.0;
        }
    }

    /**
     * 获取当前触发信息（用于调试）
     */
    public Map<String, String> getCurrentTrigger(String wxUserId) {
        String key = TRIGGER_CACHE_PREFIX + wxUserId;
        try {
            Map<Object, Object> data = redisTemplate.opsForHash().entries(key);
            Map<String, String> result = new HashMap<>();
            for (Map.Entry<Object, Object> entry : data.entrySet()) {
                result.put(entry.getKey().toString(), entry.getValue().toString());
            }
            return result;
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    /**
     * 清除触发缓存（用户登出或手动清除时调用）
     */
    public void clearTrigger(String wxUserId) {
        String key = TRIGGER_CACHE_PREFIX + wxUserId;
        try {
            redisTemplate.delete(key);
        } catch (Exception e) {
            log.warn("清除触发缓存失败", e);
        }
    }

    /**
     * 检查是否有活跃触发
     */
    public boolean hasActiveTrigger(String wxUserId) {
        String key = TRIGGER_CACHE_PREFIX + wxUserId;
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(key));
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 根据商品ID记录触发（便捷方法）
     */
    public void recordViewTriggerById(String wxUserId, String productId) {
        GoodsSpu product = goodsSpuMapper.selectById(productId);
        if (product != null) {
            recordViewTrigger(wxUserId, product);
        }
    }

    /**
     * 根据商品ID记录加购触发（便捷方法）
     */
    public void recordCartTriggerById(String wxUserId, String productId) {
        GoodsSpu product = goodsSpuMapper.selectById(productId);
        if (product != null) {
            recordCartTrigger(wxUserId, product);
        }
    }

    /**
     * 获取价格区间
     */
    private String getPriceRange(BigDecimal price) {
        if (price == null) {
            return "未知";
        }
        double p = price.doubleValue();
        if (p < 50) return "低价";
        if (p < 150) return "中低价";
        if (p < 300) return "中等";
        if (p < 500) return "中高价";
        return "高价";
    }
}
