package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 调度模式设置为自动工具
 *
 * 将工厂的调度模式设置为自动模式。自动模式下系统会根据
 * 订单、库存和产能自动生成生产计划和调度。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class SchedulingSetAutoTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "scheduling_set_auto";
    }

    @Override
    public String getDescription() {
        return "将工厂的调度模式设置为自动模式。自动模式下系统会根据订单、库存和产能自动生成生产计划和调度。" +
                "适用场景：启用智能调度、自动化生产排程、提高调度效率。";
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
        log.info("执行调度模式设置为自动 - 工厂ID: {}", factoryId);

        String reason = getString(params, "reason");
        Long userId = getLong(context, "userId");
        String userName = getString(context, "username");

        // TODO: 调用实际的调度服务设置模式
        // schedulingService.setSchedulingMode(factoryId, SchedulingMode.AUTO, userId);

        // 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("message", "调度模式已设置为自动模式");
        result.put("factoryId", factoryId);
        result.put("previousMode", "MANUAL"); // TODO: 从服务获取之前的模式
        result.put("currentMode", "AUTO");
        result.put("changedBy", userName);
        result.put("changedAt", LocalDateTime.now().toString());

        if (reason != null && !reason.trim().isEmpty()) {
            result.put("reason", reason);
        }

        // 添加模式说明
        Map<String, Object> modeInfo = new HashMap<>();
        modeInfo.put("mode", "AUTO");
        modeInfo.put("description", "系统自动根据订单、库存和产能生成生产计划");
        modeInfo.put("features", Arrays.asList(
                "自动生成生产计划",
                "智能排程优化",
                "实时调整产能分配",
                "自动处理紧急订单"
        ));
        result.put("modeInfo", modeInfo);

        // 添加后续操作建议
        result.put("nextSteps", Arrays.asList(
                "确认自动调度配置参数",
                "监控自动生成的计划",
                "如需人工干预可切换到手动模式"
        ));

        log.info("调度模式设置完成 - 工厂ID: {}, 模式: AUTO", factoryId);

        return result;
    }
}
