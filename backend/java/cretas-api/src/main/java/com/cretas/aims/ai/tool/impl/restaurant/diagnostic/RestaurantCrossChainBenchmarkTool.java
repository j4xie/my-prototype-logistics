package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Restaurant cross-chain benchmark tool — wraps the Python
 * cross_chain_benchmark section (P3 Task 3.3-3.4). Compares multiple
 * brand chains against each other within the same sub-sector.
 *
 * <p>The Python section accepts a {@code chains} list where each element
 * has {@code name}, {@code sub_sector}, and {@code rows} (inline POS data).
 * The tool passes params through the standard
 * {@link AbstractRestaurantDiagnosticTool#buildSectionParams} mechanism.
 *
 * <p>Activated by intents like:
 * <ul>
 *   <li>"我在川菜连锁里排第几"</li>
 *   <li>"对标蜀大侠差在哪"</li>
 *   <li>"跨品牌对标"</li>
 *   <li>"连锁品牌比较"</li>
 *   <li>"17家店跟同行比"</li>
 * </ul>
 */
@Slf4j
@Component
public class RestaurantCrossChainBenchmarkTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_cross_chain_benchmark";
    }

    @Override
    public String getDescription() {
        return "跨连锁品牌对标 — 把多个品牌的 POS 数据放在一起对比, 分析各品牌的人均客单/SKU 复杂度/"
             + "价格带分布/品类集中度/菜品重叠度. 适用场景: 客户想了解自家品牌在同子行业里的位置, "
             + "例如'我在川菜连锁里排第几'/'对标蜀大侠差在哪'/'跨品牌对标'/"
             + "'连锁品牌比较'/'17家店跟同行比'. "
             + "调用时需通过 chains 参数传入各品牌数据列表.";
    }

    @Override
    protected String getSectionName() {
        return "cross_chain_benchmark";
    }
}
