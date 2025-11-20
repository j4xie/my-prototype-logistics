package com.cretas.aims.repository;

import com.cretas.aims.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
/**
 * 会话数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface SessionRepository extends JpaRepository<Session, String> {
    /**
     * 根据访问令牌查找未撤销的会话
     */
    Optional<Session> findByTokenAndIsRevokedFalse(String token);
     /**
     * 根据刷新令牌查找未撤销的会话
      */
    Optional<Session> findByRefreshTokenAndIsRevokedFalse(String refreshToken);
     /**
     * 查找用户的所有活动会话
      */
    List<Session> findByUserIdAndIsRevokedFalse(Integer userId);
     /**
     * 查找工厂的所有活动会话
      */
    List<Session> findByFactoryIdAndIsRevokedFalse(String factoryId);
     /**
     * 撤销用户的所有会话
      */
    @Modifying
    @Query("UPDATE Session s SET s.isRevoked = true WHERE s.userId = :userId")
    void revokeAllUserSessions(@Param("userId") Integer userId);
     /**
     * 撤销工厂的所有会话
      */
    @Query("UPDATE Session s SET s.isRevoked = true WHERE s.factoryId = :factoryId")
    void revokeAllFactorySessions(@Param("factoryId") String factoryId);
     /**
     * 删除过期的会话
      */
    @Query("DELETE FROM Session s WHERE s.expiresAt < :expireTime")
    void deleteExpiredSessions(@Param("expireTime") LocalDateTime expireTime);
     /**
     * 统计活动会话数
      */
    @Query("SELECT COUNT(s) FROM Session s WHERE s.isRevoked = false AND s.expiresAt > :currentTime")
    Long countActiveSessions(@Param("currentTime") LocalDateTime currentTime);
     /**
     * 检查会话是否存在且有效
      */
    @Query("SELECT COUNT(s) > 0 FROM Session s WHERE s.token = :token AND s.isRevoked = false AND s.expiresAt > :currentTime")
    boolean isSessionValid(@Param("token") String token, @Param("currentTime") LocalDateTime currentTime);
}
