package com.cretas.aims.service.impl;

import com.cretas.aims.dto.intent.IntentFeedbackRequest;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.MultiIntentResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.conversation.ConversationTurn;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.conversation.ConversationStateService;
import com.cretas.aims.service.intent.IntentConfigManagementService;
import com.cretas.aims.service.intent.IntentFeedbackLearningService;
import com.cretas.aims.service.intent.IntentRecognitionPipelineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * AI Intent Service Facade
 *
 * Thin delegation layer that preserves the AIIntentService interface contract.
 * All business logic has been refactored into 6 focused sub-services:
 *
 * 1. IntentRecognitionPipelineService  - orchestrates the recognition flow
 * 2. PhraseMatchingService             - exact/phrase/regex/keyword matching
 * 3. SemanticMatchingService           - embedding/classifier/router/RAG
 * 4. IntentScoringService              - parallel scoring, LLM reranking/fallback
 * 5. IntentConfigManagementService     - CRUD, permissions, quota, cache
 * 6. IntentFeedbackLearningService     - feedback recording, auto-learning
 *
 * The pipeline service internally uses services 2-4 for recognition.
 * This facade only needs to inject the pipeline, config management, and feedback services.
 *
 * @author Cretas Team
 * @version 2.0.0 (Facade pattern refactoring)
 * @since 2025-12-31
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AIIntentServiceImpl implements AIIntentService {

    private final IntentRecognitionPipelineService pipelineService;
    private final IntentConfigManagementService configService;
    private final IntentFeedbackLearningService feedbackService;

    /**
     * P4 Task 4.3: optional conversation context service.
     * Non-final so Spring can inject it independently of @RequiredArgsConstructor.
     * required=false ensures existing tests without a Redis bean still work.
     */
    @Autowired(required = false)
    private ConversationStateService conversationStateService;

    // ==================== Intent Recognition ====================

    /**
     * P4 Task 4.3: recognizeIntent with conversation context support.
     *
     * <p>When userId is non-null AND conversationStateService is available:
     * - Loads recent 3 turns before matching (exposed for future context-aware layers)
     * - Appends the recognized turn after successful dispatch
     *
     * <p>Fail-open: any ConversationStateService exception is swallowed and logged.
     * Intent recognition is the primary concern — context tracking is best-effort.
     *
     * <p>When userId is null or conversationStateService is null, delegates directly
     * to {@link #recognizeIntent(String, String)} — zero-overhead backward compat.
     */
    @Override
    public Optional<AIIntentConfig> recognizeIntent(
            String factoryId, String userInput, String userId) {
        // Fast path: no user ID or no context service → delegate directly
        if (userId == null || conversationStateService == null) {
            return recognizeIntent(factoryId, userInput);
        }

        // Load recent context and feed into LLM prompt via ThreadLocal (best-effort)
        java.util.List<ConversationTurn> recent = java.util.Collections.emptyList();
        try {
            recent = conversationStateService.loadRecent(factoryId, userId, 3);
            if (log.isDebugEnabled()) {
                log.debug("Loaded {} conversation turns for {}/{}",
                        recent.size(), factoryId, userId);
            }
            // P4 Task 4.4: set ThreadLocal so LLM prompt builder can inject conversation history
            LlmIntentFallbackClientImpl.conversationTurnsHolder.set(recent);
        } catch (Exception e) {
            log.warn("Failed to load conversation context for {}/{}, proceeding without: {}",
                    factoryId, userId, e.getMessage());
        }

        // Dispatch through normal intent matching
        Optional<AIIntentConfig> result;
        try {
            result = recognizeIntent(factoryId, userInput);
        } finally {
            // Always clean up ThreadLocal to avoid cross-request leaks
            LlmIntentFallbackClientImpl.conversationTurnsHolder.remove();
        }

        // Append turn on success (best-effort — swallow exceptions)
        if (result.isPresent()) {
            try {
                AIIntentConfig cfg = result.get();
                ConversationTurn turn = new ConversationTurn(
                        userInput,
                        cfg.getIntentCode(),
                        cfg.getToolName(),
                        null,   // skillName — populated by executor later
                        null,   // response  — populated by executor later
                        System.currentTimeMillis()
                );
                conversationStateService.appendTurn(factoryId, userId, turn);
            } catch (Exception e) {
                log.warn("Failed to append conversation turn for {}/{}: {}",
                        factoryId, userId, e.getMessage());
            }
        }

        return result;
    }

    @Override
    public Optional<AIIntentConfig> recognizeIntent(String userInput) {
        return pipelineService.recognizeIntent(userInput);
    }

    @Override
    public Optional<AIIntentConfig> recognizeIntent(String factoryId, String userInput) {
        return pipelineService.recognizeIntent(factoryId, userInput);
    }

    @Override
    public IntentMatchResult recognizeIntentWithConfidence(String userInput, int topN) {
        return pipelineService.recognizeIntentWithConfidence(userInput, null, topN, null, null, null);
    }

    @Override
    public IntentMatchResult recognizeIntentWithConfidence(String userInput, String factoryId,
                                                            int topN, Long userId, String userRole) {
        return pipelineService.recognizeIntentWithConfidence(userInput, factoryId, topN, userId, userRole, null);
    }

    @Override
    public IntentMatchResult recognizeIntentWithConfidence(String userInput, String factoryId, int topN,
                                                            Long userId, String userRole, String sessionId) {
        return pipelineService.recognizeIntentWithConfidence(userInput, factoryId, topN, userId, userRole, sessionId);
    }

    // ==================== Multi-Intent Recognition ====================

    @Override
    public MultiIntentResult recognizeMultiIntent(String userInput, String factoryId) {
        return pipelineService.recognizeMultiIntent(userInput, factoryId);
    }

    @Override
    public MultiIntentResult recognizeMultiIntent(String userInput, String factoryId, double threshold) {
        return pipelineService.recognizeMultiIntent(userInput, factoryId, threshold);
    }

    @Override
    public List<AIIntentConfig> recognizeAllIntents(String factoryId, String userInput) {
        return pipelineService.recognizeAllIntents(factoryId, userInput);
    }

    @Override
    @Deprecated
    public List<AIIntentConfig> recognizeAllIntents(String userInput) {
        return pipelineService.recognizeAllIntents(userInput);
    }

    // ==================== Intent Queries ====================

    @Override
    public Optional<AIIntentConfig> getIntentByCode(String factoryId, String intentCode) {
        return configService.getIntentByCode(factoryId, intentCode);
    }

    @Override
    @Deprecated
    public Optional<AIIntentConfig> getIntentByCode(String intentCode) {
        return configService.getIntentByCode(intentCode);
    }

    @Override
    public List<AIIntentConfig> getAllIntents(String factoryId) {
        return configService.getAllIntents(factoryId);
    }

    @Override
    @Deprecated
    public List<AIIntentConfig> getAllIntents() {
        return configService.getAllIntents();
    }

    @Override
    public List<AIIntentConfig> getIntentsByCategory(String factoryId, String category) {
        return configService.getIntentsByCategory(factoryId, category);
    }

    @Override
    @Deprecated
    public List<AIIntentConfig> getIntentsByCategory(String category) {
        return configService.getIntentsByCategory(category);
    }

    @Override
    public List<AIIntentConfig> getIntentsBySensitivity(String factoryId, String sensitivityLevel) {
        return configService.getIntentsBySensitivity(factoryId, sensitivityLevel);
    }

    @Override
    @Deprecated
    public List<AIIntentConfig> getIntentsBySensitivity(String sensitivityLevel) {
        return configService.getIntentsBySensitivity(sensitivityLevel);
    }

    @Override
    public List<String> getAllCategories(String factoryId) {
        return configService.getAllCategories(factoryId);
    }

    @Override
    @Deprecated
    public List<String> getAllCategories() {
        return configService.getAllCategories();
    }

    // ==================== Permission & Quota ====================

    @Override
    public boolean hasPermission(String factoryId, String intentCode, String userRole) {
        return configService.hasPermission(factoryId, intentCode, userRole);
    }

    @Override
    @Deprecated
    public boolean hasPermission(String intentCode, String userRole) {
        return configService.hasPermission(intentCode, userRole);
    }

    @Override
    public boolean requiresApproval(String factoryId, String intentCode) {
        return configService.requiresApproval(factoryId, intentCode);
    }

    @Override
    @Deprecated
    public boolean requiresApproval(String intentCode) {
        return configService.requiresApproval(intentCode);
    }

    @Override
    public Optional<String> getApprovalChainId(String factoryId, String intentCode) {
        return configService.getApprovalChainId(factoryId, intentCode);
    }

    @Override
    @Deprecated
    public Optional<String> getApprovalChainId(String intentCode) {
        return configService.getApprovalChainId(intentCode);
    }

    @Override
    public int getQuotaCost(String factoryId, String intentCode) {
        return configService.getQuotaCost(factoryId, intentCode);
    }

    @Override
    @Deprecated
    public int getQuotaCost(String intentCode) {
        return configService.getQuotaCost(intentCode);
    }

    @Override
    public int getCacheTtl(String factoryId, String intentCode) {
        return configService.getCacheTtl(factoryId, intentCode);
    }

    @Override
    @Deprecated
    public int getCacheTtl(String intentCode) {
        return configService.getCacheTtl(intentCode);
    }

    // ==================== Intent Management ====================

    @Override
    public AIIntentConfig createIntent(AIIntentConfig intentConfig) {
        return configService.createIntent(intentConfig);
    }

    @Override
    public AIIntentConfig updateIntent(AIIntentConfig intentConfig) {
        return configService.updateIntent(intentConfig);
    }

    @Override
    public void deleteIntent(String intentCode) {
        configService.deleteIntent(intentCode);
    }

    @Override
    public void setIntentActive(String intentCode, boolean active) {
        configService.setIntentActive(intentCode, active);
    }

    // ==================== Cache Management ====================

    @Override
    public void clearCache() {
        configService.clearCache();
    }

    @Override
    public void refreshCache() {
        configService.refreshCache();
    }

    // ==================== Feedback ====================

    @Override
    public void recordPositiveFeedback(String factoryId, String intentCode, List<String> matchedKeywords) {
        feedbackService.recordPositiveFeedback(factoryId, intentCode, matchedKeywords);
    }

    @Override
    public void recordNegativeFeedback(String factoryId, String rejectedIntentCode,
                                        String selectedIntentCode, List<String> matchedKeywords) {
        feedbackService.recordNegativeFeedback(factoryId, rejectedIntentCode,
                selectedIntentCode, matchedKeywords);
    }

    @Override
    public void processIntentFeedback(String factoryId, Long userId, IntentFeedbackRequest request) {
        feedbackService.processIntentFeedback(factoryId, userId, request);
    }
}
