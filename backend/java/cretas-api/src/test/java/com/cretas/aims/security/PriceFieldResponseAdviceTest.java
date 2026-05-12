package com.cretas.aims.security;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.inventory.PurchaseOrderItem;
import com.cretas.aims.entity.inventory.PurchaseReceiveItem;
import com.cretas.aims.entity.inventory.PurchaseReceiveRecord;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.inventory.SalesOrderItem;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.PermissionService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.mock.web.MockHttpServletRequest;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link PriceFieldResponseAdvice}.
 *
 * <p>Covers:
 * <ul>
 *   <li>Strip price fields when current user lacks {@code procurement:price:view}.</li>
 *   <li>Pass through unchanged when current user has the permission.</li>
 *   <li>Pass through when no authenticated user (e.g. public endpoints).</li>
 *   <li>Handle nested entities (PurchaseOrder → items → unitPrice).</li>
 *   <li>Handle collections (PageResponse.content list).</li>
 *   <li>Handle ApiResponse envelope.</li>
 *   <li>Handle null body.</li>
 *   <li>Bidirectional JPA cycle resilience (PurchaseOrderItem.purchaseOrder cycle).</li>
 * </ul>
 *
 * @author Cretas Team
 * @since 2026-05-12
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("PriceFieldResponseAdvice — RBAC price isolation (PR #415 Option B)")
class PriceFieldResponseAdviceTest {

    @Mock private PermissionService permissionService;
    @Mock private UserRepository userRepository;

    @InjectMocks private PriceFieldResponseAdvice advice;

    private MockHttpServletRequest httpRequest;
    private ServerHttpRequest serverRequest;

    @BeforeEach
    void setup() {
        httpRequest = new MockHttpServletRequest();
        serverRequest = new ServletServerHttpRequest(httpRequest);
    }

    // ───────── Helpers ─────────

    private void asUser(Long userId, boolean canViewPrice) {
        httpRequest.setAttribute("userId", userId);
        User user = new User();
        user.setId(userId);
        lenient().when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        lenient().when(permissionService.hasPermission(eq(user),
                eq(PriceFieldResponseAdvice.PRICE_VIEW_PERMISSION))).thenReturn(canViewPrice);
    }

    private Object run(Object body) {
        return advice.beforeBodyWrite(body, null, MediaType.APPLICATION_JSON, null, serverRequest, null);
    }

    private PurchaseOrder samplePurchaseOrder() {
        PurchaseOrder order = new PurchaseOrder();
        order.setId("po-1");
        order.setFactoryId("F006");
        order.setOrderNumber("PO-2026-001");
        order.setSupplierId("sup-1");
        order.setTotalAmount(new BigDecimal("12345.67"));
        order.setTaxAmount(new BigDecimal("1604.94"));

        PurchaseOrderItem item = new PurchaseOrderItem();
        item.setId(1L);
        item.setMaterialName("青花椒");
        item.setQuantity(new BigDecimal("100.0000"));
        item.setUnitPrice(new BigDecimal("123.4567"));
        item.setTaxRate(new BigDecimal("13.00"));
        order.setItems(Arrays.asList(item));
        return order;
    }

    // ───────── Tests ─────────

    @Test
    @DisplayName("mgr role: PurchaseOrder.totalAmount / taxAmount / item.unitPrice / item.taxRate all nulled")
    void warehouseManager_purchaseOrder_pricesStripped() {
        asUser(10L, false);

        PurchaseOrder order = samplePurchaseOrder();
        run(order);

        assertNull(order.getTotalAmount(), "totalAmount stripped");
        assertNull(order.getTaxAmount(), "taxAmount stripped");
        assertEquals(1, order.getItems().size());
        PurchaseOrderItem item = order.getItems().get(0);
        assertNull(item.getUnitPrice(), "items[0].unitPrice stripped");
        assertNull(item.getTaxRate(), "items[0].taxRate stripped");

        // Non-price fields preserved
        assertEquals("PO-2026-001", order.getOrderNumber());
        assertEquals("青花椒", item.getMaterialName());
        assertEquals(new BigDecimal("100.0000"), item.getQuantity(), "quantity preserved");
    }

