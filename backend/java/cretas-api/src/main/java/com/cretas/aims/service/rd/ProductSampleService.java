package com.cretas.aims.service.rd;

import com.cretas.aims.entity.rd.RdRequest;
import com.cretas.aims.entity.rd.ProductSample;
import com.cretas.aims.entity.rd.QuotationTask;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ProductSampleService {

    // ==================== 研发需求 ====================
    RdRequest createRequest(String factoryId, String customerName, String customerContact,
                             String requirements, String urgency, Long submittedBy);
    RdRequest assignRequest(String requestId, Long assignedTo);
    Page<RdRequest> listRequests(String factoryId, String status, Pageable pageable);

    // ==================== 样品管理 ====================
    ProductSample createSample(String factoryId, String rdRequestId, String name,
                                String specification, String grade, String mainMaterial, Long assignedTo);
    ProductSample updateProgress(String sampleId, String note, String photoUrl);
    ProductSample submitForApproval(String sampleId, Long submittedBy);
    ProductSample approveSample(String sampleId, Long approvedBy, String notes);
    ProductSample rejectSample(String sampleId, Long approvedBy, String notes);
    Page<ProductSample> listSamples(String factoryId, String status, Pageable pageable);
    ProductSample getSample(String sampleId);

    // ==================== 报价任务 ====================
    QuotationTask getQuotationBySample(String sampleId);
    QuotationTask submitQuotation(String taskId, java.math.BigDecimal materialCost,
                                   java.math.BigDecimal laborCost, java.math.BigDecimal overheadCost,
                                   java.math.BigDecimal suggestedPrice, Long quotedBy);
    QuotationTask confirmQuotation(String taskId, java.math.BigDecimal finalPrice, Long confirmedBy);
    Page<QuotationTask> listQuotations(String factoryId, String status, Pageable pageable);
}
