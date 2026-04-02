package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;

/**
 * 生产批次创建工具（数据操作版）
 *
 * 通过数据操作意图创建生产批次。
 * Intent Code: PROCESSING_BATCH_CREATE (via DATA_OP handler)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class ProcessingBatchCreateToolDataOp extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "dataop_batch_create";
    }

    @Override
    public String getDescription() {
        return "创建新的生产批次。需要提供产品类型ID和计划产量。" +
                "适用场景：新建加工批次、创建生产批次。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> productTypeId = new HashMap<>();
        productTypeId.put("type", "string");
        productTypeId.put("description", "产品类型ID");
        properties.put("productTypeId", productTypeId);

        Map<String, Object> plannedQuantity = new HashMap<>();
        plannedQuantity.put("type", "number");
        plannedQuantity.put("description", "计划产量");
        properties.put("plannedQuantity", plannedQuantity);

        schema.put("properties", properties);
        schema.put("required", Collections.singletonList("productTypeId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.singletonList("productTypeId");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        // 生产批次创建服务未接入 — 禁止降级处理，返回明确错误而非模拟数据
        return buildSimpleResult("error", java.util.Map.of(
                "success", false,
                "error", "生产批次创建服务尚未接入，请联系管理员配置 ProcessingService",
                "code", "SERVICE_NOT_AVAILABLE"));
    }
}
