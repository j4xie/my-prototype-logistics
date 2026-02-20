package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiAnalysisConfig;
import com.cretas.aims.entity.smartbi.enums.AnalysisConfigType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * SmartBI 分析配置 Repository
 *
 * <p>管理数据源的分析配置，支持按类型、名称查询。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiAnalysisConfigRepository extends JpaRepository<SmartBiAnalysisConfig, Long> {

    /**
     * 根据数据源ID查询所有活跃配置
     *
     * @param datasourceId 数据源ID
     * @return 配置列表
     */
    List<SmartBiAnalysisConfig> findByDatasourceIdAndIsActiveTrueOrderByDisplayOrderAsc(Long datasourceId);

    /**
     * 根据数据源ID查询所有配置
     *
     * @param datasourceId 数据源ID
     * @return 配置列表
     */
    List<SmartBiAnalysisConfig> findByDatasourceIdOrderByDisplayOrderAsc(Long datasourceId);

    /**
     * 根据数据源ID和配置类型查询
     *
     * @param datasourceId 数据源ID
     * @param configType 配置类型
     * @return 配置列表
     */
    List<SmartBiAnalysisConfig> findByDatasourceIdAndConfigTypeAndIsActiveTrue(Long datasourceId, AnalysisConfigType configType);

    /**
     * 根据数据源ID、配置类型和配置名称查询
     *
     * @param datasourceId 数据源ID
     * @param configType 配置类型
     * @param configName 配置名称
     * @return 配置
     */
    Optional<SmartBiAnalysisConfig> findByDatasourceIdAndConfigTypeAndConfigName(Long datasourceId, AnalysisConfigType configType, String configName);

    /**
     * 检查配置是否已存在
     *
     * @param datasourceId 数据源ID
     * @param configType 配置类型
     * @param configName 配置名称
     * @return 是否存在
     */
    boolean existsByDatasourceIdAndConfigTypeAndConfigName(Long datasourceId, AnalysisConfigType configType, String configName);

    /**
     * 查询数据源的所有KPI配置
     *
     * @param datasourceId 数据源ID
     * @return KPI配置列表
     */
    @Query("SELECT c FROM SmartBiAnalysisConfig c WHERE c.datasourceId = :datasourceId AND c.configType = 'KPI' AND c.isActive = true ORDER BY c.displayOrder")
    List<SmartBiAnalysisConfig> findKpiConfigs(@Param("datasourceId") Long datasourceId);

    /**
     * 查询数据源的所有图表配置
     *
     * @param datasourceId 数据源ID
     * @return 图表配置列表
     */
    @Query("SELECT c FROM SmartBiAnalysisConfig c WHERE c.datasourceId = :datasourceId AND c.configType = 'CHART' AND c.isActive = true ORDER BY c.displayOrder")
    List<SmartBiAnalysisConfig> findChartConfigs(@Param("datasourceId") Long datasourceId);

    /**
     * 查询数据源的所有排名配置
     *
     * @param datasourceId 数据源ID
     * @return 排名配置列表
     */
    @Query("SELECT c FROM SmartBiAnalysisConfig c WHERE c.datasourceId = :datasourceId AND c.configType = 'RANKING' AND c.isActive = true ORDER BY c.displayOrder")
    List<SmartBiAnalysisConfig> findRankingConfigs(@Param("datasourceId") Long datasourceId);

    /**
     * 查询数据源的所有洞察配置
     *
     * @param datasourceId 数据源ID
     * @return 洞察配置列表
     */
    @Query("SELECT c FROM SmartBiAnalysisConfig c WHERE c.datasourceId = :datasourceId AND c.configType = 'INSIGHT' AND c.isActive = true ORDER BY c.displayOrder")
    List<SmartBiAnalysisConfig> findInsightConfigs(@Param("datasourceId") Long datasourceId);

    /**
     * 删除数据源的所有配置
     *
     * @param datasourceId 数据源ID
     */
    @Modifying
    void deleteByDatasourceId(Long datasourceId);

    /**
     * 统计数据源的配置数量
     *
     * @param datasourceId 数据源ID
     * @return 配置数量
     */
    long countByDatasourceIdAndIsActiveTrue(Long datasourceId);

    /**
     * 统计指定类型的配置数量
     *
     * @param datasourceId 数据源ID
     * @param configType 配置类型
     * @return 配置数量
     */
    long countByDatasourceIdAndConfigTypeAndIsActiveTrue(Long datasourceId, AnalysisConfigType configType);

    /**
     * 批量更新配置状态
     *
     * @param datasourceId 数据源ID
     * @param configType 配置类型
     * @param isActive 是否活跃
     */
    @Modifying
    @Query("UPDATE SmartBiAnalysisConfig c SET c.isActive = :isActive WHERE c.datasourceId = :datasourceId AND c.configType = :configType")
    void updateActiveStatus(@Param("datasourceId") Long datasourceId, @Param("configType") AnalysisConfigType configType, @Param("isActive") Boolean isActive);
}
