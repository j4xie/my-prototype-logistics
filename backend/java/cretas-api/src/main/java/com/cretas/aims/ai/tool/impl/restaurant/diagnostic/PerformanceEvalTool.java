package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j @Component
public class PerformanceEvalTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_performance_eval"; }
    @Override public String getDescription() { return "绩效评估 — 基于可控利润+人效+点评分三维度加权打分."; }
    @Override protected String getSectionName() { return "performance_eval"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("各门店绩效排名", "调整KPI权重", "查看可控利润明细");
    }
}
