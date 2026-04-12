package com.cretas.aims.service.sales.impl;

import com.cretas.aims.dto.sales.BatchAllocationDTO;
import com.cretas.aims.entity.inventory.FinishedGoodsBatch;
import com.cretas.aims.entity.inventory.SalesDeliveryItem;
import com.cretas.aims.entity.sales.SalesDeliveryItemBatchAllocation;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.inventory.FinishedGoodsBatchRepository;
import com.cretas.aims.repository.inventory.SalesDeliveryItemRepository;
import com.cretas.aims.repository.sales.SalesDeliveryItemBatchAllocationRepository;
import com.cretas.aims.service.sales.SalesDeliveryBatchAllocationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SalesDeliveryBatchAllocationServiceImpl implements SalesDeliveryBatchAllocationService {

    private final SalesDeliveryItemBatchAllocationRepository allocationRepository;
    private final SalesDeliveryItemRepository deliveryItemRepository;
    private final FinishedGoodsBatchRepository finishedGoodsBatchRepository;

    @Override
    @Transactional
    public void allocateBatches(String factoryId, String deliveryItemId, List<BatchAllocationDTO> allocations) {
        if (factoryId == null || factoryId.isBlank()) {
            throw new BusinessException("factoryId 不能为空");
        }
        if (deliveryItemId == null || deliveryItemId.isBlank()) {
            throw new BusinessException("deliveryItemId 不能为空");
        }
        if (allocations == null || allocations.isEmpty()) {
            throw new BusinessException("批次分配列表不能为空");
        }

        // 1. 查发货行
        Long itemIdLong;
        try {
            itemIdLong = Long.valueOf(deliveryItemId);
        } catch (NumberFormatException e) {
            throw new BusinessException("非法的 deliveryItemId: " + deliveryItemId);
        }
        SalesDeliveryItem item = deliveryItemRepository.findById(itemIdLong)
                .orElseThrow(() -> new BusinessException("发货行不存在: " + deliveryItemId));
        if (item.getDeliveredQuantity() == null) {
            throw new BusinessException("发货行数量未设置: " + deliveryItemId);
        }

        // 2. 校验每一条 allocation：batch 存在、同工厂、有足够可用库存
        BigDecimal total = BigDecimal.ZERO;
        List<SalesDeliveryItemBatchAllocation> toPersist = new ArrayList<>();
        for (BatchAllocationDTO dto : allocations) {
            if (dto.getFinishedGoodsBatchId() == null || dto.getAllocatedQty() == null) {
                throw new BusinessException("批次分配字段不完整");
            }
            if (dto.getAllocatedQty().signum() <= 0) {
                throw new BusinessException("分配数量必须大于 0");
            }
            FinishedGoodsBatch batch = finishedGoodsBatchRepository.findById(dto.getFinishedGoodsBatchId())
                    .orElseThrow(() -> new BusinessException("成品批次不存在: " + dto.getFinishedGoodsBatchId()));
            if (!factoryId.equals(batch.getFactoryId())) {
                throw new BusinessException("成品批次不属于当前工厂: " + dto.getFinishedGoodsBatchId());
            }
            BigDecimal available = batch.getProducedQuantity()
                    .subtract(batch.getShippedQuantity() == null ? BigDecimal.ZERO : batch.getShippedQuantity())
                    .subtract(batch.getReservedQuantity() == null ? BigDecimal.ZERO : batch.getReservedQuantity());
            if (available.compareTo(dto.getAllocatedQty()) < 0) {
                throw new BusinessException("成品批次 " + batch.getBatchNumber()
                        + " 可用库存不足（可用=" + available + "，申请=" + dto.getAllocatedQty() + "）");
            }

            SalesDeliveryItemBatchAllocation alloc = new SalesDeliveryItemBatchAllocation();
            alloc.setFactoryId(factoryId);
            alloc.setDeliveryItemId(deliveryItemId);
            alloc.setFinishedGoodsBatchId(batch.getId());
            alloc.setBatchNumber(batch.getBatchNumber());
            alloc.setAllocatedQty(dto.getAllocatedQty());
            alloc.setUnit(item.getUnit());
            toPersist.add(alloc);
            total = total.add(dto.getAllocatedQty());
        }

        // 3. 总量必须等于发货行数量
        if (total.compareTo(item.getDeliveredQuantity()) != 0) {
            throw new BusinessException("批次分配总量 " + total
                    + " 不等于发货行数量 " + item.getDeliveredQuantity());
        }

        // 4. 先清空旧分配，再写入
        allocationRepository.deleteByFactoryIdAndDeliveryItemId(factoryId, deliveryItemId);
        allocationRepository.saveAll(toPersist);

        log.info("销售发货批次分配: factoryId={}, deliveryItemId={}, allocations={}, total={}",
                factoryId, deliveryItemId, toPersist.size(), total);
    }

    @Override
    public List<SalesDeliveryItemBatchAllocation> listByDeliveryItem(String factoryId, String deliveryItemId) {
        return allocationRepository.findByFactoryIdAndDeliveryItemId(factoryId, deliveryItemId);
    }

    @Override
    @Transactional
    public void clearAllocations(String factoryId, String deliveryItemId) {
        allocationRepository.deleteByFactoryIdAndDeliveryItemId(factoryId, deliveryItemId);
    }

    @Override
    public List<Map<String, Object>> recommendFifo(String factoryId, String productTypeId, BigDecimal requiredQty) {
        if (factoryId == null || factoryId.isBlank()) {
            throw new BusinessException("factoryId 不能为空");
        }
        if (productTypeId == null || productTypeId.isBlank()) {
            throw new BusinessException("productTypeId 不能为空");
        }
        if (requiredQty == null || requiredQty.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("requiredQty 必须大于 0");
        }

        var batches = finishedGoodsBatchRepository.findAvailableBatchesFifo(factoryId, productTypeId);

        List<Map<String, Object>> result = new ArrayList<>();
        BigDecimal remaining = requiredQty;

        for (var batch : batches) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;
            BigDecimal available = batch.getAvailableQuantity();
            if (available.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal allocate = remaining.min(available);
            Map<String, Object> rec = new LinkedHashMap<>();
            rec.put("batchId", batch.getId());
            rec.put("batchNumber", batch.getBatchNumber());
            rec.put("productionDate", batch.getProductionDate() != null ? batch.getProductionDate().toString() : null);
            rec.put("expireDate", batch.getExpireDate() != null ? batch.getExpireDate().toString() : null);
            rec.put("availableQuantity", available);
            rec.put("recommendedQuantity", allocate);
            result.add(rec);
            remaining = remaining.subtract(allocate);
        }

        log.info("FIFO 成品推荐: factoryId={}, productTypeId={}, requiredQty={}, batches={}, fulfilled={}",
                factoryId, productTypeId, requiredQty, result.size(),
                remaining.compareTo(BigDecimal.ZERO) <= 0);

        return result;
    }

    @Override
    public boolean isFullyAllocated(String factoryId, String deliveryItemId) {
        BigDecimal sum = allocationRepository.sumAllocatedQtyByDeliveryItemId(factoryId, deliveryItemId);
        if (sum == null || sum.signum() == 0) {
            return false;
        }
        Long itemIdLong;
        try {
            itemIdLong = Long.valueOf(deliveryItemId);
        } catch (NumberFormatException e) {
            return false;
        }
        SalesDeliveryItem item = deliveryItemRepository.findById(itemIdLong).orElse(null);
        if (item == null || item.getDeliveredQuantity() == null) {
            return false;
        }
        return sum.compareTo(item.getDeliveredQuantity()) == 0;
    }
}
