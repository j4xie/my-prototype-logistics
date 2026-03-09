package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * 营业额趋势分析工具（近7天/30天）
 *
 * 对应意图: RESTAURANT_REVENUE_TREND
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantRevenueTrendTool extends AbstractBusinessTool {

    @Autowired
    private SalesOrderRepository salesOrderRepository;

    @Override
    public String getToolName() {
        return "restaurant_revenue_trend";
    }

    @Override
    public String getDescription() {
        return "营业额趋势分析，按天展示营业额、订单数、日均及最高日营业额。默认近7天。" +
                "适用场景：营业走势、收入趋势分析、经营状况评估。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> days = new HashMap<>();
        days.put("type", "integer");
        days.put("description", "统计天数，默认7天");
        days.put("default", 7);
        days.put("minimum", 1);
        days.put("maximum", 90);
        properties.put("days", days);

        schema.put("properties", properties);
        schema.put("required", Collections.emptyList());

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行营业额趋势分析 - 工厂ID: {}, 参数: {}", factoryId, params);

        int days = getInteger(params, "days", 7);

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(days - 1);

        List<Map<String, Object>> trendList = new ArrayList<>();
        double totalRevenue = 0;
        double maxRevenue = 0;
        String maxDate = "-";

        for (LocalDate d = startDate; !d.isAfter(endDate); d = d.plusDays(1)) {
            final LocalDate current = d;
            var dayOrders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, current, current);
            double dayRevenue = dayOrders.stream()
                    .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount().doubleValue() : 0)
                    .sum();
            totalRevenue += dayRevenue;

            if (dayRevenue > maxRevenue) {
                maxRevenue = dayRevenue;
                maxDate = d.toString();
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("日期", d.toString());
            row.put("营业额", String.format("¥%.2f", dayRevenue));
            row.put("订单数", dayOrders.size());
            trendList.add(row);
        }

        double avgRevenue = days > 0 ? totalRevenue / days : 0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", days + "天（" + startDate + " 至 " + endDate + "）");
        result.put("总营业额", String.format("¥%.2f", totalRevenue));
        result.put("日均营业额", String.format("¥%.2f", avgRevenue));
        result.put("最高日营业额", String.format("¥%.2f（%s）", maxRevenue, maxDate));
        result.put("每日明细", trendList);

        log.info("营业额趋势分析完成 - 近{}天总营业额: ¥{}", days, String.format("%.2f", totalRevenue));
        return result;
    }
}
