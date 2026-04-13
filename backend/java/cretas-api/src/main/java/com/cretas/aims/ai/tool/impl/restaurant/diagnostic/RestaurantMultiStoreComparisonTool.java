package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantMultiStoreComparisonTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_multi_store_comparison";
    }

    @Override
    public String getDescription() {
        return "连锁多店对比 + 异常检测 (门店排名/营收下滑预警) - 横向对比多个门店的财务和运营指标, 识别异常门店. 适用场景: 客户问'17 家店哪家最好'/'哪家店出问题了'/'门店之间差距多大'.";
    }

    @Override
    protected String getSectionName() {
        return "multi_store_comparison";
    }
}
