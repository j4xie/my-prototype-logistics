package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 推荐奖励配置表 - 对齐 V4.0 SQL: referral_reward_config
 */
@Data
@TableName("referral_reward_config")
@EqualsAndHashCode(callSuper = true)
public class ReferralRewardConfig extends Model<ReferralRewardConfig> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 配置名称
     */
    @TableField("config_name")
    private String configName;

    /**
     * 推荐类型：1新用户注册 2首单购买 3累计消费
     */
    @TableField("referral_type")
    private Integer referralType;

    /**
     * 奖励类型：1现金 2积分 3优惠券
     */
    @TableField("reward_type")
    private Integer rewardType;

    /**
     * 推荐人奖励金额/积分
     */
    @TableField("referrer_reward")
    private BigDecimal referrerReward;

    /**
     * 被推荐人奖励金额/积分
     */
    @TableField("referee_reward")
    private BigDecimal refereeReward;

    /**
     * 关联优惠券ID
     */
    @TableField("coupon_id")
    private Long couponId;

    /**
     * 最低订单金额
     */
    @TableField("min_order_amount")
    private BigDecimal minOrderAmount;

    /**
     * 奖励比例（百分比）
     */
    @TableField("reward_rate")
    private BigDecimal rewardRate;

    /**
     * 最高奖励金额限制
     */
    @TableField("max_reward")
    private BigDecimal maxReward;

    /**
     * 生效开始时间
     */
    @TableField("start_time")
    private LocalDateTime startTime;

    /**
     * 生效结束时间
     */
    @TableField("end_time")
    private LocalDateTime endTime;

    /**
     * 状态：0停用 1启用
     */
    private Integer status;

    /**
     * 优先级
     */
    private Integer priority;

    /**
     * 备注
     */
    private String remark;

    /**
     * 创建时间
     */
    @TableField("create_time")
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @TableField("update_time")
    private LocalDateTime updateTime;

    /**
     * 删除标记
     */
    @TableLogic
    @TableField("del_flag")
    private Integer delFlag;
}
