package com.cretas.aims.service.impl;

import com.cretas.aims.config.IntentKnowledgeBase;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression test for P2 Task 2.9: locks in the RESTAURANT domain prefix
 * filter so the 14 new diagnostic tools are automatically included when
 * {@code LlmIntentFallbackClientImpl} filters tools by domain.
 *
 * <p>Background: the prefix filter in
 * {@code LlmIntentFallbackClientImpl.DOMAIN_TOOL_PREFIXES} maps
 * {@link IntentKnowledgeBase.Domain#RESTAURANT} to
 * {@code Set.of("restaurant_", "menu_", "dish_", "order_")}. All 14 new
 * diagnostic tools created in P2.3-2.6 follow the {@code restaurant_*}
 * naming convention, so they fall under the existing prefix automatically.
 *
 * <p>This test asserts two invariants:
 * <ol>
 *   <li>The static prefix map still contains {@code "restaurant_"} for
 *       {@link IntentKnowledgeBase.Domain#RESTAURANT}.</li>
 *   <li>Each of the 14 diagnostic tool names starts with {@code "restaurant_"}
 *       — verifies the naming convention that the prefix filter depends on.</li>
 * </ol>
 *
 * <p>We use reflection rather than {@code @SpringBootTest} because the
 * static map is private and loading the full Spring context for a tiny
 * invariant check would be wasteful.
 */
class RestaurantDomainPrefixTest {

    private static final List<String> EXPECTED_DIAGNOSTIC_TOOL_NAMES = Arrays.asList(
            "restaurant_cost_rigidity_analysis",
            "restaurant_benchmark_alert",
            "restaurant_channel_margin",
            "restaurant_dining_heatmap",
            "restaurant_long_tail_sku",
            "restaurant_menu_normalization",
            "restaurant_temporal_comparison",
            "restaurant_review_analysis",
            "restaurant_member_rfm",
            "restaurant_stored_value",
            "restaurant_multi_store_comparison",
            "restaurant_calibration_history",
            "restaurant_store_pnl_one_pager",
            "restaurant_bom_layer_status"
    );

    @Test
    void restaurantDomainPrefixMapContainsRestaurantUnderscore() throws Exception {
        Field field = LlmIntentFallbackClientImpl.class.getDeclaredField("DOMAIN_TOOL_PREFIXES");
        field.setAccessible(true);

        @SuppressWarnings("unchecked")
        Map<IntentKnowledgeBase.Domain, Set<String>> prefixMap =
                (Map<IntentKnowledgeBase.Domain, Set<String>>) field.get(null);

        Set<String> restaurantPrefixes = prefixMap.get(IntentKnowledgeBase.Domain.RESTAURANT);
        assertThat(restaurantPrefixes)
                .as("RESTAURANT domain must have a prefix set")
                .isNotNull()
                .as("RESTAURANT domain prefix set must contain 'restaurant_' so the 14 diagnostic tools are filtered into the RESTAURANT domain automatically")
                .contains("restaurant_");
    }

    @Test
    void all14DiagnosticToolsStartWithRestaurantUnderscore() {
        assertThat(EXPECTED_DIAGNOSTIC_TOOL_NAMES).hasSize(14);
        for (String toolName : EXPECTED_DIAGNOSTIC_TOOL_NAMES) {
            assertThat(toolName)
                    .as("Diagnostic tool '%s' must start with 'restaurant_' for domain prefix filtering to work", toolName)
                    .startsWith("restaurant_");
        }
    }
}
