package com.cretas.aims.repository;

import com.cretas.aims.entity.PlatformAdmin;
import com.cretas.aims.entity.enums.PlatformRole;
import com.cretas.aims.entity.enums.Status;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
/**
 * 平台管理员仓库接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface PlatformAdminRepository extends JpaRepository<PlatformAdmin, Integer> {
    /**
     * 根据用户名查找平台管理员
     */
    Optional<PlatformAdmin> findByUsername(String username);
     /**
     * 根据邮箱查找平台管理员
      */
    Optional<PlatformAdmin> findByEmail(String email);
     /**
     * 根据手机号查找平台管理员
      */
    Optional<PlatformAdmin> findByPhoneNumber(String phoneNumber);
     /**
     * 检查用户名是否存在
      */
    boolean existsByUsername(String username);
     /**
     * 检查邮箱是否存在
      */
    boolean existsByEmail(String email);
     /**
     * 根据角色查找平台管理员列表
      */
    List<PlatformAdmin> findByPlatformRole(PlatformRole role);
     /**
     * 根据状态查找平台管理员列表
      */
    List<PlatformAdmin> findByStatus(Status status);
     /**
     * 查找激活的平台管理员
      */
    List<PlatformAdmin> findByStatusOrderByCreatedAtDesc(Status status);
}
