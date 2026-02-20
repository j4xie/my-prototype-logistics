package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;

/**
 * 原材料批次更新工具
 *
 * 提供原材料批次信息更新功能，支持更新原材料的供应商、存储位置、质量等级等字段。
 * 适用场景：更新原材料信息、修改存储位置、调整质量等级等。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class MaterialUpdateTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "material_update";
    }

    @Override
    public String getDescription() {
        return "更新原材料批次信息。支持更新供应商、存储位置、质量等级、数量、备注等字段。" +
                "适用场景：修改原材料供应商、调整存储位置、更新质量检验结果。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // materialBatchId: 原材料批次ID（必需）
        Map<String, Object> materialBatchId = new HashMap<>();
        materialBatchId.put("type", "string");
        materialBatchId.put("description", "原材料批次ID，必需参数");
        properties.put("materialBatchId", materialBatchId);

        // supplierId: 供应商ID（可选）
        Map<String, Object> supplierId = new HashMap<>();
        supplierId.put("type", "string");
        supplierId.put("description", "供应商ID");
        properties.put("supplierId", supplierId);

        // storageLocation: 存储位置（可选）
        Map<String, Object> storageLocation = new HashMap<>();
        storageLocation.put("type", "string");
        storageLocation.put("description", "存储位置，如：A区-1排-3层");
        properties.put("storageLocation", storageLocation);

        // qualityGrade: 质量等级（可选）
        Map<String, Object> qualityGrade = new HashMap<>();
        qualityGrade.put("type", "string");
        qualityGrade.put("description", "质量等级");
        qualityGrade.put("enum", Arrays.asList("A", "B", "C", "REJECT"));
        properties.put("qualityGrade", qualityGrade);

        // quantity: 数量（可选）
        Map<String, Object> quantity = new HashMap<>();
        quantity.put("type", "number");
        quantity.put("description", "更新后的数量");
        quantity.put("minimum", 0);
        properties.put("quantity", quantity);

        // unit: 单位（可选）
        Map<String, Object> unit = new HashMap<>();
        unit.put("type", "string");
        unit.put("description", "数量单位，如：kg、个、箱");
        properties.put("unit", unit);

        // temperature: 存储温度（可选）
        Map<String, Object> temperature = new HashMap<>();
        temperature.put("type", "number");
        temperature.put("description", "存储温度（摄氏度）");
        properties.put("temperature", temperature);

        // remark: 备注（可选）
        Map<String, Object> remark = new HashMap<>();
        remark.put("type", "string");
        remark.put("description", "备注信息");
        properties.put("remark", remark);

        // reason: 更新原因（可选）
        Map<String, Object> reason = new HashMap<>();
        reason.put("type", "string");
        reason.put("description", "更新原因，用于操作记录");
        properties.put("reason", reason);

        schema.put("properties", properties);
        schema.put("required", Collections.singletonList("materialBatchId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.singletonList("materialBatchId");
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = new HashMap<>();
        questions.put("materialBatchId", "请问您要更新哪个原材料批次？请提供批次ID。");
        questions.put("supplierId", "请问要更新为哪个供应商？");
        questions.put("storageLocation", "请问新的存储位置是什么？");
        questions.put("qualityGrade", "请问质量等级是什么？（A/B/C/REJECT）");
        questions.put("quantity", "请问数量要更新为多少？");
        questions.put("temperature", "请问存储温度是多少度？");
        questions.put("reason", "请说明更新原因。");

        String question = questions.get(paramName);
        return question != null ? question : super.getParameterQuestion(paramName);
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = new HashMap<>();
        displayNames.put("materialBatchId", "原材料批次ID");
        displayNames.put("supplierId", "供应商ID");
        displayNames.put("storageLocation", "存储位置");
        displayNames.put("qualityGrade", "质量等级");
        displayNames.put("quantity", "数量");
        displayNames.put("unit", "单位");
        displayNames.put("temperature", "存储温度");
        displayNames.put("remark", "备注");
        displayNames.put("reason", "更新原因");

        String name = displayNames.get(paramName);
        return name != null ? name : super.getParameterDisplayName(paramName);
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行原材料批次更新 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 解析参数
        String materialBatchId = getString(params, "materialBatchId");
        String supplierId = getString(params, "supplierId");
        String storageLocation = getString(params, "storageLocation");
        String qualityGrade = getString(params, "qualityGrade");
        BigDecimal quantity = getBigDecimal(params, "quantity");
        String unit = getString(params, "unit");
        BigDecimal temperature = getBigDecimal(params, "temperature");
        String remark = getString(params, "remark");
        String reason = getString(params, "reason");

        // TODO: 调用实际的原材料服务进行更新
        // MaterialBatchDTO updatedMaterial = materialBatchService.updateMaterialBatch(factoryId, materialBatchId, updateRequest);

        // 构建更新字段摘要
        Map<String, Object> updatedFields = new HashMap<>();
        if (supplierId != null) updatedFields.put("supplierId", supplierId);
        if (storageLocation != null) updatedFields.put("storageLocation", storageLocation);
        if (qualityGrade != null) updatedFields.put("qualityGrade", qualityGrade);
        if (quantity != null) updatedFields.put("quantity", quantity);
        if (unit != null) updatedFields.put("unit", unit);
        if (temperature != null) updatedFields.put("temperature", temperature);
        if (remark != null) updatedFields.put("remark", remark);

        if (updatedFields.isEmpty()) {
            return buildSimpleResult("未指定要更新的字段", Map.of("materialBatchId", materialBatchId));
        }

        // 模拟更新成功响应
        Map<String, Object> result = new HashMap<>();
        result.put("materialBatchId", materialBatchId);
        result.put("updatedFields", updatedFields);
        result.put("reason", reason);
        result.put("message", "原材料批次更新成功");

        log.info("原材料批次更新完成 - 批次ID: {}, 更新字段: {}", materialBatchId, updatedFields.keySet());

        return result;
    }
}
