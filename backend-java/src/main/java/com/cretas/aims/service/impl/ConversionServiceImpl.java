package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ConversionDTO;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.MaterialProductConversion;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.ConversionRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.service.ConversionService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
        conversion.calculateStandardUsage();
        conversion = conversionRepository.save(conversion);
        return convertToDTO(conversion, materialType, productType);
    }

    @Override
    @Transactional
    public ConversionDTO updateConversion(String factoryId, Integer id, ConversionDTO dto) {
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

        // 更新字段
        conversion.setMaterialTypeId(dto.getMaterialTypeId());
        conversion.setProductTypeId(dto.getProductTypeId());
        conversion.setConversionRate(dto.getConversionRate());
        conversion.setWastageRate(dto.getWastageRate());
        conversion.setMinBatchSize(dto.getMinBatchSize());
        conversion.setMaxBatchSize(dto.getMaxBatchSize());
        conversion.setIsActive(dto.getIsActive());
        conversion.setNotes(dto.getNotes());
        conversion.calculateStandardUsage();
        conversion = conversionRepository.save(conversion);

        // 获取原材料和产品类型
        RawMaterialType materialType = materialTypeRepository.findById(dto.getMaterialTypeId()).orElse(null);
        ProductType productType = productTypeRepository.findById(dto.getProductTypeId()).orElse(null);
        return convertToDTO(conversion, materialType, productType);
    }

    @Override
    @Transactional
    public void deleteConversion(String factoryId, Integer id) {
        log.info("删除转换率配置: factoryId={}, id={}", factoryId, id);
        MaterialProductConversion conversion = conversionRepository.findById(id)
                .orElseThrow(() -> new BusinessException("转换率配置不存在"));
        if (!conversion.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权访问该转换率配置");
        }
        conversionRepository.delete(conversion);
    }

    @Override
    @Transactional(readOnly = true)
    public ConversionDTO getConversion(String factoryId, Integer id) {
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
            page = conversionRepository.findByFactoryId(factoryId, pageable);
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
        Map<Long, ProductType> productTypeMap = productTypeRepository.findAllById(productTypeIds).stream()
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
        Map<Long, ProductType> productTypeMap = productTypeRepository.findAllById(productTypeIds).stream()
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
        Map<Long, ProductType> productTypeMap = productTypeRepository.findAllById(productTypeIds).stream()
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
    public void updateActiveStatus(String factoryId, List<Integer> ids, Boolean isActive) {
        log.info("批量更新转换率激活状态: factoryId={}, ids={}, isActive={}", factoryId, ids, isActive);

        for (Integer id : ids) {
            MaterialProductConversion conversion = conversionRepository.findById(id).orElse(null);
            if (conversion != null && conversion.getFactoryId().equals(factoryId)) {
                conversion.setIsActive(isActive);
                conversionRepository.save(conversion);
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
        Map<Long, ProductType> productTypeMap = productTypeRepository.findAllById(productTypeIds).stream()
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
}
