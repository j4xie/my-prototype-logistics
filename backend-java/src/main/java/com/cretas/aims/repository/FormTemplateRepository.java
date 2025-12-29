package com.cretas.aims.repository;

import com.cretas.aims.entity.config.FormTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 表单模板数据访问接口
 *
 * 支持:
 * - 按工厂和实体类型查询
 * - 系统级模板查询 (factoryId = null)
 * - 分页查询
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Repository
public interface FormTemplateRepository extends JpaRepository<FormTemplate, String> {

    /**
     * 根据工厂ID和实体类型查找启用的模板
     * 优先返回工厂级模板，如果没有则返回系统级模板
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 模板（如果存在）
     */
    @Query("SELECT f FROM FormTemplate f WHERE f.entityType = :entityType " +
           "AND (f.factoryId = :factoryId OR f.factoryId IS NULL) " +
           "AND f.isActive = true " +
           "ORDER BY CASE WHEN f.factoryId IS NOT NULL THEN 0 ELSE 1 END")
    List<FormTemplate> findByFactoryIdAndEntityType(
            @Param("factoryId") String factoryId,
            @Param("entityType") String entityType);

    /**
     * 根据工厂ID和实体类型查找唯一启用的模板
     * 工厂级模板优先于系统级模板
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 模板（如果存在）
     */
    default Optional<FormTemplate> findActiveByFactoryIdAndEntityType(String factoryId, String entityType) {
        List<FormTemplate> templates = findByFactoryIdAndEntityType(factoryId, entityType);
        return templates.isEmpty() ? Optional.empty() : Optional.of(templates.get(0));
    }

    /**
     * 根据工厂ID分页查询所有模板
     *
     * @param factoryId 工厂ID
     * @param pageable 分页参数
     * @return 分页模板列表
     */
    Page<FormTemplate> findByFactoryIdAndIsActiveTrue(String factoryId, Pageable pageable);

    /**
     * 查询系统级模板（factoryId = null）
     *
     * @param pageable 分页参数
     * @return 分页模板列表
     */
    Page<FormTemplate> findByFactoryIdIsNullAndIsActiveTrue(Pageable pageable);

    /**
     * 查询指定实体类型的所有启用模板
     *
     * @param entityType 实体类型
     * @return 模板列表
     */
    List<FormTemplate> findByEntityTypeAndIsActiveTrue(String entityType);

    /**
     * 检查工厂是否存在指定实体类型的模板
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 是否存在
     */
    boolean existsByFactoryIdAndEntityTypeAndIsActiveTrue(String factoryId, String entityType);

    /**
     * 根据创建来源查询模板
     *
     * @param source 创建来源 (MANUAL, AI_ASSISTANT, IMPORT)
     * @param pageable 分页参数
     * @return 分页模板列表
     */
    Page<FormTemplate> findBySourceAndIsActiveTrue(String source, Pageable pageable);

    /**
     * 统计工厂的模板数量
     *
     * @param factoryId 工厂ID
     * @return 模板数量
     */
    long countByFactoryIdAndIsActiveTrue(String factoryId);

    /**
     * 统计AI生成的模板数量
     *
     * @param factoryId 工厂ID
     * @return AI生成的模板数量
     */
    @Query("SELECT COUNT(f) FROM FormTemplate f WHERE f.factoryId = :factoryId " +
           "AND f.source = 'AI_ASSISTANT' AND f.isActive = true")
    long countAIGeneratedByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 统计使用指定模板包的模板数量
     *
     * @param sourcePackageId 来源模板包ID
     * @return 使用该模板包的模板数量
     */
    long countBySourcePackageIdAndIsActiveTrue(String sourcePackageId);

    /**
     * 查找使用指定模板包的所有模板
     *
     * @param sourcePackageId 来源模板包ID
     * @return 模板列表
     */
    List<FormTemplate> findBySourcePackageIdAndIsActiveTrue(String sourcePackageId);

    /**
     * 统计来源字段包含指定内容的模板数量（兼容旧数据）
     *
     * @param pattern 搜索模式
     * @return 匹配的模板数量
     */
    @Query("SELECT COUNT(f) FROM FormTemplate f WHERE f.source LIKE %:pattern% OR f.sourcePackageId = :pattern")
    long countBySourceContaining(@Param("pattern") String pattern);

    /**
     * 查找来源字段包含指定内容的模板（兼容旧数据）
     *
     * @param pattern 搜索模式
     * @return 模板列表
     */
    @Query("SELECT f FROM FormTemplate f WHERE f.source LIKE %:pattern% OR f.sourcePackageId = :pattern")
    List<FormTemplate> findBySourceContaining(@Param("pattern") String pattern);
}
