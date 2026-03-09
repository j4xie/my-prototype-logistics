package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.repository.inventory.SalesOrderItemRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 畅销菜品查询工具（近7天销量TOP 5）
 *
 * 对应意图: RESTAURANT_BESTSELLER_QUERY
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantBestsellerQueryTool extends AbstractBusinessTool {

    @Autowired
    private SalesOrderRepository salesOrderRepository;

    @Autowired
    private SalesOrderItemRepository salesOrderItemRepository;

    @Override
    public String getToolName() {
        return "restaurant_bestseller_query";
    }

    @Override
    public String getDescription() {
        return "查询近7天畅销菜品TOP 5。返回菜品名称、销量和销售额。" +
                "适用场景：了解哪些菜最受欢迎、热门菜品分析。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");
        schema.put("properties", Collections.emptyMap());
        schema.put("required", Collections.emptyList());
        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行畅销菜品查询 - 工厂ID: {}", factoryId);

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(7);

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        Map<String, double[]> accumulator = new HashMap<>();
        Map<String, String> nameMap = new HashMap<>();
        for (var order : orders) {
            var items = salesOrderItemRepository.findBySalesOrderId(order.getId());
            for (var item : items) {
                if (item.getProductTypeId() == null) continue;
                accumulator.computeIfAbsent(item.getProductTypeId(), k -> new double[2]);
                double[] acc = accumulator.get(item.getProductTypeId());
                if (item.getQuantity() != null) acc[0] += item.getQuantity().doubleValue();
                if (item.getQuantity() != null && item.getUnitPrice() != null)
                    acc[1] += item.getQuantity().multiply(item.getUnitPrice()).doubleValue();
                if (!nameMap.containsKey(item.getProductTypeId()) && item.getProductName() != null)
                    nameMap.put(item.getProductTypeId(), item.getProductName());
            }
        }

        List<Map<String, Object>> bestSellers = accumulator.entrySet().stream()
                .sorted(Comparator.comparingDouble((Map.Entry<String, double[]> e) -> e.getValue()[0]).reversed())
                .limit(5)
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("菜品", nameMap.getOrDefault(e.getKey(), e.getKey()));
                    row.put("7天销量", String.format("%.1f 份", e.getValue()[0]));
                    row.put("销售额", String.format("¥%.2f", e.getValue()[1]));
                    return row;
                }).collect(Collectors.toList());

        if (bestSellers.isEmpty()) {
            return buildSimpleResult("近7天暂无销售数据，请先完成点单记录后再查询畅销菜品。", null);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", startDate + " 至 " + endDate + "（近7天）");
        result.put("畅销TOP5", bestSellers);

        log.info("畅销菜品查询完成 - TOP5第一名: {}", bestSellers.get(0).get("菜品"));
        return result;
    }
}
