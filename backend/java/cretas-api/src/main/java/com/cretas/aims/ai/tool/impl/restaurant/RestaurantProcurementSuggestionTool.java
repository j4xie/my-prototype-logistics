package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * 智能采购建议工具
 *
 * 基于低库存和临期食材生成采购建议。
 * 对应意图: RESTAURANT_PROCUREMENT_SUGGESTION
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantProcurementSuggestionTool extends AbstractBusinessTool {

    @Autowired
    private RawMaterialTypeRepository rawMaterialTypeRepository;

    @Autowired
    private MaterialBatchRepository materialBatchRepository;

    @Override
    public String getToolName() {
        return "restaurant_procurement_suggestion";
    }

    @Override
    public String getDescription() {
        return "智能采购建议，基于低库存和临期食材自动生成补货方案。" +
                "适用场景：采购决策、补货计划、库存优化。";
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
        log.info("执行智能采购建议 - 工厂ID: {}", factoryId);

        var lowMaterials = rawMaterialTypeRepository.findMaterialTypesWithStockWarning(factoryId);

        List<Map<String, Object>> suggestions = new ArrayList<>();

        for (var mt : lowMaterials) {
            if (mt.getMinStock() == null) continue;
            var batches = materialBatchRepository.findByFactoryId(factoryId, PageRequest.of(0, 500));
            double currentStock = batches.stream()
                    .filter(b -> b.getMaterialType() != null &&
                                 b.getMaterialType().getId().equals(mt.getId()))
                    .mapToDouble(b -> b.getRemainingQuantity() != null ?
                            b.getRemainingQuantity().doubleValue() : 0)
                    .sum();

            if (currentStock < mt.getMinStock().doubleValue() * 1.2) {
                Map<String, Object> sugg = new LinkedHashMap<>();
                sugg.put("食材", mt.getName());
                sugg.put("当前库存", String.format("%.2f", currentStock));
                sugg.put("建议采购量", String.format("%.2f", mt.getMinStock().doubleValue() * 2 - currentStock));
                sugg.put("单位", mt.getUnit() != null ? mt.getUnit() : "");
                sugg.put("优先级", currentStock <= 0 ? "紧急" : "一般");
                suggestions.add(sugg);
            }
        }

        LocalDate warningDate = LocalDate.now().plusDays(7);
        var expiringBatches = materialBatchRepository.findExpiringBatches(factoryId, warningDate);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("低库存采购建议", suggestions);
        result.put("临期食材数量", expiringBatches.size());
        if (!expiringBatches.isEmpty()) {
            result.put("临期提醒", "有 " + expiringBatches.size() + " 批食材即将到期，建议优先使用再采购。");
        }
        result.put("采购原则", List.of("优先补充库存低于阈值的食材", "临期食材先用再买", "建议每次采购满足3-5天用量"));

        log.info("智能采购建议完成 - {} 种需补货, {} 批临期", suggestions.size(), expiringBatches.size());
        return result;
    }
}
