package com.cretas.aims.service.intent;

import java.util.Optional;

/**
 * 意图权限校验服务
 *
 * 负责意图执行的权限检查和审批流程管理
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface IntentPermissionService {

    /**
     * 检查用户是否有权限执行指定意图（带租户隔离）
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图编码
     * @param userRole 用户角色
     * @return 是否有权限
     */
    boolean hasPermission(String factoryId, String intentCode, String userRole);

    /**
     * 检查用户是否有权限执行指定意图（全局）
     * @deprecated 推荐使用带 factoryId 的方法
     */
    @Deprecated
    boolean hasPermission(String intentCode, String userRole);

    /**
     * 检查意图是否需要审批（带租户隔离）
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图编码
     * @return 是否需要审批
     */
    boolean requiresApproval(String factoryId, String intentCode);

    /**
     * 检查意图是否需要审批（全局）
     * @deprecated 推荐使用带 factoryId 的方法
     */
    @Deprecated
    boolean requiresApproval(String intentCode);

    /**
     * 获取意图的审批链ID（带租户隔离）
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图编码
     * @return 审批链ID
     */
    Optional<String> getApprovalChainId(String factoryId, String intentCode);

    /**
     * 获取意图的审批链ID（全局）
     * @deprecated 推荐使用带 factoryId 的方法
     */
    @Deprecated
    Optional<String> getApprovalChainId(String intentCode);
}
