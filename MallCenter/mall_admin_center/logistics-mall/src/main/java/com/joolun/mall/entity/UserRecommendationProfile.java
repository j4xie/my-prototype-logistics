package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 用户推荐画像表
 * 聚合的用户画像，用于快速推荐计算
 */
@Data
@TableName("user_recommendation_profiles")
@EqualsAndHashCode(callSuper = true)
public class UserRecommendationProfile extends Model<UserRecommendationProfile> {
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
     * 画像状态: cold_start/warming/mature/inactive
     */
    private String profileStatus;

    /**
     * 总行为数
     */
    private Integer behaviorCount;

    /**
     * 购买次数
     */
    private Integer purchaseCount;

    /**
     * 品类偏好 (JSON: {"肉类": 0.8, "海鲜": 0.6})
     */
    private String categoryPreferences;

    /**
     * 价格偏好 (JSON: {"range": "medium", "avg": 150, "max": 500})
     */
    private String pricePreferences;

    /**
     * 品牌偏好 (JSON: {"科尔沁": 0.9, "恒都": 0.7})
     */
    private String brandPreferences;

    /**
     * 特性偏好 (JSON: {"organic": 0.8, "imported": 0.5})
     */
    private String featurePreferences;

    /**
     * 活跃时段 (JSON: {"morning": 0.3, "afternoon": 0.5, "evening": 0.7})
     */
    private String activeHours;

    /**
     * 浏览模式 (JSON: {"avg_duration": 30, "avg_products": 5})
     */
    private String browsePattern;

    /**
     * 购买模式 (JSON: {"frequency": "weekly", "avg_amount": 300})
     */
    private String purchasePattern;

    /**
     * 最后推荐时间
     */
    private LocalDateTime lastRecommendationTime;

    /**
     * 推荐点击率
     */
    private BigDecimal recommendationClickRate;

    /**
     * 推荐转化率
     */
    private BigDecimal recommendationConvertRate;

    /**
     * 冷启动策略: popular/category_based/similar_user
     */
    private String coldStartStrategy;

    /**
     * 冷启动是否已完成 (用户已选择初始偏好)
     * 只有首次使用时弹出冷启动弹窗，完成后不再显示
     */
    private Boolean coldStartCompleted;

    /**
     * 冷启动完成时间
     */
    private LocalDateTime coldStartCompletedTime;

    /**
     * 首次访问时间
     */
    private LocalDateTime firstVisitTime;

    /**
     * 最后活跃时间
     */
    private LocalDateTime lastActiveTime;

    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
