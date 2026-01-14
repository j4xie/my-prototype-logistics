package com.cretas.aims.repository.bom;

import com.cretas.aims.entity.bom.LaborCostConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 人工成本配置 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-13
 */
@Repository
public interface LaborCostConfigRepository extends JpaRepository<LaborCostConfig, Long> {

    /**
     * 根据工厂ID和产品类型ID查询人工成本配置
     */
    List<LaborCostConfig> findByFactoryIdAndProductTypeIdAndDeletedAtIsNullOrderBySortOrderAsc(
        String factoryId, String productTypeId);

    /**
     * 查询工厂的全局人工成本配置（productTypeId为NULL）
     */
    List<LaborCostConfig> findByFactoryIdAndProductTypeIdIsNullAndDeletedAtIsNullOrderBySortOrderAsc(String factoryId);

    /**
     * 查询工厂的所有人工成本配置
     */
    List<LaborCostConfig> findByFactoryIdAndDeletedAtIsNullOrderBySortOrderAsc(String factoryId);

    /**
     * 查询工厂启用的人工成本配置
     */
    List<LaborCostConfig> findByFactoryIdAndIsActiveTrueAndDeletedAtIsNullOrderBySortOrderAsc(String factoryId);

    /**
     * 根据工厂ID和产品类型ID查询启用的人工成本配置
     */
    List<LaborCostConfig> findByFactoryIdAndProductTypeIdAndIsActiveTrueAndDeletedAtIsNullOrderBySortOrderAsc(
        String factoryId, String productTypeId);

    /**
     * 检查工序名称是否已存在
     */
    boolean existsByFactoryIdAndProcessNameAndDeletedAtIsNull(String factoryId, String processName);
}
