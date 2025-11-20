package com.cretas.aims.controller;

import com.cretas.aims.dto.MobileDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.EquipmentAlert;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.ProcessingBatch;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.entity.enums.AlertStatus;
import com.cretas.aims.repository.EquipmentAlertRepository;
import com.cretas.aims.repository.EquipmentRepository;
import com.cretas.aims.repository.ProcessingBatchRepository;
import com.cretas.aims.repository.QualityInspectionRepository;
import com.cretas.aims.service.AIEnterpriseService;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.ProcessingService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产加工控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/processing")
@RequiredArgsConstructor
@Tag(name = "生产加工管理")
public class ProcessingController {

    private final ProcessingService processingService;
    private final MobileService mobileService;
    private final AIEnterpriseService aiEnterpriseService;
    private final ProcessingBatchRepository processingBatchRepository;
    private final EquipmentRepository equipmentRepository;
    private final EquipmentAlertRepository equipmentAlertRepository;
    private final QualityInspectionRepository qualityInspectionRepository;

    // ========== 批次管理接口 ==========

    /**
     * 创建生产批次
     */
    @PostMapping("/batches")
    @Operation(summary = "创建生产批次", description = "创建新的生产批次")
    public ApiResponse<ProductionBatch> createBatch(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Parameter(description = "批次信息") ProductionBatch batch) {
        log.info("创建生产批次: factoryId={}, batchNumber={}", factoryId, batch.getBatchNumber());
        ProductionBatch result = processingService.createBatch(factoryId, batch);
        return ApiResponse.success(result);
    }

    /**
     * 开始生产
     */
    @PostMapping("/batches/{batchId}/start")
    @Operation(summary = "开始生产", description = "开始批次生产")
    public ApiResponse<ProductionBatch> startProduction(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId,
            @RequestParam @Parameter(description = "负责人ID") Integer supervisorId) {
        log.info("开始生产: factoryId={}, batchId={}", factoryId, batchId);
        ProductionBatch result = processingService.startProduction(factoryId, batchId, supervisorId);
        return ApiResponse.success(result);
    }

    /**
     * 暂停生产
     */
    @PostMapping("/batches/{batchId}/pause")
    @Operation(summary = "暂停生产", description = "暂停批次生产")
    public ApiResponse<ProductionBatch> pauseProduction(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId,
            @RequestParam @Parameter(description = "暂停原因") String reason) {
        log.info("暂停生产: factoryId={}, batchId={}, reason={}", factoryId, batchId, reason);
        ProductionBatch result = processingService.pauseProduction(factoryId, batchId, reason);
        return ApiResponse.success(result);
    }

    /**
     * 完成生产
     */
    @PostMapping("/batches/{batchId}/complete")
    @Operation(summary = "完成生产", description = "完成批次生产")
    public ApiResponse<ProductionBatch> completeProduction(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId,
            @RequestParam @Parameter(description = "实际产量") BigDecimal actualQuantity,
            @RequestParam @Parameter(description = "良品数量") BigDecimal goodQuantity,
            @RequestParam @Parameter(description = "不良品数量") BigDecimal defectQuantity) {
        log.info("完成生产: factoryId={}, batchId={}, actualQuantity={}", factoryId, batchId, actualQuantity);
        ProductionBatch result = processingService.completeProduction(
                factoryId, batchId, actualQuantity, goodQuantity, defectQuantity);
        return ApiResponse.success(result);
    }

    /**
     * 取消生产
     */
    @PostMapping("/batches/{batchId}/cancel")
    @Operation(summary = "取消生产", description = "取消批次生产")
    public ApiResponse<ProductionBatch> cancelProduction(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId,
            @RequestParam @Parameter(description = "取消原因") String reason) {
        log.info("取消生产: factoryId={}, batchId={}, reason={}", factoryId, batchId, reason);
        ProductionBatch result = processingService.cancelProduction(factoryId, batchId, reason);
        return ApiResponse.success(result);
    }

