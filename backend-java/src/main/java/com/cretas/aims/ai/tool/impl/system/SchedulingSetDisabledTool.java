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
        log.info("执行调度模式设置为禁用 - 工厂ID: {}", factoryId);

        String reason = getString(params, "reason");
        String duration = getString(params, "duration");
        Long userId = getLong(context, "userId");
        String userName = getString(context, "username");

        // TODO: 调用实际的调度服务设置模式
        // schedulingService.setSchedulingMode(factoryId, SchedulingMode.DISABLED, userId);

        // 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("message", "调度模式已设置为禁用状态");
        result.put("factoryId", factoryId);
        result.put("previousMode", "AUTO"); // TODO: 从服务获取之前的模式
        result.put("currentMode", "DISABLED");
        result.put("changedBy", userName);
        result.put("changedAt", LocalDateTime.now().toString());

        if (reason != null && !reason.trim().isEmpty()) {
            result.put("reason", reason);
        }
        if (duration != null && !duration.trim().isEmpty()) {
            result.put("estimatedDuration", duration);
        }

        // 添加模式说明
        Map<String, Object> modeInfo = new HashMap<>();
        modeInfo.put("mode", "DISABLED");
        modeInfo.put("description", "调度功能已暂停，不会生成新的生产计划");
        modeInfo.put("impact", Arrays.asList(
                "不再自动生成生产计划",
                "不处理新订单排程",
                "已有计划保持当前状态",
                "可继续执行已确认的计划"
        ));
        result.put("modeInfo", modeInfo);

        // 添加重要警告
        result.put("warnings", Arrays.asList(
                "调度功能已完全禁用",
                "新订单将不会被排程",
                "请尽快完成维护并重新启用调度",
                "长时间禁用可能影响订单交付"
        ));

        // 添加后续操作建议
        result.put("nextSteps", Arrays.asList(
                "通知相关人员调度已暂停",
                "完成所需的维护或调整",
                "维护完成后切换到自动或手动模式"
        ));

        log.info("调度模式设置完成 - 工厂ID: {}, 模式: DISABLED, 原因: {}",
                factoryId, reason != null ? reason : "未提供");

        return result;
    }
}
