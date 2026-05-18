package com.cretas.aims.controller.hr;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.hr.AttendanceShift;
import com.cretas.aims.repository.hr.AttendanceShiftRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 班次定义 (Shift template) 列表查询 — read-only.
 *
 * <p>路径: {@code /api/mobile/{factoryId}/hr/attendance-shifts}
 *
 * <p>用途: 排班日历 (shift-calendar.vue) 顶部 palette 列出可分配的班次.
 * 班次新增/编辑暂未提供 (后续迭代; 当前班次需 DB 直接维护或 seed 注入).
 *
 * <p>RBAC: hr:read+ (任何 HR 角色可读)
 *
 * @author Cretas Team — #835 follow-up shift calendar UI
 * @since 2026-05-18
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/hr/attendance-shifts")
@RequiredArgsConstructor
@RequireModule("hr_employee")
public class AttendanceShiftController {

    private final AttendanceShiftRepository repository;

    /**
     * 列出工厂所有班次. activeOnly=true 仅返回 isActive=true (palette 默认).
     */
    @GetMapping
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> list(@PathVariable String factoryId,
                                  @RequestParam(defaultValue = "true") boolean activeOnly) {
        List<AttendanceShift> data = activeOnly
                ? repository.findByFactoryIdAndIsActiveTrue(factoryId)
                : repository.findByFactoryId(factoryId);
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }
}
