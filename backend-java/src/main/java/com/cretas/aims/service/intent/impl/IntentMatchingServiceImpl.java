package com.cretas.aims.service.intent.impl;

import com.cretas.aims.config.IntentKnowledgeBase;
import com.cretas.aims.config.IntentMatchingConfig;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.MultiIntentResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.IntentEmbeddingCacheService;
import com.cretas.aims.service.KeywordEffectivenessService;
import com.cretas.aims.service.LlmIntentFallbackClient;
import com.cretas.aims.service.MultiLabelIntentClassifier;
import com.cretas.aims.service.QueryPreprocessorService;
import com.cretas.aims.service.TwoStageIntentClassifier;
import com.cretas.aims.service.intent.IntentConfigService;
import com.cretas.aims.service.intent.IntentMatchingService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 意图匹配服务实现
 *
 * 核心意图识别逻辑，包含多层匹配算法
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service("intentMatchingServiceImpl")
@RequiredArgsConstructor
public class IntentMatchingServiceImpl implements IntentMatchingService {

    private final AIIntentConfigRepository intentRepository;
    private final IntentConfigService intentConfigService;
    private final ObjectMapper objectMapper;
    private final LlmIntentFallbackClient llmFallbackClient;
    private final KeywordEffectivenessService keywordEffectivenessService;
    private final IntentEmbeddingCacheService embeddingCacheService;
    private final IntentMatchingConfig matchingConfig;
    private final IntentKnowledgeBase knowledgeBase;
    private final TwoStageIntentClassifier twoStageIntentClassifier;
    private final MultiLabelIntentClassifier multiLabelIntentClassifier;
    private final QueryPreprocessorService queryPreprocessorService;

    @Value("${cretas.ai.preprocess.enabled:true}")
    private boolean preprocessEnabled;

    @Override
    public Optional<AIIntentConfig> recognizeIntent(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return Optional.empty();
        }

        List<AIIntentConfig> allIntents = intentConfigService.getAllIntents();
        String normalizedInput = userInput.toLowerCase().trim();

        // 优先使用正则匹配
        for (AIIntentConfig intent : allIntents) {
            if (matchesByRegex(intent, normalizedInput)) {
                log.debug("Intent matched by regex: {} for input: {}", intent.getIntentCode(), userInput);
                return Optional.of(intent);
            }
        }

        // 然后使用关键词匹配
        List<AIIntentConfig> keywordMatches = new ArrayList<>();
        for (AIIntentConfig intent : allIntents) {
            int matchScore = calculateKeywordMatchScore(intent, normalizedInput);
            if (matchScore > 0) {
                keywordMatches.add(intent);
            }
        }

        if (!keywordMatches.isEmpty()) {
            String finalNormalizedInput = normalizedInput;
            keywordMatches.sort((a, b) -> {
                int priorityCompare = b.getPriority().compareTo(a.getPriority());
                if (priorityCompare != 0) return priorityCompare;
                return calculateKeywordMatchScore(b, finalNormalizedInput) -
                       calculateKeywordMatchScore(a, finalNormalizedInput);
            });
            AIIntentConfig bestMatch = keywordMatches.get(0);
            log.debug("Intent matched by keywords: {} for input: {}", bestMatch.getIntentCode(), userInput);
            return Optional.of(bestMatch);
        }

