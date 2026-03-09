package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 高峰时段分析工具
 *
 * 使用 sales_orders.created_at 统计各整点时段订单数量。
 * 数据不足时使用蓝图默认配置。
 * 对应意图: RESTAURANT_PEAK_HOURS_ANALYSIS
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantPeakHoursAnalysisTool extends AbstractBusinessTool {

    @Autowired
    private SalesOrderRepository salesOrderRepository;

    @Override
    public String getToolName() {
        return "restaurant_peak_hours_analysis";
    }

    @Override
    public String getDescription() {
        return "高峰时段分析，统计近7天各时段订单分布，识别午市/晚市高峰。" +
                "适用场景：排班参考、备料安排、运营优化。";
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
        log.info("执行高峰时段分析 - 工厂ID: {}", factoryId);

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(7);

        var orders = salesOrderRepository.findByFactoryIdAndDateRange(factoryId, startDate, endDate);

        if (orders.isEmpty()) {
            return buildSimpleResult(
                    "近7天无订单数据，无法分析高峰时段。建议累积更多销售数据后再查询。", null);
        }

        long[] hourBuckets = new long[24];
        int validOrderCount = 0;
        for (var o : orders) {
            if (o.getCreatedAt() != null) {
                int h = o.getCreatedAt().getHour();
                if (h >= 6 && h <= 22) {
                    hourBuckets[h]++;
                    validOrderCount++;
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("统计周期", startDate + " 至 " + endDate + "（近7天）");
        result.put("总订单数", orders.size());

        // 数据不足时使用默认值
        if (validOrderCount < 10) {
            log.info("高峰时段分析数据不足（有效订单 {} 条），使用蓝图默认配置", validOrderCount);
            result.put("数据说明", String.format("当前有效时间戳订单仅 %d 条（需 >=10 条才能精确分析）", validOrderCount));
            result.put("高峰时段（蓝图默认）", Map.of(
                    "午市高峰", "11:00-13:00",
                    "晚市高峰", "17:00-20:00",
                    "数据来源", "FactoryTypeBlueprint RESTAURANT 类型默认配置"
            ));
            result.put("运营建议", List.of(
                    "午市（11:00-13:00）：高峰前30分钟完成备料，安排充足服务人员",
                    "晚市（17:00-20:00）：提前补充食材，避免断货影响翻台",
                    "建议积累更多销售记录后，系统将自动生成门店专属高峰分析"
            ));
            return result;
        }

        // 构建各时段分布
        List<Map<String, Object>> hourlyList = new ArrayList<>();
        for (int h = 6; h <= 22; h++) {
            if (hourBuckets[h] > 0) {
                double pct = validOrderCount > 0 ? hourBuckets[h] * 100.0 / validOrderCount : 0;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("时段", String.format("%02d:00-%02d:00", h, h + 1));
                row.put("订单数", hourBuckets[h]);
                row.put("占比", String.format("%.1f%%", pct));
                hourlyList.add(row);
            }
        }

        // 找出 Top 4 最忙时段
        List<int[]> top4Buckets = new ArrayList<>();
        for (int h = 6; h <= 22; h++) {
            top4Buckets.add(new int[]{h, (int) hourBuckets[h]});
        }
        top4Buckets.sort((a, b) -> Integer.compare(b[1], a[1]));
        List<int[]> peakBuckets = top4Buckets.stream()
                .filter(b -> b[1] > 0)
                .limit(4)
                .sorted(Comparator.comparingInt(b -> b[0]))
                .collect(Collectors.toList());

        // 合并连续高峰时段
        List<String> peakWindows = new ArrayList<>();
        if (!peakBuckets.isEmpty()) {
            int windowStart = peakBuckets.get(0)[0];
            int windowEnd = peakBuckets.get(0)[0];
            for (int i = 1; i < peakBuckets.size(); i++) {
                int curHour = peakBuckets.get(i)[0];
                if (curHour <= windowEnd + 1) {
                    windowEnd = curHour;
                } else {
                    peakWindows.add(String.format("%02d:00-%02d:00", windowStart, windowEnd + 1));
                    windowStart = curHour;
                    windowEnd = curHour;
                }
            }
            peakWindows.add(String.format("%02d:00-%02d:00", windowStart, windowEnd + 1));
        }

        int topHour = peakBuckets.isEmpty() ? -1 : peakBuckets.stream()
                .max(Comparator.comparingInt(b -> b[1]))
                .map(b -> b[0])
                .orElse(-1);
        double topHourPct = topHour >= 0 && validOrderCount > 0
                ? hourBuckets[topHour] * 100.0 / validOrderCount : 0;

        result.put("高峰时段窗口", peakWindows);
        result.put("最忙时段", topHour >= 0
                ? String.format("%02d:00-%02d:00（占全天订单 %.1f%%）", topHour, topHour + 1, topHourPct)
                : "数据不足");
        result.put("时段分布", hourlyList);
        result.put("运营建议", List.of(
                "在高峰时段开始前30分钟完成备料，确保食材充足",
                "高峰时段安排充足服务人员，缩短顾客等待时间",
                "低谷时段安排设备清洁、食材预处理等准备工作"
        ));
        result.put("数据说明", "时段统计基于订单创建时间（created_at），与实际下单时间误差通常在数秒内");

        log.info("高峰时段分析完成 - 高峰窗口: {}", peakWindows);
        return result;
    }
}
