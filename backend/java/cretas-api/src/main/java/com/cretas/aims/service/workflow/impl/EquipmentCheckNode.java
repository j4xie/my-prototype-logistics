package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.service.workflow.WorkflowNodeDescriptor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class EquipmentCheckNode implements WorkflowNodeDescriptor {

    @Override
    public String getNodeType() { return "equipment_check"; }

    @Override
    public String getDisplayName() { return "设备检查"; }

    @Override
    public String getDescription() { return "检查设备状态 — 确保设备在线、温度正常后才允许进入下一步"; }

    @Override
    public String getIcon() { return "mdi-cog-outline"; }

    @Override
    public String getColor() { return "#E74C3C"; }

    @Override
    public String getCategory() { return "质量"; }

    @Override
    public Map<String, Object> getConfigSchema() {
        return Map.ofEntries(
            Map.entry("type", "object"),
            Map.entry("properties", Map.ofEntries(
                Map.entry("requiredEquipmentStatus", Map.of("type", "string", "description", "要求的设备状态", "enum", List.of("ONLINE", "IDLE", "any"))),
                Map.entry("temperatureMin", Map.of("type", "number", "description", "最低温度阈值 (摄氏度，0=不检查)")),
                Map.entry("temperatureMax", Map.of("type", "number", "description", "最高温度阈值 (摄氏度，0=不检查)")),
                Map.entry("checkInterval", Map.of("type", "integer", "description", "循环检查间隔(秒)")),
                Map.entry("blockOnFail", Map.of("type", "boolean", "description", "检查不通过时是否阻止后续操作"))
            ))
        );
    }

    @Override
    public Map<String, Object> getDefaultConfig() {
        return Map.of("requiredEquipmentStatus", "ONLINE", "temperatureMin", 0, "temperatureMax", 0, "checkInterval", 60, "blockOnFail", true);
    }

    @Override
    public List<String> getAllowedNextNodes() {
        return List.of("checkin_checkout", "cumulative_report", "quality_check");
    }
}
