package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.material.RawMaterialTypeDTO;
import java.util.List;
/**
 * 原材料类型服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface RawMaterialTypeService {
    /**
     * 创建原材料类型
     */
    RawMaterialTypeDTO createMaterialType(String factoryId, RawMaterialTypeDTO dto);
     /**
     * 更新原材料类型
      */
    RawMaterialTypeDTO updateMaterialType(String factoryId, Integer id, RawMaterialTypeDTO dto);
     /**
     * 删除原材料类型
      */
    void deleteMaterialType(String factoryId, Integer id);
     /**
     * 获取原材料类型详情
      */
    RawMaterialTypeDTO getMaterialTypeById(String factoryId, Integer id);
     /**
     * 获取原材料类型列表（分页）
      */
    PageResponse<RawMaterialTypeDTO> getMaterialTypes(String factoryId, PageRequest pageRequest);
     /**
     * 获取所有激活的原材料类型
      */
    List<RawMaterialTypeDTO> getActiveMaterialTypes(String factoryId);
     /**
     * 根据类别获取原材料类型
      */
    List<RawMaterialTypeDTO> getMaterialTypesByCategory(String factoryId, String category);
     /**
     * 根据存储类型获取原材料类型
      */
    List<RawMaterialTypeDTO> getMaterialTypesByStorageType(String factoryId, String storageType);
     /**
     * 搜索原材料类型
      */
    PageResponse<RawMaterialTypeDTO> searchMaterialTypes(String factoryId, String keyword, PageRequest pageRequest);
     /**
     * 获取原材料类别列表
      */
    List<String> getMaterialCategories(String factoryId);
     /**
     * 获取库存预警的原材料
      */
    List<RawMaterialTypeDTO> getLowStockMaterials(String factoryId);
     /**
     * 批量更新状态
      */
    void updateMaterialTypesStatus(String factoryId, List<Integer> ids, Boolean isActive);
     /**
     * 检查原材料编码是否存在
      */
    boolean checkCodeExists(String factoryId, String code, Integer excludeId);
}
