package com.cretas.aims.ai.tool.impl.crm;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.WorkOrder;
import com.cretas.aims.service.WorkOrderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class OrderListTool extends AbstractBusinessTool {

    @Autowired
    private WorkOrderService workOrderService;

    @Override
    public String getToolName() {
        return "order_list";
    }

    @Override
    public String getDescription() {
        return "查询订单/工单列表，支持分页。也用于查询采购单列表。" +
                "适用场景：订单列表、查看订单、采购单列表、工单列表。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> page = new HashMap<>();
        page.put("type", "integer");
        page.put("description", "页码（从0开始）");
        page.put("default", 0);
        properties.put("page", page);

        Map<String, Object> size = new HashMap<>();
        size.put("type", "integer");
        size.put("description", "每页数量");
        size.put("default", 20);
        properties.put("size", size);

        Map<String, Object> status = new HashMap<>();
        status.put("type", "string");
        status.put("description", "订单状态过滤（如：PENDING、IN_PROGRESS、COMPLETED）");
        properties.put("status", status);

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
        log.info("执行订单列表查询 - 工厂ID: {}, 参数: {}", factoryId, params);

        int page = getInteger(params, "page", 0);
        int size = getInteger(params, "size", 20);
        String status = getString(params, "status");

        PageRequest pageable = PageRequest.of(page, size);
        Page<WorkOrder> orders;

        if (status != null && !status.isEmpty()) {
            orders = workOrderService.getWorkOrdersByStatus(factoryId, status, pageable);
        } else {
            orders = workOrderService.getWorkOrders(factoryId, pageable);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("orders", orders.getContent());
        result.put("total", orders.getTotalElements());
        result.put("page", page);
        result.put("size", size);
        result.put("totalPages", orders.getTotalPages());
        result.put("message", "查询到 " + orders.getTotalElements() + " 个订单");
        return result;
    }
}
