package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 装修关键词映射实体
 * 用于将用户输入关键词映射到行业/风格类型，减少AI调用
 */
@Data
@TableName("decoration_keyword_mapping")
@EqualsAndHashCode(callSuper = true)
public class DecorationKeywordMapping extends Model<DecorationKeywordMapping> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 关键词（用户可能输入的词）
     */
    private String keyword;

    /**
     * 映射类型: industry/style/product
     */
    private String mappingType;

    /**
     * 映射值
     * 如果mappingType=industry，值为fresh_food/seafood等
     * 如果mappingType=style，值为fresh/luxury等
     */
    private String mappingValue;

    /**
     * 关联的主题编码（可选）
     */
    private String themeCode;

    /**
     * 匹配权重（用于多关键词匹配时的优先级）
     */
    private Integer weight;

    /**
     * 匹配次数（用于统计和优化）
     */
    private Integer matchCount;

    /**
     * 状态：0禁用 1启用
     */
    private Integer status;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;
}
