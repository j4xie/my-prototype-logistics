package com.cretas.aims.service;

import com.cretas.aims.entity.learning.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Active Learning Service Interface
 *
 * Provides comprehensive active learning capabilities for AI intent recognition:
 * - Low confidence sample collection and clustering
 * - Intent transition probability analysis
 * - Cross-factory knowledge sharing
 * - Learning suggestion generation
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
public interface ActiveLearningService {

    // ==================== Sample Collection ====================

    /**
     * Collect low confidence sample from intent match result
     *
     * @param factoryId Factory ID
     * @param userId User ID
     * @param userInput Original user input
     * @param normalizedInput Normalized input
     * @param matchedIntentCode Matched intent code (may be null)
     * @param confidenceScore Confidence score
     * @param matchMethod Match method used
     * @param topCandidates JSON string of top candidates
     * @param matchedKeywords JSON string of matched keywords
     * @param sourceRecordId Source IntentMatchRecord ID
     * @return Created sample or null if confidence too high
     */
    ActiveLearningSample collectSample(
            String factoryId,
            Long userId,
            String userInput,
            String normalizedInput,
            String matchedIntentCode,
            BigDecimal confidenceScore,
            String matchMethod,
            String topCandidates,
            String matchedKeywords,
            String sourceRecordId);

    /**
     * Get pending samples for factory
     *
     * @param factoryId Factory ID
     * @param limit Maximum samples to return
     * @return List of pending samples
     */
    List<ActiveLearningSample> getPendingSamples(String factoryId, int limit);

    // ==================== Sample Clustering ====================

    /**
     * Cluster pending samples for a factory
     *
     * This method:
     * 1. Retrieves pending samples
     * 2. Calculates similarity (using embeddings if available)
     * 3. Groups similar samples into clusters
     * 4. Updates sample records with cluster assignments
     *
     * @param factoryId Factory ID
     * @return Number of clusters created
     */
    int clusterSamples(String factoryId);

    /**
     * Analyze clusters and generate suggestions
     *
     * @param factoryId Factory ID
     * @param minClusterSize Minimum cluster size to analyze
     * @return List of generated suggestions
     */
    List<LearningSuggestion> analyzeClustersAndGenerateSuggestions(
            String factoryId, int minClusterSize);

    // ==================== Intent Transition ====================

    /**
     * Record intent transition (for Markov chain modeling)
     *
     * @param factoryId Factory ID
     * @param fromIntentCode Previous intent code
     * @param toIntentCode Current intent code
     */
    void recordIntentTransition(
            String factoryId,
            String fromIntentCode,
            String toIntentCode);

    /**
     * Update transition matrix for a factory
     *
     * Recalculates all transition probabilities using Laplace smoothing
     *
     * @param factoryId Factory ID
     * @param windowStart Start of time window
     */
    void updateTransitionMatrix(String factoryId, LocalDate windowStart);

    /**
     * Get transition probability between intents
     *
     * @param factoryId Factory ID
     * @param fromIntentCode Source intent
     * @param toIntentCode Target intent
     * @return Transition probability (0-1)
     */
    BigDecimal getTransitionProbability(
            String factoryId,
            String fromIntentCode,
            String toIntentCode);

    /**
     * Get most likely next intents from a given intent
     *
     * @param factoryId Factory ID
     * @param fromIntentCode Source intent
     * @param topN Number of results
     * @return List of (intent code, probability) pairs
     */
    List<Map.Entry<String, BigDecimal>> getMostLikelyNextIntents(
            String factoryId,
            String fromIntentCode,
            int topN);

    /**
     * Calibrate confidence score using transition probability
     *
     * @param factoryId Factory ID
     * @param previousIntent Previous intent in conversation
     * @param currentIntent Current predicted intent
     * @param originalConfidence Original confidence score
     * @return Calibrated confidence score
     */
    BigDecimal calibrateConfidenceWithTransition(
            String factoryId,
            String previousIntent,
            String currentIntent,
            BigDecimal originalConfidence);

    // ==================== Cross-Factory Knowledge ====================

    /**
     * Register new knowledge from a factory
     *
     * @param factoryId Source factory ID
     * @param knowledgeType Type of knowledge
     * @param intentCode Related intent code
     * @param content Knowledge content
     * @return Created knowledge record
     */
    CrossFactoryKnowledge registerKnowledge(
            String factoryId,
            CrossFactoryKnowledge.KnowledgeType knowledgeType,
            String intentCode,
            String content);

