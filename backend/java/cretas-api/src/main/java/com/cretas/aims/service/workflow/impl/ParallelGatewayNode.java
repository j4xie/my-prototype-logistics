package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.service.workflow.WorkflowNodeDescriptor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class ParallelGatewayNode implements WorkflowNodeDescriptor {

    @Override
    public String getNodeType() { return "parallel_gateway"; }

    @Override
    public String getDisplayName() { return "并行网关"; }

    @Override
    public String getDescription() { return "AND分支/合并 — 多道工序同时进行，全部完成后再汇合"; }

    @Override
    public String getIcon() { return "mdi-call-split"; }

    @Override
    public String getColor() { return "#9B59B6"; }

    @Override
    public String getCategory() { return "控制"; }

    @Override
    public Map<String, Object> getConfigSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "gatewayMode", Map.of("type", "string", "description", "网关模式", "enum", List.of("split", "join", "split_join")),
                "joinCondition", Map.of("type", "string", "description", "合并条件", "enum", List.of("all_completed", "any_completed", "n_of_m")),
                "requiredBranches", Map.of("type", "integer", "description", "N-of-M模式下需要完成的分支数")
            )
        );
    }

    @Override
    public Map<String, Object> getDefaultConfig() {
        return Map.of("gatewayMode", "split_join", "joinCondition", "all_completed", "requiredBranches", 0);
    }

    @Override
    public List<String> getAllowedNextNodes() {
        return List.of("plan_creation", "checkin_checkout", "cumulative_report", "quality_check", "approval", "completion_mark", "parallel_gateway", "exclusive_gateway", "timer_trigger");
    }
}
