package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.service.workflow.WorkflowNodeDescriptor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class TimerTriggerNode implements WorkflowNodeDescriptor {

    @Override
    public String getNodeType() { return "timer_trigger"; }

    @Override
    public String getDisplayName() { return "定时触发"; }

    @Override
    public String getDescription() { return "按时间自动触发转换 — 超时升级、定期质检、班次交接"; }

    @Override
    public String getIcon() { return "mdi-timer-outline"; }

    @Override
    public String getColor() { return "#3498DB"; }

    @Override
    public String getCategory() { return "控制"; }

    @Override
    public Map<String, Object> getConfigSchema() {
        return Map.ofEntries(
            Map.entry("type", "object"),
            Map.entry("properties", Map.ofEntries(
                Map.entry("triggerType", Map.of("type", "string", "description", "触发类型", "enum", List.of("delay", "cron", "shift_change"))),
                Map.entry("delayMinutes", Map.of("type", "integer", "description", "延迟触发(分钟) — triggerType=delay时生效")),
                Map.entry("cronExpression", Map.of("type", "string", "description", "Cron表达式 — triggerType=cron时生效 (如: 0 0 8 * * *)")),
                Map.entry("shiftSchedule", Map.of("type", "string", "description", "班次 — triggerType=shift_change时生效", "enum", List.of("day_shift_end", "night_shift_end", "custom"))),
                Map.entry("autoFireEvent", Map.of("type", "string", "description", "定时触发时自动发送的事件名称")),
                Map.entry("notifyBeforeMinutes", Map.of("type", "integer", "description", "触发前N分钟发送预警通知"))
            ))
        );
    }

    @Override
    public Map<String, Object> getDefaultConfig() {
        return Map.of("triggerType", "delay", "delayMinutes", 60, "autoFireEvent", "timeout", "notifyBeforeMinutes", 10);
    }

    @Override
    public List<String> getAllowedNextNodes() {
        return List.of("approval", "quality_check", "completion_mark", "exclusive_gateway");
    }
}
