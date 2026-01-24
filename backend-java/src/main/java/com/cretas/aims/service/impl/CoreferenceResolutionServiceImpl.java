package com.cretas.aims.service.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.dto.clarification.ReferenceResult;
import com.cretas.aims.dto.clarification.ReferenceResult.ResolvedItem;
import com.cretas.aims.dto.clarification.ReferenceResult.ResolutionMethod;
import com.cretas.aims.dto.conversation.ConversationContext;
import com.cretas.aims.dto.conversation.ConversationMessage;
import com.cretas.aims.dto.conversation.EntitySlot;
import com.cretas.aims.service.CoreferenceResolutionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 指代消解服务实现
 *
 * 实现 Phase 3 会话级指代消解：
 * 1. 识别代词："它"、"这个"、"那批"、"上面提到的"
 * 2. 从会话历史中查找指代对象
 * 3. 使用 LLM 辅助复杂指代消解
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Slf4j
@Service
public class CoreferenceResolutionServiceImpl implements CoreferenceResolutionService {

    private final DashScopeClient dashScopeClient;
    private final ObjectMapper objectMapper;

    /**
     * 是否启用指代消解
     */
    @Value("${cretas.ai.coreference.enabled:true}")
    private boolean enabled;

    /**
     * 是否启用 LLM 辅助消解
     */
    @Value("${cretas.ai.coreference.llm-enabled:true}")
    private boolean llmEnabled;

    /**
     * LLM 消解的最小上下文轮数
     */
    @Value("${cretas.ai.coreference.min-context-rounds:1}")
    private int minContextRounds;

    @Autowired
    public CoreferenceResolutionServiceImpl(
            @Autowired(required = false) DashScopeClient dashScopeClient,
            ObjectMapper objectMapper) {
        this.dashScopeClient = dashScopeClient;
        this.objectMapper = objectMapper;
    }

    // ==================== 指代词正则模式 ====================

    /**
     * 代词模式: 它、他们、它们
     */
    private static final Pattern PRONOUN_PATTERN = Pattern.compile(
            "(它|他们|它们|她|他|她们)"
    );

    /**
     * 近指模式: 这个、这批、这家
     */
    private static final Pattern PROXIMAL_PATTERN = Pattern.compile(
            "(这个|这批|这家|这种|这类|这些|这里|这边)"
    );

    /**
     * 远指模式: 那个、那批、那家
     */
    private static final Pattern DISTAL_PATTERN = Pattern.compile(
            "(那个|那批|那家|那种|那类|那些|那里|那边)"
    );

    /**
     * 定指模式: 该批次、该供应商
     */
    private static final Pattern DEFINITE_PATTERN = Pattern.compile(
            "(该批次|该供应商|该客户|该物料|该产品|该订单|该记录|该)"
    );

    /**
     * 时间指代模式: 刚才、之前、上次
     */
    private static final Pattern TEMPORAL_PATTERN = Pattern.compile(
            "(刚才|之前|上次|上回|前面|刚刚|方才)"
    );

    /**
     * 位置指代模式: 上面、前面
     */
    private static final Pattern POSITIONAL_PATTERN = Pattern.compile(
            "(上面|前面|上述|上边|上头|前头)(?:提到的|说的|那个)?"
    );

    /**
     * 复合指代模式: 上面提到的、刚才说的
     */
    private static final Pattern COMPOUND_PATTERN = Pattern.compile(
            "(上面提到的|刚才说的|之前提到的|前面说的|上次查的|刚才查的)"
    );

    /**
     * 所有支持的指代词模式（按优先级排序）
     */
    private static final List<PatternEntry> ALL_PATTERNS = Arrays.asList(
            new PatternEntry(COMPOUND_PATTERN, ReferenceType.POSITIONAL),
            new PatternEntry(TEMPORAL_PATTERN, ReferenceType.TEMPORAL),
            new PatternEntry(POSITIONAL_PATTERN, ReferenceType.POSITIONAL),
            new PatternEntry(DEFINITE_PATTERN, ReferenceType.DEFINITE),
            new PatternEntry(PROXIMAL_PATTERN, ReferenceType.PROXIMAL),
            new PatternEntry(DISTAL_PATTERN, ReferenceType.DISTAL),
            new PatternEntry(PRONOUN_PATTERN, ReferenceType.PRONOUN)
    );

