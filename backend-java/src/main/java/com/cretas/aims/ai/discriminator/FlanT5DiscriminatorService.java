package com.cretas.aims.ai.discriminator;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

import com.cretas.aims.ai.discriminator.InputValidator.InputQuality;
import com.cretas.aims.ai.discriminator.InputValidator.ValidationResult;

/**
 * Flan-T5 Discriminator Service for JudgeRLVR.
 *
 * <p>This service provides intent judgment capabilities using either:
 * <ul>
 *   <li>Local Flan-T5 model (preferred for latency)</li>
 *   <li>DashScope LLM fallback (when local model unavailable)</li>
 * </ul>
 *
 * <p>Key features:
 * <ul>
 *   <li>Batch judgment for multiple candidates</li>
 *   <li>Configurable pruning thresholds</li>
 *   <li>Result caching for repeated queries</li>
 *   <li>Safe mode for write operations</li>
 *   <li>Metrics collection for monitoring</li>
 * </ul>
 *
 * <p>Usage example:
 * <pre>
 * Map&lt;String, Double&gt; scores = discriminatorService.batchJudge(
 *     "查看今天的销售情况",
 *     List.of("sales_overview", "sales_ranking", "sales_trend")
 * );
 * // scores: {sales_overview=1.0, sales_ranking=0.0, sales_trend=0.0}
 * </pre>
 *
 * @author Cretas AI Team
 * @since 1.0.0
 */
@Slf4j
@Service
public class FlanT5DiscriminatorService {

    private final FlanT5Config config;
    private final DashScopeClient dashScopeClient;
    private final AIIntentConfigRepository intentConfigRepository;
    private final InputValidator inputValidator;

    // Cache for judgment results
    private Cache<String, DiscriminatorResult> resultCache;

    // Metrics for input validation
    private final AtomicLong vagueInputs = new AtomicLong(0);
    private final AtomicLong writeOpInputs = new AtomicLong(0);
    private final AtomicLong irrelevantInputs = new AtomicLong(0);
    private final AtomicLong invalidInputs = new AtomicLong(0);

    // Intent description cache
    private final Map<String, String> intentDescriptionCache = new ConcurrentHashMap<>();

    // Metrics
    private final AtomicLong totalCalls = new AtomicLong(0);
    private final AtomicLong cacheHits = new AtomicLong(0);
    private final AtomicLong localModelCalls = new AtomicLong(0);
    private final AtomicLong fallbackCalls = new AtomicLong(0);
    private final AtomicLong errors = new AtomicLong(0);

    // Local model predictor (lazy initialized)
    // Note: Actual DJL integration would require additional setup
    private volatile boolean localModelAvailable = false;

    @Autowired
    public FlanT5DiscriminatorService(
            FlanT5Config config,
            DashScopeClient dashScopeClient,
            AIIntentConfigRepository intentConfigRepository,
            InputValidator inputValidator
    ) {
        this.config = config;
        this.dashScopeClient = dashScopeClient;
        this.intentConfigRepository = intentConfigRepository;
        this.inputValidator = inputValidator;
    }

    @PostConstruct
    public void init() {
        if (!config.isEnabled()) {
            log.info("Flan-T5 discriminator is disabled");
            return;
        }

        // Initialize cache
        if (config.isCacheEnabled()) {
            this.resultCache = Caffeine.newBuilder()
                    .maximumSize(config.getMaxCacheSize())
                    .expireAfterWrite(Duration.ofSeconds(config.getCacheTtlSeconds()))
                    .recordStats()
                    .build();
            log.info("Flan-T5 result cache initialized: maxSize={}, ttl={}s",
                    config.getMaxCacheSize(), config.getCacheTtlSeconds());
        }

        // Try to initialize local model
        initLocalModel();

        // Preload intent descriptions
        preloadIntentDescriptions();

        log.info("Flan-T5 discriminator initialized: enabled={}, localModel={}, fallback={}",
                config.isEnabled(), localModelAvailable, config.isDashScopeFallbackEnabled());
    }

