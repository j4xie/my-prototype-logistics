package com.cretas.aims.ai.tool.impl.crm;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.WorkOrder;
import com.cretas.aims.service.WorkOrderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class OrderStatsTool extends AbstractBusinessTool {

    @Autowired
    private WorkOrderService workOrderService;

    @Override
    public String getToolName() {
        return "order_stats";
    }

    @Override
    public String getDescription() {
        return "订单/工单统计。统计各状态的订单数量，包括待处理、进行中、已完成和逾期数量。" +
                "适用场景：订单统计、订单概览、采购统计、工单汇总。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");
        schema.put("properties", Collections.emptyMap());
        schema.put("required", Collections.emptyList());
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行订单统计 - 工厂ID: {}", factoryId);

        long total = workOrderService.countByFactory(factoryId);
        long pending = workOrderService.countByStatus(factoryId, "PENDING");
        long inProgress = workOrderService.countByStatus(factoryId, "IN_PROGRESS");
        long completed = workOrderService.countByStatus(factoryId, "COMPLETED");
        List<WorkOrder> overdue = workOrderService.getOverdueWorkOrders(factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("total", total);
        result.put("pending", pending);
        result.put("inProgress", inProgress);
        result.put("completed", completed);
        result.put("overdue", overdue.size());
        result.put("message", "订单统计：总计 " + total + " 个，待处理 " + pending
                + "，进行中 " + inProgress + "，已完成 " + completed
                + "，逾期 " + overdue.size());
        return result;
    }
}