    @Override
    public ReferenceResult resolve(String userInput, ConversationContext context) {
        if (!enabled || userInput == null || userInput.isEmpty()) {
            return ReferenceResult.noReference(userInput);
        }

        long startTime = System.currentTimeMillis();

        try {
            // Step 1: 检测所有指代词
            List<DetectedReference> detectedRefs = detectReferences(userInput);
            if (detectedRefs.isEmpty()) {
                return ReferenceResult.noReference(userInput);
            }

            log.debug("检测到 {} 个指代词: {}", detectedRefs.size(), detectedRefs);

            // Step 2: 批量消解
            Map<String, String> resolvedMap = resolveBatch(userInput, detectedRefs, context);

            // Step 3: 构建消解后的文本
            String resolvedText = applyResolutions(userInput, detectedRefs, resolvedMap);

            // Step 4: 找出未消解的指代
            List<String> unresolvedList = new ArrayList<>();
            List<ResolvedItem> resolvedItems = new ArrayList<>();

            for (DetectedReference ref : detectedRefs) {
                String resolved = resolvedMap.get(ref.getText());
                if (resolved != null && !resolved.equals(ref.getText())) {
                    resolvedItems.add(ResolvedItem.builder()
                            .reference(ref.getText())
                            .resolvedTo(resolved)
                            .method(ResolutionMethod.CONTEXT)
                            .startIndex(ref.getStartIndex())
                            .endIndex(ref.getEndIndex())
                            .confidence(0.8)
                            .build());
                } else {
                    unresolvedList.add(ref.getText());
                }
            }

            long processingTime = System.currentTimeMillis() - startTime;

            // 判断消解状态
            if (resolvedItems.isEmpty()) {
                // 全部未消解，尝试 LLM
                if (llmEnabled && context != null && hasEnoughContext(context)) {
                    ReferenceResult llmResult = resolveWithLLM(userInput, unresolvedList, context);
                    llmResult.setProcessingTimeMs(processingTime + llmResult.getProcessingTimeMs());
                    return llmResult;
                }
                return ReferenceResult.failed(userInput, unresolvedList);
            }

            // 部分或全部消解成功
            double avgConfidence = resolvedItems.stream()
                    .mapToDouble(ResolvedItem::getConfidence)
                    .average()
                    .orElse(0.8);

            ReferenceResult result = ReferenceResult.builder()
                    .originalText(userInput)
                    .resolvedText(resolvedText)
                    .resolvedReferences(resolvedMap)
                    .resolvedItems(resolvedItems)
                    .unresolvedReferences(unresolvedList)
                    .resolved(true)
                    .confidence(avgConfidence)
                    .resolutionMethod(unresolvedList.isEmpty()
                            ? ResolutionMethod.CONTEXT
                            : ResolutionMethod.HYBRID)
                    .processingTimeMs(processingTime)
                    .build();

            log.info("指代消解完成: {} -> {}, resolved={}, unresolved={}, time={}ms",
                    userInput, resolvedText, resolvedItems.size(),
                    unresolvedList.size(), processingTime);

            return result;

        } catch (Exception e) {
            log.warn("指代消解失败: {}", e.getMessage());
            return ReferenceResult.noReference(userInput);
        }
    }

    @Override
    public List<DetectedReference> detectReferences(String userInput) {
        List<DetectedReference> detected = new ArrayList<>();

        if (userInput == null || userInput.isEmpty()) {
            return detected;
        }

        // 按优先级匹配所有模式
        Set<String> foundPositions = new HashSet<>(); // 避免重复检测

        for (PatternEntry entry : ALL_PATTERNS) {
            Matcher matcher = entry.pattern.matcher(userInput);
            while (matcher.find()) {
                String matchText = matcher.group(1);
                int start = matcher.start(1);
                String posKey = start + ":" + matchText;

                if (!foundPositions.contains(posKey)) {
                    foundPositions.add(posKey);
                    detected.add(DetectedReference.builder()
                            .text(matchText)
                            .type(entry.type)
                            .startIndex(start)
                            .endIndex(matcher.end(1))
                            .expectedEntityType(inferEntityType(matchText, entry.type))
                            .build());
                }
            }
        }

        // 按位置排序
        detected.sort(Comparator.comparingInt(DetectedReference::getStartIndex));

        return detected;
    }

