package com.cretas.aims.repository.purchase;

import com.cretas.aims.entity.purchase.InquiryQuoteSupplierPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 核价单 — 供应商报价数据访问 (P-NUCLEAR-1).
 */
@Repository
public interface InquiryQuoteSupplierPriceRepository
        extends JpaRepository<InquiryQuoteSupplierPrice, String> {

    List<InquiryQuoteSupplierPrice> findByInquiryQuoteIdOrderByUnitPriceAsc(String inquiryQuoteId);

    Optional<InquiryQuoteSupplierPrice> findByInquiryQuoteIdAndSupplierId(
            String inquiryQuoteId, String supplierId);

    long countByInquiryQuoteId(String inquiryQuoteId);
}