    @Test
    @DisplayName("finance role: PurchaseOrder.totalAmount + item.unitPrice unchanged")
    void financeManager_purchaseOrder_pricesUnchanged() {
        asUser(20L, true);

        PurchaseOrder order = samplePurchaseOrder();
        run(order);

        assertEquals(new BigDecimal("12345.67"), order.getTotalAmount());
        assertEquals(new BigDecimal("1604.94"), order.getTaxAmount());
        assertEquals(new BigDecimal("123.4567"), order.getItems().get(0).getUnitPrice());
        assertEquals(new BigDecimal("13.00"), order.getItems().get(0).getTaxRate());
    }

    @Test
    @DisplayName("procurement role: full price visibility")
    void procurementManager_purchaseOrder_pricesUnchanged() {
        asUser(30L, true);

        PurchaseOrder order = samplePurchaseOrder();
        run(order);
        assertNotNull(order.getTotalAmount());
        assertNotNull(order.getItems().get(0).getUnitPrice());
    }

    @Test
    @DisplayName("admin (super) role: full price visibility (whitelist short-circuit)")
    void admin_purchaseOrder_pricesUnchanged() {
        asUser(1L, true);
        PurchaseOrder order = samplePurchaseOrder();
        run(order);
        assertNotNull(order.getTotalAmount());
    }

    @Test
    @DisplayName("mgr role: PurchaseReceiveRecord + nested PurchaseReceiveItem stripped")
    void warehouseManager_receiveRecord_pricesStripped() {
        asUser(10L, false);

        PurchaseReceiveRecord rec = new PurchaseReceiveRecord();
        rec.setId("rec-1");
        rec.setReceiveNumber("PR-2026-001");
        rec.setTotalAmount(new BigDecimal("9999.99"));

        PurchaseReceiveItem item = new PurchaseReceiveItem();
        item.setId(1L);
        item.setMaterialName("青花椒");
        item.setReceivedQuantity(new BigDecimal("99.0000"));
        item.setUnitPrice(new BigDecimal("99.9999"));
        rec.setItems(Arrays.asList(item));

        run(rec);
        assertNull(rec.getTotalAmount());
        assertNull(rec.getItems().get(0).getUnitPrice());
        assertEquals("PR-2026-001", rec.getReceiveNumber());
        assertEquals(new BigDecimal("99.0000"), rec.getItems().get(0).getReceivedQuantity());
    }

    @Test
    @DisplayName("mgr role: MaterialBatch entity (unitPrice nulled)")
    void warehouseManager_materialBatch_pricesStripped() {
        asUser(10L, false);

        MaterialBatch batch = new MaterialBatch();
        batch.setId("batch-1");
        batch.setBatchNumber("BATCH-001");
        batch.setUnitPrice(new BigDecimal("88.88"));

        run(batch);
        assertNull(batch.getUnitPrice());
        assertEquals("BATCH-001", batch.getBatchNumber());
    }

    @Test
    @DisplayName("mgr role: MaterialBatchDTO (totalValue / unitPrice / totalPrice all nulled)")
    void warehouseManager_materialBatchDTO_pricesStripped() {
        asUser(10L, false);

        MaterialBatchDTO dto = MaterialBatchDTO.builder()
                .id("batch-1")
                .batchNumber("BATCH-001")
                .totalValue(new BigDecimal("1000.00"))
                .unitPrice(new BigDecimal("10.00"))
                .totalPrice(new BigDecimal("1000.00"))
                .build();
        run(dto);
        assertNull(dto.getTotalValue());
        assertNull(dto.getUnitPrice());
        assertNull(dto.getTotalPrice());
        assertEquals("BATCH-001", dto.getBatchNumber());
    }

    @Test
    @DisplayName("mgr role: SalesOrder + SalesOrderItem 三价对比 all stripped")
    void warehouseManager_salesOrder_pricesStripped() {
        asUser(10L, false);

        SalesOrder so = new SalesOrder();
        so.setId("so-1");
        so.setOrderNumber("SO-2026-001");
        so.setTotalAmount(new BigDecimal("50000.00"));
        so.setDiscountAmount(new BigDecimal("1000.00"));
        so.setTaxAmount(new BigDecimal("6500.00"));

        SalesOrderItem item = new SalesOrderItem();
        item.setId(1L);
        item.setProductName("青花椒成品");
        item.setQuantity(new BigDecimal("500.0000"));
        item.setUnitPrice(new BigDecimal("100.0000"));
        item.setCostUnitPrice(new BigDecimal("80.0000"));
        item.setTaxRate(new BigDecimal("13.00"));
        item.setDiscountRate(new BigDecimal("5.00"));
        so.setItems(Arrays.asList(item));

        run(so);
        assertNull(so.getTotalAmount());
        assertNull(so.getDiscountAmount());
        assertNull(so.getTaxAmount());
        assertNull(item.getUnitPrice());
        assertNull(item.getCostUnitPrice());
        assertNull(item.getTaxRate());
        assertNull(item.getDiscountRate());
        // Non-price preserved
        assertEquals("SO-2026-001", so.getOrderNumber());
        assertEquals("青花椒成品", item.getProductName());
        assertEquals(new BigDecimal("500.0000"), item.getQuantity());
    }

