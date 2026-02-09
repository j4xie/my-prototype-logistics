package com.cretas.aims.ai.tool.impl.shipment;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.ShipmentRecord;
import com.cretas.aims.service.ShipmentRecordService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 出货单状态更新工具
 *
 * 专门用于更新出货单的状态，支持状态流转：
 * PENDING -> SHIPPED -> DELIVERED
 * 任意状态 -> CANCELLED（需提供原因）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class ShipmentStatusUpdateTool extends AbstractBusinessTool {

    @Autowired
    private ShipmentRecordService shipmentRecordService;

    // 有效状态列表
    private static final List<String> VALID_STATUSES = Arrays.asList(
            "PENDING", "SHIPPED", "DELIVERED", "CANCELLED"
    );

    @Override
    public String getToolName() {
        return "shipment_status_update";
    }

    @Override
    public String getDescription() {
        return "更新出货单状态。支持状态：PENDING(待发货)、SHIPPED(已发货)、DELIVERED(已送达)、CANCELLED(已取消)。" +
                "取消操作需要提供原因。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // shipmentId: 出货单ID（必需）
        Map<String, Object> shipmentId = new HashMap<>();
        shipmentId.put("type", "string");
        shipmentId.put("description", "出货单ID，用于标识要更新状态的出货单");
        properties.put("shipmentId", shipmentId);

        // status: 新状态（必需）
        Map<String, Object> status = new HashMap<>();
        status.put("type", "string");
        status.put("description", "新的出货单状态");
        status.put("enum", VALID_STATUSES);
        properties.put("status", status);

        // reason: 原因（可选，取消时必需）
        Map<String, Object> reason = new HashMap<>();
        reason.put("type", "string");
        reason.put("description", "状态变更原因，取消操作时必须提供");
        reason.put("maxLength", 500);
        properties.put("reason", reason);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("shipmentId", "status"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("shipmentId", "status");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行出货单状态更新 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 1. 解析参数
        String shipmentId = getString(params, "shipmentId");
        String status = getString(params, "status");
        String reason = getString(params, "reason");

        // 2. 验证状态值
        String upperStatus = status.toUpperCase();
        if (!VALID_STATUSES.contains(upperStatus)) {
            throw new IllegalArgumentException("无效的状态值: " + status +
                    "。有效值: " + String.join(", ", VALID_STATUSES));
        }

        // 3. 取消操作必须提供原因
        if ("CANCELLED".equals(upperStatus) && (reason == null || reason.trim().isEmpty())) {
            throw new IllegalArgumentException("取消出货单必须提供原因");
        }

        // 4. 验证出货单存在
        Optional<ShipmentRecord> existingOpt = shipmentRecordService.getByIdAndFactoryId(shipmentId, factoryId);
        if (existingOpt.isEmpty()) {
            throw new IllegalArgumentException("未找到出货单: " + shipmentId);
        }

        ShipmentRecord existing = existingOpt.get();
        String oldStatus = existing.getStatus();
        String oldStatusUpper = mapStatusToUpper(oldStatus);

        // 5. 验证状态流转合法性
        validateStatusTransition(oldStatusUpper, upperStatus);

        // 6. 映射状态并更新
        String mappedStatus = mapStatus(upperStatus);
        ShipmentRecord updated = shipmentRecordService.updateStatus(shipmentId, mappedStatus);

        // 7. 如果有原因，更新备注
        if (reason != null && !reason.trim().isEmpty()) {
            ShipmentRecord updateData = new ShipmentRecord();
            String existingNotes = existing.getNotes() != null ? existing.getNotes() : "";
            String statusChangeNote = String.format("[状态变更: %s -> %s] 原因: %s",
                    oldStatusUpper, upperStatus, reason);
            updateData.setNotes(existingNotes.isEmpty() ? statusChangeNote : existingNotes + " | " + statusChangeNote);
            shipmentRecordService.updateShipment(shipmentId, updateData);
        }

        // 8. 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("shipmentId", updated.getId());
        result.put("shipmentNumber", updated.getShipmentNumber());
        result.put("previousStatus", oldStatusUpper);
        result.put("newStatus", upperStatus);
        result.put("statusDescription", getStatusDescription(upperStatus));
        if (reason != null) {
            result.put("reason", reason);
        }
        result.put("message", String.format("出货单 %s 状态已从 %s 更新为 %s",
                updated.getShipmentNumber(),
                getStatusDescription(oldStatusUpper),
                getStatusDescription(upperStatus)));

        log.info("出货单状态更新完成 - 单号: {}, {} -> {}",
                updated.getShipmentNumber(), oldStatusUpper, upperStatus);

        return result;
    }

    /**
     * 验证状态流转是否合法
     */
    private void validateStatusTransition(String oldStatus, String newStatus) {
        // CANCELLED 状态不能再变更
        if ("CANCELLED".equals(oldStatus)) {
            throw new IllegalArgumentException("已取消的出货单不能再变更状态");
        }

        // DELIVERED 只能变更为 CANCELLED
        if ("DELIVERED".equals(oldStatus) && !"CANCELLED".equals(newStatus)) {
            throw new IllegalArgumentException("已送达的出货单只能取消，不能变更为其他状态");
        }

        // 不允许状态回退（除了取消）
        if (!"CANCELLED".equals(newStatus)) {
            int oldIndex = VALID_STATUSES.indexOf(oldStatus);
            int newIndex = VALID_STATUSES.indexOf(newStatus);
            if (newIndex < oldIndex) {
                throw new IllegalArgumentException(String.format(
                        "状态不能从 %s 回退到 %s", oldStatus, newStatus));
            }
        }
    }

    /**
     * 映射状态值（从请求参数到数据库值）
     */
    private String mapStatus(String status) {
        return switch (status.toUpperCase()) {
            case "PENDING" -> "pending";
            case "SHIPPED" -> "shipped";
            case "DELIVERED" -> "delivered";
            case "CANCELLED" -> "returned"; // CANCELLED 映射到数据库的 returned
            default -> status.toLowerCase();
        };
    }

    /**
     * 映射状态值（从数据库值到响应格式）
     */
    private String mapStatusToUpper(String status) {
        if (status == null) return "PENDING";
        return switch (status.toLowerCase()) {
            case "pending" -> "PENDING";
            case "shipped" -> "SHIPPED";
            case "delivered" -> "DELIVERED";
            case "returned" -> "CANCELLED";
            default -> status.toUpperCase();
        };
    }

    /**
     * 获取状态描述
     */
    private String getStatusDescription(String status) {
        return switch (status.toUpperCase()) {
            case "PENDING" -> "待发货";
            case "SHIPPED" -> "已发货";
            case "DELIVERED" -> "已送达";
            case "CANCELLED" -> "已取消";
            default -> status;
        };
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        switch (paramName) {
            case "shipmentId":
                return "请问要更新哪个出货单的状态？请提供出货单ID。";
            case "status":
                return "请问要更新为什么状态？（PENDING待发货/SHIPPED已发货/DELIVERED已送达/CANCELLED已取消）";
            case "reason":
                return "请说明状态变更的原因。";
            default:
                return super.getParameterQuestion(paramName);
        }
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        switch (paramName) {
            case "shipmentId":
                return "出货单ID";
            case "status":
                return "新状态";
            case "reason":
                return "变更原因";
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
