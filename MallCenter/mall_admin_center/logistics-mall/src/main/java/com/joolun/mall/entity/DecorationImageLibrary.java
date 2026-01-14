package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 装修图片库实体
 */
@Data
@TableName("decoration_image_library")
@EqualsAndHashCode(callSuper = true)
public class DecorationImageLibrary extends Model<DecorationImageLibrary> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 图片名称
     */
    private String name;

    /**
     * 图片URL
     */
    private String imageUrl;

    /**
     * 缩略图URL
     */
    private String thumbnailUrl;

    /**
     * 图片类型: banner/product/background/icon
     */
    private String imageType;

    /**
     * 行业类型: food/clothing/electronics等
     */
    private String industryType;

    /**
     * 风格类型: modern/minimalist/luxury等
     */
    private String styleType;

    /**
     * 图片宽度
     */
    private Integer width;

    /**
     * 图片高度
     */
    private Integer height;

    /**
     * 文件大小(KB)
     */
    private Integer fileSize;

    /**
     * 标签，逗号分隔
     */
    private String tags;

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
