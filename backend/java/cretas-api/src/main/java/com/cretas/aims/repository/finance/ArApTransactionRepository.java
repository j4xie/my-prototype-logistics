package com.cretas.aims.repository.finance;

import com.cretas.aims.entity.enums.ArApTransactionType;
import com.cretas.aims.entity.enums.CounterpartyType;
import com.cretas.aims.entity.finance.ArApTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ArApTransactionRepository extends JpaRepository<ArApTransaction, String> {

    Page<ArApTransaction> findByFactoryIdOrderByTransactionDateDesc(String factoryId, Pageable pageable);

    Page<ArApTransaction> findByFactoryIdAndCounterpartyTypeOrderByTransactionDateDesc(
            String factoryId, CounterpartyType counterpartyType, Pageable pageable);

    Page<ArApTransaction> findByFactoryIdAndCounterpartyTypeAndCounterpartyIdOrderByTransactionDateDesc(
            String factoryId, CounterpartyType counterpartyType, String counterpartyId, Pageable pageable);

    /** 查找某个交易对手的所有交易（用于对账单） */
    @Query("SELECT t FROM ArApTransaction t WHERE t.factoryId = :factoryId " +
            "AND t.counterpartyType = :type AND t.counterpartyId = :counterpartyId " +
            "AND t.transactionDate BETWEEN :startDate AND :endDate " +
            "ORDER BY t.transactionDate ASC, t.createdAt ASC")
    List<ArApTransaction> findByCounterpartyAndDateRange(
            @Param("factoryId") String factoryId,
            @Param("type") CounterpartyType type,
            @Param("counterpartyId") String counterpartyId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /** 逾期应收（AR_INVOICE，dueDate已过，未完全冲销） */
    @Query("SELECT t FROM ArApTransaction t WHERE t.factoryId = :factoryId " +
            "AND t.transactionType = 'AR_INVOICE' " +
            "AND t.dueDate IS NOT NULL AND t.dueDate < :today " +
            "ORDER BY t.dueDate ASC")
    List<ArApTransaction> findOverdueReceivables(
            @Param("factoryId") String factoryId,
            @Param("today") LocalDate today);

    /** 逾期应付 */
    @Query("SELECT t FROM ArApTransaction t WHERE t.factoryId = :factoryId " +
            "AND t.transactionType = 'AP_INVOICE' " +
            "AND t.dueDate IS NOT NULL AND t.dueDate < :today " +
            "ORDER BY t.dueDate ASC")
    List<ArApTransaction> findOverduePayables(
            @Param("factoryId") String factoryId,
            @Param("today") LocalDate today);

    /** 应收总额 */
    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM ArApTransaction t " +
            "WHERE t.factoryId = :factoryId AND t.counterpartyType = 'CUSTOMER'")
    BigDecimal sumReceivables(@Param("factoryId") String factoryId);

    /** 应付总额 */
    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM ArApTransaction t " +
            "WHERE t.factoryId = :factoryId AND t.counterpartyType = 'SUPPLIER'")
    BigDecimal sumPayables(@Param("factoryId") String factoryId);

    /** 按交易对手汇总余额 */
    @Query("SELECT t.counterpartyId, t.counterpartyName, SUM(t.amount) " +
            "FROM ArApTransaction t " +
            "WHERE t.factoryId = :factoryId AND t.counterpartyType = :type " +
            "GROUP BY t.counterpartyId, t.counterpartyName " +
            "ORDER BY SUM(t.amount) DESC")
    List<Object[]> sumByCounterparty(
            @Param("factoryId") String factoryId,
            @Param("type") CounterpartyType type);

    /** 查找期初余额快照（startDate之前最后一笔交易的balanceAfter） */
    @Query("SELECT t.balanceAfter FROM ArApTransaction t " +
            "WHERE t.factoryId = :factoryId " +
            "AND t.counterpartyType = :type AND t.counterpartyId = :counterpartyId " +
            "AND t.transactionDate < :startDate " +
            "ORDER BY t.transactionDate DESC, t.createdAt DESC")
    List<BigDecimal> findOpeningBalance(
            @Param("factoryId") String factoryId,
            @Param("type") CounterpartyType type,
            @Param("counterpartyId") String counterpartyId,
            @Param("startDate") LocalDate startDate);

    /** 检查销售订单是否已挂账 */
    boolean existsByFactoryIdAndSalesOrderIdAndTransactionType(
            String factoryId, String salesOrderId, ArApTransactionType transactionType);

    /** 检查采购订单是否已挂账 */
    boolean existsByFactoryIdAndPurchaseOrderIdAndTransactionType(
            String factoryId, String purchaseOrderId, ArApTransactionType transactionType);

    /** 按交易类型统计 */
    @Query("SELECT t.transactionType, COUNT(t), COALESCE(SUM(t.amount), 0) " +
            "FROM ArApTransaction t WHERE t.factoryId = :factoryId " +
            "GROUP BY t.transactionType")
    List<Object[]> statisticsByType(@Param("factoryId") String factoryId);
}
