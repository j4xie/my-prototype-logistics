package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.joolun.mall.entity.DecorationModule;
import com.joolun.mall.entity.DecorationTemplate;
import com.joolun.mall.entity.DecorationThemePreset;
import com.joolun.mall.entity.MerchantPageConfig;
import com.joolun.mall.entity.DecorationImageLibrary;
import com.joolun.mall.entity.DecorationComponentStyle;
import com.joolun.mall.entity.DecorationLayoutPreset;
import com.joolun.mall.entity.DecorationIconLibrary;
import com.joolun.mall.entity.DecorationFontStyle;
import com.joolun.mall.mapper.DecorationModuleMapper;
import com.joolun.mall.mapper.DecorationTemplateMapper;
import com.joolun.mall.mapper.DecorationThemePresetMapper;
import com.joolun.mall.mapper.MerchantPageConfigMapper;
import com.joolun.mall.mapper.DecorationImageLibraryMapper;
import com.joolun.mall.mapper.DecorationComponentStyleMapper;
import com.joolun.mall.mapper.DecorationLayoutPresetMapper;
import com.joolun.mall.mapper.DecorationIconLibraryMapper;
import com.joolun.mall.mapper.DecorationFontStyleMapper;
import com.joolun.mall.service.DecorationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 装修服务实现
 */
@Service
@RequiredArgsConstructor
public class DecorationServiceImpl extends ServiceImpl<DecorationTemplateMapper, DecorationTemplate> implements DecorationService {

    private final DecorationModuleMapper moduleMapper;
    private final DecorationThemePresetMapper themePresetMapper;
    private final MerchantPageConfigMapper pageConfigMapper;
    private final DecorationImageLibraryMapper imageLibraryMapper;
    private final DecorationComponentStyleMapper componentStyleMapper;
    private final DecorationLayoutPresetMapper layoutPresetMapper;
    private final DecorationIconLibraryMapper iconLibraryMapper;
    private final DecorationFontStyleMapper fontStyleMapper;

    // ==================== 模板管理 ====================

    @Override
    public IPage<DecorationTemplate> pageTemplates(Page<DecorationTemplate> page, DecorationTemplate query) {
        return baseMapper.selectPage1(page, query);
    }

    @Override
    public DecorationTemplate getTemplateById(Long id) {
        return baseMapper.selectById(id);
    }

