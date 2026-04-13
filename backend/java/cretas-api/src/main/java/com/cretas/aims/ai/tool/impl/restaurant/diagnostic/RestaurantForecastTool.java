package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Restaurant forecast tool — wraps the Python restaurant_forecast section
 * (P3 Task 3.5-3.6). Builds a monthly revenue time series from POS data
 * or caller-provided history, runs multi-algorithm forecast with
 * confidence band, returns predictions + Chinese interpretation.
 *
 * <p>The underlying ForecastService supports: moving_average, linear_trend,
 * exponential_smoothing, seasonal_decomposition, auto (best-fit selection).
 *
 * <p>Activated by intents like "下个月会怎样" / "按这个趋势预测未来" /
 * "什么时候会扛不住" / "3 月营收预测".
 *
 * <p>Registered via {@code @Component} — picked up automatically by
 * {@code ToolRegistry}. No manual wiring required.
 */
@Slf4j
@Component
public class RestaurantForecastTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_forecast";
    }

    @Override
    public String getDescription() {
        return "餐饮营收预测 — 基于历史月度营收做 1-6 个月预测, 含 80% 置信区间. "
             + "返回预测值 + 上下界 + Chinese 趋势解读 (如'按当前趋势预测期末营收将再降 15%, "
             + "需要立即干预'). 适用场景: 客户问'下个月会怎样'/'按这个趋势预测未来'/"
             + "'什么时候会扛不住'/'3 月营收预测'.";
    }

    @Override
    protected String getSectionName() {
        return "restaurant_forecast";
    }
}
