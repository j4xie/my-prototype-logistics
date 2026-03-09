package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.enums.SalesOrderStatus;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

/**
 * 退单率查询工具
 *
 * 使用 SalesOrder 中 CANCELLED 状态占比作为近似退货率。
 * 对应意图: RESTAURANT_RETURN_RATE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantReturnRateTool extends AbstractBusinessTool {

    @Autowired
    private SalesOrderRepository salesOrderRepository;

    @Override
    public String getToolName() {
        return "restaurant_return_rate";
    }

    @Override
    public String getDescription() {
        return "退单率查询，统计取消订单占比。默认近30天。" +
                "适用场景：服务质量评估、退单原因分析、运营改善。";
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
        log.info("执行退单率查询 - 工厂ID: {}, 参数: {}", factoryId, params);

        int days = getInteger(params, "days", 30);

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(days);

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        if (orders.isEmpty()) {
            return buildSimpleResult(
                    String.format("近%d天暂无订单数据，无法计算退单率。", days), null);
        }

        long totalCount = orders.size();
        long cancelledCount = orders.stream()
                .filter(o -> o.getStatus() == SalesOrderStatus.CANCELLED)
                .count();
        double returnRate = totalCount > 0 ?
                BigDecimal.valueOf(cancelledCount * 100.0 / totalCount)
                        .setScale(2, RoundingMode.HALF_UP).doubleValue() : 0;

        String assessment = returnRate > 10 ? "偏高，建议排查原因" :
                returnRate > 5 ? "中等，有改善空间" : "良好，继续保持";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", String.format("近%d天（%s 至 %s）", days, startDate, endDate));
        result.put("总订单数", totalCount);
        result.put("取消订单数", cancelledCount);
        result.put("退单率", String.format("%.2f%%", returnRate));
        result.put("评估", assessment);
        result.put("行业参考", "餐饮业退单率建议控制在 3% 以内");
        result.put("说明", "退单率 = 已取消订单数 / 总订单数。包含主动取消和被动取消。");

        log.info("退单率查询完成 - 退单率: {}%", String.format("%.2f", returnRate));
        return result;
    }
}
