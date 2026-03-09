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
 * 按产品维度销量排行工具（TOP 15，含分类汇总）
 *
 * 对应意图: RESTAURANT_DISH_PRODUCT_SALES_RANKING
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantDishProductSalesRankingTool extends AbstractBusinessTool {

    @Autowired
    private ProductTypeRepository productTypeRepository;

    @Autowired
    private SalesOrderRepository salesOrderRepository;

    @Autowired
    private SalesOrderItemRepository salesOrderItemRepository;

    @Override
    public String getToolName() {
        return "restaurant_dish_product_sales_ranking";
    }

    @Override
    public String getDescription() {
        return "按产品维度的销量排行（TOP 15），包含产品分类信息和分类销售额汇总。" +
                "适用场景：产品分析、品类对比、菜单结构优化。";
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
        log.info("执行产品维度销量排行 - 工厂ID: {}, 参数: {}", factoryId, params);

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

        List<ProductType> allDishes = productTypeRepository.findByFactoryIdAndIsActive(factoryId, true);
        Map<String, String> categoryMap = new HashMap<>();
        for (ProductType d : allDishes) {
            categoryMap.put(d.getId(), d.getCategory() != null ? d.getCategory() : "未分类");
        }

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);
        if (orders.isEmpty()) {
            return buildSimpleResult(
                    String.format("近30天（%s 至 %s）暂无销售记录。", startDate, endDate), null);
        }

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

        List<Map<String, Object>> ranking = accumulator.entrySet().stream()
                .sorted(Comparator.comparingDouble((Map.Entry<String, double[]> e) -> e.getValue()[0]).reversed())
                .limit(15)
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("菜品名称", nameMap.getOrDefault(e.getKey(), e.getKey()));
                    row.put("分类", categoryMap.getOrDefault(e.getKey(), "未分类"));
                    row.put("销售数量", String.format("%.1f", e.getValue()[0]));
                    row.put("销售金额", String.format("¥%.2f", e.getValue()[1]));
                    return row;
                }).collect(Collectors.toList());

        for (int i = 0; i < ranking.size(); i++) {
            ranking.get(i).put("排名", i + 1);
        }

        // 按分类汇总
        Map<String, Double> categoryRevenue = new LinkedHashMap<>();
        for (Map.Entry<String, double[]> e : accumulator.entrySet()) {
            String cat = categoryMap.getOrDefault(e.getKey(), "未分类");
            categoryRevenue.merge(cat, e.getValue()[1], Double::sum);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("period", startDate + " 至 " + endDate);
        result.put("产品销量排行（TOP 15）", ranking);
        result.put("分类销售额汇总", categoryRevenue);

        log.info("产品维度销量排行完成 - 共 {} 个产品", ranking.size());
        return result;
    }
}
