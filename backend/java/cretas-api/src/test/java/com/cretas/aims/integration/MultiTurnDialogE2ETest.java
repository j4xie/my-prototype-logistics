package com.cretas.aims.integration;

import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.conversation.ConversationTurn;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.conversation.ConversationStateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * P4 Task 4.6: Multi-turn dialog E2E test.
 *
 * <p>@Disabled by default — requires:
 * <ul>
 *   <li>Running Redis on localhost:6379 (or Testcontainers Docker)</li>
 *   <li>Running PostgreSQL with Flyway migrations V20260411_01-06 applied</li>
 *   <li>DashScope API key (for LLM fallback if intent matching doesn't hit the
 *       EXACT / PHRASE / REGEX layers)</li>
 *   <li>Full Spring Boot context</li>
 * </ul>
 *
 * <p>Run manually in CI after deploy:
 * <pre>
 * ./mvnw.cmd test -Dtest=MultiTurnDialogE2ETest
 * </pre>
 *
 * <p>Verifies the full P4 conversation state pipeline:
 * <ol>
 *   <li>Turn 1: "帮我分析成本刚性" → recognized as RESTAURANT_COST_RIGIDITY +
 *       appended to conversation state</li>
 *   <li>Turn 2: "为什么这么高" → context loaded, LLM fallback gets prior turn as
 *       prompt prefix, routes to cost_rigidity or benchmark_alert</li>
 *   <li>Turn 3: "第 1 条处方怎么执行" → context shows prior cost_rigidity diagnosis,
 *       LLM handles the follow-up</li>
 *   <li>After all 3 turns, ConversationStateService.loadRecent should return
 *       3 turns in newest-first order</li>
 * </ol>
 *
 * <p>Demo-style multi-turn chat is now architecturally real: mobile/web clients
 * pass userId, service loads/appends context, LLM prompts include history.
 */
@Disabled("Requires Redis + PostgreSQL + DashScope + full Spring context. "
        + "Run manually in CI after deploy: "
        + "./mvnw.cmd test -Dtest=MultiTurnDialogE2ETest")
@SpringBootTest
class MultiTurnDialogE2ETest {

    private static final String FACTORY = "F-DINGXIAN-YIWU";
    private static final String USER = "U-dengzong";

    @Autowired
    private AIIntentService intentService;

    @Autowired
    private ConversationStateService contextService;

    @BeforeEach
    void cleanup() {
        contextService.clear(FACTORY, USER);
    }

    @Test
    void three_turn_dialog_preserves_context_and_resolves_followups() {
        // Turn 1: explicit cost_rigidity query (hits keyword matcher)
        Optional<AIIntentConfig> intent1 =
                intentService.recognizeIntent(FACTORY, "帮我分析成本刚性", USER);
        assertThat(intent1).isPresent();
        assertThat(intent1.get().getIntentCode()).isEqualTo("RESTAURANT_COST_RIGIDITY");

        // Turn 2: follow-up "why so high" — context should route via LLM to a
        // related cost/benchmark intent. The exact match depends on the LLM's
        // choice, so accept either.
        Optional<AIIntentConfig> intent2 =
                intentService.recognizeIntent(FACTORY, "为什么这么高", USER);
        assertThat(intent2).isPresent();
        String code2 = intent2.get().getIntentCode();
        assertThat(code2).isIn(
                "RESTAURANT_COST_RIGIDITY",
                "RESTAURANT_BENCHMARK_ALERT",
                "RESTAURANT_DIAGNOSTIC"
        );

        // Turn 3: prescription follow-up
        intentService.recognizeIntent(FACTORY, "第 1 条处方怎么执行", USER);

        // Verify all 3 turns are in Redis (newest first)
        List<ConversationTurn> history = contextService.loadRecent(FACTORY, USER, 5);
        assertThat(history).hasSize(3);
        // Index 0 is newest
        assertThat(history.get(0).userMessage()).isEqualTo("第 1 条处方怎么执行");
        // Index 2 is oldest (turn 1)
        assertThat(history.get(2).userMessage()).isEqualTo("帮我分析成本刚性");
    }

    @Test
    void clear_removes_all_user_turns() {
        intentService.recognizeIntent(FACTORY, "帮我分析成本刚性", USER);
        assertThat(contextService.loadRecent(FACTORY, USER, 5)).isNotEmpty();

        contextService.clear(FACTORY, USER);

        assertThat(contextService.loadRecent(FACTORY, USER, 5)).isEmpty();
    }
}
