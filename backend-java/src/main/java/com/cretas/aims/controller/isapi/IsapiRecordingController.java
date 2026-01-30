package com.cretas.aims.controller.isapi;

import com.cretas.aims.dto.ApiResponse;
import com.cretas.aims.dto.isapi.RecordingSearchRequest;
import com.cretas.aims.dto.isapi.RecordingSearchResponse;
import com.cretas.aims.service.isapi.IsapiRecordingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * NVR 录像管理 API 控制器 (Phase 3)
 *
 * 提供录像检索、回放地址获取等功能
 *
 * @author Cretas Team
 * @since 2026-01-30
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/isapi/recordings")
@RequiredArgsConstructor
@Tag(name = "NVR 录像管理", description = "录像检索、回放地址获取")
public class IsapiRecordingController {

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
            return ApiResponse.error(response.getMessage());
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
            String playbackUrl;
            if (includeAuth) {
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
            result.put("includeAuth", includeAuth);

            return ApiResponse.success(result);

        } catch (Exception e) {
            log.error("获取回放地址失败: {}", e.getMessage(), e);
            return ApiResponse.error("获取回放地址失败: " + e.getMessage());
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
            return ApiResponse.error(response.getMessage());
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
            return ApiResponse.error(response.getMessage());
        }
    }
}
