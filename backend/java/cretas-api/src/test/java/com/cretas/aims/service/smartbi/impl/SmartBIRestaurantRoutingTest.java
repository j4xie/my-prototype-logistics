package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.smartbi.NLQueryResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Focused unit tests for the P5.6 restaurant Tool-Skill routing adapter in
 * {@link SmartBIServiceImpl}. Validates two private methods via reflection:
 *
 * <ul>
 *   <li>{@code RESTAURANT_DIAGNOSTIC_KEYWORDS} regex — must match 14+ signal
 *       keywords from the Flyway migrations without false positives on
 *       generic factory queries.</li>
 *   <li>{@code mapIntentExecuteResponse} adapter — must extract sectionName,
 *       data, followUpChips from {@code resultData} and toolName from
 *       {@code metadata} into the new NLQueryResponse fields.</li>
 * </ul>
 *
 * <p>We use reflection rather than a full {@code @SpringBootTest} because
 * the adapter is a pure mapper — no need for Spring context. Spring integration
 * testing happens in the manual curl verification step post-deploy.
 *
 * <p>The routing end-to-end path ({@code tryRouteRestaurantDiagnostic}) is
 * NOT covered here because it requires mocking IntentExecutorService which
 * drags in 20+ dependencies. It will be validated in P5.6-verify by hitting
 * the live /smart-bi/query endpoint.
 */
class SmartBIRestaurantRoutingTest {

    @Test
    @DisplayName("Keyword regex matches all P2 restaurant diagnostic intent triggers (Phase 1+2)")
    void keywordRegexMatchesAllFlywayIntents() throws Exception {
        Pattern pattern = getKeywordPattern();

        // 14 intents from V20260411_01 migration - pick 1 representative phrase per intent
        List<String> positiveSamples = Arrays.asList(
            "帮我分析一下成本刚性, 营收降了 47% 人工只降了 26%",  // RESTAURANT_COST_RIGIDITY
            "对标火锅行业我差在哪",                              // RESTAURANT_BENCHMARK_ALERT
            "渠道毛利拆一下, 堂食和外卖的",                       // RESTAURANT_CHANNEL_MARGIN
            "时段客流几点最忙",                                  // RESTAURANT_DINING_HEATMAP
            "哪些菜该砍了, 销量太差",                            // RESTAURANT_LONG_TAIL_SKU
            "菜单归一后有多少个 SKU",                             // RESTAURANT_MENU_NORMALIZATION
            "这个月同店同比怎么样",                              // RESTAURANT_TEMPORAL_COMPARISON
            "客户点评里都在说什么",                              // RESTAURANT_REVIEW_ANALYSIS
            "会员分层 RFM 分一下",                                // RESTAURANT_MEMBER_RFM
            "储值卡核销率现在多少",                              // RESTAURANT_STORED_VALUE
            "我 17 家店哪家最差",                                 // RESTAURANT_MULTI_STORE
            "BOM校准历史追溯一下",                                // RESTAURANT_CALIBRATION_HISTORY
            "给我生成一份单店利润表 P&L",                        // RESTAURANT_STORE_PNL
            "当前 BOM精度 是什么 Layer",                          // RESTAURANT_BOM_LAYER_STATUS
            // P3.2 / P3.3 / P3.5 added intents
            "帮我做个菜单工程 Kasavana 四象限",                   // RESTAURANT_MENU_ENGINEERING
            "跟同业对比一下 我们家营收排第几",                    // RESTAURANT_CROSS_CHAIN_BENCHMARK
            "销售预测下月营收会多少",                             // RESTAURANT_SALES_FORECAST
            // Phase 1 financial analytics intents
            "这个月BOM差异归因看看是供应链还是管理问题",           // RESTAURANT_BOM_VARIANCE
            "本月销售计划完成度怎么样",                           // RESTAURANT_SALES_PLAN_TRACK
            "人效分析一下 各门店人均产出",                         // RESTAURANT_LABOR_PRODUCTIVITY
            // Phase 2 intents
            "桌位配置分析一下 两人位够不够",                        // RESTAURANT_SEAT_OCCUPANCY
            "套餐拆单统计看看哪些菜是套餐带动的",                    // RESTAURANT_COMBO_SPLIT
            "这批供应商退货异常检测一下",                            // RESTAURANT_RETURN_ANOMALY
            "竞品分析 我们跟周边同行评分对比怎么样"                   // RESTAURANT_REVIEW_COMPETITIVE
        );

        for (String query : positiveSamples) {
            assertThat(pattern.matcher(query).find())
                .as("Should match restaurant keyword in: '%s'", query)
                .isTrue();
        }
    }

