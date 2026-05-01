package com.cretas.aims.service.intent;

import com.cretas.aims.config.IntentKnowledgeBase;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.QueryPreprocessorService;

import java.util.List;

/**
 * Intent Scoring Service
 *
 * Handles v4.0 parallel scoring, v6.0 semantic-first architecture,
 * ArenaRL disambiguation, LLM reranking, LLM fallback, and OOD handling:
 * - doRecognizeIntentWithConfidence (core scoring logic)
 * - tryLlmReranking
 * - tryLlmFallback
 * - parallelScoreMatch (v4.0)
 * - semanticFirstRouting + preciseVerification (v6.0)
 *
 * @author Cretas Team
 * @version 2.0.0 (refactored from AIIntentServiceImpl)
 *
 * @deprecated Phase 2B-β: replaced by Python {@code backend/python/ai/scoring/intent_scoring.py}.
 * This interface still ships in Bucket B for now (no functional change),
 * but no new callers should be added. Phase 3 will remove this entirely.
 */
@Deprecated
public interface IntentScoringService {

    /**
     * Core intent recognition scoring logic (called after phrase/classifier/router layers).
     */
    IntentMatchResult doRecognizeIntentWithConfidence(
            String processedInput, String originalInput,
            String factoryId, int topN,
            Long userId, String userRole,
            QueryPreprocessorService.EnhancedPreprocessResult enhancedResult,
            IntentKnowledgeBase.VerbNounDisambiguationResult verbNounResult,
            boolean skipPhraseShortcut,
            String businessDomain);

    /**
     * Try LLM Fallback for intent classification.
     */
    IntentMatchResult tryLlmFallback(String userInput, String originalInput,
                                      String factoryId,
                                      List<AIIntentConfig> allIntents,
                                      IntentMatchResult ruleResult,
                                      IntentKnowledgeBase.ActionType actionType,
                                      Long userId, String userRole);

    /**
     * Try LLM Reranking for candidate confirmation.
     */
    IntentMatchResult tryLlmReranking(String userInput, String factoryId,
                                       List<IntentMatchResult.CandidateIntent> candidates,
                                       IntentMatchResult semanticResult,
                                       IntentKnowledgeBase.ActionType actionType,
                                       Long userId, String userRole);

    /**
     * Save intent match record asynchronously.
     */
    void saveIntentMatchRecord(IntentMatchResult result, String factoryId,
                                Long userId, String sessionId, boolean llmCalled);
}