    /**
     * Record feedback for knowledge
     *
     * @param knowledgeId Knowledge ID
     * @param factoryId Factory providing feedback
     * @param isPositive Whether feedback is positive
     */
    void recordKnowledgeFeedback(
            Long knowledgeId,
            String factoryId,
            boolean isPositive);

    /**
     * Check and promote eligible knowledge to global
     *
     * @param minEffectiveness Minimum effectiveness score
     * @param minAdoptions Minimum number of factory adoptions
     * @return Number of promoted knowledge items
     */
    int promoteKnowledgeToGlobal(BigDecimal minEffectiveness, int minAdoptions);

    /**
     * Adopt global knowledge for a factory
     *
     * @param factoryId Factory ID
     * @param knowledgeId Knowledge ID to adopt
     * @return Created adoption record
     */
    CrossFactoryKnowledgeAdoption adoptKnowledge(String factoryId, Long knowledgeId);

    /**
     * Get global knowledge not yet adopted by factory
     *
     * @param factoryId Factory ID
     * @return List of available global knowledge
     */
    List<CrossFactoryKnowledge> getAvailableGlobalKnowledge(String factoryId);

    /**
     * Evaluate keyword effectiveness using Wilson Score
     *
     * @param factoryId Factory ID
     * @return Map of keyword to Wilson Score
     */
    Map<String, BigDecimal> evaluateKeywordEffectiveness(String factoryId);

    // ==================== Learning Suggestions ====================

    /**
     * Get pending suggestions for review
     *
     * @param factoryId Factory ID
     * @param limit Maximum suggestions
     * @return List of pending suggestions
     */
    List<LearningSuggestion> getPendingSuggestions(String factoryId, int limit);

    /**
     * Approve a learning suggestion
     *
     * @param suggestionId Suggestion ID
     * @param reviewer Reviewer username
     * @param notes Review notes
     */
    void approveSuggestion(Long suggestionId, String reviewer, String notes);

    /**
     * Reject a learning suggestion
     *
     * @param suggestionId Suggestion ID
     * @param reviewer Reviewer username
     * @param notes Rejection reason
     */
    void rejectSuggestion(Long suggestionId, String reviewer, String notes);

    /**
     * Apply approved suggestion
     *
     * @param suggestionId Suggestion ID
     * @param applier Person applying
     */
    void applySuggestion(Long suggestionId, String applier);

    // ==================== Model Performance ====================

    /**
     * Log model performance for a period
     *
     * @param factoryId Factory ID
     * @param periodType Period type (HOURLY, DAILY, etc.)
     */
    void logModelPerformance(String factoryId, ModelPerformanceLog.PeriodType periodType);

    /**
     * Get performance trend
     *
     * @param factoryId Factory ID
     * @param periodType Period type
     * @param days Number of days to look back
     * @return List of performance logs
     */
    List<ModelPerformanceLog> getPerformanceTrend(
            String factoryId,
            ModelPerformanceLog.PeriodType periodType,
            int days);

    /**
     * Check if performance is degrading
     *
     * @param factoryId Factory ID
     * @param threshold Degradation threshold (e.g., 0.05 for 5%)
     * @return true if performance is degrading
     */
    boolean isPerformanceDegrading(String factoryId, double threshold);

    // ==================== Annotation Queue ====================

    /**
     * Add sample to annotation queue
     *
     * @param sample Active learning sample
     * @return Created annotation queue item
     */
    AnnotationQueue addToAnnotationQueue(ActiveLearningSample sample);

    /**
     * Assign annotations to annotator
     *
     * @param factoryId Factory ID
     * @param annotator Annotator username
     * @param count Number to assign
     * @return Assigned items
     */
    List<AnnotationQueue> assignAnnotations(String factoryId, String annotator, int count);

    /**
     * Complete annotation
     *
     * @param annotationId Annotation ID
     * @param intentCode Annotated intent code
     * @param annotator Annotator username
     * @param notes Notes
     */
    void completeAnnotation(Long annotationId, String intentCode, String annotator, String notes);

    // ==================== Cleanup Tasks ====================

    /**
     * Clean up old data
     *
     * @param retentionDays Number of days to retain
     * @return Total records deleted
     */
    int cleanupOldData(int retentionDays);

    /**
     * Expire old suggestions
     *
     * @return Number of expired suggestions
     */
    int expireOldSuggestions();
}
