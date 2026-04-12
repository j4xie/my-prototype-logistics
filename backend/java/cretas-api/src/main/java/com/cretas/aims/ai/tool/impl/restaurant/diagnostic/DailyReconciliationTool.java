package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays; import java.util.List; import java.util.Map;

@Slf4j @Component
public class DailyReconciliationTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_daily_reconciliation"; }
    @Override public String getDescription() { return "日清日结库存对账 — 对比BOM预期用量vs实际盘点, 找出差异超标食材."; }
    @Override protected String getSectionName() { return "daily_reconciliation"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("哪些食材差异最大", "本周差异趋势", "追溯差异原因"); }
}
