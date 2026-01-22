package com.cretas.aims.ai.synthetic;

import com.cretas.aims.ai.discriminator.DiscriminatorResult;
import com.cretas.aims.ai.discriminator.FlanT5Config;
import com.cretas.aims.ai.discriminator.FlanT5DiscriminatorService;
import com.cretas.aims.ai.synthetic.IntentScenGenerator.SyntheticSample;
import com.cretas.aims.config.SyntheticDataConfig;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.EmbeddingClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * GRAPE (Generative Retrieval-Augmented Prompt Engineering) Filter Service.
 *
 * <p>This service filters synthetic samples using the GRAPE strategy, which
 * keeps only the samples that the current intent matching model finds likely.
 * The key insight is that synthetic samples which the model already recognizes
 * correctly are more likely to reinforce correct behavior, while samples the
 * model cannot recognize may introduce noise.
 *
 * <p>GRAPE filtering process:
 * <ol>
 *   <li>Score each synthetic sample using the current intent matching model</li>
 *   <li>Sort samples by score in descending order</li>
 *   <li>Keep only the top threshold% of samples (configured via grapeThreshold)</li>
 *   <li>Set the grapeScore on each kept sample for downstream use</li>
 * </ol>
 *
 * <p>Example usage:
 * <pre>
 * List&lt;SyntheticSample&gt; candidates = generator.generate(intentCode, 100);
 * List&lt;SyntheticSample&gt; filtered = grapeFilter.filter(candidates);
 * // filtered contains top 30% (default) of candidates by model confidence
 * </pre>
 *
 * @author Cretas AI Team
 * @since 1.0.0
 * @see SyntheticDataConfig#getGrapeThreshold()
 * @see IntentScenGenerator.SyntheticSample
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GRAPEFilter {

    private final SyntheticDataConfig syntheticDataConfig;
    private final AIIntentService aiIntentService;

    @Autowired(required = false)
    private FlanT5DiscriminatorService flanT5Discriminator;

    @Autowired(required = false)
    private FlanT5Config flanT5Config;

    @Autowired
    private EmbeddingClient embeddingClient;

    /**
     * Internal record to hold a sample with its computed score.
     *
     * @param sample the synthetic sample being scored
     * @param score  the model confidence score (0.0 to 1.0)
     */
    public record ScoredSample(SyntheticSample sample, double score) {}

    /**
     * Filters synthetic samples using the GRAPE strategy.
     *
     * <p>The filtering process:
     * <ol>
     *   <li>Score each candidate sample using {@link #scoreSample(SyntheticSample)}</li>
     *   <li>Sort all samples by score in descending order</li>
     *   <li>Keep only the top threshold% of samples</li>
     *   <li>Set the grapeScore field on each kept sample</li>
     * </ol>
     *
     * <p>Samples with a score of 0 (where the model predicted the wrong intent)
     * are typically filtered out unless the threshold is very high.
     *
     * @param candidates the list of synthetic samples to filter
     * @return filtered list containing only the top-scoring samples
     */
    public List<SyntheticSample> filter(List<SyntheticSample> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            log.debug("GRAPE filter received empty candidate list, returning empty");
            return List.of();
        }

        double threshold = syntheticDataConfig.getGrapeThreshold();
        log.info("GRAPE filtering {} candidates with threshold {}", candidates.size(), threshold);

        // Score all samples
        List<ScoredSample> scoredSamples = candidates.stream()
                .map(sample -> new ScoredSample(sample, scoreSample(sample)))
                .sorted(Comparator.comparingDouble(ScoredSample::score).reversed())
                .collect(Collectors.toList());

        // Calculate how many samples to keep
        int keepCount = (int) Math.ceil(candidates.size() * threshold);
        keepCount = Math.max(1, keepCount); // Keep at least 1 sample

        log.debug("GRAPE keeping top {} samples out of {}", keepCount, candidates.size());

        // Keep top threshold% and set grapeScore on each
        List<SyntheticSample> filtered = scoredSamples.stream()
                .limit(keepCount)
                .map(scoredSample -> {
                    SyntheticSample sample = scoredSample.sample();
                    sample.setGrapeScore(BigDecimal.valueOf(scoredSample.score()));
                    return sample;
                })
                .collect(Collectors.toList());

        // Log statistics
        if (log.isDebugEnabled()) {
            double avgScore = scoredSamples.stream()
                    .limit(keepCount)
                    .mapToDouble(ScoredSample::score)
                    .average()
                    .orElse(0.0);
            double minScore = scoredSamples.stream()
                    .limit(keepCount)
                    .mapToDouble(ScoredSample::score)
                    .min()
                    .orElse(0.0);
            log.debug("GRAPE filter stats: kept={}, avgScore={:.4f}, minScore={:.4f}",
                    filtered.size(), avgScore, minScore);
        }

        log.info("GRAPE filter completed: {} -> {} samples", candidates.size(), filtered.size());
        return filtered;
    }

    /**
     * Scores a synthetic sample using the current intent matching model.
     *
     * <p>The scoring logic (with Flan-T5 enhancement):
     * <ul>
     *   <li>If Flan-T5 is enabled, use discriminator for more precise judgment</li>
     *   <li>Otherwise, use AIIntentService to recognize the intent from the sample's userInput</li>
     *   <li>If the matched intent code equals the sample's expected intentCode,
     *       return the confidence score</li>
     *   <li>Otherwise, return 0 (the model predicted the wrong intent)</li>
     * </ul>
     *
     * <p>This ensures that only samples where the model "agrees" with the expected
     * label (and with high confidence) are retained for training.
     *
     * @param sample the synthetic sample to score
     * @return confidence score (0.0 to 1.0), or 0 if intent mismatch
     */
    public double scoreSample(SyntheticSample sample) {
        if (sample == null || sample.getUserInput() == null || sample.getIntentCode() == null) {
            log.warn("GRAPE received invalid sample: null or missing required fields");
            return 0.0;
        }

        // v10.0: Use Flan-T5 discriminator if enabled
        if (useFlanT5Discriminator()) {
            return scoreSampleWithFlanT5(sample);
        }

        // Fallback to original AIIntentService matching
        return scoreSampleWithIntentService(sample);
    }

    /**
     * Check if Flan-T5 discriminator should be used.
     */
    private boolean useFlanT5Discriminator() {
        return flanT5Config != null
                && flanT5Config.isEnabled()
                && flanT5Discriminator != null;
    }

    /**
     * Score sample using Flan-T5 discriminator (v10.0 enhancement).
     *
     * @param sample the synthetic sample to score
     * @return confidence score from discriminator
     */
    private double scoreSampleWithFlanT5(SyntheticSample sample) {
        try {
            DiscriminatorResult result = flanT5Discriminator.judge(
                    sample.getUserInput(),
                    sample.getIntentCode()
            );

            if (!result.isSuccessful()) {
                log.trace("GRAPE/Flan-T5: Judgment failed for '{}', intent={}: {}",
                        truncateForLog(sample.getUserInput()),
                        sample.getIntentCode(),
                        result.getErrorMessage());
                return 0.0;
            }

            double score = result.getScore();
            log.trace("GRAPE/Flan-T5: Scored '{}' for intent={}, score={:.4f}",
                    truncateForLog(sample.getUserInput()),
                    sample.getIntentCode(),
                    score);
            return score;

        } catch (Exception e) {
            log.warn("GRAPE/Flan-T5: Error scoring sample '{}': {}",
                    truncateForLog(sample.getUserInput()),
                    e.getMessage());
            // Fallback to intent service on error
            return scoreSampleWithIntentService(sample);
        }
    }

    /**
     * Score sample using original AIIntentService matching.
     *
     * @param sample the synthetic sample to score
     * @return confidence score from intent service
     */
    private double scoreSampleWithIntentService(SyntheticSample sample) {
        try {
            // Use the intent service to match the sample's user input
            IntentMatchResult matchResult = aiIntentService.recognizeIntentWithConfidence(
                    sample.getUserInput()
            );

            // If no match found, score is 0
            if (matchResult == null || matchResult.getBestMatch() == null) {
                log.trace("GRAPE: No match found for input '{}', score=0",
                        truncateForLog(sample.getUserInput()));
                return 0.0;
            }

            AIIntentConfig bestMatch = matchResult.getBestMatch();
            String matchedIntentCode = bestMatch.getIntentCode();

            // Check if the matched intent matches the expected intent
            if (sample.getIntentCode().equals(matchedIntentCode)) {
                double confidence = matchResult.getConfidence() != null
                        ? matchResult.getConfidence()
                        : 0.0;
                log.trace("GRAPE: Intent match for '{}': expected={}, matched={}, confidence={:.4f}",
                        truncateForLog(sample.getUserInput()),
                        sample.getIntentCode(),
                        matchedIntentCode,
                        confidence);
                return confidence;
            } else {
                log.trace("GRAPE: Intent mismatch for '{}': expected={}, matched={}, score=0",
                        truncateForLog(sample.getUserInput()),
                        sample.getIntentCode(),
                        matchedIntentCode);
                return 0.0;
            }
        } catch (Exception e) {
            log.warn("GRAPE: Error scoring sample '{}': {}",
                    truncateForLog(sample.getUserInput()),
                    e.getMessage());
            return 0.0;
        }
    }

    /**
     * Truncates a string for logging purposes.
     *
     * @param input the input string
     * @return truncated string (max 50 chars)
     */
    private String truncateForLog(String input) {
        if (input == null) {
            return "null";
        }
        return input.length() > 50 ? input.substring(0, 47) + "..." : input;
    }
}
