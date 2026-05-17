package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.WorkflowRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * WorkflowRule 数据访问 — Sprint 4 Wave 1 (C-WF-RULE-1).
 *
 * @since 2026-05-16
 */
@Repository
public interface WorkflowRuleRepository extends JpaRepository<WorkflowRule, String> {

    /** Executor primary lookup — condition 节点求值时拿全部已启用 rule, 按 priority 排序. */
    List<WorkflowRule> findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(
            String workflowId, String nodeId);

    /** factoryId-scoped 单条查询 (CRUD/REST 用). */
    Optional<WorkflowRule> findByIdAndFactoryId(String id, String factoryId);

    /** 列 workflow 下所有 rule (Vue editor / 管理列表用). */
    List<WorkflowRule> findByWorkflowIdAndFactoryIdOrderByNodeIdAscPriorityAsc(
            String workflowId, String factoryId);

    /** 列 factory 下所有 rule. */
    List<WorkflowRule> findByFactoryIdOrderByCreatedAtDesc(String factoryId);

    /** 用于 cascade 校验 — workflow 下指定 node 有多少 rule. */
    long countByWorkflowIdAndNodeId(String workflowId, String nodeId);
}
