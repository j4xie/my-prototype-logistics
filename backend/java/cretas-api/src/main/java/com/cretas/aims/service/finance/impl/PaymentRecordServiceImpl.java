package com.cretas.aims.service.finance.impl;

import com.cretas.aims.entity.finance.PaymentRecord;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.enums.PaymentMethod;
import com.cretas.aims.entity.enums.PaymentRecordStatus;
import com.cretas.aims.event.SalesOrderSettledEvent;
import com.cretas.aims.repository.CustomerRepository;
import com.cretas.aims.repository.PaymentRecordRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.service.finance.ArApService;
import com.cretas.aims.service.finance.PaymentRecordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentRecordServiceImpl implements PaymentRecordService {

    private final PaymentRecordRepository paymentRecordRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final CustomerRepository customerRepository;
    private final ArApService arApService;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public PaymentRecord recordPayment(String factoryId, String salesOrderId, BigDecimal amount,
                                        PaymentMethod method, LocalDate paymentDate,
                                        String paymentReference, String receiptUrl,
                                        Long recordedBy, String remark) {
        SalesOrder so = salesOrderRepository.findById(salesOrderId)
                .orElseThrow(() -> new IllegalArgumentException("销售订单不存在: " + salesOrderId));

        PaymentRecord record = new PaymentRecord();
        record.setFactoryId(factoryId);
        record.setPaymentNumber(generatePaymentNumber());
        record.setSalesOrderId(salesOrderId);
        record.setCustomerId(so.getCustomerId());
        record.setCustomerName(so.getCustomerId() != null ?
                customerRepository.findById(so.getCustomerId()).map(c -> c.getName()).orElse(null) : null);
        record.setAmount(amount);
        record.setPaymentMethod(method);
        record.setPaymentDate(paymentDate != null ? paymentDate : LocalDate.now());
        record.setPaymentReference(paymentReference);
        record.setReceiptUrl(receiptUrl);
        record.setStatus(PaymentRecordStatus.PENDING);
        record.setRecordedBy(recordedBy);
        record.setRemark(remark);

        log.info("收款记录创建: orderId={}, amount={}", salesOrderId, amount);
        return paymentRecordRepository.save(record);
    }

    @Override
    @Transactional
    public PaymentRecord verifyPayment(String paymentId, Long verifiedBy) {
        PaymentRecord record = getPayment(paymentId);
        if (record.getStatus() != PaymentRecordStatus.PENDING) {
            throw new IllegalStateException("只能验证PENDING状态的收款记录");
        }

        record.setStatus(PaymentRecordStatus.VERIFIED);
        record.setVerifiedBy(verifiedBy);
        record.setVerifiedAt(LocalDateTime.now());
        PaymentRecord saved = paymentRecordRepository.save(record);

        // 同步创建 ArApTransaction (AR_PAYMENT)
        arApService.recordArPayment(
                record.getFactoryId(),
                record.getCustomerId(),
                record.getAmount(),
                record.getPaymentMethod() != null ? record.getPaymentMethod() : PaymentMethod.BANK_TRANSFER,
                record.getPaymentReference(),
                verifiedBy,
                "收款确认: " + record.getPaymentNumber());

        // 更新销售订单收款状态
        updateSalesOrderPaymentStatus(record.getSalesOrderId(), record.getFactoryId());

        log.info("收款已验证: paymentId={}, amount={}", paymentId, record.getAmount());
        return saved;
    }

    @Override
    @Transactional
    public PaymentRecord rejectPayment(String paymentId, Long verifiedBy, String reason) {
        PaymentRecord record = getPayment(paymentId);
        if (record.getStatus() != PaymentRecordStatus.PENDING) {
            throw new IllegalStateException("只能驳回PENDING状态的收款记录");
        }
        record.setStatus(PaymentRecordStatus.REJECTED);
        record.setVerifiedBy(verifiedBy);
        record.setVerifiedAt(LocalDateTime.now());
        record.setRemark(reason);
        return paymentRecordRepository.save(record);
    }

    @Override
    public Page<PaymentRecord> listPayments(String factoryId, PaymentRecordStatus status, Pageable pageable) {
        if (status != null) {
            return paymentRecordRepository.findByFactoryIdAndStatusAndDeletedAtIsNull(factoryId, status, pageable);
        }
        return paymentRecordRepository.findByFactoryIdAndDeletedAtIsNull(factoryId, pageable);
    }

    @Override
    public PaymentRecord getPayment(String paymentId) {
        return paymentRecordRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("收款记录不存在: " + paymentId));
    }

    @Override
    public java.util.List<PaymentRecord> listPaymentsBySalesOrder(String factoryId, String salesOrderId) {
        return paymentRecordRepository
                .findByFactoryIdAndSalesOrderIdAndDeletedAtIsNullOrderByCreatedAtDesc(factoryId, salesOrderId);
    }

    private void updateSalesOrderPaymentStatus(String salesOrderId, String factoryId) {
        if (salesOrderId == null) return;
        SalesOrder so = salesOrderRepository.findById(salesOrderId).orElse(null);
        if (so == null) return;

        BigDecimal totalPaid = paymentRecordRepository.sumVerifiedAmountBySalesOrderId(salesOrderId);
        so.setPaidAmount(totalPaid);

        boolean settled = so.getTotalAmount() != null && totalPaid.compareTo(so.getTotalAmount()) >= 0;
        so.setSettlementFlag(settled);
        salesOrderRepository.save(so);

        if (settled) {
            eventPublisher.publishEvent(new SalesOrderSettledEvent(
                    this, factoryId, salesOrderId, totalPaid));
            log.info("销售订单已结清: orderId={}, totalPaid={}", salesOrderId, totalPaid);
        }
    }

    private String generatePaymentNumber() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = paymentRecordRepository.count() + 1;
        return String.format("PAY-%s-%04d", dateStr, count);
    }
}
