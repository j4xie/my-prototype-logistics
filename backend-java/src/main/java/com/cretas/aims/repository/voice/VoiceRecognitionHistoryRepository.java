package com.cretas.aims.repository.voice;

import com.cretas.aims.entity.voice.VoiceRecognitionHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 语音识别历史记录仓库
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Repository
public interface VoiceRecognitionHistoryRepository extends JpaRepository<VoiceRecognitionHistory, Long> {

    /**
     * 按工厂ID分页查询
     */
    Page<VoiceRecognitionHistory> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    /**
     * 按工厂ID和用户ID分页查询
     */
    Page<VoiceRecognitionHistory> findByFactoryIdAndUserIdOrderByCreatedAtDesc(
            String factoryId, Long userId, Pageable pageable);

    /**
     * 按工厂ID和时间范围查询
     */
    @Query("SELECT h FROM VoiceRecognitionHistory h WHERE h.factoryId = :factoryId " +
           "AND h.createdAt BETWEEN :startTime AND :endTime ORDER BY h.createdAt DESC")
    Page<VoiceRecognitionHistory> findByFactoryIdAndTimeRange(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            Pageable pageable);

    /**
     * 按工厂ID和业务场景查询
     */
    Page<VoiceRecognitionHistory> findByFactoryIdAndBusinessSceneOrderByCreatedAtDesc(
            String factoryId, String businessScene, Pageable pageable);

    /**
     * 统计工厂今日识别次数
     */
    @Query("SELECT COUNT(h) FROM VoiceRecognitionHistory h WHERE h.factoryId = :factoryId " +
           "AND h.createdAt >= :todayStart")
    Long countTodayByFactoryId(@Param("factoryId") String factoryId,
                               @Param("todayStart") LocalDateTime todayStart);

    /**
     * 统计用户今日识别次数
     */
    @Query("SELECT COUNT(h) FROM VoiceRecognitionHistory h WHERE h.factoryId = :factoryId " +
           "AND h.userId = :userId AND h.createdAt >= :todayStart")
    Long countTodayByUserIdAndFactoryId(@Param("factoryId") String factoryId,
                                        @Param("userId") Long userId,
                                        @Param("todayStart") LocalDateTime todayStart);

    /**
     * 获取识别成功率统计
     */
    @Query("SELECT COUNT(h), SUM(CASE WHEN h.statusCode = 0 THEN 1 ELSE 0 END) " +
           "FROM VoiceRecognitionHistory h WHERE h.factoryId = :factoryId " +
           "AND h.createdAt BETWEEN :startTime AND :endTime")
    List<Object[]> getSuccessRateStats(@Param("factoryId") String factoryId,
                                       @Param("startTime") LocalDateTime startTime,
                                       @Param("endTime") LocalDateTime endTime);

    /**
     * 删除过期记录
     */
    @Query("DELETE FROM VoiceRecognitionHistory h WHERE h.factoryId = :factoryId " +
           "AND h.createdAt < :expireTime")
    void deleteExpiredRecords(@Param("factoryId") String factoryId,
                              @Param("expireTime") LocalDateTime expireTime);

    /**
     * 按关联业务ID查询
     */
    List<VoiceRecognitionHistory> findByFactoryIdAndRelatedBusinessIdOrderByCreatedAtDesc(
            String factoryId, String relatedBusinessId);
}
