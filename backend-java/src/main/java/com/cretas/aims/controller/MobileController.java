package com.cretas.aims.controller;

import com.cretas.aims.dto.MobileDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.user.UserDTO;
import com.cretas.aims.entity.EquipmentAlert;
import com.cretas.aims.entity.enums.AlertStatus;
import com.cretas.aims.repository.EquipmentAlertRepository;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.utils.SecurityUtils;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 移动端接口控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile")
@Tag(name = "移动端接口", description = "移动端专用接口")
@RequiredArgsConstructor
public class MobileController {

    private final MobileService mobileService;
    private final EquipmentAlertRepository equipmentAlertRepository;

    // ==================== 认证相关接口 ====================

    @PostMapping("/auth/unified-login")
    @Operation(summary = "统一登录接口")
    public ApiResponse<MobileDTO.LoginResponse> unifiedLogin(
            @RequestBody @Valid MobileDTO.LoginRequest request) {
        log.info("移动端统一登录: username={}", request.getUsername());
        MobileDTO.LoginResponse response = mobileService.unifiedLogin(request);
        return ApiResponse.success(response);
    }

    @PostMapping("/auth/refresh")
    @Operation(summary = "刷新访问令牌")
    public ApiResponse<MobileDTO.LoginResponse> refreshToken(
            @RequestParam @Parameter(description = "刷新令牌") String refreshToken) {
        log.debug("刷新令牌");
        MobileDTO.LoginResponse response = mobileService.refreshToken(refreshToken);
        return ApiResponse.success(response);
    }

