package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 菜品成本分析工具
 *
 * 基于食材库存单价与BOM配方进行成本分析。
 * 对应意图: RESTAURANT_DISH_COST_ANALYSIS
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantDishCostAnalysisTool extends AbstractBusinessTool {

    @Autowired
    private ProductTypeRepository productTypeRepository;

    @Autowired
    private RawMaterialTypeRepository rawMaterialTypeRepository;

    @Override
    public String getToolName() {
        return "restaurant_dish_cost_analysis";
    }

    @Override
    public String getDescription() {
        return "菜品成本分析，基于食材库存单价与BOM配方。展示菜品总数、在库食材种类及成本优化建议。" +
                "适用场景：成本核算、毛利分析、食材成本占比。";
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
        log.info("执行菜品成本分析 - 工厂ID: {}", factoryId);

        var dishes = productTypeRepository.findByFactoryIdAndIsActive(factoryId, true);
        if (dishes.isEmpty()) {
            return buildSimpleResult("暂无菜品数据，无法进行成本分析。请先在「菜品管理」中录入菜品。", null);
        }

        long ingredientCount = rawMaterialTypeRepository.countActiveMaterialTypes(factoryId);
        long dishCount = dishes.size();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("菜品总数", dishCount);
        result.put("在库食材种类", ingredientCount);
        result.put("分析说明", "精确的菜品成本分析需要配置BOM配方（食材用量）。当前仅展示食材库存概览。");
        result.put("建议", List.of(
                "在「配方管理」中为每道菜品录入食材用量（BOM）",
                "配置完成后，AI将自动计算每道菜的理论成本和毛利率",
                "可对比销售均价，识别高/低毛利菜品"
        ));

        log.info("菜品成本分析完成 - 菜品数: {}, 食材种类: {}", dishCount, ingredientCount);
        return result;
    }
}
