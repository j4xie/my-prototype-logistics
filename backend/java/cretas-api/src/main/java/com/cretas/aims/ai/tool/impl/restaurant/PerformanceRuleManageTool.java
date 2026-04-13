package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.restaurant.PerformanceRule;
import com.cretas.aims.service.restaurant.PerformanceRuleService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.util.*;

@Slf4j @Component
public class PerformanceRuleManageTool extends AbstractBusinessTool {
    @Autowired private PerformanceRuleService ruleService;

    @Override public String getToolName() { return "restaurant_performance_rule_manage"; }
    @Override public String getDescription() { return "管理绩效规则 — 设定或修改KPI权重和考核指标, 仅老板/财务可操作, 每月1号生效."; }
    @Override public Map<String, Object> getParametersSchema() {
        return Map.of("type", "object", "properties", Map.of(
            "store_id", Map.of("type", "string"), "month", Map.of("type", "string", "description", "生效月 YYYY-MM"),
            "kpi_weights", Map.of("type", "object", "description", "KPI配置 {name: {weight, target}}")),
            "required", List.of("month", "kpi_weights"));
    }
    @Override protected List<String> getRequiredParameters() { return List.of("month", "kpi_weights"); }

    @Override @SuppressWarnings("unchecked")
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> ctx) throws Exception {
        String storeId = getString(params, "store_id");
        LocalDate month = LocalDate.parse(getString(params, "month") + "-01");
        Map<String, Object> weights = (Map<String, Object>) params.get("kpi_weights");
        PerformanceRule rule = ruleService.createOrUpdate(factoryId, storeId, month, weights, null, "OWNER", null);
        return buildSimpleResult("绩效规则已设置, " + month.getMonth() + "月1日生效",
            Map.of("ruleId", rule.getId(), "effectiveMonth", rule.getEffectiveMonth().toString()));
    }
}
