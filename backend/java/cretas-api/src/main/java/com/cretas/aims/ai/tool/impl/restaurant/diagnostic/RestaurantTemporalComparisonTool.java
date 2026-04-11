package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantTemporalComparisonTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_temporal_comparison";
    }

    @Override
    public String getDescription() {
        return "同店同比分析 (YoY/QoQ/MoM) - 对比不同时间段的营收变化, 给出趋势解读. 适用场景: 客户问'比去年同期'/'和上个季度比'/'这个月比上月好还是差'.";
    }

    @Override
    protected String getSectionName() {
        return "temporal_comparison";
    }
}
