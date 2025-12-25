package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 推荐记录表 - 对齐 V4.0 SQL: referral
 */
@Data
@TableName("referral")
@EqualsAndHashCode(callSuper = true)
public class Referral extends Model<Referral> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 推荐码
     */
    @TableField("referral_code")
    private String referralCode;

    /**
     * 推荐人用户ID
     */
    @TableField("referrer_id")
    private Long referrerId;

    /**
     * 推荐人名称
     */
    @TableField("referrer_name")
    private String referrerName;

    /**
     * 被推荐人用户ID
     */
    @TableField("referee_id")
    private Long refereeId;

    /**
     * 被推荐人名称
     */
    @TableField("referee_name")
    private String refereeName;

    /**
     * 被推荐人手机号
     */
    @TableField("referee_phone")
    private String refereePhone;

    /**
     * 推荐类型：1新用户注册 2首单购买 3累计消费
     */
    @TableField("referral_type")
    private Integer referralType;

    /**
     * 状态：0待确认 1已确认 2已奖励 3已失效
     */
    private Integer status;

    /**
     * 关联订单ID
     */
    @TableField("order_id")
    private Long orderId;

    /**
     * 订单金额
     */
    @TableField("order_amount")
    private BigDecimal orderAmount;

    /**
     * 奖励金额
     */
    @TableField("reward_amount")
    private BigDecimal rewardAmount;

    /**
     * 奖励类型：1现金 2积分 3优惠券
     */
    @TableField("reward_type")
    private Integer rewardType;

    /**
     * 奖励发放时间
     */
    @TableField("reward_time")
    private LocalDateTime rewardTime;

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
