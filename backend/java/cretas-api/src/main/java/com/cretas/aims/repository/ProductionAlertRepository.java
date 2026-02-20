package com.cretas.aims.repository;

import com.cretas.aims.entity.ProductionAlert;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * 生产告警数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
@Repository
public interface ProductionAlertRepository extends JpaRepository<ProductionAlert, Long> {

    /**
     * 按工厂ID分页查询，按创建时间降序
     */
    Page<ProductionAlert> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    /**
     * 按工厂ID和状态查询
     */
    List<ProductionAlert> findByFactoryIdAndStatus(String factoryId, String status);

    /**
     * 按工厂ID和状态分页查询
     */
    Page<ProductionAlert> findByFactoryIdAndStatus(String factoryId, String status, Pageable pageable);

    /**
     * 按工厂ID和级别查询
     */
    List<ProductionAlert> findByFactoryIdAndLevel(String factoryId, String level);

    /**
     * 按工厂ID和级别分页查询
     */
    Page<ProductionAlert> findByFactoryIdAndLevel(String factoryId, String level, Pageable pageable);

    /**
     * 按工厂ID、状态和级别分页查询
     */
    Page<ProductionAlert> findByFactoryIdAndStatusAndLevel(String factoryId, String status, String level, Pageable pageable);

    /**
     * 按工厂ID和多个状态查询
     */
    List<ProductionAlert> findByFactoryIdAndStatusIn(String factoryId, Collection<String> statuses);

    /**
     * 按工厂ID和状态统计数量
     */
    long countByFactoryIdAndStatus(String factoryId, String status);

    /**
     * 按工厂ID、状态和级别统计数量
     */
    long countByFactoryIdAndStatusAndLevel(String factoryId, String status, String level);

    /**
     * 查询活跃告警按级别分组统计
     */
    @Query("SELECT pa.level, COUNT(pa) FROM ProductionAlert pa " +
           "WHERE pa.factoryId = :factoryId AND pa.status = 'ACTIVE' " +
           "GROUP BY pa.level")
    List<Object[]> countActiveAlertsByLevel(@Param("factoryId") String factoryId);

    /**
     * 查询指定时间范围内创建的告警
     */
    @Query("SELECT pa FROM ProductionAlert pa " +
           "WHERE pa.factoryId = :factoryId " +
           "AND pa.createdAt >= :startTime AND pa.createdAt <= :endTime " +
           "ORDER BY pa.createdAt DESC")
    List<ProductionAlert> findByFactoryIdAndCreatedAtBetween(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 查询已解决但超过截止时间未验证的告警（用于自动验证）
     */
    List<ProductionAlert> findByStatusAndResolvedAtBefore(String status, LocalDateTime cutoffTime);
}
