package com.cretas.aims.controller.hr;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.hr.AttendanceShift;
import com.cretas.aims.entity.hr.EmployeeShiftAssignment;
import com.cretas.aims.entity.hr.enums.ShiftAssignmentStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.hr.AttendanceShiftRepository;
import com.cretas.aims.repository.hr.EmployeeShiftAssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 员工排班分配 (User × Date × Shift) REST API — 排班日历支撑.
 *
 * <p>路径: {@code /api/mobile/{factoryId}/hr/shift-assignments}
 *
 * <p>核心场景 (shift-calendar.vue 月视图):
 * <ul>
 *   <li>GET ?startDate=&endDate= → 加载月度全部分配 (左轴=员工, 横轴=日期)</li>
 *   <li>POST (单格 upsert) → 点击 cell 设置/改班次 (R4 幂等: 同 user-date 已有则覆盖 shiftId/notes)</li>
 *   <li>POST /bulk → 批量分配 (一员工一日期段一班次, 自动 upsert)</li>
 *   <li>DELETE /{id} → 清除某 cell 排班</li>
 * </ul>
 *
 * <p>RBAC: 查询 hr:read+, 写操作 hr:read_write.
 *
 * <p>该 controller 直接使用 repository — 无独立 Service (#835 follow-up scope: frontend-only).
 * 后续迭代如需 EventListener / cross-cutting 校验 (e.g. 排班冲突自动 detect, 工时上限),
 * 抽 EmployeeShiftAssignmentService.
 *
 * @author Cretas Team — #835 follow-up shift calendar UI
 * @since 2026-05-18
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/hr/shift-assignments")
@RequiredArgsConstructor
@RequireModule("hr_employee")
public class EmployeeShiftAssignmentController {

    private final EmployeeShiftAssignmentRepository assignmentRepository;
    private final AttendanceShiftRepository shiftRepository;

    /**
     * 列出工厂在 [startDate, endDate] 内的全部排班 (用于月视图日历).
     * 可选 userId filter — 只看某员工.
     */
    @GetMapping
    @RequirePermission({"hr:read", "hr:read_write"})
    public ResponseEntity<?> list(@PathVariable String factoryId,
                                  @RequestParam String startDate,
                                  @RequestParam String endDate,
                                  @RequestParam(required = false) Long userId) {
        LocalDate start = parseDate(startDate, "startDate");
        LocalDate end = parseDate(endDate, "endDate");
        if (start.isAfter(end)) {
            throw new BusinessException("startDate 必须 <= endDate");
        }
        List<EmployeeShiftAssignment> rows = (userId != null)
                ? assignmentRepository.findByFactoryIdAndUserIdAndWorkDateBetween(factoryId, userId, start, end)
                : assignmentRepository.findByFactoryIdAndWorkDateBetween(factoryId, start, end);
        return ResponseEntity.ok(Map.of("success", true, "data", rows));
    }

    /**
     * 单格 upsert — 给某员工某天分配某班次 (R4 幂等: 已存在覆盖).
     * Body: {userId, workDate (YYYY-MM-DD), shiftId, notes?}
     */
    @PostMapping
    @Transactional
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> upsert(@PathVariable String factoryId,
                                    @RequestBody Map<String, Object> body) {
        Long userId = parseUserId(body.get("userId"));
        LocalDate workDate = parseDate((String) body.get("workDate"), "workDate");
        String shiftId = (String) body.get("shiftId");
        String notes = (String) body.get("notes");

        AttendanceShift shift = requireShift(factoryId, shiftId);

        EmployeeShiftAssignment saved = upsertOne(factoryId, userId, workDate, shift.getId(), notes);
        return ResponseEntity.ok(Map.of("success", true, "data", saved, "message", "已保存"));
    }

    /**
     * 批量分配 — 一员工 OR 多员工, 日期段, 单一班次.
     * Body: {userIds: [Long], dates: [YYYY-MM-DD], shiftId, notes?}
     *
     * <p>R1 防呆: 调用方需明确批量范围, 后端 enforce 任何一格已有都覆盖 (upsert).
     * 返回 {created: int, updated: int, total: int}.
     */
    @PostMapping("/bulk")
    @Transactional
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> bulkAssign(@PathVariable String factoryId,
                                        @RequestBody Map<String, Object> body) {
        Object userIdsObj = body.get("userIds");
        Object datesObj = body.get("dates");
        String shiftId = (String) body.get("shiftId");
        String notes = (String) body.get("notes");

        if (!(userIdsObj instanceof List<?> userIdsRaw) || userIdsRaw.isEmpty()) {
            throw new BusinessException("userIds 必填 (非空数组)");
        }
        if (!(datesObj instanceof List<?> datesRaw) || datesRaw.isEmpty()) {
            throw new BusinessException("dates 必填 (非空数组, 元素 YYYY-MM-DD)");
        }
        AttendanceShift shift = requireShift(factoryId, shiftId);

        int created = 0;
        int updated = 0;
        List<EmployeeShiftAssignment> savedRows = new ArrayList<>();
        for (Object u : userIdsRaw) {
            Long uid = parseUserId(u);
            for (Object d : datesRaw) {
                LocalDate wd = parseDate((String) d, "dates 元素");
                Optional<EmployeeShiftAssignment> existing = assignmentRepository
                        .findByFactoryIdAndUserIdAndWorkDate(factoryId, uid, wd);
                if (existing.isPresent()) {
                    updated++;
                } else {
                    created++;
                }
                savedRows.add(upsertOne(factoryId, uid, wd, shift.getId(), notes));
            }
        }
        Map<String, Object> result = new HashMap<>();
        result.put("total", savedRows.size());
        result.put("created", created);
        result.put("updated", updated);
        result.put("rows", savedRows);
        return ResponseEntity.ok(Map.of("success", true, "data", result,
                "message", String.format("批量保存完成: 新增 %d, 覆盖 %d, 合计 %d", created, updated, savedRows.size())));
    }

    /**
     * 删除某员工某天的排班 (按 id 删).
     */
    @DeleteMapping("/{id}")
    @Transactional
    @RequirePermission({"hr:read_write"})
    public ResponseEntity<?> delete(@PathVariable String factoryId, @PathVariable String id) {
        Optional<EmployeeShiftAssignment> existing = assignmentRepository.findById(id);
        if (existing.isEmpty() || !existing.get().getFactoryId().equals(factoryId)) {
            return ResponseEntity.status(404)
                    .body(Map.of("success", false, "message", "排班记录不存在"));
        }
        assignmentRepository.delete(existing.get());
        return ResponseEntity.ok(Map.of("success", true, "message", "已清除排班"));
    }

    // ===================== private helpers =====================

    private EmployeeShiftAssignment upsertOne(String factoryId, Long userId, LocalDate workDate,
                                              String shiftId, String notes) {
        Optional<EmployeeShiftAssignment> existing = assignmentRepository
                .findByFactoryIdAndUserIdAndWorkDate(factoryId, userId, workDate);
        if (existing.isPresent()) {
            EmployeeShiftAssignment row = existing.get();
            row.setShiftId(shiftId);
            if (notes != null) row.setNotes(notes);
            // 重新分配 → 重置 SCHEDULED 状态 (旧 detect 结果应通过 re-detect 覆盖)
            row.setStatus(ShiftAssignmentStatus.SCHEDULED);
            return assignmentRepository.save(row);
        }
        EmployeeShiftAssignment created = EmployeeShiftAssignment.builder()
                .factoryId(factoryId)
                .userId(userId)
                .workDate(workDate)
                .shiftId(shiftId)
                .notes(notes)
                .status(ShiftAssignmentStatus.SCHEDULED)
                .build();
        return assignmentRepository.save(created);
    }

    private AttendanceShift requireShift(String factoryId, String shiftId) {
        if (shiftId == null || shiftId.isBlank()) {
            throw new BusinessException("shiftId 必填");
        }
        return shiftRepository.findByIdAndFactoryId(shiftId, factoryId)
                .orElseThrow(() -> new BusinessException("班次不存在或不属于该工厂: " + shiftId));
    }

    private LocalDate parseDate(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(fieldName + " 必填 (YYYY-MM-DD)");
        }
        try {
            return LocalDate.parse(value);
        } catch (Exception e) {
            throw new BusinessException(fieldName + " 格式必须 YYYY-MM-DD, 当前=" + value);
        }
    }

    private Long parseUserId(Object value) {
        if (value == null) {
            throw new BusinessException("userId 必填");
        }
        if (value instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            throw new BusinessException("userId 必须为数字, 当前=" + value);
        }
    }
}
