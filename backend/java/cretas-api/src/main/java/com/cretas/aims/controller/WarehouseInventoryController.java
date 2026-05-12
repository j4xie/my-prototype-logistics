package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.factory.FactoryWarehouse;
import com.cretas.aims.entity.inventory.FinishedGoodsBatch;
import com.cretas.aims.exception.AuthorizationException;
import com.cretas.aims.mapper.MaterialBatchMapper;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.factory.FactoryWarehouseRepository;
import com.cretas.aims.repository.inventory.FinishedGoodsBatchRepository;
import com.cretas.aims.service.FactoryService;
import com.cretas.aims.utils.FactoryAccessValidator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Note: MaterialBatch list streamed → mapped → enriched via mapper.toDTO + peek warehouseCode/name.
// finished_goods_batches serialized direct from entity (warehouseId already on entity).

/**
 * 分仓库存查询 Controller (PR #309 B2=B, 2026-05-11 spec).
 *
 * <p>支持 Dropdown 跨工厂查询 (与 {@link FactoryNetworkController}/factories/network 联动):
 * 客户在前端选择当前用户可见的目标工厂 (default = 自身工厂), 然后按 warehouseId 过滤
 * 查询原料 (material_batches) + 成品 (finished_goods_batches) 库存。
 *
 * <p>Multi-tenancy 保护:
 * <ol>
 *   <li>path {@code factoryId} 仍然必须等于 token's factoryId (FactoryAccessValidator)
 *   <li>{@code targetFactoryId} 若与 path 不同, 必须在 {@code getAccessibleFactoryIds(path factoryId)}
 *       返回的 list 中 — 即跟 {@code /factories/network} dropdown 同一可见性集合
 *   <li>平台管理员绕过两条规则
 * </ol>
 *
 * <p>NOTE: 这不是 A5 跨工厂 sales aggregation (feature-flag gated). 这只是单工厂
 * 查询的可达性 dropdown — 用户每次只看一个工厂的库存, 不聚合多工厂。
 *
 * @author Cretas Team
 * @since 2026-05-11 (PR #309 B2)
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/inventory")
@RequiredArgsConstructor
@Tag(name = "分仓库存查询", description = "按 factoryId × warehouseId 查询库存 (PR #309 B2)")
public class WarehouseInventoryController {

    private final FactoryAccessValidator factoryAccessValidator;
    private final FactoryService factoryService;
    private final MaterialBatchRepository materialBatchRepository;
    private final FinishedGoodsBatchRepository finishedGoodsBatchRepository;
    private final FactoryWarehouseRepository factoryWarehouseRepository;
    private final MaterialBatchMapper materialBatchMapper;

    /**
     * 分仓库存查询 — 返回指定 factory × warehouse 的 material + finished-goods 批次。
     *
     * <h4>响应结构</h4>
     * <pre>
     * {
     *   "success": true,
     *   "data": {
     *     "factoryId": "F001",
     *     "warehouseId": "uuid-xx",
     *     "warehouseCode": "WH-LOG",
     *     "warehouseName": "物流仓",
     *     "materials": [ MaterialBatchDTO... ],
     *     "products":  [ FinishedGoodsBatch... ],
     *     "materialCount": 12,
     *     "productCount": 5
     *   }
     * }
     * </pre>
     *
     * @param factoryId       path — token 的 factoryId (auth check anchor)
     * @param targetFactoryId 查询的目标工厂 (默认 = path factoryId); 必须在 path factoryId 的可见网络中
     * @param warehouseId     仓库 UUID (factory_warehouses.id); 必须属于 targetFactoryId
     * @return Map: materials / products / counts
     */
    @GetMapping("/by-warehouse")
    @Operation(summary = "分仓库存查询", description = "按 (factory × warehouse) 查询 material + finished-goods 库存")
    public ApiResponse<Map<String, Object>> queryByWarehouse(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(required = false) String targetFactoryId,
            @RequestParam @NotBlank String warehouseId,
            HttpServletRequest request) {

        // P1-B fix (PR #469 §6): 移除 redundant `factoryAccessValidator.validateAccess(factoryId)` —
        // 同 BUG-2 (PR #370) 在 FactoryNetworkController 修过的根因: validator 依赖 SecurityContextHolder,
        // 但项目用 JwtAuthInterceptor 把 userId 写到 request attributes (不填 SecurityContextHolder),
        // 导致 SecurityUtils.getCurrentUserId() 返 null → AuthenticationException("用户未登录") = 401
        // 即便合法登录的 admin/warehouse 用户也被错误拒绝.
        //
        // 多租户边界已由 JwtAuthInterceptor.preHandle 强制: 跨工厂访问 403, 未登录 401.
        // 路径 factoryId 的合法性已 gate 在到达 controller 之前.

        // 1. Resolve target factory (default = path)
        String effectiveFactoryId = (targetFactoryId != null && !targetFactoryId.isBlank())
                ? targetFactoryId
                : factoryId;

        // 2. Cross-factory access check: targetFactoryId 必须在 path factoryId 的可见网络.
        //    JwtAuthInterceptor 已 gate path factoryId, 这里只校验 targetFactoryId 跳跃.
        if (!effectiveFactoryId.equals(factoryId)) {
            Long userId = readUserIdAttr(request);
            try {
                List<String> accessible = factoryService.getAccessibleFactoryIds(factoryId);
                if (accessible == null || !accessible.contains(effectiveFactoryId)) {
                    // Accessible 不含 → 仅平台管理员可豁免; 否则 403.
                    if (userId == null) {
                        log.warn("跨工厂分仓查询被拒 (无 userId attr): pathFactoryId={}, targetFactoryId={}",
                                factoryId, effectiveFactoryId);
                        throw new AuthorizationException("无权访问该工厂的库存数据");
                    }
                    try {
                        factoryAccessValidator.validateAccess(effectiveFactoryId, userId);
                    } catch (Exception ex) {
                        log.warn("跨工厂分仓查询被拒: pathFactoryId={}, targetFactoryId={}, userId={}",
                                factoryId, effectiveFactoryId, userId);
                        throw new AuthorizationException("无权访问该工厂的库存数据");
                    }
                }
            } catch (AuthorizationException ae) {
                throw ae;
            } catch (Exception e) {
                log.error("getAccessibleFactoryIds failed: factoryId={}, err={}", factoryId, e.getMessage());
                throw new AuthorizationException("无权访问该工厂的库存数据");
            }
        }

        // 4. Resolve warehouse — 必须属于 effectiveFactoryId (防止跨厂仓库 ID 注入)
        FactoryWarehouse warehouse = factoryWarehouseRepository
                .findByIdAndFactoryIdAndDeletedAtIsNull(warehouseId, effectiveFactoryId)
                .orElseThrow(() -> new AuthorizationException(
                        "仓库不存在或不属于该工厂: warehouseId=" + warehouseId + ", factoryId=" + effectiveFactoryId));

        log.info("分仓库存查询: pathFactory={}, targetFactory={}, warehouse={} ({})",
                factoryId, effectiveFactoryId, warehouse.getCode(), warehouse.getName());

        // 5. Query material batches in this warehouse — uses idx_material_batch_warehouse composite index.
        //    @Where(deleted_at IS NULL) on MaterialBatch entity already excludes soft-deleted rows.
        List<MaterialBatch> materialEntities =
                materialBatchRepository.findByFactoryIdAndWarehouseId(effectiveFactoryId, warehouseId);

        List<MaterialBatchDTO> materials = materialEntities.stream()
                .map(materialBatchMapper::toDTO)
                .peek(dto -> {
                    // 显式 fill warehouseCode + warehouseName (DTO 只有 warehouseId, 这里 enrich)
                    dto.setWarehouseCode(warehouse.getCode());
                    dto.setWarehouseName(warehouse.getName());
                })
                .collect(Collectors.toList());

        // 6. Query finished-goods batches in this warehouse — uses idx_finished_batch_warehouse composite index.
        //    @Where(deleted_at IS NULL) on FinishedGoodsBatch entity excludes soft-deleted rows.
        List<FinishedGoodsBatch> products =
                finishedGoodsBatchRepository.findByFactoryIdAndWarehouseId(effectiveFactoryId, warehouseId);

        Map<String, Object> data = new HashMap<>();
        data.put("factoryId", effectiveFactoryId);
        data.put("warehouseId", warehouseId);
        data.put("warehouseCode", warehouse.getCode());
        data.put("warehouseName", warehouse.getName());
        data.put("warehouseType", warehouse.getType() != null ? warehouse.getType().name() : null);
        data.put("materials", materials);
        data.put("products", products);
        data.put("materialCount", materials.size());
        data.put("productCount", products.size());

        return ApiResponse.success("查询成功", data);
    }

    /**
     * 获取指定工厂的仓库列表 (供前端 warehouse 下拉使用, 跨工厂场景).
     *
     * <p>NOTE: 同 {@link com.cretas.aims.controller.factory.FactoryWarehouseController}
     * 但带 cross-factory 鉴权 — 这里 path factoryId 是 token's, query targetFactoryId 是
     * 想要列的工厂。
     *
     * <p>未来 cleanup: 让 FactoryWarehouseController 也支持 targetFactoryId, 删此端点。
     */
    @GetMapping("/warehouses")
    @Operation(summary = "获取工厂仓库列表 (支持跨可见工厂)",
               description = "默认列出 path factoryId 的仓库; 若指定 targetFactoryId 且在可见网络中, 列目标工厂的仓库")
    public ApiResponse<List<FactoryWarehouse>> listWarehouses(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(required = false) String targetFactoryId,
            HttpServletRequest request) {

        // P1-B fix: 同 queryByWarehouse — JwtAuthInterceptor 已 gate path factoryId.
        String effectiveFactoryId = (targetFactoryId != null && !targetFactoryId.isBlank())
                ? targetFactoryId
                : factoryId;

        if (!effectiveFactoryId.equals(factoryId)) {
            Long userId = readUserIdAttr(request);
            try {
                List<String> accessible = factoryService.getAccessibleFactoryIds(factoryId);
                if (accessible == null || !accessible.contains(effectiveFactoryId)) {
                    if (userId == null) {
                        throw new AuthorizationException("无权访问该工厂的仓库列表");
                    }
                    try {
                        factoryAccessValidator.validateAccess(effectiveFactoryId, userId);
                    } catch (Exception ex) {
                        throw new AuthorizationException("无权访问该工厂的仓库列表");
                    }
                }
            } catch (AuthorizationException ae) {
                throw ae;
            } catch (Exception e) {
                throw new AuthorizationException("无权访问该工厂的仓库列表");
            }
        }

        List<FactoryWarehouse> list =
                factoryWarehouseRepository.findByFactoryIdAndDeletedAtIsNullOrderByCodeAsc(effectiveFactoryId);
        return ApiResponse.success("查询成功", list);
    }

    /**
     * 读取 JwtAuthInterceptor 写入的 userId attribute. 兼容 Long / Integer / String 三种类型.
     * 返回 null 表示请求未携带有效 token (理论上不可能到达此处 — interceptor 应已 401).
     */
    private Long readUserIdAttr(HttpServletRequest request) {
        Object raw = request.getAttribute("userId");
        if (raw instanceof Long l) return l;
        if (raw instanceof Integer i) return i.longValue();
        if (raw instanceof String s) {
            try { return Long.parseLong(s); } catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }
}
