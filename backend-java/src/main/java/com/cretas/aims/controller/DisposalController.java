package com.cretas.aims.controller;

import com.cretas.aims.entity.DisposalRecord;
import com.cretas.aims.service.DisposalRecordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 报废记录控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/disposal-records")
@RequiredArgsConstructor
public class DisposalController {

    private final DisposalRecordService disposalRecordService;

    /**
     * 获取报废记录列表（分页）
     */
    @GetMapping
    public ResponseEntity<?> getDisposalRecords(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String type) {
        try {
            Page<DisposalRecord> records;
            if (type != null && !type.isEmpty()) {
                records = disposalRecordService.getByFactoryIdAndType(factoryId, type, page, size);
            } else {
                records = disposalRecordService.getByFactoryId(factoryId, page, size);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", records.getContent());
            response.put("page", page);
            response.put("size", size);
            response.put("totalElements", records.getTotalElements());
            response.put("totalPages", records.getTotalPages());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("获取报废记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取单个报废记录
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getDisposalRecord(
            @PathVariable String factoryId,
            @PathVariable Long id) {
        try {
            return disposalRecordService.getById(id)
                    .map(record -> ResponseEntity.ok(Map.of(
                        "success", true,
                        "data", record
                    )))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            log.error("获取报废记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 创建报废记录
     */
    @PostMapping
    public ResponseEntity<?> createDisposalRecord(
            @PathVariable String factoryId,
            @RequestBody DisposalRecord record) {
        try {
            record.setFactoryId(factoryId);
            DisposalRecord created = disposalRecordService.createDisposalRecord(record);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", created,
                "message", "报废记录创建成功"
            ));
        } catch (Exception e) {
            log.error("创建报废记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 更新报废记录
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateDisposalRecord(
            @PathVariable String factoryId,
            @PathVariable Long id,
            @RequestBody DisposalRecord updateData) {
        try {
            DisposalRecord updated = disposalRecordService.updateDisposalRecord(id, updateData);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", updated,
                "message", "报废记录更新成功"
            ));
        } catch (IllegalStateException e) {
            log.warn("更新报废记录被拒绝: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("更新报废记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 审批报废记录
     */
    @PutMapping("/{id}/approve")
    public ResponseEntity<?> approveDisposal(
            @PathVariable String factoryId,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        try {
            Integer approverId = (Integer) body.get("approverId");
            String approverName = (String) body.get("approverName");

            DisposalRecord approved = disposalRecordService.approveDisposal(id, approverId, approverName);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", approved,
                "message", "报废记录审批成功"
            ));
        } catch (Exception e) {
            log.error("审批报废记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 删除报废记录
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDisposalRecord(
            @PathVariable String factoryId,
            @PathVariable Long id) {
        try {
            disposalRecordService.deleteDisposalRecord(id);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "报废记录删除成功"
            ));
        } catch (IllegalStateException e) {
            log.warn("删除报废记录被拒绝: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("删除报废记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取待审批的报废记录
     */
    @GetMapping("/pending")
    public ResponseEntity<?> getPendingApprovals(@PathVariable String factoryId) {
        try {
            List<DisposalRecord> pending = disposalRecordService.getPendingApprovals(factoryId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", pending
            ));
        } catch (Exception e) {
            log.error("获取待审批报废记录失败", e);
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
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        try {
            List<DisposalRecord> records = disposalRecordService.getByDateRange(factoryId, startDate, endDate);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", records
            ));
        } catch (Exception e) {
            log.error("按日期范围查询报废记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取报废统计
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(
            @PathVariable String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        try {
            Map<String, Object> stats = disposalRecordService.getDisposalStats(factoryId, startDate, endDate);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", stats
            ));
        } catch (Exception e) {
            log.error("获取报废统计失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 按类型统计
     */
    @GetMapping("/stats/by-type")
    public ResponseEntity<?> getStatsByType(
            @PathVariable String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        try {
            List<Object[]> stats = disposalRecordService.getStatsByType(factoryId, startDate, endDate);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", stats
            ));
        } catch (Exception e) {
            log.error("按类型统计报废记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取可回收报废记录
     */
    @GetMapping("/recyclable")
    public ResponseEntity<?> getRecyclableDisposals(@PathVariable String factoryId) {
        try {
            List<DisposalRecord> recyclable = disposalRecordService.getRecyclableDisposals(factoryId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", recyclable
            ));
        } catch (Exception e) {
            log.error("获取可回收报废记录失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }
}
