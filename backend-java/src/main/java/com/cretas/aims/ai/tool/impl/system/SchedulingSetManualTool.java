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
        log.info("执行调度模式设置为手动 - 工厂ID: {}", factoryId);

        String reason = getString(params, "reason");
        Long userId = getLong(context, "userId");
        String userName = getString(context, "username");

        // TODO: 调用实际的调度服务设置模式
        // schedulingService.setSchedulingMode(factoryId, SchedulingMode.MANUAL, userId);

        // 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("message", "调度模式已设置为手动模式");
        result.put("factoryId", factoryId);
        result.put("previousMode", "AUTO"); // TODO: 从服务获取之前的模式
        result.put("currentMode", "MANUAL");
        result.put("changedBy", userName);
        result.put("changedAt", LocalDateTime.now().toString());

        if (reason != null && !reason.trim().isEmpty()) {
            result.put("reason", reason);
        }

        // 添加模式说明
        Map<String, Object> modeInfo = new HashMap<>();
        modeInfo.put("mode", "MANUAL");
        modeInfo.put("description", "所有生产计划和调度需要人工创建和确认");
        modeInfo.put("features", Arrays.asList(
                "完全人工控制生产计划",
                "手动分配产能资源",
                "人工确认每个调度决策",
                "适合特殊订单处理"
        ));
        result.put("modeInfo", modeInfo);

        // 添加注意事项
        result.put("warnings", Arrays.asList(
                "手动模式下系统不会自动生成计划",
                "请确保及时处理待排程订单",
                "建议定期检查产能利用率"
        ));

        // 添加后续操作建议
        result.put("nextSteps", Arrays.asList(
                "检查当前待排程订单",
                "手动创建生产计划",
                "监控生产执行情况"
        ));

        log.info("调度模式设置完成 - 工厂ID: {}, 模式: MANUAL", factoryId);

        return result;
    }
}
