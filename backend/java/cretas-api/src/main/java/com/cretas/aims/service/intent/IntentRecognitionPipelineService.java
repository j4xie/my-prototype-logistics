package com.cretas.aims.service.intent;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.MultiIntentResult;
import com.cretas.aims.entity.config.AIIntentConfig;

import java.util.List;
import java.util.Optional;

/**
 * Intent Recognition Pipeline Service
 *
 * Orchestrates the full intent recognition flow:
 * phrase matching -> classifier -> semantic router -> scoring -> LLM fallback.
 * This is the "conductor" that calls sub-services in sequence.
 *
 * @author Cretas Team
 * @version 2.0.0 (refactored from AIIntentServiceImpl)
 */
public interface IntentRecognitionPipelineService {

    /**
     * Main pipeline: recognize intent with confidence (full 6-param signature).
     */
    IntentMatchResult recognizeIntentWithConfidence(String userInput, String factoryId, int topN,
                                                     Long userId, String userRole, String sessionId);

    /**
     * Simple recognition (regex + keyword, no confidence scoring).
     */
    Optional<AIIntentConfig> recognizeIntent(String factoryId, String userInput);

    /**
     * Simple recognition without factory isolation (deprecated, backward-compat).
     */
    @Deprecated
    Optional<AIIntentConfig> recognizeIntent(String userInput);

    /**
     * Recognize all matching intents (factory-isolated).
     */
    List<AIIntentConfig> recognizeAllIntents(String factoryId, String userInput);

    /**
     * Recognize all matching intents (deprecated, backward-compat).
     */
    @Deprecated
    List<AIIntentConfig> recognizeAllIntents(String userInput);

    /**
     * Multi-label intent recognition.
     */
    MultiIntentResult recognizeMultiIntent(String userInput, String factoryId);

    /**
     * Multi-label intent recognition with custom threshold.
     */
    MultiIntentResult recognizeMultiIntent(String userInput, String factoryId, double threshold);
}
