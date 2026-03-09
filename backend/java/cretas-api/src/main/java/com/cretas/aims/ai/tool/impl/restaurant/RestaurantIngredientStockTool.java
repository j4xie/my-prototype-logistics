package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.MaterialBatchRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 食材库存查询工具
 *
 * 按食材类型汇总当前库存。
 * 对应意图: RESTAURANT_INGREDIENT_STOCK
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantIngredientStockTool extends AbstractBusinessTool {

    @Autowired
    private MaterialBatchRepository materialBatchRepository;

    @Override
    public String getToolName() {
        return "restaurant_ingredient_stock";
    }

    @Override
    public String getDescription() {
        return "查询餐饮门店的食材库存。按食材类型汇总可用数量和批次数。" +
                "适用场景：查看库存、盘点食材、备料参考。";
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
        log.info("执行食材库存查询 - 工厂ID: {}", factoryId);

        var batches = materialBatchRepository.findByFactoryId(factoryId, PageRequest.of(0, 200));

        if (batches.isEmpty()) {
            return buildSimpleResult("当前食材库存为空。请先在「库存管理」中录入食材入库记录。", null);
        }

        // 按食材类型汇总
        Map<String, double[]> stockMap = new LinkedHashMap<>(); // [totalQty, batchCount]
        Map<String, String> unitMap = new HashMap<>();
        batches.forEach(b -> {
            String materialName = b.getMaterialType() != null ? b.getMaterialType().getName() : "未知食材";
            stockMap.computeIfAbsent(materialName, k -> new double[2]);
            double[] acc = stockMap.get(materialName);
            if (b.getRemainingQuantity() != null) acc[0] += b.getRemainingQuantity().doubleValue();
            acc[1]++;
            if (!unitMap.containsKey(materialName) && b.getQuantityUnit() != null)
                unitMap.put(materialName, b.getQuantityUnit());
        });

        List<Map<String, Object>> stockList = stockMap.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("食材", e.getKey());
                    row.put("可用数量", String.format("%.2f %s", e.getValue()[0],
                            unitMap.getOrDefault(e.getKey(), "")));
                    row.put("批次数", (int) e.getValue()[1]);
                    return row;
                }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("食材种类数", stockList.size());
        result.put("库存明细", stockList);

        log.info("食材库存查询完成 - 共 {} 种食材", stockList.size());
        return result;
    }
}
