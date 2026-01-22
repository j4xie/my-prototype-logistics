package com.cretas.aims.ai.synthetic;

import com.cretas.aims.ai.discriminator.DiscriminatorResult;
import com.cretas.aims.ai.discriminator.FlanT5Config;
import com.cretas.aims.ai.discriminator.FlanT5DiscriminatorService;
import com.cretas.aims.ai.synthetic.IntentScenGenerator.SyntheticSample;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Intent Validator Service
 *
 * Validates synthetic samples through three checks:
 * 1. Structure validation - checks required slots exist
 * 2. Semantic validation - checks slot values are valid (enhanced with Flan-T5)
 * 3. Executability validation - basic sanity check
 *
 * <p>v10.0: Added Flan-T5 discriminator support for LLM-based semantic validation.
 */
@Slf4j
@Service
public class IntentValidator {

    @Autowired(required = false)
    private FlanT5DiscriminatorService flanT5Discriminator;

    @Autowired(required = false)
    private FlanT5Config flanT5Config;

    // Valid time expressions in Chinese
    private static final Set<String> VALID_TIME_EXPRESSIONS = Set.of(
        "今天", "本周", "本月", "最近", "上个月", "上周", "昨天",
        "这周", "这个月", "近期", "过去", "去年", "今年", "上半年", "下半年",
        "第一季度", "第二季度", "第三季度", "第四季度", "Q1", "Q2", "Q3", "Q4"
    );

    // Valid metric names in Chinese
    private static final Set<String> VALID_METRICS = Set.of(
        "销售额", "利润", "产量", "订单", "库存", "成本", "收入", "营收",
        "毛利", "净利", "出货量", "入库量", "退货率", "合格率", "良品率",
        "订单量", "客户数", "供应商数", "员工数", "出勤率", "效率"
    );

    /**
     * Validation result containing status and error messages
     */
    public static class ValidationResult {
        private final boolean valid;
        private final List<String> errors;

        private ValidationResult(boolean valid, List<String> errors) {
            this.valid = valid;
            this.errors = errors != null ? errors : new ArrayList<>();
        }

        public boolean isValid() {
            return valid;
        }

        public List<String> getErrors() {
            return errors;
        }

        /**
         * Create a successful validation result
         */
        public static ValidationResult success() {
            return new ValidationResult(true, new ArrayList<>());
        }

        /**
         * Create a failed validation result with error messages
         */
        public static ValidationResult failure(String... errors) {
            return new ValidationResult(false, Arrays.asList(errors));
        }

        /**
         * Create a failed validation result with error list
         */
        public static ValidationResult failure(List<String> errors) {
            return new ValidationResult(false, errors);
        }
    }

    /**
     * Main validation method that runs all three checks
     *
     * @param sample the synthetic sample to validate
     * @return validation result with status and any errors
     */
    public ValidationResult validate(SyntheticSample sample) {
        List<String> allErrors = new ArrayList<>();

        // Run structure validation
        if (!validateStructure(sample)) {
            allErrors.add("Structure validation failed: missing required slots (TIME or METRIC)");
        }

        // Run semantic validation
        if (!validateSemantics(sample)) {
            allErrors.add("Semantic validation failed: invalid slot values");
        }

        // Run executability validation
        if (!validateExecutability(sample)) {
            allErrors.add("Executability validation failed: empty userInput or missing intentCode");
        }

        if (allErrors.isEmpty()) {
            return ValidationResult.success();
        }
        return ValidationResult.failure(allErrors);
    }

    // Intent codes that require TIME or METRIC slots (query-type intents)
    private static final Set<String> QUERY_INTENTS = Set.of(
        "SALES_QUERY", "INVENTORY_QUERY", "PRODUCTION_QUERY", "QUALITY_QUERY",
        "COST_QUERY", "PROFIT_QUERY", "ORDER_QUERY", "REVENUE_QUERY",
        "REPORT_PRODUCTION", "REPORT_SALES", "REPORT_INVENTORY"
    );

