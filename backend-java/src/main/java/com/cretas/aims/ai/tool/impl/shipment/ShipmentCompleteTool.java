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
 * 出货完成工具
 *
 * 完成出货单，将状态从 shipped 更新为 delivered（已送达）。
 * 可选填写送达时间、签收人、备注等信息。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class ShipmentCompleteTool extends AbstractBusinessTool {

    @Autowired
    private ShipmentRecordService shipmentRecordService;

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public String getToolName() {
        return "shipment_complete";
    }

    @Override
    public String getDescription() {
        return "完成出货单（已送达）。" +
                "将出货单状态更新为'已送达'。" +
                "可以同时记录送达时间、签收人、备注等信息。" +
                "适用场景：确认签收、完成配送、结束出货流程。";
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

        // deliveryTime: 送达时间（可选）
        Map<String, Object> deliveryTime = new HashMap<>();
        deliveryTime.put("type", "string");
        deliveryTime.put("description", "实际送达时间，格式: yyyy-MM-dd HH:mm:ss，默认当前时间");
        properties.put("deliveryTime", deliveryTime);

        // signedBy: 签收人（可选）
        Map<String, Object> signedBy = new HashMap<>();
        signedBy.put("type", "string");
        signedBy.put("description", "签收人姓名");
        properties.put("signedBy", signedBy);

        // notes: 备注（可选）
        Map<String, Object> notes = new HashMap<>();
        notes.put("type", "string");
        notes.put("description", "送达备注信息");
        properties.put("notes", notes);

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
        String deliveryTime = getString(params, "deliveryTime");
        String signedBy = getString(params, "signedBy");
        String notes = getString(params, "notes");

        log.info("完成出货单: factoryId={}, shipmentId={}, signedBy={}",
                factoryId, shipmentId, signedBy);

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
        String previousStatus = record.getStatus();

        // 3. 验证当前状态（允许从 pending 或 shipped 状态完成）
        if ("delivered".equals(record.getStatus())) {
            throw new IllegalArgumentException("出货单已经是'已送达'状态");
        }
        if ("returned".equals(record.getStatus())) {
            throw new IllegalArgumentException("出货单已退回，无法完成");
        }

        // 4. 更新状态为 delivered
        ShipmentRecord updated = shipmentRecordService.updateStatus(record.getId(), "delivered");

        // 5. 更新备注信息
        StringBuilder notesBuilder = new StringBuilder();
        if (record.getNotes() != null) {
            notesBuilder.append(record.getNotes()).append("\n");
        }
        notesBuilder.append("[送达确认] ");
        if (deliveryTime != null) {
            notesBuilder.append("送达时间: ").append(deliveryTime).append(" ");
        } else {
            notesBuilder.append("送达时间: ").append(LocalDateTime.now().format(DATE_TIME_FORMATTER)).append(" ");
        }
        if (signedBy != null) {
            notesBuilder.append("签收人: ").append(signedBy).append(" ");
        }
        if (notes != null) {
            notesBuilder.append("备注: ").append(notes);
        }

        ShipmentRecord updateData = new ShipmentRecord();
        updateData.setNotes(notesBuilder.toString().trim());
        updated = shipmentRecordService.updateShipment(record.getId(), updateData);

        // 6. 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("shipmentId", updated.getId());
        result.put("shipmentNumber", updated.getShipmentNumber());
        result.put("previousStatus", previousStatus);
        result.put("currentStatus", "delivered");
        result.put("completedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
        if (signedBy != null) {
            result.put("signedBy", signedBy);
        }
        result.put("message", String.format("出货单 %s 已完成送达", updated.getShipmentNumber()));

        log.info("出货完成成功: shipmentNumber={}", updated.getShipmentNumber());

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = new HashMap<>();
        questions.put("shipmentId", "请问您要完成哪个出货单？请提供出货单ID或出货单号。");
        questions.put("deliveryTime", "请问实际送达时间是什么时候？");
        questions.put("signedBy", "请问签收人的姓名是什么？");
        questions.put("notes", "请问有什么需要备注的信息吗？");

        String question = questions.get(paramName);
        return question != null ? question : super.getParameterQuestion(paramName);
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = new HashMap<>();
        displayNames.put("shipmentId", "出货单ID");
        displayNames.put("deliveryTime", "送达时间");
        displayNames.put("signedBy", "签收人");
        displayNames.put("notes", "备注");

        String name = displayNames.get(paramName);
        return name != null ? name : super.getParameterDisplayName(paramName);
    }
}
