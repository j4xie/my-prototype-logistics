package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ConversionDTO;
import com.cretas.aims.dto.ConversionChangeHistoryDTO;
import com.cretas.aims.dto.ConversionHistoryAnalysisDTO;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.ConversionChangeHistory;
import com.cretas.aims.entity.MaterialProductConversion;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.MaterialConsumption;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.ChangeType;
import com.cretas.aims.entity.enums.ProductionBatchStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.ConversionRepository;
import com.cretas.aims.repository.ConversionChangeHistoryRepository;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.MaterialConsumptionRepository;
import com.cretas.aims.repository.ProductionBatchRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.ConversionService;
import com.cretas.aims.utils.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
/**
 * 转换率管理服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
@RequiredArgsConstructor
public class ConversionServiceImpl implements ConversionService {
    private static final Logger log = LoggerFactory.getLogger(ConversionServiceImpl.class);

    private final ConversionRepository conversionRepository;
    private final RawMaterialTypeRepository materialTypeRepository;
    private final ProductTypeRepository productTypeRepository;
    private final ProductionBatchRepository productionBatchRepository;
    private final MaterialConsumptionRepository materialConsumptionRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final ConversionChangeHistoryRepository historyRepository;
    private final UserRepository userRepository;
    @Override
    @Transactional
    public ConversionDTO createConversion(String factoryId, ConversionDTO dto) {
        log.info("创建转换率配置: factoryId={}, materialTypeId={}, productTypeId={}",
                factoryId, dto.getMaterialTypeId(), dto.getProductTypeId());
        // 检查是否已存在相同配置
        if (conversionRepository.existsByFactoryIdAndMaterialTypeIdAndProductTypeId(
                factoryId, dto.getMaterialTypeId(), dto.getProductTypeId())) {
            throw new BusinessException("该转换率配置已存在");
        }
        // 验证原材料类型存在
        RawMaterialType materialType = materialTypeRepository.findById(dto.getMaterialTypeId())
                .orElseThrow(() -> new BusinessException("原材料类型不存在"));
        // 验证产品类型存在
        ProductType productType = productTypeRepository.findById(dto.getProductTypeId())
                .orElseThrow(() -> new BusinessException("产品类型不存在"));
        MaterialProductConversion conversion = new MaterialProductConversion();
        conversion.setFactoryId(factoryId);
        conversion.setMaterialTypeId(dto.getMaterialTypeId());
        conversion.setProductTypeId(dto.getProductTypeId());
        conversion.setConversionRate(dto.getConversionRate());
        conversion.setWastageRate(dto.getWastageRate() != null ? dto.getWastageRate() : BigDecimal.ZERO);
        conversion.setMinBatchSize(dto.getMinBatchSize());
        conversion.setMaxBatchSize(dto.getMaxBatchSize());
        conversion.setIsActive(dto.getIsActive() != null ? dto.getIsActive() : true);
        conversion.setNotes(dto.getNotes());
        // standardUsage 由 @PrePersist/@PreUpdate 自动计算
        conversion = conversionRepository.save(conversion);

        // 记录创建历史
        recordHistory(conversion, null, conversion.getConversionRate(),
                null, conversion.getWastageRate(), ChangeType.CREATE, null);

        return convertToDTO(conversion, materialType, productType);
    }

    @Override
    @Transactional
    public ConversionDTO updateConversion(String factoryId, String id, ConversionDTO dto) {
        log.info("更新转换率配置: factoryId={}, id={}", factoryId, id);
        MaterialProductConversion conversion = conversionRepository.findById(id)
                .orElseThrow(() -> new BusinessException("转换率配置不存在"));
        if (!conversion.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该转换率配置");
        }

        // 如果要更改原材料或产品类型，检查是否会重复
        if (!conversion.getMaterialTypeId().equals(dto.getMaterialTypeId()) ||
            !conversion.getProductTypeId().equals(dto.getProductTypeId())) {
            if (conversionRepository.existsByFactoryIdAndMaterialTypeIdAndProductTypeId(
                    factoryId, dto.getMaterialTypeId(), dto.getProductTypeId())) {
                throw new BusinessException("该转换率配置已存在");
            }
        }

        // 记录更新前的值
        BigDecimal oldRate = conversion.getConversionRate();
        BigDecimal oldWastage = conversion.getWastageRate();

        // 更新字段
        conversion.setMaterialTypeId(dto.getMaterialTypeId());
        conversion.setProductTypeId(dto.getProductTypeId());
        conversion.setConversionRate(dto.getConversionRate());
        conversion.setWastageRate(dto.getWastageRate() != null ? dto.getWastageRate() : BigDecimal.ZERO);
        conversion.setMinBatchSize(dto.getMinBatchSize());
        conversion.setMaxBatchSize(dto.getMaxBatchSize());
        conversion.setIsActive(dto.getIsActive() != null ? dto.getIsActive() : true);
        conversion.setNotes(dto.getNotes());
        // standardUsage 由 @PrePersist/@PreUpdate 自动计算
        conversion = conversionRepository.save(conversion);

        // 记录更新历史（仅当转换率或损耗率发生变化时）
        boolean rateChanged = !Objects.equals(oldRate, dto.getConversionRate());
        boolean wastageChanged = !Objects.equals(oldWastage, dto.getWastageRate());
        if (rateChanged || wastageChanged) {
            recordHistory(conversion, oldRate, conversion.getConversionRate(),
                    oldWastage, conversion.getWastageRate(), ChangeType.UPDATE, dto.getNotes());
        }

        // 获取原材料和产品类型
        RawMaterialType materialType = materialTypeRepository.findById(dto.getMaterialTypeId()).orElse(null);
        ProductType productType = productTypeRepository.findById(dto.getProductTypeId()).orElse(null);
        return convertToDTO(conversion, materialType, productType);
    }

    @Override
    @Transactional
    public void deleteConversion(String factoryId, String id) {
        log.info("删除转换率配置: factoryId={}, id={}", factoryId, id);
        MaterialProductConversion conversion = conversionRepository.findById(id)
                .orElseThrow(() -> new BusinessException("转换率配置不存在"));
        if (!conversion.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该转换率配置");
        }

        // 记录删除历史（在删除前记录）
        recordHistory(conversion, conversion.getConversionRate(), null,
                conversion.getWastageRate(), null, ChangeType.DELETE, null);

        conversionRepository.delete(conversion);
    }

    @Override
    @Transactional(readOnly = true)
    public ConversionDTO getConversion(String factoryId, String id) {
        MaterialProductConversion conversion = conversionRepository.findById(id)
                .orElseThrow(() -> new BusinessException("转换率配置不存在"));
        if (!conversion.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该转换率配置");
        }
        RawMaterialType materialType = materialTypeRepository.findById(conversion.getMaterialTypeId()).orElse(null);
        ProductType productType = productTypeRepository.findById(conversion.getProductTypeId()).orElse(null);
        return convertToDTO(conversion, materialType, productType);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ConversionDTO> getConversions(String factoryId, Boolean isActive, Pageable pageable) {
        Page<MaterialProductConversion> page;
        if (isActive != null) {
            page = conversionRepository.findByFactoryIdAndIsActive(factoryId, isActive, pageable);
        } else {
            page = conversionRepository.findByFactoryId(factoryId, null);
        }

        // 批量预加载材料和产品类型 - 避免N+1查询
        Set<String> materialTypeIds = page.getContent().stream()
                .map(MaterialProductConversion::getMaterialTypeId)
                .collect(Collectors.toSet());
        Set<String> productTypeIds = page.getContent().stream()
                .map(MaterialProductConversion::getProductTypeId)
                .collect(Collectors.toSet());

        Map<String, RawMaterialType> materialTypeMap = materialTypeRepository.findAllById(materialTypeIds).stream()
                .collect(Collectors.toMap(RawMaterialType::getId, m -> m));
        Map<String, ProductType> productTypeMap = productTypeRepository.findAllById(productTypeIds).stream()
                .collect(Collectors.toMap(ProductType::getId, p -> p));

        List<ConversionDTO> dtos = page.getContent().stream()
                .map(conversion -> {
                    RawMaterialType materialType = materialTypeMap.get(conversion.getMaterialTypeId());
                    ProductType productType = productTypeMap.get(conversion.getProductTypeId());
                    return convertToDTO(conversion, materialType, productType);
                })
                .collect(Collectors.toList());

        return PageResponse.of(dtos, page.getNumber(), page.getSize(), page.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConversionDTO> getConversionsByMaterial(String factoryId, String materialTypeId) {
        log.info("根据原材料获取转换率列表: factoryId={}, materialTypeId={}", factoryId, materialTypeId);

        List<MaterialProductConversion> conversions = conversionRepository.findByFactoryIdAndMaterialTypeId(
                factoryId, materialTypeId);

        // 批量预加载 - 避免N+1查询
        RawMaterialType materialType = materialTypeRepository.findById(materialTypeId).orElse(null);
        Set<String> productTypeIds = conversions.stream()
                .map(MaterialProductConversion::getProductTypeId)
                .collect(Collectors.toSet());
        Map<String, ProductType> productTypeMap = productTypeRepository.findAllById(productTypeIds).stream()
                .collect(Collectors.toMap(ProductType::getId, p -> p));

        return conversions.stream()
                .map(conversion -> {
                    ProductType productType = productTypeMap.get(conversion.getProductTypeId());
                    return convertToDTO(conversion, materialType, productType);
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConversionDTO> getConversionsByProduct(String factoryId, String productTypeId) {
        log.info("根据产品获取转换率列表: factoryId={}, productTypeId={}", factoryId, productTypeId);

        List<MaterialProductConversion> conversions = conversionRepository.findByFactoryIdAndProductTypeId(
                factoryId, productTypeId);

        // 批量预加载 - 避免N+1查询
        ProductType productType = productTypeRepository.findById(productTypeId).orElse(null);
        Set<String> materialTypeIds = conversions.stream()
                .map(MaterialProductConversion::getMaterialTypeId)
                .collect(Collectors.toSet());
        Map<String, RawMaterialType> materialTypeMap = materialTypeRepository.findAllById(materialTypeIds).stream()
                .collect(Collectors.toMap(RawMaterialType::getId, m -> m));

        return conversions.stream()
                .map(conversion -> {
                    RawMaterialType materialType = materialTypeMap.get(conversion.getMaterialTypeId());
                    return convertToDTO(conversion, materialType, productType);
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ConversionDTO getConversionRate(String factoryId, String materialTypeId, String productTypeId) {
        log.info("获取特定转换率: factoryId={}, materialTypeId={}, productTypeId={}",
                factoryId, materialTypeId, productTypeId);

        MaterialProductConversion conversion = conversionRepository
                .findByFactoryIdAndMaterialTypeIdAndProductTypeId(factoryId, materialTypeId, productTypeId)
                .orElseThrow(() -> new BusinessException("未找到对应的转换率配置"));

        RawMaterialType materialType = materialTypeRepository.findById(materialTypeId).orElse(null);
        ProductType productType = productTypeRepository.findById(productTypeId).orElse(null);

        return convertToDTO(conversion, materialType, productType);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MaterialRequirement> calculateMaterialRequirement(String factoryId, String productTypeId,
                                                                 BigDecimal productQuantity) {
        log.info("计算原材料需求: factoryId={}, productTypeId={}, quantity={}",
                factoryId, productTypeId, productQuantity);

        List<MaterialProductConversion> conversions = conversionRepository
                .findByFactoryIdAndProductTypeId(factoryId, productTypeId);

        // 批量预加载材料类型 - 避免N+1查询
        Set<String> materialTypeIds = conversions.stream()
                .map(MaterialProductConversion::getMaterialTypeId)
                .collect(Collectors.toSet());
        Map<String, RawMaterialType> materialTypeMap = materialTypeRepository.findAllById(materialTypeIds).stream()
                .collect(Collectors.toMap(RawMaterialType::getId, m -> m));

        return conversions.stream()
                .filter(MaterialProductConversion::getIsActive)
                .map(conversion -> {
                    RawMaterialType materialType = materialTypeMap.get(conversion.getMaterialTypeId());

                    MaterialRequirement requirement = new MaterialRequirement();
                    requirement.setMaterialTypeId(conversion.getMaterialTypeId());
                    requirement.setMaterialTypeName(materialType != null ? materialType.getName() : "未知");
                    requirement.setUnit(materialType != null ? materialType.getUnit() : "");

                    // 计算基础需求量
                    BigDecimal baseQuantity = conversion.calculateActualUsage(productQuantity);
                    requirement.setQuantity(baseQuantity);

                    // 计算损耗量
                    BigDecimal wastageQuantity = baseQuantity.multiply(conversion.getWastageRate())
                            .divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
                    requirement.setWastageQuantity(wastageQuantity);

                    // 总需求量 = 基础量 + 损耗量
                    requirement.setTotalQuantity(baseQuantity.add(wastageQuantity));

                    return requirement;
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductOutput> calculateProductOutput(String factoryId, String materialTypeId,
                                                     BigDecimal materialQuantity) {
        log.info("计算产品产出: factoryId={}, materialTypeId={}, quantity={}",
                factoryId, materialTypeId, materialQuantity);

        List<MaterialProductConversion> conversions = conversionRepository
                .findByFactoryIdAndMaterialTypeId(factoryId, materialTypeId);

        // 批量预加载产品类型 - 避免N+1查询
        Set<String> productTypeIds = conversions.stream()
                .map(MaterialProductConversion::getProductTypeId)
                .collect(Collectors.toSet());
        Map<String, ProductType> productTypeMap = productTypeRepository.findAllById(productTypeIds).stream()
                .collect(Collectors.toMap(ProductType::getId, p -> p));

        return conversions.stream()
                .filter(MaterialProductConversion::getIsActive)
                .map(conversion -> {
                    ProductType productType = productTypeMap.get(conversion.getProductTypeId());

                    ProductOutput output = new ProductOutput();
                    output.setProductTypeId(conversion.getProductTypeId());
                    output.setProductTypeName(productType != null ? productType.getName() : "未知");
                    output.setUnit(productType != null ? productType.getUnit() : "");

                    // 计算产出量（考虑损耗）
                    BigDecimal efficiency = BigDecimal.ONE.subtract(
                            conversion.getWastageRate().divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP));
                    BigDecimal outputQuantity = materialQuantity.multiply(conversion.getConversionRate())
                            .multiply(efficiency);
                    output.setQuantity(outputQuantity);
                    output.setEfficiency(efficiency.multiply(new BigDecimal("100")));

                    return output;
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void updateActiveStatus(String factoryId, List<String> ids, Boolean isActive) {
        log.info("批量更新转换率激活状态: factoryId={}, ids={}, isActive={}", factoryId, ids, isActive);

        for (String id : ids) {
            MaterialProductConversion conversion = conversionRepository.findById(id).orElse(null);
            if (conversion != null && conversion.getFactoryId().equals(factoryId)) {
                Boolean oldIsActive = conversion.getIsActive();
                conversion.setIsActive(isActive);
                conversionRepository.save(conversion);

                // 记录启用/停用历史（仅当状态实际发生变化时）
                if (!Objects.equals(oldIsActive, isActive)) {
                    ChangeType changeType = Boolean.TRUE.equals(isActive) ? ChangeType.ACTIVATE : ChangeType.DEACTIVATE;
                    recordHistory(conversion, conversion.getConversionRate(), conversion.getConversionRate(),
                            conversion.getWastageRate(), conversion.getWastageRate(), changeType, null);
                }
            }
        }
    }

    @Override
    @Transactional
    public List<ConversionDTO> importConversions(String factoryId, List<ConversionDTO> conversions) {
        log.info("导入转换率配置: factoryId={}, count={}", factoryId, conversions.size());

        List<ConversionDTO> results = new ArrayList<>();
        for (ConversionDTO dto : conversions) {
            try {
                // 检查是否已存在
                Optional<MaterialProductConversion> existing = conversionRepository
                        .findByFactoryIdAndMaterialTypeIdAndProductTypeId(
                                factoryId, dto.getMaterialTypeId(), dto.getProductTypeId());

                if (existing.isPresent()) {
                    // 更新现有记录
                    results.add(updateConversion(factoryId, existing.get().getId(), dto));
                } else {
                    // 创建新记录
                    results.add(createConversion(factoryId, dto));
                }
            } catch (Exception e) {
                log.error("导入转换率配置失败: {}", e.getMessage());
                // 继续处理下一条记录
            }
        }

        return results;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConversionDTO> exportConversions(String factoryId) {
        log.info("导出转换率配置: factoryId={}", factoryId);

        List<MaterialProductConversion> conversions = conversionRepository.findByFactoryId(factoryId, Pageable.unpaged()).getContent();

        // 批量预加载材料和产品类型 - 避免N+1查询
        Set<String> materialTypeIds = conversions.stream()
                .map(MaterialProductConversion::getMaterialTypeId)
                .collect(Collectors.toSet());
        Set<String> productTypeIds = conversions.stream()
                .map(MaterialProductConversion::getProductTypeId)
                .collect(Collectors.toSet());

        Map<String, RawMaterialType> materialTypeMap = materialTypeRepository.findAllById(materialTypeIds).stream()
                .collect(Collectors.toMap(RawMaterialType::getId, m -> m));
        Map<String, ProductType> productTypeMap = productTypeRepository.findAllById(productTypeIds).stream()
                .collect(Collectors.toMap(ProductType::getId, p -> p));

        return conversions.stream()
                .map(conversion -> {
                    RawMaterialType materialType = materialTypeMap.get(conversion.getMaterialTypeId());
                    ProductType productType = productTypeMap.get(conversion.getProductTypeId());
                    return convertToDTO(conversion, materialType, productType);
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ValidationResult validateConversion(String factoryId, ConversionDTO dto) {
        ValidationResult result = new ValidationResult();
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // 验证转换率
        if (dto.getConversionRate() == null || dto.getConversionRate().compareTo(BigDecimal.ZERO) <= 0) {
            errors.add("转换率必须大于0");
        }

        // 验证损耗率
        if (dto.getWastageRate() != null) {
            if (dto.getWastageRate().compareTo(BigDecimal.ZERO) < 0) {
                errors.add("损耗率不能为负数");
            }
            if (dto.getWastageRate().compareTo(new BigDecimal("100")) > 0) {
                errors.add("损耗率不能超过100%");
            }
            if (dto.getWastageRate().compareTo(new BigDecimal("50")) > 0) {
                warnings.add("损耗率超过50%，请确认是否正确");
            }
        }

        // 验证批量大小
        if (dto.getMinBatchSize() != null && dto.getMaxBatchSize() != null) {
            if (dto.getMinBatchSize().compareTo(dto.getMaxBatchSize()) > 0) {
                errors.add("最小批量不能大于最大批量");
            }
        }

        // 验证材料和产品存在性
        if (!materialTypeRepository.existsById(dto.getMaterialTypeId())) {
            errors.add("原材料类型不存在");
        }
        if (!productTypeRepository.existsById(dto.getProductTypeId())) {
            errors.add("产品类型不存在");
        }

        result.setValid(errors.isEmpty());
        result.setErrors(errors);
        result.setWarnings(warnings);

        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public ConversionStatistics getStatistics(String factoryId) {
        log.info("获取转换率统计: factoryId={}", factoryId);

        ConversionStatistics stats = new ConversionStatistics();

        // 总数统计
        List<MaterialProductConversion> allConversions = conversionRepository.findByFactoryId(factoryId, Pageable.unpaged()).getContent();
        stats.setTotalConversions(allConversions.size());
        stats.setActiveConversions(conversionRepository.countByFactoryIdAndIsActive(factoryId, true));
        stats.setInactiveConversions(conversionRepository.countByFactoryIdAndIsActive(factoryId, false));

        // 材料和产品类型统计
        Set<String> materialTypes = new HashSet<>();
        Set<String> productTypes = new HashSet<>();
        BigDecimal totalConversionRate = BigDecimal.ZERO;
        BigDecimal totalWastageRate = BigDecimal.ZERO;
        int wastageCount = 0;

        for (MaterialProductConversion conversion : allConversions) {
            materialTypes.add(conversion.getMaterialTypeId());
            productTypes.add(conversion.getProductTypeId());
            totalConversionRate = totalConversionRate.add(conversion.getConversionRate());

            if (conversion.getWastageRate() != null) {
                totalWastageRate = totalWastageRate.add(conversion.getWastageRate());
                wastageCount++;
            }
        }

        stats.setMaterialTypes(materialTypes.size());
        stats.setProductTypes(productTypes.size());

        // 平均值计算
        if (!allConversions.isEmpty()) {
            stats.setAverageConversionRate(totalConversionRate.divide(
                    new BigDecimal(allConversions.size()), 4, RoundingMode.HALF_UP));
        }

        if (wastageCount > 0) {
            stats.setAverageWastageRate(totalWastageRate.divide(
                    new BigDecimal(wastageCount), 2, RoundingMode.HALF_UP));
        }

        return stats;
    }

    @Override
    @Transactional(readOnly = true)
    public SuggestedConversion suggestConversionFromHistory(String factoryId, String materialTypeId, String productTypeId) {
        log.info("基于历史数据计算建议转换率: factoryId={}, materialTypeId={}, productTypeId={}",
                factoryId, materialTypeId, productTypeId);

        SuggestedConversion result = new SuggestedConversion();

        // 1. 查询该工厂所有已完成的生产批次（指定产品类型）
        List<ProductionBatch> completedBatches = productionBatchRepository.findByFactoryId(factoryId).stream()
                .filter(batch -> batch.getStatus() == ProductionBatchStatus.COMPLETED)
                .filter(batch -> productTypeId.equals(batch.getProductTypeId()))
                .filter(batch -> batch.getActualQuantity() != null && batch.getActualQuantity().compareTo(BigDecimal.ZERO) > 0)
                .collect(Collectors.toList());

        if (completedBatches.isEmpty()) {
            result.setHasData(false);
            result.setSampleCount(0);
            result.setMessage("暂无历史生产数据，请手动输入转换率");
            result.setConfidence("NONE");
            return result;
        }

        // 2. 收集这些批次的原料消耗记录
        BigDecimal totalMaterialConsumed = BigDecimal.ZERO;
        BigDecimal totalProductOutput = BigDecimal.ZERO;
        int validBatchCount = 0;

        for (ProductionBatch batch : completedBatches) {
            // 获取该批次的所有原料消耗记录
            List<MaterialConsumption> consumptions = materialConsumptionRepository.findByProductionBatchId(batch.getId());

            // 过滤出指定原材料类型的消耗
            BigDecimal batchMaterialConsumed = BigDecimal.ZERO;
            for (MaterialConsumption consumption : consumptions) {
                // 通过 batchId 获取 MaterialBatch，检查 materialTypeId
                Optional<MaterialBatch> materialBatchOpt = materialBatchRepository.findById(consumption.getBatchId());
                if (materialBatchOpt.isPresent()) {
                    MaterialBatch materialBatch = materialBatchOpt.get();
                    if (materialTypeId.equals(materialBatch.getMaterialTypeId())) {
                        batchMaterialConsumed = batchMaterialConsumed.add(consumption.getQuantity());
                    }
                }
            }

            // 如果该批次使用了指定原材料，计入统计
            if (batchMaterialConsumed.compareTo(BigDecimal.ZERO) > 0) {
                totalMaterialConsumed = totalMaterialConsumed.add(batchMaterialConsumed);
                totalProductOutput = totalProductOutput.add(batch.getActualQuantity());
                validBatchCount++;
            }
        }

        // 3. 计算转换率
        if (validBatchCount == 0 || totalMaterialConsumed.compareTo(BigDecimal.ZERO) == 0) {
            result.setHasData(false);
            result.setSampleCount(0);
            result.setMessage("未找到使用该原材料类型的生产记录，请手动输入转换率");
            result.setConfidence("NONE");
            return result;
        }

        // 转换率 = 产品产出量 / 原料消耗量
        BigDecimal suggestedRate = totalProductOutput.divide(totalMaterialConsumed, 4, RoundingMode.HALF_UP);

        // 损耗率 = (消耗量 - 产出量) / 消耗量 * 100
        BigDecimal wastage = totalMaterialConsumed.subtract(totalProductOutput);
        BigDecimal suggestedWastageRate = BigDecimal.ZERO;
        if (wastage.compareTo(BigDecimal.ZERO) > 0) {
            suggestedWastageRate = wastage
                    .divide(totalMaterialConsumed, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));
        }

        // 4. 设置结果
        result.setHasData(true);
        result.setSampleCount(validBatchCount);
        result.setSuggestedRate(suggestedRate);
        result.setSuggestedWastageRate(suggestedWastageRate);
        result.setTotalMaterialConsumed(totalMaterialConsumed);
        result.setTotalProductOutput(totalProductOutput);

        // 置信度判断
        if (validBatchCount >= 5) {
            result.setConfidence("HIGH");
            result.setMessage(String.format("基于 %d 个已完成批次计算，数据可靠", validBatchCount));
        } else if (validBatchCount >= 3) {
            result.setConfidence("MEDIUM");
            result.setMessage(String.format("基于 %d 个已完成批次计算，建议参考使用", validBatchCount));
        } else {
            result.setConfidence("LOW");
            result.setMessage(String.format("仅基于 %d 个批次计算，仅供参考，建议根据实际情况调整", validBatchCount));
        }

        log.info("转换率计算完成: sampleCount={}, suggestedRate={}, suggestedWastageRate={}, confidence={}",
                validBatchCount, suggestedRate, suggestedWastageRate, result.getConfidence());

        return result;
    }

    private ConversionDTO convertToDTO(MaterialProductConversion conversion, RawMaterialType materialType, ProductType productType) {
        return ConversionDTO.builder()
                .id(conversion.getId())
                .materialTypeId(conversion.getMaterialTypeId())
                .materialTypeName(materialType != null ? materialType.getName() : null)
                .materialUnit(materialType != null ? materialType.getUnit() : null)
                .productTypeId(conversion.getProductTypeId())
                .productTypeName(productType != null ? productType.getName() : null)
                .productCode(productType != null ? productType.getCode() : null)
                .productUnit(productType != null ? productType.getUnit() : null)
                .conversionRate(conversion.getConversionRate())
                .wastageRate(conversion.getWastageRate())
                .standardUsage(conversion.getStandardUsage())
                .minBatchSize(conversion.getMinBatchSize())
                .maxBatchSize(conversion.getMaxBatchSize())
                .isActive(conversion.getIsActive())
                .notes(conversion.getNotes())
                .build();
    }

    // ========== 变更历史记录相关方法 ==========

    /**
     * 记录转换率变更历史
     */
    private void recordHistory(MaterialProductConversion conversion,
                               BigDecimal oldRate, BigDecimal newRate,
                               BigDecimal oldWastage, BigDecimal newWastage,
                               ChangeType changeType, String reason) {
        try {
            Long userId = SecurityUtils.getCurrentUserId();

            ConversionChangeHistory history = new ConversionChangeHistory();
            history.setId(UUID.randomUUID().toString());
            history.setConversionId(conversion.getId());
            history.setFactoryId(conversion.getFactoryId());
            history.setMaterialTypeId(conversion.getMaterialTypeId());
            history.setProductTypeId(conversion.getProductTypeId());
            history.setChangeType(changeType);
            history.setOldConversionRate(oldRate);
            history.setNewConversionRate(newRate);
            history.setOldWastageRate(oldWastage);
            history.setNewWastageRate(newWastage);
            history.setChangedBy(userId);
            history.setReason(reason);
            history.setChangedAt(LocalDateTime.now());

            historyRepository.save(history);
            log.debug("记录转换率变更历史: conversionId={}, changeType={}", conversion.getId(), changeType);
        } catch (Exception e) {
            // 记录历史失败不应影响主业务
            log.warn("记录转换率变更历史失败: {}", e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ConversionChangeHistoryDTO> getChangeHistory(String factoryId, String conversionId, Pageable pageable) {
        log.info("获取转换率变更历史: factoryId={}, conversionId={}", factoryId, conversionId);

        // 验证转换率配置属于该工厂
        MaterialProductConversion conversion = conversionRepository.findById(conversionId).orElse(null);
        if (conversion != null && !conversion.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该转换率配置");
        }

        Page<ConversionChangeHistory> page = historyRepository.findByConversionIdOrderByChangedAtDesc(conversionId, pageable);
        List<ConversionChangeHistoryDTO> dtos = page.getContent().stream()
                .map(this::convertHistoryToDTO)
                .collect(Collectors.toList());

        return PageResponse.of(dtos, page.getNumber(), page.getSize(), page.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ConversionChangeHistoryDTO> getMaterialHistory(String factoryId, String materialTypeId, Pageable pageable) {
        log.info("获取原料类型的转换率变更历史: factoryId={}, materialTypeId={}", factoryId, materialTypeId);

        Page<ConversionChangeHistory> page = historyRepository.findByFactoryIdAndMaterialTypeIdOrderByChangedAtDesc(
                factoryId, materialTypeId, pageable);
        List<ConversionChangeHistoryDTO> dtos = page.getContent().stream()
                .map(this::convertHistoryToDTO)
                .collect(Collectors.toList());

        return PageResponse.of(dtos, page.getNumber(), page.getSize(), page.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public ConversionHistoryAnalysisDTO getHistoryForAnalysis(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取转换率变更历史分析数据: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        LocalDateTime startTime = startDate.atStartOfDay();
        LocalDateTime endTime = endDate.atTime(23, 59, 59);

        // 获取时间段内的所有变更记录
        List<ConversionChangeHistory> histories = historyRepository.findByFactoryIdAndChangedAtBetweenOrderByChangedAtAsc(
                factoryId, startTime, endTime);

        // 构建统计摘要
        ConversionHistoryAnalysisDTO.Summary summary = ConversionHistoryAnalysisDTO.Summary.builder()
                .totalChanges(histories.size())
                .createCount(historyRepository.countByFactoryIdAndChangeTypeAndChangedAtBetween(factoryId, ChangeType.CREATE, startTime, endTime))
                .updateCount(historyRepository.countByFactoryIdAndChangeTypeAndChangedAtBetween(factoryId, ChangeType.UPDATE, startTime, endTime))
                .deleteCount(historyRepository.countByFactoryIdAndChangeTypeAndChangedAtBetween(factoryId, ChangeType.DELETE, startTime, endTime))
                .materialTypeCount((int) histories.stream().map(ConversionChangeHistory::getMaterialTypeId).distinct().count())
                .productTypeCount((int) histories.stream().map(ConversionChangeHistory::getProductTypeId).distinct().count())
                .build();

        // 按转换率配置分组，构建趋势数据
        Map<String, List<ConversionChangeHistory>> byConversion = histories.stream()
                .collect(Collectors.groupingBy(ConversionChangeHistory::getConversionId));

        // 批量预加载材料和产品类型名称
        Set<String> materialTypeIds = histories.stream().map(ConversionChangeHistory::getMaterialTypeId).collect(Collectors.toSet());
        Set<String> productTypeIds = histories.stream().map(ConversionChangeHistory::getProductTypeId).collect(Collectors.toSet());
        Map<String, String> materialTypeNames = materialTypeRepository.findAllById(materialTypeIds).stream()
                .collect(Collectors.toMap(RawMaterialType::getId, RawMaterialType::getName));
        Map<String, String> productTypeNames = productTypeRepository.findAllById(productTypeIds).stream()
                .collect(Collectors.toMap(ProductType::getId, ProductType::getName));

        List<ConversionHistoryAnalysisDTO.ConversionTrend> trends = byConversion.entrySet().stream()
                .map(entry -> {
                    List<ConversionChangeHistory> conversionHistories = entry.getValue();
                    ConversionChangeHistory first = conversionHistories.get(0);

                    // 构建变更数据点
                    List<ConversionHistoryAnalysisDTO.ChangePoint> changePoints = conversionHistories.stream()
                            .map(h -> ConversionHistoryAnalysisDTO.ChangePoint.builder()
                                    .date(h.getChangedAt().toLocalDate())
                                    .rate(h.getNewConversionRate())
                                    .wastage(h.getNewWastageRate())
                                    .changeType(h.getChangeType().name())
                                    .build())
                            .collect(Collectors.toList());

                    // 计算趋势类型和平均变化
                    ConversionHistoryAnalysisDTO.TrendType trendType = calculateTrendType(conversionHistories);
                    BigDecimal avgChange = calculateAverageChange(conversionHistories);

                    // 获取当前值（最后一条记录的新值）
                    ConversionChangeHistory latest = conversionHistories.get(conversionHistories.size() - 1);

                    return ConversionHistoryAnalysisDTO.ConversionTrend.builder()
                            .materialTypeId(first.getMaterialTypeId())
                            .materialTypeName(materialTypeNames.get(first.getMaterialTypeId()))
                            .productTypeId(first.getProductTypeId())
                            .productTypeName(productTypeNames.get(first.getProductTypeId()))
                            .changes(changePoints)
                            .trend(trendType)
                            .avgChange(avgChange)
                            .currentRate(latest.getNewConversionRate())
                            .currentWastage(latest.getNewWastageRate())
                            .build();
                })
                .collect(Collectors.toList());

        return ConversionHistoryAnalysisDTO.builder()
                .period(ConversionHistoryAnalysisDTO.Period.builder()
                        .start(startDate)
                        .end(endDate)
                        .build())
                .summary(summary)
                .trends(trends)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public long getChangeCount(String conversionId) {
        return historyRepository.countByConversionId(conversionId);
    }

    /**
     * 计算趋势类型
     */
    private ConversionHistoryAnalysisDTO.TrendType calculateTrendType(List<ConversionChangeHistory> histories) {
        if (histories.size() < 2) {
            return ConversionHistoryAnalysisDTO.TrendType.STABLE;
        }

        // 过滤出有转换率变化的记录
        List<BigDecimal> rates = histories.stream()
                .filter(h -> h.getNewConversionRate() != null)
                .map(ConversionChangeHistory::getNewConversionRate)
                .collect(Collectors.toList());

        if (rates.size() < 2) {
            return ConversionHistoryAnalysisDTO.TrendType.STABLE;
        }

        // 计算变化方向
        int increases = 0;
        int decreases = 0;
        BigDecimal maxChange = BigDecimal.ZERO;

        for (int i = 1; i < rates.size(); i++) {
            BigDecimal change = rates.get(i).subtract(rates.get(i - 1));
            if (change.abs().compareTo(maxChange) > 0) {
                maxChange = change.abs();
            }
            if (change.compareTo(BigDecimal.ZERO) > 0) {
                increases++;
            } else if (change.compareTo(BigDecimal.ZERO) < 0) {
                decreases++;
            }
        }

        // 判断趋势
        int totalChanges = increases + decreases;
        if (totalChanges == 0) {
            return ConversionHistoryAnalysisDTO.TrendType.STABLE;
        }

        double increaseRatio = (double) increases / totalChanges;
        double decreaseRatio = (double) decreases / totalChanges;

        // 如果变化幅度很大且方向不一致，视为波动
        if (maxChange.compareTo(new BigDecimal("0.1")) > 0 && Math.abs(increaseRatio - decreaseRatio) < 0.3) {
            return ConversionHistoryAnalysisDTO.TrendType.VOLATILE;
        }

        if (increaseRatio > 0.6) {
            return ConversionHistoryAnalysisDTO.TrendType.INCREASING;
        } else if (decreaseRatio > 0.6) {
            return ConversionHistoryAnalysisDTO.TrendType.DECREASING;
        }

        return ConversionHistoryAnalysisDTO.TrendType.STABLE;
    }

    /**
     * 计算平均变化幅度
     */
    private BigDecimal calculateAverageChange(List<ConversionChangeHistory> histories) {
        List<BigDecimal> changes = new ArrayList<>();

        for (ConversionChangeHistory h : histories) {
            if (h.getOldConversionRate() != null && h.getNewConversionRate() != null) {
                changes.add(h.getNewConversionRate().subtract(h.getOldConversionRate()).abs());
            }
        }

        if (changes.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal sum = changes.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(new BigDecimal(changes.size()), 4, RoundingMode.HALF_UP);
    }

    /**
     * 转换历史记录为DTO
     */
    private ConversionChangeHistoryDTO convertHistoryToDTO(ConversionChangeHistory history) {
        ConversionChangeHistoryDTO dto = ConversionChangeHistoryDTO.builder()
                .id(history.getId())
                .conversionId(history.getConversionId())
                .factoryId(history.getFactoryId())
                .materialTypeId(history.getMaterialTypeId())
                .productTypeId(history.getProductTypeId())
                .changeType(history.getChangeType())
                .oldConversionRate(history.getOldConversionRate())
                .newConversionRate(history.getNewConversionRate())
                .oldWastageRate(history.getOldWastageRate())
                .newWastageRate(history.getNewWastageRate())
                .reason(history.getReason())
                .notes(history.getNotes())
                .changedBy(history.getChangedBy())
                .changedAt(history.getChangedAt())
                .createdAt(history.getCreatedAt())
                .build();

        // 计算变化量
        if (history.getOldConversionRate() != null && history.getNewConversionRate() != null) {
            dto.setConversionRateChange(history.getNewConversionRate().subtract(history.getOldConversionRate()));
        }
        if (history.getOldWastageRate() != null && history.getNewWastageRate() != null) {
            dto.setWastageRateChange(history.getNewWastageRate().subtract(history.getOldWastageRate()));
        }

        // 获取材料和产品类型名称
        materialTypeRepository.findById(history.getMaterialTypeId())
                .ifPresent(mt -> dto.setMaterialTypeName(mt.getName()));
        productTypeRepository.findById(history.getProductTypeId())
                .ifPresent(pt -> dto.setProductTypeName(pt.getName()));

        // 获取操作人用户名
        if (history.getChangedBy() != null) {
            userRepository.findById(history.getChangedBy())
                    .ifPresent(user -> dto.setChangedByUsername(user.getUsername()));
        }

        return dto;
    }
}
