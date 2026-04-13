package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantStoredValueTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_stored_value";
    }

    @Override
    public String getDescription() {
        return "储值卡依赖度分析 (月核销率 + 兑付余额 + 警戒线) - 评估充卡后的兑付健康度. 适用场景: 客户问'储值卡还剩多少没兑'/'核销速度在变慢吗'/'充卡依赖度过高怎么办'.";
    }

    @Override
    protected String getSectionName() {
        return "stored_value";
    }
}
