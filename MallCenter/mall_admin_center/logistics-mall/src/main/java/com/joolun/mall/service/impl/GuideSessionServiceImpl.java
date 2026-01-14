package com.joolun.mall.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.AiDecorationSession;
import com.joolun.mall.entity.DecorationLayoutPreset;
import com.joolun.mall.entity.DecorationThemePreset;
import com.joolun.mall.entity.MerchantPageConfig;
import com.joolun.mall.mapper.AiDecorationSessionMapper;
import com.joolun.mall.mapper.DecorationLayoutPresetMapper;
import com.joolun.mall.mapper.DecorationThemePresetMapper;
import com.joolun.mall.mapper.MerchantPageConfigMapper;
import com.joolun.mall.service.GuideSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 引导式装修会话服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GuideSessionServiceImpl implements GuideSessionService {

    private final AiDecorationSessionMapper sessionMapper;
    private final DecorationThemePresetMapper themePresetMapper;
    private final DecorationLayoutPresetMapper layoutPresetMapper;
    private final MerchantPageConfigMapper pageConfigMapper;

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 预定义的行业选项
     */
    private static final List<Map<String, Object>> INDUSTRY_OPTIONS = Arrays.asList(
            createOption("fresh_food", "生鲜食品", "icon-fruit", "新鲜蔬果、有机食品"),
            createOption("seafood", "海鲜水产", "icon-fish", "海鲜、水产品"),
            createOption("dessert", "甜品烘焙", "icon-cake", "蛋糕、面包、甜点"),
            createOption("gift", "高端礼品", "icon-gift", "礼品、礼盒"),
            createOption("baby", "母婴用品", "icon-baby", "婴儿用品、母婴产品"),
            createOption("tech", "数码科技", "icon-phone", "数码产品、电子设备"),
            createOption("beauty", "美妆护肤", "icon-beauty", "化妆品、护肤品"),
            createOption("general", "其他", "icon-shop", "其他行业类型")
    );

    private static Map<String, Object> createOption(String code, String name, String icon, String description) {
        Map<String, Object> option = new HashMap<>();
        option.put("code", code);
        option.put("name", name);
        option.put("icon", icon);
        option.put("description", description);
        return option;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> startGuide(Long merchantId) {
        // 创建新会话
        AiDecorationSession session = new AiDecorationSession();
        session.setSessionId(UUID.randomUUID().toString());
        session.setMerchantId(merchantId);
        session.setStatus("guide_active");
        session.setCurrentStep(1);
        session.setTitle("引导式装修会话");
        session.setCreateTime(LocalDateTime.now());
        session.setUpdateTime(LocalDateTime.now());
        session.setExpireTime(LocalDateTime.now().plusHours(24)); // 24小时过期

        sessionMapper.insert(session);

        log.info("创建引导会话: sessionId={}, merchantId={}", session.getSessionId(), merchantId);

        // 返回会话ID和行业选项
        Map<String, Object> result = new HashMap<>();
        result.put("sessionId", session.getSessionId());
        result.put("currentStep", 1);
        result.put("industries", getIndustryOptions());
        result.put("message", "请选择您的店铺行业类型");

        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> processSelection(String sessionId, int step, String selection) {
        AiDecorationSession session = sessionMapper.selectBySessionId(sessionId);
        if (session == null) {
            throw new RuntimeException("会话不存在或已过期");
        }

        if (!"guide_active".equals(session.getStatus())) {
            throw new RuntimeException("会话状态无效");
        }

        Map<String, Object> result = new HashMap<>();

        switch (step) {
            case 1:
                // 步骤1：选择行业
                session.setSelectedIndustry(selection);
                session.setCurrentStep(2);
                session.setUpdateTime(LocalDateTime.now());
                sessionMapper.updateById(session);

                result.put("currentStep", 2);
                result.put("styles", getStyleOptions(selection));
                result.put("message", "请选择您喜欢的设计风格");
                break;

            case 2:
                // 步骤2：选择风格
                session.setSelectedStyle(selection);
                session.setCurrentStep(3);
                session.setUpdateTime(LocalDateTime.now());
                sessionMapper.updateById(session);

                result.put("currentStep", 3);
                result.put("themes", getThemePreview(session.getSelectedIndustry(), selection));
                result.put("message", "请选择主题预设");
                break;

            case 3:
                // 步骤3：选择主题
                session.setSelectedThemeCode(selection);
                session.setCurrentStep(4);
                session.setUpdateTime(LocalDateTime.now());
                sessionMapper.updateById(session);

                // 获取布局选项
                List<Map<String, Object>> layouts = getLayoutOptions(session.getSelectedIndustry(), session.getSelectedStyle());
                result.put("currentStep", 4);
                result.put("layouts", layouts);
                result.put("selectedTheme", getThemeDetails(selection));
                result.put("message", "请选择页面布局");
                break;

            case 4:
                // 步骤4：选择布局
                try {
                    session.setSelectedLayoutId(Long.parseLong(selection));
                } catch (NumberFormatException e) {
                    session.setSelectedLayoutId(null);
                }
                session.setUpdateTime(LocalDateTime.now());
                sessionMapper.updateById(session);

                // 生成最终预览
                result.put("currentStep", 5);
                result.put("preview", generatePreview(session));
                result.put("message", "配置预览，点击确认完成装修");
                break;

            default:
                throw new RuntimeException("无效的步骤: " + step);
        }

        result.put("sessionId", sessionId);
        return result;
    }

    @Override
    public List<Map<String, Object>> getIndustryOptions() {
        return new ArrayList<>(INDUSTRY_OPTIONS);
    }

    @Override
    public List<Map<String, Object>> getStyleOptions(String industryType) {
        // 查询该行业相关的主题，从中提取风格标签
        List<DecorationThemePreset> themes = themePresetMapper.selectByIndustryType(industryType);

        if (themes.isEmpty()) {
            // 如果没有行业特定主题，返回所有系统主题的风格
            themes = themePresetMapper.selectSystemPresets();
        }

        // 提取风格选项，去重
        Set<String> styleSet = new LinkedHashSet<>();
        Map<String, Map<String, Object>> styleMap = new LinkedHashMap<>();

        for (DecorationThemePreset theme : themes) {
            String styleTags = theme.getStyleTags();
            if (StringUtils.hasText(styleTags)) {
                for (String tag : styleTags.split(",")) {
                    String trimmedTag = tag.trim();
                    if (!styleSet.contains(trimmedTag)) {
                        styleSet.add(trimmedTag);
                        Map<String, Object> styleOption = new HashMap<>();
                        styleOption.put("code", trimmedTag);
                        styleOption.put("name", getStyleDisplayName(trimmedTag));
                        styleOption.put("description", getStyleDescription(trimmedTag));

                        // 从主题获取预览颜色
                        String primaryColor = "#52c41a";
                        if (StringUtils.hasText(theme.getColorConfig())) {
                            try {
                                JsonNode colorNode = objectMapper.readTree(theme.getColorConfig());
                                if (colorNode.has("primaryColor")) {
                                    primaryColor = colorNode.get("primaryColor").asText();
                                }
                            } catch (Exception e) {
                                log.warn("解析colorConfig失败");
                            }
                        }
                        styleOption.put("previewColor", primaryColor);
                        styleOption.put("themeCodes", new ArrayList<>(Collections.singletonList(theme.getCode())));

                        styleMap.put(trimmedTag, styleOption);
                    } else {
                        // 添加到已有的主题代码列表
                        Map<String, Object> existing = styleMap.get(trimmedTag);
                        if (existing != null) {
                            @SuppressWarnings("unchecked")
                            List<String> themeCodes = (List<String>) existing.get("themeCodes");
                            if (!themeCodes.contains(theme.getCode())) {
                                themeCodes.add(theme.getCode());
                            }
                        }
                    }
                }
            }
        }

        return new ArrayList<>(styleMap.values());
    }

    @Override
    public Map<String, Object> getThemePreview(String industryType, String styleType) {
        Map<String, Object> result = new HashMap<>();

        // 查询符合行业和风格的主题
        List<DecorationThemePreset> themes = themePresetMapper.selectByIndustryType(industryType);

        // 过滤出匹配风格的主题
        List<Map<String, Object>> matchedThemes = themes.stream()
                .filter(theme -> {
                    String styleTags = theme.getStyleTags();
                    return StringUtils.hasText(styleTags) && styleTags.contains(styleType);
                })
                .map(this::themeToMap)
                .collect(Collectors.toList());

        // 如果没有精确匹配，返回所有该行业的主题
        if (matchedThemes.isEmpty()) {
            matchedThemes = themes.stream()
                    .map(this::themeToMap)
                    .collect(Collectors.toList());
        }

        // 如果仍然为空，返回所有系统主题
        if (matchedThemes.isEmpty()) {
            matchedThemes = themePresetMapper.selectSystemPresets().stream()
                    .map(this::themeToMap)
                    .collect(Collectors.toList());
        }

        result.put("themes", matchedThemes);
        result.put("industryType", industryType);
        result.put("styleType", styleType);
        result.put("count", matchedThemes.size());

        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> finishGuide(String sessionId, Map<String, Object> finalConfig) {
        AiDecorationSession session = sessionMapper.selectBySessionId(sessionId);
        if (session == null) {
            throw new RuntimeException("会话不存在");
        }

        // 更新会话状态
        session.setStatus("completed");
        session.setIsApplied(1);
        session.setAppliedTime(LocalDateTime.now());
        session.setUpdateTime(LocalDateTime.now());

        // 保存生成的配置
        try {
            session.setGeneratedConfig(objectMapper.writeValueAsString(finalConfig));
        } catch (Exception e) {
            log.error("序列化配置失败", e);
        }

        sessionMapper.updateById(session);

        // 保存商户页面配置
        MerchantPageConfig pageConfig = new MerchantPageConfig();
        pageConfig.setMerchantId(session.getMerchantId());
        pageConfig.setPageType("home");
        pageConfig.setPageName("首页");
        pageConfig.setStatus(1); // 已发布
        pageConfig.setVersion(1);
        pageConfig.setCreateTime(LocalDateTime.now());
        pageConfig.setUpdateTime(LocalDateTime.now());
        pageConfig.setPublishTime(LocalDateTime.now());

        // 设置主题配置
        DecorationThemePreset theme = themePresetMapper.selectByCode(session.getSelectedThemeCode());
        if (theme != null) {
            pageConfig.setThemePresetId(theme.getId());
            pageConfig.setCustomTheme(theme.getColorConfig());
        }

        // 检查是否已存在配置
        MerchantPageConfig existingConfig = pageConfigMapper.selectByMerchantAndPageType(
                session.getMerchantId(), "home");
        if (existingConfig != null) {
            pageConfig.setId(existingConfig.getId());
            pageConfig.setVersion(existingConfig.getVersion() + 1);
            pageConfigMapper.updateById(pageConfig);
        } else {
            pageConfigMapper.insert(pageConfig);
        }

        session.setPageConfigId(pageConfig.getId());
        sessionMapper.updateById(session);

        log.info("完成引导装修: sessionId={}, merchantId={}, themeCode={}",
                sessionId, session.getMerchantId(), session.getSelectedThemeCode());

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "装修配置已保存并应用");
        result.put("pageConfigId", pageConfig.getId());
        result.put("themeCode", session.getSelectedThemeCode());

        return result;
    }

    @Override
    public AiDecorationSession getSession(String sessionId) {
        return sessionMapper.selectBySessionId(sessionId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateSession(AiDecorationSession session) {
        session.setUpdateTime(LocalDateTime.now());
        return sessionMapper.updateById(session) > 0;
    }

    // ==================== 私有辅助方法 ====================

    private Map<String, Object> themeToMap(DecorationThemePreset theme) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", theme.getId());
        item.put("code", theme.getCode());
        item.put("name", theme.getName());
        item.put("description", theme.getDescription());
        item.put("slogan", theme.getSlogan());
        item.put("thumbnail", theme.getThumbnail());

        // 解析颜色配置
        String primaryColor = "#52c41a";
        String secondaryColor = "#389e0d";
        if (StringUtils.hasText(theme.getColorConfig())) {
            try {
                JsonNode colorNode = objectMapper.readTree(theme.getColorConfig());
                if (colorNode.has("primaryColor")) {
                    primaryColor = colorNode.get("primaryColor").asText();
                }
                if (colorNode.has("secondaryColor")) {
                    secondaryColor = colorNode.get("secondaryColor").asText();
                }
            } catch (Exception e) {
                log.warn("解析colorConfig失败: {}", theme.getColorConfig());
            }
        }
        item.put("primaryColor", primaryColor);
        item.put("secondaryColor", secondaryColor);
        item.put("previewBg", "linear-gradient(135deg, " + primaryColor + ", " + secondaryColor + ")");
        item.put("industries", theme.getIndustryTags() != null ? theme.getIndustryTags().split(",") : new String[]{});
        item.put("styles", theme.getStyleTags() != null ? theme.getStyleTags().split(",") : new String[]{});

        return item;
    }

    private List<Map<String, Object>> getLayoutOptions(String industryType, String styleType) {
        List<DecorationLayoutPreset> layouts;

        // 先按行业查询
        layouts = layoutPresetMapper.selectByIndustry(industryType);

        // 如果没有行业特定布局，获取所有活跃布局
        if (layouts.isEmpty()) {
            layouts = layoutPresetMapper.selectActiveList();
        }

        return layouts.stream().map(layout -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", layout.getId());
            item.put("name", layout.getName());
            item.put("code", layout.getCode());
            item.put("description", layout.getDescription());
            item.put("previewImage", layout.getPreviewImage());
            item.put("moduleTypes", layout.getModuleTypes());
            return item;
        }).collect(Collectors.toList());
    }

    private Map<String, Object> getThemeDetails(String themeCode) {
        DecorationThemePreset theme = themePresetMapper.selectByCode(themeCode);
        if (theme == null) {
            return new HashMap<>();
        }
        return themeToMap(theme);
    }

    private Map<String, Object> generatePreview(AiDecorationSession session) {
        Map<String, Object> preview = new HashMap<>();

        // 基本信息
        preview.put("industry", session.getSelectedIndustry());
        preview.put("style", session.getSelectedStyle());
        preview.put("themeCode", session.getSelectedThemeCode());
        preview.put("layoutId", session.getSelectedLayoutId());

        // 主题详情
        if (StringUtils.hasText(session.getSelectedThemeCode())) {
            preview.put("theme", getThemeDetails(session.getSelectedThemeCode()));
        }

        // 布局详情
        if (session.getSelectedLayoutId() != null) {
            DecorationLayoutPreset layout = layoutPresetMapper.selectById(session.getSelectedLayoutId());
            if (layout != null) {
                Map<String, Object> layoutInfo = new HashMap<>();
                layoutInfo.put("id", layout.getId());
                layoutInfo.put("name", layout.getName());
                layoutInfo.put("code", layout.getCode());
                layoutInfo.put("moduleTypes", layout.getModuleTypes());
                preview.put("layout", layoutInfo);
            }
        }

        return preview;
    }

    private String getStyleDisplayName(String styleCode) {
        Map<String, String> styleNames = new HashMap<>();
        styleNames.put("fresh", "清新自然");
        styleNames.put("elegant", "优雅高端");
        styleNames.put("modern", "现代简约");
        styleNames.put("warm", "温馨暖调");
        styleNames.put("cool", "冷调科技");
        styleNames.put("playful", "活力趣味");
        styleNames.put("classic", "经典传统");
        styleNames.put("minimal", "极简主义");
        styleNames.put("luxury", "奢华尊贵");
        styleNames.put("natural", "自然生态");
        return styleNames.getOrDefault(styleCode, styleCode);
    }

    private String getStyleDescription(String styleCode) {
        Map<String, String> styleDescs = new HashMap<>();
        styleDescs.put("fresh", "清新明亮的色调，传递自然健康的品牌形象");
        styleDescs.put("elegant", "高雅精致的设计，适合高端品质定位");
        styleDescs.put("modern", "简洁现代的风格，突出产品本身");
        styleDescs.put("warm", "温暖舒适的氛围，增强亲和力");
        styleDescs.put("cool", "冷静专业的调性，展现科技感");
        styleDescs.put("playful", "活泼有趣的设计，吸引年轻用户");
        styleDescs.put("classic", "经典稳重的风格，传递信任感");
        styleDescs.put("minimal", "极简设计，聚焦核心内容");
        styleDescs.put("luxury", "奢华精致，彰显尊贵品质");
        styleDescs.put("natural", "自然生态风格，强调环保健康");
        return styleDescs.getOrDefault(styleCode, "适合各类店铺的通用风格");
    }
}
