package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 待办事项查询工具
 *
 * 查询用户的待办事项，包括分配的工单、逾期任务、待处理和进行中的任务。
 * Intent Code: USER_TODO_LIST
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class TodoListTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "todo_list";
    }

    @Override
    public String getDescription() {
        return "查询用户的待办事项列表。包括分配给当前用户的工单、逾期任务、待处理和进行中的任务统计。" +
                "适用场景：查看我的待办、待处理事项、逾期提醒。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");
        schema.put("properties", new HashMap<>());
        schema.put("required", Collections.emptyList());
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        // 待办事项服务未接入 — 禁止降级处理，返回明确错误而非模拟数据
        return buildSimpleResult("error", java.util.Map.of(
                "success", false,
                "error", "待办事项服务尚未接入，请联系管理员配置 WorkOrderService",
                "code", "SERVICE_NOT_AVAILABLE"));
    }
}
