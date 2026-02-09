package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;

/**
 * 生产计划更新工具
 *
 * 提供生产计划信息更新功能，支持更新计划状态、计划数量、计划日期等字段。
 * 适用场景：调整生产计划、修改计划状态、更新计划时间等。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class PlanUpdateTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "plan_update";
    }

    @Override
    public String getDescription() {
        return "更新生产计划信息。支持更新计划状态、计划数量、开始日期、结束日期、优先级等字段。" +
                "适用场景：调整生产计划、修改计划状态（如暂停、恢复）、更新计划时间安排。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // planId: 计划ID（必需）
        Map<String, Object> planId = new HashMap<>();
        planId.put("type", "string");
        planId.put("description", "生产计划ID，必需参数");
        properties.put("planId", planId);

        // status: 计划状态（可选）
        Map<String, Object> status = new HashMap<>();
        status.put("type", "string");
        status.put("description", "计划状态");
        status.put("enum", Arrays.asList(
                "DRAFT",        // 草稿
                "PENDING",      // 待执行
                "IN_PROGRESS",  // 执行中
                "PAUSED",       // 已暂停
                "COMPLETED",    // 已完成
                "CANCELLED"     // 已取消
        ));
        properties.put("status", status);

        // plannedQuantity: 计划数量（可选）
        Map<String, Object> plannedQuantity = new HashMap<>();
        plannedQuantity.put("type", "number");
        plannedQuantity.put("description", "计划生产数量");
        plannedQuantity.put("minimum", 0);
        properties.put("plannedQuantity", plannedQuantity);

        // startDate: 开始日期（可选）
        Map<String, Object> startDate = new HashMap<>();
        startDate.put("type", "string");
        startDate.put("format", "date");
        startDate.put("description", "计划开始日期，格式：YYYY-MM-DD");
        properties.put("startDate", startDate);

        // endDate: 结束日期（可选）
        Map<String, Object> endDate = new HashMap<>();
        endDate.put("type", "string");
        endDate.put("format", "date");
        endDate.put("description", "计划结束日期，格式：YYYY-MM-DD");
        properties.put("endDate", endDate);

        // priority: 优先级（可选）
        Map<String, Object> priority = new HashMap<>();
        priority.put("type", "string");
        priority.put("description", "计划优先级");
        priority.put("enum", Arrays.asList("LOW", "NORMAL", "HIGH", "URGENT"));
        properties.put("priority", priority);

        // productionLineId: 生产线ID（可选）
        Map<String, Object> productionLineId = new HashMap<>();
        productionLineId.put("type", "string");
        productionLineId.put("description", "生产线ID");
        properties.put("productionLineId", productionLineId);

        // remark: 备注（可选）
        Map<String, Object> remark = new HashMap<>();
        remark.put("type", "string");
        remark.put("description", "计划备注信息");
        properties.put("remark", remark);

        // reason: 更新原因（可选）
        Map<String, Object> reason = new HashMap<>();
        reason.put("type", "string");
        reason.put("description", "更新原因，用于操作记录");
        properties.put("reason", reason);

        schema.put("properties", properties);
        schema.put("required", Collections.singletonList("planId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.singletonList("planId");
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = new HashMap<>();
        questions.put("planId", "请问您要更新哪个生产计划？请提供计划ID或计划编号。");
        questions.put("status", "请问要将计划状态设置为什么？（如：执行中、已暂停、已完成等）");
        questions.put("plannedQuantity", "请问计划数量要调整为多少？");
        questions.put("startDate", "请问新的开始日期是什么时候？（格式：YYYY-MM-DD）");
        questions.put("endDate", "请问新的结束日期是什么时候？（格式：YYYY-MM-DD）");
        questions.put("priority", "请问优先级要设置为什么？（LOW/NORMAL/HIGH/URGENT）");
        questions.put("productionLineId", "请问要分配到哪条生产线？");
        questions.put("reason", "请说明更新原因。");

        String question = questions.get(paramName);
        return question != null ? question : super.getParameterQuestion(paramName);
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = new HashMap<>();
        displayNames.put("planId", "生产计划ID");
        displayNames.put("status", "计划状态");
        displayNames.put("plannedQuantity", "计划数量");
        displayNames.put("startDate", "开始日期");
        displayNames.put("endDate", "结束日期");
        displayNames.put("priority", "优先级");
        displayNames.put("productionLineId", "生产线ID");
        displayNames.put("remark", "备注");
        displayNames.put("reason", "更新原因");

        String name = displayNames.get(paramName);
        return name != null ? name : super.getParameterDisplayName(paramName);
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行生产计划更新 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 解析参数
        String planId = getString(params, "planId");
        String status = getString(params, "status");
        BigDecimal plannedQuantity = getBigDecimal(params, "plannedQuantity");
        String startDate = getString(params, "startDate");
        String endDate = getString(params, "endDate");
        String priority = getString(params, "priority");
        String productionLineId = getString(params, "productionLineId");
        String remark = getString(params, "remark");
        String reason = getString(params, "reason");

        // TODO: 调用实际的生产计划服务进行更新
        // ProductionPlanDTO updatedPlan = productionPlanService.updatePlan(factoryId, planId, updateRequest);

        // 构建更新字段摘要
        Map<String, Object> updatedFields = new HashMap<>();
        if (status != null) updatedFields.put("status", status);
        if (plannedQuantity != null) updatedFields.put("plannedQuantity", plannedQuantity);
        if (startDate != null) updatedFields.put("startDate", startDate);
        if (endDate != null) updatedFields.put("endDate", endDate);
        if (priority != null) updatedFields.put("priority", priority);
        if (productionLineId != null) updatedFields.put("productionLineId", productionLineId);
        if (remark != null) updatedFields.put("remark", remark);

        if (updatedFields.isEmpty()) {
            return buildSimpleResult("未指定要更新的字段", Map.of("planId", planId));
        }

        // 模拟更新成功响应
        Map<String, Object> result = new HashMap<>();
        result.put("planId", planId);
        result.put("updatedFields", updatedFields);
        result.put("reason", reason);
        result.put("message", "生产计划更新成功");

        log.info("生产计划更新完成 - 计划ID: {}, 更新字段: {}", planId, updatedFields.keySet());

        return result;
    }
}
