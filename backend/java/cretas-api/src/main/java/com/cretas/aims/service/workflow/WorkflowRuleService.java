package com.cretas.aims.service.workflow;

import com.cretas.aims.dto.workflow.WorkflowRuleRequest;
import com.cretas.aims.entity.config.WorkflowRule;

import java.util.List;

/**
 * WorkflowRule CRUD service — Sprint 4 Wave 1 (C-WF-RULE-1).
 *
 * @since 2026-05-16
 */
public interface WorkflowRuleService {

    WorkflowRule create(String factoryId, WorkflowRuleRequest request);

    WorkflowRule update(String factoryId, String id, WorkflowRuleRequest request);

    void delete(String factoryId, String id);

    /** 404 if not found. */
    WorkflowRule getRequired(String factoryId, String id);

    List<WorkflowRule> listByWorkflow(String factoryId, String workflowId);

    /** Executor 用 — by workflow + node, enabled only, sorted by priority asc. */
    List<WorkflowRule> findActiveByNode(String workflowId, String nodeId);
}