    /**
     * Validates that required slots exist in the sample
     * For query-type intents: at least TIME or METRIC must be present
     * For action-type intents: basic structure is sufficient
     *
     * @param sample the synthetic sample to validate
     * @return true if structure is valid
     */
    public boolean validateStructure(SyntheticSample sample) {
        if (sample == null) {
            return false;
        }

        // Basic checks: intentCode must be present
        String intentCode = sample.getIntentCode();
        if (intentCode == null || intentCode.trim().isEmpty()) {
            return false;
        }

        // For non-query intents (action intents like ALERT_ACTIVE), params are optional
        if (!isQueryIntent(intentCode)) {
            return true;  // Action intents don't require TIME/METRIC
        }

        // For query intents, require at least TIME or METRIC
        Map<String, String> params = sample.getParams();
        if (params == null || params.isEmpty()) {
            return false;
        }

        // Check if at least TIME or METRIC is present
        boolean hasTime = params.containsKey("TIME") && params.get("TIME") != null
                          && !params.get("TIME").trim().isEmpty();
        boolean hasMetric = params.containsKey("METRIC") && params.get("METRIC") != null
                            && !params.get("METRIC").trim().isEmpty();

        return hasTime || hasMetric;
    }

    /**
     * Check if the intent is a query-type intent that requires TIME/METRIC slots
     */
    private boolean isQueryIntent(String intentCode) {
        if (intentCode == null) {
            return false;
        }
        // Check exact match first
        if (QUERY_INTENTS.contains(intentCode)) {
            return true;
        }
        // Check if it contains QUERY or REPORT keywords
        String upper = intentCode.toUpperCase();
        return upper.contains("QUERY") || upper.contains("REPORT") || upper.contains("ANALYSIS");
    }

