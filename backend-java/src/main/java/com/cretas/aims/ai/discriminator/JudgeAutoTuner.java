package com.cretas.aims.ai.discriminator;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedList;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Auto-tuner for JudgeRLVR discriminator thresholds.
 *
 * <p>This service monitors discriminator performance and automatically
 * adjusts pruning thresholds to maintain target mis-prune rates.
 *
 * <p>Key features:
 * <ul>
 *   <li>Sliding window monitoring of judgment results</li>
 *   <li>Automatic threshold adjustment based on mis-prune rate</li>
 *   <li>Per-intent tracking for fine-grained tuning</li>
 *   <li>Alert generation for anomalous behavior</li>
 * </ul>
 *
 * <p>Mis-prune definition: A correct answer was pruned (scored below threshold
 * when it should have been kept).
 *
 * @author Cretas AI Team
 * @since 1.0.0
 */
@Slf4j
@Service
public class JudgeAutoTuner {

    private final FlanT5Config config;

    // Sliding window for recent judgments
    private final Queue<JudgeRecord> window = new LinkedList<>();
    private static final int MAX_WINDOW_SIZE = 10000;

    // Per-intent statistics
    private final Map<String, IntentStats> intentStatsMap = new ConcurrentHashMap<>();

    // Global counters
    private final AtomicLong totalRecords = new AtomicLong(0);
    private final AtomicLong misPruneCount = new AtomicLong(0);
    private final AtomicLong correctPruneCount = new AtomicLong(0);

    // Last adjustment timestamp
    private volatile Instant lastAdjustment = Instant.now();

    @Autowired
    public JudgeAutoTuner(FlanT5Config config) {
        this.config = config;
    }

    /**
     * Record a judgment result for tuning analysis.
     *
     * @param record The judgment record with feedback
     */
    public void recordJudge(JudgeRecord record) {
        if (record == null || !config.isEnabled()) {
            return;
        }

        totalRecords.incrementAndGet();

        // Add to sliding window
        synchronized (window) {
            window.offer(record);
            while (window.size() > MAX_WINDOW_SIZE) {
                window.poll();
            }
        }

        // Update global counters
        if (record.isPrunedCorrectAnswer()) {
            misPruneCount.incrementAndGet();
            log.warn("Mis-prune detected: input='{}', intent={}, score={}",
                    truncate(record.getUserInput(), 50),
                    record.getIntentCode(),
                    record.getScore());
        } else if (record.isPrunedIncorrectAnswer()) {
            correctPruneCount.incrementAndGet();
        }

        // Update per-intent stats
        IntentStats stats = intentStatsMap.computeIfAbsent(
                record.getIntentCode(), k -> new IntentStats());
        stats.recordJudge(record);

        // Check if auto-tune is needed
        if (shouldAutoTune()) {
            autoTune();
        }
    }

    /**
     * Check if auto-tuning should be triggered.
     */
    private boolean shouldAutoTune() {
        int windowSize = config.getAutoTuneWindow();
        return totalRecords.get() > 0 && totalRecords.get() % windowSize == 0;
    }

    /**
     * Perform automatic threshold adjustment.
     */
    private synchronized void autoTune() {
        double misPruneRate = calculateMisPruneRate();
        double targetRate = config.getTargetMisPruneRate();
        double currentThreshold = config.getPruneThreshold();

        log.info("Auto-tuning: misPruneRate={:.4f}, targetRate={:.4f}, currentThreshold={}",
                misPruneRate, targetRate, currentThreshold);

        if (misPruneRate > targetRate) {
            // Mis-prune rate too high - lower threshold (more permissive)
            double newThreshold = Math.max(
                    config.getMinThreshold(),
                    currentThreshold - config.getAdjustmentStep()
            );
            if (newThreshold != currentThreshold) {
                config.setPruneThreshold(newThreshold);
                lastAdjustment = Instant.now();
                log.warn("Mis-prune rate too high ({:.2f}%), lowering threshold: {} -> {}",
                        misPruneRate * 100, currentThreshold, newThreshold);
            }
        } else if (misPruneRate < targetRate * 0.5) {
            // Mis-prune rate well below target - can raise threshold (more aggressive)
            double newThreshold = Math.min(
                    config.getMaxThreshold(),
                    currentThreshold + config.getAdjustmentStep()
            );
            if (newThreshold != currentThreshold) {
                config.setPruneThreshold(newThreshold);
                lastAdjustment = Instant.now();
                log.info("Mis-prune rate low ({:.2f}%), raising threshold: {} -> {}",
                        misPruneRate * 100, currentThreshold, newThreshold);
            }
        }
    }

