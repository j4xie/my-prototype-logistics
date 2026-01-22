package com.cretas.aims.ai.synthetic;

import org.springframework.stereotype.Service;

import com.cretas.aims.ai.synthetic.IntentScenGenerator.SyntheticSample;

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
 * 2. Semantic validation - checks slot values are valid
 * 3. Executability validation - basic sanity check
 */
@Service
public class IntentValidator {

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

    /**
     * Validates that required slots exist in the sample
     * At least TIME or METRIC must be present
     *
     * @param sample the synthetic sample to validate
     * @return true if structure is valid
     */
    public boolean validateStructure(SyntheticSample sample) {
        if (sample == null || sample.getParams() == null) {
            return false;
        }

        Map<String, String> params = sample.getParams();

        // Check if at least TIME or METRIC is present
        boolean hasTime = params.containsKey("TIME") && params.get("TIME") != null
                          && !params.get("TIME").trim().isEmpty();
        boolean hasMetric = params.containsKey("METRIC") && params.get("METRIC") != null
                            && !params.get("METRIC").trim().isEmpty();

        return hasTime || hasMetric;
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
}
