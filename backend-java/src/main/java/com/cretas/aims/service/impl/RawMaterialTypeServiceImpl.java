package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.material.RawMaterialTypeDTO;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.ConversionRepository;
import com.cretas.aims.service.RawMaterialTypeService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 原材料类型服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
@RequiredArgsConstructor
public class RawMaterialTypeServiceImpl implements RawMaterialTypeService {
    private static final Logger log = LoggerFactory.getLogger(RawMaterialTypeServiceImpl.class);

    private final RawMaterialTypeRepository materialTypeRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final ConversionRepository conversionRepository;
    
    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public RawMaterialTypeDTO createMaterialType(String factoryId, RawMaterialTypeDTO dto) {
        log.info("创建原材料类型: factoryId={}, code={}", factoryId, dto.getCode());

        // 检查编码是否已存在
        if (materialTypeRepository.existsByFactoryIdAndCode(factoryId, dto.getCode())) {
            throw new BusinessException("原材料编码已存在: " + dto.getCode());
        }

        RawMaterialType materialType = new RawMaterialType();
        materialType.setFactoryId(factoryId);
        materialType.setCode(dto.getCode());
        materialType.setName(dto.getName());
        materialType.setCategory(dto.getCategory());
        materialType.setUnit(dto.getUnit());
        materialType.setUnitPrice(dto.getUnitPrice());
        materialType.setStorageType(dto.getStorageType());
        materialType.setShelfLifeDays(dto.getShelfLifeDays());
        materialType.setMinStock(dto.getMinStock());
        materialType.setMaxStock(dto.getMaxStock());
        materialType.setNotes(dto.getNotes());
        materialType.setIsActive(true);
        // 使用从Controller传入的createdBy，如果为null则使用默认值1
        materialType.setCreatedBy(dto.getCreatedBy() != null ? dto.getCreatedBy() : 1);
        materialType.setCreatedAt(LocalDateTime.now());
        materialType.setUpdatedAt(LocalDateTime.now());

        materialType = materialTypeRepository.save(materialType);

        log.info("原材料类型创建成功: id={}", materialType.getId());
        return convertToDTO(materialType);
    }

    @Override
    @Transactional
    public RawMaterialTypeDTO updateMaterialType(String factoryId, String id, RawMaterialTypeDTO dto) {
        log.info("更新原材料类型: factoryId={}, id={}", factoryId, id);

        RawMaterialType materialType = materialTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("原材料类型不存在: " + id));

        if (!materialType.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权限操作此原材料类型");
        }

        // 检查编码是否重复
        if (dto.getCode() != null && !dto.getCode().equals(materialType.getCode())) {
            if (materialTypeRepository.existsByFactoryIdAndCode(factoryId, dto.getCode())) {
                throw new BusinessException("原材料编码已存在: " + dto.getCode());
            }
            materialType.setCode(dto.getCode());
        }

        // 更新其他字段
        if (dto.getName() != null) materialType.setName(dto.getName());
        if (dto.getCategory() != null) materialType.setCategory(dto.getCategory());
        if (dto.getUnit() != null) materialType.setUnit(dto.getUnit());
        if (dto.getUnitPrice() != null) materialType.setUnitPrice(dto.getUnitPrice());
        if (dto.getStorageType() != null) materialType.setStorageType(dto.getStorageType());
        if (dto.getShelfLifeDays() != null) materialType.setShelfLifeDays(dto.getShelfLifeDays());
        if (dto.getMinStock() != null) materialType.setMinStock(dto.getMinStock());
        if (dto.getMaxStock() != null) materialType.setMaxStock(dto.getMaxStock());
        if (dto.getNotes() != null) materialType.setNotes(dto.getNotes());
        if (dto.getIsActive() != null) materialType.setIsActive(dto.getIsActive());

        materialType.setUpdatedAt(LocalDateTime.now());
        materialType = materialTypeRepository.save(materialType);

