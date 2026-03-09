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
        log.info("查询待办事项 - 工厂ID: {}", factoryId);

        Long userId = getLong(context, "userId");

        // TODO: 调用 WorkOrderService 查询
        Map<String, Object> result = new HashMap<>();
        result.put("message", "待办事项查询完成");
        result.put("factoryId", factoryId);
        result.put("userId", userId);
        result.put("notice", "请接入WorkOrderService完成实际查询");

        return result;
    }
}