    /**
     * Validates that slot values are semantically valid
     * - TIME slot: must be parseable (contains valid time expressions)
     * - METRIC slot: must be a valid metric name
     *
     * @param sample the synthetic sample to validate
     * @return true if semantics are valid
     */
    public boolean validateSemantics(SyntheticSample sample) {
        if (sample == null || sample.getParams() == null) {
            return true; // No params to validate
        }

        Map<String, String> params = sample.getParams();

        // Validate TIME slot if present
        if (params.containsKey("TIME")) {
            String timeValue = params.get("TIME");
            if (timeValue != null && !timeValue.trim().isEmpty()) {
                if (!isValidTimeExpression(timeValue)) {
                    return false;
                }
            }
        }

        // Validate METRIC slot if present
        if (params.containsKey("METRIC")) {
            String metricValue = params.get("METRIC");
            if (metricValue != null && !metricValue.trim().isEmpty()) {
                if (!isValidMetric(metricValue)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Basic sanity check for executability
     * - userInput must not be empty
     * - intentCode must be set
     *
     * @param sample the synthetic sample to validate
     * @return true if sample is executable
     */
    public boolean validateExecutability(SyntheticSample sample) {
        if (sample == null) {
            return false;
        }

        // Check userInput is not empty
        String userInput = sample.getUserInput();
        if (userInput == null || userInput.trim().isEmpty()) {
            return false;
        }

        // Check intentCode is set
        String intentCode = sample.getIntentCode();
        if (intentCode == null || intentCode.trim().isEmpty()) {
            return false;
        }

        return true;
    }

    /**
     * Check if the time value contains a valid time expression
     */
    private boolean isValidTimeExpression(String timeValue) {
        String normalized = timeValue.trim();

        // Check if the value contains any valid time expression
        for (String validExpr : VALID_TIME_EXPRESSIONS) {
            if (normalized.contains(validExpr)) {
                return true;
            }
        }

        // Also accept date patterns like YYYY-MM-DD or YYYY年MM月
        if (normalized.matches(".*\\d{4}[-/年]\\d{1,2}[-/月].*")) {
            return true;
        }

        // Accept numeric ranges like "最近7天", "近30天"
        if (normalized.matches(".*[最近]\\d+[天周月年].*")) {
            return true;
        }

        return false;
    }

    /**
     * Check if the metric value is a valid metric name
     */
    private boolean isValidMetric(String metricValue) {
        String normalized = metricValue.trim();

        // Direct match
        if (VALID_METRICS.contains(normalized)) {
            return true;
        }

        // Check if the value contains any valid metric
        for (String validMetric : VALID_METRICS) {
            if (normalized.contains(validMetric)) {
                return true;
            }
        }

        return false;
    }

    // ==================== v10.0: Flan-T5 Enhanced Validation ====================

    /**
     * v10.0: Validate semantic coherence using Flan-T5 discriminator.
     *
     * <p>This method uses the LLM to determine if the user input semantically
     * matches the expected intent, going beyond rule-based validation.
     *
     * @param sample the synthetic sample to validate
     * @return true if semantically coherent, false otherwise
     */
    public boolean validateSemanticsWithLLM(SyntheticSample sample) {
        if (!useFlanT5Discriminator() || sample == null) {
            // Fall back to rule-based validation when discriminator unavailable
            return validateSemantics(sample);
        }

        try {
            DiscriminatorResult result = flanT5Discriminator.judge(
                    sample.getUserInput(),
                    sample.getIntentCode()
            );

            if (!result.isSuccessful()) {
                log.warn("IntentValidator/Flan-T5: Semantic validation failed for '{}': {}",
                        truncate(sample.getUserInput(), 50),
                        result.getErrorMessage());
                return validateSemantics(sample); // Fallback
            }

            // Use threshold of 0.6 for semantic coherence
            boolean isCoherent = result.getScore() >= 0.6;

            if (log.isDebugEnabled()) {
                log.debug("IntentValidator/Flan-T5: Semantic validation for '{}', " +
                                "intent={}, score={:.4f}, coherent={}",
                        truncate(sample.getUserInput(), 50),
                        sample.getIntentCode(),
                        result.getScore(),
                        isCoherent);
            }

            return isCoherent;

        } catch (Exception e) {
            log.warn("IntentValidator/Flan-T5: Error during semantic validation: {}",
                    e.getMessage());
            return validateSemantics(sample); // Fallback to rule-based
        }
    }

    /**
     * v10.0: Extended validation that includes LLM semantic check.
     *
     * @param sample the synthetic sample to validate
     * @return validation result with status and any errors
     */
    public ValidationResult validateWithLLM(SyntheticSample sample) {
        List<String> allErrors = new ArrayList<>();

        // Run structure validation
        if (!validateStructure(sample)) {
            allErrors.add("Structure validation failed: missing required slots (TIME or METRIC)");
        }

        // Run semantic validation (LLM-enhanced)
        if (useFlanT5Discriminator()) {
            if (!validateSemanticsWithLLM(sample)) {
                allErrors.add("Semantic validation (LLM) failed: input does not match intent semantically");
            }
        } else {
            if (!validateSemantics(sample)) {
                allErrors.add("Semantic validation failed: invalid slot values");
            }
        }

        // Run executability validation
        if (!validateExecutability(sample)) {
            allErrors.add("Executability validation failed: empty userInput or missing intentCode");
        }

        if (allErrors.isEmpty()) {
            return ValidationResult.success();
        }
        return ValidationResult.failure(allErrors);
    }

    /**
     * Check if Flan-T5 discriminator is available.
     */
    private boolean useFlanT5Discriminator() {
        return flanT5Config != null
                && flanT5Config.isEnabled()
                && flanT5Discriminator != null;
    }

    /**
     * Truncate string for logging.
     */
    private String truncate(String s, int maxLen) {
        if (s == null) return "null";
        return s.length() > maxLen ? s.substring(0, maxLen - 3) + "..." : s;
    }
}
