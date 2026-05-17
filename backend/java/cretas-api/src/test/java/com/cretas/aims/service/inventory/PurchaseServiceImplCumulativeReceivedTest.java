package com.cretas.aims.service.inventory;

import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.inventory.PurchaseOrderItem;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.inventory.PurchaseOrderItemRepository;
import com.cretas.aims.repository.inventory.PurchaseOrderRepository;
import com.cretas.aims.service.inventory.impl.PurchaseServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Issue #787 follow-up regression test — backend cumulative-received aggregate.
 *
 * <p>Verifies PurchaseServiceImpl.getCumulativeReceived returns correct per-line
 * + total aggregates, enforces factory isolation, and handles the empty-items edge case.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("PurchaseServiceImpl 累计已收 aggregate 测试 (Issue #787)")
class PurchaseServiceImplCumulativeReceivedTest {

    @Mock private PurchaseOrderRepository purchaseOrderRepository;
    @Mock private PurchaseOrderItemRepository purchaseOrderItemRepository;

    private PurchaseServiceImpl service;

    private static final String FACTORY_ID = "F001";
    private static final String OTHER_FACTORY = "F999";
    private static final String PO_ID = "PO-001";

    @BeforeEach
    void setUp() {
        service = new PurchaseServiceImpl(
                purchaseOrderRepository,
                purchaseOrderItemRepository,
                /* receiveRecordRepository */ null,
                /* supplierRepository */ null,
                /* materialTypeRepository */ null,
                /* materialBatchRepository */ null,
                /* bomItemRepository */ null,
                /* arApService */ null,
                /* applicationEventPublisher */ null,
                /* materialBatchService */ null);
    }

    private PurchaseOrder buildOrder(String factoryId) {
        PurchaseOrder order = new PurchaseOrder();
        order.setId(PO_ID);
        order.setFactoryId(factoryId);
        order.setOrderNumber("PO-20260517-001");
        order.setStatus(PurchaseOrderStatus.APPROVED);
        return order;
    }

    private PurchaseOrderItem buildItem(String materialId, String name, BigDecimal planned, BigDecimal received) {
        PurchaseOrderItem item = new PurchaseOrderItem();
        item.setPurchaseOrderId(PO_ID);
        item.setMaterialTypeId(materialId);
        item.setMaterialName(name);
        item.setQuantity(planned);
        item.setReceivedQuantity(received);
        item.setUnit("kg");
        return item;
    }

    @Test
    @DisplayName("3 行 PO + 部分入库 → 汇总 plannedTotal/cumulativeReceived 与 per-line 一致")
    void getCumulativeReceived_aggregatesCorrectly() {
        when(purchaseOrderRepository.findById(PO_ID))
                .thenReturn(Optional.of(buildOrder(FACTORY_ID)));
        when(purchaseOrderItemRepository.findByPurchaseOrderId(PO_ID))
                .thenReturn(List.of(
                        buildItem("MAT-001", "辣椒", new BigDecimal("100"), new BigDecimal("30")),
                        buildItem("MAT-002", "盐", new BigDecimal("50"), new BigDecimal("50")),
                        buildItem("MAT-003", "糖", new BigDecimal("200"), BigDecimal.ZERO)));

        Map<String, Object> result = service.getCumulativeReceived(FACTORY_ID, PO_ID);

        assertEquals(PO_ID, result.get("poId"));
        assertEquals("PO-20260517-001", result.get("orderNumber"));
        assertEquals(new BigDecimal("350"), result.get("plannedTotal"));
        assertEquals(new BigDecimal("80"), result.get("cumulativeReceived"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> lines = (List<Map<String, Object>>) result.get("lines");
        assertEquals(3, lines.size());

        Map<String, Object> line1 = lines.get(0);
        assertEquals("MAT-001", line1.get("materialId"));
        assertEquals("辣椒", line1.get("materialName"));
        assertEquals(new BigDecimal("100"), line1.get("plannedQty"));
        assertEquals(new BigDecimal("30"), line1.get("receivedQty"));
        assertEquals(new BigDecimal("70"), line1.get("pendingQty"));

        Map<String, Object> line2 = lines.get(1);
        assertEquals(new BigDecimal("0"), line2.get("pendingQty"),
                "全部入库行 pending should be 0");

        Map<String, Object> line3 = lines.get(2);
        assertEquals(new BigDecimal("200"), line3.get("pendingQty"),
                "未入库行 pending should equal planned");
    }

    @Test
    @DisplayName("空 items 行 → planned/received 都为 0, lines 列表空")
    void getCumulativeReceived_emptyItems_zeroTotals() {
        when(purchaseOrderRepository.findById(PO_ID))
                .thenReturn(Optional.of(buildOrder(FACTORY_ID)));
        when(purchaseOrderItemRepository.findByPurchaseOrderId(PO_ID))
                .thenReturn(List.of());

        Map<String, Object> result = service.getCumulativeReceived(FACTORY_ID, PO_ID);

        assertEquals(BigDecimal.ZERO, result.get("plannedTotal"));
        assertEquals(BigDecimal.ZERO, result.get("cumulativeReceived"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> lines = (List<Map<String, Object>>) result.get("lines");
        assertTrue(lines.isEmpty());
    }

    @Test
    @DisplayName("跨工厂访问 → throw BusinessException 403")
    void getCumulativeReceived_crossFactory_throwsForbidden() {
        when(purchaseOrderRepository.findById(PO_ID))
                .thenReturn(Optional.of(buildOrder(OTHER_FACTORY)));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.getCumulativeReceived(FACTORY_ID, PO_ID));
        assertEquals(403, ex.getCode());
    }

    @Test
    @DisplayName("null receivedQuantity 行 → 视为 0, 不抛 NPE")
    void getCumulativeReceived_nullReceivedQuantity_treatedAsZero() {
        PurchaseOrderItem nullReceived = new PurchaseOrderItem();
        nullReceived.setPurchaseOrderId(PO_ID);
        nullReceived.setMaterialTypeId("MAT-001");
        nullReceived.setMaterialName("辣椒");
        nullReceived.setQuantity(new BigDecimal("100"));
        nullReceived.setReceivedQuantity(null);
        nullReceived.setUnit("kg");

        when(purchaseOrderRepository.findById(PO_ID))
                .thenReturn(Optional.of(buildOrder(FACTORY_ID)));
        when(purchaseOrderItemRepository.findByPurchaseOrderId(PO_ID))
                .thenReturn(List.of(nullReceived));

        Map<String, Object> result = service.getCumulativeReceived(FACTORY_ID, PO_ID);
        assertEquals(new BigDecimal("100"), result.get("plannedTotal"));
        assertEquals(BigDecimal.ZERO, result.get("cumulativeReceived"));
    }
}