    /**
     * Initialize local Flan-T5 model.
     * This is a placeholder - actual DJL integration would go here.
     */
    private void initLocalModel() {
        try {
            // Check if model path exists
            java.io.File modelDir = new java.io.File(config.getModelPath());
            if (!modelDir.exists()) {
                log.warn("Flan-T5 model not found at {}, will use DashScope fallback",
                        config.getModelPath());
                return;
            }

            // TODO: Initialize DJL predictor for Flan-T5
            // This would require:
            // 1. Add PyTorch engine dependency
            // 2. Load T5 model using DJL
            // 3. Create text-to-text predictor
            //
            // Example (not implemented):
            // Criteria<String, String> criteria = Criteria.builder()
            //     .setTypes(String.class, String.class)
            //     .optModelPath(Paths.get(config.getModelPath()))
            //     .optEngine("PyTorch")
            //     .build();
            // this.predictor = criteria.loadModel().newPredictor();
            // this.localModelAvailable = true;

            log.info("Local Flan-T5 model initialization skipped (DJL not configured)");
            localModelAvailable = false;

        } catch (Exception e) {
            log.error("Failed to initialize local Flan-T5 model: {}", e.getMessage());
            localModelAvailable = false;
        }
    }

    /**
     * Preload intent descriptions for efficient prompt generation.
     */
    private void preloadIntentDescriptions() {
        try {
            List<AIIntentConfig> configs = intentConfigRepository.findAll();
            for (AIIntentConfig cfg : configs) {
                if (cfg.getIntentCode() != null && cfg.getDescription() != null) {
                    intentDescriptionCache.put(cfg.getIntentCode(), cfg.getDescription());
                }
            }
            log.info("Preloaded {} intent descriptions", intentDescriptionCache.size());
        } catch (Exception e) {
            log.warn("Failed to preload intent descriptions: {}", e.getMessage());
        }
    }

    /**
     * Judge whether a user input matches a single intent.
     *
     * @param userInput   The user's input text
     * @param intentCode  The intent code to judge
     * @return Discriminator result with match status and score
     */
    public DiscriminatorResult judge(String userInput, String intentCode) {
        if (!config.isEnabled()) {
            return DiscriminatorResult.error(intentCode, "Discriminator disabled");
        }

        totalCalls.incrementAndGet();
        long startTime = System.currentTimeMillis();

        // Check cache
        String cacheKey = buildCacheKey(userInput, intentCode);
        if (config.isCacheEnabled() && resultCache != null) {
            DiscriminatorResult cached = resultCache.getIfPresent(cacheKey);
            if (cached != null) {
                cacheHits.incrementAndGet();
                return cached.asCached();
            }
        }

        // Get intent description
        String intentDescription = intentDescriptionCache.getOrDefault(
                intentCode, intentCode);

        // Build prompt
        String prompt = buildPrompt(userInput, intentCode, intentDescription);

        // Execute judgment
        DiscriminatorResult result;
        if (localModelAvailable) {
            result = judgeWithLocalModel(prompt, intentCode);
            localModelCalls.incrementAndGet();
        } else if (config.isDashScopeFallbackEnabled()) {
            result = judgeWithDashScope(prompt, intentCode);
            fallbackCalls.incrementAndGet();
        } else {
            errors.incrementAndGet();
            return DiscriminatorResult.error(intentCode, "No model available");
        }

        // Set latency
        result.setLatencyMs(System.currentTimeMillis() - startTime);
        result.setPrompt(prompt);

        // Cache result
        if (config.isCacheEnabled() && resultCache != null && result.isSuccessful()) {
            resultCache.put(cacheKey, result);
        }

        if (config.isVerboseLogging()) {
            log.debug("Discriminator judgment: input='{}', intent={}, match={}, score={}, latency={}ms",
                    truncate(userInput, 50), intentCode, result.isMatch(),
                    result.getScore(), result.getLatencyMs());
        }

        return result;
    }

