package com.cretas.aims.entity.factory;

import com.cretas.aims.entity.factory.FactoryWarehouse.WarehouseType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * P1-4 双仓体系 schema test — FactoryWarehouse entity 存在 + WarehouseType enum 含 3 值.
 */
@DisplayName("FactoryWarehouse schema (P1-4)")
class FactoryWarehouseSchemaTest {

    @Test
    void shouldHaveFactoryIdField() {
        assertDoesNotThrow(() -> FactoryWarehouse.class.getDeclaredField("factoryId"));
    }

    @Test
    void shouldHaveCodeField() {
        assertDoesNotThrow(() -> FactoryWarehouse.class.getDeclaredField("code"));
    }

    @Test
    void shouldHaveNameField() {
        assertDoesNotThrow(() -> FactoryWarehouse.class.getDeclaredField("name"));
    }

    @Test
    void shouldHaveTypeField() {
        assertDoesNotThrow(() -> FactoryWarehouse.class.getDeclaredField("type"));
    }

    @Test
    void warehouseTypeEnum_shouldHaveThreeValues() {
        WarehouseType[] values = WarehouseType.values();
        assertEquals(3, values.length);
        assertNotNull(WarehouseType.valueOf("LOGISTICS"));
        assertNotNull(WarehouseType.valueOf("WORKSHOP"));
        assertNotNull(WarehouseType.valueOf("OTHER"));
    }
}
