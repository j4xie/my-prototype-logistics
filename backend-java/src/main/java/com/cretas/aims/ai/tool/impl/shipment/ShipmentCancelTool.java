package com.cretas.aims.ai.tool.impl.shipment;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.ShipmentRecord;
import com.cretas.aims.service.ShipmentRecordService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 出货单取消工具
 *
 * 专门用于取消出货单，需要提供取消原因。
 * 取消后的出货单状态变为 CANCELLED，不可恢复。
 *
 * 业务规则：
 * 1. 必须提供取消原因
 * 2. 已取消的出货单不能再次取消
 * 3. 已送达的出货单取消需要特别说明
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class ShipmentCancelTool extends AbstractBusinessTool {

    @Autowired
    private ShipmentRecordService shipmentRecordService;

    @Override
    public String getToolName() {
        return "shipment_cancel";
    }

    @Override
    public String getDescription() {
        return "取消出货单。需要提供出货单ID和取消原因。取消后不可恢复。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // shipmentId: 出货单ID（必需）
        Map<String, Object> shipmentId = new HashMap<>();
        shipmentId.put("type", "string");
        shipmentId.put("description", "出货单ID，用于标识要取消的出货单");
        properties.put("shipmentId", shipmentId);

        // reason: 取消原因（必需）
        Map<String, Object> reason = new HashMap<>();
        reason.put("type", "string");
        reason.put("description", "取消原因，必须提供，用于记录和追溯");
        reason.put("minLength", 1);
        reason.put("maxLength", 500);
        properties.put("reason", reason);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("shipmentId", "reason"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("shipmentId", "reason");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行取消出货单 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 1. 解析参数
        String shipmentId = getString(params, "shipmentId");
        String reason = getString(params, "reason");

        // 2. 验证原因不为空
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("取消原因不能为空");
        }

        // 3. 验证出货单存在
        Optional<ShipmentRecord> existingOpt = shipmentRecordService.getByIdAndFactoryId(shipmentId, factoryId);
        if (existingOpt.isEmpty()) {
            throw new IllegalArgumentException("未找到出货单: " + shipmentId);
        }

        ShipmentRecord existing = existingOpt.get();
        String shipmentNumber = existing.getShipmentNumber();
        String currentStatus = existing.getStatus();

        // 4. 验证当前状态
        if ("returned".equals(currentStatus)) {
            throw new IllegalArgumentException("出货单 " + shipmentNumber + " 已被取消，不能重复取消");
        }

        String currentStatusDesc = getStatusDescription(currentStatus);

        // 5. 更新状态为取消（数据库中使用 returned）
        ShipmentRecord updated = shipmentRecordService.updateStatus(shipmentId, "returned");

        // 6. 更新备注记录取消原因
        String existingNotes = existing.getNotes() != null ? existing.getNotes() : "";
        String cancelNote = String.format("[取消] 原状态: %s | 原因: %s | 操作人ID: %s",
                currentStatusDesc, reason, getUserId(context));

        ShipmentRecord updateData = new ShipmentRecord();
        updateData.setNotes(existingNotes.isEmpty() ? cancelNote : existingNotes + " | " + cancelNote);
        shipmentRecordService.updateShipment(shipmentId, updateData);

        // 7. 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("shipmentId", updated.getId());
        result.put("shipmentNumber", shipmentNumber);
        result.put("previousStatus", currentStatusDesc);
        result.put("newStatus", "CANCELLED");
        result.put("reason", reason);
        result.put("cancelled", true);
        result.put("message", String.format("出货单 %s 已取消。原状态: %s，取消原因: %s",
                shipmentNumber, currentStatusDesc, reason));

        log.info("出货单取消完成 - 单号: {}, 原状态: {}, 原因: {}",
                shipmentNumber, currentStatusDesc, reason);

        return result;
    }

    /**
     * 获取状态描述
     */
    private String getStatusDescription(String status) {
        if (status == null) return "未知";
        return switch (status.toLowerCase()) {
            case "pending" -> "待发货";
            case "shipped" -> "已发货";
            case "delivered" -> "已送达";
            case "returned" -> "已取消";
            default -> status;
        };
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        switch (paramName) {
            case "shipmentId":
                return "请问要取消哪个出货单？请提供出货单ID或出货单号。";
            case "reason":
                return "请说明取消出货单的原因。";
            default:
                return super.getParameterQuestion(paramName);
        }
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        switch (paramName) {
            case "shipmentId":
                return "出货单ID";
            case "reason":
                return "取消原因";
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
        // 取消操作需要更高权限
        return "super_admin".equals(userRole) ||
                "factory_super_admin".equals(userRole) ||
                "platform_admin".equals(userRole) ||
                "factory_admin".equals(userRole);
    }
}
