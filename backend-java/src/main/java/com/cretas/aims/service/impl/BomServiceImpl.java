package com.cretas.aims.service.impl;

import com.cretas.aims.dto.bom.BomCostSummaryDTO;
import com.cretas.aims.entity.bom.BomItem;
import com.cretas.aims.entity.bom.LaborCostConfig;
import com.cretas.aims.entity.bom.OverheadCostConfig;
import com.cretas.aims.exception.EntityNotFoundException;
import com.cretas.aims.repository.bom.BomItemRepository;
import com.cretas.aims.repository.bom.LaborCostConfigRepository;
import com.cretas.aims.repository.bom.OverheadCostConfigRepository;
import com.cretas.aims.service.BomService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * BOM 成本计算服务实现
 *
 * 成本计算公式:
 * - 原料成本 = 成品含量 / 出成率 * 单价
 * - 人工成本 = 工序单价 * 操作量
 * - 均摊费用 = 单价 * 分摊量
 * - 总成本 = 原料成本 + 人工成本 + 均摊费用
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-13
 */
@Service
@RequiredArgsConstructor
public class BomServiceImpl implements BomService {

    private static final Logger log = LoggerFactory.getLogger(BomServiceImpl.class);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final BomItemRepository bomItemRepository;
    private final LaborCostConfigRepository laborCostConfigRepository;
    private final OverheadCostConfigRepository overheadCostConfigRepository;

    // ============ BOM Items ============

