package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.material.ConvertToFrozenRequest;
import com.cretas.aims.dto.material.UndoFrozenRequest;
import com.cretas.aims.dto.material.CreateMaterialBatchRequest;
import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.MaterialBatchAdjustment;
import com.cretas.aims.entity.MaterialConsumption;
import com.cretas.aims.entity.ProductionPlanBatchUsage;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.mapper.MaterialBatchMapper;
import com.cretas.aims.repository.MaterialBatchAdjustmentRepository;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.MaterialConsumptionRepository;
import com.cretas.aims.repository.ProductionPlanBatchUsageRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.service.MaterialBatchService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 原材料批次服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
public class MaterialBatchServiceImpl implements MaterialBatchService {
    private static final Logger log = LoggerFactory.getLogger(MaterialBatchServiceImpl.class);

    private final MaterialBatchRepository materialBatchRepository;
    private final MaterialBatchAdjustmentRepository materialBatchAdjustmentRepository;
    private final RawMaterialTypeRepository materialTypeRepository;
    private final MaterialBatchMapper materialBatchMapper;
    private final MaterialConsumptionRepository materialConsumptionRepository;
    private final ProductionPlanBatchUsageRepository productionPlanBatchUsageRepository;

    // Manual constructor (Lombok @RequiredArgsConstructor not working)
    public MaterialBatchServiceImpl(
            MaterialBatchRepository materialBatchRepository,
            MaterialBatchAdjustmentRepository materialBatchAdjustmentRepository,
            RawMaterialTypeRepository materialTypeRepository,
            MaterialBatchMapper materialBatchMapper,
            MaterialConsumptionRepository materialConsumptionRepository,
            ProductionPlanBatchUsageRepository productionPlanBatchUsageRepository) {
        this.materialBatchRepository = materialBatchRepository;
        this.materialBatchAdjustmentRepository = materialBatchAdjustmentRepository;
        this.materialTypeRepository = materialTypeRepository;
        this.materialBatchMapper = materialBatchMapper;
        this.materialConsumptionRepository = materialConsumptionRepository;
        this.productionPlanBatchUsageRepository = productionPlanBatchUsageRepository;
    }

    @Override
    @Transactional
    public MaterialBatchDTO createMaterialBatch(String factoryId, CreateMaterialBatchRequest request, Integer userId) {
        // 验证并获取原材料类型
        var materialType = materialTypeRepository.findById(request.getMaterialTypeId())
            .orElseThrow(() -> new ResourceNotFoundException("原材料类型不存在"));

        // 创建批次
        MaterialBatch batch = materialBatchMapper.toEntity(request, factoryId, userId);
        // 生成UUID作为ID
        batch.setId(java.util.UUID.randomUUID().toString());

        // 自动计算到期日期（如果未提供）
        if (batch.getExpireDate() == null && materialType.getShelfLifeDays() != null) {
            LocalDate expireDate = request.getReceiptDate().plusDays(materialType.getShelfLifeDays());
            batch.setExpireDate(expireDate);
            log.info("自动计算到期日期: receiptDate={}, shelfLifeDays={}, expireDate={}",
                request.getReceiptDate(), materialType.getShelfLifeDays(), expireDate);
        }

        // 生成唯一批次号
        String batchNumber = generateUniqueBatchNumber(batch.getBatchNumber());
        batch.setBatchNumber(batchNumber);
        batch = materialBatchRepository.save(batch);
        log.info("创建原材料批次成功: batchNumber={}", batch.getBatchNumber());
        return materialBatchMapper.toDTO(batch);
    }

    @Override
    @Transactional
    public MaterialBatchDTO updateMaterialBatch(String factoryId, String batchId, CreateMaterialBatchRequest request) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        // 只能更新可用状态的批次
        if (batch.getStatus() != MaterialBatchStatus.AVAILABLE) {
            throw new BusinessException("只能修改可用状态的批次");
        }

