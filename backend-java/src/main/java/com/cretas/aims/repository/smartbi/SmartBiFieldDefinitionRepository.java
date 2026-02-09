package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiFieldDefinition;
import com.cretas.aims.entity.smartbi.enums.FieldType;
import com.cretas.aims.entity.smartbi.enums.MetricType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * SmartBI 字段定义 Repository
 *
 * <p>管理数据源的字段元数据，支持按数据源、字段类型、指标类型查询。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiFieldDefinitionRepository extends JpaRepository<SmartBiFieldDefinition, Long> {

    /**
     * 根据数据源ID查询所有字段定义
     *
     * @param datasourceId 数据源ID
     * @return 字段定义列表
     */
    List<SmartBiFieldDefinition> findByDatasourceIdOrderByDisplayOrderAsc(Long datasourceId);

    /**
     * 根据数据源ID查询可见字段
     *
     * @param datasourceId 数据源ID
     * @return 可见字段列表
     */
    List<SmartBiFieldDefinition> findByDatasourceIdAndIsVisibleTrueOrderByDisplayOrderAsc(Long datasourceId);

    /**
     * 根据数据源ID和字段名称查询
     *
     * @param datasourceId 数据源ID
     * @param fieldName 字段名称
     * @return 字段定义
     */
    Optional<SmartBiFieldDefinition> findByDatasourceIdAndFieldName(Long datasourceId, String fieldName);

    /**
     * 根据数据源ID和字段类型查询
     *
     * @param datasourceId 数据源ID
     * @param fieldType 字段类型
     * @return 字段定义列表
     */
    List<SmartBiFieldDefinition> findByDatasourceIdAndFieldType(Long datasourceId, FieldType fieldType);

    /**
     * 根据数据源ID和指标类型查询
     *
     * @param datasourceId 数据源ID
     * @param metricType 指标类型
     * @return 字段定义列表
     */
    List<SmartBiFieldDefinition> findByDatasourceIdAndMetricType(Long datasourceId, MetricType metricType);

    /**
     * 查询数据源的所有KPI字段
     *
     * @param datasourceId 数据源ID
     * @return KPI字段列表
     */
    List<SmartBiFieldDefinition> findByDatasourceIdAndIsKpiTrue(Long datasourceId);

    /**
     * 检查字段名称是否已存在
     *
     * @param datasourceId 数据源ID
     * @param fieldName 字段名称
     * @return 是否存在
     */
    boolean existsByDatasourceIdAndFieldName(Long datasourceId, String fieldName);

    /**
     * 删除数据源的所有字段定义
     *
     * @param datasourceId 数据源ID
     */
    @Modifying
    void deleteByDatasourceId(Long datasourceId);

    /**
     * 批量删除指定ID的字段
     *
     * @param ids 字段ID列表
     */
    @Modifying
    @Query("DELETE FROM SmartBiFieldDefinition f WHERE f.id IN :ids")
    void deleteByIds(@Param("ids") List<Long> ids);

    /**
     * 统计数据源的字段数量
     *
     * @param datasourceId 数据源ID
     * @return 字段数量
     */
    long countByDatasourceId(Long datasourceId);

    /**
     * 根据数据源ID查询度量字段
     *
     * @param datasourceId 数据源ID
     * @return 度量字段列表
     */
    @Query("SELECT f FROM SmartBiFieldDefinition f WHERE f.datasourceId = :datasourceId AND f.metricType = 'MEASURE' ORDER BY f.displayOrder")
    List<SmartBiFieldDefinition> findMeasureFields(@Param("datasourceId") Long datasourceId);

    /**
     * 根据数据源ID查询维度字段
     *
     * @param datasourceId 数据源ID
     * @return 维度字段列表
     */
    @Query("SELECT f FROM SmartBiFieldDefinition f WHERE f.datasourceId = :datasourceId AND f.metricType = 'DIMENSION' ORDER BY f.displayOrder")
    List<SmartBiFieldDefinition> findDimensionFields(@Param("datasourceId") Long datasourceId);

    /**
     * 批量更新字段显示顺序
     *
     * @param datasourceId 数据源ID
     * @param fieldName 字段名称
     * @param displayOrder 显示顺序
     */
    @Modifying
    @Query("UPDATE SmartBiFieldDefinition f SET f.displayOrder = :displayOrder WHERE f.datasourceId = :datasourceId AND f.fieldName = :fieldName")
    void updateDisplayOrder(@Param("datasourceId") Long datasourceId, @Param("fieldName") String fieldName, @Param("displayOrder") Integer displayOrder);
}
