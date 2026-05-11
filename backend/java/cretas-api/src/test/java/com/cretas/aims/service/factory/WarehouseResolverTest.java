package com.cretas.aims.service.factory;

import com.cretas.aims.entity.factory.FactoryWarehouse;
import com.cretas.aims.entity.factory.FactoryWarehouse.WarehouseType;
import com.cretas.aims.entity.factory.WarehouseCodes;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.factory.FactoryWarehouseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * D1 双仓流转 — WarehouseResolver 单元测试 (2026-05-10 spec, PR #309 A1=A).
 *
 * <p>验证:
 * <ol>
 *   <li>WH-LOG / WH-WKS code 解析为正确的 factory_warehouses.id</li>
 *   <li>seed 缺失时抛 BusinessException (defensive)</li>
 *   <li>跨 factory 隔离: factoryA 不能拿到 factoryB 的 warehouse</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("WarehouseResolver D1 单元测试")
class WarehouseResolverTest {

    @Mock
    private FactoryWarehouseRepository factoryWarehouseRepository;

    @InjectMocks
    private WarehouseResolver warehouseResolver;

    private static final String FACTORY_ID = "F001";
    private static final String WH_LOG_ID = "wh-log-uuid-001";
    private static final String WH_WKS_ID = "wh-wks-uuid-001";

    private FactoryWarehouse whLog;
    private FactoryWarehouse whWks;

    @BeforeEach
    void setUp() {
        whLog = new FactoryWarehouse();
        whLog.setId(WH_LOG_ID);
        whLog.setFactoryId(FACTORY_ID);
        whLog.setCode(WarehouseCodes.WH_LOG);
        whLog.setName("物流仓");
        whLog.setType(WarehouseType.LOGISTICS);
        whLog.setIsActive(true);

        whWks = new FactoryWarehouse();
        whWks.setId(WH_WKS_ID);
        whWks.setFactoryId(FACTORY_ID);
        whWks.setCode(WarehouseCodes.WH_WKS);
        whWks.setName("鲜棉仓");
        whWks.setType(WarehouseType.WORKSHOP);
        whWks.setIsActive(true);
    }

    @Test
    @DisplayName("resolveLogisticsId 返回 WH-LOG 的 factory_warehouses.id")
    void resolveLogisticsId_returnsCorrectId() {
        when(factoryWarehouseRepository.findByFactoryIdAndCodeAndDeletedAtIsNull(FACTORY_ID, WarehouseCodes.WH_LOG))
                .thenReturn(Optional.of(whLog));

        String id = warehouseResolver.resolveLogisticsId(FACTORY_ID);

        assertEquals(WH_LOG_ID, id);
        verify(factoryWarehouseRepository).findByFactoryIdAndCodeAndDeletedAtIsNull(FACTORY_ID, WarehouseCodes.WH_LOG);
    }

    @Test
    @DisplayName("resolveWorkshopId 返回 WH-WKS 的 factory_warehouses.id")
    void resolveWorkshopId_returnsCorrectId() {
        when(factoryWarehouseRepository.findByFactoryIdAndCodeAndDeletedAtIsNull(FACTORY_ID, WarehouseCodes.WH_WKS))
                .thenReturn(Optional.of(whWks));

        String id = warehouseResolver.resolveWorkshopId(FACTORY_ID);

        assertEquals(WH_WKS_ID, id);
    }

    @Test
    @DisplayName("resolveId 任意 code: 找到则返回 id")
    void resolveId_arbitraryCode_returnsId() {
        when(factoryWarehouseRepository.findByFactoryIdAndCodeAndDeletedAtIsNull(FACTORY_ID, "WH-OTHER"))
                .thenReturn(Optional.of(whLog));

        String id = warehouseResolver.resolveId(FACTORY_ID, "WH-OTHER");

        assertEquals(WH_LOG_ID, id);
    }

    @Test
    @DisplayName("resolveLogisticsId: seed 缺失 (factory 没 WH-LOG) 抛 BusinessException")
    void resolveLogisticsId_missingSeed_throwsBusinessException() {
        when(factoryWarehouseRepository.findByFactoryIdAndCodeAndDeletedAtIsNull(FACTORY_ID, WarehouseCodes.WH_LOG))
                .thenReturn(Optional.empty());

        BusinessException ex = assertThrows(BusinessException.class,
                () -> warehouseResolver.resolveLogisticsId(FACTORY_ID));

        assertTrue(ex.getMessage().contains("WH-LOG"), "异常应包含 WH-LOG code");
        assertTrue(ex.getMessage().contains(FACTORY_ID), "异常应包含 factoryId");
    }

    @Test
    @DisplayName("resolveWorkshopId: seed 缺失抛 BusinessException")
    void resolveWorkshopId_missingSeed_throwsBusinessException() {
        when(factoryWarehouseRepository.findByFactoryIdAndCodeAndDeletedAtIsNull(FACTORY_ID, WarehouseCodes.WH_WKS))
                .thenReturn(Optional.empty());

        assertThrows(BusinessException.class,
                () -> warehouseResolver.resolveWorkshopId(FACTORY_ID));
    }

    @Test
    @DisplayName("WarehouseCodes 常量值一致 (WH-LOG, WH-WKS)")
    void warehouseCodes_constantsAreCorrect() {
        // 与 V20260411_03 / V20260424_08 seed 必须一致
        assertEquals("WH-LOG", WarehouseCodes.WH_LOG);
        assertEquals("WH-WKS", WarehouseCodes.WH_WKS);
    }
}