    /**
     * Batch judge multiple intents for a single user input with input validation.
     *
     * @param userInput    The user's input text
     * @param intentCodes  List of intent codes to judge
     * @return Map of intent code to score (0.0 to 1.0)
     */
    public Map<String, Double> batchJudge(String userInput, List<String> intentCodes) {
        if (!config.isEnabled() || intentCodes == null || intentCodes.isEmpty()) {
            return new HashMap<>();
        }

        Map<String, Double> scores = new HashMap<>();

        // Validate input first
        ValidationResult validation = inputValidator.validate(userInput);

        // Handle invalid/irrelevant/vague inputs - return all zeros
        if (!validation.isValid()) {
            switch (validation.getQuality()) {
                case INVALID:
                    invalidInputs.incrementAndGet();
                    // Return all zeros for invalid input
                    intentCodes.forEach(code -> scores.put(code, 0.0));
                    return scores;

                case IRRELEVANT:
                    irrelevantInputs.incrementAndGet();
                    // Return all zeros for irrelevant input
                    intentCodes.forEach(code -> scores.put(code, 0.0));
                    return scores;

                case TOO_SHORT:
                case VAGUE:
                    vagueInputs.incrementAndGet();
                    // Return all zeros for vague/too short input - they need clarification
                    intentCodes.forEach(code -> scores.put(code, 0.0));
                    return scores;
            }
        }

        // Handle write operations - return all zeros for query intents
        // Write operations don't match read/query intents
        if (validation.isWriteOperation()) {
            writeOpInputs.incrementAndGet();
            // Return all zeros - write ops shouldn't match query intents
            intentCodes.forEach(code -> scores.put(code, 0.0));
            return scores;
        }

        // Use cleaned input for judgment
        String cleanedInput = validation.getCleanedInput() != null
                ? validation.getCleanedInput()
                : userInput;

        // Get confidence modifier based on input quality
        double confidenceModifier = inputValidator.getConfidenceModifier(validation.getQuality());

        // Process in batches
        int batchSize = config.getBatchSize();
        for (int i = 0; i < intentCodes.size(); i += batchSize) {
            int end = Math.min(i + batchSize, intentCodes.size());
            List<String> batch = intentCodes.subList(i, end);

            // Judge each in batch (can be parallelized)
            if (config.isAsyncEnabled()) {
                List<CompletableFuture<DiscriminatorResult>> futures = batch.stream()
                        .map(intentCode -> CompletableFuture.supplyAsync(
                                () -> judge(cleanedInput, intentCode)))
                        .collect(Collectors.toList());

                CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                        .orTimeout(config.getBatchTimeoutMs(), TimeUnit.MILLISECONDS)
                        .join();

                for (int j = 0; j < batch.size(); j++) {
                    try {
                        DiscriminatorResult result = futures.get(j).get();
                        // Apply confidence modifier
                        double adjustedScore = result.getScore() * confidenceModifier;
                        scores.put(batch.get(j), adjustedScore);
                    } catch (Exception e) {
                        scores.put(batch.get(j), 0.0);
                    }
                }
            } else {
                for (String intentCode : batch) {
                    DiscriminatorResult result = judge(cleanedInput, intentCode);
                    double adjustedScore = result.getScore() * confidenceModifier;
                    scores.put(intentCode, adjustedScore);
                }
            }
        }

        return scores;
    }

    /**
     * Validate user input and return validation result.
     * Can be used by callers to handle special cases.
     *
     * @param userInput The user's input text
     * @return Validation result with quality and suggestions
     */
    public ValidationResult validateInput(String userInput) {
        return inputValidator.validate(userInput);
    }

    /**
     * Check if input contains write operation keywords.
     *
     * @param userInput The user's input text
     * @return true if write operation detected
     */
    public boolean isWriteOperation(String userInput) {
        return inputValidator.containsWriteKeyword(userInput);
    }

    /**
     * Judge and prune candidates based on discriminator scores.
     *
     * @param userInput   The user's input text
     * @param candidates  List of candidate intent codes
     * @param isWriteOp   Whether this is a write operation (use safe mode)
     * @return Pruned list of intent codes
     */
    public List<String> judgeAndPrune(
            String userInput,
            List<String> candidates,
            boolean isWriteOp
    ) {
        if (!config.isEnabled() || candidates == null || candidates.isEmpty()) {
            return candidates;
        }

        // Get scores
        Map<String, Double> scores = batchJudge(userInput, candidates);

        // Determine threshold
        double threshold = isWriteOp && config.isSafeModeEnabled()
                ? config.getSafeModePruneThreshold()
                : config.getPruneThreshold();

        // Sort by score descending
        List<Map.Entry<String, Double>> sorted = scores.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                .collect(Collectors.toList());

        // Prune low scorers
        List<String> pruned = sorted.stream()
                .filter(e -> e.getValue() >= threshold)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        // Ensure minimum candidates
        if (pruned.size() < config.getMinKeepCandidates()) {
            pruned = sorted.stream()
                    .limit(config.getMinKeepCandidates())
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toList());
        }

        if (config.isVerboseLogging()) {
            log.debug("Pruning result: {} -> {} candidates, threshold={}, isWriteOp={}",
                    candidates.size(), pruned.size(), threshold, isWriteOp);
        }

