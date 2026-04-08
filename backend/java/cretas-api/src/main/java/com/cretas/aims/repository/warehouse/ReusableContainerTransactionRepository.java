package com.cretas.aims.repository.warehouse;

import com.cretas.aims.entity.warehouse.ReusableContainerTransaction;
import com.cretas.aims.entity.warehouse.ReusableContainerTransaction.TransactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReusableContainerTransactionRepository
        extends JpaRepository<ReusableContainerTransaction, String> {

    List<ReusableContainerTransaction> findByFactoryIdAndContainerIdOrderByCreatedAtDesc(
            String factoryId, String containerId);

    List<ReusableContainerTransaction> findByFactoryIdAndCustomerIdAndTransactionType(
            String factoryId, String customerId, TransactionType transactionType);

    /**
     * 汇总每个客户当前在用(未归还)的周转框数量。
     * 公式: SUM(SHIP_OUT) + SUM(RETURN_IN) + SUM(LOSS)
     * 其中 SHIP_OUT 是负数 (扣减客户"欠"的数量转正),
     * RETURN_IN 正数减少欠的数量,
     * LOSS 按流水中的 quantity 记为负数 (不再欠).
     *
     * 这里简化: 返回 [customerId, customerName, containerId, containerCode, inUseQuantity]
     * inUseQuantity = -SUM(quantity where type in (SHIP_OUT, RETURN_IN, LOSS))
     */
    @Query("SELECT t.customerId as customerId, t.customerName as customerName, " +
           "t.containerId as containerId, " +
           "-SUM(t.quantity) as inUseQuantity " +
           "FROM ReusableContainerTransaction t " +
           "WHERE t.factoryId = :factoryId AND t.customerId IS NOT NULL " +
           "AND t.transactionType IN (com.cretas.aims.entity.warehouse.ReusableContainerTransaction.TransactionType.SHIP_OUT, " +
           "com.cretas.aims.entity.warehouse.ReusableContainerTransaction.TransactionType.RETURN_IN, " +
           "com.cretas.aims.entity.warehouse.ReusableContainerTransaction.TransactionType.LOSS) " +
           "GROUP BY t.customerId, t.customerName, t.containerId " +
           "HAVING -SUM(t.quantity) > 0")
    List<CustomerContainerBalance> findCustomerBalances(@Param("factoryId") String factoryId);

    interface CustomerContainerBalance {
        String getCustomerId();
        String getCustomerName();
        String getContainerId();
        Long getInUseQuantity();
    }
}
