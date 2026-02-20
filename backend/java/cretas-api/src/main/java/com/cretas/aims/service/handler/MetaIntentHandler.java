package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import com.cretas.aims.util.ErrorSanitizer;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 元意图处理器 - AI 自我扩展能力
 *
 * 处理 META 分类的意图:
 * - INTENT_CREATE: 创建新的 AI 意图配置
 * - INTENT_UPDATE: 更新现有意图配置（如添加关键词）
 * - INTENT_ANALYZE: 分析意图使用情况
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MetaIntentHandler implements IntentHandler {

    private final AIIntentConfigRepository intentConfigRepository;
    private final ObjectMapper objectMapper;

    @Override
    public String getSupportedCategory() {
        return "META";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("MetaIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                case "INTENT_CREATE" -> handleCreateIntent(factoryId, request, intentConfig, userId, userRole);
                case "INTENT_UPDATE" -> handleUpdateIntent(factoryId, request, intentConfig, userId, userRole);
                case "INTENT_ANALYZE" -> handleAnalyzeIntent(factoryId, request, intentConfig);
                default -> buildFailedResponse(intentCode, intentConfig, "未知的元意图: " + intentCode);
            };

        } catch (Exception e) {
            log.error("MetaIntentHandler执行失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            return buildFailedResponse(intentCode, intentConfig, "执行失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * 处理创建意图
     * 根据用户描述生成新的意图配置
     *
     * 平台管理员(super_admin/platform_admin)可以选择创建:
     * - 平台级意图 (scope: "PLATFORM"): factoryId = null, 所有工厂可见
     * - 工厂级意图 (scope: "FACTORY"): factoryId = 指定工厂
     * 普通工厂用户只能创建工厂级意图
     */
    private IntentExecuteResponse handleCreateIntent(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig, Long userId, String userRole) {
        String userInput = request.getUserInput();
        log.info("创建意图: factoryId={}, userRole={}, userInput={}", factoryId, userRole, userInput);

        // 判断是否为平台管理员
        boolean isPlatformAdmin = "super_admin".equals(userRole) || "platform_admin".equals(userRole);

        // 从 context 获取意图配置参数
        if (request.getContext() == null || request.getContext().isEmpty()) {
            String scopeHint = isPlatformAdmin ?
                    "- scope: 意图范围（PLATFORM=平台级共享/FACTORY=工厂级）[可选，默认FACTORY]\n" +
                    "- targetFactoryId: 目标工厂ID（仅scope=FACTORY时有效）[可选，默认当前工厂]\n" : "";
            return buildNeedMoreInfoResponse(intentConfig,
                    "创建新意图需要提供以下信息：\n" +
                    "- intentCode: 意图代码（如 INVENTORY_ALERT）\n" +
                    "- intentName: 意图名称（如 库存告警）\n" +
                    "- intentCategory: 分类（SYSTEM/USER/CONFIG/DATA_OP/FORM）\n" +
                    "- keywords: 关键词数组\n" +
                    "- description: 描述\n" +
                    scopeHint + "\n" +
                    "示例 context: {\n" +
                    "  \"intentCode\": \"INVENTORY_ALERT\",\n" +
                    "  \"intentName\": \"库存告警\",\n" +
                    "  \"intentCategory\": \"SYSTEM\",\n" +
                    "  \"keywords\": [\"库存告警\", \"库存不足\", \"缺货预警\"],\n" +
                    "  \"description\": \"设置和管理库存告警规则\"" +
                    (isPlatformAdmin ? ",\n  \"scope\": \"PLATFORM\"  // 可选: PLATFORM 或 FACTORY" : "") +
                    "\n}");
        }

        JsonNode params = objectMapper.valueToTree(request.getContext());

        // 验证必填字段
        if (!params.has("intentCode") || !params.has("intentName")) {
            return buildNeedMoreInfoResponse(intentConfig,
                    "创建意图需要提供 intentCode 和 intentName");
        }

        String newIntentCode = params.get("intentCode").asText();
        String newIntentName = params.get("intentName").asText();

        // 确定有效的工厂ID（平台管理员可以选择创建平台级或工厂级意图）
        String effectiveFactoryId = factoryId; // 默认使用当前工厂
        String scopeDescription = "工厂级";

        if (isPlatformAdmin && params.has("scope")) {
            String scope = params.get("scope").asText().toUpperCase();
            if ("PLATFORM".equals(scope)) {
                // 平台级意图：所有工厂可见
                effectiveFactoryId = null;
                scopeDescription = "平台级";
                log.info("平台管理员创建平台级意图: intentCode={}", newIntentCode);
            } else if ("FACTORY".equals(scope)) {
                // 工厂级意图：可指定目标工厂
                if (params.has("targetFactoryId")) {
                    effectiveFactoryId = params.get("targetFactoryId").asText();
                    scopeDescription = "工厂级 (目标工厂: " + effectiveFactoryId + ")";
                }
                log.info("平台管理员创建工厂级意图: intentCode={}, factoryId={}", newIntentCode, effectiveFactoryId);
            }
        }

        // 检查是否已存在（工厂级隔离：检查工厂范围内是否有同名意图）
        // 平台级意图检查全局范围，工厂级意图检查工厂范围
        boolean existsInScope;
        if (effectiveFactoryId == null) {
            // 平台级意图：检查是否已存在同名的平台级意图
            existsInScope = intentConfigRepository.existsByIntentCodeAndDeletedAtIsNull(newIntentCode);
        } else {
            existsInScope = intentConfigRepository.existsByIntentCodeInFactoryScope(newIntentCode, effectiveFactoryId);
        }
        if (existsInScope) {
            return buildFailedResponse("INTENT_CREATE", intentConfig,
                    "意图代码 '" + newIntentCode + "' 已存在（" + scopeDescription + "），请使用 INTENT_UPDATE 更新或选择其他代码");
        }

        // 构建新意图配置
        AIIntentConfig newConfig = AIIntentConfig.builder()
                .factoryId(effectiveFactoryId) // null = 平台级, 非null = 工厂级
                .intentCode(newIntentCode)
                .intentName(newIntentName)
                .intentCategory(params.has("intentCategory") ? params.get("intentCategory").asText() : "SYSTEM")
                .sensitivityLevel(params.has("sensitivityLevel") ? params.get("sensitivityLevel").asText() : "MEDIUM")
                .description(params.has("description") ? params.get("description").asText() : null)
                .quotaCost(params.has("quotaCost") ? params.get("quotaCost").asInt() : 1)
                .priority(params.has("priority") ? params.get("priority").asInt() : 80)
                .requiredRoles(params.has("requiredRoles") ? params.get("requiredRoles").toString() : "[\"factory_super_admin\"]")
                .requiresApproval(params.has("requiresApproval") && params.get("requiresApproval").asBoolean())
                .isActive(true) // 默认激活（如果需要审批流程，可设为 false）
                .build();

        // 处理关键词
        if (params.has("keywords")) {
            try {
                newConfig.setKeywords(objectMapper.writeValueAsString(params.get("keywords")));
            } catch (JsonProcessingException e) {
                newConfig.setKeywords("[\"" + newIntentName + "\"]");
            }
        } else {
            newConfig.setKeywords("[\"" + newIntentName + "\"]");
        }

        // 保存新配置
        AIIntentConfig saved = intentConfigRepository.save(newConfig);
        log.info("新意图配置已创建: intentCode={}, id={}, scope={}",
                saved.getIntentCode(), saved.getId(), scopeDescription);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("META")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("新意图 '" + newIntentName + "' 已创建成功！\n" +
                        "意图代码: " + newIntentCode + "\n" +
                        "意图范围: " + scopeDescription + "\n" +
                        "现在可以使用关键词触发此意图。")
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("AIIntentConfig")
                                .entityId(saved.getId())
                                .entityName(newIntentName)
                                .action("CREATED")
                                .changes(Map.of(
                                        "intentCode", newIntentCode,
                                        "category", saved.getIntentCategory(),
                                        "keywords", saved.getKeywords(),
                                        "scope", scopeDescription,
                                        "factoryId", effectiveFactoryId != null ? effectiveFactoryId : "PLATFORM"
                                ))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("TEST_INTENT")
                                .actionName("测试新意图")
                                .description("使用关键词测试新创建的意图")
                                .endpoint("/api/mobile/" + factoryId + "/ai-intents/execute")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_ALL")
                                .actionName("查看所有意图")
                                .description("查看系统中所有意图配置")
                                .endpoint("/api/mobile/" + factoryId + "/ai-intents")
                                .build()
                ))
                .build();
    }

    /**
     * 处理更新意图
     * 支持更新关键词、描述、优先级等
     */
    private IntentExecuteResponse handleUpdateIntent(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig, Long userId, String userRole) {
        String userInput = request.getUserInput();
        boolean isPlatformAdmin = "super_admin".equals(userRole) || "platform_admin".equals(userRole);
        log.info("更新意图: factoryId={}, userRole={}, userInput={}", factoryId, userRole, userInput);

        if (request.getContext() == null || request.getContext().isEmpty()) {
            return buildNeedMoreInfoResponse(intentConfig,
                    "更新意图需要提供以下信息：\n" +
                    "- intentCode: 要更新的意图代码（必填）\n" +
                    "- 以及要更新的字段（可选）：\n" +
                    "  - addKeywords: 要添加的关键词数组\n" +
                    "  - removeKeywords: 要移除的关键词数组\n" +
                    "  - description: 新的描述\n" +
                    "  - priority: 新的优先级\n" +
                    "  - isActive: 是否启用\n\n" +
                    "示例 context: {\n" +
                    "  \"intentCode\": \"USER_CREATE\",\n" +
                    "  \"addKeywords\": [\"新增员工\", \"注册账号\"]\n" +
                    "}");
        }

        JsonNode params = objectMapper.valueToTree(request.getContext());

        if (!params.has("intentCode")) {
            return buildNeedMoreInfoResponse(intentConfig,
                    "请指定要更新的意图代码 (intentCode)");
        }

        String targetIntentCode = params.get("intentCode").asText();

        // 查找现有意图（工厂级隔离：优先查找工厂级意图，其次平台级）
        List<AIIntentConfig> matchingConfigs = intentConfigRepository
                .findByIntentCodeAndFactoryIdOrPlatform(targetIntentCode, factoryId);

        if (matchingConfigs.isEmpty()) {
            return buildFailedResponse("INTENT_UPDATE", intentConfig,
                    "未找到意图: " + targetIntentCode);
        }

        // 取第一个匹配结果（工厂级优先）
        AIIntentConfig existing = matchingConfigs.get(0);

        // 权限检查：工厂用户不能修改平台级意图
        if (existing.getFactoryId() == null && !isPlatformAdmin) {
            return buildFailedResponse("INTENT_UPDATE", intentConfig,
                    "无权修改平台级意图 '" + targetIntentCode + "'。请联系平台管理员。");
        }

        // 权限检查：工厂用户只能修改自己工厂的意图
        if (existing.getFactoryId() != null && !existing.getFactoryId().equals(factoryId) && !isPlatformAdmin) {
            return buildFailedResponse("INTENT_UPDATE", intentConfig,
                    "无权修改其他工厂的意图 '" + targetIntentCode + "'");
        }
        List<String> changes = new ArrayList<>();

        // 处理添加关键词
        if (params.has("addKeywords")) {
            try {
                List<String> currentKeywords = parseKeywords(existing.getKeywords());
                JsonNode addKeywordsNode = params.get("addKeywords");
                List<String> addKeywords = new ArrayList<>();
                if (addKeywordsNode.isArray()) {
                    for (JsonNode kw : addKeywordsNode) {
                        String keyword = kw.asText();
                        if (!currentKeywords.contains(keyword)) {
                            currentKeywords.add(keyword);
                            addKeywords.add(keyword);
                        }
                    }
                }
                existing.setKeywords(objectMapper.writeValueAsString(currentKeywords));
                if (!addKeywords.isEmpty()) {
                    changes.add("添加关键词: " + String.join(", ", addKeywords));
                }
            } catch (Exception e) {
                log.warn("添加关键词失败: {}", e.getMessage());
            }
        }

        // 处理移除关键词
        if (params.has("removeKeywords")) {
            try {
                List<String> currentKeywords = parseKeywords(existing.getKeywords());
                JsonNode removeKeywordsNode = params.get("removeKeywords");
                List<String> removedKeywords = new ArrayList<>();
                if (removeKeywordsNode.isArray()) {
                    for (JsonNode kw : removeKeywordsNode) {
                        String keyword = kw.asText();
                        if (currentKeywords.remove(keyword)) {
                            removedKeywords.add(keyword);
                        }
                    }
                }
                existing.setKeywords(objectMapper.writeValueAsString(currentKeywords));
                if (!removedKeywords.isEmpty()) {
                    changes.add("移除关键词: " + String.join(", ", removedKeywords));
                }
            } catch (Exception e) {
                log.warn("移除关键词失败: {}", e.getMessage());
            }
        }

        // 更新描述
        if (params.has("description")) {
            existing.setDescription(params.get("description").asText());
            changes.add("更新描述");
        }

        // 更新优先级
        if (params.has("priority")) {
            existing.setPriority(params.get("priority").asInt());
            changes.add("更新优先级为: " + existing.getPriority());
        }

        // 更新启用状态
        if (params.has("isActive")) {
            existing.setIsActive(params.get("isActive").asBoolean());
            changes.add(existing.getIsActive() ? "已启用" : "已禁用");
        }

        if (changes.isEmpty()) {
            return buildFailedResponse("INTENT_UPDATE", intentConfig,
                    "未检测到任何更新，请指定要修改的字段");
        }

        // 保存更新
        intentConfigRepository.save(existing);
        log.info("意图配置已更新: intentCode={}, changes={}", targetIntentCode, changes);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("META")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("意图 '" + existing.getIntentName() + "' 已更新！\n" +
                        "更新内容:\n- " + String.join("\n- ", changes))
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("AIIntentConfig")
                                .entityId(existing.getId())
                                .entityName(existing.getIntentName())
                                .action("UPDATED")
                                .changes(Map.of("changes", changes.toString()))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 处理分析意图
     * 返回意图使用统计信息
     */
    private IntentExecuteResponse handleAnalyzeIntent(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        log.info("分析意图使用情况: factoryId={}", factoryId);

        // 获取当前工厂可见的意图配置（工厂级 + 平台级）
        List<AIIntentConfig> allConfigs = intentConfigRepository.findByFactoryIdOrPlatformLevel(factoryId);

        // 按分类统计
        Map<String, Long> categoryStats = allConfigs.stream()
                .collect(Collectors.groupingBy(
                        c -> c.getIntentCategory() != null ? c.getIntentCategory() : "UNKNOWN",
                        Collectors.counting()
                ));

        // 按敏感度统计
        Map<String, Long> sensitivityStats = allConfigs.stream()
                .collect(Collectors.groupingBy(
                        c -> c.getSensitivityLevel() != null ? c.getSensitivityLevel() : "LOW",
                        Collectors.counting()
                ));

        // 需要审批的意图数量
        long requiresApprovalCount = allConfigs.stream()
                .filter(c -> Boolean.TRUE.equals(c.getRequiresApproval()))
                .count();

        // 构建统计报告
        StringBuilder report = new StringBuilder();
        report.append("📊 AI 意图配置统计\n");
        report.append("═══════════════════════════\n\n");

        report.append("【总体概况】\n");
        report.append("• 意图总数: ").append(allConfigs.size()).append(" 个\n");
        report.append("• 需审批: ").append(requiresApprovalCount).append(" 个\n\n");

        report.append("【按分类统计】\n");
        categoryStats.forEach((category, count) ->
                report.append("• ").append(getCategoryDisplayName(category))
                        .append(": ").append(count).append(" 个\n")
        );

        report.append("\n【按敏感度统计】\n");
        sensitivityStats.forEach((level, count) ->
                report.append("• ").append(getSensitivityDisplayName(level))
                        .append(": ").append(count).append(" 个\n")
        );

        report.append("\n【高优先级意图 TOP5】\n");
        allConfigs.stream()
                .sorted((a, b) -> Integer.compare(
                        b.getPriority() != null ? b.getPriority() : 0,
                        a.getPriority() != null ? a.getPriority() : 0))
                .limit(5)
                .forEach(c -> report.append("• ")
                        .append(c.getIntentName())
                        .append(" (").append(c.getIntentCode()).append(")")
                        .append(" - 优先级: ").append(c.getPriority())
                        .append("\n")
                );

        // 构建结果数据
        Map<String, Object> resultData = new LinkedHashMap<>();
        resultData.put("totalCount", allConfigs.size());
        resultData.put("requiresApprovalCount", requiresApprovalCount);
        resultData.put("categoryStats", categoryStats);
        resultData.put("sensitivityStats", sensitivityStats);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("META")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message(report.toString())
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(resultData)
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_ALL")
                                .actionName("查看所有意图")
                                .description("查看完整的意图配置列表")
                                .endpoint("/api/mobile/" + factoryId + "/ai-intents")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("CREATE_NEW")
                                .actionName("创建新意图")
                                .description("创建新的意图配置")
                                .endpoint("/api/mobile/" + factoryId + "/ai-intents/execute")
                                .parameters(Map.of("userInput", "创建意图"))
                                .build()
                ))
                .build();
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        String intentCode = intentConfig.getIntentCode();
        log.info("MetaIntentHandler预览: intentCode={}, factoryId={}", intentCode, factoryId);

        String previewMessage = switch (intentCode) {
            case "INTENT_CREATE" -> "将创建新的 AI 意图配置。需要提供意图代码、名称、分类和关键词。";
            case "INTENT_UPDATE" -> "将更新现有意图配置。可以添加/移除关键词、修改描述和优先级。";
            case "INTENT_ANALYZE" -> "将分析系统中所有意图的使用情况和统计信息。";
            default -> "未知的元意图操作";
        };

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig.getIntentName())
                .intentCategory("META")
                .status("PREVIEW")
                .message(previewMessage)
                .executedAt(LocalDateTime.now())
                .build();
    }

    @Override
    public boolean supportsSemanticsMode() {
        // 启用语义模式
        return true;
    }

    // ==================== Helper Methods ====================

    private List<String> parseKeywords(String keywordsJson) {
        if (keywordsJson == null || keywordsJson.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            JsonNode node = objectMapper.readTree(keywordsJson);
            List<String> keywords = new ArrayList<>();
            if (node.isArray()) {
                for (JsonNode kw : node) {
                    keywords.add(kw.asText());
                }
            }
            return keywords;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String getCategoryDisplayName(String category) {
        return switch (category) {
            case "SYSTEM" -> "系统配置";
            case "USER" -> "用户管理";
            case "CONFIG" -> "配置管理";
            case "DATA_OP" -> "数据操作";
            case "FORM" -> "表单生成";
            case "META" -> "元意图";
            case "ANALYSIS" -> "数据分析";
            case "SCHEDULE" -> "排程管理";
            default -> category;
        };
    }

    private String getSensitivityDisplayName(String level) {
        return switch (level) {
            case "LOW" -> "低敏感";
            case "MEDIUM" -> "中敏感";
            case "HIGH" -> "高敏感";
            case "CRITICAL" -> "关键操作";
            default -> level;
        };
    }

    private IntentExecuteResponse buildFailedResponse(String intentCode, AIIntentConfig intentConfig, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig != null ? intentConfig.getIntentName() : null)
                .intentCategory("META")
                .status("FAILED")
                .message(message)
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse buildNeedMoreInfoResponse(AIIntentConfig intentConfig, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("META")
                .status("NEED_MORE_INFO")
                .message(message)
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("PROVIDE_PARAMS")
                                .actionName("补充参数")
                                .description("请在请求中添加 context 字段提供所需信息")
                                .build()
                ))
                .build();
    }
}
