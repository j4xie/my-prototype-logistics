package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantDiningHeatmapTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_dining_heatmap";
    }

    @Override
    public String getDescription() {
        return "餐饮时段客流热力图 - 按小时聚合堂食营收, 识别高峰低谷时段. 适用场景: 客户问'几点最忙'/'午市晚市占比'/'下午时段空不空'/'加什么班最划算'.";
    }

    @Override
    protected String getSectionName() {
        return "dining_heatmap";
    }
}
