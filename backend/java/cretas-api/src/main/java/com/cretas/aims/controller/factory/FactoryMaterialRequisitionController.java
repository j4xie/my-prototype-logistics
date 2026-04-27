package com.cretas.aims.controller.factory;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.entity.factory.FactoryMaterialRequisition;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.factory.FactoryMaterialRequisition.Status;
import com.cretas.aims.service.factory.FactoryMaterialRequisitionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 工厂物料需求单 Controller — P0-5 (W2-3).
 *
 * <h3>客户原话锚点</h3>
 * 会议 3124-3252s: "提交过后如果生产一个物料需求单, 根据 BOM 会生产一个物料需求单;
 * 给到仓库备料, 然后仓库把他的库存调过到工厂; 生产跑完以后...进行一个生产退料."
 *
 * <h3>状态机</h3>
 * <pre>
 *   POST /material-requisitions/generate    PENDING
 *   PUT  /{id}/start-picking                 PICKING
 *   PUT  /{id}/confirm-picking               PICKING (补填数量/批次)
 *   PUT  /{id}/transfer                      TRANSFERRED
 *   PUT  /{id}/receive                       ISSUED
 *   PUT  /{id}/close                         CLOSED (自动退料)
 *   PUT  /{id}/cancel                        CANCELLED
 * </pre>
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/material-requisitions")
@RequiredArgsConstructor
@RequireModule("production_plan")
public class FactoryMaterialRequisitionController {

    private final FactoryMaterialRequisitionService service;

    @RequirePermission({"warehouse:read_write", "production:read_write"})
    @PostMapping("/generate")
    public ResponseEntity<?> generate(
            @PathVariable String factoryId,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        String planId = (String) body.get("productionPlanId");
        FactoryMaterialRequisition mr = service.generateFromPlan(factoryId, planId, userId);
        return ResponseEntity.ok(Map.of("success", true, "data", mr, "message", "物料需求单已按 BOM 自动生成"));
    }

    @GetMapping
    public ResponseEntity<?> list(
            @PathVariable String factoryId,
            @RequestParam(required = false) Status status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pg = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<FactoryMaterialRequisition> result = service.list(factoryId, status, pg);
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> detail(@PathVariable String factoryId, @PathVariable String id) {
        return ResponseEntity.ok(Map.of("success", true, "data", service.getById(factoryId, id)));
    }

    @GetMapping("/by-plan/{planId}")
    public ResponseEntity<?> byPlan(@PathVariable String factoryId, @PathVariable String planId) {
        List<FactoryMaterialRequisition> list = service.listByPlan(factoryId, planId);
        return ResponseEntity.ok(Map.of("success", true, "data", list));
    }

    @RequirePermission({"warehouse:read_write", "production:read_write"})
    @PutMapping("/{id}/start-picking")
    public ResponseEntity<?> startPicking(
            @PathVariable String factoryId, @PathVariable String id,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(Map.of("success", true, "data", service.startPicking(factoryId, id, userId)));
    }

    @RequirePermission({"warehouse:read_write", "production:read_write"})
    @PutMapping("/{id}/confirm-picking")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> confirmPicking(
            @PathVariable String factoryId, @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        return ResponseEntity.ok(Map.of("success", true, "data", service.confirmPicking(factoryId, id, userId, items)));
    }

    @RequirePermission({"warehouse:read_write", "production:read_write"})
    @PutMapping("/{id}/transfer")
    public ResponseEntity<?> transfer(
            @PathVariable String factoryId, @PathVariable String id,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(Map.of("success", true, "data", service.transferToFactory(factoryId, id, userId)));
    }

    @RequirePermission({"warehouse:read_write", "production:read_write"})
    @PutMapping("/{id}/receive")
    public ResponseEntity<?> receive(
            @PathVariable String factoryId, @PathVariable String id,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(Map.of("success", true, "data", service.receive(factoryId, id, userId)));
    }

    @RequirePermission({"warehouse:read_write", "production:read_write"})
    @PutMapping("/{id}/close")
    public ResponseEntity<?> close(
            @PathVariable String factoryId, @PathVariable String id,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(Map.of("success", true, "data", service.close(factoryId, id, userId), "message", "已关单, 退料已按 issued-consumed 自动计算"));
    }

    @RequirePermission({"warehouse:read_write", "production:read_write"})
    @PutMapping("/{id}/cancel")
    public ResponseEntity<?> cancel(
            @PathVariable String factoryId, @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        String reason = (String) body.getOrDefault("reason", "");
        return ResponseEntity.ok(Map.of("success", true, "data", service.cancel(factoryId, id, userId, reason)));
    }
}
