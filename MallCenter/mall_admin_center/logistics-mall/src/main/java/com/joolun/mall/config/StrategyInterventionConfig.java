package com.joolun.mall.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 推荐策略干预配置
 * 基于抖音推荐系统"商业与生态博弈"设计
 *
 * FinalScore = BaseScore + sum(w_i × StrategyBoost_i)
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "mall.recommend.strategy")
public class StrategyInterventionConfig {

    /**
     * 是否启用策略干预
     */
    private boolean enabled = true;

    // ==================== 商家策略 ====================

    /**
     * 新商家扶持权重 (入驻30天内)
     * 给新入驻商家额外曝光机会
     */
    private double newMerchantWeight = 0.10;

    /**
     * 新商家判定天数
     */
    private int newMerchantDays = 30;

    /**
     * 高评分商家加权 (评分>4.5)
     */
    private double highRatingMerchantWeight = 0.05;

    /**
     * 高评分阈值
     */
    private double highRatingThreshold = 4.5;

    // ==================== 商品策略 ====================

    /**
     * 新品推广权重 (上架7天内)
     * 新上架商品额外加分
     */
    private double newProductWeight = 0.15;

    /**
     * 新品判定天数
     */
    private int newProductDays = 7;

    /**
     * 促销商品加权 (有折扣或优惠券)
     * marketPrice > salesPrice 或 有关联优惠券
     */
    private double promotionWeight = 0.10;

    /**
     * 促销折扣阈值 (低于此折扣率才加权)
     * 0.85 表示 85折 及以下
     */
    private double promotionDiscountThreshold = 0.85;

    /**
     * 库存消化加权 (库存充足的商品)
     * 防止库存积压，适当推荐库存多的商品
     */
    private double inventoryWeight = 0.05;

    /**
     * 高库存阈值
     */
    private int highInventoryThreshold = 100;

    /**
     * 低库存降权 (库存<10)
     * 避免推荐即将断货的商品
     */
    private double lowInventoryPenalty = -0.10;

    /**
     * 低库存阈值
     */
    private int lowInventoryThreshold = 10;

    // ==================== 利润策略 ====================

    /**
     * 高毛利商品加权
     * (salesPrice - costPrice) / salesPrice > threshold
     */
    private double highMarginWeight = 0.05;

    /**
     * 高毛利阈值 (毛利率)
     */
    private double highMarginThreshold = 0.30;

    // ==================== 溯源策略 ====================

    /**
     * 溯源完整度加权
     * 有完整生产溯源信息的商品加分
     * (此功能需要产品溯源标签支持)
     */
    private double traceabilityWeight = 0.10;

    // ==================== 时效策略 ====================

    /**
     * 季节性商品加权
     * 当前季节的应季商品加分
     */
    private double seasonalWeight = 0.05;

    /**
     * 即将过期商品降权
     * 保质期即将到期的商品降权 (需要expirationDate字段)
     */
    private double expiringPenalty = -0.15;

    /**
     * 即将过期天数阈值
     */
    private int expiringDays = 7;

    // ==================== 多样性策略 ====================

    /**
     * MMR多样性系数 (0-1)
     * λ = 0.55 表示 55%看分数，45%看多样性
     * 降低lambda以增强商户多样性
     */
    private double mmrLambda = 0.55;

    /**
     * 同分类相似度
     */
    private double sameCategorySimilarity = 0.5;

    /**
     * 同商家相似度
     * 提高到0.5以增强商户多样性惩罚
     */
    private double sameMerchantSimilarity = 0.5;

    /**
     * 单商户最大占比 (0-1)
     * 推荐结果中单个商户商品不超过此比例
     */
    private double maxMerchantRatio = 0.20;

    /**
     * 相近价格相似度 (价格差<20%)
     */
    private double similarPriceSimilarity = 0.3;

    /**
     * 相近价格阈值 (百分比)
     */
    private double similarPriceThreshold = 0.20;
}
