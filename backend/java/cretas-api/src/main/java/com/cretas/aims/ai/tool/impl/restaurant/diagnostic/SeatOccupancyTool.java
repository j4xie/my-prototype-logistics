package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class SeatOccupancyTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_seat_occupancy"; }
    @Override public String getDescription() {
        return "桌位配置分析 — 对比实际客群人数分布与桌位配置, 识别 2/4/6/8 人位是否匹配.";
    }
    @Override protected String getSectionName() { return "seat_occupancy"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("各门店桌位利用率对比", "高峰时段等位情况", "按时段拆分客群人数");
    }
}