    /**
     * Calculate current mis-prune rate from sliding window.
     */
    public double calculateMisPruneRate() {
        long misPrunes;
        long total;

        synchronized (window) {
            total = window.size();
            misPrunes = window.stream()
                    .filter(JudgeRecord::isPrunedCorrectAnswer)
                    .count();
        }

        return total > 0 ? (double) misPrunes / total : 0.0;
    }

    /**
     * Scheduled task to log statistics.
     */
    @Scheduled(fixedRate = 300000) // Every 5 minutes
    public void logStats() {
        if (!config.isEnabled() || totalRecords.get() == 0) {
            return;
        }

        double misPruneRate = calculateMisPruneRate();
        log.info("JudgeAutoTuner stats: total={}, misPrunes={}, correctPrunes={}, " +
                        "misPruneRate={:.4f}, threshold={}, intents={}",
                totalRecords.get(),
                misPruneCount.get(),
                correctPruneCount.get(),
                misPruneRate,
                config.getPruneThreshold(),
                intentStatsMap.size());
    }

    /**
     * Get statistics for a specific intent.
     */
    public IntentStats getIntentStats(String intentCode) {
        return intentStatsMap.get(intentCode);
    }

    /**
     * Get all intent statistics.
     */
    public Map<String, IntentStats> getAllIntentStats() {
        return Map.copyOf(intentStatsMap);
    }

    /**
     * Get current tuning metrics.
     */
    public Map<String, Object> getMetrics() {
        Map<String, Object> metrics = new ConcurrentHashMap<>();
        metrics.put("totalRecords", totalRecords.get());
        metrics.put("misPruneCount", misPruneCount.get());
        metrics.put("correctPruneCount", correctPruneCount.get());
        metrics.put("misPruneRate", calculateMisPruneRate());
        metrics.put("currentThreshold", config.getPruneThreshold());
        metrics.put("targetMisPruneRate", config.getTargetMisPruneRate());
        metrics.put("lastAdjustment", lastAdjustment.toString());
        metrics.put("windowSize", window.size());
        metrics.put("trackedIntents", intentStatsMap.size());
        return metrics;
    }

    /**
     * Reset all statistics.
     */
    public void reset() {
        synchronized (window) {
            window.clear();
        }
        intentStatsMap.clear();
        totalRecords.set(0);
        misPruneCount.set(0);
        correctPruneCount.set(0);
        log.info("JudgeAutoTuner reset");
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return "null";
        return s.length() > maxLen ? s.substring(0, maxLen - 3) + "..." : s;
    }

    // ==================== Inner Classes ====================

    /**
     * Record of a single judgment for analysis.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class JudgeRecord {
        private String userInput;
        private String intentCode;
        private double score;
        private boolean wasPruned;
        private boolean wasCorrectAnswer;
        private Instant timestamp;

        /**
         * True if a correct answer was wrongly pruned.
         */
        public boolean isPrunedCorrectAnswer() {
            return wasPruned && wasCorrectAnswer;
        }

        /**
         * True if an incorrect answer was correctly pruned.
         */
        public boolean isPrunedIncorrectAnswer() {
            return wasPruned && !wasCorrectAnswer;
        }

        public static JudgeRecord create(
                String userInput,
                String intentCode,
                double score,
                boolean wasPruned,
                boolean wasCorrectAnswer
        ) {
            return new JudgeRecord(
                    userInput,
                    intentCode,
                    score,
                    wasPruned,
                    wasCorrectAnswer,
                    Instant.now()
            );
        }
    }

    /**
     * Per-intent statistics.
     */
    @Data
    public static class IntentStats {
        private long totalJudgments = 0;
        private long misPrunes = 0;
        private long correctPrunes = 0;
        private double avgScore = 0.0;
        private double minScore = 1.0;
        private double maxScore = 0.0;

        public synchronized void recordJudge(JudgeRecord record) {
            totalJudgments++;

            // Update score stats
            double score = record.getScore();
            avgScore = ((avgScore * (totalJudgments - 1)) + score) / totalJudgments;
            minScore = Math.min(minScore, score);
            maxScore = Math.max(maxScore, score);

            // Update prune stats
            if (record.isPrunedCorrectAnswer()) {
                misPrunes++;
            } else if (record.isPrunedIncorrectAnswer()) {
                correctPrunes++;
            }
        }

        public double getMisPruneRate() {
            return totalJudgments > 0 ? (double) misPrunes / totalJudgments : 0.0;
        }
    }
}
