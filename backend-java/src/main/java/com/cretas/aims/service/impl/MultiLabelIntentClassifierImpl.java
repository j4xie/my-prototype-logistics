package com.cretas.aims.service.impl;

import com.cretas.aims.dto.intent.MultiIntentResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.EmbeddingClient;
import com.cretas.aims.service.LlmIntentFallbackClient;
import com.cretas.aims.service.MultiLabelIntentClassifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 多标签意图分类器实现
 *
 * 基于 Sigmoid 的多标签意图分类：
 * 1. 将用户输入转为向量 (EmbeddingClient)
 * 2. 与所有意图向量计算余弦相似度
 * 3. Sigmoid 归一化为 0-1 概率
 * 4. 阈值筛选
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MultiLabelIntentClassifierImpl implements MultiLabelIntentClassifier {

    private final EmbeddingClient embeddingClient;
    private final AIIntentConfigRepository intentConfigRepository;

    /**
     * LLM Fallback 客户端（用于 Phase 0 验证和 embedding 不可用时的降级）
     */
    @Autowired(required = false)
    private LlmIntentFallbackClient llmFallbackClient;

    /**
     * 默认阈值
     */
    @Value("${ai.multi-intent.threshold:0.55}")
    private double defaultThreshold;

    /**
     * Sigmoid 放大系数（增加区分度）
     */
    @Value("${ai.multi-intent.sigmoid-scale:6.0}")
    private double sigmoidScale;

    /**
     * 最大返回意图数
     */
    @Value("${ai.multi-intent.max-intents:3}")
    private int maxIntents;

    /**
     * 是否启用 LLM Fallback（Phase 0 验证用）
     */
    @Value("${ai.multi-intent.llm-fallback-enabled:true}")
    private boolean llmFallbackEnabled;

    /**
     * 意图向量缓存
     * Key: intentCode
     * Value: embedding vector
     */
    private final Map<String, float[]> intentEmbeddingCache = new ConcurrentHashMap<>();

    /**
     * 意图描述文本缓存
     * Key: intentCode
     * Value: 构建的意图描述文本
     */
    private final Map<String, String> intentDescriptionCache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        log.info("MultiLabelIntentClassifier 初始化 - threshold={}, sigmoidScale={}, maxIntents={}",
                defaultThreshold, sigmoidScale, maxIntents);
        // 预热缓存（可选，首次查询时懒加载）
    }

    @Override
    public MultiIntentResult classifyMultiLabel(String userInput, String factoryId) {
        return classifyMultiLabel(userInput, factoryId, defaultThreshold);
    }

    @Override
    public MultiIntentResult classifyMultiLabel(String userInput, String factoryId, double threshold) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return buildEmptyResult("输入为空");
        }

        if (!isAvailable()) {
            log.warn("Embedding 服务和 LLM Fallback 都不可用，无法进行多标签分类");
            return buildEmptyResult("分类服务不可用");
        }

        // Phase 0 验证：使用 LLM Fallback
        if (shouldUseLlmFallback()) {
            log.info("[Phase0] 使用 LLM Fallback 进行多意图分类: '{}'", userInput);
            try {
                MultiIntentResult llmResult = llmFallbackClient.classifyMultiIntent(userInput, factoryId, null);
                if (llmResult != null && !llmResult.getIntents().isEmpty()) {
                    log.info("[Phase0] LLM Fallback 成功: isMulti={}, intents={}",
                            llmResult.isMultiIntent(), llmResult.getIntents().size());
                    return llmResult;
                }
            } catch (Exception e) {
                log.error("[Phase0] LLM Fallback 失败: {}", e.getMessage());
            }
            return buildEmptyResult("LLM Fallback 分类失败");
        }

        try {
            // 1. 获取所有意图评分（使用 Embedding）
            List<ScoredIntent> allScores = getAllIntentScores(userInput, factoryId);

            // 2. 筛选超过阈值的意图
            List<ScoredIntent> passedIntents = allScores.stream()
                    .filter(s -> s.getSigmoidScore() >= threshold)
                    .limit(maxIntents)
                    .collect(Collectors.toList());

            if (passedIntents.isEmpty()) {
                log.debug("多标签分类: 无意图超过阈值 {} - userInput: {}", threshold, userInput);
                return buildEmptyResult("无意图超过阈值");
            }

            // 3. 构建多意图结果
            boolean isMultiIntent = passedIntents.size() > 1;
            List<MultiIntentResult.SingleIntentMatch> intents = new ArrayList<>();

            for (int i = 0; i < passedIntents.size(); i++) {
                ScoredIntent scored = passedIntents.get(i);
                AIIntentConfig intent = scored.getIntent();

                intents.add(MultiIntentResult.SingleIntentMatch.builder()
                        .intentCode(intent.getIntentCode())
                        .intentName(intent.getIntentName())
                        .confidence(scored.getSigmoidScore())
                        .extractedParams(new HashMap<>())
                        .reasoning(String.format("语义相似度: %.3f → Sigmoid: %.3f",
                                scored.getRawSimilarity(), scored.getSigmoidScore()))
                        .executionOrder(i + 1)
                        .build());
            }

            // 4. 确定执行策略
            MultiIntentResult.ExecutionStrategy strategy = determineStrategy(intents);

            // 5. 计算总体置信度（取平均）
            double overallConfidence = intents.stream()
                    .mapToDouble(MultiIntentResult.SingleIntentMatch::getConfidence)
                    .average()
                    .orElse(0.0);

            String reasoning = isMultiIntent
                    ? String.format("检测到 %d 个独立意图，阈值 %.2f", intents.size(), threshold)
                    : String.format("单意图匹配，置信度 %.3f", overallConfidence);

            log.info("多标签分类完成: isMulti={}, intents={}, strategy={}, confidence={:.3f}",
                    isMultiIntent, intents.size(), strategy, overallConfidence);

            return MultiIntentResult.builder()
                    .isMultiIntent(isMultiIntent)
                    .intents(intents)
                    .executionStrategy(strategy)
                    .overallConfidence(overallConfidence)
                    .reasoning(reasoning)
                    .build();

        } catch (Exception e) {
            log.error("多标签分类失败: {}", e.getMessage(), e);
            return buildEmptyResult("分类过程异常: " + e.getMessage());
        }
    }

    @Override
    public double computeIntentScore(String userInput, AIIntentConfig intent) {
        if (userInput == null || intent == null) {
            return 0.0;
        }

        try {
            // 获取用户输入向量
            float[] inputEmbedding = embeddingClient.encode(userInput);

            // 获取意图向量
            float[] intentEmbedding = getIntentEmbedding(intent);

            // 计算余弦相似度
            double similarity = cosineSimilarity(inputEmbedding, intentEmbedding);

            // Sigmoid 归一化
            return sigmoid(similarity);

        } catch (Exception e) {
            log.error("计算意图评分失败: intent={}, error={}", intent.getIntentCode(), e.getMessage());
            return 0.0;
        }
    }

    @Override
    public List<ScoredIntent> getAllIntentScores(String userInput, String factoryId) {
        // 获取所有启用的意图
        List<AIIntentConfig> allIntents = factoryId != null
                ? intentConfigRepository.findByFactoryIdOrPlatformLevel(factoryId)
                : intentConfigRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByPriorityDesc();

        if (allIntents.isEmpty()) {
            log.warn("无可用意图配置: factoryId={}", factoryId);
            return Collections.emptyList();
        }

        // 获取用户输入向量
        float[] inputEmbedding;
        try {
            inputEmbedding = embeddingClient.encode(userInput);
        } catch (Exception e) {
            log.error("用户输入向量化失败: {}", e.getMessage());
            return Collections.emptyList();
        }

        // 计算所有意图的评分
        List<ScoredIntentImpl> results = new ArrayList<>();
        for (AIIntentConfig intent : allIntents) {
            try {
                float[] intentEmbedding = getIntentEmbedding(intent);
                double rawSimilarity = cosineSimilarity(inputEmbedding, intentEmbedding);
                double sigmoidScore = sigmoid(rawSimilarity);

                results.add(new ScoredIntentImpl(intent, rawSimilarity, sigmoidScore));
            } catch (Exception e) {
                log.warn("意图 {} 评分失败: {}", intent.getIntentCode(), e.getMessage());
            }
        }

        // 按 Sigmoid 评分降序排列
        results.sort((a, b) -> Double.compare(b.getSigmoidScore(), a.getSigmoidScore()));

        return new ArrayList<>(results);
    }

    @Override
    public double getDefaultThreshold() {
        return defaultThreshold;
    }

    @Override
    public boolean isAvailable() {
        // 优先检查 embedding 服务
        if (embeddingClient != null && embeddingClient.isAvailable()) {
            return true;
        }
        // Phase 0 验证：如果启用了 LLM fallback，也视为可用
        if (llmFallbackEnabled && llmFallbackClient != null && llmFallbackClient.isHealthy()) {
            log.debug("Embedding 不可用，使用 LLM Fallback 模式");
            return true;
        }
        return false;
    }

    /**
     * 检查是否应该使用 LLM fallback
     */
    private boolean shouldUseLlmFallback() {
        return llmFallbackEnabled
                && (embeddingClient == null || !embeddingClient.isAvailable())
                && llmFallbackClient != null
                && llmFallbackClient.isHealthy();
    }

    // ==================== 私有方法 ====================

    /**
     * 获取意图向量（带缓存）
     */
    private float[] getIntentEmbedding(AIIntentConfig intent) {
        String cacheKey = intent.getIntentCode();

        return intentEmbeddingCache.computeIfAbsent(cacheKey, k -> {
            String intentText = buildIntentText(intent);
            intentDescriptionCache.put(cacheKey, intentText);
            return embeddingClient.encode(intentText);
        });
    }

    /**
     * 构建意图描述文本（用于向量化）
     *
     * 组合：意图名称 + 描述 + 关键词 + 示例查询
     */
    private String buildIntentText(AIIntentConfig intent) {
        StringBuilder sb = new StringBuilder();

        // 意图名称
        sb.append(intent.getIntentName());

        // 描述
        if (intent.getDescription() != null && !intent.getDescription().isEmpty()) {
            sb.append(" ").append(intent.getDescription());
        }

        // 关键词
        List<String> keywords = intent.getKeywordsList();
        if (!keywords.isEmpty()) {
            sb.append(" ").append(String.join(" ", keywords));
        }

        // 示例查询（最多取3个）
        List<String> examples = intent.getExampleQueriesList();
        if (!examples.isEmpty()) {
            int limit = Math.min(3, examples.size());
            for (int i = 0; i < limit; i++) {
                sb.append(" ").append(examples.get(i));
            }
        }

        return sb.toString();
    }

    /**
     * 计算余弦相似度
     */
    private double cosineSimilarity(float[] a, float[] b) {
        if (a.length != b.length) {
            throw new IllegalArgumentException("向量维度不匹配: " + a.length + " vs " + b.length);
        }

        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        for (int i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA == 0 || normB == 0) {
            return 0.0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Sigmoid 函数
     *
     * @param x 输入值（通常是余弦相似度，范围 -1 到 1）
     * @return 归一化后的概率 (0-1)
     */
    private double sigmoid(double x) {
        // 使用放大系数增加区分度
        // 相似度 0.5 → ~0.5, 相似度 0.7 → ~0.85, 相似度 0.3 → ~0.15
        return 1.0 / (1.0 + Math.exp(-sigmoidScale * (x - 0.5)));
    }

    /**
     * 确定执行策略
     */
    private MultiIntentResult.ExecutionStrategy determineStrategy(
            List<MultiIntentResult.SingleIntentMatch> intents) {

        if (intents.size() <= 1) {
            return MultiIntentResult.ExecutionStrategy.PARALLEL;
        }

        // 如果有意图置信度低于 0.7，需要用户确认
        boolean hasLowConfidence = intents.stream()
                .anyMatch(i -> i.getConfidence() < 0.7);

        if (hasLowConfidence || intents.size() > 3) {
            return MultiIntentResult.ExecutionStrategy.USER_CONFIRM;
        }

        // 检查是否有依赖关系（简单判断：如果有 CREATE 在 QUERY 前面）
        // TODO: 可以增加更复杂的依赖判断逻辑

        return MultiIntentResult.ExecutionStrategy.PARALLEL;
    }

    /**
     * 构建空结果
     */
    private MultiIntentResult buildEmptyResult(String reason) {
        return MultiIntentResult.builder()
                .isMultiIntent(false)
                .intents(Collections.emptyList())
                .executionStrategy(MultiIntentResult.ExecutionStrategy.PARALLEL)
                .overallConfidence(0.0)
                .reasoning(reason)
                .build();
    }

    /**
     * 清除缓存（用于意图配置更新后）
     */
    public void clearCache() {
        intentEmbeddingCache.clear();
        intentDescriptionCache.clear();
        log.info("多标签分类器缓存已清除");
    }

    /**
     * 清除单个意图的缓存
     */
    public void clearCache(String intentCode) {
        intentEmbeddingCache.remove(intentCode);
        intentDescriptionCache.remove(intentCode);
        log.debug("意图 {} 缓存已清除", intentCode);
    }

    // ==================== 内部类 ====================

    /**
     * 评分意图实现类
     */
    private static class ScoredIntentImpl implements ScoredIntent {
        private final AIIntentConfig intent;
        private final double rawSimilarity;
        private final double sigmoidScore;

        public ScoredIntentImpl(AIIntentConfig intent, double rawSimilarity, double sigmoidScore) {
            this.intent = intent;
            this.rawSimilarity = rawSimilarity;
            this.sigmoidScore = sigmoidScore;
        }

        @Override
        public AIIntentConfig getIntent() {
            return intent;
        }

        @Override
        public double getRawSimilarity() {
            return rawSimilarity;
        }

        @Override
        public double getSigmoidScore() {
            return sigmoidScore;
        }
    }
}
