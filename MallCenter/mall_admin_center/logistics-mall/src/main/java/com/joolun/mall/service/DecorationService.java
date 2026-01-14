package com.joolun.mall.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import com.joolun.mall.entity.DecorationModule;
import com.joolun.mall.entity.DecorationTemplate;
import com.joolun.mall.entity.DecorationThemePreset;
import com.joolun.mall.entity.MerchantPageConfig;
import com.joolun.mall.entity.DecorationImageLibrary;
import com.joolun.mall.entity.DecorationComponentStyle;
import com.joolun.mall.entity.DecorationLayoutPreset;
import com.joolun.mall.entity.DecorationIconLibrary;
import com.joolun.mall.entity.DecorationFontStyle;

import java.util.List;
import java.util.Map;

/**
 * 装修服务接口
 */
public interface DecorationService extends IService<DecorationTemplate> {

    // ==================== 模板管理 ====================

    /**
     * 分页查询模板
     */
    IPage<DecorationTemplate> pageTemplates(Page<DecorationTemplate> page, DecorationTemplate query);

    /**
     * 根据ID获取模板
     */
    DecorationTemplate getTemplateById(Long id);

    /**
     * 根据编码获取模板
     */
    DecorationTemplate getTemplateByCode(String code);

    /**
     * 保存模板
     */
    boolean saveTemplate(DecorationTemplate template);

    /**
     * 更新模板
     */
    boolean updateTemplate(DecorationTemplate template);

    /**
     * 获取默认模板
     */
    DecorationTemplate getDefaultTemplate();

    /**
     * 按风格类型查询模板
     */
    List<DecorationTemplate> listTemplatesByStyle(String styleType);

    // ==================== 模块管理 ====================

    /**
     * 获取所有启用的模块列表
     */
    List<DecorationModule> listModules();

    /**
     * 根据编码获取模块
     */
    DecorationModule getModuleByCode(String code);

    /**
     * 按模块类型查询
     */
    List<DecorationModule> listModulesByType(String moduleType);

    // ==================== 主题管理 ====================

    /**
     * 获取主题列表
     * @param styleTag 风格标签，为空则查询所有
     */
    List<DecorationThemePreset> listThemes(String styleTag);

    /**
     * 根据编码获取主题
     */
    DecorationThemePreset getThemeByCode(String code);

    /**
     * 获取系统预设主题
     */
    List<DecorationThemePreset> listSystemThemes();

    // ==================== 商户配置 ====================

    /**
     * 获取商户页面配置
     */
    MerchantPageConfig getPageConfig(Long merchantId, String pageType);

    /**
     * 保存商户页面配置
     */
    boolean savePageConfig(MerchantPageConfig config);

    /**
     * 更新商户页面配置
     */
    boolean updatePageConfig(MerchantPageConfig config);

    /**
     * 发布页面配置
     */
    boolean publishPageConfig(Long configId);

    /**
     * 获取商户所有页面配置
     */
    List<MerchantPageConfig> listPageConfigsByMerchant(Long merchantId);

    /**
     * 获取已发布的配置
     */
    MerchantPageConfig getPublishedConfig(Long merchantId, String pageType);

    // ==================== 图片素材 ====================

    /**
     * 按行业类型查询图片
     */
    List<DecorationImageLibrary> listImagesByIndustry(String industryType);

    /**
     * 按风格类型查询图片
     */
    List<DecorationImageLibrary> listImagesByStyle(String styleType);

    /**
     * 按图片类型查询
     */
    List<DecorationImageLibrary> listImagesByType(String imageType);

    /**
     * 获取所有启用的图片
     */
    List<DecorationImageLibrary> listActiveImages();

    // ==================== 组件样式 ====================

    /**
     * 按组件类型查询样式
     */
    List<DecorationComponentStyle> listStylesByComponent(String componentType);

    /**
     * 获取所有启用的组件样式
     */
    List<DecorationComponentStyle> listActiveComponentStyles();

    // ==================== 布局预设 ====================

    /**
     * 按行业类型查询布局
     */
    List<DecorationLayoutPreset> listLayoutsByIndustry(String industryType);

    /**
     * 按风格类型查询布局
     */
    List<DecorationLayoutPreset> listLayoutsByStyle(String styleType);

    /**
     * 获取所有启用的布局
     */
    List<DecorationLayoutPreset> listActiveLayouts();

    /**
     * 根据ID获取布局
     */
    DecorationLayoutPreset getLayoutById(Long id);

    // ==================== 图标素材 ====================

    /**
     * 按分类查询图标
     */
    List<DecorationIconLibrary> listIconsByCategory(String category);

    /**
     * 按图标类型查询
     */
    List<DecorationIconLibrary> listIconsByType(String iconType);

    /**
     * 获取所有启用的图标
     */
    List<DecorationIconLibrary> listActiveIcons();

    // ==================== 字体样式 ====================

    /**
     * 按使用场景查询字体
     */
    List<DecorationFontStyle> listFontsByUsage(String usageType);

    /**
     * 获取所有启用的字体
     */
    List<DecorationFontStyle> listActiveFonts();

    // ==================== 主题关联素材 ====================

    /**
     * 获取主题关联的素材资源
     * @param themeCode 主题编码
     * @return 包含图片、布局、图标等素材的Map
     */
    Map<String, Object> getThemeAssets(String themeCode);

    // ==================== API便捷方法（返回Map格式） ====================

    /**
     * 获取所有布局列表（返回Map格式供API使用）
     */
    List<Map<String, Object>> listLayouts();

    /**
     * 按行业获取图片（返回Map格式供API使用）
     * @param industryType 行业类型
     */
    List<Map<String, Object>> listImages(String industryType);

    /**
     * 获取组件样式列表（返回Map格式供API使用）
     * @param componentType 组件类型，为空则返回所有
     */
    List<Map<String, Object>> listComponentStyles(String componentType);

    /**
     * 获取图标列表（返回Map格式供API使用）
     * @param category 分类，为空则返回所有
     */
    List<Map<String, Object>> listIcons(String category);

    /**
     * 获取字体列表（返回Map格式供API使用）
     * @param usageType 用途类型，为空则返回所有
     */
    List<Map<String, Object>> listFonts(String usageType);
}
