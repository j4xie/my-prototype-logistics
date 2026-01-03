package com.cretas.aims.controller;

import com.cretas.aims.entity.DisposalRecord;
import com.cretas.aims.service.DisposalRecordService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "报废管理", description = "报废记录管理相关接口，包括报废记录的创建、查询、审批、统计分析等功能，支持按类型（原材料/产品/设备）分类管理")
public class DisposalController {

    private final DisposalRecordService disposalRecordService;

    /**
     * 获取报废记录列表（分页）
     */
    @GetMapping
    @Operation(summary = "获取报废记录列表", description = "分页查询指定工厂的报废记录，支持按类型筛选。返回分页信息和报废记录列表")
    public ResponseEntity<?> getDisposalRecords(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @RequestParam(defaultValue = "0") @Parameter(description = "页码（0-based）", example = "0") int page,
            @RequestParam(defaultValue = "10") @Parameter(description = "每页大小", example = "10") int size,
            @RequestParam(required = false) @Parameter(description = "报废类型过滤：material（原材料）/product（产品）/equipment（设备）", example = "material") String type) {
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
    @Operation(summary = "获取报废记录详情", description = "根据ID获取单个报废记录的详细信息，包括报废原因、数量、审批状态等")
    public ResponseEntity<?> getDisposalRecord(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @PathVariable @Parameter(description = "报废记录ID", example = "1", required = true) Long id) {
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
    @Operation(summary = "创建报废记录", description = "创建新的报废记录，需要指定报废类型、数量、原因等信息。创建后默认状态为待审批")
    public ResponseEntity<?> createDisposalRecord(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @RequestBody @Parameter(description = "报废记录信息，包含type、quantity、reason、itemId等") DisposalRecord record) {
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
    @Operation(summary = "更新报废记录", description = "更新指定的报废记录信息。注意：已审批通过的记录不可修改")
    public ResponseEntity<?> updateDisposalRecord(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @PathVariable @Parameter(description = "报废记录ID", example = "1", required = true) Long id,
            @RequestBody @Parameter(description = "更新数据，包含需要修改的字段") DisposalRecord updateData) {
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
    @Operation(summary = "审批报废记录", description = "审批指定的报废记录，需要提供审批人信息。审批通过后记录状态变更为已审批，库存将相应减少")
    public ResponseEntity<?> approveDisposal(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @PathVariable @Parameter(description = "报废记录ID", example = "1", required = true) Long id,
            @RequestBody @Parameter(description = "审批信息 {\"approverId\": 1, \"approverName\": \"张三\"}") Map<String, Object> body) {
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
    @Operation(summary = "删除报废记录", description = "删除指定的报废记录。注意：已审批通过的记录不可删除")
    public ResponseEntity<?> deleteDisposalRecord(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @PathVariable @Parameter(description = "报废记录ID", example = "1", required = true) Long id) {
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
    @Operation(summary = "获取待审批报废记录", description = "获取指定工厂所有待审批的报废记录列表，用于审批人员查看待处理的审批任务")
    public ResponseEntity<?> getPendingApprovals(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId) {
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
    @Operation(summary = "按日期范围查询报废记录", description = "根据时间范围查询报废记录，用于统计分析和报表生成")
    public ResponseEntity<?> getByDateRange(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) @Parameter(description = "开始时间", example = "2026-01-01T00:00:00", required = true) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) @Parameter(description = "结束时间", example = "2026-01-31T23:59:59", required = true) LocalDateTime endDate) {
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
    @Operation(summary = "获取报废统计", description = "获取指定时间范围内的报废统计数据，包括总数量、总金额、各类型分布等")
    public ResponseEntity<?> getStats(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) @Parameter(description = "开始时间", example = "2026-01-01T00:00:00", required = true) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) @Parameter(description = "结束时间", example = "2026-01-31T23:59:59", required = true) LocalDateTime endDate) {
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
    @Operation(summary = "按类型统计报废", description = "按报废类型（原材料/产品/设备）分组统计指定时间范围内的报废数据，用于分析各类型报废占比")
    public ResponseEntity<?> getStatsByType(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) @Parameter(description = "开始时间", example = "2026-01-01T00:00:00", required = true) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) @Parameter(description = "结束时间", example = "2026-01-31T23:59:59", required = true) LocalDateTime endDate) {
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
    @Operation(summary = "获取可回收报废记录", description = "获取指定工厂所有标记为可回收的报废记录列表，便于安排回收处理")
    public ResponseEntity<?> getRecyclableDisposals(
            @PathVariable @Parameter(description = "工厂ID", example = "F001", required = true) String factoryId) {
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
