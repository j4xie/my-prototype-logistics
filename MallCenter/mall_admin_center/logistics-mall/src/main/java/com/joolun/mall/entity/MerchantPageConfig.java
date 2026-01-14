package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 商户页面配置实体
 */
@Data
@TableName("merchant_page_config")
@EqualsAndHashCode(callSuper = true)
public class MerchantPageConfig extends Model<MerchantPageConfig> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 商户ID
     */
    private Long merchantId;

    /**
     * 页面类型：home/category/product_list/product_detail/cart/user_center
     */
    private String pageType;

    /**
     * 页面名称
     */
    private String pageName;

    /**
     * 使用的模板ID
     */
    private Long templateId;

    /**
     * 主题预设ID
     */
    private Long themePresetId;

    /**
     * 自定义主题配置 JSON
     */
    private String customTheme;

    /**
     * 模块列表配置 JSON
     */
    private String modulesConfig;

    /**
     * 页面配置 JSON
     */
    private String pageConfig;

    /**
     * SEO标题
     */
    private String seoTitle;

    /**
     * SEO关键词
     */
    private String seoKeywords;

    /**
     * SEO描述
     */
    private String seoDescription;

    /**
     * 状态：0草稿 1已发布
     */
    private Integer status;

    /**
     * 版本号
     */
    private Integer version;

    /**
     * 发布时间
     */
    private LocalDateTime publishTime;

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
