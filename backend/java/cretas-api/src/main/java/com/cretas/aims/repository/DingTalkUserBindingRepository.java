package com.cretas.aims.repository;

import com.cretas.aims.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * DingTalk-side identity binding lookup.
 *
 * <p>Separate repo (not added to {@link UserRepository}) to keep my Track B1
 * scope narrow — no edit to the high-traffic shared User repository or User
 * entity. Goes through a native query so {@link User} doesn't need a new
 * field for {@code dingtalk_user_id} (column added by V20260516_01).
 *
 * <p>Returns a thin {@link DingTalkBoundUser} projection (id + factoryId +
 * roleCode + username) — everything the inbound consumer needs to build an
 * IntentExecuteRequest without loading the full User.
 */
@Repository
public interface DingTalkUserBindingRepository extends JpaRepository<User, Long> {

    @Query(value = "SELECT id AS userId, factory_id AS factoryId, " +
                   "       COALESCE(role_code, position) AS roleCode, username " +
                   "  FROM users " +
                   " WHERE dingtalk_user_id = :dingtalkUserId " +
                   "   AND deleted_at IS NULL " +
                   "   AND is_active = TRUE " +
                   " LIMIT 1",
           nativeQuery = true)
    Optional<DingTalkBoundUser> findBoundUser(@Param("dingtalkUserId") String dingtalkUserId);

    interface DingTalkBoundUser {
        Long getUserId();
        String getFactoryId();
        String getRoleCode();
        String getUsername();
    }
}
