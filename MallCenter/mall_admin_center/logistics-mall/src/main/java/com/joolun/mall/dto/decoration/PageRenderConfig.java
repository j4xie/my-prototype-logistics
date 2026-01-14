package com.joolun.mall.dto.decoration;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 页面渲染配置DTO
 * 用于小程序端获取页面装修配置
 */
@Data
public class PageRenderConfig {

    /**
     * 配置ID
     */
    private Long id;

    /**
     * 商户ID
     */
    private Long merchantId;

    /**
     * 页面类型
     */
    private String pageType;

    /**
     * 页面名称
     */
    private String pageName;

    /**
     * 主题配置
     */
    private ThemeConfig theme;

    /**
     * 模块列表
     */
    private List<ModuleConfig> modules;

    /**
     * 页面配置
     */
    private Map<String, Object> pageConfig;

    /**
     * SEO配置
     */
    private SeoConfig seo;

    /**
     * 版本号
     */
    private Integer version;

    /**
     * 主题配置
     */
    @Data
    public static class ThemeConfig {
        /**
         * 主色
         */
        private String primaryColor;

        /**
         * 次色
         */
        private String secondaryColor;

        /**
         * 背景色
         */
        private String backgroundColor;

        /**
         * 文字颜色
         */
        private String textColor;

        /**
         * 次要文字颜色
         */
        private String textSecondaryColor;

        /**
         * 边框颜色
         */
        private String borderColor;

        /**
         * 圆角大小
         */
        private String borderRadius;

        /**
         * 字体
         */
        private String fontFamily;

        /**
         * 自定义CSS变量
         */
        private Map<String, String> cssVariables;
    }

    /**
     * 模块配置
     */
    @Data
    public static class ModuleConfig {
        /**
         * 模块编码
         */
        private String code;

        /**
         * 模块类型
         */
        private String type;

        /**
         * 模块标题
         */
        private String title;

        /**
         * 是否显示
         */
        private Boolean visible;

        /**
         * 排序
         */
        private Integer sort;

        /**
         * 模块数据
         */
        private Map<String, Object> data;

        /**
         * 模块样式
         */
        private Map<String, Object> style;
    }

    /**
     * SEO配置
     */
    @Data
    public static class SeoConfig {
        /**
         * 标题
         */
        private String title;

        /**
         * 关键词
         */
        private String keywords;

        /**
         * 描述
         */
        private String description;
    }
}
