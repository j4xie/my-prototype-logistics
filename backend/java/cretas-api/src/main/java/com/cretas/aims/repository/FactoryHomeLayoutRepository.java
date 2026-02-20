package com.cretas.aims.repository;

import com.cretas.aims.entity.decoration.FactoryHomeLayout;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 工厂首页布局配置数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Repository
public interface FactoryHomeLayoutRepository extends JpaRepository<FactoryHomeLayout, Long> {

    /**
     * 根据工厂ID查找布局配置
     *
     * @param factoryId 工厂ID
     * @return 布局配置
     */
    Optional<FactoryHomeLayout> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID和状态查找布局配置
     *
     * @param factoryId 工厂ID
     * @param status 状态 (0草稿 1发布)
     * @return 布局配置
     */
    Optional<FactoryHomeLayout> findByFactoryIdAndStatus(String factoryId, Integer status);

    /**
     * 检查工厂是否已有布局配置
     *
     * @param factoryId 工厂ID
     * @return 是否存在
     */
    boolean existsByFactoryId(String factoryId);

    /**
     * 查找所有AI生成的布局配置
     *
     * @param aiGenerated AI生成标记 (0否 1是)
     * @return 布局配置列表
     */
    List<FactoryHomeLayout> findByAiGenerated(Integer aiGenerated);

    /**
     * 查找启用了时段布局的工厂配置
     *
     * @return 布局配置列表
     */
    List<FactoryHomeLayout> findByTimeBasedEnabled(Integer timeBasedEnabled);

    /**
     * 获取已发布的布局配置
     *
     * @param factoryId 工厂ID
     * @return 布局配置
     */
    @Query("SELECT f FROM FactoryHomeLayout f WHERE f.factoryId = :factoryId AND f.status = 1")
    Optional<FactoryHomeLayout> findPublishedByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 获取模块配置JSON
     *
     * @param factoryId 工厂ID
     * @return 模块配置JSON字符串
     */
    @Query("SELECT f.modulesConfig FROM FactoryHomeLayout f WHERE f.factoryId = :factoryId AND f.status = 1")
    String findModulesConfigByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 获取主题配置JSON
     *
     * @param factoryId 工厂ID
     * @return 主题配置JSON字符串
     */
    @Query("SELECT f.themeConfig FROM FactoryHomeLayout f WHERE f.factoryId = :factoryId AND f.status = 1")
    String findThemeConfigByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 获取使用统计JSON
     *
     * @param factoryId 工厂ID
     * @return 使用统计JSON字符串
     */
    @Query("SELECT f.usageStats FROM FactoryHomeLayout f WHERE f.factoryId = :factoryId")
    String findUsageStatsByFactoryId(@Param("factoryId") String factoryId);
}
