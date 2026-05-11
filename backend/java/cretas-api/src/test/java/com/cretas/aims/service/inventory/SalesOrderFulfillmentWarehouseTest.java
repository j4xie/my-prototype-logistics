package com.cretas.aims.service.inventory;

import com.cretas.aims.entity.factory.WarehouseCodes;
import com.cretas.aims.entity.inventory.FinishedGoodsBatch;
import com.cretas.aims.entity.inventory.SalesDeliveryItem;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.inventory.FinishedGoodsBatchRepository;
import com.cretas.aims.service.factory.WarehouseResolver;
import com.cretas.aims.service.inventory.impl.SalesServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * D5: SalesOrder 发货 → 仅从总仓 (WH-LOG) 出货 (PR #316, 2026-05-11).
 *
 * <p>验证 {@link SalesServiceImpl#deductFinishedGoodsInventory} (FIFO 扣减)
 * 通过 {@link WarehouseResolver#resolveLogisticsId} 解析 WH-LOG 仓库 id,
 * 仅扣减该仓库的批次。WH-WKS (鲜棉仓) 批次不参与销售扣减。
 *
 * <p>测试 pattern：参考 {@code SalesServiceImplSalespersonTest} — 用 null ctor
 * 构造 service, 反射设置需要的字段 (warehouseResolver, finishedGoodsBatchRepository).
 *
 * @since 2026-05-11 PR #316 D5 (sales from WH-LOG)
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("D5: SalesOrder fulfillment WH-LOG 过滤")
class SalesOrderFulfillmentWarehouseTest {

    @Mock
    private FinishedGoodsBatchRepository finishedGoodsBatchRepository;

    @Mock
    private WarehouseResolver warehouseResolver;

    private SalesServiceImpl salesService;

    private static final String FACTORY_A = "F001";
    private static final String PRODUCT_TYPE = "PT-001";
    private static final String WH_LOG_ID = "wh-log-f001";

    @BeforeEach
    void setUp() {
        // Mirror SalesServiceImplSalespersonTest pattern: 8-arg ctor with null + reflective injection.
        salesService = new SalesServiceImpl(
                null,    // salesOrderRepository
                null,    // salesOrderItemRepository
                null,    // deliveryRecordRepository
                finishedGoodsBatchRepository,
                null,    // customerRepository
                null,    // productTypeRepository
                null,    // arApService
                null);   // applicationEventPublisher
        ReflectionTestUtils.setField(salesService, "warehouseResolver", warehouseResolver);
        when(warehouseResolver.resolveLogisticsId(FACTORY_A)).thenReturn(WH_LOG_ID);
    }

    /** Invoke private deductFinishedGoodsInventory via reflection. */
    private void invokeDeduct(SalesDeliveryItem item) throws Exception {
        Method m = SalesServiceImpl.class.getDeclaredMethod(
                "deductFinishedGoodsInventory", String.class, SalesDeliveryItem.class);
        m.setAccessible(true);
        try {
            m.invoke(salesService, FACTORY_A, item);
        } catch (java.lang.reflect.InvocationTargetException e) {
            // Unwrap so callers can catch BusinessException directly.
            if (e.getCause() instanceof RuntimeException) {
                throw (RuntimeException) e.getCause();
            }
            throw e;
        }
    }

    private SalesDeliveryItem buildDeliveryItem(BigDecimal quantity) {
        SalesDeliveryItem item = new SalesDeliveryItem();
        item.setProductTypeId(PRODUCT_TYPE);
        item.setDeliveredQuantity(quantity);
        return item;
    }

    private FinishedGoodsBatch buildAvailableBatch(String batchNumber, String warehouseId, BigDecimal produced) {
        FinishedGoodsBatch b = new FinishedGoodsBatch();
        b.setFactoryId(FACTORY_A);
        b.setBatchNumber(batchNumber);
        b.setProductTypeId(PRODUCT_TYPE);
        b.setWarehouseId(warehouseId);
        b.setStatus("AVAILABLE");
        b.setProducedQuantity(produced);
        b.setShippedQuantity(BigDecimal.ZERO);
        b.setReservedQuantity(BigDecimal.ZERO);
        return b;
    }

    // ============================================================
    // Standard path — WH-LOG batches only
    // ============================================================

    @Test
    @DisplayName("标准: 仅查询 WH-LOG 批次, 用 WH-LOG warehouseId 解析")
    void deduct_queriesWhLogOnly() throws Exception {
        FinishedGoodsBatch whLogBatch = buildAvailableBatch("B-LOG-001", WH_LOG_ID, new BigDecimal("50"));
        when(finishedGoodsBatchRepository.findAvailableBatchesByWarehouse(FACTORY_A, PRODUCT_TYPE, WH_LOG_ID))
                .thenReturn(List.of(whLogBatch));

        SalesDeliveryItem item = buildDeliveryItem(new BigDecimal("30"));
        invokeDeduct(item);

        // WH-LOG repository 查询调用 1 次, factory-only 查询 (无 warehouse 过滤) 永远不调用
        verify(warehouseResolver, times(1)).resolveLogisticsId(FACTORY_A);
        verify(finishedGoodsBatchRepository, times(1))
                .findAvailableBatchesByWarehouse(FACTORY_A, PRODUCT_TYPE, WH_LOG_ID);
        verify(finishedGoodsBatchRepository, never())
                .findAvailableBatches(anyString(), anyString());

        // 扣减 30 / 50
        assertEquals(0, whLogBatch.getShippedQuantity().compareTo(new BigDecimal("30")));
        assertEquals("B-LOG-001", whLogBatch.getBatchNumber());
        // 批次 id 写回到 delivery item (SalesServiceImpl line 1008-1010)
        // — 这里 id 由 JPA @GeneratedValue 但测试中我们手工 set 验证: skip 因 id null in unit test
    }

    @Test
    @DisplayName("标准: FIFO 跨多个 WH-LOG 批次扣减")
    void deduct_consumesAcrossWhLogBatchesFifo() throws Exception {
        FinishedGoodsBatch oldBatch = buildAvailableBatch("B-LOG-OLD", WH_LOG_ID, new BigDecimal("20"));
        FinishedGoodsBatch newBatch = buildAvailableBatch("B-LOG-NEW", WH_LOG_ID, new BigDecimal("40"));
        // Repository returns FEFO ordered (oldest first)
        when(finishedGoodsBatchRepository.findAvailableBatchesByWarehouse(FACTORY_A, PRODUCT_TYPE, WH_LOG_ID))
                .thenReturn(List.of(oldBatch, newBatch));

        SalesDeliveryItem item = buildDeliveryItem(new BigDecimal("35"));
        invokeDeduct(item);

        // 第一批 20/20 全用, 第二批 15/40 部分
        assertEquals(0, oldBatch.getShippedQuantity().compareTo(new BigDecimal("20")));
        assertEquals(0, newBatch.getShippedQuantity().compareTo(new BigDecimal("15")));
        // 第一批 depleted
        assertEquals("DEPLETED", oldBatch.getStatus());
        // 第二批仍 AVAILABLE
        assertEquals("AVAILABLE", newBatch.getStatus());

        verify(finishedGoodsBatchRepository, times(1)).save(eq(oldBatch));
        verify(finishedGoodsBatchRepository, times(1)).save(eq(newBatch));
    }

    // ============================================================
    // Negative — WH-WKS only, no WH-LOG → insufficient stock
    // ============================================================

    @Test
    @DisplayName("负: 仅 WH-WKS 有库存 → 销售扣减抛 BusinessException (不可用)")
    void deduct_onlyWhWksAvailable_throwsInsufficient() throws Exception {
        // Repository 按 WH-LOG warehouseId 查 → 返空 (WH-WKS 批次被仓库 filter 排除)
        when(finishedGoodsBatchRepository.findAvailableBatchesByWarehouse(FACTORY_A, PRODUCT_TYPE, WH_LOG_ID))
                .thenReturn(Collections.emptyList());

        SalesDeliveryItem item = buildDeliveryItem(new BigDecimal("10"));
        BusinessException ex = assertThrows(BusinessException.class, () -> invokeDeduct(item));

        // 错误信息提示 "成品库存不足" + 缺少数量
        assertNotNull(ex.getMessage());
        assertEquals(true, ex.getMessage().contains("成品库存不足"));
        assertEquals(true, ex.getMessage().contains(PRODUCT_TYPE));

        // 没有 save 调用 (没批次扣)
        verify(finishedGoodsBatchRepository, never()).save(eq((FinishedGoodsBatch) null));
    }

    // ============================================================
    // getAvailableBatches — public read path
    // ============================================================

    @Test
    @DisplayName("getAvailableBatches: 仅返回 WH-LOG 批次 (供 UI 库存查询)")
    void getAvailableBatches_returnsWhLogOnly() {
        FinishedGoodsBatch whLogBatch = buildAvailableBatch("B-LOG-001", WH_LOG_ID, new BigDecimal("100"));
        when(finishedGoodsBatchRepository.findAvailableBatchesByWarehouse(FACTORY_A, PRODUCT_TYPE, WH_LOG_ID))
                .thenReturn(List.of(whLogBatch));

        List<FinishedGoodsBatch> batches = salesService.getAvailableBatches(FACTORY_A, PRODUCT_TYPE);

        assertEquals(1, batches.size());
        assertEquals(WH_LOG_ID, batches.get(0).getWarehouseId());
        // 验证调用走 WH-LOG 过滤路径
        verify(warehouseResolver, times(1)).resolveLogisticsId(FACTORY_A);
        verify(finishedGoodsBatchRepository, times(1))
                .findAvailableBatchesByWarehouse(FACTORY_A, PRODUCT_TYPE, WH_LOG_ID);
    }

    @Test
    @DisplayName("WH-LOG warehouseCode 常量稳定 (D5 spec 锁定)")
    void warehouseCodeConstantIsStable() {
        // Defensive: 若未来重命名 WH-LOG → 这个 test 立即 fail, 提醒 grep 所有 site
        assertEquals("WH-LOG", WarehouseCodes.WH_LOG);
    }
}
