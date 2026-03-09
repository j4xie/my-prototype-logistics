package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * 订单统计工具（数量、均价）
 *
 * 对应意图: RESTAURANT_ORDER_STATISTICS
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantOrderStatisticsTool extends AbstractBusinessTool {

    @Autowired
    private SalesOrderRepository salesOrderRepository;

    @Override
    public String getToolName() {
        return "restaurant_order_statistics";
    }

    @Override
    public String getDescription() {
        return "订单统计分析，包括总订单数、今日订单数、总营业额和平均客单价。默认近30天。" +
                "适用场景：经营概览、订单量分析、日常运营监控。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> startDate = new HashMap<>();
        startDate.put("type", "string");
        startDate.put("description", "开始日期，格式: yyyy-MM-dd，默认30天前");
        startDate.put("format", "date");
        properties.put("startDate", startDate);

        Map<String, Object> endDate = new HashMap<>();
        endDate.put("type", "string");
        endDate.put("description", "结束日期，格式: yyyy-MM-dd，默认今天");
        endDate.put("format", "date");
        properties.put("endDate", endDate);

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
        log.info("执行订单统计查询 - 工厂ID: {}, 参数: {}", factoryId, params);

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(30);
        String startDateStr = getString(params, "startDate");
        String endDateStr = getString(params, "endDate");
        if (startDateStr != null) {
            try { startDate = LocalDate.parse(startDateStr); } catch (Exception ignored) {}
        }
        if (endDateStr != null) {
            try { endDate = LocalDate.parse(endDateStr); } catch (Exception ignored) {}
        }

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        long totalOrders = orders.size();
        double totalRevenue = orders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount().doubleValue() : 0)
                .sum();
        double avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        long todayOrders = salesOrderRepository.countByFactoryIdAndDate(factoryId, LocalDate.now());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", startDate + " 至 " + endDate);
        result.put("总订单数", totalOrders);
        result.put("今日订单数", todayOrders);
        result.put("总营业额", String.format("¥%.2f", totalRevenue));
        result.put("平均客单价", String.format("¥%.2f", avgOrderValue));

        log.info("订单统计查询完成 - 总订单: {}, 营业额: ¥{}", totalOrders, String.format("%.2f", totalRevenue));
        return result;
    }
}
