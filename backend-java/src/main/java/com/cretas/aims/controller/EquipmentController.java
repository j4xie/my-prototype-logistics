package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.equipment.CreateEquipmentRequest;
import com.cretas.aims.dto.equipment.EquipmentDTO;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.EquipmentService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * 设备管理控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/equipment")
@RequiredArgsConstructor
@Tag(name = "设备管理", description = "设备管理相关接口")
public class EquipmentController {

    private final EquipmentService equipmentService;
    private final MobileService mobileService;

    /**
     * 创建设备
     */
    @PostMapping
    @Operation(summary = "创建设备")
    public ApiResponse<EquipmentDTO> createEquipment(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreateEquipmentRequest request) {

        String token = TokenUtils.extractToken(authorization);
        Integer userId = mobileService.getUserFromToken(token).getId();

        log.info("创建设备: factoryId={}, name={}", factoryId, request.getName());
        EquipmentDTO equipment = equipmentService.createEquipment(factoryId, request, userId);
        return ApiResponse.success("设备创建成功", equipment);
    }

    /**
     * 更新设备
     */
    @PutMapping("/{equipmentId}")
    @Operation(summary = "更新设备")
    public ApiResponse<EquipmentDTO> updateEquipment(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId,
            @Valid @RequestBody CreateEquipmentRequest request) {

        log.info("更新设备: factoryId={}, equipmentId={}", factoryId, equipmentId);
        EquipmentDTO equipment = equipmentService.updateEquipment(factoryId, equipmentId, request);
        return ApiResponse.success("设备更新成功", equipment);
    }

    /**
     * 删除设备
     */
    @DeleteMapping("/{equipmentId}")
    @Operation(summary = "删除设备")
    public ApiResponse<Void> deleteEquipment(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId) {

        log.info("删除设备: factoryId={}, equipmentId={}", factoryId, equipmentId);
        equipmentService.deleteEquipment(factoryId, equipmentId);
        return ApiResponse.success("设备删除成功", null);
    }

    /**
     * 获取设备详情
     */
    @GetMapping("/{equipmentId}")
    @Operation(summary = "获取设备详情")
    public ApiResponse<EquipmentDTO> getEquipmentById(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId) {

        EquipmentDTO equipment = equipmentService.getEquipmentById(factoryId, equipmentId);
        return ApiResponse.success(equipment);
    }

    /**
     * 获取设备列表（分页）
     */
    @GetMapping
    @Operation(summary = "获取设备列表（分页）")
    public ApiResponse<PageResponse<EquipmentDTO>> getEquipmentList(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Valid PageRequest pageRequest) {

        PageResponse<EquipmentDTO> response = equipmentService.getEquipmentList(factoryId, pageRequest);
        return ApiResponse.success(response);
    }

    /**
     * 按状态获取设备
     */
    @GetMapping("/status/{status}")
    @Operation(summary = "按状态获取设备")
    public ApiResponse<List<EquipmentDTO>> getEquipmentByStatus(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备状态(idle/running/maintenance/scrapped)", required = true)
            @PathVariable @NotBlank String status) {

        List<EquipmentDTO> equipment = equipmentService.getEquipmentByStatus(factoryId, status);
        return ApiResponse.success(equipment);
    }

    /**
     * 按类型获取设备
     */
    @GetMapping("/type/{type}")
    @Operation(summary = "按类型获取设备")
    public ApiResponse<List<EquipmentDTO>> getEquipmentByType(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备类型", required = true)
            @PathVariable @NotBlank String type) {

        List<EquipmentDTO> equipment = equipmentService.getEquipmentByType(factoryId, type);
        return ApiResponse.success(equipment);
    }

