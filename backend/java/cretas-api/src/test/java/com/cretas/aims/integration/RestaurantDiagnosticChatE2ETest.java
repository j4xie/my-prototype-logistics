package com.cretas.aims.integration;

import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.AIIntentService;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * P2 Task 2.10: Full-stack E2E — natural language question → intent
 * recognition → Java tool → Python section → structured response.
 *
 * <p>This test is <strong>{@code @Disabled}</strong> by default because it
 * requires:
 * <ul>
 *   <li>Running Python backend on port 8083 with the refactored
 *       {@code /api/smartbi/restaurant/sections/*} router (P1 Task 1.7)</li>
 *   <li>PostgreSQL with the V20260411_01 migration applied (P2 Task 2.8)
 *       so the 14 {@code RESTAURANT_*} intent configs are present</li>
 *   <li>Full Spring Boot context (DashScope LLM keys, Redis, etc.)</li>
 * </ul>
 *
 * <p>To run manually (after starting Python + Java locally):
 * <pre>
 * cd backend/java/cretas-api
 * ./mvnw.cmd test -Dtest=RestaurantDiagnosticChatE2ETest -DrunIntegration=true
 * </pre>
 *
 * <p>The {@code @Disabled} annotation keeps this out of the fast unit test
 * suite. CI can selectively enable it via an {@code @EnabledIfSystemProperty}
 * annotation when the integration environment is available.
 *
 * <p>The 3 test scenarios lock in the intent-routing contract for the
 * 3 highest-value questions from real customer conversations:
 * <ol>
 *   <li>"帮我分析一下成本刚性" → RESTAURANT_COST_RIGIDITY
 *       (emerged from 鼎鲜火锅 2026-02 loss case)</li>
 *   <li>"对标火锅行业我差在哪" → RESTAURANT_BENCHMARK_ALERT</li>
 *   <li>"17 家店哪家最差" → RESTAURANT_MULTI_STORE</li>
 * </ol>
 */
@Disabled("Requires Python backend on 8083 + V20260411_01 Flyway migration applied + DashScope keys. "
        + "Run manually: ./mvnw.cmd test -Dtest=RestaurantDiagnosticChatE2ETest")
@SpringBootTest
class RestaurantDiagnosticChatE2ETest {

    private static final String TEST_FACTORY = "F-DINGXIAN-YIWU";

    @Autowired
    private AIIntentService intentService;

    @Test
    void costRigidityQuestionRoutesToCorrectIntent() {
        String question = "帮我分析一下成本刚性, 营收降了 47% 人工只降了 26%";

        Optional<AIIntentConfig> intent = intentService.recognizeIntent(TEST_FACTORY, question);

        assertThat(intent).isPresent();
        assertThat(intent.get().getIntentCode()).isEqualTo("RESTAURANT_COST_RIGIDITY");
        assertThat(intent.get().getToolName()).isEqualTo("restaurant_cost_rigidity_analysis");
    }

    @Test
    void benchmarkQuestionRoutesToCorrectIntent() {
        String question = "对标火锅行业我差在哪";

        Optional<AIIntentConfig> intent = intentService.recognizeIntent(TEST_FACTORY, question);

        assertThat(intent).isPresent();
        assertThat(intent.get().getIntentCode()).isEqualTo("RESTAURANT_BENCHMARK_ALERT");
        assertThat(intent.get().getToolName()).isEqualTo("restaurant_benchmark_alert");
    }

    @Test
    void multiStoreQuestionRoutesToCorrectIntent() {
        String question = "我 17 家店哪家最差";

        Optional<AIIntentConfig> intent = intentService.recognizeIntent("F-QINGHUAJIAO", question);

        assertThat(intent).isPresent();
        assertThat(intent.get().getIntentCode()).isEqualTo("RESTAURANT_MULTI_STORE");
        assertThat(intent.get().getToolName()).isEqualTo("restaurant_multi_store_comparison");
    }

    @Test
    void longTailQuestionRoutesToCorrectIntent() {
        String question = "哪些菜该砍了, 销量太差";

        Optional<AIIntentConfig> intent = intentService.recognizeIntent(TEST_FACTORY, question);

        assertThat(intent).isPresent();
        assertThat(intent.get().getIntentCode()).isEqualTo("RESTAURANT_LONG_TAIL_SKU");
        assertThat(intent.get().getToolName()).isEqualTo("restaurant_long_tail_sku");
    }

    @Test
    void reviewAnalysisQuestionRoutesToCorrectIntent() {
        String question = "客户点评里都在说什么, 差评主要集中在哪";

        Optional<AIIntentConfig> intent = intentService.recognizeIntent(TEST_FACTORY, question);

        assertThat(intent).isPresent();
        assertThat(intent.get().getIntentCode()).isEqualTo("RESTAURANT_REVIEW_ANALYSIS");
        assertThat(intent.get().getToolName()).isEqualTo("restaurant_review_analysis");
    }
}
