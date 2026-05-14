package com.cretas.aims.service.sales;

import com.cretas.aims.dto.sales.BatchAllocationDTO;
import com.cretas.aims.entity.sales.SalesDeliveryItemBatchAllocation;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * PC 端销售发货批次分配服务（P0-13 昆山六扇门客户需求）。
 *
 * <p>发货确认时必须保证每一行 SalesDeliveryItem 已完成批次分配，
 * 否则阻断状态流转，实现真正的批次追溯。
 */
public interface SalesDeliveryBatchAllocationService {

    /**
     * 为指定发货行设置批次分配。先清空旧分配，再按给定列表写入。
     *
     * <p>校验：
     * <ul>
     *   <li>发货行必须存在且属于同工厂</li>
     *   <li>每个 FinishedGoodsBatch 必须存在且属于同工厂</li>
     *   <li>每个 batch 的可用库存（produced - shipped - reserved）>= allocatedQty</li>
     *   <li>总分配量必须等于 SalesDeliveryItem.deliveredQuantity</li>
     * </ul>
     */
    void allocateBatches(String factoryId, String deliveryItemId, List<BatchAllocationDTO> allocations);

    List<SalesDeliveryItemBatchAllocation> listByDeliveryItem(String factoryId, String deliveryItemId);

    void clearAllocations(String factoryId, String deliveryItemId);

    /**
     * @return true 当该发货行的总分配量 == deliveredQuantity。
     */
    boolean isFullyAllocated(String factoryId, String deliveryItemId);

    /**
     * FIFO 推荐：按生产日期升序返回可用成品批次，附建议分配数量（累计至 requiredQty）。
     * 镜像原材料 FIFO 模式（MaterialFifoRecommendTool）用于成品出库。
     *
     * <p>客户需求 5016s: "客户也要做先进先出，销售出库单要有PC日期"
     *
     * <p>T4-D5 (#572): {@code sourceWarehouseCode} honors per-line source warehouse
     * declared on SalesOrderItem → SalesDeliveryItem (PR #564 data contract).
     * When null/blank, falls back to WH-LOG (legacy D5 default).
     */
    List<Map<String, Object>> recommendFifo(String factoryId, String productTypeId, BigDecimal requiredQty, String sourceWarehouseCode);
}
