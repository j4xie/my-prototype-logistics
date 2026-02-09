package com.cretas.aims.service;

import com.cretas.aims.dto.intent.ExtractedSlots;
import com.cretas.aims.dto.intent.ExtractedSlots.ComparisonDetails;
import com.cretas.aims.dto.intent.ExtractedSlots.NumericDetails;
import com.cretas.aims.dto.intent.SlotType;
import com.cretas.aims.service.TwoStageIntentClassifier.ClassifiedDomain;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Comparison Query Handler
 *
 * Handles ranking and comparison type queries that require special processing.
 * Works in conjunction with SlotExtractor to refine intent classification
 * for queries like "销量最高的产品" or "本月同比增长".
 *
 * <p>Key Features:</p>
 * <ul>
 *   <li>Ranking query detection and intent mapping</li>
 *   <li>YoY/MoM/QoQ comparison handling</li>
 *   <li>Domain-specific intent determination</li>
 *   <li>Modifier generation for TwoStageIntentClassifier</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ComparisonQueryHandler {

    /**
     * Domain to ranking intent mapping
     * Maps domain name to the corresponding ranking intent code
     */
    private static final Map<String, String> DOMAIN_RANKING_INTENTS = new HashMap<>();

    /**
     * Domain to YoY intent mapping
     */
    private static final Map<String, String> DOMAIN_YOY_INTENTS = new HashMap<>();

    /**
     * Domain to MoM intent mapping
     */
    private static final Map<String, String> DOMAIN_MOM_INTENTS = new HashMap<>();

    /**
     * Domain to stats intent mapping
     */
    private static final Map<String, String> DOMAIN_STATS_INTENTS = new HashMap<>();

    static {
        // Ranking intents
        DOMAIN_RANKING_INTENTS.put("ORDER", "ORDER_RANKING");
        DOMAIN_RANKING_INTENTS.put("CUSTOMER", "CUSTOMER_RANKING");
        DOMAIN_RANKING_INTENTS.put("SUPPLIER", "SUPPLIER_RANKING");
        DOMAIN_RANKING_INTENTS.put("MATERIAL", "MATERIAL_RANKING");
        DOMAIN_RANKING_INTENTS.put("PROCESSING", "PROCESSING_RANKING");
        DOMAIN_RANKING_INTENTS.put("EQUIPMENT", "EQUIPMENT_RANKING");
        DOMAIN_RANKING_INTENTS.put("QUALITY", "QUALITY_RANKING");
        DOMAIN_RANKING_INTENTS.put("ATTENDANCE", "ATTENDANCE_RANKING");
        DOMAIN_RANKING_INTENTS.put("SHIPMENT", "SHIPMENT_RANKING");

        // YoY intents
        DOMAIN_YOY_INTENTS.put("ORDER", "ORDER_YOY_ANALYSIS");
        DOMAIN_YOY_INTENTS.put("MATERIAL", "MATERIAL_YOY_ANALYSIS");
        DOMAIN_YOY_INTENTS.put("PROCESSING", "PROCESSING_YOY_ANALYSIS");
        DOMAIN_YOY_INTENTS.put("QUALITY", "QUALITY_YOY_ANALYSIS");
        DOMAIN_YOY_INTENTS.put("ATTENDANCE", "ATTENDANCE_YOY_ANALYSIS");

        // MoM intents
        DOMAIN_MOM_INTENTS.put("ORDER", "ORDER_MOM_ANALYSIS");
        DOMAIN_MOM_INTENTS.put("MATERIAL", "MATERIAL_MOM_ANALYSIS");
        DOMAIN_MOM_INTENTS.put("PROCESSING", "PROCESSING_MOM_ANALYSIS");
        DOMAIN_MOM_INTENTS.put("QUALITY", "QUALITY_MOM_ANALYSIS");
        DOMAIN_MOM_INTENTS.put("ATTENDANCE", "ATTENDANCE_MOM_ANALYSIS");

        // Stats intents
        DOMAIN_STATS_INTENTS.put("ORDER", "ORDER_STATS");
        DOMAIN_STATS_INTENTS.put("CUSTOMER", "CUSTOMER_STATS");
        DOMAIN_STATS_INTENTS.put("SUPPLIER", "SUPPLIER_STATS");
        DOMAIN_STATS_INTENTS.put("MATERIAL", "MATERIAL_STATS");
        DOMAIN_STATS_INTENTS.put("PROCESSING", "PROCESSING_STATS");
        DOMAIN_STATS_INTENTS.put("EQUIPMENT", "EQUIPMENT_STATS");
        DOMAIN_STATS_INTENTS.put("QUALITY", "QUALITY_STATS");
        DOMAIN_STATS_INTENTS.put("ATTENDANCE", "ATTENDANCE_STATS");
        DOMAIN_STATS_INTENTS.put("SHIPMENT", "SHIPMENT_STATS");
    }

    // ==================== Public Methods ====================

    /**
     * Check if the query is a ranking-type query
     *
     * @param input User input text
     * @param slots Extracted slots from input
     * @return true if this is a ranking query
     */
    public boolean isRankingQuery(String input, ExtractedSlots slots) {
        if (slots == null) {
            return false;
        }

        // Check comparison details
        ComparisonDetails details = slots.getComparisonDetails();
        if (details != null) {
            ComparisonDetails.ComparisonType type = details.getType();
            return type == ComparisonDetails.ComparisonType.RANKING ||
                   type == ComparisonDetails.ComparisonType.MAX ||
                   type == ComparisonDetails.ComparisonType.MIN;
        }

        // Check numeric details for TOP_N / BOTTOM_N
        NumericDetails numDetails = slots.getNumericDetails();
        if (numDetails != null) {
            NumericDetails.NumericType numType = numDetails.getType();
            return numType == NumericDetails.NumericType.TOP_N ||
                   numType == NumericDetails.NumericType.BOTTOM_N;
        }

        return false;
    }

    /**
     * Check if the query is a time-based comparison query (YoY/MoM/QoQ)
     *
     * @param input User input text
     * @param slots Extracted slots from input
     * @return true if this is a comparison query
     */
    public boolean isComparisonQuery(String input, ExtractedSlots slots) {
        if (slots == null) {
            return false;
        }

        ComparisonDetails details = slots.getComparisonDetails();
        if (details == null) {
            return false;
        }

        ComparisonDetails.ComparisonType type = details.getType();
        return type == ComparisonDetails.ComparisonType.YOY ||
               type == ComparisonDetails.ComparisonType.MOM ||
               type == ComparisonDetails.ComparisonType.QOQ ||
               type == ComparisonDetails.ComparisonType.TREND ||
               type == ComparisonDetails.ComparisonType.CHANGE;
    }

    /**
     * Check if the query is a stats/aggregation query
     *
     * @param input User input text
     * @param slots Extracted slots from input
     * @return true if this is a stats query
     */
    public boolean isStatsQuery(String input, ExtractedSlots slots) {
        if (slots == null) {
            return false;
        }

        // Check for metrics that typically indicate stats queries
        if (slots.hasSlot(SlotType.METRIC)) {
            String metric = slots.getSlotValue(SlotType.METRIC).orElse("");
            // Stats-related metrics
            return metric.matches(".*(率|量|额|值|数)$");
        }

        // Check comparison details for aggregate types
        ComparisonDetails details = slots.getComparisonDetails();
        if (details != null) {
            ComparisonDetails.ComparisonType type = details.getType();
            return type == ComparisonDetails.ComparisonType.SUM ||
                   type == ComparisonDetails.ComparisonType.AVERAGE ||
                   type == ComparisonDetails.ComparisonType.COUNT ||
                   type == ComparisonDetails.ComparisonType.RATIO;
        }

        return false;
    }

    /**
     * Determine the specific intent based on domain and extracted slots
     *
     * @param domain Classified domain from TwoStageIntentClassifier
     * @param slots  Extracted slots from input
     * @return Intent code or null if no special handling needed
     */
    public String determineIntent(String domain, ExtractedSlots slots) {
        if (domain == null || slots == null) {
            return null;
        }

        String domainUpper = domain.toUpperCase();

        // Check for YoY comparison
        if (isYoyQuery(slots)) {
            String intent = DOMAIN_YOY_INTENTS.get(domainUpper);
            if (intent != null) {
                log.debug("YoY query detected for domain {}: {}", domain, intent);
                return intent;
            }
        }

        // Check for MoM comparison
        if (isMomQuery(slots)) {
            String intent = DOMAIN_MOM_INTENTS.get(domainUpper);
            if (intent != null) {
                log.debug("MoM query detected for domain {}: {}", domain, intent);
                return intent;
            }
        }

        // Check for ranking query
        if (isRankingQuery(null, slots)) {
            String intent = DOMAIN_RANKING_INTENTS.get(domainUpper);
            if (intent != null) {
                log.debug("Ranking query detected for domain {}: {}", domain, intent);
                return intent;
            }
        }

        // Check for stats query
        if (isStatsQuery(null, slots)) {
            String intent = DOMAIN_STATS_INTENTS.get(domainUpper);
            if (intent != null) {
                log.debug("Stats query detected for domain {}: {}", domain, intent);
                return intent;
            }
        }

        return null;
    }

    /**
     * Determine the specific intent based on domain enum and extracted slots
     *
     * @param domain Classified domain enum
     * @param slots  Extracted slots from input
     * @return Intent code or null if no special handling needed
     */
    public String determineIntent(ClassifiedDomain domain, ExtractedSlots slots) {
        if (domain == null || domain == ClassifiedDomain.UNKNOWN) {
            return null;
        }
        return determineIntent(domain.name(), slots);
    }

    /**
     * Generate modifiers for TwoStageIntentClassifier based on extracted slots
     *
     * @param slots Extracted slots from input
     * @return Set of modifier strings for IntentCompositionConfig
     */
    public Set<String> generateModifiers(ExtractedSlots slots) {
        Set<String> modifiers = new HashSet<>();

        if (slots == null) {
            return modifiers;
        }

        ComparisonDetails compDetails = slots.getComparisonDetails();
        if (compDetails != null) {
            switch (compDetails.getType()) {
                case RANKING:
                case MAX:
                case MIN:
                    modifiers.add("RANKING");
                    break;
                case YOY:
                    modifiers.add("YOY");
                    break;
                case MOM:
                    modifiers.add("MOM");
                    break;
                case QOQ:
                    modifiers.add("QOQ");
                    break;
                case TREND:
                case CHANGE:
                    modifiers.add("COMPARISON");
                    break;
                case SUM:
                case AVERAGE:
                case COUNT:
                case RATIO:
                    modifiers.add("STATS");
                    modifiers.add("AGGREGATION");
                    break;
            }
        }

        NumericDetails numDetails = slots.getNumericDetails();
        if (numDetails != null) {
            switch (numDetails.getType()) {
                case TOP_N:
                case BOTTOM_N:
                    modifiers.add("RANKING");
                    break;
                case PERCENTAGE:
                    modifiers.add("STATS");
                    break;
            }
        }

        // Add time-based modifiers
        if (slots.getTimeRange() != null) {
            if (slots.getTimeRange().isFuture()) {
                modifiers.add("FUTURE");
            }
        }

        // Add stats modifier if metric is present
        if (slots.hasSlot(SlotType.METRIC)) {
            modifiers.add("STATS");
        }

        log.debug("Generated modifiers from slots: {}", modifiers);
        return modifiers;
    }

    /**
     * Analyze query and return comprehensive analysis result
     *
     * @param input User input text
     * @param slots Extracted slots
     * @param domain Classified domain
     * @return QueryAnalysis with all relevant information
     */
    public QueryAnalysis analyzeQuery(String input, ExtractedSlots slots, ClassifiedDomain domain) {
        QueryAnalysis.QueryAnalysisBuilder builder = QueryAnalysis.builder()
                .originalInput(input)
                .domain(domain)
                .extractedSlots(slots);

        // Determine query type
        if (isRankingQuery(input, slots)) {
            builder.queryType(QueryType.RANKING);
        } else if (isComparisonQuery(input, slots)) {
            builder.queryType(QueryType.COMPARISON);
        } else if (isStatsQuery(input, slots)) {
            builder.queryType(QueryType.STATS);
        } else if (slots != null && slots.isEntityQuery()) {
            builder.queryType(QueryType.ENTITY_LOOKUP);
        } else {
            builder.queryType(QueryType.GENERAL);
        }

        // Generate modifiers
        Set<String> modifiers = generateModifiers(slots);
        builder.modifiers(modifiers);

        // Determine intent
        String suggestedIntent = determineIntent(domain, slots);
        builder.suggestedIntent(suggestedIntent);

        // Set parameters
        if (slots != null) {
            builder.parameters(slots.toParameterMap());
        }

        return builder.build();
    }

    // ==================== Private Helper Methods ====================

    private boolean isYoyQuery(ExtractedSlots slots) {
        if (slots == null || slots.getComparisonDetails() == null) {
            return false;
        }
        return slots.getComparisonDetails().getType() == ComparisonDetails.ComparisonType.YOY;
    }

    private boolean isMomQuery(ExtractedSlots slots) {
        if (slots == null || slots.getComparisonDetails() == null) {
            return false;
        }
        return slots.getComparisonDetails().getType() == ComparisonDetails.ComparisonType.MOM;
    }

    // ==================== Inner Classes ====================

    /**
     * Query type classification
     */
    public enum QueryType {
        /**
         * Ranking/Top-N query
         * Example: "销量最高的产品", "前10名客户"
         */
        RANKING,

        /**
         * Time-based comparison query
         * Example: "同比增长", "环比变化"
         */
        COMPARISON,

        /**
         * Statistics/aggregation query
         * Example: "本月销售额", "平均合格率"
         */
        STATS,

        /**
         * Entity lookup query
         * Example: "设备EQ001的状态", "订单O123的详情"
         */
        ENTITY_LOOKUP,

        /**
         * General query (no special type)
         */
        GENERAL
    }

    /**
     * Comprehensive query analysis result
     */
    @Data
    @Builder
    @AllArgsConstructor
    public static class QueryAnalysis {
        /**
         * Original user input
         */
        private String originalInput;

        /**
         * Classified domain
         */
        private ClassifiedDomain domain;

        /**
         * Determined query type
         */
        private QueryType queryType;

        /**
         * Extracted slots
         */
        private ExtractedSlots extractedSlots;

        /**
         * Generated modifiers for intent composition
         */
        private Set<String> modifiers;

        /**
         * Suggested intent code based on analysis
         */
        private String suggestedIntent;

        /**
         * Extracted parameters as map
         */
        private Map<String, Object> parameters;

        /**
         * Check if this query requires special handling
         */
        public boolean requiresSpecialHandling() {
            return queryType != QueryType.GENERAL;
        }

        /**
         * Check if intent was determined
         */
        public boolean hasIntent() {
            return suggestedIntent != null && !suggestedIntent.isEmpty();
        }
    }
}
