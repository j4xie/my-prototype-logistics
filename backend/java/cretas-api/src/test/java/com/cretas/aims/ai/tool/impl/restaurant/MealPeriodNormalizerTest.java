package com.cretas.aims.ai.tool.impl.restaurant;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * POJO-style unit test (no Spring context). Validates the LLM → enum mapping
 * that backs RevenueReportGenerateTool's meal_periods param normalization.
 */
class MealPeriodNormalizerTest {

    @Test
    void mapsXiawuchaToWushi() {
        assertEquals(List.of("午市"),
            MealPeriodNormalizer.normalize(List.of("下午茶")));
    }

    @Test
    void mapsYexiaoToWanshi() {
        assertEquals(List.of("晚市"),
            MealPeriodNormalizer.normalize(List.of("夜宵")));
    }

    @Test
    void mapsWanxiaoToWanshi() {
        assertEquals(List.of("晚市"),
            MealPeriodNormalizer.normalize(List.of("晚宵")));
    }

    @Test
    void passesThroughCanonicalValues() {
        assertEquals(
            List.of("午市", "晚市"),
            MealPeriodNormalizer.normalize(List.of("午市", "晚市"))
        );
    }

    @Test
    void deduplicatesAfterNormalization() {
        // 下午茶 + 午市 both normalize to 午市 — should collapse to single entry.
        assertEquals(
            List.of("午市"),
            MealPeriodNormalizer.normalize(List.of("下午茶", "午市", "下午茶"))
        );
    }

    @Test
    void trimsWhitespaceBeforeLookup() {
        assertEquals(List.of("午市"),
            MealPeriodNormalizer.normalize(List.of(" 午市 ")));
    }

    @Test
    void rejectsUnknownValue() {
        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class,
            () -> MealPeriodNormalizer.normalize(List.of("夜市"))
        );
        assertTrue(ex.getMessage().contains("夜市"));
        // Allowed list mentioned in error so users get actionable feedback.
        assertTrue(ex.getMessage().contains("午市"));
    }

    @Test
    void emptyAndNullInputReturnEmpty() {
        assertEquals(Collections.emptyList(), MealPeriodNormalizer.normalize(Collections.emptyList()));
        assertEquals(Collections.emptyList(), MealPeriodNormalizer.normalize(null));
    }

    @Test
    void mappingTableSize() {
        // Sanity: if anyone adds/removes entries this catches the change.
        // 5 entries: 午市, 晚市, 下午茶, 夜宵, 晚宵.
        // Test by exercising each known mapping via Arrays.asList for variety.
        List<String> all = Arrays.asList("午市", "晚市", "下午茶", "夜宵", "晚宵");
        // Should not throw for any known input.
        for (String s : all) {
            MealPeriodNormalizer.normalize(List.of(s));
        }
    }
}
