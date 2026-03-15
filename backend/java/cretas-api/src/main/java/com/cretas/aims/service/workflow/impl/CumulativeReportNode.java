package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.service.workflow.WorkflowNodeDescriptor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class CumulativeReportNode implements WorkflowNodeDescriptor {

    @Override
    public String getNodeType() { return "cumulative_report"; }

    @Override
    public String getDisplayName() { return "累加报工"; }

    @Override
    public String getDescription() { return "支持多次报工累加，一小时一报或随时报工，自动汇总"; }

    @Override
    public String getIcon() { return "mdi-counter"; }

    @Override
    public String getColor() { return "#E6A23C"; }

    @Override
    public String getCategory() { return "执行"; }

    @Override
    public Map<String, Object> getConfigSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "reportingInterval", Map.of("type", "string", "enum", List.of("hourly", "per_shift", "free"), "description", "报工频率", "default", "hourly"),
                "requireApproval", Map.of("type", "boolean", "description", "是否需要审批", "default", true),
                "autoPromptOnTarget", Map.of("type", "boolean", "description", "达标时自动提示", "default", true),
                "maxExceedPercent", Map.of("type", "integer", "description", "允许超额百分比", "default", 150)
            )
        );
    }

    @Override
    public Map<String, Object> getDefaultConfig() {
        return Map.of("reportingInterval", "hourly", "requireApproval", true, "autoPromptOnTarget", true, "maxExceedPercent", 150);
    }

    @Override
    public List<String> getAllowedNextNodes() {
        return List.of("approval", "quality_check", "completion_mark");
    }

    @Override
    public List<String> getAvailableGuards() {
        return List.of("#isCompletedGtePlanned(id)");
    }
}