        log.info("原材料类型更新成功: id={}", materialType.getId());
        return convertToDTO(materialType);
    }

    @Override
    @Transactional
    public void deleteMaterialType(String factoryId, String id) {
        log.info("删除原材料类型: factoryId={}, id={}", factoryId, id);

        RawMaterialType materialType = materialTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("原材料类型不存在: " + id));

        if (!materialType.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权限操作此原材料类型");
        }

        // 检查是否有关联的批次（使用原生SQL查询，避免触发枚举转换错误）
        try {
            // 使用原生SQL查询count，避免加载实体时触发枚举问题
            Long batchCount = ((Number) entityManager.createNativeQuery(
                    "SELECT COUNT(*) FROM material_batches WHERE factory_id = ? AND material_type_id = ?")
                    .setParameter(1, factoryId)
                    .setParameter(2, id)
                    .getSingleResult()).longValue();
            
            if (batchCount > 0) {
                log.warn("原材料类型有关联的批次，无法删除: id={}, batchCount={}", id, batchCount);
                throw new BusinessException("原材料类型有关联的批次（" + batchCount + "个），无法删除。请先删除或转移相关批次。");
            }
        } catch (BusinessException e) {
            // 如果是业务异常（有关联数据），直接抛出
            throw e;
        } catch (Exception e) {
            // 其他异常（如SQL问题）记录日志但不阻止删除
            log.warn("检查关联批次时出错: {}", e.getMessage());
        }

        // 检查是否有关联的转换率（使用原生SQL查询，避免加载关联实体）
        try {
            // 使用原生SQL查询count，避免加载实体
            Long conversionCount = ((Number) entityManager.createNativeQuery(
                    "SELECT COUNT(*) FROM material_product_conversions WHERE factory_id = ? AND material_type_id = ?")
                    .setParameter(1, factoryId)
                    .setParameter(2, id)
                    .getSingleResult()).longValue();
            
            if (conversionCount > 0) {
                log.warn("原材料类型有关联的转换率，无法删除: id={}, conversionCount={}", id, conversionCount);
                throw new BusinessException("原材料类型有关联的转换率（" + conversionCount + "个），无法删除。请先删除相关转换率。");
            }
        } catch (BusinessException e) {
            // 如果是业务异常（有关联数据），直接抛出
            throw e;
        } catch (Exception e) {
            log.warn("检查关联转换率时出错: {}", e.getMessage());
        }

        try {
            materialTypeRepository.delete(materialType);
            log.info("原材料类型删除成功: id={}", id);
        } catch (Exception e) {
            log.error("删除原材料类型失败: id={}, error={}", id, e.getMessage(), e);
            if (e.getMessage() != null && e.getMessage().contains("foreign key constraint")) {
                throw new BusinessException("原材料类型有关联数据，无法删除。请先删除相关批次或转换率。");
            }
            throw new BusinessException("删除失败: " + e.getMessage());
        }
    }

    @Override
    public RawMaterialTypeDTO getMaterialTypeById(String factoryId, String id) {
        log.info("获取原材料类型详情: factoryId={}, id={}", factoryId, id);

        RawMaterialType materialType = materialTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("原材料类型不存在: " + id));

        if (!materialType.getFactoryId().equals(factoryId)) {
            throw new BusinessException("无权限查看此原材料类型");
        }

        return convertToDTO(materialType);
    }

    @Override
    public PageResponse<RawMaterialTypeDTO> getMaterialTypes(String factoryId, PageRequest pageRequest) {
        log.info("获取原材料类型列表: factoryId={}, page={}, size={}",
                factoryId, pageRequest.getPage(), pageRequest.getSize());

        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<RawMaterialType> page = materialTypeRepository.findByFactoryId(factoryId, pageable);

        List<RawMaterialTypeDTO> dtos = page.getContent().stream()
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
    public List<RawMaterialTypeDTO> getActiveMaterialTypes(String factoryId) {
        log.info("获取激活的原材料类型: factoryId={}", factoryId);

        List<RawMaterialType> materialTypes = materialTypeRepository.findByFactoryIdAndIsActive(factoryId, true);
        return materialTypes.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<RawMaterialTypeDTO> getMaterialTypesByCategory(String factoryId, String category) {
        log.info("根据类别获取原材料类型: factoryId={}, category={}", factoryId, category);

        List<RawMaterialType> materialTypes = materialTypeRepository.findByFactoryIdAndCategory(factoryId, category);
        return materialTypes.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<RawMaterialTypeDTO> getMaterialTypesByStorageType(String factoryId, String storageType) {
        log.info("根据存储类型获取原材料类型: factoryId={}, storageType={}", factoryId, storageType);

        List<RawMaterialType> materialTypes = materialTypeRepository.findByFactoryIdAndStorageType(factoryId, storageType);
        return materialTypes.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    public PageResponse<RawMaterialTypeDTO> searchMaterialTypes(String factoryId, String keyword, PageRequest pageRequest) {
        log.info("搜索原材料类型: factoryId={}, keyword={}", factoryId, keyword);

        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<RawMaterialType> page = materialTypeRepository.searchMaterialTypes(factoryId, keyword, pageable);

        List<RawMaterialTypeDTO> dtos = page.getContent().stream()
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
    public List<String> getMaterialCategories(String factoryId) {
        log.info("获取原材料类别列表: factoryId={}", factoryId);

        return materialTypeRepository.findByFactoryId(factoryId).stream()
                .map(RawMaterialType::getCategory)
                .filter(category -> category != null && !category.isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());
    }

    @Override
    public List<RawMaterialTypeDTO> getLowStockMaterials(String factoryId) {
        log.info("获取库存预警的原材料: factoryId={}", factoryId);

        List<RawMaterialType> materialTypes = materialTypeRepository.findMaterialTypesWithStockWarning(factoryId);
        return materialTypes.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void updateMaterialTypesStatus(String factoryId, List<String> ids, Boolean isActive) {
        log.info("批量更新原材料类型状态: factoryId={}, ids={}, isActive={}", factoryId, ids, isActive);

        for (String id : ids) {
            RawMaterialType materialType = materialTypeRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("原材料类型不存在: " + id));

            if (!materialType.getFactoryId().equals(factoryId)) {
                throw new BusinessException("无权限操作原材料类型: " + id);
            }

            materialType.setIsActive(isActive);
            materialType.setUpdatedAt(LocalDateTime.now());
            materialTypeRepository.save(materialType);
        }

        log.info("批量更新原材料类型状态成功: count={}", ids.size());
    }

    @Override
    public boolean checkCodeExists(String factoryId, String code, String excludeId) {
        log.info("检查原材料编码是否存在: factoryId={}, code={}, excludeId={}", factoryId, code, excludeId);

        if (excludeId != null) {
            RawMaterialType existing = materialTypeRepository.findByFactoryIdAndCode(factoryId, code).orElse(null);
            return existing != null && !existing.getId().equals(excludeId);
        }

        return materialTypeRepository.existsByFactoryIdAndCode(factoryId, code);
    }

    /**
     * 转换实体到DTO
     */
    private RawMaterialTypeDTO convertToDTO(RawMaterialType materialType) {
        return RawMaterialTypeDTO.builder()
                .id(materialType.getId())
                .factoryId(materialType.getFactoryId())
                .code(materialType.getCode())
                .name(materialType.getName())
                .category(materialType.getCategory())
                .unit(materialType.getUnit())
                .unitPrice(materialType.getUnitPrice())
                .storageType(materialType.getStorageType())
                .shelfLifeDays(materialType.getShelfLifeDays())
                .minStock(materialType.getMinStock())
                .maxStock(materialType.getMaxStock())
                .isActive(materialType.getIsActive())
                .notes(materialType.getNotes())
                .createdBy(materialType.getCreatedBy())
                .createdAt(materialType.getCreatedAt())
                .updatedAt(materialType.getUpdatedAt())
                .build();
    }
}
