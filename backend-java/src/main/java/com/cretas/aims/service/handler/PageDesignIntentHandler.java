package com.cretas.aims.service.handler;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.LowcodeComponentDefinition;
import com.cretas.aims.entity.LowcodePageConfig;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.LowcodeComponentDefinitionRepository;
import com.cretas.aims.repository.LowcodePageConfigRepository;
import com.cretas.aims.util.ErrorSanitizer;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 页面设计意图处理器
 *
 * 处理 PAGE_DESIGN 分类的意图:
 * - PAGE_GENERATE: AI生成页面布局
 * - PAGE_COMPONENT_ADD: 添加组件到页面
 * - PAGE_STYLE_UPDATE: 更新页面样式/主题
 * - PAGE_DATA_BIND: 数据绑定配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PageDesignIntentHandler implements IntentHandler {

    private final LowcodePageConfigRepository pageConfigRepository;
    private final LowcodeComponentDefinitionRepository componentDefinitionRepository;
    private final DashScopeClient dashScopeClient;
    private final ObjectMapper objectMapper;

    // 默认页面类型
    private static final String DEFAULT_PAGE_TYPE = "home";

    // 默认页面ID
    private static final String DEFAULT_PAGE_ID = "home_page";

    @Override
    public String getSupportedCategory() {
        return "PAGE_DESIGN";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {
        String intentCode = intentConfig.getIntentCode();
        log.info("PageDesignIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            switch (intentCode) {
                case "PAGE_GENERATE":
                    return handlePageGenerate(factoryId, request, intentConfig, userId);
                case "PAGE_COMPONENT_ADD":
                    return handleComponentAdd(factoryId, request, intentConfig, userId);
                case "PAGE_STYLE_UPDATE":
                    return handleStyleUpdate(factoryId, request, intentConfig, userId);
                case "PAGE_DATA_BIND":
                    return handleDataBind(factoryId, request, intentConfig, userId);
                default:
                    return buildFailedResponse(intentCode, intentConfig, "未知的页面设计意图: " + intentCode);
            }

        } catch (Exception e) {
            log.error("PageDesignIntentHandler执行失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            return buildFailedResponse(intentCode, intentConfig, "执行失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        String intentCode = intentConfig.getIntentCode();
        log.info("PageDesignIntentHandler预览: intentCode={}, factoryId={}", intentCode, factoryId);

        String previewMessage;
        switch (intentCode) {
            case "PAGE_GENERATE":
                previewMessage = "将使用AI根据您的需求生成页面布局配置。";
                break;
            case "PAGE_COMPONENT_ADD":
                previewMessage = "将解析您的指令并添加相应组件到页面。";
                break;
            case "PAGE_STYLE_UPDATE":
                previewMessage = "将根据您的描述更新页面主题和样式配置。";
                break;
            case "PAGE_DATA_BIND":
                previewMessage = "将为页面组件配置数据绑定关系。";
                break;
            default:
                previewMessage = "未知的页面设计操作";
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig.getIntentName())
                .intentCategory("PAGE_DESIGN")
                .status("PREVIEW")
                .message(previewMessage)
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ==================== Intent Handlers ====================

    /**
     * 处理AI生成页面布局
     * 获取可用组件列表，调用LLM生成页面配置
     */
    private IntentExecuteResponse handlePageGenerate(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig, Long userId) {
        String userInput = request.getUserInput();
        log.info("页面生成意图: factoryId={}, userInput={}", factoryId, userInput);

        // 1. 获取可用组件列表
        List<LowcodeComponentDefinition> availableComponents = getAvailableComponents(factoryId);
        if (availableComponents.isEmpty()) {
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "没有可用的组件定义，请先配置组件库");
        }

        // 2. 构建LLM Prompt
        String systemPrompt = buildPageGeneratePrompt(availableComponents);
        String llmResponse;
        try {
            String prompt = userInput != null && !userInput.isEmpty()
                    ? userInput
                    : "生成一个适合工厂管理的首页布局，包含数据统计、快捷操作和图表展示";
            llmResponse = dashScopeClient.chatLowTemp(systemPrompt, prompt);
        } catch (Exception e) {
            log.error("LLM调用失败: {}", e.getMessage());
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "AI生成页面失败，请稍后重试");
        }

        // 3. 解析生成的布局
        Map<String, Object> generatedConfig;
        try {
            generatedConfig = parseGeneratedPageConfig(llmResponse, availableComponents);
        } catch (Exception e) {
            log.error("解析生成配置失败: {}", e.getMessage());
            // 返回默认配置
            generatedConfig = buildDefaultPageConfig(availableComponents);
        }

        // 4. 提取页面信息
        String pageId = extractString(request.getContext(), "pageId", DEFAULT_PAGE_ID);
        String pageType = extractString(request.getContext(), "pageType", DEFAULT_PAGE_TYPE);
        String pageName = extractString(request.getContext(), "pageName", "AI生成页面");

        // 5. 保存页面配置
        LowcodePageConfig savedConfig = savePageConfig(factoryId, pageId, pageType, pageName,
                generatedConfig, userInput, userId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("PAGE_DESIGN")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("已成功生成页面布局配置")
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "pageConfig", generatedConfig,
                        "pageId", savedConfig.getPageId(),
                        "configId", savedConfig.getId(),
                        "componentCount", countComponents(generatedConfig)
                ))
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("LowcodePageConfig")
                                .entityId(savedConfig.getId().toString())
                                .entityName(pageName)
                                .action("CREATED")
                                .changes(Map.of("source", "AI_GENERATED"))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_PAGE")
                                .actionName("预览页面")
                                .description("预览生成的页面效果")
                                .endpoint("/api/mobile/" + factoryId + "/lowcode/pages/" + pageId + "/preview")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("EDIT_PAGE")
                                .actionName("编辑页面")
                                .description("进一步调整页面配置")
                                .endpoint("/api/mobile/" + factoryId + "/lowcode/pages/" + pageId + "/edit")
                                .build()
                ))
                .build();
    }

    /**
     * 处理添加组件到页面
     * 解析用户指令，确定要添加的组件并更新页面配置
     */
    private IntentExecuteResponse handleComponentAdd(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig, Long userId) {
        String userInput = request.getUserInput();
        log.info("添加组件意图: factoryId={}, userInput={}", factoryId, userInput);

        // 1. 获取目标页面ID
        String pageId = extractString(request.getContext(), "pageId", DEFAULT_PAGE_ID);

        // 2. 获取当前页面配置
        Optional<LowcodePageConfig> existingConfig = pageConfigRepository.findByFactoryIdAndPageId(factoryId, pageId);
        if (existingConfig.isEmpty()) {
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "未找到页面配置: " + pageId + "，请先创建页面");
        }

        // 3. 获取可用组件
        List<LowcodeComponentDefinition> availableComponents = getAvailableComponents(factoryId);

        // 4. 调用LLM解析用户指令
        String systemPrompt = buildComponentAddPrompt(availableComponents);
        String llmResponse;
        try {
            llmResponse = dashScopeClient.chatLowTemp(systemPrompt, userInput);
        } catch (Exception e) {
            log.error("LLM调用失败: {}", e.getMessage());
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "AI解析指令失败，请尝试更具体的描述，例如：'添加一个折线图组件'");
        }

        // 5. 解析LLM响应并添加组件
        Map<String, Object> componentToAdd;
        try {
            componentToAdd = parseComponentAddResponse(llmResponse, availableComponents);
        } catch (Exception e) {
            log.error("解析组件添加响应失败: {}", e.getMessage());
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "无法理解您要添加的组件，请尝试：'添加一个统计卡片' 或 '添加柱状图'");
        }

        // 6. 更新页面配置
        LowcodePageConfig config = existingConfig.get();
        Map<String, Object> layoutConfig = parseLayoutConfig(config.getLayoutConfig());
        addComponentToLayout(layoutConfig, componentToAdd);
        config.setLayoutConfig(toJson(layoutConfig));
        config.setVersion(config.getVersion() + 1);
        pageConfigRepository.save(config);

        String componentName = (String) componentToAdd.getOrDefault("name", "组件");

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("PAGE_DESIGN")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("已成功添加组件: " + componentName)
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "addedComponent", componentToAdd,
                        "pageId", pageId,
                        "newVersion", config.getVersion()
                ))
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("LowcodePageConfig")
                                .entityId(config.getId().toString())
                                .entityName(config.getPageName())
                                .action("UPDATED")
                                .changes(Map.of(
                                        "operation", "ADD_COMPONENT",
                                        "componentType", componentToAdd.get("type")
                                ))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("ADD_MORE")
                                .actionName("继续添加")
                                .description("添加更多组件")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("PREVIEW")
                                .actionName("预览页面")
                                .description("预览添加组件后的效果")
                                .endpoint("/api/mobile/" + factoryId + "/lowcode/pages/" + pageId + "/preview")
                                .build()
                ))
                .build();
    }

    /**
     * 处理更新页面样式/主题
     * 解析样式更新指令并更新themeConfig
     */
    private IntentExecuteResponse handleStyleUpdate(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig, Long userId) {
        String userInput = request.getUserInput();
        log.info("样式更新意图: factoryId={}, userInput={}", factoryId, userInput);

        // 1. 获取目标页面ID
        String pageId = extractString(request.getContext(), "pageId", DEFAULT_PAGE_ID);

        // 2. 获取当前页面配置
        Optional<LowcodePageConfig> existingConfig = pageConfigRepository.findByFactoryIdAndPageId(factoryId, pageId);
        if (existingConfig.isEmpty()) {
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "未找到页面配置: " + pageId + "，请先创建页面");
        }

        // 3. 调用LLM解析样式更新指令
        String systemPrompt = buildStyleUpdatePrompt();
        String llmResponse;
        try {
            llmResponse = dashScopeClient.chatLowTemp(systemPrompt, userInput);
        } catch (Exception e) {
            log.error("LLM调用失败: {}", e.getMessage());
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "AI解析样式指令失败，请尝试更具体的描述");
        }

        // 4. 解析LLM响应并更新样式
        Map<String, Object> styleUpdates;
        try {
            styleUpdates = parseStyleUpdateResponse(llmResponse);
        } catch (Exception e) {
            log.error("解析样式更新响应失败: {}", e.getMessage());
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "无法理解您的样式需求，请尝试：'使用深色主题' 或 '主色调改为蓝色'");
        }

        // 5. 更新主题配置
        LowcodePageConfig config = existingConfig.get();
        Map<String, Object> themeConfig = parseThemeConfig(config.getThemeConfig());
        themeConfig.putAll(styleUpdates);
        config.setThemeConfig(toJson(themeConfig));
        config.setVersion(config.getVersion() + 1);
        pageConfigRepository.save(config);

        String styleSummary = (String) styleUpdates.getOrDefault("summary", "样式已更新");

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("PAGE_DESIGN")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message(styleSummary)
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "styleUpdates", styleUpdates,
                        "pageId", pageId,
                        "newThemeConfig", themeConfig,
                        "newVersion", config.getVersion()
                ))
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("LowcodePageConfig")
                                .entityId(config.getId().toString())
                                .entityName(config.getPageName())
                                .action("UPDATED")
                                .changes(Map.of("operation", "STYLE_UPDATE", "updates", styleUpdates))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("PREVIEW")
                                .actionName("预览效果")
                                .description("预览样式更新后的效果")
                                .endpoint("/api/mobile/" + factoryId + "/lowcode/pages/" + pageId + "/preview")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("RESET_STYLE")
                                .actionName("重置样式")
                                .description("恢复默认样式")
                                .build()
                ))
                .build();
    }

    /**
     * 处理数据绑定配置
     * 解析数据绑定需求并更新dataBindings配置
     */
    private IntentExecuteResponse handleDataBind(String factoryId, IntentExecuteRequest request,
                                                  AIIntentConfig intentConfig, Long userId) {
        String userInput = request.getUserInput();
        log.info("数据绑定意图: factoryId={}, userInput={}", factoryId, userInput);

        // 1. 获取目标页面ID
        String pageId = extractString(request.getContext(), "pageId", DEFAULT_PAGE_ID);

        // 2. 获取当前页面配置
        Optional<LowcodePageConfig> existingConfig = pageConfigRepository.findByFactoryIdAndPageId(factoryId, pageId);
        if (existingConfig.isEmpty()) {
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "未找到页面配置: " + pageId + "，请先创建页面");
        }

        // 3. 调用LLM解析数据绑定指令
        String systemPrompt = buildDataBindPrompt();
        String llmResponse;
        try {
            llmResponse = dashScopeClient.chatLowTemp(systemPrompt, userInput);
        } catch (Exception e) {
            log.error("LLM调用失败: {}", e.getMessage());
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "AI解析数据绑定指令失败，请尝试更具体的描述");
        }

        // 4. 解析LLM响应
        Map<String, Object> bindingConfig;
        try {
            bindingConfig = parseDataBindResponse(llmResponse);
        } catch (Exception e) {
            log.error("解析数据绑定响应失败: {}", e.getMessage());
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "无法理解您的数据绑定需求，请尝试：'将统计卡片绑定到订单数据接口'");
        }

        // 5. 更新数据绑定配置
        LowcodePageConfig config = existingConfig.get();
        Map<String, Object> dataBindings = parseDataBindings(config.getDataBindings());
        mergeDataBindings(dataBindings, bindingConfig);
        config.setDataBindings(toJson(dataBindings));
        config.setVersion(config.getVersion() + 1);
        pageConfigRepository.save(config);

        String bindingSummary = (String) bindingConfig.getOrDefault("summary", "数据绑定已配置");

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("PAGE_DESIGN")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message(bindingSummary)
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "bindingConfig", bindingConfig,
                        "pageId", pageId,
                        "dataBindings", dataBindings,
                        "newVersion", config.getVersion()
                ))
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("LowcodePageConfig")
                                .entityId(config.getId().toString())
                                .entityName(config.getPageName())
                                .action("UPDATED")
                                .changes(Map.of("operation", "DATA_BIND", "bindings", bindingConfig))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("TEST_BINDING")
                                .actionName("测试绑定")
                                .description("测试数据绑定是否生效")
                                .endpoint("/api/mobile/" + factoryId + "/lowcode/pages/" + pageId + "/test-bindings")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_BINDINGS")
                                .actionName("查看所有绑定")
                                .description("查看页面的所有数据绑定配置")
                                .build()
                ))
                .build();
    }

    // ==================== Helper Methods ====================

    /**
     * 获取可用组件列表
     */
    private List<LowcodeComponentDefinition> getAvailableComponents(String factoryId) {
        // 获取系统组件和工厂自定义组件
        List<LowcodeComponentDefinition> components = componentDefinitionRepository.findByIsSystemOrFactoryId(1, factoryId);
        // 只返回启用的组件
        return components.stream()
                .filter(c -> c.getStatus() == 1)
                .collect(Collectors.toList());
    }

    /**
     * 构建页面生成Prompt
     */
    private String buildPageGeneratePrompt(List<LowcodeComponentDefinition> components) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个低代码页面设计师。请根据用户需求生成页面布局配置。\n\n");
        sb.append("可用组件:\n");

        for (LowcodeComponentDefinition comp : components) {
            sb.append(String.format("- %s (%s): %s\n",
                    comp.getName(), comp.getComponentType(),
                    comp.getAiDescription() != null ? comp.getAiDescription() : ""));
        }

        sb.append("\n请输出JSON格式的页面配置:\n");
        sb.append("{\n");
        sb.append("  \"layout\": {\n");
        sb.append("    \"type\": \"grid\",\n");
        sb.append("    \"columns\": 12,\n");
        sb.append("    \"gap\": 16\n");
        sb.append("  },\n");
        sb.append("  \"components\": [\n");
        sb.append("    {\n");
        sb.append("      \"id\": \"唯一ID\",\n");
        sb.append("      \"type\": \"组件type\",\n");
        sb.append("      \"name\": \"组件显示名\",\n");
        sb.append("      \"position\": { \"x\": 0, \"y\": 0, \"w\": 6, \"h\": 2 },\n");
        sb.append("      \"props\": { ... }\n");
        sb.append("    }\n");
        sb.append("  ]\n");
        sb.append("}\n\n");
        sb.append("要求:\n");
        sb.append("1. 合理安排组件位置，避免重叠\n");
        sb.append("2. 重要信息放在页面上方\n");
        sb.append("3. 只输出JSON，不要其他内容");

        return sb.toString();
    }

    /**
     * 构建组件添加Prompt
     */
    private String buildComponentAddPrompt(List<LowcodeComponentDefinition> components) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个页面组件助手。用户会描述想要添加的组件，请解析并返回组件配置。\n\n");
        sb.append("可用组件:\n");

        for (LowcodeComponentDefinition comp : components) {
            sb.append(String.format("- %s (type: %s, category: %s)\n",
                    comp.getName(), comp.getComponentType(), comp.getCategory()));
        }

        sb.append("\n请分析用户描述，输出JSON格式:\n");
        sb.append("{\n");
        sb.append("  \"type\": \"匹配的组件type\",\n");
        sb.append("  \"name\": \"组件名称\",\n");
        sb.append("  \"position\": { \"x\": 0, \"y\": 0, \"w\": 6, \"h\": 2 },\n");
        sb.append("  \"props\": { ... 用户指定的属性 }\n");
        sb.append("}\n\n");
        sb.append("只输出JSON，不要其他内容。如果无法匹配组件，输出 {\"error\": \"无法匹配组件\"}");

        return sb.toString();
    }

    /**
     * 构建样式更新Prompt
     */
    private String buildStyleUpdatePrompt() {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个页面样式助手。用户会描述样式需求，请解析并返回样式配置。\n\n");
        sb.append("可配置的样式选项:\n");
        sb.append("- theme: 'light' | 'dark' (主题模式)\n");
        sb.append("- primaryColor: 主色调 (如 #1890ff)\n");
        sb.append("- fontSize: 'small' | 'medium' | 'large'\n");
        sb.append("- borderRadius: 边框圆角 (如 8)\n");
        sb.append("- spacing: 间距大小 (如 16)\n");
        sb.append("- fontFamily: 字体\n\n");
        sb.append("请输出JSON格式:\n");
        sb.append("{\n");
        sb.append("  \"theme\": \"light\",\n");
        sb.append("  \"primaryColor\": \"#1890ff\",\n");
        sb.append("  \"summary\": \"操作描述\"\n");
        sb.append("}\n\n");
        sb.append("只输出需要更新的字段和summary，不要其他内容");

        return sb.toString();
    }

    /**
     * 构建数据绑定Prompt
     */
    private String buildDataBindPrompt() {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个数据绑定配置助手。用户会描述数据绑定需求，请解析并返回绑定配置。\n\n");
        sb.append("绑定配置格式:\n");
        sb.append("{\n");
        sb.append("  \"componentId\": \"目标组件ID\",\n");
        sb.append("  \"dataSource\": {\n");
        sb.append("    \"type\": \"api\" | \"static\" | \"store\",\n");
        sb.append("    \"endpoint\": \"API路径\",\n");
        sb.append("    \"method\": \"GET\" | \"POST\",\n");
        sb.append("    \"params\": { ... }\n");
        sb.append("  },\n");
        sb.append("  \"mapping\": {\n");
        sb.append("    \"propName\": \"dataPath\"\n");
        sb.append("  },\n");
        sb.append("  \"refreshInterval\": 刷新间隔秒数,\n");
        sb.append("  \"summary\": \"操作描述\"\n");
        sb.append("}\n\n");
        sb.append("只输出JSON，不要其他内容");

        return sb.toString();
    }

    /**
     * 解析生成的页面配置
     */
    private Map<String, Object> parseGeneratedPageConfig(String response, List<LowcodeComponentDefinition> components)
            throws JsonProcessingException {
        String cleaned = cleanJsonResponse(response);
        Map<String, Object> config = objectMapper.readValue(cleaned, new TypeReference<>() {});

        // 验证并补充组件信息
        if (config.containsKey("components")) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> comps = (List<Map<String, Object>>) config.get("components");
            for (Map<String, Object> comp : comps) {
                String type = (String) comp.get("type");
                components.stream()
                        .filter(c -> c.getComponentType().equals(type))
                        .findFirst()
                        .ifPresent(def -> {
                            comp.putIfAbsent("name", def.getName());
                            comp.putIfAbsent("category", def.getCategory());
                        });
                // 确保有唯一ID
                comp.putIfAbsent("id", UUID.randomUUID().toString().substring(0, 8));
            }
        }

        return config;
    }

    /**
     * 解析组件添加响应
     */
    private Map<String, Object> parseComponentAddResponse(String response, List<LowcodeComponentDefinition> components)
            throws JsonProcessingException {
        String cleaned = cleanJsonResponse(response);
        Map<String, Object> result = objectMapper.readValue(cleaned, new TypeReference<>() {});

        if (result.containsKey("error")) {
            throw new IllegalArgumentException((String) result.get("error"));
        }

        // 验证组件类型存在
        String type = (String) result.get("type");
        boolean validType = components.stream().anyMatch(c -> c.getComponentType().equals(type));
        if (!validType) {
            throw new IllegalArgumentException("无效的组件类型: " + type);
        }

        // 确保有唯一ID
        result.putIfAbsent("id", UUID.randomUUID().toString().substring(0, 8));

        return result;
    }

    /**
     * 解析样式更新响应
     */
    private Map<String, Object> parseStyleUpdateResponse(String response) throws JsonProcessingException {
        String cleaned = cleanJsonResponse(response);
        return objectMapper.readValue(cleaned, new TypeReference<>() {});
    }

    /**
     * 解析数据绑定响应
     */
    private Map<String, Object> parseDataBindResponse(String response) throws JsonProcessingException {
        String cleaned = cleanJsonResponse(response);
        return objectMapper.readValue(cleaned, new TypeReference<>() {});
    }

    /**
     * 清理JSON响应中的markdown标记
     */
    private String cleanJsonResponse(String response) {
        return response
                .replaceAll("```json\\s*", "")
                .replaceAll("```\\s*", "")
                .trim();
    }

    /**
     * 构建默认页面配置
     */
    private Map<String, Object> buildDefaultPageConfig(List<LowcodeComponentDefinition> components) {
        Map<String, Object> config = new HashMap<>();
        config.put("layout", Map.of("type", "grid", "columns", 12, "gap", 16));

        List<Map<String, Object>> defaultComponents = new ArrayList<>();
        int y = 0;

        // 添加一些默认组件
        for (LowcodeComponentDefinition comp : components) {
            if ("display".equals(comp.getCategory()) && defaultComponents.size() < 4) {
                Map<String, Object> compConfig = new HashMap<>();
                compConfig.put("id", UUID.randomUUID().toString().substring(0, 8));
                compConfig.put("type", comp.getComponentType());
                compConfig.put("name", comp.getName());
                compConfig.put("position", Map.of("x", 0, "y", y, "w", 6, "h", 2));
                compConfig.put("props", new HashMap<>());
                defaultComponents.add(compConfig);
                y += 2;
            }
        }

        config.put("components", defaultComponents);
        return config;
    }

    /**
     * 保存页面配置
     */
    private LowcodePageConfig savePageConfig(String factoryId, String pageId, String pageType,
                                              String pageName, Map<String, Object> config,
                                              String aiPrompt, Long userId) {
        // 检查是否已存在
        Optional<LowcodePageConfig> existing = pageConfigRepository.findByFactoryIdAndPageId(factoryId, pageId);

        LowcodePageConfig pageConfig;
        if (existing.isPresent()) {
            pageConfig = existing.get();
            pageConfig.setVersion(pageConfig.getVersion() + 1);
        } else {
            pageConfig = LowcodePageConfig.builder()
                    .pageId(pageId)
                    .factoryId(factoryId)
                    .pageType(pageType)
                    .pageName(pageName)
                    .status(0) // 草稿状态
                    .version(1)
                    .createdBy(userId)
                    .build();
        }

        pageConfig.setLayoutConfig(toJson(config));
        pageConfig.setAiGenerated(1);
        pageConfig.setAiPrompt(aiPrompt);

        return pageConfigRepository.save(pageConfig);
    }

    /**
     * 解析布局配置JSON
     */
    private Map<String, Object> parseLayoutConfig(String json) {
        if (json == null || json.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            log.warn("解析布局配置失败: {}", e.getMessage());
            return new HashMap<>();
        }
    }

    /**
     * 解析主题配置JSON
     */
    private Map<String, Object> parseThemeConfig(String json) {
        if (json == null || json.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            log.warn("解析主题配置失败: {}", e.getMessage());
            return new HashMap<>();
        }
    }

    /**
     * 解析数据绑定配置JSON
     */
    private Map<String, Object> parseDataBindings(String json) {
        if (json == null || json.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            log.warn("解析数据绑定配置失败: {}", e.getMessage());
            return new HashMap<>();
        }
    }

    /**
     * 添加组件到布局
     */
    private void addComponentToLayout(Map<String, Object> layoutConfig, Map<String, Object> component) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> components = (List<Map<String, Object>>) layoutConfig.get("components");
        if (components == null) {
            components = new ArrayList<>();
            layoutConfig.put("components", components);
        }

        // 自动计算位置（添加到末尾）
        if (!component.containsKey("position")) {
            int maxY = components.stream()
                    .map(c -> {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> pos = (Map<String, Object>) c.get("position");
                        if (pos != null) {
                            Object y = pos.get("y");
                            Object h = pos.get("h");
                            int yVal = y instanceof Integer ? (Integer) y : 0;
                            int hVal = h instanceof Integer ? (Integer) h : 2;
                            return yVal + hVal;
                        }
                        return 0;
                    })
                    .max(Integer::compareTo)
                    .orElse(0);
            component.put("position", Map.of("x", 0, "y", maxY, "w", 6, "h", 2));
        }

        components.add(component);
    }

    /**
     * 合并数据绑定配置
     */
    private void mergeDataBindings(Map<String, Object> existing, Map<String, Object> newBindings) {
        String componentId = (String) newBindings.get("componentId");
        if (componentId != null) {
            @SuppressWarnings("unchecked")
            Map<String, Object> bindings = (Map<String, Object>) existing.computeIfAbsent("bindings", k -> new HashMap<>());
            bindings.put(componentId, newBindings);
        }
        // 移除summary字段（只是描述信息）
        newBindings.remove("summary");
    }

    /**
     * 计算组件数量
     */
    private int countComponents(Map<String, Object> config) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> components = (List<Map<String, Object>>) config.get("components");
        return components != null ? components.size() : 0;
    }

    /**
     * 转换为JSON字符串
     */
    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.error("JSON序列化失败: {}", e.getMessage());
            return "{}";
        }
    }

    /**
     * 从context中提取字符串值
     */
    private String extractString(Map<String, Object> context, String key, String defaultValue) {
        if (context == null || !context.containsKey(key)) {
            return defaultValue;
        }
        Object value = context.get(key);
        return value != null ? value.toString() : defaultValue;
    }

    /**
     * 构建失败响应
     */
    private IntentExecuteResponse buildFailedResponse(String intentCode, AIIntentConfig intentConfig, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig != null ? intentConfig.getIntentName() : null)
                .intentCategory("PAGE_DESIGN")
                .status("FAILED")
                .message(message)
                .executedAt(LocalDateTime.now())
                .build();
    }

    @Override
    public boolean supportsSemanticsMode() {
        return true;
    }
}
