package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantCostRigidityAnalysisTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_cost_rigidity_analysis";
    }

    @Override
    public String getDescription() {
        return "分析餐厅成本刚性 (cost_rigidity = Δ人工成本 / Δ营收). 适用场景: 客户问'为什么亏损这么多'/'人工成本是不是太高'/'成本结构健不健康'. 返回: 刚性系数、行业健康阈值对比、年化影响估算、严重性等级.";
    }

    @Override
    protected String getSectionName() {
        return "cost_rigidity";
    }
}
