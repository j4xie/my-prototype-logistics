package com.cretas.aims.service;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.config.DashScopeConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * LLM 意图消歧服务
 *
 * 当食品实体冲突检测触发时（hasEntityIntentConflict），
 * 调用 LLM 判断用户真实意图是"食品知识查询"还是"工厂数据操作"。
 *
 * 设计原则：
 * - 使用 qwen-turbo（快速 + 低成本）
 * - 内存缓存避免重复调用
 * - LLM 不可用时 fallback 到 FOOD_KNOWLEDGE（与原行为一致）
 */
@Slf4j
@Service
public class IntentDisambiguationService {

    private final DashScopeClient dashScopeClient;
    private final DashScopeConfig dashScopeConfig;
    private final ObjectMapper objectMapper;

    @Value("${cretas.ai.disambiguation.enabled:true}")
    private boolean enabled;

    @Value("${cretas.ai.disambiguation.cache-ttl-seconds:3600}")
    private long cacheTtlSeconds;

    @Value("${cretas.ai.disambiguation.max-cache-size:500}")
    private int maxCacheSize;

    @Value("${cretas.ai.disambiguation.timeout-ms:5000}")
    private int timeoutMs;

    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private static final String SYSTEM_PROMPT =
            "你是食品溯源系统的意图分类助手。判断用户输入属于哪一类：\n" +
            "A=食品知识查询（通用知识、标准、工艺、注意事项）\n" +
            "B=工厂数据操作（查询本工厂具体数据：批次、库存数量、订单、状态）\n\n" +
            "判断规则（严格按此顺序执行）：\n" +
            "1. 问\"怎么做/怎么预防/注意什么/标准要求/原因/措施\" → A\n" +
            "2. 问\"还剩多少/有多少/库存/列表/今天/本月的\" → B\n" +
            "3. 食品名+\"工艺/要注意/注意事项\" → A\n" +
            "4. 食品名+\"批次/入库/出库/数量\" → B\n\n" +
            "例子：\n" +
            "\"大肠杆菌超标的原因和预防措施\" → A（问原因和预防知识）\n" +
            "\"酸奶的生产工艺要注意什么\" → A（问工艺注意事项）\n" +
            "\"库房里还剩多少猪肉\" → B（问具体库存数量）\n" +
            "\"牛肉批次入库了多少\" → B（问具体入库数据）\n\n" +
            "重要：choice字段必须与你的判断一致。如果你认为是知识查询，choice必须填A。\n" +
            "仅返回JSON: {\"choice\":\"A\",\"reason\":\"简短理由\"}";

    public IntentDisambiguationService(
            DashScopeClient dashScopeClient,
            DashScopeConfig dashScopeConfig,
            ObjectMapper objectMapper) {
        this.dashScopeClient = dashScopeClient;
        this.dashScopeConfig = dashScopeConfig;
        this.objectMapper = objectMapper;
    }

    public enum Choice {
        FOOD_KNOWLEDGE,
        FACTORY_DATA
    }

    public static class DisambiguationResult {
        private final Choice choice;
        private final String reason;
        private final long latencyMs;
        private final boolean isDefault;

        public DisambiguationResult(Choice choice, String reason, long latencyMs, boolean isDefault) {
            this.choice = choice;
            this.reason = reason;
            this.latencyMs = latencyMs;
            this.isDefault = isDefault;
        }

        public Choice getChoice() { return choice; }
        public String getReason() { return reason; }
        public long getLatencyMs() { return latencyMs; }
        public boolean isDefault() { return isDefault; }
    }

    private static class CacheEntry {
        final DisambiguationResult result;
        final long expiresAt;

        CacheEntry(DisambiguationResult result, long ttlMs) {
            this.result = result;
            this.expiresAt = System.currentTimeMillis() + ttlMs;
        }

        boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }
    }

    /**
     * 消歧判断：用户输入是食品知识查询还是工厂数据操作
     *
     * @param originalInput 用户原始输入
     * @param matchedIntent 系统初步匹配到的意图代码
     * @return 消歧结果
     */
    public DisambiguationResult disambiguate(String originalInput, String matchedIntent) {
        long startTime = System.currentTimeMillis();

        // 功能未启用时，默认返回食品知识（保持原行为）
        if (!enabled) {
            log.debug("[Disambiguation] 功能未启用，默认返回FOOD_KNOWLEDGE");
            return new DisambiguationResult(Choice.FOOD_KNOWLEDGE, "功能未启用", 0, true);
        }

        // 检查缓存
        String cacheKey = originalInput.trim().toLowerCase();
        CacheEntry cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            long latency = System.currentTimeMillis() - startTime;
            log.debug("[Disambiguation] 缓存命中: input='{}', choice={}, latency={}ms",
                    originalInput, cached.result.getChoice(), latency);
            return new DisambiguationResult(
                    cached.result.getChoice(), cached.result.getReason() + " (cached)", latency, false);
        }

        // LLM 不可用时 fallback
        if (!dashScopeConfig.isAvailable()) {
            log.warn("[Disambiguation] DashScope不可用，默认返回FOOD_KNOWLEDGE");
            return new DisambiguationResult(Choice.FOOD_KNOWLEDGE, "LLM不可用", 0, true);
        }

        // 调用 LLM
        try {
            String userPrompt = String.format("用户输入：\"%s\"\n系统初步匹配到的意图：%s", originalInput, matchedIntent);

            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .model(dashScopeConfig.getCorrectionModel())
                    .messages(List.of(
                            ChatMessage.system(SYSTEM_PROMPT),
                            ChatMessage.user(userPrompt)
                    ))
                    .maxTokens(150)
                    .temperature(0.1)
                    .build();

            ChatCompletionResponse response = dashScopeClient.chatCompletion(request);
            long latency = System.currentTimeMillis() - startTime;

            if (response.hasError()) {
                log.warn("[Disambiguation] LLM返回错误: {}, 默认FOOD_KNOWLEDGE", response.getErrorMessage());
                return new DisambiguationResult(Choice.FOOD_KNOWLEDGE, "LLM错误: " + response.getErrorMessage(), latency, true);
            }

            String content = response.getContent();
            if (content == null || content.isBlank()) {
                log.warn("[Disambiguation] LLM返回空内容，默认FOOD_KNOWLEDGE");
                return new DisambiguationResult(Choice.FOOD_KNOWLEDGE, "LLM返回空", latency, true);
            }

            // 解析 JSON 响应
            DisambiguationResult result = parseResponse(content, latency);

            // 写入缓存（淘汰旧条目）
            if (cache.size() >= maxCacheSize) {
                evictExpiredEntries();
            }
            if (cache.size() < maxCacheSize) {
                cache.put(cacheKey, new CacheEntry(result, cacheTtlSeconds * 1000));
            }

            log.info("[Disambiguation] input='{}', matchedIntent='{}', choice={}, reason='{}', latency={}ms",
                    originalInput, matchedIntent, result.getChoice(), result.getReason(), latency);

            return result;
        } catch (Exception e) {
            long latency = System.currentTimeMillis() - startTime;
            log.warn("[Disambiguation] LLM调用异常: {}, 默认FOOD_KNOWLEDGE", e.getMessage());
            return new DisambiguationResult(Choice.FOOD_KNOWLEDGE, "异常: " + e.getMessage(), latency, true);
        }
    }

    private DisambiguationResult parseResponse(String content, long latency) {
        try {
            // 提取 JSON 部分（LLM 可能返回额外文字）
            String json = content.trim();
            int braceStart = json.indexOf('{');
            int braceEnd = json.lastIndexOf('}');
            if (braceStart >= 0 && braceEnd > braceStart) {
                json = json.substring(braceStart, braceEnd + 1);
            }

            JsonNode node = objectMapper.readTree(json);
            String choiceStr = node.has("choice") ? node.get("choice").asText() : "";
            String reason = node.has("reason") ? node.get("reason").asText() : "";

            Choice choice;
            if ("B".equalsIgnoreCase(choiceStr)) {
                choice = Choice.FACTORY_DATA;
            } else if ("A".equalsIgnoreCase(choiceStr)) {
                choice = Choice.FOOD_KNOWLEDGE;
            } else {
                // 无法解析时默认食品知识
                choice = Choice.FOOD_KNOWLEDGE;
            }
            log.debug("[Disambiguation] LLM raw: choice='{}', reason='{}'", choiceStr, reason);

            return new DisambiguationResult(choice, reason, latency, false);
        } catch (Exception e) {
            log.warn("[Disambiguation] JSON解析失败: content='{}', error={}", content, e.getMessage());
            // 解析失败时默认食品知识
            return new DisambiguationResult(Choice.FOOD_KNOWLEDGE, "JSON解析失败", latency, true);
        }
    }

    private void evictExpiredEntries() {
        cache.entrySet().removeIf(entry -> entry.getValue().isExpired());
    }

    /**
     * 检查服务是否可用
     */
    public boolean isAvailable() {
        return enabled && dashScopeConfig.isAvailable();
    }
}
