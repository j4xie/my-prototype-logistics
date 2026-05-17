package com.cretas.aims.controller;

import com.cretas.aims.security.RequirePermission;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.repository.inventory.PurchaseOrderRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;

/**
 * U-MARKER-1 (Sprint 4 Wave 2 Chat L) — row marker color PATCH endpoint.
 *
 * Generic endpoint: PATCH /api/mobile/{factoryId}/markers/{entity}/{id}
 *   Body: { "color": "red" | "orange" | "yellow" | "green" | "blue" | null }
 *
 * Supported entities: sales-order, purchase-order. Customer marker deferred
 * to follow-up (Customer entity not yet updated in PR 4 to keep scope tight).
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/markers")
@RequiredArgsConstructor
public class RowMarkerController {

    private static final Set<String> VALID_COLORS = Set.of("red", "orange", "yellow", "green", "blue");

    private final SalesOrderRepository salesOrderRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;

    public record MarkerRequest(@Pattern(regexp = "^(red|orange|yellow|green|blue)?$") String color) {}

    @PatchMapping("/sales-order/{id}")
    @RequirePermission("sales:edit")
    public ResponseEntity<Map<String, Object>> setSalesOrderMarker(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestBody MarkerRequest body
    ) {
        validateColor(body.color());
        SalesOrder so = salesOrderRepository.findById(id).orElseThrow(
                () -> new IllegalArgumentException("Sales order not found: " + id));
        if (!factoryId.equals(so.getFactoryId())) {
            return ResponseEntity.status(403).body(Map.of(
                    "success", false,
                    "message", "factoryId mismatch"
            ));
        }
        so.setMarkerColor(body.color());
        salesOrderRepository.save(so);
        log.info("Set sales-order {} marker={} (factory={})", id, body.color(), factoryId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of("id", id, "markerColor", body.color() == null ? "" : body.color())
        ));
    }

    @PatchMapping("/purchase-order/{id}")
    @RequirePermission("purchase:edit")
    public ResponseEntity<Map<String, Object>> setPurchaseOrderMarker(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestBody MarkerRequest body
    ) {
        validateColor(body.color());
        PurchaseOrder po = purchaseOrderRepository.findById(id).orElseThrow(
                () -> new IllegalArgumentException("Purchase order not found: " + id));
        if (!factoryId.equals(po.getFactoryId())) {
            return ResponseEntity.status(403).body(Map.of(
                    "success", false,
                    "message", "factoryId mismatch"
            ));
        }
        po.setMarkerColor(body.color());
        purchaseOrderRepository.save(po);
        log.info("Set purchase-order {} marker={} (factory={})", id, body.color(), factoryId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of("id", id, "markerColor", body.color() == null ? "" : body.color())
        ));
    }

    private static void validateColor(String color) {
        if (color != null && !color.isEmpty() && !VALID_COLORS.contains(color)) {
            throw new IllegalArgumentException("Invalid marker color: " + color
                    + " (allowed: red, orange, yellow, green, blue, or null)");
        }
    }
}
