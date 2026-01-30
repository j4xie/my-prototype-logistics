package com.cretas.aims.service.impl;

import com.cretas.aims.entity.intent.IntentMatchRecord;
import com.cretas.aims.entity.learning.*;
import com.cretas.aims.repository.IntentMatchRecordRepository;
import com.cretas.aims.repository.learning.*;
import com.cretas.aims.service.ActiveLearningService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Active Learning Service Implementation
 *
 * Implements comprehensive active learning system for AI intent recognition:
 * - Collects low confidence samples for analysis
 * - Clusters similar inputs to discover patterns
 * - Tracks intent transitions for confidence calibration
 * - Manages cross-factory knowledge sharing
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ActiveLearningServiceImpl implements ActiveLearningService {

    private final ActiveLearningSampleRepository sampleRepository;
    private final IntentTransitionMatrixRepository transitionRepository;
    private final CrossFactoryKnowledgeRepository knowledgeRepository;
    private final CrossFactoryKnowledgeAdoptionRepository adoptionRepository;
    private final LearningTaskRepository taskRepository;
    private final ModelPerformanceLogRepository performanceRepository;
    private final AnnotationQueueRepository annotationRepository;
    private final LearningSuggestionRepository suggestionRepository;
    private final SampleClusterRepository clusterRepository;
    private final IntentMatchRecordRepository matchRecordRepository;
    private final ObjectMapper objectMapper;

    @Value("${cretas.ai.active-learning.confidence-threshold:0.7}")
    private BigDecimal confidenceThreshold;

    @Value("${cretas.ai.active-learning.min-cluster-size:5}")
    private int minClusterSize;

    @Value("${cretas.ai.active-learning.transition-smoothing:1.0}")
    private double laplaceSmoothingAlpha;

    // ==================== Sample Collection ====================

    @Override
    @Transactional
    public ActiveLearningSample collectSample(
            String factoryId,
            Long userId,
            String userInput,
            String normalizedInput,
            String matchedIntentCode,
            BigDecimal confidenceScore,
            String matchMethod,
            String topCandidates,
            String matchedKeywords,
            String sourceRecordId) {

        // Only collect low confidence samples
        if (confidenceScore != null && confidenceScore.compareTo(confidenceThreshold) >= 0) {
            return null;
        }

        // Check if already collected
        if (sourceRecordId != null && sampleRepository.existsBySourceRecordId(sourceRecordId)) {
            log.debug("Sample already exists for record: {}", sourceRecordId);
            return null;
        }

        ActiveLearningSample sample = ActiveLearningSample.builder()
                .factoryId(factoryId)
                .userId(userId)
                .userInput(userInput)
                .normalizedInput(normalizedInput)
                .matchedIntentCode(matchedIntentCode)
                .confidenceScore(confidenceScore != null ? confidenceScore : BigDecimal.ZERO)
                .matchMethod(matchMethod)
                .topCandidates(topCandidates)
                .matchedKeywords(matchedKeywords)
                .sourceRecordId(sourceRecordId)
                .learningStatus(ActiveLearningSample.LearningStatus.PENDING)
                .build();

        sample = sampleRepository.save(sample);
        log.info("Collected low confidence sample: factory={}, confidence={}, input={}",
                factoryId, confidenceScore, truncate(userInput, 50));

        return sample;
    }

    @Override
    public List<ActiveLearningSample> getPendingSamples(String factoryId, int limit) {
        return sampleRepository.findPendingForClustering(factoryId, PageRequest.of(0, limit));
    }

    // ==================== Sample Clustering ====================

    @Override
    @Transactional
    public int clusterSamples(String factoryId) {
        log.info("Starting sample clustering for factory: {}", factoryId);

        List<ActiveLearningSample> pendingSamples = sampleRepository
                .findPendingForClustering(factoryId, PageRequest.of(0, 500));

        if (pendingSamples.size() < minClusterSize) {
            log.info("Not enough samples for clustering: {} < {}", pendingSamples.size(), minClusterSize);
            return 0;
        }

        // Simple text-based clustering using Jaccard similarity
        // In production, use embedding-based clustering
        Map<String, List<ActiveLearningSample>> clusters = performSimpleClustering(pendingSamples);

        int clusterCount = 0;
        for (Map.Entry<String, List<ActiveLearningSample>> entry : clusters.entrySet()) {
            List<ActiveLearningSample> clusterSamples = entry.getValue();
            if (clusterSamples.size() < minClusterSize) {
                continue;
            }

            String clusterId = "cluster_" + factoryId + "_" + System.currentTimeMillis() + "_" + clusterCount;
            String representativeSample = findRepresentativeSample(clusterSamples);

            // Create cluster record
            SampleCluster cluster = SampleCluster.createNew(
                    factoryId, clusterId, representativeSample, clusterSamples.size());

            // Calculate cluster statistics
            BigDecimal avgConfidence = calculateAverageConfidence(clusterSamples);
            Map<String, Integer> intentDistribution = calculateIntentDistribution(clusterSamples);
            String dominantIntent = findDominantIntent(intentDistribution);
            BigDecimal dominantRatio = calculateDominantRatio(intentDistribution, clusterSamples.size());

            cluster.setAvgConfidence(avgConfidence);
            cluster.setDominantIntentCode(dominantIntent);
            cluster.setDominantIntentRatio(dominantRatio);
            cluster.setIntentDistribution(toJson(intentDistribution));
            cluster.setCommonKeywords(extractCommonKeywords(clusterSamples));

            clusterRepository.save(cluster);

            // Update samples with cluster assignment
            List<Long> sampleIds = clusterSamples.stream()
                    .map(ActiveLearningSample::getId)
                    .collect(Collectors.toList());
            sampleRepository.updateClusterAssignment(
                    sampleIds, clusterId, representativeSample, LocalDateTime.now());

            clusterCount++;
            log.info("Created cluster: id={}, size={}, avgConfidence={}, dominantIntent={}",
                    clusterId, clusterSamples.size(), avgConfidence, dominantIntent);
        }

        log.info("Clustering complete: {} clusters created from {} samples",
                clusterCount, pendingSamples.size());
        return clusterCount;
    }

    @Override
    @Transactional
    public List<LearningSuggestion> analyzeClustersAndGenerateSuggestions(
            String factoryId, int minClusterSize) {

        List<SampleCluster> clusters = clusterRepository
                .findSignificantClusters(factoryId, minClusterSize);

        List<LearningSuggestion> suggestions = new ArrayList<>();

        for (SampleCluster cluster : clusters) {
            // Generate suggestions based on cluster characteristics
            if (cluster.hasClearDominantIntent(0.7)) {
                // Cluster has clear intent - suggest new keyword/expression
                LearningSuggestion suggestion = generateKeywordSuggestion(cluster);
                if (suggestion != null && !isDuplicateSuggestion(suggestion)) {
                    suggestions.add(suggestionRepository.save(suggestion));
                }
            } else if (cluster.isAmbiguous(0.5)) {
                // Ambiguous cluster - may need new intent or clarification
                LearningSuggestion suggestion = generateNewIntentSuggestion(cluster);
                if (suggestion != null && !isDuplicateSuggestion(suggestion)) {
                    suggestions.add(suggestionRepository.save(suggestion));
                }
            }

            // Mark cluster as analyzed
            cluster.markAnalyzed();
            clusterRepository.save(cluster);
        }

        log.info("Generated {} suggestions from {} clusters for factory {}",
                suggestions.size(), clusters.size(), factoryId);
        return suggestions;
    }

    // ==================== Intent Transition ====================

    @Override
    @Transactional
    public void recordIntentTransition(
            String factoryId,
            String fromIntentCode,
            String toIntentCode) {

        if (fromIntentCode == null || toIntentCode == null) {
            return;
        }

        LocalDate windowStart = LocalDate.now().withDayOfMonth(1); // Monthly window
        LocalDate windowEnd = windowStart.plusMonths(1);

        Optional<IntentTransitionMatrix> existing = transitionRepository
                .findByFactoryIdAndFromIntentCodeAndToIntentCodeAndWindowStart(
                        factoryId, fromIntentCode, toIntentCode, windowStart);

        if (existing.isPresent()) {
            transitionRepository.incrementTransitionCount(
                    factoryId, fromIntentCode, toIntentCode, windowStart);
        } else {
            IntentTransitionMatrix newTransition = IntentTransitionMatrix.createNew(
                    factoryId, fromIntentCode, toIntentCode, windowStart, windowEnd);
            transitionRepository.save(newTransition);
        }

        log.debug("Recorded transition: {} -> {} for factory {}", fromIntentCode, toIntentCode, factoryId);
    }

    @Override
    @Transactional
    public void updateTransitionMatrix(String factoryId, LocalDate windowStart) {
        log.info("Updating transition matrix for factory: {}, window: {}", factoryId, windowStart);

        // Get all distinct source intents
        List<String> sourceIntents = transitionRepository.findDistinctSourceIntents(factoryId, windowStart);

        // Get vocabulary size for Laplace smoothing
        Set<String> allIntents = new HashSet<>(sourceIntents);
        allIntents.addAll(transitionRepository.findDistinctTargetIntents(factoryId, windowStart));
        int vocabularySize = Math.max(allIntents.size(), 1);

        // Update total counts and probabilities for each source intent
        for (String fromIntent : sourceIntents) {
            Integer totalCount = transitionRepository.getTotalTransitionsFrom(
                    factoryId, fromIntent, windowStart);
            if (totalCount == null) totalCount = 0;

            transitionRepository.updateTotalFromCount(factoryId, fromIntent, totalCount, windowStart);

            // Recalculate probabilities for all transitions from this intent
            List<IntentTransitionMatrix> transitions = transitionRepository
                    .findByFactoryIdAndFromIntentCodeAndWindowStart(factoryId, fromIntent, windowStart);

            for (IntentTransitionMatrix transition : transitions) {
                transition.calculateProbability(vocabularySize);
                transitionRepository.save(transition);
            }
        }

        log.info("Transition matrix updated: {} source intents, {} vocabulary size",
                sourceIntents.size(), vocabularySize);
    }

    @Override
    public BigDecimal getTransitionProbability(
            String factoryId,
            String fromIntentCode,
            String toIntentCode) {

        LocalDate windowStart = LocalDate.now().withDayOfMonth(1);

        return transitionRepository
                .findByFactoryIdAndFromIntentCodeAndToIntentCodeAndWindowStart(
                        factoryId, fromIntentCode, toIntentCode, windowStart)
                .map(IntentTransitionMatrix::getTransitionProbability)
                .orElse(BigDecimal.ZERO);
    }

    @Override
    public List<Map.Entry<String, BigDecimal>> getMostLikelyNextIntents(
            String factoryId,
            String fromIntentCode,
            int topN) {

        LocalDate windowStart = LocalDate.now().withDayOfMonth(1);

        List<IntentTransitionMatrix> transitions = transitionRepository
                .findMostLikelyNextIntents(factoryId, fromIntentCode, windowStart);

        return transitions.stream()
                .limit(topN)
                .map(t -> Map.entry(t.getToIntentCode(), t.getTransitionProbability()))
                .collect(Collectors.toList());
    }

    @Override
    public BigDecimal calibrateConfidenceWithTransition(
            String factoryId,
            String previousIntent,
            String currentIntent,
            BigDecimal originalConfidence) {

        if (previousIntent == null || originalConfidence == null) {
            return originalConfidence;
        }

        BigDecimal transitionProb = getTransitionProbability(factoryId, previousIntent, currentIntent);

        // Bayesian update: combine original confidence with transition probability
        // P(intent|input,context) = P(intent|input) * P(intent|previous) / Z
        // Simplified: weighted average with transition as a boost/penalty
        double original = originalConfidence.doubleValue();
        double transition = transitionProb.doubleValue();

        // Weight transition probability as 20% of the final score
        double calibrated = original * 0.8 + transition * 0.2;

        // Ensure bounds
        calibrated = Math.max(0, Math.min(1, calibrated));

        return BigDecimal.valueOf(calibrated).setScale(4, RoundingMode.HALF_UP);
    }

    // ==================== Cross-Factory Knowledge ====================

    @Override
    @Transactional
    public CrossFactoryKnowledge registerKnowledge(
            String factoryId,
            CrossFactoryKnowledge.KnowledgeType knowledgeType,
            String intentCode,
            String content) {

        CrossFactoryKnowledge knowledge = CrossFactoryKnowledge.builder()
                .knowledgeType(knowledgeType)
                .intentCode(intentCode)
                .content(content)
                .sourceFactoryId(factoryId)
                .promotionStatus(CrossFactoryKnowledge.PromotionStatus.LOCAL)
                .build();

        // Calculate hash before saving
        knowledge.setContentHash(knowledge.calculateContentHash());

        // Check for existing
        Optional<CrossFactoryKnowledge> existing = knowledgeRepository
                .findByKnowledgeTypeAndIntentCodeAndContentHash(
                        knowledgeType, intentCode, knowledge.getContentHash());

        if (existing.isPresent()) {
            CrossFactoryKnowledge existingKnowledge = existing.get();
            existingKnowledge.incrementAdoption();
            return knowledgeRepository.save(existingKnowledge);
        }

        knowledge = knowledgeRepository.save(knowledge);

        // Create self-adoption for source factory
        CrossFactoryKnowledgeAdoption adoption = CrossFactoryKnowledgeAdoption.createNew(
                knowledge.getId(), factoryId);
        adoptionRepository.save(adoption);

        log.info("Registered new knowledge: type={}, intent={}, content={}",
                knowledgeType, intentCode, truncate(content, 50));
        return knowledge;
    }

    @Override
    @Transactional
    public void recordKnowledgeFeedback(Long knowledgeId, String factoryId, boolean isPositive) {
        // Update global knowledge
        CrossFactoryKnowledge knowledge = knowledgeRepository.findById(knowledgeId).orElse(null);
        if (knowledge == null) {
            return;
        }

        if (isPositive) {
            knowledge.recordPositiveFeedback();
        } else {
            knowledge.recordNegativeFeedback();
        }
        knowledgeRepository.save(knowledge);

        // Update factory-level adoption
        Optional<CrossFactoryKnowledgeAdoption> adoption = adoptionRepository
                .findByKnowledgeIdAndFactoryId(knowledgeId, factoryId);

        if (adoption.isPresent()) {
            CrossFactoryKnowledgeAdoption record = adoption.get();
            if (isPositive) {
                record.recordPositiveFeedback();
            } else {
                record.recordNegativeFeedback();
            }
            adoptionRepository.save(record);
        }
    }

    @Override
    @Transactional
    public int promoteKnowledgeToGlobal(BigDecimal minEffectiveness, int minAdoptions) {
        List<CrossFactoryKnowledge> candidates = knowledgeRepository
                .findPromotionCandidates(minEffectiveness, minAdoptions);

        int promoted = 0;
        for (CrossFactoryKnowledge knowledge : candidates) {
            knowledge.promoteToGlobal();
            knowledgeRepository.save(knowledge);
            promoted++;
            log.info("Promoted knowledge to global: id={}, type={}, intent={}",
                    knowledge.getId(), knowledge.getKnowledgeType(), knowledge.getIntentCode());
        }

        return promoted;
    }

    @Override
    @Transactional
    public CrossFactoryKnowledgeAdoption adoptKnowledge(String factoryId, Long knowledgeId) {
        // Check if already adopted
        if (adoptionRepository.existsByKnowledgeIdAndFactoryIdAndIsActiveTrue(knowledgeId, factoryId)) {
            return adoptionRepository.findByKnowledgeIdAndFactoryId(knowledgeId, factoryId).orElse(null);
        }

        CrossFactoryKnowledgeAdoption adoption = CrossFactoryKnowledgeAdoption.createNew(knowledgeId, factoryId);
        adoption = adoptionRepository.save(adoption);

        // Increment adoption count on knowledge
        knowledgeRepository.incrementAdoptionCount(knowledgeId);

        log.info("Factory {} adopted knowledge {}", factoryId, knowledgeId);
        return adoption;
    }

    @Override
    public List<CrossFactoryKnowledge> getAvailableGlobalKnowledge(String factoryId) {
        return knowledgeRepository.findNotAdoptedByFactory(factoryId);
    }

    @Override
    public Map<String, BigDecimal> evaluateKeywordEffectiveness(String factoryId) {
        List<CrossFactoryKnowledgeAdoption> adoptions = adoptionRepository.findByFactoryIdAndIsActiveTrue(factoryId);

        Map<String, BigDecimal> effectiveness = new HashMap<>();
        for (CrossFactoryKnowledgeAdoption adoption : adoptions) {
            CrossFactoryKnowledge knowledge = adoption.getKnowledge();
            if (knowledge != null && knowledge.getKnowledgeType() == CrossFactoryKnowledge.KnowledgeType.KEYWORD) {
                effectiveness.put(knowledge.getContent(),
                        adoption.getLocalEffectivenessScore() != null
                                ? adoption.getLocalEffectivenessScore()
                                : knowledge.getEffectivenessScore());
            }
        }
        return effectiveness;
    }

    // ==================== Learning Suggestions ====================

    @Override
    public List<LearningSuggestion> getPendingSuggestions(String factoryId, int limit) {
        return suggestionRepository.findPendingForReview(
                factoryId, LocalDateTime.now(), PageRequest.of(0, limit));
    }

    @Override
    @Transactional
    public void approveSuggestion(Long suggestionId, String reviewer, String notes) {
        suggestionRepository.approveSuggestion(
                suggestionId, reviewer, LocalDateTime.now(), notes);
        log.info("Suggestion {} approved by {}", suggestionId, reviewer);
    }

    @Override
    @Transactional
    public void rejectSuggestion(Long suggestionId, String reviewer, String notes) {
        suggestionRepository.rejectSuggestion(
                suggestionId, reviewer, LocalDateTime.now(), notes);
        log.info("Suggestion {} rejected by {}: {}", suggestionId, reviewer, notes);
    }

    @Override
    @Transactional
    public void applySuggestion(Long suggestionId, String applier) {
        LearningSuggestion suggestion = suggestionRepository.findById(suggestionId).orElse(null);
        if (suggestion == null || suggestion.getStatus() != LearningSuggestion.SuggestionStatus.APPROVED) {
            log.warn("Cannot apply suggestion {}: not found or not approved", suggestionId);
            return;
        }

        // Record current effectiveness before applying
        BigDecimal effectivenessBefore = BigDecimal.valueOf(0.5); // TODO: Calculate from actual data

        suggestionRepository.applySuggestion(
                suggestionId, applier, LocalDateTime.now(), effectivenessBefore);

        // TODO: Actually apply the suggestion (add keyword, expression, etc.)
        // This depends on the suggestion type and should integrate with AIIntentConfigService

        log.info("Suggestion {} applied by {}", suggestionId, applier);
    }

    // ==================== Model Performance ====================

    @Override
    @Transactional
    public void logModelPerformance(String factoryId, ModelPerformanceLog.PeriodType periodType) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime periodStart = calculatePeriodStart(now, periodType);
        LocalDateTime periodEnd = calculatePeriodEnd(periodStart, periodType);

        // Check if already logged
        if (performanceRepository.existsByFactoryIdAndPeriodTypeAndPeriodStart(
                factoryId, periodType, periodStart)) {
            return;
        }

        // Get statistics from IntentMatchRecord
        long totalRequests = matchRecordRepository.countTotalRequests(factoryId, periodStart, periodEnd);
        long matchedRequests = matchRecordRepository.countMatchedRequests(factoryId, periodStart, periodEnd);
        long llmFallbackCount = matchRecordRepository.countLlmFallbackRequests(factoryId, periodStart, periodEnd);
        BigDecimal avgConfidence = matchRecordRepository.calculateAverageConfidence(factoryId, periodStart);

        ModelPerformanceLog log = ModelPerformanceLog.createForPeriod(
                factoryId, periodType, periodStart, periodEnd);

        log.setTotalRequests(totalRequests);
        log.setMatchedRequests(matchedRequests);
        log.setLlmFallbackCount(llmFallbackCount);
        log.setAvgConfidence(avgConfidence);
        log.setUnmatchedCount(totalRequests - matchedRequests);

        // Calculate accuracy from user feedback if available
        // This would need additional queries to IntentMatchRecord

        performanceRepository.save(log);
    }

    @Override
    public List<ModelPerformanceLog> getPerformanceTrend(
            String factoryId,
            ModelPerformanceLog.PeriodType periodType,
            int days) {

        LocalDateTime startDate = LocalDateTime.now().minusDays(days);
        LocalDateTime endDate = LocalDateTime.now();

        return performanceRepository.findByFactoryIdAndPeriodTypeAndPeriodStartBetweenOrderByPeriodStartAsc(
                factoryId, periodType, startDate, endDate);
    }

    @Override
    public boolean isPerformanceDegrading(String factoryId, double threshold) {
        List<ModelPerformanceLog> recentLogs = getPerformanceTrend(
                factoryId, ModelPerformanceLog.PeriodType.DAILY, 7);

        if (recentLogs.size() < 2) {
            return false;
        }

        ModelPerformanceLog latest = recentLogs.get(recentLogs.size() - 1);
        ModelPerformanceLog previous = recentLogs.get(recentLogs.size() - 2);

        return latest.isPerformanceDegraded(previous, threshold);
    }

    // ==================== Annotation Queue ====================

    @Override
    @Transactional
    public AnnotationQueue addToAnnotationQueue(ActiveLearningSample sample) {
        if (annotationRepository.existsBySampleId(sample.getId())) {
            return null;
        }

        AnnotationQueue annotation = AnnotationQueue.fromSample(sample);
        return annotationRepository.save(annotation);
    }

    @Override
    @Transactional
    public List<AnnotationQueue> assignAnnotations(String factoryId, String annotator, int count) {
        List<AnnotationQueue> pending = annotationRepository.findPendingForAssignment(
                factoryId, PageRequest.of(0, count));

        if (pending.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> ids = pending.stream().map(AnnotationQueue::getId).collect(Collectors.toList());
        LocalDateTime dueDate = LocalDateTime.now().plusDays(3);

        annotationRepository.assignToAnnotator(ids, annotator, LocalDateTime.now(), dueDate);

        return annotationRepository.findByAssignedToAndAnnotationStatus(
                annotator, AnnotationQueue.AnnotationStatus.ASSIGNED);
    }

    @Override
    @Transactional
    public void completeAnnotation(Long annotationId, String intentCode, String annotator, String notes) {
        annotationRepository.completeAnnotation(
                annotationId, intentCode, annotator, LocalDateTime.now(), notes);
        log.info("Annotation {} completed by {}: intent={}", annotationId, annotator, intentCode);
    }

    // ==================== Cleanup Tasks ====================

    @Override
    @Transactional
    public int cleanupOldData(int retentionDays) {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(retentionDays);

        int deleted = 0;
        deleted += sampleRepository.deleteOldSamples(cutoffDate);
        deleted += clusterRepository.deleteOldClusters(cutoffDate);
        deleted += annotationRepository.deleteOldCompletedItems(cutoffDate);
        deleted += taskRepository.deleteOldCompletedTasks(cutoffDate);

        log.info("Cleanup completed: {} records deleted (retention: {} days)", deleted, retentionDays);
        return deleted;
    }

    @Override
    @Transactional
    public int expireOldSuggestions() {
        return suggestionRepository.expireSuggestions(LocalDateTime.now());
    }

    // ==================== Helper Methods ====================

    private Map<String, List<ActiveLearningSample>> performSimpleClustering(
            List<ActiveLearningSample> samples) {
        // Simple clustering based on normalized input similarity
        // In production, use embedding-based clustering (K-means, DBSCAN)
        Map<String, List<ActiveLearningSample>> clusters = new HashMap<>();

        for (ActiveLearningSample sample : samples) {
            String key = generateClusterKey(sample);
            clusters.computeIfAbsent(key, k -> new ArrayList<>()).add(sample);
        }

        return clusters;
    }

    private String generateClusterKey(ActiveLearningSample sample) {
        // Simple key based on matched intent and first few words
        String input = sample.getNormalizedInput() != null
                ? sample.getNormalizedInput() : sample.getUserInput();
        String[] words = input.split("\\s+");
        String prefix = Arrays.stream(words).limit(3).collect(Collectors.joining(" "));
        return (sample.getMatchedIntentCode() != null ? sample.getMatchedIntentCode() : "UNKNOWN")
                + "_" + prefix.hashCode();
    }

    private String findRepresentativeSample(List<ActiveLearningSample> samples) {
        // Return the sample closest to average length
        int avgLength = (int) samples.stream()
                .mapToInt(s -> s.getUserInput().length())
                .average()
                .orElse(0);

        return samples.stream()
                .min(Comparator.comparingInt(s -> Math.abs(s.getUserInput().length() - avgLength)))
                .map(ActiveLearningSample::getUserInput)
                .orElse("");
    }

    private BigDecimal calculateAverageConfidence(List<ActiveLearningSample> samples) {
        return samples.stream()
                .map(ActiveLearningSample::getConfidenceScore)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(samples.size()), 4, RoundingMode.HALF_UP);
    }

    private Map<String, Integer> calculateIntentDistribution(List<ActiveLearningSample> samples) {
        return samples.stream()
                .filter(s -> s.getMatchedIntentCode() != null)
                .collect(Collectors.groupingBy(
                        ActiveLearningSample::getMatchedIntentCode,
                        Collectors.collectingAndThen(Collectors.counting(), Long::intValue)));
    }

    private String findDominantIntent(Map<String, Integer> distribution) {
        return distribution.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
    }

    private BigDecimal calculateDominantRatio(Map<String, Integer> distribution, int totalSize) {
        int maxCount = distribution.values().stream().max(Integer::compareTo).orElse(0);
        if (totalSize == 0) return BigDecimal.ZERO;
        return BigDecimal.valueOf((double) maxCount / totalSize).setScale(4, RoundingMode.HALF_UP);
    }

    private String extractCommonKeywords(List<ActiveLearningSample> samples) {
        // Extract common words from inputs
        Map<String, Integer> wordCounts = new HashMap<>();
        for (ActiveLearningSample sample : samples) {
            String input = sample.getNormalizedInput() != null
                    ? sample.getNormalizedInput() : sample.getUserInput();
            for (String word : input.split("\\s+")) {
                if (word.length() >= 2) {
                    wordCounts.merge(word.toLowerCase(), 1, Integer::sum);
                }
            }
        }

        List<String> commonWords = wordCounts.entrySet().stream()
                .filter(e -> e.getValue() >= samples.size() / 2)
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(10)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        return toJson(commonWords);
    }

    private LearningSuggestion generateKeywordSuggestion(SampleCluster cluster) {
        if (cluster.getDominantIntentCode() == null || cluster.getSuggestedKeywords() == null) {
            return null;
        }

        // Get first suggested keyword
        List<String> keywords = fromJson(cluster.getSuggestedKeywords(), List.class);
        if (keywords == null || keywords.isEmpty()) {
            keywords = fromJson(cluster.getCommonKeywords(), List.class);
        }
        if (keywords == null || keywords.isEmpty()) {
            return null;
        }

        String keyword = keywords.get(0);
        return LearningSuggestion.createKeywordSuggestion(
                cluster.getFactoryId(),
                cluster.getDominantIntentCode(),
                keyword,
                "Discovered from cluster: " + cluster.getClusterId(),
                cluster.getSampleCount(),
                cluster.getAvgConfidence());
    }

    private LearningSuggestion generateNewIntentSuggestion(SampleCluster cluster) {
        return LearningSuggestion.builder()
                .factoryId(cluster.getFactoryId())
                .suggestionType(LearningSuggestion.SuggestionType.NEW_INTENT)
                .content(cluster.getRepresentativeSample())
                .description("Ambiguous cluster may need new intent")
                .reason("Cluster " + cluster.getClusterId() + " has no clear dominant intent")
                .clusterId(cluster.getClusterId())
                .clusterSize(cluster.getSampleCount())
                .sampleCount(cluster.getSampleCount())
                .confidenceScore(cluster.getAvgConfidence())
                .build();
    }

    private boolean isDuplicateSuggestion(LearningSuggestion suggestion) {
        return suggestionRepository.existsSimilarSuggestion(
                suggestion.getFactoryId(),
                suggestion.getSuggestionType(),
                suggestion.getIntentCode(),
                suggestion.getContent());
    }

    private LocalDateTime calculatePeriodStart(LocalDateTime now, ModelPerformanceLog.PeriodType periodType) {
        switch (periodType) {
            case HOURLY:
                return now.withMinute(0).withSecond(0).withNano(0);
            case DAILY:
                return now.toLocalDate().atStartOfDay();
            case WEEKLY:
                return now.toLocalDate().minusDays(now.getDayOfWeek().getValue() - 1).atStartOfDay();
            case MONTHLY:
                return now.toLocalDate().withDayOfMonth(1).atStartOfDay();
            default:
                return now.toLocalDate().atStartOfDay();
        }
    }

    private LocalDateTime calculatePeriodEnd(LocalDateTime start, ModelPerformanceLog.PeriodType periodType) {
        switch (periodType) {
            case HOURLY:
                return start.plusHours(1);
            case DAILY:
                return start.plusDays(1);
            case WEEKLY:
                return start.plusWeeks(1);
            case MONTHLY:
                return start.plusMonths(1);
            default:
                return start.plusDays(1);
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    private <T> T fromJson(String json, Class<T> type) {
        if (json == null || json.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private String truncate(String str, int maxLength) {
        if (str == null) return "";
        return str.length() <= maxLength ? str : str.substring(0, maxLength) + "...";
    }
}
