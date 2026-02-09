package com.cretas.aims.ai.tool.impl.shipment;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.ShipmentRecord;
import com.cretas.aims.service.ShipmentRecordService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 出货确认工具
 *
 * 确认出货单，将状态从 pending 更新为 shipped（开始发货）。
 * 可选填写实际发货时间、车辆信息、司机信息等。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class ShipmentConfirmTool extends AbstractBusinessTool {

    @Autowired
    private ShipmentRecordService shipmentRecordService;

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public String getToolName() {
        return "shipment_confirm";
    }

    @Override
    public String getDescription() {
        return "确认出货单（开始发货）。" +
                "将出货单状态从'待发货'更新为'已发货'。" +
                "可以同时更新实际发货时间、车辆号码、司机姓名等信息。" +
                "适用场景：确认发货、更新物流信息、开始配送。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // shipmentId: 出货单ID（必需）
        Map<String, Object> shipmentId = new HashMap<>();
        shipmentId.put("type", "string");
        shipmentId.put("description", "出货单ID或出货单号");
        properties.put("shipmentId", shipmentId);

        // actualShipTime: 实际发货时间（可选）
        Map<String, Object> actualShipTime = new HashMap<>();
        actualShipTime.put("type", "string");
        actualShipTime.put("description", "实际发货时间，格式: yyyy-MM-dd HH:mm:ss，默认当前时间");
        properties.put("actualShipTime", actualShipTime);

        // vehicleNumber: 车辆号码（可选）
        Map<String, Object> vehicleNumber = new HashMap<>();
        vehicleNumber.put("type", "string");
        vehicleNumber.put("description", "配送车辆号码/车牌号");
        properties.put("vehicleNumber", vehicleNumber);

        // driverName: 司机姓名（可选）
        Map<String, Object> driverName = new HashMap<>();
        driverName.put("type", "string");
        driverName.put("description", "配送司机姓名");
        properties.put("driverName", driverName);

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
        // 1. 获取参数
        String shipmentId = getString(params, "shipmentId");
        String actualShipTime = getString(params, "actualShipTime");
        String vehicleNumber = getString(params, "vehicleNumber");
        String driverName = getString(params, "driverName");

        log.info("确认出货单: factoryId={}, shipmentId={}, vehicleNumber={}, driverName={}",
                factoryId, shipmentId, vehicleNumber, driverName);

        // 2. 查找出货记录（支持ID或出货单号）
        Optional<ShipmentRecord> recordOpt = shipmentRecordService.getByIdAndFactoryId(shipmentId, factoryId);
        if (recordOpt.isEmpty()) {
            // 尝试通过出货单号查找
            recordOpt = shipmentRecordService.getByShipmentNumberAndFactoryId(shipmentId, factoryId);
        }

        if (recordOpt.isEmpty()) {
            throw new IllegalArgumentException("未找到出货单: " + shipmentId);
        }

        ShipmentRecord record = recordOpt.get();

        // 3. 验证当前状态
        if (!"pending".equals(record.getStatus())) {
            throw new IllegalArgumentException("出货单状态不是'待发货'，当前状态: " + record.getStatus());
        }

        // 4. 更新状态为 shipped
        ShipmentRecord updated = shipmentRecordService.updateStatus(record.getId(), "shipped");

        // 5. 如果有额外信息，更新到notes字段
        if (vehicleNumber != null || driverName != null) {
            StringBuilder notesBuilder = new StringBuilder();
            if (record.getNotes() != null) {
                notesBuilder.append(record.getNotes()).append("\n");
            }
            notesBuilder.append("[发货确认] ");
            if (actualShipTime != null) {
                notesBuilder.append("发货时间: ").append(actualShipTime).append(" ");
            } else {
                notesBuilder.append("发货时间: ").append(LocalDateTime.now().format(DATE_TIME_FORMATTER)).append(" ");
            }
            if (vehicleNumber != null) {
                notesBuilder.append("车辆: ").append(vehicleNumber).append(" ");
            }
            if (driverName != null) {
                notesBuilder.append("司机: ").append(driverName);
            }

            ShipmentRecord updateData = new ShipmentRecord();
            updateData.setNotes(notesBuilder.toString().trim());
            updated = shipmentRecordService.updateShipment(record.getId(), updateData);
        }

        // 6. 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("shipmentId", updated.getId());
        result.put("shipmentNumber", updated.getShipmentNumber());
        result.put("previousStatus", "pending");
        result.put("currentStatus", "shipped");
        result.put("confirmedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
        if (vehicleNumber != null) {
            result.put("vehicleNumber", vehicleNumber);
        }
        if (driverName != null) {
            result.put("driverName", driverName);
        }
        result.put("message", String.format("出货单 %s 已确认发货", updated.getShipmentNumber()));

        log.info("出货确认成功: shipmentNumber={}", updated.getShipmentNumber());

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = new HashMap<>();
        questions.put("shipmentId", "请问您要确认哪个出货单？请提供出货单ID或出货单号。");
        questions.put("actualShipTime", "请问实际发货时间是什么时候？");
        questions.put("vehicleNumber", "请问配送车辆的车牌号是什么？");
        questions.put("driverName", "请问配送司机的姓名是什么？");

        String question = questions.get(paramName);
        return question != null ? question : super.getParameterQuestion(paramName);
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = new HashMap<>();
        displayNames.put("shipmentId", "出货单ID");
        displayNames.put("actualShipTime", "实际发货时间");
        displayNames.put("vehicleNumber", "车辆号码");
        displayNames.put("driverName", "司机姓名");

        String name = displayNames.get(paramName);
        return name != null ? name : super.getParameterDisplayName(paramName);
    }
}
