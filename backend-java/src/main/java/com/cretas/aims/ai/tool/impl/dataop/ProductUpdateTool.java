package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;

/**
 * 产品类型更新工具
 *
 * 提供产品类型信息更新功能，支持更新产品名称、规格、保质期、状态等字段。
 * 适用场景：修改产品信息、更新产品规格、调整保质期设置等。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class ProductUpdateTool extends AbstractBusinessTool {

    @Override
    public String getToolName() {
        return "product_update";
    }

    @Override
    public String getDescription() {
        return "更新产品类型信息。支持更新产品名称、规格、保质期、状态、描述等字段。" +
                "适用场景：修改产品基本信息、调整产品保质期、更新产品状态（如停产）。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // productTypeId: 产品类型ID（必需）
        Map<String, Object> productTypeId = new HashMap<>();
        productTypeId.put("type", "string");
        productTypeId.put("description", "产品类型ID，必需参数");
        properties.put("productTypeId", productTypeId);

        // productName: 产品名称（可选）
        Map<String, Object> productName = new HashMap<>();
        productName.put("type", "string");
        productName.put("description", "产品名称");
        properties.put("productName", productName);

        // productCode: 产品编码（可选）
        Map<String, Object> productCode = new HashMap<>();
        productCode.put("type", "string");
        productCode.put("description", "产品编码");
        properties.put("productCode", productCode);

        // category: 产品类别（可选）
        Map<String, Object> category = new HashMap<>();
        category.put("type", "string");
        category.put("description", "产品类别，如：肉类、蔬菜、水产等");
        properties.put("category", category);

        // specification: 规格（可选）
        Map<String, Object> specification = new HashMap<>();
        specification.put("type", "string");
        specification.put("description", "产品规格，如：500g/袋、1kg/箱");
        properties.put("specification", specification);

        // shelfLife: 保质期（可选）
        Map<String, Object> shelfLife = new HashMap<>();
        shelfLife.put("type", "integer");
        shelfLife.put("description", "保质期（天）");
        shelfLife.put("minimum", 1);
        properties.put("shelfLife", shelfLife);

        // status: 状态（可选）
        Map<String, Object> status = new HashMap<>();
        status.put("type", "string");
        status.put("description", "产品状态");
        status.put("enum", Arrays.asList(
                "ACTIVE",       // 在产
                "INACTIVE",     // 停产
                "DEVELOPING",   // 开发中
                "DISCONTINUED"  // 已下架
        ));
        properties.put("status", status);

        // unit: 单位（可选）
        Map<String, Object> unit = new HashMap<>();
        unit.put("type", "string");
        unit.put("description", "计量单位，如：kg、个、箱");
        properties.put("unit", unit);

        // price: 单价（可选）
        Map<String, Object> price = new HashMap<>();
        price.put("type", "number");
        price.put("description", "产品单价");
        price.put("minimum", 0);
        properties.put("price", price);

        // description: 描述（可选）
        Map<String, Object> description = new HashMap<>();
        description.put("type", "string");
        description.put("description", "产品描述");
        properties.put("description", description);

        // storageCondition: 存储条件（可选）
        Map<String, Object> storageCondition = new HashMap<>();
        storageCondition.put("type", "string");
        storageCondition.put("description", "存储条件，如：冷藏、冷冻、常温");
        properties.put("storageCondition", storageCondition);

        // reason: 更新原因（可选）
        Map<String, Object> reason = new HashMap<>();
        reason.put("type", "string");
        reason.put("description", "更新原因，用于操作记录");
        properties.put("reason", reason);

        schema.put("properties", properties);
        schema.put("required", Collections.singletonList("productTypeId"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.singletonList("productTypeId");
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = new HashMap<>();
        questions.put("productTypeId", "请问您要更新哪个产品？请提供产品ID或产品编码。");
        questions.put("productName", "请问新的产品名称是什么？");
        questions.put("productCode", "请问新的产品编码是什么？");
        questions.put("category", "请问产品类别要改为什么？");
        questions.put("specification", "请问产品规格是什么？");
        questions.put("shelfLife", "请问保质期要设置为多少天？");
        questions.put("status", "请问要将产品状态设置为什么？（在产/停产/开发中/已下架）");
        questions.put("price", "请问产品单价是多少？");
        questions.put("storageCondition", "请问存储条件是什么？（冷藏/冷冻/常温）");
        questions.put("reason", "请说明更新原因。");

        String question = questions.get(paramName);
        return question != null ? question : super.getParameterQuestion(paramName);
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = new HashMap<>();
        displayNames.put("productTypeId", "产品类型ID");
        displayNames.put("productName", "产品名称");
        displayNames.put("productCode", "产品编码");
        displayNames.put("category", "产品类别");
        displayNames.put("specification", "产品规格");
        displayNames.put("shelfLife", "保质期");
        displayNames.put("status", "产品状态");
        displayNames.put("unit", "计量单位");
        displayNames.put("price", "产品单价");
        displayNames.put("description", "产品描述");
        displayNames.put("storageCondition", "存储条件");
        displayNames.put("reason", "更新原因");

        String name = displayNames.get(paramName);
        return name != null ? name : super.getParameterDisplayName(paramName);
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行产品类型更新 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 解析参数
        String productTypeId = getString(params, "productTypeId");
        String productName = getString(params, "productName");
        String productCode = getString(params, "productCode");
        String category = getString(params, "category");
        String specification = getString(params, "specification");
        Integer shelfLife = getInteger(params, "shelfLife");
        String status = getString(params, "status");
        String unit = getString(params, "unit");
        BigDecimal price = getBigDecimal(params, "price");
        String description = getString(params, "description");
        String storageCondition = getString(params, "storageCondition");
        String reason = getString(params, "reason");

        // TODO: 调用实际的产品类型服务进行更新
        // ProductTypeDTO updatedProduct = productTypeService.updateProductType(factoryId, productTypeId, updateRequest);

        // 构建更新字段摘要
        Map<String, Object> updatedFields = new HashMap<>();
        if (productName != null) updatedFields.put("productName", productName);
        if (productCode != null) updatedFields.put("productCode", productCode);
        if (category != null) updatedFields.put("category", category);
        if (specification != null) updatedFields.put("specification", specification);
        if (shelfLife != null) updatedFields.put("shelfLife", shelfLife);
        if (status != null) updatedFields.put("status", status);
        if (unit != null) updatedFields.put("unit", unit);
        if (price != null) updatedFields.put("price", price);
        if (description != null) updatedFields.put("description", description);
        if (storageCondition != null) updatedFields.put("storageCondition", storageCondition);

        if (updatedFields.isEmpty()) {
            return buildSimpleResult("未指定要更新的字段", Map.of("productTypeId", productTypeId));
        }

        // 模拟更新成功响应
        Map<String, Object> result = new HashMap<>();
        result.put("productTypeId", productTypeId);
        result.put("updatedFields", updatedFields);
        result.put("reason", reason);
        result.put("message", "产品类型更新成功");

        log.info("产品类型更新完成 - 产品ID: {}, 更新字段: {}", productTypeId, updatedFields.keySet());

        return result;
    }
}
