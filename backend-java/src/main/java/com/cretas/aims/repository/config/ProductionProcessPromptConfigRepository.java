package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.ProductionProcessPromptConfig;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 生产工序Prompt配置 Repository
 * 用于管理不同生产工序的AI视觉检测提示词配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Repository("configProductionProcessPromptConfigRepository")
public interface ProductionProcessPromptConfigRepository extends JpaRepository<ProductionProcessPromptConfig, Long> {

    // ==================== 按工厂和工序类型查询 ====================

    /**
     * 按工厂ID和工序类型查询启用的配置
     */
    List<ProductionProcessPromptConfig> findByFactoryIdAndProcessStageTypeAndIsActiveTrue(
            String factoryId, String processStageType);

    /**
     * 按工厂ID和工序类型查询启用的配置（按优先级降序）
     */
    List<ProductionProcessPromptConfig> findByFactoryIdAndProcessStageTypeAndIsActiveTrueOrderByPriorityDesc(
            String factoryId, String processStageType);

    /**
     * 按工厂ID和工序类型查询优先级最高的启用配置
     */
    Optional<ProductionProcessPromptConfig> findFirstByFactoryIdAndProcessStageTypeAndIsActiveTrueOrderByPriorityDesc(
            String factoryId, String processStageType);

    // ==================== 按工厂和产品类型查询 ====================

    /**
     * 按工厂ID和产品类型ID查询启用的配置
     */
    List<ProductionProcessPromptConfig> findByFactoryIdAndProductTypeIdAndIsActiveTrue(
            String factoryId, String productTypeId);

    /**
     * 按工厂ID和产品类型ID查询启用的配置（按优先级降序）
     */
    List<ProductionProcessPromptConfig> findByFactoryIdAndProductTypeIdAndIsActiveTrueOrderByPriorityDesc(
            String factoryId, String productTypeId);

    /**
     * 按工厂ID和产品类型ID查询优先级最高的启用配置
     */
    Optional<ProductionProcessPromptConfig> findFirstByFactoryIdAndProductTypeIdAndIsActiveTrueOrderByPriorityDesc(
            String factoryId, String productTypeId);

    // ==================== 按优先级排序查询 ====================

    /**
     * 按工厂ID查询所有启用的配置（按优先级降序）
     */
    List<ProductionProcessPromptConfig> findByFactoryIdAndIsActiveTrueOrderByPriorityDesc(String factoryId);

    /**
     * 按工序类型查询所有启用的配置（按优先级降序）
     */
    List<ProductionProcessPromptConfig> findByProcessStageTypeAndIsActiveTrueOrderByPriorityDesc(String processStageType);

    /**
     * 查询所有启用的配置（按优先级降序）
     */
    List<ProductionProcessPromptConfig> findByIsActiveTrueOrderByPriorityDesc();

    // ==================== 全局配置查询 ====================

    /**
     * 查询全局配置（factoryId IS NULL）
     */
    List<ProductionProcessPromptConfig> findByFactoryIdIsNullAndIsActiveTrueOrderByPriorityDesc();

    /**
     * 按工序类型查询全局配置
     */
    Optional<ProductionProcessPromptConfig> findFirstByFactoryIdIsNullAndProcessStageTypeAndIsActiveTrueOrderByPriorityDesc(
            String processStageType);

    /**
     * 按产品类型查询全局配置
     */
    Optional<ProductionProcessPromptConfig> findFirstByFactoryIdIsNullAndProductTypeIdAndIsActiveTrueOrderByPriorityDesc(
            String productTypeId);

    // ==================== 组合条件查询（带有效期） ====================

