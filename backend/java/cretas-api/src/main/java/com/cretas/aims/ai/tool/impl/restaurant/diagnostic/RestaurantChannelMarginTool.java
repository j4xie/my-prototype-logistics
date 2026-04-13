package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantChannelMarginTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_channel_margin";
    }

    @Override
    public String getDescription() {
        return "餐饮渠道毛利率分析 - 按订单来源 (堂食/外卖/团购) 拆分营收贡献和净收款率. 适用场景: 客户问'美团/饿了么拿走多少抽成'/'哪个渠道赚钱'/'团购单值不值得'.";
    }

    @Override
    protected String getSectionName() {
        return "channel_margin";
    }
}
