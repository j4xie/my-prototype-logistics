package com.joolun.web.controller.mall;

import com.joolun.common.annotation.Anonymous;
import com.joolun.common.core.domain.R;
import com.joolun.mall.entity.AiDecorationSession;
import com.joolun.mall.entity.DecorationThemePreset;
import com.joolun.mall.service.DecorationAiService;
import com.joolun.mall.service.DecorationService;
import com.joolun.mall.service.GuideSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 小程序装修API
 * 供小程序端获取页面装修配置
 */
@Slf4j
@RestController
@RequestMapping("/weixin/api/ma/decoration")
@RequiredArgsConstructor
public class MaDecorationApi {

    private final DecorationService decorationService;
    private final DecorationAiService decorationAiService;
    private final GuideSessionService guideSessionService;

    /**
     * 获取页面渲染配置
     *
     * @param merchantId 商户ID（可选）
     * @param pageType   页面类型，默认home
     * @return 页面渲染配置
     */
    @Anonymous
    @GetMapping("/page")
    public R<Map<String, Object>> getPageConfig(
            @RequestParam(required = false) Long merchantId,
            @RequestParam(defaultValue = "home") String pageType) {
        try {
            // 返回默认的都鲜来绿色主题配置
            Map<String, Object> config = new HashMap<>();

            // 主题配置
            Map<String, Object> theme = new HashMap<>();
            theme.put("primaryColor", "#52c41a");
            theme.put("secondaryColor", "#1a1a1a");
            theme.put("backgroundColor", "#f5f5f5");
            theme.put("textColor", "#333333");
            theme.put("accentColor", "#52c41a");
            config.put("theme", theme);

            // 模块配置（默认启用所有模块）
            config.put("modules", new Object[]{});

            return R.ok(config);
        } catch (Exception e) {
            log.error("获取页面配置失败: merchantId={}, pageType={}", merchantId, pageType, e);
            return R.fail("获取页面配置失败");
        }
    }

