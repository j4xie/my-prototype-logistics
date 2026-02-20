package com.cretas.aims.scheduler;

import com.cretas.aims.entity.intent.FactoryAILearningConfig;
import com.cretas.aims.entity.learning.LearningSuggestion;
import com.cretas.aims.entity.learning.ModelPerformanceLog;
import com.cretas.aims.service.ActiveLearningService;
import com.cretas.aims.service.FactoryConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Active Learning Scheduler
 *
 * Manages scheduled tasks for the active learning system:
 * - Daily: Low confidence sample analysis and clustering
 * - Weekly: Intent transition matrix updates
 * - Monthly: Keyword effectiveness evaluation and cross-factory knowledge promotion
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ActiveLearningScheduler {

    private final ActiveLearningService activeLearningService;
    private final FactoryConfigService factoryConfigService;

    @Value("${cretas.ai.active-learning.min-cluster-size:5}")
    private int minClusterSize;

    @Value("${cretas.ai.active-learning.promotion-min-effectiveness:0.80}")
    private BigDecimal promotionMinEffectiveness;

    @Value("${cretas.ai.active-learning.promotion-min-adoptions:3}")
    private int promotionMinAdoptions;

    @Value("${cretas.ai.active-learning.data-retention-days:90}")
    private int dataRetentionDays;

    @Value("${cretas.ai.active-learning.performance-degradation-threshold:0.05}")
    private double performanceDegradationThreshold;

    // ==================== Daily Tasks ====================

    /**
     * Every day at 02:00 - Analyze low confidence samples
     *
     * This task:
     * 1. Collects pending low confidence samples
     * 2. Clusters similar samples
     * 3. Generates learning suggestions
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void analyzeLowConfidenceSamples() {
        log.info("========== Starting daily low confidence sample analysis ==========");

        try {
            List<String> factories = factoryConfigService.getAutoLearnEnabledFactories();
            int totalClusters = 0;
            int totalSuggestions = 0;

            for (String factoryId : factories) {
                try {
                    // Step 1: Cluster pending samples
                    int clusters = activeLearningService.clusterSamples(factoryId);
                    totalClusters += clusters;

                    // Step 2: Analyze clusters and generate suggestions
                    List<LearningSuggestion> suggestions = activeLearningService
                            .analyzeClustersAndGenerateSuggestions(factoryId, minClusterSize);
                    totalSuggestions += suggestions.size();

                    if (clusters > 0 || !suggestions.isEmpty()) {
                        log.info("Factory {}: {} clusters, {} suggestions",
                                factoryId, clusters, suggestions.size());
                    }
                } catch (Exception e) {
                    log.error("Failed to analyze samples for factory {}: {}", factoryId, e.getMessage(), e);
                }
            }

            log.info("Low confidence sample analysis complete: {} factories, {} clusters, {} suggestions",
                    factories.size(), totalClusters, totalSuggestions);

        } catch (Exception e) {
            log.error("Low confidence sample analysis task failed: {}", e.getMessage(), e);
        }
    }

    /**
     * Every day at 03:00 - Log daily model performance
     */
    @Scheduled(cron = "0 0 3 * * ?")
    public void logDailyPerformance() {
        log.info("========== Starting daily performance logging ==========");

        try {
            List<String> factories = factoryConfigService.getAutoLearnEnabledFactories();
            int logged = 0;
            int alerts = 0;

            for (String factoryId : factories) {
                try {
                    activeLearningService.logModelPerformance(factoryId, ModelPerformanceLog.PeriodType.DAILY);
                    logged++;

                    // Check for performance degradation
                    if (activeLearningService.isPerformanceDegrading(factoryId, performanceDegradationThreshold)) {
                        log.warn("Performance degradation detected for factory {}", factoryId);
                        alerts++;
                        // TODO: Send notification to administrators
                    }
                } catch (Exception e) {
                    log.error("Failed to log performance for factory {}: {}", factoryId, e.getMessage());
                }
            }

            log.info("Daily performance logging complete: {} logged, {} alerts", logged, alerts);

        } catch (Exception e) {
            log.error("Daily performance logging task failed: {}", e.getMessage(), e);
        }
    }

    /**
     * Every day at 04:00 - Expire old suggestions
     */
    @Scheduled(cron = "0 0 4 * * ?")
    public void expireOldSuggestions() {
        log.info("========== Starting suggestion expiration task ==========");

        try {
            int expired = activeLearningService.expireOldSuggestions();
            log.info("Suggestion expiration complete: {} suggestions expired", expired);
        } catch (Exception e) {
            log.error("Suggestion expiration task failed: {}", e.getMessage(), e);
        }
    }

    // ==================== Weekly Tasks ====================

    /**
     * Every Monday at 01:00 - Update intent transition matrices
     *
     * This task:
     * 1. Recalculates transition probabilities using Laplace smoothing
     * 2. Updates all factory transition matrices
     */
    @Scheduled(cron = "0 0 1 ? * MON")
    public void updateTransitionMatrices() {
        log.info("========== Starting weekly transition matrix update ==========");

        try {
            List<String> factories = factoryConfigService.getAutoLearnEnabledFactories();
            LocalDate windowStart = LocalDate.now().withDayOfMonth(1);

            for (String factoryId : factories) {
                try {
                    activeLearningService.updateTransitionMatrix(factoryId, windowStart);
                    log.debug("Updated transition matrix for factory {}", factoryId);
                } catch (Exception e) {
                    log.error("Failed to update transition matrix for factory {}: {}",
                            factoryId, e.getMessage(), e);
                }
            }

            log.info("Transition matrix update complete: {} factories processed", factories.size());

        } catch (Exception e) {
            log.error("Transition matrix update task failed: {}", e.getMessage(), e);
        }
    }

    /**
     * Every Sunday at 00:00 - Log weekly model performance
     */
    @Scheduled(cron = "0 0 0 ? * SUN")
    public void logWeeklyPerformance() {
        log.info("========== Starting weekly performance logging ==========");

        try {
            List<String> factories = factoryConfigService.getAutoLearnEnabledFactories();

            for (String factoryId : factories) {
                try {
                    activeLearningService.logModelPerformance(factoryId, ModelPerformanceLog.PeriodType.WEEKLY);
                } catch (Exception e) {
                    log.error("Failed to log weekly performance for factory {}: {}",
                            factoryId, e.getMessage());
                }
            }

            log.info("Weekly performance logging complete: {} factories", factories.size());

        } catch (Exception e) {
            log.error("Weekly performance logging task failed: {}", e.getMessage(), e);
        }
    }

    // ==================== Monthly Tasks ====================

    /**
     * Every 1st of month at 00:00 - Evaluate keyword effectiveness
     *
     * This task:
     * 1. Evaluates keyword effectiveness using Wilson Score
     * 2. Deprecates low-performing keywords
     * 3. Promotes high-performing cross-factory knowledge
     */
    @Scheduled(cron = "0 0 0 1 * ?")
    public void evaluateKeywordEffectiveness() {
        log.info("========== Starting monthly keyword effectiveness evaluation ==========");

        try {
            List<String> factories = factoryConfigService.getAutoLearnEnabledFactories();

            for (String factoryId : factories) {
                try {
                    activeLearningService.evaluateKeywordEffectiveness(factoryId);
                    log.debug("Evaluated keyword effectiveness for factory {}", factoryId);
                } catch (Exception e) {
                    log.error("Failed to evaluate keywords for factory {}: {}",
                            factoryId, e.getMessage(), e);
                }
            }

            // Promote high-performing cross-factory knowledge
            int promoted = activeLearningService.promoteKnowledgeToGlobal(
                    promotionMinEffectiveness, promotionMinAdoptions);

            log.info("Keyword effectiveness evaluation complete: {} factories, {} knowledge promoted",
                    factories.size(), promoted);

        } catch (Exception e) {
            log.error("Keyword effectiveness evaluation task failed: {}", e.getMessage(), e);
        }
    }

    /**
     * Every 1st of month at 01:00 - Log monthly model performance
     */
    @Scheduled(cron = "0 0 1 1 * ?")
    public void logMonthlyPerformance() {
        log.info("========== Starting monthly performance logging ==========");

        try {
            List<String> factories = factoryConfigService.getAutoLearnEnabledFactories();

            for (String factoryId : factories) {
                try {
                    activeLearningService.logModelPerformance(factoryId, ModelPerformanceLog.PeriodType.MONTHLY);
                } catch (Exception e) {
                    log.error("Failed to log monthly performance for factory {}: {}",
                            factoryId, e.getMessage());
                }
            }

            log.info("Monthly performance logging complete: {} factories", factories.size());

        } catch (Exception e) {
            log.error("Monthly performance logging task failed: {}", e.getMessage(), e);
        }
    }

    /**
     * Every 15th of month at 00:00 - Clean up old data
     *
     * This task:
     * 1. Deletes old samples that have been learned or ignored
     * 2. Cleans up old clusters
     * 3. Removes old completed annotations
     */
    @Scheduled(cron = "0 0 0 15 * ?")
    public void cleanupOldData() {
        log.info("========== Starting bi-monthly data cleanup ==========");

        try {
            int deleted = activeLearningService.cleanupOldData(dataRetentionDays);
            log.info("Data cleanup complete: {} records deleted (retention: {} days)",
                    deleted, dataRetentionDays);
        } catch (Exception e) {
            log.error("Data cleanup task failed: {}", e.getMessage(), e);
        }
    }

    // ==================== Hourly Tasks ====================

    /**
     * Every hour - Log hourly model performance (for busy factories)
     *
     * Only runs for factories with high traffic
     */
    @Scheduled(cron = "0 0 * * * ?")
    public void logHourlyPerformance() {
        // Only log hourly for high-traffic factories to avoid excessive data
        try {
            List<FactoryAILearningConfig> configs = factoryConfigService.getCleanupEnabledFactories();

            for (FactoryAILearningConfig config : configs) {
                // Only log hourly if factory is in MATURE phase (higher traffic expected)
                if (FactoryAILearningConfig.LearningPhase.MATURE.equals(config.getLearningPhase())) {
                    try {
                        activeLearningService.logModelPerformance(
                                config.getFactoryId(), ModelPerformanceLog.PeriodType.HOURLY);
                    } catch (Exception e) {
                        log.debug("Failed to log hourly performance for factory {}: {}",
                                config.getFactoryId(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Hourly performance logging skipped: {}", e.getMessage());
        }
    }

    // ==================== Manual Trigger Methods ====================

    /**
     * Manually trigger sample analysis for a specific factory
     *
     * @param factoryId Factory ID
     * @return Number of suggestions generated
     */
    public int triggerSampleAnalysis(String factoryId) {
        log.info("Manual sample analysis triggered for factory: {}", factoryId);

        int clusters = activeLearningService.clusterSamples(factoryId);
        List<LearningSuggestion> suggestions = activeLearningService
                .analyzeClustersAndGenerateSuggestions(factoryId, minClusterSize);

        log.info("Manual analysis complete for {}: {} clusters, {} suggestions",
                factoryId, clusters, suggestions.size());
        return suggestions.size();
    }

    /**
     * Manually trigger transition matrix update for a specific factory
     *
     * @param factoryId Factory ID
     */
    public void triggerTransitionMatrixUpdate(String factoryId) {
        log.info("Manual transition matrix update triggered for factory: {}", factoryId);

        LocalDate windowStart = LocalDate.now().withDayOfMonth(1);
        activeLearningService.updateTransitionMatrix(factoryId, windowStart);

        log.info("Manual transition matrix update complete for {}", factoryId);
    }

    /**
     * Manually trigger knowledge promotion check
     *
     * @return Number of promoted knowledge items
     */
    public int triggerKnowledgePromotion() {
        log.info("Manual knowledge promotion triggered");

        int promoted = activeLearningService.promoteKnowledgeToGlobal(
                promotionMinEffectiveness, promotionMinAdoptions);

        log.info("Manual knowledge promotion complete: {} items promoted", promoted);
        return promoted;
    }
}
