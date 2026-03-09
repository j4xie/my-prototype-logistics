package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 出货单删除工具
 *
 * 删除出货单，已发货的出货单不能删除。需要确认操作。
 * Intent Code: SHIPMENT_DELETE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class ShipmentDeleteTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "shipment_delete";
    }

    @Override
    public String getDescription() {
        return "删除出货单。已发货的出货单不能删除，只能退回。" +
                "适用场景：删除未发货的出货单、取消出货。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> shipmentId = new HashMap<>();
        shipmentId.put("type", "string");
        shipmentId.put("description", "出货单ID或出货单号");
        properties.put("shipmentId", shipmentId);

        Map<String, Object> confirmed = new HashMap<>();
        confirmed.put("type", "boolean");
        confirmed.put("description", "是否已确认删除");
        properties.put("confirmed", confirmed);

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
        log.info("删除出货单 - 工厂ID: {}, 参数: {}", factoryId, params);

        String shipmentId = getString(params, "shipmentId");
        Boolean confirmed = getBoolean(params, "confirmed", false);

        Map<String, Object> result = new HashMap<>();
        result.put("shipmentId", shipmentId);

        if (!confirmed) {
            result.put("status", "NEED_CONFIRM");
            result.put("message", "确认删除出货单 [" + shipmentId + "]？已发货的出货单不能删除，只能退回。");
        } else {
            // TODO: 调用 ShipmentRecordService.deleteShipment
            result.put("message", "出货单 [" + shipmentId + "] 已删除。");
            result.put("operation", "DELETE");
        }
        result.put("notice", "请接入ShipmentRecordService完成实际操作");

        return result;
    }
}