        log.debug("No intent matched for input: {}", userInput);
        return Optional.empty();
    }

    @Override
    public Optional<AIIntentConfig> recognizeIntent(String factoryId, String userInput) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("recognizeIntent called without factoryId, returning empty");
            return Optional.empty();
        }
        if (userInput == null || userInput.trim().isEmpty()) {
            return Optional.empty();
        }

        List<AIIntentConfig> allIntents = intentConfigService.getAllIntents(factoryId);
        String normalizedInput = userInput.toLowerCase().trim();

        // 优先使用正则匹配
        for (AIIntentConfig intent : allIntents) {
            if (matchesByRegex(intent, normalizedInput)) {
                log.debug("Intent matched by regex: {} for input: {} (factoryId: {})",
                         intent.getIntentCode(), userInput, factoryId);
                return Optional.of(intent);
            }
        }

        // 然后使用关键词匹配
        List<AIIntentConfig> keywordMatches = new ArrayList<>();
        for (AIIntentConfig intent : allIntents) {
            int matchScore = calculateKeywordMatchScore(intent, normalizedInput);
            if (matchScore > 0) {
                keywordMatches.add(intent);
            }
        }

        if (!keywordMatches.isEmpty()) {
            String finalNormalizedInput = normalizedInput;
            keywordMatches.sort((a, b) -> {
                int priorityCompare = b.getPriority().compareTo(a.getPriority());
                if (priorityCompare != 0) return priorityCompare;
                return calculateKeywordMatchScore(b, finalNormalizedInput) -
                       calculateKeywordMatchScore(a, finalNormalizedInput);
            });
            AIIntentConfig bestMatch = keywordMatches.get(0);
            log.debug("Intent matched by keywords: {} for input: {} (factoryId: {})",
                     bestMatch.getIntentCode(), userInput, factoryId);
            return Optional.of(bestMatch);
        }

        log.debug("No intent matched for input: {} (factoryId: {})", userInput, factoryId);
        return Optional.empty();
    }

    @Override
    public List<AIIntentConfig> recognizeAllIntents(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return Collections.emptyList();
        }

        List<AIIntentConfig> allIntents = intentConfigService.getAllIntents();
        String normalizedInput = userInput.toLowerCase().trim();

        return allIntents.stream()
                .filter(intent -> matchesByRegex(intent, normalizedInput) ||
                                  calculateKeywordMatchScore(intent, normalizedInput) > 0)
                .sorted(Comparator.comparing(AIIntentConfig::getPriority).reversed())
                .collect(Collectors.toList());
    }

    @Override
    public List<AIIntentConfig> recognizeAllIntents(String factoryId, String userInput) {
        if (factoryId == null || factoryId.isBlank()) {
            log.warn("recognizeAllIntents called without factoryId, returning empty list");
            return Collections.emptyList();
        }
        if (userInput == null || userInput.trim().isEmpty()) {
            return Collections.emptyList();
        }

        List<AIIntentConfig> allIntents = intentConfigService.getAllIntents(factoryId);
        String normalizedInput = userInput.toLowerCase().trim();

        List<AIIntentConfig> matches = allIntents.stream()
                .filter(intent -> matchesByRegex(intent, normalizedInput) ||
                                  calculateKeywordMatchScore(intent, normalizedInput) > 0)
                .sorted(Comparator.comparing(AIIntentConfig::getPriority).reversed())
                .collect(Collectors.toList());

        log.debug("Found {} matching intents for input: {} (factoryId: {})",
                 matches.size(), userInput, factoryId);
        return matches;
    }

    @Override
    public IntentMatchResult recognizeIntentWithConfidence(String userInput, int topN) {
        return recognizeIntentWithConfidence(userInput, null, topN, null, null, null);
    }

    @Override
    public IntentMatchResult recognizeIntentWithConfidence(String userInput, String factoryId,
                                                            int topN, Long userId, String userRole) {
        return recognizeIntentWithConfidence(userInput, factoryId, topN, userId, userRole, null);
    }

    @Override
    public IntentMatchResult recognizeIntentWithConfidence(String userInput, String factoryId, int topN,
                                                            Long userId, String userRole, String sessionId) {
        if (userInput == null || userInput.trim().isEmpty()) {
            return IntentMatchResult.empty(userInput);
        }

        // 获取所有意图
        List<AIIntentConfig> allIntents = factoryId != null && !factoryId.isBlank()
                ? intentConfigService.getAllIntents(factoryId)
                : intentConfigService.getAllIntents();

        String normalizedInput = userInput.toLowerCase().trim();

        // 使用两阶段分类器
        try {
            TwoStageIntentClassifier.TwoStageResult twoStageResult =
                    twoStageIntentClassifier.classify(normalizedInput);

            if (twoStageResult.isSuccessful() && twoStageResult.getConfidence() >= 0.85) {
                String composedIntent = twoStageResult.getComposedIntent();
                Optional<AIIntentConfig> intentOpt = allIntents.stream()
                        .filter(i -> i.getIntentCode().equals(composedIntent))
                        .findFirst();

                if (intentOpt.isPresent()) {
                    AIIntentConfig intent = intentOpt.get();
                    log.info("Two-stage classifier matched: intent={}, confidence={}",
                            composedIntent, twoStageResult.getConfidence());

                    return IntentMatchResult.builder()
                            .bestMatch(intent)
                            .topCandidates(Collections.singletonList(
                                    IntentMatchResult.CandidateIntent.fromConfig(
                                            intent, twoStageResult.getConfidence(), 95,
                                            Collections.emptyList(),
                                            IntentMatchResult.MatchMethod.SEMANTIC)))
                            .confidence(twoStageResult.getConfidence())
                            .matchMethod(IntentMatchResult.MatchMethod.SEMANTIC)
                            .matchedKeywords(Collections.emptyList())
                            .isStrongSignal(true)
                            .requiresConfirmation(twoStageResult.getConfidence() < 0.90)
                            .userInput(userInput)
                            .build();
                }
            }
        } catch (Exception e) {
            log.warn("Two-stage classifier failed: {}", e.getMessage());
        }

        // 回退到关键词匹配
        List<IntentMatchResult.CandidateIntent> candidates = new ArrayList<>();
        for (AIIntentConfig intent : allIntents) {
            int matchScore = calculateKeywordMatchScore(intent, normalizedInput);
            if (matchScore > 0) {
                candidates.add(IntentMatchResult.CandidateIntent.builder()
                        .intentCode(intent.getIntentCode())
                        .intentName(intent.getIntentName())
                        .intentCategory(intent.getIntentCategory())
                        .confidence(matchScore / 100.0)
                        .matchScore(matchScore)
                        .matchedKeywords(Collections.emptyList())
                        .matchMethod(IntentMatchResult.MatchMethod.KEYWORD)
                        .description(intent.getDescription())
                        .build());
            }
        }

        if (candidates.isEmpty()) {
            return IntentMatchResult.empty(userInput);
        }

        // 排序并选择最佳
        candidates.sort((a, b) -> Double.compare(b.getConfidence(), a.getConfidence()));
        List<IntentMatchResult.CandidateIntent> topCandidates = candidates.stream()
                .limit(topN)
                .collect(Collectors.toList());

        IntentMatchResult.CandidateIntent best = topCandidates.get(0);
        AIIntentConfig bestConfig = intentConfigService.getIntentConfigByCode(factoryId, best.getIntentCode());

        return IntentMatchResult.builder()
                .bestMatch(bestConfig)
                .topCandidates(topCandidates)
                .confidence(best.getConfidence())
                .matchMethod(IntentMatchResult.MatchMethod.KEYWORD)
                .matchedKeywords(best.getMatchedKeywords())
                .isStrongSignal(best.getConfidence() >= 0.75)
                .requiresConfirmation(best.getConfidence() < 0.75)
                .userInput(userInput)
                .build();
    }

    @Override
    public MultiIntentResult recognizeMultiIntent(String factoryId, String userInput,
                                                   Long userId, String userRole, String sessionId) {
        // 使用多标签分类器
        try {
            return multiLabelIntentClassifier.classify(factoryId, userInput, userId, userRole, sessionId);
        } catch (Exception e) {
            log.warn("Multi-intent recognition failed: {}", e.getMessage());
            return MultiIntentResult.empty(userInput);
        }
    }

    @Override
    public boolean matchesByRegex(AIIntentConfig intent, String input) {
        String regexPattern = intent.getRegexPattern();
        if (regexPattern == null || regexPattern.isEmpty()) {
            return false;
        }

        try {
            Pattern pattern = Pattern.compile(regexPattern, Pattern.CASE_INSENSITIVE);
            return pattern.matcher(input).find();
        } catch (Exception e) {
            log.warn("Invalid regex pattern for intent {}: {}", intent.getIntentCode(), e.getMessage());
            return false;
        }
    }

    @Override
    public int calculateKeywordMatchScore(AIIntentConfig intent, String input) {
        String keywordsJson = intent.getKeywords();
        if (keywordsJson == null || keywordsJson.isEmpty()) {
            return 0;
        }

        try {
            List<String> keywords = objectMapper.readValue(keywordsJson, new TypeReference<List<String>>() {});
            int score = 0;
            String lowerInput = input.toLowerCase();

            for (String keyword : keywords) {
                if (lowerInput.contains(keyword.toLowerCase())) {
                    score += 20; // 每个关键词20分
                }
            }

            return Math.min(100, score);
        } catch (Exception e) {
            log.warn("Failed to parse keywords for intent {}: {}", intent.getIntentCode(), e.getMessage());
            return 0;
        }
    }
}
