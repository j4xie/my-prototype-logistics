package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.ProductionLineSupervisor;
import com.cretas.aims.service.ProductionLineSupervisorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 产线-车间主任配置控制器
 * 管理后台使用：配置每条产线由哪个车间主任负责
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/production-lines")
@RequiredArgsConstructor
@Tag(name = "产线主任配置", description = "配置产线与车间主任的关联关系")
public class ProductionLineSupervisorController {

    private final ProductionLineSupervisorService supervisorService;

    /**
     * 获取产线的负责人列表
     */
    @GetMapping("/{lineId}/supervisors")
    @Operation(summary = "获取产线负责人列表")
    public ApiResponse<List<ProductionLineSupervisor>> getSupervisors(
            @PathVariable String factoryId,
            @PathVariable String lineId) {
        log.info("获取产线负责人: factoryId={}, lineId={}", factoryId, lineId);
        List<ProductionLineSupervisor> supervisors = supervisorService.getSupervisorsByLine(factoryId, lineId);
        return ApiResponse.success("获取成功", supervisors);
    }

    /**
     * 分配产线负责人
     */
    @PostMapping("/{lineId}/supervisors")
    @Operation(summary = "分配产线负责人")
    public ApiResponse<ProductionLineSupervisor> assignSupervisor(
            @PathVariable String factoryId,
            @PathVariable String lineId,
            @RequestParam Long userId,
            @RequestParam(defaultValue = "false") boolean isPrimary) {
        log.info("分配产线负责人: factoryId={}, lineId={}, userId={}, isPrimary={}",
                 factoryId, lineId, userId, isPrimary);
        ProductionLineSupervisor supervisor = supervisorService.assignSupervisor(factoryId, lineId, userId, isPrimary);
        return ApiResponse.success("分配成功", supervisor);
    }

    /**
     * 移除产线负责人
     */
    @DeleteMapping("/{lineId}/supervisors/{userId}")
    @Operation(summary = "移除产线负责人")
    public ApiResponse<Void> removeSupervisor(
            @PathVariable String factoryId,
            @PathVariable String lineId,
            @PathVariable Long userId) {
        log.info("移除产线负责人: factoryId={}, lineId={}, userId={}", factoryId, lineId, userId);
        supervisorService.removeSupervisor(lineId, userId);
        return ApiResponse.success("移除成功", null);
    }
}
