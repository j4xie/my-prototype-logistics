package com.cretas.aims.ai.tool.impl.system;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.WorkOrder;
import com.cretas.aims.service.WorkOrderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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

    @Autowired
    private WorkOrderService workOrderService;

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
        try {
            // Extract userId from context
            Long userId = null;
            Object userIdObj = context != null ? context.get("userId") : null;
            if (userIdObj instanceof Long) {
                userId = (Long) userIdObj;
            } else if (userIdObj instanceof Number) {
                userId = ((Number) userIdObj).longValue();
            } else if (userIdObj instanceof String) {
                try { userId = Long.parseLong((String) userIdObj); } catch (NumberFormatException ignored) {}
            }

            Map<String, Object> result = new HashMap<>();

            // Query work orders assigned to this user
            Pageable pageable = PageRequest.of(0, 20);
            if (userId != null) {
                Page<WorkOrder> assignedPage = workOrderService.getWorkOrdersByAssignee(factoryId, userId, pageable);
                result.put("myWorkOrders", assignedPage.getContent());
                result.put("myWorkOrderTotal", assignedPage.getTotalElements());
            }

            // Query overdue work orders for the factory
            List<WorkOrder> overdueOrders = workOrderService.getOverdueWorkOrders(factoryId);
            result.put("overdueWorkOrders", overdueOrders);
            result.put("overdueCount", overdueOrders.size());

            // Count pending work orders
            long pendingCount = workOrderService.countByStatus(factoryId, "PENDING");
            long inProgressCount = workOrderService.countByStatus(factoryId, "IN_PROGRESS");
            result.put("pendingCount", pendingCount);
            result.put("inProgressCount", inProgressCount);
            result.put("factoryId", factoryId);
            if (userId != null) result.put("userId", userId);

            return buildSimpleResult("待办事项查询成功", result);
        } catch (Exception e) {
            log.error("查询待办事项失败 - 工厂ID: {}", factoryId, e);
            throw e;
        }
    }
}
