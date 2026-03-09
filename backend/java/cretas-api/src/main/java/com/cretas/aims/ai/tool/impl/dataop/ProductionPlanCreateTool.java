package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;

/**
 * 生产计划创建工具
 *
 * 通过AI对话创建完整生产计划，支持按名称模糊匹配产品、产线和主管。
 * Intent Code: PRODUCTION_PLAN_CREATE_FULL / PRODUCTION_PLAN_CREATE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class ProductionPlanCreateTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "production_plan_create";
    }

    @Override
    public String getDescription() {
        return "创建生产计划。需要提供产品、计划产量、预计完成日期等信息。" +
                "支持通过名称或ID指定产品、产线和主管。" +
                "适用场景：新建生产计划、排产、安排生产任务。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> productId = new HashMap<>();
        productId.put("type", "string");
        productId.put("description", "产品名称或ID");
        properties.put("productId", productId);

        Map<String, Object> quantity = new HashMap<>();
        quantity.put("type", "string");
        quantity.put("description", "计划产量，如500kg、100箱");
        properties.put("quantity", quantity);

        Map<String, Object> expectedDate = new HashMap<>();
        expectedDate.put("type", "string");
        expectedDate.put("description", "预计完成日期，如2026-03-10、明天、后天");
        properties.put("expectedDate", expectedDate);

        Map<String, Object> productionLineId = new HashMap<>();
        productionLineId.put("type", "string");
        productionLineId.put("description", "生产线名称或编号");
        properties.put("productionLineId", productionLineId);

        Map<String, Object> estimatedWorkers = new HashMap<>();
        estimatedWorkers.put("type", "integer");
        estimatedWorkers.put("description", "需要工人数");
        properties.put("estimatedWorkers", estimatedWorkers);

        Map<String, Object> supervisorId = new HashMap<>();
        supervisorId.put("type", "string");
        supervisorId.put("description", "负责主管用户名或姓名");
        properties.put("supervisorId", supervisorId);

        Map<String, Object> customerName = new HashMap<>();
        customerName.put("type", "string");
        customerName.put("description", "客户名称（可选）");
        properties.put("customerName", customerName);

        Map<String, Object> processName = new HashMap<>();
        processName.put("type", "string");
        processName.put("description", "工序名称，如分切、包装（可选）");
        properties.put("processName", processName);

        Map<String, Object> batchDate = new HashMap<>();
        batchDate.put("type", "string");
        batchDate.put("description", "批次日期（可选）");
        properties.put("batchDate", batchDate);

        Map<String, Object> priority = new HashMap<>();
        priority.put("type", "integer");
        priority.put("description", "优先级，1-10，默认5");
        properties.put("priority", priority);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("productId", "quantity"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("productId", "quantity");
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        return switch (paramName) {
            case "productId" -> "请提供产品名称或ID。";
            case "quantity" -> "请提供计划产量（如500kg、100箱）。";
            default -> super.getParameterQuestion(paramName);
        };
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("创建生产计划 - 工厂ID: {}, 参数: {}", factoryId, params);

        String productId = getString(params, "productId");
        String quantity = getString(params, "quantity");
        String expectedDate = getString(params, "expectedDate");
        String productionLineId = getString(params, "productionLineId");
        Integer estimatedWorkers = getInteger(params, "estimatedWorkers");
        String supervisorId = getString(params, "supervisorId");
        String customerName = getString(params, "customerName");
        String processName = getString(params, "processName");

        // TODO: 调用 ProductionPlanService.createProductionPlan
        Map<String, Object> result = new HashMap<>();
        result.put("message", "生产计划创建请求已提交");
        result.put("productId", productId);
        result.put("quantity", quantity);
        result.put("expectedDate", expectedDate);
        if (productionLineId != null) result.put("productionLineId", productionLineId);
        if (estimatedWorkers != null) result.put("estimatedWorkers", estimatedWorkers);
        if (supervisorId != null) result.put("supervisorId", supervisorId);
        if (customerName != null) result.put("customerName", customerName);
        if (processName != null) result.put("processName", processName);
        result.put("notice", "请接入ProductionPlanService完成实际创建");

        return result;
    }
}
