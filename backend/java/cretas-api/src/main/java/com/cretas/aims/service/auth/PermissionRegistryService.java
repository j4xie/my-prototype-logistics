package com.cretas.aims.service.auth;

import com.cretas.aims.entity.auth.PermissionRegistry;
import com.cretas.aims.entity.auth.PermissionRegistry.Source;

import java.util.List;
import java.util.Map;

/**
 * 权限登记服务 (Sprint 4 Wave 2 Chat J — C-CHECKPOWER-1).
 *
 * <p>负责:
 * <ol>
 *   <li>启动时扫描所有 controller 的 {@code @RequirePermission} 注解,upsert 到
 *       permission_registry 表 (source=ANNOTATION)</li>
 *   <li>提供查询 API:列出全部权限 / 按 module / 按 source / audit gap (declared 但未引用)</li>
 *   <li>提供 manifest export 接口 — 输出 JSON 给运维 / 合规审计</li>
 * </ol>
 *
 * <p>设计要点:
 * <ul>
 *   <li>幂等 — 重复启动不重复插入 (upsert by permissionCode + factoryId=NULL)</li>
 *   <li>不删除既有 — 哪怕某 controller 的注解删了,registry 行保留 (审计追溯),
 *       只是 source_class/source_method 不再更新</li>
 *   <li>手动 / SEED 来源的行不被 ANNOTATION scanner 覆盖</li>
 * </ul>
 *
 * @since 2026-05-24
 */
public interface PermissionRegistryService {

    /**
     * 扫描所有 {@code @RequestController}/{@code @Controller} bean 的
     * {@code @RequirePermission} 注解, upsert 到 registry。
     *
     * <p>由 ApplicationReadyEvent listener 调用;也可通过 admin API 手动触发。
     *
     * @return scan summary {@code { scannedClasses, scannedMethods, registeredPermissions,
     *         updatedPermissions, skippedPermissions }}
     */
    ScanResult scanAndRegister();

    /** 列出全部 active 权限 (无 factory filter — global + 所有 factory 级别). */
    List<PermissionRegistry> listAllActive();

    /** 按 module 列出. */
    List<PermissionRegistry> listByModule(String module);

    /** 按 source 列出. */
    List<PermissionRegistry> listBySource(Source source);

    /** distinct module 列表. */
    List<String> listModules();

    /** Audit summary — 各 source / module 的 count. */
    Map<String, Object> auditSummary();

    /**
     * 扫描结果汇总.
     */
    record ScanResult(
            int scannedClasses,
            int scannedMethods,
            int registeredPermissions,
            int updatedPermissions,
            int skippedPermissions,
            List<String> errors
    ) {}
}
