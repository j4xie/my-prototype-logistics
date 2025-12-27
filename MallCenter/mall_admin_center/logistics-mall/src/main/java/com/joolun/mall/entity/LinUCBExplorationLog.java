package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * LinUCB 探索日志表
 * 记录每次探索推荐的详细信息，用于算法调试和效果分析
 */
@Data
@TableName("linucb_exploration_logs")
@EqualsAndHashCode(callSuper = true)
public class LinUCBExplorationLog extends Model<LinUCBExplorationLog> {
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
     * 臂ID (分类ID或商品ID)
     */
    private String armId;

    /**
     * 臂类型: category / product
     */
    private String armType;

    /**
     * 上下文特征向量 (JSON格式)
     */
    private String contextVector;

    /**
     * 预期奖励 (x^T * theta)
     */
    private BigDecimal expectedReward;

    /**
     * 探索奖励/不确定性奖励 (alpha * sqrt(x^T * A^{-1} * x))
     */
    private BigDecimal explorationBonus;

    /**
     * 总UCB值 (expectedReward + explorationBonus)
     */
    private BigDecimal totalUcb;

    /**
     * 实际奖励 (用户反馈后更新)
     * 1.0=点击, 0.0=未点击, null=未知
     */
    private BigDecimal actualReward;

    /**
     * 是否点击
     */
    private Boolean isClicked;

    /**
     * 是否购买
     */
    private Boolean isPurchased;

    /**
     * alpha参数值 (探索系数)
     */
    private BigDecimal alphaValue;

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
