package com.cretas.aims.service.scheduling;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

/**
 * Fair-MAB (Multi-Armed Bandit) Fairness Scheduling Service
 * Based on: "Fair Learning for Combinatorial MAB"
 *
 * Core concept: Add fairness constraints on top of LinUCB to ensure
 * each worker receives a minimum proportion of task assignments.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface FairMABService {

    /**
     * Calculate fairness-adjusted recommendation score
     * Score(w,t) = LinUCB(w,t) + alpha * FairnessBonus(w) + beta * VirtualQueue(w)
     *
     * @param factoryId Factory ID
     * @param workerId Worker ID
     * @param taskType Task type
     * @param linucbScore Original LinUCB score
     * @return Fairness-adjusted score
     */
    double calculateFairScore(String factoryId, Long workerId, String taskType, double linucbScore);

    /**
     * Calculate fairness bonus
     * FairnessBonus = max(0, targetRatio - actualRatio) * fairnessWeight
     *
     * @param factoryId Factory ID
     * @param workerId Worker ID
     * @return Fairness bonus value
     */
    double calculateFairnessBonus(String factoryId, Long workerId);

    /**
     * Get virtual queue length
     * Virtual queue tracks "fairness debt"
     *
     * @param factoryId Factory ID
     * @param workerId Worker ID
     * @return Virtual queue length
     */
    double getVirtualQueueLength(String factoryId, Long workerId);

    /**
     * Update virtual queue (called after task assignment)
     *
     * @param factoryId Factory ID
     * @param workerId Worker ID
     * @param wasAssigned Whether the worker was assigned a task
     */
    void updateVirtualQueue(String factoryId, Long workerId, boolean wasAssigned);

    /**
     * Detect fairness violations
     * Returns workers with significantly unequal recent assignments
     *
     * @param factoryId Factory ID
     * @param days Number of days to analyze
     * @return List of fairness violations
     */
    List<FairnessViolation> detectFairnessViolations(String factoryId, int days);

    /**
     * Get factory fairness statistics
     *
     * @param factoryId Factory ID
     * @return Fairness statistics
     */
    FairnessStats getFactoryFairnessStats(String factoryId);

    /**
     * Reset statistics period (weekly/monthly)
     *
     * @param factoryId Factory ID
     */
    void resetPeriod(String factoryId);

    // ==================== DTO Classes ====================

    /**
     * Fairness violation record
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    class FairnessViolation {
        private Long workerId;
        private double targetRatio;
        private double actualRatio;
        private double violationSeverity; // 0-1, higher means more severe
        private int missedAssignments;
    }

    /**
     * Factory-level fairness statistics
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    class FairnessStats {
        private String factoryId;
        private int totalWorkers;
        private int totalAssignments;
        private double giniCoefficient; // Gini coefficient, lower is fairer
        private double minRatio;
        private double maxRatio;
        private List<WorkerFairnessInfo> workerStats;
    }

    /**
     * Worker-level fairness information
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    class WorkerFairnessInfo {
        private Long workerId;
        private double targetRatio;
        private double actualRatio;
        private int assignments;
        private double queueLength;
    }
}
