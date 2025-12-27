package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 商品特征标签表
 * 用于内容推荐匹配
 */
@Data
@TableName("product_feature_tags")
@EqualsAndHashCode(callSuper = true)
public class ProductFeatureTag extends Model<ProductFeatureTag> {
    private static final long serialVersionUID = 1L;

    /**
     * 主键ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 商品ID (goods_spu.id)
     */
    private String productId;

    /**
     * 标签类型: category/brand/feature/price_level/quality
     */
    private String tagType;

    /**
     * 标签值
     */
    private String tagValue;

    /**
     * 标签权重
     */
    private BigDecimal weight;

    /**
     * 来源: system/ai/manual
     */
    private String source;

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