    /**
     * 获取CSS变量配置
     * 用于小程序动态设置主题样式
     *
     * @param merchantId 商户ID（可选）
     * @return CSS变量映射
     */
    @Anonymous
    @GetMapping("/css-variables")
    public R<Map<String, String>> getCssVariables(
            @RequestParam(required = false) Long merchantId) {
        try {
            // 返回都鲜来绿色主题CSS变量
            Map<String, String> cssVariables = new HashMap<>();
            cssVariables.put("--primary-gold", "#52c41a");
            cssVariables.put("--primary-color", "#52c41a");
            cssVariables.put("--primary-light", "#d7f0db");
            cssVariables.put("--primary-dark", "#389e0d");
            cssVariables.put("--dark-bg", "#1a1a1a");
            cssVariables.put("--dark-secondary", "#2d2d2d");
            cssVariables.put("--notice-bg", "#d7f0db");
            cssVariables.put("--notice-text", "#389e0d");
            cssVariables.put("--text-primary", "#333");
            cssVariables.put("--text-secondary", "#666");
            cssVariables.put("--text-light", "#999");
            cssVariables.put("--border-gold", "#52c41a");
            cssVariables.put("--accent-color", "#52c41a");

            return R.ok(cssVariables);
        } catch (Exception e) {
            log.error("获取CSS变量失败: merchantId={}", merchantId, e);
            return R.fail("获取CSS变量失败");
        }
    }

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 获取主题预设列表
     * 供小程序店铺装修使用
     *
     * @return 主题列表
     */
    @Anonymous
    @GetMapping("/themes")
    public R<List<Map<String, Object>>> getThemes() {
        try {
            // 获取所有启用的主题
            List<DecorationThemePreset> themes = decorationService.listSystemThemes();

            // 转换为前端需要的格式
            List<Map<String, Object>> result = themes.stream().map(theme -> {
                Map<String, Object> item = new HashMap<>();
                item.put("id", theme.getId());
                item.put("code", theme.getCode());
                item.put("name", theme.getName());
                item.put("description", theme.getDescription());
                item.put("slogan", theme.getSlogan());

                // 从colorConfig JSON解析颜色值
                String primaryColor = "#52c41a";  // 默认绿色
                String secondaryColor = "#389e0d";
                if (theme.getColorConfig() != null && !theme.getColorConfig().isEmpty()) {
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
                return item;
            }).collect(Collectors.toList());

            return R.ok(result);
        } catch (Exception e) {
            log.error("获取主题列表失败", e);
            return R.fail("获取主题列表失败");
        }
    }

    /**
     * 保存商户页面配置
     *
     * @param params 配置参数
     * @return 操作结果
     */
    @Anonymous
    @PostMapping("/page-config")
    public R<Boolean> savePageConfig(@RequestBody Map<String, Object> params) {
        try {
            Long merchantId = params.get("merchantId") != null ?
                    Long.parseLong(params.get("merchantId").toString()) : null;
            String pageType = (String) params.getOrDefault("pageType", "home");
            String themeCode = (String) params.get("themeCode");
            String themeConfig = (String) params.get("themeConfig");

            log.info("保存页面配置: merchantId={}, pageType={}, themeCode={}", merchantId, pageType, themeCode);

            // TODO: 实际保存到MerchantPageConfig表
            // 暂时返回成功
            return R.ok(true);
        } catch (Exception e) {
            log.error("保存页面配置失败", e);
            return R.fail("保存配置失败");
        }
    }

    /**
     * AI分析需求（简化版）
     *
     * @param params 包含prompt的请求参数
     * @return 分析结果
     */
    @Anonymous
    @PostMapping("/ai/analyze")
    public R<Map<String, Object>> analyzeWithAi(@RequestBody Map<String, Object> params) {
        try {
            String prompt = (String) params.get("prompt");
            if (prompt == null || prompt.trim().isEmpty()) {
                return R.fail("请输入店铺描述");
            }

            // 简单的关键词匹配分析
            Map<String, Object> result = analyzePromptLocally(prompt);
            return R.ok(result);
        } catch (Exception e) {
            log.error("AI分析失败", e);
            return R.fail("分析失败");
        }
    }

    /**
     * 本地简单分析（关键词匹配）
     */
    private Map<String, Object> analyzePromptLocally(String prompt) {
        Map<String, Object> result = new HashMap<>();
        String lowerPrompt = prompt.toLowerCase();

        // 关键词到主题映射
        if (lowerPrompt.contains("生鲜") || lowerPrompt.contains("水果") || lowerPrompt.contains("蔬菜") || lowerPrompt.contains("有机")) {
            result.put("recommendedTheme", "fresh_green");
            result.put("reason", "您的店铺涉及生鲜/有机食品，推荐清新绿主题，传递新鲜健康的理念");
        } else if (lowerPrompt.contains("海鲜") || lowerPrompt.contains("水产")) {
            result.put("recommendedTheme", "ocean_blue");
            result.put("reason", "海鲜水产店铺推荐海洋蓝主题，展现深海品质");
        } else if (lowerPrompt.contains("高端") || lowerPrompt.contains("奢华") || lowerPrompt.contains("礼品")) {
            result.put("recommendedTheme", "classic_gold");
            result.put("reason", "高端礼品店铺推荐经典金主题，彰显尊贵品质");
        } else if (lowerPrompt.contains("甜品") || lowerPrompt.contains("蛋糕") || lowerPrompt.contains("烘焙")) {
            result.put("recommendedTheme", "sweet_pink");
            result.put("reason", "甜品烘焙店铺推荐甜美粉主题，营造温馨甜蜜氛围");
        } else if (lowerPrompt.contains("母婴") || lowerPrompt.contains("宝宝") || lowerPrompt.contains("儿童")) {
            result.put("recommendedTheme", "baby_warm");
            result.put("reason", "母婴店铺推荐母婴暖主题，传递关爱与温暖");
        } else if (lowerPrompt.contains("科技") || lowerPrompt.contains("数码") || lowerPrompt.contains("电子")) {
            result.put("recommendedTheme", "tech_blue");
            result.put("reason", "科技数码店铺推荐科技蓝主题，展现专业与创新");
        } else if (lowerPrompt.contains("促销") || lowerPrompt.contains("活动") || lowerPrompt.contains("特价")) {
            result.put("recommendedTheme", "dopamine_orange");
            result.put("reason", "促销活动推荐活力橙主题，激发购买欲望");
        } else if (lowerPrompt.contains("简约") || lowerPrompt.contains("极简")) {
            result.put("recommendedTheme", "minimal_white");
            result.put("reason", "追求简约风格推荐简约白主题，简洁大方");
        } else {
            // 默认推荐
            result.put("recommendedTheme", "fresh_green");
            result.put("reason", "默认推荐清新绿主题，适合大多数店铺");
        }

        result.put("confidence", 0.8);
        return result;
    }

    // ==================== 素材相关API ====================

    /**
     * 获取主题关联的所有素材
     * @param code 主题编码
     * @return 素材数据（布局、图片、组件样式、图标、字体）
     */
    @Anonymous
    @GetMapping("/theme/{code}/assets")
    public R<Map<String, Object>> getThemeAssets(@PathVariable("code") String code) {
        try {
            Map<String, Object> assets = decorationService.getThemeAssets(code);
            return R.ok(assets);
        } catch (Exception e) {
            log.error("获取主题素材失败: code={}", code, e);
            return R.fail("获取主题素材失败");
        }
    }

    /**
     * 获取所有布局预设列表
     * @return 布局列表
     */
    @Anonymous
    @GetMapping("/layouts")
    public R<List<Map<String, Object>>> getLayouts() {
        try {
            List<Map<String, Object>> layouts = decorationService.listLayouts();
            return R.ok(layouts);
        } catch (Exception e) {
            log.error("获取布局列表失败", e);
            return R.fail("获取布局列表失败");
        }
    }

    /**
     * 按行业获取图片素材
     * @param industry 行业类型
     * @return 图片列表
     */
    @Anonymous
    @GetMapping("/images/{industry}")
    public R<List<Map<String, Object>>> getImagesByIndustry(@PathVariable("industry") String industry) {
        try {
            List<Map<String, Object>> images = decorationService.listImages(industry);
            return R.ok(images);
        } catch (Exception e) {
            log.error("获取行业图片失败: industry={}", industry, e);
            return R.fail("获取行业图片失败");
        }
    }

    /**
     * 获取组件样式列表
     * @param componentType 组件类型（可选）
     * @return 组件样式列表
     */
    @Anonymous
    @GetMapping("/component-styles")
    public R<List<Map<String, Object>>> getComponentStyles(
            @RequestParam(required = false) String componentType) {
        try {
            List<Map<String, Object>> styles = decorationService.listComponentStyles(componentType);
            return R.ok(styles);
        } catch (Exception e) {
            log.error("获取组件样式失败: componentType={}", componentType, e);
            return R.fail("获取组件样式失败");
        }
    }

    /**
     * 获取图标库
     * @param category 分类（可选）
     * @return 图标列表
     */
    @Anonymous
    @GetMapping("/icons")
    public R<List<Map<String, Object>>> getIcons(
            @RequestParam(required = false) String category) {
        try {
            List<Map<String, Object>> icons = decorationService.listIcons(category);
            return R.ok(icons);
        } catch (Exception e) {
            log.error("获取图标列表失败: category={}", category, e);
            return R.fail("获取图标列表失败");
        }
    }

    /**
     * 获取字体样式
     * @param usageType 用途类型（可选）
     * @return 字体列表
     */
    @Anonymous
    @GetMapping("/fonts")
    public R<List<Map<String, Object>>> getFonts(
            @RequestParam(required = false) String usageType) {
        try {
            List<Map<String, Object>> fonts = decorationService.listFonts(usageType);
            return R.ok(fonts);
        } catch (Exception e) {
            log.error("获取字体列表失败: usageType={}", usageType, e);
            return R.fail("获取字体列表失败");
        }
    }

    // ==================== AI图片生成API ====================

    /**
     * AI生成图片
     * 商户根据描述实时生成自定义图片，调用通义万相API
     *
     * @param params 包含prompt描述、style风格、size尺寸
     * @return 生成的图片URL
     */
    @Anonymous
    @PostMapping("/ai/generate-image")
    public R<Map<String, Object>> generateImage(@RequestBody Map<String, Object> params) {
        try {
            String prompt = (String) params.get("prompt");
            String style = (String) params.getOrDefault("style", "realistic");
            String size = (String) params.getOrDefault("size", "1280*720");

            if (prompt == null || prompt.trim().isEmpty()) {
                return R.fail("请输入图片描述");
            }

            log.info("收到AI图片生成请求: prompt={}, style={}, size={}", prompt, style, size);

            // 调用AI图片生成服务
            Map<String, Object> result = decorationAiService.generateImage(prompt, style, size);

            Boolean success = (Boolean) result.get("success");
            if (success != null && success) {
                return R.ok(result);
            } else {
                String message = (String) result.getOrDefault("message", "图片生成失败");
                return R.fail(message);
            }
        } catch (Exception e) {
            log.error("AI生成图片失败", e);
            return R.fail("图片生成失败: " + e.getMessage());
        }
    }

    // ==================== 引导式装修API ====================

    /**
     * 开始引导式装修会话
     * 创建新的引导会话，返回sessionId和行业选项
     *
     * @param params 包含merchantId的请求参数
     * @return 会话信息和行业选项
     */
    @Anonymous
    @PostMapping("/ai/guide/start")
    public R<Map<String, Object>> startGuide(@RequestBody Map<String, Object> params) {
        try {
            Long merchantId = null;
            if (params.get("merchantId") != null) {
                merchantId = Long.parseLong(params.get("merchantId").toString());
            }

            log.info("开始引导式装修: merchantId={}", merchantId);

            Map<String, Object> result = guideSessionService.startGuide(merchantId);
            return R.ok(result);
        } catch (Exception e) {
            log.error("开始引导会话失败", e);
            return R.fail("开始引导失败: " + e.getMessage());
        }
    }

    /**
     * 处理引导步骤选择
     * 用户在当前步骤做出选择，返回下一步的选项
     *
     * @param params 包含sessionId、step、selection的请求参数
     * @return 下一步数据
     */
    @Anonymous
    @PostMapping("/ai/guide/select")
    public R<Map<String, Object>> guideSelect(@RequestBody Map<String, Object> params) {
        try {
            String sessionId = (String) params.get("sessionId");
            Integer step = params.get("step") != null ?
                    Integer.parseInt(params.get("step").toString()) : null;
            String selection = (String) params.get("selection");

            if (sessionId == null || sessionId.trim().isEmpty()) {
                return R.fail("会话ID不能为空");
            }
            if (step == null) {
                return R.fail("步骤不能为空");
            }
            if (selection == null || selection.trim().isEmpty()) {
                return R.fail("选择不能为空");
            }

            log.info("处理引导选择: sessionId={}, step={}, selection={}", sessionId, step, selection);

            Map<String, Object> result = guideSessionService.processSelection(sessionId, step, selection);
            return R.ok(result);
        } catch (RuntimeException e) {
            log.warn("处理引导选择失败: {}", e.getMessage());
            return R.fail(e.getMessage());
        } catch (Exception e) {
            log.error("处理引导选择异常", e);
            return R.fail("处理选择失败");
        }
    }

    /**
     * 获取行业选项列表
     * 引导流程步骤1的选项
     *
     * @return 行业选项列表
     */
    @Anonymous
    @GetMapping("/ai/guide/industries")
    public R<List<Map<String, Object>>> getIndustryOptions() {
        try {
            List<Map<String, Object>> industries = guideSessionService.getIndustryOptions();
            return R.ok(industries);
        } catch (Exception e) {
            log.error("获取行业选项失败", e);
            return R.fail("获取行业选项失败");
        }
    }

    /**
     * 获取指定行业的风格选项
     * 引导流程步骤2的选项
     *
     * @param industry 行业类型编码
     * @return 风格选项列表
     */
    @Anonymous
    @GetMapping("/ai/guide/styles/{industry}")
    public R<List<Map<String, Object>>> getStyleOptions(@PathVariable("industry") String industry) {
        try {
            if (industry == null || industry.trim().isEmpty()) {
                return R.fail("行业类型不能为空");
            }

            List<Map<String, Object>> styles = guideSessionService.getStyleOptions(industry);
            return R.ok(styles);
        } catch (Exception e) {
            log.error("获取风格选项失败: industry={}", industry, e);
            return R.fail("获取风格选项失败");
        }
    }

    /**
     * 获取主题预览
     * 根据行业和风格获取匹配的主题列表
     *
     * @param industry 行业类型编码
     * @param style    风格类型编码
     * @return 主题预览数据
     */
    @Anonymous
    @GetMapping("/ai/guide/themes")
    public R<Map<String, Object>> getThemePreview(
            @RequestParam String industry,
            @RequestParam String style) {
        try {
            Map<String, Object> preview = guideSessionService.getThemePreview(industry, style);
            return R.ok(preview);
        } catch (Exception e) {
            log.error("获取主题预览失败: industry={}, style={}", industry, style, e);
            return R.fail("获取主题预览失败");
        }
    }

    /**
     * 完成引导并保存配置
     * 用户确认所有选择后，保存装修配置
     *
     * @param params 包含sessionId和finalConfig的请求参数
     * @return 保存结果
     */
    @Anonymous
    @PostMapping("/ai/guide/finish")
    public R<Map<String, Object>> finishGuide(@RequestBody Map<String, Object> params) {
        try {
            String sessionId = (String) params.get("sessionId");
            @SuppressWarnings("unchecked")
            Map<String, Object> finalConfig = (Map<String, Object>) params.get("finalConfig");

            if (sessionId == null || sessionId.trim().isEmpty()) {
                return R.fail("会话ID不能为空");
            }

            log.info("完成引导装修: sessionId={}", sessionId);

            Map<String, Object> result = guideSessionService.finishGuide(
                    sessionId,
                    finalConfig != null ? finalConfig : new HashMap<>()
            );
            return R.ok(result);
        } catch (RuntimeException e) {
            log.warn("完成引导失败: {}", e.getMessage());
            return R.fail(e.getMessage());
        } catch (Exception e) {
            log.error("完成引导异常", e);
            return R.fail("完成引导失败");
        }
    }

    /**
     * 获取引导会话状态
     * 查询当前会话的进度和已选择的内容
     *
     * @param sessionId 会话ID
     * @return 会话状态
     */
    @Anonymous
    @GetMapping("/ai/guide/session/{sessionId}")
    public R<Map<String, Object>> getGuideSession(@PathVariable("sessionId") String sessionId) {
        try {
            AiDecorationSession session = guideSessionService.getSession(sessionId);
            if (session == null) {
                return R.fail("会话不存在或已过期");
            }

            Map<String, Object> result = new HashMap<>();
            result.put("sessionId", session.getSessionId());
            result.put("status", session.getStatus());
            result.put("currentStep", session.getCurrentStep());
            result.put("selectedIndustry", session.getSelectedIndustry());
            result.put("selectedStyle", session.getSelectedStyle());
            result.put("selectedThemeCode", session.getSelectedThemeCode());
            result.put("selectedLayoutId", session.getSelectedLayoutId());
            result.put("createTime", session.getCreateTime());

            return R.ok(result);
        } catch (Exception e) {
            log.error("获取会话状态失败: sessionId={}", sessionId, e);
            return R.fail("获取会话状态失败");
        }
    }
}
