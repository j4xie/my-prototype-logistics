package com.cretas.aims.dto.intent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Extracted Slots DTO
 *
 * Contains all slots (parameters) extracted from user input,
 * along with metadata about the extraction process.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExtractedSlots {

    /**
     * Map of slot type to extracted value
     * Key: SlotType enum
     * Value: Extracted string value
     */
    @Builder.Default
    private Map<SlotType, String> slots = new HashMap<>();

    /**
     * Parsed time range (if TIME_RANGE slot exists)
     */
    private TimeRange timeRange;

    /**
     * Normalized input (with slot placeholders)
     * Example: "设备{DEVICE_ID}的状态" from "设备EQ001的状态"
     */
    private String normalizedInput;

    /**
     * Original user input
     */
    private String originalInput;

    /**
     * List of extracted slot details with positions
     */
    @Builder.Default
    private List<SlotMatch> slotMatches = new ArrayList<>();

    /**
     * Comparison type details (if COMPARISON slot exists)
     */
    private ComparisonDetails comparisonDetails;

    /**
     * Numeric details (if NUMBER slot exists)
     */
    private NumericDetails numericDetails;

    /**
     * Extraction confidence (0.0 - 1.0)
     */
    @Builder.Default
    private double confidence = 1.0;

    // ==================== Inner Classes ====================

    /**
     * Details about a single slot match
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SlotMatch {
        /**
         * Slot type
         */
        private SlotType slotType;

        /**
         * Extracted value
         */
        private String value;

        /**
         * Start position in original input
         */
        private int startPos;

        /**
         * End position in original input
         */
        private int endPos;

        /**
         * Original matched text
         */
        private String matchedText;

        /**
         * Extraction confidence (0.0 - 1.0)
         */
        @Builder.Default
        private double confidence = 1.0;
    }

    /**
     * Comparison type details
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ComparisonDetails {
        /**
         * Type of comparison
         */
        private ComparisonType type;

        /**
         * Direction (ascending/descending)
         */
        private SortDirection direction;

        /**
         * Original comparison expression
         */
        private String originalExpression;

        public enum ComparisonType {
            RANKING,      // 排名/TOP N
            YOY,          // 同比
            MOM,          // 环比
            QOQ,          // 季环比
            MAX,          // 最高/最大
            MIN,          // 最低/最小
            AVERAGE,      // 平均
            SUM,          // 求和
            COUNT,        // 计数
            TREND,        // 趋势
            CHANGE,       // 变化/增长/下降
            RATIO         // 占比
        }

        public enum SortDirection {
            ASC,          // 升序
            DESC          // 降序
        }
    }

    /**
     * Numeric extraction details
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NumericDetails {
        /**
         * Type of numeric constraint
         */
        private NumericType type;

        /**
         * Numeric value
         */
        private Integer value;

        /**
         * Secondary value (for ranges)
         */
        private Integer secondValue;

        /**
         * Original expression
         */
        private String originalExpression;

        public enum NumericType {
            TOP_N,        // TOP N / 前 N
            BOTTOM_N,     // 倒数 N
            GREATER_THAN, // 大于
            LESS_THAN,    // 小于
            EQUAL,        // 等于
            BETWEEN,      // 区间
            PERCENTAGE    // 百分比
        }
    }

    // ==================== Convenience Methods ====================

    /**
     * Check if a specific slot type was extracted
     */
    public boolean hasSlot(SlotType type) {
        return slots.containsKey(type);
    }

    /**
     * Get slot value by type
     */
    public Optional<String> getSlotValue(SlotType type) {
        return Optional.ofNullable(slots.get(type));
    }

    /**
     * Get slot value or default
     */
    public String getSlotValueOrDefault(SlotType type, String defaultValue) {
        return slots.getOrDefault(type, defaultValue);
    }

    /**
     * Check if any slots were extracted
     */
    public boolean hasAnySlots() {
        return !slots.isEmpty();
    }

    /**
     * Get count of extracted slots
     */
    public int getSlotCount() {
        return slots.size();
    }

    /**
     * Check if this is a ranking/comparison query
     */
    public boolean isRankingQuery() {
        return hasSlot(SlotType.COMPARISON) ||
               (comparisonDetails != null &&
                comparisonDetails.getType() == ComparisonDetails.ComparisonType.RANKING);
    }

    /**
     * Check if this is a time-based comparison (YoY/MoM)
     */
    public boolean isTimeComparison() {
        if (comparisonDetails == null) return false;
        ComparisonDetails.ComparisonType type = comparisonDetails.getType();
        return type == ComparisonDetails.ComparisonType.YOY ||
               type == ComparisonDetails.ComparisonType.MOM ||
               type == ComparisonDetails.ComparisonType.QOQ;
    }

    /**
     * Check if this query has a time constraint
     */
    public boolean hasTimeConstraint() {
        return hasSlot(SlotType.TIME_RANGE) || hasSlot(SlotType.DATE) || timeRange != null;
    }

    /**
     * Check if this is a parameterized entity query
     */
    public boolean isEntityQuery() {
        return hasSlot(SlotType.DEVICE_ID) ||
               hasSlot(SlotType.EMPLOYEE_ID) ||
               hasSlot(SlotType.CUSTOMER_ID) ||
               hasSlot(SlotType.BATCH_ID) ||
               hasSlot(SlotType.ORDER_ID) ||
               hasSlot(SlotType.PRODUCT_ID) ||
               hasSlot(SlotType.SUPPLIER_ID) ||
               hasSlot(SlotType.MATERIAL_ID);
    }

    /**
     * Add a slot value
     */
    public ExtractedSlots addSlot(SlotType type, String value) {
        if (slots == null) {
            slots = new HashMap<>();
        }
        slots.put(type, value);
        return this;
    }

    /**
     * Add a slot match with position info
     */
    public ExtractedSlots addSlotMatch(SlotMatch match) {
        if (slotMatches == null) {
            slotMatches = new ArrayList<>();
        }
        slotMatches.add(match);
        slots.put(match.getSlotType(), match.getValue());
        return this;
    }

    /**
     * Create empty ExtractedSlots
     */
    public static ExtractedSlots empty(String originalInput) {
        return ExtractedSlots.builder()
                .originalInput(originalInput)
                .normalizedInput(originalInput)
                .slots(new HashMap<>())
                .slotMatches(new ArrayList<>())
                .confidence(1.0)
                .build();
    }

    /**
     * Convert slots to Map<String, Object> for integration
     */
    public Map<String, Object> toParameterMap() {
        Map<String, Object> params = new HashMap<>();
        for (Map.Entry<SlotType, String> entry : slots.entrySet()) {
            params.put(entry.getKey().name().toLowerCase(), entry.getValue());
        }
        if (timeRange != null) {
            params.put("startDate", timeRange.getStartDate());
            params.put("endDate", timeRange.getEndDate());
        }
        if (comparisonDetails != null) {
            params.put("comparisonType", comparisonDetails.getType());
            params.put("sortDirection", comparisonDetails.getDirection());
        }
        if (numericDetails != null) {
            params.put("numericType", numericDetails.getType());
            params.put("numericValue", numericDetails.getValue());
        }
        return params;
    }
}
