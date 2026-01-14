package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 装修模板实体
 */
@Data
@TableName("decoration_template")
@EqualsAndHashCode(callSuper = true)
public class DecorationTemplate extends Model<DecorationTemplate> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 模板名称
     */
    private String name;

    /**
     * 模板编码
     */
    private String code;

    /**
     * 模板描述
     */
    private String description;

    /**
     * 缩略图URL
     */
    private String thumbnail;

    /**
     * 预览URL
     */
    private String previewUrl;

    /**
     * 风格类型：fresh/luxury/simple/dopamine
     */
    private String styleType;

    /**
     * 行业类型：food/retail/beauty
     */
    private String industryType;

    /**
     * 主题配置 JSON
     */
    private String themeConfig;

    /**
     * 模块配置 JSON
     */
    private String modulesConfig;

    /**
     * 状态：0禁用 1启用
     */
    private Integer status;

    /**
     * 是否默认：0否 1是
     */
    private Integer isDefault;

    /**
     * 使用次数
     */
    private Integer useCount;

    /**
     * 创建人
     */
    private Long createBy;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;
}
