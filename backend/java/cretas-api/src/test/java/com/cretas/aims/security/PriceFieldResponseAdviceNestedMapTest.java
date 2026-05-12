package com.cretas.aims.security;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.inventory.PurchaseOrderItem;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.PermissionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.mock.web.MockHttpServletRequest;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;

/**
 * Nested-Map / dynamic-shape tests for {@link PriceFieldResponseAdvice}.
 *
 * <p>Captures the P0 RBAC bypass surface discovered in PR #470 (chat1 R3
 * finance-l4-deep audit): SmartBI analysis endpoints returning
 * {@code Map<String, Object>} payloads (rankings, charts, heatmap, aiInsights,
 * trendComparison, opportunityScores, targetCompletion, kpiCards.formattedValue)
 * leaked nested price data to warehouse_manager because the response advice's
 * existing Map-walking only recursed into values without inspecting keys.
 *
 * <p>The fix in this PR adds <b>key-pattern path matching</b> when walking
 * Map entries: when a known price-value key (value / formattedValue / target /
 * currentSales / previousSales / completionRate / grossMargin / amount /
 * revenue / profit / sales) appears under a recognized price-container path
 * segment (rankings / *Ranking / charts / heatmap / opportunityScores /
 * targetCompletion / trendComparison / trendChart / kpiCards / aiInsights /
 * roi), the entry value is replaced with {@code null}. For
 * {@code aiInsights[].message} strings, amount-shaped substrings (e.g.,
 * "23,075,969.60", "¥1,000元", "1.2万") are replaced with "[REDACTED]".
 *
 * @author Cretas Team
 * @since 2026-05-12 (P0 architectural fix — recurse into nested Maps/Lists)
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("PriceFieldResponseAdvice — nested Map/List recursion (P0 PR #470 root-cause)")
class PriceFieldResponseAdviceNestedMapTest {

    @Mock private PermissionService permissionService;
    @Mock private UserRepository userRepository;
    @InjectMocks private PriceFieldResponseAdvice advice;

    private MockHttpServletRequest httpRequest;
    private ServerHttpRequest serverRequest;

    @BeforeEach
    void setup() {
        httpRequest = new MockHttpServletRequest();
        serverRequest = new ServletServerHttpRequest(httpRequest);
        PriceSensitiveContext.clear();
    }

    @AfterEach
    void teardown() {
        PriceSensitiveContext.clear();
    }

    private void asUser(Long userId, boolean canViewPrice) {
        httpRequest.setAttribute("userId", userId);
        User user = new User();
        user.setId(userId);
        lenient().when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        lenient().when(permissionService.hasPermission(eq(user),
                eq(PriceFieldResponseAdvice.PRICE_VIEW_PERMISSION))).thenReturn(canViewPrice);
    }

    private Object run(Object body) {
        return advice.beforeBodyWrite(body, null, MediaType.APPLICATION_JSON, null, serverRequest, null);
    }

    private Map<String, Object> rankingRow(int rank, String name, double value) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("rank", rank);
        row.put("name", name);
        row.put("value", value);
        return row;
    }

    // ───────── Tests ─────────

    @Test
    @DisplayName("warehouse: salespersonRanking[*].value stripped (chat1 PR #470 §5 most-damaging leak)")
    void warehouse_salespersonRanking_value_stripped() {
        asUser(10L, false);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("salespersonRanking", new ArrayList<>(Arrays.asList(
                rankingRow(1, "陈涛秀", 732709.2),
                rankingRow(2, "王芳娜", 712008.0),
                rankingRow(3, "马兰娜", 697132.0))));

        run(response);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) response.get("salespersonRanking");
        assertEquals(3, rows.size(), "list size preserved");
        assertNull(rows.get(0).get("value"), "rank 1 value stripped");
        assertNull(rows.get(1).get("value"), "rank 2 value stripped");
        assertNull(rows.get(2).get("value"), "rank 3 value stripped");
        // Non-price preserved
        assertEquals("陈涛秀", rows.get(0).get("name"));
        assertEquals(1, rows.get(0).get("rank"));
    }

    @Test
    @DisplayName("warehouse: customerRanking + productRanking + supplierRanking + regionRanking all stripped")
    void warehouse_multipleRankings_allStripped() {
        asUser(10L, false);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("customerRanking", new ArrayList<>(Arrays.asList(
                rankingRow(1, "客户A", 1091940.3))));
        response.put("productRanking", new ArrayList<>(Arrays.asList(
                rankingRow(1, "青花椒成品", 3734272.6))));
        response.put("supplierRanking", new ArrayList<>(Arrays.asList(
                rankingRow(1, "供应商X", 250000.0))));
        response.put("regionRanking", new ArrayList<>(Arrays.asList(
                rankingRow(1, "华东", 5000000.0))));

        run(response);

        for (String key : Arrays.asList("customerRanking", "productRanking", "supplierRanking", "regionRanking")) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> rows = (List<Map<String, Object>>) response.get(key);
            assertNull(rows.get(0).get("value"),
                    key + "[0].value should be stripped");
            assertNotNull(rows.get(0).get("name"),
                    key + "[0].name should be preserved");
        }
    }

    @Test
    @DisplayName("warehouse: charts.data[*].value stripped")
    void warehouse_chartsData_value_stripped() {
        asUser(10L, false);

        Map<String, Object> chart = new LinkedHashMap<>();
        chart.put("type", "LINE");
        List<Map<String, Object>> chartData = new ArrayList<>();
        Map<String, Object> p1 = new LinkedHashMap<>();
        p1.put("label", "2026-04");
        p1.put("value", 10000000.0);
        chartData.add(p1);
        Map<String, Object> p2 = new LinkedHashMap<>();
        p2.put("label", "2026-05");
        p2.put("value", 12000000.0);
        chartData.add(p2);
        chart.put("data", chartData);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("charts", chart);

        run(response);

        @SuppressWarnings("unchecked")
        Map<String, Object> stripped = (Map<String, Object>) response.get("charts");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> data = (List<Map<String, Object>>) stripped.get("data");
        assertNull(data.get(0).get("value"), "charts.data[0].value stripped");
        assertNull(data.get(1).get("value"), "charts.data[1].value stripped");
        // label preserved
        assertEquals("2026-04", data.get(0).get("label"));
        // type preserved
        assertEquals("LINE", stripped.get("type"));
    }

    @Test
    @DisplayName("warehouse: kpiCards[*].formattedValue stripped (chat1 PR #470 D4.2 reclassified-WARN)")
    void warehouse_kpiCards_formattedValue_stripped() {
        asUser(10L, false);

        Map<String, Object> response = new LinkedHashMap<>();
        List<Map<String, Object>> kpis = new ArrayList<>();
        Map<String, Object> kpi1 = new LinkedHashMap<>();
        kpi1.put("id", "GROSS_PROFIT");
        kpi1.put("label", "毛利润");
        kpi1.put("value", null);  // already stripped top-level
        kpi1.put("formattedValue", "23,075,969.60");  // leaked sibling
        kpis.add(kpi1);
        response.put("kpiCards", kpis);

        run(response);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stripped = (List<Map<String, Object>>) response.get("kpiCards");
        assertNull(stripped.get(0).get("formattedValue"),
                "kpiCards[0].formattedValue must be stripped — was leaking '23,075,969.60'");
        // Non-price metadata preserved
        assertEquals("GROSS_PROFIT", stripped.get(0).get("id"));
        assertEquals("毛利润", stripped.get(0).get("label"));
    }

    @Test
    @DisplayName("warehouse: heatmap.data[*].value stripped")
    void warehouse_heatmap_data_value_stripped() {
        asUser(10L, false);

        Map<String, Object> heatmap = new LinkedHashMap<>();
        List<Map<String, Object>> cells = new ArrayList<>();
        Map<String, Object> c1 = new LinkedHashMap<>();
        c1.put("x", "华东");
        c1.put("y", "2026-05");
        c1.put("value", 5000000.0);
        cells.add(c1);
        heatmap.put("data", cells);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("heatmap", heatmap);

        run(response);

        @SuppressWarnings("unchecked")
        Map<String, Object> hm = (Map<String, Object>) response.get("heatmap");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> data = (List<Map<String, Object>>) hm.get("data");
        assertNull(data.get(0).get("value"), "heatmap.data[0].value stripped");
        assertEquals("华东", data.get(0).get("x"));
        assertEquals("2026-05", data.get(0).get("y"));
    }

    @Test
    @DisplayName("warehouse: opportunityScores[*].currentSales / previousSales stripped")
    void warehouse_opportunityScores_currentPrevious_stripped() {
        asUser(10L, false);

        List<Map<String, Object>> scores = new ArrayList<>();
        Map<String, Object> s1 = new LinkedHashMap<>();
        s1.put("region", "华东");
        s1.put("currentSales", 5250000.0);
        s1.put("previousSales", 4800000.0);
        s1.put("score", 87);  // non-price metadata
        scores.add(s1);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("opportunityScores", scores);

        run(response);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stripped = (List<Map<String, Object>>) response.get("opportunityScores");
        assertNull(stripped.get(0).get("currentSales"),
                "opportunityScores[0].currentSales stripped");
        assertNull(stripped.get(0).get("previousSales"),
                "opportunityScores[0].previousSales stripped");
        assertEquals("华东", stripped.get(0).get("region"));
    }

    @Test
    @DisplayName("warehouse: targetCompletion[*].target / completionRate stripped")
    void warehouse_targetCompletion_target_completionRate_stripped() {
        asUser(10L, false);

        List<Map<String, Object>> targets = new ArrayList<>();
        Map<String, Object> t1 = new LinkedHashMap<>();
        t1.put("region", "华东");
        t1.put("target", 6000000.0);
        t1.put("completionRate", 87.5);
        targets.add(t1);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("targetCompletion", targets);

        run(response);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stripped = (List<Map<String, Object>>) response.get("targetCompletion");
        assertNull(stripped.get(0).get("target"));
        assertNull(stripped.get(0).get("completionRate"));
        assertEquals("华东", stripped.get(0).get("region"));
    }

    @Test
    @DisplayName("warehouse: aiInsights[*].message amount-text redacted to [REDACTED]")
    void warehouse_aiInsights_message_amountRedacted() {
        asUser(10L, false);

        List<Map<String, Object>> insights = new ArrayList<>();
        Map<String, Object> i1 = new LinkedHashMap<>();
        i1.put("level", "INFO");
        i1.put("title", "毛利润同比增长");
        i1.put("message", "本月毛利润达到 23,075,969.60 元，同比增长 12.5%");
        insights.add(i1);
        Map<String, Object> i2 = new LinkedHashMap<>();
        i2.put("level", "WARN");
        i2.put("message", "净利润 ¥2,440,637.80 低于预期，建议关注成本控制");
        insights.add(i2);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("aiInsights", insights);

        run(response);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stripped = (List<Map<String, Object>>) response.get("aiInsights");
        String msg1 = (String) stripped.get(0).get("message");
        String msg2 = (String) stripped.get(1).get("message");
        assertNotNull(msg1, "message preserved as non-null string");
        assertFalse(msg1.contains("23,075,969.60"),
                "amount '23,075,969.60' must be redacted from aiInsights message");
        assertTrue(msg1.contains("[REDACTED]"),
                "redacted placeholder must appear in message: " + msg1);
        assertFalse(msg2.contains("2,440,637.80"),
                "amount '2,440,637.80' must be redacted from second insight");
        // Non-price metadata preserved
        assertEquals("INFO", stripped.get(0).get("level"));
        assertEquals("毛利润同比增长", stripped.get(0).get("title"));
    }

    @Test
    @DisplayName("warehouse: trendComparison.data[*] dynamic-key numeric values stripped (department amounts)")
    void warehouse_trendComparison_dynamicKeys_numericStripped() {
        asUser(10L, false);

        // /analysis/department leaks like:
        //   trendComparison.data = [{week:"2026-W18", "销售部":1000000, "生产部":800000, ...}, ...]
        Map<String, Object> trend = new LinkedHashMap<>();
        List<Map<String, Object>> trendData = new ArrayList<>();
        Map<String, Object> wk1 = new LinkedHashMap<>();
        wk1.put("week", "2026-W18");
        wk1.put("销售部", 1000000.0);
        wk1.put("生产部", 800000.0);
        wk1.put("仓储部", 250000.0);
        trendData.add(wk1);
        Map<String, Object> wk2 = new LinkedHashMap<>();
        wk2.put("week", "2026-W19");
        wk2.put("销售部", 1100000.0);
        wk2.put("生产部", 820000.0);
        wk2.put("仓储部", 260000.0);
        trendData.add(wk2);
        trend.put("data", trendData);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("trendComparison", trend);

        run(response);

        @SuppressWarnings("unchecked")
        Map<String, Object> tc = (Map<String, Object>) response.get("trendComparison");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> data = (List<Map<String, Object>>) tc.get("data");
        // Numeric department values stripped (dynamic keys)
        assertNull(data.get(0).get("销售部"), "trendComparison.data[0].销售部 stripped");
        assertNull(data.get(0).get("生产部"), "trendComparison.data[0].生产部 stripped");
        assertNull(data.get(0).get("仓储部"), "trendComparison.data[0].仓储部 stripped");
        // week preserved
        assertEquals("2026-W18", data.get(0).get("week"));
        assertEquals("2026-W19", data.get(1).get("week"));
    }

    @Test
    @DisplayName("warehouse: ApiResponse<Map<String,Object>> envelope — recurses into data")
    void warehouse_apiResponseEnvelope_recursesIntoMap() {
        asUser(10L, false);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("salespersonRanking", new ArrayList<>(Arrays.asList(
                rankingRow(1, "陈涛秀", 732709.2))));
        ApiResponse<Map<String, Object>> envelope = ApiResponse.success("ok", data);

        run(envelope);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>)
                envelope.getData().get("salespersonRanking");
        assertNull(rows.get(0).get("value"), "envelope.data.salespersonRanking[0].value stripped");
        assertEquals("ok", envelope.getMessage());
        assertEquals(Boolean.TRUE, envelope.getSuccess());
    }

    @Test
    @DisplayName("warehouse: bare top-level {value: 100} (no container) NOT stripped (precision: avoid over-strip)")
    void warehouse_bareValueAtTopLevel_notStripped() {
        asUser(10L, false);

        // Map without a price-container ancestor. 'value' alone is ambiguous —
        // could be a non-monetary count, enum value, etc. We only strip when
        // the path context indicates a price container.
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "ok");
        response.put("value", 42);  // ambiguous — non-monetary likely
        response.put("count", 7);

        run(response);

        // Top-level 'value' under no price-container path stays put.
        assertEquals(42, response.get("value"),
                "bare top-level 'value' (no price-container path) must be preserved — precision check");
        assertEquals(7, response.get("count"));
        assertEquals("ok", response.get("status"));
    }

    @Test
    @DisplayName("admin role: all Map-shaped price data preserved (regression)")
    void admin_allMapPriceData_preserved() {
        asUser(1L, true);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("salespersonRanking", new ArrayList<>(Arrays.asList(
                rankingRow(1, "陈涛秀", 732709.2))));
        Map<String, Object> kpi = new LinkedHashMap<>();
        kpi.put("formattedValue", "23,075,969.60");
        response.put("kpiCards", new ArrayList<>(Arrays.asList(kpi)));
        List<Map<String, Object>> insights = new ArrayList<>();
        Map<String, Object> i1 = new LinkedHashMap<>();
        i1.put("message", "本月毛利润达到 23,075,969.60 元");
        insights.add(i1);
        response.put("aiInsights", insights);

        run(response);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) response.get("salespersonRanking");
        assertEquals(732709.2, rows.get(0).get("value"), "admin: value preserved");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> kpis = (List<Map<String, Object>>) response.get("kpiCards");
        assertEquals("23,075,969.60", kpis.get(0).get("formattedValue"),
                "admin: formattedValue preserved");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> ai = (List<Map<String, Object>>) response.get("aiInsights");
        assertTrue(((String) ai.get(0).get("message")).contains("23,075,969.60"),
                "admin: aiInsights amount-text NOT redacted");
    }

    @Test
    @DisplayName("regression: existing entity @PriceSensitive top-level stripping still works (PR #443 baseline)")
    void regression_topLevelEntityStripping_stillWorks() {
        asUser(10L, false);

        PurchaseOrder order = new PurchaseOrder();
        order.setId("po-recurse-regress");
        order.setOrderNumber("PO-2026-recurse-1");
        order.setFactoryId("F006");
        order.setSupplierId("sup-1");
        order.setTotalAmount(new BigDecimal("9999.99"));

        PurchaseOrderItem item = new PurchaseOrderItem();
        item.setId(1L);
        item.setMaterialName("青花椒");
        item.setQuantity(new BigDecimal("100.0000"));
        item.setUnitPrice(new BigDecimal("99.9999"));
        order.setItems(Arrays.asList(item));

        run(order);

        // Existing top-level Jackson @PriceSensitive stripping must still null these.
        assertNull(order.getTotalAmount(), "PR #443 baseline: totalAmount stripped");
        assertNull(order.getItems().get(0).getUnitPrice(), "PR #443 baseline: item.unitPrice stripped");
        // Non-price preserved
        assertEquals("PO-2026-recurse-1", order.getOrderNumber());
        assertEquals("青花椒", order.getItems().get(0).getMaterialName());
    }

    @Test
    @DisplayName("warehouse: nested list-of-lists (rankings → groups → rows) recurses through all levels")
    void warehouse_nestedListInList_recurses() {
        asUser(10L, false);

        // {rankings: {region: [[{value:1},{value:2}], [{value:3}]]}}
        Map<String, Object> response = new LinkedHashMap<>();
        Map<String, Object> rankings = new LinkedHashMap<>();
        List<List<Map<String, Object>>> groups = new ArrayList<>();
        groups.add(new ArrayList<>(Arrays.asList(
                rankingRow(1, "A", 100.0),
                rankingRow(2, "B", 200.0))));
        groups.add(new ArrayList<>(Arrays.asList(
                rankingRow(1, "C", 300.0))));
        rankings.put("region", groups);
        response.put("rankings", rankings);

        run(response);

        @SuppressWarnings("unchecked")
        Map<String, Object> r = (Map<String, Object>) response.get("rankings");
        @SuppressWarnings("unchecked")
        List<List<Map<String, Object>>> grps = (List<List<Map<String, Object>>>) r.get("region");
        for (List<Map<String, Object>> g : grps) {
            for (Map<String, Object> row : g) {
                assertNull(row.get("value"), "nested list-of-lists: every row.value must be stripped");
                assertNotNull(row.get("name"), "name preserved");
            }
        }
    }

    @Test
    @DisplayName("warehouse: aiInsights with no amount-substrings — message preserved unchanged")
    void warehouse_aiInsights_noAmount_messagePreserved() {
        asUser(10L, false);

        List<Map<String, Object>> insights = new ArrayList<>();
        Map<String, Object> i = new LinkedHashMap<>();
        i.put("level", "INFO");
        i.put("message", "建议优化生产计划，提升周转率");  // no money pattern
        insights.add(i);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("aiInsights", insights);

        run(response);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stripped = (List<Map<String, Object>>) response.get("aiInsights");
        assertEquals("建议优化生产计划，提升周转率", stripped.get(0).get("message"),
                "no-amount message preserved verbatim (no spurious [REDACTED] insertion)");
    }

    @Test
    @DisplayName("warehouse: ROI nested under finance metric → value + formattedValue stripped")
    void warehouse_roi_nestedFinanceMetric_stripped() {
        asUser(10L, false);

        Map<String, Object> roi = new LinkedHashMap<>();
        roi.put("value", 331.81);
        roi.put("formattedValue", "331.81%");
        roi.put("label", "投资回报率");

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("ROI", roi);

        run(response);

        @SuppressWarnings("unchecked")
        Map<String, Object> stripped = (Map<String, Object>) response.get("ROI");
        assertNull(stripped.get("value"), "ROI.value stripped");
        assertNull(stripped.get("formattedValue"), "ROI.formattedValue stripped");
        // Non-price metadata preserved
        assertEquals("投资回报率", stripped.get("label"));
    }

    @Test
    @DisplayName("immutable Map — does not throw (best-effort: skip mutation, preserve safety)")
    void immutableMap_doesNotThrow() {
        asUser(10L, false);

        // Map.of(...) returns an immutable map; entry.setValue() throws UnsupportedOperationException.
        // The advice must catch and continue (log + degrade gracefully).
        Map<String, Object> insideRanking = Map.of("rank", 1, "name", "X", "value", 100.0);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("salespersonRanking", new ArrayList<>(Arrays.asList(insideRanking)));

        // Must not throw — graceful fallback when payload is immutable.
        assertDoesNotThrow(() -> run(response));
    }
}
