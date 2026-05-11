package com.cretas.aims.service.orchestration;

import com.cretas.aims.dto.orchestration.StockCheckResult;
import com.cretas.aims.entity.inventory.FinishedGoodsBatch;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.inventory.SalesOrderItem;
import com.cretas.aims.repository.inventory.FinishedGoodsBatchRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * A5 集团联销 (cross-factory sales) feature flag test — PR #309 A5=C.
 *
 * <p>验证 {@code cretas.sales.cross-factory.enabled} 控制
 * {@link InventoryMatchingService} 在销售订单库存匹配 / 预留时
 * 调用 factory-filtered 还是 all-factories 的 repository 查询。
 *
 * <p>默认 (false) 保持单厂语义；true 时跳过 factoryId 过滤进入"集团池"语义。
 *
 * @since 2026-05-10 PR #309 A5=C feature flag introduction
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("A5: InventoryMatchingService cross-factory feature flag")
class InventoryMatchingServiceCrossFactoryFlagTest {

    @Mock
    private SalesOrderRepository salesOrderRepository;

    @Mock
    private FinishedGoodsBatchRepository finishedGoodsBatchRepository;

    @InjectMocks
    private InventoryMatchingService service;

    private static final String FACTORY_A = "F001";
    private static final String PRODUCT_TYPE = "PT-001";
    private static final String SALES_ORDER_ID = "SO-A5-TEST";

    /** 反射设置 @Value-注入的 boolean 字段，绕开 Spring context 用 pure Mockito. */
    private void setFlag(boolean enabled) throws Exception {
        Field f = InventoryMatchingService.class.getDeclaredField("crossFactoryEnabled");
        f.setAccessible(true);
        f.setBoolean(service, enabled);
    }

    /** 构造一个待发货数量 > 0 的最小 SO + item, 触发库存查询路径. */
    private SalesOrder buildSalesOrderWithOneItem(BigDecimal pending) {
        SalesOrderItem item = new SalesOrderItem();
        item.setProductTypeId(PRODUCT_TYPE);
        item.setProductName("测试产品");
        item.setQuantity(pending);
        item.setDeliveredQuantity(BigDecimal.ZERO);
        // getPendingQuantity() = quantity - deliveredQuantity = pending

        SalesOrder so = new SalesOrder();
        so.setId(SALES_ORDER_ID);
        so.setFactoryId(FACTORY_A);
        so.setItems(List.of(item));
        return so;
    }

    @BeforeEach
    void setUp() throws Exception {
        // 默认每个测试开始 flag=false; 个别测试自己覆盖.
        setFlag(false);
    }

    // ============================================================
    // checkAvailability — readonly path
    // ============================================================

    @Test
    @DisplayName("flag=false (默认): checkAvailability 只查询 SO.factoryId 的库存")
    void checkAvailability_flagFalse_filtersByFactory() throws Exception {
        setFlag(false);

        SalesOrder so = buildSalesOrderWithOneItem(new BigDecimal("100"));
        when(salesOrderRepository.findById(SALES_ORDER_ID)).thenReturn(Optional.of(so));
        when(finishedGoodsBatchRepository.sumAvailableQuantityByProductType(FACTORY_A, PRODUCT_TYPE))
                .thenReturn(new BigDecimal("200"));

        StockCheckResult result = service.checkAvailability(FACTORY_A, SALES_ORDER_ID);

        // factory-filtered 查询被调用 1 次, all-factories 永远不调用
        verify(finishedGoodsBatchRepository, times(1))
                .sumAvailableQuantityByProductType(FACTORY_A, PRODUCT_TYPE);
        verify(finishedGoodsBatchRepository, never())
                .sumAvailableQuantityByProductTypeAllFactories(anyString());

        assertEquals(1, result.getLineItems().size());
        // 富余 100, 全部满足
        assertEquals(0, result.getLineItems().get(0).getAvailableQuantity()
                .compareTo(new BigDecimal("200")));
    }

    @Test
    @DisplayName("flag=true: checkAvailability 跳过 factoryId 过滤 (集团池)")
    void checkAvailability_flagTrue_skipsFactoryFilter() throws Exception {
        setFlag(true);

        SalesOrder so = buildSalesOrderWithOneItem(new BigDecimal("100"));
        when(salesOrderRepository.findById(SALES_ORDER_ID)).thenReturn(Optional.of(so));
        when(finishedGoodsBatchRepository.sumAvailableQuantityByProductTypeAllFactories(PRODUCT_TYPE))
                .thenReturn(new BigDecimal("500"));  // 跨工厂总量比单厂多

        StockCheckResult result = service.checkAvailability(FACTORY_A, SALES_ORDER_ID);

        // all-factories 查询被调用 1 次, factory-filtered 永远不调用
        verify(finishedGoodsBatchRepository, times(1))
                .sumAvailableQuantityByProductTypeAllFactories(PRODUCT_TYPE);
        verify(finishedGoodsBatchRepository, never())
                .sumAvailableQuantityByProductType(anyString(), anyString());

        assertEquals(0, result.getLineItems().get(0).getAvailableQuantity()
                .compareTo(new BigDecimal("500")));
    }

