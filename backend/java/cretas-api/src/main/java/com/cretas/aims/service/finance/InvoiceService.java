package com.cretas.aims.service.finance;

import com.cretas.aims.entity.finance.InvoiceRecord;
import com.cretas.aims.entity.enums.InvoiceStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

public interface InvoiceService {

    InvoiceRecord requestInvoice(String factoryId, String salesOrderId, java.math.BigDecimal amount,
                                  java.math.BigDecimal taxAmount, String invoiceType, Long requestedBy, String remark);

    InvoiceRecord approveInvoice(String invoiceId, Long reviewedBy, String notes);

    InvoiceRecord rejectInvoice(String invoiceId, Long reviewedBy, String notes);

    InvoiceRecord issueInvoice(String invoiceId, MultipartFile pdfFile, Long issuedBy);

    Page<InvoiceRecord> listInvoices(String factoryId, InvoiceStatus status, Pageable pageable);

    InvoiceRecord getInvoice(String invoiceId);
}