        // 更新批次信息
        materialBatchMapper.updateEntity(batch, request);
        batch = materialBatchRepository.save(batch);
        log.info("更新原材料批次成功: batchId={}", batchId);
        return materialBatchMapper.toDTO(batch);
    }

    @Override
    @Transactional
    public void deleteMaterialBatch(String factoryId, String batchId) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        // 只能删除未使用的批次
        if (!batch.getCurrentQuantity().equals(batch.getReceiptQuantity())) {
            throw new BusinessException("已使用的批次不能删除");
        }

        materialBatchRepository.delete(batch);
        log.info("删除原材料批次成功: batchId={}", batchId);
    }

    @Override
    public MaterialBatchDTO getMaterialBatchById(String factoryId, String batchId) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权查看该批次");
        }

        return materialBatchMapper.toDTO(batch);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<MaterialBatchDTO> getMaterialBatchList(String factoryId, PageRequest pageRequest) {
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

        Page<MaterialBatch> batchPage = materialBatchRepository.findByFactoryId(factoryId, pageable);
        List<MaterialBatchDTO> batchDTOs = batchPage.getContent().stream()
                .map(materialBatchMapper::toDTO)
                .collect(Collectors.toList());

        return PageResponse.of(
                batchDTOs,
                pageRequest.getPage(),
                pageRequest.getSize(),
                batchPage.getTotalElements()
        );
    }

    @Override
    public List<MaterialBatchDTO> getMaterialBatchesByStatus(String factoryId, MaterialBatchStatus status) {
        return materialBatchRepository.findByFactoryIdAndStatus(factoryId, status)
                .stream()
                .map(materialBatchMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<MaterialBatchDTO> getAvailableBatchesFIFO(String factoryId, String materialTypeId) {
        List<MaterialBatch> batches = materialBatchRepository.findAvailableBatchesFIFO(factoryId, materialTypeId);
        return batches.stream()
                .map(materialBatchMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<MaterialBatchDTO> getExpiringBatches(String factoryId, Integer warningDays) {
        LocalDate warningDate = LocalDate.now().plusDays(warningDays);
        List<MaterialBatch> batches = materialBatchRepository.findExpiringBatches(factoryId, warningDate);
        return batches.stream()
                .map(materialBatchMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<MaterialBatchDTO> getExpiredBatches(String factoryId) {
        List<MaterialBatch> batches = materialBatchRepository.findExpiredBatches(factoryId);
        return batches.stream()
                .map(materialBatchMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<MaterialBatchDTO> getMaterialBatchesBySupplier(String factoryId, String supplierId) {
        List<MaterialBatch> batches = materialBatchRepository.findByFactoryIdAndSupplierId(factoryId, supplierId);
        return batches.stream()
                .map(materialBatchMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public MaterialBatchDTO adjustBatchQuantity(String factoryId, String batchId, BigDecimal adjustmentQuantity, String reason) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        // 计算新数量
        BigDecimal newQuantity = batch.getCurrentQuantity().add(adjustmentQuantity);
        if (newQuantity.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("调整后数量不能为负数");
        }

        // 记录调整
        MaterialBatchAdjustment adjustment = new MaterialBatchAdjustment();
        adjustment.setBatchId(batchId);
        adjustment.setAdjustmentType(adjustmentQuantity.compareTo(BigDecimal.ZERO) > 0 ? "increase" : "decrease");
        adjustment.setQuantityBefore(batch.getCurrentQuantity());
        adjustment.setAdjustmentQuantity(adjustmentQuantity.abs());
        adjustment.setQuantityAfter(newQuantity);
        adjustment.setReason(reason);
        adjustment.setAdjustmentTime(LocalDateTime.now());
        adjustment.setAdjustedBy(1); // TODO: 从上下文获取用户ID
        materialBatchAdjustmentRepository.save(adjustment);

        // 更新批次数量
        // 注意: currentQuantity 现在是计算属性 (receiptQuantity - usedQuantity - reservedQuantity)
        // 要调整可用数量，需要调整 receiptQuantity
        BigDecimal qtyAdjustment = newQuantity.subtract(batch.getCurrentQuantity());
        batch.setReceiptQuantity(batch.getReceiptQuantity().add(qtyAdjustment));

        if (newQuantity.compareTo(BigDecimal.ZERO) == 0) {
            batch.setStatus(MaterialBatchStatus.USED_UP);
        }

        batch = materialBatchRepository.save(batch);
        log.info("调整批次数量: batchId={}, adjustment={}, reason={}", batchId, adjustmentQuantity, reason);
        return materialBatchMapper.toDTO(batch);
    }

    @Override
    @Transactional
    public void markBatchAsExpired(String factoryId, String batchId) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        batch.setStatus(MaterialBatchStatus.EXPIRED);
        materialBatchRepository.save(batch);
        log.info("标记批次过期: batchId={}", batchId);
    }

    @Override
    @Transactional
    public void markBatchAsUsedUp(String factoryId, String batchId) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        batch.setStatus(MaterialBatchStatus.USED_UP);
        // 注意: currentQuantity 是计算属性，不能直接设置
        // 标记为用完：设置 usedQuantity = receiptQuantity - reservedQuantity
        batch.setUsedQuantity(batch.getReceiptQuantity().subtract(batch.getReservedQuantity()));
        materialBatchRepository.save(batch);
        log.info("标记批次用完: batchId={}", batchId);
    }

    @Override
    @Transactional
    public void reserveBatchQuantity(String factoryId, String batchId, BigDecimal quantity) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        // 检查可用数量
        if (batch.getCurrentQuantity().compareTo(quantity) < 0) {
            throw new BusinessException("批次可用数量不足");
        }

        // 预留数量（这里简化处理，实际可能需要额外的预留字段）
        materialBatchRepository.save(batch);
        log.info("预留批次数量: batchId={}, quantity={}", batchId, quantity);
    }

    @Override
    @Transactional
    public void releaseBatchQuantity(String factoryId, String batchId, BigDecimal quantity) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        // 释放预留数量
        materialBatchRepository.save(batch);
        log.info("释放批次预留: batchId={}, quantity={}", batchId, quantity);
    }

    @Override
    @Transactional
    public void useBatchQuantity(String factoryId, String batchId, BigDecimal quantity) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        // 使用数量
        // 注意: currentQuantity 是计算属性，通过增加 usedQuantity 来减少 currentQuantity
        batch.setUsedQuantity(batch.getUsedQuantity().add(quantity));
        batch.setLastUsedAt(LocalDateTime.now());

        if (batch.getCurrentQuantity().compareTo(BigDecimal.ZERO) == 0) {
            batch.setStatus(MaterialBatchStatus.USED_UP);
        }

        materialBatchRepository.save(batch);
        log.info("使用批次数量: batchId={}, quantity={}", batchId, quantity);
    }

    @Override
    public BigDecimal calculateInventoryValue(String factoryId) {
        BigDecimal value = materialBatchRepository.calculateInventoryValue(factoryId);
        return value != null ? value : BigDecimal.ZERO;
    }

    @Override
    public Map<String, BigDecimal> getInventoryByMaterialType(String factoryId) {
        List<Object[]> results = materialBatchRepository.sumQuantityByMaterialType(factoryId);
        Map<String, BigDecimal> inventory = new HashMap<>();

        for (Object[] result : results) {
            String materialTypeId = (String) result[0];
            BigDecimal quantity = (BigDecimal) result[1];
            // TODO: 获取原材料类型名称
            inventory.put("MaterialType-" + materialTypeId, quantity);
        }

        return inventory;
    }

    @Override
    public List<Map<String, Object>> getLowStockWarnings(String factoryId) {
        // TODO: 实现低库存预警
        return new ArrayList<>();
    }

    @Override
    @Transactional
    public List<MaterialBatchDTO> batchCreateMaterialBatches(String factoryId, List<CreateMaterialBatchRequest> requests, Integer userId) {
        return requests.stream()
                .map(request -> createMaterialBatch(factoryId, request, userId))
                .collect(Collectors.toList());
    }

    @Override
    public byte[] exportInventoryReport(String factoryId) {
        // TODO: 实现库存报表导出
        throw new UnsupportedOperationException("库存报表导出功能暂未实现");
    }

    @Override
    public List<Map<String, Object>> getBatchUsageHistory(String factoryId, String batchId) {
        // TODO: 从消耗记录和调整记录中获取使用历史
        return new ArrayList<>();
    }

    @Override
    public boolean checkBatchNumberExists(String batchNumber) {
        return materialBatchRepository.existsByBatchNumber(batchNumber);
    }

    @Override
    @Scheduled(cron = "0 0 2 * * ?") // 每天凌晨2点执行
    public void autoCheckAndUpdateExpiredBatches() {
        log.info("开始自动检查过期批次");

        // 查找所有工厂的过期批次
        List<MaterialBatch> expiredBatches = materialBatchRepository.findAll().stream()
                .filter(batch -> batch.getStatus() == MaterialBatchStatus.AVAILABLE)
                .filter(batch -> batch.getExpireDate() != null)
                .filter(batch -> batch.getExpireDate().isBefore(LocalDate.now()))
                .collect(Collectors.toList());

        for (MaterialBatch batch : expiredBatches) {
            batch.setStatus(MaterialBatchStatus.EXPIRED);
            materialBatchRepository.save(batch);
            log.info("自动标记批次过期: batchNumber={}", batch.getBatchNumber());
        }

        log.info("完成自动检查过期批次，共处理 {} 个批次", expiredBatches.size());
    }

    @Override
    public byte[] exportInventoryReport(String factoryId, LocalDate startDate, LocalDate endDate) {
        // TODO: 实现带日期范围的库存报表导出
        throw new UnsupportedOperationException("库存报表导出功能待实现");
    }

    @Override
    public List<MaterialBatchDTO> getMaterialBatchesByType(String factoryId, String materialTypeId) {
        List<MaterialBatch> batches = materialBatchRepository.findByFactoryIdAndMaterialTypeId(factoryId, materialTypeId);
        return batches.stream()
                .map(materialBatchMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<MaterialBatchDTO> getFIFOBatches(String factoryId, String materialTypeId, BigDecimal requiredQuantity) {
        List<MaterialBatch> availableBatches = materialBatchRepository.findAvailableBatchesFIFOByStatus(
                factoryId, materialTypeId, MaterialBatchStatus.AVAILABLE);

        List<MaterialBatchDTO> result = new ArrayList<>();
        BigDecimal totalQuantity = BigDecimal.ZERO;

        for (MaterialBatch batch : availableBatches) {
            if (totalQuantity.compareTo(requiredQuantity) >= 0) {
                break;
            }
            result.add(materialBatchMapper.toDTO(batch));
            totalQuantity = totalQuantity.add(batch.getRemainingQuantity());
        }

        return result;
    }

    @Override
    @Transactional
    public MaterialBatchDTO useBatchMaterial(String factoryId, String batchId, BigDecimal quantity, String productionPlanId) {
        MaterialBatch batch = materialBatchRepository.findByIdAndFactoryId(batchId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次不存在"));

        if (batch.getRemainingQuantity().compareTo(quantity) < 0) {
            throw new BusinessException("批次剩余数量不足");
        }

        // 更新已使用数量 (remainingQuantity 会自动重新计算)
        batch.setUsedQuantity(batch.getUsedQuantity().add(quantity));
        batch.setLastUsedAt(LocalDateTime.now());

        // 如果用完了，更新状态
        // 注意: getRemainingQuantity() 现在是计算属性
        if (batch.getRemainingQuantity().compareTo(BigDecimal.ZERO) == 0) {
            batch.setStatus(MaterialBatchStatus.USED_UP);
        }

        // 记录消耗（如果提供了生产计划ID）
        if (productionPlanId != null) {
            MaterialConsumption consumption = new MaterialConsumption();
            consumption.setFactoryId(factoryId);
            consumption.setProductionPlanId(productionPlanId);
            consumption.setBatchId(batchId);
            consumption.setQuantity(quantity);
            consumption.setConsumptionTime(LocalDateTime.now());
            materialConsumptionRepository.save(consumption);
        }

        return materialBatchMapper.toDTO(materialBatchRepository.save(batch));
    }

    @Override
    @Transactional
    public MaterialBatchDTO adjustBatchQuantity(String factoryId, String batchId, BigDecimal newQuantity,
                                                String reason, Integer adjustedBy) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        BigDecimal oldQuantity = batch.getRemainingQuantity();
        BigDecimal adjustment = newQuantity.subtract(oldQuantity);

        // 注意: remainingQuantity 和 totalQuantity 都是计算属性
        // 要调整剩余数量，需要调整 receiptQuantity
        batch.setReceiptQuantity(batch.getReceiptQuantity().add(adjustment));

        // 记录调整
        MaterialBatchAdjustment adjustmentRecord = new MaterialBatchAdjustment();
        adjustmentRecord.setBatchId(batchId);
        adjustmentRecord.setAdjustmentType(adjustment.compareTo(BigDecimal.ZERO) > 0 ? "INCREASE" : "DECREASE");
        adjustmentRecord.setQuantityBefore(oldQuantity);
        adjustmentRecord.setQuantityAfter(newQuantity);
        adjustmentRecord.setAdjustmentQuantity(adjustment.abs());
        adjustmentRecord.setReason(reason);
        adjustmentRecord.setAdjustedBy(adjustedBy);
        adjustmentRecord.setAdjustmentTime(LocalDateTime.now());
        materialBatchAdjustmentRepository.save(adjustmentRecord);

        batch = materialBatchRepository.save(batch);
        return materialBatchMapper.toDTO(batch);
    }

    @Override
    @Transactional
    public MaterialBatchDTO updateBatchStatus(String factoryId, String batchId, MaterialBatchStatus status) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        batch.setStatus(status);
        batch = materialBatchRepository.save(batch);
        return materialBatchMapper.toDTO(batch);
    }

    @Override
    @Transactional
    public void reserveBatchMaterial(String factoryId, String batchId, BigDecimal quantity, String productionPlanId) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        if (batch.getRemainingQuantity().compareTo(quantity) < 0) {
            throw new BusinessException("批次剩余数量不足以预留");
        }

        // 更新预留数量 (remainingQuantity 会自动重新计算)
        batch.setReservedQuantity(batch.getReservedQuantity().add(quantity));

        // 如果剩余量为0，更新状态为DEPLETED
        // 注意: getRemainingQuantity() 现在是计算属性
        if (batch.getRemainingQuantity().compareTo(BigDecimal.ZERO) == 0) {
            batch.setStatus(MaterialBatchStatus.DEPLETED);
        }

        materialBatchRepository.save(batch);
        log.info("预留批次材料成功: batchId={}, quantity={}, remainingAfter={}, reservedTotal={}",
                batchId, quantity, batch.getRemainingQuantity(), batch.getReservedQuantity());

        // 记录批次使用关联
        ProductionPlanBatchUsage usage = new ProductionPlanBatchUsage();
        usage.setProductionPlanId(productionPlanId);
        usage.setBatchId(batchId);
        usage.setReservedQuantity(quantity);
        usage.setUsedQuantity(BigDecimal.ZERO);
        productionPlanBatchUsageRepository.save(usage);
    }

    @Override
    @Transactional
    public void releaseBatchReservation(String factoryId, String batchId, BigDecimal quantity, String productionPlanId) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        // 验证预留数量是否充足
        if (batch.getReservedQuantity().compareTo(quantity) < 0) {
            throw new BusinessException("预留数量不足以释放");
        }

        // 释放预留数量 (remainingQuantity 会自动增加)
        batch.setReservedQuantity(batch.getReservedQuantity().subtract(quantity));

        // 如果之前是DEPLETED状态，恢复为AVAILABLE
        // 注意: getRemainingQuantity() 现在是计算属性
        if (batch.getStatus() == MaterialBatchStatus.DEPLETED &&
            batch.getRemainingQuantity().compareTo(BigDecimal.ZERO) > 0) {
            batch.setStatus(MaterialBatchStatus.AVAILABLE);
        }

        materialBatchRepository.save(batch);
        log.info("释放预留材料成功: batchId={}, quantity={}, remainingAfter={}, reservedTotal={}",
                batchId, quantity, batch.getRemainingQuantity(), batch.getReservedQuantity());

        // 更新批次使用关联
        ProductionPlanBatchUsage usage = productionPlanBatchUsageRepository
                .findByProductionPlanIdAndBatchId(productionPlanId, batchId)
                .orElse(null);

        if (usage != null) {
            usage.setReservedQuantity(usage.getReservedQuantity().subtract(quantity));
            if (usage.getReservedQuantity().compareTo(BigDecimal.ZERO) <= 0) {
                productionPlanBatchUsageRepository.delete(usage);
            } else {
                productionPlanBatchUsageRepository.save(usage);
            }
        }
    }

    @Override
    @Transactional
    public void consumeBatchMaterial(String factoryId, String batchId, BigDecimal quantity, String productionPlanId) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次", "id", batchId));

        // 验证工厂ID
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作该批次");
        }

        // 验证预留数量是否充足
        if (batch.getReservedQuantity().compareTo(quantity) < 0) {
            throw new BusinessException("预留数量不足以消耗");
        }

        // 从预留数量中扣减，增加已使用数量
        batch.setReservedQuantity(batch.getReservedQuantity().subtract(quantity));
        batch.setUsedQuantity(batch.getUsedQuantity().add(quantity));
        batch.setLastUsedAt(LocalDateTime.now());

        // 如果预留和剩余都为0，更新状态为DEPLETED
        if (batch.getReservedQuantity().compareTo(BigDecimal.ZERO) == 0 &&
            batch.getRemainingQuantity().compareTo(BigDecimal.ZERO) == 0) {
            batch.setStatus(MaterialBatchStatus.DEPLETED);
        }

        materialBatchRepository.save(batch);
        log.info("消耗批次材料成功: batchId={}, quantity={}, reservedRemaining={}, usedTotal={}",
                batchId, quantity, batch.getReservedQuantity(), batch.getUsedQuantity());

        // 记录消耗记录
        MaterialConsumption consumption = new MaterialConsumption();
        consumption.setFactoryId(factoryId);
        consumption.setProductionPlanId(productionPlanId);
        consumption.setBatchId(batchId);
        consumption.setQuantity(quantity);
        consumption.setConsumptionTime(LocalDateTime.now());
        materialConsumptionRepository.save(consumption);

        // 更新批次使用关联
        ProductionPlanBatchUsage usage = productionPlanBatchUsageRepository
                .findByProductionPlanIdAndBatchId(productionPlanId, batchId)
                .orElse(null);

        if (usage != null) {
            usage.setReservedQuantity(usage.getReservedQuantity().subtract(quantity));
            usage.setUsedQuantity(usage.getUsedQuantity().add(quantity));
            productionPlanBatchUsageRepository.save(usage);
        }
    }

    @Override
    public Map<String, Object> getInventoryStatistics(String factoryId) {
        Map<String, Object> statistics = new HashMap<>();

        // 总批次数
        long totalBatches = materialBatchRepository.countByFactoryId(factoryId);
        statistics.put("totalBatches", totalBatches);

        // 可用批次数
        long availableBatches = materialBatchRepository.countByFactoryIdAndStatus(factoryId, MaterialBatchStatus.AVAILABLE);
        statistics.put("availableBatches", availableBatches);

        // 过期批次数
        long expiredBatches = materialBatchRepository.countByFactoryIdAndStatus(factoryId, MaterialBatchStatus.EXPIRED);
        statistics.put("expiredBatches", expiredBatches);

        // 总库存价值
        BigDecimal totalValue = calculateInventoryValue(factoryId);
        statistics.put("totalValue", totalValue);

        // 按材料类型统计
        Map<String, BigDecimal> inventoryByType = getInventoryByMaterialType(factoryId);
        statistics.put("inventoryByType", inventoryByType);

        // 即将过期批次数（7天内）
        List<MaterialBatch> expiringBatches = materialBatchRepository.findExpiringBatchesByStatus(
                factoryId, LocalDate.now().plusDays(7), MaterialBatchStatus.AVAILABLE);
        statistics.put("expiringBatchesCount", expiringBatches.size());

        return statistics;
    }

    @Override
    public BigDecimal getInventoryValuation(String factoryId) {
        return calculateInventoryValue(factoryId);
    }

    @Override
    @Transactional
    public int handleExpiredBatches(String factoryId) {
        List<MaterialBatch> expiredBatches = materialBatchRepository.findExpiredBatchesByDate(
                factoryId, LocalDate.now());

        int count = 0;
        for (MaterialBatch batch : expiredBatches) {
            if (batch.getStatus() != MaterialBatchStatus.EXPIRED) {
                batch.setStatus(MaterialBatchStatus.EXPIRED);
                materialBatchRepository.save(batch);
                count++;
            }
        }

        return count;
    }

    @Override
    @Transactional
    public MaterialBatchDTO convertToFrozen(String factoryId, String batchId, ConvertToFrozenRequest request) {
        log.info("开始转冻品: factoryId={}, batchId={}", factoryId, batchId);

        // 1. 查询原材料批次
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("批次不存在: " + batchId));

        // 2. 验证工厂ID
        if (!factoryId.equals(batch.getFactoryId())) {
            throw new BusinessException("批次不属于该工厂");
        }

        // 3. 验证批次状态（只有鲜品可以转冻品）
        if (batch.getStatus() != MaterialBatchStatus.FRESH) {
            throw new BusinessException("只有鲜品批次可以转为冻品，当前状态: " + batch.getStatus());
        }

        // 4. 更新批次状态和存储位置
        batch.setStatus(MaterialBatchStatus.FROZEN);
        batch.setStorageLocation(request.getStorageLocation());

        // 5. 在notes中记录转换信息
        String existingNotes = batch.getNotes() != null ? batch.getNotes() : "";
        String convertNote = String.format("\n[%s] 转冻品操作 - 操作人ID:%d, 转换日期:%s",
                LocalDateTime.now().toString(),
                request.getConvertedBy(),
                request.getConvertedDate().toString());

        if (request.getNotes() != null && !request.getNotes().isEmpty()) {
            convertNote += ", 备注: " + request.getNotes();
        }

        batch.setNotes(existingNotes + convertNote);

        // 6. 保存批次
        MaterialBatch savedBatch = materialBatchRepository.save(batch);

        log.info("转冻品成功: batchId={}, newStatus={}", batchId, savedBatch.getStatus());

        // 7. 转换为DTO返回
        return materialBatchMapper.toDTO(savedBatch);
    }

    @Override
    @Transactional
    public MaterialBatchDTO undoFrozen(String factoryId, String batchId, UndoFrozenRequest request) {
        log.info("开始撤销转冻品: factoryId={}, batchId={}", factoryId, batchId);

        // 1. 查询原材料批次
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("批次不存在: " + batchId));

        // 2. 验证工厂ID
        if (!factoryId.equals(batch.getFactoryId())) {
            throw new BusinessException("批次不属于该工厂");
        }

        // 3. 验证批次状态（只有冻品可以撤销）
        if (batch.getStatus() != MaterialBatchStatus.FROZEN) {
            throw new BusinessException("只有冻品批次可以撤销，当前状态: " + batch.getStatus());
        }

        // 4. 从notes中解析最后转换时间并验证时间窗口
        String notes = batch.getNotes() != null ? batch.getNotes() : "";
        LocalDateTime convertedTime = extractLastConvertTime(notes);

        if (convertedTime == null) {
            throw new BusinessException("无法找到转换时间记录，无法撤销");
        }

        LocalDateTime now = LocalDateTime.now();
        long minutesPassed = java.time.Duration.between(convertedTime, now).toMinutes();

        if (minutesPassed > 10) {
            throw new BusinessException(
                String.format("转换已超过10分钟（已过%d分钟），无法撤销", minutesPassed)
            );
        }

        log.info("转换时间: {}, 当前时间: {}, 已过: {}分钟", convertedTime, now, minutesPassed);

        // 5. 恢复为FRESH状态
        batch.setStatus(MaterialBatchStatus.FRESH);

        // 6. 在notes中记录撤销信息
        String undoNote = String.format("\n[%s] 撤销转冻品操作 - 操作人ID:%d, 原因: %s",
                LocalDateTime.now().toString(),
                request.getOperatorId(),
                request.getReason());
        batch.setNotes(notes + undoNote);

        // 7. 保存批次
        MaterialBatch savedBatch = materialBatchRepository.save(batch);
        log.info("撤销转冻品成功: batchId={}, newStatus={}", batchId, savedBatch.getStatus());

        // 8. 转换为DTO返回
        return materialBatchMapper.toDTO(savedBatch);
    }

    /**
     * 从notes中提取最后一次转冻品的时间
     */
    private LocalDateTime extractLastConvertTime(String notes) {
        if (notes == null || notes.isEmpty()) {
            return null;
        }

        try {
            // 查找最后一个转冻品记录的时间戳
            // 格式: [2025-11-20T16:53:39.766951] 转冻品操作 - ...
            String[] lines = notes.split("\n");
            for (int i = lines.length - 1; i >= 0; i--) {
                String line = lines[i];
                if (line.contains("转冻品操作")) {
                    int start = line.indexOf('[');
                    int end = line.indexOf(']');
                    if (start >= 0 && end > start) {
                        String timeStr = line.substring(start + 1, end);
                        return LocalDateTime.parse(timeStr);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("解析转换时间失败: {}", e.getMessage());
        }

        return null;
    }

    /**
     * 生成唯一批次号
     */
    private String generateUniqueBatchNumber(String baseNumber) {
        String batchNumber = baseNumber;
        int counter = 0;

        while (materialBatchRepository.existsByBatchNumber(batchNumber)) {
            counter++;
            batchNumber = baseNumber + "-" + counter;
        }

        return batchNumber;
    }
}
