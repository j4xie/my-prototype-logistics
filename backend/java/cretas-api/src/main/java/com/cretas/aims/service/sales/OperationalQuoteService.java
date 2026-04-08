package com.cretas.aims.service.sales;

import com.cretas.aims.entity.sales.OperationalQuote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 销售运营报价服务 — V3 P0-4 (Round 2 Agent B 设计 8.5/10).
 *
 * 4 个状态机动作:
 * <ol>
 *   <li>{@link #createQuote} — 研发提交报价单 (status=PENDING_QUOTE)</li>
 *   <li>{@link #submitQuote} — 销售运营录价 (status=PENDING_APPROVAL)</li>
 *   <li>{@link #approveQuote} — 主管审批通过 (status=APPROVED)</li>
 *   <li>{@link #rejectQuote} — 主管驳回 (status=REJECTED)</li>
 * </ol>
 */
public interface OperationalQuoteService {

    /** 研发提交报价单 — 由样品驱动. status=PENDING_QUOTE, 指派给 quotedByUserId. */
    OperationalQuote createQuote(String factoryId, String sampleId, String customerId,
                                  String productTypeId, String bomId,
                                  Long submittedByUserId, Long quotedByUserId, String quotedByName,
                                  String remarks);

    /** 销售运营录价 → status=PENDING_APPROVAL */
    OperationalQuote submitQuote(String factoryId, String quoteId,
                                  String quoteType, BigDecimal unitPrice, String unit,
                                  BigDecimal minOrderQty, BigDecimal costPrice,
                                  LocalDate validUntil, String remarks);

    /** 主管审批通过 → status=APPROVED */
    OperationalQuote approveQuote(String factoryId, String quoteId,
                                   Long approverUserId, String approverName, String comment);

    /** 主管驳回 → status=REJECTED */
    OperationalQuote rejectQuote(String factoryId, String quoteId,
                                  Long approverUserId, String approverName, String reason);

    /** 客户砍价 → 重新报价 (revisionCount + 1, 回到 PENDING_QUOTE) */
    OperationalQuote reviseQuote(String factoryId, String quoteId, String reason);

    /** 详情 (factory-scoped) */
    OperationalQuote getQuote(String factoryId, String quoteId);

    /** 列表 (按状态/分页) */
    Page<OperationalQuote> listQuotes(String factoryId, String status, Pageable pageable);

    /** 销售下单时拉取有效报价 (APPROVED + 未过期 + 同客户同产品) */
    List<OperationalQuote> getActiveQuotes(String factoryId, String customerId, String productTypeId);
}
