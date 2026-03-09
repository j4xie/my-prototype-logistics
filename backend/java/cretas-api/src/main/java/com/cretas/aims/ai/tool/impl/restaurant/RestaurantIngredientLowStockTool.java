package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 食材低库存预警工具
 *
 * 对比当前库存与最低库存阈值，识别需要补货的食材。
 * 对应意图: RESTAURANT_INGREDIENT_LOW_STOCK
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantIngredientLowStockTool extends AbstractBusinessTool {

    @Autowired
    private RawMaterialTypeRepository rawMaterialTypeRepository;

    @Autowired
    private MaterialBatchRepository materialBatchRepository;

    @Override
    public String getToolName() {
        return "restaurant_ingredient_low_stock";
    }

    @Override
    public String getDescription() {
        return "食材低库存预警，对比当前库存与最低库存阈值。识别需要紧急补货的食材。" +
                "适用场景：采购提醒、库存安全管理、补货决策。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");
        schema.put("properties", Collections.emptyMap());
        schema.put("required", Collections.emptyList());
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行食材低库存预警 - 工厂ID: {}", factoryId);

        var materialTypes = rawMaterialTypeRepository.findMaterialTypesWithStockWarning(factoryId);

        if (materialTypes.isEmpty()) {
            return buildSimpleResult(
                    "暂未配置食材最低库存阈值。请在「食材管理」中为每种食材设置最低库存量。", null);
        }

        List<Map<String, Object>> lowStockAlerts = new ArrayList<>();
        for (var mt : materialTypes) {
            if (mt.getMinStock() == null) continue;
            var batches = materialBatchRepository.findByFactoryId(factoryId, PageRequest.of(0, 500));
            double currentStock = batches.stream()
                    .filter(b -> b.getMaterialType() != null &&
                                 b.getMaterialType().getId().equals(mt.getId()))
                    .mapToDouble(b -> b.getRemainingQuantity() != null ?
                            b.getRemainingQuantity().doubleValue() : 0)
                    .sum();

            if (currentStock < mt.getMinStock().doubleValue()) {
                Map<String, Object> alert = new LinkedHashMap<>();
                alert.put("食材", mt.getName());
                alert.put("当前库存", String.format("%.2f %s", currentStock,
                        mt.getUnit() != null ? mt.getUnit() : ""));
                alert.put("最低阈值", String.format("%.2f %s", mt.getMinStock(),
                        mt.getUnit() != null ? mt.getUnit() : ""));
                alert.put("缺口", String.format("%.2f", mt.getMinStock().doubleValue() - currentStock));
                lowStockAlerts.add(alert);
            }
        }

        if (lowStockAlerts.isEmpty()) {
            return buildSimpleResult("所有食材库存均在安全线以上，无需紧急补货。", null);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("低库存食材数", lowStockAlerts.size());
        result.put("低库存列表", lowStockAlerts);

        log.info("食材低库存预警完成 - 发现 {} 种低库存食材", lowStockAlerts.size());
        return result;
    }
}
