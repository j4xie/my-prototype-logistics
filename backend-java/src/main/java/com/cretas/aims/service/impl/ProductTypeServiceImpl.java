package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.producttype.ProductTypeDTO;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.service.ProductTypeService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 产品类型服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
public class ProductTypeServiceImpl implements ProductTypeService {

    private static final Logger log = LoggerFactory.getLogger(ProductTypeServiceImpl.class);

    private final ProductTypeRepository productTypeRepository;
    private final ObjectMapper objectMapper;

    // Manual constructor (Lombok @RequiredArgsConstructor not working)
    public ProductTypeServiceImpl(ProductTypeRepository productTypeRepository, ObjectMapper objectMapper) {
        this.productTypeRepository = productTypeRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    @CacheEvict(value = "productTypes", key = "#factoryId")
    public ProductTypeDTO createProductType(String factoryId, ProductTypeDTO dto) {
        // 如果没有提供 code，自动生成 SKU
        if (dto.getCode() == null || dto.getCode().trim().isEmpty()) {
            long count = productTypeRepository.countByFactoryId(factoryId);
            String generatedCode = String.format("PT-%s-%03d", factoryId, count + 1);
            dto.setCode(generatedCode);
            log.info("自动生成产品代码: {}", generatedCode);
        }

        log.info("创建产品类型: factoryId={}, code={}", factoryId, dto.getCode());

        // 检查产品编码是否已存在
        if (productTypeRepository.existsByFactoryIdAndCode(factoryId, dto.getCode())) {
            throw new BusinessException("产品编码已存在: " + dto.getCode());
        }

        ProductType productType = new ProductType();
        productType.setId(java.util.UUID.randomUUID().toString());
        productType.setFactoryId(factoryId);
        productType.setCode(dto.getCode());
        productType.setName(dto.getName());
        productType.setCategory(dto.getCategory());
        productType.setUnit(dto.getUnit());
        productType.setUnitPrice(dto.getUnitPrice());
        productType.setProductionTimeMinutes(dto.getProductionTimeMinutes());
        productType.setShelfLifeDays(dto.getShelfLifeDays());
        productType.setPackageSpec(dto.getPackageSpec());
        productType.setNotes(dto.getNotes());
        productType.setIsActive(true);
        productType.setCreatedBy(dto.getCreatedBy() != null ? Long.valueOf(dto.getCreatedBy()) : null);
        productType.setCreatedAt(LocalDateTime.now());
        productType.setUpdatedAt(LocalDateTime.now());

        // Sprint 2 S2-1: Form Template Association
        productType.setFormTemplateId(dto.getFormTemplateId());

        // Sprint 2 S2-5: SOP Configuration Association
        productType.setDefaultSopConfigId(dto.getDefaultSopConfigId());

        // Phase 5: SKU Configuration fields
        productType.setWorkHours(dto.getWorkHours() != null ? dto.getWorkHours() : BigDecimal.ONE);
        productType.setComplexityScore(dto.getComplexityScore() != null ? dto.getComplexityScore() : 3);
        productType.setProcessingSteps(serializeToJson(dto.getProcessingSteps()));
        productType.setSkillRequirements(serializeToJson(dto.getSkillRequirements()));
        productType.setEquipmentIds(serializeToJson(dto.getEquipmentIds()));
        productType.setQualityCheckIds(serializeToJson(dto.getQualityCheckIds()));

        // Custom Form Schema Configuration
        productType.setCustomSchemaOverrides(dto.getCustomSchemaOverrides());

        productType = productTypeRepository.save(productType);
        log.info("产品类型创建成功: id={}", productType.getId());

        return convertToDTO(productType);
    }

    @Override
    @Transactional
    @CacheEvict(value = "productTypes", key = "#factoryId")
    public ProductTypeDTO updateProductType(String factoryId, String id, ProductTypeDTO dto) {
        log.info("更新产品类型: factoryId={}, id={}", factoryId, id);

        ProductType productType = productTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("产品类型不存在: " + id));

        if (!productType.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权限操作此产品类型");
        }

        // 检查产品编码是否重复
        if (dto.getCode() != null && !dto.getCode().equals(productType.getCode())) {
            if (productTypeRepository.existsByFactoryIdAndCode(factoryId, dto.getCode())) {
                throw new BusinessException("产品编码已存在: " + dto.getCode());
            }
            productType.setCode(dto.getCode());
        }

        // 更新其他字段
        if (dto.getName() != null) productType.setName(dto.getName());
        if (dto.getCategory() != null) productType.setCategory(dto.getCategory());
        if (dto.getUnit() != null) productType.setUnit(dto.getUnit());
        if (dto.getUnitPrice() != null) productType.setUnitPrice(dto.getUnitPrice());
        if (dto.getProductionTimeMinutes() != null) productType.setProductionTimeMinutes(dto.getProductionTimeMinutes());
        if (dto.getShelfLifeDays() != null) productType.setShelfLifeDays(dto.getShelfLifeDays());
        if (dto.getPackageSpec() != null) productType.setPackageSpec(dto.getPackageSpec());
        if (dto.getNotes() != null) productType.setNotes(dto.getNotes());
        if (dto.getIsActive() != null) productType.setIsActive(dto.getIsActive());

        // Sprint 2 S2-1: Form Template Association
        if (dto.getFormTemplateId() != null) productType.setFormTemplateId(dto.getFormTemplateId());

        // Sprint 2 S2-5: SOP Configuration Association
        if (dto.getDefaultSopConfigId() != null) productType.setDefaultSopConfigId(dto.getDefaultSopConfigId());

        // Phase 5: SKU Configuration fields
        if (dto.getWorkHours() != null) productType.setWorkHours(dto.getWorkHours());
        if (dto.getComplexityScore() != null) productType.setComplexityScore(dto.getComplexityScore());
        if (dto.getProcessingSteps() != null) productType.setProcessingSteps(serializeToJson(dto.getProcessingSteps()));
        if (dto.getSkillRequirements() != null) productType.setSkillRequirements(serializeToJson(dto.getSkillRequirements()));
        if (dto.getEquipmentIds() != null) productType.setEquipmentIds(serializeToJson(dto.getEquipmentIds()));
        if (dto.getQualityCheckIds() != null) productType.setQualityCheckIds(serializeToJson(dto.getQualityCheckIds()));

        // Custom Form Schema Configuration
        if (dto.getCustomSchemaOverrides() != null) productType.setCustomSchemaOverrides(dto.getCustomSchemaOverrides());

        productType.setUpdatedAt(LocalDateTime.now());
        productType = productTypeRepository.save(productType);

        log.info("产品类型更新成功: id={}", productType.getId());
        return convertToDTO(productType);
    }

