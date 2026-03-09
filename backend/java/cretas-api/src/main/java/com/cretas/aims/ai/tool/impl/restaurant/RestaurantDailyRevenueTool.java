package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * 今日/指定日期营业额查询工具
 *
 * 对应意图: RESTAURANT_DAILY_REVENUE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantDailyRevenueTool extends AbstractBusinessTool {

    @Autowired
    private SalesOrderRepository salesOrderRepository;

    @Override
    public String getToolName() {
        return "restaurant_daily_revenue";
    }

    @Override
    public String getDescription() {
        return "查询今日或指定日期的营业额，包括订单数量和客单价。" +
                "适用场景：查看当日营收、指定日期营业情况。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> date = new HashMap<>();
        date.put("type", "string");
        date.put("description", "查询日期，格式: yyyy-MM-dd，默认今天");
        date.put("format", "date");
        properties.put("date", date);

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
        log.info("执行日营业额查询 - 工厂ID: {}, 参数: {}", factoryId, params);

        LocalDate queryDate = LocalDate.now();
        String dateStr = getString(params, "date");
        if (dateStr != null) {
            try {
                queryDate = LocalDate.parse(dateStr);
            } catch (Exception ignored) {}
        }

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, queryDate, queryDate);

        if (orders.isEmpty()) {
            return buildSimpleResult(
                    String.format("%s 暂无订单记录，营业额为 ¥0.00。", queryDate), null);
        }

        double totalRevenue = orders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount().doubleValue() : 0)
                .sum();
        long orderCount = orders.size();
        double avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("日期", queryDate.toString());
        result.put("营业额", String.format("¥%.2f", totalRevenue));
        result.put("订单数量", orderCount);
        result.put("客单价", String.format("¥%.2f", avgOrderValue));

        log.info("日营业额查询完成 - 日期: {}, 营业额: ¥{}", queryDate, String.format("%.2f", totalRevenue));
        return result;
    }
}
