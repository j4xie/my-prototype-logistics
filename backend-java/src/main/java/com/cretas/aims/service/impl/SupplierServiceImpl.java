package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.supplier.CreateSupplierRequest;
import com.cretas.aims.dto.supplier.SupplierDTO;
import com.cretas.aims.entity.Supplier;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.mapper.SupplierMapper;
import com.cretas.aims.repository.SupplierRepository;
import com.cretas.aims.service.SupplierService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
/**
 * 供应商服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
public class SupplierServiceImpl implements SupplierService {
    private static final Logger log = LoggerFactory.getLogger(SupplierServiceImpl.class);

    private final SupplierRepository supplierRepository;
    private final SupplierMapper supplierMapper;

    // Manual constructor (Lombok @RequiredArgsConstructor not working)
    public SupplierServiceImpl(SupplierRepository supplierRepository, SupplierMapper supplierMapper) {
        this.supplierRepository = supplierRepository;
        this.supplierMapper = supplierMapper;
    }

    @Override
    @Transactional
    public SupplierDTO createSupplier(String factoryId, CreateSupplierRequest request, Long userId) {
        log.info("创建供应商: factoryId={}, name={}", factoryId, request.getName());
        // 检查供应商名称是否重复
        if (supplierRepository.existsByFactoryIdAndName(factoryId, request.getName())) {
            throw new BusinessException("供应商名称已存在");
        }
        // 创建供应商实体
        Supplier supplier = supplierMapper.toEntity(request, factoryId, userId);
        // 生成UUID作为ID
        //supplier.setId(java.util.UUID.randomUUID().toString());
        // 确保供应商代码唯一
        String baseCode = "SUP";//supplier.getSupplierCode();
        int counter = 0;
        while (supplierRepository.existsBySupplierCode(supplier.getSupplierCode())) {
            counter++;
            supplier.setSupplierCode(baseCode + "-" + counter);
        }
        // 保存供应商
        supplier = supplierRepository.save(supplier);
        log.info("供应商创建成功: id={}, code={}", supplier.getId(), supplier.getSupplierCode());
        return supplierMapper.toDTO(supplier);
    }
    @Override
    @Transactional
    public SupplierDTO updateSupplier(String factoryId, String supplierId, CreateSupplierRequest request) {
        log.info("更新供应商: factoryId={}, supplierId={}", factoryId, supplierId);
        Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在"));
        // 检查名称是否与其他供应商重复
        if (request.getName() != null && !request.getName().equals(supplier.getName())) {
            if (supplierRepository.existsByFactoryIdAndNameAndIdNot(factoryId, request.getName(), supplierId)) {
                throw new BusinessException("供应商名称已存在");
            }
        }
        // 更新供应商信息
        supplierMapper.updateEntity(supplier, request);
        supplier = supplierRepository.save(supplier);
        log.info("供应商更新成功: id={}", supplier.getId());
        return supplierMapper.toDTO(supplier);
    }
    @Override
    @Transactional
    public void deleteSupplier(String factoryId, String supplierId) {
        log.info("删除供应商: factoryId={}, supplierId={}", factoryId, supplierId);
        Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在"));
        // 检查是否有关联的原材料批次
        if (supplierRepository.hasRelatedMaterialBatches(supplierId)) {
            throw new BusinessException("供应商有关联的原材料批次，无法删除");
        }
        supplierRepository.delete(supplier);
        log.info("供应商删除成功: id={}", supplierId);
    }
    @Override
    @Transactional(readOnly = true)
    public SupplierDTO getSupplierById(String factoryId, String supplierId) {
        Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在"));
        return supplierMapper.toDTO(supplier);
    }
    @Override
    @Transactional(readOnly = true)
    public PageResponse<SupplierDTO> getSupplierList(String factoryId, PageRequest pageRequest) {
        // 创建分页请求
        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );
        // 查询供应商
        Page<Supplier> supplierPage = supplierRepository.findByFactoryId(factoryId, pageable);
        // 转换为DTO
        List<SupplierDTO> supplierDTOs = supplierPage.getContent().stream()
                .map(supplierMapper::toDTO)
                .collect(Collectors.toList());
        // 构建分页响应
        PageResponse<SupplierDTO> response = new PageResponse<>();
        response.setContent(supplierDTOs);
        response.setPage(pageRequest.getPage());
        response.setSize(pageRequest.getSize());
        response.setTotalElements(supplierPage.getTotalElements());
        response.setTotalPages(supplierPage.getTotalPages());
        response.setFirst(supplierPage.isFirst());
        response.setLast(supplierPage.isLast());
        return response;
    }
    @Override
    @Transactional(readOnly = true)
    public List<SupplierDTO> getActiveSuppliers(String factoryId) {
        List<Supplier> suppliers = supplierRepository.findByFactoryIdAndIsActive(factoryId, true);
        return suppliers.stream()
                .map(supplierMapper::toDTO)
                .collect(Collectors.toList());
    }
    @Override
    @Transactional(readOnly = true)
    public List<SupplierDTO> searchSuppliersByName(String factoryId, String keyword) {
        List<Supplier> suppliers = supplierRepository.searchByName(factoryId, keyword);
        return suppliers.stream()
                .map(supplierMapper::toDTO)
                .collect(Collectors.toList());
    }
    @Override
    @Transactional(readOnly = true)
    public List<SupplierDTO> getSuppliersByMaterialType(String factoryId, String materialType) {
        List<Supplier> suppliers = supplierRepository.findByFactoryIdAndSuppliedMaterialsContaining(
                factoryId, materialType);
        return suppliers.stream()
                .map(supplierMapper::toDTO)
                .collect(Collectors.toList());
    }
    @Override
    @Transactional
    public SupplierDTO toggleSupplierStatus(String factoryId, String supplierId, Boolean isActive) {
        log.info("切换供应商状态: factoryId={}, supplierId={}, isActive={}",
                factoryId, supplierId, isActive);
        Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在"));
        supplier.setIsActive(isActive);
        supplier.setUpdatedAt(LocalDateTime.now());
        supplier = supplierRepository.save(supplier);
        log.info("供应商状态更新成功: id={}, isActive={}", supplier.getId(), isActive);
        return supplierMapper.toDTO(supplier);
    }
    @Override
    @Transactional
    public SupplierDTO updateSupplierRating(String factoryId, String supplierId,
                                           Integer rating, String notes) {
        log.info("更新供应商评级: factoryId={}, supplierId={}, rating={}",
                factoryId, supplierId, rating);
        Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在"));
        if (rating < 1 || rating > 5) {
            throw new BusinessException("评级必须在1-5之间");
        }
        supplier.setRating(rating);
        supplier.setRatingNotes(notes);
        supplier = supplierRepository.save(supplier);
        log.info("供应商评级更新成功: id={}, rating={}", supplier.getId(), rating);
        return supplierMapper.toDTO(supplier);
    }
    @Override
    @Transactional
    public SupplierDTO updateCreditLimit(String factoryId, String supplierId, BigDecimal creditLimit) {
        log.info("更新供应商信用额度: factoryId={}, supplierId={}, creditLimit={}",
                factoryId, supplierId, creditLimit);
        Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在"));
        if (creditLimit.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("信用额度不能为负数");
        }
        supplier.setCreditLimit(creditLimit);
        supplier = supplierRepository.save(supplier);
        log.info("供应商信用额度更新成功: id={}, creditLimit={}", supplier.getId(), creditLimit);
        return supplierMapper.toDTO(supplier);
    }
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getSupplierStatistics(String factoryId, String supplierId) {
        Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在"));
        Map<String, Object> statistics = new HashMap<>();
        statistics.put("supplierId", supplier.getId());
        statistics.put("supplierName", supplier.getName());
        statistics.put("rating", supplier.getRating());
        statistics.put("creditLimit", supplier.getCreditLimit());
        statistics.put("currentBalance", supplier.getCurrentBalance());
        statistics.put("isActive", supplier.getIsActive());
        // TODO: 添加订单统计、供货统计等信息
        statistics.put("totalOrders", 0);
        statistics.put("totalAmount", BigDecimal.ZERO);
        statistics.put("averageDeliveryDays", 0);
        statistics.put("onTimeDeliveryRate", 0.0);
        return statistics;
    }
    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getSupplierHistory(String factoryId, String supplierId) {
        Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("供应商不存在"));
        // TODO: 从原材料批次表中获取供货历史
        List<Map<String, Object>> history = new ArrayList<>();
        return history;
    }
    @Override
    @Transactional(readOnly = true)
    public boolean checkSupplierCodeExists(String factoryId, String supplierCode) {
        return supplierRepository.existsByFactoryIdAndSupplierCode(factoryId, supplierCode);
    }
    @Override
    public byte[] exportSupplierList(String factoryId) {
        log.info("导出供应商列表: factoryId={}", factoryId);

        // 查询所有供应商
        List<Supplier> suppliers = supplierRepository.findByFactoryId(factoryId);

        // 转换为DTO
        List<SupplierDTO> supplierDTOs = suppliers.stream()
                .map(supplierMapper::toDTO)
                .collect(Collectors.toList());

        // 转换为Excel导出DTO
        List<com.cretas.aims.dto.supplier.SupplierExportDTO> exportDTOs = supplierDTOs.stream()
                .map(com.cretas.aims.dto.supplier.SupplierExportDTO::fromSupplierDTO)
                .collect(Collectors.toList());

        // 生成Excel文件
        com.cretas.aims.utils.ExcelUtil excelUtil = new com.cretas.aims.utils.ExcelUtil();
        byte[] excelBytes = excelUtil.exportToExcel(
                exportDTOs,
                com.cretas.aims.dto.supplier.SupplierExportDTO.class,
                "供应商列表"
        );

        log.info("供应商列表导出成功: factoryId={}, count={}", factoryId, suppliers.size());
        return excelBytes;
    }

    @Override
    public byte[] generateImportTemplate() {
        log.info("生成供应商导入模板");

        // 使用ExcelUtil生成空模板
        com.cretas.aims.utils.ExcelUtil excelUtil = new com.cretas.aims.utils.ExcelUtil();
        byte[] templateBytes = excelUtil.generateTemplate(
                com.cretas.aims.dto.supplier.SupplierExportDTO.class,
                "供应商导入模板"
        );

        log.info("供应商导入模板生成成功");
        return templateBytes;
    }

    @Override
    // 不使用@Transactional，让每个save操作独立进行，避免单行失败导致整体回滚
    public com.cretas.aims.dto.common.ImportResult<SupplierDTO> importSuppliersFromExcel(
            String factoryId,
            java.io.InputStream inputStream) {
        log.info("开始从Excel批量导入供应商: factoryId={}", factoryId);

        // 1. 解析Excel文件
        com.cretas.aims.utils.ExcelUtil excelUtil = new com.cretas.aims.utils.ExcelUtil();
        List<com.cretas.aims.dto.supplier.SupplierExportDTO> excelData;
        try {
            excelData = excelUtil.importFromExcel(inputStream,
                    com.cretas.aims.dto.supplier.SupplierExportDTO.class);
        } catch (Exception e) {
            log.error("Excel文件解析失败: factoryId={}", factoryId, e);
            throw new RuntimeException("Excel文件格式错误或无法解析: " + e.getMessage());
        }

        com.cretas.aims.dto.common.ImportResult<SupplierDTO> result =
                com.cretas.aims.dto.common.ImportResult.create(excelData.size());

        // 2. 逐行验证并导入
        for (int i = 0; i < excelData.size(); i++) {
            com.cretas.aims.dto.supplier.SupplierExportDTO exportDTO = excelData.get(i);
            int rowNumber = i + 2; // Excel行号（从2开始，1是表头）

            try {
                // 2.1 验证必填字段
                if (exportDTO.getName() == null || exportDTO.getName().trim().isEmpty()) {
                    result.addFailure(rowNumber, "供应商名称不能为空", toJsonString(exportDTO));
                    continue;
                }

                // 2.2 验证编码唯一性（如果提供了编码）
                if (exportDTO.getSupplierCode() != null && !exportDTO.getSupplierCode().trim().isEmpty()) {
                    if (supplierRepository.existsByFactoryIdAndSupplierCode(factoryId, exportDTO.getSupplierCode())) {
                        result.addFailure(rowNumber, "供应商编码已存在: " + exportDTO.getSupplierCode(),
                                toJsonString(exportDTO));
                        continue;
                    }
                }

                // 2.3 验证名称唯一性
                if (supplierRepository.existsByFactoryIdAndName(factoryId, exportDTO.getName())) {
                    result.addFailure(rowNumber, "供应商名称已存在: " + exportDTO.getName(),
                            toJsonString(exportDTO));
                    continue;
                }

                // 2.4 转换为Entity
                Supplier supplier = convertFromExportDTO(exportDTO, factoryId);

                // 2.5 保存
                Supplier saved = supplierRepository.save(supplier);

                // 2.6 转换为DTO并记录成功
                SupplierDTO dto = supplierMapper.toDTO(saved);
                result.addSuccess(dto);

                log.debug("成功导入供应商: row={}, name={}", rowNumber, exportDTO.getName());

            } catch (Exception e) {
                log.error("导入供应商失败: factoryId={}, row={}, data={}", factoryId, rowNumber, exportDTO, e);
                result.addFailure(rowNumber, "保存失败: " + e.getMessage(), toJsonString(exportDTO));
            }
        }

        log.info("供应商批量导入完成: factoryId={}, total={}, success={}, failure={}",
                factoryId, result.getTotalCount(), result.getSuccessCount(), result.getFailureCount());
        return result;
    }

    /**
     * 从SupplierExportDTO转换为Supplier实体
     */
    private Supplier convertFromExportDTO(com.cretas.aims.dto.supplier.SupplierExportDTO dto, String factoryId) {
        Supplier supplier = new Supplier();
        supplier.setId(java.util.UUID.randomUUID().toString());
        supplier.setFactoryId(factoryId);
        supplier.setSupplierCode(dto.getSupplierCode());
        supplier.setCode(dto.getSupplierCode()); // code字段使用supplierCode
        supplier.setName(dto.getName());
        supplier.setContactPerson(dto.getContactPerson());
        supplier.setPhone(dto.getPhone());
        supplier.setEmail(dto.getEmail());
        supplier.setAddress(dto.getAddress());
        supplier.setSuppliedMaterials(dto.getSuppliedMaterials());
        supplier.setPaymentTerms(dto.getPaymentTerms());
        supplier.setDeliveryDays(dto.getDeliveryDays());
        supplier.setCreditLimit(dto.getCreditLimit() != null ? dto.getCreditLimit() : BigDecimal.ZERO);
        supplier.setCurrentBalance(BigDecimal.ZERO);
        supplier.setRating(dto.getRating());
        supplier.setIsActive("启用".equals(dto.getStatus()));
        supplier.setCreatedBy(1L); // 系统导入，使用默认用户ID
        return supplier;
    }

    /**
     * 将对象转换为JSON字符串
     */
    private String toJsonString(Object obj) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return obj.toString();
        }
    }

    @Override
    @Transactional
    public List<SupplierDTO> importSuppliers(String factoryId, List<CreateSupplierRequest> requests,
                                            Long userId) {
        log.info("批量导入供应商: factoryId={}, count={}", factoryId, requests.size());
        List<SupplierDTO> importedSuppliers = new ArrayList<>();
        for (CreateSupplierRequest request : requests) {
            try {
                SupplierDTO supplier = createSupplier(factoryId, request, userId);
                importedSuppliers.add(supplier);
            } catch (Exception e) {
                log.error("导入供应商失败: name={}, error={}", request.getName(), e.getMessage());
            }
        }
        log.info("批量导入完成，成功导入 {} 个供应商", importedSuppliers.size());
        return importedSuppliers;
    }
    @Override
    @Transactional(readOnly = true)
    public Map<Integer, Long> getSupplierRatingDistribution(String factoryId) {
        List<Object[]> distribution = supplierRepository.getSupplierRatingDistribution(factoryId);
        Map<Integer, Long> result = new HashMap<>();
        for (Object[] row : distribution) {
            Integer rating = (Integer) row[0];
            Long count = (Long) row[1];
            // 修复: 过滤null rating，避免JSON序列化失败
            if (rating != null) {
                result.put(rating, count);
            } else {
                // 将null rating归类为"未评级"（rating=0）
                log.warn("发现未评级的供应商，数量: {}", count);
                result.put(0, result.getOrDefault(0, 0L) + count);
            }
        }
        // 确保所有评级都有值（0-5分，0表示未评级）
        for (int i = 0; i <= 5; i++) {
            result.putIfAbsent(i, 0L);
        }
        return result;
    }
    @Override
    @Transactional(readOnly = true)
    public List<SupplierDTO> getSuppliersWithOutstandingBalance(String factoryId) {
        List<Supplier> suppliers = supplierRepository.findSuppliersWithOutstandingBalance(factoryId);
        return suppliers.stream()
                .map(supplierMapper::toDTO)
                .collect(Collectors.toList());
    }
}
