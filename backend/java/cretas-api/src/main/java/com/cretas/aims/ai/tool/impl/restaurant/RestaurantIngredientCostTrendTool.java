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
 * 食材成本趋势工具（在库批次成本分析）
 *
 * 对应意图: RESTAURANT_INGREDIENT_COST_TREND
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantIngredientCostTrendTool extends AbstractBusinessTool {

    @Autowired
    private MaterialBatchRepository materialBatchRepository;

    @Override
    public String getToolName() {
        return "restaurant_ingredient_cost_trend";
    }

    @Override
    public String getDescription() {
        return "食材成本趋势分析，按食材类型汇总入库成本，展示成本TOP10。" +
                "适用场景：采购成本分析、食材价格趋势、成本控制。";
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
        log.info("执行食材成本趋势分析 - 工厂ID: {}", factoryId);

        var batches = materialBatchRepository.findByFactoryId(factoryId, PageRequest.of(0, 500));

        if (batches.isEmpty()) {
            return buildSimpleResult(
                    "暂无食材入库记录，无法分析成本趋势。请先录入采购入库数据。", null);
        }

        // 按食材类型汇总成本
        Map<String, Double> costByMaterial = new LinkedHashMap<>();
        batches.forEach(b -> {
            String name = b.getMaterialType() != null ? b.getMaterialType().getName() : "其他";
            double cost = 0;
            if (b.getUnitPrice() != null && b.getReceiptQuantity() != null) {
                cost = b.getUnitPrice().multiply(b.getReceiptQuantity()).doubleValue();
            }
            costByMaterial.merge(name, cost, Double::sum);
        });

        List<Map<String, Object>> costList = costByMaterial.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(10)
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("食材", e.getKey());
                    row.put("采购成本", String.format("¥%.2f", e.getValue()));
                    return row;
                }).collect(Collectors.toList());

        double totalCost = costByMaterial.values().stream().mapToDouble(Double::doubleValue).sum();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("在库批次总成本", String.format("¥%.2f", totalCost));
        result.put("食材成本TOP10", costList);
        result.put("说明", "数据来源于当前在库批次的入库成本，反映近期采购价格趋势");

        log.info("食材成本趋势分析完成 - 总成本: ¥{}", String.format("%.2f", totalCost));
        return result;
    }
}
