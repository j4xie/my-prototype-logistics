package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 订单更新工具
 *
 * 修改订单状态，支持确认和取消操作。
 * Intent Code: ORDER_UPDATE / ORDER_MODIFY
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class OrderUpdateTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "order_update";
    }

    @Override
    public String getDescription() {
        return "修改订单信息或状态。支持确认订单(confirm)和取消订单(cancel)操作。" +
                "适用场景：确认订单、取消订单、修改订单状态。";
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

        Map<String, Object> action = new HashMap<>();
        action.put("type", "string");
        action.put("description", "操作类型");
        action.put("enum", Arrays.asList("confirm", "cancel"));
        properties.put("action", action);

        schema.put("properties", properties);
        schema.put("required", Collections.singletonList("orderId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.singletonList("orderId");
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        if ("orderId".equals(paramName)) {
            return "请提供要修改的订单ID或订单编号。";
        }
        return super.getParameterQuestion(paramName);
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("更新订单 - 工厂ID: {}, 参数: {}", factoryId, params);

        String orderId = getString(params, "orderId");
        String action = getString(params, "action");

        // TODO: 调用 SalesService.confirmOrder / cancelOrder
        Map<String, Object> result = new HashMap<>();
        result.put("orderId", orderId);
        result.put("action", action);
        if (action != null) {
            result.put("message", "订单 " + orderId + " 已" + ("confirm".equals(action) ? "确认" : "取消"));
        } else {
            result.put("message", "请指定操作: confirm(确认) 或 cancel(取消)");
            result.put("availableActions", Arrays.asList("confirm", "cancel"));
        }
        result.put("notice", "请接入SalesService完成实际操作");

        return result;
    }
}
