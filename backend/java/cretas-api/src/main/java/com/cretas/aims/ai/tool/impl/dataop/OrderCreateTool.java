package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * 订单创建工具
 *
 * 创建销售订单，支持指定客户、产品类型、数量等。
 * Intent Code: ORDER_NEW / ORDER_CREATE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class OrderCreateTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "order_create";
    }

    @Override
    public String getDescription() {
        return "创建销售订单。需要提供客户ID、产品类型ID和数量。" +
                "适用场景：下单、创建订单、新建销售单。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> customerId = new HashMap<>();
        customerId.put("type", "string");
        customerId.put("description", "客户ID");
        properties.put("customerId", customerId);

        Map<String, Object> productTypeId = new HashMap<>();
        productTypeId.put("type", "string");
        productTypeId.put("description", "产品类型ID");
        properties.put("productTypeId", productTypeId);

        Map<String, Object> quantity = new HashMap<>();
        quantity.put("type", "number");
        quantity.put("description", "订购数量");
        properties.put("quantity", quantity);

        Map<String, Object> unit = new HashMap<>();
        unit.put("type", "string");
        unit.put("description", "单位，如箱、kg等");
        properties.put("unit", unit);

        Map<String, Object> unitPrice = new HashMap<>();
        unitPrice.put("type", "number");
        unitPrice.put("description", "单价");
        properties.put("unitPrice", unitPrice);

        Map<String, Object> requiredDeliveryDate = new HashMap<>();
        requiredDeliveryDate.put("type", "string");
        requiredDeliveryDate.put("format", "date");
        requiredDeliveryDate.put("description", "要求交付日期，格式YYYY-MM-DD");
        properties.put("requiredDeliveryDate", requiredDeliveryDate);

        Map<String, Object> remark = new HashMap<>();
        remark.put("type", "string");
        remark.put("description", "备注");
        properties.put("remark", remark);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("customerId", "productTypeId", "quantity"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("customerId", "productTypeId", "quantity");
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        return switch (paramName) {
            case "customerId" -> "请提供客户ID。";
            case "productTypeId" -> "请提供产品类型ID。";
            case "quantity" -> "请提供订购数量。";
            default -> super.getParameterQuestion(paramName);
        };
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("创建订单 - 工厂ID: {}, 参数: {}", factoryId, params);

        String customerId = getString(params, "customerId");
        String productTypeId = getString(params, "productTypeId");
        BigDecimal quantity = getBigDecimal(params, "quantity");
        String unit = getString(params, "unit", "箱");
        BigDecimal unitPrice = getBigDecimal(params, "unitPrice");
        String remark = getString(params, "remark");

        // TODO: 调用 SalesService.createSalesOrder
        Map<String, Object> result = new HashMap<>();
        result.put("message", "订单创建成功");
        result.put("customerId", customerId);
        result.put("productTypeId", productTypeId);
        result.put("quantity", quantity);
        result.put("unit", unit);
        result.put("orderDate", LocalDate.now().toString());
        result.put("notice", "请接入SalesService完成实际创建");

        return result;
    }
}
