package com.cretas.aims.service.sales;

import com.cretas.aims.dto.sales.BatchAllocationDTO;
import com.cretas.aims.entity.sales.SalesDeliveryItemBatchAllocation;

import java.util.List;

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
}
