package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/**
 * 商品阶梯定价
 */
@Data
@TableName("goods_price_tier")
@EqualsAndHashCode(callSuper = true)
public class GoodsPriceTier extends Model<GoodsPriceTier> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 商品SPU ID
     */
    private String spuId;

    /**
     * 最小数量
     */
    private Integer minQuantity;

    /**
     * 最大数量（NULL表示无上限）
     */
    private Integer maxQuantity;

    /**
     * 单价
     */
    private BigDecimal price;

    /**
     * 折扣率%
     */
    private BigDecimal discountRate;

    /**
     * 排序
     */
    private Integer sortOrder;

    /**
     * 创建时间
     */
    private java.time.LocalDateTime createTime;

    /**
     * 更新时间
     */
    private java.time.LocalDateTime updateTime;
}
