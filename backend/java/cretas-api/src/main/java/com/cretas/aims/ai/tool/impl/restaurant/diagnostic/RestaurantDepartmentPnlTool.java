package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Restaurant department P&L tool — wraps the Python department_pnl
 * section (P3.5D P1). Computes per-department labor + cost breakdown
 * using the DepartmentTree hierarchy (前厅/后厨/管理), aggregates
 * leaves to parents, and returns per-head productivity + revenue
 * share metrics.
 *
 * Activated by intents like "哪个部门人力超了" / "前厅后厨谁贵" /
 * "人均产出比" / "部门成本分解".
 */
@Slf4j
@Component
public class RestaurantDepartmentPnlTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_department_pnl";
    }

    @Override
    public String getDescription() {
        return "部门级 P&L 分解 — 按 DepartmentTree (前厅/后厨/管理) 聚合人力成本, "
             + "计算每个档口的人均工资 + 占总营收比. 基于 3 级部门树自动聚合 (热菜 + 冷菜 "
             + "+ 明档 → 后厨). 适用场景: 客户问'哪个部门人力超了'/'后厨人均产出多少'/"
             + "'前厅和后厨谁贵'/'30 行人均产出比'.";
    }

    @Override
    protected String getSectionName() {
        return "department_pnl";
    }
}
