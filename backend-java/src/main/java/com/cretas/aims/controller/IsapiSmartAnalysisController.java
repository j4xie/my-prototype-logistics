package com.cretas.aims.controller;

import com.cretas.aims.dto.isapi.SmartAnalysisDTO;
import com.cretas.aims.dto.isapi.SmartAnalysisDTO.SmartCapabilities;
import com.cretas.aims.service.isapi.IsapiSmartAnalysisService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/**
 * ISAPI 智能分析配置 REST API
 * 管理海康威视摄像头的智能分析规则配置
 *
 * 支持功能:
 * - 越界检测 (LineDetection) - 虚拟警戒线
 * - 区域入侵检测 (FieldDetection) - 入侵检测区域
 * - 人脸检测 (FaceDetection) - 人脸检测区域
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/isapi/devices/{deviceId}/smart")
@RequiredArgsConstructor
@Tag(name = "ISAPI Smart Analysis", description = "海康威视摄像头智能分析配置管理")
public class IsapiSmartAnalysisController {

    private final IsapiSmartAnalysisService smartAnalysisService;

    // ==================== 智能分析能力 ====================

    /**
     * 获取设备智能分析能力
     */
    @GetMapping("/capabilities")
    @Operation(summary = "获取设备智能分析能力", description = "查询设备支持的智能分析类型")
    public ResponseEntity<Map<String, Object>> getSmartCapabilities(
            @PathVariable String factoryId,
            @PathVariable String deviceId) {
        try {
            SmartCapabilities caps = smartAnalysisService.getSmartCapabilities(factoryId, deviceId);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", caps);
            result.put("message", "获取智能分析能力成功");

            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            log.warn("获取智能分析能力参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("获取智能分析能力失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("获取智能分析能力失败: " + e.getMessage()));
        }
    }

    // ==================== 越界检测配置 ====================

    /**
     * 获取越界检测配置
     */
    @GetMapping("/channels/{channelId}/line-detection")
    @Operation(summary = "获取越界检测配置", description = "获取指定通道的越界检测规则配置")
    public ResponseEntity<Map<String, Object>> getLineDetectionConfig(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @PathVariable int channelId) {
        try {
            SmartAnalysisDTO config = smartAnalysisService.getLineDetectionConfig(factoryId, deviceId, channelId);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", config);
            result.put("message", "获取越界检测配置成功");

            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            log.warn("获取越界检测配置参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("获取越界检测配置失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("获取越界检测配置失败: " + e.getMessage()));
        }
    }

    /**
     * 保存越界检测配置
     */
    @PutMapping("/channels/{channelId}/line-detection")
    @Operation(summary = "保存越界检测配置", description = "保存指定通道的越界检测规则配置")
    public ResponseEntity<Map<String, Object>> saveLineDetectionConfig(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @PathVariable int channelId,
            @Valid @RequestBody SmartAnalysisDTO config) {
        try {
            smartAnalysisService.saveLineDetectionConfig(factoryId, deviceId, channelId, config);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "保存越界检测配置成功");

            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            log.warn("保存越界检测配置参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("保存越界检测配置失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("保存越界检测配置失败: " + e.getMessage()));
        }
    }

    // ==================== 区域入侵检测配置 ====================

    /**
     * 获取区域入侵检测配置
     */
    @GetMapping("/channels/{channelId}/field-detection")
    @Operation(summary = "获取区域入侵检测配置", description = "获取指定通道的区域入侵检测规则配置")
    public ResponseEntity<Map<String, Object>> getFieldDetectionConfig(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @PathVariable int channelId) {
        try {
            SmartAnalysisDTO config = smartAnalysisService.getFieldDetectionConfig(factoryId, deviceId, channelId);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", config);
            result.put("message", "获取区域入侵配置成功");

            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            log.warn("获取区域入侵配置参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("获取区域入侵配置失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("获取区域入侵配置失败: " + e.getMessage()));
        }
    }

    /**
     * 保存区域入侵检测配置
     */
    @PutMapping("/channels/{channelId}/field-detection")
    @Operation(summary = "保存区域入侵检测配置", description = "保存指定通道的区域入侵检测规则配置")
    public ResponseEntity<Map<String, Object>> saveFieldDetectionConfig(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @PathVariable int channelId,
            @Valid @RequestBody SmartAnalysisDTO config) {
        try {
            smartAnalysisService.saveFieldDetectionConfig(factoryId, deviceId, channelId, config);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "保存区域入侵配置成功");

            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            log.warn("保存区域入侵配置参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("保存区域入侵配置失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("保存区域入侵配置失败: " + e.getMessage()));
        }
    }

    // ==================== 人脸检测配置 ====================

    /**
     * 获取人脸检测配置
     */
    @GetMapping("/channels/{channelId}/face-detection")
    @Operation(summary = "获取人脸检测配置", description = "获取指定通道的人脸检测配置")
    public ResponseEntity<Map<String, Object>> getFaceDetectionConfig(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @PathVariable int channelId) {
        try {
            SmartAnalysisDTO config = smartAnalysisService.getFaceDetectionConfig(factoryId, deviceId, channelId);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("data", config);
            result.put("message", "获取人脸检测配置成功");

            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            log.warn("获取人脸检测配置参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("获取人脸检测配置失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("获取人脸检测配置失败: " + e.getMessage()));
        }
    }

    /**
     * 保存人脸检测配置
     */
    @PutMapping("/channels/{channelId}/face-detection")
    @Operation(summary = "保存人脸检测配置", description = "保存指定通道的人脸检测配置")
    public ResponseEntity<Map<String, Object>> saveFaceDetectionConfig(
            @PathVariable String factoryId,
            @PathVariable String deviceId,
            @PathVariable int channelId,
            @Valid @RequestBody SmartAnalysisDTO config) {
        try {
            smartAnalysisService.saveFaceDetectionConfig(factoryId, deviceId, channelId, config);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "保存人脸检测配置成功");

            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            log.warn("保存人脸检测配置参数错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("保存人脸检测配置失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(errorResponse("保存人脸检测配置失败: " + e.getMessage()));
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
