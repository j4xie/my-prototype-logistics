package com.cretas.aims.service.scheduling.impl;

import com.cretas.aims.config.DispatcherStrategyConfig;
import com.cretas.aims.entity.FactorySchedulingConfig;
import com.cretas.aims.repository.FactorySchedulingConfigRepository;
import com.cretas.aims.repository.WorkerAllocationFeedbackRepository;
import com.cretas.aims.service.scheduling.FairMABService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fair-MAB Fairness Scheduling Service Implementation
 *
 * Algorithm based on "Fair Learning for Combinatorial MAB"
 *
 * Key features:
 * 1. Virtual queue mechanism to track fairness debt
 * 2. Fairness bonus calculation based on assignment ratio
 * 3. Exploration bonus for underutilized workers
 * 4. Gini coefficient for measuring inequality
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FairMABServiceImpl implements FairMABService {

    private final WorkerAllocationFeedbackRepository feedbackRepository;
    private final FactorySchedulingConfigRepository configRepository;
    private final DispatcherStrategyConfig defaultConfig;

    // Virtual queue in-memory cache (production should use Redis)
    private final Map<String, Map<Long, Double>> virtualQueues = new ConcurrentHashMap<>();
    private final Map<String, Map<Long, Integer>> periodAssignments = new ConcurrentHashMap<>();

    private static final double DEFAULT_FAIRNESS_WEIGHT = 0.2;
    private static final double VIRTUAL_QUEUE_DECAY = 0.95;
    private static final double EXPLORATION_BONUS = 0.1;

    @Override
    public double calculateFairScore(String factoryId, Long workerId, String taskType, double linucbScore) {
        // Get factory configuration
        FactorySchedulingConfig config = configRepository.findByFactoryId(factoryId)
                .orElse(FactorySchedulingConfig.createDefault(factoryId));

        double fairnessWeight = config.getFairnessWeight() != null
                ? config.getFairnessWeight()
                : DEFAULT_FAIRNESS_WEIGHT;

        // Calculate fairness bonus
        double fairnessBonus = calculateFairnessBonus(factoryId, workerId);

        // Get virtual queue length
        double queueLength = getVirtualQueueLength(factoryId, workerId);

        // Exploration bonus (for workers not assigned for a long time)
        double explorationBonus = calculateExplorationBonus(factoryId, workerId);

        // Final score
        double fairScore = linucbScore
                + fairnessWeight * fairnessBonus
                + 0.1 * queueLength  // Virtual queue weight
                + EXPLORATION_BONUS * explorationBonus;

        log.debug("FairMAB Score for worker {}: linucb={}, fairness={}, queue={}, exploration={}, final={}",
                workerId, linucbScore, fairnessBonus, queueLength, explorationBonus, fairScore);

        return fairScore;
    }

    @Override
    public double calculateFairnessBonus(String factoryId, Long workerId) {
        // Get all active workers in the factory
        List<Long> activeWorkers = getActiveWorkers(factoryId);
        if (activeWorkers.isEmpty()) {
            return 0.0;
        }

        double targetRatio = 1.0 / activeWorkers.size();

        // Get worker's actual assignment ratio
        Map<Long, Integer> assignments = periodAssignments.getOrDefault(factoryId, new HashMap<>());
        int totalAssignments = assignments.values().stream().mapToInt(Integer::intValue).sum();
        if (totalAssignments == 0) {
            return 0.5; // Give medium bonus initially
        }

        int workerAssignments = assignments.getOrDefault(workerId, 0);
        double actualRatio = (double) workerAssignments / totalAssignments;

        // FairnessBonus = max(0, targetRatio - actualRatio)
        return Math.max(0, targetRatio - actualRatio);
    }

    @Override
    public double getVirtualQueueLength(String factoryId, Long workerId) {
        return virtualQueues
                .getOrDefault(factoryId, new HashMap<>())
                .getOrDefault(workerId, 0.0);
    }

    @Override
    @Transactional
    public void updateVirtualQueue(String factoryId, Long workerId, boolean wasAssigned) {
        Map<Long, Double> factoryQueues = virtualQueues.computeIfAbsent(
                factoryId, k -> new ConcurrentHashMap<>());
        Map<Long, Integer> factoryAssignments = periodAssignments.computeIfAbsent(
                factoryId, k -> new ConcurrentHashMap<>());

        List<Long> activeWorkers = getActiveWorkers(factoryId);
        double targetRatio = activeWorkers.isEmpty() ? 0 : 1.0 / activeWorkers.size();

        for (Long wId : activeWorkers) {
            double currentQueue = factoryQueues.getOrDefault(wId, 0.0);

            if (wId.equals(workerId) && wasAssigned) {
                // Assigned worker: reduce queue
                currentQueue = Math.max(0, currentQueue - 1.0);
                // Update assignment count
                factoryAssignments.merge(wId, 1, Integer::sum);
            } else {
                // Non-assigned workers: increase queue (fairness debt accumulation)
                currentQueue = currentQueue * VIRTUAL_QUEUE_DECAY + targetRatio;
            }

            factoryQueues.put(wId, currentQueue);
        }

        log.debug("Updated virtual queues for factory {}: assigned worker={}, totalWorkers={}",
                factoryId, workerId, activeWorkers.size());
    }

    @Override
    public List<FairnessViolation> detectFairnessViolations(String factoryId, int days) {
        List<FairnessViolation> violations = new ArrayList<>();

        Map<Long, Integer> assignments = periodAssignments.getOrDefault(factoryId, new HashMap<>());
        int totalAssignments = assignments.values().stream().mapToInt(Integer::intValue).sum();
        if (totalAssignments == 0) {
            return violations;
        }

        List<Long> activeWorkers = getActiveWorkers(factoryId);
        double targetRatio = activeWorkers.isEmpty() ? 0 : 1.0 / activeWorkers.size();
        int expectedAssignments = (int) (totalAssignments * targetRatio);

        for (Long workerId : activeWorkers) {
            int actual = assignments.getOrDefault(workerId, 0);
            double actualRatio = (double) actual / totalAssignments;

            // If actual ratio is below 70% of target, consider it a violation
            if (actualRatio < targetRatio * 0.7) {
                FairnessViolation violation = new FairnessViolation();
                violation.setWorkerId(workerId);
                violation.setTargetRatio(targetRatio);
                violation.setActualRatio(actualRatio);
                violation.setViolationSeverity(1.0 - actualRatio / targetRatio);
                violation.setMissedAssignments(expectedAssignments - actual);
                violations.add(violation);
            }
        }

        // Sort by severity (descending)
        violations.sort((a, b) -> Double.compare(b.getViolationSeverity(), a.getViolationSeverity()));

        log.info("Detected {} fairness violations for factory {} over {} days",
                violations.size(), factoryId, days);

        return violations;
    }

    @Override
    public FairnessStats getFactoryFairnessStats(String factoryId) {
        FairnessStats stats = new FairnessStats();
        stats.setFactoryId(factoryId);

        Map<Long, Integer> assignments = periodAssignments.getOrDefault(factoryId, new HashMap<>());
        List<Long> activeWorkers = getActiveWorkers(factoryId);

        stats.setTotalWorkers(activeWorkers.size());
        stats.setTotalAssignments(assignments.values().stream().mapToInt(Integer::intValue).sum());

        if (stats.getTotalAssignments() == 0 || activeWorkers.isEmpty()) {
            stats.setGiniCoefficient(0.0);
            stats.setMinRatio(0.0);
            stats.setMaxRatio(0.0);
            stats.setWorkerStats(new ArrayList<>());
            return stats;
        }

        double targetRatio = 1.0 / activeWorkers.size();
        List<WorkerFairnessInfo> workerStats = new ArrayList<>();
        List<Double> ratios = new ArrayList<>();

        for (Long workerId : activeWorkers) {
            int workerAssignments = assignments.getOrDefault(workerId, 0);
            double actualRatio = (double) workerAssignments / stats.getTotalAssignments();
            ratios.add(actualRatio);

            WorkerFairnessInfo info = new WorkerFairnessInfo();
            info.setWorkerId(workerId);
            info.setTargetRatio(targetRatio);
            info.setActualRatio(actualRatio);
            info.setAssignments(workerAssignments);
            info.setQueueLength(getVirtualQueueLength(factoryId, workerId));
            workerStats.add(info);
        }

        stats.setWorkerStats(workerStats);
        stats.setMinRatio(ratios.stream().mapToDouble(Double::doubleValue).min().orElse(0));
        stats.setMaxRatio(ratios.stream().mapToDouble(Double::doubleValue).max().orElse(0));
        stats.setGiniCoefficient(calculateGiniCoefficient(ratios));

        log.debug("Factory {} fairness stats: workers={}, assignments={}, gini={}",
                factoryId, stats.getTotalWorkers(), stats.getTotalAssignments(), stats.getGiniCoefficient());

        return stats;
    }

    @Override
    public void resetPeriod(String factoryId) {
        periodAssignments.put(factoryId, new ConcurrentHashMap<>());
        virtualQueues.put(factoryId, new ConcurrentHashMap<>());
        log.info("Reset fairness period for factory: {}", factoryId);
    }

    // ==================== Helper Methods ====================

    /**
     * Calculate exploration bonus based on assignment history
     * Workers not assigned for a long time get higher bonus
     */
    private double calculateExplorationBonus(String factoryId, Long workerId) {
        Map<Long, Integer> assignments = periodAssignments.getOrDefault(factoryId, new HashMap<>());
        int workerAssignments = assignments.getOrDefault(workerId, 0);

        if (workerAssignments == 0) {
            return 1.0; // Never assigned, maximum bonus
        }

        int totalAssignments = assignments.values().stream().mapToInt(Integer::intValue).sum();
        double ratio = (double) workerAssignments / Math.max(1, totalAssignments);

        // Lower assignment ratio means higher exploration bonus
        return Math.max(0, 1.0 - ratio * 2);
    }

    /**
     * Get active workers from recent feedback records
     */
    private List<Long> getActiveWorkers(String factoryId) {
        LocalDateTime since = LocalDateTime.now().minusDays(30);
        return feedbackRepository.findDistinctWorkerIdsByFactoryIdAndCreatedAtAfter(factoryId, since);
    }

    /**
     * Calculate Gini coefficient for measuring inequality
     * Range: 0 (perfect equality) to 1 (perfect inequality)
     *
     * Formula: G = (2 * sum(i * y_i) - (n+1) * sum(y_i)) / (n * sum(y_i))
     * where y_i are sorted values
     */
    private double calculateGiniCoefficient(List<Double> values) {
        if (values.isEmpty()) {
            return 0.0;
        }

        int n = values.size();
        double sum = values.stream().mapToDouble(Double::doubleValue).sum();
        if (sum == 0) {
            return 0.0;
        }

        List<Double> sortedValues = new ArrayList<>(values);
        Collections.sort(sortedValues);

        double sumOfDifferences = 0;
        for (int i = 0; i < n; i++) {
            sumOfDifferences += (2 * (i + 1) - n - 1) * sortedValues.get(i);
        }

        return sumOfDifferences / (n * sum);
    }
}
