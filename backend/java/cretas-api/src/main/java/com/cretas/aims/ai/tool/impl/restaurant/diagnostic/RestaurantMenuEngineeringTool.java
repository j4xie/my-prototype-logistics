package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Restaurant menu engineering tool — wraps the Python menu_engineering
 * section (P3 Task 3.2). Applies the Kasavana-Smith 4-quadrant model:
 * classifies menu items by sold_qty × margin_ratio into Star / Cash Cow
 * / Puzzle / Dog buckets and generates actionable Chinese recommendations.
 *
 * Activated by intents like "哪些菜该砍" / "菜品工程" / "菜单结构合理吗" /
 * "哪些菜撑得住".
 */
@Slf4j
@Component
public class RestaurantMenuEngineeringTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_menu_engineering";
    }

    @Override
    public String getDescription() {
        return "菜品工程 4 象限分析 (Kasavana-Smith 模型) — 按销量 × 毛利把菜品分为 "
             + "Star (招牌)/Cash Cow (走量)/Puzzle (高利无人点)/Dog (淘汰候选). "
             + "自动生成 Chinese 行动建议: 保护 Star, 推广 Puzzle, 淘汰 Dog. "
             + "适用场景: 客户问'哪些菜该砍'/'菜品工程'/'菜单结构合理吗'/"
             + "'高利但没人点的菜'.";
    }

    @Override
    protected String getSectionName() {
        return "menu_engineering";
    }
}
