package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * 客单价查询工具
 *
 * 基于 salesOrderRepository 计算 totalAmount / orderCount。
 * 对应意图: RESTAURANT_AVG_TICKET
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantAvgTicketTool extends AbstractBusinessTool {

    @Autowired
    private SalesOrderRepository salesOrderRepository;

    @Override
    public String getToolName() {
        return "restaurant_avg_ticket";
    }

    @Override
    public String getDescription() {
        return "查询客单价，包括近期平均客单价和今日客单价。默认统计近30天。" +
                "适用场景：客单价分析、消费水平评估、定价参考。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> days = new HashMap<>();
        days.put("type", "integer");
        days.put("description", "统计天数，默认30天");
        days.put("default", 30);
        days.put("minimum", 1);
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
        log.info("执行客单价查询 - 工厂ID: {}, 参数: {}", factoryId, params);

        int days = getInteger(params, "days", 30);

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(days);

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        if (orders.isEmpty()) {
            return buildSimpleResult(
                    String.format("近%d天暂无订单数据，无法计算客单价。", days), null);
        }

        double totalRevenue = orders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount().doubleValue() : 0)
                .sum();
        long orderCount = orders.size();
        double avgTicket = totalRevenue / orderCount;

        // 今日客单价
        var todayOrders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, LocalDate.now(), LocalDate.now());
        double todayRevenue = todayOrders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount().doubleValue() : 0)
                .sum();
        double todayAvgTicket = todayOrders.isEmpty() ? 0 : todayRevenue / todayOrders.size();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", String.format("近%d天（%s 至 %s）", days, startDate, endDate));
        result.put("总营业额", String.format("¥%.2f", totalRevenue));
        result.put("总订单数", orderCount);
        result.put("平均客单价", String.format("¥%.2f", avgTicket));
        result.put("今日客单价", todayOrders.isEmpty() ? "今日暂无订单" : String.format("¥%.2f", todayAvgTicket));
        result.put("行业参考", "餐饮业平均客单价因品类差异较大，快餐30-60元，正餐80-200元");

        log.info("客单价查询完成 - 平均客单价: ¥{}", String.format("%.2f", avgTicket));
        return result;
    }
}