    @Override
    @Transactional(readOnly = true)
    public List<BomItem> getBomItemsByProduct(String factoryId, String productTypeId) {
        log.debug("获取产品BOM项目: factoryId={}, productTypeId={}", factoryId, productTypeId);
        return bomItemRepository.findByFactoryIdAndProductTypeIdAndDeletedAtIsNullOrderBySortOrderAsc(
            factoryId, productTypeId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BomItem> getAllBomItems(String factoryId) {
        log.debug("获取工厂所有BOM项目: factoryId={}", factoryId);
        return bomItemRepository.findByFactoryIdAndDeletedAtIsNullOrderByProductTypeIdAscSortOrderAsc(factoryId);
    }

    @Override
    @Transactional
    public BomItem saveBomItem(BomItem bomItem) {
        log.info("保存BOM项目: factoryId={}, productTypeId={}, materialTypeId={}",
            bomItem.getFactoryId(), bomItem.getProductTypeId(), bomItem.getMaterialTypeId());

        // 设置默认值
        if (bomItem.getYieldRate() == null) {
            bomItem.setYieldRate(new BigDecimal("100.00"));
        }
        if (bomItem.getTaxRate() == null) {
            bomItem.setTaxRate(BigDecimal.ZERO);
        }
        if (bomItem.getSortOrder() == null) {
            bomItem.setSortOrder(0);
        }

        BomItem saved = bomItemRepository.save(bomItem);
        log.info("BOM项目保存成功: id={}", saved.getId());
        return saved;
    }

    @Override
    @Transactional
    public List<BomItem> saveBomItems(List<BomItem> bomItems) {
        log.info("批量保存BOM项目: count={}", bomItems.size());
        return bomItems.stream()
            .map(this::saveBomItem)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void deleteBomItem(Long id) {
        log.info("删除BOM项目: id={}", id);
        BomItem bomItem = bomItemRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("BomItem", id.toString()));
        bomItem.softDelete();
        bomItemRepository.save(bomItem);
        log.info("BOM项目删除成功: id={}", id);
    }

    // ============ Labor Cost ============

    @Override
    @Transactional(readOnly = true)
    public List<LaborCostConfig> getLaborCostsByProduct(String factoryId, String productTypeId) {
        log.debug("获取产品人工成本配置: factoryId={}, productTypeId={}", factoryId, productTypeId);
        return laborCostConfigRepository
            .findByFactoryIdAndProductTypeIdAndIsActiveTrueAndDeletedAtIsNullOrderBySortOrderAsc(
                factoryId, productTypeId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LaborCostConfig> getGlobalLaborCosts(String factoryId) {
        log.debug("获取工厂全局人工成本配置: factoryId={}", factoryId);
        return laborCostConfigRepository
            .findByFactoryIdAndProductTypeIdIsNullAndDeletedAtIsNullOrderBySortOrderAsc(factoryId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LaborCostConfig> getAllLaborCosts(String factoryId) {
        log.debug("获取工厂所有人工成本配置: factoryId={}", factoryId);
        return laborCostConfigRepository.findByFactoryIdAndDeletedAtIsNullOrderBySortOrderAsc(factoryId);
    }

    @Override
    @Transactional
    public LaborCostConfig saveLaborCost(LaborCostConfig config) {
        log.info("保存人工成本配置: factoryId={}, processName={}",
            config.getFactoryId(), config.getProcessName());

        // 设置默认值
        if (config.getDefaultQuantity() == null) {
            config.setDefaultQuantity(BigDecimal.ONE);
        }
        if (config.getIsActive() == null) {
            config.setIsActive(true);
        }
        if (config.getSortOrder() == null) {
            config.setSortOrder(0);
        }

        LaborCostConfig saved = laborCostConfigRepository.save(config);
        log.info("人工成本配置保存成功: id={}", saved.getId());
        return saved;
    }

    @Override
    @Transactional
    public void deleteLaborCost(Long id) {
        log.info("删除人工成本配置: id={}", id);
        LaborCostConfig config = laborCostConfigRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("LaborCostConfig", id.toString()));
        config.softDelete();
        laborCostConfigRepository.save(config);
        log.info("人工成本配置删除成功: id={}", id);
    }

    // ============ Overhead Cost ============

    @Override
    @Transactional(readOnly = true)
    public List<OverheadCostConfig> getOverheadCosts(String factoryId) {
        log.debug("获取工厂均摊费用配置: factoryId={}", factoryId);
        return overheadCostConfigRepository.findByFactoryIdAndDeletedAtIsNullOrderBySortOrderAsc(factoryId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OverheadCostConfig> getActiveOverheadCosts(String factoryId) {
        log.debug("获取工厂启用的均摊费用配置: factoryId={}", factoryId);
        return overheadCostConfigRepository.findByFactoryIdAndIsActiveTrueAndDeletedAtIsNullOrderBySortOrderAsc(factoryId);
    }

    @Override
    @Transactional
    public OverheadCostConfig saveOverheadCost(OverheadCostConfig config) {
        log.info("保存均摊费用配置: factoryId={}, name={}", config.getFactoryId(), config.getName());

        // 设置默认值
        if (config.getAllocationMethod() == null) {
            config.setAllocationMethod("PER_UNIT");
        }
        if (config.getAllocationRate() == null) {
            config.setAllocationRate(BigDecimal.ONE);
        }
        if (config.getIsActive() == null) {
            config.setIsActive(true);
        }
        if (config.getSortOrder() == null) {
            config.setSortOrder(0);
        }

        OverheadCostConfig saved = overheadCostConfigRepository.save(config);
        log.info("均摊费用配置保存成功: id={}", saved.getId());
        return saved;
    }

    @Override
    @Transactional
    public void deleteOverheadCost(Long id) {
        log.info("删除均摊费用配置: id={}", id);
        OverheadCostConfig config = overheadCostConfigRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("OverheadCostConfig", id.toString()));
        config.softDelete();
        overheadCostConfigRepository.save(config);
        log.info("均摊费用配置删除成功: id={}", id);
    }

    // ============ Cost Calculation ============

    @Override
    @Transactional(readOnly = true)
    public BomCostSummaryDTO calculateProductCost(String factoryId, String productTypeId) {
        log.info("计算产品成本: factoryId={}, productTypeId={}", factoryId, productTypeId);

        // 1. 获取BOM项目
        List<BomItem> bomItems = getBomItemsByProduct(factoryId, productTypeId);

        // 2. 获取人工成本（优先产品级别，其次全局）
        List<LaborCostConfig> laborCosts = getLaborCostsByProduct(factoryId, productTypeId);
        if (laborCosts.isEmpty()) {
            laborCosts = getGlobalLaborCosts(factoryId);
        }

        // 3. 获取均摊费用
        List<OverheadCostConfig> overheadCosts = getActiveOverheadCosts(factoryId);

        // 4. 计算原辅料成本
        List<BomCostSummaryDTO.MaterialCostItem> materialCostItems = new ArrayList<>();
        BigDecimal materialCostTotal = BigDecimal.ZERO;

        for (BomItem item : bomItems) {
            BigDecimal actualQuantity = calculateActualQuantity(item.getStandardQuantity(), item.getYieldRate());
            BigDecimal subtotal = calculateMaterialCost(actualQuantity, item.getUnitPrice());

            BomCostSummaryDTO.MaterialCostItem costItem = BomCostSummaryDTO.MaterialCostItem.builder()
                .materialName(item.getMaterialName())
                .materialTypeId(item.getMaterialTypeId())
                .standardQuantity(item.getStandardQuantity())
                .yieldRate(item.getYieldRate())
                .actualQuantity(actualQuantity)
                .unit(item.getUnit())
                .unitPrice(item.getUnitPrice())
                .taxRate(item.getTaxRate())
                .subtotal(subtotal)
                .build();

            materialCostItems.add(costItem);
            materialCostTotal = materialCostTotal.add(subtotal);
        }

        // 5. 计算人工成本
        List<BomCostSummaryDTO.LaborCostItem> laborCostItems = new ArrayList<>();
        BigDecimal laborCostTotal = BigDecimal.ZERO;

        for (LaborCostConfig config : laborCosts) {
            BigDecimal subtotal = calculateLaborCost(config.getUnitPrice(), config.getDefaultQuantity());

            BomCostSummaryDTO.LaborCostItem costItem = BomCostSummaryDTO.LaborCostItem.builder()
                .processName(config.getProcessName())
                .processCategory(config.getProcessCategory())
                .unitPrice(config.getUnitPrice())
                .priceUnit(config.getPriceUnit())
                .quantity(config.getDefaultQuantity())
                .subtotal(subtotal)
                .build();

            laborCostItems.add(costItem);
            laborCostTotal = laborCostTotal.add(subtotal);
        }

        // 6. 计算均摊费用
        List<BomCostSummaryDTO.OverheadCostItem> overheadCostItems = new ArrayList<>();
        BigDecimal overheadCostTotal = BigDecimal.ZERO;

        for (OverheadCostConfig config : overheadCosts) {
            BigDecimal subtotal = calculateOverheadCost(config.getUnitPrice(), config.getAllocationRate());

            BomCostSummaryDTO.OverheadCostItem costItem = BomCostSummaryDTO.OverheadCostItem.builder()
                .name(config.getName())
                .category(config.getCategory())
                .unitPrice(config.getUnitPrice())
                .priceUnit(config.getPriceUnit())
                .allocationRate(config.getAllocationRate())
                .subtotal(subtotal)
                .build();

            overheadCostItems.add(costItem);
            overheadCostTotal = overheadCostTotal.add(subtotal);
        }

        // 7. 计算总成本
        BigDecimal totalCost = materialCostTotal
            .add(laborCostTotal)
            .add(overheadCostTotal)
            .setScale(4, RoundingMode.HALF_UP);

        // 8. 获取产品名称
        String productName = bomItems.isEmpty() ? null : bomItems.get(0).getProductName();

        // 9. 构建返回结果
        BomCostSummaryDTO summary = BomCostSummaryDTO.builder()
            .productTypeId(productTypeId)
            .productName(productName)
            .materialCosts(materialCostItems)
            .materialCostTotal(materialCostTotal.setScale(4, RoundingMode.HALF_UP))
            .laborCosts(laborCostItems)
            .laborCostTotal(laborCostTotal.setScale(4, RoundingMode.HALF_UP))
            .overheadCosts(overheadCostItems)
            .overheadCostTotal(overheadCostTotal.setScale(4, RoundingMode.HALF_UP))
            .totalCost(totalCost)
            .calculatedAt(LocalDateTime.now().format(DATE_FORMATTER))
            .build();

        log.info("产品成本计算完成: productTypeId={}, totalCost={}", productTypeId, totalCost);
        return summary;
    }

    @Override
    @Transactional(readOnly = true)
    public List<BomCostSummaryDTO> calculateProductCosts(String factoryId, List<String> productTypeIds) {
        log.info("批量计算产品成本: factoryId={}, count={}", factoryId, productTypeIds.size());
        return productTypeIds.stream()
            .map(productTypeId -> calculateProductCost(factoryId, productTypeId))
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getProductTypesWithBom(String factoryId) {
        log.debug("获取有BOM配置的产品类型: factoryId={}", factoryId);
        return bomItemRepository.findDistinctProductTypeIds(factoryId);
    }

    // ============ Private Helper Methods ============

    /**
     * 计算实际用量（考虑出成率）
     * 公式: 实际用量 = 标准用量 / (出成率 / 100)
     */
    private BigDecimal calculateActualQuantity(BigDecimal standardQuantity, BigDecimal yieldRate) {
        if (standardQuantity == null) {
            return BigDecimal.ZERO;
        }
        if (yieldRate == null || yieldRate.compareTo(BigDecimal.ZERO) == 0) {
            return standardQuantity;
        }
        return standardQuantity.divide(
            yieldRate.divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP),
            6, RoundingMode.HALF_UP
        );
    }

    /**
     * 计算原料成本
     * 公式: 成本 = 实际用量 * 单价
     */
    private BigDecimal calculateMaterialCost(BigDecimal actualQuantity, BigDecimal unitPrice) {
        if (actualQuantity == null || unitPrice == null) {
            return BigDecimal.ZERO;
        }
        return actualQuantity.multiply(unitPrice).setScale(4, RoundingMode.HALF_UP);
    }

    /**
     * 计算人工成本
     * 公式: 成本 = 单价 * 操作量
     */
    private BigDecimal calculateLaborCost(BigDecimal unitPrice, BigDecimal quantity) {
        if (unitPrice == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal qty = quantity != null ? quantity : BigDecimal.ONE;
        return unitPrice.multiply(qty).setScale(4, RoundingMode.HALF_UP);
    }

    /**
     * 计算均摊费用
     * 公式: 成本 = 单价 * 分摊比例
     */
    private BigDecimal calculateOverheadCost(BigDecimal unitPrice, BigDecimal allocationRate) {
        if (unitPrice == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal rate = allocationRate != null ? allocationRate : BigDecimal.ONE;
        return unitPrice.multiply(rate).setScale(4, RoundingMode.HALF_UP);
    }
}
