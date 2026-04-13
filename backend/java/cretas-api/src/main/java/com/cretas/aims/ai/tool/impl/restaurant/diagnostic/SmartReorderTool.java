package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class SmartReorderTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_smart_reorder"; }
    @Override public String getDescription() {
        return "智能叫货单 — 基于历史销量预测+BOM展开+当前库存, 自动生成采购建议.";
    }
    @Override protected String getSectionName() { return "smart_reorder"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("各食材消耗趋势", "对比上周叫货量", "调整安全库存系数");
    }
}
