package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.supplier.CreateSupplierRequest;
import com.cretas.aims.dto.supplier.SupplierDTO;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
/**
 * 供应商服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface SupplierService {
    /**
     * 创建供应商
     */
    SupplierDTO createSupplier(String factoryId, CreateSupplierRequest request, Integer userId);
     /**
     * 更新供应商
      */
    SupplierDTO updateSupplier(String factoryId, String supplierId, CreateSupplierRequest request);
     /**
     * 删除供应商
      */
    void deleteSupplier(String factoryId, String supplierId);
     /**
     * 获取供应商详情
      */
    SupplierDTO getSupplierById(String factoryId, String supplierId);
     /**
     * 获取供应商列表（分页）
      */
    PageResponse<SupplierDTO> getSupplierList(String factoryId, PageRequest pageRequest);
     /**
     * 获取所有活跃供应商
      */
    List<SupplierDTO> getActiveSuppliers(String factoryId);
     /**
     * 按名称搜索供应商
      */
    List<SupplierDTO> searchSuppliersByName(String factoryId, String keyword);
     /**
     * 按供应材料类型获取供应商
      */
    List<SupplierDTO> getSuppliersByMaterialType(String factoryId, String materialType);
     /**
     * 激活/停用供应商
      */
    SupplierDTO toggleSupplierStatus(String factoryId, String supplierId, Boolean isActive);
     /**
     * 更新供应商评级
      */
    SupplierDTO updateSupplierRating(String factoryId, String supplierId, Integer rating, String notes);
     /**
     * 更新供应商信用额度
      */
    SupplierDTO updateCreditLimit(String factoryId, String supplierId, BigDecimal creditLimit);
     /**
     * 获取供应商统计信息
      */
    Map<String, Object> getSupplierStatistics(String factoryId, String supplierId);
     /**
     * 获取供应商供货历史
      */
    List<Map<String, Object>> getSupplierHistory(String factoryId, String supplierId);
     /**
     * 检查供应商代码是否存在
      */
    boolean checkSupplierCodeExists(String factoryId, String supplierCode);
     /**
     * 导出供应商列表
      */
    byte[] exportSupplierList(String factoryId);

    /**
     * 生成供应商导入模板
      */
    byte[] generateImportTemplate();
     /**
     * 从Excel文件批量导入供应商
      */
    com.cretas.aims.dto.common.ImportResult<SupplierDTO> importSuppliersFromExcel(String factoryId, java.io.InputStream inputStream);
     /**
     * 批量导入供应商
      */
    List<SupplierDTO> importSuppliers(String factoryId, List<CreateSupplierRequest> requests, Integer userId);
     /**
     * 获取供应商评级分布
      */
    Map<Integer, Long> getSupplierRatingDistribution(String factoryId);
     /**
     * 获取欠款供应商列表
      */
    List<SupplierDTO> getSuppliersWithOutstandingBalance(String factoryId);
}
