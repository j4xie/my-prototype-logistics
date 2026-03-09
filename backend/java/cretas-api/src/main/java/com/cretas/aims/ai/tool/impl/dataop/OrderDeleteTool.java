package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 订单删除/取消工具
 *
 * 取消订单，需要确认操作。
 * Intent Code: ORDER_DELETE / ORDER_CANCEL
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class OrderDeleteTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "order_delete";
    }

    @Override
    public String getDescription() {
        return "取消/删除订单。此为不可撤销操作，需要确认。" +
                "适用场景：取消订单、删除未发货的订单。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> orderId = new HashMap<>();
        orderId.put("type", "string");
        orderId.put("description", "订单ID或订单编号");
        properties.put("orderId", orderId);

        Map<String, Object> confirmed = new HashMap<>();
        confirmed.put("type", "boolean");
        confirmed.put("description", "是否已确认取消");
        properties.put("confirmed", confirmed);

        schema.put("properties", properties);
        schema.put("required", Collections.singletonList("orderId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.singletonList("orderId");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("取消订单 - 工厂ID: {}, 参数: {}", factoryId, params);

        String orderId = getString(params, "orderId");
        Boolean confirmed = getBoolean(params, "confirmed", false);

        Map<String, Object> result = new HashMap<>();
        result.put("orderId", orderId);

        if (!confirmed) {
            result.put("status", "NEED_CONFIRM");
            result.put("message", "确认要取消订单 " + orderId + " 吗？此操作不可撤销。");
        } else {
            // TODO: 调用 SalesService.cancelOrder
            result.put("status", "COMPLETED");
            result.put("message", "订单 " + orderId + " 已取消");
            result.put("operation", "CANCEL");
        }
        result.put("notice", "请接入SalesService完成实际操作");

        return result;
    }
}
