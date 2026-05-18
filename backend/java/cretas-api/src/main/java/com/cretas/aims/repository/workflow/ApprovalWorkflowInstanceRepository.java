package com.cretas.aims.repository.workflow;

import com.cretas.aims.entity.workflow.ApprovalWorkflowInstance;
import com.cretas.aims.entity.workflow.ApprovalWorkflowInstance.InstanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Approval workflow instance repository — Phase 1 B.3.
 *
 * <p>Note on soft-delete: {@link ApprovalWorkflowInstance} 在类上声明
 * {@code @Where(clause = "deleted_at IS NULL")}, 所有查询自动过滤.
 *
 * @since 2026-05-18
 */
@Repository
public interface ApprovalWorkflowInstanceRepository
        extends JpaRepository<ApprovalWorkflowInstance, String> {

    /**
     * 业务实体查实例 — {@code PurchaseServiceImpl.findInstanceByPO} 用 (B.6).
     *
     * <p>同一 (factory, module, business entity) 理论上至多 1 个 active 实例 (业务约束).
     * 历史归档实例也命中 — caller 应进一步 filter by status 如需排除终态.
     */
    Optional<ApprovalWorkflowInstance> findByFactoryIdAndModuleCodeAndBusinessEntityId(
            String factoryId, String moduleCode, String businessEntityId);

    /**
     * 工厂维度按 status 查 — 用于 factory 级别统计或定向恢复.
     */
    List<ApprovalWorkflowInstance> findByFactoryIdAndStatus(
            String factoryId, InstanceStatus status);

    /**
     * 启动恢复 — 全工厂扫所有 RUNNING 实例.
     *
     * <p>调用方: {@code WorkflowEngineServiceImpl#rebuildRedisFromPg}
     * (注解 {@code @EventListener(ApplicationReadyEvent.class)}).
     *
     * <p>命中 partial index {@code idx_aw_instances_recovery}
     * ({@code WHERE status='RUNNING' AND deleted_at IS NULL}).
     */
    List<ApprovalWorkflowInstance> findByStatus(InstanceStatus status);

    /**
     * Phase D 报表统计 — 按 workflow + status 维度.
     */
    List<ApprovalWorkflowInstance> findByFactoryIdAndWorkflowIdAndStatus(
            String factoryId, String workflowId, InstanceStatus status);
}
