package com.cretas.aims.repository.calibration;

import com.cretas.aims.entity.calibration.ToolCallCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 工具调用缓存仓库接口
 */
@Repository
public interface ToolCallCacheRepository extends JpaRepository<ToolCallCache, Long> {

    /**
     * 根据缓存键查询
     */
    Optional<ToolCallCache> findByCacheKey(String cacheKey);

    /**
     * 根据会话ID、工具名和参数哈希查询
     */
    Optional<ToolCallCache> findBySessionIdAndToolNameAndParametersHash(
        String sessionId, String toolName, String parametersHash);

    /**
     * 查询会话的所有缓存
     */
    List<ToolCallCache> findBySessionId(String sessionId);

    /**
     * 查询未过期的缓存
     */
    @Query("SELECT c FROM ToolCallCache c WHERE c.cacheKey = :cacheKey AND c.expiresAt > :now")
    Optional<ToolCallCache> findValidCache(
        @Param("cacheKey") String cacheKey,
        @Param("now") LocalDateTime now);

    /**
     * 查询会话的未过期缓存
     */
    @Query("SELECT c FROM ToolCallCache c WHERE c.sessionId = :sessionId AND c.expiresAt > :now")
    List<ToolCallCache> findValidCachesBySession(
        @Param("sessionId") String sessionId,
        @Param("now") LocalDateTime now);

    /**
     * 删除过期缓存
     */
    @Modifying
    @Query("DELETE FROM ToolCallCache c WHERE c.expiresAt < :now")
    int deleteExpiredCache(@Param("now") LocalDateTime now);

    /**
     * 删除会话的所有缓存
     */
    @Modifying
    void deleteBySessionId(String sessionId);

    /**
     * 统计缓存命中总次数
     */
    @Query("SELECT COALESCE(SUM(c.hitCount), 0) FROM ToolCallCache c WHERE c.sessionId = :sessionId")
    Long sumHitCountBySession(@Param("sessionId") String sessionId);

    /**
     * 查询命中次数最高的缓存
     */
    List<ToolCallCache> findTop10ByOrderByHitCountDesc();
}
