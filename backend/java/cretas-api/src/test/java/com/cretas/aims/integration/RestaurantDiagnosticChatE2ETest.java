package com.cretas.aims.integration;

import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.AIIntentService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * P2 Task 2.10: intent routing verification — natural language question →
 * {@code recognizeIntent()} → correct {@code RESTAURANT_*} intent config.
 *
 * <p>Gated by {@code -DrunIntegration=true} system property. Not run in the
 * default {@code mvn test} build because it needs a full {@code @SpringBootTest}
 * context + PostgreSQL with {@code V20260411_01} migration applied (14 restaurant
 * intent configs). Python backend and DashScope keys are <em>not</em> required —
 * all assertions operate on layer 1-4 (EXACT/PHRASE/REGEX/KEYWORD) intent
 * recognition which is DB-local.
 *
 * <p>To run manually or in CI integration suite:
 * <pre>
 * cd backend/java/cretas-api
 * ./mvnw.cmd test -Dtest=RestaurantDiagnosticChatE2ETest -DrunIntegration=true
 * </pre>
 *
 * <p>P5.6 audit (2026-04-11) changed this from class-level {@code @Disabled}
 * (which made it "paper coverage" that never ran) to
 * {@code @EnabledIfSystemProperty}: still skipped by default, but actively
 * opt-in-able so we can verify the intent routing contract any time without
 * commenting out an annotation.
 *
 * <p>The 5 test scenarios lock in the intent-routing contract for the
 * highest-value questions from real customer conversations:
 * <ol>
 *   <li>"帮我分析一下成本刚性" → RESTAURANT_COST_RIGIDITY
 *       (emerged from 鼎鲜火锅 2026-02 loss case)</li>
 *   <li>"对标火锅行业我差在哪" → RESTAURANT_BENCHMARK_ALERT</li>
 *   <li>"17 家店哪家最差" → RESTAURANT_MULTI_STORE</li>
 *   <li>"哪些菜该砍了" → RESTAURANT_LONG_TAIL_SKU</li>
 *   <li>"差评主要集中在哪" → RESTAURANT_REVIEW_ANALYSIS</li>
 * </ol>
 */
@EnabledIfSystemProperty(named = "runIntegration", matches = "true")
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
