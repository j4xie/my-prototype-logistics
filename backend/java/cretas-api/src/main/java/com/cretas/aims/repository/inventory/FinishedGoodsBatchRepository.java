package com.cretas.aims.repository.inventory;

import com.cretas.aims.entity.inventory.FinishedGoodsBatch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface FinishedGoodsBatchRepository extends JpaRepository<FinishedGoodsBatch, String> {

    Page<FinishedGoodsBatch> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    List<FinishedGoodsBatch> findByFactoryIdAndProductTypeIdAndStatus(String factoryId, String productTypeId, String status);

    Optional<FinishedGoodsBatch> findByFactoryIdAndBatchNumber(String factoryId, String batchNumber);

    /** 查询有可用库存的成品批次（FEFO 出库 — 先到期先出） */
    @Query("SELECT b FROM FinishedGoodsBatch b WHERE b.factoryId = :factoryId " +
            "AND b.productTypeId = :productTypeId AND b.status = 'AVAILABLE' " +
            "AND (b.producedQuantity - b.shippedQuantity - b.reservedQuantity) > 0 " +
            "ORDER BY b.expireDate ASC NULLS LAST, b.productionDate ASC")
    List<FinishedGoodsBatch> findAvailableBatches(
            @Param("factoryId") String factoryId,
            @Param("productTypeId") String productTypeId);

    /** 汇总指定产品类型的可用成品库存总量（用于销售订单库存检查） */
    @Query("SELECT COALESCE(SUM(b.producedQuantity - b.shippedQuantity - b.reservedQuantity), 0) " +
            "FROM FinishedGoodsBatch b WHERE b.factoryId = :factoryId " +
            "AND b.productTypeId = :productTypeId AND b.status = 'AVAILABLE' " +
            "AND (b.producedQuantity - b.shippedQuantity - b.reservedQuantity) > 0")
    BigDecimal sumAvailableQuantityByProductType(
            @Param("factoryId") String factoryId,
            @Param("productTypeId") String productTypeId);
}
