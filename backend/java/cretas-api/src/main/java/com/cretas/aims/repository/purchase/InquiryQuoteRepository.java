package com.cretas.aims.repository.purchase;

import com.cretas.aims.entity.enums.InquiryQuoteStatus;
import com.cretas.aims.entity.purchase.InquiryQuote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 核价单数据访问接口 (P-NUCLEAR-1).
 */
@Repository
public interface InquiryQuoteRepository extends JpaRepository<InquiryQuote, String> {

    Page<InquiryQuote> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    Page<InquiryQuote> findByFactoryIdAndStatusOrderByCreatedAtDesc(
            String factoryId, InquiryQuoteStatus status, Pageable pageable);

    Optional<InquiryQuote> findByFactoryIdAndInquiryNumber(String factoryId, String inquiryNumber);

    Optional<InquiryQuote> findByFactoryIdAndId(String factoryId, String id);

    /** 防呆 R4: 给定 inquiry, 是否已存在生成的 PO (idempotent guard) */
    List<InquiryQuote> findByFactoryIdAndPurchaseOrderIdIsNotNull(String factoryId);

    /** 生成 inquiry_number: 查找当天最大序号 */
    @Query("SELECT MAX(iq.inquiryNumber) FROM InquiryQuote iq " +
            "WHERE iq.factoryId = :factoryId AND iq.inquiryNumber LIKE :prefix")
    Optional<String> findMaxInquiryNumberByPrefix(
            @Param("factoryId") String factoryId,
            @Param("prefix") String prefix);
}
