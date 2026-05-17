package com.cretas.aims.service;

import com.cretas.aims.entity.config.OpinionTemplate;

import java.util.List;
import java.util.Optional;

/**
 * 审批意见模板服务 (C-OPINION-1).
 *
 * <p>Sprint 4 W2 Chat J 完成 PR #730 foundation 之后的 service+controller 接入.
 * 弹框 Vue 组件 {@code OpinionInputDialog} 通过 {@link #listAvailable} 拉取
 * "工厂自定义 + 系统预设" 合集作 dropdown.
 *
 * <p>系统预设 (factoryId IS NULL) 全局共享, 不允许工厂用户修改 — Controller 层
 * {@code @RequirePermission("system:read_write")} 限制 + Service 层防御性 reject
 * 任何 factoryId=NULL 的写操作.
 *
 * @since 2026-05-16
 */
public interface OpinionTemplateService {

    /**
     * 弹框使用: 工厂可见的全部 active 模板 (factoryId 自定义 + factory_id IS NULL 系统预设),
     * 按 sortOrder 升序.
     */
    List<OpinionTemplate> listAvailable(String factoryId, String decisionType);

    /** Admin: 列出某工厂自定义模板 (不含系统预设). */
    List<OpinionTemplate> listByFactory(String factoryId);

    /** Admin: 列出系统预设 (factory_id IS NULL). */
    List<OpinionTemplate> listSystemPresets();

    Optional<OpinionTemplate> getById(String factoryId, String id);

    /**
     * 创建工厂自定义模板.
     *
     * @throws com.cretas.aims.exception.BusinessException 若 factoryId NULL/empty (禁止改系统预设)
     */
    OpinionTemplate create(String factoryId, OpinionTemplate template);

    /**
     * 更新工厂自定义模板 (PATCH semantics — 非空字段覆盖).
     *
     * @throws com.cretas.aims.exception.ResourceNotFoundException 若 id 不存在或属于其他工厂
     * @throws com.cretas.aims.exception.BusinessException 若试图改系统预设 (factoryId NULL)
     */
    OpinionTemplate update(String factoryId, String id, OpinionTemplate partial);

    /**
     * 软删除工厂自定义模板.
     *
     * @throws com.cretas.aims.exception.ResourceNotFoundException 若 id 不存在或属于其他工厂
     * @throws com.cretas.aims.exception.BusinessException 若试图删系统预设
     */
    void delete(String factoryId, String id);
}
