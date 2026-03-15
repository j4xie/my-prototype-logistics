package com.cretas.aims.service.impl;

import com.cretas.aims.entity.WorkflowTemplate;
import com.cretas.aims.entity.rules.StateMachine;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.StateMachineRepository;
import com.cretas.aims.repository.WorkflowTemplateRepository;
import com.cretas.aims.service.WorkflowTemplateService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class WorkflowTemplateServiceImpl implements WorkflowTemplateService {

    private static final Logger log = LoggerFactory.getLogger(WorkflowTemplateServiceImpl.class);
    private final WorkflowTemplateRepository repository;
    private final StateMachineRepository stateMachineRepository;

    @Override
    public List<WorkflowTemplate> listApproved() {
        return repository.findByReviewStatus("approved");
    }

    @Override
    public List<WorkflowTemplate> listByStatus(String reviewStatus) {
        return repository.findByReviewStatus(reviewStatus);
    }

    @Override
    public Optional<WorkflowTemplate> getById(Long id) {
        return repository.findById(id);
    }

    @Override
    @Transactional
    public WorkflowTemplate create(WorkflowTemplate template) {
        if (template.getWorkflowJson() == null || template.getWorkflowJson().isEmpty()) {
            throw new BusinessException("workflowJson is required");
        }
        return repository.save(template);
    }

    @Override
    @Transactional
    public WorkflowTemplate approve(Long id, Long reviewedBy, String reviewNotes) {
        WorkflowTemplate template = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowTemplate", "id", id.toString()));

        if (!"pending_review".equals(template.getReviewStatus())) {
            throw new BusinessException("Only pending_review templates can be approved");
        }

        template.setReviewStatus("approved");
        template.setReviewedBy(reviewedBy);
        template.setReviewedAt(LocalDateTime.now());
        template.setReviewNotes(reviewNotes);
        return repository.save(template);
    }

    @Override
    @Transactional
    public WorkflowTemplate reject(Long id, Long reviewedBy, String reviewNotes) {
        WorkflowTemplate template = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowTemplate", "id", id.toString()));

        if (!"pending_review".equals(template.getReviewStatus())) {
            throw new BusinessException("Only pending_review templates can be rejected");
        }

        template.setReviewStatus("rejected");
        template.setReviewedBy(reviewedBy);
        template.setReviewedAt(LocalDateTime.now());
        template.setReviewNotes(reviewNotes);
        return repository.save(template);
    }

    @Override
    public List<WorkflowTemplate> search(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return repository.findByReviewStatusIn(List.of("approved", "pending_review"));
        }
        return repository.findByTemplateNameContainingIgnoreCase(keyword.trim());
    }

    @Override
    @Transactional
    public WorkflowTemplate extractFromStateMachine(String factoryId, String entityType,
                                                     String templateName, String description,
                                                     String industryTags) {
        StateMachine sm = stateMachineRepository
                .findByFactoryIdAndEntityTypeAndPublishStatus(factoryId, entityType, "published")
                .orElseThrow(() -> new ResourceNotFoundException(
                        "StateMachine", "factoryId+entityType", factoryId + "/" + entityType));

        log.info("Extracting workflow template from StateMachine: factory={}, entity={}, version={}",
                factoryId, entityType, sm.getVersion());

        WorkflowTemplate template = WorkflowTemplate.builder()
                .templateName(templateName != null ? templateName : sm.getMachineName())
                .description(description != null ? description : sm.getMachineDescription())
                .industryTags(industryTags != null ? industryTags : "[]")
                .workflowJson(buildWorkflowJson(sm))
                .sourceCount(1)
                .reviewStatus("pending_review")
                .isSeedData(false)
                .build();

        return repository.save(template);
    }

    private String buildWorkflowJson(StateMachine sm) {
        return String.format(
                "{\"initialState\":\"%s\",\"states\":%s,\"transitions\":%s}",
                sm.getInitialState(),
                sm.getStatesJson(),
                sm.getTransitionsJson()
        );
    }
}
