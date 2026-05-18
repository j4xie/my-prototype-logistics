package com.cretas.aims.controller.datacenter;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.datacenter.OperationLog;
import com.cretas.aims.repository.datacenter.OperationLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.cretas.aims.config.RequireRole;

import java.time.LocalDateTime;

/**
 * 操作日志查询 — 系统操作日志独立 menu.
 *
 * <p>Sprint 4 Chat K C-LOG-AUDIT-1. 列表 + filter (module/action/user/entity/time-range).
 * Vue OperationLog.vue 用此接口拉数据.
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/operation-logs")
@RequiredArgsConstructor
public class OperationLogController {

    private final OperationLogRepository repo;

    /**
     * 分页 + 多维 filter 查询. 所有 query param 可空即不过滤.
     *
     * @param factoryId  路径
     * @param module     业务模块筛选 (CUSTOMER / MATERIAL / ...)
     * @param action     操作类型 (CREATE / UPDATE / DELETE / EXPORT / IMPORT / OTHER)
     * @param userId     操作人 ID
     * @param entityType Entity 简单类名 (Customer / MaterialBatch / ...)
     * @param entityId   Entity 主键
     * @param start      起始时间 (ISO-8601)
     * @param end        结束时间 (ISO-8601)
     * @param page       页码 (0-based)
     * @param size       每页条数 (default 50, max 200)
     */
    @GetMapping
    @RequireRole({"factory_super_admin", "permission_admin"})
    public ResponseEntity<ApiResponse<Page<OperationLog>>> list(
            @PathVariable String factoryId,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        int safeSize = Math.min(Math.max(size, 1), 200);
        Page<OperationLog> result = repo.findByFilters(
                factoryId, module, action, userId, entityType, entityId, start, end,
                PageRequest.of(Math.max(page, 0), safeSize));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /** 查看单条日志 (含 diff JSONB 详情). */
    @GetMapping("/{logId}")
    @RequireRole({"factory_super_admin", "permission_admin"})
    public ResponseEntity<ApiResponse<OperationLog>> get(
            @PathVariable String factoryId,
            @PathVariable Long logId) {
        return repo.findById(logId)
                .filter(o -> factoryId.equals(o.getFactoryId()))
                .map(o -> ResponseEntity.ok(ApiResponse.success(o)))
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.error("日志不存在或无权访问")));
    }
}