    /**
     * 查询在指定日期有效的配置
     * 按匹配精确度和优先级排序：
     * 1. 工厂+产品类型级配置优先
     * 2. 工厂级配置其次
     * 3. 全局配置最后
     */
    @Query("SELECT c FROM ProductionProcessPromptConfig c " +
           "WHERE c.processStageType = :processStageType " +
           "AND (c.factoryId = :factoryId OR c.factoryId IS NULL) " +
           "AND (c.productTypeId = :productTypeId OR c.productTypeId IS NULL) " +
           "AND c.isActive = true " +
           "AND (c.effectiveFrom IS NULL OR c.effectiveFrom <= :date) " +
           "AND (c.effectiveTo IS NULL OR c.effectiveTo >= :date) " +
           "ORDER BY c.priority DESC, " +
           "CASE WHEN c.factoryId = :factoryId AND c.productTypeId = :productTypeId THEN 1 " +
           "     WHEN c.factoryId = :factoryId AND c.productTypeId IS NULL THEN 2 " +
           "     WHEN c.factoryId IS NULL AND c.productTypeId = :productTypeId THEN 3 " +
           "     ELSE 4 END")
    List<ProductionProcessPromptConfig> findEffectiveConfigs(
            @Param("factoryId") String factoryId,
            @Param("processStageType") String processStageType,
            @Param("productTypeId") String productTypeId,
            @Param("date") LocalDate date);

    /**
     * 查询最佳匹配的配置（单个）
     * 注意：返回 List 并由调用方取第一个，因为 Optional + Pageable 不兼容
     */
    @Query("SELECT c FROM ProductionProcessPromptConfig c " +
           "WHERE c.processStageType = :processStageType " +
           "AND (c.factoryId = :factoryId OR c.factoryId IS NULL) " +
           "AND (c.productTypeId = :productTypeId OR c.productTypeId IS NULL) " +
           "AND c.isActive = true " +
           "AND (c.effectiveFrom IS NULL OR c.effectiveFrom <= :date) " +
           "AND (c.effectiveTo IS NULL OR c.effectiveTo >= :date) " +
           "ORDER BY c.priority DESC, " +
           "CASE WHEN c.factoryId = :factoryId AND c.productTypeId = :productTypeId THEN 1 " +
           "     WHEN c.factoryId = :factoryId AND c.productTypeId IS NULL THEN 2 " +
           "     WHEN c.factoryId IS NULL AND c.productTypeId = :productTypeId THEN 3 " +
           "     ELSE 4 END")
    List<ProductionProcessPromptConfig> findBestMatchConfig(
            @Param("factoryId") String factoryId,
            @Param("processStageType") String processStageType,
            @Param("productTypeId") String productTypeId,
            @Param("date") LocalDate date,
            Pageable pageable);

    // ==================== 分页查询 ====================

    /**
     * 分页查询所有配置（按优先级降序）
     */
    Page<ProductionProcessPromptConfig> findAllByOrderByPriorityDesc(Pageable pageable);

    /**
     * 按工厂ID分页查询
     */
    Page<ProductionProcessPromptConfig> findByFactoryIdOrderByPriorityDesc(String factoryId, Pageable pageable);

    /**
     * 按工序类型分页查询
     */
    Page<ProductionProcessPromptConfig> findByProcessStageTypeOrderByPriorityDesc(
            String processStageType, Pageable pageable);

    /**
     * 按启用状态分页查询
     */
    Page<ProductionProcessPromptConfig> findByIsActiveOrderByPriorityDesc(Boolean isActive, Pageable pageable);

    // ==================== 统计和检查 ====================

    /**
     * 统计工厂的启用配置数量
     */
    long countByFactoryIdAndIsActiveTrue(String factoryId);

    /**
     * 统计指定工序类型的配置数量
     */
    long countByProcessStageTypeAndIsActiveTrue(String processStageType);

    /**
     * 检查配置是否存在
     */
    boolean existsByFactoryIdAndProcessStageTypeAndProductTypeId(
            String factoryId, String processStageType, String productTypeId);

    /**
     * 检查配置名称是否已存在
     */
    boolean existsByFactoryIdAndName(String factoryId, String name);

    // ==================== 状态更新 ====================

    /**
     * 更新配置启用状态
     */
    @Modifying
    @Query("UPDATE ProductionProcessPromptConfig c SET c.isActive = :isActive WHERE c.id = :id")
    int updateActiveStatus(@Param("id") Long id, @Param("isActive") Boolean isActive);

    /**
     * 批量禁用工厂的所有配置
     */
    @Modifying
    @Query("UPDATE ProductionProcessPromptConfig c SET c.isActive = false WHERE c.factoryId = :factoryId")
    int disableAllByFactoryId(@Param("factoryId") String factoryId);
}