    @Override
    @Transactional
    @CacheEvict(value = "productTypes", key = "#factoryId")
    public void deleteProductType(String factoryId, String id) {
        log.info("删除产品类型: factoryId={}, id={}", factoryId, id);

        ProductType productType = productTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("产品类型不存在: " + id));

        if (!productType.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权限操作此产品类型");
        }

        // TODO: 检查是否有关联的生产计划
        // if (productType.getProductionPlans() != null && !productType.getProductionPlans().isEmpty()) {
        //     throw new BusinessException("产品类型有关联的生产计划，无法删除");
        // }

        productTypeRepository.delete(productType);
        log.info("产品类型删除成功: id={}", id);
    }

    @Override
    public ProductTypeDTO getProductTypeById(String factoryId, String id) {
        log.info("获取产品类型详情: factoryId={}, id={}", factoryId, id);

        ProductType productType = productTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("产品类型不存在: " + id));

        if (!productType.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权限查看此产品类型");
        }

        return convertToDTO(productType);
    }

    @Override
    public PageResponse<ProductTypeDTO> getProductTypes(String factoryId, PageRequest pageRequest) {
        log.info("获取产品类型列表: factoryId={}, page={}, size={}",
                factoryId, pageRequest.getPage(), pageRequest.getSize());

        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<ProductType> page = productTypeRepository.findByFactoryId(factoryId, pageable);
        List<ProductTypeDTO> dtos = page.getContent().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());

        return PageResponse.of(
                dtos,
                pageRequest.getPage(),
                pageRequest.getSize(),
                page.getTotalElements()
        );
    }

    @Override
    @Cacheable(value = "productTypes", key = "#factoryId")
    public List<ProductTypeDTO> getActiveProductTypes(String factoryId) {
        log.info("获取激活的产品类型: factoryId={}", factoryId);

        List<ProductType> productTypes = productTypeRepository.findByFactoryIdAndIsActive(factoryId, true);
        return productTypes.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<ProductTypeDTO> getProductTypesByCategory(String factoryId, String category) {
        log.info("根据类别获取产品类型: factoryId={}, category={}", factoryId, category);

        List<ProductType> productTypes = productTypeRepository.findByFactoryIdAndCategory(factoryId, category);
        return productTypes.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public PageResponse<ProductTypeDTO> searchProductTypes(String factoryId, String keyword, PageRequest pageRequest) {
        log.info("搜索产品类型: factoryId={}, keyword={}", factoryId, keyword);

        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<ProductType> page = productTypeRepository.searchProductTypes(factoryId, keyword, pageable);
        List<ProductTypeDTO> dtos = page.getContent().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());

        return PageResponse.of(
                dtos,
                pageRequest.getPage(),
                pageRequest.getSize(),
                page.getTotalElements()
        );
    }

    @Override
    public List<String> getProductCategories(String factoryId) {
        log.info("获取产品类别列表: factoryId={}", factoryId);

        return productTypeRepository.findByFactoryId(factoryId).stream()
                .map(ProductType::getCategory)
                .filter(category -> category != null && !category.isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void updateProductTypesStatus(String factoryId, List<String> ids, Boolean isActive) {
        log.info("批量更新产品类型状态: factoryId={}, ids={}, isActive={}", factoryId, ids, isActive);

        for (String id : ids) {
            ProductType productType = productTypeRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("产品类型不存在: " + id));

            if (!productType.getFactoryId().equals(factoryId)) {
                throw new BusinessException("无权限操作产品类型: " + id);
            }

            productType.setIsActive(isActive);
            productType.setUpdatedAt(LocalDateTime.now());
            productTypeRepository.save(productType);
        }

        log.info("批量更新产品类型状态成功: count={}", ids.size());
    }

    @Override
    public boolean checkCodeExists(String factoryId, String code, String excludeId) {
        log.info("检查产品编码是否存在: factoryId={}, code={}, excludeId={}", factoryId, code, excludeId);

        if (excludeId != null) {
            ProductType existing = productTypeRepository.findByFactoryIdAndCode(factoryId, code).orElse(null);
            return existing != null && !existing.getId().equals(excludeId);
        }

        return productTypeRepository.existsByFactoryIdAndCode(factoryId, code);
    }

    @Override
    @Transactional
    public void initializeDefaultProductTypes(String factoryId) {
        log.info("初始化默认产品类型: factoryId={}", factoryId);

        // 检查是否已有产品类型
        long count = productTypeRepository.countByFactoryId(factoryId);
        if (count > 0) {
            log.info("工厂已有产品类型，跳过初始化: count={}", count);
            return;
        }

        // 创建默认产品类型
        List<ProductType> defaultTypes = Arrays.asList(
                createDefaultProductType(factoryId, "P001", "面包", "烘焙", "个", BigDecimal.valueOf(5.00), 120, 3),
                createDefaultProductType(factoryId, "P002", "蛋糕", "烘焙", "个", BigDecimal.valueOf(25.00), 180, 5),
                createDefaultProductType(factoryId, "P003", "饼干", "烘焙", "盒", BigDecimal.valueOf(15.00), 60, 30),
                createDefaultProductType(factoryId, "P004", "月饼", "糕点", "盒", BigDecimal.valueOf(50.00), 240, 60),
                createDefaultProductType(factoryId, "P005", "牛奶", "乳制品", "瓶", BigDecimal.valueOf(8.00), 30, 7)
        );

        productTypeRepository.saveAll(defaultTypes);
        log.info("默认产品类型初始化成功: count={}", defaultTypes.size());
    }

    private ProductType createDefaultProductType(String factoryId, String code, String name,
                                                 String category, String unit, BigDecimal price,
                                                 Integer productionTime, Integer shelfLife) {
        ProductType productType = new ProductType();
        productType.setFactoryId(factoryId);
        productType.setCode(code);
        productType.setName(name);
        productType.setCategory(category);
        productType.setUnit(unit);
        productType.setUnitPrice(price);
        productType.setProductionTimeMinutes(productionTime);
        productType.setShelfLifeDays(shelfLife);
        productType.setIsActive(true);
        productType.setCreatedBy(1L); // 系统创建
        productType.setCreatedAt(LocalDateTime.now());
        productType.setUpdatedAt(LocalDateTime.now());
        return productType;
    }

    private ProductTypeDTO convertToDTO(ProductType productType) {
        return ProductTypeDTO.builder()
                .id(productType.getId())
                .factoryId(productType.getFactoryId())
                .code(productType.getCode())
                .name(productType.getName())
                .category(productType.getCategory())
                .unit(productType.getUnit())
                .unitPrice(productType.getUnitPrice())
                .productionTimeMinutes(productType.getProductionTimeMinutes())
                .shelfLifeDays(productType.getShelfLifeDays())
                .packageSpec(productType.getPackageSpec())
                .isActive(productType.getIsActive())
                .notes(productType.getNotes())
                .createdBy(productType.getCreatedBy())
                .createdAt(productType.getCreatedAt())
                .updatedAt(productType.getUpdatedAt())
                // Sprint 2 S2-1: Form Template Association
                .formTemplateId(productType.getFormTemplateId())
                // Sprint 2 S2-5: SOP Configuration Association
                .defaultSopConfigId(productType.getDefaultSopConfigId())
                // Phase 5: SKU Configuration fields
                .workHours(productType.getWorkHours())
                .complexityScore(productType.getComplexityScore())
                .processingSteps(parseProcessingSteps(productType.getProcessingSteps()))
                .skillRequirements(parseSkillRequirements(productType.getSkillRequirements()))
                .equipmentIds(parseStringList(productType.getEquipmentIds()))
                .qualityCheckIds(parseStringList(productType.getQualityCheckIds()))
                // Custom Form Schema Configuration
                .customSchemaOverrides(productType.getCustomSchemaOverrides())
                .build();
    }

    // ==================== Phase 5: JSON Serialization/Deserialization Helpers ====================

    /**
     * Serialize object to JSON string
     */
    private String serializeToJson(Object obj) {
        if (obj == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.error("JSON序列化失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Parse processing steps from JSON string
     */
    private List<ProductTypeDTO.ProcessingStepDTO> parseProcessingSteps(String json) {
        if (json == null || json.isEmpty() || "[]".equals(json)) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json,
                    new TypeReference<List<ProductTypeDTO.ProcessingStepDTO>>() {});
        } catch (JsonProcessingException e) {
            log.error("解析 processingSteps JSON 失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Parse skill requirements from JSON string
     */
    private ProductTypeDTO.SkillRequirementDTO parseSkillRequirements(String json) {
        if (json == null || json.isEmpty() || "{}".equals(json)) {
            return null;
        }
        try {
            return objectMapper.readValue(json, ProductTypeDTO.SkillRequirementDTO.class);
        } catch (JsonProcessingException e) {
            log.error("解析 skillRequirements JSON 失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Parse string list from JSON string
     */
    private List<String> parseStringList(String json) {
        if (json == null || json.isEmpty() || "[]".equals(json)) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            log.error("解析 JSON 数组失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
}
