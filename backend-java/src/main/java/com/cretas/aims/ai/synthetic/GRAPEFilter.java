package com.cretas.aims.ai.synthetic;

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
     * <p>The scoring logic:
     * <ul>
     *   <li>Use AIIntentService to recognize the intent from the sample's userInput</li>
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

        // Use AIIntentService matching
        return scoreSampleWithIntentService(sample);
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

            // If no match found, try fallback scoring
            if (matchResult == null || matchResult.getBestMatch() == null) {
                log.trace("GRAPE: No match found for input '{}', trying fallback",
                        truncateForLog(sample.getUserInput()));
                return scoreSampleWithFallback(sample);
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
            log.warn("GRAPE: Error scoring sample '{}': {}, trying fallback",
                    truncateForLog(sample.getUserInput()),
                    e.getMessage());
            return scoreSampleWithFallback(sample);
        }
    }

    /**
     * Fallback scoring when Embedding/IntentService is unavailable.
     * Uses keyword-based heuristic scoring.
     *
     * @param sample the synthetic sample to score
     * @return heuristic confidence score (0.0 to 1.0)
     */
    private double scoreSampleWithFallback(SyntheticSample sample) {
        // Always use keyword-based heuristic as fallback
        // This ensures synthetic samples get scored even when intent service fails
        log.debug("GRAPE using keyword-based fallback for sample: {}", truncateForLog(sample.getUserInput()));

        // Fallback: Use keyword-based heuristic
        // Score based on presence of domain-specific keywords in user input
        String userInput = sample.getUserInput().toLowerCase();
        String intentCode = sample.getIntentCode().toLowerCase();

        double score = 0.0;

        // Extract domain from intentCode (e.g., "MATERIAL_QUERY" -> "material")
        String[] intentParts = intentCode.split("_");
        if (intentParts.length > 0) {
            String domain = intentParts[0];

            // Domain keyword mapping for Chinese - comprehensive coverage
            java.util.Map<String, String[]> domainKeywords = new java.util.HashMap<>();
            domainKeywords.put("material", new String[]{"原料", "材料", "物料", "原材料", "批次", "库存"});
            domainKeywords.put("processing", new String[]{"加工", "生产", "批次", "工序", "任务"});
            domainKeywords.put("production", new String[]{"生产", "产量", "产线", "制造", "产出"});
            domainKeywords.put("equipment", new String[]{"设备", "机器", "机台", "设施", "维护"});
            domainKeywords.put("quality", new String[]{"质量", "质检", "品质", "检验", "合格"});
            domainKeywords.put("inventory", new String[]{"库存", "仓库", "存量", "库房", "盘点"});
            domainKeywords.put("order", new String[]{"订单", "工单", "任务单", "发货"});
            domainKeywords.put("trace", new String[]{"溯源", "追溯", "追踪", "批次", "来源"});
            domainKeywords.put("scheduling", new String[]{"排产", "排程", "调度", "计划", "安排"});
            domainKeywords.put("alert", new String[]{"告警", "预警", "警报", "异常", "提醒"});
            domainKeywords.put("report", new String[]{"报表", "报告", "统计", "分析", "汇总"});
            domainKeywords.put("supplier", new String[]{"供应商", "供货商", "供应", "采购"});
            domainKeywords.put("customer", new String[]{"客户", "顾客", "买家", "用户"});
            domainKeywords.put("shipment", new String[]{"发货", "物流", "运输", "配送", "出货"});
            domainKeywords.put("attendance", new String[]{"考勤", "打卡", "出勤", "签到", "签退"});
            domainKeywords.put("scale", new String[]{"称重", "秤", "重量", "计量"});
            domainKeywords.put("form", new String[]{"表单", "表格", "填写", "录入"});
            domainKeywords.put("user", new String[]{"用户", "员工", "人员", "账号"});
            domainKeywords.put("factory", new String[]{"工厂", "车间", "产线", "设置"});
            domainKeywords.put("cost", new String[]{"成本", "费用", "花费", "支出"});
            domainKeywords.put("conversion", new String[]{"转化", "换算", "转换", "比例"});
            domainKeywords.put("rule", new String[]{"规则", "配置", "设定", "策略"});
            domainKeywords.put("intent", new String[]{"意图", "识别", "分析", "创建"});
            domainKeywords.put("plan", new String[]{"计划", "规划", "安排", "预定"});

            String[] keywords = domainKeywords.get(domain);
            if (keywords != null) {
                for (String keyword : keywords) {
                    if (userInput.contains(keyword)) {
                        score += 0.25; // Each keyword adds 0.25
                    }
                }
            }

            // Action type bonus
            if (intentCode.contains("query") || intentCode.contains("list") || intentCode.contains("get")) {
                if (userInput.contains("查") || userInput.contains("看") ||
                    userInput.contains("显示") || userInput.contains("列出")) {
                    score += 0.2;
                }
            } else if (intentCode.contains("create") || intentCode.contains("add") || intentCode.contains("update")) {
                if (userInput.contains("创建") || userInput.contains("添加") ||
                    userInput.contains("修改") || userInput.contains("更新")) {
                    score += 0.2;
                }
            }
        }

        // Cap at 0.7 (lower than semantic matching to indicate lower confidence)
        score = Math.min(score, 0.7);

        log.trace("GRAPE fallback: input='{}', intent={}, score={:.4f}",
                truncateForLog(userInput), intentCode, score);

        return score;
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
