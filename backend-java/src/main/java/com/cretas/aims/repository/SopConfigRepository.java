package com.cretas.aims.repository;

import com.cretas.aims.entity.config.SopConfig;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * SOP 配置数据访问接口
 *
 * Sprint 2 任务:
 * - S2-2: 创建 SopConfig 实体和仓库
 * - S2-3: 支持按规则组查询
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Repository
public interface SopConfigRepository extends JpaRepository<SopConfig, String> {

    /**
     * 根据工厂ID和编码查找SOP配置
     *
     * @param factoryId 工厂ID
     * @param code SOP编码
     * @return SOP配置
     */
    Optional<SopConfig> findByFactoryIdAndCode(String factoryId, String code);

    /**
     * 根据工厂ID分页查询启用的SOP配置
     *
     * @param factoryId 工厂ID
     * @param pageable 分页参数
     * @return 分页SOP配置列表
     */
    Page<SopConfig> findByFactoryIdAndIsActiveTrue(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID查询所有启用的SOP配置
     *
     * @param factoryId 工厂ID
     * @return SOP配置列表
     */
    List<SopConfig> findByFactoryIdAndIsActiveTrue(String factoryId);

    /**
     * 根据工厂ID和实体类型查询SOP配置
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return SOP配置列表
     */
    List<SopConfig> findByFactoryIdAndEntityTypeAndIsActiveTrue(String factoryId, String entityType);

    /**
     * 根据工厂ID和产品类型ID查询SOP配置
     * 优先返回产品类型专属SOP，若无则返回通用SOP（productTypeId = null）
     *
     * @param factoryId 工厂ID
     * @param productTypeId 产品类型ID
     * @param entityType 实体类型
     * @return SOP配置列表
     */
    @Query("SELECT s FROM SopConfig s WHERE s.factoryId = :factoryId " +
           "AND s.entityType = :entityType " +
           "AND (s.productTypeId = :productTypeId OR s.productTypeId IS NULL) " +
           "AND s.isActive = true " +
           "ORDER BY CASE WHEN s.productTypeId IS NOT NULL THEN 0 ELSE 1 END")
    List<SopConfig> findByFactoryIdAndProductTypeIdAndEntityType(
            @Param("factoryId") String factoryId,
            @Param("productTypeId") String productTypeId,
            @Param("entityType") String entityType);

    /**
     * 获取适用于指定产品类型的SOP配置
     *
     * @param factoryId 工厂ID
     * @param productTypeId 产品类型ID
     * @param entityType 实体类型
     * @return SOP配置
     */
    default Optional<SopConfig> findActiveByProductType(
            String factoryId, String productTypeId, String entityType) {
        List<SopConfig> configs = findByFactoryIdAndProductTypeIdAndEntityType(
                factoryId, productTypeId, entityType);
        return configs.isEmpty() ? Optional.empty() : Optional.of(configs.get(0));
    }

    // ==================== Sprint 2 S2-3: 规则组查询 ====================

    /**
     * 根据规则组ID查询SOP配置
     *
     * @param factoryId 工厂ID
     * @param ruleGroupId 规则组ID
     * @return SOP配置列表
     */
    List<SopConfig> findByFactoryIdAndRuleGroupIdAndIsActiveTrue(
            String factoryId, String ruleGroupId);

    /**
     * 检查规则组是否被SOP使用
     *
     * @param ruleGroupId 规则组ID
     * @return 是否被使用
     */
    boolean existsByRuleGroupIdAndIsActiveTrue(String ruleGroupId);

    /**
     * 统计使用指定规则组的SOP数量
     *
     * @param ruleGroupId 规则组ID
     * @return SOP数量
     */
    long countByRuleGroupIdAndIsActiveTrue(String ruleGroupId);

    // ==================== 统计查询 ====================

    /**
     * 统计工厂的SOP配置数量
     *
     * @param factoryId 工厂ID
     * @return SOP数量
     */
    long countByFactoryIdAndIsActiveTrue(String factoryId);

    /**
     * 检查工厂是否存在指定编码的SOP
     *
     * @param factoryId 工厂ID
     * @param code SOP编码
     * @return 是否存在
     */
    boolean existsByFactoryIdAndCode(String factoryId, String code);

    // ==================== 蓝图相关 ====================

    /**
     * 查询工厂的所有未删除SOP配置
     * 用于蓝图导出功能
     *
     * @param factoryId 工厂ID
     * @return SOP配置列表
     */
    List<SopConfig> findByFactoryIdAndDeletedAtIsNull(String factoryId);
}
