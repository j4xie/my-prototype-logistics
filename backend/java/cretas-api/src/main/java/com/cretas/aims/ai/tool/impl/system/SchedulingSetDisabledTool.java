package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 调度模式设置为禁用工具
 *
 * 将工厂的调度模式设置为禁用状态。禁用后系统将暂停所有
 * 调度功能，已有计划保持不变但不会生成新计划。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class SchedulingSetDisabledTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "scheduling_set_disabled";
    }

    @Override
    public String getDescription() {
        return "将工厂的调度模式设置为禁用状态。禁用后系统将暂停所有调度功能，已有计划保持不变但不会生成新计划。" +
                "适用场景：工厂停产维护、系统升级、紧急暂停调度。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // reason: 设置原因（可选）
        Map<String, Object> reason = new HashMap<>();
        reason.put("type", "string");
        reason.put("description", "禁用原因或备注，建议提供");
        properties.put("reason", reason);

        // duration: 预计禁用时长（可选）
        Map<String, Object> duration = new HashMap<>();
        duration.put("type", "string");
        duration.put("description", "预计禁用时长，如：2小时、1天");
        properties.put("duration", duration);

        schema.put("properties", properties);
        schema.put("required", Collections.emptyList());

        return schema;
    }

    /**
     * 无必需参数，操作作用于工厂级别
     */
    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        // 调度模式服务未接入 — 禁止降级处理，返回明确错误而非模拟数据
        return buildSimpleResult("error", java.util.Map.of(
                "success", false,
                "error", "调度模式服务尚未接入，请联系管理员配置 SchedulingService",
                "code", "SERVICE_NOT_AVAILABLE"));
    }
}
