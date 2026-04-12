package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j @Component
public class PieceworkCalcTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_piecework_calc"; }
    @Override public String getDescription() { return "计件绩效计算 — 按岗位(迎宾个人/服务组团队)计算本月提成."; }
    @Override protected String getSectionName() { return "piecework_calc"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("各岗位提成对比", "调整计件规则", "查看排班工时");
    }
}
