package com.cretas.aims.controller;

import com.cretas.aims.service.workstation.WorkstationCountingService;
import com.cretas.aims.service.workstation.WorkstationCountingService.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/**
 * 工位计数 REST API 控制器
 *
 * 支持功能:
 * - 初始化工位计数会话 (绑定摄像头、电子秤、工人、批次)
 * - 图像帧处理 (AI识别完成手势进行自动计数)
 * - 手动计数
 * - 标签验证 (OCR识别)
 * - 查询工位状态
 * - 停止工位会话
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/workstation-counting")
@RequiredArgsConstructor
@Tag(name = "工位计数", description = "生产线工位计数管理API（集成摄像头AI识别+电子秤称重）")
public class WorkstationCountingController {

    private final WorkstationCountingService countingService;

    // ==================== 工位管理 ====================

    /**
     * 初始化工位计数会话
     */
    @PostMapping("/init")
    @Operation(summary = "初始化工位", description = "初始化工位计数会话，绑定摄像头、电子秤、工人和生产批次")
    public ResponseEntity<Map<String, Object>> initWorkstation(
            @PathVariable String factoryId,
            @Valid @RequestBody WorkstationConfig config) {
        try {
            // 设置工厂ID
            config.setFactoryId(factoryId);

            WorkstationInitResult result = countingService.initWorkstation(config);

            Map<String, Object> response = new HashMap<>();
            response.put("success", result.isSuccess());
            response.put("data", result);
            response.put("message", result.getMessage());

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("初始化工位参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("初始化工位失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("初始化工位失败: " + e.getMessage()));
        }
    }

    /**
     * 停止工位计数会话
     */
    @PostMapping("/{workstationId}/stop")
    @Operation(summary = "停止工位", description = "停止工位计数会话，保存统计数据")
    public ResponseEntity<Map<String, Object>> stopWorkstation(
            @PathVariable String factoryId,
            @PathVariable @Parameter(description = "工位ID") String workstationId) {
        try {
            WorkstationStopResult result = countingService.stopWorkstation(workstationId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", result.isSuccess());
            response.put("data", result);
            response.put("message", result.getMessage());

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("停止工位参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("停止工位失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("停止工位失败: " + e.getMessage()));
        }
    }

    // ==================== 计数操作 ====================

    /**
     * 处理图像帧（AI识别完成手势）
     */
    @PostMapping("/{workstationId}/frame")
    @Operation(summary = "处理图像帧", description = "上传图像帧，AI识别完成手势自动计数")
    public ResponseEntity<Map<String, Object>> processFrame(
            @PathVariable String factoryId,
            @PathVariable @Parameter(description = "工位ID") String workstationId,
            @RequestBody @Parameter(description = "Base64编码的图像数据") Map<String, String> body) {
        try {
            String imageBase64 = body.get("imageBase64");
            if (imageBase64 == null || imageBase64.isEmpty()) {
                return ResponseEntity.badRequest().body(errorResponse("缺少图像数据"));
            }

            CountingResult result = countingService.processFrame(workstationId, imageBase64);

            Map<String, Object> response = new HashMap<>();
            response.put("success", result.isSuccess());
            response.put("data", result);
            response.put("message", result.getMessage());

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("处理图像帧参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("处理图像帧失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("处理图像帧失败: " + e.getMessage()));
        }
    }

    /**
     * 手动计数
     */
    @PostMapping("/{workstationId}/manual-count")
    @Operation(summary = "手动计数", description = "手动增加一个计数（用于补录或手势识别失败时），可传入重量")
    public ResponseEntity<Map<String, Object>> manualCount(
            @PathVariable String factoryId,
            @PathVariable @Parameter(description = "工位ID") String workstationId,
            @RequestBody(required = false) @Parameter(description = "可选的重量数据") Map<String, Object> body) {
        try {
            // 提取可选的重量参数
            java.math.BigDecimal manualWeight = null;
            if (body != null && body.containsKey("weight")) {
                Object weightObj = body.get("weight");
                if (weightObj instanceof Number) {
                    manualWeight = new java.math.BigDecimal(weightObj.toString());
                }
            }

            CountingResult result = countingService.manualCount(workstationId, manualWeight);

            Map<String, Object> response = new HashMap<>();
            response.put("success", result.isSuccess());
            response.put("data", result);
            response.put("message", result.getMessage());

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("手动计数参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("手动计数失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("手动计数失败: " + e.getMessage()));
        }
    }

    // ==================== 标签验证 ====================

    /**
     * 验证标签
     */
    @PostMapping("/{workstationId}/verify-label")
    @Operation(summary = "验证标签", description = "OCR识别标签，验证批次号是否匹配，检查打印质量")
    public ResponseEntity<Map<String, Object>> verifyLabel(
            @PathVariable String factoryId,
            @PathVariable @Parameter(description = "工位ID") String workstationId,
            @RequestBody @Parameter(description = "标签图像数据") Map<String, String> body) {
        try {
            String labelImageBase64 = body.get("labelImageBase64");
            if (labelImageBase64 == null || labelImageBase64.isEmpty()) {
                return ResponseEntity.badRequest().body(errorResponse("缺少标签图像数据"));
            }

            LabelVerifyResult result = countingService.verifyLabel(workstationId, labelImageBase64);

            Map<String, Object> response = new HashMap<>();
            response.put("success", result.isSuccess());
            response.put("data", result);
            response.put("message", result.getMessage());

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("验证标签参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("验证标签失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("验证标签失败: " + e.getMessage()));
        }
    }

    // ==================== 状态查询 ====================

    /**
     * 获取工位状态
     */
    @GetMapping("/{workstationId}/status")
    @Operation(summary = "获取工位状态", description = "获取工位当前的计数状态和统计信息")
    public ResponseEntity<Map<String, Object>> getWorkstationStatus(
            @PathVariable String factoryId,
            @PathVariable @Parameter(description = "工位ID") String workstationId) {
        try {
            WorkstationStatusInfo status = countingService.getWorkstationStatus(workstationId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", status);
            response.put("message", status.getMessage());

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("获取工位状态参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("获取工位状态失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("获取工位状态失败: " + e.getMessage()));
        }
    }

    // ==================== 辅助方法 ====================

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
