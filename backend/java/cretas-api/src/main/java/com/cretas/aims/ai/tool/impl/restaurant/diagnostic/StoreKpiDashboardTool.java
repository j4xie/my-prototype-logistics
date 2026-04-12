package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * 店长KPI仪表盘工具 — 财务+营运+外部评价三维度健康度评估.
 *
 * <p>调用 Python section {@code store_kpi_dashboard}, 返回 overall_health (GOOD/WARNING/CRITICAL)
 * 及各维度明细. 典型场景: 月末门店复盘、多店横向对比.
 */
@Slf4j
@Component
public class StoreKpiDashboardTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_store_kpi_dashboard";
    }

    @Override
    public String getDescription() {
        return "店长KPI仪表盘 — 财务+营运+外部评价三维度健康度评估.";
    }

    @Override
    protected String getSectionName() {
        return "store_kpi_dashboard";
    }

    @Override
    protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("各门店KPI对比", "查看某一维度明细", "生成月度绩效报告");
    }
}
