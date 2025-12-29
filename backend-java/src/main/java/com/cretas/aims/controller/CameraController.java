package com.cretas.aims.controller;

import com.cretas.aims.dto.camera.CameraDeviceInfo;
import com.cretas.aims.dto.camera.CaptureImageRequest;
import com.cretas.aims.dto.camera.CaptureImageResponse;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.CameraService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

/**
 * 相机控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-02-02
 */
@Slf4j
@RestController
@RequestMapping("/api/camera")
@Tag(name = "相机管理", description = "海康威视工业相机管理API")
@RequiredArgsConstructor
public class CameraController {

    private final CameraService cameraService;

    /**
     * 获取SDK版本
     */
    @GetMapping("/version")
    @Operation(summary = "获取SDK版本", description = "获取海康威视相机SDK版本信息")
    @PreAuthorize("hasAnyRole('ADMIN', 'QUALITY_INSPECTOR', 'SUPERVISOR')")
    public ResponseEntity<ApiResponse<Map<String, String>>> getSdkVersion() {
        log.info("获取相机SDK版本");
        String version = cameraService.getSdkVersion();
        return ResponseEntity.ok(ApiResponse.success(Map.of("version", version)));
    }

    /**
     * 枚举可用相机设备
     */
    @GetMapping("/devices")
    @Operation(summary = "枚举相机设备", description = "获取所有可用的相机设备列表")
    @PreAuthorize("hasAnyRole('ADMIN', 'QUALITY_INSPECTOR', 'SUPERVISOR')")
    public ResponseEntity<ApiResponse<List<CameraDeviceInfo>>> enumerateDevices() {
        log.info("枚举相机设备");
        List<CameraDeviceInfo> devices = cameraService.enumerateDevices();
        return ResponseEntity.ok(ApiResponse.success(devices));
    }

    /**
     * 连接相机
     */
    @PostMapping("/connect")
    @Operation(summary = "连接相机", description = "连接到指定的相机设备")
    @PreAuthorize("hasAnyRole('ADMIN', 'QUALITY_INSPECTOR', 'SUPERVISOR')")
    public ResponseEntity<ApiResponse<Void>> connectCamera(
            @RequestParam @Parameter(description = "设备索引") Integer deviceIndex) {
        log.info("连接相机，设备索引: {}", deviceIndex);
        cameraService.connectCamera(deviceIndex);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /**
     * 断开相机连接
     */
    @PostMapping("/disconnect")
    @Operation(summary = "断开相机连接", description = "断开当前连接的相机设备")
    @PreAuthorize("hasAnyRole('ADMIN', 'QUALITY_INSPECTOR', 'SUPERVISOR')")
    public ResponseEntity<ApiResponse<Void>> disconnectCamera() {
        log.info("断开相机连接");
        cameraService.disconnectCamera();
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /**
     * 检查相机连接状态
     */
    @GetMapping("/status")
    @Operation(summary = "检查连接状态", description = "检查相机是否已连接")
    @PreAuthorize("hasAnyRole('ADMIN', 'QUALITY_INSPECTOR', 'SUPERVISOR')")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> getCameraStatus() {
        log.info("检查相机连接状态");
        boolean connected = cameraService.isConnected();
        return ResponseEntity.ok(ApiResponse.success(Map.of("connected", connected)));
    }

    /**
     * 采集图像
     */
    @PostMapping("/capture")
    @Operation(summary = "采集图像", description = "从已连接的相机采集单张图像")
    @PreAuthorize("hasAnyRole('ADMIN', 'QUALITY_INSPECTOR', 'SUPERVISOR')")
    public ResponseEntity<ApiResponse<CaptureImageResponse>> captureImage(
            @Valid @RequestBody(required = false) @Parameter(description = "拍照请求参数") CaptureImageRequest request) {
        log.info("采集图像，请求参数: {}", request);
        CaptureImageResponse response = cameraService.captureImage(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 快速拍照（使用默认参数）
     */
    @PostMapping("/capture/quick")
    @Operation(summary = "快速拍照", description = "使用默认参数快速采集图像")
    @PreAuthorize("hasAnyRole('ADMIN', 'QUALITY_INSPECTOR', 'SUPERVISOR')")
    public ResponseEntity<ApiResponse<CaptureImageResponse>> quickCapture() {
        log.info("快速拍照");
        CaptureImageResponse response = cameraService.captureImage();
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}

