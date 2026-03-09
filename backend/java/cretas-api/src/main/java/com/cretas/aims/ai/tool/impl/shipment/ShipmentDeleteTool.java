package com.cretas.aims.ai.tool.impl.shipment;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.ShipmentRecord;
import com.cretas.aims.service.ShipmentRecordService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 出货单删除工具
 *
 * 根据出货单ID或出货单号删除出货记录。
 * 先按出货单号查找，再按ID+工厂ID查找，确保归属正确。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-08
 */
@Slf4j
@Component
public class ShipmentDeleteTool extends AbstractBusinessTool {

    @Autowired
    private ShipmentRecordService shipmentRecordService;

    @Override
    public String getToolName() {
        return "shipment_delete";
    }

    @Override
    public String getDescription() {
        return "删除出货单。需要提供出货单ID或出货单号，删除后不可恢复。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> shipmentId = new HashMap<>();
        shipmentId.put("type", "string");
        shipmentId.put("description", "出货单ID或出货单号，用于标识要删除的出货单");
        properties.put("shipmentId", shipmentId);

        schema.put("properties", properties);
        schema.put("required", List.of("shipmentId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return List.of("shipmentId");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行删除出货单 - 工厂ID: {}, 参数: {}", factoryId, params);

        String shipmentId = getString(params, "shipmentId");

        // 先按出货单号查找，再按ID+工厂ID查找
        Optional<ShipmentRecord> recordOpt = shipmentRecordService.getByShipmentNumber(shipmentId);
        if (recordOpt.isEmpty()) {
            recordOpt = shipmentRecordService.getByIdAndFactoryId(shipmentId, factoryId);
        }
        if (recordOpt.isEmpty()) {
            throw new IllegalArgumentException("未找到出货单: " + shipmentId);
        }

        ShipmentRecord record = recordOpt.get();
        String shipmentNumber = record.getShipmentNumber();
        String recordId = record.getId();

        // 执行删除
        shipmentRecordService.deleteShipment(recordId);

        Map<String, Object> result = new HashMap<>();
        result.put("shipmentId", recordId);
        result.put("shipmentNumber", shipmentNumber);
        result.put("deleted", true);
        result.put("message", "出货单 " + shipmentNumber + " 已删除");

        log.info("出货单删除完成 - 单号: {}, ID: {}", shipmentNumber, recordId);

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        if ("shipmentId".equals(paramName)) {
            return "请问要删除哪个出货单？请提供出货单ID或出货单号。";
        }
        return super.getParameterQuestion(paramName);
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        if ("shipmentId".equals(paramName)) {
            return "出货单ID";
        }
        return super.getParameterDisplayName(paramName);
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
                "factory_admin".equals(userRole);
    }
}
