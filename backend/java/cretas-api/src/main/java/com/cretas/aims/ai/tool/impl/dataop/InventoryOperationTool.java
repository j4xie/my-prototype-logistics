package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;

/**
 * 库存操作工具
 *
 * 处理库存出库和清零操作。
 * Intent Code: INVENTORY_CLEAR / INVENTORY_OUTBOUND / WAREHOUSE_OUTBOUND
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class InventoryOperationTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "inventory_operation";
    }

    @Override
    public String getDescription() {
        return "执行库存操作，包括出库和库存清零。出库需要指定批次和数量，清零需要确认。" +
                "适用场景：出库操作、库存清零、批次出库。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> batchId = new HashMap<>();
        batchId.put("type", "string");
        batchId.put("description", "批次ID");
        properties.put("batchId", batchId);

        Map<String, Object> operationType = new HashMap<>();
        operationType.put("type", "string");
        operationType.put("description", "操作类型");
        operationType.put("enum", Arrays.asList("OUTBOUND", "CLEAR"));
        properties.put("operationType", operationType);

        Map<String, Object> quantity = new HashMap<>();
        quantity.put("type", "number");
        quantity.put("description", "出库数量（出库时需要）");
        properties.put("quantity", quantity);

        Map<String, Object> confirmed = new HashMap<>();
        confirmed.put("type", "boolean");
        confirmed.put("description", "是否已确认（清零时需要）");
        properties.put("confirmed", confirmed);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("batchId", "operationType"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("batchId", "operationType");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        // 库存操作服务未接入 — 禁止降级处理，返回明确错误而非模拟数据
        return buildSimpleResult("error", java.util.Map.of(
                "success", false,
                "error", "库存操作服务尚未接入，请联系管理员配置 MaterialBatchService",
                "code", "SERVICE_NOT_AVAILABLE"));
    }
}
