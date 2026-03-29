package com.cretas.aims.service.intent;

import com.cretas.aims.config.IntentKnowledgeBase;
import com.cretas.aims.dto.ClassifierResult;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.RouteDecision;
import com.cretas.aims.entity.config.AIIntentConfig;

import java.util.List;

/**
 * Semantic Matching Service
 *
 * Handles embedding-based similarity matching, BERT classifier,
 * semantic router, and RAG retrieval:
 * - Layer 0.4: Semantic similarity matching
 * - v16.0: Python BERT classifier fast decision
 * - v11.0: Semantic router (DIRECT_EXECUTE / NEED_RERANKING / NEED_FULL_LLM)
 * - v11.4: RAG historical case retrieval
 * - v35.0: OOD detection
 *
 * @author Cretas Team
 * @version 2.0.0 (refactored from AIIntentServiceImpl)
 */
public interface SemanticMatchingService {

    /**
     * Try classifier fast decision (BERT model).
     * Returns a result if high-confidence classifier match; null to continue.
     * Sets ONNX fallback result in thread-local for downstream use.
     */
    IntentMatchResult tryClassifierFastDecision(String processedInput, String userInput,
                                                 String factoryId, String businessDomain,
                                                 boolean skipPhraseShortcut,
                                                 Object enhancedResult, Object preprocessedQuery);

    /**
     * Try semantic router decision.
     * Returns a result if DIRECT_EXECUTE or successful NEED_RERANKING; null to continue.
     */
    IntentMatchResult trySemanticRouterDecision(String processedInput, String userInput,
                                                 String factoryId, int topN,
                                                 Long userId, String userRole,
                                                 String businessDomain, boolean skipPhraseShortcut,
                                                 Object enhancedResult, Object preprocessedQuery);

    /**
     * Detect OOD (Out-of-Distribution) input.
     * Returns true if input is likely out-of-domain.
     */
    boolean detectOOD(String userInput, String processedInput);

    /**
     * Handle OOD fallback (try phrase match rescue, then route to GENERIC_AI_CHAT).
     */
    IntentMatchResult handleOODFallback(String userInput, String factoryId,
                                         String businessDomain,
                                         Object enhancedResult, Object preprocessedQuery);

    /**
     * Check if a routed intent is a semantic black hole.
     */
    boolean isSemanticBlackHoleIntent(String routedIntent, String userInput);

    /**
     * Retrieve and clear the ONNX classifier fallback result from thread-local.
     */
    ClassifierResult getAndClearOnnxFallbackResult();
}
