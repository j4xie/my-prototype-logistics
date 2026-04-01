package com.cretas.aims.repository.rd;

import com.cretas.aims.entity.rd.QuotationTask;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface QuotationTaskRepository extends JpaRepository<QuotationTask, String> {
    Page<QuotationTask> findByFactoryIdAndDeletedAtIsNull(String factoryId, Pageable pageable);
    Page<QuotationTask> findByFactoryIdAndStatusAndDeletedAtIsNull(String factoryId, String status, Pageable pageable);
    QuotationTask findBySampleIdAndDeletedAtIsNull(String sampleId);
}
