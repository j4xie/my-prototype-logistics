package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * 订单查询工具
 *
 * 查询订单状态、详情、今日订单、超时监控等。
 * Intent Code: ORDER_STATUS / ORDER_DETAIL / ORDER_TODAY / ORDER_LIST /
 *              ORDER_FILTER / ORDER_TIMEOUT_MONITOR
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class OrderQueryTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "order_query";
    }

    @Override
    public String getDescription() {
        return "查询订单信息，支持按状态、日期、订单号等条件查询。" +
                "适用场景：查看订单状态、今日订单、订单详情、超时订单监控。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> queryType = new HashMap<>();
        queryType.put("type", "string");
        queryType.put("description", "查询类型");
        queryType.put("enum", Arrays.asList("ORDER_STATUS", "ORDER_DETAIL", "ORDER_TODAY",
                "ORDER_LIST", "ORDER_FILTER", "ORDER_TIMEOUT_MONITOR"));
        properties.put("queryType", queryType);

        Map<String, Object> orderId = new HashMap<>();
        orderId.put("type", "string");
        orderId.put("description", "订单ID（查询详情时需要）");
        properties.put("orderId", orderId);

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
        log.info("查询订单 - 工厂ID: {}, 参数: {}", factoryId, params);

        String queryType = getString(params, "queryType", "ORDER_LIST");
        String orderId = getString(params, "orderId");

        Map<String, Object> result = new HashMap<>();
        result.put("factoryId", factoryId);
        result.put("queryType", queryType);

        switch (queryType) {
            case "ORDER_TODAY":
                result.put("date", LocalDate.now().toString());
                result.put("message", "今日订单查询完成");
                break;
            case "ORDER_TIMEOUT_MONITOR":
                result.put("monitorType", "overdue");
                result.put("message", "超时订单监控数据获取完成");
                break;
            case "ORDER_DETAIL":
                if (orderId == null) {
                    result.put("message", "请提供要查询的订单编号");
                    result.put("status", "NEED_MORE_INFO");
                } else {
                    result.put("orderId", orderId);
                    result.put("message", "订单详情查询完成");
                }
                break;
            default:
                result.put("message", "订单数据查询完成");
        }

        result.put("notice", "请接入SalesService完成实际查询");
        return result;
    }
}
