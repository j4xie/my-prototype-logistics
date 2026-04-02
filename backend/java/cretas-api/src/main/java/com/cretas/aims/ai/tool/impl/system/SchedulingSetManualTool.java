package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 调度模式设置为手动工具
 *
 * 将工厂的调度模式设置为手动模式。手动模式下生产计划和调度
 * 完全由人工控制，系统仅提供辅助功能。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class SchedulingSetManualTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "scheduling_set_manual";
    }

    @Override
    public String getDescription() {
        return "将工厂的调度模式设置为手动模式。手动模式下生产计划和调度完全由人工控制，系统仅提供辅助功能。" +
                "适用场景：需要人工精细控制生产、特殊订单处理、调试生产流程。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // reason: 设置原因（可选）
        Map<String, Object> reason = new HashMap<>();
        reason.put("type", "string");
        reason.put("description", "设置原因或备注");
        properties.put("reason", reason);

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
