package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantLongTailSkuTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_long_tail_sku";
    }

    @Override
    public String getDescription() {
        return "长尾菜品识别 (销量占比 <3% 的冗余 SKU) - 识别可下架的菜品, 估算年省成本. 适用场景: 客户问'哪些菜该砍'/'菜单瘦身建议'/'哪些菜没人点'.";
    }

    @Override
    protected String getSectionName() {
        return "long_tail_sku";
    }
}
