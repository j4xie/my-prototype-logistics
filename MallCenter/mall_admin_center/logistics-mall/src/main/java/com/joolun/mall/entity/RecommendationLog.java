package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 推荐日志表
 * 记录推荐结果，用于评估和优化推荐算法
 */
@Data
@TableName("recommendation_logs")
@EqualsAndHashCode(callSuper = true)
public class RecommendationLog extends Model<RecommendationLog> {
    private static final long serialVersionUID = 1L;

    /**
     * 主键ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 微信用户ID
     */
    private String wxUserId;

    /**
     * 推荐类型: home_feed/search_result/similar_product/cart_recommend
     */
    private String recommendationType;

    /**
     * 推荐位置
     */
    private Integer recommendationPosition;

    /**
     * 推荐商品ID
     */
    private String productId;

    /**
     * 推荐原因说明
     */
    private String recommendationReason;

    /**
     * 匹配的标签 (JSON: ["肉类", "高端"])
     */
    private String matchTags;

    /**
     * 推荐分数
     */
    private BigDecimal score;

    /**
     * 算法类型: content_based/collaborative/hybrid/popular
     */
    private String algorithmType;

    /**
     * 算法版本
     */
    private String algorithmVersion;

    /**
     * A/B测试分组: linucb/thompson
     * 用于对比两种探索算法的效果
     */
    private String abTestGroup;

    /**
     * 探索算法名称
     * 实际使用的Bandit算法: LinUCB/ThompsonSampling
     */
    private String explorerAlgorithm;

    /**
     * 是否点击
     */
    private Boolean isClicked;

    /**
     * 是否购买
     */
    private Boolean isPurchased;

    /**
     * 反馈时间
     */
    private LocalDateTime feedbackTime;

    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
