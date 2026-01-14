package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 装修图片Prompt模板实体
 * 用于AI图片生成的预置prompt模板
 */
@Data
@TableName("decoration_prompt_template")
@EqualsAndHashCode(callSuper = true)
public class DecorationPromptTemplate extends Model<DecorationPromptTemplate> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 模板名称
     */
    private String name;

    /**
     * 模板编码（唯一标识）
     * 格式: {industry}_{imageType} 如 fresh_food_banner
     */
    private String code;

    /**
     * 行业类型: fresh_food/seafood/dessert/gift/baby/tech/beauty/general
     */
    private String industryType;

    /**
     * 图片类型: banner/background/icon/product
     */
    private String imageType;

    /**
     * 风格类型: fresh/luxury/minimal/dopamine/warm
     */
    private String styleType;

    /**
     * 基础prompt模板
     * 支持变量替换: {product}, {style}, {color_tone}, {size}
     */
    private String basePrompt;

    /**
     * 变量定义JSON
     * 定义模板中可替换的变量及其默认值
     * 例如: {"product": "水果蔬菜", "style": "清新", "color_tone": "绿色"}
     */
    private String variablesDef;

    /**
     * 负向提示词
     * 用于排除不想要的元素
     */
    private String negativePrompt;

    /**
     * 推荐尺寸
     * 格式: 宽x高，如 750*300
     */
    private String recommendedSize;

    /**
     * 示例图片URL
     */
    private String exampleImage;

    /**
     * 使用次数
     */
    private Integer useCount;

    /**
     * 状态：0禁用 1启用
     */
    private Integer status;

    /**
     * 排序
     */
    private Integer sortOrder;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;
}