    @Test
    @DisplayName("Keyword regex does NOT match generic factory/sales queries")
    void keywordRegexRejectsGenericQueries() throws Exception {
        Pattern pattern = getKeywordPattern();

        // These should fall through to legacy SmartBI switch-case
        List<String> negativeSamples = Arrays.asList(
            "本月销售额是多少",
            "哪个部门业绩最好",
            "应收账款账龄分析",
            "生产任务完成进度怎么样",
            "设备利用率排名",
            "原材料库存水平",
            "今天的订单金额",
            "给我看下销售趋势"
        );

        for (String query : negativeSamples) {
            assertThat(pattern.matcher(query).find())
                .as("Should NOT match generic query: '%s'", query)
                .isFalse();
        }
    }

    @Test
    @DisplayName("mapIntentExecuteResponse unwraps sections from resultData map")
    void adapterExtractsSectionFromResultData() throws Exception {
        Map<String, Object> toolResultData = new LinkedHashMap<>();
        toolResultData.put("success", true);
        toolResultData.put("section", "cost_rigidity");
        toolResultData.put("data", Map.of(
            "rigidity_score", 0.561,
            "severity", "HIGH",
            "headline", "人工成本过度刚性"
        ));
        toolResultData.put("warnings", Collections.emptyList());
        toolResultData.put("followUpChips", Arrays.asList(
            "看看具体的岗位工资",
            "对标火锅行业的人工占比"
        ));

        IntentExecuteResponse execResp = IntentExecuteResponse.builder()
            .intentRecognized(true)
            .intentCode("RESTAURANT_COST_RIGIDITY")
            .intentName("成本刚性诊断")
            .confidence(0.95)
            .status("SUCCESS")
            .message("分析完成")
            .formattedText("人工成本过度刚性 (0.561)")
            .resultData(toolResultData)
            .metadata(Map.of("toolName", "restaurant_cost_rigidity_analysis"))
            .build();

        NLQueryResponse result = invokeMapAdapter(execResp);

        assertThat(result.getIntentCode()).isEqualTo("RESTAURANT_COST_RIGIDITY");
        assertThat(result.getIntent()).isEqualTo("RESTAURANT_DIAGNOSTIC");
        assertThat(result.getToolName()).isEqualTo("restaurant_cost_rigidity_analysis");
        assertThat(result.getResponseText()).isEqualTo("人工成本过度刚性 (0.561)");
        assertThat(result.getMessage()).isEqualTo("分析完成");
        assertThat(result.getConfidence()).isEqualTo(0.95);

        assertThat(result.getSections())
            .as("Should wrap the single tool output as a 1-element sections list")
            .hasSize(1);
        Map<String, Object> section = result.getSections().get(0);
        assertThat(section.get("sectionName")).isEqualTo("cost_rigidity");
        assertThat(section.get("status")).isEqualTo("ok");
        assertThat(section.get("data")).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> sectionData = (Map<String, Object>) section.get("data");
        assertThat(sectionData.get("rigidity_score")).isEqualTo(0.561);

        assertThat(result.getFollowUpChips())
            .containsExactly("看看具体的岗位工资", "对标火锅行业的人工占比");
    }

