package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class LaborProductivityTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_labor_productivity";
    }

    @Override
    public String getDescription() {
        return "人效 (人均产出) 监控 — 月营收/员工数, 判断是否在 3-4 万健康区间.";
    }

    @Override
    protected String getSectionName() {
        return "labor_productivity";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>(super.getParametersSchema());
        @SuppressWarnings("unchecked")
        Map<String, Object> props = new HashMap<>((Map<String, Object>) schema.getOrDefault("properties", Collections.emptyMap()));

        props.put("headcount", Map.of("type", "integer", "description", "门店当月在岗员工人数"));
        props.put("revenue", Map.of("type", "number", "description", "门店当月营收 (元)"));

        schema.put("properties", props);
        schema.put("required", List.of("headcount"));
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return List.of("headcount");
    }

    @Override
    protected List<String> buildFollowUps(String sectionName, Map<String, Object> data) {
        return Arrays.asList(
            "对比各门店人效排名",
            "人效趋势变化 (近6个月)",
            "哪些岗位可以用兼职替代"
        );
    }
}
