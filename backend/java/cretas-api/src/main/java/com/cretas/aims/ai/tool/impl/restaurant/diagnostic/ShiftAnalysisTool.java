package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j @Component
public class ShiftAnalysisTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_shift_analysis"; }
    @Override public String getDescription() { return "排班分析 — 评估全职/兼职比例、工时合规、人力成本效率."; }
    @Override protected String getSectionName() { return "shift_analysis"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("各门店排班对比", "兼职比例优化建议", "节假日排班调整");
    }
}
