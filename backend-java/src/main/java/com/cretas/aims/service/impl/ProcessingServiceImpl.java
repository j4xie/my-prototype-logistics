package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.*;
import com.cretas.aims.entity.enums.*;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.*;
import com.cretas.aims.service.ProcessingService;
import com.cretas.aims.service.AIAnalysisService;
import com.cretas.aims.service.CacheService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
/**
 * 生产加工服务实现类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
@RequiredArgsConstructor
public class ProcessingServiceImpl implements ProcessingService {
    private static final Logger log = LoggerFactory.getLogger(ProcessingServiceImpl.class);

    private final ProductionBatchRepository productionBatchRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final MaterialConsumptionRepository materialConsumptionRepository;
    private final QualityInspectionRepository qualityInspectionRepository;
    private final EquipmentRepository equipmentRepository;
    private final EquipmentUsageRepository equipmentUsageRepository;
    private final ProductionPlanRepository productionPlanRepository;
    private final SystemLogRepository systemLogRepository;
    private final RawMaterialTypeRepository rawMaterialTypeRepository;
    private final BatchWorkSessionRepository batchWorkSessionRepository;
    private final UserRepository userRepository;
    private final SupplierRepository supplierRepository;
    private final AIAnalysisService aiAnalysisService;
    private final CacheService cacheService;
    // ========== 批次管理 ==========
    @Override
    @Transactional
    public ProductionBatch createBatch(String factoryId, ProductionBatch batch) {
        log.info("创建生产批次: factoryId={}, batchNumber={}", factoryId, batch.getBatchNumber());
        // 验证批次号唯一性
        if (productionBatchRepository.existsByFactoryIdAndBatchNumber(factoryId, batch.getBatchNumber())) {
            throw new BusinessException("批次号已存在: " + batch.getBatchNumber());
        }
        batch.setFactoryId(factoryId);
        batch.setStatus(ProductionBatchStatus.PLANNED);
        batch.setCreatedAt(LocalDateTime.now());
        return productionBatchRepository.save(batch);
    }
    public ProductionBatch startProduction(String factoryId, String batchId, Integer supervisorId) {
        log.info("开始生产: factoryId={}, batchId={}, supervisorId={}", factoryId, batchId, supervisorId);
        ProductionBatch batch = productionBatchRepository.findByIdAndFactoryId(batchId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("批次不存在"));
        if (ProductionBatchStatus.PLANNED != batch.getStatus()) {
            throw new BusinessException("批次状态不允许开始生产: " + batch.getStatus());
        }
        batch.setStatus(ProductionBatchStatus.IN_PROGRESS);
        batch.setStartTime(LocalDateTime.now());
        batch.setSupervisorId(supervisorId);
        return productionBatchRepository.save(batch);
    }
    public ProductionBatch pauseProduction(String factoryId, String batchId, String reason) {
        log.info("暂停生产: factoryId={}, batchId={}, reason={}", factoryId, batchId, reason);
        ProductionBatch batch = productionBatchRepository.findByIdAndFactoryId(batchId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("批次不存在"));
        if (ProductionBatchStatus.IN_PROGRESS != batch.getStatus()) {
            throw new BusinessException("只有进行中的批次可以暂停");
        }
        batch.setStatus(ProductionBatchStatus.PAUSED);
        batch.setNotes(batch.getNotes() != null ? batch.getNotes() + "\n暂停原因: " + reason : "暂停原因: " + reason);
        return productionBatchRepository.save(batch);
    }
    public ProductionBatch completeProduction(String factoryId, String batchId, BigDecimal actualQuantity,
                                             BigDecimal goodQuantity, BigDecimal defectQuantity) {
        log.info("完成生产: factoryId={}, batchId={}, actualQuantity={}", factoryId, batchId, actualQuantity);
        ProductionBatch batch = productionBatchRepository.findByIdAndFactoryId(batchId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("批次不存在"));
        if (ProductionBatchStatus.IN_PROGRESS != batch.getStatus() &&
            ProductionBatchStatus.PAUSED != batch.getStatus()) {
            throw new BusinessException("批次状态不允许完成生产: " + batch.getStatus());
        }
        batch.setStatus(ProductionBatchStatus.COMPLETED);
        batch.setEndTime(LocalDateTime.now());
        batch.setActualQuantity(actualQuantity);
        batch.setGoodQuantity(goodQuantity);
        batch.setDefectQuantity(defectQuantity);
        // 计算指标
        batch.calculateMetrics();
        return productionBatchRepository.save(batch);
    }
    public ProductionBatch cancelProduction(String factoryId, String batchId, String reason) {
        log.info("取消生产: factoryId={}, batchId={}, reason={}", factoryId, batchId, reason);
        ProductionBatch batch = productionBatchRepository.findByIdAndFactoryId(batchId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("批次不存在"));
        if (ProductionBatchStatus.COMPLETED == batch.getStatus()) {
            throw new BusinessException("已完成的批次不能取消");
        }
        batch.setStatus(ProductionBatchStatus.CANCELLED);
        batch.setNotes(batch.getNotes() != null ? batch.getNotes() + "\n取消原因: " + reason : "取消原因: " + reason);
        return productionBatchRepository.save(batch);
    }
    public ProductionBatch getBatchById(String factoryId, String batchId) {
        return productionBatchRepository.findByIdAndFactoryId(batchId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("批次不存在"));
    }
    public PageResponse<ProductionBatch> getBatches(String factoryId, String status, PageRequest pageRequest) {
        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );
        Page<ProductionBatch> page;
        if (status != null && !status.isEmpty()) {
            // 将字符串状态转换为枚举
            ProductionBatchStatus statusEnum = ProductionBatchStatus.valueOf(status.toUpperCase());
            page = productionBatchRepository.findByFactoryIdAndStatus(factoryId, statusEnum, pageable);
        } else {
            page = productionBatchRepository.findByFactoryId(factoryId, pageable);
        }
        return PageResponse.of(
                page.getContent(),
                pageRequest.getPage(),
                pageRequest.getSize(),
                page.getTotalElements()
        );
    }
    public List<Map<String, Object>> getBatchTimeline(String factoryId, String batchId) {
        ProductionBatch batch = getBatchById(factoryId, batchId);
        List<Map<String, Object>> timeline = new ArrayList<>();
        // 创建时间点
        Map<String, Object> created = new HashMap<>();
        created.put("time", batch.getCreatedAt());
        created.put("event", "批次创建");
        created.put("status", "PLANNED");
        timeline.add(created);
        // 开始生产时间点
        if (batch.getStartTime() != null) {
            Map<String, Object> started = new HashMap<>();
            started.put("time", batch.getStartTime());
            started.put("event", "开始生产");
            started.put("status", "IN_PROGRESS");
            timeline.add(started);
        }
        // 结束时间点
        if (batch.getEndTime() != null) {
            Map<String, Object> ended = new HashMap<>();
            ended.put("time", batch.getEndTime());
            ended.put("event", "COMPLETED".equals(batch.getStatus()) ? "生产完成" : "生产取消");
            ended.put("status", batch.getStatus());
            timeline.add(ended);
        }
        return timeline;
    }
    // ========== 原材料管理 ==========
    public MaterialBatch createMaterialReceipt(String factoryId, MaterialBatch materialBatch) {
        log.info("创建原材料接收记录: factoryId={}, batchNumber={}", factoryId, materialBatch.getBatchNumber());
        if (materialBatchRepository.existsByFactoryIdAndBatchNumber(factoryId, materialBatch.getBatchNumber())) {
            throw new BusinessException("原材料批次号已存在: " + materialBatch.getBatchNumber());
        }

        // 获取初始数量（支持多种字段名）
        BigDecimal initialQty = materialBatch.getInitialQuantity();
        if (initialQty == null) {
            throw new BusinessException("原材料数量不能为空");
        }

        // 从原材料类型获取单位
        if (materialBatch.getMaterialType() != null && materialBatch.getMaterialType().getId() != null) {
            RawMaterialType materialType = rawMaterialTypeRepository.findById(materialBatch.getMaterialType().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("原材料类型不存在"));
            materialBatch.setQuantityUnit(materialType.getUnit());  // 设置数量单位
        } else if (materialBatch.getQuantityUnit() == null) {
            // 如果没有原材料类型且没有单位，使用默认值
            materialBatch.setQuantityUnit("公斤");
        }

        materialBatch.setFactoryId(factoryId);
        materialBatch.setStatus(MaterialBatchStatus.AVAILABLE);
        // 注意: initialQuantity, remainingQuantity, currentQuantity, totalQuantity 都是计算属性
        // 只需设置核心字段: receiptQuantity, usedQuantity, reservedQuantity
        materialBatch.setReceiptQuantity(initialQty);  // receiptQuantity 是核心字段
        materialBatch.setUsedQuantity(BigDecimal.ZERO);
        materialBatch.setReservedQuantity(BigDecimal.ZERO);

        // 同步purchase_date遗留字段
        if (materialBatch.getPurchaseDate() == null && materialBatch.getReceiptDate() != null) {
            materialBatch.setPurchaseDate(materialBatch.getReceiptDate());
        }

        // 注意: totalWeight 是计算属性 (weightPerUnit × receiptQuantity)
        // 如果没有提供 weightPerUnit，使用默认值1.0 (表示1kg/单位)
        if (materialBatch.getWeightPerUnit() == null) {
            materialBatch.setWeightPerUnit(BigDecimal.ONE);
        }

        // 注意: totalPrice 和 totalValue 都是计算属性
        // totalPrice = unitPrice × receiptQuantity，会自动计算
        // 只需确保设置了 unitPrice 即可
        if (materialBatch.getUnitPrice() == null) {
            // 如果没有单价，设置默认值0
            materialBatch.setUnitPrice(BigDecimal.ZERO);
        }

        return materialBatchRepository.save(materialBatch);
    }
    public PageResponse<MaterialBatch> getMaterialReceipts(String factoryId, PageRequest pageRequest) {
        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "purchaseDate")
        );
        Page<MaterialBatch> page = materialBatchRepository.findByFactoryId(factoryId, pageable);
        return PageResponse.of(
                page.getContent(),
                pageRequest.getPage(),
                pageRequest.getSize(),
                page.getTotalElements()
        );
    }
    public MaterialBatch updateMaterialReceipt(String factoryId, String batchId, MaterialBatch updates) {
        MaterialBatch batch = materialBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("原材料批次不存在"));
        if (!batch.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权操作此批次");
        }
        // 更新允许修改的字段
        if (updates.getStorageLocation() != null) {
            batch.setStorageLocation(updates.getStorageLocation());
        }
        if (updates.getQualityCertificate() != null) {
            batch.setQualityCertificate(updates.getQualityCertificate());
        }
        if (updates.getNotes() != null) {
            batch.setNotes(updates.getNotes());
        }
        return materialBatchRepository.save(batch);
    }
    public void recordMaterialConsumption(String factoryId, String productionBatchId,
                                         List<Map<String, Object>> consumptions) {
        log.info("记录原材料消耗: factoryId={}, productionBatchId={}", factoryId, productionBatchId);
        ProductionBatch productionBatch = getBatchById(factoryId, productionBatchId);
        for (Map<String, Object> consumption : consumptions) {
            String materialBatchId = (String) consumption.get("materialBatchId");
            BigDecimal quantity = new BigDecimal(consumption.get("quantity").toString());
            MaterialBatch materialBatch = materialBatchRepository.findById(materialBatchId)
                    .orElseThrow(() -> new ResourceNotFoundException("原材料批次不存在"));
            // 检查库存
            if (materialBatch.getRemainingQuantity().compareTo(quantity) < 0) {
                throw new BusinessException("原材料库存不足: " + materialBatch.getBatchNumber());
            }
            // 更新库存
            // 注意: remainingQuantity 和 currentQuantity 是计算属性，会自动重新计算
            materialBatch.setUsedQuantity(materialBatch.getUsedQuantity().add(quantity));
            materialBatch.setLastUsedAt(LocalDateTime.now());
            // 创建消耗记录
            MaterialConsumption consumptionRecord = new MaterialConsumption();
            consumptionRecord.setBatch(materialBatch);
            consumptionRecord.setProductionBatchId(productionBatchId);
            consumptionRecord.setQuantity(quantity);
            consumptionRecord.setConsumedAt(LocalDateTime.now());
            materialBatchRepository.save(materialBatch);
            materialConsumptionRepository.save(consumptionRecord);
        }
        // 更新生产批次的原材料成本
        BigDecimal totalMaterialCost = BigDecimal.ZERO;
        for (Map<String, Object> consumption : consumptions) {
            String materialBatchId = (String) consumption.get("materialBatchId");
            BigDecimal quantity = new BigDecimal(consumption.get("quantity").toString());
            MaterialBatch materialBatch = materialBatchRepository.findById(materialBatchId).get();
            BigDecimal cost = quantity.multiply(materialBatch.getUnitPrice());
            totalMaterialCost = totalMaterialCost.add(cost);
        }
        productionBatch.setMaterialCost(totalMaterialCost);
        productionBatchRepository.save(productionBatch);
    }
    // ========== 质量检验 ==========
    public Map<String, Object> submitInspection(String factoryId, String batchId, Map<String, Object> inspection) {
        log.info("提交质检记录: factoryId={}, batchId={}", factoryId, batchId);
        QualityInspection qualityInspection = new QualityInspection();
        qualityInspection.setFactoryId(factoryId);
        qualityInspection.setProductionBatchId(batchId);
        qualityInspection.setInspectorId((Integer) inspection.get("inspectorId"));
        qualityInspection.setInspectionDate(LocalDate.now());
        qualityInspection.setSampleSize(new BigDecimal(inspection.get("sampleSize").toString()));
        qualityInspection.setPassCount(new BigDecimal(inspection.get("passCount").toString()));
        qualityInspection.setFailCount(new BigDecimal(inspection.get("failCount").toString()));
        BigDecimal passRate = qualityInspection.getPassCount()
                .divide(qualityInspection.getSampleSize(), 2, RoundingMode.HALF_UP)
                .multiply(new BigDecimal(100));
        qualityInspection.setPassRate(passRate);
        qualityInspection.setResult((String) inspection.get("result"));
        qualityInspection.setNotes((String) inspection.get("notes"));
        QualityInspection saved = qualityInspectionRepository.save(qualityInspection);
        Map<String, Object> result = new HashMap<>();
        result.put("inspection", saved);
        result.put("passRate", passRate);
        return result;
    }
    public PageResponse<Map<String, Object>> getInspections(String factoryId, String batchId, PageRequest pageRequest) {
        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "inspectionDate")
        );
        Page<QualityInspection> page;
        if (batchId != null) {
            page = qualityInspectionRepository.findByFactoryIdAndProductionBatchId(factoryId, batchId, pageable);
        } else {
            page = qualityInspectionRepository.findByFactoryId(factoryId, pageable);
        }
        List<Map<String, Object>> inspectionMaps = page.getContent().stream()
                .map(this::convertInspectionToMap)
                .collect(Collectors.toList());
        return PageResponse.of(
                inspectionMaps,
                pageRequest.getPage(),
                pageRequest.getSize(),
                page.getTotalElements()
        );
    }
    public Map<String, Object> getQualityStatistics(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<QualityInspection> inspections = qualityInspectionRepository.findByFactoryIdAndDateRange(
                factoryId, startDate, endDate);
        Map<String, Object> statistics = new HashMap<>();
        statistics.put("totalInspections", inspections.size());
        if (!inspections.isEmpty()) {
            BigDecimal averagePassRate = inspections.stream()
                    .map(QualityInspection::getPassRate)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .divide(new BigDecimal(inspections.size()), 2, RoundingMode.HALF_UP);
            statistics.put("averagePassRate", averagePassRate);
            long passedCount = inspections.stream()
                    .filter(i -> "PASS".equals(i.getResult()))
                    .count();
            statistics.put("passedBatches", passedCount);
            statistics.put("failedBatches", inspections.size() - passedCount);
        }
        return statistics;
    }
    public List<Map<String, Object>> getQualityTrends(String factoryId, Integer days) {
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(days);
        List<QualityInspection> inspections = qualityInspectionRepository.findByFactoryIdAndDateRange(
                factoryId, startDate, endDate);
        Map<LocalDate, List<QualityInspection>> groupedByDate = inspections.stream()
                .collect(Collectors.groupingBy(QualityInspection::getInspectionDate));
        List<Map<String, Object>> trends = new ArrayList<>();
        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            Map<String, Object> dayTrend = new HashMap<>();
            dayTrend.put("date", date);
            List<QualityInspection> dayInspections = groupedByDate.getOrDefault(date, new ArrayList<>());
            if (!dayInspections.isEmpty()) {
                BigDecimal avgPassRate = dayInspections.stream()
                        .map(QualityInspection::getPassRate)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(new BigDecimal(dayInspections.size()), 2, RoundingMode.HALF_UP);
                dayTrend.put("passRate", avgPassRate);
                dayTrend.put("inspectionCount", dayInspections.size());
            } else {
                dayTrend.put("passRate", null);
                dayTrend.put("inspectionCount", 0);
            }
            trends.add(dayTrend);
        }
        return trends;
    }
    // ========== 设备监控 ==========
    public void recordEquipmentUsage(String factoryId, String batchId, Integer equipmentId,
                                    LocalDate startTime, LocalDate endTime) {
        // 将Integer equipmentId转换为String以匹配FactoryEquipment.id类型
        String equipmentIdStr = String.valueOf(equipmentId);
        FactoryEquipment equipment = equipmentRepository.findById(equipmentIdStr)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));
        EquipmentUsage usage = new EquipmentUsage();
        usage.setEquipmentId(equipmentIdStr);  // 使用转换后的String类型
        usage.setProductionBatchId(batchId);
        usage.setStartTime(startTime.atStartOfDay());
        usage.setEndTime(endTime.atTime(23, 59, 59));
        usage.setDurationHours((int) ChronoUnit.HOURS.between(usage.getStartTime(), usage.getEndTime()));
        equipmentUsageRepository.save(usage);
        // 更新设备使用时长
        equipment.setTotalRunningHours(
                (equipment.getTotalRunningHours() != null ? equipment.getTotalRunningHours() : 0) + usage.getDurationHours()
        );
        equipment.setLastMaintenanceDate(LocalDate.now());
        equipmentRepository.save(equipment);
    }
    public List<Map<String, Object>> getEquipmentMonitoring(String factoryId) {
        List<FactoryEquipment> equipments = equipmentRepository.findByFactoryId(factoryId,
                org.springframework.data.domain.PageRequest.of(0, 1000)).getContent();
        return equipments.stream().map(equipment -> {
            Map<String, Object> monitoring = new HashMap<>();
            monitoring.put("equipmentId", equipment.getId());
            monitoring.put("name", equipment.getName());
            monitoring.put("status", equipment.getStatus());
            monitoring.put("totalOperatingHours", equipment.getTotalRunningHours());
            monitoring.put("lastMaintenanceDate", equipment.getLastMaintenanceDate());
            // 计算利用率
            LocalDateTime weekAgo = LocalDateTime.now().minusDays(7);
            List<EquipmentUsage> recentUsages = equipmentUsageRepository.findByEquipmentIdAndStartTimeAfter(
                    equipment.getId(), weekAgo);
            int totalUsageHours = recentUsages.stream()
                    .mapToInt(EquipmentUsage::getDurationHours)
                    .sum();
            double utilizationRate = (totalUsageHours / 168.0) * 100; // 168 = 7天 * 24小时
            monitoring.put("weeklyUtilizationRate", utilizationRate);
            return monitoring;
        }).collect(Collectors.toList());
    }
    public Map<String, Object> getEquipmentMetrics(String factoryId, Integer equipmentId, Integer days) {
        // 将Integer equipmentId转换为String以匹配FactoryEquipment.id类型
        String equipmentIdStr = String.valueOf(equipmentId);
        FactoryEquipment equipment = equipmentRepository.findById(equipmentIdStr)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));
        LocalDateTime startDate = LocalDateTime.now().minusDays(days);
        List<EquipmentUsage> usages = equipmentUsageRepository.findByEquipmentIdAndStartTimeAfter(
                equipmentIdStr, startDate);  // 使用转换后的String类型
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("equipment", equipment);
        metrics.put("totalUsageHours", usages.stream().mapToInt(EquipmentUsage::getDurationHours).sum());
        metrics.put("usageCount", usages.size());
        metrics.put("averageUsageHours",
                usages.isEmpty() ? 0 : usages.stream().mapToInt(EquipmentUsage::getDurationHours).average().orElse(0));
        return metrics;
    }
    public void recordEquipmentMaintenance(String factoryId, Integer equipmentId, Map<String, Object> maintenance) {
        // 将Integer equipmentId转换为String以匹配FactoryEquipment.id类型
        String equipmentIdStr = String.valueOf(equipmentId);
        FactoryEquipment equipment = equipmentRepository.findById(equipmentIdStr)
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在"));
        equipment.setLastMaintenanceDate(LocalDate.now());
        equipment.setStatus("running");
        equipment.setNotes((String) maintenance.get("notes"));
        equipmentRepository.save(equipment);
    }
    // ========== 成本分析 ==========
    public Map<String, Object> getBatchCostAnalysis(String factoryId, String batchId) {
        ProductionBatch batch = getBatchById(factoryId, batchId);
        Map<String, Object> analysis = new HashMap<>();

        // 添加batch基本信息（作为Map而不是对象）
        Map<String, Object> batchInfo = new HashMap<>();
        batchInfo.put("batchNumber", batch.getBatchNumber());
        batchInfo.put("productName", batch.getProductName());
        batchInfo.put("actualQuantity", batch.getActualQuantity());
        batchInfo.put("goodQuantity", batch.getGoodQuantity());
        batchInfo.put("defectQuantity", batch.getDefectQuantity());
        batchInfo.put("yieldRate", batch.getYieldRate());
        batchInfo.put("startTime", batch.getStartTime());
        batchInfo.put("endTime", batch.getEndTime());
        analysis.put("batch", batchInfo);

        analysis.put("materialCost", batch.getMaterialCost());
        analysis.put("laborCost", batch.getLaborCost());
        analysis.put("equipmentCost", batch.getEquipmentCost());
        analysis.put("otherCost", batch.getOtherCost());
        analysis.put("totalCost", batch.getTotalCost());
        analysis.put("unitCost", batch.getUnitCost());
        // 成本构成比例
        if (batch.getTotalCost() != null && batch.getTotalCost().compareTo(BigDecimal.ZERO) > 0) {
            analysis.put("materialCostRatio",
                    batch.getMaterialCost().divide(batch.getTotalCost(), 2, RoundingMode.HALF_UP).multiply(new BigDecimal(100)));
            analysis.put("laborCostRatio",
                    batch.getLaborCost().divide(batch.getTotalCost(), 2, RoundingMode.HALF_UP).multiply(new BigDecimal(100)));
            analysis.put("equipmentCostRatio",
                    batch.getEquipmentCost().divide(batch.getTotalCost(), 2, RoundingMode.HALF_UP).multiply(new BigDecimal(100)));
            analysis.put("otherCostRatio",
                    batch.getOtherCost().divide(batch.getTotalCost(), 2, RoundingMode.HALF_UP).multiply(new BigDecimal(100)));
        }
        return analysis;
    }

    /**
     * 获取增强的批次成本分析（包含完整业务链数据）
     * 整合原材料、设备、人工、质检等全维度信息
     */
    public Map<String, Object> getEnhancedBatchCostAnalysis(String factoryId, String batchId) {
        log.info("获取增强的批次成本分析: factoryId={}, batchId={}", factoryId, batchId);

        ProductionBatch batch = getBatchById(factoryId, batchId);
        Map<String, Object> analysis = new HashMap<>();

        // ========== 1. 基本信息 ==========
        Map<String, Object> batchInfo = new HashMap<>();
        batchInfo.put("batchNumber", batch.getBatchNumber());
        batchInfo.put("productName", batch.getProductName());
        batchInfo.put("plannedQuantity", batch.getPlannedQuantity());
        batchInfo.put("actualQuantity", batch.getActualQuantity());
        batchInfo.put("goodQuantity", batch.getGoodQuantity());
        batchInfo.put("defectQuantity", batch.getDefectQuantity());
        batchInfo.put("yieldRate", batch.getYieldRate());
        batchInfo.put("efficiency", batch.getEfficiency());
        batchInfo.put("status", batch.getStatus());
        batchInfo.put("startTime", batch.getStartTime());
        batchInfo.put("endTime", batch.getEndTime());

        // 计算生产时长
        if (batch.getStartTime() != null && batch.getEndTime() != null) {
            long hours = ChronoUnit.HOURS.between(batch.getStartTime(), batch.getEndTime());
            batchInfo.put("productionHours", hours);
        }
        analysis.put("batchInfo", batchInfo);

        // ========== 2. 生产计划对比 ==========
        if (batch.getProductionPlanId() != null) {
            productionPlanRepository.findById(batch.getProductionPlanId()).ifPresent(plan -> {
                Map<String, Object> planComparison = new HashMap<>();
                planComparison.put("planId", plan.getId());
                planComparison.put("planNumber", plan.getPlanNumber());
                // planComparison.put("plannedDate", plan.getPlannedDate());  // 暂时注释 - 数据库表中没有此字段
                planComparison.put("plannedQuantity", plan.getPlannedQuantity());
                planComparison.put("actualQuantity", batch.getActualQuantity());

                if (plan.getPlannedQuantity() != null && batch.getActualQuantity() != null) {
                    BigDecimal completionRate = batch.getActualQuantity()
                        .divide(plan.getPlannedQuantity(), 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal(100));
                    planComparison.put("completionRate", completionRate);
                }

                planComparison.put("planStartTime", plan.getStartTime());
                planComparison.put("planEndTime", plan.getEndTime());
                planComparison.put("actualStartTime", batch.getStartTime());
                planComparison.put("actualEndTime", batch.getEndTime());
                planComparison.put("status", plan.getStatus());

                analysis.put("productionPlanComparison", planComparison);
            });
        }

        // ========== 3. 原材料消耗详情 ==========
        List<MaterialConsumption> consumptions = materialConsumptionRepository.findByProductionBatchId(batchId);
        List<Map<String, Object>> materialDetails = new ArrayList<>();
        BigDecimal totalMaterialCost = BigDecimal.ZERO;

        for (MaterialConsumption consumption : consumptions) {
            Map<String, Object> materialDetail = new HashMap<>();
            MaterialBatch materialBatch = consumption.getBatch();

            materialDetail.put("consumptionId", consumption.getId());
            materialDetail.put("batchNumber", materialBatch.getBatchNumber());

            // 获取原材料名称（通过materialType关联）
            String materialName = materialBatch.getMaterialType() != null ?
                materialBatch.getMaterialType().getName() : "未知原材料";
            materialDetail.put("materialName", materialName);

            materialDetail.put("quantity", consumption.getQuantity());
            materialDetail.put("unit", materialBatch.getQuantityUnit());
            materialDetail.put("unitPrice", materialBatch.getUnitPrice());

            // 计算此次消耗成本
            BigDecimal cost = consumption.getQuantity().multiply(materialBatch.getUnitPrice());
            materialDetail.put("cost", cost);
            totalMaterialCost = totalMaterialCost.add(cost);

            // 供应商信息
            if (materialBatch.getSupplier() != null) {
                Map<String, Object> supplierInfo = new HashMap<>();
                supplierInfo.put("id", materialBatch.getSupplier().getId());
                supplierInfo.put("name", materialBatch.getSupplier().getName());
                supplierInfo.put("contactPerson", materialBatch.getSupplier().getContactPerson());
                materialDetail.put("supplier", supplierInfo);
            }

            // FIFO信息
            materialDetail.put("receiptDate", materialBatch.getReceiptDate());
            materialDetail.put("expireDate", materialBatch.getExpireDate());

            // 库存状态
            materialDetail.put("initialQuantity", materialBatch.getInitialQuantity());
            materialDetail.put("remainingQuantity", materialBatch.getRemainingQuantity());

            materialDetail.put("consumedAt", consumption.getConsumedAt());

            materialDetails.add(materialDetail);
        }

        analysis.put("materialConsumptions", materialDetails);
        analysis.put("materialConsumptionCount", materialDetails.size());
        analysis.put("totalMaterialCost", totalMaterialCost);

        // ========== 4. 设备使用详情 ==========
        List<EquipmentUsage> usages = equipmentUsageRepository.findByProductionBatchId(batchId);
        List<Map<String, Object>> equipmentDetails = new ArrayList<>();
        BigDecimal totalEquipmentCost = BigDecimal.ZERO;
        int totalEquipmentHours = 0;

        for (EquipmentUsage usage : usages) {
            Map<String, Object> equipmentDetail = new HashMap<>();

            // 将Integer equipmentId转换为String以匹配FactoryEquipment.id类型
            String equipmentIdStr = String.valueOf(usage.getEquipmentId());
            equipmentRepository.findById(equipmentIdStr).ifPresent(equipment -> {
                equipmentDetail.put("equipmentId", equipment.getId());
                equipmentDetail.put("equipmentName", equipment.getName());
                equipmentDetail.put("equipmentCode", equipment.getEquipmentCode());
                equipmentDetail.put("model", equipment.getModel());
                equipmentDetail.put("status", equipment.getStatus());
            });

            equipmentDetail.put("usageId", usage.getId());
            equipmentDetail.put("startTime", usage.getStartTime());
            equipmentDetail.put("endTime", usage.getEndTime());
            equipmentDetail.put("durationHours", usage.getDurationHours());

            // 计算设备成本（假设每小时50元）
            BigDecimal equipmentCost = new BigDecimal(usage.getDurationHours()).multiply(new BigDecimal("50"));
            equipmentDetail.put("cost", equipmentCost);

            totalEquipmentCost = totalEquipmentCost.add(equipmentCost);
            totalEquipmentHours += usage.getDurationHours();

            equipmentDetails.add(equipmentDetail);
        }

        analysis.put("equipmentUsages", equipmentDetails);
        analysis.put("equipmentUsageCount", equipmentDetails.size());
        analysis.put("totalEquipmentHours", totalEquipmentHours);
        analysis.put("totalEquipmentCost", totalEquipmentCost);

        // ========== 5. 人工工时详情 ==========
        // TODO-FIX: BatchWorkSession关联到ProcessingBatch(ID:Integer),而此方法接收ProductionBatch(ID:Long)
        // 导致类型不匹配错误。暂时使用batch表中的labor_cost字段,后续需要统一数据模型。
        // 问题详情: BatchWorkSession.batchId是Integer类型,关联processing_batches表
        // 而这里的batchId参数是Long类型,来自production_batches表

        List<Map<String, Object>> laborDetails = new ArrayList<>();
        BigDecimal totalLaborCost = batch.getLaborCost() != null ? batch.getLaborCost() : BigDecimal.ZERO;
        int totalWorkMinutes = batch.getWorkDurationMinutes() != null ? batch.getWorkDurationMinutes() : 0;

        // 添加汇总信息 (详细的工时会话数据需要数据模型统一后才能查询)
        if (totalLaborCost.compareTo(BigDecimal.ZERO) > 0 || totalWorkMinutes > 0) {
            Map<String, Object> laborSummary = new HashMap<>();
            laborSummary.put("workMinutes", totalWorkMinutes);
            laborSummary.put("laborCost", totalLaborCost);
            laborSummary.put("workerCount", batch.getWorkerCount());
            laborSummary.put("note", "工时详情需要数据模型统一后提供");
            laborDetails.add(laborSummary);
        }

        analysis.put("laborSessions", laborDetails);
        analysis.put("laborSessionCount", laborDetails.size());
        analysis.put("totalWorkMinutes", totalWorkMinutes);
        analysis.put("totalWorkHours", totalWorkMinutes / 60.0);
        analysis.put("totalLaborCost", totalLaborCost);

        // ========== 6. 质量检验详情 ==========
        List<QualityInspection> inspections = qualityInspectionRepository.findByFactoryIdAndProductionBatchId(
            factoryId, batchId, org.springframework.data.domain.PageRequest.of(0, 100)).getContent();

        List<Map<String, Object>> qualityDetails = new ArrayList<>();

        for (QualityInspection inspection : inspections) {
            Map<String, Object> qualityDetail = new HashMap<>();

            qualityDetail.put("inspectionId", inspection.getId());
            qualityDetail.put("inspectionDate", inspection.getInspectionDate());
            qualityDetail.put("sampleSize", inspection.getSampleSize());
            qualityDetail.put("passCount", inspection.getPassCount());
            qualityDetail.put("failCount", inspection.getFailCount());
            qualityDetail.put("passRate", inspection.getPassRate());
            qualityDetail.put("result", inspection.getResult());
            qualityDetail.put("notes", inspection.getNotes());

            // 检验员信息
            if (inspection.getInspectorId() != null) {
                userRepository.findById(inspection.getInspectorId()).ifPresent(inspector -> {
                    Map<String, Object> inspectorInfo = new HashMap<>();
                    inspectorInfo.put("id", inspector.getId());
                    inspectorInfo.put("fullName", inspector.getFullName());
                    qualityDetail.put("inspector", inspectorInfo);
                });
            }

            qualityDetails.add(qualityDetail);
        }

        analysis.put("qualityInspections", qualityDetails);
        analysis.put("qualityInspectionCount", qualityDetails.size());

        // 计算平均合格率
        if (!inspections.isEmpty()) {
            BigDecimal avgPassRate = inspections.stream()
                .map(QualityInspection::getPassRate)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(new BigDecimal(inspections.size()), 2, RoundingMode.HALF_UP);
            analysis.put("averagePassRate", avgPassRate);
        }

        // ========== 7. 成本汇总 ==========
        Map<String, Object> costSummary = new HashMap<>();
        costSummary.put("materialCost", totalMaterialCost);
        costSummary.put("laborCost", totalLaborCost);
        costSummary.put("equipmentCost", totalEquipmentCost);
        costSummary.put("otherCost", batch.getOtherCost() != null ? batch.getOtherCost() : BigDecimal.ZERO);

        BigDecimal totalCost = totalMaterialCost.add(totalLaborCost).add(totalEquipmentCost)
            .add(batch.getOtherCost() != null ? batch.getOtherCost() : BigDecimal.ZERO);
        costSummary.put("totalCost", totalCost);

        // 单位成本
        if (batch.getActualQuantity() != null && batch.getActualQuantity().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal unitCost = totalCost.divide(batch.getActualQuantity(), 4, RoundingMode.HALF_UP);
            costSummary.put("unitCost", unitCost);
        }

        // 成本占比
        if (totalCost.compareTo(BigDecimal.ZERO) > 0) {
            costSummary.put("materialCostRatio",
                totalMaterialCost.divide(totalCost, 4, RoundingMode.HALF_UP).multiply(new BigDecimal(100)));
            costSummary.put("laborCostRatio",
                totalLaborCost.divide(totalCost, 4, RoundingMode.HALF_UP).multiply(new BigDecimal(100)));
            costSummary.put("equipmentCostRatio",
                totalEquipmentCost.divide(totalCost, 4, RoundingMode.HALF_UP).multiply(new BigDecimal(100)));
        }

        analysis.put("costSummary", costSummary);

        // ========== 8. 风险预警 ==========
        List<String> risks = new ArrayList<>();

        // 原材料过期风险
        for (MaterialConsumption consumption : consumptions) {
            MaterialBatch mb = consumption.getBatch();
            if (mb.getExpireDate() != null && mb.getExpireDate().isBefore(LocalDate.now().plusDays(7))) {
                String matName = mb.getMaterialType() != null ?
                    mb.getMaterialType().getName() : "未知原材料";
                risks.add("原材料 " + matName + " 批次 " + mb.getBatchNumber() + " 即将过期");
            }
        }

        // 良品率风险
        if (batch.getYieldRate() != null && batch.getYieldRate().compareTo(new BigDecimal("90")) < 0) {
            risks.add("良品率偏低（" + batch.getYieldRate() + "%），建议加强质量控制");
        }

        // 成本占比风险
        if (totalCost.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal materialRatio = totalMaterialCost.divide(totalCost, 4, RoundingMode.HALF_UP);
            if (materialRatio.compareTo(new BigDecimal("0.65")) > 0) {
                risks.add("原材料成本占比过高（" + materialRatio.multiply(new BigDecimal(100)) + "%），建议优化采购");
            }
        }

        analysis.put("risks", risks);
        analysis.put("riskCount", risks.size());

        log.info("增强的批次成本分析完成: batchId={}, 原材料{}种, 设备{}台, 人工{}人次, 质检{}次",
                 batchId, materialDetails.size(), equipmentDetails.size(), laborDetails.size(), qualityDetails.size());

        return analysis;
    }
    public ProductionBatch recalculateBatchCost(String factoryId, String batchId) {
        ProductionBatch batch = getBatchById(factoryId, batchId);
        // 重新计算原材料成本
        List<MaterialConsumption> consumptions = materialConsumptionRepository.findByProductionBatchId(batchId);
        BigDecimal materialCost = consumptions.stream()
                .map(c -> c.getQuantity().multiply(c.getBatch().getUnitPrice()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        batch.setMaterialCost(materialCost);
        // 重新计算设备成本
        List<EquipmentUsage> usages = equipmentUsageRepository.findByProductionBatchId(batchId);
        BigDecimal equipmentCost = new BigDecimal(usages.stream()
                .mapToInt(EquipmentUsage::getDurationHours)
                .sum() * 50); // 假设每小时设备成本50元
        batch.setEquipmentCost(equipmentCost);
        // 重新计算总成本
        batch.calculateMetrics();
        return productionBatchRepository.save(batch);
    }
    public Map<String, Object> getAICostAnalysis(String factoryId, String batchId) {
        ProductionBatch batch = getBatchById(factoryId, batchId);
        Map<String, Object> aiAnalysis = new HashMap<>();
        aiAnalysis.put("batch", batch);
        List<String> suggestions = new ArrayList<>();
        // 基于成本分析提供建议
        if (batch.getMaterialCost() != null && batch.getTotalCost() != null) {
            BigDecimal materialRatio = batch.getMaterialCost().divide(batch.getTotalCost(), 2, RoundingMode.HALF_UP);
            if (materialRatio.compareTo(new BigDecimal("0.6")) > 0) {
                suggestions.add("原材料成本占比过高（" + materialRatio.multiply(new BigDecimal(100)) + "%），建议优化采购策略或寻找替代供应商");
            }
        }
        if (batch.getYieldRate() != null && batch.getYieldRate().compareTo(new BigDecimal("90")) < 0) {
            suggestions.add("良品率偏低（" + batch.getYieldRate() + "%），建议加强质量控制和工艺优化");
        }
        if (batch.getEfficiency() != null && batch.getEfficiency().compareTo(new BigDecimal("80")) < 0) {
            suggestions.add("生产效率偏低（" + batch.getEfficiency() + "%），建议优化生产流程和人员配置");
        }
        aiAnalysis.put("suggestions", suggestions);
        aiAnalysis.put("potentialSavings", calculatePotentialSavings(batch));
        return aiAnalysis;
    }
    // ========== 仪表盘 ==========
    public Map<String, Object> getDashboardOverview(String factoryId) {
        Map<String, Object> overview = new HashMap<>();
        // 今日生产批次数
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        long todayBatches = productionBatchRepository.countByFactoryIdAndCreatedAtAfter(factoryId, todayStart);
        overview.put("todayBatches", todayBatches);
        // 进行中批次数 - 使用枚举类型
        long inProgressBatches = productionBatchRepository.countByFactoryIdAndStatus(
                factoryId, ProductionBatchStatus.IN_PROGRESS);
        overview.put("inProgressBatches", inProgressBatches);
        // 本月产量
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        BigDecimal monthlyOutput = productionBatchRepository.calculateMonthlyOutput(factoryId, monthStart);
        overview.put("monthlyOutput", monthlyOutput != null ? monthlyOutput : BigDecimal.ZERO);
        // 本月良品率
        BigDecimal monthlyYieldRate = productionBatchRepository.calculateAverageYieldRate(factoryId, monthStart);
        overview.put("monthlyYieldRate", monthlyYieldRate != null ? monthlyYieldRate : BigDecimal.ZERO);
        // 原材料库存预警
        Long lowStockMaterials = materialBatchRepository.countLowStockMaterials(factoryId);
        overview.put("lowStockMaterials", lowStockMaterials != null ? lowStockMaterials : 0L);
        return overview;
    }
    public Map<String, Object> getProductionStatistics(String factoryId, String period) {
        Map<String, Object> statistics = new HashMap<>();
        LocalDateTime startDate;
        switch (period.toLowerCase()) {
            case "today":
                startDate = LocalDate.now().atStartOfDay();
                break;
            case "week":
                startDate = LocalDate.now().minusDays(7).atStartOfDay();
                break;
            case "month":
                startDate = LocalDate.now().withDayOfMonth(1).atStartOfDay();
                break;
            default:
                startDate = LocalDate.now().minusDays(30).atStartOfDay();
        }
        // 批次统计
        long totalBatches = productionBatchRepository.countByFactoryIdAndCreatedAtAfter(factoryId, startDate);
        statistics.put("totalBatches", totalBatches);
        // 产量统计
        BigDecimal totalOutput = productionBatchRepository.calculateTotalOutputAfter(factoryId, startDate);
        statistics.put("totalOutput", totalOutput != null ? totalOutput : BigDecimal.ZERO);
        // 成本统计
        BigDecimal totalCost = productionBatchRepository.calculateTotalCostAfter(factoryId, startDate);
        statistics.put("totalCost", totalCost != null ? totalCost : BigDecimal.ZERO);
        // 效率统计
        BigDecimal avgEfficiency = productionBatchRepository.calculateAverageEfficiency(factoryId, startDate);
        statistics.put("averageEfficiency", avgEfficiency != null ? avgEfficiency : BigDecimal.ZERO);
        return statistics;
    }
    public Map<String, Object> getQualityDashboard(String factoryId) {
        Map<String, Object> dashboard = new HashMap<>();
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        // 本月质检统计
        Map<String, Object> monthlyStats = getQualityStatistics(factoryId, monthStart, today);
        dashboard.put("monthlyStatistics", monthlyStats);
        // 质量趋势
        List<Map<String, Object>> trends = getQualityTrends(factoryId, 30);
        dashboard.put("trends", trends);
        // 最新质检记录
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(1);
        pageRequest.setSize(10);
        PageResponse<Map<String, Object>> recentInspections = getInspections(factoryId, null, pageRequest);
        dashboard.put("recentInspections", recentInspections.getContent());
        return dashboard;
    }
    public Map<String, Object> getEquipmentDashboard(String factoryId) {
        Map<String, Object> dashboard = new HashMap<>();
        // 设备监控
        List<Map<String, Object>> monitoring = getEquipmentMonitoring(factoryId);
        dashboard.put("monitoring", monitoring);
        // 设备统计
        long totalEquipments = equipmentRepository.countByFactoryId(factoryId);
        long runningEquipments = equipmentRepository.countByFactoryIdAndStatus(factoryId, "running");
        long maintenanceEquipments = equipmentRepository.countByFactoryIdAndStatus(factoryId, "maintenance");
        dashboard.put("totalEquipments", totalEquipments);
        dashboard.put("runningEquipments", runningEquipments);
        dashboard.put("maintenanceEquipments", maintenanceEquipments);
        // 平均利用率
        double avgUtilization = monitoring.stream()
                .mapToDouble(m -> (double) m.get("weeklyUtilizationRate"))
                .average()
                .orElse(0);
        dashboard.put("averageUtilization", avgUtilization);
        return dashboard;
    }
    public Map<String, Object> getAlertsDashboard(String factoryId) {
        Map<String, Object> alerts = new HashMap<>();
        List<Map<String, Object>> alertList = new ArrayList<>();
        // 低库存预警
        List<Object> lowStockMaterials = materialBatchRepository.findLowStockMaterials(factoryId);
        for (Object material : lowStockMaterials) {
            Map<String, Object> alert = new HashMap<>();
            alert.put("type", "LOW_STOCK");
            alert.put("level", "WARNING");
            alert.put("message", "原材料库存低");
            alert.put("data", material);
            alertList.add(alert);
        }
        // 过期预警
        List<MaterialBatch> expiringSoon = materialBatchRepository.findExpiringSoon(factoryId, LocalDate.now().plusDays(7));
        for (MaterialBatch batch : expiringSoon) {
            Map<String, Object> alert = new HashMap<>();
            alert.put("type", "EXPIRING");
            alert.put("level", "WARNING");
            alert.put("message", "原材料即将过期: " + batch.getBatchNumber());
            alert.put("data", batch);
            alert.put("expireDate", batch.getExpireDate());
            alertList.add(alert);
        }
        // 设备维护提醒
        List<FactoryEquipment> maintenanceDue = equipmentRepository.findMaintenanceDue(factoryId, LocalDate.now().minusDays(30));
        for (FactoryEquipment equipment : maintenanceDue) {
            Map<String, Object> alert = new HashMap<>();
            alert.put("type", "MAINTENANCE");
            alert.put("level", "INFO");
            alert.put("message", "设备需要维护: " + equipment.getName());
            alert.put("data", equipment);
            alert.put("lastMaintenance", equipment.getLastMaintenanceDate());
            alertList.add(alert);
        }
        alerts.put("alerts", alertList);
        alerts.put("totalAlerts", alertList.size());
        return alerts;
    }
    public Map<String, Object> getTrendAnalysis(String factoryId, String metric, Integer days) {
        Map<String, Object> analysis = new HashMap<>();
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(days);
        List<Map<String, Object>> trendData = new ArrayList<>();
        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            Map<String, Object> dayData = new HashMap<>();
            dayData.put("date", date);
            switch (metric.toLowerCase()) {
                case "production":
                    BigDecimal dayOutput = productionBatchRepository.calculateDailyOutput(
                            factoryId, date.atStartOfDay(), date.atTime(23, 59, 59));
                    dayData.put("value", dayOutput != null ? dayOutput : BigDecimal.ZERO);
                    break;
                case "quality":
                    BigDecimal dayYieldRate = productionBatchRepository.calculateDailyYieldRate(
                            factoryId, date.atStartOfDay(), date.atTime(23, 59, 59));
                    dayData.put("value", dayYieldRate != null ? dayYieldRate : BigDecimal.ZERO);
                    break;
                case "cost":
                    BigDecimal dayCost = productionBatchRepository.calculateDailyCost(
                            factoryId, date.atStartOfDay(), date.atTime(23, 59, 59));
                    dayData.put("value", dayCost != null ? dayCost : BigDecimal.ZERO);
                    break;
                default:
                    dayData.put("value", BigDecimal.ZERO);
            }
            trendData.add(dayData);
        }
        analysis.put("metric", metric);
        analysis.put("period", days);
        analysis.put("data", trendData);
        return analysis;
    }
    // 辅助方法
    private Map<String, Object> convertInspectionToMap(QualityInspection inspection) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", inspection.getId());
        map.put("productionBatchId", inspection.getProductionBatchId());
        map.put("inspectorId", inspection.getInspectorId());
        map.put("inspectionDate", inspection.getInspectionDate());
        map.put("sampleSize", inspection.getSampleSize());
        map.put("passCount", inspection.getPassCount());
        map.put("failCount", inspection.getFailCount());
        map.put("passRate", inspection.getPassRate());
        map.put("result", inspection.getResult());
        map.put("notes", inspection.getNotes());
        return map;
    }
    private BigDecimal calculatePotentialSavings(ProductionBatch batch) {
        BigDecimal savings = BigDecimal.ZERO;
        // 如果良品率提升到95%能节省的成本
        if (batch.getYieldRate() != null && batch.getYieldRate().compareTo(new BigDecimal("95")) < 0) {
            BigDecimal currentWaste = batch.getDefectQuantity().multiply(batch.getUnitCost());
            BigDecimal targetWaste = batch.getActualQuantity().multiply(new BigDecimal("0.05")).multiply(batch.getUnitCost());
            savings = savings.add(currentWaste.subtract(targetWaste));
        }
        return savings;
    }

    // ========== AI智能成本分析（新版本） ==========

    /**
     * AI智能成本分析（带缓存优化 + 完整业务链数据）
     */
    @Override
    public Map<String, Object> analyzeWithAI(String factoryId, String batchId,
                                             String sessionId, String customMessage) {
        log.info("AI成本分析(增强版): factoryId={}, batchId={}, sessionId={}, customMessage={}",
                 factoryId, batchId, sessionId, customMessage != null ? "有追问" : "初次分析");

        // 1. 检查缓存（仅对初次分析且无自定义消息的情况使用缓存）
        if (sessionId == null && customMessage == null) {
            Map<String, Object> cachedResult = cacheService.getAIAnalysisCache(factoryId, batchId);
            if (cachedResult != null) {
                log.info("返回缓存的AI分析结果: factoryId={}, batchId={}", factoryId, batchId);
                cachedResult.put("fromCache", true);
                return cachedResult;
            }
        }

        // 2. 获取增强的批次成本数据（包含完整业务链数据）
        Map<String, Object> enhancedCostData = getEnhancedBatchCostAnalysis(factoryId, batchId);

        // 3. 调用AI服务
        Map<String, Object> aiResult = aiAnalysisService.analyzeCost(
            factoryId, batchId, enhancedCostData, sessionId, customMessage);

        // 4. 组合结果
        Map<String, Object> result = new HashMap<>();
        ProductionBatch batch = getBatchById(factoryId, batchId);

        result.put("batchId", batchId);
        result.put("batchNumber", batch.getBatchNumber());
        result.put("productName", batch.getProductName());
        result.put("enhancedData", enhancedCostData); // 使用增强数据
        result.put("aiAnalysis", aiResult.get("aiAnalysis"));
        result.put("sessionId", aiResult.get("sessionId"));
        result.put("messageCount", aiResult.get("messageCount"));
        result.put("success", aiResult.get("success"));
        result.put("fromCache", false);
        result.put("dataVersion", "enhanced_v2"); // 标记使用增强版数据

        // 如果AI调用失败，添加错误信息
        if (aiResult.containsKey("error")) {
            result.put("error", aiResult.get("error"));
            result.put("errorDetail", aiResult.get("errorDetail"));
        }

        // 5. 保存到缓存（仅对成功的初次分析）
        if (sessionId == null && customMessage == null && Boolean.TRUE.equals(aiResult.get("success"))) {
            cacheService.setAIAnalysisCache(factoryId, batchId, result);
        }

        log.info("AI成本分析完成(增强版): batchId={}, 包含原材料{}种, 设备{}台, 人工{}人次, 质检{}次",
                 batchId,
                 enhancedCostData.get("materialConsumptionCount"),
                 enhancedCostData.get("equipmentUsageCount"),
                 enhancedCostData.get("laborSessionCount"),
                 enhancedCostData.get("qualityInspectionCount"));

        return result;
    }

    /**
     * 获取AI对话历史
     */
    @Override
    public List<Map<String, Object>> getAISessionHistory(String sessionId) {
        log.info("获取AI会话历史: sessionId={}", sessionId);
        return aiAnalysisService.getSessionHistory(sessionId);
    }

    /**
     * 获取时间范围内的批次成本分析数据
     */
    @Override
    public List<Map<String, Object>> getTimeRangeBatchesCostAnalysis(
            String factoryId,
            java.time.LocalDateTime startDate,
            java.time.LocalDateTime endDate) {

        log.info("获取时间范围批次成本数据: factoryId={}, startDate={}, endDate={}",
                factoryId, startDate, endDate);

        // 1. 查询时间范围内的所有批次
        List<ProductionBatch> batches = productionBatchRepository
                .findByFactoryIdAndCreatedAtBetween(factoryId, startDate, endDate);

        log.info("查询到{}个批次", batches.size());

        // 2. 限制最大批次数量（避免Token消耗过大）
        final int MAX_BATCHES = 50;
        if (batches.size() > MAX_BATCHES) {
            log.warn("批次数量过多({})，限制为前{}个", batches.size(), MAX_BATCHES);
            batches = batches.subList(0, MAX_BATCHES);
        }

        // 3. 为每个批次获取增强的成本数据
        List<Map<String, Object>> batchesCostData = batches.stream()
                .map(batch -> {
                    try {
                        Map<String, Object> costData = getEnhancedBatchCostAnalysis(factoryId, batch.getId());
                        // 添加批次基本信息
                        costData.put("batchNumber", batch.getBatchNumber());
                        costData.put("productName", batch.getProductName());
                        costData.put("status", batch.getStatus());
                        costData.put("createdAt", batch.getCreatedAt());
                        return costData;
                    } catch (Exception e) {
                        log.error("获取批次成本数据失败: batchId={}, error={}",
                                batch.getId(), e.getMessage());
                        return null;
                    }
                })
                .filter(data -> data != null)
                .collect(java.util.stream.Collectors.toList());

        log.info("成功获取{}个批次的成本数据", batchesCostData.size());

        return batchesCostData;
    }

    /**
     * 获取多个批次的对比分析数据
     */
    @Override
    public List<Map<String, Object>> getComparativeBatchesCostAnalysis(
            String factoryId,
            List<String> batchIds) {

        log.info("获取批次对比分析数据: factoryId={}, batchIds={}", factoryId, batchIds);

        // 1. 参数校验：确保批次数量在2-5之间
        if (batchIds == null || batchIds.size() < 2) {
            throw new IllegalArgumentException("至少需要2个批次进行对比分析");
        }
        if (batchIds.size() > 5) {
            throw new IllegalArgumentException("最多支持5个批次进行对比分析");
        }

        // 2. 为每个批次获取增强的成本数据
        List<Map<String, Object>> comparativeBatchesData = batchIds.stream()
                .map(batchId -> {
                    try {
                        // 获取批次基本信息
                        ProductionBatch batch = productionBatchRepository.findByIdAndFactoryId(batchId, factoryId)
                                .orElseThrow(() -> new RuntimeException("批次不存在: " + batchId));

                        // 获取增强的成本数据
                        Map<String, Object> costData = getEnhancedBatchCostAnalysis(factoryId, batchId);

                        // 添加批次基本信息
                        costData.put("batchId", batch.getId());
                        costData.put("batchNumber", batch.getBatchNumber());
                        costData.put("productName", batch.getProductName());
                        costData.put("status", batch.getStatus());
                        costData.put("createdAt", batch.getCreatedAt());

                        log.info("成功获取批次{}的成本数据", batchId);
                        return costData;

                    } catch (Exception e) {
                        log.error("获取批次成本数据失败: batchId={}, error={}", batchId, e.getMessage());
                        return null;
                    }
                })
                .filter(data -> data != null)
                .collect(java.util.stream.Collectors.toList());

        // 3. 校验：确保所有批次数据都获取成功
        if (comparativeBatchesData.size() < 2) {
            throw new RuntimeException("至少需要2个有效批次数据才能进行对比分析");
        }

        log.info("成功获取{}个批次的对比数据", comparativeBatchesData.size());

        return comparativeBatchesData;
    }

    /**
     * AI服务健康检查
     */
    @Override
    public Map<String, Object> checkAIServiceHealth() {
        log.info("检查AI服务健康状态");
        return aiAnalysisService.healthCheck();
    }
}
