package com.cretas.aims.service;

import com.cretas.aims.entity.ProductionBatch;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 批次自动扣料服务
 *
 * <p>负责生产批次完成后的BOM自动扣料、差异调整、消耗汇总和成本计算。</p>
 *
 * @since 2026-03-18
 */
public interface BatchConsumptionService {

    /**
     * 自动扣料：根据BOM展开 + FEFO分配，创建MaterialConsumption记录并更新批次成本
     *
     * @param batch 已完成的生产批次
     */
    void autoConsumeForBatch(ProductionBatch batch);

    /**
     * 差异调整：修改某种物料的实际消耗量
     *
     * @param factoryId      工厂ID
     * @param batchId        生产批次ID
     * @param materialTypeId 物料类型ID
     * @param actualQuantity 实际消耗量
     * @param reason         调整原因
     */
    void adjustConsumption(String factoryId, Long batchId, String materialTypeId,
                           BigDecimal actualQuantity, String reason);

    /**
     * 获取批次消耗汇总（含计划vs实际、BOM达成率）
     *
     * @param factoryId 工厂ID
     * @param batchId   生产批次ID
     * @return 汇总数据
     */
    Map<String, Object> getConsumptionSummary(String factoryId, Long batchId);

    /**
     * 计算批次物料总成本
     *
     * @param batchId 生产批次ID
     * @return 总成本
     */
    BigDecimal calculateBatchMaterialCost(Long batchId);
}
