package com.cretas.aims.repository.bom;

import com.cretas.aims.entity.bom.OverheadCostConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 均摊费用配置 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-13
 */
@Repository
public interface OverheadCostConfigRepository extends JpaRepository<OverheadCostConfig, Long> {

    /**
     * 根据工厂ID查询所有均摊费用配置
     */
    List<OverheadCostConfig> findByFactoryIdAndDeletedAtIsNullOrderBySortOrderAsc(String factoryId);

    /**
     * 根据工厂ID查询启用的均摊费用配置
     */
    List<OverheadCostConfig> findByFactoryIdAndIsActiveTrueAndDeletedAtIsNullOrderBySortOrderAsc(String factoryId);

    /**
     * 根据工厂ID和类别查询均摊费用配置
     */
    List<OverheadCostConfig> findByFactoryIdAndCategoryAndDeletedAtIsNullOrderBySortOrderAsc(
        String factoryId, String category);

    /**
     * 检查费用名称是否已存在
     */
    boolean existsByFactoryIdAndNameAndDeletedAtIsNull(String factoryId, String name);
}
