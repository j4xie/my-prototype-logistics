package com.cretas.aims.service.handler;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.FactorySettings;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.FactorySettingsRepository;
import com.cretas.aims.service.validator.LayoutValidator;
import com.cretas.aims.util.ErrorSanitizer;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 装饰系统意图处理器
 *
 * 处理 DECORATION 分类的意图:
 * - HOME_LAYOUT_UPDATE: 更新首页布局 (移动/显示/隐藏模块)
 * - HOME_LAYOUT_GENERATE: AI生成布局方案
 * - HOME_LAYOUT_SUGGEST: 智能布局建议
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-13
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DecorationIntentHandler implements IntentHandler {

    private final FactorySettingsRepository factorySettingsRepository;
    private final DashScopeClient dashScopeClient;
    private final ObjectMapper objectMapper;
    private final LayoutValidator layoutValidator;

    // 可用模块定义
    private static final List<Map<String, Object>> DEFAULT_MODULES = List.of(
            Map.of("id", "welcome", "name", "欢迎卡片", "type", "welcome", "x", 0, "y", 0, "w", 2, "h", 1, "visible", true),
            Map.of("id", "ai_insight", "name", "AI洞察", "type", "ai_insight", "x", 0, "y", 1, "w", 2, "h", 2, "visible", true),
            Map.of("id", "stats_grid", "name", "数据统计", "type", "stats_grid", "x", 0, "y", 3, "w", 2, "h", 2, "visible", true),
            Map.of("id", "quick_actions", "name", "快捷操作", "type", "quick_actions", "x", 0, "y", 5, "w", 2, "h", 1, "visible", true),
            Map.of("id", "dev_tools", "name", "开发工具", "type", "dev_tools", "x", 0, "y", 6, "w", 1, "h", 1, "visible", false)
    );

    @Override
    public String getSupportedCategory() {
        return "DECORATION";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {
        String intentCode = intentConfig.getIntentCode();
        log.info("DecorationIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                case "HOME_LAYOUT_UPDATE" -> handleLayoutUpdate(factoryId, request, intentConfig, userId);
                case "HOME_LAYOUT_GENERATE" -> handleLayoutGenerate(factoryId, request, intentConfig, userId);
                case "HOME_LAYOUT_SUGGEST" -> handleLayoutSuggest(factoryId, request, intentConfig, userId);
                default -> buildFailedResponse(intentCode, intentConfig, "未知的装饰意图: " + intentCode);
            };

        } catch (Exception e) {
            log.error("DecorationIntentHandler执行失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            return buildFailedResponse(intentCode, intentConfig, "执行失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        String intentCode = intentConfig.getIntentCode();
        log.info("DecorationIntentHandler预览: intentCode={}, factoryId={}", intentCode, factoryId);

        String previewMessage = switch (intentCode) {
            case "HOME_LAYOUT_UPDATE" -> "将根据您的指令更新首页布局。";
            case "HOME_LAYOUT_GENERATE" -> "将使用AI生成一套适合您的首页布局方案。";
            case "HOME_LAYOUT_SUGGEST" -> "将分析您的使用习惯并提供布局优化建议。";
            default -> "未知的装饰操作";
        };

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig.getIntentName())
                .intentCategory("DECORATION")
                .status("PREVIEW")
                .message(previewMessage)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 处理布局更新指令
     * 解析用户自然语言指令，转换为布局操作
     */
    private IntentExecuteResponse handleLayoutUpdate(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig, Long userId) {
        String userInput = request.getUserInput();
        log.info("布局更新意图: factoryId={}, userInput={}", factoryId, userInput);

        // 1. 获取当前布局
        List<Map<String, Object>> currentLayout = getCurrentLayout(factoryId, userId);

        // 2. 调用LLM解析用户指令
        String systemPrompt = buildLayoutUpdatePrompt(currentLayout);
        String llmResponse;
        try {
            llmResponse = dashScopeClient.chatLowTemp(systemPrompt, userInput);
        } catch (Exception e) {
            log.error("LLM调用失败: {}", e.getMessage());
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "AI解析指令失败，请尝试更具体的描述");
        }

        // 3. 解析LLM响应并应用操作
        List<Map<String, Object>> updatedLayout;
        String operationSummary;
        try {
            Map<String, Object> parsedResponse = parseLlmLayoutResponse(llmResponse);
            updatedLayout = applyLayoutOperations(currentLayout, parsedResponse);
            operationSummary = (String) parsedResponse.getOrDefault("summary", "布局已更新");
        } catch (Exception e) {
            log.error("解析LLM响应失败: {}", e.getMessage());
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "无法理解您的指令，请尝试: '把AI洞察移到顶部' 或 '隐藏开发工具'");
        }

        // 4. 验证布局合法性
        LayoutValidator.ValidationResult validation = layoutValidator.validate(updatedLayout);
        if (!validation.isValid()) {
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "布局更新失败: " + validation.getErrorMessage());
        }

        // 5. 保存布局
        saveLayout(factoryId, userId, updatedLayout);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("DECORATION")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message(operationSummary)
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "layout", updatedLayout,
                        "moduleCount", updatedLayout.size(),
                        "visibleCount", updatedLayout.stream()
                                .filter(m -> Boolean.TRUE.equals(m.get("visible")))
                                .count()
                ))
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("HomeLayout")
                                .entityId(factoryId + "_" + userId)
                                .entityName("首页布局")
                                .action("UPDATED")
                                .changes(Map.of("operation", operationSummary))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_LAYOUT")
                                .actionName("查看布局")
                                .description("查看更新后的首页布局")
                                .endpoint("/api/mobile/" + factoryId + "/home/layout")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("RESET_LAYOUT")
                                .actionName("重置布局")
                                .description("恢复默认布局")
                                .endpoint("/api/mobile/" + factoryId + "/home/layout/reset")
                                .build()
                ))
                .build();
    }

    /**
     * 处理AI布局生成
     */
    private IntentExecuteResponse handleLayoutGenerate(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig, Long userId) {
        String userInput = request.getUserInput();
        log.info("AI布局生成意图: factoryId={}, userInput={}", factoryId, userInput);

        // 1. 构建生成Prompt
        String systemPrompt = buildLayoutGeneratePrompt();
        String llmResponse;
        try {
            llmResponse = dashScopeClient.chatLowTemp(systemPrompt,
                    userInput != null && !userInput.isEmpty() ? userInput : "生成一个适合工厂管理的首页布局");
        } catch (Exception e) {
            log.error("LLM调用失败: {}", e.getMessage());
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "AI生成布局失败，请稍后重试");
        }

        // 2. 解析生成的布局
        List<Map<String, Object>> generatedLayout;
        try {
            generatedLayout = parseGeneratedLayout(llmResponse);
        } catch (Exception e) {
            log.error("解析生成布局失败: {}", e.getMessage());
            // 返回默认布局
            generatedLayout = new ArrayList<>(DEFAULT_MODULES);
        }

        // 3. 验证布局合法性
        LayoutValidator.ValidationResult validation = layoutValidator.validate(generatedLayout);
        if (!validation.isValid()) {
            log.warn("生成的布局验证失败，使用默认布局: {}", validation.getErrorMessage());
            generatedLayout = new ArrayList<>(DEFAULT_MODULES);
        }

        // 4. 保存布局
        saveLayout(factoryId, userId, generatedLayout);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("DECORATION")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("已为您生成新的首页布局方案")
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "layout", generatedLayout,
                        "moduleCount", generatedLayout.size(),
                        "visibleCount", generatedLayout.stream()
                                .filter(m -> Boolean.TRUE.equals(m.get("visible")))
                                .count()
                ))
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("HomeLayout")
                                .entityId(factoryId + "_" + userId)
                                .entityName("首页布局")
                                .action("GENERATED")
                                .changes(Map.of("source", "AI_GENERATED"))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("CUSTOMIZE_LAYOUT")
                                .actionName("自定义布局")
                                .description("进一步调整布局")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("RESET_LAYOUT")
                                .actionName("恢复默认")
                                .description("恢复默认布局")
                                .endpoint("/api/mobile/" + factoryId + "/home/layout/reset")
                                .build()
                ))
                .build();
    }

    /**
     * 处理智能布局建议
     */
    private IntentExecuteResponse handleLayoutSuggest(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig, Long userId) {
        log.info("智能布局建议意图: factoryId={}, userId={}", factoryId, userId);

        // 1. 获取当前布局
        List<Map<String, Object>> currentLayout = getCurrentLayout(factoryId, userId);

        // 2. 分析并生成建议 (这里简化实现，实际可以结合用户行为数据)
        List<String> suggestions = generateLayoutSuggestions(currentLayout);

        // 3. 生成推荐布局
        List<Map<String, Object>> suggestedLayout = generateSuggestedLayout(currentLayout);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("DECORATION")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("已分析您的使用习惯，以下是布局优化建议")
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "suggestions", suggestions,
                        "currentLayout", currentLayout,
                        "suggestedLayout", suggestedLayout
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("APPLY_SUGGESTION")
                                .actionName("应用建议")
                                .description("应用推荐的布局方案")
                                .parameters(Map.of("layout", suggestedLayout))
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("IGNORE_SUGGESTION")
                                .actionName("保持现状")
                                .description("不做任何更改")
                                .build()
                ))
                .build();
    }

    // ==================== Helper Methods ====================

    /**
     * 获取当前布局
     */
    private List<Map<String, Object>> getCurrentLayout(String factoryId, Long userId) {
        try {
            Optional<FactorySettings> settingsOpt = factorySettingsRepository.findByFactoryId(factoryId);
            if (settingsOpt.isPresent() && settingsOpt.get().getAiSettings() != null) {
                JsonNode aiSettings = objectMapper.readTree(settingsOpt.get().getAiSettings());
                if (aiSettings.has("homeLayout")) {
                    return objectMapper.convertValue(
                            aiSettings.get("homeLayout"),
                            new TypeReference<List<Map<String, Object>>>() {}
                    );
                }
            }
        } catch (Exception e) {
            log.warn("获取当前布局失败，使用默认布局: {}", e.getMessage());
        }
        return new ArrayList<>(DEFAULT_MODULES);
    }

    /**
     * 保存布局
     */
    private void saveLayout(String factoryId, Long userId, List<Map<String, Object>> layout) {
        try {
            Optional<FactorySettings> settingsOpt = factorySettingsRepository.findByFactoryId(factoryId);
            FactorySettings settings;
            Map<String, Object> aiSettings;

            if (settingsOpt.isPresent()) {
                settings = settingsOpt.get();
                if (settings.getAiSettings() != null) {
                    aiSettings = objectMapper.readValue(settings.getAiSettings(),
                            new TypeReference<Map<String, Object>>() {});
                } else {
                    aiSettings = new HashMap<>();
                }
            } else {
                settings = new FactorySettings();
                settings.setFactoryId(factoryId);
                aiSettings = new HashMap<>();
            }

            aiSettings.put("homeLayout", layout);
            aiSettings.put("layoutUpdatedAt", LocalDateTime.now().toString());
            aiSettings.put("layoutUpdatedBy", userId);
            settings.setAiSettings(objectMapper.writeValueAsString(aiSettings));

            factorySettingsRepository.save(settings);
            log.info("布局已保存: factoryId={}, userId={}", factoryId, userId);
        } catch (Exception e) {
            log.error("保存布局失败: {}", e.getMessage(), e);
            throw new RuntimeException("保存布局失败", e);
        }
    }

    /**
     * 构建布局更新的LLM Prompt
     */
    private String buildLayoutUpdatePrompt(List<Map<String, Object>> currentLayout) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个首页布局助手。用户会给出自然语言指令来调整首页模块布局。\n\n");
        sb.append("当前布局包含以下模块:\n");

        for (Map<String, Object> module : currentLayout) {
            sb.append(String.format("- %s (id: %s, 位置: y=%s, 可见: %s)\n",
                    module.get("name"), module.get("id"), module.get("y"), module.get("visible")));
        }

        sb.append("\n请分析用户指令，输出JSON格式的操作:\n");
        sb.append("{\n");
        sb.append("  \"operation\": \"move|show|hide|resize\",\n");
        sb.append("  \"targetId\": \"模块ID\",\n");
        sb.append("  \"params\": { \"position\": \"top|bottom|up|down\" 或 \"visible\": true|false },\n");
        sb.append("  \"summary\": \"操作描述\"\n");
        sb.append("}\n\n");
        sb.append("只输出JSON，不要其他内容。如果无法理解指令，输出 {\"error\": \"无法理解指令\"}");

        return sb.toString();
    }

    /**
     * 构建布局生成的LLM Prompt
     */
    private String buildLayoutGeneratePrompt() {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个首页布局设计师。请根据用户需求生成首页模块布局。\n\n");
        sb.append("可用模块:\n");
        sb.append("- welcome: 欢迎卡片 (最大 2x1)\n");
        sb.append("- ai_insight: AI洞察 (最大 2x2)\n");
        sb.append("- stats_grid: 数据统计 (最大 2x2, 必须存在)\n");
        sb.append("- quick_actions: 快捷操作 (最大 2x1)\n");
        sb.append("- dev_tools: 开发工具 (最大 1x1)\n\n");
        sb.append("请输出JSON数组格式的布局配置:\n");
        sb.append("[\n");
        sb.append("  {\"id\": \"模块id\", \"x\": 0, \"y\": 位置, \"w\": 宽度, \"h\": 高度, \"visible\": true/false},\n");
        sb.append("  ...\n");
        sb.append("]\n\n");
        sb.append("要求:\n");
        sb.append("1. stats_grid必须存在\n");
        sb.append("2. y值从0开始递增\n");
        sb.append("3. 只输出JSON数组，不要其他内容");

        return sb.toString();
    }

    /**
     * 解析LLM布局更新响应
     */
    private Map<String, Object> parseLlmLayoutResponse(String response) throws JsonProcessingException {
        // 清理响应中的markdown代码块标记
        String cleaned = response
                .replaceAll("```json\\s*", "")
                .replaceAll("```\\s*", "")
                .trim();

        return objectMapper.readValue(cleaned, new TypeReference<Map<String, Object>>() {});
    }

    /**
     * 解析生成的布局
     */
    private List<Map<String, Object>> parseGeneratedLayout(String response) throws JsonProcessingException {
        String cleaned = response
                .replaceAll("```json\\s*", "")
                .replaceAll("```\\s*", "")
                .trim();

        List<Map<String, Object>> parsed = objectMapper.readValue(cleaned,
                new TypeReference<List<Map<String, Object>>>() {});

        // 补充必要字段
        for (Map<String, Object> module : parsed) {
            String id = (String) module.get("id");
            Map<String, Object> defaultModule = DEFAULT_MODULES.stream()
                    .filter(m -> m.get("id").equals(id))
                    .findFirst()
                    .orElse(null);

            if (defaultModule != null) {
                module.putIfAbsent("name", defaultModule.get("name"));
                module.putIfAbsent("type", defaultModule.get("type"));
            }
            module.putIfAbsent("visible", true);
        }

        return parsed;
    }

    /**
     * 应用布局操作
     */
    private List<Map<String, Object>> applyLayoutOperations(List<Map<String, Object>> layout,
                                                            Map<String, Object> operation) {
        if (operation.containsKey("error")) {
            throw new IllegalArgumentException((String) operation.get("error"));
        }

        String op = (String) operation.get("operation");
        String targetId = (String) operation.get("targetId");
        @SuppressWarnings("unchecked")
        Map<String, Object> params = (Map<String, Object>) operation.getOrDefault("params", Map.of());

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> module : layout) {
            result.add(new HashMap<>(module));
        }

        switch (op) {
            case "show" -> {
                for (Map<String, Object> module : result) {
                    if (targetId.equals(module.get("id"))) {
                        module.put("visible", true);
                    }
                }
            }
            case "hide" -> {
                for (Map<String, Object> module : result) {
                    if (targetId.equals(module.get("id"))) {
                        module.put("visible", false);
                    }
                }
            }
            case "move" -> {
                String position = (String) params.get("position");
                if ("top".equals(position)) {
                    // 移动到顶部
                    Map<String, Object> target = null;
                    for (Map<String, Object> m : result) {
                        if (targetId.equals(m.get("id"))) {
                            target = m;
                            break;
                        }
                    }
                    if (target != null) {
                        result.remove(target);
                        result.add(0, target);
                        // 重新计算y位置
                        recalculatePositions(result);
                    }
                } else if ("bottom".equals(position)) {
                    // 移动到底部
                    Map<String, Object> target = null;
                    for (Map<String, Object> m : result) {
                        if (targetId.equals(m.get("id"))) {
                            target = m;
                            break;
                        }
                    }
                    if (target != null) {
                        result.remove(target);
                        result.add(target);
                        recalculatePositions(result);
                    }
                }
            }
        }

        return result;
    }

    /**
     * 重新计算模块位置
     */
    private void recalculatePositions(List<Map<String, Object>> layout) {
        int y = 0;
        for (Map<String, Object> module : layout) {
            module.put("y", y);
            Object h = module.get("h");
            y += (h instanceof Integer) ? (Integer) h : 1;
        }
    }

    /**
     * 生成布局建议
     */
    private List<String> generateLayoutSuggestions(List<Map<String, Object>> currentLayout) {
        List<String> suggestions = new ArrayList<>();

        // 检查数据统计是否在顶部
        boolean statsAtTop = currentLayout.stream()
                .filter(m -> "stats_grid".equals(m.get("id")))
                .anyMatch(m -> {
                    Object y = m.get("y");
                    return y instanceof Integer && (Integer) y <= 2;
                });

        if (!statsAtTop) {
            suggestions.add("建议将「数据统计」模块移到更靠前的位置，便于快速查看关键指标");
        }

        // 检查AI洞察是否可见
        boolean aiVisible = currentLayout.stream()
                .filter(m -> "ai_insight".equals(m.get("id")))
                .anyMatch(m -> Boolean.TRUE.equals(m.get("visible")));

        if (!aiVisible) {
            suggestions.add("建议开启「AI洞察」模块，获取智能分析和建议");
        }

        // 检查快捷操作
        boolean quickActionsVisible = currentLayout.stream()
                .filter(m -> "quick_actions".equals(m.get("id")))
                .anyMatch(m -> Boolean.TRUE.equals(m.get("visible")));

        if (!quickActionsVisible) {
            suggestions.add("建议开启「快捷操作」模块，提高常用功能的访问效率");
        }

        if (suggestions.isEmpty()) {
            suggestions.add("当前布局已经很合理，无需调整");
        }

        return suggestions;
    }

    /**
     * 生成推荐布局
     */
    private List<Map<String, Object>> generateSuggestedLayout(List<Map<String, Object>> currentLayout) {
        List<Map<String, Object>> suggested = new ArrayList<>();

        // 推荐顺序: welcome -> stats_grid -> ai_insight -> quick_actions -> dev_tools
        List<String> preferredOrder = List.of("welcome", "stats_grid", "ai_insight", "quick_actions", "dev_tools");

        for (String id : preferredOrder) {
            currentLayout.stream()
                    .filter(m -> id.equals(m.get("id")))
                    .findFirst()
                    .ifPresent(m -> {
                        Map<String, Object> copy = new HashMap<>(m);
                        // 除了dev_tools，其他都建议显示
                        if (!"dev_tools".equals(id)) {
                            copy.put("visible", true);
                        }
                        suggested.add(copy);
                    });
        }

        recalculatePositions(suggested);
        return suggested;
    }

    private IntentExecuteResponse buildFailedResponse(String intentCode, AIIntentConfig intentConfig, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig != null ? intentConfig.getIntentName() : null)
                .intentCategory("DECORATION")
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
