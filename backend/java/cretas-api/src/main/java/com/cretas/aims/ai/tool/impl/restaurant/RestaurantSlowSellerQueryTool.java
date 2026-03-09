package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.repository.inventory.SalesOrderItemRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 滞销菜品查询工具（近7天销量最低5道）
 *
 * 对应意图: RESTAURANT_SLOW_SELLER_QUERY
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantSlowSellerQueryTool extends AbstractBusinessTool {

    @Autowired
    private ProductTypeRepository productTypeRepository;

    @Autowired
    private SalesOrderRepository salesOrderRepository;

    @Autowired
    private SalesOrderItemRepository salesOrderItemRepository;

    @Override
    public String getToolName() {
        return "restaurant_slow_seller_query";
    }

    @Override
    public String getDescription() {
        return "查询近7天滞销菜品（销量最低5道或零销售）。帮助识别需要促销或下架的菜品。" +
                "适用场景：菜单优化、减少食材浪费、滞销品分析。";
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
        log.info("执行滞销菜品查询 - 工厂ID: {}", factoryId);

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(7);

        var allDishes = productTypeRepository.findByFactoryIdAndIsActive(factoryId, true);
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

        List<Map<String, Object>> slowSellers = new ArrayList<>();

        // 无任何销售记录的菜品（完全滞销）
        for (var dish : allDishes) {
            if (!accumulator.containsKey(dish.getId())) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("菜品", dish.getName());
                row.put("7天销量", "0 份");
                row.put("状态", "零销售");
                slowSellers.add(row);
            }
        }

        // 补充低销量菜品
        accumulator.entrySet().stream()
                .sorted(Comparator.comparingDouble(e -> e.getValue()[0]))
                .limit(5)
                .forEach(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("菜品", nameMap.getOrDefault(e.getKey(), e.getKey()));
                    row.put("7天销量", String.format("%.1f 份", e.getValue()[0]));
                    row.put("状态", "低销量");
                    slowSellers.add(row);
                });

        if (slowSellers.isEmpty()) {
            return buildSimpleResult("近7天所有菜品均有销售，暂无明显滞销菜品。", null);
        }

        List<Map<String, Object>> top5 = slowSellers.stream().limit(5).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", startDate + " 至 " + endDate + "（近7天）");
        result.put("滞销菜品", top5);
        result.put("建议", "可考虑对滞销菜品进行促销或暂时下架，以降低食材损耗。");

        log.info("滞销菜品查询完成 - 发现 {} 道滞销菜品", top5.size());
        return result;
    }
}
