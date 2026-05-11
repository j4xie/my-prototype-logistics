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

    /**
     * FEFO 出库（带 warehouse 过滤）。D1 双仓流转 (PR #309 A1=A, 2026-05-10 spec)。
     * 用途：销售批次预占/发货 (WH-LOG 固定)、调拨发货 (source warehouse)。
     */
    @Query("SELECT b FROM FinishedGoodsBatch b WHERE b.factoryId = :factoryId " +
            "AND b.productTypeId = :productTypeId " +
            "AND b.warehouseId = :warehouseId " +
            "AND b.status = 'AVAILABLE' " +
            "AND (b.producedQuantity - b.shippedQuantity - b.reservedQuantity) > 0 " +
            "ORDER BY b.expireDate ASC NULLS LAST, b.productionDate ASC")
    List<FinishedGoodsBatch> findAvailableBatchesByWarehouse(
            @Param("factoryId") String factoryId,
            @Param("productTypeId") String productTypeId,
            @Param("warehouseId") String warehouseId);

    /** FIFO 推荐：按生产日期升序返回可用成品批次（先进先出） */
    @Query("SELECT b FROM FinishedGoodsBatch b WHERE b.factoryId = :factoryId " +
            "AND b.productTypeId = :productTypeId AND b.status = 'AVAILABLE' " +
            "AND (b.producedQuantity - b.shippedQuantity - b.reservedQuantity) > 0 " +
            "ORDER BY b.productionDate ASC NULLS LAST")
    List<FinishedGoodsBatch> findAvailableBatchesFifo(
            @Param("factoryId") String factoryId,
            @Param("productTypeId") String productTypeId);

    /**
     * FIFO 推荐（带 warehouse 过滤）。D1 双仓流转 (PR #309 A1=A, 2026-05-10 spec)。
     */
    @Query("SELECT b FROM FinishedGoodsBatch b WHERE b.factoryId = :factoryId " +
            "AND b.productTypeId = :productTypeId " +
            "AND b.warehouseId = :warehouseId " +
            "AND b.status = 'AVAILABLE' " +
            "AND (b.producedQuantity - b.shippedQuantity - b.reservedQuantity) > 0 " +
            "ORDER BY b.productionDate ASC NULLS LAST")
    List<FinishedGoodsBatch> findAvailableBatchesFifoByWarehouse(
            @Param("factoryId") String factoryId,
            @Param("productTypeId") String productTypeId,
            @Param("warehouseId") String warehouseId);

    /** 汇总指定产品类型的可用成品库存总量（用于销售订单库存检查） */
    @Query("SELECT COALESCE(SUM(b.producedQuantity - b.shippedQuantity - b.reservedQuantity), 0) " +
            "FROM FinishedGoodsBatch b WHERE b.factoryId = :factoryId " +
            "AND b.productTypeId = :productTypeId AND b.status = 'AVAILABLE' " +
            "AND (b.producedQuantity - b.shippedQuantity - b.reservedQuantity) > 0")
    BigDecimal sumAvailableQuantityByProductType(
            @Param("factoryId") String factoryId,
            @Param("productTypeId") String productTypeId);

    /**
     * 按 warehouse 过滤的可用成品库存汇总。D1 双仓流转 (PR #309 A1=A, 2026-05-10 spec)。
     * 用途：销售订单库存检查 (WH-LOG)、调拨单库存检查 (source warehouse)。
     */
    @Query("SELECT COALESCE(SUM(b.producedQuantity - b.shippedQuantity - b.reservedQuantity), 0) " +
            "FROM FinishedGoodsBatch b WHERE b.factoryId = :factoryId " +
            "AND b.productTypeId = :productTypeId " +
            "AND b.warehouseId = :warehouseId " +
            "AND b.status = 'AVAILABLE' " +
            "AND (b.producedQuantity - b.shippedQuantity - b.reservedQuantity) > 0")
    BigDecimal sumAvailableQuantityByProductTypeAndWarehouse(
            @Param("factoryId") String factoryId,
            @Param("productTypeId") String productTypeId,
            @Param("warehouseId") String warehouseId);

    /**
     * 查找 plan + warehouse 范围内的所有可用成品批次。D1 反向调拨触发 (PR #309 A3=A, 2026-05-10 spec)。
     *
     * <p>用途：报工触发计划完成后, 反向调拨编排查询该 plan 在 WH-WKS 生成的成品批次,
     * 聚合后作为 BRANCH_TO_HQ 调拨单 items.
     */
    @Query("SELECT b FROM FinishedGoodsBatch b WHERE b.factoryId = :factoryId " +
            "AND b.productionPlanId = :planId " +
            "AND b.warehouseId = :warehouseId " +
            "AND b.status = 'AVAILABLE' " +
            "AND (b.producedQuantity - b.shippedQuantity - b.reservedQuantity) > 0 " +
            "ORDER BY b.productTypeId ASC, b.expireDate ASC NULLS LAST, b.productionDate ASC")
    List<FinishedGoodsBatch> findAvailableByPlanAndWarehouse(
            @Param("factoryId") String factoryId,
            @Param("planId") String planId,
            @Param("warehouseId") String warehouseId);

    /**
     * A5 集团联销 (cross-factory sales) — 跨工厂可用成品库存汇总。
     *
     * <p>当 feature flag {@code cretas.sales.cross-factory.enabled=true} 时启用。
     * 当前实现：去掉 factoryId 过滤，允许所有工厂的批次参与库存匹配
     * （等价于"集团池"语义）。
     *
     * <p>未来当 {@code factory_network} 表落地后，此方法可以替换为
     * {@code WHERE b.factoryId IN (SELECT f.factoryId FROM FactoryNetwork f WHERE f.parent = :soFactoryId)}
     * 实现按销售组织受控的跨工厂汇总。
     *
     * @see com.cretas.aims.service.orchestration.InventoryMatchingService
     * @since 2026-05-10 PR #309 A5=C feature flag introduction
     */
    @Query("SELECT COALESCE(SUM(b.producedQuantity - b.shippedQuantity - b.reservedQuantity), 0) " +
            "FROM FinishedGoodsBatch b WHERE b.productTypeId = :productTypeId " +
            "AND b.status = 'AVAILABLE' " +
            "AND (b.producedQuantity - b.shippedQuantity - b.reservedQuantity) > 0")
    BigDecimal sumAvailableQuantityByProductTypeAllFactories(
            @Param("productTypeId") String productTypeId);

    /**
     * A5 集团联销 (cross-factory sales) — 跨工厂可用成品批次（FEFO）。
     *
     * <p>当 feature flag {@code cretas.sales.cross-factory.enabled=true} 时启用，
     * 跳过 factoryId 过滤。订单 FEFO 预留时跨工厂池中按到期日最早依次取。
     *
     * @see com.cretas.aims.service.orchestration.InventoryMatchingService
     * @since 2026-05-10 PR #309 A5=C feature flag introduction
     */
    @Query("SELECT b FROM FinishedGoodsBatch b WHERE b.productTypeId = :productTypeId " +
            "AND b.status = 'AVAILABLE' " +
            "AND (b.producedQuantity - b.shippedQuantity - b.reservedQuantity) > 0 " +
            "ORDER BY b.expireDate ASC NULLS LAST, b.productionDate ASC")
    List<FinishedGoodsBatch> findAvailableBatchesAllFactories(
            @Param("productTypeId") String productTypeId);

    /**
     * 分仓库存查询 (PR #309 B2=B, 2026-05-11 spec).
     * factory_id × warehouse_id composite index (idx_finished_batch_warehouse).
     * 默认 @Where(deleted_at IS NULL) 已在 entity 起作用。
     */
    List<FinishedGoodsBatch> findByFactoryIdAndWarehouseId(String factoryId, String warehouseId);
}
