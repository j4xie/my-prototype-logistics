package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.Customer;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.entity.Supplier;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.enums.SalesOrderStatus;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.sales.OperationalQuote;
import com.cretas.aims.repository.CustomerRepository;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.repository.SupplierRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.repository.inventory.PurchaseOrderRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.repository.sales.OperationalQuoteRepository;
import com.cretas.aims.security.PriceMaskResolver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * R13: integration test for ReferenceDataController push-down isActive filter.
 *
 * <p>R10 audit S1 (reviewer #6) flagged: "R10 push-down has zero test coverage —
 * a typo in JPQL OR clause would not be caught until manual smoke." This test
 * verifies the 4 endpoints actually call the new isActive-filtered repo methods,
 * NOT the old unfiltered ones.
 */
@ExtendWith(MockitoExtension.class)
class ReferenceDataControllerTest {

    @Mock UserRepository userRepository;
    @Mock CustomerRepository customerRepository;
    @Mock SupplierRepository supplierRepository;
    @Mock ProductTypeRepository productTypeRepository;
    @Mock RawMaterialTypeRepository materialTypeRepository;
    @Mock OperationalQuoteRepository quoteRepository;
    @Mock SalesOrderRepository salesOrderRepository;
    @Mock PurchaseOrderRepository purchaseOrderRepository;
    @Mock MaterialBatchRepository materialBatchRepository;
    // findProducts now takes an Authorization header for price-masking. The
    // controller field is @Autowired final, so @InjectMocks needs a mock here
    // (returning false = no masking, matches default null-Authorization behavior).
    @Mock PriceMaskResolver priceMaskResolver;

    @InjectMocks ReferenceDataController controller;

    @Test
    void findCustomers_usesActiveFilteredQuery_notRawFindByFactory() {
        Page<Customer> empty = new PageImpl<>(List.of());
        when(customerRepository.findByFactoryIdAndIsActiveTrue(eq("F001"), any(Pageable.class))).thenReturn(empty);

        controller.findCustomers("F001", "", 1, 50);

        verify(customerRepository).findByFactoryIdAndIsActiveTrue(eq("F001"), any(Pageable.class));
        // Critical: the OLD unfiltered method should NEVER be called by this endpoint.
        verify(customerRepository, never()).findByFactoryId(eq("F001"), any(Pageable.class));
    }

    @Test
    void findCustomers_withKeyword_usesActiveSearchVariant() {
        Page<Customer> empty = new PageImpl<>(List.of());
        when(customerRepository.searchActiveByNamePaged(eq("F001"), any(), any(Pageable.class))).thenReturn(empty);

        controller.findCustomers("F001", "蓝", 1, 50);

        verify(customerRepository).searchActiveByNamePaged(eq("F001"), any(), any(Pageable.class));
        verify(customerRepository, never()).searchByNamePaged(eq("F001"), any(), any(Pageable.class));
    }

    @Test
    void findSuppliers_usesActiveFilteredQuery() {
        when(supplierRepository.findByFactoryIdAndIsActiveTrue(eq("F001"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));
        controller.findSuppliers("F001", "", 1, 50);
        verify(supplierRepository).findByFactoryIdAndIsActiveTrue(eq("F001"), any(Pageable.class));
        verify(supplierRepository, never()).findByFactoryId(eq("F001"), any(Pageable.class));
    }

    @Test
    void findProducts_usesActiveFilteredQuery() {
        when(productTypeRepository.findByFactoryIdAndIsActiveTrue(eq("F001"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));
        // Audit fix 2026-05-13: findProducts signature gained `authorization` arg
        // (PR #443 §F2 price-mask resolver) but this test wasn't updated → ALL
        // recent F006 PRs (#549/#560/#562/#564) have java-build-test=FAILURE
        // because of this single stale call. Passing null is fine (priceMaskResolver
        // tolerates null Authorization header).
        controller.findProducts("F001", "", 1, 50, null);
        verify(productTypeRepository).findByFactoryIdAndIsActiveTrue(eq("F001"), any(Pageable.class));
        verify(productTypeRepository, never()).findByFactoryId(eq("F001"), any(Pageable.class));
    }

    @Test
    void findMaterials_usesActiveFilteredQuery() {
        when(materialTypeRepository.findByFactoryIdAndIsActiveTrue(eq("F001"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));
        controller.findMaterials("F001", "", 1, 50);
        verify(materialTypeRepository).findByFactoryIdAndIsActiveTrue(eq("F001"), any(Pageable.class));
        verify(materialTypeRepository, never()).findByFactoryId(eq("F001"), any(Pageable.class));
    }

    @Test
    void findEmployees_appliesActiveFilter_inMemoryViaSearchUsers() {
        // /employees uses over-fetch + post-filter (isActive AND optionally salesOnly).
        // The repo method is searchUsers (not isActive-aware), but the controller's stream
        // applies the filter. Verify: a deactivated user is excluded.
        User active = new User();
        active.setId(1L);
        active.setFullName("张三");
        active.setIsActive(true);
        active.setRoleCode("salesperson");

        User inactive = new User();
        inactive.setId(2L);
        inactive.setFullName("李四");
        inactive.setIsActive(false);
        inactive.setRoleCode("salesperson");

        when(userRepository.searchUsers(eq("F001"), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(active, inactive)));

        ApiResponse<Map<String, Object>> resp = controller.findEmployees("F001", "", true, 1, 50);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) resp.getData().get("content");

        assertEquals(1, content.size(), "Inactive user must be filtered out");
        assertEquals(1L, content.get(0).get("id"));
        assertEquals("张三", content.get(0).get("fullName"));
    }

    @Test
    void getEmployee_byNumericId_returnsUser() {
        User u = new User();
        u.setId(146L);
        u.setFullName("销售主管小吴");
        u.setFactoryId("F001");
        when(userRepository.findById(146L)).thenReturn(java.util.Optional.of(u));

        ApiResponse<Map<String, Object>> resp = controller.getEmployee("F001", "146");
        assertNotNull(resp.getData());
        assertEquals("销售主管小吴", resp.getData().get("fullName"));
    }

    @Test
    void getEmployee_byNumericId_crossFactory_returnsNull() {
        User u = new User();
        u.setId(146L);
        u.setFactoryId("F002");  // wrong factory
        when(userRepository.findById(146L)).thenReturn(java.util.Optional.of(u));

        ApiResponse<Map<String, Object>> resp = controller.getEmployee("F001", "146");
        assertNull(resp.getData(), "Cross-factory access must return null, not the user");
    }

    // ===== R15: coverage for /sales-orders, /purchase-orders, /batches, /quotes =====

    /**
     * R19 audit SER-A fix: parameterized test driven by enum source. Exhaustively asserts
     * every SalesOrderStatus is correctly included/excluded per usage. R17/R18 hand-rolled
     * tests had test-data cardinality < whitelist cardinality (PARTIAL_DELIVERED missing),
     * so future drift in the whitelist Set wouldn't break the test.
     */
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(SalesOrderStatus.class)
    void findSalesOrders_invoiceable_whitelist_exhaustive(SalesOrderStatus status) {
        SalesOrder so = newSO("id-" + status, "SO-" + status, status);
        when(salesOrderRepository.findByFactoryIdOrderByCreatedAtDesc(eq("F001"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(so)));
        ApiResponse<Map<String, Object>> resp = controller.findSalesOrders("F001", "", "invoiceable", 1, 50);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) resp.getData().get("content");

        // R23 audit I3: was inline Set.of(...) re-encoding the whitelist — meaning the test
        // asserted "controller agrees with TEST PIN", not "controller agrees with central
        // OrderUsageWhitelists". Fix: import the actual constant under test.
        boolean expectedToPass = com.cretas.aims.domain.OrderUsageWhitelists.SO_INVOICEABLE.contains(status);
        assertEquals(expectedToPass ? 1 : 0, content.size(),
                "status=" + status + " should " + (expectedToPass ? "PASS" : "be excluded") + " from invoiceable whitelist");
    }

    @Test
    void findSalesOrders_plannable_includesConfirmedExcludesCompleted() {
        // R19 audit CRIT-A: production_plan.sourceOrderId needs CONFIRMED + PENDING_FINANCE_REVIEW
        // — exactly the states finance whitelist excludes. Verify ?usage=plannable does the right thing.
        SalesOrder confirmed = newSO("cf", "SO-CF", SalesOrderStatus.CONFIRMED);
        SalesOrder completed = newSO("co", "SO-CO", SalesOrderStatus.COMPLETED);
        when(salesOrderRepository.findByFactoryIdOrderByCreatedAtDesc(eq("F001"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(confirmed, completed)));
        ApiResponse<Map<String, Object>> resp = controller.findSalesOrders("F001", "", "plannable", 1, 50);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) resp.getData().get("content");

        assertEquals(1, content.size(), "plannable: CONFIRMED in, COMPLETED out");
        assertEquals("SO-CF", content.get(0).get("orderNumber"));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(PurchaseOrderStatus.class)
    void findPurchaseOrders_invoiceable_whitelist_exhaustive(PurchaseOrderStatus status) {
        PurchaseOrder po = newPO("id-" + status, "PO-" + status, status);
        when(purchaseOrderRepository.findByFactoryIdOrderByCreatedAtDesc(eq("F001"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(po)));
        ApiResponse<Map<String, Object>> resp = controller.findPurchaseOrders("F001", "", "invoiceable", 1, 50);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) resp.getData().get("content");

        // R23 audit I3: same fix as SO test above — import constant, don't pin a copy.
        boolean expectedToPass = com.cretas.aims.domain.OrderUsageWhitelists.PO_INVOICEABLE.contains(status);
        assertEquals(expectedToPass ? 1 : 0, content.size(),
                "status=" + status + " should " + (expectedToPass ? "PASS" : "be excluded") + " from invoiceable whitelist");
    }

    @Test
    void findPurchaseOrders_receivable_includesApprovedOpsOnly() {
        // R19 audit CRIT-B: inbound.purchaseOrderId allows receive-before-finance. APPROVED
        // (ops-only) should pass for ?usage=receivable. Excluded under invoiceable.
        PurchaseOrder opsApproved = newPO("o", "PO-O", PurchaseOrderStatus.APPROVED);
        PurchaseOrder finApproved = newPO("a", "PO-FA", PurchaseOrderStatus.FINANCE_APPROVED);
        when(purchaseOrderRepository.findByFactoryIdOrderByCreatedAtDesc(eq("F001"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(opsApproved, finApproved)));
        ApiResponse<Map<String, Object>> resp = controller.findPurchaseOrders("F001", "", "receivable", 1, 50);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) resp.getData().get("content");
        assertEquals(2, content.size(), "receivable: APPROVED + FINANCE_APPROVED both pass");
    }

    @Test
    void findBatches_returnsBatchNumber() {
        MaterialBatch b = new MaterialBatch();
        b.setId("b1");
        b.setBatchNumber("BATCH-001");
        when(materialBatchRepository.findByFactoryId(eq("F001"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(b)));

        ApiResponse<Map<String, Object>> resp = controller.findBatches("F001", "", 1, 50);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) resp.getData().get("content");

        assertEquals(1, content.size());
        assertEquals("BATCH-001", content.get(0).get("batchNumber"));
    }

    @Test
    void findQuotes_filtersApprovedAndNotExpired() {
        // APPROVED + future validUntil → included
        OperationalQuote ok = new OperationalQuote();
        ok.setId("q-ok");
        ok.setQuoteNo("QT-OK");
        ok.setStatus("APPROVED");
        ok.setValidUntil(java.time.LocalDate.now().plusDays(7));
        // APPROVED + expired → excluded
        OperationalQuote expired = new OperationalQuote();
        expired.setId("q-exp");
        expired.setQuoteNo("QT-EXP");
        expired.setStatus("APPROVED");
        expired.setValidUntil(java.time.LocalDate.now().minusDays(1));
        // DRAFT → excluded
        OperationalQuote draft = new OperationalQuote();
        draft.setId("q-d");
        draft.setQuoteNo("QT-D");
        draft.setStatus("DRAFT");

        when(quoteRepository.findByFactoryIdAndDeletedAtIsNullOrderByCreatedAtDesc(eq("F001"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(ok, expired, draft)));

        ApiResponse<Map<String, Object>> resp = controller.findQuotes("F001", "", 1, 50);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) resp.getData().get("content");

        assertEquals(1, content.size(), "Only APPROVED + non-expired should pass");
        assertEquals("QT-OK", content.get(0).get("quoteNo"));
    }

    private SalesOrder newSO(String id, String num, SalesOrderStatus status) {
        SalesOrder so = new SalesOrder();
        so.setId(id);
        so.setOrderNumber(num);
        so.setStatus(status);
        return so;
    }

    private PurchaseOrder newPO(String id, String num, PurchaseOrderStatus status) {
        PurchaseOrder po = new PurchaseOrder();
        po.setId(id);
        po.setOrderNumber(num);
        po.setStatus(status);
        return po;
    }
}
