package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 字体样式实体
 */
@Data
@TableName("decoration_font_style")
@EqualsAndHashCode(callSuper = true)
public class DecorationFontStyle extends Model<DecorationFontStyle> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 字体名称
     */
    private String name;

    /**
     * 字体编码
     */
    private String code;

    /**
     * 字体族名称
     */
    private String fontFamily;

    /**
     * 字体文件URL
     */
    private String fontUrl;

    /**
     * 使用场景: title/body/button/price
     */
    private String usageType;

    /**
     * 字体粗细
     */
    private String fontWeight;

    /**
     * 默认字体大小(px)
     */
    private Integer fontSize;

    /**
     * 默认行高
     */
    private String lineHeight;

    /**
     * 默认字间距
     */
    private String letterSpacing;

    /**
     * 预览文本
     */
    private String previewText;

    /**
     * 样式配置 JSON
     */
    private String styleConfig;

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
