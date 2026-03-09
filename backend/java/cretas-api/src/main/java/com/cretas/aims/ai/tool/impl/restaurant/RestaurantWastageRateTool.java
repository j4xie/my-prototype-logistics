package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.MaterialBatchRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * 损耗率查询工具
 *
 * 入库量 vs 过期量估算损耗率。
 * 对应意图: RESTAURANT_WASTAGE_RATE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantWastageRateTool extends AbstractBusinessTool {

    @Autowired
    private MaterialBatchRepository materialBatchRepository;

    @Override
    public String getToolName() {
        return "restaurant_wastage_rate";
    }

    @Override
    public String getDescription() {
        return "损耗率查询，基于入库量与过期量估算食材损耗率。" +
                "适用场景：库存管理评估、损耗趋势监控、运营改善。";
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
        log.info("执行损耗率查询 - 工厂ID: {}", factoryId);

        try {
            var allBatches = materialBatchRepository.findByFactoryId(factoryId, PageRequest.of(0, 1000));
            var expiredBatches = materialBatchRepository.findExpiredBatches(factoryId);

            double totalInbound = allBatches.stream()
                    .mapToDouble(b -> b.getReceiptQuantity() != null ? b.getReceiptQuantity().doubleValue() : 0)
                    .sum();
            double totalExpiredQty = expiredBatches.stream()
                    .mapToDouble(b -> b.getRemainingQuantity() != null ?
                            b.getRemainingQuantity().doubleValue() : 0)
                    .sum();

            double wastageRate = totalInbound > 0 ?
                    BigDecimal.valueOf(totalExpiredQty / totalInbound * 100)
                            .setScale(2, RoundingMode.HALF_UP).doubleValue() : 0;

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("总入库量（各批次汇总）", String.format("%.2f（混合单位）", totalInbound));
            result.put("过期未处理量", String.format("%.2f", totalExpiredQty));
            result.put("损耗率（估算）", String.format("%.2f%%", wastageRate));
            result.put("行业参考", "餐饮业食材损耗率建议控制在 5% 以内");
            result.put("说明", "损耗率为估算值（过期未处理批次/总入库量），精确计算需配置损耗记录模块");

            log.info("损耗率查询完成 - 损耗率: {}%", String.format("%.2f", wastageRate));
            return result;
        } catch (Exception e) {
            log.warn("损耗率查询异常: {}", e.getMessage());
            return buildSimpleResult(
                    "损耗率功能正在建设中。当前建议：每日记录食材损耗，系统将自动计算损耗率并提供优化建议。", null);
        }
    }
}