        return pruned;
    }

    /**
     * Check if discriminator should be triggered based on confidence.
     *
     * @param confidence Current matching confidence
     * @return true if discriminator should be used
     */
    public boolean shouldTrigger(double confidence) {
        return config.isEnabled()
                && confidence >= config.getTriggerMinConfidence()
                && confidence < config.getTriggerMaxConfidence();
    }

    // ==================== Private Methods ====================

    /**
     * Build prompt for judgment.
     */
    private String buildPrompt(String userInput, String intentCode, String intentDescription) {
        String template = config.isUseFewShot()
                ? config.getFewShotPromptTemplate()
                : config.getZeroShotPromptTemplate();

        return template
                .replace("{input}", userInput)
                .replace("{intentCode}", intentCode)
                .replace("{intentDescription}", intentDescription);
    }

    /**
     * Judge using local Flan-T5 model.
     */
    private DiscriminatorResult judgeWithLocalModel(String prompt, String intentCode) {
        // TODO: Implement actual DJL inference
        // For now, return error to trigger fallback
        return DiscriminatorResult.error(intentCode, "Local model not implemented");
    }

    /**
     * Judge using DashScope LLM fallback.
     */
    private DiscriminatorResult judgeWithDashScope(String prompt, String intentCode) {
        try {
            // Call DashScope with low temperature for deterministic output
            String response = dashScopeClient.chatLowTemp(
                    "你是一个意图判别助手，只回答'是'或'否'。",
                    prompt
            );

            // Parse response
            if (response == null || response.trim().isEmpty()) {
                return DiscriminatorResult.error(intentCode, "Empty response from DashScope");
            }

            String normalized = response.trim();
            boolean isMatch = normalized.contains("是") && !normalized.contains("否");
            double score = isMatch ? 1.0 : 0.0;

            return DiscriminatorResult.builder()
                    .intentCode(intentCode)
                    .match(isMatch)
                    .score(score)
                    .rawOutput(normalized)
                    .successful(true)
                    .timestamp(Instant.now())
                    .build();

        } catch (Exception e) {
            errors.incrementAndGet();
            log.warn("DashScope judgment failed for intent {}: {}", intentCode, e.getMessage());
            return DiscriminatorResult.error(intentCode, e.getMessage());
        }
    }

    /**
     * Build cache key from user input and intent code.
     */
    private String buildCacheKey(String userInput, String intentCode) {
        return userInput.hashCode() + ":" + intentCode;
    }

    /**
     * Truncate string for logging.
     */
    private String truncate(String s, int maxLen) {
        if (s == null) return "null";
        return s.length() > maxLen ? s.substring(0, maxLen - 3) + "..." : s;
    }

    // ==================== Metrics ====================

    /**
     * Get current metrics.
     */
    public Map<String, Object> getMetrics() {
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("enabled", config.isEnabled());
        metrics.put("localModelAvailable", localModelAvailable);
        metrics.put("totalCalls", totalCalls.get());
        metrics.put("cacheHits", cacheHits.get());
        metrics.put("cacheHitRate", totalCalls.get() > 0
                ? (double) cacheHits.get() / totalCalls.get() : 0.0);
        metrics.put("localModelCalls", localModelCalls.get());
        metrics.put("fallbackCalls", fallbackCalls.get());
        metrics.put("errors", errors.get());

        // Input validation metrics
        metrics.put("vagueInputs", vagueInputs.get());
        metrics.put("writeOpInputs", writeOpInputs.get());
        metrics.put("irrelevantInputs", irrelevantInputs.get());
        metrics.put("invalidInputs", invalidInputs.get());

        if (config.isCacheEnabled() && resultCache != null) {
            metrics.put("cacheSize", resultCache.estimatedSize());
            metrics.put("cacheStats", resultCache.stats().toString());
        }

        return metrics;
    }

    /**
     * Reset metrics counters.
     */
    public void resetMetrics() {
        totalCalls.set(0);
        cacheHits.set(0);
        localModelCalls.set(0);
        fallbackCalls.set(0);
        errors.set(0);
        vagueInputs.set(0);
        writeOpInputs.set(0);
        irrelevantInputs.set(0);
        invalidInputs.set(0);
    }

    /**
     * Clear the result cache.
     */
    public void clearCache() {
        if (resultCache != null) {
            resultCache.invalidateAll();
            log.info("Discriminator cache cleared");
        }
    }

    /**
     * Refresh intent descriptions from database.
     */
    public void refreshIntentDescriptions() {
        intentDescriptionCache.clear();
        preloadIntentDescriptions();
    }

    /**
     * Get all intent descriptions for training data export.
     * @return Map of intentCode -> description
     */
    public Map<String, String> getIntentDescriptions() {
        if (intentDescriptionCache.isEmpty()) {
            preloadIntentDescriptions();
        }
        return new HashMap<>(intentDescriptionCache);
    }
}
