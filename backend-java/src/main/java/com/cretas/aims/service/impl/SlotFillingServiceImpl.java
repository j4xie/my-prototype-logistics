package com.cretas.aims.service.impl;

import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.config.IntentSlotConfiguration;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.slot.RequiredSlot;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.ConversationService;
import com.cretas.aims.service.ParameterExtractionLearningService;
import com.cretas.aims.service.SlotFillingService;
import com.cretas.aims.dto.ai.PreprocessedQuery;
import com.cretas.aims.config.TimeNormalizationRules;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Slot Filling 服务实现
 *
 * 实现渐进式参数收集（Slot Filling）机制：
 * 1. 在意图识别后检查必需参数
 * 2. 使用正则表达式和学习规则提取参数
 * 3. 主动创建参数收集会话
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SlotFillingServiceImpl implements SlotFillingService {

    private final IntentSlotConfiguration intentSlotConfiguration;
    private final ToolRegistry toolRegistry;
    private final ConversationService conversationService;
    private final ParameterExtractionLearningService parameterExtractionLearningService;

    @Override
    public IntentExecuteResponse checkAndStartSlotFilling(
            String factoryId,
            Long userId,
            AIIntentConfig intent,
            IntentExecuteRequest request,
            IntentMatchResult matchResult) {

        try {
            // 1. 获取意图的必需槽位定义
            List<RequiredSlot> requiredSlots = getRequiredSlots(intent);
            if (requiredSlots.isEmpty()) {
                log.debug("意图 {} 无必需槽位配置，跳过 Slot Filling", intent.getIntentCode());
                return null;
            }

            // 2. 从用户输入和上下文中提取已有参数
            Map<String, Object> extractedParams = extractParameters(
                    request.getUserInput(),
                    requiredSlots,
                    request.getContext(),
                    matchResult);

            log.debug("从用户输入提取参数: intentCode={}, extracted={}",
                    intent.getIntentCode(), extractedParams.keySet());

            // 3. 找出缺失的必需槽位
            List<RequiredSlot> missingSlots = findMissingSlots(requiredSlots, extractedParams);
            if (missingSlots.isEmpty()) {
                log.debug("所有必需参数已提取，跳过 Slot Filling: intentCode={}", intent.getIntentCode());
                // 将提取的参数合并到请求上下文
                if (request.getContext() == null) {
                    request.setContext(new HashMap<>());
                }
                request.getContext().putAll(extractedParams);
                return null;
            }

            log.info("检测到缺失参数，启动 Slot Filling: intentCode={}, missing={}",
                    intent.getIntentCode(),
                    missingSlots.stream().map(RequiredSlot::getName).collect(Collectors.toList()));

            // 4. 启动参数收集会话
            return startSlotFilling(factoryId, userId, intent, missingSlots, extractedParams);

        } catch (Exception e) {
            log.warn("Slot Filling 检查失败，继续执行: intentCode={}, error={}",
                    intent.getIntentCode(), e.getMessage());
            return null;
        }
    }

    @Override
    public List<RequiredSlot> getRequiredSlots(AIIntentConfig intent) {
        // 1. 优先从配置中获取
        List<RequiredSlot> configuredSlots = intentSlotConfiguration.getMandatorySlots(intent.getIntentCode());
        if (!configuredSlots.isEmpty()) {
            return configuredSlots;
        }

        // 2. 尝试从绑定的 Tool 推断
        String toolName = intent.getToolName();
        if (toolName != null && !toolName.isEmpty()) {
            Optional<ToolExecutor> toolOpt = toolRegistry.getExecutor(toolName);
            if (toolOpt.isPresent()) {
                return inferSlotsFromTool(toolOpt.get());
            }
        }

        return Collections.emptyList();
    }

    @SuppressWarnings("unchecked")
    private List<RequiredSlot> inferSlotsFromTool(ToolExecutor tool) {
        List<RequiredSlot> slots = new ArrayList<>();

        Map<String, Object> schema = tool.getParametersSchema();
        if (schema == null) return slots;

        List<String> required = (List<String>) schema.get("required");
        Map<String, Object> properties = (Map<String, Object>) schema.get("properties");

        if (required == null || properties == null) return slots;

        for (String paramName : required) {
            Map<String, Object> propDef = (Map<String, Object>) properties.get(paramName);
            if (propDef == null) continue;

            String type = (String) propDef.get("type");
            String description = (String) propDef.get("description");

            RequiredSlot slot = RequiredSlot.builder()
                    .name(paramName)
                    .label(description != null ? description : getParameterLabel(paramName))
                    .type(mapJsonTypeToSlotType(type))
                    .required(true)
                    .validationHint(getParameterValidationHint(paramName))
                    .build();
            slots.add(slot);
        }

        return slots;
    }

    private String mapJsonTypeToSlotType(String jsonType) {
        if (jsonType == null) return "TEXT";
        switch (jsonType.toLowerCase()) {
            case "integer": return "INTEGER";
            case "number": return "NUMBER";
            case "boolean": return "BOOLEAN";
            default: return "TEXT";
        }
    }

    @Override
    public Map<String, Object> extractParameters(
            String userInput,
            List<RequiredSlot> slots,
            Map<String, Object> context,
            IntentMatchResult matchResult) {

        Map<String, Object> extracted = new HashMap<>();

        // 1. 从请求上下文获取
        if (context != null) {
            for (RequiredSlot slot : slots) {
                Object value = context.get(slot.getName());
                if (value != null && !value.toString().isEmpty()) {
                    extracted.put(slot.getName(), value);
                }
            }
        }

        // 2. 从预处理结果获取（实体引用、时间范围等）
        if (matchResult != null && matchResult.getPreprocessedQuery() != null) {
            extractFromPreprocessedQuery(matchResult.getPreprocessedQuery(), extracted);
        }

        // 3. 使用正则模式从用户输入提取
        if (userInput != null && !userInput.isEmpty()) {
            extractWithPatterns(userInput, slots, extracted);
        }

        // 4. 使用学习规则提取剩余参数
        if (matchResult != null && matchResult.getBestMatch() != null) {
            extractWithLearnedRules(userInput, slots, extracted, matchResult, context);
        }

        return extracted;
    }

    private void extractFromPreprocessedQuery(PreprocessedQuery pq, Map<String, Object> extracted) {
        // 提取已解析的实体引用
        if (pq.getResolvedReferences() != null) {
            for (Map.Entry<String, PreprocessedQuery.ResolvedReference> entry : pq.getResolvedReferences().entrySet()) {
                PreprocessedQuery.ResolvedReference ref = entry.getValue();
                if (ref != null && ref.getEntityType() != null) {
                    String paramName = entityTypeToParamName(ref.getEntityType());
                    if (paramName != null && !extracted.containsKey(paramName)) {
                        extracted.put(paramName, ref.getEntityId());
                    }
                }
            }
        }

        // 提取时间范围
        if (pq.hasTimeRange()) {
            TimeNormalizationRules.TimeRange timeRange = pq.getPrimaryTimeRange();
            if (timeRange != null && timeRange.isValid()) {
                if (!extracted.containsKey("startDate")) {
                    extracted.put("startDate", timeRange.getStart().toLocalDate().toString());
                }
                if (!extracted.containsKey("endDate")) {
                    extracted.put("endDate", timeRange.getEnd().toLocalDate().toString());
                }
            }
        }
    }

    private void extractWithPatterns(String userInput, List<RequiredSlot> slots, Map<String, Object> extracted) {
        for (RequiredSlot slot : slots) {
            if (extracted.containsKey(slot.getName())) continue;

            String pattern = slot.getPattern();
            if (pattern != null && !pattern.isEmpty()) {
                try {
                    Matcher matcher = Pattern.compile(pattern).matcher(userInput);
                    if (matcher.find()) {
                        String value = matcher.group(1);
                        if (value != null && !value.isEmpty()) {
                            extracted.put(slot.getName(), normalizeSlotValue(value, slot.getType()));
                            log.debug("正则提取参数: {}={}", slot.getName(), value);
                        }
                    }
                } catch (Exception e) {
                    log.debug("正则提取失败: slot={}, error={}", slot.getName(), e.getMessage());
                }
            }
        }
    }

    private void extractWithLearnedRules(String userInput, List<RequiredSlot> slots,
                                          Map<String, Object> extracted, IntentMatchResult matchResult,
                                          Map<String, Object> context) {
        List<String> remainingParams = slots.stream()
                .map(RequiredSlot::getName)
                .filter(name -> !extracted.containsKey(name))
                .collect(Collectors.toList());

        if (!remainingParams.isEmpty()) {
            try {
                String factoryId = context != null && context.containsKey("factoryId")
                        ? context.get("factoryId").toString() : null;
                Map<String, Object> learnedExtracted = parameterExtractionLearningService.extractWithLearnedRules(
                        factoryId,
                        matchResult.getBestMatch().getIntentCode(),
                        userInput,
                        remainingParams);
                extracted.putAll(learnedExtracted);
            } catch (Exception e) {
                log.debug("学习规则提取失败: {}", e.getMessage());
            }
        }
    }

    private String entityTypeToParamName(String entityType) {
        if (entityType == null) return null;
        switch (entityType.toUpperCase()) {
            case "BATCH": return "batchId";
            case "SUPPLIER": return "supplierId";
            case "PRODUCT": return "productId";
            case "CUSTOMER": return "customerId";
            case "MATERIAL_TYPE": return "materialTypeId";
            default: return null;
        }
    }

    private Object normalizeSlotValue(String value, String slotType) {
        if (value == null || slotType == null) return value;

        switch (slotType.toUpperCase()) {
            case "INTEGER":
                try {
                    return Integer.parseInt(value.replaceAll("[^\\d]", ""));
                } catch (NumberFormatException e) {
                    return value;
                }
            case "NUMBER":
                try {
                    return Double.parseDouble(value.replaceAll("[^\\d.]", ""));
                } catch (NumberFormatException e) {
                    return value;
                }
            case "BOOLEAN":
                return value.matches("(?i)true|yes|是|1");
            case "DATE":
                if (value.equals("今天")) return LocalDate.now().toString();
                if (value.equals("明天")) return LocalDate.now().plusDays(1).toString();
                if (value.equals("昨天")) return LocalDate.now().minusDays(1).toString();
                return value;
            default:
                return value;
        }
    }

    @Override
    public List<RequiredSlot> findMissingSlots(List<RequiredSlot> requiredSlots, Map<String, Object> extractedParams) {
        List<RequiredSlot> missing = new ArrayList<>();

        for (RequiredSlot slot : requiredSlots) {
            if (!slot.isRequired()) continue;

            Object value = extractedParams.get(slot.getName());
            if (value == null || (value instanceof String && ((String) value).trim().isEmpty())) {
                missing.add(slot);
            }
        }

        return missing;
    }

    @Override
    public IntentExecuteResponse startSlotFilling(
            String factoryId,
            Long userId,
            AIIntentConfig intent,
            List<RequiredSlot> missingSlots,
            Map<String, Object> extractedParams) {

        // 1. 生成澄清问题
        List<String> clarificationQuestions = generateClarificationQuestions(missingSlots, intent);

        // 2. 转换为 ConversationService 的参数格式
        List<ConversationService.RequiredParameter> requiredParams = missingSlots.stream()
                .map(slot -> ConversationService.RequiredParameter.builder()
                        .name(slot.getName())
                        .label(slot.getLabel())
                        .type(slot.getType())
                        .validationHint(slot.getValidationHint())
                        .collected(false)
                        .build())
                .collect(Collectors.toList());

        // 3. 创建参数收集会话
        String sessionId = null;
        Integer conversationRound = 1;
        Integer maxConversationRounds = 5;

        try {
            ConversationService.ConversationResponse conversationResp =
                    conversationService.startParameterCollection(
                            factoryId, userId, intent.getIntentCode(), intent.getIntentName(),
                            requiredParams, clarificationQuestions);

            if (conversationResp != null && conversationResp.getSessionId() != null) {
                sessionId = conversationResp.getSessionId();
                conversationRound = conversationResp.getCurrentRound();
                maxConversationRounds = conversationResp.getMaxRounds();
                log.info("Slot Filling 会话已创建: sessionId={}, intentCode={}, missingParams={}",
                        sessionId, intent.getIntentCode(),
                        missingSlots.stream().map(RequiredSlot::getName).collect(Collectors.toList()));
            }
        } catch (Exception e) {
            log.warn("创建 Slot Filling 会话失败: {}", e.getMessage());
        }

        // 4. 构建响应消息
        String message = buildSlotFillingMessage(intent.getIntentName(), clarificationQuestions);

        // 5. 构建响应元数据
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("slotFilling", true);
        metadata.put("missingSlots", missingSlots.stream()
                .map(s -> Map.of("name", s.getName(), "label", s.getLabel(), "type", s.getType()))
                .collect(Collectors.toList()));
        if (!extractedParams.isEmpty()) {
            metadata.put("extractedParams", extractedParams);
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intent.getIntentCode())
                .intentName(intent.getIntentName())
                .intentCategory(intent.getIntentCategory())
                .status("NEED_MORE_INFO")
                .message(message)
                .clarificationQuestions(clarificationQuestions)
                .sessionId(sessionId)
                .conversationRound(conversationRound)
                .maxConversationRounds(maxConversationRounds)
                .metadata(metadata)
                .executedAt(LocalDateTime.now())
                .build();
    }

    private List<String> generateClarificationQuestions(List<RequiredSlot> missingSlots, AIIntentConfig intent) {
        List<String> questions = new ArrayList<>();
        for (RequiredSlot slot : missingSlots) {
            questions.add(generateQuestionForSlot(slot, intent));
        }
        return questions;
    }

    private String generateQuestionForSlot(RequiredSlot slot, AIIntentConfig intent) {
        // 如果有验证提示，优先使用
        if (slot.getValidationHint() != null && !slot.getValidationHint().isEmpty()) {
            return slot.getValidationHint();
        }

        String label = slot.getLabel() != null ? slot.getLabel() : slot.getName();
        String type = slot.getType() != null ? slot.getType().toUpperCase() : "TEXT";

        switch (type) {
            case "BATCH_ID":
                return "请问您要操作哪个批次？请提供批次号或批次ID。";
            case "QUANTITY":
            case "NUMBER":
                return "请问" + label + "是多少？";
            case "DATE":
                return "请提供" + label + "（格式：YYYY-MM-DD 或 今天/明天）";
            case "SELECT":
                return "请选择" + label;
            case "BOOLEAN":
                return label + "？（是/否）";
            default:
                return "请提供" + label;
        }
    }

    private String buildSlotFillingMessage(String intentName, List<String> questions) {
        StringBuilder sb = new StringBuilder();
        sb.append("好的，我来帮您执行「").append(intentName != null ? intentName : "操作").append("」。\n\n");
        sb.append("需要您提供以下信息：\n");

        for (int i = 0; i < questions.size(); i++) {
            sb.append(i + 1).append(". ").append(questions.get(i)).append("\n");
        }

        sb.append("\n请直接告诉我，我会帮您完成操作。");
        return sb.toString();
    }

    private String getParameterLabel(String paramName) {
        Map<String, String> labels = Map.ofEntries(
                Map.entry("batchId", "批次号"),
                Map.entry("batchNumber", "批次号"),
                Map.entry("quantity", "数量"),
                Map.entry("materialTypeId", "原材料类型"),
                Map.entry("productId", "产品"),
                Map.entry("supplierId", "供应商"),
                Map.entry("customerId", "客户"),
                Map.entry("reason", "原因"),
                Map.entry("status", "状态"),
                Map.entry("startDate", "开始日期"),
                Map.entry("endDate", "结束日期")
        );
        return labels.getOrDefault(paramName, paramName);
    }

    private String getParameterValidationHint(String paramName) {
        Map<String, String> hints = Map.ofEntries(
                Map.entry("batchId", "请提供批次号，例如：MT-20240115-001"),
                Map.entry("quantity", "请输入数量，可以带单位如 100kg"),
                Map.entry("startDate", "请提供日期，格式：YYYY-MM-DD 或 今天/明天"),
                Map.entry("endDate", "请提供日期，格式：YYYY-MM-DD 或 今天/明天")
        );
        return hints.get(paramName);
    }
}
