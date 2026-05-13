package com.cretas.aims.ai.tool.impl.restaurant;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Normalizes user-facing meal-period names (from LLM input) to the enum
 * values stored in {@code fact_pos_transaction.meal_period}.
 *
 * <p>Spec §5.5 (LLM input → Java normalization → Python passive consumer):
 * Vue UI only exposes 午市/晚市; LLM may emit synonyms (下午茶 / 夜宵) which
 * this util folds to the canonical enum before forwarding to Python /prepare.
 *
 * <p>Unknown input → IllegalArgumentException so the Tool layer can surface a
 * structured error to the user ("班次参数错误: …") rather than silently
 * passing an unrecognized value downstream.
 *
 * @author Cretas Team
 * @since 2026-05-13
 */
public final class MealPeriodNormalizer {

    /** Insertion-ordered so the error message lists in a stable, useful order. */
    private static final Map<String, String> MAP = new LinkedHashMap<>();
    static {
        MAP.put("午市", "午市");
        MAP.put("晚市", "晚市");
        MAP.put("下午茶", "午市");
        MAP.put("夜宵", "晚市");
        MAP.put("晚宵", "晚市");
    }

    private MealPeriodNormalizer() {}

    /**
     * Normalize a list of natural-language meal periods to canonical enum.
     *
     * @param input list from LLM (may be empty or null)
     * @return canonical list, distinct, preserving first-seen order
     * @throws IllegalArgumentException if any entry isn't in the known mapping
     */
    public static List<String> normalize(List<String> input) {
        if (input == null || input.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> result = new ArrayList<>();
        for (String raw : input) {
            String trimmed = raw == null ? "" : raw.trim();
            String mapped = MAP.get(trimmed);
            if (mapped == null) {
                throw new IllegalArgumentException(
                    "Unknown meal period: '" + raw + "' (allowed: " + MAP.keySet() + ")"
                );
            }
            if (!result.contains(mapped)) {
                result.add(mapped);
            }
        }
        return result;
    }
}
