package com.joolun.mall.service.impl;

import com.joolun.mall.entity.DecorationKeywordMapping;
import com.joolun.mall.entity.DecorationPromptTemplate;
import com.joolun.mall.mapper.DecorationKeywordMappingMapper;
import com.joolun.mall.service.ImagePromptBuilder;
import com.joolun.mall.service.PromptTemplateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 图片Prompt构建器实现
 * 支持智能行业/风格识别和prompt模板构建
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ImagePromptBuilderImpl implements ImagePromptBuilder {

    private final DecorationKeywordMappingMapper keywordMappingMapper;
    private final PromptTemplateService promptTemplateService;

    /**
     * 关键词缓存（keyword -> mapping）
     * 用于减少数据库查询
     */
    private final Map<String, DecorationKeywordMapping> keywordCache = new ConcurrentHashMap<>();

    /**
     * 默认行业类型
     */
    private static final String DEFAULT_INDUSTRY = "general";

    /**
     * 默认风格类型
     */
    private static final String DEFAULT_STYLE = "fresh";

    /**
     * 默认负向提示词
     */
    private static final String DEFAULT_NEGATIVE_PROMPT = "blurry, low quality, distorted, watermark, text, logo, ugly, deformed";

    /**
     * 初始化时加载关键词缓存
     */
    @PostConstruct
    public void initCache() {
        try {
            List<DecorationKeywordMapping> mappings = keywordMappingMapper.selectActiveList();
            if (!CollectionUtils.isEmpty(mappings)) {
                for (DecorationKeywordMapping mapping : mappings) {
                    keywordCache.put(mapping.getKeyword().toLowerCase(), mapping);
                }
                log.info("Loaded {} keyword mappings into cache", mappings.size());
            }
        } catch (Exception e) {
            log.error("Failed to load keyword cache: {}", e.getMessage());
        }
    }

    @Override
    public String buildImagePrompt(String industryType, String styleType, String productDescription,
                                   String imageType, String size) {
        // 使用默认值处理空参数
        String industry = StringUtils.hasText(industryType) ? industryType : DEFAULT_INDUSTRY;
        String style = StringUtils.hasText(styleType) ? styleType : DEFAULT_STYLE;
        String product = StringUtils.hasText(productDescription) ? productDescription : "";
        String imgType = StringUtils.hasText(imageType) ? imageType : "banner";
        String imgSize = StringUtils.hasText(size) ? size : "750*300";

        // 获取最佳匹配模板
        DecorationPromptTemplate template = promptTemplateService.getBestMatch(industry, style, imgType);

        if (template != null) {
            // 使用模板构建prompt
            Map<String, String> variables = new HashMap<>();
            variables.put("product", product);
            variables.put("style", getStyleDescription(style));
            variables.put("color_tone", getColorTone(style, industry));
            variables.put("size", imgSize);

            String prompt = promptTemplateService.buildPrompt(template.getCode(), variables);
            if (StringUtils.hasText(prompt)) {
                log.debug("Built prompt using template {}: {}", template.getCode(), prompt);
                return prompt;
            }
        }

        // 降级：使用默认模板构建prompt
        return buildDefaultPrompt(product, style, imgType, imgSize);
    }

    @Override
    public String matchIndustry(String userInput) {
        if (!StringUtils.hasText(userInput)) {
            return DEFAULT_INDUSTRY;
        }

        String input = userInput.toLowerCase().trim();

        // 1. 精确匹配（从缓存）
        DecorationKeywordMapping exactMatch = keywordCache.get(input);
        if (exactMatch != null && "industry".equals(exactMatch.getMappingType())) {
            incrementMatchCount(exactMatch.getId());
            return exactMatch.getMappingValue();
        }

        // 2. 包含匹配（遍历缓存）
        for (Map.Entry<String, DecorationKeywordMapping> entry : keywordCache.entrySet()) {
            DecorationKeywordMapping mapping = entry.getValue();
            if ("industry".equals(mapping.getMappingType()) && input.contains(entry.getKey())) {
                incrementMatchCount(mapping.getId());
                return mapping.getMappingValue();
            }
        }

        // 3. 数据库模糊匹配
        try {
            List<DecorationKeywordMapping> fuzzyMatches = keywordMappingMapper.selectByKeywordLike(input);
            if (!CollectionUtils.isEmpty(fuzzyMatches)) {
                for (DecorationKeywordMapping mapping : fuzzyMatches) {
                    if ("industry".equals(mapping.getMappingType())) {
                        incrementMatchCount(mapping.getId());
                        // 加入缓存
                        keywordCache.put(mapping.getKeyword().toLowerCase(), mapping);
                        return mapping.getMappingValue();
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to fuzzy match industry: {}", e.getMessage());
        }

        log.debug("No industry match found for input: {}, using default: {}", userInput, DEFAULT_INDUSTRY);
        return DEFAULT_INDUSTRY;
    }

    @Override
    public String matchStyle(String userInput) {
        if (!StringUtils.hasText(userInput)) {
            return DEFAULT_STYLE;
        }

        String input = userInput.toLowerCase().trim();

        // 1. 精确匹配（从缓存）
        DecorationKeywordMapping exactMatch = keywordCache.get(input);
        if (exactMatch != null && "style".equals(exactMatch.getMappingType())) {
            incrementMatchCount(exactMatch.getId());
            return exactMatch.getMappingValue();
        }

        // 2. 包含匹配（遍历缓存）
        for (Map.Entry<String, DecorationKeywordMapping> entry : keywordCache.entrySet()) {
            DecorationKeywordMapping mapping = entry.getValue();
            if ("style".equals(mapping.getMappingType()) && input.contains(entry.getKey())) {
                incrementMatchCount(mapping.getId());
                return mapping.getMappingValue();
            }
        }

        // 3. 数据库模糊匹配
        try {
            List<DecorationKeywordMapping> fuzzyMatches = keywordMappingMapper.selectByKeywordLike(input);
            if (!CollectionUtils.isEmpty(fuzzyMatches)) {
                for (DecorationKeywordMapping mapping : fuzzyMatches) {
                    if ("style".equals(mapping.getMappingType())) {
                        incrementMatchCount(mapping.getId());
                        keywordCache.put(mapping.getKeyword().toLowerCase(), mapping);
                        return mapping.getMappingValue();
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to fuzzy match style: {}", e.getMessage());
        }

        log.debug("No style match found for input: {}, using default: {}", userInput, DEFAULT_STYLE);
        return DEFAULT_STYLE;
    }

    @Override
    public DecorationPromptTemplate getRecommendedTemplate(String industryType, String styleType, String imageType) {
        return promptTemplateService.getBestMatch(industryType, styleType, imageType);
    }

    @Override
    public String buildSmartPrompt(String userDescription, String imageType, String size) {
        // 从用户描述中自动识别行业和风格
        String industry = matchIndustry(userDescription);
        String style = matchStyle(userDescription);

        log.debug("Smart prompt - detected industry: {}, style: {} from: {}", industry, style, userDescription);

        return buildImagePrompt(industry, style, userDescription, imageType, size);
    }

    @Override
    public String getNegativePrompt(String industryType, String imageType) {
        // 尝试获取模板中的负向提示词
        List<DecorationPromptTemplate> templates = promptTemplateService.getByIndustryAndType(industryType, imageType);
        if (!CollectionUtils.isEmpty(templates)) {
            DecorationPromptTemplate template = templates.get(0);
            if (StringUtils.hasText(template.getNegativePrompt())) {
                return template.getNegativePrompt();
            }
        }

        // 返回默认负向提示词
        return DEFAULT_NEGATIVE_PROMPT;
    }

    /**
     * 增加关键词匹配次数（异步，不阻塞主流程）
     */
    private void incrementMatchCount(Long mappingId) {
        if (mappingId != null) {
            try {
                keywordMappingMapper.incrementMatchCount(mappingId);
            } catch (Exception e) {
                log.error("Failed to increment match count for mapping {}: {}", mappingId, e.getMessage());
            }
        }
    }

    /**
     * 获取风格描述（中文）
     */
    private String getStyleDescription(String styleType) {
        if (!StringUtils.hasText(styleType)) {
            return "清新自然";
        }

        switch (styleType.toLowerCase()) {
            case "fresh":
                return "清新自然";
            case "luxury":
                return "高端奢华";
            case "minimal":
                return "简约现代";
            case "dopamine":
                return "多巴胺活力";
            case "warm":
                return "温馨舒适";
            default:
                return "清新自然";
        }
    }

    /**
     * 根据风格和行业获取推荐色调
     */
    private String getColorTone(String styleType, String industryType) {
        // 根据风格确定基础色调
        String baseTone;
        switch (styleType != null ? styleType.toLowerCase() : "") {
            case "fresh":
                baseTone = "绿色、浅蓝色";
                break;
            case "luxury":
                baseTone = "金色、黑色、深红色";
                break;
            case "minimal":
                baseTone = "白色、灰色、黑色";
                break;
            case "dopamine":
                baseTone = "明亮的黄色、粉色、紫色";
                break;
            case "warm":
                baseTone = "暖橙色、米白色、浅棕色";
                break;
            default:
                baseTone = "自然色调";
        }

        // 根据行业微调
        if (industryType != null) {
            switch (industryType.toLowerCase()) {
                case "fresh_food":
                    return "新鲜的" + baseTone + "，突出食材的自然色彩";
                case "seafood":
                    return "海洋蓝色、清新的" + baseTone;
                case "dessert":
                    return "甜美的粉色、奶油色、" + baseTone;
                case "gift":
                    return "喜庆的红色、金色、" + baseTone;
                case "baby":
                    return "柔和的粉蓝色、粉色、" + baseTone;
                case "tech":
                    return "科技感的蓝色、银色、" + baseTone;
                case "beauty":
                    return "优雅的玫瑰金、粉色、" + baseTone;
                default:
                    return baseTone;
            }
        }

        return baseTone;
    }

    /**
     * 构建默认prompt（当没有匹配模板时使用）
     */
    private String buildDefaultPrompt(String product, String style, String imageType, String size) {
        StringBuilder prompt = new StringBuilder();

        // 基础描述
        prompt.append("专业商业摄影风格，");

        // 图片类型描述
        switch (imageType.toLowerCase()) {
            case "banner":
                prompt.append("电商横幅广告图，");
                break;
            case "background":
                prompt.append("店铺背景装饰图，");
                break;
            case "icon":
                prompt.append("简洁图标设计，");
                break;
            case "product":
                prompt.append("产品展示图，");
                break;
            default:
                prompt.append("商业宣传图，");
        }

        // 产品描述
        if (StringUtils.hasText(product)) {
            prompt.append("展示").append(product).append("，");
        }

        // 风格描述
        prompt.append(getStyleDescription(style)).append("风格，");

        // 尺寸
        prompt.append("尺寸").append(size).append("像素，");

        // 质量要求
        prompt.append("高清晰度，专业灯光，精美构图");

        log.debug("Built default prompt: {}", prompt);
        return prompt.toString();
    }
}
