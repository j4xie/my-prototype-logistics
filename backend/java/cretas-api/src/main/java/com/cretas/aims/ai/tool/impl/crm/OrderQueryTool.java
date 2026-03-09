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
public class OrderQueryTool extends AbstractBusinessTool {

    @Autowired
    private WorkOrderService workOrderService;

    @Override
    public String getToolName() {
        return "order_query";
    }

    @Override
    public String getDescription() {
        return "查询订单/工单状态、详情或今日订单。支持按订单ID查询详情或按状态查询。" +
                "适用场景：订单状态查询、订单详情、今日订单、查看订单进度。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> orderId = new HashMap<>();
        orderId.put("type", "string");
        orderId.put("description", "订单/工单ID或编号（查询具体订单时使用）");
        properties.put("orderId", orderId);

        Map<String, Object> queryType = new HashMap<>();
        queryType.put("type", "string");
        queryType.put("description", "查询类型：ORDER_STATUS（订单状态）、ORDER_DETAIL（订单详情）、ORDER_TODAY（今日订单）");
        queryType.put("default", "ORDER_STATUS");
        properties.put("queryType", queryType);

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
        log.info("执行订单查询 - 工厂ID: {}, 参数: {}", factoryId, params);

        String orderId = getString(params, "orderId");
        String queryType = getString(params, "queryType", "ORDER_STATUS");
        int page = getInteger(params, "page", 0);
        int size = getInteger(params, "size", 20);

        Map<String, Object> result = new HashMap<>();
        result.put("queryType", queryType);

        // If specific orderId provided, query that order
        if (orderId != null && !orderId.isEmpty()) {
            Optional<WorkOrder> order = workOrderService.getWorkOrderById(factoryId, orderId);
            if (order.isPresent()) {
                result.put("order", order.get());
                result.put("message", "订单查询成功");
            } else {
                // Try by order number
                Optional<WorkOrder> byNumber = workOrderService.getByOrderNumber(orderId);
                if (byNumber.isPresent()) {
                    result.put("order", byNumber.get());
                    result.put("message", "订单查询成功");
                } else {
                    result.put("message", "未找到订单: " + orderId);
                }
            }
            return result;
        }

        // General query
        PageRequest pageable = PageRequest.of(page, size);
        Page<WorkOrder> orders = workOrderService.getWorkOrders(factoryId, pageable);

        result.put("orders", orders.getContent());
        result.put("total", orders.getTotalElements());
        result.put("message", "订单查询完成，共" + orders.getTotalElements() + "条");
        return result;
    }
}
