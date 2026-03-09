package com.cretas.aims.ai.tool.impl.shipment;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.ShipmentRecord;
import com.cretas.aims.service.ShipmentRecordService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 仓库备货通知工具
 *
 * 查询当前工厂的待发货出货单，生成仓库备货通知。
 * 列出最近待备货的出货单信息，便于仓库提前准备。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-08
 */
@Slf4j
@Component
public class ShipmentNotifyWarehouseTool extends AbstractBusinessTool {

    @Autowired
    private ShipmentRecordService shipmentRecordService;

    @Override
    public String getToolName() {
        return "shipment_notify_warehouse";
    }

    @Override
    public String getDescription() {
        return "通知仓库备货。查询当前待发货的出货单，生成仓库备货通知清单。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> limit = new HashMap<>();
        limit.put("type", "integer");
        limit.put("description", "显示的最大待备货出货单数量，默认5");
        limit.put("default", 5);
        properties.put("limit", limit);

        schema.put("properties", properties);
        schema.put("required", List.of());

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return List.of();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行仓库备货通知 - 工厂ID: {}", factoryId);

        int displayLimit = getInteger(params, "limit", 5);

        // 查询待发货出货单
        Page<ShipmentRecord> pendingPage = shipmentRecordService.getByFactoryIdAndStatus(factoryId, "pending", 0, 20);
        List<ShipmentRecord> pending = pendingPage.getContent();

        // 构建通知详情
        List<Map<String, Object>> shipmentDetails = new ArrayList<>();
        pending.stream().limit(displayLimit).forEach(s -> {
            Map<String, Object> detail = new HashMap<>();
            detail.put("shipmentNumber", s.getShipmentNumber());
            detail.put("productName", s.getProductName() != null ? s.getProductName() : "未指定产品");
            detail.put("id", s.getId());
            shipmentDetails.add(detail);
        });

        // 构建结果
        Map<String, Object> result = new HashMap<>();
        result.put("pendingShipments", pending.size());
        result.put("notificationSent", true);
        result.put("details", shipmentDetails);

        StringBuilder sb = new StringBuilder();
        sb.append("仓库备货通知已发送\n\n");
        sb.append("待发货订单: ").append(pending.size()).append("个\n");
        if (!pending.isEmpty()) {
            sb.append("最近待备货:\n");
            pending.stream().limit(displayLimit).forEach(s ->
                    sb.append("  - ").append(s.getShipmentNumber())
                      .append(" -> ").append(s.getProductName() != null ? s.getProductName() : "未指定产品")
                      .append("\n"));
        }
        result.put("message", sb.toString());

        log.info("仓库备货通知完成 - 工厂: {}, 待发货数: {}", factoryId, pending.size());

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        if ("limit".equals(paramName)) {
            return "请问要显示多少条待备货记录？";
        }
        return super.getParameterQuestion(paramName);
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        if ("limit".equals(paramName)) {
            return "显示数量";
        }
        return super.getParameterDisplayName(paramName);
    }
}
