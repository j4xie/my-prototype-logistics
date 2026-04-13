package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

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

    @Override
    protected List<String> buildFollowUps(String sectionName, Map<String, Object> data) {
        Number rigidity = (Number) data.get("costRigidity");
        if (rigidity == null) {
            return List.of("对标火锅行业", "看时段客流分布");
        }
        if (rigidity.doubleValue() < 0.7) {
            // Critical: suggest deeper analysis chain
            return List.of(
                "对标火锅行业我差在哪",
                "给我 5 条处方",
                "按这个趋势预测下个月",
                "哪些菜该砍"
            );
        }
        return List.of("对标火锅行业", "看时段客流分布");
    }
}
