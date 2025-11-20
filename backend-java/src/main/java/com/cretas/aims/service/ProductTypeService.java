package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.producttype.ProductTypeDTO;
import java.util.List;
/**
 * 产品类型服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface ProductTypeService {
    /**
     * 创建产品类型
     */
    ProductTypeDTO createProductType(String factoryId, ProductTypeDTO dto);
     /**
     * 更新产品类型
      */
    ProductTypeDTO updateProductType(String factoryId, String id, ProductTypeDTO dto);
     /**
     * 删除产品类型
      */
    void deleteProductType(String factoryId, String id);
     /**
     * 获取产品类型详情
      */
    ProductTypeDTO getProductTypeById(String factoryId, String id);
     /**
     * 获取产品类型列表（分页）
      */
    PageResponse<ProductTypeDTO> getProductTypes(String factoryId, PageRequest pageRequest);
     /**
     * 获取所有激活的产品类型
      */
    List<ProductTypeDTO> getActiveProductTypes(String factoryId);
     /**
     * 根据类别获取产品类型
      */
    List<ProductTypeDTO> getProductTypesByCategory(String factoryId, String category);
     /**
     * 搜索产品类型
      */
    PageResponse<ProductTypeDTO> searchProductTypes(String factoryId, String keyword, PageRequest pageRequest);
     /**
     * 获取产品类别列表
      */
    List<String> getProductCategories(String factoryId);
     /**
     * 批量更新状态
      */
    void updateProductTypesStatus(String factoryId, List<String> ids, Boolean isActive);
     /**
     * 检查产品编码是否存在
      */
    boolean checkCodeExists(String factoryId, String code, String excludeId);
     /**
     * 初始化默认产品类型
      */
    void initializeDefaultProductTypes(String factoryId);
}