    @Override
    public ResolvedEntity findReferent(
            String reference,
            ReferenceType referenceType,
            ConversationContext context) {

        if (context == null) {
            return null;
        }

        // 1. 从实体槽位查找
        ResolvedEntity slotEntity = findFromEntitySlots(reference, referenceType, context);
        if (slotEntity != null) {
            return slotEntity;
        }

        // 2. 从最近消息中查找
        ResolvedEntity messageEntity = findFromRecentMessages(reference, referenceType, context);
        if (messageEntity != null) {
            return messageEntity;
        }

        // 3. 从最后意图上下文查找
        if (context.getLastIntentCode() != null) {
            // 如果有最后意图，可能相关实体就是那个意图涉及的实体
            return ResolvedEntity.builder()
                    .entityType("INFERRED")
                    .entityName("上次操作的对象")
                    .source("lastIntent")
                    .confidence(0.5)
                    .build();
        }

        return null;
    }

    @Override
    public ReferenceResult resolveWithLLM(
            String userInput,
            List<String> references,
            ConversationContext context) {

        if (dashScopeClient == null || !llmEnabled) {
            return ReferenceResult.failed(userInput, references);
        }

        long startTime = System.currentTimeMillis();

        try {
            // 构建上下文摘要
            String contextSummary = buildContextSummary(context);

            // 构建 prompt
            String prompt = buildLLMPrompt(userInput, references, contextSummary);

            // 调用 LLM
            String response = dashScopeClient.chatCompletionWithPrompt(prompt);

            // 解析响应
            Map<String, String> resolvedMap = parseLLMResponse(response, references);

            if (resolvedMap.isEmpty()) {
                return ReferenceResult.failed(userInput, references);
            }

            // 应用消解
            String resolvedText = userInput;
            List<ResolvedItem> resolvedItems = new ArrayList<>();

            for (Map.Entry<String, String> entry : resolvedMap.entrySet()) {
                resolvedText = resolvedText.replace(entry.getKey(), entry.getValue());
                resolvedItems.add(ResolvedItem.builder()
                        .reference(entry.getKey())
                        .resolvedTo(entry.getValue())
                        .method(ResolutionMethod.LLM)
                        .confidence(0.75)
                        .build());
            }

            long processingTime = System.currentTimeMillis() - startTime;

            return ReferenceResult.builder()
                    .originalText(userInput)
                    .resolvedText(resolvedText)
                    .resolvedReferences(resolvedMap)
                    .resolvedItems(resolvedItems)
                    .resolved(true)
                    .confidence(0.75)
                    .resolutionMethod(ResolutionMethod.LLM)
                    .processingTimeMs(processingTime)
                    .build();

        } catch (Exception e) {
            log.warn("LLM 指代消解失败: {}", e.getMessage());
            return ReferenceResult.failed(userInput, references);
        }
    }

    @Override
    public Map<String, String> resolveBatch(
            String userInput,
            List<DetectedReference> references,
            ConversationContext context) {

        Map<String, String> resolved = new HashMap<>();

        for (DetectedReference ref : references) {
            ResolvedEntity entity = findReferent(ref.getText(), ref.getType(), context);
            if (entity != null && entity.getEntityName() != null) {
                resolved.put(ref.getText(), entity.getEntityName());
            }
        }

        return resolved;
    }

    @Override
    public boolean hasUnresolvedReferences(String userInput) {
        if (userInput == null || userInput.isEmpty()) {
            return false;
        }

        for (PatternEntry entry : ALL_PATTERNS) {
            if (entry.pattern.matcher(userInput).find()) {
                return true;
            }
        }
        return false;
    }

    @Override
    public List<String> getSupportedPatterns() {
        return Arrays.asList(
                "代词: 它、他们、它们",
                "近指: 这个、这批、这家、这种、这类",
                "远指: 那个、那批、那家、那种、那类",
                "定指: 该批次、该供应商、该客户",
                "时间指代: 刚才、之前、上次",
                "位置指代: 上面、前面、上述",
                "复合指代: 上面提到的、刚才说的"
        );
    }

    @Override
    public boolean isAvailable() {
        return enabled;
    }

