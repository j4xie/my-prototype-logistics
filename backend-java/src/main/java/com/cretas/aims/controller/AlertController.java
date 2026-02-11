package com.cretas.aims.controller;

import com.cretas.aims.entity.ProductionAlert;
import com.cretas.aims.repository.ProductionAlertRepository;
import com.cretas.aims.service.AnomalyDetectionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 生产告警控制器
 * 提供告警的查询、确认、解决和手动检测功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/alerts")
public class AlertController {

    private static final Logger log = LoggerFactory.getLogger(AlertController.class);

    @Autowired
    private ProductionAlertRepository alertRepository;

    @Autowired(required = false)
    private AnomalyDetectionService anomalyDetectionService;

    // GET /alerts - paginated list with filters
    @GetMapping
    public ResponseEntity<?> getAlerts(
            @PathVariable String factoryId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String level,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<ProductionAlert> alerts;
            PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

            if (status != null && level != null) {
                alerts = alertRepository.findByFactoryIdAndStatusAndLevel(factoryId, status, level, pageRequest);
            } else if (status != null) {
                alerts = alertRepository.findByFactoryIdAndStatus(factoryId, status, pageRequest);
            } else if (level != null) {
                alerts = alertRepository.findByFactoryIdAndLevel(factoryId, level, pageRequest);
            } else {
                alerts = alertRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageRequest);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", Map.of(
                "content", alerts.getContent(),
                "totalElements", alerts.getTotalElements(),
                "totalPages", alerts.getTotalPages(),
                "number", alerts.getNumber()
            ));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to get alerts for factory {}", factoryId, e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // GET /alerts/summary - dashboard summary
    @GetMapping("/summary")
    public ResponseEntity<?> getAlertSummary(@PathVariable String factoryId) {
        try {
            if (anomalyDetectionService == null) {
                return ResponseEntity.ok(Map.of("success", false, "message", "AnomalyDetectionService not available"));
            }
            Map<String, Object> summary = anomalyDetectionService.getAlertSummary(factoryId);
            return ResponseEntity.ok(Map.of("success", true, "data", summary));
        } catch (Exception e) {
            log.error("Failed to get alert summary for factory {}", factoryId, e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // GET /alerts/{id} - single alert detail
    @GetMapping("/{alertId}")
    public ResponseEntity<?> getAlertDetail(@PathVariable String factoryId, @PathVariable Long alertId) {
        try {
            Optional<ProductionAlert> alert = alertRepository.findById(alertId);
            if (alert.isEmpty() || !alert.get().getFactoryId().equals(factoryId)) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(Map.of("success", true, "data", alert.get()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // PUT /alerts/{id}/acknowledge
    @PutMapping("/{alertId}/acknowledge")
    public ResponseEntity<?> acknowledgeAlert(
            @PathVariable String factoryId, @PathVariable Long alertId,
            @RequestParam Long userId) {
        try {
            Optional<ProductionAlert> opt = alertRepository.findById(alertId);
            if (opt.isEmpty() || !opt.get().getFactoryId().equals(factoryId)) {
                return ResponseEntity.notFound().build();
            }
            ProductionAlert alert = opt.get();
            if (!"ACTIVE".equals(alert.getStatus())) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Alert is not in ACTIVE status"));
            }
            alert.setStatus("ACKNOWLEDGED");
            alert.setAcknowledgedBy(userId);
            alert.setAcknowledgedAt(LocalDateTime.now());
            alertRepository.save(alert);
            return ResponseEntity.ok(Map.of("success", true, "data", alert));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // PUT /alerts/{id}/resolve
    @PutMapping("/{alertId}/resolve")
    public ResponseEntity<?> resolveAlert(
            @PathVariable String factoryId, @PathVariable Long alertId,
            @RequestParam Long userId, @RequestBody(required = false) Map<String, String> body) {
        try {
            Optional<ProductionAlert> opt = alertRepository.findById(alertId);
            if (opt.isEmpty() || !opt.get().getFactoryId().equals(factoryId)) {
                return ResponseEntity.notFound().build();
            }
            ProductionAlert alert = opt.get();
            if (!"ACTIVE".equals(alert.getStatus()) && !"ACKNOWLEDGED".equals(alert.getStatus())) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Alert must be ACTIVE or ACKNOWLEDGED to resolve"));
            }
            alert.setStatus("RESOLVED");
            alert.setResolvedBy(userId);
            alert.setResolvedAt(LocalDateTime.now());
            if (body != null && body.containsKey("resolutionNotes")) {
                alert.setResolutionNotes(body.get("resolutionNotes"));
            }
            alertRepository.save(alert);
            return ResponseEntity.ok(Map.of("success", true, "data", alert));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // POST /alerts/detect - manually trigger detection
    @PostMapping("/detect")
    public ResponseEntity<?> triggerDetection(@PathVariable String factoryId) {
        try {
            if (anomalyDetectionService == null) {
                return ResponseEntity.ok(Map.of("success", false, "message", "AnomalyDetectionService not available"));
            }
            int count = anomalyDetectionService.detectAnomalies(factoryId);
            return ResponseEntity.ok(Map.of("success", true, "data", Map.of("newAlerts", count)));
        } catch (Exception e) {
            log.error("Manual detection failed for factory {}", factoryId, e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}
