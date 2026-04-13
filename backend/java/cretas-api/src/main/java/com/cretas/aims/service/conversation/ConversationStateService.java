package com.cretas.aims.service.conversation;

import com.cretas.aims.entity.conversation.ConversationTurn;

import java.util.List;

/**
 * Conversation state service for the entire Tool-Skill platform.
 *
 * <p>Stores recent turns per (factoryId, userId) with TTL so users can
 * ask follow-up questions ("why?", "how do I do step 1?") and have the
 * AIIntentService plus LLM fallback use prior context for better answers.
 *
 * <p>Not restaurant-specific — all 337+ tools benefit.
 *
 * <p>Implementations should be fail-open: if the backing store is
 * unavailable or slow, return empty list (loadRecent) or log+drop
 * (appendTurn) rather than blocking the caller.
 *
 * <p>Part of P4 Task 4.1.
 */
public interface ConversationStateService {

    /**
     * Load the most recent N turns for a user session.
     * Returns empty list when none exist, the store is unavailable, or
     * the TTL expired. Most recent turn at index 0.
     */
    List<ConversationTurn> loadRecent(String factoryId, String userId, int n);

    /**
     * Append a turn to the conversation history.
     * Resets TTL to the configured value. Caps at the configured
     * maxTurns (oldest dropped first).
     */
    void appendTurn(String factoryId, String userId, ConversationTurn turn);

    /**
     * Clear conversation state for a user (logout, explicit reset).
     */
    void clear(String factoryId, String userId);

    /**
     * Count of turns currently stored for a user (observability).
     * Returns 0 on store unavailability.
     */
    int turnCount(String factoryId, String userId);
}
