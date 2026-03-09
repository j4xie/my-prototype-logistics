package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

/**
 * 毛利率分析工具
 *
 * 对比营业额与食材成本，计算毛利率。
 * 对应意图: RESTAURANT_MARGIN_ANALYSIS
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantMarginAnalysisTool extends AbstractBusinessTool {

    @Autowired
    private SalesOrderRepository salesOrderRepository;

    @Autowired
    private MaterialBatchRepository materialBatchRepository;

    @Override
    public String getToolName() {
        return "restaurant_margin_analysis";
    }

    @Override
    public String getDescription() {
        return "毛利率分析，对比近30天营业额与食材成本，计算毛利润和毛利率。" +
                "适用场景：盈利分析、成本控制、经营效益评估。";
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
        log.info("执行毛利率分析 - 工厂ID: {}", factoryId);

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(30);

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        double totalRevenue = orders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount().doubleValue() : 0)
                .sum();

        var batches = materialBatchRepository.findByFactoryId(factoryId, PageRequest.of(0, 500));
        double ingredientCost = batches.stream()
                .filter(b -> b.getReceiptDate() != null &&
                             !b.getReceiptDate().isBefore(startDate) &&
                             !b.getReceiptDate().isAfter(endDate))
                .mapToDouble(b -> {
                    if (b.getUnitPrice() != null && b.getReceiptQuantity() != null) {
                        return b.getUnitPrice().multiply(b.getReceiptQuantity()).doubleValue();
                    }
                    return 0;
                }).sum();

        double grossProfit = totalRevenue - ingredientCost;
        double grossMargin = totalRevenue > 0 ?
                BigDecimal.valueOf(grossProfit / totalRevenue * 100)
                        .setScale(2, RoundingMode.HALF_UP).doubleValue() : 0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", startDate + " 至 " + endDate + "（近30天）");
        result.put("营业额", String.format("¥%.2f", totalRevenue));
        result.put("食材成本", String.format("¥%.2f", ingredientCost));
        result.put("毛利润", String.format("¥%.2f", grossProfit));
        result.put("毛利率", String.format("%.2f%%", grossMargin));
        result.put("行业参考", "餐饮业平均毛利率 60-70%，精细化管理可达 75%+");
        result.put("说明", "成本仅含食材采购成本，未含人工、租金等固定费用");

        log.info("毛利率分析完成 - 毛利率: {}%", String.format("%.2f", grossMargin));
        return result;
    }
}