    @Test
    @DisplayName("mgr role: ApiResponse<PurchaseOrder> envelope — recurses into data")
    void warehouseManager_apiResponse_recurses() {
        asUser(10L, false);

        PurchaseOrder order = samplePurchaseOrder();
        ApiResponse<PurchaseOrder> response = ApiResponse.success("查询成功", order);

        run(response);
        assertNull(response.getData().getTotalAmount(), "ApiResponse.data.totalAmount stripped");
        assertNull(response.getData().getItems().get(0).getUnitPrice());
        // Envelope fields preserved
        assertEquals("查询成功", response.getMessage());
        assertEquals(Boolean.TRUE, response.getSuccess());
    }

    @Test
    @DisplayName("mgr role: PageResponse<PurchaseOrder> — recurses into content list")
    void warehouseManager_pageResponse_recurses() {
        asUser(10L, false);

        PurchaseOrder p1 = samplePurchaseOrder();
        PurchaseOrder p2 = samplePurchaseOrder();
        p2.setId("po-2");
        p2.setOrderNumber("PO-2026-002");

        PageResponse<PurchaseOrder> page = new PageResponse<>();
        page.setContent(Arrays.asList(p1, p2));
        page.setTotalElements(2L);

        ApiResponse<PageResponse<PurchaseOrder>> response = ApiResponse.success("ok", page);

        run(response);
        assertNull(response.getData().getContent().get(0).getTotalAmount());
        assertNull(response.getData().getContent().get(1).getTotalAmount());
        assertNull(response.getData().getContent().get(0).getItems().get(0).getUnitPrice());
        // Counts preserved
        assertEquals(2L, response.getData().getTotalElements());
    }

    @Test
    @DisplayName("Null body — pass through")
    void nullBody_passThrough() {
        // No need to stub user for null body — early return
        Object result = run(null);
        assertNull(result);
    }

    @Test
    @DisplayName("No authenticated user (e.g. /api/mobile/auth/login) — pass through unchanged")
    void noAuthUser_passThrough() {
        // No userId attribute, no user lookup, no permission check
        PurchaseOrder order = samplePurchaseOrder();
        run(order);
        // Untouched — auth layer (JwtAuthInterceptor) handles public endpoints
        assertEquals(new BigDecimal("12345.67"), order.getTotalAmount());
        assertNotNull(order.getItems().get(0).getUnitPrice());
    }

    @Test
    @DisplayName("Bidirectional JPA cycle — does not stack-overflow")
    void cycleProtection() {
        asUser(10L, false);

        PurchaseOrder order = samplePurchaseOrder();
        // Manually wire bidirectional ref (JPA usually does this; mimic post-load state)
        order.getItems().get(0).setPurchaseOrder(order);

        // Should complete without StackOverflowError
        assertDoesNotThrow(() -> run(order));
        assertNull(order.getTotalAmount());
        assertNull(order.getItems().get(0).getUnitPrice());
    }

    @Test
    @DisplayName("Non-JSON content type — pass through")
    void nonJsonContentType_passThrough() {
        // Don't stub user/permission — the advice should short-circuit on content type
        PurchaseOrder order = samplePurchaseOrder();
        Object result = advice.beforeBodyWrite(order, null,
                MediaType.APPLICATION_OCTET_STREAM, null, serverRequest, null);
        // Untouched
        assertEquals(new BigDecimal("12345.67"), order.getTotalAmount());
    }

    @Test
    @DisplayName("Plain List<PurchaseOrder> (no wrapper) — strips each element")
    void plainList_recurses() {
        asUser(10L, false);

        List<PurchaseOrder> list = Arrays.asList(samplePurchaseOrder(), samplePurchaseOrder());
        run(list);
        for (PurchaseOrder o : list) {
            assertNull(o.getTotalAmount());
            assertNull(o.getItems().get(0).getUnitPrice());
        }
    }
}
