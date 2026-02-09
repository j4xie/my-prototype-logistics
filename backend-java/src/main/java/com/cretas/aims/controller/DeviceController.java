package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.DeviceRegistration;
import com.cretas.aims.repository.DeviceRegistrationRepository;
import com.cretas.aims.service.PushNotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.cretas.aims.util.ErrorSanitizer;

/**
 * 设备管理控制器
 * 处理设备注册、注销和推送通知管理
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/devices")
@Tag(name = "设备管理", description = "设备注册和推送通知相关接口")
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceRegistrationRepository deviceRepository;
    private final PushNotificationService pushNotificationService;

    /**
     * 注册设备
     */
    @PostMapping("/register")
    @Operation(summary = "注册设备", description = "注册设备以接收推送通知")
    public ApiResponse<DeviceRegistrationResponse> registerDevice(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody DeviceRegistrationRequest request,
            HttpServletRequest httpRequest) {

        log.info("设备注册请求: factoryId={}, deviceId={}, platform={}",
                factoryId, request.getDeviceId(), request.getPlatform());

        try {
            // 验证 Push Token 格式
            if (!pushNotificationService.validatePushToken(request.getPushToken())) {
                return ApiResponse.error("无效的 Push Token 格式");
            }

            // 获取当前用户 ID
            Long userId = getUserIdFromRequest(httpRequest);
            if (userId == null) {
                return ApiResponse.error("未找到用户信息");
            }

            // 检查设备是否已注册
            Optional<DeviceRegistration> existingDevice = deviceRepository
                    .findByDeviceIdAndFactoryId(request.getDeviceId(), factoryId);

            DeviceRegistration device;

            if (existingDevice.isPresent()) {
                // 更新现有设备
                device = existingDevice.get();
                device.setPushToken(request.getPushToken());
                device.setDeviceName(request.getDeviceName());
                device.setDeviceModel(request.getDeviceModel());
                device.setOsVersion(request.getOsVersion());
                device.setAppVersion(request.getAppVersion());
                device.updateLastActive();
                device.enable();

                log.info("更新现有设备: deviceId={}", request.getDeviceId());
            } else {
                // 创建新设备
                device = DeviceRegistration.builder()
                        .userId(userId)
                        .factoryId(factoryId)
                        .pushToken(request.getPushToken())
                        .deviceId(request.getDeviceId())
                        .platform(request.getPlatform())
                        .deviceName(request.getDeviceName())
                        .deviceModel(request.getDeviceModel())
                        .osVersion(request.getOsVersion())
                        .appVersion(request.getAppVersion())
                        .lastActiveAt(LocalDateTime.now())
                        .isEnabled(true)
                        .build();

                log.info("注册新设备: deviceId={}", request.getDeviceId());
            }

            device = deviceRepository.save(device);

            DeviceRegistrationResponse response = new DeviceRegistrationResponse();
            response.setDeviceId(device.getDeviceId());
            response.setRegisteredAt(device.getCreatedAt());

            return ApiResponse.success("设备注册成功", response);

        } catch (Exception e) {
            log.error("设备注册失败", e);
            return ApiResponse.error("设备注册失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * 注销设备
     */
    @DeleteMapping("/unregister")
    @Transactional
    @Operation(summary = "注销设备", description = "注销设备，停止接收推送通知")
    public ApiResponse<Void> unregisterDevice(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "设备ID") String deviceId) {

        log.info("设备注销请求: factoryId={}, deviceId={}", factoryId, deviceId);

        try {
            deviceRepository.deleteByDeviceIdAndFactoryId(deviceId, factoryId);
            return ApiResponse.successMessage("设备注销成功");
        } catch (Exception e) {
            log.error("设备注销失败", e);
            return ApiResponse.error("设备注销失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * 更新设备 Token
     */
    @PutMapping("/token")
    @Operation(summary = "更新设备Token", description = "当 Push Token 刷新时更新")
    public ApiResponse<Void> updateDeviceToken(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody UpdateTokenRequest request) {

        log.info("更新设备 Token: factoryId={}, deviceId={}", factoryId, request.getDeviceId());

        try {
            Optional<DeviceRegistration> deviceOpt = deviceRepository
                    .findByDeviceIdAndFactoryId(request.getDeviceId(), factoryId);

            if (!deviceOpt.isPresent()) {
                return ApiResponse.error("设备未注册");
            }

            DeviceRegistration device = deviceOpt.get();
            device.updateToken(request.getPushToken());
            deviceRepository.save(device);

            return ApiResponse.successMessage("Token 更新成功");
        } catch (Exception e) {
            log.error("Token 更新失败", e);
            return ApiResponse.error("Token 更新失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * 获取用户的所有设备
     */
    @GetMapping("/list")
    @Operation(summary = "获取用户设备列表", description = "获取当前用户的所有已注册设备")
    public ApiResponse<List<DeviceRegistration>> getUserDevices(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            HttpServletRequest httpRequest) {

        try {
            Long userId = getUserIdFromRequest(httpRequest);
            if (userId == null) {
                return ApiResponse.error("未找到用户信息");
            }

            List<DeviceRegistration> devices = deviceRepository
                    .findByUserIdAndFactoryId(userId, factoryId);

            return ApiResponse.success(devices);
        } catch (Exception e) {
            log.error("获取设备列表失败", e);
            return ApiResponse.error("获取设备列表失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * 测试推送通知
     */
    @PostMapping("/test-notification")
    @Operation(summary = "测试推送通知", description = "向当前用户发送测试推送")
    public ApiResponse<Void> testNotification(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            HttpServletRequest httpRequest) {

        try {
            Long userId = getUserIdFromRequest(httpRequest);
            if (userId == null) {
                return ApiResponse.error("未找到用户信息");
            }

            Map<String, Object> data = new HashMap<>();
            data.put("type", "test");
            data.put("timestamp", System.currentTimeMillis());

            pushNotificationService.sendToUser(
                    userId,
                    "测试通知",
                    "这是一条测试推送通知",
                    data
            );

            return ApiResponse.successMessage("测试推送已发送");
        } catch (Exception e) {
            log.error("发送测试推送失败", e);
            return ApiResponse.error("发送测试推送失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * 启用/禁用设备推送
     */
    @PutMapping("/{deviceId}/toggle")
    @Operation(summary = "启用/禁用设备", description = "切换设备的推送通知状态")
    public ApiResponse<Void> toggleDevice(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "设备ID") String deviceId,
            @RequestParam @Parameter(description = "是否启用") boolean enabled) {

        try {
            Optional<DeviceRegistration> deviceOpt = deviceRepository
                    .findByDeviceIdAndFactoryId(deviceId, factoryId);

            if (!deviceOpt.isPresent()) {
                return ApiResponse.error("设备未找到");
            }

            DeviceRegistration device = deviceOpt.get();
            if (enabled) {
                device.enable();
            } else {
                device.disable();
            }
            deviceRepository.save(device);

            return ApiResponse.successMessage(enabled ? "设备已启用" : "设备已禁用");
        } catch (Exception e) {
            log.error("切换设备状态失败", e);
            return ApiResponse.error("操作失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * 从请求中获取用户ID
     */
    private Long getUserIdFromRequest(HttpServletRequest request) {
        Object userIdObj = request.getAttribute("userId");
        if (userIdObj == null) {
            return null;
        }
        if (userIdObj instanceof Long) {
            return (Long) userIdObj;
        }
        if (userIdObj instanceof Integer) {
            return ((Integer) userIdObj).longValue();
        }
        if (userIdObj instanceof String) {
            try {
                return Long.parseLong((String) userIdObj);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    // DTO 类

    @Data
    public static class DeviceRegistrationRequest {
        @NotBlank(message = "Push Token 不能为空")
        private String pushToken;

        @NotBlank(message = "设备ID不能为空")
        private String deviceId;

        @NotBlank(message = "平台类型不能为空")
        private String platform;

        private String deviceName;
        private String deviceModel;
        private String osVersion;
        private String appVersion;
    }

    @Data
    public static class UpdateTokenRequest {
        @NotBlank(message = "设备ID不能为空")
        private String deviceId;

        @NotBlank(message = "Push Token 不能为空")
        private String pushToken;
    }

    @Data
    public static class DeviceRegistrationResponse {
        private String deviceId;
        private LocalDateTime registeredAt;
    }
}
