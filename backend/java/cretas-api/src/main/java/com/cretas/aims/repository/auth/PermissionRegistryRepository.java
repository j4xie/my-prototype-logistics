package com.cretas.aims.repository.auth;

import com.cretas.aims.entity.auth.PermissionRegistry;
import com.cretas.aims.entity.auth.PermissionRegistry.Source;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 权限登记 Repository (Sprint 4 Wave 2 Chat J — C-CHECKPOWER-1).
 *
 * @since 2026-05-24
 */
@Repository
public interface PermissionRegistryRepository extends JpaRepository<PermissionRegistry, String> {

    /**
     * 按 (permission_code, factory_id) 查询. factoryId NULL 表示全局权限。
     * 不使用 derived query (Spring Data 对 NULL 参数行为不一致),用 @Query 显式 IS NULL。
     */
    @Query("""
        SELECT p FROM PermissionRegistry p
        WHERE p.permissionCode = :code
          AND (
                (:factoryId IS NULL AND p.factoryId IS NULL)
             OR (CAST(:factoryId AS string) IS NOT NULL AND p.factoryId = :factoryId)
          )
        """)
    Optional<PermissionRegistry> findByCodeAndFactory(
            @Param("code") String permissionCode,
            @Param("factoryId") String factoryId);

    /** 仅按 code 查全局 (factory_id IS NULL) 权限. */
    Optional<PermissionRegistry> findByPermissionCodeAndFactoryIdIsNull(String permissionCode);

    /** 列出工厂级权限 (factory_id = ?). */
    List<PermissionRegistry> findByFactoryId(String factoryId);

    /** 全部全局权限 (factory_id IS NULL). */
    List<PermissionRegistry> findByFactoryIdIsNullOrderByModuleAscActionAsc();

    /** 按 source 过滤 (e.g. 列出所有 ANNOTATION 自动注册权限). */
    List<PermissionRegistry> findBySource(Source source);

    /** 按 module 过滤. */
    List<PermissionRegistry> findByModuleOrderByActionAsc(String module);

    /** distinct module 列表 — 用于 audit summary "几个模块". */
    @Query("SELECT DISTINCT p.module FROM PermissionRegistry p WHERE p.isActive = TRUE ORDER BY p.module")
    List<String> findDistinctModules();

    /** Count by source — audit summary. */
    long countBySource(Source source);
}
