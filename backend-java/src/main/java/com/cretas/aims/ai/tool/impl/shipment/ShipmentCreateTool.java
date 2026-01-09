package com.cretas.aims.ai.tool.impl.shipment;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.ShipmentRecord;
import com.cretas.aims.service.ShipmentRecordService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * 出货单创建工具
 *
 * 创建新的出货单，支持关联产品批次和客户信息。
 * 创建后默认状态为 PENDING（待发货）。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class ShipmentCreateTool extends AbstractBusinessTool {

    @Autowired
    private ShipmentRecordService shipmentRecordService;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Override
    public String getToolName() {
        return "shipment_create";
    }

    @Override
    public String getDescription() {
        return "创建出货单。需要指定客户ID和产品批次列表，可选指定计划发货日期、备注和车辆编号。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // customerId: 客户ID（必需）
        Map<String, Object> customerId = new HashMap<>();
        customerId.put("type", "string");
        customerId.put("description", "客户ID，用于标识出货目标客户");
        properties.put("customerId", customerId);

        // productBatchIds: 产品批次ID列表（必需）
        Map<String, Object> productBatchIds = new HashMap<>();
        productBatchIds.put("type", "array");
        productBatchIds.put("description", "产品批次ID列表，关联本次出货的所有产品批次");
        Map<String, Object> items = new HashMap<>();
        items.put("type", "string");
        productBatchIds.put("items", items);
        properties.put("productBatchIds", productBatchIds);

        // productName: 产品名称（必需，用于记录）
        Map<String, Object> productName = new HashMap<>();
        productName.put("type", "string");
        productName.put("description", "产品名称，用于出货记录显示");
        properties.put("productName", productName);

        // quantity: 出货数量（必需）
        Map<String, Object> quantity = new HashMap<>();
        quantity.put("type", "number");
        quantity.put("description", "出货数量");
        quantity.put("minimum", 0.001);
        properties.put("quantity", quantity);

        // unit: 单位（必需）
        Map<String, Object> unit = new HashMap<>();
        unit.put("type", "string");
        unit.put("description", "计量单位，如：kg、箱、件");
        properties.put("unit", unit);

        // scheduledDate: 计划发货日期（可选）
        Map<String, Object> scheduledDate = new HashMap<>();
        scheduledDate.put("type", "string");
        scheduledDate.put("description", "计划发货日期，格式：yyyy-MM-dd，不指定则使用当天");
        scheduledDate.put("format", "date");
        properties.put("scheduledDate", scheduledDate);

        // notes: 备注（可选）
        Map<String, Object> notes = new HashMap<>();
        notes.put("type", "string");
        notes.put("description", "出货单备注信息");
        notes.put("maxLength", 500);
        properties.put("notes", notes);

        // vehicleNumber: 车辆编号（可选）
        Map<String, Object> vehicleNumber = new HashMap<>();
        vehicleNumber.put("type", "string");
        vehicleNumber.put("description", "运输车辆编号或物流单号");
        properties.put("vehicleNumber", vehicleNumber);

        // deliveryAddress: 配送地址（可选）
        Map<String, Object> deliveryAddress = new HashMap<>();
        deliveryAddress.put("type", "string");
        deliveryAddress.put("description", "配送目的地址");
        properties.put("deliveryAddress", deliveryAddress);

        // unitPrice: 单价（可选）
        Map<String, Object> unitPrice = new HashMap<>();
        unitPrice.put("type", "number");
        unitPrice.put("description", "产品单价");
        properties.put("unitPrice", unitPrice);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("customerId", "productBatchIds"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("customerId", "productBatchIds");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行创建出货单 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 1. 解析必需参数
        String customerId = getString(params, "customerId");
        List<String> productBatchIds = getList(params, "productBatchIds");

        // 2. 解析可选参数
        String productName = getString(params, "productName", "产品出货");
        String quantityStr = getString(params, "quantity");
        String unit = getString(params, "unit", "件");
        String scheduledDateStr = getString(params, "scheduledDate");
        String notes = getString(params, "notes");
        String vehicleNumber = getString(params, "vehicleNumber");
        String deliveryAddress = getString(params, "deliveryAddress");
        String unitPriceStr = getString(params, "unitPrice");

        // 3. 构建出货记录
        ShipmentRecord shipment = new ShipmentRecord();
        shipment.setFactoryId(factoryId);
        shipment.setCustomerId(customerId);
        shipment.setProductName(productName);
        shipment.setStatus("pending"); // 默认状态

        // 设置数量
        if (quantityStr != null) {
            shipment.setQuantity(getBigDecimal(params, "quantity"));
        } else {
            shipment.setQuantity(java.math.BigDecimal.ONE);
        }

        // 设置单位
        shipment.setUnit(unit);

        // 设置计划发货日期
        if (scheduledDateStr != null && !scheduledDateStr.trim().isEmpty()) {
            try {
                LocalDate scheduledDate = LocalDate.parse(scheduledDateStr, DATE_FORMATTER);
                shipment.setShipmentDate(scheduledDate);
            } catch (DateTimeParseException e) {
                log.warn("日期格式解析失败，使用当天: {}", scheduledDateStr);
                shipment.setShipmentDate(LocalDate.now());
            }
        } else {
            shipment.setShipmentDate(LocalDate.now());
        }

        // 设置备注（包含产品批次信息）
        StringBuilder notesBuilder = new StringBuilder();
        if (notes != null && !notes.trim().isEmpty()) {
            notesBuilder.append(notes);
        }
        if (productBatchIds != null && !productBatchIds.isEmpty()) {
            if (notesBuilder.length() > 0) {
                notesBuilder.append(" | ");
            }
            notesBuilder.append("关联批次: ").append(String.join(", ", productBatchIds));
        }
        shipment.setNotes(notesBuilder.toString());

        // 设置车辆编号/物流信息
        if (vehicleNumber != null && !vehicleNumber.trim().isEmpty()) {
            shipment.setTrackingNumber(vehicleNumber);
        }

        // 设置配送地址
        if (deliveryAddress != null && !deliveryAddress.trim().isEmpty()) {
            shipment.setDeliveryAddress(deliveryAddress);
        }

        // 设置单价
        if (unitPriceStr != null) {
            shipment.setUnitPrice(getBigDecimal(params, "unitPrice"));
        }

        // 设置记录人
        Long userId = getUserId(context);
        shipment.setRecordedBy(userId);

        // 4. 调用服务创建
        ShipmentRecord created = shipmentRecordService.createShipment(shipment);

        // 5. 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("shipmentId", created.getId());
        result.put("shipmentNumber", created.getShipmentNumber());
        result.put("customerId", created.getCustomerId());
        result.put("productName", created.getProductName());
        result.put("quantity", created.getQuantity());
        result.put("unit", created.getUnit());
        result.put("shipmentDate", created.getShipmentDate().toString());
        result.put("status", created.getStatus());
        result.put("productBatchIds", productBatchIds);
        result.put("message", String.format("出货单创建成功，单号: %s，客户: %s，产品: %s",
                created.getShipmentNumber(), customerId, productName));

        log.info("出货单创建完成 - 单号: {}, 客户: {}", created.getShipmentNumber(), customerId);

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        switch (paramName) {
            case "customerId":
                return "请问出货给哪个客户？请提供客户ID。";
            case "productBatchIds":
                return "请问要出货哪些产品批次？请提供产品批次ID列表。";
            case "productName":
                return "请问产品名称是什么？";
            case "quantity":
                return "请问出货数量是多少？";
            case "unit":
                return "请问计量单位是什么？（如：kg、箱、件）";
            case "scheduledDate":
                return "请问计划什么时候发货？（格式：yyyy-MM-dd）";
            case "notes":
                return "请问有什么备注信息？（可选）";
            case "vehicleNumber":
                return "请问运输车辆编号是什么？（可选）";
            default:
                return super.getParameterQuestion(paramName);
        }
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        switch (paramName) {
            case "customerId":
                return "客户ID";
            case "productBatchIds":
                return "产品批次列表";
            case "productName":
                return "产品名称";
            case "quantity":
                return "出货数量";
            case "unit":
                return "单位";
            case "scheduledDate":
                return "计划发货日期";
            case "notes":
                return "备注";
            case "vehicleNumber":
                return "车辆编号";
            default:
                return super.getParameterDisplayName(paramName);
        }
    }

    @Override
    public boolean requiresPermission() {
        return true;
    }

    @Override
    public boolean hasPermission(String userRole) {
        return "super_admin".equals(userRole) ||
                "factory_super_admin".equals(userRole) ||
                "platform_admin".equals(userRole) ||
                "factory_admin".equals(userRole) ||
                "warehouse_manager".equals(userRole);
    }
}
