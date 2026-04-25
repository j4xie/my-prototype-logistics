package com.cretas.aims.service.inventory;

import com.cretas.aims.entity.User;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.inventory.impl.SalesServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SalesServiceImplSalespersonTest {

    @Mock UserRepository userRepository;
    @InjectMocks SalesServiceImpl salesService;

    @Test
    void resolveSalesperson_numericUserId_setsBothColumns() {
        User user = new User();
        user.setId(1309L);
        user.setFullName("张六膳");
        user.setFactoryId("F006");
        when(userRepository.findById(1309L)).thenReturn(Optional.of(user));

        SalesOrder order = new SalesOrder();
        salesService.resolveSalespersonField(order, "1309", "F006");

        // R6 (V20260425_09): salespersonId is now BIGINT/Long, was String previously.
        assertEquals(1309L, order.getSalespersonId());
        assertEquals("张六膳", order.getSalesperson());
    }

    @Test
    void resolveSalesperson_userBelongsToOtherFactory_throws() {
        User user = new User();
        user.setId(1309L);
        user.setFullName("张六膳");
        user.setFactoryId("F001");  // different factory
        when(userRepository.findById(1309L)).thenReturn(Optional.of(user));

        SalesOrder order = new SalesOrder();
        assertThrows(ResourceNotFoundException.class,
            () -> salesService.resolveSalespersonField(order, "1309", "F006"));
    }

    @Test
    void resolveSalesperson_nameString_setsOnlyName() {
        SalesOrder order = new SalesOrder();
        salesService.resolveSalespersonField(order, "李四", "F006");

        assertNull(order.getSalespersonId());
        assertEquals("李四", order.getSalesperson());
    }

    @Test
    void resolveSalesperson_nullInput_noChange() {
        SalesOrder order = new SalesOrder();
        order.setSalesperson("existing");
        salesService.resolveSalespersonField(order, null, "F006");

        assertNull(order.getSalespersonId());
        assertEquals("existing", order.getSalesperson());
    }

    @Test
    void resolveSalesperson_blankInput_noChange() {
        SalesOrder order = new SalesOrder();
        salesService.resolveSalespersonField(order, "  ", "F006");

        assertNull(order.getSalespersonId());
        assertNull(order.getSalesperson());
    }
}
