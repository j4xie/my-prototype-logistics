package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.MaterialBatchRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;

/**
 * 损耗汇总工具
 *
 * 基于过期批次估算损耗金额。
 * 对应意图: RESTAURANT_WASTAGE_SUMMARY
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantWastageSummaryTool extends AbstractBusinessTool {

    @Autowired
    private MaterialBatchRepository materialBatchRepository;

    @Override
    public String getToolName() {
        return "restaurant_wastage_summary";
    }

    @Override
    public String getDescription() {
        return "损耗汇总查询，统计已过期且未处理的食材批次，估算损耗金额。" +
                "适用场景：损耗盘点、成本控制、库存管理评估。";
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
        log.info("执行损耗汇总查询 - 工厂ID: {}", factoryId);

        try {
            var expiredBatches = materialBatchRepository.findExpiredBatches(factoryId);

            double wastageValue = expiredBatches.stream()
                    .mapToDouble(b -> {
                        if (b.getUnitPrice() != null && b.getRemainingQuantity() != null &&
                                b.getRemainingQuantity().compareTo(BigDecimal.ZERO) > 0) {
                            return b.getUnitPrice().multiply(b.getRemainingQuantity()).doubleValue();
                        }
                        return 0;
                    }).sum();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("统计范围", "当前已过期且未处理批次");
            result.put("过期批次数", expiredBatches.size());
            result.put("估算损耗金额", String.format("¥%.2f", wastageValue));
            result.put("说明", "当前仅统计已过期的食材批次损耗。如需精细化损耗管理（报废、加工损耗等），" +
                    "请在「库存管理→损耗记录」中录入详细损耗数据。");

            log.info("损耗汇总查询完成 - 过期批次: {}, 损耗金额: ¥{}", expiredBatches.size(), String.format("%.2f", wastageValue));
            return result;
        } catch (Exception e) {
            log.warn("损耗汇总查询异常（可能是损耗记录表未建立）: {}", e.getMessage());
            return buildSimpleResult(
                    "损耗管理功能正在建设中，请先在「管理→门店进销存」中录入损耗记录。" +
                    "当前可通过「食材库存」查看过期食材情况。", null);
        }
    }
}