    // ============================================================
    // reserveStock — write path (FEFO)
    // ============================================================

    @Test
    @DisplayName("flag=false (默认): reserveStock 只在 SO.factoryId 内 FEFO 预留")
    void reserveStock_flagFalse_filtersByFactory() throws Exception {
        setFlag(false);
        when(finishedGoodsBatchRepository.findAvailableBatches(FACTORY_A, PRODUCT_TYPE))
                .thenReturn(Collections.emptyList());

        service.reserveStock(FACTORY_A, PRODUCT_TYPE, new BigDecimal("10"));

        verify(finishedGoodsBatchRepository, times(1))
                .findAvailableBatches(FACTORY_A, PRODUCT_TYPE);
        verify(finishedGoodsBatchRepository, never())
                .findAvailableBatchesAllFactories(anyString());
    }

    @Test
    @DisplayName("flag=true: reserveStock 跨工厂 FEFO 预留 (集团池)")
    void reserveStock_flagTrue_skipsFactoryFilter() throws Exception {
        setFlag(true);
        when(finishedGoodsBatchRepository.findAvailableBatchesAllFactories(PRODUCT_TYPE))
                .thenReturn(Collections.emptyList());

        service.reserveStock(FACTORY_A, PRODUCT_TYPE, new BigDecimal("10"));

        verify(finishedGoodsBatchRepository, times(1))
                .findAvailableBatchesAllFactories(PRODUCT_TYPE);
        verify(finishedGoodsBatchRepository, never())
                .findAvailableBatches(anyString(), anyString());
    }

    // ============================================================
    // FEFO reservation 实际跨工厂取批次行为 (端到端)
    // ============================================================

    @Test
    @DisplayName("flag=true: FEFO 从跨工厂批次池中按返回顺序预留")
    void reserveStock_flagTrue_reservesAcrossFactoryBatches() throws Exception {
        setFlag(true);

        // 模拟跨工厂池: 两个不同 factory 的批次, repository 已按 FEFO 排好序
        FinishedGoodsBatch batchFromFactoryB = new FinishedGoodsBatch();
        batchFromFactoryB.setFactoryId("F002");
        batchFromFactoryB.setBatchNumber("B-F002-001");
        batchFromFactoryB.setProductTypeId(PRODUCT_TYPE);
        batchFromFactoryB.setStatus("AVAILABLE");
        batchFromFactoryB.setProducedQuantity(new BigDecimal("30"));
        batchFromFactoryB.setShippedQuantity(BigDecimal.ZERO);
        batchFromFactoryB.setReservedQuantity(BigDecimal.ZERO);

        FinishedGoodsBatch batchFromFactoryC = new FinishedGoodsBatch();
        batchFromFactoryC.setFactoryId("F003");
        batchFromFactoryC.setBatchNumber("B-F003-001");
        batchFromFactoryC.setProductTypeId(PRODUCT_TYPE);
        batchFromFactoryC.setStatus("AVAILABLE");
        batchFromFactoryC.setProducedQuantity(new BigDecimal("50"));
        batchFromFactoryC.setShippedQuantity(BigDecimal.ZERO);
        batchFromFactoryC.setReservedQuantity(BigDecimal.ZERO);

        when(finishedGoodsBatchRepository.findAvailableBatchesAllFactories(PRODUCT_TYPE))
                .thenReturn(List.of(batchFromFactoryB, batchFromFactoryC));

        // 调用 SO.factoryId=F001 但跨工厂取了 F002 + F003 的批次
        service.reserveStock(FACTORY_A, PRODUCT_TYPE, new BigDecimal("60"));

        // 首批 30 全用 (F002), 第二批用 30/50 (F003)
        assertEquals(0, batchFromFactoryB.getReservedQuantity().compareTo(new BigDecimal("30")),
                "first batch fully reserved from F002");
        assertEquals(0, batchFromFactoryC.getReservedQuantity().compareTo(new BigDecimal("30")),
                "second batch partial-reserved 30/50 from F003");

        verify(finishedGoodsBatchRepository, times(1))
                .findAvailableBatchesAllFactories(PRODUCT_TYPE);
        // 两批各 save 一次 (依次 iteration)
        verify(finishedGoodsBatchRepository, times(1)).save(eq(batchFromFactoryB));
        verify(finishedGoodsBatchRepository, times(1)).save(eq(batchFromFactoryC));
    }
}