    @Test
    @DisplayName("mapIntentExecuteResponse handles failed tool with status=failed")
    void adapterHandlesFailedToolResult() throws Exception {
        Map<String, Object> toolResultData = new HashMap<>();
        toolResultData.put("success", false);
        toolResultData.put("section", "benchmark_alert");
        toolResultData.put("data", Collections.emptyMap());
        toolResultData.put("warnings", Arrays.asList("sub_sector 未提供", "门店数据缺失"));

        IntentExecuteResponse execResp = IntentExecuteResponse.builder()
            .intentRecognized(true)
            .intentCode("RESTAURANT_BENCHMARK_ALERT")
            .status("FAILED")
            .resultData(toolResultData)
            .build();

        NLQueryResponse result = invokeMapAdapter(execResp);

        assertThat(result.getSections()).hasSize(1);
        Map<String, Object> section = result.getSections().get(0);
        assertThat(section.get("status")).isEqualTo("failed");
        assertThat(section.get("warnings"))
            .isInstanceOf(List.class)
            .asList()
            .containsExactly("sub_sector 未提供", "门店数据缺失");
    }

    @Test
    @DisplayName("mapIntentExecuteResponse returns empty sections when resultData is null or non-Map")
    void adapterGracefullyHandlesMissingResultData() throws Exception {
        IntentExecuteResponse execResp = IntentExecuteResponse.builder()
            .intentRecognized(true)
            .intentCode("RESTAURANT_COST_RIGIDITY")
            .status("SUCCESS")
            .resultData(null)  // No data at all
            .build();

        NLQueryResponse result = invokeMapAdapter(execResp);

        assertThat(result.getIntentCode()).isEqualTo("RESTAURANT_COST_RIGIDITY");
        assertThat(result.getSections())
            .as("Null resultData should yield null or empty sections, not throw")
            .isNull();  // builder default is null
        assertThat(result.getFollowUpChips()).isNull();
    }

    @Test
    @DisplayName("mapIntentExecuteResponse skips toolName when metadata has no toolName key")
    void adapterSkipsToolNameWhenMetadataMissing() throws Exception {
        Map<String, Object> toolResultData = new HashMap<>();
        toolResultData.put("success", true);
        toolResultData.put("section", "cost_rigidity");
        toolResultData.put("data", Map.of("score", 0.5));

        IntentExecuteResponse execResp = IntentExecuteResponse.builder()
            .intentRecognized(true)
            .intentCode("RESTAURANT_COST_RIGIDITY")
            .status("SUCCESS")
            .resultData(toolResultData)
            .metadata(Map.of("recoveredAfterRetries", 0))  // no toolName
            .build();

        NLQueryResponse result = invokeMapAdapter(execResp);

        assertThat(result.getToolName()).isNull();
        assertThat(result.getIntentCode()).isEqualTo("RESTAURANT_COST_RIGIDITY");
        assertThat(result.getSections()).hasSize(1);
    }

    // ==================== Reflection helpers ====================

    /**
     * Reads the private static {@code RESTAURANT_DIAGNOSTIC_KEYWORDS} field from
     * {@link SmartBIServiceImpl}. Using reflection avoids having to instantiate
     * the full service (which has 12+ dependencies).
     */
    private Pattern getKeywordPattern() throws Exception {
        Field field = SmartBIServiceImpl.class.getDeclaredField("RESTAURANT_DIAGNOSTIC_KEYWORDS");
        field.setAccessible(true);
        return (Pattern) field.get(null);
    }

    /**
     * Invokes the package-private static {@code mapIntentExecuteResponse}
     * method directly. No instance needed — the method is a pure function
     * that only reads from its parameter.
     */
    private NLQueryResponse invokeMapAdapter(IntentExecuteResponse execResp) throws Exception {
        Method method = SmartBIServiceImpl.class.getDeclaredMethod(
            "mapIntentExecuteResponse", IntentExecuteResponse.class);
        method.setAccessible(true);
        return (NLQueryResponse) method.invoke(null, execResp);  // null instance - static method
    }
}
