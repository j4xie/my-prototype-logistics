package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.production.CreateProductionPlanRequest;
import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.entity.*;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.mapper.ProductionPlanMapper;
import com.cretas.aims.repository.*;
import com.cretas.aims.service.ProductionPlanService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 生产计划服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
public class ProductionPlanServiceImpl implements ProductionPlanService {
    private static final Logger log = LoggerFactory.getLogger(ProductionPlanServiceImpl.class);

    private final ProductionPlanRepository productionPlanRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final MaterialConsumptionRepository materialConsumptionRepository;
    private final ProductionPlanBatchUsageRepository planBatchUsageRepository;
    private final ProductTypeRepository productTypeRepository;
    private final ProductionPlanMapper productionPlanMapper;
    private final ConversionRepository conversionRepository;

    // Manual constructor (Lombok @RequiredArgsConstructor not working)
    public ProductionPlanServiceImpl(
            ProductionPlanRepository productionPlanRepository,
            MaterialBatchRepository materialBatchRepository,
            MaterialConsumptionRepository materialConsumptionRepository,
            ProductionPlanBatchUsageRepository planBatchUsageRepository,
            ProductTypeRepository productTypeRepository,
            ProductionPlanMapper productionPlanMapper,
            ConversionRepository conversionRepository) {
        this.productionPlanRepository = productionPlanRepository;
        this.materialBatchRepository = materialBatchRepository;
        this.materialConsumptionRepository = materialConsumptionRepository;
        this.planBatchUsageRepository = planBatchUsageRepository;
        this.productTypeRepository = productTypeRepository;
        this.productionPlanMapper = productionPlanMapper;
        this.conversionRepository = conversionRepository;
    }

    @Override
    @Transactional
    public ProductionPlanDTO createProductionPlan(String factoryId, CreateProductionPlanRequest request, Long userId) {
        // 验证产品类型是否存在
        if (!productTypeRepository.existsById(request.getProductTypeId())) {
            throw new ResourceNotFoundException("产品类型不存在");
        }

        // 创建生产计划
        ProductionPlan plan = productionPlanMapper.toEntity(request, factoryId, userId.longValue());
        plan = productionPlanRepository.save(plan);

        // 如果指定了原材料批次，创建关联
        if (request.getMaterialBatchIds() != null && request.getMaterialBatchIds().length > 0) {
            assignMaterialBatchesToPlan(plan, Arrays.asList(request.getMaterialBatchIds()));
        }

        log.info("创建生产计划成功: planNumber={}", plan.getPlanNumber());
        return toDTOWithConversionInfo(plan);
    }

    @Override
    @Transactional
    public ProductionPlanDTO updateProductionPlan(String factoryId, String planId, CreateProductionPlanRequest request) {
        ProductionPlan plan = productionPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("生产计划", "id", planId));

        // 验证工厂ID
        if (!plan.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该生产计划");
        }

        // 只能更新待处理的计划
        if (plan.getStatus() != ProductionPlanStatus.PENDING) {
            throw new BusinessException("只能修改待处理的生产计划");
        }

        // 更新计划信息
        productionPlanMapper.updateEntity(plan, request);
        plan = productionPlanRepository.save(plan);

