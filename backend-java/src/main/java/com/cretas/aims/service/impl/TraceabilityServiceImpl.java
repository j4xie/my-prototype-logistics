package com.cretas.aims.service.impl;

import com.cretas.aims.dto.traceability.TraceabilityDTO;
import com.cretas.aims.entity.*;
import com.cretas.aims.repository.*;
import com.cretas.aims.service.TraceabilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
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
    @Transactional(readOnly = true)
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

        // 6. 生成溯源码
        String traceCode = generateTraceCode(batchNumber);

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
    @Transactional(readOnly = true)
    public TraceabilityDTO.PublicTraceResponse getPublicTrace(String batchNumber) {
        log.info("公开溯源查询: batchNumber={}", batchNumber);

        // 1. 跨工厂查找生产批次（公开查询不限制工厂）
        List<ProductionBatch> batches = productionBatchRepository.findAll().stream()
                .filter(b -> b.getBatchNumber().equals(batchNumber))
                .collect(Collectors.toList());

        if (batches.isEmpty()) {
            log.warn("公开查询未找到批次: {}", batchNumber);
            return TraceabilityDTO.PublicTraceResponse.builder()
                    .batchNumber(batchNumber)
                    .isValid(false)
                    .message("未找到该批次信息")
                    .queryTime(LocalDateTime.now())
                    .build();
        }

        ProductionBatch batch = batches.get(0);
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
                .traceCode(generateTraceCode(batchNumber))
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
     */
    private List<TraceabilityDTO.MaterialInfo> buildMaterialInfoList(List<MaterialConsumption> consumptions) {
        List<TraceabilityDTO.MaterialInfo> materials = new ArrayList<>();

        for (MaterialConsumption consumption : consumptions) {
            // 获取原材料批次信息
            Optional<MaterialBatch> materialOpt = materialBatchRepository.findById(consumption.getBatchId());
            if (materialOpt.isEmpty()) {
                continue;
            }

            MaterialBatch materialBatch = materialOpt.get();

            // 获取供应商信息
            String supplierName = "未知供应商";
            String supplierCode = "";
            if (materialBatch.getSupplierId() != null) {
                Optional<Supplier> supplierOpt = supplierRepository.findById(materialBatch.getSupplierId());
                if (supplierOpt.isPresent()) {
                    supplierName = supplierOpt.get().getName();
                    supplierCode = supplierOpt.get().getSupplierCode();
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
     */
    private List<TraceabilityDTO.QualityInfo> buildQualityInfoList(List<QualityInspection> inspections) {
        List<TraceabilityDTO.QualityInfo> qualityInfos = new ArrayList<>();

        for (QualityInspection inspection : inspections) {
            // 获取检验员名称
            String inspectorName = "检验员";
            if (inspection.getInspectorId() != null) {
                Optional<User> userOpt = userRepository.findById(inspection.getInspectorId());
                if (userOpt.isPresent()) {
                    inspectorName = userOpt.get().getFullName();
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
     */
    private List<TraceabilityDTO.ShipmentInfo> buildShipmentInfoList(List<ShipmentRecord> shipmentRecords) {
        List<TraceabilityDTO.ShipmentInfo> shipments = new ArrayList<>();

        for (ShipmentRecord record : shipmentRecords) {
            // 获取客户名称
            String customerName = "客户";
            if (record.getCustomerId() != null) {
                Optional<Customer> customerOpt = customerRepository.findById(record.getCustomerId());
                if (customerOpt.isPresent()) {
                    customerName = customerOpt.get().getName();
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
     */
    private List<TraceabilityDTO.PublicMaterialInfo> buildPublicMaterialInfoList(List<MaterialConsumption> consumptions) {
        List<TraceabilityDTO.PublicMaterialInfo> materials = new ArrayList<>();

        for (MaterialConsumption consumption : consumptions) {
            Optional<MaterialBatch> materialOpt = materialBatchRepository.findById(consumption.getBatchId());
            if (materialOpt.isEmpty()) {
                continue;
            }

            MaterialBatch materialBatch = materialOpt.get();
            String materialType = "原材料";
            if (materialBatch.getMaterialType() != null) {
                materialType = materialBatch.getMaterialType().getName();
            }

            // 获取产地信息（简化）
            String origin = "国内";
            if (materialBatch.getSupplierId() != null) {
                Optional<Supplier> supplierOpt = supplierRepository.findById(materialBatch.getSupplierId());
                if (supplierOpt.isPresent() && supplierOpt.get().getAddress() != null) {
                    // 只显示省/市级别
                    String address = supplierOpt.get().getAddress();
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
     */
    private String generateTraceCode(String batchNumber) {
        return "TRACE-" + batchNumber + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