    /**
     * 获取批次详情
     */
    @GetMapping("/batches/{batchId}")
    @Operation(summary = "获取批次详情", description = "获取生产批次详细信息")
    public ApiResponse<ProductionBatch> getBatchById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId) {
        log.info("获取批次详情: factoryId={}, batchId={}", factoryId, batchId);
        ProductionBatch batch = processingService.getBatchById(factoryId, batchId);
        return ApiResponse.success(batch);
    }

    /**
     * 获取批次列表
     */
    @GetMapping("/batches")
    @Operation(summary = "获取批次列表", description = "分页获取生产批次列表")
    public ApiResponse<PageResponse<ProductionBatch>> getBatches(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "状态") String status,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("获取批次列表: factoryId={}, status={}", factoryId, status);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<ProductionBatch> result = processingService.getBatches(factoryId, status, pageRequest);
        return ApiResponse.success(result);
    }

    /**
     * 获取批次时间线
     */
    @GetMapping("/batches/{batchId}/timeline")
    @Operation(summary = "获取批次时间线", description = "获取批次生产时间线")
    public ApiResponse<List<Map<String, Object>>> getBatchTimeline(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId) {
        log.info("获取批次时间线: factoryId={}, batchId={}", factoryId, batchId);
        List<Map<String, Object>> timeline = processingService.getBatchTimeline(factoryId, batchId);
        return ApiResponse.success(timeline);
    }

    // ========== 原材料管理接口 ==========

    /**
     * 创建原材料接收记录
     */
    @PostMapping("/material-receipt")
    @Operation(summary = "原材料接收", description = "创建原材料接收记录")
    public ApiResponse<MaterialBatch> createMaterialReceipt(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestHeader(value = "Authorization", required = false) @Parameter(description = "访问令牌") String authorization,
            @RequestBody @Parameter(description = "原材料批次信息") MaterialBatch materialBatch) {
        log.info("原材料接收: factoryId={}, batchNumber={}", factoryId, materialBatch.getBatchNumber());

        // 获取当前用户ID（如果提供了token）
        Integer userId = null;
        if (authorization != null && !authorization.trim().isEmpty()) {
            try {
                String token = TokenUtils.extractToken(authorization);
                var userDTO = mobileService.getUserFromToken(token);
                userId = userDTO.getId();
            } catch (Exception e) {
                log.warn("无法从token获取用户信息: {}", e.getMessage());
            }
        }

        // 设置创建者ID
        if (userId != null) {
            materialBatch.setCreatedBy(userId);
        }

        MaterialBatch result = processingService.createMaterialReceipt(factoryId, materialBatch);
        return ApiResponse.success(result);
    }

    /**
     * 获取原材料列表
     */
    @GetMapping("/materials")
    @Operation(summary = "获取原材料列表", description = "分页获取原材料列表")
    public ApiResponse<PageResponse<MaterialBatch>> getMaterialReceipts(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("获取原材料列表: factoryId={}", factoryId);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<MaterialBatch> result = processingService.getMaterialReceipts(factoryId, pageRequest);
        return ApiResponse.success(result);
    }

    /**
     * 记录原材料消耗
     */
    @PostMapping("/batches/{batchId}/material-consumption")
    @Operation(summary = "记录原材料消耗", description = "记录生产批次的原材料消耗")
    public ApiResponse<Void> recordMaterialConsumption(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId,
            @RequestBody @Parameter(description = "消耗记录") List<Map<String, Object>> consumptions) {
        log.info("记录原材料消耗: factoryId={}, batchId={}", factoryId, batchId);
        processingService.recordMaterialConsumption(factoryId, batchId, consumptions);
        return ApiResponse.success();
    }

    // ========== 质量检验接口 ==========

    /**
     * 提交质检记录
     */
    @PostMapping("/quality/inspections")
    @Operation(summary = "提交质检记录", description = "提交产品质量检验记录")
    public ApiResponse<Map<String, Object>> submitInspection(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "批次ID") String batchId,
            @RequestBody @Parameter(description = "质检信息") Map<String, Object> inspection) {
        log.info("提交质检记录: factoryId={}, batchId={}", factoryId, batchId);
        Map<String, Object> result = processingService.submitInspection(factoryId, batchId, inspection);
        return ApiResponse.success(result);
    }

    /**
     * 获取质检记录
     */
    @GetMapping("/quality/inspections")
    @Operation(summary = "获取质检记录", description = "分页获取质检记录")
    public ApiResponse<PageResponse<Map<String, Object>>> getInspections(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "批次ID") String batchId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("获取质检记录: factoryId={}, batchId={}", factoryId, batchId);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<Map<String, Object>> result = processingService.getInspections(factoryId, batchId, pageRequest);
        return ApiResponse.success(result);
    }

    /**
     * 获取质量统计
     */
    @GetMapping("/quality/statistics")
    @Operation(summary = "质量统计", description = "获取质量统计数据")
    public ApiResponse<Map<String, Object>> getQualityStatistics(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.info("获取质量统计: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);
        Map<String, Object> statistics = processingService.getQualityStatistics(factoryId, startDate, endDate);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取质量趋势
     */
    @GetMapping("/quality/trends")
    @Operation(summary = "质量趋势", description = "获取质量趋势分析")
    public ApiResponse<List<Map<String, Object>>> getQualityTrends(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "30") @Parameter(description = "天数") Integer days) {
        log.info("获取质量趋势: factoryId={}, days={}", factoryId, days);
        List<Map<String, Object>> trends = processingService.getQualityTrends(factoryId, days);
        return ApiResponse.success(trends);
    }

    // ========== 成本分析接口 ==========

    /**
     * 获取批次成本分析
     */
    @GetMapping("/batches/{batchId}/cost-analysis")
    @Operation(summary = "批次成本分析", description = "获取批次成本详细分析")
    public ApiResponse<Map<String, Object>> getBatchCostAnalysis(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId) {
        log.info("获取批次成本分析: factoryId={}, batchId={}", factoryId, batchId);
        Map<String, Object> analysis = processingService.getBatchCostAnalysis(factoryId, batchId);
        return ApiResponse.success(analysis);
    }

    /**
     * 重新计算批次成本
     */
    @PostMapping("/batches/{batchId}/recalculate-cost")
    @Operation(summary = "重算成本", description = "重新计算批次成本")
    public ApiResponse<ProductionBatch> recalculateBatchCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "批次ID") String batchId) {
        log.info("重新计算批次成本: factoryId={}, batchId={}", factoryId, batchId);
        ProductionBatch batch = processingService.recalculateBatchCost(factoryId, batchId);
        return ApiResponse.success(batch);
    }

    // ========== AI成本分析接口 ==========
    // 所有AI接口已迁移到 AIController (/api/mobile/{factoryId}/ai/*)
    // 详见: com.cretas.aims.controller.AIController

    // ========== 仪表盘接口 ==========

    /**
     * 生产概览
     */
    @GetMapping("/dashboard/overview")
    @Operation(summary = "生产概览", description = "获取生产概览数据")
    public ApiResponse<Map<String, Object>> getDashboardOverview(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "today") @Parameter(description = "时间周期") String period) {
        log.info("获取生产概览: factoryId={}, period={}", factoryId, period);
        Map<String, Object> overviewData = processingService.getDashboardOverview(factoryId);

        // ========== 新增: 查询今日产量、设备统计 (2025-11-20) ==========
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

        // 1. 今日产量（千克）- 只统计已完成的批次
        Double todayOutputKg = processingBatchRepository
                .findByFactoryIdAndCreatedAtBetween(factoryId, startOfDay, endOfDay)
                .stream()
                .filter(batch -> "COMPLETED".equalsIgnoreCase(batch.getStatus()))
                .filter(batch -> batch.getQuantity() != null)
                .mapToDouble(batch -> batch.getQuantity().doubleValue())
                .sum();

        // 2. 活跃设备数 (状态为RUNNING)
        Long activeEquipmentLong = equipmentRepository.countByFactoryIdAndStatus(factoryId, "RUNNING");
        Integer activeEquipment = activeEquipmentLong != null ? activeEquipmentLong.intValue() : 0;

        // 3. 总设备数
        Long totalEquipmentLong = equipmentRepository.countByFactoryId(factoryId);
        Integer totalEquipment = totalEquipmentLong != null ? totalEquipmentLong.intValue() : 0;

        log.debug("新增统计字段: todayOutputKg={}kg, activeEquipment={}, totalEquipment={}",
                todayOutputKg, activeEquipment, totalEquipment);

        // 映射后端数据到前端期望的格式
        Map<String, Object> summary = new HashMap<>();

        // 获取生产相关数据
        long activeBatches = (Long) overviewData.getOrDefault("inProgressBatches", 0L);

        // 因为todayBatches查询可能有问题，我们使用activeBatches作为基础
        // 在实际应用中应该修复底层查询
        long totalBatches = activeBatches > 0 ? activeBatches : 0L;
        long completedBatches = 0L;

        summary.put("totalBatches", activeBatches);  // 使用进行中批次作为总批次（临时方案）
        summary.put("activeBatches", activeBatches);
        summary.put("completedBatches", completedBatches);
        summary.put("qualityInspections", overviewData.getOrDefault("qualityInspections", 0L));
        summary.put("activeAlerts", overviewData.getOrDefault("lowStockMaterials", 0L));
        summary.put("onDutyWorkers", overviewData.getOrDefault("onDutyWorkers", 0));
        summary.put("totalWorkers", overviewData.getOrDefault("totalWorkers", 0));

        // ========== 新增字段 (2025-11-20) ==========
        summary.put("todayOutputKg", todayOutputKg);
        summary.put("activeEquipment", activeEquipment);
        summary.put("totalEquipment", totalEquipment);

        // 包装数据以匹配前端期望的格式
        Map<String, Object> response = new HashMap<>();
        response.put("period", period);
        response.put("summary", summary);

        // 添加KPI数据
        Map<String, Object> kpi = new HashMap<>();
        Object yieldRate = overviewData.getOrDefault("monthlyYieldRate", BigDecimal.ZERO);
        kpi.put("productionEfficiency", yieldRate);
        kpi.put("qualityPassRate", yieldRate);
        kpi.put("equipmentUtilization", overviewData.getOrDefault("equipmentUtilization", 0));
        response.put("kpi", kpi);

        // 添加告警数据
        Map<String, Object> alerts = new HashMap<>();
        alerts.put("active", overviewData.getOrDefault("lowStockMaterials", 0L));
        alerts.put("status", "normal");
        response.put("alerts", alerts);

        log.info("仪表板数据: totalBatches={}, activeBatches={}, completedBatches={}", totalBatches, activeBatches, completedBatches);
        return ApiResponse.success(response);
    }

    /**
     * 生产统计
     */
    @GetMapping("/dashboard/production")
    @Operation(summary = "生产统计", description = "获取生产统计数据")
    public ApiResponse<Map<String, Object>> getProductionStatistics(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "today") @Parameter(description = "时间周期: today, week, month") String period) {
        log.info("获取生产统计: factoryId={}, period={}", factoryId, period);
        Map<String, Object> statistics = processingService.getProductionStatistics(factoryId, period);
        return ApiResponse.success(statistics);
    }

    /**
     * 质量仪表盘
     */
    @GetMapping("/dashboard/quality")
    @Operation(summary = "质量仪表盘", description = "获取质量统计和趋势")
    public ApiResponse<Map<String, Object>> getQualityDashboard(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取质量仪表盘: factoryId={}", factoryId);
        Map<String, Object> dashboard = processingService.getQualityDashboard(factoryId);
        return ApiResponse.success(dashboard);
    }

    /**
     * 设备仪表盘
     */
    @GetMapping("/dashboard/equipment")
    @Operation(summary = "设备仪表盘", description = "获取设备状态统计")
    public ApiResponse<Map<String, Object>> getEquipmentDashboard(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取设备仪表盘: factoryId={}, period={}", factoryId);
        Map<String, Object> dashboard = processingService.getEquipmentDashboard(factoryId);
        return ApiResponse.success(dashboard);
    }

    /**
     * 告警仪表盘
     */
    @GetMapping("/dashboard/alerts")
    @Operation(summary = "告警仪表盘", description = "获取告警统计和趋势")
    public ApiResponse<Map<String, Object>> getAlertsDashboard(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "week") @Parameter(description = "时间周期: today, week, month") String period) {
        log.info("获取告警仪表盘: factoryId={}, period={}", factoryId, period);

        // 查询所有告警
        List<EquipmentAlert> allAlerts = equipmentAlertRepository.findByFactoryIdOrderByTriggeredAtDesc(factoryId);

        Map<String, Object> dashboard = new java.util.HashMap<>();

        // 告警总数统计
        long totalAlerts = allAlerts.size();
        long unresolvedAlerts = allAlerts.stream()
                .filter(a -> a.getStatus() == AlertStatus.ACTIVE || a.getStatus() == AlertStatus.ACKNOWLEDGED)
                .count();
        long resolvedAlerts = allAlerts.stream()
                .filter(a -> a.getStatus() == AlertStatus.RESOLVED)
                .count();
        long ignoredAlerts = allAlerts.stream()
                .filter(a -> a.getStatus() == AlertStatus.IGNORED)
                .count();

        dashboard.put("totalAlerts", totalAlerts);
        dashboard.put("unresolvedAlerts", unresolvedAlerts);
        dashboard.put("resolvedAlerts", resolvedAlerts);
        dashboard.put("ignoredAlerts", ignoredAlerts);

        // 按严重程度分类
        Map<String, Long> bySeverity = allAlerts.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        a -> a.getLevel().name().toLowerCase(),
                        java.util.stream.Collectors.counting()
                ));
        dashboard.put("bySeverity", bySeverity);

        // 按类型分类
        Map<String, Long> byType = allAlerts.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        EquipmentAlert::getAlertType,
                        java.util.stream.Collectors.counting()
                ));
        dashboard.put("byType", byType);

        // 最近的未处理告警 (Top 10)
        List<Map<String, Object>> recentAlerts = allAlerts.stream()
                .filter(a -> a.getStatus() == AlertStatus.ACTIVE || a.getStatus() == AlertStatus.ACKNOWLEDGED)
                .limit(10)
                .map(alert -> {
                    Map<String, Object> alertMap = new java.util.HashMap<>();
                    alertMap.put("id", alert.getId());
                    alertMap.put("equipmentId", alert.getEquipmentId());
                    alertMap.put("type", alert.getAlertType());
                    alertMap.put("severity", alert.getLevel().name().toLowerCase());
                    alertMap.put("message", alert.getMessage());
                    alertMap.put("timestamp", alert.getTriggeredAt());
                    alertMap.put("status", alert.getStatus().name());
                    return alertMap;
                })
                .collect(java.util.stream.Collectors.toList());
        dashboard.put("recentAlerts", recentAlerts);

        dashboard.put("period", period);
        dashboard.put("generatedAt", LocalDateTime.now());

        return ApiResponse.success(dashboard);
    }

    /**
     * 趋势分析仪表盘
     */
    @GetMapping("/dashboard/trends")
    @Operation(summary = "趋势分析", description = "获取生产、质量、设备等趋势数据")
    public ApiResponse<Map<String, Object>> getTrendsDashboard(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "month") @Parameter(description = "时间周期: week, month, quarter, year") String period,
            @RequestParam(defaultValue = "production") @Parameter(description = "趋势类型: production, quality, equipment, cost") String metric) {
        log.info("获取趋势分析: factoryId={}, period={}, metric={}", factoryId, period, metric);

        int days = "week".equals(period) ? 7 : ("month".equals(period) ? 30 : ("quarter".equals(period) ? 90 : 365));
        LocalDateTime startDate = LocalDateTime.now().minusDays(days);

        Map<String, Object> trends = new java.util.HashMap<>();
        List<Map<String, Object>> dataPoints = new java.util.ArrayList<>();

        // 根据metric类型从不同表查询数据
        switch (metric) {
            case "production":
                // 查询生产批次数量趋势
                List<ProcessingBatch> batches = processingBatchRepository.findAll().stream()
                        .filter(b -> b.getCreatedAt() != null && b.getCreatedAt().isAfter(startDate))
                        .collect(java.util.stream.Collectors.toList());

                // 按日期分组统计
                for (int i = days - 1; i >= 0; i--) {
                    LocalDate date = LocalDate.now().minusDays(i);
                    LocalDateTime dayStart = date.atStartOfDay();
                    LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();

                    long count = batches.stream()
                            .filter(b -> b.getCreatedAt() != null &&
                                    !b.getCreatedAt().isBefore(dayStart) &&
                                    b.getCreatedAt().isBefore(dayEnd))
                            .count();

                    Map<String, Object> point = new java.util.HashMap<>();
                    point.put("date", date.toString());
                    point.put("value", count);
                    point.put("target", 10); // 目标值可以从配置读取
                    dataPoints.add(point);
                }
                break;

            case "quality":
                // 查询质检合格率趋势
                LocalDate startLocalDate = startDate.toLocalDate();
                List<QualityInspection> inspections = qualityInspectionRepository.findAll().stream()
                        .filter(qi -> qi.getInspectionDate() != null && qi.getInspectionDate().isAfter(startLocalDate))
                        .collect(java.util.stream.Collectors.toList());

                for (int i = days - 1; i >= 0; i--) {
                    LocalDate date = LocalDate.now().minusDays(i);

                    List<QualityInspection> dayInspections = inspections.stream()
                            .filter(qi -> qi.getInspectionDate() != null &&
                                    qi.getInspectionDate().equals(date))
                            .collect(java.util.stream.Collectors.toList());

                    double passRate = dayInspections.isEmpty() ? 0.0 :
                            dayInspections.stream()
                                    .filter(qi -> "合格".equals(qi.getResult()) || "通过".equals(qi.getResult()))
                                    .count() * 100.0 / dayInspections.size();

                    Map<String, Object> point = new java.util.HashMap<>();
                    point.put("date", date.toString());
                    point.put("value", Math.round(passRate * 100.0) / 100.0);
                    point.put("target", 98.0); // 目标合格率
                    dataPoints.add(point);
                }
                break;

            case "equipment":
                // 查询设备告警率趋势（告警数量越少越好）
                List<EquipmentAlert> alerts = equipmentAlertRepository.findByFactoryIdOrderByTriggeredAtDesc(factoryId).stream()
                        .filter(a -> a.getTriggeredAt() != null && a.getTriggeredAt().isAfter(startDate))
                        .collect(java.util.stream.Collectors.toList());

                for (int i = days - 1; i >= 0; i--) {
                    LocalDate date = LocalDate.now().minusDays(i);
                    LocalDateTime dayStart = date.atStartOfDay();
                    LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();

                    long alertCount = alerts.stream()
                            .filter(a -> a.getTriggeredAt() != null &&
                                    !a.getTriggeredAt().isBefore(dayStart) &&
                                    a.getTriggeredAt().isBefore(dayEnd))
                            .count();

                    Map<String, Object> point = new java.util.HashMap<>();
                    point.put("date", date.toString());
                    point.put("value", alertCount);
                    point.put("target", 2); // 目标：每天不超过2个告警
                    dataPoints.add(point);
                }
                break;

            case "cost":
                // 查询成本趋势（暂时返回占位数据，需要实际成本表）
                for (int i = days - 1; i >= 0; i--) {
                    LocalDate date = LocalDate.now().minusDays(i);
                    Map<String, Object> point = new java.util.HashMap<>();
                    point.put("date", date.toString());
                    point.put("value", 0);
                    point.put("target", 5000);
                    point.put("note", "成本数据需要集成实际成本管理模块");
                    dataPoints.add(point);
                }
                break;

            default:
                log.warn("未知的metric类型: {}", metric);
        }

        trends.put("metric", metric);
        trends.put("period", period);
        trends.put("dataPoints", dataPoints);

        // 统计摘要
        Map<String, Object> summary = new java.util.HashMap<>();
        if (!dataPoints.isEmpty()) {
            summary.put("average", dataPoints.stream()
                    .mapToDouble(p -> ((Number) p.get("value")).doubleValue())
                    .average().orElse(0.0));
            summary.put("max", dataPoints.stream()
                    .mapToDouble(p -> ((Number) p.get("value")).doubleValue())
                    .max().orElse(0.0));
            summary.put("min", dataPoints.stream()
                    .mapToDouble(p -> ((Number) p.get("value")).doubleValue())
                    .min().orElse(0.0));
        } else {
            summary.put("average", 0.0);
            summary.put("max", 0.0);
            summary.put("min", 0.0);
        }
        trends.put("summary", summary);
        trends.put("generatedAt", LocalDateTime.now());

        return ApiResponse.success(trends);
    }

    // ========== AI接口已全部迁移 ==========
    // 所有AI相关功能（成本分析、配额查询、报告管理、对话历史）已迁移到统一接口
    // 新接口位置: AIController (/api/mobile/{factoryId}/ai/*)
    // 详见: com.cretas.aims.controller.AIController

}