        log.info("更新生产计划成功: planId={}", planId);
        return toDTOWithConversionInfo(plan);
    }

    @Override
    @Transactional
    public void deleteProductionPlan(String factoryId, String planId) {
        ProductionPlan plan = productionPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("生产计划", "id", planId));

        // 验证工厂ID
        if (!plan.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该生产计划");
        }

        // 只能删除待处理的计划
        if (plan.getStatus() != ProductionPlanStatus.PENDING) {
            throw new BusinessException("只能删除待处理的生产计划");
        }

        productionPlanRepository.delete(plan);
        log.info("删除生产计划成功: planId={}", planId);
    }

    @Override
    @Transactional(readOnly = true)
    public ProductionPlanDTO getProductionPlanById(String factoryId, String planId) {
        ProductionPlan plan = productionPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("生产计划", "id", planId));

        // 验证工厂ID
        if (!plan.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权查看该生产计划");
        }

        return toDTOWithConversionInfo(plan);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ProductionPlanDTO> getProductionPlanList(String factoryId, PageRequest pageRequest) {
        Sort sort = Sort.by(
                pageRequest.getSortDirection().equalsIgnoreCase("DESC") ?
                Sort.Direction.DESC : Sort.Direction.ASC,
                pageRequest.getSortBy()
        );

        org.springframework.data.domain.PageRequest pageable =
            org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                sort
            );

        Page<ProductionPlan> planPage;

        // 如果指定了状态过滤
        if (pageRequest.getStatus() != null && !pageRequest.getStatus().isEmpty()) {
            try {
                ProductionPlanStatus status = ProductionPlanStatus.valueOf(pageRequest.getStatus().toUpperCase());
                planPage = productionPlanRepository.findByFactoryIdAndStatus(factoryId, status, pageable);
                log.info("按状态过滤生产计划: factoryId={}, status={}", factoryId, status);
            } catch (IllegalArgumentException e) {
                log.warn("无效的状态值: {}, 返回全部数据", pageRequest.getStatus());
                planPage = productionPlanRepository.findByFactoryId(factoryId, pageable);
            }
        } else {
            planPage = productionPlanRepository.findByFactoryId(factoryId, pageable);
        }

        List<ProductionPlanDTO> planDTOs = planPage.getContent().stream()
                .map(this::toDTOWithConversionInfo)
                .collect(Collectors.toList());

        return PageResponse.of(
                planDTOs,
                pageRequest.getPage(),
                pageRequest.getSize(),
                planPage.getTotalElements()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductionPlanDTO> getProductionPlansByStatus(String factoryId, ProductionPlanStatus status) {
        return productionPlanRepository.findByFactoryIdAndStatus(factoryId, status)
                .stream()
                .map(this::toDTOWithConversionInfo)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductionPlanDTO> getProductionPlansByDateRange(String factoryId, LocalDate startDate, LocalDate endDate) {
        // 暂时注释 - 数据库表中没有planned_date字段
        // return productionPlanRepository.findByDateRange(factoryId, startDate, endDate)
        //         .stream()
        //         .map(productionPlanMapper::toDTO)
        //         .collect(Collectors.toList());
        return new ArrayList<>();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductionPlanDTO> getTodayProductionPlans(String factoryId) {
        // 暂时注释 - 数据库表中没有planned_date字段
        // return productionPlanRepository.findTodayPlans(factoryId)
        //         .stream()
        //         .map(productionPlanMapper::toDTO)
        //         .collect(Collectors.toList());
        return new ArrayList<>();
    }

    @Override
    @Transactional
    public ProductionPlanDTO startProduction(String factoryId, String planId) {
        ProductionPlan plan = productionPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("生产计划", "id", planId));

        // 验证工厂ID
        if (!plan.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该生产计划");
        }

        // 验证状态
        if (plan.getStatus() != ProductionPlanStatus.PENDING) {
            throw new BusinessException("只能开始待处理的生产计划");
        }

        // 更新状态和开始时间
        plan.setStatus(ProductionPlanStatus.IN_PROGRESS);
        plan.setStartTime(LocalDateTime.now());
        plan = productionPlanRepository.save(plan);

        log.info("开始生产: planId={}", planId);
        return toDTOWithConversionInfo(plan);
    }

    @Override
    @Transactional
    public ProductionPlanDTO completeProduction(String factoryId, String planId, BigDecimal actualQuantity) {
        ProductionPlan plan = productionPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("生产计划", "id", planId));

        // 验证工厂ID
        if (!plan.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该生产计划");
        }

        if (plan.getStatus() != ProductionPlanStatus.IN_PROGRESS) {
            throw new BusinessException("只能完成进行中的生产计划");
        }

        // 更新状态和完成信息
        plan.setStatus(ProductionPlanStatus.COMPLETED);
        plan.setEndTime(LocalDateTime.now());
        plan.setActualQuantity(actualQuantity);
        plan = productionPlanRepository.save(plan);

        log.info("完成生产: planId={}, actualQuantity={}", planId, actualQuantity);
        return toDTOWithConversionInfo(plan);
    }

    @Override
    @Transactional
    public void cancelProductionPlan(String factoryId, String planId, String reason) {
        ProductionPlan plan = productionPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("生产计划", "id", planId));

        // 验证工厂ID
        if (!plan.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该生产计划");
        }

        // 已完成的计划不能取消
        if (plan.getStatus() == ProductionPlanStatus.COMPLETED) {
            throw new BusinessException("已完成的生产计划不能取消");
        }

        // 更新状态
        plan.setStatus(ProductionPlanStatus.CANCELLED);
        plan.setNotes(plan.getNotes() != null ?
            plan.getNotes() + "\n取消原因：" + reason :
            "取消原因：" + reason);
        productionPlanRepository.save(plan);

        log.info("取消生产计划: planId={}, reason={}", planId, reason);
    }

    @Override
    @Transactional
    public ProductionPlanDTO pauseProduction(String factoryId, String planId) {
        ProductionPlan plan = productionPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("生产计划", "id", planId));

        // 验证工厂ID
        if (!plan.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该生产计划");
        }

        // 只能暂停进行中的计划
        if (plan.getStatus() != ProductionPlanStatus.IN_PROGRESS) {
            throw new BusinessException("只能暂停进行中的生产计划");
        }

        plan.setStatus(ProductionPlanStatus.PAUSED);
        plan = productionPlanRepository.save(plan);

        log.info("暂停生产: planId={}", planId);
        return toDTOWithConversionInfo(plan);
    }

    @Override
    @Transactional
    public ProductionPlanDTO resumeProduction(String factoryId, String planId) {
        ProductionPlan plan = productionPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("生产计划", "id", planId));

        // 验证工厂ID
        if (!plan.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该生产计划");
        }

        // 只能恢复暂停的计划
        if (plan.getStatus() != ProductionPlanStatus.PAUSED) {
            throw new BusinessException("只能恢复暂停的生产计划");
        }

        plan.setStatus(ProductionPlanStatus.IN_PROGRESS);
        plan = productionPlanRepository.save(plan);

        log.info("恢复生产: planId={}", planId);
        return toDTOWithConversionInfo(plan);
    }

    @Override
    @Transactional
    public ProductionPlanDTO updateActualCosts(String factoryId, String planId,
                                               BigDecimal materialCost,
                                               BigDecimal laborCost,
                                               BigDecimal equipmentCost,
                                               BigDecimal otherCost) {
        ProductionPlan plan = productionPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("生产计划", "id", planId));

        // 验证工厂ID
        if (!plan.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该生产计划");
        }

        // 更新实际成本
        if (materialCost != null) {
            plan.setActualMaterialCost(materialCost);
        }
        if (laborCost != null) {
            plan.setActualLaborCost(laborCost);
        }
        if (equipmentCost != null) {
            plan.setActualEquipmentCost(equipmentCost);
        }
        if (otherCost != null) {
            plan.setActualOtherCost(otherCost);
        }

        plan = productionPlanRepository.save(plan);

        log.info("更新实际成本: planId={}", planId);
        return toDTOWithConversionInfo(plan);
    }

    @Override
    @Transactional
    public void assignMaterialBatches(String factoryId, String planId, List<String> batchIds) {
        ProductionPlan plan = productionPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("生产计划", "id", planId));

        // 验证工厂ID
        if (!plan.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该生产计划");
        }

        assignMaterialBatchesToPlan(plan, batchIds);
        log.info("分配原材料批次: planId={}, batchCount={}", planId, batchIds.size());
    }

    @Override
    @Transactional
    public void recordMaterialConsumption(String factoryId, String planId, String batchId, BigDecimal quantity) {
        ProductionPlan plan = productionPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("生产计划", "id", planId));

        // 验证工厂ID
        if (!plan.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该生产计划");
        }

        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 检查库存是否足够
        if (batch.getCurrentQuantity().compareTo(quantity) < 0) {
            throw new BusinessException("批次库存不足");
        }

        // 创建消耗记录
        MaterialConsumption consumption = new MaterialConsumption();
        consumption.setFactoryId(factoryId);
        consumption.setProductionPlanId(planId);
        consumption.setBatchId(batchId);
        consumption.setQuantity(quantity);
        consumption.setUnitPrice(batch.getUnitPrice());
        consumption.setTotalCost(quantity.multiply(batch.getUnitPrice()));
        consumption.setConsumptionTime(LocalDateTime.now());
        consumption.setRecordedBy(plan.getCreatedBy());
        materialConsumptionRepository.save(consumption);

        // 更新批次库存
        // 注意: currentQuantity 是计算属性，通过增加 usedQuantity 来减少 currentQuantity
        batch.setUsedQuantity(batch.getUsedQuantity().add(quantity));
        batch.setLastUsedAt(LocalDateTime.now());
        if (batch.getCurrentQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            batch.setStatus(MaterialBatchStatus.USED_UP);
        }
        materialBatchRepository.save(batch);

        log.info("记录材料消耗: planId={}, batchId={}, quantity={}", planId, batchId, quantity);
    }

    @Override
    public Map<String, Object> getProductionStatistics(String factoryId, LocalDate startDate, LocalDate endDate) {
        // 暂时注释 - 数据库表中没有planned_date字段
        // List<ProductionPlan> plans = productionPlanRepository.findByDateRange(factoryId, startDate, endDate);
        List<ProductionPlan> plans = new ArrayList<>();

        Map<String, Object> statistics = new HashMap<>();
        statistics.put("totalPlans", plans.size());
        statistics.put("completedPlans", plans.stream().filter(p -> p.getStatus() == ProductionPlanStatus.COMPLETED).count());
        statistics.put("inProgressPlans", plans.stream().filter(p -> p.getStatus() == ProductionPlanStatus.IN_PROGRESS).count());
        statistics.put("pendingPlans", plans.stream().filter(p -> p.getStatus() == ProductionPlanStatus.PENDING).count());

        // 计算总成本
        BigDecimal totalCost = plans.stream()
                .filter(p -> p.getStatus() == ProductionPlanStatus.COMPLETED)
                .map(p -> {
                    BigDecimal cost = BigDecimal.ZERO;
                    if (p.getActualMaterialCost() != null) cost = cost.add(p.getActualMaterialCost());
                    if (p.getActualLaborCost() != null) cost = cost.add(p.getActualLaborCost());
                    if (p.getActualEquipmentCost() != null) cost = cost.add(p.getActualEquipmentCost());
                    if (p.getActualOtherCost() != null) cost = cost.add(p.getActualOtherCost());
                    return cost;
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        statistics.put("totalCost", totalCost);

        return statistics;
    }

    @Override
    public List<ProductionPlanDTO> getPendingPlansToExecute(String factoryId) {
        // 暂时注释 - 数据库表中没有planned_date字段
        // return productionPlanRepository.findPendingPlansToExecute(factoryId)
        //         .stream()
        //         .map(productionPlanMapper::toDTO)
        //         .collect(Collectors.toList());
        return new ArrayList<>();
    }

    @Override
    @Transactional
    public List<ProductionPlanDTO> batchCreateProductionPlans(String factoryId,
                                                              List<CreateProductionPlanRequest> requests,
                                                              Long userId) {
        return requests.stream()
                .map(request -> createProductionPlan(factoryId, request, userId))
                .collect(Collectors.toList());
    }

    @Override
    public byte[] exportProductionPlans(String factoryId, LocalDate startDate, LocalDate endDate) {
        // TODO: 实现导出功能
        throw new UnsupportedOperationException("导出功能暂未实现");
    }

    /**
     * 分配原材料批次到生产计划
     */
    private void assignMaterialBatchesToPlan(ProductionPlan plan, List<String> batchIds) {
        for (String batchId : batchIds) {
            MaterialBatch batch = materialBatchRepository.findById(batchId)
                    .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

            // 检查批次状态
            if (batch.getStatus() != MaterialBatchStatus.AVAILABLE) {
                throw new BusinessException("批次 " + batch.getBatchNumber() + " 不可用");
            }

            // 创建关联
            ProductionPlanBatchUsage usage = new ProductionPlanBatchUsage();
            usage.setProductionPlanId(plan.getId());
            usage.setMaterialBatchId(batchId);
            usage.setPlannedQuantity(BigDecimal.ZERO); // 需要根据实际需求设置
            planBatchUsageRepository.save(usage);
        }
    }

    /**
     * 将计划实体转换为DTO并填充转换率信息
     */
    private ProductionPlanDTO toDTOWithConversionInfo(ProductionPlan plan) {
        ProductionPlanDTO dto = productionPlanMapper.toDTO(plan);
        enrichWithConversionRateInfo(dto, plan.getFactoryId(), plan.getProductTypeId());
        return dto;
    }

    /**
     * 填充转换率配置状态到DTO
     * 检查该产品类型是否有配置转换率
     */
    private void enrichWithConversionRateInfo(ProductionPlanDTO dto, String factoryId, String productTypeId) {
        if (factoryId == null || productTypeId == null) {
            dto.setConversionRateConfigured(false);
            return;
        }

        // 查询该产品类型的所有转换率配置
        List<MaterialProductConversion> conversions =
            conversionRepository.findByFactoryIdAndProductTypeId(factoryId, productTypeId);

        if (conversions != null && !conversions.isEmpty()) {
            // 有转换率配置
            dto.setConversionRateConfigured(true);

            // 如果只有一个配置，直接返回该转换率和损耗率
            // 如果有多个配置（多种原材料），返回第一个作为示例（前端可以点击查看详情）
            MaterialProductConversion firstConversion = conversions.get(0);
            dto.setConversionRate(firstConversion.getConversionRate());
            dto.setWastageRate(firstConversion.getWastageRate());

            log.debug("产品类型 {} 已配置转换率: {} 个配置", productTypeId, conversions.size());
        } else {
            // 没有转换率配置
            dto.setConversionRateConfigured(false);
            dto.setConversionRate(null);
            dto.setWastageRate(null);

            log.debug("产品类型 {} 未配置转换率", productTypeId);
        }
    }
}
