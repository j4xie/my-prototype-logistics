package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 布局预设实体
 */
@Data
@TableName("decoration_layout_preset")
@EqualsAndHashCode(callSuper = true)
public class DecorationLayoutPreset extends Model<DecorationLayoutPreset> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 布局名称
     */
    private String name;

    /**
     * 布局编码
     */
    private String code;

    /**
     * 布局描述
     */
    private String description;

    /**
     * 预览图URL
     */
    private String previewImage;

    /**
     * 布局配置 JSON (模块排列)
     */
    private String layoutConfig;

    /**
     * 包含的模块类型，逗号分隔
     */
    private String moduleTypes;

    /**
     * 行业类型: food/clothing/electronics等
     */
    private String industryType;

    /**
     * 风格类型: modern/minimalist/luxury等
     */
    private String styleType;

    /**
     * 适用页面类型: home/category/product等
     */
    private String pageType;

    /**
     * 状态：0禁用 1启用
     */
    private Integer status;

    /**
     * 排序
     */
    private Integer sortOrder;

    /**
     * 使用次数
     */
    private Integer useCount;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;
}
