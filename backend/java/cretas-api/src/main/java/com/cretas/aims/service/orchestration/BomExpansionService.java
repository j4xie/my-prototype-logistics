package com.cretas.aims.service.orchestration;

import com.cretas.aims.dto.orchestration.MaterialAllocation;
import com.cretas.aims.dto.orchestration.MaterialCheckResult;
import com.cretas.aims.dto.orchestration.MaterialRequirement;
import com.cretas.aims.dto.orchestration.MaterialShortfall;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.MaterialProductConversion;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.repository.ConversionRepository;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.ProductionPlanRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * BOM展开服务
 *
 * <p>负责根据生产计划中的产品类型和生产数量，展开所需原辅料清单（BOM展开），
 * 并校验当前库存是否满足需求，同时按FEFO策略输出批次分配方案。</p>
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Service
@RequiredArgsConstructor
public class BomExpansionService {

    private static final Logger log = LoggerFactory.getLogger(BomExpansionService.class);

    private final ConversionRepository conversionRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final ProductionPlanRepository productionPlanRepository;

    /**
     * BOM展开：根据产品类型和生产数量，计算所有需要的原辅料（含损耗）。
     *
     * @param factoryId         工厂ID
     * @param productTypeId     产品类型ID
     * @param productionQuantity 计划生产数量
     * @return 原辅料需求清单（含损耗率换算后的总需求量）
     */
    @Transactional(readOnly = true)
    public List<MaterialRequirement> expandBOM(String factoryId,
                                               String productTypeId,
                                               BigDecimal productionQuantity) {
        List<MaterialProductConversion> conversions =
                conversionRepository.findByFactoryIdAndProductTypeId(factoryId, productTypeId);

        List<MaterialRequirement> requirements = new ArrayList<>();
        for (MaterialProductConversion conv : conversions) {
            if (!Boolean.TRUE.equals(conv.getIsActive())) {
                continue;
            }

            BigDecimal required = conv.calculateActualUsage(productionQuantity);

            MaterialRequirement req = new MaterialRequirement();
            req.setMaterialTypeId(conv.getMaterialTypeId());
            req.setMaterialTypeName(
                    conv.getMaterialType() != null
                            ? conv.getMaterialType().getName()
                            : conv.getMaterialTypeId()
            );
            req.setRequiredQuantity(required);
            req.setWastageRate(conv.getWastageRate());
            requirements.add(req);
        }

        log.info("BOM展开: factoryId={}, productType={}, quantity={}, 需要原料种类={}",
                factoryId, productTypeId, productionQuantity, requirements.size());
        return requirements;
    }

    /**
     * 检查原辅料库存是否满足BOM需求。
     *
     * <p>对每种原辅料，按FEFO策略（先到期先出）检查可用库存。
     * 库存充足时，生成批次分配方案；不足时，记录短缺信息。</p>
     *
     * @param factoryId    工厂ID
     * @param requirements BOM展开后的原辅料需求清单
     * @return 检查结果，含"是否全部满足"标志、短缺列表、批次分配方案
     */
    @Transactional(readOnly = true)
    public MaterialCheckResult checkMaterialAvailability(String factoryId,
                                                         List<MaterialRequirement> requirements) {
        boolean allSatisfied = true;
        List<MaterialShortfall> shortfalls = new ArrayList<>();
        List<MaterialAllocation> allocations = new ArrayList<>();

        for (MaterialRequirement req : requirements) {
            // 使用FEFO策略获取可用批次（按到期日升序）
            List<MaterialBatch> batches =
                    materialBatchRepository.findAvailableBatchesFEFO(factoryId, req.getMaterialTypeId());

            // 汇总可用数量
            BigDecimal totalAvailable = batches.stream()
                    .map(b -> b.getReceiptQuantity()
                            .subtract(b.getUsedQuantity() != null ? b.getUsedQuantity() : BigDecimal.ZERO)
                            .subtract(b.getReservedQuantity() != null ? b.getReservedQuantity() : BigDecimal.ZERO))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            if (totalAvailable.compareTo(req.getRequiredQuantity()) < 0) {
                // 库存不足，记录短缺
                allSatisfied = false;

                MaterialShortfall sf = new MaterialShortfall();
                sf.setMaterialTypeId(req.getMaterialTypeId());
                sf.setMaterialTypeName(req.getMaterialTypeName());
                sf.setRequiredQuantity(req.getRequiredQuantity());
                sf.setAvailableQuantity(totalAvailable);
                sf.setShortfallQuantity(req.getRequiredQuantity().subtract(totalAvailable));
                shortfalls.add(sf);
            } else {
                // 库存充足，按FEFO逐批次分配
                BigDecimal remaining = req.getRequiredQuantity();
                for (MaterialBatch batch : batches) {
                    if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
                        break;
                    }

                    BigDecimal available = batch.getReceiptQuantity()
                            .subtract(batch.getUsedQuantity() != null ? batch.getUsedQuantity() : BigDecimal.ZERO)
                            .subtract(batch.getReservedQuantity() != null ? batch.getReservedQuantity() : BigDecimal.ZERO);

                    BigDecimal alloc = remaining.min(available);

                    MaterialAllocation allocation = new MaterialAllocation();
                    allocation.setMaterialTypeId(req.getMaterialTypeId());
                    allocation.setMaterialBatchId(batch.getId());
                    allocation.setBatchNumber(batch.getBatchNumber());
                    allocation.setAllocatedQuantity(alloc);
                    allocations.add(allocation);

                    remaining = remaining.subtract(alloc);
                }
            }
        }

        MaterialCheckResult result = new MaterialCheckResult();
        result.setAllSatisfied(allSatisfied);
        result.setShortfalls(shortfalls);
        result.setAllocations(allocations);

        log.info("原辅料检查: factoryId={}, 全部满足={}, 短缺种类={}, 分配批次数={}",
                factoryId, allSatisfied, shortfalls.size(), allocations.size());
        return result;
    }

    /**
     * 针对待排产的生产计划，重新检查其原辅料库存是否已到位。
     *
     * <p>通常在新原料入库（MaterialReceivedEvent）后触发，用于唤醒等待中的生产计划。</p>
     *
     * @param plan 待检查的生产计划
     * @return true 表示原辅料已全部到位，可以开始排产；false 表示仍有短缺
     */
    @Transactional(readOnly = true)
    public boolean recheckAvailability(ProductionPlan plan) {
        List<MaterialRequirement> requirements = expandBOM(
                plan.getFactoryId(),
                plan.getProductTypeId(),
                plan.getPlannedQuantity()
        );
        MaterialCheckResult result = checkMaterialAvailability(plan.getFactoryId(), requirements);
        log.info("生产计划复检: planId={}, allSatisfied={}", plan.getId(), result.isAllSatisfied());
        return result.isAllSatisfied();
    }
}
