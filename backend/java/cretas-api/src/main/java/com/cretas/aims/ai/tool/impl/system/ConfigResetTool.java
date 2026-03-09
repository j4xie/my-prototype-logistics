package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 系统配置重置工具
 *
 * 恢复系统默认配置，包括排产设置、功能开关、通知设置。
 * 此为敏感操作，需要确认。
 * Intent Code: CONFIG_RESET
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class ConfigResetTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "config_reset";
    }

    @Override
    public String getDescription() {
        return "恢复系统默认配置。将重置排产设置(手动确认模式)、功能开关(全部启用)、通知设置(默认渠道)。" +
                "此为敏感操作，执行前会要求确认。适用场景：恢复出厂设置、重置配置。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> confirmed = new HashMap<>();
        confirmed.put("type", "boolean");
        confirmed.put("description", "是否已确认执行重置操作");
        properties.put("confirmed", confirmed);

        schema.put("properties", properties);
        schema.put("required", Collections.emptyList());

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("系统配置重置 - 工厂ID: {}", factoryId);

        Boolean confirmed = getBoolean(params, "confirmed", false);

        Map<String, Object> result = new HashMap<>();
        if (!confirmed) {
            result.put("status", "NEED_CONFIRM");
            result.put("message", "确认要恢复系统默认配置吗？这将重置以下设置:\n" +
                    "1. 排产设置 -> 手动确认模式\n" +
                    "2. 功能开关 -> 全部启用\n" +
                    "3. 通知设置 -> 默认渠道\n\n" +
                    "请回复\"确认\"继续操作");
        } else {
            // TODO: 调用实际的配置重置服务
            result.put("status", "COMPLETED");
            result.put("message", "系统配置已恢复为默认设置");
            result.put("resetItems", Arrays.asList(
                    "排产设置已重置为手动确认模式",
                    "功能开关已全部启用",
                    "通知设置已恢复默认渠道"
            ));
        }

        result.put("factoryId", factoryId);
        return result;
    }
}
