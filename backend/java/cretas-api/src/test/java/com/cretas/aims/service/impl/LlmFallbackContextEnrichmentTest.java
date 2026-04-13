package com.cretas.aims.service.impl;

import com.cretas.aims.entity.conversation.ConversationTurn;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit test for P4 Task 4.4 — verifies that the conversation-history
 * prefix builder formats recent turns correctly for LLM consumption.
 *
 * <p>Uses the static helper {@code buildConversationContextPrefix} on
 * {@link LlmIntentFallbackClientImpl}. Does NOT start a Spring context
 * — the helper is pure string manipulation.
 */
class LlmFallbackContextEnrichmentTest {

    @Test
    void prefix_is_empty_for_empty_history() {
        String prefix = LlmIntentFallbackClientImpl.buildConversationContextPrefix(List.of());
        assertThat(prefix).isEmpty();
    }

    @Test
    void prefix_contains_user_message_and_tool_for_each_turn() {
        ConversationTurn turn1 = new ConversationTurn(
                "帮我分析成本刚性",
                "RESTAURANT_COST_RIGIDITY",
                "restaurant_cost_rigidity_analysis",
                null,
                Map.of("costRigidity", 0.561, "severity", "critical"),
                1700000000000L
        );
        String prefix = LlmIntentFallbackClientImpl.buildConversationContextPrefix(List.of(turn1));

        // Must include the Chinese history header
        assertThat(prefix).contains("对话历史");
        // Must include the user message
        assertThat(prefix).contains("帮我分析成本刚性");
        // Must include the tool name so the LLM knows what was executed
        assertThat(prefix).contains("restaurant_cost_rigidity_analysis");
        // Must include at least one response field
        assertThat(prefix).contains("costRigidity");
    }

    @Test
    void prefix_orders_turns_oldest_first_for_natural_reading() {
        // loadRecent returns newest first (index 0). The prefix should
        // reverse to oldest-first so the LLM reads chronologically.
        ConversationTurn old = new ConversationTurn(
                "turn 1 (oldest)", null, null, null, null, 1000L);
        ConversationTurn mid = new ConversationTurn(
                "turn 2", null, null, null, null, 2000L);
        ConversationTurn latest = new ConversationTurn(
                "turn 3 (newest)", null, null, null, null, 3000L);

        // Simulate loadRecent output: newest first
        List<ConversationTurn> fromLoad = List.of(latest, mid, old);
        String prefix = LlmIntentFallbackClientImpl.buildConversationContextPrefix(fromLoad);

        int oldIdx = prefix.indexOf("turn 1");
        int midIdx = prefix.indexOf("turn 2");
        int newIdx = prefix.indexOf("turn 3");

        // All present
        assertThat(oldIdx).isGreaterThan(-1);
        assertThat(midIdx).isGreaterThan(-1);
        assertThat(newIdx).isGreaterThan(-1);
        // oldest appears BEFORE newest in the prefix
        assertThat(oldIdx).isLessThan(newIdx);
        assertThat(midIdx).isBetween(oldIdx, newIdx);
    }

    @Test
    void prefix_truncates_long_response_dicts() {
        // Response with many fields — only the first 3 should appear
        // to keep the prompt tight.
        ConversationTurn turn = new ConversationTurn(
                "test",
                "TEST_INTENT",
                "test_tool",
                null,
                Map.of(
                        "field1", "v1", "field2", "v2", "field3", "v3",
                        "field4", "v4", "field5", "v5"
                ),
                1000L
        );
        String prefix = LlmIntentFallbackClientImpl.buildConversationContextPrefix(List.of(turn));

        // Prefix should be reasonably short (not dump all 5 fields)
        // Accept "短" heuristic: contains at most 3 of the 5 field names
        int fieldCount = 0;
        for (int i = 1; i <= 5; i++) {
            if (prefix.contains("field" + i)) fieldCount++;
        }
        assertThat(fieldCount).isLessThanOrEqualTo(3);
    }

    @Test
    void prefix_handles_turn_without_tool() {
        // User-only turn (no tool executed yet — freshly recognized intent failed)
        ConversationTurn turn = ConversationTurn.userOnly("just asking");
        String prefix = LlmIntentFallbackClientImpl.buildConversationContextPrefix(List.of(turn));

        assertThat(prefix).contains("just asking");
        // Should not crash on null toolName / null response
    }
}
