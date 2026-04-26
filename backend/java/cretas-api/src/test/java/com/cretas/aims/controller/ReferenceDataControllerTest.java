package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.Customer;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.entity.Supplier;
import com.cretas.aims.entity.User;
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
}
