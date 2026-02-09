package com.cretas.aims.controller;

import com.cretas.aims.entity.isapi.LabelRecognitionConfig;
import com.cretas.aims.entity.isapi.LabelRecognitionRecord;
import com.cretas.aims.service.isapi.AutoLabelRecognitionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 标签识别 REST API 控制器
 *
 * 支持功能:
 * - 配置管理 (CRUD)
 * - 手动触发识别
 * - 识别历史查询
 * - 统计数据查询
 *
 * @author Cretas Team
 * @since 2026-01-13
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/label-recognition")
@RequiredArgsConstructor
@Tag(name = "标签识别", description = "摄像头自动标签识别管理API")
public class LabelRecognitionController {

    private final AutoLabelRecognitionService labelRecognitionService;

    // ==================== 配置管理 ====================

    /**
     * 获取配置列表
     */
    @GetMapping("/configs")
    @Operation(summary = "获取配置列表", description = "获取工厂的所有标签识别配置")
    public ResponseEntity<Map<String, Object>> getConfigs(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Pageable pageable = PageRequest.of(page, size);
            Page<LabelRecognitionConfig> configs = labelRecognitionService.getConfigs(factoryId, pageable);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", Map.of(
                    "content", configs.getContent(),
                    "totalElements", configs.getTotalElements(),
                    "totalPages", configs.getTotalPages(),
                    "page", page,
                    "size", size
            ));
            response.put("message", "获取成功");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("获取配置列表失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("获取配置列表失败: " + e.getMessage()));
        }
    }

    /**
     * 获取单个配置
     */
    @GetMapping("/configs/{configId}")
    @Operation(summary = "获取配置详情", description = "获取单个标签识别配置的详细信息")
    public ResponseEntity<Map<String, Object>> getConfig(
            @PathVariable String factoryId,
            @PathVariable @Parameter(description = "配置ID") Long configId) {
        try {
            LabelRecognitionConfig config = labelRecognitionService.getConfig(configId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", config);
            response.put("message", "获取成功");

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("获取配置详情失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("获取配置详情失败: " + e.getMessage()));
        }
    }

    /**
     * 创建配置
     */
    @PostMapping("/configs")
    @Operation(summary = "创建配置", description = "创建新的标签识别配置")
    public ResponseEntity<Map<String, Object>> createConfig(
            @PathVariable String factoryId,
            @Valid @RequestBody LabelRecognitionConfig config) {
        try {
            LabelRecognitionConfig created = labelRecognitionService.createConfig(factoryId, config);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", created);
            response.put("message", "创建成功");

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("创建配置失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("创建配置失败: " + e.getMessage()));
        }
    }

    /**
     * 更新配置
     */
    @PutMapping("/configs/{configId}")
    @Operation(summary = "更新配置", description = "更新标签识别配置")
    public ResponseEntity<Map<String, Object>> updateConfig(
            @PathVariable String factoryId,
            @PathVariable @Parameter(description = "配置ID") Long configId,
            @Valid @RequestBody LabelRecognitionConfig updates) {
        try {
            LabelRecognitionConfig updated = labelRecognitionService.updateConfig(configId, updates);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", updated);
            response.put("message", "更新成功");

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("更新配置失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("更新配置失败: " + e.getMessage()));
        }
    }

    /**
     * 删除配置
     */
    @DeleteMapping("/configs/{configId}")
    @Operation(summary = "删除配置", description = "删除标签识别配置（软删除）")
    public ResponseEntity<Map<String, Object>> deleteConfig(
            @PathVariable String factoryId,
            @PathVariable @Parameter(description = "配置ID") Long configId) {
        try {
            labelRecognitionService.deleteConfig(configId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "删除成功");

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("删除配置失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("删除配置失败: " + e.getMessage()));
        }
    }

    /**
     * 启用/禁用配置
     */
    @PostMapping("/configs/{configId}/toggle")
    @Operation(summary = "启用/禁用配置", description = "切换标签识别配置的启用状态")
    public ResponseEntity<Map<String, Object>> toggleConfig(
            @PathVariable String factoryId,
            @PathVariable @Parameter(description = "配置ID") Long configId,
            @RequestBody Map<String, Boolean> body) {
        try {
            Boolean enabled = body.get("enabled");
            if (enabled == null) {
                return ResponseEntity.badRequest().body(errorResponse("缺少 enabled 参数"));
            }

            LabelRecognitionConfig config = labelRecognitionService.toggleConfig(configId, enabled);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", config);
            response.put("message", enabled ? "配置已启用" : "配置已禁用");

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("切换配置状态失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("切换配置状态失败: " + e.getMessage()));
        }
    }

    // ==================== 手动触发 ====================

    /**
     * 手动触发识别
     */
    @PostMapping("/configs/{configId}/trigger")
    @Operation(summary = "手动触发识别", description = "手动触发一次标签识别")
    public ResponseEntity<Map<String, Object>> triggerRecognition(
            @PathVariable String factoryId,
            @PathVariable @Parameter(description = "配置ID") Long configId) {
        try {
            LabelRecognitionRecord record = labelRecognitionService.manualRecognize(configId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", buildRecordDTO(record));
            response.put("message", "识别完成");

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("手动触发识别失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("手动触发识别失败: " + e.getMessage()));
        }
    }

    // ==================== 识别历史 ====================

    /**
     * 获取识别历史
     */
    @GetMapping("/records")
    @Operation(summary = "获取识别历史", description = "获取工厂的标签识别历史记录")
    public ResponseEntity<Map<String, Object>> getRecords(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) @Parameter(description = "配置ID过滤") Long configId) {
        try {
            Pageable pageable = PageRequest.of(page, size);
            Page<LabelRecognitionRecord> records;

            if (configId != null) {
                records = labelRecognitionService.getRecordsByConfig(configId, pageable);
            } else {
                records = labelRecognitionService.getRecords(factoryId, pageable);
            }

            // 转换为DTO（不包含图片数据）
            List<Map<String, Object>> recordDTOs = records.getContent().stream()
                    .map(this::buildRecordDTO)
                    .toList();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", Map.of(
                    "content", recordDTOs,
                    "totalElements", records.getTotalElements(),
                    "totalPages", records.getTotalPages(),
                    "page", page,
                    "size", size
            ));
            response.put("message", "获取成功");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("获取识别历史失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("获取识别历史失败: " + e.getMessage()));
        }
    }

    /**
     * 获取最近识别记录
     */
    @GetMapping("/records/recent")
    @Operation(summary = "获取最近识别记录", description = "获取最近的标签识别记录")
    public ResponseEntity<Map<String, Object>> getRecentRecords(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "10") int limit) {
        try {
            List<LabelRecognitionRecord> records = labelRecognitionService.getRecentRecords(factoryId, limit);

            // 转换为DTO
            List<Map<String, Object>> recordDTOs = records.stream()
                    .map(this::buildRecordDTO)
                    .toList();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", recordDTOs);
            response.put("message", "获取成功");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("获取最近识别记录失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("获取最近识别记录失败: " + e.getMessage()));
        }
    }

    // ==================== 统计数据 ====================

    /**
     * 获取统计数据
     */
    @GetMapping("/statistics")
    @Operation(summary = "获取统计数据", description = "获取标签识别统计数据")
    public ResponseEntity<Map<String, Object>> getStatistics(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "统计日期，默认今天") LocalDate date) {
        try {
            if (date == null) {
                date = LocalDate.now();
            }

            Map<String, Object> stats = labelRecognitionService.getStatistics(factoryId, date);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", stats);
            response.put("message", "获取成功");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("获取统计数据失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("获取统计数据失败: " + e.getMessage()));
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 构建记录DTO（不包含图片数据）
     */
    private Map<String, Object> buildRecordDTO(LabelRecognitionRecord record) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", record.getId());
        dto.put("factoryId", record.getFactoryId());
        dto.put("configId", record.getConfigId());
        dto.put("deviceId", record.getDeviceId());
        dto.put("triggerType", record.getTriggerType());
        dto.put("triggerEventId", record.getTriggerEventId());
        dto.put("status", record.getStatus());
        dto.put("statusName", record.getStatusDisplayName());
        dto.put("recognizedBatchNumber", record.getRecognizedBatchNumber());
        dto.put("expectedBatchNumber", record.getExpectedBatchNumber());
        dto.put("batchMatch", record.getBatchMatch());
        dto.put("printQuality", record.getPrintQuality());
        dto.put("confidence", record.getConfidence());
        dto.put("qualityScore", record.getQualityScore());
        dto.put("qualityIssues", record.getQualityIssues());
        dto.put("recognitionTime", record.getRecognitionTime());
        dto.put("processingDurationMs", record.getProcessingDurationMs());
        dto.put("errorMessage", record.getErrorMessage());
        dto.put("requiresAlert", record.requiresAlert());
        dto.put("hasImage", record.getCapturedImage() != null);
        dto.put("imageUrl", record.getCapturedImageUrl());
        dto.put("createdAt", record.getCreatedAt());
        return dto;
    }

    /**
     * 构建错误响应
     */
    private Map<String, Object> errorResponse(String message) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        result.put("message", message);
        return result;
    }
}
