package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiDatasource;
import com.cretas.aims.entity.smartbi.enums.DatasourceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * SmartBI 数据源 Repository
 *
 * <p>管理数据源元数据，支持按工厂、类型、名称查询。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiDatasourceRepository extends JpaRepository<SmartBiDatasource, Long> {

    /**
     * 根据工厂ID查询所有活跃的数据源
     *
     * @param factoryId 工厂ID
     * @return 数据源列表
     */
    List<SmartBiDatasource> findByFactoryIdAndIsActiveTrue(String factoryId);

    /**
     * 根据工厂ID查询所有数据源（包括非活跃）
     *
     * @param factoryId 工厂ID
     * @return 数据源列表
     */
    List<SmartBiDatasource> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID和数据源名称查询
     *
     * @param factoryId 工厂ID
     * @param name 数据源名称
     * @return 数据源
     */
    Optional<SmartBiDatasource> findByFactoryIdAndName(String factoryId, String name);

    /**
     * 根据工厂ID和数据源类型查询
     *
     * @param factoryId 工厂ID
     * @param sourceType 数据源类型
     * @return 数据源列表
     */
    List<SmartBiDatasource> findByFactoryIdAndSourceType(String factoryId, DatasourceType sourceType);

    /**
     * 检查数据源名称是否已存在
     *
     * @param factoryId 工厂ID
     * @param name 数据源名称
     * @return 是否存在
     */
    boolean existsByFactoryIdAndName(String factoryId, String name);

    /**
     * 根据ID和工厂ID查询数据源（安全查询）
     *
     * @param id 数据源ID
     * @param factoryId 工厂ID
     * @return 数据源
     */
    Optional<SmartBiDatasource> findByIdAndFactoryId(Long id, String factoryId);

    /**
     * 获取数据源及其字段定义
     *
     * @param datasourceId 数据源ID
     * @return 数据源（含字段定义）
     */
    @Query("SELECT DISTINCT d FROM SmartBiDatasource d LEFT JOIN FETCH d.fieldDefinitions WHERE d.id = :datasourceId")
    Optional<SmartBiDatasource> findByIdWithFields(@Param("datasourceId") Long datasourceId);

    /**
     * 统计工厂的数据源数量
     *
     * @param factoryId 工厂ID
     * @return 数据源数量
     */
    long countByFactoryIdAndIsActiveTrue(String factoryId);

    /**
     * 根据名称模糊查询
     *
     * @param factoryId 工厂ID
     * @param namePattern 名称模式
     * @return 数据源列表
     */
    @Query("SELECT d FROM SmartBiDatasource d WHERE d.factoryId = :factoryId AND d.name LIKE %:namePattern% AND d.isActive = true")
    List<SmartBiDatasource> searchByName(@Param("factoryId") String factoryId, @Param("namePattern") String namePattern);
}
