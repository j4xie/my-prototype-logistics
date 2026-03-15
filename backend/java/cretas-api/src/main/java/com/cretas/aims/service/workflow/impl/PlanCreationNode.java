package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.service.workflow.WorkflowNodeDescriptor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class PlanCreationNode implements WorkflowNodeDescriptor {

    @Override
    public String getNodeType() { return "plan_creation"; }

    @Override
    public String getDisplayName() { return "计划创建"; }

    @Override
    public String getDescription() { return "创建工序任务，设置计划产量、产品、工序、日期范围"; }

    @Override
    public String getIcon() { return "mdi-clipboard-text"; }

    @Override
    public String getColor() { return "#409EFF"; }

    @Override
    public String getCategory() { return "计划"; }

    @Override
    public Map<String, Object> getConfigSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "requireProductType", Map.of("type", "boolean", "description", "是否必须选择产品", "default", true),
                "requireWorkProcess", Map.of("type", "boolean", "description", "是否必须选择工序", "default", true),
                "allowMultiDay", Map.of("type", "boolean", "description", "是否允许跨天", "default", true)
            )
        );
    }

    @Override
    public Map<String, Object> getDefaultConfig() {
        return Map.of("requireProductType", true, "requireWorkProcess", true, "allowMultiDay", true);
    }

    @Override
    public List<String> getAllowedNextNodes() {
        return List.of("checkin_checkout", "cumulative_report");
    }
}
