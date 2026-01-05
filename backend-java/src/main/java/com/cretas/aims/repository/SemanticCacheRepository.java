package com.cretas.aims.repository;

import com.cretas.aims.entity.cache.SemanticCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 语义缓存 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Repository
public interface SemanticCacheRepository extends JpaRepository<SemanticCache, Long> {

    /**
     * 精确匹配：通过工厂ID和输入哈希查找未过期的缓存
     *
     * @param factoryId 工厂ID
     * @param inputHash 输入文本哈希
     * @param now 当前时间 (用于过期判断)
     * @return 缓存条目 (如果存在且未过期)
     */
    Optional<SemanticCache> findByFactoryIdAndInputHashAndExpiresAtAfter(
        String factoryId, String inputHash, LocalDateTime now);

    /**
     * 获取工厂的所有有效缓存 (用于语义匹配)
     *
     * @param factoryId 工厂ID
     * @param now 当前时间
     * @return 有效缓存列表
     */
    @Query("SELECT sc FROM SemanticCache sc WHERE sc.factoryId = :factoryId " +
           "AND sc.expiresAt > :now AND sc.embeddingVector IS NOT NULL " +
           "ORDER BY sc.hitCount DESC")
    List<SemanticCache> findValidCachesByFactoryId(
        @Param("factoryId") String factoryId,
        @Param("now") LocalDateTime now);

    /**
     * 获取工厂的有效缓存 (带数量限制)
     *
     * @param factoryId 工厂ID
     * @param now 当前时间
     * @param limit 最大返回数量
     * @return 有效缓存列表
     */
    @Query(value = "SELECT * FROM semantic_cache sc WHERE sc.factory_id = :factoryId " +
           "AND sc.expires_at > :now AND sc.embedding_vector IS NOT NULL " +
           "AND sc.deleted_at IS NULL " +
           "ORDER BY sc.hit_count DESC LIMIT :limit", nativeQuery = true)
    List<SemanticCache> findTopValidCachesByFactoryId(
        @Param("factoryId") String factoryId,
        @Param("now") LocalDateTime now,
        @Param("limit") int limit);

    /**
     * 按意图代码查找缓存
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param now 当前时间
     * @return 缓存列表
     */
    List<SemanticCache> findByFactoryIdAndIntentCodeAndExpiresAtAfter(
        String factoryId, String intentCode, LocalDateTime now);

    /**
     * 统计工厂的有效缓存数量
     *
     * @param factoryId 工厂ID
     * @param now 当前时间
     * @return 缓存数量
     */
    @Query("SELECT COUNT(sc) FROM SemanticCache sc WHERE sc.factoryId = :factoryId " +
           "AND sc.expiresAt > :now")
    long countValidCachesByFactoryId(
        @Param("factoryId") String factoryId,
        @Param("now") LocalDateTime now);

    /**
     * 删除过期缓存
     *
     * @param now 当前时间
     * @return 删除的数量
     */
    @Modifying
    @Query("DELETE FROM SemanticCache sc WHERE sc.expiresAt <= :now")
    int deleteExpiredCaches(@Param("now") LocalDateTime now);

    /**
     * 删除工厂的所有缓存
     *
     * @param factoryId 工厂ID
     * @return 删除的数量
     */
    @Modifying
    @Query("DELETE FROM SemanticCache sc WHERE sc.factoryId = :factoryId")
    int deleteByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 删除指定意图的所有缓存 (意图配置更新时使用)
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @return 删除的数量
     */
    @Modifying
    @Query("DELETE FROM SemanticCache sc WHERE sc.factoryId = :factoryId " +
           "AND sc.intentCode = :intentCode")
    int deleteByFactoryIdAndIntentCode(
        @Param("factoryId") String factoryId,
        @Param("intentCode") String intentCode);

    /**
     * 更新命中统计
     *
     * @param id 缓存ID
     * @param hitTime 命中时间
     * @return 更新的行数
     */
    @Modifying
    @Query("UPDATE SemanticCache sc SET sc.hitCount = sc.hitCount + 1, " +
           "sc.lastHitAt = :hitTime WHERE sc.id = :id")
    int incrementHitCount(@Param("id") Long id, @Param("hitTime") LocalDateTime hitTime);

    /**
     * 检查是否存在相同的缓存
     *
     * @param factoryId 工厂ID
     * @param inputHash 输入哈希
     * @return 是否存在
     */
    boolean existsByFactoryIdAndInputHash(String factoryId, String inputHash);

    /**
     * 通过工厂ID和哈希查找缓存
     *
     * @param factoryId 工厂ID
     * @param inputHash 输入哈希
     * @return 缓存条目
     */
    Optional<SemanticCache> findByFactoryIdAndInputHash(String factoryId, String inputHash);

    /**
     * 统计工厂的缓存总数
     *
     * @param factoryId 工厂ID
     * @return 缓存数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计工厂的有效缓存数量
     *
     * @param factoryId 工厂ID
     * @param now 当前时间
     * @return 有效缓存数量
     */
    @Query("SELECT COUNT(sc) FROM SemanticCache sc WHERE sc.factoryId = :factoryId " +
           "AND sc.expiresAt > :now")
    long countValidByFactoryId(@Param("factoryId") String factoryId,
                               @Param("now") LocalDateTime now);

    /**
     * 获取最近命中的缓存 (用于热点分析)
     *
     * @param factoryId 工厂ID
     * @param since 起始时间
     * @return 缓存列表
     */
    @Query("SELECT sc FROM SemanticCache sc WHERE sc.factoryId = :factoryId " +
           "AND sc.lastHitAt >= :since ORDER BY sc.hitCount DESC")
    List<SemanticCache> findRecentlyHitCaches(
        @Param("factoryId") String factoryId,
        @Param("since") LocalDateTime since);
}
