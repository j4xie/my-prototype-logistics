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
 * 出货单更新工具
 *
 * 更新出货单的基本信息，如客户、发货日期、备注等。
 * 不包含状态更新，状态更新请使用 ShipmentStatusUpdateTool。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class ShipmentUpdateTool extends AbstractBusinessTool {

    @Autowired
    private ShipmentRecordService shipmentRecordService;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Override
    public String getToolName() {
        return "shipment_update";
    }

    @Override
    public String getDescription() {
        return "更新出货单信息。需要指定出货单ID，可更新客户、计划发货日期、备注、车辆编号等信息。" +
                "注意：状态更新请使用 shipment_status_update 工具。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // shipmentId: 出货单ID（必需）
        Map<String, Object> shipmentId = new HashMap<>();
        shipmentId.put("type", "string");
        shipmentId.put("description", "出货单ID，用于标识要更新的出货单");
        properties.put("shipmentId", shipmentId);

        // customerId: 客户ID（可选）
        Map<String, Object> customerId = new HashMap<>();
        customerId.put("type", "string");
        customerId.put("description", "新的客户ID");
        properties.put("customerId", customerId);

        // scheduledDate: 计划发货日期（可选）
        Map<String, Object> scheduledDate = new HashMap<>();
        scheduledDate.put("type", "string");
        scheduledDate.put("description", "新的计划发货日期，格式：yyyy-MM-dd");
        scheduledDate.put("format", "date");
        properties.put("scheduledDate", scheduledDate);

        // notes: 备注（可选）
        Map<String, Object> notes = new HashMap<>();
        notes.put("type", "string");
        notes.put("description", "新的备注信息");
        notes.put("maxLength", 500);
        properties.put("notes", notes);

        // vehicleNumber: 车辆编号（可选）
        Map<String, Object> vehicleNumber = new HashMap<>();
        vehicleNumber.put("type", "string");
        vehicleNumber.put("description", "新的车辆编号或物流单号");
        properties.put("vehicleNumber", vehicleNumber);

        // deliveryAddress: 配送地址（可选）
        Map<String, Object> deliveryAddress = new HashMap<>();
        deliveryAddress.put("type", "string");
        deliveryAddress.put("description", "新的配送地址");
        properties.put("deliveryAddress", deliveryAddress);

        // logisticsCompany: 物流公司（可选）
        Map<String, Object> logisticsCompany = new HashMap<>();
        logisticsCompany.put("type", "string");
        logisticsCompany.put("description", "物流公司名称");
        properties.put("logisticsCompany", logisticsCompany);

        // productName: 产品名称（可选）
        Map<String, Object> productName = new HashMap<>();
        productName.put("type", "string");
        productName.put("description", "产品名称");
        properties.put("productName", productName);

        // quantity: 数量（可选）
        Map<String, Object> quantity = new HashMap<>();
        quantity.put("type", "number");
        quantity.put("description", "出货数量");
        properties.put("quantity", quantity);

        // unitPrice: 单价（可选）
        Map<String, Object> unitPrice = new HashMap<>();
        unitPrice.put("type", "number");
        unitPrice.put("description", "产品单价");
        properties.put("unitPrice", unitPrice);

        schema.put("properties", properties);
        schema.put("required", Collections.singletonList("shipmentId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.singletonList("shipmentId");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行更新出货单 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 1. 解析必需参数
        String shipmentId = getString(params, "shipmentId");

        // 2. 验证出货单存在
        Optional<ShipmentRecord> existingOpt = shipmentRecordService.getByIdAndFactoryId(shipmentId, factoryId);
        if (existingOpt.isEmpty()) {
            throw new IllegalArgumentException("未找到出货单: " + shipmentId);
        }

        ShipmentRecord existing = existingOpt.get();
        String originalNumber = existing.getShipmentNumber();

        // 3. 构建更新数据
        ShipmentRecord updateData = new ShipmentRecord();
        List<String> updatedFields = new ArrayList<>();

        // 客户ID
        String customerId = getString(params, "customerId");
        if (customerId != null && !customerId.trim().isEmpty()) {
            updateData.setCustomerId(customerId);
            updatedFields.add("customerId");
        }

        // 计划发货日期
        String scheduledDateStr = getString(params, "scheduledDate");
        if (scheduledDateStr != null && !scheduledDateStr.trim().isEmpty()) {
            try {
                LocalDate scheduledDate = LocalDate.parse(scheduledDateStr, DATE_FORMATTER);
                updateData.setShipmentDate(scheduledDate);
                updatedFields.add("scheduledDate");
            } catch (DateTimeParseException e) {
                log.warn("日期格式解析失败: {}", scheduledDateStr);
            }
        }

        // 备注
        String notes = getString(params, "notes");
        if (notes != null) {
            updateData.setNotes(notes);
            updatedFields.add("notes");
        }

        // 车辆编号/物流单号
        String vehicleNumber = getString(params, "vehicleNumber");
        if (vehicleNumber != null && !vehicleNumber.trim().isEmpty()) {
            updateData.setTrackingNumber(vehicleNumber);
            updatedFields.add("vehicleNumber");
        }

        // 配送地址
        String deliveryAddress = getString(params, "deliveryAddress");
        if (deliveryAddress != null && !deliveryAddress.trim().isEmpty()) {
            updateData.setDeliveryAddress(deliveryAddress);
            updatedFields.add("deliveryAddress");
        }

        // 物流公司
        String logisticsCompany = getString(params, "logisticsCompany");
        if (logisticsCompany != null && !logisticsCompany.trim().isEmpty()) {
            updateData.setLogisticsCompany(logisticsCompany);
            updatedFields.add("logisticsCompany");
        }

        // 产品名称
        String productName = getString(params, "productName");
        if (productName != null && !productName.trim().isEmpty()) {
            updateData.setProductName(productName);
            updatedFields.add("productName");
        }

        // 数量
        if (params.containsKey("quantity")) {
            updateData.setQuantity(getBigDecimal(params, "quantity"));
            updatedFields.add("quantity");
        }

        // 单价
        if (params.containsKey("unitPrice")) {
            updateData.setUnitPrice(getBigDecimal(params, "unitPrice"));
            updatedFields.add("unitPrice");
        }

        // 4. 检查是否有更新
        if (updatedFields.isEmpty()) {
            Map<String, Object> result = new HashMap<>();
            result.put("shipmentId", shipmentId);
            result.put("shipmentNumber", originalNumber);
            result.put("updated", false);
            result.put("message", "没有提供需要更新的字段");
            return result;
        }

        // 5. 调用服务更新
        ShipmentRecord updated = shipmentRecordService.updateShipment(shipmentId, updateData);

        // 6. 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("shipmentId", updated.getId());
        result.put("shipmentNumber", updated.getShipmentNumber());
        result.put("updated", true);
        result.put("updatedFields", updatedFields);
        result.put("message", String.format("出货单 %s 更新成功，已更新字段: %s",
                updated.getShipmentNumber(), String.join(", ", updatedFields)));

        log.info("出货单更新完成 - 单号: {}, 更新字段: {}", updated.getShipmentNumber(), updatedFields);

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        switch (paramName) {
            case "shipmentId":
                return "请问要更新哪个出货单？请提供出货单ID。";
            case "customerId":
                return "请问要更新为哪个客户？";
            case "scheduledDate":
                return "请问新的计划发货日期是？（格式：yyyy-MM-dd）";
            case "notes":
                return "请问新的备注内容是什么？";
            case "vehicleNumber":
                return "请问新的车辆编号/物流单号是什么？";
            case "deliveryAddress":
                return "请问新的配送地址是什么？";
            default:
                return super.getParameterQuestion(paramName);
        }
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        switch (paramName) {
            case "shipmentId":
                return "出货单ID";
            case "customerId":
                return "客户ID";
            case "scheduledDate":
                return "计划发货日期";
            case "notes":
                return "备注";
            case "vehicleNumber":
                return "车辆编号";
            case "deliveryAddress":
                return "配送地址";
            case "logisticsCompany":
                return "物流公司";
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
