package com.cretas.aims.service.decoration.impl;

import com.cretas.aims.dto.decoration.*;
import com.cretas.aims.entity.decoration.FactoryHomeLayout;
import com.cretas.aims.repository.FactoryHomeLayoutRepository;
import com.cretas.aims.service.decoration.DecorationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 装饰服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DecorationServiceImpl implements DecorationService {

    private final FactoryHomeLayoutRepository layoutRepository;
    private final ObjectMapper objectMapper;

    /**
     * 默认模块配置
     */
    private static final List<HomeLayoutDTO.ModuleConfig> DEFAULT_MODULES = Arrays.asList(
            HomeLayoutDTO.ModuleConfig.builder()
                    .id("today_stats")
                    .type("stats")
                    .title("今日统计")
                    .icon("chart-bar")
                    .visible(true)
                    .order(1)
                    .colSpan(2)
                    .rowSpan(1)
                    .build(),
            HomeLayoutDTO.ModuleConfig.builder()
                    .id("quick_actions")
                    .type("actions")
                    .title("快捷操作")
                    .icon("lightning-bolt")
                    .visible(true)
                    .order(2)
                    .colSpan(1)
                    .rowSpan(1)
                    .build(),
            HomeLayoutDTO.ModuleConfig.builder()
                    .id("recent_orders")
                    .type("list")
                    .title("最近订单")
                    .icon("clipboard-list")
                    .visible(true)
                    .order(3)
                    .colSpan(1)
                    .rowSpan(1)
                    .build(),
            HomeLayoutDTO.ModuleConfig.builder()
                    .id("production_progress")
                    .type("progress")
                    .title("生产进度")
                    .icon("trending-up")
                    .visible(true)
                    .order(4)
                    .colSpan(2)
                    .rowSpan(1)
                    .build(),
            HomeLayoutDTO.ModuleConfig.builder()
                    .id("inventory_alerts")
                    .type("alerts")
                    .title("库存预警")
                    .icon("exclamation-circle")
                    .visible(true)
                    .order(5)
                    .colSpan(1)
                    .rowSpan(1)
                    .build(),
            HomeLayoutDTO.ModuleConfig.builder()
                    .id("quality_overview")
                    .type("stats")
                    .title("质量概览")
                    .icon("shield-check")
                    .visible(true)
                    .order(6)
                    .colSpan(1)
                    .rowSpan(1)
                    .build()
    );

    /**
     * 默认主题配置
     */
    private static final HomeLayoutDTO.ThemeConfig DEFAULT_THEME = HomeLayoutDTO.ThemeConfig.builder()
            .primaryColor("#1890ff")
            .backgroundColor("#f5f5f5")
            .cardRadius(8)
            .cardGap(12)
            .fontScale(1.0)
            .compactMode(false)
            .build();

    @Override
    public HomeLayoutDTO getHomeLayout(String factoryId) {
        log.debug("获取工厂首页布局: factoryId={}", factoryId);

        Optional<FactoryHomeLayout> layoutOpt = layoutRepository.findPublishedByFactoryId(factoryId);

        if (layoutOpt.isEmpty()) {
            // 返回默认布局
            return createDefaultLayout(factoryId);
        }

        return convertToDTO(layoutOpt.get());
    }

    @Override
    @Transactional
    public HomeLayoutDTO saveDraft(String factoryId, HomeLayoutDTO.SaveRequest request) {
        log.info("保存布局草稿: factoryId={}", factoryId);

        FactoryHomeLayout layout = layoutRepository.findByFactoryId(factoryId)
                .orElse(createNewLayout(factoryId));

        // 更新配置
        updateLayoutFromRequest(layout, request);
        layout.setStatus(0); // 草稿状态

        FactoryHomeLayout saved = layoutRepository.save(layout);
        log.info("布局草稿已保存: id={}", saved.getId());

        return convertToDTO(saved);
    }

    @Override
    @Transactional
    public HomeLayoutDTO publishLayout(String factoryId) {
        log.info("发布布局配置: factoryId={}", factoryId);

        FactoryHomeLayout layout = layoutRepository.findByFactoryId(factoryId)
                .orElseThrow(() -> new IllegalArgumentException("布局配置不存在，请先保存草稿"));

        layout.setStatus(1); // 发布状态
        layout.setVersion(layout.getVersion() + 1);

        FactoryHomeLayout saved = layoutRepository.save(layout);
        log.info("布局已发布: id={}, version={}", saved.getId(), saved.getVersion());

        return convertToDTO(saved);
    }

    @Override
    @Transactional
    public AILayoutResponse generateLayoutWithAI(String factoryId, AILayoutRequest request) {
        log.info("AI生成布局: factoryId={}, prompt={}", factoryId, request.getPrompt());

        long startTime = System.currentTimeMillis();

        // 基于用户输入生成布局配置
        List<HomeLayoutDTO.ModuleConfig> generatedModules = generateModulesFromRequest(request);
        HomeLayoutDTO.ThemeConfig generatedTheme = generateThemeFromRequest(request);

        // 创建布局DTO
        HomeLayoutDTO layout = HomeLayoutDTO.builder()
                .factoryId(factoryId)
                .modules(generatedModules)
                .theme(generatedTheme)
                .gridColumns(request.getGridColumns() != null ? request.getGridColumns() : 2)
                .status(0)
                .version(1)
                .aiGenerated(1)
                .aiPrompt(request.getPrompt())
                .timeBasedEnabled(Boolean.TRUE.equals(request.getTimeBasedEnabled()) ? 1 : 0)
                .build();

        // 保存到数据库
        FactoryHomeLayout entity = layoutRepository.findByFactoryId(factoryId)
                .orElse(createNewLayout(factoryId));

        entity.setModulesConfig(serializeModules(generatedModules));
        entity.setThemeConfig(serializeTheme(generatedTheme));
        entity.setGridColumns(layout.getGridColumns());
        entity.setAiGenerated(1);
        entity.setAiPrompt(request.getPrompt());
        entity.setTimeBasedEnabled(layout.getTimeBasedEnabled());
        entity.setStatus(0);

        layoutRepository.save(entity);

        long generationTime = System.currentTimeMillis() - startTime;

        // 生成建议
        List<AILayoutResponse.DesignSuggestion> suggestions = generateDesignSuggestions(request);

        return AILayoutResponse.builder()
                .layout(layout)
                .explanation("根据您的描述，我们为您生成了一个优化的首页布局。")
                .generationTimeMs(generationTime)
                .modelUsed("rule-based")
                .suggestions(suggestions)
                .build();
    }

    @Override
    public LayoutSuggestionDTO getSuggestions(String factoryId) {
        log.debug("获取布局建议: factoryId={}", factoryId);

        // 获取使用统计
        String usageStatsJson = layoutRepository.findUsageStatsByFactoryId(factoryId);
        Map<String, Integer> moduleClicks = parseUsageStats(usageStatsJson);

        // 生成建议
        List<LayoutSuggestionDTO.Suggestion> suggestions = new ArrayList<>();
        List<LayoutSuggestionDTO.ModuleUsage> mostUsed = new ArrayList<>();
        List<LayoutSuggestionDTO.ModuleUsage> leastUsed = new ArrayList<>();

        if (!moduleClicks.isEmpty()) {
            // 按点击次数排序
            List<Map.Entry<String, Integer>> sortedClicks = new ArrayList<>(moduleClicks.entrySet());
            sortedClicks.sort((a, b) -> b.getValue().compareTo(a.getValue()));

            int totalClicks = moduleClicks.values().stream().mapToInt(Integer::intValue).sum();

            // 最常用模块
            for (int i = 0; i < Math.min(3, sortedClicks.size()); i++) {
                Map.Entry<String, Integer> entry = sortedClicks.get(i);
                mostUsed.add(LayoutSuggestionDTO.ModuleUsage.builder()
                        .moduleId(entry.getKey())
                        .moduleName(getModuleName(entry.getKey()))
                        .clickCount(entry.getValue())
                        .usagePercentage(totalClicks > 0 ? (double) entry.getValue() / totalClicks : 0)
                        .build());
            }

            // 最少使用模块
            for (int i = sortedClicks.size() - 1; i >= Math.max(0, sortedClicks.size() - 3); i--) {
                Map.Entry<String, Integer> entry = sortedClicks.get(i);
                leastUsed.add(LayoutSuggestionDTO.ModuleUsage.builder()
                        .moduleId(entry.getKey())
                        .moduleName(getModuleName(entry.getKey()))
                        .clickCount(entry.getValue())
                        .usagePercentage(totalClicks > 0 ? (double) entry.getValue() / totalClicks : 0)
                        .build());

                // 为使用较少的模块生成建议
                if (entry.getValue() < 5) {
                    suggestions.add(LayoutSuggestionDTO.Suggestion.builder()
                            .id(UUID.randomUUID().toString())
                            .type("visibility")
                            .title("考虑隐藏低使用率模块")
                            .description("\"" + getModuleName(entry.getKey()) + "\" 模块使用频率较低，可考虑隐藏以简化首页")
                            .confidence(0.7)
                            .targetModuleId(entry.getKey())
                            .action("hide")
                            .expectedBenefit("简化首页，提升加载速度")
                            .build());
                }
            }

            // 根据高使用率模块生成位置调整建议
            if (!mostUsed.isEmpty() && mostUsed.get(0).getClickCount() > 20) {
                suggestions.add(LayoutSuggestionDTO.Suggestion.builder()
                        .id(UUID.randomUUID().toString())
                        .type("module_reorder")
                        .title("调整高频模块位置")
                        .description("将 \"" + mostUsed.get(0).getModuleName() + "\" 移至首位可提高操作效率")
                        .confidence(0.85)
                        .targetModuleId(mostUsed.get(0).getModuleId())
                        .action("move_to_top")
                        .suggestedPosition(1)
                        .expectedBenefit("减少用户操作步骤")
                        .build());
            }
        }

        // 如果没有统计数据，提供默认建议
        if (suggestions.isEmpty()) {
            suggestions.add(LayoutSuggestionDTO.Suggestion.builder()
                    .id(UUID.randomUUID().toString())
                    .type("general")
                    .title("开始使用布局统计")
                    .description("继续使用系统，我们将根据您的使用习惯提供个性化布局建议")
                    .confidence(1.0)
                    .action("continue_usage")
                    .expectedBenefit("获得更准确的个性化建议")
                    .build());
        }

        return LayoutSuggestionDTO.builder()
                .suggestions(suggestions)
                .behaviorAnalysis(LayoutSuggestionDTO.BehaviorAnalysis.builder()
                        .mostUsedModules(mostUsed)
                        .leastUsedModules(leastUsed)
                        .peakUsageHours(Arrays.asList("09:00-11:00", "14:00-16:00"))
                        .analysisPeriodDays(7)
                        .build())
                .timestamp(System.currentTimeMillis())
                .build();
    }

    @Override
    @Transactional
    public void recordModuleClick(String factoryId, String moduleId) {
        log.debug("记录模块点击: factoryId={}, moduleId={}", factoryId, moduleId);

        FactoryHomeLayout layout = layoutRepository.findByFactoryId(factoryId).orElse(null);
        if (layout == null) {
            return;
        }

        // 解析并更新使用统计
        Map<String, Object> usageStats = parseUsageStatsMap(layout.getUsageStats());
        @SuppressWarnings("unchecked")
        Map<String, Integer> moduleClicks = (Map<String, Integer>) usageStats.computeIfAbsent("moduleClicks", k -> new HashMap<>());

        moduleClicks.put(moduleId, moduleClicks.getOrDefault(moduleId, 0) + 1);
        usageStats.put("lastUpdated", LocalDateTime.now().toString());

        try {
            layout.setUsageStats(objectMapper.writeValueAsString(usageStats));
            layoutRepository.save(layout);
        } catch (JsonProcessingException e) {
            log.error("序列化使用统计失败", e);
        }
    }

    @Override
    @Transactional
    public HomeLayoutDTO resetToDefault(String factoryId) {
        log.info("重置为默认布局: factoryId={}", factoryId);

        FactoryHomeLayout layout = layoutRepository.findByFactoryId(factoryId)
                .orElse(createNewLayout(factoryId));

        layout.setModulesConfig(serializeModules(DEFAULT_MODULES));
        layout.setThemeConfig(serializeTheme(DEFAULT_THEME));
        layout.setGridColumns(2);
        layout.setTimeBasedEnabled(0);
        layout.setAiGenerated(0);
        layout.setAiPrompt(null);
        layout.setStatus(1);
        layout.setVersion(layout.getVersion() + 1);

        FactoryHomeLayout saved = layoutRepository.save(layout);
        return convertToDTO(saved);
    }

    @Override
    public List<HomeLayoutDTO.ModuleConfig> getAvailableModules(String factoryId) {
        // 返回所有可用模块
        return new ArrayList<>(DEFAULT_MODULES);
    }

    // ==================== 私有辅助方法 ====================

    private HomeLayoutDTO createDefaultLayout(String factoryId) {
        return HomeLayoutDTO.builder()
                .factoryId(factoryId)
                .modules(new ArrayList<>(DEFAULT_MODULES))
                .theme(DEFAULT_THEME)
                .gridColumns(2)
                .status(1)
                .version(1)
                .aiGenerated(0)
                .timeBasedEnabled(0)
                .build();
    }

    private FactoryHomeLayout createNewLayout(String factoryId) {
        return FactoryHomeLayout.builder()
                .factoryId(factoryId)
                .modulesConfig(serializeModules(DEFAULT_MODULES))
                .themeConfig(serializeTheme(DEFAULT_THEME))
                .gridColumns(2)
                .status(0)
                .version(1)
                .aiGenerated(0)
                .timeBasedEnabled(0)
                .build();
    }

    private HomeLayoutDTO convertToDTO(FactoryHomeLayout entity) {
        return HomeLayoutDTO.builder()
                .id(entity.getId())
                .factoryId(entity.getFactoryId())
                .modules(parseModules(entity.getModulesConfig()))
                .theme(parseTheme(entity.getThemeConfig()))
                .gridColumns(entity.getGridColumns())
                .status(entity.getStatus())
                .version(entity.getVersion())
                .aiGenerated(entity.getAiGenerated())
                .aiPrompt(entity.getAiPrompt())
                .timeBasedEnabled(entity.getTimeBasedEnabled())
                .morningModules(parseModules(entity.getMorningLayout()))
                .afternoonModules(parseModules(entity.getAfternoonLayout()))
                .eveningModules(parseModules(entity.getEveningLayout()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private void updateLayoutFromRequest(FactoryHomeLayout layout, HomeLayoutDTO.SaveRequest request) {
        if (request.getModules() != null) {
            layout.setModulesConfig(serializeModules(request.getModules()));
        }
        if (request.getTheme() != null) {
            layout.setThemeConfig(serializeTheme(request.getTheme()));
        }
        if (request.getGridColumns() != null) {
            layout.setGridColumns(request.getGridColumns());
        }
        if (request.getTimeBasedEnabled() != null) {
            layout.setTimeBasedEnabled(request.getTimeBasedEnabled() ? 1 : 0);
        }
        if (request.getMorningModules() != null) {
            layout.setMorningLayout(serializeModules(request.getMorningModules()));
        }
        if (request.getAfternoonModules() != null) {
            layout.setAfternoonLayout(serializeModules(request.getAfternoonModules()));
        }
        if (request.getEveningModules() != null) {
            layout.setEveningLayout(serializeModules(request.getEveningModules()));
        }
    }

    private List<HomeLayoutDTO.ModuleConfig> parseModules(String json) {
        if (json == null || json.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            Map<String, Object> config = objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
            Object modulesObj = config.get("modules");
            if (modulesObj != null) {
                String modulesJson = objectMapper.writeValueAsString(modulesObj);
                return objectMapper.readValue(modulesJson, new TypeReference<List<HomeLayoutDTO.ModuleConfig>>() {});
            }
        } catch (JsonProcessingException e) {
            log.error("解析模块配置失败: {}", e.getMessage());
        }
        return new ArrayList<>();
    }

    private HomeLayoutDTO.ThemeConfig parseTheme(String json) {
        if (json == null || json.isEmpty()) {
            return DEFAULT_THEME;
        }
        try {
            return objectMapper.readValue(json, HomeLayoutDTO.ThemeConfig.class);
        } catch (JsonProcessingException e) {
            log.error("解析主题配置失败: {}", e.getMessage());
            return DEFAULT_THEME;
        }
    }

    private String serializeModules(List<HomeLayoutDTO.ModuleConfig> modules) {
        try {
            Map<String, Object> config = new HashMap<>();
            config.put("modules", modules);
            return objectMapper.writeValueAsString(config);
        } catch (JsonProcessingException e) {
            log.error("序列化模块配置失败", e);
            return "{}";
        }
    }

    private String serializeTheme(HomeLayoutDTO.ThemeConfig theme) {
        try {
            return objectMapper.writeValueAsString(theme);
        } catch (JsonProcessingException e) {
            log.error("序列化主题配置失败", e);
            return "{}";
        }
    }

    private Map<String, Integer> parseUsageStats(String json) {
        if (json == null || json.isEmpty()) {
            return new HashMap<>();
        }
        try {
            Map<String, Object> stats = objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
            Object clicksObj = stats.get("moduleClicks");
            if (clicksObj != null) {
                String clicksJson = objectMapper.writeValueAsString(clicksObj);
                return objectMapper.readValue(clicksJson, new TypeReference<Map<String, Integer>>() {});
            }
        } catch (JsonProcessingException e) {
            log.error("解析使用统计失败: {}", e.getMessage());
        }
        return new HashMap<>();
    }

    private Map<String, Object> parseUsageStatsMap(String json) {
        if (json == null || json.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            log.error("解析使用统计失败: {}", e.getMessage());
            return new HashMap<>();
        }
    }

    private String getModuleName(String moduleId) {
        Map<String, String> moduleNames = Map.of(
                "today_stats", "今日统计",
                "quick_actions", "快捷操作",
                "recent_orders", "最近订单",
                "production_progress", "生产进度",
                "inventory_alerts", "库存预警",
                "quality_overview", "质量概览"
        );
        return moduleNames.getOrDefault(moduleId, moduleId);
    }

    private List<HomeLayoutDTO.ModuleConfig> generateModulesFromRequest(AILayoutRequest request) {
        List<HomeLayoutDTO.ModuleConfig> modules = new ArrayList<>(DEFAULT_MODULES);

        // 根据用户偏好调整
        if (request.getPreferences() != null) {
            AILayoutRequest.Preferences prefs = request.getPreferences();

            // 优先级模块放在前面
            if (prefs.getPriorityModules() != null && !prefs.getPriorityModules().isEmpty()) {
                modules.sort((a, b) -> {
                    int aIndex = prefs.getPriorityModules().indexOf(a.getId());
                    int bIndex = prefs.getPriorityModules().indexOf(b.getId());
                    if (aIndex == -1) aIndex = Integer.MAX_VALUE;
                    if (bIndex == -1) bIndex = Integer.MAX_VALUE;
                    return Integer.compare(aIndex, bIndex);
                });
            }

            // 更新排序
            for (int i = 0; i < modules.size(); i++) {
                modules.get(i).setOrder(i + 1);
            }
        }

        // 处理包含/排除的模块
        if (request.getExcludedModules() != null) {
            modules.removeIf(m -> request.getExcludedModules().contains(m.getId()));
        }

        return modules;
    }

    private HomeLayoutDTO.ThemeConfig generateThemeFromRequest(AILayoutRequest request) {
        HomeLayoutDTO.ThemeConfig theme = HomeLayoutDTO.ThemeConfig.builder()
                .primaryColor("#1890ff")
                .backgroundColor("#f5f5f5")
                .cardRadius(8)
                .cardGap(12)
                .fontScale(1.0)
                .compactMode(false)
                .build();

        if (request.getPreferences() != null) {
            AILayoutRequest.Preferences prefs = request.getPreferences();
            if (Boolean.TRUE.equals(prefs.getCompactLayout())) {
                theme.setCompactMode(true);
                theme.setCardGap(8);
            }
            if ("dark".equals(prefs.getColorScheme())) {
                theme.setBackgroundColor("#1a1a1a");
                theme.setPrimaryColor("#177ddc");
            }
        }

        if ("modern".equals(request.getStyle())) {
            theme.setCardRadius(12);
        } else if ("classic".equals(request.getStyle())) {
            theme.setCardRadius(4);
        }

        return theme;
    }

    private List<AILayoutResponse.DesignSuggestion> generateDesignSuggestions(AILayoutRequest request) {
        List<AILayoutResponse.DesignSuggestion> suggestions = new ArrayList<>();

        suggestions.add(AILayoutResponse.DesignSuggestion.builder()
                .type("layout_tip")
                .title("布局建议")
                .description("当前布局已根据您的偏好进行优化，您可以随时手动调整模块位置")
                .confidence(0.9)
                .action("none")
                .build());

        if (request.getTimeBasedEnabled() != null && request.getTimeBasedEnabled()) {
            suggestions.add(AILayoutResponse.DesignSuggestion.builder()
                    .type("time_based")
                    .title("时段布局提示")
                    .description("您已启用时段布局，系统将在不同时段自动切换显示内容")
                    .confidence(0.95)
                    .action("configure_time_layouts")
                    .build());
        }

        return suggestions;
    }
}
