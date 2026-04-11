package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantStorePnlOnePagerTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_store_pnl_one_pager";
    }

    @Override
    public String getDescription() {
        return "单店 P&L 一页纸 (headline + 财务分解 + 诊断聚合) - 生成完整的单店利润表简报, 含 headline 金句和关键警告. 适用场景: 客户问'给我这家店完整利润表'/'一页纸总结这家店的经营状况'.";
    }

    @Override
    protected String getSectionName() {
        return "store_pnl_one_pager";
    }
}
