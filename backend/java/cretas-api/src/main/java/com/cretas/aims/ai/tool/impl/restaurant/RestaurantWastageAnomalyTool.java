package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.repository.MaterialBatchRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 损耗异常检测工具
 *
 * 检测同食材多批次过期、高价食材过期等异常。
 * 对应意图: RESTAURANT_WASTAGE_ANOMALY
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantWastageAnomalyTool extends AbstractBusinessTool {

    @Autowired
    private MaterialBatchRepository materialBatchRepository;

    @Override
    public String getToolName() {
        return "restaurant_wastage_anomaly";
    }

    @Override
    public String getDescription() {
        return "损耗异常检测，识别重复过期和高价食材过期等异常情况。" +
                "适用场景：异常预警、库存风险管理、运营问题排查。";
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
        log.info("执行损耗异常检测 - 工厂ID: {}", factoryId);

        try {
            var expiredBatches = materialBatchRepository.findExpiredBatches(factoryId);
            var recentExpired = expiredBatches.stream()
                    .filter(b -> b.getExpireDate() != null &&
                                 !b.getExpireDate().isBefore(LocalDate.now().minusDays(7)))
                    .collect(Collectors.toList());

            List<Map<String, Object>> anomalies = new ArrayList<>();

            // 规则1：同一食材连续多批次过期
            Map<String, Long> expiredByMaterial = recentExpired.stream()
                    .filter(b -> b.getMaterialType() != null)
                    .collect(Collectors.groupingBy(
                            (MaterialBatch b) -> b.getMaterialType().getName(),
                            Collectors.counting()));

            expiredByMaterial.entrySet().stream()
                    .filter(e -> e.getValue() >= 2)
                    .forEach(e -> {
                        Map<String, Object> anomaly = new LinkedHashMap<>();
                        anomaly.put("异常类型", "重复过期");
                        anomaly.put("食材", e.getKey());
                        anomaly.put("近7天过期批次数", e.getValue());
                        anomaly.put("可能原因", "订货量过多或该食材销量下降");
                        anomaly.put("建议", "减少下次采购量，或促销消化库存");
                        anomalies.add(anomaly);
                    });

            // 规则2：高价值食材过期
            double avgCost = expiredBatches.stream()
                    .mapToDouble(b -> b.getUnitPrice() != null ? b.getUnitPrice().doubleValue() : 0)
                    .average().orElse(0);

            recentExpired.stream()
                    .filter(b -> b.getUnitPrice() != null && b.getUnitPrice().doubleValue() > avgCost * 2)
                    .forEach(b -> {
                        Map<String, Object> anomaly = new LinkedHashMap<>();
                        anomaly.put("异常类型", "高价食材过期");
                        anomaly.put("食材", b.getMaterialType() != null ? b.getMaterialType().getName() : "未知");
                        anomaly.put("批次号", b.getBatchNumber());
                        anomaly.put("单价", String.format("¥%.2f", b.getUnitPrice()));
                        anomaly.put("建议", "高价食材需加强先进先出（FIFO）管理");
                        anomalies.add(anomaly);
                    });

            if (anomalies.isEmpty()) {
                return buildSimpleResult("近7天未检测到明显损耗异常，库存管理状态良好。", null);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("检测周期", "近7天");
            result.put("异常数量", anomalies.size());
            result.put("异常详情", anomalies);

            log.info("损耗异常检测完成 - 发现 {} 条异常", anomalies.size());
            return result;
        } catch (Exception e) {
            log.warn("损耗异常检测失败: {}", e.getMessage());
            return buildSimpleResult(
                    "损耗异常检测功能正在建设中。建议定期盘点食材库存，对比理论用量与实际用量，发现异常及时上报。", null);
        }
    }
}
