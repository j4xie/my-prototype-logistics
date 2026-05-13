package com.cretas.aims.controller.isapi;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.isapi.RecordingSearchRequest;
import com.cretas.aims.dto.isapi.RecordingSearchResponse;
import com.cretas.aims.service.isapi.IsapiRecordingService;
import com.cretas.aims.utils.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import com.cretas.aims.util.ErrorSanitizer;
import com.cretas.aims.exception.BusinessException;

/**
 * NVR 录像管理 API 控制器 (Phase 3)
 *
 * 提供录像检索、回放地址获取等功能
 *
 * <h3>RBAC (PR #488 §F3 fix, 2026-05-13)</h3>
 * <ul>
 *   <li>类级 {@link RequirePermission}{@code ({"equipment:read_write"})} —
 *       所有 4 个端点都要求摄像头/设备读写权限 (factory_super_admin / equipment_admin / 等)。</li>
 *   <li>{@code GET /playback-url?includeAuth=true} 额外内联校验:
 *       含 RTSP 凭证的 URL 仅向 {@code factory_super_admin} / {@code equipment_admin}
 *       角色暴露; 其他持有 {@code equipment:read_write} 的角色 (如 dispatcher)
 *       将被强制降级为 {@code includeAuth=false}。</li>
 * </ul>
 *
 * @author Cretas Team
 * @since 2026-01-30
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/isapi/recordings")
@RequiredArgsConstructor
@RequirePermission({"equipment:read_write"})
@Tag(name = "NVR 录像管理", description = "录像检索、回放地址获取")
public class IsapiRecordingController {

    /**
     * 角色: 工厂总监 — 拥有工厂所有权限, 可见 RTSP 凭证。
     * 对应 {@code FactoryUserRole.factory_super_admin}。
     */
    private static final String ROLE_FACTORY_SUPER_ADMIN = "factory_super_admin";

    /**
     * 角色: 设备管理员 — 设备台账/维护/告警/凭证管理, 可见 RTSP 凭证。
     * 对应 {@code FactoryUserRole.equipment_admin}。
     */
    private static final String ROLE_EQUIPMENT_ADMIN = "equipment_admin";

    private final IsapiRecordingService recordingService;

    /**
     * 搜索录像
     */
    @PostMapping("/search")
    @Operation(summary = "搜索录像", description = "按时间段、通道搜索 NVR 历史录像")
    public ApiResponse<RecordingSearchResponse> searchRecordings(
            @PathVariable String factoryId,
            @Valid @RequestBody RecordingSearchRequest request) {

        log.info("[{}] 搜索录像: deviceId={}, {} ~ {}",
                factoryId, request.getDeviceId(), request.getStartTime(), request.getEndTime());

        RecordingSearchResponse response = recordingService.searchRecordings(request);

        if (response.isSuccess()) {
            return ApiResponse.success(response);
        } else {
            throw new BusinessException(400, response.getMessage());
        }
    }

    /**
     * 获取录像回放地址
     */
    @GetMapping("/playback-url")
    @Operation(summary = "获取回放地址", description = "获取指定时间段的 RTSP 回放地址")
    public ApiResponse<Map<String, Object>> getPlaybackUrl(
            @PathVariable String factoryId,
            @RequestParam String deviceId,
            @RequestParam Integer channelId,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime startTime,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime endTime,
            @RequestParam(defaultValue = "false") boolean includeAuth) {

        log.info("[{}] 获取回放地址: deviceId={}, channelId={}, {} ~ {}",
                factoryId, deviceId, channelId, startTime, endTime);

        try {
            // PR #488 §F3 fix (P1 privacy): 含 RTSP 凭证的 URL 仅向高权限角色暴露。
            // 类级 @RequirePermission({"equipment:read_write"}) 已拦截非设备角色;
            // 这里进一步限制 includeAuth=true (URL 内嵌 username:password) 仅给
            // factory_super_admin / equipment_admin。其他角色 (如 dispatcher) 即便
            // 在请求中传 includeAuth=true, 也强制降级到 includeAuth=false 路径。
            boolean credentialsAllowed = includeAuth && (
                    SecurityUtils.hasRole(ROLE_FACTORY_SUPER_ADMIN)
                            || SecurityUtils.hasRole(ROLE_EQUIPMENT_ADMIN));
            if (includeAuth && !credentialsAllowed) {
                log.warn("[{}] 拒绝向当前用户暴露 RTSP 凭证 — username={}, 强制 includeAuth=false",
                        factoryId, SecurityUtils.getCurrentUsername());
            }

            String playbackUrl;
            if (credentialsAllowed) {
                playbackUrl = recordingService.getPlaybackUrl(deviceId, channelId, startTime, endTime);
            } else {
                playbackUrl = recordingService.getPlaybackUrlWithoutAuth(deviceId, channelId, startTime, endTime);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("playbackUrl", playbackUrl);
            result.put("deviceId", deviceId);
            result.put("channelId", channelId);
            result.put("startTime", startTime);
            result.put("endTime", endTime);
            // 暴露实际使用的 includeAuth 值 (可能被降级), 让前端感知凭证未注入。
            result.put("includeAuth", credentialsAllowed);

            return ApiResponse.success(result);

        } catch (BusinessException be) {
            throw be;


        } catch (Exception e) {
            log.error("获取回放地址失败: {}", e.getMessage(), e);
            throw new BusinessException(500, "获取回放地址失败: " + ErrorSanitizer.sanitize(e), e);
        }
    }

    /**
     * 快速搜索最近的录像
     */
    @GetMapping("/recent")
    @Operation(summary = "搜索最近录像", description = "搜索指定设备最近 N 小时的录像")
    public ApiResponse<RecordingSearchResponse> searchRecentRecordings(
            @PathVariable String factoryId,
            @RequestParam String deviceId,
            @RequestParam(defaultValue = "1") Integer channelId,
            @RequestParam(defaultValue = "1") Integer hours,
            @RequestParam(defaultValue = "50") Integer maxResults) {

        log.info("[{}] 搜索最近录像: deviceId={}, channelId={}, hours={}",
                factoryId, deviceId, channelId, hours);

        LocalDateTime endTime = LocalDateTime.now();
        LocalDateTime startTime = endTime.minusHours(hours);

        RecordingSearchRequest request = RecordingSearchRequest.builder()
                .deviceId(deviceId)
                .channelIds(java.util.List.of(channelId))
                .startTime(startTime)
                .endTime(endTime)
                .maxResults(maxResults)
                .build();

        RecordingSearchResponse response = recordingService.searchRecordings(request);

        if (response.isSuccess()) {
            return ApiResponse.success(response);
        } else {
            throw new BusinessException(400, response.getMessage());
        }
    }

    /**
     * 搜索指定日期的录像
     */
    @GetMapping("/by-date")
    @Operation(summary = "搜索指定日期录像", description = "搜索指定日期的全天录像")
    public ApiResponse<RecordingSearchResponse> searchRecordingsByDate(
            @PathVariable String factoryId,
            @RequestParam String deviceId,
            @RequestParam(defaultValue = "1") Integer channelId,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") java.time.LocalDate date,
            @RequestParam(defaultValue = "100") Integer maxResults) {

        log.info("[{}] 搜索指定日期录像: deviceId={}, channelId={}, date={}",
                factoryId, deviceId, channelId, date);

        LocalDateTime startTime = date.atStartOfDay();
        LocalDateTime endTime = date.atTime(23, 59, 59);

        RecordingSearchRequest request = RecordingSearchRequest.builder()
                .deviceId(deviceId)
                .channelIds(java.util.List.of(channelId))
                .startTime(startTime)
                .endTime(endTime)
                .maxResults(maxResults)
                .build();

        RecordingSearchResponse response = recordingService.searchRecordings(request);

        if (response.isSuccess()) {
            return ApiResponse.success(response);
        } else {
            throw new BusinessException(400, response.getMessage());
        }
    }
}
