package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.service.workflow.WorkflowNodeDescriptor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class CompletionMarkNode implements WorkflowNodeDescriptor {

    @Override
    public String getNodeType() { return "completion_mark"; }

    @Override
    public String getDisplayName() { return "完工标记"; }

    @Override
    public String getDescription() { return "标记工序任务完工，支持手动确认或自动达标触发"; }

    @Override
    public String getIcon() { return "mdi-flag-checkered"; }

    @Override
    public String getColor() { return "#909399"; }

    @Override
    public String getCategory() { return "完工"; }

    @Override
    public Map<String, Object> getConfigSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "autoCompleteOnTarget", Map.of("type", "boolean", "description", "达标时自动完工", "default", false),
                "requireConfirmation", Map.of("type", "boolean", "description", "是否需要人工确认", "default", true),
                "allowSupplement", Map.of("type", "boolean", "description", "完工后是否允许补报", "default", true)
            )
        );
    }

    @Override
    public Map<String, Object> getDefaultConfig() {
        return Map.of("autoCompleteOnTarget", false, "requireConfirmation", true, "allowSupplement", true);
    }

    @Override
    public List<String> getAllowedNextNodes() {
        return List.of();
    }

    @Override
    public List<String> getAvailableGuards() {
        return List.of("#isCompletedGtePlanned(id)", "#hasNoPendingSupplements(id)");
    }
}
