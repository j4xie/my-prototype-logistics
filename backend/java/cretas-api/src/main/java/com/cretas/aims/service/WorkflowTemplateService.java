package com.cretas.aims.service;

import com.cretas.aims.entity.WorkflowTemplate;

import java.util.List;
import java.util.Optional;

public interface WorkflowTemplateService {

    List<WorkflowTemplate> listApproved();

    List<WorkflowTemplate> listByStatus(String reviewStatus);

    Optional<WorkflowTemplate> getById(Long id);

    WorkflowTemplate create(WorkflowTemplate template);

    WorkflowTemplate approve(Long id, Long reviewedBy, String reviewNotes);

    WorkflowTemplate reject(Long id, Long reviewedBy, String reviewNotes);

    List<WorkflowTemplate> search(String keyword);

    /**
     * Extract a template from an existing published StateMachine configuration.
     * Called by FactoryConfigAgentTool when factories share similar workflows.
     */
    WorkflowTemplate extractFromStateMachine(String factoryId, String entityType,
                                              String templateName, String description,
                                              String industryTags);
}
