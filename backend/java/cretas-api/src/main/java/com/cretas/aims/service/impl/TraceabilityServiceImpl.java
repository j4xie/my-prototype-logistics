package com.cretas.aims.service.impl;

import com.cretas.aims.dto.traceability.TraceabilityDTO;
import com.cretas.aims.entity.*;
import com.cretas.aims.repository.*;
import com.cretas.aims.service.EncodingRuleService;
import com.cretas.aims.service.TraceabilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 溯源服务实现类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TraceabilityServiceImpl implements TraceabilityService {

    private final ProductionBatchRepository productionBatchRepository;
    private final MaterialConsumptionRepository materialConsumptionRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final QualityInspectionRepository qualityInspectionRepository;
    private final ShipmentRecordRepository shipmentRecordRepository;
    private final UserRepository userRepository;
    private final FactoryRepository factoryRepository;
    private final SupplierRepository supplierRepository;
    private final CustomerRepository customerRepository;
    private final EncodingRuleService encodingRuleService;

    /** 溯源码实体类型标识 */
    private static final String TRACE_CODE_ENTITY_TYPE = "TRACE_CODE";

    @Override
    @Transactional(readOnly = true)
    public TraceabilityDTO.BatchTraceResponse getBatchTrace(String factoryId, String batchNumber) {
        log.info("获取批次基础溯源信息: factoryId={}, batchNumber={}", factoryId, batchNumber);

        // 1. 查找生产批次
        Optional<ProductionBatch> batchOpt = productionBatchRepository
                .findByFactoryIdAndBatchNumber(factoryId, batchNumber);

        if (batchOpt.isEmpty()) {
            log.warn("未找到生产批次: {}", batchNumber);
            return null;
        }

        ProductionBatch batch = batchOpt.get();

        // 2. 构建生产信息
        TraceabilityDTO.ProductionInfo productionInfo = buildProductionInfo(batch, factoryId);

        // 3. 统计关联数据数量
        List<MaterialConsumption> consumptions = materialConsumptionRepository
                .findByProductionBatchId(batch.getId());
        List<QualityInspection> inspections = qualityInspectionRepository
                .findByProductionBatchId(batch.getId());
        List<ShipmentRecord> shipments = shipmentRecordRepository
                .findByFactoryIdAndBatchNumber(factoryId, batchNumber);

        // 4. 构建响应
        return TraceabilityDTO.BatchTraceResponse.builder()
                .production(productionInfo)
                .materialCount(consumptions.size())
                .inspectionCount(inspections.size())
                .shipmentCount(shipments.size())
                .qualityStatus(batch.getQualityStatus() != null ? batch.getQualityStatus().name() : "PENDING")
                .lastUpdateTime(batch.getUpdatedAt())
                .build();
    }

    @Override
    @Transactional  // 移除 readOnly=true, 因为 generateTraceCode() 会调用 incrementSequence() 写操作
    public TraceabilityDTO.FullTraceResponse getFullTrace(String factoryId, String batchNumber) {
        log.info("获取完整溯源链路: factoryId={}, batchNumber={}", factoryId, batchNumber);

        // 1. 查找生产批次
        Optional<ProductionBatch> batchOpt = productionBatchRepository
                .findByFactoryIdAndBatchNumber(factoryId, batchNumber);

        if (batchOpt.isEmpty()) {
            log.warn("未找到生产批次: {}", batchNumber);
            return null;
        }

        ProductionBatch batch = batchOpt.get();

        // 2. 构建生产信息
        TraceabilityDTO.ProductionInfo productionInfo = buildProductionInfo(batch, factoryId);

        // 3. 获取原材料消耗记录并构建材料信息
        List<MaterialConsumption> consumptions = materialConsumptionRepository
                .findByProductionBatchId(batch.getId());
        List<TraceabilityDTO.MaterialInfo> materials = buildMaterialInfoList(consumptions);

        // 4. 获取质检记录
        List<QualityInspection> inspections = qualityInspectionRepository
                .findByProductionBatchId(batch.getId());
        List<TraceabilityDTO.QualityInfo> qualityInfos = buildQualityInfoList(inspections);

        // 5. 获取出货记录
        List<ShipmentRecord> shipmentRecords = shipmentRecordRepository
                .findByFactoryIdAndBatchNumber(factoryId, batchNumber);
        List<TraceabilityDTO.ShipmentInfo> shipments = buildShipmentInfoList(shipmentRecords);

        // 6. 生成溯源码（使用工厂ID以支持配置化规则）
        String traceCode = generateTraceCode(factoryId, batchNumber);

        // 7. 构建完整响应
        return TraceabilityDTO.FullTraceResponse.builder()
                .production(productionInfo)
                .materials(materials)
                .qualityInspections(qualityInfos)
                .shipments(shipments)
                .traceCode(traceCode)
                .queryTime(LocalDateTime.now())
                .build();
    }

    @Override
    @Transactional  // 移除 readOnly=true, 因为 generateTraceCode() 会调用 incrementSequence() 写操作
    public TraceabilityDTO.PublicTraceResponse getPublicTrace(String batchNumber) {
        log.info("公开溯源查询: batchNumber={}", batchNumber);

        // 1. 跨工厂查找生产批次（公开查询不限制工厂）
        // N+1 修复：使用直接查询替代 findAll().stream().filter()
        Optional<ProductionBatch> batchOpt = productionBatchRepository.findByBatchNumber(batchNumber);

        if (batchOpt.isEmpty()) {
            log.warn("公开查询未找到批次: {}", batchNumber);
            return TraceabilityDTO.PublicTraceResponse.builder()
                    .batchNumber(batchNumber)
                    .isValid(false)
                    .message("未找到该批次信息")
                    .queryTime(LocalDateTime.now())
                    .build();
        }

        ProductionBatch batch = batchOpt.get();
        String factoryId = batch.getFactoryId();

        // 2. 获取工厂信息（脱敏）
        String factoryName = "认证工厂";
        Optional<Factory> factoryOpt = factoryRepository.findById(factoryId);
        if (factoryOpt.isPresent()) {
            factoryName = factoryOpt.get().getName();
        }

        // 3. 获取原材料信息（脱敏）
        List<MaterialConsumption> consumptions = materialConsumptionRepository
                .findByProductionBatchId(batch.getId());
        List<TraceabilityDTO.PublicMaterialInfo> publicMaterials = buildPublicMaterialInfoList(consumptions);

        // 4. 获取质检信息（脱敏）
        List<QualityInspection> inspections = qualityInspectionRepository
                .findByProductionBatchId(batch.getId());
        TraceabilityDTO.PublicQualityInfo publicQuality = null;
        if (!inspections.isEmpty()) {
            QualityInspection latestInspection = inspections.get(inspections.size() - 1);
            publicQuality = TraceabilityDTO.PublicQualityInfo.builder()
                    .inspectionDate(latestInspection.getInspectionDate().atStartOfDay())
                    .result(latestInspection.getResult())
                    .passRate(latestInspection.getPassRate() != null ?
                            latestInspection.getPassRate().doubleValue() : null)
                    .build();
        }

        // 5. 构建公开响应
        return TraceabilityDTO.PublicTraceResponse.builder()
                .productName(batch.getProductName())
                .batchNumber(batchNumber)
                .productionDate(batch.getStartTime() != null ? batch.getStartTime().toLocalDate() : null)
                .factoryName(factoryName)
                .qualityStatus(batch.getQualityStatus() != null ? batch.getQualityStatus().name() : "待检验")
                .certificationInfo("食品安全认证")
                .materials(publicMaterials)
                .qualityInspection(publicQuality)
                .traceCode(generateTraceCode(factoryId, batchNumber))
                .queryTime(LocalDateTime.now())
                .isValid(true)
                .message("溯源信息查询成功")
                .build();
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 构建生产信息
     */
    private TraceabilityDTO.ProductionInfo buildProductionInfo(ProductionBatch batch, String factoryId) {
        // 获取工厂名称
        String factoryName = factoryId;
        Optional<Factory> factoryOpt = factoryRepository.findById(factoryId);
        if (factoryOpt.isPresent()) {
            factoryName = factoryOpt.get().getName();
        }

        return TraceabilityDTO.ProductionInfo.builder()
                .batchNumber(batch.getBatchNumber())
                .productName(batch.getProductName())
                .productType(batch.getProductTypeId())
                .productionDate(batch.getStartTime() != null ? batch.getStartTime().toLocalDate() : null)
                .completionTime(batch.getEndTime())
                .supervisorName(batch.getSupervisorName())
                .equipmentName(batch.getEquipmentName())
                .quantity(batch.getActualQuantity() != null ? batch.getActualQuantity().doubleValue() : null)
                .unit(batch.getUnit())
                .qualityStatus(batch.getQualityStatus() != null ? batch.getQualityStatus().name() : "PENDING")
                .factoryName(factoryName)
                .factoryId(factoryId)
                .build();
    }

    /**
     * 构建原材料信息列表
     * N+1 修复：使用批量查询 + Map 替代循环中的单独查询
     */
    private List<TraceabilityDTO.MaterialInfo> buildMaterialInfoList(List<MaterialConsumption> consumptions) {
        if (consumptions.isEmpty()) {
            return new ArrayList<>();
        }

        // 1. 批量查询所有 MaterialBatch
        Set<String> batchIds = consumptions.stream()
                .map(MaterialConsumption::getBatchId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, MaterialBatch> batchMap = materialBatchRepository.findAllById(batchIds)
                .stream().collect(Collectors.toMap(MaterialBatch::getId, Function.identity()));

        // 2. 批量查询所有 Supplier
        Set<String> supplierIds = batchMap.values().stream()
                .map(MaterialBatch::getSupplierId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, Supplier> supplierMap = supplierIds.isEmpty() ? Collections.emptyMap() :
                supplierRepository.findAllById(supplierIds)
                        .stream().collect(Collectors.toMap(Supplier::getId, Function.identity()));

        // 3. 使用 Map 关联数据
        List<TraceabilityDTO.MaterialInfo> materials = new ArrayList<>();
        for (MaterialConsumption consumption : consumptions) {
            MaterialBatch materialBatch = batchMap.get(consumption.getBatchId());
            if (materialBatch == null) {
                continue;
            }

            // 从 Map 获取供应商信息
            String supplierName = "未知供应商";
            String supplierCode = "";
            if (materialBatch.getSupplierId() != null) {
                Supplier supplier = supplierMap.get(materialBatch.getSupplierId());
                if (supplier != null) {
                    supplierName = supplier.getName();
                    supplierCode = supplier.getSupplierCode();
                }
            }

            // 获取材料类型名称
            String materialName = materialBatch.getMaterialTypeId();
            String materialType = "原材料";
            if (materialBatch.getMaterialType() != null) {
                materialName = materialBatch.getMaterialType().getName();
                materialType = materialBatch.getMaterialType().getCategory();
            }

            materials.add(TraceabilityDTO.MaterialInfo.builder()
                    .batchNumber(materialBatch.getBatchNumber())
                    .materialName(materialName)
                    .materialType(materialType)
                    .supplierName(supplierName)
                    .supplierCode(supplierCode)
                    .receiptDate(materialBatch.getReceiptDate())
                    .expireDate(materialBatch.getExpireDate())
                    .quantity(consumption.getQuantity() != null ? consumption.getQuantity().doubleValue() : null)
                    .unit(materialBatch.getQuantityUnit())
                    .storageLocation(materialBatch.getStorageLocation())
                    .status(materialBatch.getStatus() != null ? materialBatch.getStatus().name() : "UNKNOWN")
                    .build());
        }

        return materials;
    }

    /**
     * 构建质检信息列表
     * N+1 修复：使用批量查询 + Map 替代循环中的单独查询
     */
    private List<TraceabilityDTO.QualityInfo> buildQualityInfoList(List<QualityInspection> inspections) {
        if (inspections.isEmpty()) {
            return new ArrayList<>();
        }

        // 批量查询所有检验员
        Set<Long> inspectorIds = inspections.stream()
                .map(QualityInspection::getInspectorId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, User> inspectorMap = inspectorIds.isEmpty() ? Collections.emptyMap() :
                userRepository.findAllById(inspectorIds)
                        .stream().collect(Collectors.toMap(User::getId, Function.identity()));

        // 使用 Map 关联数据
        List<TraceabilityDTO.QualityInfo> qualityInfos = new ArrayList<>();
        for (QualityInspection inspection : inspections) {
            // 从 Map 获取检验员名称
            String inspectorName = "检验员";
            if (inspection.getInspectorId() != null) {
                User inspector = inspectorMap.get(inspection.getInspectorId());
                if (inspector != null) {
                    inspectorName = inspector.getFullName();
                }
            }

            qualityInfos.add(TraceabilityDTO.QualityInfo.builder()
                    .inspectionId(inspection.getId())
                    .inspectionDate(inspection.getInspectionDate().atStartOfDay())
                    .inspectorName(inspectorName)
                    .result(inspection.getResult())
                    .passRate(inspection.getPassRate() != null ? inspection.getPassRate().doubleValue() : null)
                    .conclusion(inspection.getResult())
                    .remarks(inspection.getNotes())
                    .build());
        }

        return qualityInfos;
    }

    /**
     * 构建出货信息列表
     * N+1 修复：使用批量查询 + Map 替代循环中的单独查询
     */
    private List<TraceabilityDTO.ShipmentInfo> buildShipmentInfoList(List<ShipmentRecord> shipmentRecords) {
        if (shipmentRecords.isEmpty()) {
            return new ArrayList<>();
        }

        // 批量查询所有客户
        Set<String> customerIds = shipmentRecords.stream()
                .map(ShipmentRecord::getCustomerId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, Customer> customerMap = customerIds.isEmpty() ? Collections.emptyMap() :
                customerRepository.findAllById(customerIds)
                        .stream().collect(Collectors.toMap(Customer::getId, Function.identity()));

        // 使用 Map 关联数据
        List<TraceabilityDTO.ShipmentInfo> shipments = new ArrayList<>();
        for (ShipmentRecord record : shipmentRecords) {
            // 从 Map 获取客户名称
            String customerName = "客户";
            if (record.getCustomerId() != null) {
                Customer customer = customerMap.get(record.getCustomerId());
                if (customer != null) {
                    customerName = customer.getName();
                }
            }

            shipments.add(TraceabilityDTO.ShipmentInfo.builder()
                    .shipmentNumber(record.getShipmentNumber())
                    .shipmentDate(record.getShipmentDate())
                    .customerName(customerName)
                    .logisticsCompany(record.getLogisticsCompany())
                    .trackingNumber(record.getTrackingNumber())
                    .status(record.getStatus())
                    .quantity(record.getQuantity() != null ? record.getQuantity().doubleValue() : null)
                    .unit(record.getUnit())
                    .build());
        }

        return shipments;
    }

    /**
     * 构建公开原材料信息列表（脱敏）
     * N+1 修复：使用批量查询 + Map 替代循环中的单独查询
     */
    private List<TraceabilityDTO.PublicMaterialInfo> buildPublicMaterialInfoList(List<MaterialConsumption> consumptions) {
        if (consumptions.isEmpty()) {
            return new ArrayList<>();
        }

        // 1. 批量查询所有 MaterialBatch
        Set<String> batchIds = consumptions.stream()
                .map(MaterialConsumption::getBatchId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, MaterialBatch> batchMap = materialBatchRepository.findAllById(batchIds)
                .stream().collect(Collectors.toMap(MaterialBatch::getId, Function.identity()));

        // 2. 批量查询所有 Supplier
        Set<String> supplierIds = batchMap.values().stream()
                .map(MaterialBatch::getSupplierId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, Supplier> supplierMap = supplierIds.isEmpty() ? Collections.emptyMap() :
                supplierRepository.findAllById(supplierIds)
                        .stream().collect(Collectors.toMap(Supplier::getId, Function.identity()));

        // 3. 使用 Map 关联数据
        List<TraceabilityDTO.PublicMaterialInfo> materials = new ArrayList<>();
        for (MaterialConsumption consumption : consumptions) {
            MaterialBatch materialBatch = batchMap.get(consumption.getBatchId());
            if (materialBatch == null) {
                continue;
            }

            String materialType = "原材料";
            if (materialBatch.getMaterialType() != null) {
                materialType = materialBatch.getMaterialType().getName();
            }

            // 从 Map 获取产地信息（简化）
            String origin = "国内";
            if (materialBatch.getSupplierId() != null) {
                Supplier supplier = supplierMap.get(materialBatch.getSupplierId());
                if (supplier != null && supplier.getAddress() != null) {
                    // 只显示省/市级别
                    String address = supplier.getAddress();
                    if (address.contains("省")) {
                        origin = address.split("省")[0] + "省";
                    } else if (address.contains("市")) {
                        origin = address.split("市")[0] + "市";
                    }
                }
            }

            materials.add(TraceabilityDTO.PublicMaterialInfo.builder()
                    .materialType(materialType)
                    .origin(origin)
                    .receiptDate(materialBatch.getReceiptDate())
                    .build());
        }

        return materials;
    }

    /**
     * 生成溯源码
     *
     * 优先使用 EncodingRuleService 配置化生成溯源码
     * 如果未配置溯源码规则，则使用默认格式
     *
     * @param batchNumber 批次号
     * @return 溯源码
     */
    private String generateTraceCode(String batchNumber) {
        return generateTraceCode(null, batchNumber);
    }

    /**
     * 生成溯源码（带工厂ID）
     *
     * 优先使用 EncodingRuleService 配置化生成溯源码
     * 如果未配置溯源码规则，则使用默认格式
     *
     * @param factoryId 工厂ID（可选）
     * @param batchNumber 批次号
     * @return 溯源码
     */
    private String generateTraceCode(String factoryId, String batchNumber) {
        try {
            // 尝试使用配置化的编码规则生成溯源码
            if (factoryId != null) {
                // 使用上下文变量传递批次号信息
                Map<String, String> context = new HashMap<>();
                context.put("BATCH", batchNumber);
                return encodingRuleService.generateCode(factoryId, TRACE_CODE_ENTITY_TYPE, context);
            } else {
                // 没有工厂ID时，尝试使用系统默认规则
                return encodingRuleService.generateCode("SYSTEM", TRACE_CODE_ENTITY_TYPE);
            }
        } catch (Exception e) {
            // 如果编码规则未配置或生成失败，使用默认格式
            log.debug("使用默认溯源码格式: {}", e.getMessage());
            return "TRACE-" + batchNumber + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        }
    }
}

