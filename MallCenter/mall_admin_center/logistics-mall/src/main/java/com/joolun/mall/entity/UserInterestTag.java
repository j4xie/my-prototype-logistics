package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 用户兴趣标签表
 * AI分析后的用户兴趣标签，用于个性化推荐
 */
@Data
@TableName("user_interest_tags")
@EqualsAndHashCode(callSuper = true)
public class UserInterestTag extends Model<UserInterestTag> {
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
     * 标签类型: category/brand/price_range/feature/keyword
     */
    private String tagType;

    /**
     * 标签值 (如: 肉类、进口、高端)
     */
    private String tagValue;

    /**
     * 标签层级 (一级/二级/三级分类)
     */
    private Integer tagLevel;

    /**
     * 兴趣权重 (0.0001-1.0000)
     */
    private BigDecimal weight;

    /**
     * AI分析置信度 (0.0001-1.0000)
     */
    private BigDecimal confidence;

    /**
     * 来源: behavior/ai_analysis/manual
     */
    private String source;

    /**
     * 相关行为次数
     */
    private Integer interactionCount;

    /**
     * 最后交互时间
     */
    private LocalDateTime lastInteractionTime;

    /**
     * 时间衰减因子
     */
    private BigDecimal decayFactor;

    /**
     * 有效权重 (计算字段: weight * decayFactor)
     */
    @TableField(exist = false)
    private BigDecimal effectiveWeight;

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