    @Override
    public DecorationTemplate getTemplateByCode(String code) {
        return baseMapper.selectByCode(code);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean saveTemplate(DecorationTemplate template) {
        template.setCreateTime(LocalDateTime.now());
        template.setUpdateTime(LocalDateTime.now());
        if (template.getStatus() == null) {
            template.setStatus(1);
        }
        if (template.getIsDefault() == null) {
            template.setIsDefault(0);
        }
        if (template.getUseCount() == null) {
            template.setUseCount(0);
        }
        return baseMapper.insert(template) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateTemplate(DecorationTemplate template) {
        template.setUpdateTime(LocalDateTime.now());
        return baseMapper.updateById(template) > 0;
    }

    @Override
    public DecorationTemplate getDefaultTemplate() {
        return baseMapper.selectDefault();
    }

    @Override
    public List<DecorationTemplate> listTemplatesByStyle(String styleType) {
        return baseMapper.selectByStyleType(styleType);
    }

    // ==================== 模块管理 ====================

    @Override
    public List<DecorationModule> listModules() {
        return moduleMapper.selectActiveList();
    }

    @Override
    public DecorationModule getModuleByCode(String code) {
        return moduleMapper.selectByCode(code);
    }

    @Override
    public List<DecorationModule> listModulesByType(String moduleType) {
        return moduleMapper.selectByModuleType(moduleType);
    }

    // ==================== 主题管理 ====================

    @Override
    public List<DecorationThemePreset> listThemes(String styleTag) {
        if (StringUtils.hasText(styleTag)) {
            return themePresetMapper.selectByStyleType(styleTag);
        }
        return themePresetMapper.selectActiveList();
    }

    @Override
    public DecorationThemePreset getThemeByCode(String code) {
        return themePresetMapper.selectByCode(code);
    }

    @Override
    public List<DecorationThemePreset> listSystemThemes() {
        return themePresetMapper.selectSystemPresets();
    }

    // ==================== 商户配置 ====================

    @Override
    public MerchantPageConfig getPageConfig(Long merchantId, String pageType) {
        return pageConfigMapper.selectByMerchantAndPageType(merchantId, pageType);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean savePageConfig(MerchantPageConfig config) {
        config.setCreateTime(LocalDateTime.now());
        config.setUpdateTime(LocalDateTime.now());
        if (config.getStatus() == null) {
            config.setStatus(0); // 默认草稿状态
        }
        if (config.getVersion() == null) {
            config.setVersion(1);
        }
        return pageConfigMapper.insert(config) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updatePageConfig(MerchantPageConfig config) {
        config.setUpdateTime(LocalDateTime.now());
        return pageConfigMapper.updateById(config) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean publishPageConfig(Long configId) {
        MerchantPageConfig config = pageConfigMapper.selectById(configId);
        if (config == null) {
            return false;
        }
        config.setStatus(1); // 已发布状态
        config.setPublishTime(LocalDateTime.now());
        config.setVersion(config.getVersion() + 1);
        config.setUpdateTime(LocalDateTime.now());
        return pageConfigMapper.updateById(config) > 0;
    }

    @Override
    public List<MerchantPageConfig> listPageConfigsByMerchant(Long merchantId) {
        return pageConfigMapper.selectByMerchantId(merchantId);
    }

    @Override
    public MerchantPageConfig getPublishedConfig(Long merchantId, String pageType) {
        return pageConfigMapper.selectPublishedConfig(merchantId, pageType);
    }

    // ==================== 图片素材 ====================

    @Override
    public List<DecorationImageLibrary> listImagesByIndustry(String industryType) {
        return imageLibraryMapper.selectByIndustry(industryType);
    }

    @Override
    public List<DecorationImageLibrary> listImagesByStyle(String styleType) {
        return imageLibraryMapper.selectByStyle(styleType);
    }

    @Override
    public List<DecorationImageLibrary> listImagesByType(String imageType) {
        return imageLibraryMapper.selectByType(imageType);
    }

    @Override
    public List<DecorationImageLibrary> listActiveImages() {
        return imageLibraryMapper.selectActiveList();
    }

    // ==================== 组件样式 ====================

    @Override
    public List<DecorationComponentStyle> listStylesByComponent(String componentType) {
        return componentStyleMapper.selectByComponentType(componentType);
    }

    @Override
    public List<DecorationComponentStyle> listActiveComponentStyles() {
        return componentStyleMapper.selectActiveList();
    }

    // ==================== 布局预设 ====================

    @Override
    public List<DecorationLayoutPreset> listLayoutsByIndustry(String industryType) {
        return layoutPresetMapper.selectByIndustry(industryType);
    }

    @Override
    public List<DecorationLayoutPreset> listLayoutsByStyle(String styleType) {
        return layoutPresetMapper.selectByStyle(styleType);
    }

    @Override
    public List<DecorationLayoutPreset> listActiveLayouts() {
        return layoutPresetMapper.selectActiveList();
    }

    @Override
    public DecorationLayoutPreset getLayoutById(Long id) {
        return layoutPresetMapper.selectById(id);
    }

    // ==================== 图标素材 ====================

    @Override
    public List<DecorationIconLibrary> listIconsByCategory(String category) {
        return iconLibraryMapper.selectByCategory(category);
    }

    @Override
    public List<DecorationIconLibrary> listIconsByType(String iconType) {
        return iconLibraryMapper.selectByIconType(iconType);
    }

    @Override
    public List<DecorationIconLibrary> listActiveIcons() {
        return iconLibraryMapper.selectActiveList();
    }

    // ==================== 字体样式 ====================

    @Override
    public List<DecorationFontStyle> listFontsByUsage(String usageType) {
        return fontStyleMapper.selectByUsageType(usageType);
    }

    @Override
    public List<DecorationFontStyle> listActiveFonts() {
        return fontStyleMapper.selectActiveList();
    }

    // ==================== 主题关联素材 ====================

    @Override
    public Map<String, Object> getThemeAssets(String themeCode) {
        Map<String, Object> assets = new HashMap<>();

        // 获取主题信息
        DecorationThemePreset theme = themePresetMapper.selectByCode(themeCode);
        if (theme == null) {
            return assets;
        }

        assets.put("theme", theme);

        // 根据主题的风格标签获取相关图片
        String styleTags = theme.getStyleTags();
        if (StringUtils.hasText(styleTags)) {
            String[] tags = styleTags.split(",");
            if (tags.length > 0) {
                List<DecorationImageLibrary> images = imageLibraryMapper.selectByStyle(tags[0].trim());
                assets.put("images", images);
            }
        }

        // 根据主题的行业标签获取相关布局
        String industryTags = theme.getIndustryTags();
        if (StringUtils.hasText(industryTags)) {
            String[] tags = industryTags.split(",");
            if (tags.length > 0) {
                List<DecorationLayoutPreset> layouts = layoutPresetMapper.selectByIndustry(tags[0].trim());
                assets.put("layouts", layouts);

                // 同时获取行业相关图片
                List<DecorationImageLibrary> industryImages = imageLibraryMapper.selectByIndustry(tags[0].trim());
                assets.put("industryImages", industryImages);
            }
        }

        // 获取所有可用的组件样式
        List<DecorationComponentStyle> componentStyles = componentStyleMapper.selectActiveList();
        assets.put("componentStyles", componentStyles);

        // 获取所有可用的图标
        List<DecorationIconLibrary> icons = iconLibraryMapper.selectActiveList();
        assets.put("icons", icons);

        // 获取所有可用的字体
        List<DecorationFontStyle> fonts = fontStyleMapper.selectActiveList();
        assets.put("fonts", fonts);

        return assets;
    }

    // ==================== API便捷方法（返回Map格式） ====================

    @Override
    public List<Map<String, Object>> listImages(String industryType) {
        List<DecorationImageLibrary> images;
        if (StringUtils.hasText(industryType)) {
            images = imageLibraryMapper.selectByIndustry(industryType);
        } else {
            images = imageLibraryMapper.selectActiveList();
        }
        return images.stream().map(image -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", image.getId());
            item.put("name", image.getName());
            item.put("url", image.getImageUrl());
            item.put("imageType", image.getImageType());
            item.put("industryType", image.getIndustryType());
            item.put("styleType", image.getStyleType());
            item.put("width", image.getWidth());
            item.put("height", image.getHeight());
            item.put("format", image.getImageType());
            return item;
        }).collect(java.util.stream.Collectors.toList());
    }

    @Override
    public List<Map<String, Object>> listLayouts() {
        List<DecorationLayoutPreset> layouts = layoutPresetMapper.selectActiveList();
        return layouts.stream().map(layout -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", layout.getId());
            item.put("name", layout.getName());
            item.put("code", layout.getCode());
            item.put("description", layout.getDescription());
            item.put("previewImage", layout.getPreviewImage());
            item.put("moduleList", layout.getModuleTypes());
            item.put("industryType", layout.getIndustryType());
            item.put("styleType", layout.getStyleType());
            return item;
        }).collect(java.util.stream.Collectors.toList());
    }

    @Override
    public List<Map<String, Object>> listComponentStyles(String componentType) {
        List<DecorationComponentStyle> styles;
        if (StringUtils.hasText(componentType)) {
            styles = componentStyleMapper.selectByComponentType(componentType);
        } else {
            styles = componentStyleMapper.selectActiveList();
        }
        return styles.stream().map(style -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", style.getId());
            item.put("componentType", style.getComponentType());
            item.put("styleName", style.getName());
            item.put("styleCode", style.getCode());
            item.put("description", style.getDescription());
            item.put("cssConfig", style.getStyleConfig());
            item.put("previewImage", style.getPreviewImage());
            return item;
        }).collect(java.util.stream.Collectors.toList());
    }

    @Override
    public List<Map<String, Object>> listIcons(String category) {
        List<DecorationIconLibrary> icons;
        if (StringUtils.hasText(category)) {
            icons = iconLibraryMapper.selectByCategory(category);
        } else {
            icons = iconLibraryMapper.selectActiveList();
        }
        return icons.stream().map(icon -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", icon.getId());
            item.put("name", icon.getName());
            item.put("iconCode", icon.getCode());
            item.put("iconType", icon.getIconType());
            item.put("category", icon.getCategory());
            item.put("svgContent", icon.getIconContent());
            item.put("color", icon.getDefaultColor());
            return item;
        }).collect(java.util.stream.Collectors.toList());
    }

    @Override
    public List<Map<String, Object>> listFonts(String usageType) {
        List<DecorationFontStyle> fonts;
        if (StringUtils.hasText(usageType)) {
            fonts = fontStyleMapper.selectByUsageType(usageType);
        } else {
            fonts = fontStyleMapper.selectActiveList();
        }
        return fonts.stream().map(font -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", font.getId());
            item.put("name", font.getName());
            item.put("styleCode", font.getCode());
            item.put("fontFamily", font.getFontFamily());
            item.put("fontSize", font.getFontSize());
            item.put("fontWeight", font.getFontWeight());
            item.put("color", font.getStyleConfig());
            item.put("lineHeight", font.getLineHeight());
            item.put("letterSpacing", font.getLetterSpacing());
            item.put("textAlign", font.getUsageType());
            item.put("usageType", font.getUsageType());
            return item;
        }).collect(java.util.stream.Collectors.toList());
    }
}
