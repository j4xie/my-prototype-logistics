package com.cretas.aims.service.finance;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.enums.CounterpartyType;
import com.cretas.aims.entity.enums.PaymentMethod;
import com.cretas.aims.entity.finance.ArApTransaction;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface ArApService {

    // ==================== 挂账（应收/应付产生） ====================

    /** 销售出货 → 产生应收（AR_INVOICE） */
    ArApTransaction recordReceivable(String factoryId, String customerId,
                                      String salesOrderId, BigDecimal amount,
                                      LocalDate dueDate, Long operatedBy, String remark);

    /** 采购入库 → 产生应付（AP_INVOICE） */
    ArApTransaction recordPayable(String factoryId, String supplierId,
                                   String purchaseOrderId, BigDecimal amount,
                                   LocalDate dueDate, Long operatedBy, String remark);

    // ==================== 收付款（冲减应收/应付） ====================

    /** 收到客户付款（AR_PAYMENT） */
    ArApTransaction recordArPayment(String factoryId, String customerId,
                                     BigDecimal amount, PaymentMethod method,
                                     String paymentReference, Long operatedBy, String remark);

    /** 向供应商付款（AP_PAYMENT） */
    ArApTransaction recordApPayment(String factoryId, String supplierId,
                                     BigDecimal amount, PaymentMethod method,
                                     String paymentReference, Long operatedBy, String remark);

    // ==================== 手工调整 ====================

    /** 手工调整（正数增加，负数减少） */
    ArApTransaction recordAdjustment(String factoryId, CounterpartyType counterpartyType,
                                      String counterpartyId, BigDecimal amount,
                                      Long operatedBy, String remark);

    // ==================== 查询 ====================

    /** 分页查询交易记录 */
    PageResponse<ArApTransaction> getTransactions(String factoryId,
                                                   CounterpartyType counterpartyType,
                                                   String counterpartyId,
                                                   int page, int size);

    /** 对账单：指定期间的交易明细 + 期初/期末余额 */
    Map<String, Object> getStatement(String factoryId, CounterpartyType counterpartyType,
                                      String counterpartyId,
                                      LocalDate startDate, LocalDate endDate);

    /** 账龄分析（6桶） */
    List<Map<String, Object>> getAgingAnalysis(String factoryId, CounterpartyType counterpartyType);

    /** 财务概览统计 */
    Map<String, Object> getFinanceOverview(String factoryId);

    /** 信用检查：客户余额是否超过信用额度 */
    boolean checkCreditLimit(String factoryId, String customerId, BigDecimal additionalAmount);
}
