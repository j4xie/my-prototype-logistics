package com.cretas.aims.service.finance.impl;

import com.cretas.aims.entity.finance.InvoiceRecord;
import com.cretas.aims.entity.finance.InvoiceRecord.TaxBreakdownEntry;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.inventory.SalesOrderItem;
import com.cretas.aims.entity.enums.InvoiceStatus;
import com.cretas.aims.entity.enums.InvoiceType;
import com.cretas.aims.event.InvoiceIssuedEvent;
import com.cretas.aims.repository.CustomerRepository;
import com.cretas.aims.repository.InvoiceRecordRepository;
import com.cretas.aims.repository.inventory.SalesOrderItemRepository;
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
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class InvoiceServiceImpl implements InvoiceService {

    private final InvoiceRecordRepository invoiceRecordRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final SalesOrderItemRepository salesOrderItemRepository;
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
    public InvoiceRecord requestInvoiceFromOrder(String factoryId, String salesOrderId,
                                                  String invoiceType, Long requestedBy, String remark) {
        SalesOrder so = salesOrderRepository.findById(salesOrderId)
                .orElseThrow(() -> new IllegalArgumentException("销售订单不存在: " + salesOrderId));

        // Tenant isolation guard
        if (!factoryId.equals(so.getFactoryId())) {
            throw new IllegalArgumentException("销售订单不存在或无权访问: " + salesOrderId);
        }

        List<SalesOrderItem> items = salesOrderItemRepository.findBySalesOrderId(salesOrderId);
        if (items.isEmpty()) {
            throw new IllegalArgumentException("销售订单无明细行,无法生成开票申请: " + salesOrderId);
        }

        List<TaxBreakdownEntry> breakdown = aggregateByTaxRate(items);

        // Sum totals from breakdown
        BigDecimal totalTaxable = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;
        for (TaxBreakdownEntry entry : breakdown) {
            totalTaxable = totalTaxable.add(entry.getTaxableAmount());
            totalTax = totalTax.add(entry.getTaxAmount());
        }

        InvoiceRecord record = new InvoiceRecord();
        record.setFactoryId(factoryId);
        record.setInvoiceNumber(generateInvoiceNumber());
        record.setSalesOrderId(salesOrderId);
        record.setCustomerId(so.getCustomerId());
        record.setCustomerName(so.getCustomerId() != null ?
                customerRepository.findById(so.getCustomerId()).map(c -> c.getName()).orElse(null) : null);
        record.setAmount(totalTaxable);
        record.setTaxAmount(totalTax);
        record.setTotalAmount(totalTaxable.add(totalTax));
        record.setTaxBreakdown(breakdown);
        record.setInvoiceType(invoiceType != null ? InvoiceType.valueOf(invoiceType) : InvoiceType.NORMAL);
        record.setStatus(InvoiceStatus.REQUESTED);
        record.setRequestedBy(requestedBy);
        record.setRequestedAt(LocalDateTime.now());
        record.setRemark(remark);

        InvoiceRecord saved = invoiceRecordRepository.save(record);
        log.info("税率分组开票申请创建: orderId={}, breakdownGroups={}, totalAmount={}",
                salesOrderId, breakdown.size(), saved.getTotalAmount());
        return saved;
    }

    /**
     * 按 tax_rate 对销售订单行进行分组聚合。
     * null tax_rate 视为 0% (兼容历史数据)。
     * 行金额 = quantity × unit_price × (1 - discount/100), 与 SalesOrderItem.getLineAmount() 对齐。
     * 税额 = 行金额 × tax_rate / 100。
     */
    private List<TaxBreakdownEntry> aggregateByTaxRate(List<SalesOrderItem> items) {
        // LinkedHashMap 保持插入顺序的稳定输出
        Map<BigDecimal, TaxBreakdownEntry> grouped = new LinkedHashMap<>();

        for (SalesOrderItem item : items) {
            BigDecimal taxRate = item.getTaxRate() != null ? item.getTaxRate() : BigDecimal.ZERO;
            // Normalize scale so 9.0 and 9.00 are same key
            BigDecimal key = taxRate.setScale(2, RoundingMode.HALF_UP);

            BigDecimal lineAmount = item.getLineAmount();  // 含折扣的不含税金额
            BigDecimal lineTax = lineAmount
                    .multiply(taxRate)
                    .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);

            TaxBreakdownEntry entry = grouped.computeIfAbsent(key,
                    k -> new TaxBreakdownEntry(k, BigDecimal.ZERO, BigDecimal.ZERO, 0));
            entry.setTaxableAmount(entry.getTaxableAmount().add(lineAmount));
            entry.setTaxAmount(entry.getTaxAmount().add(lineTax));
            entry.setLineCount(entry.getLineCount() + 1);
        }

        // Sort by taxRate ascending so 9% always before 13% in UI
        List<TaxBreakdownEntry> result = new ArrayList<>(grouped.values());
        result.sort(Comparator.comparing(TaxBreakdownEntry::getTaxRate));
        return result;
    }

    @Override
    @Transactional
    public InvoiceRecord approveInvoice(String factoryId, String invoiceId, Long reviewedBy, String notes) {
        InvoiceRecord record = getInvoice(factoryId, invoiceId);
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
    public InvoiceRecord rejectInvoice(String factoryId, String invoiceId, Long reviewedBy, String notes) {
        InvoiceRecord record = getInvoice(factoryId, invoiceId);
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
    public InvoiceRecord issueInvoice(String factoryId, String invoiceId, MultipartFile pdfFile, Long issuedBy) {
        InvoiceRecord record = getInvoice(factoryId, invoiceId);
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
    public InvoiceRecord getInvoice(String factoryId, String invoiceId) {
        return invoiceRecordRepository.findByIdAndFactoryIdAndDeletedAtIsNull(invoiceId, factoryId)
                .orElseThrow(() -> new IllegalArgumentException("开票记录不存在或无权访问: " + invoiceId));
    }

    @Override
    public List<InvoiceRecord> listInvoicesBySalesOrder(String factoryId, String salesOrderId) {
        return invoiceRecordRepository
                .findByFactoryIdAndSalesOrderIdAndDeletedAtIsNullOrderByCreatedAtDesc(factoryId, salesOrderId);
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
