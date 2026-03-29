package com.cretas.aims.service.intent;

import com.cretas.aims.config.IntentKnowledgeBase;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;

import java.util.List;
import java.util.Optional;

/**
 * Phrase Matching Service
 *
 * Handles Layer 0 (exact match) and Layer 1 (phrase match):
 * - Filler-word stripping
 * - Exact phrase matching via IntentKnowledgeBase
 * - Regex matching
 * - Keyword scoring
 * - Write-operation verb detection & override
 * - Multi-intent trigger detection
 * - Vague input detection
 * - Negation intent conversion
 *
 * @author Cretas Team
 * @version 2.0.0 (refactored from AIIntentServiceImpl)
 */
public interface PhraseMatchingService {

    /**
     * Try phrase match shortcut (early return if high-confidence phrase match found).
     * Returns a result if phrase match succeeds; null if no phrase match.
     */
    IntentMatchResult tryPhraseMatchShortcut(String userInput, String originalInput,
                                              String factoryId, String businessDomain,
                                              IntentKnowledgeBase.VerbNounDisambiguationResult verbNounResult,
                                              Object enhancedResult, Object preprocessedQuery);

    /**
     * Check and handle vague/ambiguous input before matching.
     * Returns a clarification result if input is too vague; null otherwise.
     */
    IntentMatchResult checkAndHandleVagueInput(String userInput, String factoryId,
                                                Long userId, String sessionId);

    /**
     * Detect multi-intent trigger words in user input.
     */
    boolean containsMultiIntentTrigger(String userInput);

    /**
     * Filter filler words prefix from input to improve phrase matching.
     * "帮我查一下库存" -> "库存"
     */
    String filterFillerWordsForPhrase(String input);

    /**
     * Strip HTML/XSS tags from input.
     */
    String stripHtmlTags(String input);

    /**
     * Match by regex pattern on an intent config.
     */
    boolean matchesByRegex(AIIntentConfig intent, String input);

    /**
     * Calculate keyword match score for an intent.
     */
    int calculateKeywordMatchScore(AIIntentConfig intent, String input, String factoryId);

    /**
     * Calculate keyword match score (no factory, backward-compat).
     */
    int calculateKeywordMatchScore(AIIntentConfig intent, String input);

    /**
     * Get matched keywords for an intent and input.
     */
    List<String> getMatchedKeywords(AIIntentConfig intent, String input, String factoryId);

    /**
     * Negation intent conversion (v7.5).
     */
    String convertNegationIntent(String intentCode, boolean hasNegation);

    /**
     * Apply negation conversion to an existing IntentMatchResult.
     */
    IntentMatchResult applyNegationConversion(IntentMatchResult result, Object enhancedResult, String factoryId);

    /**
     * Try verb-aware override for phrase-matched intent.
     */
    String tryVerbAwareOverride(String matchedIntentCode, String userInput, List<AIIntentConfig> allIntents);

    /**
     * Detect write-operation verb-noun shortcut (v22.0).
     */
    IntentMatchResult tryWriteOperationShortcut(String userInput, String factoryId,
                                                 IntentKnowledgeBase.VerbNounDisambiguationResult verbNounResult,
                                                 Object preprocessedQuery);
}