    /**
     * 搜索设备
     */
    @GetMapping("/search")
    @Operation(summary = "搜索设备")
    public ApiResponse<List<EquipmentDTO>> searchEquipment(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "搜索关键词", required = true)
            @RequestParam @NotBlank String keyword) {

        List<EquipmentDTO> equipment = equipmentService.searchEquipment(factoryId, keyword);
        return ApiResponse.success(equipment);
    }

    /**
     * 更新设备状态
     */
    @PutMapping("/{equipmentId}/status")
    @Operation(summary = "更新设备状态")
    public ApiResponse<EquipmentDTO> updateEquipmentStatus(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId,
            @Parameter(description = "设备状态", required = true)
            @RequestParam @NotBlank String status) {

        log.info("更新设备状态: factoryId={}, equipmentId={}, status={}", factoryId, equipmentId, status);
        EquipmentDTO equipment = equipmentService.updateEquipmentStatus(factoryId, equipmentId, status);
        return ApiResponse.success("设备状态更新成功", equipment);
    }

    /**
     * 启动设备
     */
    @PostMapping("/{equipmentId}/start")
    @Operation(summary = "启动设备")
    public ApiResponse<EquipmentDTO> startEquipment(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId) {

        log.info("启动设备: factoryId={}, equipmentId={}", factoryId, equipmentId);
        EquipmentDTO equipment = equipmentService.startEquipment(factoryId, equipmentId);
        return ApiResponse.success("设备启动成功", equipment);
    }

    /**
     * 停止设备
     */
    @PostMapping("/{equipmentId}/stop")
    @Operation(summary = "停止设备")
    public ApiResponse<EquipmentDTO> stopEquipment(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId,
            @Parameter(description = "运行小时数")
            @RequestParam(required = false) Integer runningHours) {

        log.info("停止设备: factoryId={}, equipmentId={}, runningHours={}", factoryId, equipmentId, runningHours);
        EquipmentDTO equipment = equipmentService.stopEquipment(factoryId, equipmentId, runningHours);
        return ApiResponse.success("设备停止成功", equipment);
    }

    /**
     * 记录设备维护
     */
    @PostMapping("/{equipmentId}/maintenance")
    @Operation(summary = "记录设备维护")
    public ApiResponse<EquipmentDTO> recordMaintenance(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId,
            @Parameter(description = "维护日期", required = true)
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate maintenanceDate,
            @Parameter(description = "维护费用")
            @RequestParam(required = false) BigDecimal cost,
            @Parameter(description = "维护描述")
            @RequestParam(required = false) String description) {

        log.info("记录设备维护: factoryId={}, equipmentId={}, date={}", factoryId, equipmentId, maintenanceDate);
        EquipmentDTO equipment = equipmentService.recordMaintenance(factoryId, equipmentId, maintenanceDate, cost, description);
        return ApiResponse.success("维护记录成功", equipment);
    }

    /**
     * 获取需要维护的设备
     */
    @GetMapping("/needing-maintenance")
    @Operation(summary = "获取需要维护的设备")
    public ApiResponse<List<EquipmentDTO>> getEquipmentNeedingMaintenance(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        List<EquipmentDTO> equipment = equipmentService.getEquipmentNeedingMaintenance(factoryId);
        return ApiResponse.success(equipment);
    }

    /**
     * 获取保修即将到期的设备
     */
    @GetMapping("/expiring-warranty")
    @Operation(summary = "获取保修即将到期的设备")
    public ApiResponse<List<EquipmentDTO>> getEquipmentWithExpiringWarranty(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "提前天数", required = true)
            @RequestParam(defaultValue = "30") Integer daysAhead) {

        List<EquipmentDTO> equipment = equipmentService.getEquipmentWithExpiringWarranty(factoryId, daysAhead);
        return ApiResponse.success(equipment);
    }

    /**
     * 计算设备折旧后价值
     */
    @GetMapping("/{equipmentId}/depreciated-value")
    @Operation(summary = "计算设备折旧后价值")
    public ApiResponse<BigDecimal> calculateDepreciatedValue(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId) {

        BigDecimal value = equipmentService.calculateDepreciatedValue(factoryId, equipmentId);
        return ApiResponse.success(value);
    }

    /**
     * 获取设备统计信息
     */
    @GetMapping("/{equipmentId}/statistics")
    @Operation(summary = "获取设备统计信息")
    public ApiResponse<Map<String, Object>> getEquipmentStatistics(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId) {

        Map<String, Object> statistics = equipmentService.getEquipmentStatistics(factoryId, equipmentId);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取设备使用历史
     */
    @GetMapping("/{equipmentId}/usage-history")
    @Operation(summary = "获取设备使用历史")
    public ApiResponse<List<Map<String, Object>>> getEquipmentUsageHistory(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId) {

        List<Map<String, Object>> history = equipmentService.getEquipmentUsageHistory(factoryId, equipmentId);
        return ApiResponse.success(history);
    }

    /**
     * 获取设备维护历史
     */
    @GetMapping("/{equipmentId}/maintenance-history")
    @Operation(summary = "获取设备维护历史")
    public ApiResponse<List<Map<String, Object>>> getEquipmentMaintenanceHistory(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId) {

        List<Map<String, Object>> history = equipmentService.getEquipmentMaintenanceHistory(factoryId, equipmentId);
        return ApiResponse.success(history);
    }

    /**
     * 获取工厂设备总体统计
     */
    @GetMapping("/overall-statistics")
    @Operation(summary = "获取工厂设备总体统计")
    public ApiResponse<Map<String, Object>> getOverallEquipmentStatistics(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        Map<String, Object> statistics = equipmentService.getOverallEquipmentStatistics(factoryId);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取设备效率报告
     */
    @GetMapping("/{equipmentId}/efficiency-report")
    @Operation(summary = "获取设备效率报告")
    public ApiResponse<Map<String, Object>> getEquipmentEfficiencyReport(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId,
            @Parameter(description = "开始日期", required = true)
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期", required = true)
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        Map<String, Object> report = equipmentService.getEquipmentEfficiencyReport(factoryId, equipmentId, startDate, endDate);
        return ApiResponse.success(report);
    }

    /**
     * 从Excel文件批量导入设备
     */
    @PostMapping("/import")
    @Operation(summary = "从Excel文件批量导入设备")
    public ApiResponse<com.cretas.aims.dto.common.ImportResult<EquipmentDTO>> importEquipmentFromExcel(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "Excel文件", required = true)
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {

        log.info("从Excel批量导入设备: factoryId={}, filename={}", factoryId, file.getOriginalFilename());

        // 验证文件类型
        if (file.getOriginalFilename() == null || !file.getOriginalFilename().endsWith(".xlsx")) {
            return ApiResponse.error("只支持.xlsx格式的Excel文件");
        }

        // 验证文件大小（10MB限制）
        if (file.getSize() > 10 * 1024 * 1024) {
            return ApiResponse.error("文件大小不能超过10MB");
        }

        try {
            com.cretas.aims.dto.common.ImportResult<EquipmentDTO> result =
                    equipmentService.importEquipmentFromExcel(factoryId, file.getInputStream());

            if (result.getIsFullSuccess()) {
                log.info("设备批量导入完全成功: factoryId={}, count={}", factoryId, result.getSuccessCount());
                return ApiResponse.success("导入成功", result);
            } else {
                log.warn("设备批量导入部分失败: factoryId={}, success={}, failure={}",
                        factoryId, result.getSuccessCount(), result.getFailureCount());
                return ApiResponse.success(
                        String.format("导入完成：成功%d条，失败%d条",
                                result.getSuccessCount(), result.getFailureCount()),
                        result);
            }
        } catch (Exception e) {
            log.error("设备批量导入失败: factoryId={}", factoryId, e);
            return ApiResponse.error("导入失败: " + e.getMessage());
        }
    }

    /**
     * 导出设备列表
     */
    @GetMapping("/export")
    @Operation(summary = "导出设备列表")
    public ResponseEntity<byte[]> exportEquipmentList(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        log.info("导出设备列表: factoryId={}", factoryId);
        byte[] excelBytes = equipmentService.exportEquipmentList(factoryId);

        // 生成文件名（包含时间戳）
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = "设备列表_" + timestamp + ".xlsx";

        // 设置响应头
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", filename);
        headers.setContentLength(excelBytes.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(excelBytes);
    }

    /**
     * 下载设备导入模板
     */
    @GetMapping("/export/template")
    @Operation(summary = "下载设备导入模板")
    public ResponseEntity<byte[]> downloadEquipmentTemplate(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        log.info("下载设备导入模板: factoryId={}", factoryId);
        byte[] templateBytes = equipmentService.generateImportTemplate();

        // 设置文件名
        String filename = "设备导入模板.xlsx";

        // 设置响应头
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", filename);
        headers.setContentLength(templateBytes.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(templateBytes);
    }

    /**
     * 报废设备
     */
    @PostMapping("/{equipmentId}/scrap")
    @Operation(summary = "报废设备")
    public ApiResponse<EquipmentDTO> scrapEquipment(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId,
            @Parameter(description = "报废原因", required = true)
            @RequestParam @NotBlank String reason) {

        log.info("报废设备: factoryId={}, equipmentId={}, reason={}", factoryId, equipmentId, reason);
        EquipmentDTO equipment = equipmentService.scrapEquipment(factoryId, equipmentId, reason);
        return ApiResponse.success("设备报废成功", equipment);
    }

    /**
     * 计算设备OEE（整体设备效率）
     */
    @GetMapping("/{equipmentId}/oee")
    @Operation(summary = "计算设备OEE")
    public ApiResponse<Double> calculateOEE(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "设备ID", required = true)
            @PathVariable @NotBlank String equipmentId,
            @Parameter(description = "开始日期", required = true)
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期", required = true)
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        Double oee = equipmentService.calculateOEE(factoryId, equipmentId, startDate, endDate);
        return ApiResponse.success(oee);
    }
}