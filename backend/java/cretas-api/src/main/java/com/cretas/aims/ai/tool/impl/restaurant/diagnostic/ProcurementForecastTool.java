package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays; import java.util.List; import java.util.Map;

@Slf4j @Component
public class ProcurementForecastTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_procurement_forecast"; }
    @Override public String getDescription() { return "采购预测 — 基于历史日销量+节假日调整, 预测未来N天营收和客流."; }
    @Override protected String getSectionName() { return "procurement_forecast"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("结合BOM生成叫货单", "调整节假日倍数", "对比去年同期"); }
}
