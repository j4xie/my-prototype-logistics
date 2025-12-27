package com.cretas.aims.controller;

import com.cretas.aims.entity.ShipmentRecord;
import com.cretas.aims.service.ShipmentRecordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 出货记录控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/shipments")
@RequiredArgsConstructor
public class ShipmentController {

    private final ShipmentRecordService shipmentRecordService;

    /**
     * 获取出货记录列表（分页）
     */
    @GetMapping
    public ResponseEntity<?> getShipments(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        try {
            Page<ShipmentRecord> shipments;
            if (status != null && !status.isEmpty()) {
                shipments = shipmentRecordService.getByFactoryIdAndStatus(factoryId, status, page, size);
            } else {
                shipments = shipmentRecordService.getByFactoryId(factoryId, page, size);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", shipments.getContent());
            response.put("page", page);
            response.put("size", size);
            response.put("totalElements", shipments.getTotalElements());
            response.put("totalPages", shipments.getTotalPages());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("获取出货记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    // ==================== 具体路径必须在通配符 /{id} 之前 ====================

    /**
     * 按客户查询出货记录
     */
    @GetMapping("/customer/{customerId}")
    public ResponseEntity<?> getByCustomer(
            @PathVariable String factoryId,
            @PathVariable String customerId) {
        try {
            List<ShipmentRecord> shipments = shipmentRecordService.getByCustomer(factoryId, customerId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", shipments
            ));
        } catch (Exception e) {
            log.error("按客户查询出货记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 按日期范围查询
     */
    @GetMapping("/date-range")
    public ResponseEntity<?> getByDateRange(
            @PathVariable String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            List<ShipmentRecord> shipments = shipmentRecordService.getByDateRange(factoryId, startDate, endDate);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", shipments
            ));
        } catch (Exception e) {
            log.error("按日期范围查询出货记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 物流追踪查询
     */
    @GetMapping("/tracking/{trackingNumber}")
    public ResponseEntity<?> getByTrackingNumber(
            @PathVariable String factoryId,
            @PathVariable String trackingNumber) {
        try {
            return shipmentRecordService.getByTrackingNumber(trackingNumber)
                    .map(shipment -> ResponseEntity.ok(Map.of(
                        "success", true,
                        "data", shipment
                    )))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            log.error("物流追踪查询失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取出货统计
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@PathVariable String factoryId) {
        try {
            Map<String, Object> stats = new HashMap<>();
            stats.put("total", shipmentRecordService.countByFactoryId(factoryId));
            stats.put("pending", shipmentRecordService.countByStatus(factoryId, "pending"));
            stats.put("shipped", shipmentRecordService.countByStatus(factoryId, "shipped"));
            stats.put("delivered", shipmentRecordService.countByStatus(factoryId, "delivered"));
            stats.put("returned", shipmentRecordService.countByStatus(factoryId, "returned"));

            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", stats
            ));
        } catch (Exception e) {
            log.error("获取出货统计失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取最近出货记录
     */
    @GetMapping("/recent")
    public ResponseEntity<?> getRecentShipments(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "10") int limit) {
        try {
            // 获取最近N条出货记录
            Page<ShipmentRecord> shipments = shipmentRecordService.getByFactoryId(factoryId, 0, limit);

            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", shipments.getContent()
            ));
        } catch (Exception e) {
            log.error("获取最近出货记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    // ==================== 通配符路径放在最后 ====================

    /**
     * 获取单个出货记录
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getShipment(
            @PathVariable String factoryId,
            @PathVariable String id) {
        try {
            return shipmentRecordService.getById(id)
                    .map(shipment -> ResponseEntity.ok(Map.of(
                        "success", true,
                        "data", shipment
                    )))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            log.error("获取出货记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 创建出货记录
     */
    @PostMapping
    public ResponseEntity<?> createShipment(
            @PathVariable String factoryId,
            @RequestAttribute("userId") Long userId,
            @RequestBody ShipmentRecord shipment) {
        try {
            shipment.setFactoryId(factoryId);
            shipment.setRecordedBy(userId);
            ShipmentRecord created = shipmentRecordService.createShipment(shipment);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", created,
                "message", "出货记录创建成功"
            ));
        } catch (Exception e) {
            log.error("创建出货记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 更新出货记录
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateShipment(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestBody ShipmentRecord updateData) {
        try {
            ShipmentRecord updated = shipmentRecordService.updateShipment(id, updateData);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", updated,
                "message", "出货记录更新成功"
            ));
        } catch (Exception e) {
            log.error("更新出货记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 更新出货状态
     */
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        try {
            String status = body.get("status");
            ShipmentRecord updated = shipmentRecordService.updateStatus(id, status);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", updated,
                "message", "状态更新成功"
            ));
        } catch (Exception e) {
            log.error("更新出货状态失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 删除出货记录
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteShipment(
            @PathVariable String factoryId,
            @PathVariable String id) {
        try {
            shipmentRecordService.deleteShipment(id);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "出货记录删除成功"
            ));
        } catch (Exception e) {
            log.error("删除出货记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }
}
