package com.cretas.aims.ai.discriminator;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Result of Flan-T5 discriminator judgment.
 *
 * <p>Contains the judgment result for whether a user input matches a given intent,
 * along with confidence score and diagnostic information.
 *
 * @author Cretas AI Team
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiscriminatorResult {

    /**
     * The intent code being judged
     */
    private String intentCode;

    /**
     * Whether the discriminator judges this as a match (true = 是, false = 否)
     */
    private boolean match;

    /**
     * Confidence score (0.0 to 1.0)
     * For Flan-T5: binary output converted to score (1.0 for 是, 0.0 for 否)
     * For calibrated models: actual probability score
     */
    private double score;

    /**
     * Raw model output (e.g., "是", "否", or full text)
     */
    private String rawOutput;

    /**
     * Inference latency in milliseconds
     */
    private long latencyMs;

    /**
     * Whether this result was served from cache
     */
    private boolean cached;

    /**
     * Timestamp when this judgment was made
     */
    private Instant timestamp;

    /**
     * The prompt used for this judgment (for debugging)
     */
    private String prompt;

    /**
     * Error message if judgment failed
     */
    private String errorMessage;

    /**
     * Whether the judgment was successful (no errors)
     */
    private boolean successful;

    /**
     * Create a successful match result
     */
    public static DiscriminatorResult match(String intentCode, double score, long latencyMs) {
        return DiscriminatorResult.builder()
                .intentCode(intentCode)
                .match(true)
                .score(score)
                .latencyMs(latencyMs)
                .successful(true)
                .timestamp(Instant.now())
                .build();
    }

    /**
     * Create a successful non-match result
     */
    public static DiscriminatorResult noMatch(String intentCode, double score, long latencyMs) {
        return DiscriminatorResult.builder()
                .intentCode(intentCode)
                .match(false)
                .score(score)
                .latencyMs(latencyMs)
                .successful(true)
                .timestamp(Instant.now())
                .build();
    }

    /**
     * Create a failed result with error message
     */
    public static DiscriminatorResult error(String intentCode, String errorMessage) {
        return DiscriminatorResult.builder()
                .intentCode(intentCode)
                .match(false)
                .score(0.0)
                .successful(false)
                .errorMessage(errorMessage)
                .timestamp(Instant.now())
                .build();
    }

    /**
     * Create a cached result
     */
    public DiscriminatorResult asCached() {
        this.cached = true;
        return this;
    }
}
