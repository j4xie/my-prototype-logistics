package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiAnalysisCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * SmartBI 分析结果缓存 Repository
 *
 * <p>管理AI分析结果缓存，支持按缓存键和分析类型查询，以及过期清理。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Repository
public interface SmartBiAnalysisCacheRepository extends JpaRepository<SmartBiAnalysisCache, Long> {

    /**
     * 根据工厂ID和缓存键查询缓存
     *
     * @param factoryId 工厂ID
     * @param cacheKey 缓存键
     * @return 缓存记录
     */
    Optional<SmartBiAnalysisCache> findByFactoryIdAndCacheKey(String factoryId, String cacheKey);

    /**
     * 根据工厂ID和分析类型查询缓存列表
     *
     * @param factoryId 工厂ID
     * @param analysisType 分析类型
     * @return 缓存记录列表
     */
    List<SmartBiAnalysisCache> findByFactoryIdAndAnalysisType(String factoryId, String analysisType);

    /**
     * 删除指定时间之前过期的缓存
     *
     * @param dateTime 过期时间阈值
     */
    @Modifying
    void deleteByExpiresAtBefore(LocalDateTime dateTime);

    /**
     * 查询最新的分析缓存（按工厂、类型和日期）
     *
     * @param factoryId 工厂ID
     * @param type 分析类型
     * @param date 分析日期
     * @return 最新缓存记录
     */
    @Query("SELECT c FROM SmartBiAnalysisCache c WHERE c.factoryId = :factoryId " +
           "AND c.analysisType = :type AND c.analysisDate = :date")
    Optional<SmartBiAnalysisCache> findLatestCache(@Param("factoryId") String factoryId,
                                                    @Param("type") String type,
                                                    @Param("date") LocalDate date);
}
