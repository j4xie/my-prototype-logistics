package com.cretas.aims.repository;

import com.cretas.aims.entity.ConversionChangeHistory;
import com.cretas.aims.entity.enums.ChangeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 转换率变更历史记录数据访问层
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-25
 */
@Repository
public interface ConversionChangeHistoryRepository extends JpaRepository<ConversionChangeHistory, String> {

    /**
     * 按转换率ID查询历史（分页，按时间倒序）
     */
    Page<ConversionChangeHistory> findByConversionIdOrderByChangedAtDesc(
            String conversionId, Pageable pageable);

    /**
     * 按转换率ID查询所有历史（按时间倒序）
     */
    List<ConversionChangeHistory> findByConversionIdOrderByChangedAtDesc(String conversionId);

    /**
     * 按工厂和原料类型查询历史（分页）
     */
    Page<ConversionChangeHistory> findByFactoryIdAndMaterialTypeIdOrderByChangedAtDesc(
            String factoryId, String materialTypeId, Pageable pageable);

    /**
     * 按工厂查询指定时间段内的历史（AI分析用）
     */
    List<ConversionChangeHistory> findByFactoryIdAndChangedAtBetweenOrderByChangedAtAsc(
            String factoryId, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 按工厂和变更类型统计数量
     */
    long countByFactoryIdAndChangeType(String factoryId, ChangeType changeType);

    /**
     * 统计转换率的变更次数
     */
    long countByConversionId(String conversionId);

    /**
     * 按工厂统计指定时间段内的变更次数
     */
    long countByFactoryIdAndChangedAtBetween(
            String factoryId, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 按工厂、变更类型统计指定时间段内的变更次数
     */
    long countByFactoryIdAndChangeTypeAndChangedAtBetween(
            String factoryId, ChangeType changeType, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 获取某原料的最新N条变更记录（用于趋势分析）
     */
    List<ConversionChangeHistory> findTop10ByFactoryIdAndMaterialTypeIdOrderByChangedAtDesc(
            String factoryId, String materialTypeId);

    /**
     * 获取某转换率配置的最新一条变更记录
     */
    ConversionChangeHistory findFirstByConversionIdOrderByChangedAtDesc(String conversionId);

    /**
     * 按操作人查询历史
     */
    Page<ConversionChangeHistory> findByChangedByOrderByChangedAtDesc(
            Long changedBy, Pageable pageable);

    /**
     * 获取工厂内所有转换率ID（用于统计分析）
     */
    @Query("SELECT DISTINCT h.conversionId FROM ConversionChangeHistory h WHERE h.factoryId = :factoryId")
    List<String> findDistinctConversionIdsByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 获取工厂内指定时间段变更过的原料类型ID列表
     */
    @Query("SELECT DISTINCT h.materialTypeId FROM ConversionChangeHistory h " +
           "WHERE h.factoryId = :factoryId " +
           "AND h.changedAt BETWEEN :startTime AND :endTime")
    List<String> findDistinctMaterialTypeIdsByFactoryIdAndTimeRange(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);
}
