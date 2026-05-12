package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.factory.FactoryWarehouse;
import com.cretas.aims.entity.factory.FactoryWarehouse.WarehouseType;
import com.cretas.aims.exception.AuthorizationException;
import com.cretas.aims.mapper.MaterialBatchMapper;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.factory.FactoryWarehouseRepository;
import com.cretas.aims.repository.inventory.FinishedGoodsBatchRepository;
import com.cretas.aims.service.FactoryService;
import com.cretas.aims.utils.FactoryAccessValidator;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * P1-B (PR #469 §6, this PR fixes): regression test that {@code /api/mobile/{factoryId}/inventory/by-warehouse}
 * no longer throws {@code AuthenticationException("用户未登录")} = 401 for legitimately
 * authenticated users.
 *
 * <p>Same root cause as BUG-2 in {@link FactoryNetworkControllerTest} (PR #370):
 * {@link com.cretas.aims.utils.SecurityUtils#getCurrentUserId()} reads from
 * {@code SecurityContextHolder}, but this project authenticates via
 * {@link com.cretas.aims.config.JwtAuthInterceptor} which writes
 * {@code userId} into request attributes only. The original PR #309 B2 controller
 * called {@code factoryAccessValidator.validateAccess(factoryId)} which transitively
 * called {@code SecurityUtils.getCurrentUserId()} → null → 401 for every caller.
 *
 * <p>Fix: rely on {@code JwtAuthInterceptor} for the path factoryId check (it already
 * gates 401/403), and read userId from the request attribute when the cross-factory
 * platform-admin fallback is needed.
 */
@DisplayName("P1-B: WarehouseInventoryController 不再因 SecurityContext 空抛 401")
@ExtendWith(MockitoExtension.class)
class WarehouseInventoryControllerTest {

    @Mock private FactoryAccessValidator factoryAccessValidator;
    @Mock private FactoryService factoryService;
    @Mock private MaterialBatchRepository materialBatchRepository;
    @Mock private FinishedGoodsBatchRepository finishedGoodsBatchRepository;
    @Mock private FactoryWarehouseRepository factoryWarehouseRepository;
    @Mock private MaterialBatchMapper materialBatchMapper;
    @Mock private HttpServletRequest request;

    private WarehouseInventoryController controller;

    @BeforeEach
    void setUp() {
        controller = new WarehouseInventoryController(
                factoryAccessValidator,
                factoryService,
                materialBatchRepository,
                finishedGoodsBatchRepository,
                factoryWarehouseRepository,
                materialBatchMapper);
    }

    @Test
    @DisplayName("queryByWarehouse: 同工厂访问 (path=F001, no targetFactoryId) → 200, 不抛 401")
    void queryByWarehouse_sameFactory_returnsOkWithoutAuthError() {
        String factoryId = "F001";
        String warehouseId = "wh-uuid-1";

        FactoryWarehouse wh = new FactoryWarehouse();
        wh.setId(warehouseId);
        wh.setFactoryId(factoryId);
        wh.setCode("WH-LOG");
        wh.setName("物流仓");
        wh.setType(WarehouseType.LOGISTICS);

        when(factoryWarehouseRepository
                .findByIdAndFactoryIdAndDeletedAtIsNull(eq(warehouseId), eq(factoryId)))
                .thenReturn(Optional.of(wh));
        when(materialBatchRepository.findByFactoryIdAndWarehouseId(eq(factoryId), eq(warehouseId)))
                .thenReturn(Collections.<MaterialBatch>emptyList());
        when(finishedGoodsBatchRepository.findByFactoryIdAndWarehouseId(eq(factoryId), eq(warehouseId)))
                .thenReturn(Collections.emptyList());

        ApiResponse<Map<String, Object>> resp =
                controller.queryByWarehouse(factoryId, null, warehouseId, request);

        assertNotNull(resp);
        assertEquals(Boolean.TRUE, resp.getSuccess(),
                "合法登录用户访问自己工厂的 by-warehouse 应该 success=true, 不应 401");
        Map<String, Object> data = resp.getData();
        assertNotNull(data);
        assertEquals(factoryId, data.get("factoryId"));
        assertEquals(warehouseId, data.get("warehouseId"));
        assertEquals("WH-LOG", data.get("warehouseCode"));
        assertEquals(0, data.get("materialCount"));
        assertEquals(0, data.get("productCount"));
    }

    @Test
    @DisplayName("queryByWarehouse: warehouse 不属于 factory → 403 AuthorizationException (业务规则, 非 401)")
    void queryByWarehouse_warehouseNotInFactory_throwsAuthorization() {
        String factoryId = "F001";
        String warehouseId = "wh-uuid-bad";

        when(factoryWarehouseRepository
                .findByIdAndFactoryIdAndDeletedAtIsNull(eq(warehouseId), eq(factoryId)))
                .thenReturn(Optional.empty());

        assertThrows(AuthorizationException.class,
                () -> controller.queryByWarehouse(factoryId, null, warehouseId, request));
    }

    @Test
    @DisplayName("queryByWarehouse: 跨工厂查询走 accessible 列表 (无需 SecurityContext)")
    void queryByWarehouse_crossFactory_usesAccessibleList() {
        String pathFactory = "F001";
        String targetFactory = "F002";
        String warehouseId = "wh-uuid-f002";

        // F002 在 F001 的可见网络中 (parent-child 等) → 允许跨工厂查询
        when(factoryService.getAccessibleFactoryIds(eq(pathFactory)))
                .thenReturn(List.of(pathFactory, targetFactory));

        FactoryWarehouse wh = new FactoryWarehouse();
        wh.setId(warehouseId);
        wh.setFactoryId(targetFactory);
        wh.setCode("WH-WKS");
        wh.setName("线边仓 F002");
        wh.setType(WarehouseType.WORKSHOP);

        when(factoryWarehouseRepository
                .findByIdAndFactoryIdAndDeletedAtIsNull(eq(warehouseId), eq(targetFactory)))
                .thenReturn(Optional.of(wh));
        when(materialBatchRepository.findByFactoryIdAndWarehouseId(eq(targetFactory), eq(warehouseId)))
                .thenReturn(Collections.<MaterialBatch>emptyList());
        when(finishedGoodsBatchRepository.findByFactoryIdAndWarehouseId(eq(targetFactory), eq(warehouseId)))
                .thenReturn(Collections.emptyList());

        ApiResponse<Map<String, Object>> resp =
                controller.queryByWarehouse(pathFactory, targetFactory, warehouseId, request);

        assertEquals(Boolean.TRUE, resp.getSuccess());
        assertEquals(targetFactory, resp.getData().get("factoryId"));
    }

    @Test
    @DisplayName("queryByWarehouse: 跨工厂目标不在 accessible 网络 → AuthorizationException (403, 不是 401)")
    void queryByWarehouse_crossFactoryNotAccessible_throwsAuthorization() {
        String pathFactory = "F001";
        String targetFactory = "F999"; // not in network
        String warehouseId = "wh-uuid";

        // accessible 不含 F999, 且 request attribute 没有 userId → 不应回退到 SecurityUtils 抛 "用户未登录" 401,
        // 而应明确返回 AuthorizationException (403).
        when(factoryService.getAccessibleFactoryIds(eq(pathFactory)))
                .thenReturn(List.of(pathFactory));
        lenient().when(request.getAttribute("userId")).thenReturn(null);

        AuthorizationException ex = assertThrows(AuthorizationException.class,
                () -> controller.queryByWarehouse(pathFactory, targetFactory, warehouseId, request));
        assertTrue(ex.getMessage().contains("无权"),
                "应为 403 业务级拒绝, 不是 401 '用户未登录'");
    }

    @Test
    @DisplayName("listWarehouses: 同工厂访问 → 200, 不抛 401")
    void listWarehouses_sameFactory_returnsOkWithoutAuthError() {
        String factoryId = "F001";
        FactoryWarehouse wh = new FactoryWarehouse();
        wh.setId("wh-1");
        wh.setFactoryId(factoryId);
        wh.setCode("WH-LOG");

        when(factoryWarehouseRepository
                .findByFactoryIdAndDeletedAtIsNullOrderByCodeAsc(eq(factoryId)))
                .thenReturn(List.of(wh));

        ApiResponse<List<FactoryWarehouse>> resp =
                controller.listWarehouses(factoryId, null, request);

        assertEquals(Boolean.TRUE, resp.getSuccess());
        assertEquals(1, resp.getData().size());
        assertEquals("WH-LOG", resp.getData().get(0).getCode());
    }
}
