package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 主题预设实体
 */
@Data
@TableName("decoration_theme_preset")
@EqualsAndHashCode(callSuper = true)
public class DecorationThemePreset extends Model<DecorationThemePreset> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 预设名称
     */
    private String name;

    /**
     * 预设编码
     */
    private String code;

    /**
     * 预设描述
     */
    private String description;

    /**
     * 缩略图URL (映射 preview_image)
     */
    @TableField("preview_image")
    private String thumbnail;

    /**
     * 颜色配置 JSON
     */
    private String colorConfig;

    /**
     * 风格标签，逗号分隔
     */
    private String styleTags;

    /**
     * 行业标签，逗号分隔
     */
    private String industryTags;

    /**
     * 宣传语
     */
    private String slogan;

    /**
     * 推荐模块配置 JSON
     */
    private String recommendedModules;

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
