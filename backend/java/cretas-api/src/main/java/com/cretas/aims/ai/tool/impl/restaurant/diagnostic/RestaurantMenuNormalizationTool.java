package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantMenuNormalizationTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_menu_normalization";
    }

    @Override
    public String getDescription() {
        return "菜名归一化统计 (原始菜名 → 标品 SKU) - 合并重复别名, 给出归一后的 unique SKU 数. 适用场景: 客户问'我菜单有多少重复'/'归一后 SKU 数'/'菜名乱了要不要整理'.";
    }

    @Override
    protected String getSectionName() {
        return "menu_normalization";
    }
}
