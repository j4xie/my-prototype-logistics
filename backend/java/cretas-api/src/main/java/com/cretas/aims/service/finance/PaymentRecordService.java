package com.cretas.aims.service.finance;

import com.cretas.aims.entity.finance.PaymentRecord;
import com.cretas.aims.entity.enums.PaymentMethod;
import com.cretas.aims.entity.enums.PaymentRecordStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;

public interface PaymentRecordService {

    PaymentRecord recordPayment(String factoryId, String salesOrderId, BigDecimal amount,
                                 PaymentMethod method, LocalDate paymentDate,
                                 String paymentReference, String receiptUrl,
                                 Long recordedBy, String remark);

    PaymentRecord verifyPayment(String paymentId, Long verifiedBy);

    PaymentRecord rejectPayment(String paymentId, Long verifiedBy, String reason);

    Page<PaymentRecord> listPayments(String factoryId, PaymentRecordStatus status, Pageable pageable);

    PaymentRecord getPayment(String paymentId);

    /** List all payment records for a given sales order, factory-scoped. */
    java.util.List<PaymentRecord> listPaymentsBySalesOrder(String factoryId, String salesOrderId);
}
