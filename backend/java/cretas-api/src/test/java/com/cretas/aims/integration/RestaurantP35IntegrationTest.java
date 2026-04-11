package com.cretas.aims.integration;

import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.dto.python.PythonRestaurantSectionRequest;
import com.cretas.aims.dto.python.PythonRestaurantSectionResponse;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * P3.5 Integration test — calls the 4 new section handlers
 * (expense_breakdown, shrinkage_analysis, department_pnl,
 * monthly_ppt_export) via PythonSmartBIClient and verifies responses.
 *
 * <p>@Disabled by default — requires:
 * <ul>
 *   <li>Running Python backend on 8083 with P3.5 sections deployed
 *       (commits up to 44a488d0f)</li>
 *   <li>Flyway migrations V20260411_01 + V20260411_02 + V20260411_03
 *       applied (4 new intent configs)</li>
 *   <li>Full Spring context (DashScope keys, Redis, PostgreSQL)</li>
 * </ul>
 *
 * <p>To run manually (after deploy):
 * <pre>
 * cd backend/java/cretas-api
 * ./mvnw.cmd test -Dtest=RestaurantP35IntegrationTest
 * </pre>
 *
 * <p>Locks in the Java&rarr;Python contract for all 4 P3.5 new sections.
 */
@Disabled("Requires Python backend on 8083 with P3.5 sections deployed. "
        + "Run manually after deploy: ./mvnw.cmd test -Dtest=RestaurantP35IntegrationTest")
@SpringBootTest
class RestaurantP35IntegrationTest {

    private static final String FACTORY = "F-DINGXIAN-YIWU";

    @Autowired
    private PythonSmartBIClient client;

    @Test
    void expenseBreakdownReturnsAggregatedTree() {
        PythonRestaurantSectionRequest req = PythonRestaurantSectionRequest.builder()
            .factoryId(FACTORY)
            .subSector("火锅")
            .params(Map.of(
                "expense_account_tree_id", "hotpot_default",
                "expense_leaf_values", Map.of(
                    "工资", 237660,
                    "房租费", 85000,
                    "充卡赠送", 51680.61,
                    "水费", 3200,
                    "电费", 8500
                )
            ))
            .build();

        Optional<PythonRestaurantSectionResponse> result =
            client.callRestaurantSection("expense_breakdown", req);

        assertThat(result).isPresent();
        assertThat(result.get().isSuccess()).isTrue();
        assertThat(result.get().getData()).containsKey("aggregated");
        assertThat(result.get().getData()).containsKey("topAccounts");
    }

    @Test
    void shrinkageAnalysisDetectsOffender() {
        PythonRestaurantSectionRequest req = PythonRestaurantSectionRequest.builder()
            .factoryId(FACTORY)
            .subSector("火锅")
            .params(Map.of(
                "shrinkage_rows", List.of(
                    Map.of("department", "热菜", "standardCost", 50000, "actualCost", 52000),
                    Map.of("department", "刺身", "standardCost", 30000, "actualCost", 34000)
                )
            ))
            .build();

        Optional<PythonRestaurantSectionResponse> result =
            client.callRestaurantSection("shrinkage_analysis", req);

        assertThat(result).isPresent();
        assertThat(result.get().isSuccess()).isTrue();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> offenders = (List<Map<String, Object>>) result.get()
            .getData().get("topOffenders");
        assertThat(offenders).isNotEmpty();
        // 刺身 13.3% is worse than 热菜 4%
        assertThat(offenders.get(0).get("department")).isEqualTo("刺身");
    }

    @Test
    void departmentPnlUsesHotpotTree() {
        PythonRestaurantSectionRequest req = PythonRestaurantSectionRequest.builder()
            .factoryId(FACTORY)
            .subSector("火锅")
            .params(Map.of(
                "department_tree_id", "hotpot_default",
                "labor_by_department", Map.of(
                    "热菜", 80000,
                    "冷菜", 40000,
                    "前厅服务员", 50000
                ),
                "revenue", 731048
            ))
            .build();

        Optional<PythonRestaurantSectionResponse> result =
            client.callRestaurantSection("department_pnl", req);

        assertThat(result).isPresent();
        assertThat(result.get().isSuccess()).isTrue();
        assertThat(result.get().getData()).containsKey("aggregated");
    }

    @Test
    void monthlyPptExportGeneratesFile() {
        PythonRestaurantSectionRequest req = PythonRestaurantSectionRequest.builder()
            .factoryId(FACTORY)
            .subSector("火锅")
            .storeName("鼎鲜火锅·义乌分公司")
            .period("2026-02")
            .params(Map.of(
                "financial_metrics", Map.of(
                    "revenue", 731048,
                    "foodCost", 307040,
                    "laborCost", 237660,
                    "netProfit", -49724
                )
            ))
            .build();

        Optional<PythonRestaurantSectionResponse> result =
            client.callRestaurantSection("monthly_ppt_export", req);

        assertThat(result).isPresent();
        assertThat(result.get().isSuccess()).isTrue();
        assertThat(result.get().getData()).containsKey("pptPath");
        assertThat(result.get().getData()).containsKey("downloadUrl");
    }
}
