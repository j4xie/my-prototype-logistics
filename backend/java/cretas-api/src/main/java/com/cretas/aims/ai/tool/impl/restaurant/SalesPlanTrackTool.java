package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.impl.restaurant.diagnostic.AbstractRestaurantDiagnosticTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class SalesPlanTrackTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_sales_plan_track";
    }

    @Override
    public String getDescription() {
        return "追踪门店月度销售计划完成度 — 对比目标与实际, 计算日/周/月进度, 未达标预警.";
    }

    @Override
    protected String getSectionName() {
        return "sales_plan_tracking";
    }

    @Override
    protected List<String> buildFollowUps(String sectionName, Map<String, Object> data) {
        return Arrays.asList(
            "对比上月的完成情况",
            "哪家门店计划差距最大",
            "调整本月销售目标"
        );
    }
}
