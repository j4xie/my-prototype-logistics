package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.ImportResult;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.material.RawMaterialTypeDTO;
import com.cretas.aims.dto.materialtype.MaterialTypeExportDTO;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.ConversionRepository;
import com.cretas.aims.service.RawMaterialTypeService;
import com.cretas.aims.utils.ExcelUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.*;
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
    private final ExcelUtil excelUtil;

    @PersistenceContext
    private EntityManager entityManager;

    // ========== 系统默认原材料类型数据 ==========
    private static final List<Map<String, String>> DEFAULT_MATERIAL_TYPES = new ArrayList<>();

    static {
        // 海水鱼类
        DEFAULT_MATERIAL_TYPES.add(createDefaultMaterial("带鱼", "DY", "海水鱼", "kg", "冷冻"));
        DEFAULT_MATERIAL_TYPES.add(createDefaultMaterial("黄花鱼", "HHY", "海水鱼", "kg", "冷冻"));
        DEFAULT_MATERIAL_TYPES.add(createDefaultMaterial("鲳鱼", "CY", "海水鱼", "kg", "冷冻"));
        // 淡水鱼类
        DEFAULT_MATERIAL_TYPES.add(createDefaultMaterial("鲈鱼", "LY", "淡水鱼", "kg", "冷藏"));
        DEFAULT_MATERIAL_TYPES.add(createDefaultMaterial("草鱼", "CYU", "淡水鱼", "kg", "冷藏"));
        // 虾类
        DEFAULT_MATERIAL_TYPES.add(createDefaultMaterial("对虾", "DX", "虾类", "kg", "冷冻"));
        DEFAULT_MATERIAL_TYPES.add(createDefaultMaterial("基围虾", "JWX", "虾类", "kg", "冷藏"));
        // 贝类
        DEFAULT_MATERIAL_TYPES.add(createDefaultMaterial("扇贝", "SB", "贝类", "kg", "冷藏"));
    }

    private static Map<String, String> createDefaultMaterial(String name, String code, String category, String unit, String storageType) {
        Map<String, String> material = new HashMap<>();
        material.put("name", name);
        material.put("code", code);
        material.put("category", category);
        material.put("unit", unit);
        material.put("storageType", storageType);
        return material;
    }

    @Override
    @Transactional
    @CacheEvict(value = "materialTypes", key = "#factoryId")
    public RawMaterialTypeDTO createMaterialType(String factoryId, RawMaterialTypeDTO dto) {
        log.info("创建原材料类型: factoryId={}, code={}", factoryId, dto.getCode());

        // 检查编码是否已存在
        if (materialTypeRepository.existsByFactoryIdAndCode(factoryId, dto.getCode())) {
            throw new BusinessException("原材料编码已存在: " + dto.getCode());
        }

        RawMaterialType materialType = new RawMaterialType();
        // 生成唯一ID：如果传入了ID则使用传入的，否则自动生成
        if (dto.getId() != null && !dto.getId().isEmpty()) {
            materialType.setId(dto.getId());
        } else {
            // 使用编码作为ID前缀，加上时间戳确保唯一性
            String generatedId = "RMT_" + System.currentTimeMillis();
            materialType.setId(generatedId);
        }
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
        materialType.setCreatedBy(dto.getCreatedBy() != null ? dto.getCreatedBy() : 1L);
        materialType.setCreatedAt(LocalDateTime.now());
        materialType.setUpdatedAt(LocalDateTime.now());

        materialType = materialTypeRepository.save(materialType);

        log.info("原材料类型创建成功: id={}", materialType.getId());
        return convertToDTO(materialType);
    }

    @Override
    @Transactional
    @CacheEvict(value = "materialTypes", key = "#factoryId")
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
    @CacheEvict(value = "materialTypes", key = "#factoryId")
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
    @Cacheable(value = "materialTypes", key = "#factoryId")
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
    @CacheEvict(value = "materialTypes", key = "#factoryId")
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

    // ========== 导出导入功能 ==========

    @Override
    public byte[] exportMaterialTypes(String factoryId) {
        log.info("导出原材料类型列表: factoryId={}", factoryId);

        List<RawMaterialType> materialTypes = materialTypeRepository.findByFactoryId(factoryId);

        List<MaterialTypeExportDTO> exportDTOs = materialTypes.stream()
                .map(MaterialTypeExportDTO::fromRawMaterialType)
                .collect(Collectors.toList());

        return excelUtil.exportToExcel(exportDTOs, MaterialTypeExportDTO.class, "原材料类型列表");
    }

    @Override
    public byte[] generateImportTemplate() {
        log.info("生成原材料类型导入模板");
        return excelUtil.generateTemplate(MaterialTypeExportDTO.class, "原材料类型导入模板");
    }

    @Override
    public ImportResult<RawMaterialType> importMaterialTypesFromExcel(String factoryId, InputStream inputStream) {
        log.info("开始从Excel批量导入原材料类型: factoryId={}", factoryId);

        // 1. 解析Excel文件
        List<MaterialTypeExportDTO> excelData;
        try {
            excelData = excelUtil.importFromExcel(inputStream, MaterialTypeExportDTO.class);
        } catch (Exception e) {
            log.error("Excel文件解析失败: factoryId={}", factoryId, e);
            throw new RuntimeException("Excel文件格式错误或无法解析: " + e.getMessage());
        }

        ImportResult<RawMaterialType> result = ImportResult.create(excelData.size());

        // 2. 逐行验证并导入
        for (int i = 0; i < excelData.size(); i++) {
            MaterialTypeExportDTO exportDTO = excelData.get(i);
            int rowNumber = i + 2; // Excel行号（从2开始，1是表头）

            try {
                // 2.1 验证必填字段
                if (exportDTO.getName() == null || exportDTO.getName().trim().isEmpty()) {
                    result.addFailure(rowNumber, "原材料名称不能为空", toJsonString(exportDTO));
                    continue;
                }

                // 2.2 验证编码唯一性（如果提供了编码）
                if (exportDTO.getMaterialCode() != null && !exportDTO.getMaterialCode().trim().isEmpty()) {
                    if (materialTypeRepository.existsByFactoryIdAndCode(factoryId, exportDTO.getMaterialCode())) {
                        result.addFailure(rowNumber, "原材料编码已存在: " + exportDTO.getMaterialCode(),
                                toJsonString(exportDTO));
                        continue;
                    }
                }

                // 2.3 转换为Entity
                RawMaterialType materialType = convertFromExportDTO(exportDTO, factoryId);

                // 2.4 保存
                RawMaterialType saved = materialTypeRepository.save(materialType);

                // 2.5 记录成功
                result.addSuccess(saved);

                log.debug("成功导入原材料类型: row={}, name={}", rowNumber, exportDTO.getName());

            } catch (Exception e) {
                log.error("导入原材料类型失败: factoryId={}, row={}, data={}", factoryId, rowNumber, exportDTO, e);
                result.addFailure(rowNumber, "保存失败: " + e.getMessage(), toJsonString(exportDTO));
            }
        }

        log.info("原材料类型批量导入完成: factoryId={}, total={}, success={}, failure={}",
                factoryId, result.getTotalCount(), result.getSuccessCount(), result.getFailureCount());
        return result;
    }

    @Override
    @Transactional
    public int initializeDefaults(String factoryId) {
        log.info("初始化默认原材料类型: factoryId={}", factoryId);
        int count = 0;

        for (Map<String, String> defaultMaterial : DEFAULT_MATERIAL_TYPES) {
            String code = defaultMaterial.get("code");

            // 检查是否已存在
            if (!materialTypeRepository.existsByFactoryIdAndCode(factoryId, code)) {
                RawMaterialType materialType = new RawMaterialType();
                materialType.setFactoryId(factoryId);
                materialType.setCode(code);
                materialType.setName(defaultMaterial.get("name"));
                materialType.setCategory(defaultMaterial.get("category"));
                materialType.setUnit(defaultMaterial.get("unit"));
                materialType.setStorageType(defaultMaterial.get("storageType"));
                materialType.setIsActive(true);
                materialType.setCreatedBy(1L);
                materialType.setCreatedAt(LocalDateTime.now());
                materialType.setUpdatedAt(LocalDateTime.now());

                materialTypeRepository.save(materialType);
                count++;
            }
        }

        log.info("初始化默认原材料类型完成: factoryId={}, count={}", factoryId, count);
        return count;
    }

    @Override
    public long countMaterialTypes(String factoryId, Boolean isActive) {
        if (isActive != null) {
            return materialTypeRepository.countByFactoryIdAndIsActive(factoryId, isActive);
        } else {
            return materialTypeRepository.countByFactoryId(factoryId);
        }
    }

    /**
     * 从MaterialTypeExportDTO转换为RawMaterialType实体
     */
    private RawMaterialType convertFromExportDTO(MaterialTypeExportDTO dto, String factoryId) {
        RawMaterialType materialType = new RawMaterialType();
        materialType.setFactoryId(factoryId);
        materialType.setCode(dto.getMaterialCode());
        materialType.setName(dto.getName());
        materialType.setCategory(dto.getCategory());
        materialType.setUnit(dto.getUnit());
        materialType.setStorageType(dto.getStorageType());
        materialType.setNotes(dto.getDescription());
        materialType.setIsActive("启用".equals(dto.getStatus()));
        materialType.setCreatedBy(1L);
        materialType.setCreatedAt(LocalDateTime.now());
        materialType.setUpdatedAt(LocalDateTime.now());
        return materialType;
    }

    /**
     * 将对象转换为JSON字符串
     */
    private String toJsonString(Object obj) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return obj.toString();
        }
    }
}
