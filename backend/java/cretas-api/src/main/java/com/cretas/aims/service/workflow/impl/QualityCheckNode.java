package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.service.workflow.WorkflowNodeDescriptor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class QualityCheckNode implements WorkflowNodeDescriptor {

    @Override
    public String getNodeType() { return "quality_check"; }

    @Override
    public String getDisplayName() { return "质检"; }

    @Override
    public String getDescription() { return "工序完成后的质量检验，可配置抽检比例和检验项"; }

    @Override
    public String getIcon() { return "mdi-clipboard-check"; }

    @Override
    public String getColor() { return "#F56C6C"; }

    @Override
    public String getCategory() { return "质量"; }

    @Override
    public Map<String, Object> getConfigSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "samplingRate", Map.of("type", "number", "description", "抽检比例(%)", "default", 10),
                "requiredBeforeComplete", Map.of("type", "boolean", "description", "完工前是否必须质检", "default", false),
                "inspectionType", Map.of("type", "string", "enum", List.of("process", "final_product"), "description", "质检类型", "default", "process")
            )
        );
    }

    @Override
    public Map<String, Object> getDefaultConfig() {
        return Map.of("samplingRate", 10, "requiredBeforeComplete", false, "inspectionType", "process");
    }

    @Override
    public List<String> getAllowedNextNodes() {
        return List.of("completion_mark", "cumulative_report");
    }

    @Override
    public List<String> getAvailableGuards() {
        return List.of("#isQualityPassed(qualityStatus)");
    }
}
