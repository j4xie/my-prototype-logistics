package com.cretas.aims.service.finance.impl;

import com.cretas.aims.entity.finance.InvoiceRecord;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.enums.InvoiceStatus;
import com.cretas.aims.entity.enums.InvoiceType;
import com.cretas.aims.event.InvoiceIssuedEvent;
import com.cretas.aims.repository.CustomerRepository;
import com.cretas.aims.repository.InvoiceRecordRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.service.OssService;
import com.cretas.aims.service.finance.InvoiceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class InvoiceServiceImpl implements InvoiceService {

    private final InvoiceRecordRepository invoiceRecordRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final CustomerRepository customerRepository;
    private final OssService ossService;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public InvoiceRecord requestInvoice(String factoryId, String salesOrderId, BigDecimal amount,
                                         BigDecimal taxAmount, String invoiceType, Long requestedBy, String remark) {
        SalesOrder so = salesOrderRepository.findById(salesOrderId)
                .orElseThrow(() -> new IllegalArgumentException("销售订单不存在: " + salesOrderId));

        InvoiceRecord record = new InvoiceRecord();
        record.setFactoryId(factoryId);
        record.setInvoiceNumber(generateInvoiceNumber());
        record.setSalesOrderId(salesOrderId);
        record.setCustomerId(so.getCustomerId());
        record.setCustomerName(so.getCustomerId() != null ?
                customerRepository.findById(so.getCustomerId()).map(c -> c.getName()).orElse(null) : null);
        record.setAmount(amount);
        record.setTaxAmount(taxAmount);
        record.setTotalAmount(amount.add(taxAmount != null ? taxAmount : BigDecimal.ZERO));
        record.setInvoiceType(invoiceType != null ? InvoiceType.valueOf(invoiceType) : InvoiceType.NORMAL);
        record.setStatus(InvoiceStatus.REQUESTED);
        record.setRequestedBy(requestedBy);
        record.setRequestedAt(LocalDateTime.now());
        record.setRemark(remark);

        log.info("开票申请创建: orderId={}, amount={}", salesOrderId, record.getTotalAmount());
        return invoiceRecordRepository.save(record);
    }

    @Override
    @Transactional
    public InvoiceRecord approveInvoice(String invoiceId, Long reviewedBy, String notes) {
        InvoiceRecord record = getInvoice(invoiceId);
        if (record.getStatus() != InvoiceStatus.REQUESTED) {
            throw new IllegalStateException("只能审核状态为REQUESTED的开票申请, 当前: " + record.getStatus());
        }
        record.setStatus(InvoiceStatus.APPROVED);
        record.setReviewedBy(reviewedBy);
        record.setReviewedAt(LocalDateTime.now());
        record.setReviewNotes(notes);
        return invoiceRecordRepository.save(record);
    }

    @Override
    @Transactional
    public InvoiceRecord rejectInvoice(String invoiceId, Long reviewedBy, String notes) {
        InvoiceRecord record = getInvoice(invoiceId);
        if (record.getStatus() != InvoiceStatus.REQUESTED) {
            throw new IllegalStateException("只能驳回状态为REQUESTED的开票申请");
        }
        record.setStatus(InvoiceStatus.REJECTED);
        record.setReviewedBy(reviewedBy);
        record.setReviewedAt(LocalDateTime.now());
        record.setReviewNotes(notes);
        return invoiceRecordRepository.save(record);
    }

    @Override
    @Transactional
    public InvoiceRecord issueInvoice(String invoiceId, MultipartFile pdfFile, Long issuedBy) {
        InvoiceRecord record = getInvoice(invoiceId);
        if (record.getStatus() != InvoiceStatus.APPROVED) {
            throw new IllegalStateException("只能对已审核的申请开具发票");
        }

        // 上传发票PDF到OSS
        if (pdfFile != null && !pdfFile.isEmpty()) {
            String pdfUrl = ossService.uploadFile(pdfFile, "invoices", record.getFactoryId());
            record.setInvoicePdfUrl(pdfUrl);
        }

        record.setStatus(InvoiceStatus.ISSUED);
        record.setIssuedAt(LocalDateTime.now());
        InvoiceRecord saved = invoiceRecordRepository.save(record);

        // 回写销售订单
        updateSalesOrderInvoiceStatus(record.getSalesOrderId());

        // 发布事件
        eventPublisher.publishEvent(new InvoiceIssuedEvent(
                this, record.getFactoryId(), record.getId(),
                record.getSalesOrderId(), record.getTotalAmount()));

        log.info("发票已开具: invoiceId={}, pdfUrl={}", invoiceId, record.getInvoicePdfUrl());
        return saved;
    }

    @Override
    public Page<InvoiceRecord> listInvoices(String factoryId, InvoiceStatus status, Pageable pageable) {
        if (status != null) {
            return invoiceRecordRepository.findByFactoryIdAndStatusAndDeletedAtIsNull(factoryId, status, pageable);
        }
        return invoiceRecordRepository.findByFactoryIdAndDeletedAtIsNull(factoryId, pageable);
    }

    @Override
    public InvoiceRecord getInvoice(String invoiceId) {
        return invoiceRecordRepository.findById(invoiceId)
                .orElseThrow(() -> new IllegalArgumentException("开票记录不存在: " + invoiceId));
    }

    private void updateSalesOrderInvoiceStatus(String salesOrderId) {
        if (salesOrderId == null) return;
        SalesOrder so = salesOrderRepository.findById(salesOrderId).orElse(null);
        if (so == null) return;

        BigDecimal totalInvoiced = invoiceRecordRepository.sumIssuedAmountBySalesOrderId(salesOrderId);
        so.setInvoicedAmount(totalInvoiced);

        if (totalInvoiced.compareTo(BigDecimal.ZERO) == 0) {
            so.setInvoiceStatus("NOT_INVOICED");
        } else if (so.getTotalAmount() != null && totalInvoiced.compareTo(so.getTotalAmount()) >= 0) {
            so.setInvoiceStatus("FULLY_INVOICED");
        } else {
            so.setInvoiceStatus("PARTIAL_INVOICED");
        }
        salesOrderRepository.save(so);
    }

    private String generateInvoiceNumber() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = invoiceRecordRepository.count() + 1;
        return String.format("INV-%s-%04d", dateStr, count);
    }
}
