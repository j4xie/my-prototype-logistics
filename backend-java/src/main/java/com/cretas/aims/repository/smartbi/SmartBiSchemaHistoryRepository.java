package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiSchemaHistory;
import com.cretas.aims.entity.smartbi.enums.SchemaChangeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * SmartBI Schema 变更历史 Repository
 *
 * <p>管理数据源的 Schema 变更记录，支持版本追踪和审计。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiSchemaHistoryRepository extends JpaRepository<SmartBiSchemaHistory, Long> {

    /**
     * 根据数据源ID分页查询变更历史
     *
     * @param datasourceId 数据源ID
     * @param pageable 分页参数
     * @return 变更历史分页
     */
    Page<SmartBiSchemaHistory> findByDatasourceIdOrderByCreatedAtDesc(Long datasourceId, Pageable pageable);

    /**
     * 根据数据源ID查询所有变更历史
     *
     * @param datasourceId 数据源ID
     * @return 变更历史列表
     */
    List<SmartBiSchemaHistory> findByDatasourceIdOrderByCreatedAtDesc(Long datasourceId);

    /**
     * 根据数据源ID和变更类型查询
     *
     * @param datasourceId 数据源ID
     * @param changeType 变更类型
     * @return 变更历史列表
     */
    List<SmartBiSchemaHistory> findByDatasourceIdAndChangeType(Long datasourceId, SchemaChangeType changeType);

    /**
     * 获取数据源的最新变更记录
     *
     * @param datasourceId 数据源ID
     * @return 最新变更记录
     */
    Optional<SmartBiSchemaHistory> findFirstByDatasourceIdOrderByCreatedAtDesc(Long datasourceId);

    /**
     * 获取指定版本的变更记录
     *
     * @param datasourceId 数据源ID
     * @param versionAfter 目标版本号
     * @return 变更记录
     */
    @Query("SELECT h FROM SmartBiSchemaHistory h WHERE h.datasourceId = :datasourceId AND h.versionAfter = :versionAfter")
    Optional<SmartBiSchemaHistory> findByDatasourceIdAndTargetVersion(@Param("datasourceId") Long datasourceId,
                                                                       @Param("versionAfter") Integer versionAfter);

    /**
     * 查询时间范围内的变更历史
     *
     * @param datasourceId 数据源ID
     * @param start 开始时间
     * @param end 结束时间
     * @return 变更历史列表
     */
    @Query("SELECT h FROM SmartBiSchemaHistory h WHERE h.datasourceId = :datasourceId AND h.createdAt BETWEEN :start AND :end ORDER BY h.createdAt DESC")
    List<SmartBiSchemaHistory> findByDatasourceIdAndDateRange(@Param("datasourceId") Long datasourceId,
                                                              @Param("start") LocalDateTime start,
                                                              @Param("end") LocalDateTime end);

    /**
     * 查询可回滚的变更记录
     *
     * @param datasourceId 数据源ID
     * @return 可回滚的变更列表
     */
    List<SmartBiSchemaHistory> findByDatasourceIdAndIsReversibleTrueAndIsAppliedTrueOrderByCreatedAtDesc(Long datasourceId);

    /**
     * 查询失败的变更记录
     *
     * @param datasourceId 数据源ID
     * @return 失败的变更列表
     */
    List<SmartBiSchemaHistory> findByDatasourceIdAndIsAppliedFalse(Long datasourceId);

    /**
     * 根据操作人查询变更历史
     *
     * @param createdBy 操作人
     * @param pageable 分页参数
     * @return 变更历史分页
     */
    Page<SmartBiSchemaHistory> findByCreatedByOrderByCreatedAtDesc(String createdBy, Pageable pageable);

    /**
     * 统计数据源的变更次数
     *
     * @param datasourceId 数据源ID
     * @return 变更次数
     */
    long countByDatasourceId(Long datasourceId);

    /**
     * 统计指定类型的变更次数
     *
     * @param datasourceId 数据源ID
     * @param changeType 变更类型
     * @return 变更次数
     */
    long countByDatasourceIdAndChangeType(Long datasourceId, SchemaChangeType changeType);

    /**
     * 删除数据源的所有变更历史
     *
     * @param datasourceId 数据源ID
     */
    void deleteByDatasourceId(Long datasourceId);
}
