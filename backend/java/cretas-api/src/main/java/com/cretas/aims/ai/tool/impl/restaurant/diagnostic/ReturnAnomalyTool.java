package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class ReturnAnomalyTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_return_anomaly"; }
    @Override public String getDescription() {
        return "供应链退货异常检测 — 对比同批次各门店退货率, 识别异常门店通知总部.";
    }
    @Override protected String getSectionName() { return "return_anomaly"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("供应商历史退货趋势", "异常门店其他供应商情况", "建议更换供应商还是调查门店");
    }
}