    @Override
    public boolean isLLMAvailable() {
        return llmEnabled && dashScopeClient != null;
    }

    // ==================== 私有辅助方法 ====================

    private String inferEntityType(String reference, ReferenceType type) {
        // 根据指代词推断可能的实体类型
        if (reference.contains("批")) {
            return "BATCH";
        }
        if (reference.contains("供应商") || reference.contains("家")) {
            return "SUPPLIER";
        }
        if (reference.contains("客户")) {
            return "CUSTOMER";
        }
        if (reference.contains("物料") || reference.contains("料")) {
            return "MATERIAL";
        }
        if (reference.contains("产品")) {
            return "PRODUCT";
        }
        return null;
    }

    private ResolvedEntity findFromEntitySlots(
            String reference,
            ReferenceType type,
            ConversationContext context) {

        if (context.getEntitySlots() == null || context.getEntitySlots().isEmpty()) {
            return null;
        }

        // 根据引用文本推断槽位类型
        EntitySlot.SlotType slotType = inferSlotType(reference);
        if (slotType != null) {
            EntitySlot slot = context.getSlot(slotType);
            if (slot != null) {
                return ResolvedEntity.builder()
                        .entityType(slotType.name())
                        .entityId(slot.getId())
                        .entityName(slot.getName())
                        .source("entitySlot")
                        .confidence(0.9)
                        .build();
            }
        }

        // 如果无法确定类型，返回最近使用的任意槽位
        if (type == ReferenceType.PROXIMAL || type == ReferenceType.PRONOUN) {
            // 近指或代词，取最近更新的槽位
            return context.getEntitySlots().values().stream()
                    .filter(Objects::nonNull)
                    .max(Comparator.comparing(s -> s.getUpdatedAt() != null
                            ? s.getUpdatedAt() : java.time.LocalDateTime.MIN))
                    .map(slot -> ResolvedEntity.builder()
                            .entityType(slot.getType() != null ? slot.getType().name() : "UNKNOWN")
                            .entityId(slot.getId())
                            .entityName(slot.getName())
                            .source("recentSlot")
                            .confidence(0.7)
                            .build())
                    .orElse(null);
        }

        return null;
    }

    private EntitySlot.SlotType inferSlotType(String reference) {
        if (reference.contains("批") || reference.contains("货")) {
            return EntitySlot.SlotType.BATCH;
        }
        if (reference.contains("供应商") || reference.contains("厂家")) {
            return EntitySlot.SlotType.SUPPLIER;
        }
        if (reference.contains("客户") || reference.contains("买家")) {
            return EntitySlot.SlotType.CUSTOMER;
        }
        if (reference.contains("物料") || reference.contains("原料") || reference.contains("材料")) {
            return EntitySlot.SlotType.MATERIAL_TYPE;
        }
        if (reference.contains("产品") || reference.contains("商品")) {
            return EntitySlot.SlotType.PRODUCT;
        }
        return null;
    }

    private ResolvedEntity findFromRecentMessages(
            String reference,
            ReferenceType type,
            ConversationContext context) {

        List<ConversationMessage> messages = context.getRecentMessages();
        if (messages == null || messages.isEmpty()) {
            return null;
        }

        // 从最近的消息向前搜索
        for (int i = messages.size() - 1; i >= 0; i--) {
            ConversationMessage msg = messages.get(i);
            if (msg == null) continue;

            // 检查消息中的实体
            if (msg.getEntities() != null && !msg.getEntities().isEmpty()) {
                // 返回最近消息中的第一个实体
                Map.Entry<String, Object> firstEntity = msg.getEntities().entrySet()
                        .stream().findFirst().orElse(null);
                if (firstEntity != null) {
                    return ResolvedEntity.builder()
                            .entityType(firstEntity.getKey())
                            .entityName(String.valueOf(firstEntity.getValue()))
                            .source("recentMessage")
                            .fromRound(i + 1)
                            .confidence(0.7 - (messages.size() - 1 - i) * 0.1) // 越近置信度越高
                            .build();
                }
            }
        }

        return null;
    }

    private boolean hasEnoughContext(ConversationContext context) {
        if (context == null) {
            return false;
        }
        List<ConversationMessage> messages = context.getRecentMessages();
        return messages != null && messages.size() >= minContextRounds;
    }

