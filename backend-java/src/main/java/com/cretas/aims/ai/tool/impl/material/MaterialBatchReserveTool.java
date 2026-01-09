package com.cretas.aims.ai.tool.impl.material;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.service.MaterialBatchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 原材料批次预留工具
 *
 * 用于预留指定批次的原材料数量，支持关联生产计划。
 * 预留的材料将从可用库存中扣除，但不会实际消耗。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class MaterialBatchReserveTool extends AbstractBusinessTool {

    @Autowired
    private MaterialBatchService materialBatchService;

    @Override
    public String getToolName() {
        return "material_batch_reserve";
    }

    @Override
    public String getDescription() {
        return "预留原材料批次的指定数量。" +
                "预留后，该数量将从可用库存中扣除，但不会实际消耗材料。" +
                "可关联生产计划进行预留追踪。" +
                "适用场景：生产计划备料、订单预留、紧急备货等。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // batchId: 批次ID（必需）
        Map<String, Object> batchId = new HashMap<>();
        batchId.put("type", "string");
        batchId.put("description", "原材料批次ID");
        properties.put("batchId", batchId);

        // quantity: 预留数量（必需）
        Map<String, Object> quantity = new HashMap<>();
        quantity.put("type", "number");
        quantity.put("description", "预留数量，必须大于0");
        quantity.put("minimum", 0);
        quantity.put("exclusiveMinimum", true);
        properties.put("quantity", quantity);

        // productionPlanId: 生产计划ID（可选）
        Map<String, Object> productionPlanId = new HashMap<>();
        productionPlanId.put("type", "string");
        productionPlanId.put("description", "关联的生产计划ID，用于追踪预留来源");
        properties.put("productionPlanId", productionPlanId);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("batchId", "quantity"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("batchId", "quantity");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        // 1. 获取参数
        String batchId = getString(params, "batchId");
        BigDecimal quantity = getBigDecimal(params, "quantity");
        String productionPlanId = getString(params, "productionPlanId");

        // 2. 参数验证
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("预留数量必须大于0");
        }

        log.info("📦 开始预留原材料: factoryId={}, batchId={}, quantity={}, productionPlanId={}",
                factoryId, batchId, quantity, productionPlanId);

        // 3. 调用服务预留材料
        materialBatchService.reserveBatchMaterial(factoryId, batchId, quantity, productionPlanId);

        // 4. 构建返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("batchId", batchId);
        result.put("reservedQuantity", quantity);
        result.put("productionPlanId", productionPlanId);
        result.put("message", String.format("成功预留批次 %s 的 %s 单位材料", batchId, quantity));

        log.info("✅ 原材料预留成功: batchId={}, quantity={}", batchId, quantity);

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = new HashMap<>();
        questions.put("batchId", "请问您要预留哪个批次的材料？请提供批次ID。");
        questions.put("quantity", "请问您要预留多少数量？");
        questions.put("productionPlanId", "请问是否关联某个生产计划？如有请提供计划ID。");

        String question = questions.get(paramName);
        return question != null ? question : super.getParameterQuestion(paramName);
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = new HashMap<>();
        displayNames.put("batchId", "批次ID");
        displayNames.put("quantity", "预留数量");
        displayNames.put("productionPlanId", "生产计划ID");

        String name = displayNames.get(paramName);
        return name != null ? name : super.getParameterDisplayName(paramName);
    }
}
