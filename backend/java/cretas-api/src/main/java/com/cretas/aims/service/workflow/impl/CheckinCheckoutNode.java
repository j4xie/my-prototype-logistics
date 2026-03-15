package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.service.workflow.WorkflowNodeDescriptor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class CheckinCheckoutNode implements WorkflowNodeDescriptor {

    @Override
    public String getNodeType() { return "checkin_checkout"; }

    @Override
    public String getDisplayName() { return "签到签退"; }

    @Override
    public String getDescription() { return "NFC/扫码签到签退，绑定工序任务，记录在岗时长"; }

    @Override
    public String getIcon() { return "mdi-card-account-details"; }

    @Override
    public String getColor() { return "#67C23A"; }

    @Override
    public String getCategory() { return "执行"; }

    @Override
    public Map<String, Object> getConfigSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "method", Map.of("type", "string", "enum", List.of("NFC", "QR_CODE", "MANUAL"), "description", "签到方式", "default", "NFC"),
                "autoCheckout", Map.of("type", "boolean", "description", "是否自动签退", "default", false),
                "autoCheckoutMinutes", Map.of("type", "integer", "description", "自动签退时间（分钟）", "default", 480)
            )
        );
    }

    @Override
    public Map<String, Object> getDefaultConfig() {
        return Map.of("method", "NFC", "autoCheckout", false, "autoCheckoutMinutes", 480);
    }

    @Override
    public List<String> getAllowedNextNodes() {
        return List.of("cumulative_report", "quality_check", "completion_mark");
    }
}
