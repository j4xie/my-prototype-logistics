package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.service.workflow.WorkflowNodeDescriptor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class ExclusiveGatewayNode implements WorkflowNodeDescriptor {

    @Override
    public String getNodeType() { return "exclusive_gateway"; }

    @Override
    public String getDisplayName() { return "条件分支"; }

    @Override
    public String getDescription() { return "XOR排他网关 — 根据条件选择其中一条分支执行"; }

    @Override
    public String getIcon() { return "mdi-source-branch"; }

    @Override
    public String getColor() { return "rgb(230, 126, 34)"; }

    @Override
    public String getCategory() { return "控制"; }

    @Override
    public Map<String, Object> getConfigSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "defaultBranch", Map.of("type", "string", "description", "默认分支的目标状态代码（所有条件都不满足时走此分支）"),
                "evaluationOrder", Map.of("type", "string", "description", "条件评估顺序", "enum", List.of("priority_first", "first_match"))
            )
        );
    }

    @Override
    public Map<String, Object> getDefaultConfig() {
        return Map.of("defaultBranch", "", "evaluationOrder", "first_match");
    }

    @Override
    public List<String> getAllowedNextNodes() {
        return List.of("plan_creation", "checkin_checkout", "cumulative_report", "quality_check", "approval", "completion_mark", "parallel_gateway", "exclusive_gateway", "timer_trigger");
    }
}
