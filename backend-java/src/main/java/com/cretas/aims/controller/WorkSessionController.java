package com.cretas.aims.controller;

import com.cretas.aims.entity.EmployeeWorkSession;
import com.cretas.aims.service.EmployeeWorkSessionService;
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
 * 员工工作会话控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/work-sessions")
@RequiredArgsConstructor
public class WorkSessionController {

    private final EmployeeWorkSessionService workSessionService;

    /**
     * 获取工作会话列表（分页）
     */
    @GetMapping
    public ResponseEntity<?> getWorkSessions(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        try {
            Page<EmployeeWorkSession> sessions;
            if (status != null && !status.isEmpty()) {
                sessions = workSessionService.getByFactoryIdAndStatus(factoryId, status, page, size);
            } else {
                sessions = workSessionService.getByFactoryId(factoryId, page, size);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", sessions.getContent());
            response.put("page", page);
            response.put("size", size);
            response.put("totalElements", sessions.getTotalElements());
            response.put("totalPages", sessions.getTotalPages());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("获取工作会话失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取单个工作会话
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getWorkSession(
            @PathVariable String factoryId,
            @PathVariable Long id) {
        try {
            return workSessionService.getById(id)
                    .map(session -> ResponseEntity.ok(Map.of(
                        "success", true,
                        "data", session
                    )))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            log.error("获取工作会话失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 开始工作会话
     */
    @PostMapping("/start")
    public ResponseEntity<?> startSession(
            @PathVariable String factoryId,
            @RequestBody EmployeeWorkSession session) {
        try {
            session.setFactoryId(factoryId);
            EmployeeWorkSession started = workSessionService.startSession(session);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", started,
                "message", "工作会话已开始"
            ));
        } catch (IllegalStateException e) {
            log.warn("开始工作会话被拒绝: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("开始工作会话失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 结束工作会话
     */
    @PutMapping("/{id}/end")
    public ResponseEntity<?> endSession(
            @PathVariable String factoryId,
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            Integer breakMinutes = body != null ? (Integer) body.get("breakMinutes") : null;
            String notes = body != null ? (String) body.get("notes") : null;

            EmployeeWorkSession ended = workSessionService.endSession(id, breakMinutes, notes);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", ended,
                "message", "工作会话已结束"
            ));
        } catch (IllegalStateException e) {
            log.warn("结束工作会话被拒绝: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("结束工作会话失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 取消工作会话
     */
    @PutMapping("/{id}/cancel")
    public ResponseEntity<?> cancelSession(
            @PathVariable String factoryId,
            @PathVariable Long id) {
        try {
            EmployeeWorkSession cancelled = workSessionService.cancelSession(id);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", cancelled,
                "message", "工作会话已取消"
            ));
        } catch (IllegalStateException e) {
            log.warn("取消工作会话被拒绝: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("取消工作会话失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 更新工作会话
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateSession(
            @PathVariable String factoryId,
            @PathVariable Long id,
            @RequestBody EmployeeWorkSession updateData) {
        try {
            EmployeeWorkSession updated = workSessionService.updateSession(id, updateData);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", updated,
                "message", "工作会话更新成功"
            ));
        } catch (IllegalStateException e) {
            log.warn("更新工作会话被拒绝: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("更新工作会话失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取用户当前活跃会话
     */
    @GetMapping("/active/{userId}")
    public ResponseEntity<?> getActiveSession(
            @PathVariable String factoryId,
            @PathVariable Long userId) {
        try {
            return workSessionService.getActiveSession(factoryId, userId)
                    .map(session -> {
                        Map<String, Object> response = new HashMap<>();
                        response.put("success", true);
                        response.put("data", session);
                        return ResponseEntity.ok(response);
                    })
                    .orElseGet(() -> {
                        Map<String, Object> response = new HashMap<>();
                        response.put("success", true);
                        response.put("data", null);
                        response.put("message", "用户没有活跃的工作会话");
                        return ResponseEntity.ok(response);
                    });
        } catch (Exception e) {
            log.error("获取用户活跃会话失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取用户工作会话列表
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserSessions(
            @PathVariable String factoryId,
            @PathVariable Long userId) {
        try {
            List<EmployeeWorkSession> sessions = workSessionService.getByUserId(userId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", sessions
            ));
        } catch (Exception e) {
            log.error("获取用户工作会话失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 按时间范围查询
     */
    @GetMapping("/date-range")
    public ResponseEntity<?> getByDateRange(
            @PathVariable String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        try {
            List<EmployeeWorkSession> sessions = workSessionService.getByTimeRange(factoryId, startTime, endTime);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", sessions
            ));
        } catch (Exception e) {
            log.error("按时间范围查询工作会话失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 按工作类型查询
     */
    @GetMapping("/work-type/{workTypeId}")
    public ResponseEntity<?> getByWorkType(
            @PathVariable String factoryId,
            @PathVariable Integer workTypeId) {
        try {
            List<EmployeeWorkSession> sessions = workSessionService.getByWorkType(factoryId, workTypeId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", sessions
            ));
        } catch (Exception e) {
            log.error("按工作类型查询工作会话失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取工作会话统计
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(
            @PathVariable String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        try {
            Map<String, Object> stats = workSessionService.getSessionStats(factoryId, startTime, endTime);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", stats
            ));
        } catch (Exception e) {
            log.error("获取工作会话统计失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    /**
     * 获取用户工时统计
     */
    @GetMapping("/user/{userId}/stats")
    public ResponseEntity<?> getUserStats(
            @PathVariable String factoryId,
            @PathVariable Long userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        try {
            Map<String, Object> stats = workSessionService.getUserWorkStats(userId, startTime, endTime);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data", stats
            ));
        } catch (Exception e) {
            log.error("获取用户工时统计失败", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }
}