    @PostMapping("/auth/logout")
    @Operation(summary = "用户登出")
    public ApiResponse<Void> logout(
            @RequestParam(required = false) @Parameter(description = "设备ID") String deviceId) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("用户登出: userId={}, deviceId={}", userId, deviceId);
        mobileService.logout(userId, deviceId);
        return ApiResponse.success();
    }

    // ==================== 忘记密码接口 ====================

    @PostMapping("/auth/send-verification-code")
    @Operation(summary = "发送验证码")
    public ApiResponse<MobileDTO.SendVerificationCodeResponse> sendVerificationCode(
            @RequestBody @Valid MobileDTO.SendVerificationCodeRequest request) {
        log.info("发送验证码: phoneNumber={}, type={}", request.getPhoneNumber(), request.getVerificationType());
        MobileDTO.SendVerificationCodeResponse response = mobileService.sendVerificationCode(request);
        return ApiResponse.success(response);
    }

    @PostMapping("/auth/verify-reset-code")
    @Operation(summary = "验证重置验证码")
    public ApiResponse<MobileDTO.VerifyResetCodeResponse> verifyResetCode(
            @RequestBody @Valid MobileDTO.VerifyResetCodeRequest request) {
        log.info("验证重置码: phoneNumber={}", request.getPhoneNumber());
        MobileDTO.VerifyResetCodeResponse response = mobileService.verifyResetCode(request);
        return ApiResponse.success(response);
    }

    @PostMapping("/auth/forgot-password")
    @Operation(summary = "忘记密码-重置密码")
    public ApiResponse<MobileDTO.ForgotPasswordResponse> forgotPassword(
            @RequestBody @Valid MobileDTO.ForgotPasswordRequest request) {
        log.info("忘记密码重置: phoneNumber={}", request.getPhoneNumber());
        MobileDTO.ForgotPasswordResponse response = mobileService.forgotPassword(request);
        return ApiResponse.success(response);
    }

    // ==================== 设备激活接口 ====================

    @PostMapping("/activation/activate")
    @Operation(summary = "设备激活")
    public ApiResponse<MobileDTO.ActivationResponse> activateDevice(
            @RequestBody @Valid MobileDTO.ActivationRequest request) {
        log.info("设备激活: code={}", request.getActivationCode());
        MobileDTO.ActivationResponse response = mobileService.activateDevice(request);
        return ApiResponse.success(response);
    }

    // ==================== 注册接口 ====================

    @PostMapping("/auth/register-phase-one")
    @Operation(summary = "移动端注册-第一阶段（验证手机号）")
    public ApiResponse<MobileDTO.RegisterPhaseOneResponse> registerPhaseOne(
            @RequestBody @Valid MobileDTO.RegisterPhaseOneRequest request) {
        log.info("移动端注册第一阶段: phone={}", request.getPhoneNumber());
        MobileDTO.RegisterPhaseOneResponse response = mobileService.registerPhaseOne(request);
        return ApiResponse.success(response);
    }

    @PostMapping("/auth/register-phase-two")
    @Operation(summary = "移动端注册-第二阶段（创建账户）")
    public ApiResponse<MobileDTO.RegisterPhaseTwoResponse> registerPhaseTwo(
            @RequestBody @Valid MobileDTO.RegisterPhaseTwoRequest request) {
        log.info("移动端注册第二阶段: factoryId={}, username={}", request.getFactoryId(), request.getUsername());
        MobileDTO.RegisterPhaseTwoResponse response = mobileService.registerPhaseTwo(request);
        return ApiResponse.success(response);
    }

    // ==================== 文件上传接口 ====================

    @PostMapping("/upload")
    @Operation(summary = "移动端文件上传")
    public ApiResponse<MobileDTO.UploadResponse> uploadFiles(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(required = false) @Parameter(description = "文件分类") String category,
            @RequestParam(required = false) @Parameter(description = "元数据") String metadata) {
        log.info("文件上传: count={}, category={}", files.size(), category);
        MobileDTO.UploadResponse response = mobileService.uploadFiles(files, category, metadata);
        return ApiResponse.success(response);
    }

    // ==================== 仪表盘数据接口 ====================

    @GetMapping("/dashboard/{factoryId}")
    @Operation(summary = "获取移动端仪表盘数据")
    public ApiResponse<MobileDTO.DashboardData> getMobileDashboard(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.debug("获取移动端仪表盘数据: factoryId={}, userId={}", factoryId, userId);
        MobileDTO.DashboardData data = mobileService.getDashboardData(factoryId, userId);
        return ApiResponse.success(data);
    }

    // ==================== 数据同步接口 ====================

    @PostMapping("/sync/{factoryId}")
    @Operation(summary = "数据同步")
    public ApiResponse<MobileDTO.SyncResponse> syncData(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody MobileDTO.SyncRequest request) {
        log.info("数据同步: factoryId={}", factoryId);
        MobileDTO.SyncResponse response = mobileService.syncData(factoryId, request);
        return ApiResponse.success(response);
    }

    @GetMapping("/offline/{factoryId}")
    @Operation(summary = "获取离线数据包")
    public ApiResponse<MobileDTO.OfflineDataPackage> getOfflineDataPackage(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("获取离线数据包: factoryId={}, userId={}", factoryId, userId);
        MobileDTO.OfflineDataPackage data = mobileService.getOfflineDataPackage(factoryId, userId);
        return ApiResponse.success(data);
    }

    // ==================== 推送通知接口 ====================

    @PostMapping("/push/register")
    @Operation(summary = "注册推送通知")
    public ApiResponse<Void> registerPushNotification(
            @RequestBody @Valid MobileDTO.PushRegistration registration) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("注册推送: userId={}, platform={}", userId, registration.getPlatform());
        mobileService.registerPushNotification(userId, registration);
        return ApiResponse.success();
    }

    @DeleteMapping("/push/unregister")
    @Operation(summary = "取消推送通知注册")
    public ApiResponse<Void> unregisterPushNotification(
            @RequestParam @Parameter(description = "设备令牌") String deviceToken) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("取消推送: userId={}, token={}", userId, deviceToken);
        mobileService.unregisterPushNotification(userId, deviceToken);
        return ApiResponse.success();
    }

    // ==================== 设备管理接口 ====================

    @GetMapping("/devices")
    @Operation(summary = "获取用户设备列表")
    public ApiResponse<List<MobileDTO.DeviceInfo>> getUserDevices() {
        Long userId = SecurityUtils.getCurrentUserId();
        log.debug("获取设备列表: userId={}", userId);
        List<MobileDTO.DeviceInfo> devices = mobileService.getUserDevices(userId);
        return ApiResponse.success(devices);
    }

    @DeleteMapping("/devices/{deviceId}")
    @Operation(summary = "移除设备")
    public ApiResponse<Void> removeDevice(
            @PathVariable @Parameter(description = "设备ID") String deviceId) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("移除设备: userId={}, deviceId={}", userId, deviceId);
        mobileService.removeDevice(userId, deviceId);
        return ApiResponse.success();
    }

    // ==================== 版本管理接口 ====================

    @GetMapping("/version/check")
    @Operation(summary = "检查应用版本")
    public ApiResponse<MobileDTO.VersionCheckResponse> checkVersion(
            @RequestParam @Parameter(description = "当前版本") String currentVersion,
            @RequestParam @Parameter(description = "平台") String platform) {
        log.debug("检查版本: current={}, platform={}", currentVersion, platform);
        MobileDTO.VersionCheckResponse response = mobileService.checkVersion(currentVersion, platform);
        return ApiResponse.success(response);
    }

    // ==================== 配置接口 ====================

    @GetMapping("/config/{factoryId}")
    @Operation(summary = "获取移动端配置")
    public ApiResponse<Object> getMobileConfig(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "平台") String platform) {
        log.debug("获取配置: factoryId={}, platform={}", factoryId, platform);
        Object config = mobileService.getMobileConfig(factoryId, platform);
        return ApiResponse.success(config);
    }

    // ==================== 监控接口 ====================

    @PostMapping("/report/crash")
    @Operation(summary = "上报崩溃日志")
    public ApiResponse<Void> reportCrash(
            @RequestBody Map<String, Object> crashData) {
        log.error("收到崩溃报告: {}", crashData);

        // 解析设备信息和崩溃日志
        MobileDTO.DeviceInfo deviceInfo = null;
        String crashLog = null;

        if (crashData.containsKey("deviceInfo")) {
            // TODO: 解析设备信息
        }
        if (crashData.containsKey("crashLog")) {
            crashLog = crashData.get("crashLog").toString();
        }

        mobileService.reportCrash(deviceInfo, crashLog);
        return ApiResponse.success();
    }

    @PostMapping("/report/performance")
    @Operation(summary = "上报性能数据")
    public ApiResponse<Void> reportPerformance(
            @RequestBody Map<String, Object> performanceData) {
        log.debug("收到性能数据: {}", performanceData);

        // 解析设备信息和性能数据
        MobileDTO.DeviceInfo deviceInfo = null;
        Object perfData = performanceData.get("data");

        if (performanceData.containsKey("deviceInfo")) {
            // TODO: 解析设备信息
        }

        mobileService.reportPerformance(deviceInfo, perfData);
        return ApiResponse.success();
    }

    // ==================== 认证工具接口 ====================

    /**
     * 验证Token
     */
    @GetMapping("/auth/validate")
    @Operation(summary = "验证令牌")
    public ApiResponse<Boolean> validateToken(
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization) {
        String token = TokenUtils.extractToken(authorization);
        boolean isValid = mobileService.validateToken(token);
        return ApiResponse.success(isValid);
    }

    /**
     * 获取当前用户信息
     */
    @GetMapping("/auth/me")
    @Operation(summary = "获取当前用户信息")
    public ApiResponse<UserDTO> getCurrentUser(
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization) {
        String token = TokenUtils.extractToken(authorization);
        UserDTO user = mobileService.getUserFromToken(token);
        return ApiResponse.success(user);
    }

    /**
     * 修改密码
     */
    @PostMapping("/auth/change-password")
    @Operation(summary = "修改密码")
    public ApiResponse<Void> changePassword(
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization,
            @Parameter(description = "原密码", required = true)
            @RequestParam String oldPassword,
            @Parameter(description = "新密码", required = true)
            @RequestParam String newPassword) {
        String token = TokenUtils.extractToken(authorization);
        UserDTO user = mobileService.getUserFromToken(token);
        log.info("修改密码: userId={}", user.getId());
        mobileService.changePassword(user.getId(), oldPassword, newPassword);
        return ApiResponse.success("密码修改成功", null);
    }

    /**
     * 重置密码（管理员功能）
     */
    @PostMapping("/auth/reset-password")
    @Operation(summary = "重置密码（管理员）")
    public ApiResponse<Void> resetPassword(
            @Parameter(description = "工厂ID", required = true)
            @RequestParam String factoryId,
            @Parameter(description = "用户名", required = true)
            @RequestParam String username,
            @Parameter(description = "新密码", required = true)
            @RequestParam String newPassword) {
        log.info("重置密码: factoryId={}, username={}", factoryId, username);
        mobileService.resetPassword(factoryId, username, newPassword);
        return ApiResponse.success("密码重置成功", null);
    }

    // ==================== 人员报表接口 ====================

    /**
     * 获取人员总览统计
     */
    @GetMapping("/{factoryId}/personnel/statistics")
    @Operation(summary = "获取人员总览统计")
    public ApiResponse<MobileDTO.PersonnelStatistics> getPersonnelStatistics(
            @PathVariable @Parameter(description = "工厂ID", required = true) String factoryId,
            @RequestParam(required = false) @Parameter(description = "开始日期 YYYY-MM-DD") String startDate,
            @RequestParam(required = false) @Parameter(description = "结束日期 YYYY-MM-DD") String endDate) {
        log.info("获取人员统计: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        MobileDTO.PersonnelStatistics statistics = mobileService.getPersonnelStatistics(factoryId, startDate, endDate);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取工时排行榜
     */
    @GetMapping("/{factoryId}/personnel/work-hours-ranking")
    @Operation(summary = "获取工时排行榜")
    public ApiResponse<List<MobileDTO.WorkHoursRankingItem>> getWorkHoursRanking(
            @PathVariable @Parameter(description = "工厂ID", required = true) String factoryId,
            @RequestParam @Parameter(description = "开始日期 YYYY-MM-DD", required = true) String startDate,
            @RequestParam @Parameter(description = "结束日期 YYYY-MM-DD", required = true) String endDate,
            @RequestParam(defaultValue = "10") @Parameter(description = "返回前N名") Integer limit) {
        log.info("获取工时排行: factoryId={}, startDate={}, endDate={}, limit={}", factoryId, startDate, endDate, limit);
        List<MobileDTO.WorkHoursRankingItem> ranking = mobileService.getWorkHoursRanking(factoryId, startDate, endDate, limit);
        return ApiResponse.success(ranking);
    }

    /**
     * 获取加班统计
     */
    @GetMapping("/{factoryId}/personnel/overtime-statistics")
    @Operation(summary = "获取加班统计")
    public ApiResponse<MobileDTO.OvertimeStatistics> getOvertimeStatistics(
            @PathVariable @Parameter(description = "工厂ID", required = true) String factoryId,
            @RequestParam @Parameter(description = "开始日期 YYYY-MM-DD", required = true) String startDate,
            @RequestParam @Parameter(description = "结束日期 YYYY-MM-DD", required = true) String endDate,
            @RequestParam(required = false) @Parameter(description = "部门ID筛选") String departmentId) {
        log.info("获取加班统计: factoryId={}, startDate={}, endDate={}, departmentId={}", factoryId, startDate, endDate, departmentId);
        MobileDTO.OvertimeStatistics statistics = mobileService.getOvertimeStatistics(factoryId, startDate, endDate, departmentId);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取人员绩效统计
     */
    @GetMapping("/{factoryId}/personnel/performance")
    @Operation(summary = "获取人员绩效统计")
    public ApiResponse<List<MobileDTO.PerformanceItem>> getPersonnelPerformance(
            @PathVariable @Parameter(description = "工厂ID", required = true) String factoryId,
            @RequestParam @Parameter(description = "开始日期 YYYY-MM-DD", required = true) String startDate,
            @RequestParam @Parameter(description = "结束日期 YYYY-MM-DD", required = true) String endDate,
            @RequestParam(required = false) @Parameter(description = "用户ID") Long userId) {
        log.info("获取人员绩效: factoryId={}, startDate={}, endDate={}, userId={}", factoryId, startDate, endDate, userId);
        List<MobileDTO.PerformanceItem> performance = mobileService.getPersonnelPerformance(factoryId, startDate, endDate, userId);
        return ApiResponse.success(performance);
    }

    // ==================== 成本对比接口 ====================

    /**
     * 获取批次成本对比数据
     */
    @GetMapping("/{factoryId}/processing/cost-comparison")
    @Operation(summary = "获取批次成本对比数据")
    public ApiResponse<List<MobileDTO.BatchCostData>> getBatchCostComparison(
            @PathVariable @Parameter(description = "工厂ID", required = true) String factoryId,
            @RequestParam @Parameter(description = "批次ID列表（逗号分隔）", required = true) String batchIds) {
        log.info("获取批次成本对比: factoryId={}, batchIds={}", factoryId, batchIds);

        // 解析批次ID列表
        List<String> batchIdList = Arrays.asList(batchIds.split(","));

        List<MobileDTO.BatchCostData> costData = mobileService.getBatchCostComparison(factoryId, batchIdList);
        return ApiResponse.success(costData);
    }

    // ==================== 设备告警接口 ====================
    // 注意: 获取告警列表已移至 EquipmentAlertsController

    /**
     * 确认设备告警
     */
    @PostMapping("/{factoryId}/equipment/alerts/{alertId}/acknowledge")
    @Operation(summary = "确认设备告警")
    public ApiResponse<MobileDTO.AlertResponse> acknowledgeAlert(
            @PathVariable @Parameter(description = "工厂ID", required = true) String factoryId,
            @PathVariable @Parameter(description = "告警ID（支持数字ID或动态ID如MAINT_1）", required = true) String alertId,
            @RequestBody(required = false) MobileDTO.AcknowledgeAlertRequest request,
            @RequestAttribute("userId") Long userId,
            @RequestAttribute("username") String username) {
        log.info("确认设备告警: factoryId={}, alertId={}, userId={}", factoryId, alertId, userId);

        MobileDTO.AlertResponse response = mobileService.acknowledgeAlert(factoryId, alertId, userId, username, request);
        return ApiResponse.success("告警已确认", response);
    }

    /**
     * 解决设备告警
     */
    @PostMapping("/{factoryId}/equipment/alerts/{alertId}/resolve")
    @Operation(summary = "解决设备告警")
    public ApiResponse<MobileDTO.AlertResponse> resolveAlert(
            @PathVariable @Parameter(description = "工厂ID", required = true) String factoryId,
            @PathVariable @Parameter(description = "告警ID（支持数字ID或动态ID如MAINT_1）", required = true) String alertId,
            @RequestBody(required = false) MobileDTO.ResolveAlertRequest request,
            @RequestAttribute("userId") Long userId,
            @RequestAttribute("username") String username) {
        log.info("解决设备告警: factoryId={}, alertId={}, userId={}", factoryId, alertId, userId);

        MobileDTO.AlertResponse response = mobileService.resolveAlert(factoryId, alertId, userId, username, request);
        return ApiResponse.success("告警已解决", response);
    }

    /**
     * 忽略设备告警
     */
    @PostMapping("/{factoryId}/equipment/alerts/{alertId}/ignore")
    @Operation(summary = "忽略设备告警", description = "标记告警为已忽略，不再显示在活跃告警列表中")
    public ApiResponse<MobileDTO.AlertResponse> ignoreAlert(
            @PathVariable @Parameter(description = "工厂ID", required = true) String factoryId,
            @PathVariable @Parameter(description = "告警ID", required = true) String alertId,
            @RequestBody(required = false) @Parameter(description = "忽略原因（可选）") MobileDTO.IgnoreAlertRequest request,
            @RequestAttribute("userId") Long userId,
            @RequestAttribute("username") String username) {
        log.info("忽略设备告警: factoryId={}, alertId={}, userId={}, reason={}",
                factoryId, alertId, userId, request != null ? request.getReason() : "未填写");

        // 解析alertId
        Integer alertIdInt;
        try {
            alertIdInt = Integer.parseInt(alertId);
        } catch (NumberFormatException e) {
            log.warn("alertId解析失败: {}", alertId);
            return ApiResponse.error(400, "无效的告警ID");
        }

        // 查找告警记录
        EquipmentAlert alert = equipmentAlertRepository.findByFactoryIdAndId(factoryId, alertIdInt)
                .orElseThrow(() -> new RuntimeException("告警不存在: alertId=" + alertId));

        // 检查状态
        if (alert.getStatus() == AlertStatus.IGNORED) {
            return ApiResponse.error(400, "该告警已被忽略");
        }

        // 更新为IGNORED状态
        alert.setStatus(AlertStatus.IGNORED);
        alert.setIgnoredAt(LocalDateTime.now());
        alert.setIgnoredBy(userId);
        alert.setIgnoredByName(username);
        if (request != null && request.getReason() != null) {
            alert.setIgnoreReason(request.getReason());
        }

        equipmentAlertRepository.save(alert);
        log.info("告警已忽略: alertId={}, userId={}", alertId, userId);

        // 构建响应
        MobileDTO.AlertResponse response = new MobileDTO.AlertResponse();
        response.setId(alert.getId());
        response.setFactoryId(alert.getFactoryId());
        response.setEquipmentId(alert.getEquipmentId() != null ? String.valueOf(alert.getEquipmentId()) : null);
        response.setAlertType(alert.getAlertType());
        response.setLevel(alert.getLevel().name());
        response.setStatus(alert.getStatus().name());
        response.setMessage(alert.getMessage());
        response.setDetails(alert.getDetails());
        response.setTriggeredAt(alert.getTriggeredAt() != null ? alert.getTriggeredAt().toString() : null);
        response.setIgnoredAt(alert.getIgnoredAt() != null ? alert.getIgnoredAt().toString() : null);
        response.setIgnoredBy(alert.getIgnoredByName());
        response.setIgnoreReason(alert.getIgnoreReason());

        return ApiResponse.success("告警已忽略", response);
    }

    /**
     * 获取设备告警统计信息
     */
    @GetMapping("/{factoryId}/equipment-alerts/statistics")
    @Operation(summary = "获取告警统计", description = "获取设备告警的统计信息，包括总数、按严重程度分类、按类型分类等")
    public ApiResponse<Map<String, Object>> getAlertStatistics(
            @PathVariable @Parameter(description = "工厂ID", required = true) String factoryId,
            @RequestParam(required = false, defaultValue = "week") @Parameter(description = "时间范围: today, week, month, all") String timeRange) {
        log.info("获取告警统计: factoryId={}, timeRange={}", factoryId, timeRange);

        // 查询所有告警
        List<EquipmentAlert> allAlerts = equipmentAlertRepository.findByFactoryIdOrderByTriggeredAtDesc(factoryId);

        Map<String, Object> statistics = new java.util.HashMap<>();

        // 总体统计
        long totalAlerts = allAlerts.size();
        long activeAlerts = allAlerts.stream().filter(a -> a.getStatus() == AlertStatus.ACTIVE).count();
        long resolvedAlerts = allAlerts.stream().filter(a -> a.getStatus() == AlertStatus.RESOLVED).count();
        long ignoredAlerts = allAlerts.stream().filter(a -> a.getStatus() == AlertStatus.IGNORED).count();
        long acknowledgedAlerts = allAlerts.stream().filter(a -> a.getStatus() == AlertStatus.ACKNOWLEDGED).count();

        statistics.put("totalAlerts", totalAlerts);
        statistics.put("activeAlerts", activeAlerts);
        statistics.put("resolvedAlerts", resolvedAlerts);
        statistics.put("ignoredAlerts", ignoredAlerts);
        statistics.put("acknowledgedAlerts", acknowledgedAlerts);

        // 按严重程度分类
        Map<String, Long> bySeverity = allAlerts.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        a -> a.getLevel().name().toLowerCase(),
                        java.util.stream.Collectors.counting()
                ));
        statistics.put("bySeverity", bySeverity);

        // 按类型分类
        Map<String, Long> byType = allAlerts.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        EquipmentAlert::getAlertType,
                        java.util.stream.Collectors.counting()
                ));
        statistics.put("byType", byType);

        // 按设备分类 (Top 5)
        Map<String, Long> byEquipment = allAlerts.stream()
                .filter(alert -> alert.getEquipmentId() != null)
                .collect(java.util.stream.Collectors.groupingBy(
                        alert -> String.valueOf(alert.getEquipmentId()),
                        java.util.stream.Collectors.counting()
                ))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .collect(java.util.LinkedHashMap::new,
                        (m, e) -> m.put(e.getKey(), e.getValue()),
                        LinkedHashMap::putAll);
        statistics.put("byEquipment", byEquipment);

        // 趋势数据（最近7天）
        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
        List<Map<String, Object>> trend = new java.util.ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            java.time.LocalDate date = java.time.LocalDate.now().minusDays(i);
            LocalDateTime dayStart = date.atStartOfDay();
            LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();

            long count = allAlerts.stream()
                    .filter(a -> a.getTriggeredAt() != null &&
                            !a.getTriggeredAt().isBefore(dayStart) &&
                            a.getTriggeredAt().isBefore(dayEnd))
                    .count();

            Map<String, Object> dayData = new java.util.HashMap<>();
            dayData.put("date", date.toString());
            dayData.put("count", count);
            trend.add(dayData);
        }
        statistics.put("trend", trend);

        // 计算平均响应时间（acknowledgedAt - triggeredAt）
        double avgResponseTime = allAlerts.stream()
                .filter(a -> a.getAcknowledgedAt() != null && a.getTriggeredAt() != null)
                .mapToLong(a -> java.time.Duration.between(a.getTriggeredAt(), a.getAcknowledgedAt()).toMinutes())
                .average()
                .orElse(0.0);
        statistics.put("avgResponseTime", Math.round(avgResponseTime));

        // 计算平均解决时间（resolvedAt - triggeredAt）
        double avgResolutionTime = allAlerts.stream()
                .filter(a -> a.getResolvedAt() != null && a.getTriggeredAt() != null)
                .mapToLong(a -> java.time.Duration.between(a.getTriggeredAt(), a.getResolvedAt()).toMinutes())
                .average()
                .orElse(0.0);
        statistics.put("avgResolutionTime", Math.round(avgResolutionTime));

        // 时间范围
        statistics.put("timeRange", timeRange);
        statistics.put("generatedAt", java.time.LocalDateTime.now());

        return ApiResponse.success(statistics);
    }

    // ========== 用户反馈管理 ==========
    // 注意：工厂设置相关API已迁移至 FactorySettingsController，避免路径冲突

    /**
     * 提交用户反馈
     */
    @PostMapping("/{factoryId}/feedback")
    @Operation(summary = "提交用户反馈")
    public ApiResponse<MobileDTO.FeedbackResponse> submitFeedback(
            @PathVariable @Parameter(description = "工厂ID", required = true) String factoryId,
            @RequestBody @Parameter(description = "反馈内容", required = true) MobileDTO.SubmitFeedbackRequest request,
            @RequestAttribute("userId") Long userId) {
        log.info("提交用户反馈: factoryId={}, userId={}, type={}", factoryId, userId, request.getType());

        MobileDTO.FeedbackResponse response = mobileService.submitFeedback(factoryId, request, userId);
        return ApiResponse.success("反馈提交成功", response);
    }
}