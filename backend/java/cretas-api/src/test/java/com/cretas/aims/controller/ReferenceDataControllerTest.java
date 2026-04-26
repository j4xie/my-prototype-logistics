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
        controller.findProducts("F001", "", 1, 50);
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

    @Test
    void findSalesOrders_whitelistOnlyPostFinanceApproved() {
        // R17 audit CRIT-1 fix: whitelist (FINANCE_APPROVED + PROCESSING + PARTIAL_DELIVERED
        // + COMPLETED). Pre-finance states (CONFIRMED, PENDING_FINANCE_REVIEW) bypass the
        // dual-control gate if invoiceable, so they must be excluded.
        SalesOrder draft = newSO("d1", "SO-D", SalesOrderStatus.DRAFT);
        SalesOrder cancelled = newSO("c1", "SO-C", SalesOrderStatus.CANCELLED);
        SalesOrder rejected = newSO("r1", "SO-R", SalesOrderStatus.FINANCE_REJECTED);
        SalesOrder confirmed = newSO("cf1", "SO-CF", SalesOrderStatus.CONFIRMED);          // pre-finance — excluded
        SalesOrder pendingFin = newSO("pf1", "SO-PF", SalesOrderStatus.PENDING_FINANCE_REVIEW);  // pre-finance — excluded
        SalesOrder approved = newSO("a1", "SO-A", SalesOrderStatus.FINANCE_APPROVED);
        SalesOrder processing = newSO("p1", "SO-P", SalesOrderStatus.PROCESSING);
        SalesOrder completed = newSO("co1", "SO-CO", SalesOrderStatus.COMPLETED);

        when(salesOrderRepository.findByFactoryIdOrderByCreatedAtDesc(eq("F001"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(draft, cancelled, rejected, confirmed, pendingFin, approved, processing, completed)));

        ApiResponse<Map<String, Object>> resp = controller.findSalesOrders("F001", "", 1, 50);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) resp.getData().get("content");

        assertEquals(3, content.size(), "Only FINANCE_APPROVED + PROCESSING + COMPLETED should pass (whitelist)");
        java.util.Set<String> orderNums = content.stream()
                .map(m -> (String) m.get("orderNumber")).collect(java.util.stream.Collectors.toSet());
        assertTrue(orderNums.contains("SO-A"));
        assertTrue(orderNums.contains("SO-P"));
        assertTrue(orderNums.contains("SO-CO"));
        assertFalse(orderNums.contains("SO-CF"), "CONFIRMED bypasses finance review — excluded");
        assertFalse(orderNums.contains("SO-PF"), "PENDING_FINANCE_REVIEW pre-finance — excluded");
    }

    @Test
    void findPurchaseOrders_whitelistOnlyPostFinanceApproved() {
        // R17 audit CRIT-1: PO whitelist is FINANCE_APPROVED + PARTIAL_RECEIVED + COMPLETED + CLOSED.
        // APPROVED (operations-only) and SUBMITTED are pre-finance — excluded.
        PurchaseOrder draft = newPO("d1", "PO-D", PurchaseOrderStatus.DRAFT);
        PurchaseOrder cancelled = newPO("c1", "PO-C", PurchaseOrderStatus.CANCELLED);
        PurchaseOrder rejected = newPO("r1", "PO-R", PurchaseOrderStatus.FINANCE_REJECTED);
        PurchaseOrder opsApproved = newPO("o1", "PO-O", PurchaseOrderStatus.APPROVED);    // ops-only — excluded
        PurchaseOrder submitted = newPO("s1", "PO-S", PurchaseOrderStatus.SUBMITTED);      // pre-approval — excluded
        PurchaseOrder finApproved = newPO("a1", "PO-FA", PurchaseOrderStatus.FINANCE_APPROVED);
        PurchaseOrder partial = newPO("p1", "PO-P", PurchaseOrderStatus.PARTIAL_RECEIVED);
        PurchaseOrder completed = newPO("co1", "PO-CO", PurchaseOrderStatus.COMPLETED);

        when(purchaseOrderRepository.findByFactoryIdOrderByCreatedAtDesc(eq("F001"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(draft, cancelled, rejected, opsApproved, submitted, finApproved, partial, completed)));

        ApiResponse<Map<String, Object>> resp = controller.findPurchaseOrders("F001", "", 1, 50);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) resp.getData().get("content");

        assertEquals(3, content.size(), "Only post-finance-approved POs should pass (whitelist)");
        java.util.Set<String> poNums = content.stream()
                .map(m -> (String) m.get("poNumber")).collect(java.util.stream.Collectors.toSet());
        assertTrue(poNums.contains("PO-FA"));
        assertTrue(poNums.contains("PO-P"));
        assertTrue(poNums.contains("PO-CO"));
        assertFalse(poNums.contains("PO-O"), "APPROVED is ops-only, pre-finance — excluded (R17 audit CRIT-1)");
        assertFalse(poNums.contains("PO-S"), "SUBMITTED is pre-approval — excluded");
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
