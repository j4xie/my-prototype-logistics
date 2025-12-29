package com.cretas.aims.repository;

import com.cretas.aims.entity.MixedBatchGroup;
import com.cretas.aims.entity.enums.MixedBatchType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 混批分组仓库
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Repository
public interface MixedBatchGroupRepository extends JpaRepository<MixedBatchGroup, String> {

    /**
     * 按工厂和状态查询
     */
    Page<MixedBatchGroup> findByFactoryIdAndStatus(String factoryId, String status, Pageable pageable);

    /**
     * 按工厂查询所有
     */
    Page<MixedBatchGroup> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 按工厂和类型查询
     */
    Page<MixedBatchGroup> findByFactoryIdAndGroupType(String factoryId, MixedBatchType groupType, Pageable pageable);

    /**
     * 按工厂和状态列表查询
     */
    Page<MixedBatchGroup> findByFactoryIdAndStatusIn(String factoryId, List<String> statuses, Pageable pageable);

    /**
     * 查询待确认的混批组
     */
    @Query("SELECT m FROM MixedBatchGroup m WHERE m.factoryId = :factoryId AND m.status = 'pending' ORDER BY m.recommendScore DESC")
    List<MixedBatchGroup> findPendingGroups(@Param("factoryId") String factoryId);

    /**
     * 按工厂和ID查询
     */
    Optional<MixedBatchGroup> findByIdAndFactoryId(String id, String factoryId);

    /**
     * 查询高推荐分数的混批组
     */
    @Query("SELECT m FROM MixedBatchGroup m WHERE m.factoryId = :factoryId AND m.status = 'pending' AND m.recommendScore >= :minScore ORDER BY m.recommendScore DESC")
    List<MixedBatchGroup> findHighScoreGroups(@Param("factoryId") String factoryId, @Param("minScore") Integer minScore);

    /**
     * 按原料批次查询混批组
     */
    List<MixedBatchGroup> findByFactoryIdAndMaterialBatchId(String factoryId, String materialBatchId);

    /**
     * 按工艺类型查询混批组
     */
    List<MixedBatchGroup> findByFactoryIdAndProcessType(String factoryId, String processType);

    /**
     * 查询包含特定订单的混批组
     */
    @Query("SELECT m FROM MixedBatchGroup m WHERE m.factoryId = :factoryId AND m.orderIds LIKE CONCAT('%', :orderId, '%')")
    List<MixedBatchGroup> findByOrderId(@Param("factoryId") String factoryId, @Param("orderId") String orderId);

    /**
     * 统计各状态数量
     */
    @Query("SELECT m.status, COUNT(m) FROM MixedBatchGroup m WHERE m.factoryId = :factoryId GROUP BY m.status")
    List<Object[]> countByStatus(@Param("factoryId") String factoryId);

    /**
     * 统计各类型数量
     */
    @Query("SELECT m.groupType, COUNT(m) FROM MixedBatchGroup m WHERE m.factoryId = :factoryId AND m.status = :status GROUP BY m.groupType")
    List<Object[]> countByGroupType(@Param("factoryId") String factoryId, @Param("status") String status);

    /**
     * 查询时间范围内的混批组
     */
    @Query("SELECT m FROM MixedBatchGroup m WHERE m.factoryId = :factoryId AND m.createdAt BETWEEN :startTime AND :endTime")
    List<MixedBatchGroup> findByTimeRange(@Param("factoryId") String factoryId,
                                          @Param("startTime") LocalDateTime startTime,
                                          @Param("endTime") LocalDateTime endTime);

    /**
     * 标记过期的混批组
     */
    @Modifying
    @Query("UPDATE MixedBatchGroup m SET m.status = 'expired' WHERE m.factoryId = :factoryId AND m.status = 'pending' AND m.earliestDeadline < :now")
    int markExpiredGroups(@Param("factoryId") String factoryId, @Param("now") LocalDateTime now);

    /**
     * 删除过期的混批组
     */
    @Modifying
    @Query("DELETE FROM MixedBatchGroup m WHERE m.factoryId = :factoryId AND m.status = 'expired' AND m.createdAt < :before")
    int deleteExpiredGroups(@Param("factoryId") String factoryId, @Param("before") LocalDateTime before);

    /**
     * 统计已确认混批节省的总时间
     */
    @Query("SELECT COALESCE(SUM(m.estimatedSwitchSaving), 0) FROM MixedBatchGroup m WHERE m.factoryId = :factoryId AND m.status = 'confirmed'")
    Integer sumSwitchSavingByFactory(@Param("factoryId") String factoryId);

    /**
     * 统计待确认数量
     */
    long countByFactoryIdAndStatus(String factoryId, String status);
}
