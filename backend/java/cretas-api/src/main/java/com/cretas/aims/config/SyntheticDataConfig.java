package com.cretas.aims.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration properties for AI synthetic data generation.
 *
 * <p>This configuration controls how synthetic training data is generated,
 * filtered, and weighted during model training processes. It includes
 * settings for domain randomization (to improve model robustness) and
 * circuit breaker mechanisms (to prevent degradation from low-quality synthetic data).
 *
 * <p>Example configuration in application.properties:
 * <pre>
 * ai.synthetic.enabled=true
 * ai.synthetic.max-ratio=0.8
 * ai.synthetic.synthetic-weight=0.5
 * ai.synthetic.max-generation=1
 * ai.synthetic.grape-threshold=0.3
 * ai.synthetic.domain-randomization.synonym-prob=0.3
 * ai.synthetic.circuit-breaker.accuracy-drop-threshold=0.05
 * </pre>
 *
 * @author Cretas AI Team
 * @since 1.0.0
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "ai.synthetic")
public class SyntheticDataConfig {

    /**
     * Whether synthetic data generation is enabled.
     * When disabled, only real training data will be used.
     */
    private boolean enabled = true;

    /**
     * Maximum ratio of synthetic data in the training set.
     * Value range: 0.0 to 1.0, where 0.8 means synthetic data
     * can comprise at most 80% of the total training data.
     */
    private double maxRatio = 0.8;

    /**
     * Weight applied to synthetic data samples during training.
     * Lower values reduce the influence of synthetic samples.
     * Value range: 0.0 to 1.0
     */
    private double syntheticWeight = 0.5;

    /**
     * Maximum generation depth for synthetic data.
     * Set to 1 to prevent recursive synthesis (generating synthetic
     * data from other synthetic data).
     */
    private int maxGeneration = 1;

    /**
     * GRAPE (Generative Retrieval-Augmented Prompt Engineering) filter threshold.
     * Synthetic samples with quality scores below this threshold are discarded.
     * Value range: 0.0 to 1.0
     */
    private double grapeThreshold = 0.3;

    /**
     * Domain randomization settings for data augmentation.
     */
    private DomainRandomization domainRandomization = new DomainRandomization();

    /**
     * Circuit breaker settings for automatic quality control.
     */
    private CircuitBreaker circuitBreaker = new CircuitBreaker();

    /**
     * Configuration for domain randomization techniques.
     *
     * <p>Domain randomization applies various transformations to training data
     * to improve model robustness against real-world variations in input.
     */
    @Data
    public static class DomainRandomization {

        /**
         * Probability of applying synonym substitution to text fields.
         * Helps the model generalize across different phrasings.
         * Value range: 0.0 to 1.0
         */
        private double synonymProb = 0.3;

        /**
         * Probability of introducing realistic typos.
         * Helps the model handle imperfect user input.
         * Value range: 0.0 to 1.0 (typically kept low, e.g., 0.05)
         */
        private double typoProb = 0.05;

        /**
         * Probability of reordering elements in sequences.
         * Helps the model handle varied input orderings.
         * Value range: 0.0 to 1.0
         */
        private double reorderProb = 0.2;

        /**
         * Probability of omitting optional fields.
         * Helps the model handle incomplete input gracefully.
         * Value range: 0.0 to 1.0
         */
        private double omitOptionalProb = 0.3;
    }

    /**
     * Configuration for the synthetic data circuit breaker.
     *
     * <p>The circuit breaker monitors model performance and automatically
     * adjusts or disables synthetic data usage when quality degradation
     * is detected.
     */
    @Data
    public static class CircuitBreaker {

        /**
         * Maximum allowed accuracy drop before triggering the circuit breaker.
         * If model accuracy drops by more than this threshold (compared to
         * the baseline), the configured action will be taken.
         * Value range: 0.0 to 1.0 (e.g., 0.05 = 5% accuracy drop)
         */
        private double accuracyDropThreshold = 0.05;

        /**
         * Number of days to consider when calculating the accuracy baseline.
         * The circuit breaker compares current accuracy against the rolling
         * average from this time window.
         */
        private int windowDays = 7;

        /**
         * Action to take when the circuit breaker is triggered.
         * Supported values:
         * <ul>
         *   <li>DISABLE_SYNTHETIC - Completely disable synthetic data</li>
         *   <li>REDUCE_RATIO - Halve the synthetic data ratio</li>
         *   <li>ALERT_ONLY - Log warning but take no automatic action</li>
         * </ul>
         */
        private String action = "DISABLE_SYNTHETIC";
    }

    // ============================================================
    // Additional fields and getters for SyntheticDataService
    // ============================================================

    /**
     * Multiplier for candidate sample pool size.
     * When selecting synthetic samples, we generate candidateMultiplier * requiredCount
     * candidates and then filter down to the best ones.
     */
    private int candidateMultiplier = 3;

    /**
     * Interval in milliseconds between batch processing.
     * Helps prevent system overload during large-scale synthetic data generation.
     */
    private long batchIntervalMs = 1000;

    /**
     * Number of days to consider when calculating the synthetic/real data ratio.
     * Used for historical analysis and adaptive ratio adjustment.
     */
    private int ratioCalculationDays = 30;

    /**
     * Alias getter for maxRatio field.
     * Provides a more descriptive method name for service layer usage.
     *
     * @return the maximum synthetic data ratio
     */
    public double getMaxSyntheticRatio() {
        return this.maxRatio;
    }

    // ============================================================
    // Circuit Breaker additional fields
    // ============================================================

    /**
     * 准确率阈值 (熔断器使用)
     * 当准确率低于此值时触发熔断
     */
    private java.math.BigDecimal accuracyThreshold = java.math.BigDecimal.valueOf(0.85);

    /**
     * 分布漂移阈值 (熔断器使用)
     * 当分布漂移超过此值时触发熔断
     */
    private java.math.BigDecimal distributionDriftThreshold = java.math.BigDecimal.valueOf(0.10);
}