    private String buildContextSummary(ConversationContext context) {
        StringBuilder sb = new StringBuilder();

        // 添加实体槽位信息
        if (context.getEntitySlots() != null && !context.getEntitySlots().isEmpty()) {
            sb.append("当前上下文实体:\n");
            for (Map.Entry<EntitySlot.SlotType, EntitySlot> entry : context.getEntitySlots().entrySet()) {
                EntitySlot slot = entry.getValue();
                if (slot != null) {
                    sb.append("  - ").append(entry.getKey().name())
                            .append(": ").append(slot.getName())
                            .append(" (ID: ").append(slot.getId()).append(")\n");
                }
            }
        }

        // 添加最近对话
        List<ConversationMessage> messages = context.getRecentMessages();
        if (messages != null && !messages.isEmpty()) {
            sb.append("\n最近对话:\n");
            int start = Math.max(0, messages.size() - 5); // 最多取最近5轮
            for (int i = start; i < messages.size(); i++) {
                ConversationMessage msg = messages.get(i);
                if (msg != null && msg.getContent() != null) {
                    sb.append("  [").append(msg.getRole()).append("]: ")
                            .append(msg.getContent()).append("\n");
                }
            }
        }

        // 添加最后意图
        if (context.getLastIntentCode() != null) {
            sb.append("\n最后执行的意图: ").append(context.getLastIntentCode());
        }

        return sb.toString();
    }

    private String buildLLMPrompt(String userInput, List<String> references, String contextSummary) {
        return String.format("""
                你是一个指代消解专家。请根据上下文，将用户输入中的指代词替换为具体的实体名称。

                ## 上下文信息
                %s

                ## 用户当前输入
                %s

                ## 需要消解的指代词
                %s

                ## 输出要求
                请以 JSON 格式输出消解结果，格式如下：
                {
                  "resolutions": {
                    "指代词1": "消解后的实体名称",
                    "指代词2": "消解后的实体名称"
                  },
                  "confidence": 0.8,
                  "reasoning": "简短说明消解依据"
                }

                如果无法消解某个指代词，该项的值设为 null。
                只输出 JSON，不要输出其他内容。
                """,
                contextSummary,
                userInput,
                String.join(", ", references)
        );
    }

    private Map<String, String> parseLLMResponse(String response, List<String> references) {
        Map<String, String> resolved = new HashMap<>();

        try {
            // 提取 JSON 部分
            String jsonStr = response;
            int jsonStart = response.indexOf("{");
            int jsonEnd = response.lastIndexOf("}");
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
                jsonStr = response.substring(jsonStart, jsonEnd + 1);
            }

            JsonNode root = objectMapper.readTree(jsonStr);
            JsonNode resolutions = root.get("resolutions");
            if (resolutions != null && resolutions.isObject()) {
                Iterator<Map.Entry<String, JsonNode>> fields = resolutions.fields();
                while (fields.hasNext()) {
                    Map.Entry<String, JsonNode> field = fields.next();
                    if (!field.getValue().isNull()) {
                        resolved.put(field.getKey(), field.getValue().asText());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("解析 LLM 消解响应失败: {}", e.getMessage());
        }

        return resolved;
    }

    private String applyResolutions(
            String input,
            List<DetectedReference> references,
            Map<String, String> resolutions) {

        if (resolutions.isEmpty()) {
            return input;
        }

        String result = input;
        // 按位置从后向前替换，避免位置偏移
        List<DetectedReference> sortedRefs = new ArrayList<>(references);
        sortedRefs.sort((a, b) -> Integer.compare(b.getStartIndex(), a.getStartIndex()));

        for (DetectedReference ref : sortedRefs) {
            String replacement = resolutions.get(ref.getText());
            if (replacement != null && !replacement.equals(ref.getText())) {
                result = result.substring(0, ref.getStartIndex())
                        + replacement
                        + result.substring(ref.getEndIndex());
            }
        }

        return result;
    }

    /**
     * 模式条目
     */
    private static class PatternEntry {
        final Pattern pattern;
        final ReferenceType type;

        PatternEntry(Pattern pattern, ReferenceType type) {
            this.pattern = pattern;
            this.type = type;
        }
    }
}
