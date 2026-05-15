package com.cretas.aims.controller.integration;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.dingtalk.DingTalkSendRequest;
import com.cretas.aims.entity.integration.DingTalkWebhookLog;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Direction;
import com.cretas.aims.entity.integration.DingTalkWebhookLog.Status;
import com.cretas.aims.repository.DingTalkWebhookLogRepository;
import com.cretas.aims.service.dingtalk.DingTalkSendService;
import com.cretas.aims.service.dingtalk.DingTalkSendService.SendResult;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Admin endpoints for DingTalk webhook log audit + manual retry +
 * manual push. Protected by JWT (path starts with {@code /api/mobile/**},
 * picked up by {@link com.cretas.aims.config.WebMvcConfig} JWT interceptor)
 * plus per-method {@link RequirePermission}.
 *
 * <p>Endpoints (per Brief §Day 5 + SCHEMA_DESIGN §2.4 API table):
 * <ul>
 *   <li>{@code POST /send} — admin pushes a message into a group</li>
 *   <li>{@code GET /logs} — paginated audit list (optional direction filter)</li>
 *   <li>{@code GET /logs/{id}} — single log detail</li>
 *   <li>{@code POST /logs/{id}/retry} — manual retry of an OUTBOUND log
 *       (resets status to PENDING and re-dispatches via send service)</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/dingtalk")
@RequiredArgsConstructor
public class DingTalkAdminController {

    private final DingTalkWebhookLogRepository logRepository;
    private final DingTalkSendService sendService;

    @PostMapping("/send")
    @RequirePermission({"ai:dingtalk:send"})
    public ResponseEntity<ApiResponse<Map<String, Object>>> send(
            @PathVariable String factoryId,
            @RequestBody @Valid DingTalkSendRequest request) {

        DingTalkWebhookLog outbound = DingTalkWebhookLog.builder()
                .factoryId(factoryId)
                .direction(Direction.OUTBOUND)
                .messageType(request.getMessageType() != null ? request.getMessageType() : "ANNOUNCE")
                .dingtalkChatId(request.getChatId())
                .dingtalkUserId(request.getAtUserId())
                .messageContent(request.getContent())
                .status(Status.PENDING)
                .build();
        outbound = logRepository.save(outbound);

        SendResult result = sendService.send(outbound);

        Map<String, Object> payload = new HashMap<>();
        payload.put("logId", outbound.getId());
        payload.put("status", outbound.getStatus().name());
        payload.put("sendResult", result.getKind().name());
        if (result.getReason() != null) payload.put("reason", result.getReason());

        return ResponseEntity.ok(ApiResponse.success(payload));
    }

    @GetMapping("/logs")
    @RequirePermission({"ai:audit:view"})
    public ResponseEntity<ApiResponse<Page<DingTalkWebhookLog>>> listLogs(
            @PathVariable String factoryId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {

        int cappedSize = Math.min(Math.max(size, 1), 200);
        Page<DingTalkWebhookLog> result = logRepository.findByFactoryIdOrderByReceivedAtDesc(
                factoryId, PageRequest.of(Math.max(page, 0), cappedSize));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/logs/{id}")
    @RequirePermission({"ai:audit:view"})
    public ResponseEntity<ApiResponse<DingTalkWebhookLog>> getLog(
            @PathVariable String factoryId,
            @PathVariable Long id) {
        return logRepository.findById(id)
                .filter(l -> factoryId.equals(l.getFactoryId()))
                .map(l -> ResponseEntity.ok(ApiResponse.success(l)))
                .orElse(ResponseEntity.status(404).body(
                        ApiResponse.error("DingTalk webhook log not found: id=" + id)));
    }

    @PostMapping("/logs/{id}/retry")
    @RequirePermission({"ai:dingtalk:send"})
    public ResponseEntity<ApiResponse<Map<String, Object>>> retry(
            @PathVariable String factoryId,
            @PathVariable Long id) {

        DingTalkWebhookLog log = logRepository.findById(id).orElse(null);
        if (log == null || !factoryId.equals(log.getFactoryId())) {
            return ResponseEntity.status(404).body(
                    ApiResponse.error("DingTalk webhook log not found: id=" + id));
        }
        if (log.getDirection() != Direction.OUTBOUND) {
            return ResponseEntity.badRequest().body(
                    ApiResponse.error("only OUTBOUND logs can be retried"));
        }

        log.setStatus(Status.PENDING);
        log.setNextRetryAt(null);
        SendResult result = sendService.send(log);

        Map<String, Object> payload = new HashMap<>();
        payload.put("logId", log.getId());
        payload.put("status", log.getStatus().name());
        payload.put("sendResult", result.getKind().name());
        if (result.getReason() != null) payload.put("reason", result.getReason());

        return ResponseEntity.ok(ApiResponse.success(payload));
    }
}
