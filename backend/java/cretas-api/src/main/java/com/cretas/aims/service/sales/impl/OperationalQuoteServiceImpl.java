package com.cretas.aims.service.sales.impl;

import com.cretas.aims.entity.sales.OperationalQuote;
import com.cretas.aims.repository.sales.OperationalQuoteRepository;
import com.cretas.aims.service.sales.OperationalQuoteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class OperationalQuoteServiceImpl implements OperationalQuoteService {

    private final OperationalQuoteRepository operationalQuoteRepository;

    /** Canvas V2: DB-driven validation rules */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.ValidationRuleEvaluator validationRuleEvaluator;

    private void runConfiguredValidation(String factoryId, String operation, java.util.Map<String, Object> context) {
        if (validationRuleEvaluator == null) return;
        try {
            validationRuleEvaluator.validate(factoryId, "operational_quote", operation, context);
        } catch (com.cretas.aims.exception.BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Canvas validation non-blocking error: {}", e.getMessage());
        }
    }

    /**
     * 状态机常量 — DRAFT/PENDING_QUOTE/PENDING_APPROVAL/APPROVED/REJECTED/EXPIRED
     */
    private static final String STATUS_PENDING_QUOTE = "PENDING_QUOTE";
    private static final String STATUS_PENDING_APPROVAL = "PENDING_APPROVAL";
    private static final String STATUS_APPROVED = "APPROVED";
    private static final String STATUS_REJECTED = "REJECTED";

    @Override
    @Transactional
    public OperationalQuote createQuote(String factoryId, String sampleId, String customerId,
                                         String productTypeId, String bomId,
                                         Long submittedByUserId, Long quotedByUserId, String quotedByName,
                                         String remarks) {
        runConfiguredValidation(factoryId, "CREATE", java.util.Map.of(
            "customerId", customerId != null ? customerId : "",
            "amount", java.math.BigDecimal.ZERO,
            "marginRate", java.math.BigDecimal.ZERO));
        OperationalQuote quote = new OperationalQuote();
        quote.setFactoryId(factoryId);
        quote.setQuoteNo(generateQuoteNo(factoryId));
        quote.setSampleId(sampleId);
        quote.setCustomerId(customerId);
        quote.setProductTypeId(productTypeId);
        quote.setBomId(bomId);
        quote.setStatus(STATUS_PENDING_QUOTE);
        quote.setSubmittedByUserId(submittedByUserId);
        quote.setSubmittedAt(LocalDateTime.now());
        // 指派给销售运营 (具体的人, 不是岗位)
        quote.setQuotedByUserId(quotedByUserId);
        quote.setQuotedByName(quotedByName);
        quote.setRemarks(remarks);
        quote.setRevisionCount(0);

        try {
            OperationalQuote saved = operationalQuoteRepository.save(quote);
            log.info("报价单创建: quoteNo={}, sampleId={}, assignedTo={}",
                    saved.getQuoteNo(), sampleId, quotedByName);
            return saved;
        } catch (Exception e) {
            log.error("报价单创建失败: factoryId={}, quoteNo={}, error={}", factoryId, quote.getQuoteNo(), e.getMessage(), e);
            throw new RuntimeException("报价单创建失败: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public OperationalQuote submitQuote(String factoryId, String quoteId,
                                         String quoteType, BigDecimal unitPrice, String unit,
                                         BigDecimal minOrderQty, BigDecimal costPrice,
                                         LocalDate validUntil, String remarks) {
        runConfiguredValidation(factoryId, "UPDATE", java.util.Map.of(
            "quoteId", quoteId != null ? quoteId : "",
            "amount", unitPrice != null ? unitPrice : BigDecimal.ZERO));
        OperationalQuote quote = getQuote(factoryId, quoteId);
        if (!STATUS_PENDING_QUOTE.equals(quote.getStatus())) {
            throw new IllegalStateException("只有 PENDING_QUOTE 状态可以录价, 当前: " + quote.getStatus());
        }
        quote.setQuoteType(quoteType);
        quote.setUnitPrice(unitPrice);
        quote.setUnit(unit);
        quote.setMinOrderQty(minOrderQty);
        quote.setCostPrice(costPrice);
        quote.setValidUntil(validUntil);
        // 自动算毛利率
        if (costPrice != null && costPrice.compareTo(BigDecimal.ZERO) > 0 && unitPrice != null) {
            BigDecimal margin = unitPrice.subtract(costPrice)
                    .divide(unitPrice, 6, RoundingMode.HALF_UP);
            quote.setMarginRate(margin);
        }
        if (remarks != null) quote.setRemarks(remarks);
        quote.setStatus(STATUS_PENDING_APPROVAL);
        quote.setQuotedAt(LocalDateTime.now());

        OperationalQuote saved = operationalQuoteRepository.save(quote);
        log.info("报价已提交审批: quoteNo={}, unitPrice={}", saved.getQuoteNo(), unitPrice);
        return saved;
    }

    @Override
    @Transactional
    public OperationalQuote approveQuote(String factoryId, String quoteId,
                                          Long approverUserId, String approverName, String comment) {
        OperationalQuote quote = getQuote(factoryId, quoteId);
        if (!STATUS_PENDING_APPROVAL.equals(quote.getStatus())) {
            throw new IllegalStateException("只有 PENDING_APPROVAL 状态可以审批, 当前: " + quote.getStatus());
        }
        quote.setStatus(STATUS_APPROVED);
        quote.setApproverUserId(approverUserId);
        quote.setApproverName(approverName);
        quote.setApprovedAt(LocalDateTime.now());
        if (comment != null) {
            String existing = quote.getRemarks() == null ? "" : quote.getRemarks() + "\n";
            quote.setRemarks(existing + "[审批通过] " + comment);
        }
        OperationalQuote saved = operationalQuoteRepository.save(quote);
        log.info("报价已审批: quoteNo={}, approver={}", saved.getQuoteNo(), approverName);
        return saved;
    }

    @Override
    @Transactional
    public OperationalQuote rejectQuote(String factoryId, String quoteId,
                                         Long approverUserId, String approverName, String reason) {
        OperationalQuote quote = getQuote(factoryId, quoteId);
        if (!STATUS_PENDING_APPROVAL.equals(quote.getStatus())) {
            throw new IllegalStateException("只有 PENDING_APPROVAL 状态可以驳回, 当前: " + quote.getStatus());
        }
        quote.setStatus(STATUS_REJECTED);
        quote.setApproverUserId(approverUserId);
        quote.setApproverName(approverName);
        quote.setApprovedAt(LocalDateTime.now());
        quote.setRejectionReason(reason);
        OperationalQuote saved = operationalQuoteRepository.save(quote);
        log.info("报价已驳回: quoteNo={}, reason={}", saved.getQuoteNo(), reason);
        return saved;
    }

    @Override
    @Transactional
    public OperationalQuote reviseQuote(String factoryId, String quoteId, String reason) {
        OperationalQuote quote = getQuote(factoryId, quoteId);
        if (!STATUS_REJECTED.equals(quote.getStatus()) && !STATUS_APPROVED.equals(quote.getStatus())) {
            throw new IllegalStateException("只有已驳回或已审批的报价可以修订, 当前: " + quote.getStatus());
        }
        quote.setStatus(STATUS_PENDING_QUOTE);
        quote.setRevisionCount((quote.getRevisionCount() == null ? 0 : quote.getRevisionCount()) + 1);
        // 清空上一轮的审批字段
        quote.setQuotedAt(null);
        quote.setApproverUserId(null);
        quote.setApproverName(null);
        quote.setApprovedAt(null);
        quote.setRejectionReason(null);
        if (reason != null) {
            String existing = quote.getRemarks() == null ? "" : quote.getRemarks() + "\n";
            quote.setRemarks(existing + "[修订 v" + quote.getRevisionCount() + "] " + reason);
        }
        OperationalQuote saved = operationalQuoteRepository.save(quote);
        log.info("报价已修订: quoteNo={}, version={}", saved.getQuoteNo(), saved.getRevisionCount());
        return saved;
    }

    @Override
    public OperationalQuote getQuote(String factoryId, String quoteId) {
        return operationalQuoteRepository.findByIdAndFactoryIdAndDeletedAtIsNull(quoteId, factoryId)
                .orElseThrow(() -> new IllegalArgumentException("报价单不存在或无权访问: " + quoteId));
    }

    @Override
    public Page<OperationalQuote> listQuotes(String factoryId, String status, Pageable pageable) {
        if (status != null && !status.trim().isEmpty()) {
            return operationalQuoteRepository
                    .findByFactoryIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(factoryId, status, pageable);
        }
        return operationalQuoteRepository
                .findByFactoryIdAndDeletedAtIsNullOrderByCreatedAtDesc(factoryId, pageable);
    }

    @Override
    public List<OperationalQuote> getActiveQuotes(String factoryId, String customerId, String productTypeId) {
        return operationalQuoteRepository.findActiveForOrder(factoryId, customerId, productTypeId, LocalDate.now());
    }

    /** 生成报价单号: QT-YYYYMMDD-NNNN, with UUID fallback if counter query fails */
    private String generateQuoteNo(String factoryId) {
        String datePrefix = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        try {
            long count = operationalQuoteRepository.countByFactoryIdAndDatePrefix(factoryId, datePrefix);
            return String.format("QT-%s-%04d", datePrefix, count + 1);
        } catch (Exception e) {
            log.warn("报价单号计数查询失败, 使用UUID后缀: {}", e.getMessage());
            String fallback = java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            return String.format("QT-%s-%s", datePrefix, fallback);
        }
    }
}
