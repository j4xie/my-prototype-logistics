package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class ComboSplitTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_combo_split"; }
    @Override public String getDescription() {
        return "套餐拆单统计 — 把套餐商品拆分成实际菜品, 区分单点销量 vs 套餐内销量.";
    }
    @Override protected String getSectionName() { return "combo_split"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("哪些菜品主要靠套餐带动", "套餐定价拆单后毛利", "建议新增哪些套餐");
    }
}
