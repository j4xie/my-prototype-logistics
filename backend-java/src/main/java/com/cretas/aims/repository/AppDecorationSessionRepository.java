package com.cretas.aims.repository;

import com.cretas.aims.entity.decoration.AppDecorationSession;
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
 * AI装饰会话数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Repository
public interface AppDecorationSessionRepository extends JpaRepository<AppDecorationSession, Long> {

    /**
     * 根据会话ID查找会话
     *
     * @param sessionId 会话ID
     * @return 会话记录
     */
    Optional<AppDecorationSession> findBySessionId(String sessionId);

    /**
     * 根据工厂ID查找所有会话
     *
     * @param factoryId 工厂ID
     * @return 会话列表
     */
    List<AppDecorationSession> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID分页查找会话
     *
     * @param factoryId 工厂ID
     * @param pageable 分页参数
     * @return 会话分页
     */
    Page<AppDecorationSession> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据用户ID查找所有会话
     *
     * @param userId 用户ID
     * @return 会话列表
     */
    List<AppDecorationSession> findByUserId(Long userId);

    /**
     * 根据工厂ID和用户ID查找会话
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @return 会话列表
     */
    List<AppDecorationSession> findByFactoryIdAndUserId(String factoryId, Long userId);

    /**
     * 根据工厂ID和状态查找会话
     *
     * @param factoryId 工厂ID
     * @param status 状态 (0处理中 1成功 2失败 3已应用)
     * @return 会话列表
     */
    List<AppDecorationSession> findByFactoryIdAndStatus(String factoryId, Integer status);

    /**
     * 根据意图代码查找会话
     *
     * @param intentCode 意图代码
     * @return 会话列表
     */
    List<AppDecorationSession> findByIntentCode(String intentCode);

    /**
     * 查找需要澄清的会话
     *
     * @param factoryId 工厂ID
     * @return 会话列表
     */
    @Query("SELECT s FROM AppDecorationSession s WHERE s.factoryId = :factoryId AND s.clarificationNeeded = 1")
    List<AppDecorationSession> findSessionsNeedingClarification(@Param("factoryId") String factoryId);

    /**
     * 查找用户最近的会话
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param pageable 分页参数 (用于限制数量)
     * @return 会话列表
     */
    @Query("SELECT s FROM AppDecorationSession s WHERE s.factoryId = :factoryId AND s.userId = :userId ORDER BY s.createdAt DESC")
    List<AppDecorationSession> findRecentSessionsByUser(
        @Param("factoryId") String factoryId,
        @Param("userId") Long userId,
        Pageable pageable);

    /**
     * 查找成功并已应用的会话数量
     *
     * @param factoryId 工厂ID
     * @return 数量
     */
    @Query("SELECT COUNT(s) FROM AppDecorationSession s WHERE s.factoryId = :factoryId AND s.status = 3")
    Long countAppliedSessions(@Param("factoryId") String factoryId);

    /**
     * 查找指定时间范围内的会话
     *
     * @param factoryId 工厂ID
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 会话列表
     */
    @Query("SELECT s FROM AppDecorationSession s WHERE s.factoryId = :factoryId AND s.createdAt BETWEEN :startTime AND :endTime")
    List<AppDecorationSession> findByFactoryIdAndCreatedAtBetween(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 检查会话是否存在
     *
     * @param sessionId 会话ID
     * @return 是否存在
     */
    boolean existsBySessionId(String sessionId);

    /**
     * 更新会话状态
     *
     * @param sessionId 会话ID
     * @param status 新状态
     */
    @Modifying
    @Query("UPDATE AppDecorationSession s SET s.status = :status, s.updatedAt = CURRENT_TIMESTAMP WHERE s.sessionId = :sessionId")
    void updateStatus(@Param("sessionId") String sessionId, @Param("status") Integer status);

    /**
     * 更新生成的配置
     *
     * @param sessionId 会话ID
     * @param generatedConfig 生成的配置JSON
     */
    @Modifying
    @Query("UPDATE AppDecorationSession s SET s.generatedConfig = :generatedConfig, s.status = 1, s.updatedAt = CURRENT_TIMESTAMP WHERE s.sessionId = :sessionId")
    void updateGeneratedConfig(@Param("sessionId") String sessionId, @Param("generatedConfig") String generatedConfig);
}
