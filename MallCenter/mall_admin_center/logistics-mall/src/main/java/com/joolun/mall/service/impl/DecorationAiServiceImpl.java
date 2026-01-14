package com.joolun.mall.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.dto.decoration.AiDecorationResult;
import com.joolun.mall.dto.decoration.AiDecorationResult.ModuleConfig;
import com.joolun.mall.dto.decoration.AiDecorationResult.ModulePreference;
import com.joolun.mall.entity.AiDecorationSession;
import com.joolun.mall.entity.DecorationModule;
import com.joolun.mall.entity.DecorationThemePreset;
import com.joolun.mall.entity.MerchantPageConfig;
import com.joolun.mall.mapper.AiDecorationSessionMapper;
import com.joolun.mall.mapper.DecorationModuleMapper;
import com.joolun.mall.mapper.DecorationThemePresetMapper;
import com.joolun.mall.mapper.MerchantPageConfigMapper;
import com.joolun.mall.service.DecorationAiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * AI装修服务实现类
 * 集成DeepSeek API进行装修需求分析和配置推荐
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DecorationAiServiceImpl implements DecorationAiService {

    private final AiDecorationSessionMapper sessionMapper;
    private final DecorationThemePresetMapper themePresetMapper;
    private final DecorationModuleMapper moduleMapper;
    private final MerchantPageConfigMapper pageConfigMapper;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${ai.deepseek.api-key:}")
    private String deepseekApiKey;

    @Value("${ai.deepseek.base-url:https://api.deepseek.com}")
    private String deepseekBaseUrl;

    @Value("${ai.deepseek.model:deepseek-chat}")
    private String deepseekModel;

    /**
     * 装修AI助手System Prompt
     */
    private static final String DECORATION_SYSTEM_PROMPT = """
        你是一个专业的店铺装修AI助手，帮助商户设计小程序页面。
        分析用户描述，理解他们的行业特点、风格偏好和功能需求。

        请严格以JSON格式返回分析结果，不要包含任何其他文字：
        {
          "industry": "food/retail/beauty/other",
          "style": "fresh/luxury/simple/dopamine/elegant",
          "keywords": ["关键词1", "关键词2"],
          "colorTone": "green/gold/blue/orange/pink/neutral",
          "modulePreference": {
            "showCategory": true,
            "showBanner": true,
            "showQuickAction": true,
            "showRecommend": true,
            "showCountdown": false,
            "showAnnouncement": false,
            "showNewArrivals": false
          },
          "confidence": 0.85,
          "suggestion": "一句话装修建议"
        }

        行业判断规则：
        - food: 食品、餐饮、生鲜、零食、饮料
        - retail: 日用品、百货、服装、数码
        - beauty: 美妆、护肤、美容、个护
        - other: 其他行业

        风格判断规则：
        - fresh: 清新自然，适合食品生鲜
        - luxury: 高端奢华，适合精品高档商品
        - simple: 简约现代，适合数码科技
        - dopamine: 多巴胺风格，色彩鲜艳活泼
        - elegant: 优雅精致，适合美妆个护

        色调判断规则：
        - green: 自然健康感
        - gold: 高端品质感
        - blue: 科技信任感
        - orange: 活力促销感
        - pink: 甜美女性化
        - neutral: 中性百搭
        """;

    /**
     * 微调请求的System Prompt
     */
    private static final String REFINE_SYSTEM_PROMPT = """
        你是一个专业的店铺装修AI助手。
        用户正在调整之前的装修方案，请根据用户的新需求，在原有基础上进行调整。

        请严格以JSON格式返回调整后的结果，格式与之前相同：
        {
          "industry": "food/retail/beauty/other",
          "style": "fresh/luxury/simple/dopamine/elegant",
          "keywords": ["关键词1", "关键词2"],
          "colorTone": "green/gold/blue/orange/pink/neutral",
          "modulePreference": {
            "showCategory": true,
            "showBanner": true,
            "showQuickAction": true,
            "showRecommend": true,
            "showCountdown": false,
            "showAnnouncement": false,
            "showNewArrivals": false
          },
          "confidence": 0.85,
          "suggestion": "一句话装修建议"
        }
        """;

    /**
     * 风格到色调的默认映射
     */
    private static final Map<String, String> STYLE_TO_COLOR_MAP = Map.of(
            "fresh", "green",
            "luxury", "gold",
            "simple", "neutral",
            "dopamine", "orange",
            "elegant", "pink"
    );

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AiDecorationResult analyze(String prompt, Long merchantId) {
        if (prompt == null || prompt.trim().isEmpty()) {
            return AiDecorationResult.failure("装修需求描述不能为空");
        }

        String sessionId = UUID.randomUUID().toString();
        log.info("开始AI装修分析: sessionId={}, merchantId={}, prompt={}", sessionId, merchantId, prompt);

        try {
            // 1. 调用AI API分析用户需求
            Map<String, Object> aiAnalysis = callDeepSeekApi(prompt, DECORATION_SYSTEM_PROMPT);

            // 2. 构建分析结果
            AiDecorationResult result = buildResultFromAnalysis(sessionId, aiAnalysis);

            // 3. 根据分析结果匹配预设主题
            List<DecorationThemePreset> matchedThemes = matchThemePresets(
                    result.getStyle(),
                    result.getColorTone()
            );
            result.setRecommendedThemes(matchedThemes);

            // 选择最佳匹配主题
            if (!matchedThemes.isEmpty()) {
                result.setBestMatchTheme(matchedThemes.get(0));
            }

            // 4. 根据模块偏好生成模块配置
            List<ModuleConfig> moduleConfigs = generateModuleConfigs(result.getModulePreference());
            result.setRecommendedModules(moduleConfigs);

            // 5. 生成完整的页面配置JSON
            String generatedConfig = generatePageConfig(result);
            result.setGeneratedConfig(generatedConfig);

            // 6. 保存会话记录
            saveSession(sessionId, merchantId, prompt, result);

            // 7. 设置AI响应
            String suggestion = (String) aiAnalysis.getOrDefault("suggestion", "");
            result.setAiResponse(buildAiResponse(result, suggestion));
            result.setSuccess(true);

            log.info("AI装修分析完成: sessionId={}, industry={}, style={}, confidence={}",
                    sessionId, result.getIndustry(), result.getStyle(), result.getConfidence());

            return result;

        } catch (Exception e) {
            log.error("AI装修分析失败: sessionId={}, error={}", sessionId, e.getMessage(), e);
            return AiDecorationResult.failure("AI分析失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean applyConfig(String sessionId) {
        if (sessionId == null || sessionId.isEmpty()) {
            log.warn("应用配置失败: sessionId为空");
            return false;
        }

        try {
            // 1. 获取会话
            AiDecorationSession session = sessionMapper.selectBySessionId(sessionId);
            if (session == null) {
                log.warn("应用配置失败: 会话不存在, sessionId={}", sessionId);
                return false;
            }

            if (!"active".equals(session.getStatus())) {
                log.warn("应用配置失败: 会话状态不是active, sessionId={}, status={}",
                        sessionId, session.getStatus());
                return false;
            }

            // 2. 获取或创建商户页面配置
            Long merchantId = session.getMerchantId();
            MerchantPageConfig pageConfig = pageConfigMapper.selectByMerchantAndPageType(merchantId, "home");

            if (pageConfig == null) {
                pageConfig = new MerchantPageConfig();
                pageConfig.setMerchantId(merchantId);
                pageConfig.setPageType("home");
                pageConfig.setPageName("首页");
                pageConfig.setStatus(0); // 草稿状态
                pageConfig.setVersion(1);
                pageConfig.setCreateTime(LocalDateTime.now());
            }

            // 3. 应用AI生成的配置
            pageConfig.setModulesConfig(session.getGeneratedConfig());

            // 解析推荐的主题
            if (session.getRecommendedThemes() != null) {
                try {
                    List<Long> themeIds = objectMapper.readValue(
                            session.getRecommendedThemes(),
                            new TypeReference<List<Long>>() {}
                    );
                    if (!themeIds.isEmpty()) {
                        pageConfig.setThemePresetId(themeIds.get(0));
                    }
                } catch (Exception e) {
                    log.warn("解析推荐主题ID失败", e);
                }
            }

            pageConfig.setUpdateTime(LocalDateTime.now());

            // 4. 保存页面配置
            if (pageConfig.getId() == null) {
                pageConfigMapper.insert(pageConfig);
            } else {
                pageConfigMapper.updateById(pageConfig);
            }

            // 5. 更新会话状态
            session.setStatus("completed");
            session.setIsApplied(1);
            session.setAppliedTime(LocalDateTime.now());
            session.setPageConfigId(pageConfig.getId());
            session.setUpdateTime(LocalDateTime.now());
            sessionMapper.updateById(session);

            log.info("成功应用AI装修配置: sessionId={}, merchantId={}, pageConfigId={}",
                    sessionId, merchantId, pageConfig.getId());

            return true;

        } catch (Exception e) {
            log.error("应用AI配置失败: sessionId={}, error={}", sessionId, e.getMessage(), e);
            return false;
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AiDecorationResult refine(String sessionId, String refinement) {
        if (sessionId == null || sessionId.isEmpty()) {
            return AiDecorationResult.failure("会话ID不能为空");
        }

        if (refinement == null || refinement.trim().isEmpty()) {
            return AiDecorationResult.failure("微调描述不能为空");
        }

        try {
            // 1. 获取会话
            AiDecorationSession session = sessionMapper.selectBySessionId(sessionId);
            if (session == null) {
                return AiDecorationResult.failure("会话不存在或已过期");
            }

            if (!"active".equals(session.getStatus())) {
                return AiDecorationResult.failure("会话已完成或已放弃，无法微调");
            }

            // 2. 构建微调请求
            String previousAnalysis = session.getAiAnalysis();
            String userMessage = String.format(
                    "原始需求：%s\n\n原始分析结果：%s\n\n用户新的调整需求：%s",
                    session.getUserRequirement(),
                    previousAnalysis,
                    refinement
            );

            // 3. 调用AI进行微调分析
            Map<String, Object> aiAnalysis = callDeepSeekApi(userMessage, REFINE_SYSTEM_PROMPT);

            // 4. 构建新的分析结果
            AiDecorationResult result = buildResultFromAnalysis(sessionId, aiAnalysis);

            // 5. 重新匹配主题
            List<DecorationThemePreset> matchedThemes = matchThemePresets(
                    result.getStyle(),
                    result.getColorTone()
            );
            result.setRecommendedThemes(matchedThemes);
            if (!matchedThemes.isEmpty()) {
                result.setBestMatchTheme(matchedThemes.get(0));
            }

            // 6. 重新生成模块配置
            List<ModuleConfig> moduleConfigs = generateModuleConfigs(result.getModulePreference());
            result.setRecommendedModules(moduleConfigs);

            // 7. 重新生成页面配置
            String generatedConfig = generatePageConfig(result);
            result.setGeneratedConfig(generatedConfig);

            // 8. 更新会话记录
            updateSessionWithRefinement(session, refinement, result);

            // 9. 设置AI响应
            String suggestion = (String) aiAnalysis.getOrDefault("suggestion", "");
            result.setAiResponse(buildAiResponse(result, suggestion));
            result.setSuccess(true);

            log.info("AI装修微调完成: sessionId={}, newStyle={}, newColorTone={}",
                    sessionId, result.getStyle(), result.getColorTone());

            return result;

        } catch (Exception e) {
            log.error("AI装修微调失败: sessionId={}, error={}", sessionId, e.getMessage(), e);
            return AiDecorationResult.failure("微调失败: " + e.getMessage());
        }
    }

    @Override
    public AiDecorationResult getSessionResult(String sessionId) {
        if (sessionId == null || sessionId.isEmpty()) {
            return AiDecorationResult.failure("会话ID不能为空");
        }

        try {
            AiDecorationSession session = sessionMapper.selectBySessionId(sessionId);
            if (session == null) {
                return AiDecorationResult.failure("会话不存在");
            }

            // 从会话记录中恢复结果
            AiDecorationResult result = AiDecorationResult.success(sessionId);

            if (session.getAiAnalysis() != null) {
                Map<String, Object> analysis = objectMapper.readValue(
                        session.getAiAnalysis(),
                        new TypeReference<Map<String, Object>>() {}
                );
                populateResultFromAnalysis(result, analysis);
            }

            result.setGeneratedConfig(session.getGeneratedConfig());

            // 获取推荐主题
            if (session.getRecommendedThemes() != null) {
                List<Long> themeIds = objectMapper.readValue(
                        session.getRecommendedThemes(),
                        new TypeReference<List<Long>>() {}
                );
                if (!themeIds.isEmpty()) {
                    List<DecorationThemePreset> themes = themePresetMapper.selectBatchIds(themeIds);
                    result.setRecommendedThemes(themes);
                    if (!themes.isEmpty()) {
                        result.setBestMatchTheme(themes.get(0));
                    }
                }
            }

            return result;

        } catch (Exception e) {
            log.error("获取会话结果失败: sessionId={}, error={}", sessionId, e.getMessage(), e);
            return AiDecorationResult.failure("获取会话失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean abandonSession(String sessionId) {
        if (sessionId == null || sessionId.isEmpty()) {
            return false;
        }

        try {
            AiDecorationSession session = sessionMapper.selectBySessionId(sessionId);
            if (session == null) {
                return false;
            }

            session.setStatus("abandoned");
            session.setUpdateTime(LocalDateTime.now());
            sessionMapper.updateById(session);

            log.info("会话已放弃: sessionId={}", sessionId);
            return true;

        } catch (Exception e) {
            log.error("放弃会话失败: sessionId={}, error={}", sessionId, e.getMessage(), e);
            return false;
        }
    }

    // ==================== 私有方法 ====================

    /**
     * 调用DeepSeek API
     */
    private Map<String, Object> callDeepSeekApi(String userMessage, String systemPrompt) {
        if (deepseekApiKey == null || deepseekApiKey.isEmpty()) {
            log.warn("AI API Key未配置，使用降级分析");
            return fallbackAnalysis(userMessage);
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(deepseekApiKey);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", deepseekModel);
            requestBody.put("messages", List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userMessage)
            ));
            requestBody.put("temperature", 0.7);

            String apiUrl = deepseekBaseUrl + "/v1/chat/completions";
            log.debug("调用装修AI API: url={}, model={}", apiUrl, deepseekModel);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl,
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String content = root.path("choices").path(0).path("message").path("content").asText();

                // 尝试解析JSON
                try {
                    return objectMapper.readValue(content, new TypeReference<Map<String, Object>>() {});
                } catch (Exception jsonEx) {
                    // 尝试从文本中提取JSON
                    String jsonContent = extractJsonFromText(content);
                    if (jsonContent != null) {
                        return objectMapper.readValue(jsonContent, new TypeReference<Map<String, Object>>() {});
                    }
                    log.warn("AI返回内容解析失败，使用降级分析: {}", content);
                }
            }
        } catch (Exception e) {
            log.error("DeepSeek API调用失败: {}", e.getMessage(), e);
        }

        return fallbackAnalysis(userMessage);
    }

    /**
     * 从文本中提取JSON
     */
    private String extractJsonFromText(String text) {
        if (text == null) return null;

        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');

        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return null;
    }

    /**
     * 降级分析 - 基于关键词的简单分析
     */
    private Map<String, Object> fallbackAnalysis(String message) {
        Map<String, Object> result = new HashMap<>();

        // 行业判断
        String industry = "other";
        if (message.contains("食品") || message.contains("餐饮") || message.contains("生鲜") ||
                message.contains("零食") || message.contains("饮料") || message.contains("美食")) {
            industry = "food";
        } else if (message.contains("美妆") || message.contains("护肤") || message.contains("化妆") ||
                message.contains("美容")) {
            industry = "beauty";
        } else if (message.contains("服装") || message.contains("百货") || message.contains("日用") ||
                message.contains("数码")) {
            industry = "retail";
        }

        // 风格判断
        String style = "simple";
        if (message.contains("高端") || message.contains("奢华") || message.contains("品质")) {
            style = "luxury";
        } else if (message.contains("清新") || message.contains("自然") || message.contains("健康")) {
            style = "fresh";
        } else if (message.contains("活泼") || message.contains("多彩") || message.contains("年轻")) {
            style = "dopamine";
        } else if (message.contains("优雅") || message.contains("精致") || message.contains("女性")) {
            style = "elegant";
        }

        // 色调
        String colorTone = STYLE_TO_COLOR_MAP.getOrDefault(style, "neutral");

        // 提取关键词
        List<String> keywords = extractKeywords(message);

        // 模块偏好
        Map<String, Boolean> modulePreference = new HashMap<>();
        modulePreference.put("showCategory", true);
        modulePreference.put("showBanner", true);
        modulePreference.put("showQuickAction", message.contains("快捷") || message.contains("便捷"));
        modulePreference.put("showRecommend", true);
        modulePreference.put("showCountdown", message.contains("秒杀") || message.contains("限时") || message.contains("促销"));
        modulePreference.put("showAnnouncement", message.contains("公告") || message.contains("通知"));
        modulePreference.put("showNewArrivals", message.contains("新品") || message.contains("上新"));

        result.put("industry", industry);
        result.put("style", style);
        result.put("colorTone", colorTone);
        result.put("keywords", keywords);
        result.put("modulePreference", modulePreference);
        result.put("confidence", 0.6);
        result.put("suggestion", "基于关键词分析的装修建议");

        return result;
    }

    /**
     * 提取关键词
     */
    private List<String> extractKeywords(String message) {
        return Arrays.stream(message.split("[，。？！、\\s]+"))
                .filter(s -> s.length() >= 2 && s.length() <= 6)
                .distinct()
                .limit(5)
                .collect(Collectors.toList());
    }

    /**
     * 从AI分析结果构建AiDecorationResult
     */
    private AiDecorationResult buildResultFromAnalysis(String sessionId, Map<String, Object> analysis) {
        AiDecorationResult result = AiDecorationResult.success(sessionId);
        populateResultFromAnalysis(result, analysis);
        return result;
    }

    /**
     * 填充分析结果到AiDecorationResult
     */
    @SuppressWarnings("unchecked")
    private void populateResultFromAnalysis(AiDecorationResult result, Map<String, Object> analysis) {
        result.setIndustry((String) analysis.getOrDefault("industry", "other"));
        result.setStyle((String) analysis.getOrDefault("style", "simple"));
        result.setColorTone((String) analysis.getOrDefault("colorTone", "neutral"));
        result.setKeywords((List<String>) analysis.getOrDefault("keywords", new ArrayList<>()));

        // 处理confidence，可能是整数或浮点数
        Object confidenceObj = analysis.getOrDefault("confidence", 0.5);
        if (confidenceObj instanceof Number) {
            result.setConfidence(((Number) confidenceObj).doubleValue());
        }

        // 处理模块偏好
        ModulePreference modulePreference = new ModulePreference();
        Object mpObj = analysis.get("modulePreference");
        if (mpObj instanceof Map) {
            Map<String, Object> mp = (Map<String, Object>) mpObj;
            modulePreference.setShowCategory(getBooleanValue(mp, "showCategory", true));
            modulePreference.setShowBanner(getBooleanValue(mp, "showBanner", true));
            modulePreference.setShowQuickAction(getBooleanValue(mp, "showQuickAction", true));
            modulePreference.setShowRecommend(getBooleanValue(mp, "showRecommend", true));
            modulePreference.setShowCountdown(getBooleanValue(mp, "showCountdown", false));
            modulePreference.setShowAnnouncement(getBooleanValue(mp, "showAnnouncement", false));
            modulePreference.setShowNewArrivals(getBooleanValue(mp, "showNewArrivals", false));
        }
        result.setModulePreference(modulePreference);
    }

    /**
     * 安全获取布尔值
     */
    private boolean getBooleanValue(Map<String, Object> map, String key, boolean defaultValue) {
        Object value = map.get(key);
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        return defaultValue;
    }

    /**
     * 匹配预设主题
     */
    private List<DecorationThemePreset> matchThemePresets(String style, String colorTone) {
        List<DecorationThemePreset> themes = new ArrayList<>();

        // 1. 先按风格匹配
        if (style != null && !style.isEmpty()) {
            List<DecorationThemePreset> styleMatched = themePresetMapper.selectByStyleType(style);
            themes.addAll(styleMatched);
        }

        // 2. 如果没有匹配到，获取所有启用的主题
        if (themes.isEmpty()) {
            themes = themePresetMapper.selectActiveList();
        }

        // 3. 按色调优先级排序
        if (colorTone != null && !colorTone.isEmpty()) {
            final String targetColor = colorTone.toLowerCase();
            themes.sort((a, b) -> {
                String aPrimary = getColorFromConfig(a.getColorConfig(), "primaryColor");
                String bPrimary = getColorFromConfig(b.getColorConfig(), "primaryColor");
                boolean aMatch = aPrimary != null && aPrimary.toLowerCase().contains(targetColor);
                boolean bMatch = bPrimary != null && bPrimary.toLowerCase().contains(targetColor);
                return Boolean.compare(bMatch, aMatch);
            });
        }

        // 最多返回5个
        return themes.stream().limit(5).collect(Collectors.toList());
    }

    /**
     * 根据模块偏好生成模块配置列表
     */
    private List<ModuleConfig> generateModuleConfigs(ModulePreference preference) {
        List<ModuleConfig> configs = new ArrayList<>();

        // 获取所有可用模块
        List<DecorationModule> allModules = moduleMapper.selectActiveList();
        if (allModules == null || allModules.isEmpty()) {
            // 如果没有预设模块，生成默认配置
            return generateDefaultModuleConfigs(preference);
        }

        // 模块代码到偏好的映射
        Map<String, Boolean> preferenceMap = Map.of(
                "banner", preference.isShowBanner(),
                "category", preference.isShowCategory(),
                "quick_action", preference.isShowQuickAction(),
                "recommend", preference.isShowRecommend(),
                "countdown", preference.isShowCountdown(),
                "announcement", preference.isShowAnnouncement(),
                "new_arrivals", preference.isShowNewArrivals()
        );

        int sortOrder = 0;
        for (DecorationModule module : allModules) {
            String code = module.getCode();
            Boolean enabled = preferenceMap.get(code);

            if (enabled == null) {
                // 未在偏好中定义的模块，默认不启用
                enabled = false;
            }

            ModuleConfig config = new ModuleConfig();
            config.setModuleId(module.getId());
            config.setModuleCode(code);
            config.setModuleName(module.getName());
            config.setEnabled(enabled);
            config.setSortOrder(sortOrder++);

            // 解析默认参数
            if (module.getDefaultParams() != null) {
                try {
                    Map<String, Object> params = objectMapper.readValue(
                            module.getDefaultParams(),
                            new TypeReference<Map<String, Object>>() {}
                    );
                    config.setParams(params);
                } catch (Exception e) {
                    config.setParams(new HashMap<>());
                }
            } else {
                config.setParams(new HashMap<>());
            }

            configs.add(config);
        }

        // 按启用状态和排序排列
        configs.sort((a, b) -> {
            if (a.isEnabled() != b.isEnabled()) {
                return Boolean.compare(b.isEnabled(), a.isEnabled());
            }
            return Integer.compare(a.getSortOrder(), b.getSortOrder());
        });

        return configs;
    }

    /**
     * 生成默认模块配置
     */
    private List<ModuleConfig> generateDefaultModuleConfigs(ModulePreference preference) {
        List<ModuleConfig> configs = new ArrayList<>();
        int order = 0;

        // Banner
        ModuleConfig bannerConfig = new ModuleConfig();
        bannerConfig.setModuleCode("banner");
        bannerConfig.setModuleName("轮播图");
        bannerConfig.setEnabled(preference.isShowBanner());
        bannerConfig.setSortOrder(order++);
        bannerConfig.setParams(Map.of("autoplay", true, "interval", 3000));
        configs.add(bannerConfig);

        // Category
        ModuleConfig categoryConfig = new ModuleConfig();
        categoryConfig.setModuleCode("category");
        categoryConfig.setModuleName("分类导航");
        categoryConfig.setEnabled(preference.isShowCategory());
        categoryConfig.setSortOrder(order++);
        categoryConfig.setParams(Map.of("columns", 4, "showMore", true));
        configs.add(categoryConfig);

        // Quick Action
        ModuleConfig quickConfig = new ModuleConfig();
        quickConfig.setModuleCode("quick_action");
        quickConfig.setModuleName("快捷入口");
        quickConfig.setEnabled(preference.isShowQuickAction());
        quickConfig.setSortOrder(order++);
        quickConfig.setParams(Map.of("columns", 4));
        configs.add(quickConfig);

        // Countdown
        ModuleConfig countdownConfig = new ModuleConfig();
        countdownConfig.setModuleCode("countdown");
        countdownConfig.setModuleName("限时秒杀");
        countdownConfig.setEnabled(preference.isShowCountdown());
        countdownConfig.setSortOrder(order++);
        countdownConfig.setParams(Map.of("showTimer", true));
        configs.add(countdownConfig);

        // Recommend
        ModuleConfig recommendConfig = new ModuleConfig();
        recommendConfig.setModuleCode("recommend");
        recommendConfig.setModuleName("推荐商品");
        recommendConfig.setEnabled(preference.isShowRecommend());
        recommendConfig.setSortOrder(order++);
        recommendConfig.setParams(Map.of("columns", 2, "rows", 4));
        configs.add(recommendConfig);

        return configs;
    }

    /**
     * 生成页面配置JSON
     */
    private String generatePageConfig(AiDecorationResult result) {
        try {
            Map<String, Object> config = new HashMap<>();
            config.put("industry", result.getIndustry());
            config.put("style", result.getStyle());
            config.put("colorTone", result.getColorTone());

            // 主题配置
            if (result.getBestMatchTheme() != null) {
                Map<String, Object> themeConfig = new HashMap<>();
                DecorationThemePreset theme = result.getBestMatchTheme();
                themeConfig.put("themeId", theme.getId());
                themeConfig.put("primaryColor", getColorFromConfig(theme.getColorConfig(), "primaryColor"));
                themeConfig.put("secondaryColor", getColorFromConfig(theme.getColorConfig(), "secondaryColor"));
                themeConfig.put("backgroundColor", getColorFromConfig(theme.getColorConfig(), "backgroundColor"));
                themeConfig.put("textColor", getColorFromConfig(theme.getColorConfig(), "textColor"));
                config.put("theme", themeConfig);
            }

            // 模块配置
            List<Map<String, Object>> modulesConfig = new ArrayList<>();
            for (ModuleConfig mc : result.getRecommendedModules()) {
                Map<String, Object> moduleMap = new HashMap<>();
                moduleMap.put("code", mc.getModuleCode());
                moduleMap.put("name", mc.getModuleName());
                moduleMap.put("enabled", mc.isEnabled());
                moduleMap.put("sortOrder", mc.getSortOrder());
                moduleMap.put("params", mc.getParams());
                modulesConfig.add(moduleMap);
            }
            config.put("modules", modulesConfig);

            return objectMapper.writeValueAsString(config);

        } catch (JsonProcessingException e) {
            log.error("生成页面配置JSON失败", e);
            return "{}";
        }
    }

    /**
     * 保存会话记录
     */
    private void saveSession(String sessionId, Long merchantId, String prompt, AiDecorationResult result) {
        try {
            AiDecorationSession session = new AiDecorationSession();
            session.setSessionId(sessionId);
            session.setMerchantId(merchantId);
            session.setTitle(prompt.length() > 50 ? prompt.substring(0, 50) + "..." : prompt);
            session.setStatus("active");
            session.setUserRequirement(prompt);

            // 保存AI分析结果
            Map<String, Object> analysisMap = new HashMap<>();
            analysisMap.put("industry", result.getIndustry());
            analysisMap.put("style", result.getStyle());
            analysisMap.put("colorTone", result.getColorTone());
            analysisMap.put("keywords", result.getKeywords());
            analysisMap.put("confidence", result.getConfidence());
            analysisMap.put("modulePreference", result.getModulePreference());
            session.setAiAnalysis(objectMapper.writeValueAsString(analysisMap));

            // 保存推荐主题ID
            if (result.getRecommendedThemes() != null && !result.getRecommendedThemes().isEmpty()) {
                List<Long> themeIds = result.getRecommendedThemes().stream()
                        .map(DecorationThemePreset::getId)
                        .collect(Collectors.toList());
                session.setRecommendedThemes(objectMapper.writeValueAsString(themeIds));
            }

            session.setGeneratedConfig(result.getGeneratedConfig());
            session.setIsApplied(0);
            session.setExpireTime(LocalDateTime.now().plusHours(24)); // 24小时过期
            session.setCreateTime(LocalDateTime.now());

            sessionMapper.insert(session);

        } catch (Exception e) {
            log.error("保存会话记录失败: sessionId={}", sessionId, e);
        }
    }

    /**
     * 更新会话（微调后）
     */
    private void updateSessionWithRefinement(AiDecorationSession session, String refinement, AiDecorationResult result) {
        try {
            // 更新对话历史
            List<Map<String, String>> history = new ArrayList<>();
            if (session.getConversationHistory() != null) {
                history = objectMapper.readValue(
                        session.getConversationHistory(),
                        new TypeReference<List<Map<String, String>>>() {}
                );
            }
            history.add(Map.of("role", "user", "content", refinement));
            history.add(Map.of("role", "assistant", "content", result.getAiResponse()));
            session.setConversationHistory(objectMapper.writeValueAsString(history));

            // 更新AI分析结果
            Map<String, Object> analysisMap = new HashMap<>();
            analysisMap.put("industry", result.getIndustry());
            analysisMap.put("style", result.getStyle());
            analysisMap.put("colorTone", result.getColorTone());
            analysisMap.put("keywords", result.getKeywords());
            analysisMap.put("confidence", result.getConfidence());
            analysisMap.put("modulePreference", result.getModulePreference());
            session.setAiAnalysis(objectMapper.writeValueAsString(analysisMap));

            // 更新推荐主题
            if (result.getRecommendedThemes() != null && !result.getRecommendedThemes().isEmpty()) {
                List<Long> themeIds = result.getRecommendedThemes().stream()
                        .map(DecorationThemePreset::getId)
                        .collect(Collectors.toList());
                session.setRecommendedThemes(objectMapper.writeValueAsString(themeIds));
            }

            session.setGeneratedConfig(result.getGeneratedConfig());
            session.setUpdateTime(LocalDateTime.now());

            sessionMapper.updateById(session);

        } catch (Exception e) {
            log.error("更新会话失败: sessionId={}", session.getSessionId(), e);
        }
    }

    /**
     * 构建AI响应文本
     */
    private String buildAiResponse(AiDecorationResult result, String suggestion) {
        StringBuilder sb = new StringBuilder();

        // 行业分析
        String industryName = switch (result.getIndustry()) {
            case "food" -> "食品/餐饮";
            case "retail" -> "零售/百货";
            case "beauty" -> "美妆/护肤";
            default -> "综合";
        };
        sb.append("根据您的描述，我分析您的店铺属于「").append(industryName).append("」行业。\n\n");

        // 风格推荐
        String styleName = switch (result.getStyle()) {
            case "fresh" -> "清新自然";
            case "luxury" -> "高端奢华";
            case "simple" -> "简约现代";
            case "dopamine" -> "多巴胺活力";
            case "elegant" -> "优雅精致";
            default -> "简约";
        };
        sb.append("推荐风格：").append(styleName).append("\n");

        // 色调推荐
        String colorName = switch (result.getColorTone()) {
            case "green" -> "自然绿";
            case "gold" -> "尊贵金";
            case "blue" -> "科技蓝";
            case "orange" -> "活力橙";
            case "pink" -> "甜美粉";
            default -> "中性色";
        };
        sb.append("推荐色调：").append(colorName).append("\n\n");

        // 模块推荐
        sb.append("推荐模块配置：\n");
        ModulePreference mp = result.getModulePreference();
        if (mp.isShowBanner()) sb.append("- 轮播图\n");
        if (mp.isShowCategory()) sb.append("- 分类导航\n");
        if (mp.isShowQuickAction()) sb.append("- 快捷入口\n");
        if (mp.isShowRecommend()) sb.append("- 推荐商品\n");
        if (mp.isShowCountdown()) sb.append("- 限时秒杀\n");
        if (mp.isShowNewArrivals()) sb.append("- 新品上架\n");

        // AI建议
        if (suggestion != null && !suggestion.isEmpty()) {
            sb.append("\n").append(suggestion);
        }

        return sb.toString();
    }

    /**
     * 从 colorConfig JSON 中获取指定颜色值
     */
    private String getColorFromConfig(String colorConfig, String colorKey) {
        if (colorConfig == null || colorConfig.isEmpty()) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(colorConfig);
            JsonNode colorNode = node.get(colorKey);
            return colorNode != null ? colorNode.asText() : null;
        } catch (Exception e) {
            log.warn("解析 colorConfig 失败: {}", e.getMessage());
            return null;
        }
    }

    // ==================== 通义万相 AI 图片生成 ====================

    /**
     * 通义万相 API Key (与 DashScope 共用)
     */
    @Value("${ai.wanxiang.api-key:${ai.dashscope.api-key:${ai.deepseek.api-key:}}}")
    private String wanxiangApiKey;

    /**
     * 通义万相 text2image API URL
     */
    @Value("${ai.wanxiang.text2image-url:https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis}")
    private String wanxiangText2ImageUrl;

    /**
     * 通义万相任务查询 API URL
     */
    @Value("${ai.wanxiang.task-query-url:https://dashscope.aliyuncs.com/api/v1/tasks/}")
    private String wanxiangTaskQueryUrl;

    /**
     * 默认图片尺寸
     */
    @Value("${ai.wanxiang.default-size:1280*720}")
    private String wanxiangDefaultSize;

    /**
     * 最大轮询次数
     */
    @Value("${ai.wanxiang.max-poll-count:60}")
    private int maxPollCount;

    /**
     * 轮询间隔（毫秒）
     */
    private static final long POLL_INTERVAL_MS = 2000;

    @Override
    public Map<String, Object> generateImage(String prompt, String style, String size) {
        Map<String, Object> result = new HashMap<>();

        if (prompt == null || prompt.trim().isEmpty()) {
            result.put("success", false);
            result.put("message", "图片描述不能为空");
            return result;
        }

        log.info("开始AI图片生成: prompt={}, style={}, size={}", prompt, style, size);

        try {
            // 1. 提交图片生成任务
            String taskId = submitImageGenerationTask(prompt, style, size);
            if (taskId == null) {
                result.put("success", false);
                result.put("message", "提交图片生成任务失败");
                return result;
            }

            log.info("图片生成任务已提交: taskId={}", taskId);

            // 2. 轮询获取任务结果
            Map<String, Object> taskResult = pollTaskResult(taskId);
            if (taskResult == null) {
                result.put("success", false);
                result.put("message", "获取图片生成结果超时");
                return result;
            }

            String taskStatus = (String) taskResult.get("status");
            if ("SUCCEEDED".equals(taskStatus)) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> results = (List<Map<String, Object>>) taskResult.get("results");
                if (results != null && !results.isEmpty()) {
                    String imageUrl = (String) results.get(0).get("url");
                    result.put("success", true);
                    result.put("imageUrl", imageUrl);
                    result.put("prompt", prompt);
                    result.put("taskId", taskId);
                    log.info("图片生成成功: taskId={}, imageUrl={}", taskId, imageUrl);
                } else {
                    result.put("success", false);
                    result.put("message", "图片生成结果为空");
                }
            } else {
                String errorMessage = (String) taskResult.getOrDefault("message", "图片生成失败");
                result.put("success", false);
                result.put("message", errorMessage);
                log.warn("图片生成失败: taskId={}, status={}, message={}", taskId, taskStatus, errorMessage);
            }

        } catch (Exception e) {
            log.error("AI图片生成异常: prompt={}, error={}", prompt, e.getMessage(), e);
            result.put("success", false);
            result.put("message", "图片生成失败: " + e.getMessage());
        }

        return result;
    }

    /**
     * 提交图片生成任务到通义万相
     *
     * @param prompt 图片描述
     * @param style  风格
     * @param size   尺寸
     * @return 任务ID，失败返回null
     */
    private String submitImageGenerationTask(String prompt, String style, String size) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + wanxiangApiKey);
            // 启用异步模式
            headers.set("X-DashScope-Async", "enable");

            // 构建请求体
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", "wanx-v1");

            // input 参数
            Map<String, Object> input = new HashMap<>();
            input.put("prompt", prompt);
            requestBody.put("input", input);

            // parameters 参数
            Map<String, Object> parameters = new HashMap<>();
            parameters.put("size", size != null ? size : wanxiangDefaultSize);
            parameters.put("n", 1);

            // 风格映射 (通义万相支持的风格)
            if (style != null && !style.isEmpty()) {
                String mappedStyle = mapToWanxiangStyle(style);
                if (mappedStyle != null) {
                    parameters.put("style", mappedStyle);
                }
            }

            requestBody.put("parameters", parameters);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

            log.debug("提交通义万相任务: url={}, body={}", wanxiangText2ImageUrl, requestBody);

            ResponseEntity<String> response = restTemplate.exchange(
                    wanxiangText2ImageUrl,
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode outputNode = root.path("output");
                String taskId = outputNode.path("task_id").asText(null);

                if (taskId != null && !taskId.isEmpty()) {
                    return taskId;
                }

                // 检查是否有错误
                String code = root.path("code").asText(null);
                String message = root.path("message").asText(null);
                if (code != null) {
                    log.error("通义万相返回错误: code={}, message={}", code, message);
                }
            }

        } catch (Exception e) {
            log.error("提交通义万相任务失败: {}", e.getMessage(), e);
        }

        return null;
    }

    /**
     * 轮询获取任务结果
     *
     * @param taskId 任务ID
     * @return 任务结果，超时或失败返回null
     */
    private Map<String, Object> pollTaskResult(String taskId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + wanxiangApiKey);

        HttpEntity<Void> request = new HttpEntity<>(headers);
        String queryUrl = wanxiangTaskQueryUrl + taskId;

        for (int i = 0; i < maxPollCount; i++) {
            try {
                Thread.sleep(POLL_INTERVAL_MS);

                ResponseEntity<String> response = restTemplate.exchange(
                        queryUrl,
                        HttpMethod.GET,
                        request,
                        String.class
                );

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    JsonNode root = objectMapper.readTree(response.getBody());
                    JsonNode outputNode = root.path("output");
                    String taskStatus = outputNode.path("task_status").asText();

                    log.debug("轮询任务状态: taskId={}, status={}, poll={}", taskId, taskStatus, i + 1);

                    if ("SUCCEEDED".equals(taskStatus)) {
                        Map<String, Object> result = new HashMap<>();
                        result.put("status", "SUCCEEDED");

                        // 获取生成的图片URL
                        JsonNode resultsNode = outputNode.path("results");
                        List<Map<String, Object>> results = new ArrayList<>();
                        if (resultsNode.isArray()) {
                            for (JsonNode resultNode : resultsNode) {
                                Map<String, Object> r = new HashMap<>();
                                r.put("url", resultNode.path("url").asText());
                                results.add(r);
                            }
                        }
                        result.put("results", results);
                        return result;

                    } else if ("FAILED".equals(taskStatus)) {
                        Map<String, Object> result = new HashMap<>();
                        result.put("status", "FAILED");
                        result.put("message", outputNode.path("message").asText("任务执行失败"));
                        return result;

                    } else if ("CANCELED".equals(taskStatus)) {
                        Map<String, Object> result = new HashMap<>();
                        result.put("status", "CANCELED");
                        result.put("message", "任务已取消");
                        return result;
                    }

                    // PENDING 或 RUNNING 状态，继续轮询
                }

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("轮询被中断: taskId={}", taskId);
                return null;

            } catch (Exception e) {
                log.error("轮询任务状态失败: taskId={}, error={}", taskId, e.getMessage());
            }
        }

        log.warn("轮询任务超时: taskId={}, maxPoll={}", taskId, maxPollCount);
        return null;
    }

    /**
     * 映射风格到通义万相支持的风格参数
     * 通义万相支持的风格: <auto>, <photography>, <portrait>, <3d cartoon>, <anime>,
     * <oil painting>, <watercolor>, <sketch>, <chinese painting>, <flat illustration>
     *
     * @param style 输入风格
     * @return 通义万相风格参数
     */
    private String mapToWanxiangStyle(String style) {
        if (style == null) return null;

        return switch (style.toLowerCase()) {
            case "realistic", "photo", "photography" -> "<photography>";
            case "portrait" -> "<portrait>";
            case "3d", "3d_cartoon", "cartoon" -> "<3d cartoon>";
            case "anime" -> "<anime>";
            case "oil", "oil_painting" -> "<oil painting>";
            case "watercolor" -> "<watercolor>";
            case "sketch" -> "<sketch>";
            case "chinese", "chinese_painting" -> "<chinese painting>";
            case "flat", "illustration" -> "<flat illustration>";
            default -> "<auto>";
        };
    }
}
