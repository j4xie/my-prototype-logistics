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
import com.joolun.mall.mapper.MerchantPageConfigVersionMapper;
import com.joolun.mall.entity.MerchantPageConfigVersion;
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
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * AI装修服务实现类
 * 集成LLM API进行装修需求分析和配置推荐
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DecorationAiServiceImpl implements DecorationAiService {

    private final AiDecorationSessionMapper sessionMapper;
    private final DecorationThemePresetMapper themePresetMapper;
    private final DecorationModuleMapper moduleMapper;
    private final MerchantPageConfigMapper pageConfigMapper;
    private final MerchantPageConfigVersionMapper versionMapper;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${ai.llm.api-key:}")
    private String llmApiKey;

    @Value("${ai.llm.base-url:}")
    private String llmBaseUrl;

    @Value("${ai.llm.model:}")
    private String llmModel;

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
            Map<String, Object> aiAnalysis = callLlmApi(prompt, DECORATION_SYSTEM_PROMPT);

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
            Map<String, Object> aiAnalysis = callLlmApi(userMessage, REFINE_SYSTEM_PROMPT);

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
     * 调用LLM API
     */
    private Map<String, Object> callLlmApi(String userMessage, String systemPrompt) {
        if (llmApiKey == null || llmApiKey.isEmpty()) {
            log.warn("AI API Key未配置，使用降级分析");
            return fallbackAnalysis(userMessage);
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(llmApiKey);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", llmModel);
            requestBody.put("messages", List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userMessage)
            ));
            requestBody.put("temperature", 0.7);

            String apiUrl = llmBaseUrl + "/v1/chat/completions";
            log.debug("调用装修AI API: url={}, model={}", apiUrl, llmModel);

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
            log.error("LLM API调用失败: {}", e.getMessage(), e);
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
        modulePreference.put("showReferral", message.contains("分销") || message.contains("裂变") || message.contains("邀请") || message.contains("推广"));
        modulePreference.put("showLicense", message.contains("资质") || message.contains("许可") || message.contains("安全") || message.contains("SC"));

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
            modulePreference.setShowReferral(getBooleanValue(mp, "showReferral", false));
            modulePreference.setShowLicense(getBooleanValue(mp, "showLicense", false));
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
        Map<String, Boolean> preferenceMap = new HashMap<>();
        preferenceMap.put("banner", preference.isShowBanner());
        preferenceMap.put("category", preference.isShowCategory());
        preferenceMap.put("quick_action", preference.isShowQuickAction());
        preferenceMap.put("recommend", preference.isShowRecommend());
        preferenceMap.put("countdown", preference.isShowCountdown());
        preferenceMap.put("announcement", preference.isShowAnnouncement());
        preferenceMap.put("new_arrivals", preference.isShowNewArrivals());
        preferenceMap.put("referral_banner", preference.isShowReferral());
        preferenceMap.put("license_badge", preference.isShowLicense());

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
    @Value("${ai.wanxiang.api-key:${ai.dashscope.api-key:${ai.llm.api-key:}}}")
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

    // ==================== 装修对话式AI助手 ====================

    private static final String CHAT_SYSTEM_PROMPT = """
        你是店铺装修AI助手。可以推荐主题、修改店铺信息、管理页面模块、应用页面模板。

        ## 可用主题
        - fresh_green(清新绿) ocean_blue(海洋蓝) classic_gold(经典金) sweet_pink(甜美粉)
        - dopamine_orange(活力橙) tech_blue(科技蓝) minimal_white(简约白) garden_green(田园绿)
        - beauty_purple(美妆紫) dark_night(深夜黑) natural_wood(自然木) tea_brown(茶韵棕)
        - festival_red(节日红) glacier_blue(冰川蓝) baby_warm(母婴暖)

        ## 可用模块
        - header: 顶部导航(logo+搜索)
        - notice_bar: 通知栏(滚动公告)
        - banner: 轮播图(支持多张)
        - category_grid: 分类导航(4列网格)
        - quick_actions: 快捷入口(扫码/AI)
        - product_scroll: 横向商品(热销单品)
        - product_grid: 商品网格(推荐商品,支持2-3列)
        - text_image: 图文内容(自定义文字+图片)
        - image_ad: 广告图片(促销海报)
        - ai_float: AI悬浮按钮
        - video: 视频播放(props: videoUrl, posterUrl, title, autoplay, loop)
        - countdown: 倒计时(props: title, subtitle, endTime)
        - coupon: 优惠券(props: title, 自动加载可用券)
        - announcement: 公告(props: content)
        - new_arrivals: 新品推荐(按创建时间倒序, props: title)
        - referral_banner: 分销裂变入口(邀请好友得奖励, props: title, desc)
        - license_badge: 食品资质展示(经营许可证/SC编号, props: title, licenseNo, scCode, businessLicense)

        ## 可用模板
        - food_standard: 食品溯源标准版(全功能)
        - fresh_direct: 生鲜直供版(大图商品为主)
        - restaurant: 餐饮商家版(门店+菜品)
        - minimal: 简约精选版(极简风)
        - hotpot: 火锅专属版(门店氛围+招牌菜)
        - bakery: 烘焙甜品版(甜品展示+新品)

        ## 操作示例
        用户说"帮我设计火锅店首页" → apply_template: hotpot + recommend theme: festival_red
        用户说"去掉分类导航" → remove_module: category_grid
        用户说"加一个促销图" → add_module: image_ad
        用户说"商品改成3列" → update_module: product_grid, props: {columns: 3}
        用户说"把通知栏移到轮播下面" → reorder_modules
        用户说"隐藏快捷入口" → toggle_module: quick_actions, visible: false
        用户说"帮我生成一张轮播图" → generate_image, imagePrompt: "...", imageTarget: "banner"
        用户说"生成一张促销海报" → generate_image, imagePrompt: "...", imageTarget: "image_ad"

        请用```json```代码块回复:
        ```json
        {
          "reply": "自然语言回复",
          "action": "recommend|apply|update_info|apply_template|add_module|remove_module|update_module|reorder_modules|toggle_module|generate_image|none",
          "themeCode": "主题编码(主题相关时)",
          "templateCode": "模板编码(应用模板时)",
          "moduleType": "模块类型(模块操作时)",
          "moduleProps": {},
          "moduleOrder": [{"type":"...", "order": 0}],
          "visible": true,
          "shopName": "店名(修改时填)",
          "slogan": "宣传语(修改时填)",
          "noticeTexts": ["通知1","通知2"],
          "imagePrompt": "AI生图提示词(generate_image时填,用英文描述)",
          "imageTarget": "banner|image_ad|text_image(生成图片用于哪个模块)"
        }
        ```

        ## 图片URL处理
        - "设置轮播图图片：url1,url2" → action=update_module, moduleType=banner, moduleProps={images:[url1,url2]}
        - "设置广告图图片：url" → action=update_module, moduleType=image_ad, moduleProps={imageUrl:url}
        - "设置图文图片：url" → action=update_module, moduleType=text_image, moduleProps={imageUrl:url}
        - "更新图文模块：标题=X 内容=Y 图片=url" → action=update_module, moduleType=text_image, moduleProps={title:X, content:Y, imageUrl:url}

        重要规则:
        - themeCode只填英文编码(如fresh_green)
        - "应用"/"确认"/"就这个" → action=apply
        - "推荐" → action=recommend
        - "去掉"/"删除"/"移除"+模块 → action=remove_module
        - "加"/"添加"+模块 → action=add_module
        - "隐藏"/"显示"+模块 → action=toggle_module
        - "模板"+行业 → action=apply_template
        - 普通对话 → action=none
        """;

    private static final Map<String, Map<String, String>> THEME_COLOR_MAP = Map.ofEntries(
            Map.entry("fresh_green", Map.ofEntries(
                    Map.entry("primaryColor", "#52c41a"), Map.entry("secondaryColor", "#95de64"),
                    Map.entry("backgroundColor", "#f6ffed"), Map.entry("textColor", "#135200"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#b7eb8f"),
                    Map.entry("headerGradientStart", "#52c41a"), Map.entry("headerGradientEnd", "#95de64"),
                    Map.entry("buttonColor", "#52c41a"), Map.entry("accentColor", "#73d13d"),
                    Map.entry("shadowColor", "rgba(82,196,26,0.15)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("ocean_blue", Map.ofEntries(
                    Map.entry("primaryColor", "#1890ff"), Map.entry("secondaryColor", "#69c0ff"),
                    Map.entry("backgroundColor", "#e6f7ff"), Map.entry("textColor", "#003a8c"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#91d5ff"),
                    Map.entry("headerGradientStart", "#1890ff"), Map.entry("headerGradientEnd", "#69c0ff"),
                    Map.entry("buttonColor", "#1890ff"), Map.entry("accentColor", "#40a9ff"),
                    Map.entry("shadowColor", "rgba(24,144,255,0.15)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("classic_gold", Map.ofEntries(
                    Map.entry("primaryColor", "#D4AF37"), Map.entry("secondaryColor", "#F0D58C"),
                    Map.entry("backgroundColor", "#FFFBE6"), Map.entry("textColor", "#614700"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#FFE58F"),
                    Map.entry("headerGradientStart", "#D4AF37"), Map.entry("headerGradientEnd", "#F0D58C"),
                    Map.entry("buttonColor", "#D4AF37"), Map.entry("accentColor", "#FAAD14"),
                    Map.entry("shadowColor", "rgba(212,175,55,0.15)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("sweet_pink", Map.ofEntries(
                    Map.entry("primaryColor", "#eb2f96"), Map.entry("secondaryColor", "#ff85c0"),
                    Map.entry("backgroundColor", "#fff0f6"), Map.entry("textColor", "#780650"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#ffadd2"),
                    Map.entry("headerGradientStart", "#eb2f96"), Map.entry("headerGradientEnd", "#ff85c0"),
                    Map.entry("buttonColor", "#eb2f96"), Map.entry("accentColor", "#f759ab"),
                    Map.entry("shadowColor", "rgba(235,47,150,0.15)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("dopamine_orange", Map.ofEntries(
                    Map.entry("primaryColor", "#fa8c16"), Map.entry("secondaryColor", "#ffc069"),
                    Map.entry("backgroundColor", "#fff7e6"), Map.entry("textColor", "#612500"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#ffd591"),
                    Map.entry("headerGradientStart", "#fa8c16"), Map.entry("headerGradientEnd", "#ffc069"),
                    Map.entry("buttonColor", "#fa8c16"), Map.entry("accentColor", "#ffa940"),
                    Map.entry("shadowColor", "rgba(250,140,22,0.15)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("tech_blue", Map.ofEntries(
                    Map.entry("primaryColor", "#2F54EB"), Map.entry("secondaryColor", "#85A5FF"),
                    Map.entry("backgroundColor", "#F0F5FF"), Map.entry("textColor", "#10239E"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#ADC6FF"),
                    Map.entry("headerGradientStart", "#2F54EB"), Map.entry("headerGradientEnd", "#85A5FF"),
                    Map.entry("buttonColor", "#2F54EB"), Map.entry("accentColor", "#597EF7"),
                    Map.entry("shadowColor", "rgba(47,84,235,0.15)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("minimal_white", Map.ofEntries(
                    Map.entry("primaryColor", "#595959"), Map.entry("secondaryColor", "#8c8c8c"),
                    Map.entry("backgroundColor", "#fafafa"), Map.entry("textColor", "#262626"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#d9d9d9"),
                    Map.entry("headerGradientStart", "#595959"), Map.entry("headerGradientEnd", "#8c8c8c"),
                    Map.entry("buttonColor", "#595959"), Map.entry("accentColor", "#1890ff"),
                    Map.entry("shadowColor", "rgba(0,0,0,0.08)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("garden_green", Map.ofEntries(
                    Map.entry("primaryColor", "#7cb305"), Map.entry("secondaryColor", "#bae637"),
                    Map.entry("backgroundColor", "#fcffe6"), Map.entry("textColor", "#3f6600"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#d3f261"),
                    Map.entry("headerGradientStart", "#7cb305"), Map.entry("headerGradientEnd", "#bae637"),
                    Map.entry("buttonColor", "#7cb305"), Map.entry("accentColor", "#a0d911"),
                    Map.entry("shadowColor", "rgba(124,179,5,0.15)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("beauty_purple", Map.ofEntries(
                    Map.entry("primaryColor", "#722ED1"), Map.entry("secondaryColor", "#B37FEB"),
                    Map.entry("backgroundColor", "#F9F0FF"), Map.entry("textColor", "#391085"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#D3ADF7"),
                    Map.entry("headerGradientStart", "#722ED1"), Map.entry("headerGradientEnd", "#B37FEB"),
                    Map.entry("buttonColor", "#722ED1"), Map.entry("accentColor", "#9254DE"),
                    Map.entry("shadowColor", "rgba(114,46,209,0.15)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("dark_night", Map.ofEntries(
                    Map.entry("primaryColor", "#FAAD14"), Map.entry("secondaryColor", "#FFC53D"),
                    Map.entry("backgroundColor", "#1a1a2e"), Map.entry("textColor", "#e0e0e0"),
                    Map.entry("cardBackground", "#16213e"), Map.entry("borderColor", "#0f3460"),
                    Map.entry("headerGradientStart", "#1a1a2e"), Map.entry("headerGradientEnd", "#16213e"),
                    Map.entry("buttonColor", "#FAAD14"), Map.entry("accentColor", "#FFC53D"),
                    Map.entry("shadowColor", "rgba(250,173,20,0.2)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("natural_wood", Map.ofEntries(
                    Map.entry("primaryColor", "#A0522D"), Map.entry("secondaryColor", "#CD853F"),
                    Map.entry("backgroundColor", "#FFF8F0"), Map.entry("textColor", "#5C3317"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#DEB887"),
                    Map.entry("headerGradientStart", "#A0522D"), Map.entry("headerGradientEnd", "#CD853F"),
                    Map.entry("buttonColor", "#A0522D"), Map.entry("accentColor", "#D2691E"),
                    Map.entry("shadowColor", "rgba(160,82,45,0.15)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("tea_brown", Map.ofEntries(
                    Map.entry("primaryColor", "#8B4513"), Map.entry("secondaryColor", "#D2691E"),
                    Map.entry("backgroundColor", "#FFF5EB"), Map.entry("textColor", "#5C3317"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#DEB887"),
                    Map.entry("headerGradientStart", "#8B4513"), Map.entry("headerGradientEnd", "#D2691E"),
                    Map.entry("buttonColor", "#8B4513"), Map.entry("accentColor", "#CD853F"),
                    Map.entry("shadowColor", "rgba(139,69,19,0.15)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("festival_red", Map.ofEntries(
                    Map.entry("primaryColor", "#CF1322"), Map.entry("secondaryColor", "#FF4D4F"),
                    Map.entry("backgroundColor", "#FFF1F0"), Map.entry("textColor", "#820014"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#FFA39E"),
                    Map.entry("headerGradientStart", "#CF1322"), Map.entry("headerGradientEnd", "#FF4D4F"),
                    Map.entry("buttonColor", "#CF1322"), Map.entry("accentColor", "#F5222D"),
                    Map.entry("shadowColor", "rgba(207,19,34,0.15)"), Map.entry("badgeColor", "#FAAD14"))),
            Map.entry("glacier_blue", Map.ofEntries(
                    Map.entry("primaryColor", "#69C0FF"), Map.entry("secondaryColor", "#BAE7FF"),
                    Map.entry("backgroundColor", "#E6F7FF"), Map.entry("textColor", "#003A8C"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#91D5FF"),
                    Map.entry("headerGradientStart", "#69C0FF"), Map.entry("headerGradientEnd", "#BAE7FF"),
                    Map.entry("buttonColor", "#1890FF"), Map.entry("accentColor", "#40A9FF"),
                    Map.entry("shadowColor", "rgba(105,192,255,0.15)"), Map.entry("badgeColor", "#ff4d4f"))),
            Map.entry("baby_warm", Map.ofEntries(
                    Map.entry("primaryColor", "#F4C2C2"), Map.entry("secondaryColor", "#FFD8D8"),
                    Map.entry("backgroundColor", "#FFF5F5"), Map.entry("textColor", "#8C4A4A"),
                    Map.entry("cardBackground", "#ffffff"), Map.entry("borderColor", "#FFE0E0"),
                    Map.entry("headerGradientStart", "#F4C2C2"), Map.entry("headerGradientEnd", "#FFD8D8"),
                    Map.entry("buttonColor", "#F4C2C2"), Map.entry("accentColor", "#FF9C9C"),
                    Map.entry("shadowColor", "rgba(244,194,194,0.15)"), Map.entry("badgeColor", "#ff4d4f")))
    );

    private static final Map<String, String> THEME_NAME_MAP = Map.ofEntries(
            Map.entry("fresh_green", "清新绿"), Map.entry("ocean_blue", "海洋蓝"),
            Map.entry("classic_gold", "经典金"), Map.entry("sweet_pink", "甜美粉"),
            Map.entry("dopamine_orange", "活力橙"), Map.entry("tech_blue", "科技蓝"),
            Map.entry("minimal_white", "简约白"), Map.entry("garden_green", "田园绿"),
            Map.entry("beauty_purple", "美妆紫"), Map.entry("dark_night", "深夜黑"),
            Map.entry("natural_wood", "自然木"), Map.entry("tea_brown", "茶韵棕"),
            Map.entry("festival_red", "节日红"), Map.entry("glacier_blue", "冰川蓝"),
            Map.entry("baby_warm", "母婴暖")
    );

    private final ConcurrentHashMap<String, List<Map<String, String>>> chatHistories = new ConcurrentHashMap<>();

    @Override
    public Map<String, Object> decorationChat(String sessionId, String message, Long merchantId) {
        if (sessionId == null || sessionId.isEmpty()) {
            sessionId = UUID.randomUUID().toString().replace("-", "");
        }

        List<Map<String, String>> history = chatHistories.computeIfAbsent(sessionId, k -> new ArrayList<>());
        history.add(Map.of("role", "user", "content", message));

        // 限制历史长度（最多保留最近10轮）
        if (history.size() > 20) {
            history.subList(0, history.size() - 20).clear();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("sessionId", sessionId);

        try {
            if (llmApiKey != null && !llmApiKey.isEmpty()) {
                // 调用LLM（注入当前模块列表到system prompt）
                String llmReply = callChatApi(history, merchantId);
                Map<String, Object> parsed = extractJsonCodeBlock(llmReply);

                if (parsed != null) {
                    String reply = (String) parsed.getOrDefault("reply", llmReply);
                    String action = (String) parsed.getOrDefault("action", "none");
                    String rawThemeCode = (String) parsed.get("themeCode");
                    String themeCode = normalizeThemeCode(rawThemeCode);

                    result.put("reply", reply);
                    result.put("action", action);

                    if (themeCode != null && THEME_COLOR_MAP.containsKey(themeCode)) {
                        result.put("themeCode", themeCode);
                        result.put("themeConfig", THEME_COLOR_MAP.get(themeCode));
                    }

                    if (parsed.containsKey("shopName")) result.put("shopName", parsed.get("shopName"));
                    if (parsed.containsKey("slogan")) result.put("slogan", parsed.get("slogan"));
                    if (parsed.containsKey("noticeTexts")) result.put("noticeTexts", parsed.get("noticeTexts"));

                    // 处理新的 action 类型
                    handleChatAction(merchantId, action, parsed, result, themeCode);

                    // LLM返回none但消息含模块操作关键词时，尝试fallback
                    if ("none".equals(action)) {
                        String lowerMsg = message.toLowerCase();
                        if (lowerMsg.contains("加") || lowerMsg.contains("添加") || lowerMsg.contains("去掉") || lowerMsg.contains("删除") || lowerMsg.contains("隐藏") || lowerMsg.contains("显示")) {
                            Map<String, Object> fallback = chatFallback(merchantId, message);
                            String fbAction = (String) fallback.getOrDefault("action", "none");
                            if (!"none".equals(fbAction)) {
                                result.putAll(fallback);
                                history.add(Map.of("role", "assistant", "content", (String) fallback.get("reply")));
                                return result;
                            }
                        }
                    }
                } else {
                    result.put("reply", llmReply);
                    result.put("action", "none");
                }

                history.add(Map.of("role", "assistant", "content", llmReply));
            } else {
                // LLM不可用，使用fallback
                Map<String, Object> fallback = chatFallback(merchantId, message);
                result.putAll(fallback);
                history.add(Map.of("role", "assistant", "content", (String) fallback.get("reply")));
            }
        } catch (Exception e) {
            log.error("装修对话失败, sessionId={}", sessionId, e);
            Map<String, Object> fallback = chatFallback(merchantId, message);
            result.putAll(fallback);
            history.add(Map.of("role", "assistant", "content", (String) fallback.get("reply")));
        }

        return result;
    }

    /**
     * 处理AI Chat返回的action
     */
    @SuppressWarnings("unchecked")
    private void handleChatAction(Long merchantId, String action, Map<String, Object> parsed, Map<String, Object> result, String themeCode) {
        try {
            switch (action) {
                case "apply":
                    if (themeCode != null) {
                        boolean applied = applyChatTheme(merchantId, themeCode);
                        result.put("applied", applied);
                    }
                    break;

                case "apply_template":
                    String templateCode = (String) parsed.get("templateCode");
                    if (templateCode != null && TEMPLATE_DEFINITIONS.containsKey(templateCode)) {
                        Map<String, Object> tmplResult = applyTemplate(templateCode, merchantId);
                        result.put("applied", true);
                        result.put("templateCode", templateCode);
                        result.put("templateName", tmplResult.get("templateName"));
                        result.put("templateCard", TEMPLATE_DEFINITIONS.get(templateCode));
                        // 同时应用模板关联的主题
                        String tmplTheme = (String) TEMPLATE_DEFINITIONS.get(templateCode).get("themeCode");
                        if (tmplTheme != null) {
                            applyChatTheme(merchantId, tmplTheme);
                            result.put("themeCode", tmplTheme);
                            result.put("themeConfig", THEME_COLOR_MAP.get(tmplTheme));
                        }
                    }
                    break;

                case "add_module":
                    String addType = (String) parsed.get("moduleType");
                    Map<String, Object> addProps = (Map<String, Object>) parsed.get("moduleProps");
                    if (addType != null) {
                        Map<String, Object> addResult = addModule(merchantId, addType, addProps, null);
                        result.put("moduleChange", Map.of("action", "add", "moduleType", addType, "success", addResult.get("success")));
                    }
                    break;

                case "remove_module":
                    String removeType = (String) parsed.getOrDefault("moduleType", parsed.get("moduleId"));
                    if (removeType != null) {
                        Map<String, Object> rmResult = removeModule(merchantId, removeType);
                        result.put("moduleChange", Map.of("action", "remove", "moduleType", removeType, "success", rmResult.get("success")));
                    }
                    break;

                case "update_module":
                    String updateType = (String) parsed.getOrDefault("moduleType", parsed.get("moduleId"));
                    Map<String, Object> updateProps = (Map<String, Object>) parsed.get("moduleProps");
                    if (updateType != null && updateProps != null) {
                        Map<String, Object> updResult = updateModule(merchantId, updateType, updateProps);
                        result.put("moduleChange", Map.of("action", "update", "moduleType", updateType, "success", updResult.get("success")));
                    }
                    break;

                case "reorder_modules":
                    List<Map<String, Object>> moduleOrder = (List<Map<String, Object>>) parsed.get("moduleOrder");
                    if (moduleOrder != null) {
                        Map<String, Object> reorderResult = reorderModules(merchantId, moduleOrder);
                        result.put("moduleChange", Map.of("action", "reorder", "success", reorderResult.get("success")));
                    }
                    break;

                case "toggle_module":
                    String toggleType = (String) parsed.get("moduleType");
                    Object visibleObj = parsed.get("visible");
                    if (toggleType != null && visibleObj != null) {
                        boolean visible = visibleObj instanceof Boolean ? (Boolean) visibleObj : Boolean.parseBoolean(visibleObj.toString());
                        Map<String, Object> toggleResult = toggleModule(merchantId, toggleType, visible);
                        result.put("moduleChange", Map.of("action", "toggle", "moduleType", toggleType, "visible", visible, "success", toggleResult.get("success")));
                    }
                    break;

                case "update_info":
                    updateShopInfo(merchantId, parsed, result);
                    break;

                case "generate_image":
                    handleGenerateImage(merchantId, parsed, result);
                    break;

                default:
                    // none, recommend — 无额外处理
                    break;
            }

            // G7: 自动版本快照（仅在实际修改配置时）
            Set<String> snapshotActions = Set.of("apply", "apply_template", "add_module", "remove_module",
                    "update_module", "reorder_modules", "toggle_module", "update_info", "generate_image");
            if (snapshotActions.contains(action)) {
                MerchantPageConfig latestConfig = pageConfigMapper.selectByMerchantAndPageType(merchantId, "home");
                if (latestConfig != null) {
                    String desc = result.containsKey("reply") ? String.valueOf(result.get("reply")) : action;
                    if (desc.length() > 100) desc = desc.substring(0, 100);
                    saveVersionSnapshot(latestConfig, "chat", desc);
                }
            }
        } catch (Exception e) {
            log.error("处理装修action失败: action={}", action, e);
        }
    }

    private String callChatApi(List<Map<String, String>> history) {
        return callChatApi(history, null);
    }

    private String callChatApi(List<Map<String, String>> history, Long merchantId) {
        String url = llmBaseUrl + "/v1/chat/completions";

        // 动态注入当前模块列表，让 LLM 了解页面状态（用于排序/编辑）
        String systemPrompt = CHAT_SYSTEM_PROMPT;
        try {
            List<Map<String, Object>> currentModules = getCurrentModules(merchantId);
            if (currentModules != null && !currentModules.isEmpty()) {
                StringBuilder sb = new StringBuilder(systemPrompt);
                sb.append("\n\n## 当前页面模块（按顺序）\n");
                for (int i = 0; i < currentModules.size(); i++) {
                    Map<String, Object> mod = currentModules.get(i);
                    String type = (String) mod.getOrDefault("type", "unknown");
                    boolean visible = !Boolean.FALSE.equals(mod.get("visible"));
                    sb.append(i + 1).append(". ").append(type);
                    if (!visible) sb.append(" (已隐藏)");
                    sb.append("\n");
                }
                sb.append("\n排序操作时，请在 moduleOrder 中按新顺序列出所有模块的 type 和 order(从0开始)。");
                systemPrompt = sb.toString();
            }
        } catch (Exception e) {
            log.debug("获取当前模块列表失败，使用默认prompt", e);
        }

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        messages.addAll(history);

        Map<String, Object> body = new HashMap<>();
        body.put("model", llmModel);
        body.put("messages", messages);
        body.put("max_tokens", 500);
        body.put("temperature", 0.7);
        body.put("enable_thinking", false);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(llmApiKey);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            return root.path("choices").get(0).path("message").path("content").asText();
        } catch (Exception e) {
            log.error("调用Chat LLM失败", e);
            throw new RuntimeException("LLM调用失败: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractJsonCodeBlock(String text) {
        if (text == null || text.isEmpty()) return null;

        try {
            // 尝试提取 ```json ... ``` 代码块
            int start = text.indexOf("```json");
            if (start >= 0) {
                start = text.indexOf("\n", start) + 1;
                int end = text.indexOf("```", start);
                if (end > start) {
                    String json = text.substring(start, end).trim();
                    return objectMapper.readValue(json, Map.class);
                }
            }

            // 尝试提取 { ... } JSON对象
            int braceStart = text.indexOf("{");
            int braceEnd = text.lastIndexOf("}");
            if (braceStart >= 0 && braceEnd > braceStart) {
                String json = text.substring(braceStart, braceEnd + 1);
                return objectMapper.readValue(json, Map.class);
            }
        } catch (Exception e) {
            log.warn("解析AI回复JSON失败: {}", e.getMessage());
        }
        return null;
    }

    private String normalizeThemeCode(String raw) {
        if (raw == null || raw.isEmpty()) return null;

        // 去除括号及其内容: "ocean_blue(海洋蓝/#1890ff)" → "ocean_blue"
        String cleaned = raw.contains("(") ? raw.substring(0, raw.indexOf('(')).trim() : raw.trim();

        // 直接匹配
        if (THEME_COLOR_MAP.containsKey(cleaned)) return cleaned;

        // 模糊匹配（子串包含）
        for (String key : THEME_COLOR_MAP.keySet()) {
            if (key.contains(cleaned) || cleaned.contains(key)) return key;
        }

        // 中文名匹配
        for (Map.Entry<String, String> entry : THEME_NAME_MAP.entrySet()) {
            if (raw.contains(entry.getValue())) return entry.getKey();
        }

        return cleaned;
    }

    /**
     * 模块类型中文名映射
     */
    private static final Map<String, String> MODULE_TYPE_CN_MAP = Map.ofEntries(
            Map.entry("分类", "category_grid"), Map.entry("分类导航", "category_grid"),
            Map.entry("通知", "notice_bar"), Map.entry("通知栏", "notice_bar"),
            Map.entry("轮播", "banner"), Map.entry("轮播图", "banner"), Map.entry("Banner", "banner"),
            Map.entry("快捷", "quick_actions"), Map.entry("快捷入口", "quick_actions"),
            Map.entry("热销", "product_scroll"), Map.entry("横向商品", "product_scroll"),
            Map.entry("推荐", "product_grid"), Map.entry("商品网格", "product_grid"), Map.entry("商品列表", "product_grid"),
            Map.entry("图文", "text_image"), Map.entry("门店信息", "text_image"),
            Map.entry("广告", "image_ad"), Map.entry("促销图", "image_ad"), Map.entry("广告图", "image_ad"),
            Map.entry("AI", "ai_float"), Map.entry("悬浮", "ai_float"), Map.entry("客服", "ai_float"),
            Map.entry("视频", "video"), Map.entry("播放器", "video"),
            Map.entry("倒计时", "countdown"), Map.entry("限时", "countdown"), Map.entry("秒杀", "countdown"),
            Map.entry("优惠券", "coupon"), Map.entry("领券", "coupon"),
            Map.entry("公告栏", "announcement"), Map.entry("通告", "announcement"), Map.entry("店铺公告", "announcement"),
            Map.entry("新品", "new_arrivals"), Map.entry("上新", "new_arrivals"), Map.entry("新品推荐", "new_arrivals"),
            Map.entry("分销", "referral_banner"), Map.entry("裂变", "referral_banner"), Map.entry("邀请", "referral_banner"), Map.entry("推广", "referral_banner"),
            Map.entry("资质", "license_badge"), Map.entry("许可证", "license_badge"), Map.entry("食品安全", "license_badge"), Map.entry("SC", "license_badge")
    );

    /**
     * 模板中文名映射
     */
    private static final Map<String, String> TEMPLATE_CN_MAP = Map.of(
            "食品", "food_standard", "溯源", "food_standard",
            "生鲜", "fresh_direct", "农场", "fresh_direct",
            "餐饮", "restaurant", "火锅", "restaurant", "饭店", "restaurant",
            "简约", "minimal", "极简", "minimal"
    );

    @SuppressWarnings("unchecked")
    private Map<String, Object> chatFallback(Long merchantId, String message) {
        Map<String, Object> result = new HashMap<>();
        String lower = message.toLowerCase();

        // ===== 视频URL处理 =====
        if (message.contains("设置") && message.contains("视频")) {
            java.util.regex.Matcher videoUrlMatcher = java.util.regex.Pattern
                    .compile("(https?://[^\\s,，]+)")
                    .matcher(message);
            if (videoUrlMatcher.find()) {
                String videoUrl = videoUrlMatcher.group(1);
                Map<String, Object> videoProps = new HashMap<>();
                videoProps.put("videoUrl", videoUrl);
                Map<String, Object> updResult = updateModule(merchantId, "video", videoProps);
                result.put("reply", "已设置视频模块。刷新首页即可查看。");
                result.put("action", "update_module");
                result.put("moduleChange", Map.of("action", "update", "moduleType", "video", "success", updResult.get("success")));
                return result;
            }
        }

        // ===== 图片URL处理 =====
        if (message.contains("设置") && message.contains("图片")) {
            java.util.regex.Matcher urlMatcher = java.util.regex.Pattern
                    .compile("(https?://[^\\s,，]+)")
                    .matcher(message);
            List<String> urls = new ArrayList<>();
            while (urlMatcher.find()) {
                urls.add(urlMatcher.group(1));
            }

            if (!urls.isEmpty()) {
                if (message.contains("轮播") || message.contains("banner")) {
                    // Banner images: update swiperData via props
                    Map<String, Object> bannerProps = new HashMap<>();
                    bannerProps.put("images", urls);
                    Map<String, Object> updResult = updateModule(merchantId, "banner", bannerProps);
                    result.put("reply", "已更新轮播图，共" + urls.size() + "张图片。刷新首页即可查看。");
                    result.put("action", "update_module");
                    result.put("moduleChange", Map.of("action", "update", "moduleType", "banner", "success", updResult.get("success")));
                    return result;
                } else if (message.contains("广告")) {
                    Map<String, Object> adProps = new HashMap<>();
                    adProps.put("imageUrl", urls.get(0));
                    Map<String, Object> updResult = updateModule(merchantId, "image_ad", adProps);
                    result.put("reply", "已更新广告图。刷新首页即可查看。");
                    result.put("action", "update_module");
                    result.put("moduleChange", Map.of("action", "update", "moduleType", "image_ad", "success", updResult.get("success")));
                    return result;
                } else if (message.contains("图文")) {
                    Map<String, Object> tiProps = new HashMap<>();
                    tiProps.put("imageUrl", urls.get(0));
                    Map<String, Object> updResult = updateModule(merchantId, "text_image", tiProps);
                    result.put("reply", "已更新图文图片。刷新首页即可查看。");
                    result.put("action", "update_module");
                    result.put("moduleChange", Map.of("action", "update", "moduleType", "text_image", "success", updResult.get("success")));
                    return result;
                }
            }
        }

        // ===== 更新模块内容 (标题/内容/图片) =====
        if (message.contains("更新") && (message.contains("图文") || message.contains("广告"))) {
            String moduleType = message.contains("图文") ? "text_image" : "image_ad";
            Map<String, Object> props = new HashMap<>();

            java.util.regex.Matcher titleM = java.util.regex.Pattern.compile("标题=([^\\s]+)").matcher(message);
            if (titleM.find()) props.put("title", titleM.group(1));

            java.util.regex.Matcher contentM = java.util.regex.Pattern.compile("内容=([^\\s]+)").matcher(message);
            if (contentM.find()) props.put("content", contentM.group(1));

            java.util.regex.Matcher imgM = java.util.regex.Pattern.compile("图片=(https?://[^\\s]+)").matcher(message);
            if (imgM.find()) props.put("imageUrl", imgM.group(1));

            if (!props.isEmpty()) {
                Map<String, Object> updResult = updateModule(merchantId, moduleType, props);
                result.put("reply", "已更新" + (moduleType.equals("text_image") ? "图文" : "广告图") + "模块。刷新首页即可查看。");
                result.put("action", "update_module");
                result.put("moduleChange", Map.of("action", "update", "moduleType", moduleType, "success", updResult.get("success")));
                return result;
            }
        }

        // ===== 模块操作 fallback =====

        // "去掉/删除/移除" + 模块关键词 → remove_module
        if (lower.contains("去掉") || lower.contains("删除") || lower.contains("移除") || lower.contains("不要")) {
            for (Map.Entry<String, String> entry : MODULE_TYPE_CN_MAP.entrySet()) {
                if (message.contains(entry.getKey())) {
                    Map<String, Object> rmResult = removeModule(merchantId, entry.getValue());
                    result.put("reply", "已为您移除「" + entry.getKey() + "」模块，刷新首页即可查看效果。");
                    result.put("action", "remove_module");
                    result.put("moduleChange", Map.of("action", "remove", "moduleType", entry.getValue(), "success", rmResult.get("success")));
                    return result;
                }
            }
        }

        // "加/添加/增加" + 模块关键词 → add_module
        if (lower.contains("加") || lower.contains("添加") || lower.contains("增加")) {
            for (Map.Entry<String, String> entry : MODULE_TYPE_CN_MAP.entrySet()) {
                if (message.contains(entry.getKey())) {
                    Map<String, Object> addResult = addModule(merchantId, entry.getValue(), new HashMap<>(), null);
                    result.put("reply", "已为您添加「" + entry.getKey() + "」模块，刷新首页即可查看效果。");
                    result.put("action", "add_module");
                    result.put("moduleChange", Map.of("action", "add", "moduleType", entry.getValue(), "success", addResult.get("success")));
                    return result;
                }
            }
        }

        // "隐藏/显示" + 模块关键词 → toggle_module
        if (lower.contains("隐藏") || lower.contains("显示")) {
            boolean visible = lower.contains("显示");
            for (Map.Entry<String, String> entry : MODULE_TYPE_CN_MAP.entrySet()) {
                if (message.contains(entry.getKey())) {
                    toggleModule(merchantId, entry.getValue(), visible);
                    result.put("reply", "已" + (visible ? "显示" : "隐藏") + "「" + entry.getKey() + "」模块。");
                    result.put("action", "toggle_module");
                    result.put("moduleChange", Map.of("action", "toggle", "moduleType", entry.getValue(), "visible", visible, "success", true));
                    return result;
                }
            }
        }

        // "模板" + 行业词 → apply_template
        if (lower.contains("模板") || lower.contains("模版") || lower.contains("设计") || lower.contains("首页")) {
            for (Map.Entry<String, String> entry : TEMPLATE_CN_MAP.entrySet()) {
                if (message.contains(entry.getKey())) {
                    String tmplCode = entry.getValue();
                    Map<String, Object> tmplResult = applyTemplate(tmplCode, merchantId);
                    Map<String, Object> tmplDef = TEMPLATE_DEFINITIONS.get(tmplCode);
                    result.put("reply", "已为您应用「" + tmplDef.get("name") + "」模板，刷新首页即可查看效果。");
                    result.put("action", "apply_template");
                    result.put("applied", true);
                    result.put("templateCode", tmplCode);
                    result.put("templateCard", tmplDef);
                    String tmplTheme = (String) tmplDef.get("themeCode");
                    if (tmplTheme != null) {
                        applyChatTheme(merchantId, tmplTheme);
                        result.put("themeCode", tmplTheme);
                        result.put("themeConfig", THEME_COLOR_MAP.get(tmplTheme));
                    }
                    return result;
                }
            }
        }

        // "改成X列" → update_module: product_grid, columns=X
        if (message.matches(".*[改换]成?\\d列.*") || message.matches(".*\\d列.*")) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d)列").matcher(message);
            if (m.find()) {
                int columns = Integer.parseInt(m.group(1));
                if (columns >= 1 && columns <= 4) {
                    updateModule(merchantId, "product_grid", Map.of("columns", columns));
                    result.put("reply", "已将商品网格改为" + columns + "列布局，刷新首页即可查看效果。");
                    result.put("action", "update_module");
                    result.put("moduleChange", Map.of("action", "update", "moduleType", "product_grid", "success", true));
                    return result;
                }
            }
        }

        // 应用类指令 — 先检查消息中是否包含主题名
        if (lower.contains("应用") || lower.contains("确认") || lower.contains("就这个") || lower.contains("用这个")) {
            // 尝试从消息中提取主题
            for (Map.Entry<String, String> entry : THEME_NAME_MAP.entrySet()) {
                if (message.contains(entry.getValue()) || lower.contains(entry.getKey())) {
                    String code = entry.getKey();
                    boolean applied = applyChatTheme(merchantId, code);
                    result.put("reply", "已为您应用「" + entry.getValue() + "」主题" + (applied ? "，配置已保存！" : "。"));
                    result.put("action", "apply");
                    result.put("themeCode", code);
                    result.put("themeConfig", THEME_COLOR_MAP.get(code));
                    result.put("applied", applied);
                    return result;
                }
            }
            result.put("reply", "好的，请告诉我您想应用哪个主题，比如\"应用清新绿主题\"");
            result.put("action", "none");
            return result;
        }

        // 关键词推荐
        String themeCode = null;
        String themeName = null;

        if (lower.contains("生鲜") || lower.contains("水果") || lower.contains("蔬菜") || lower.contains("有机")) {
            themeCode = "fresh_green"; themeName = "清新绿";
        } else if (lower.contains("海洋") || lower.contains("蓝色") || lower.contains("清爽")) {
            themeCode = "ocean_blue"; themeName = "海洋蓝";
        } else if (lower.contains("粉色") || lower.contains("甜") || lower.contains("少女")) {
            themeCode = "sweet_pink"; themeName = "甜美粉";
        } else if (lower.contains("科技") || lower.contains("数码") || lower.contains("电子")) {
            themeCode = "tech_blue"; themeName = "科技蓝";
        } else if (lower.contains("简约") || lower.contains("极简") || lower.contains("白色")) {
            themeCode = "minimal_white"; themeName = "简约白";
        } else if (lower.contains("金") || lower.contains("高端") || lower.contains("奢华")) {
            themeCode = "classic_gold"; themeName = "经典金";
        } else if (lower.contains("田园") || lower.contains("自然") || lower.contains("绿色")) {
            themeCode = "garden_green"; themeName = "田园绿";
        } else if (lower.contains("美妆") || lower.contains("紫") || lower.contains("化妆")) {
            themeCode = "beauty_purple"; themeName = "美妆紫";
        } else if (lower.contains("橙") || lower.contains("活力") || lower.contains("年轻")) {
            themeCode = "dopamine_orange"; themeName = "活力橙";
        } else if (lower.contains("红") || lower.contains("节日") || lower.contains("喜庆")) {
            themeCode = "festival_red"; themeName = "节日红";
        } else if (lower.contains("冰") || lower.contains("清凉") || lower.contains("冷色")) {
            themeCode = "glacier_blue"; themeName = "冰川蓝";
        } else if (lower.contains("母婴") || lower.contains("宝宝") || lower.contains("温馨")) {
            themeCode = "baby_warm"; themeName = "母婴暖";
        } else if (lower.contains("茶") || lower.contains("中式") || lower.contains("古典")) {
            themeCode = "tea_brown"; themeName = "茶韵棕";
        } else if (lower.contains("木") || lower.contains("原木") || lower.contains("质朴")) {
            themeCode = "natural_wood"; themeName = "自然木";
        } else if (lower.contains("暗") || lower.contains("黑") || lower.contains("夜")) {
            themeCode = "dark_night"; themeName = "深夜黑";
        }

        if (themeCode != null) {
            result.put("reply", "根据您的描述，为您推荐「" + themeName + "」主题，点击下方预览卡片可以应用。");
            result.put("action", "recommend");
            result.put("themeCode", themeCode);
            result.put("themeConfig", THEME_COLOR_MAP.get(themeCode));
        } else {
            result.put("reply", "您好！我是AI装修助手，可以帮您推荐和应用店铺主题。请告诉我您的店铺类型或偏好的颜色风格。");
            result.put("action", "none");
        }

        return result;
    }

    private boolean applyChatTheme(Long merchantId, String themeCode) {
        try {
            Map<String, String> colors = THEME_COLOR_MAP.get(themeCode);
            if (colors == null) return false;

            // 查找或创建页面配置
            MerchantPageConfig config = pageConfigMapper.selectByMerchantAndPageType(merchantId, "home");
            if (config == null) {
                config = new MerchantPageConfig();
                config.setMerchantId(merchantId);
                config.setPageType("home");
                config.setPageName("首页");
                config.setStatus(1);
            }

            config.setThemeCode(themeCode);
            config.setCustomTheme(objectMapper.writeValueAsString(colors));
            config.setUpdateTime(LocalDateTime.now());

            if (config.getId() != null) {
                pageConfigMapper.updateById(config);
            } else {
                config.setCreateTime(LocalDateTime.now());
                pageConfigMapper.insert(config);
            }

            log.info("通过AI对话应用主题: themeCode={}, merchantId={}", themeCode, merchantId);
            return true;
        } catch (Exception e) {
            log.error("应用主题失败: themeCode={}", themeCode, e);
            return false;
        }
    }

    // ==================== 模板系统 ====================

    /**
     * 预置模板定义
     * key: templateCode, value: 模板配置
     */
    private static final Map<String, Map<String, Object>> TEMPLATE_DEFINITIONS = new LinkedHashMap<>();

    static {
        // 食品溯源标准版 (全功能)
        TEMPLATE_DEFINITIONS.put("food_standard", Map.of(
                "name", "食品溯源标准版",
                "description", "全功能首页，适合食品/溯源行业",
                "industry", "食品/溯源",
                "themeCode", "fresh_green",
                "modules", List.of(
                        Map.of("id", "t1_1", "type", "header", "visible", true, "order", 0, "props", Map.of("showSearch", true, "showLogo", true)),
                        Map.of("id", "t1_2", "type", "notice_bar", "visible", true, "order", 1, "props", Map.of("texts", List.of("欢迎使用食品溯源商城", "扫码查看商品溯源信息"), "interval", 4000)),
                        Map.of("id", "t1_3", "type", "banner", "visible", true, "order", 2, "props", Map.of("autoplay", true, "interval", 5000)),
                        Map.of("id", "t1_4", "type", "category_grid", "visible", true, "order", 3, "props", Map.of("columns", 4)),
                        Map.of("id", "t1_5", "type", "quick_actions", "visible", true, "order", 4, "props", Map.of()),
                        Map.of("id", "t1_6", "type", "product_scroll", "visible", true, "order", 5, "props", Map.of("title", "热销单品")),
                        Map.of("id", "t1_7", "type", "product_grid", "visible", true, "order", 6, "props", Map.of("title", "猜你喜欢", "columns", 2)),
                        Map.of("id", "t1_8", "type", "ai_float", "visible", true, "order", 99, "props", Map.of())
                )
        ));

        // 生鲜直供版 (大图商品为主)
        TEMPLATE_DEFINITIONS.put("fresh_direct", Map.of(
                "name", "生鲜直供版",
                "description", "大图商品展示，适合生鲜/农场行业",
                "industry", "生鲜/农场",
                "themeCode", "garden_green",
                "modules", List.of(
                        Map.of("id", "t2_1", "type", "header", "visible", true, "order", 0, "props", Map.of("showSearch", true, "showLogo", true)),
                        Map.of("id", "t2_2", "type", "banner", "visible", true, "order", 1, "props", Map.of("autoplay", true, "interval", 4000)),
                        Map.of("id", "t2_3", "type", "category_grid", "visible", true, "order", 2, "props", Map.of("columns", 4)),
                        Map.of("id", "t2_4", "type", "product_grid", "visible", true, "order", 3, "props", Map.of("title", "产地直供", "columns", 2)),
                        Map.of("id", "t2_5", "type", "ai_float", "visible", true, "order", 99, "props", Map.of())
                )
        ));

        // 餐饮商家版 (门店+菜品)
        TEMPLATE_DEFINITIONS.put("restaurant", Map.of(
                "name", "餐饮商家版",
                "description", "门店展示+菜品推荐，适合餐饮/火锅行业",
                "industry", "餐饮/火锅",
                "themeCode", "festival_red",
                "modules", List.of(
                        Map.of("id", "t3_1", "type", "header", "visible", true, "order", 0, "props", Map.of("showSearch", true, "showLogo", true)),
                        Map.of("id", "t3_2", "type", "banner", "visible", true, "order", 1, "props", Map.of("autoplay", true, "interval", 5000)),
                        Map.of("id", "t3_3", "type", "notice_bar", "visible", true, "order", 2, "props", Map.of("texts", List.of("欢迎光临！预订请拨打电话"), "interval", 4000)),
                        Map.of("id", "t3_4", "type", "product_scroll", "visible", true, "order", 3, "props", Map.of("title", "招牌菜品")),
                        Map.of("id", "t3_5", "type", "product_grid", "visible", true, "order", 4, "props", Map.of("title", "全部菜品", "columns", 3)),
                        Map.of("id", "t3_6", "type", "text_image", "visible", true, "order", 5, "props", Map.of("title", "门店信息", "content", "欢迎到店品尝，地址请咨询客服"))
                )
        ));

        // 简约精选版 (极简风)
        TEMPLATE_DEFINITIONS.put("minimal", Map.of(
                "name", "简约精选版",
                "description", "极简设计，突出商品本身",
                "industry", "通用",
                "themeCode", "minimal_white",
                "modules", List.of(
                        Map.of("id", "t4_1", "type", "header", "visible", true, "order", 0, "props", Map.of("showSearch", true, "showLogo", true)),
                        Map.of("id", "t4_2", "type", "banner", "visible", true, "order", 1, "props", Map.of("autoplay", true, "interval", 6000)),
                        Map.of("id", "t4_3", "type", "product_grid", "visible", true, "order", 2, "props", Map.of("title", "精选商品", "columns", 2)),
                        Map.of("id", "t4_4", "type", "ai_float", "visible", true, "order", 99, "props", Map.of())
                )
        ));

        // 火锅专属版 (门店氛围+招牌菜+优惠券)
        TEMPLATE_DEFINITIONS.put("hotpot", Map.of(
                "name", "火锅专属版",
                "description", "火锅/烧烤门店专属，突出氛围和招牌菜品",
                "industry", "火锅/烧烤",
                "themeCode", "festival_red",
                "modules", List.of(
                        Map.of("id", "t5_1", "type", "header", "visible", true, "order", 0, "props", Map.of("showSearch", true, "showLogo", true)),
                        Map.of("id", "t5_2", "type", "banner", "visible", true, "order", 1, "props", Map.of("autoplay", true, "interval", 4000)),
                        Map.of("id", "t5_3", "type", "notice_bar", "visible", true, "order", 2, "props", Map.of("texts", List.of("预订热线：请咨询客服", "本店支持外卖配送"), "interval", 4000)),
                        Map.of("id", "t5_4", "type", "coupon", "visible", true, "order", 3, "props", Map.of("title", "优惠领取")),
                        Map.of("id", "t5_5", "type", "product_scroll", "visible", true, "order", 4, "props", Map.of("title", "招牌锅底")),
                        Map.of("id", "t5_6", "type", "product_grid", "visible", true, "order", 5, "props", Map.of("title", "精选菜品", "columns", 3)),
                        Map.of("id", "t5_7", "type", "text_image", "visible", true, "order", 6, "props", Map.of("title", "门店环境", "content", "宽敞明亮的用餐环境，等候区提供免费小食")),
                        Map.of("id", "t5_8", "type", "ai_float", "visible", true, "order", 99, "props", Map.of())
                )
        ));

        // 烘焙甜品版 (新品+倒计时+精美图文)
        TEMPLATE_DEFINITIONS.put("bakery", Map.of(
                "name", "烘焙甜品版",
                "description", "面包蛋糕甜品店，突出新品和精美展示",
                "industry", "烘焙/甜品",
                "themeCode", "sweet_pink",
                "modules", List.of(
                        Map.of("id", "t6_1", "type", "header", "visible", true, "order", 0, "props", Map.of("showSearch", true, "showLogo", true)),
                        Map.of("id", "t6_2", "type", "banner", "visible", true, "order", 1, "props", Map.of("autoplay", true, "interval", 5000)),
                        Map.of("id", "t6_3", "type", "new_arrivals", "visible", true, "order", 2, "props", Map.of("title", "新品上架")),
                        Map.of("id", "t6_4", "type", "countdown", "visible", true, "order", 3, "props", Map.of("title", "限时优惠", "subtitle", "每日新鲜现烤", "endTime", "")),
                        Map.of("id", "t6_5", "type", "product_grid", "visible", true, "order", 4, "props", Map.of("title", "人气甜品", "columns", 2)),
                        Map.of("id", "t6_6", "type", "text_image", "visible", true, "order", 5, "props", Map.of("title", "关于我们", "content", "坚持手工制作，精选天然原料")),
                        Map.of("id", "t6_7", "type", "ai_float", "visible", true, "order", 99, "props", Map.of())
                )
        ));
    }

    @Override
    public List<Map<String, Object>> getPageTemplates() {
        List<Map<String, Object>> templates = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> entry : TEMPLATE_DEFINITIONS.entrySet()) {
            Map<String, Object> tmpl = new HashMap<>(entry.getValue());
            tmpl.put("code", entry.getKey());
            // 附加主题色彩预览
            String themeCode = (String) tmpl.get("themeCode");
            if (themeCode != null && THEME_COLOR_MAP.containsKey(themeCode)) {
                tmpl.put("themeConfig", THEME_COLOR_MAP.get(themeCode));
            }
            templates.add(tmpl);
        }
        return templates;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> applyTemplate(String templateCode, Long merchantId) {
        Map<String, Object> templateDef = TEMPLATE_DEFINITIONS.get(templateCode);
        if (templateDef == null) {
            throw new RuntimeException("模板不存在: " + templateCode);
        }

        String themeCode = (String) templateDef.get("themeCode");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> modules = (List<Map<String, Object>>) templateDef.get("modules");

        // 查找或创建页面配置
        MerchantPageConfig config = pageConfigMapper.selectByMerchantAndPageType(merchantId, "home");
        if (config == null) {
            config = new MerchantPageConfig();
            config.setMerchantId(merchantId);
            config.setPageType("home");
            config.setPageName("首页");
            config.setStatus(1);
        }

        try {
            config.setModulesConfig(objectMapper.writeValueAsString(modules));
            if (themeCode != null && THEME_COLOR_MAP.containsKey(themeCode)) {
                config.setThemeCode(themeCode);
                config.setCustomTheme(objectMapper.writeValueAsString(THEME_COLOR_MAP.get(themeCode)));
            }
            config.setUpdateTime(LocalDateTime.now());

            if (config.getId() != null) {
                pageConfigMapper.updateById(config);
            } else {
                config.setCreateTime(LocalDateTime.now());
                pageConfigMapper.insert(config);
            }

            log.info("应用模板成功: templateCode={}, merchantId={}", templateCode, merchantId);

            // G7: 版本快照
            saveVersionSnapshot(config, "template", "应用模板: " + templateDef.get("name"));

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("templateCode", templateCode);
            result.put("templateName", templateDef.get("name"));
            result.put("modulesCount", modules.size());
            return result;
        } catch (Exception e) {
            throw new RuntimeException("应用模板失败: " + e.getMessage());
        }
    }

    // ==================== 模块操作方法 ====================

    /**
     * 读取当前 modulesConfig，如果为空则返回默认配置
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getCurrentModules(Long merchantId) {
        MerchantPageConfig config = pageConfigMapper.selectByMerchantAndPageType(merchantId, "home");
        if (config != null && config.getModulesConfig() != null && !config.getModulesConfig().isEmpty()) {
            try {
                return objectMapper.readValue(config.getModulesConfig(),
                        new TypeReference<List<Map<String, Object>>>() {});
            } catch (Exception e) {
                log.warn("解析modulesConfig失败: {}", e.getMessage());
            }
        }
        // 返回默认配置
        return new ArrayList<>(List.of(
                Map.of("id", "def_1", "type", "header", "visible", true, "order", 0, "props", Map.of("showSearch", true, "showLogo", true)),
                Map.of("id", "def_2", "type", "notice_bar", "visible", true, "order", 1, "props", Map.of("texts", List.of("欢迎使用白垩纪食品溯源商城"), "interval", 4000)),
                Map.of("id", "def_3", "type", "banner", "visible", true, "order", 2, "props", Map.of("autoplay", true, "interval", 5000)),
                Map.of("id", "def_4", "type", "category_grid", "visible", true, "order", 3, "props", Map.of("columns", 4)),
                Map.of("id", "def_5", "type", "quick_actions", "visible", true, "order", 4, "props", Map.of()),
                Map.of("id", "def_6", "type", "product_scroll", "visible", true, "order", 5, "props", Map.of("title", "热销单品")),
                Map.of("id", "def_7", "type", "product_grid", "visible", true, "order", 6, "props", Map.of("title", "猜你喜欢", "columns", 2)),
                Map.of("id", "def_8", "type", "ai_float", "visible", true, "order", 99, "props", Map.of())
        ));
    }

    /**
     * 保存 modulesConfig 到 DB
     */
    private void saveModulesConfig(Long merchantId, List<Map<String, Object>> modules) {
        try {
            MerchantPageConfig config = pageConfigMapper.selectByMerchantAndPageType(merchantId, "home");
            if (config == null) {
                config = new MerchantPageConfig();
                config.setMerchantId(merchantId);
                config.setPageType("home");
                config.setPageName("首页");
                config.setStatus(1);
                config.setCreateTime(LocalDateTime.now());
            }
            config.setModulesConfig(objectMapper.writeValueAsString(modules));
            config.setUpdateTime(LocalDateTime.now());

            if (config.getId() != null) {
                pageConfigMapper.updateById(config);
            } else {
                pageConfigMapper.insert(config);
            }
        } catch (Exception e) {
            log.error("保存modulesConfig失败", e);
            throw new RuntimeException("保存模块配置失败");
        }
    }

    /**
     * 添加模块
     */
    private Map<String, Object> addModule(Long merchantId, String moduleType, Map<String, Object> props, String afterModuleId) {
        List<Map<String, Object>> modules = getCurrentModules(merchantId);

        // 生成新模块
        String newId = "mod_" + System.currentTimeMillis();
        Map<String, Object> newModule = new HashMap<>();
        newModule.put("id", newId);
        newModule.put("type", moduleType);
        newModule.put("visible", true);
        newModule.put("props", props != null ? props : new HashMap<>());

        // 计算 order
        int maxOrder = modules.stream().mapToInt(m -> ((Number) m.getOrDefault("order", 0)).intValue()).max().orElse(0);
        if (afterModuleId != null) {
            for (int i = 0; i < modules.size(); i++) {
                if (afterModuleId.equals(modules.get(i).get("id")) || afterModuleId.equals(modules.get(i).get("type"))) {
                    newModule.put("order", ((Number) modules.get(i).getOrDefault("order", 0)).intValue() + 1);
                    // 后续模块 order +1
                    for (int j = i + 1; j < modules.size(); j++) {
                        int curOrder = ((Number) modules.get(j).getOrDefault("order", 0)).intValue();
                        modules.get(j).put("order", curOrder + 1);
                    }
                    break;
                }
            }
        } else {
            // 默认加在 ai_float 之前
            newModule.put("order", maxOrder < 99 ? maxOrder + 1 : maxOrder);
        }

        modules.add(newModule);
        modules.sort(Comparator.comparingInt(m -> ((Number) m.getOrDefault("order", 0)).intValue()));
        saveModulesConfig(merchantId, modules);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("moduleId", newId);
        result.put("moduleType", moduleType);
        return result;
    }

    /**
     * 删除模块
     */
    private Map<String, Object> removeModule(Long merchantId, String moduleIdOrType) {
        List<Map<String, Object>> modules = getCurrentModules(merchantId);
        boolean removed = modules.removeIf(m ->
                moduleIdOrType.equals(m.get("id")) || moduleIdOrType.equals(m.get("type")));

        if (removed) {
            // 重排 order
            int order = 0;
            modules.sort(Comparator.comparingInt(m -> ((Number) m.getOrDefault("order", 0)).intValue()));
            for (Map<String, Object> m : modules) {
                if ("ai_float".equals(m.get("type"))) {
                    m.put("order", 99);
                } else {
                    m.put("order", order++);
                }
            }
            saveModulesConfig(merchantId, modules);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", removed);
        result.put("removed", moduleIdOrType);
        return result;
    }

    /**
     * 更新模块配置
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> updateModule(Long merchantId, String moduleIdOrType, Map<String, Object> newProps) {
        List<Map<String, Object>> modules = getCurrentModules(merchantId);
        boolean updated = false;

        for (Map<String, Object> m : modules) {
            if (moduleIdOrType.equals(m.get("id")) || moduleIdOrType.equals(m.get("type"))) {
                Map<String, Object> existingProps = (Map<String, Object>) m.getOrDefault("props", new HashMap<>());
                existingProps = new HashMap<>(existingProps);
                existingProps.putAll(newProps);
                m.put("props", existingProps);
                updated = true;
                break;
            }
        }

        if (updated) {
            saveModulesConfig(merchantId, modules);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", updated);
        return result;
    }

    /**
     * 切换模块显示/隐藏
     */
    private Map<String, Object> toggleModule(Long merchantId, String moduleType, boolean visible) {
        List<Map<String, Object>> modules = getCurrentModules(merchantId);
        boolean toggled = false;

        for (Map<String, Object> m : modules) {
            if (moduleType.equals(m.get("type"))) {
                m.put("visible", visible);
                toggled = true;
                break;
            }
        }

        if (toggled) {
            saveModulesConfig(merchantId, modules);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", toggled);
        return result;
    }

    /**
     * 重排模块顺序
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> reorderModules(Long merchantId, List<Map<String, Object>> moduleOrder) {
        List<Map<String, Object>> modules = getCurrentModules(merchantId);

        // 构建 type→newOrder 映射
        Map<String, Integer> orderMap = new HashMap<>();
        for (Map<String, Object> mo : moduleOrder) {
            String type = (String) mo.get("type");
            int order = ((Number) mo.getOrDefault("order", 0)).intValue();
            if (type != null) orderMap.put(type, order);
        }

        for (Map<String, Object> m : modules) {
            String type = (String) m.get("type");
            if (orderMap.containsKey(type)) {
                m.put("order", orderMap.get(type));
            }
        }

        modules.sort(Comparator.comparingInt(m -> ((Number) m.getOrDefault("order", 0)).intValue()));
        saveModulesConfig(merchantId, modules);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        return result;
    }

    /**
     * 更新店铺信息（店名、宣传语、通知文字）
     */
    @SuppressWarnings("unchecked")
    private void updateShopInfo(Long merchantId, Map<String, Object> parsed, Map<String, Object> result) {
        MerchantPageConfig config = pageConfigMapper.selectByMerchantAndPageType(merchantId, "home");
        if (config == null) {
            config = new MerchantPageConfig();
            config.setMerchantId(merchantId);
            config.setPageType("home");
            config.setPageName("首页");
            config.setStatus(1);
        }

        boolean changed = false;
        String shopName = (String) parsed.get("shopName");
        if (shopName != null && !shopName.isEmpty()) {
            config.setShopName(shopName);
            result.put("shopName", shopName);
            changed = true;
        }

        String slogan = (String) parsed.get("slogan");
        if (slogan != null && !slogan.isEmpty()) {
            config.setSlogan(slogan);
            result.put("slogan", slogan);
            changed = true;
        }

        Object noticeTextsObj = parsed.get("noticeTexts");
        if (noticeTextsObj instanceof List) {
            try {
                String noticeJson = objectMapper.writeValueAsString(noticeTextsObj);
                config.setNoticeTexts(noticeJson);
                result.put("noticeTexts", noticeTextsObj);
                changed = true;
            } catch (Exception e) {
                log.warn("序列化noticeTexts失败", e);
            }
        }

        if (changed) {
            config.setUpdateTime(LocalDateTime.now());
            if (config.getId() != null) {
                pageConfigMapper.updateById(config);
            } else {
                config.setCreateTime(LocalDateTime.now());
                pageConfigMapper.insert(config);
            }
            result.put("infoUpdated", true);
            log.info("店铺信息已更新: merchantId={}, shopName={}, slogan={}", merchantId, shopName, slogan);
        }
    }

    /**
     * G5: AI 生图 → 自动写入模块配置
     */
    private void handleGenerateImage(Long merchantId, Map<String, Object> parsed, Map<String, Object> result) {
        String imagePrompt = (String) parsed.get("imagePrompt");
        String imageTarget = (String) parsed.get("imageTarget"); // banner, image_ad, text_image

        if (imagePrompt == null || imagePrompt.isEmpty()) {
            result.put("imageGenerated", false);
            result.put("imageError", "缺少图片描述");
            return;
        }

        log.info("AI生图请求: prompt={}, target={}, merchantId={}", imagePrompt, imageTarget, merchantId);

        try {
            Map<String, Object> genResult = generateImage(imagePrompt, null, "1280*720");

            if (Boolean.TRUE.equals(genResult.get("success"))) {
                String imageUrl = (String) genResult.get("imageUrl");
                result.put("imageGenerated", true);
                result.put("generatedImageUrl", imageUrl);
                result.put("imagePrompt", imagePrompt);
                result.put("imageTarget", imageTarget);

                // 自动写入目标模块
                if (imageTarget != null && imageUrl != null) {
                    autoApplyImageToModule(merchantId, imageTarget, imageUrl);
                    result.put("imageApplied", true);
                    log.info("AI生图已自动应用: target={}, url={}", imageTarget, imageUrl);
                }
            } else {
                result.put("imageGenerated", false);
                result.put("imageError", genResult.getOrDefault("message", "图片生成失败"));
            }
        } catch (Exception e) {
            log.error("AI生图失败: prompt={}", imagePrompt, e);
            result.put("imageGenerated", false);
            result.put("imageError", "图片生成服务暂不可用");
        }
    }

    /**
     * 将 AI 生成的图片自动写入指定模块
     */
    private void autoApplyImageToModule(Long merchantId, String moduleType, String imageUrl) {
        try {
            MerchantPageConfig config = pageConfigMapper.selectByMerchantAndPageType(merchantId, "home");
            if (config == null || config.getModulesConfig() == null) return;

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> modules = objectMapper.readValue(
                    config.getModulesConfig(), new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});

            boolean updated = false;
            for (Map<String, Object> mod : modules) {
                if (moduleType.equals(mod.get("type"))) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> props = (Map<String, Object>) mod.get("props");
                    if (props == null) {
                        props = new HashMap<>();
                        mod.put("props", props);
                    }

                    if ("banner".equals(moduleType)) {
                        // banner: append to images list
                        @SuppressWarnings("unchecked")
                        List<String> images = (List<String>) props.get("images");
                        if (images == null) {
                            images = new ArrayList<>();
                            props.put("images", images);
                        }
                        images.add(imageUrl);
                    } else {
                        // image_ad, text_image: set imageUrl
                        props.put("imageUrl", imageUrl);
                    }
                    updated = true;
                    break;
                }
            }

            if (updated) {
                config.setModulesConfig(objectMapper.writeValueAsString(modules));
                config.setUpdateTime(LocalDateTime.now());
                pageConfigMapper.updateById(config);
            }
        } catch (Exception e) {
            log.warn("自动应用生成图片到模块失败: moduleType={}", moduleType, e);
        }
    }

    // ========== G7: 版本历史 ==========

    /**
     * 自动创建版本快照（在每次配置变更后调用）
     */
    private void saveVersionSnapshot(MerchantPageConfig config, String source, String description) {
        try {
            Integer maxNo = versionMapper.selectMaxVersionNo(config.getMerchantId(), config.getPageType());
            int nextNo = (maxNo != null ? maxNo : 0) + 1;

            MerchantPageConfigVersion version = new MerchantPageConfigVersion();
            version.setConfigId(config.getId());
            version.setMerchantId(config.getMerchantId());
            version.setPageType(config.getPageType());
            version.setVersionNo(nextNo);
            version.setThemeCode(config.getThemeCode());
            version.setCustomTheme(config.getCustomTheme());
            version.setModulesConfig(config.getModulesConfig());
            version.setShopName(config.getShopName());
            version.setSlogan(config.getSlogan());
            version.setNoticeTexts(config.getNoticeTexts());
            version.setChangeSource(source);
            version.setChangeDescription(description);
            version.setCreateTime(LocalDateTime.now());

            versionMapper.insert(version);

            // 清理旧版本，保留最近 20 个
            versionMapper.deleteOldVersions(config.getMerchantId(), config.getPageType(), 20);

            log.debug("版本快照已保存: merchantId={}, v{}, source={}", config.getMerchantId(), nextNo, source);
        } catch (Exception e) {
            log.warn("保存版本快照失败: merchantId={}", config.getMerchantId(), e);
        }
    }

    @Override
    public List<Map<String, Object>> getVersionHistory(Long merchantId, String pageType) {
        List<MerchantPageConfigVersion> versions = versionMapper.selectVersions(merchantId, pageType);
        List<Map<String, Object>> result = new ArrayList<>();
        for (MerchantPageConfigVersion v : versions) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", v.getId());
            item.put("versionNo", v.getVersionNo());
            item.put("themeCode", v.getThemeCode());
            item.put("shopName", v.getShopName());
            item.put("changeSource", v.getChangeSource());
            item.put("changeDescription", v.getChangeDescription());
            item.put("createTime", v.getCreateTime());
            result.add(item);
        }
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> rollbackToVersion(Long merchantId, Long versionId) {
        Map<String, Object> result = new HashMap<>();

        MerchantPageConfigVersion version = versionMapper.selectById(versionId);
        if (version == null) {
            result.put("success", false);
            result.put("message", "版本不存在");
            return result;
        }

        // 安全检查：确保版本属于同一商户（merchantId 不可为空）
        if (merchantId == null || !merchantId.equals(version.getMerchantId())) {
            result.put("success", false);
            result.put("message", "无权限回滚此版本");
            return result;
        }

        MerchantPageConfig config = pageConfigMapper.selectByMerchantAndPageType(merchantId, version.getPageType());
        if (config == null) {
            result.put("success", false);
            result.put("message", "页面配置不存在");
            return result;
        }

        // 回滚前先保存当前状态
        saveVersionSnapshot(config, "rollback", "回滚前自动备份");

        // 恢复版本数据
        config.setThemeCode(version.getThemeCode());
        config.setCustomTheme(version.getCustomTheme());
        config.setModulesConfig(version.getModulesConfig());
        config.setShopName(version.getShopName());
        config.setSlogan(version.getSlogan());
        config.setNoticeTexts(version.getNoticeTexts());
        config.setUpdateTime(LocalDateTime.now());
        pageConfigMapper.updateById(config);

        // 保存回滚后的版本
        saveVersionSnapshot(config, "rollback", "回滚到v" + version.getVersionNo());

        result.put("success", true);
        result.put("rolledBackTo", version.getVersionNo());
        result.put("message", "已回滚到版本 v" + version.getVersionNo());
        log.info("版本回滚: merchantId={}, 回滚到v{}", merchantId, version.getVersionNo());

        return result;
    }
}
