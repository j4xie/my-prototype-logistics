package com.cretas.aims.controller;

import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.dto.scheduling.ConfirmUrgentInsertRequest;
import com.cretas.aims.dto.scheduling.GetInsertSlotsRequest;
import com.cretas.aims.dto.scheduling.InsertSlotDTO;
import com.cretas.aims.service.UrgentInsertService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 紧急插单控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/urgent-insert")
@RequiredArgsConstructor
@Tag(name = "紧急插单管理", description = "紧急插单时段查询、影响分析、确认插单")
public class UrgentInsertController {

    private final UrgentInsertService urgentInsertService;

    /**
     * 获取可用的插单时段列表
     */
    @PostMapping("/slots")
    @Operation(summary = "获取可插单时段", description = "根据产品类型、数量、交期查询可用的插单时段")
    public ResponseEntity<Map<String, Object>> getAvailableSlots(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Valid @RequestBody GetInsertSlotsRequest request) {

        log.info("获取插单时段: factoryId={}, productTypeId={}, requiredQuantity={}, deadline={}",
                factoryId, request.getProductTypeId(), request.getRequiredQuantity(), request.getDeadline());

        List<InsertSlotDTO> slots = urgentInsertService.getAvailableSlots(factoryId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", slots);
        response.put("message", "获取插单时段成功");
        response.put("total", slots.size());

        return ResponseEntity.ok(response);
    }

    /**
     * 分析插单影响
     */
    @PostMapping("/slots/{slotId}/analyze")
    @Operation(summary = "分析插单影响", description = "分析选择特定时段进行插单对现有计划的影响")
    public ResponseEntity<Map<String, Object>> analyzeImpact(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "时段ID") @PathVariable String slotId,
            @Valid @RequestBody GetInsertSlotsRequest request) {

        log.info("分析插单影响: factoryId={}, slotId={}", factoryId, slotId);

        Map<String, Object> analysis = urgentInsertService.analyzeInsertImpact(factoryId, slotId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", analysis);
        response.put("message", "影响分析完成");

        return ResponseEntity.ok(response);
    }

    /**
     * 确认紧急插单
     */
    @PostMapping("/confirm")
    @Operation(summary = "确认紧急插单", description = "确认选定的时段并创建生产计划")
    public ResponseEntity<Map<String, Object>> confirmInsert(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Valid @RequestBody ConfirmUrgentInsertRequest request,
            HttpServletRequest httpRequest) {

        Long userId = getUserId(httpRequest);
        log.info("确认紧急插单: factoryId={}, slotId={}, userId={}", factoryId, request.getSlotId(), userId);

        ProductionPlanDTO plan = urgentInsertService.confirmInsert(factoryId, userId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", plan);
        response.put("message", "紧急插单成功，已创建生产计划");

        return ResponseEntity.ok(response);
    }

    /**
     * 强制插入（需要审批）
     */
    @PostMapping("/force")
    @Operation(summary = "强制插入", description = "强制插入（跳过影响检查），生成待审批的生产计划")
    public ResponseEntity<Map<String, Object>> forceInsert(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Valid @RequestBody ConfirmUrgentInsertRequest request,
            HttpServletRequest httpRequest) {

        Long userId = getUserId(httpRequest);
        log.info("强制插单: factoryId={}, slotId={}, userId={}", factoryId, request.getSlotId(), userId);

        ProductionPlanDTO plan = urgentInsertService.forceInsert(factoryId, userId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", plan);
        response.put("message", "强制插单成功，等待审批");

        return ResponseEntity.ok(response);
    }

    /**
     * 获取时段详情
     */
    @GetMapping("/slots/{slotId}")
    @Operation(summary = "获取时段详情", description = "获取单个插单时段的详细信息")
    public ResponseEntity<Map<String, Object>> getSlotDetail(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "时段ID") @PathVariable String slotId) {

        log.info("获取时段详情: factoryId={}, slotId={}", factoryId, slotId);

        InsertSlotDTO slot = urgentInsertService.getSlotDetail(factoryId, slotId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", slot);
        response.put("message", "获取时段详情成功");

        return ResponseEntity.ok(response);
    }

    /**
     * 选中时段（锁定）
     */
    @PostMapping("/slots/{slotId}/select")
    @Operation(summary = "选中时段", description = "标记时段为已选中，防止其他用户同时选择")
    public ResponseEntity<Map<String, Object>> selectSlot(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "时段ID") @PathVariable String slotId) {

        log.info("选中时段: factoryId={}, slotId={}", factoryId, slotId);

        urgentInsertService.markSlotAsSelected(factoryId, slotId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "时段已锁定");

        return ResponseEntity.ok(response);
    }

    /**
     * 释放时段
     */
    @PostMapping("/slots/{slotId}/release")
    @Operation(summary = "释放时段", description = "释放已选中的时段，使其可以被其他用户选择")
    public ResponseEntity<Map<String, Object>> releaseSlot(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "时段ID") @PathVariable String slotId) {

        log.info("释放时段: factoryId={}, slotId={}", factoryId, slotId);

        urgentInsertService.releaseSlot(factoryId, slotId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "时段已释放");

        return ResponseEntity.ok(response);
    }

    /**
     * 生成/刷新插单时段
     */
    @PostMapping("/slots/generate")
    @Operation(summary = "生成插单时段", description = "根据当前排产情况生成可用的插单时段")
    public ResponseEntity<Map<String, Object>> generateSlots(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestParam(defaultValue = "24") int hoursAhead) {

        log.info("生成插单时段: factoryId={}, hoursAhead={}", factoryId, hoursAhead);

        int count = urgentInsertService.generateInsertSlots(factoryId, hoursAhead);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", Map.of("generatedCount", count));
        response.put("message", "已生成 " + count + " 个插单时段");

        return ResponseEntity.ok(response);
    }

    /**
     * 清理过期时段
     */
    @DeleteMapping("/slots/expired")
    @Operation(summary = "清理过期时段", description = "清理已过期的插单时段")
    public ResponseEntity<Map<String, Object>> cleanupExpiredSlots(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        log.info("清理过期时段: factoryId={}", factoryId);

        int count = urgentInsertService.cleanupExpiredSlots(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", Map.of("cleanedCount", count));
        response.put("message", "已清理 " + count + " 个过期时段");

        return ResponseEntity.ok(response);
    }

    /**
     * 获取紧急插单统计
     */
    @GetMapping("/statistics")
    @Operation(summary = "获取紧急插单统计", description = "获取紧急插单相关的统计信息")
    public ResponseEntity<Map<String, Object>> getStatistics(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        log.info("获取紧急插单统计: factoryId={}", factoryId);

        Map<String, Object> statistics = urgentInsertService.getUrgentInsertStatistics(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", statistics);
        response.put("message", "获取统计成功");

        return ResponseEntity.ok(response);
    }

    // ==================== 辅助方法 ====================

    /**
     * 从请求中获取用户ID
     */
    private Long getUserId(HttpServletRequest request) {
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
}
