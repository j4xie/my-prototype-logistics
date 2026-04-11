package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantBenchmarkAlertTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_benchmark_alert";
    }

    @Override
    public String getDescription() {
        return "餐饮行业对标预警 - 把门店关键指标 (食材成本率/人工成本率/客单价/翻台率) 与子行业 (火锅/川菜/烧烤等) 中位数和健康区间对比, 输出警报和年化影响. 适用场景: 客户问'我比别人差在哪'/'行业平均是多少'/'我是不是有问题'.";
    }

    @Override
    protected String getSectionName() {
        return "benchmark_alerts";
    }
}
