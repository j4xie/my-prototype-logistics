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
public class OrderCreateTool extends AbstractBusinessTool {

    @Autowired
    private WorkOrderService workOrderService;

    @Override
    public String getToolName() {
        return "order_create";
    }

    @Override
    public String getDescription() {
        return "创建新订单/工单。需要订单类型和商品明细等信息。" +
                "适用场景：创建订单、新建工单、下单、新增采购订单、新增销售订单。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> orderType = new HashMap<>();
        orderType.put("type", "string");
        orderType.put("description", "订单类型（采购/销售）");
        properties.put("orderType", orderType);

        Map<String, Object> title = new HashMap<>();
        title.put("type", "string");
        title.put("description", "订单标题/描述");
        properties.put("title", title);

        Map<String, Object> items = new HashMap<>();
        items.put("type", "string");
        items.put("description", "商品明细描述");
        properties.put("items", items);

        Map<String, Object> customerId = new HashMap<>();
        customerId.put("type", "string");
        customerId.put("description", "客户ID（销售订单时使用）");
        properties.put("customerId", customerId);

        Map<String, Object> supplierId = new HashMap<>();
        supplierId.put("type", "string");
        supplierId.put("description", "供应商ID（采购订单时使用）");
        properties.put("supplierId", supplierId);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("orderType", "title"));
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("orderType", "title");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行订单创建 - 工厂ID: {}, 参数: {}", factoryId, params);

        String orderType = getString(params, "orderType");
        String title = getString(params, "title");
        String items = getString(params, "items");
        String customerId = getString(params, "customerId");
        String supplierId = getString(params, "supplierId");

        // Build WorkOrder entity
        WorkOrder workOrder = new WorkOrder();
        workOrder.setFactoryId(factoryId);
        workOrder.setTitle(title);
        workOrder.setDescription(items);
        workOrder.setStatus("PENDING");
        workOrder.setOrderType(orderType);

        WorkOrder created = workOrderService.createWorkOrder(workOrder);

        Map<String, Object> result = new HashMap<>();
        result.put("order", created);
        result.put("message", "订单创建成功: " + title);
        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        switch (paramName) {
            case "orderType":
                return "请问要创建什么类型的订单？（采购/销售）";
            case "title":
                return "请提供订单标题或描述。";
            default:
                return super.getParameterQuestion(paramName);
        }
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        switch (paramName) {
            case "orderType":
                return "订单类型";
            case "title":
                return "订单标题";
            case "items":
                return "商品明细";
            case "customerId":
                return "客户ID";
            case "supplierId":
                return "供应商ID";
            default:
                return super.getParameterDisplayName(paramName);
        }
    }
}
