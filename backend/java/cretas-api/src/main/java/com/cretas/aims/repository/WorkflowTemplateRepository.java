package com.cretas.aims.repository;

import com.cretas.aims.entity.WorkflowTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowTemplateRepository extends JpaRepository<WorkflowTemplate, Long> {

    List<WorkflowTemplate> findByReviewStatus(String reviewStatus);

    List<WorkflowTemplate> findByReviewStatusIn(List<String> statuses);

    List<WorkflowTemplate> findByIsSeedDataTrue();

    List<WorkflowTemplate> findByTemplateNameContainingIgnoreCase(String keyword);

    long countByReviewStatus(String reviewStatus);
}
