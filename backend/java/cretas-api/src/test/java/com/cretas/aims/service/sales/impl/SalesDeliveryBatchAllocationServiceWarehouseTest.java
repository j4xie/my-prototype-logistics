package com.cretas.aims.service.sales.impl;

import com.cretas.aims.dto.sales.BatchAllocationDTO;
import com.cretas.aims.entity.inventory.FinishedGoodsBatch;
import com.cretas.aims.entity.inventory.SalesDeliveryItem;
import com.cretas.aims.entity.sales.SalesDeliveryItemBatchAllocation;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.inventory.FinishedGoodsBatchRepository;
import com.cretas.aims.repository.inventory.SalesDeliveryItemRepository;
import com.cretas.aims.repository.sales.SalesDeliveryItemBatchAllocationRepository;
import com.cretas.aims.service.factory.WarehouseResolver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * T4-D5 (#572) tests: SalesDeliveryBatchAllocationServiceImpl must honor
 * SalesDeliveryItem.sourceWarehouseCode in both allocateBatches (manual pick)
 * and recommendFifo (FIFO recommendation) paths.
 *
 * <p>Legacy callers / rows with null sourceWarehouseCode fall back to WH-LOG
 * (preserves D5 default per PR #310 §5).
 */
@ExtendWith(MockitoExtension.class)
class SalesDeliveryBatchAllocationServiceWarehouseTest {

    @Mock SalesDeliveryItemBatchAllocationRepository allocationRepository;
    @Mock SalesDeliveryItemRepository deliveryItemRepository;
    @Mock FinishedGoodsBatchRepository finishedGoodsBatchRepository;
    @Mock WarehouseResolver warehouseResolver;

    @InjectMocks SalesDeliveryBatchAllocationServiceImpl service;

    private static final String FID = "F001";
    private static final String ITEM_ID = "42";
    private static final String WH_LOG_ID = "wh-log-uuid-001";
    private static final String WH_WKS_ID = "wh-wks-uuid-001";
    private static final String PRODUCT_ID = "p-1";

    private SalesDeliveryItem deliveryItem(String sourceCode, BigDecimal qty) {
        SalesDeliveryItem item = new SalesDeliveryItem();
        item.setId(42L);
        item.setSourceWarehouseCode(sourceCode);
        item.setDeliveredQuantity(qty);
        item.setUnit("kg");
        return item;
    }

    private FinishedGoodsBatch batch(String id, String warehouseId, BigDecimal produced) {
        FinishedGoodsBatch b = new FinishedGoodsBatch();
        b.setId(id);
        b.setFactoryId(FID);
        b.setBatchNumber("BATCH-" + id);
        b.setWarehouseId(warehouseId);
        b.setProducedQuantity(produced);
        b.setShippedQuantity(BigDecimal.ZERO);
        b.setReservedQuantity(BigDecimal.ZERO);
        b.setProductTypeId(PRODUCT_ID);
        b.setUnit("kg");
        return b;
    }

    // ─────────────── allocateBatches ───────────────

    @Test
    void allocateBatches_rejectsBatchFromDifferentWarehouse() {
        SalesDeliveryItem item = deliveryItem("WH-LOG", new BigDecimal("10"));
        when(deliveryItemRepository.findById(42L)).thenReturn(Optional.of(item));
        when(warehouseResolver.resolveId(FID, "WH-LOG")).thenReturn(WH_LOG_ID);

        FinishedGoodsBatch wksBatch = batch("b1", WH_WKS_ID, new BigDecimal("20"));
        when(finishedGoodsBatchRepository.findById("b1")).thenReturn(Optional.of(wksBatch));

        BatchAllocationDTO dto = new BatchAllocationDTO();
        dto.setFinishedGoodsBatchId("b1");
        dto.setAllocatedQty(new BigDecimal("10"));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.allocateBatches(FID, ITEM_ID, List.of(dto)));
        assertEquals(409, ex.getCode());
        assertTrue(ex.getMessage().contains("WH-LOG"),
                "error message should mention the expected warehouse code");
    }

    @Test
    void allocateBatches_acceptsBatchFromMatchingWarehouse() {
        SalesDeliveryItem item = deliveryItem("WH-WKS", new BigDecimal("10"));
        when(deliveryItemRepository.findById(42L)).thenReturn(Optional.of(item));
        when(warehouseResolver.resolveId(FID, "WH-WKS")).thenReturn(WH_WKS_ID);

        FinishedGoodsBatch wksBatch = batch("b1", WH_WKS_ID, new BigDecimal("20"));
        when(finishedGoodsBatchRepository.findById("b1")).thenReturn(Optional.of(wksBatch));

        BatchAllocationDTO dto = new BatchAllocationDTO();
        dto.setFinishedGoodsBatchId("b1");
        dto.setAllocatedQty(new BigDecimal("10"));

        assertDoesNotThrow(() -> service.allocateBatches(FID, ITEM_ID, List.of(dto)));
        verify(allocationRepository).saveAll(anyList());
    }

    @Test
    void allocateBatches_nullSourceWarehouseCode_fallsBackToWHLOG() {
        SalesDeliveryItem item = deliveryItem(null, new BigDecimal("10"));
        when(deliveryItemRepository.findById(42L)).thenReturn(Optional.of(item));
        when(warehouseResolver.resolveLogisticsId(FID)).thenReturn(WH_LOG_ID);

        FinishedGoodsBatch logBatch = batch("b1", WH_LOG_ID, new BigDecimal("20"));
        when(finishedGoodsBatchRepository.findById("b1")).thenReturn(Optional.of(logBatch));

        BatchAllocationDTO dto = new BatchAllocationDTO();
        dto.setFinishedGoodsBatchId("b1");
        dto.setAllocatedQty(new BigDecimal("10"));

        assertDoesNotThrow(() -> service.allocateBatches(FID, ITEM_ID, List.of(dto)));
        verify(warehouseResolver).resolveLogisticsId(FID);
        verify(warehouseResolver, never()).resolveId(eq(FID), any());
    }

    // ─────────────── recommendFifo ───────────────

    @Test
    void recommendFifo_usesSourceWarehouseCodeWhenProvided() {
        when(warehouseResolver.resolveId(FID, "WH-WKS")).thenReturn(WH_WKS_ID);
        when(finishedGoodsBatchRepository.findAvailableBatchesFifoByWarehouse(FID, PRODUCT_ID, WH_WKS_ID))
                .thenReturn(List.of());

        service.recommendFifo(FID, PRODUCT_ID, new BigDecimal("10"), "WH-WKS");

        verify(warehouseResolver).resolveId(FID, "WH-WKS");
        verify(warehouseResolver, never()).resolveLogisticsId(any());
        verify(finishedGoodsBatchRepository).findAvailableBatchesFifoByWarehouse(FID, PRODUCT_ID, WH_WKS_ID);
    }

    @Test
    void recommendFifo_nullSourceWarehouseCode_fallsBackToWHLOG() {
        when(warehouseResolver.resolveLogisticsId(FID)).thenReturn(WH_LOG_ID);
        when(finishedGoodsBatchRepository.findAvailableBatchesFifoByWarehouse(FID, PRODUCT_ID, WH_LOG_ID))
                .thenReturn(List.of());

        service.recommendFifo(FID, PRODUCT_ID, new BigDecimal("10"), null);

        verify(warehouseResolver).resolveLogisticsId(FID);
        verify(warehouseResolver, never()).resolveId(eq(FID), any());
        verify(finishedGoodsBatchRepository).findAvailableBatchesFifoByWarehouse(FID, PRODUCT_ID, WH_LOG_ID);
    }

    @Test
    void recommendFifo_blankSourceWarehouseCode_fallsBackToWHLOG() {
        when(warehouseResolver.resolveLogisticsId(FID)).thenReturn(WH_LOG_ID);
        when(finishedGoodsBatchRepository.findAvailableBatchesFifoByWarehouse(FID, PRODUCT_ID, WH_LOG_ID))
                .thenReturn(List.of());

        service.recommendFifo(FID, PRODUCT_ID, new BigDecimal("10"), "  ");

        verify(warehouseResolver).resolveLogisticsId(FID);
        verify(warehouseResolver, never()).resolveId(eq(FID), any());
    }
}
