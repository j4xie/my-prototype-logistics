package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Restaurant shrinkage analysis tool — wraps the Python shrinkage_analysis
 * section (P3.5C B4). Compares per-department standard cost (from BOM) vs
 * actual cost (from monthly inventory count), ranks offenders with variance
 * rate > 2%, and auto-generates Chinese action items with severity-based
 * suggestion text.
 *
 * Activated by intents like "哪个档口损溢最多" / "标准成本 vs 实际" /
 * "档口变差原因" / "月度盘点差异".
 */
@Slf4j
@Component
public class RestaurantShrinkageAnalysisTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_shrinkage_analysis";
    }

    @Override
    public String getDescription() {
        return "档口标准成本 vs 实际成本差异分析 (损溢). 基于 BOM × 销量计算标准成本, "
             + "对比月度盘点实际成本, 识别超标档口 (>2% 变异率) + 生成 Chinese 改进跟踪表. "
             + "适用场景: 客户问'哪个档口损溢最多'/'标准成本对不对'/'为什么实际成本高'/"
             + "'月度盘点差在哪'.";
    }

    @Override
    protected String getSectionName() {
        return "shrinkage_analysis";
    }
}
