package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.smartbi.IntentResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.smartbi.enums.SmartBIIntent;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * SmartBI Intent Mapper
 *
 * Converts between SmartBI intent types and AI Chat intent types:
 * - SmartBIIntent enum -> AIIntentConfig (for LLM fallback)
 * - IntentMatchResult (AI Chat) -> IntentResult (SmartBI)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Component
public class SmartBIIntentMapper {

    /**
     * Convert SmartBIIntent enum values to AIIntentConfig list for LLM fallback
     *
     * @param intents Array of SmartBIIntent enums to convert
     * @return List of AIIntentConfig objects for use with LlmIntentFallbackClient
     */
    public List<AIIntentConfig> convertToIntentConfigs(SmartBIIntent[] intents) {
        if (intents == null || intents.length == 0) {
            return new ArrayList<>();
        }
        return Arrays.stream(intents)
                .filter(intent -> intent != SmartBIIntent.UNKNOWN)
                .map(this::toAIIntentConfig)
                .collect(Collectors.toList());
    }

    /**
     * Convert a single SmartBIIntent to AIIntentConfig
     *
     * @param intent SmartBIIntent enum value
     * @return AIIntentConfig object with mapped fields
     */
    public AIIntentConfig toAIIntentConfig(SmartBIIntent intent) {
        return AIIntentConfig.builder()
                .intentCode(intent.getCode())
                .intentName(intent.getName())
                .intentCategory(mapCategoryToIntentCategory(intent.getCategory()))
                .description(buildDescription(intent))
                .sensitivityLevel("LOW")
                .isActive(true)
                .priority(calculatePriority(intent))
                .build();
    }

    /**
     * Convert AI Chat's IntentMatchResult to SmartBI's IntentResult
     *
     * @param matchResult The IntentMatchResult from AI Chat intent recognition
     * @param originalQuery The original user query string
     * @return IntentResult for SmartBI processing
     */
    public IntentResult convertToSmartBIIntentResult(IntentMatchResult matchResult, String originalQuery) {
        if (matchResult == null || matchResult.getBestMatch() == null) {
            return IntentResult.unknown(originalQuery);
        }

        AIIntentConfig bestMatch = matchResult.getBestMatch();
        SmartBIIntent smartBIIntent = findSmartBIIntent(bestMatch.getIntentCode());
        double confidence = matchResult.getConfidence() != null ? matchResult.getConfidence() : 0.0;

        IntentResult.IntentResultBuilder builder = IntentResult.builder()
                .intent(smartBIIntent)
                .confidence(confidence)
                .originalQuery(originalQuery)
                .matchedKeywords(matchResult.getMatchedKeywords() != null
                        ? matchResult.getMatchedKeywords()
                        : new ArrayList<>())
                .matchMethod(mapMatchMethod(matchResult.getMatchMethod()))
                .needsLLMFallback(confidence < 0.7 || smartBIIntent == SmartBIIntent.UNKNOWN);

        // Map candidate intents if available
        if (matchResult.getTopCandidates() != null && !matchResult.getTopCandidates().isEmpty()) {
            List<IntentResult.CandidateIntent> candidates = matchResult.getTopCandidates().stream()
                    .map(this::mapCandidateIntent)
                    .collect(Collectors.toList());
            builder.candidates(candidates);
        }

        return builder.build();
    }

    /**
     * Find SmartBIIntent from intent code string
     *
     * @param intentCode The intent code to look up
     * @return Matching SmartBIIntent or UNKNOWN if not found
     */
    public SmartBIIntent findSmartBIIntent(String intentCode) {
        return SmartBIIntent.fromCode(intentCode);
    }

    // ==================== Private Helper Methods ====================

    private String mapCategoryToIntentCategory(String category) {
        switch (category) {
            case "QUERY":
                return "ANALYSIS";
            case "COMPARE":
                return "ANALYSIS";
            case "DRILL":
                return "ANALYSIS";
            case "FORECAST":
                return "ANALYSIS";
            case "AGGREGATE":
                return "ANALYSIS";
            default:
                return "ANALYSIS";
        }
    }

    private String buildDescription(SmartBIIntent intent) {
        return String.format("SmartBI %s - %s类意图", intent.getName(), intent.getCategory());
    }

    private int calculatePriority(SmartBIIntent intent) {
        // Assign higher priority to more specific intents
        switch (intent.getCategory()) {
            case "QUERY":
                return 50;
            case "COMPARE":
                return 60;
            case "DRILL":
                return 70;
            case "FORECAST":
                return 80;
            case "AGGREGATE":
                return 55;
            default:
                return 0;
        }
    }

    private String mapMatchMethod(IntentMatchResult.MatchMethod matchMethod) {
        if (matchMethod == null) {
            return "UNKNOWN";
        }
        switch (matchMethod) {
            case EXACT:
            case PHRASE_MATCH:
                return "KEYWORD";
            case REGEX:
                return "PATTERN";
            case KEYWORD:
                return "KEYWORD";
            case SEMANTIC:
            case FUSION:
                return "SEMANTIC";
            case LLM:
                return "LLM";
            default:
                return "UNKNOWN";
        }
    }

    private IntentResult.CandidateIntent mapCandidateIntent(IntentMatchResult.CandidateIntent candidate) {
        SmartBIIntent smartBIIntent = findSmartBIIntent(candidate.getIntentCode());
        return IntentResult.CandidateIntent.builder()
                .intent(smartBIIntent)
                .confidence(candidate.getConfidence() != null ? candidate.getConfidence() : 0.0)
                .matchedKeywords(candidate.getMatchedKeywords())
                .build();
    }
}
