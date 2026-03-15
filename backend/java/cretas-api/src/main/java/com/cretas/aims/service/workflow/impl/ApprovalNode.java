package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.service.workflow.WorkflowNodeDescriptor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class ApprovalNode implements WorkflowNodeDescriptor {

    @Override
    public String getNodeType() { return "approval"; }

    @Override
    public String getDisplayName() { return "报工审批"; }

    @Override
    public String getDescription() { return "审批报工记录，支持通过/驳回/批量审批，幂等保证"; }

    @Override
    public String getIcon() { return "mdi-check-decagram"; }

    @Override
    public String getColor() { return "#67C23A"; }

    @Override
    public String getCategory() { return "审批"; }

    @Override
    public Map<String, Object> getConfigSchema() {
        return Map.ofEntries(
            Map.entry("type", "object"),
            Map.entry("properties", Map.ofEntries(
                Map.entry("autoApproveRoles", Map.of("type", "array", "items", Map.of("type", "string"), "description", "自动审批角色")),
                Map.entry("batchApproveEnabled", Map.of("type", "boolean", "description", "是否支持批量审批")),
                Map.entry("reversalEnabled", Map.of("type", "boolean", "description", "是否支持冲销")),
                Map.entry("approvalLevels", Map.of("type", "integer", "description", "审批级数 (1=单级, 2=班组长+主管, 3=三级审批)")),
                Map.entry("minApproversPerLevel", Map.of("type", "integer", "description", "每级最少审批人数")),
                Map.entry("approvalTimeoutMinutes", Map.of("type", "integer", "description", "审批超时时间(分钟)，超时自动升级")),
                Map.entry("rejectionHandling", Map.of("type", "string", "description", "驳回处理方式", "enum", List.of("return_to_reporter", "return_to_previous_node", "escalate_to_admin")))
            ))
        );
    }

    @Override
    public Map<String, Object> getDefaultConfig() {
        return Map.of(
            "autoApproveRoles", List.of("factory_super_admin"),
            "batchApproveEnabled", true,
            "reversalEnabled", true,
            "approvalLevels", 1,
            "minApproversPerLevel", 1,
            "approvalTimeoutMinutes", 0,
            "rejectionHandling", "return_to_reporter"
        );
    }

    @Override
    public List<String> getAllowedNextNodes() {
        return List.of("completion_mark", "quality_check");
    }
}
