package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.wage.EfficiencyRecordRequest;
import com.cretas.aims.dto.wage.PayrollGenerateRequest;
import com.cretas.aims.dto.wage.PayrollPeriodRequest;
import com.cretas.aims.entity.PayrollRecord;
import com.cretas.aims.entity.PieceRateRule;
import com.cretas.aims.entity.WorkerDailyEfficiency;
import com.cretas.aims.repository.PayrollRecordRepository;
import com.cretas.aims.repository.PieceRateRuleRepository;
import com.cretas.aims.repository.WorkerDailyEfficiencyRepository;
import com.cretas.aims.service.WageCalculationService;
import com.cretas.aims.utils.TokenUtils;
import com.cretas.aims.service.MobileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工资计算与人效管理 API
 *
 * 提供计件规则管理、效率记录、工资单生成、成本分析等功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/wage")
@RequiredArgsConstructor
@Tag(name = "工资计算与人效管理", description = "计件规则配置、工人效率记录、工资单生成和审批、人力成本分析")
public class WageController {

    private final WageCalculationService wageCalculationService;
    private final PieceRateRuleRepository pieceRateRuleRepository;
    private final WorkerDailyEfficiencyRepository workerDailyEfficiencyRepository;
    private final PayrollRecordRepository payrollRecordRepository;
    private final MobileService mobileService;

    // ========== 计件规则管理 ==========

    /**
     * 获取计件规则列表
     */
    @GetMapping("/piece-rate-rules")
    @Operation(summary = "获取计件规则列表", description = "获取工厂所有计件规则，支持按状态过滤")
    public ApiResponse<List<PieceRateRule>> getPieceRateRules(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(required = false) @Parameter(description = "是否只返回启用的规则", example = "true") Boolean activeOnly) {
        log.info("获取计件规则列表: factoryId={}, activeOnly={}", factoryId, activeOnly);

        List<PieceRateRule> rules;
        if (Boolean.TRUE.equals(activeOnly)) {
            rules = pieceRateRuleRepository.findEffectiveRules(factoryId, LocalDate.now());
        } else {
            rules = pieceRateRuleRepository.findByFactoryIdOrderByPriorityDesc(factoryId);
        }

        return ApiResponse.success(rules);
    }

    /**
     * 获取计件规则详情
     */
    @GetMapping("/piece-rate-rules/{ruleId}")
    @Operation(summary = "获取计件规则详情", description = "根据ID获取计件规则的详细信息")
    public ApiResponse<PieceRateRule> getPieceRateRuleById(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "规则ID", example = "1") Long ruleId) {
        log.info("获取计件规则详情: factoryId={}, ruleId={}", factoryId, ruleId);

        PieceRateRule rule = pieceRateRuleRepository.findById(ruleId)
                .orElseThrow(() -> new RuntimeException("计件规则不存在: " + ruleId));

        // 验证工厂ID
        if (!rule.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("规则不属于该工厂");
        }

        return ApiResponse.success(rule);
    }

    /**
     * 创建计件规则
     */
    @PostMapping("/piece-rate-rules")
    @Operation(summary = "创建计件规则", description = "创建新的计件规则，支持阶梯计件定价")
    public ApiResponse<PieceRateRule> createPieceRateRule(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "计件规则信息") PieceRateRule rule) {
        log.info("创建计件规则: factoryId={}, ruleName={}", factoryId, rule.getName());

        rule.setFactoryId(factoryId);
        if (rule.getIsActive() == null) {
            rule.setIsActive(true);
        }

        PieceRateRule saved = pieceRateRuleRepository.save(rule);
        log.info("计件规则创建成功: id={}", saved.getId());

        return ApiResponse.success(saved);
    }

    /**
     * 更新计件规则
     */
    @PutMapping("/piece-rate-rules/{ruleId}")
    @Operation(summary = "更新计件规则", description = "更新现有计件规则的配置")
    public ApiResponse<PieceRateRule> updatePieceRateRule(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "规则ID", example = "1") Long ruleId,
            @RequestBody @Valid @Parameter(description = "更新后的规则信息") PieceRateRule rule) {
        log.info("更新计件规则: factoryId={}, ruleId={}", factoryId, ruleId);

        PieceRateRule existing = pieceRateRuleRepository.findById(ruleId)
                .orElseThrow(() -> new RuntimeException("计件规则不存在: " + ruleId));

        if (!existing.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("规则不属于该工厂");
        }

        // 更新字段
        existing.setName(rule.getName());
        existing.setDescription(rule.getDescription());
        existing.setProcessStageType(rule.getProcessStageType());
        existing.setProductTypeId(rule.getProductTypeId());
        existing.setTier1Threshold(rule.getTier1Threshold());
        existing.setTier1Rate(rule.getTier1Rate());
        existing.setTier2Threshold(rule.getTier2Threshold());
        existing.setTier2Rate(rule.getTier2Rate());
        existing.setTier3Threshold(rule.getTier3Threshold());
        existing.setTier3Rate(rule.getTier3Rate());
        existing.setEffectiveFrom(rule.getEffectiveFrom());
        existing.setEffectiveTo(rule.getEffectiveTo());
        existing.setIsActive(rule.getIsActive());
        existing.setPriority(rule.getPriority());

        PieceRateRule saved = pieceRateRuleRepository.save(existing);
        log.info("计件规则更新成功: id={}", saved.getId());

        return ApiResponse.success(saved);
    }

    /**
     * 删除计件规则
     */
    @DeleteMapping("/piece-rate-rules/{ruleId}")
    @Operation(summary = "删除计件规则", description = "删除指定的计件规则")
    public ApiResponse<Void> deletePieceRateRule(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "规则ID", example = "1") Long ruleId) {
        log.info("删除计件规则: factoryId={}, ruleId={}", factoryId, ruleId);

        PieceRateRule rule = pieceRateRuleRepository.findById(ruleId)
                .orElseThrow(() -> new RuntimeException("计件规则不存在: " + ruleId));

        if (!rule.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("规则不属于该工厂");
        }

        pieceRateRuleRepository.delete(rule);
        log.info("计件规则删除成功: id={}", ruleId);

        return ApiResponse.success();
    }

    // ========== 效率记录 ==========

    /**
     * 记录工人计件数据 (AI检测后调用)
     */
    @PostMapping("/efficiency/record")
    @Operation(summary = "记录工人计件数据", description = "记录工人的计件数据，通常由AI检测系统调用")
    public ApiResponse<WorkerDailyEfficiency> recordEfficiency(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "效率记录请求") EfficiencyRecordRequest request) {
        log.info("记录工人计件数据: factoryId={}, workerId={}, pieceCount={}",
                factoryId, request.getWorkerId(), request.getPieceCount());

        LocalDate workDate = request.getWorkDate() != null ? request.getWorkDate() : LocalDate.now();
        int workMinutes = request.getWorkMinutes() != null ? request.getWorkMinutes() : 0;

        WorkerDailyEfficiency efficiency = wageCalculationService.recordDailyEfficiency(
                factoryId,
                request.getWorkerId(),
                workDate,
                request.getPieceCount(),
                workMinutes,
                request.getProcessStageType());

        return ApiResponse.success(efficiency);
    }

    /**
     * 获取工人日效率
     */
    @GetMapping("/efficiency/daily")
    @Operation(summary = "获取工人日效率", description = "获取指定日期所有工人的效率数据")
    public ApiResponse<List<WorkerDailyEfficiency>> getDailyEfficiency(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "日期", example = "2026-01-14") LocalDate date) {
        log.info("获取工人日效率: factoryId={}, date={}", factoryId, date);

        List<WorkerDailyEfficiency> efficiencies = workerDailyEfficiencyRepository
                .findByFactoryIdAndWorkDate(factoryId, date);

        return ApiResponse.success(efficiencies);
    }

    /**
     * 获取单个工人指定日期的效率
     */
    @GetMapping("/efficiency/daily/{workerId}")
    @Operation(summary = "获取工人日效率详情", description = "获取指定工人在指定日期的效率数据")
    public ApiResponse<WorkerDailyEfficiency> getWorkerDailyEfficiency(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "工人ID", example = "1") Long workerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "日期", example = "2026-01-14") LocalDate date) {
        log.info("获取工人日效率详情: factoryId={}, workerId={}, date={}", factoryId, workerId, date);

        WorkerDailyEfficiency efficiency = workerDailyEfficiencyRepository
                .findByFactoryIdAndWorkerIdAndWorkDate(factoryId, workerId, date)
                .orElse(null);

        return ApiResponse.success(efficiency);
    }

    /**
     * 获取效率排名
     */
    @GetMapping("/efficiency/ranking")
    @Operation(summary = "获取效率排名", description = "获取指定日期的工人效率排名，按效率从高到低排序")
    public ApiResponse<List<WorkerDailyEfficiency>> getEfficiencyRanking(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "日期", example = "2026-01-14") LocalDate date,
            @RequestParam(required = false) @Parameter(description = "工序类型", example = "CUTTING") String processStageType) {
        log.info("获取效率排名: factoryId={}, date={}, processStageType={}", factoryId, date, processStageType);

        List<WorkerDailyEfficiency> ranking;
        if (processStageType != null && !processStageType.isEmpty()) {
            ranking = wageCalculationService.getProcessEfficiencyRanking(factoryId, date, processStageType);
        } else {
            ranking = wageCalculationService.getWorkerEfficiencyRanking(factoryId, date);
        }

        return ApiResponse.success(ranking);
    }

    /**
     * 获取工人效率趋势
     */
    @GetMapping("/efficiency/trend/{workerId}")
    @Operation(summary = "获取工人效率趋势", description = "获取指定工人在日期范围内的效率趋势数据")
    public ApiResponse<Map<String, Object>> getEfficiencyTrend(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "工人ID", example = "1") Long workerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期", example = "2026-01-01") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期", example = "2026-01-14") LocalDate endDate) {
        log.info("获取工人效率趋势: factoryId={}, workerId={}, startDate={}, endDate={}",
                factoryId, workerId, startDate, endDate);

        Map<LocalDate, BigDecimal> trend = wageCalculationService.getWorkerEfficiencyTrend(workerId, startDate, endDate);

        // 计算汇总数据
        BigDecimal avgEfficiency = BigDecimal.ZERO;
        BigDecimal maxEfficiency = BigDecimal.ZERO;
        BigDecimal minEfficiency = null;
        int dataPoints = 0;

        for (BigDecimal efficiency : trend.values()) {
            if (efficiency != null && efficiency.compareTo(BigDecimal.ZERO) > 0) {
                avgEfficiency = avgEfficiency.add(efficiency);
                dataPoints++;

                if (efficiency.compareTo(maxEfficiency) > 0) {
                    maxEfficiency = efficiency;
                }
                if (minEfficiency == null || efficiency.compareTo(minEfficiency) < 0) {
                    minEfficiency = efficiency;
                }
            }
        }

        if (dataPoints > 0) {
            avgEfficiency = avgEfficiency.divide(BigDecimal.valueOf(dataPoints), 2, java.math.RoundingMode.HALF_UP);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("workerId", workerId);
        result.put("startDate", startDate);
        result.put("endDate", endDate);
        result.put("trend", trend);
        result.put("summary", Map.of(
                "averageEfficiency", avgEfficiency,
                "maxEfficiency", maxEfficiency,
                "minEfficiency", minEfficiency != null ? minEfficiency : BigDecimal.ZERO,
                "dataPoints", dataPoints
        ));

        return ApiResponse.success(result);
    }

    /**
     * 获取工厂效率趋势
     */
    @GetMapping("/efficiency/factory-trend")
    @Operation(summary = "获取工厂效率趋势", description = "获取整个工厂在日期范围内的效率趋势")
    public ApiResponse<List<Map<String, Object>>> getFactoryEfficiencyTrend(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期", example = "2026-01-01") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期", example = "2026-01-14") LocalDate endDate) {
        log.info("获取工厂效率趋势: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        List<Map<String, Object>> trend = wageCalculationService.getFactoryEfficiencyTrend(factoryId, startDate, endDate);

        return ApiResponse.success(trend);
    }

    // ========== 工资单管理 ==========

    /**
     * 生成工资单 (单个工人)
     */
    @PostMapping("/payroll/generate")
    @Operation(summary = "生成工资单", description = "为单个工人生成指定周期的工资单")
    public ApiResponse<PayrollRecord> generatePayroll(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "工资单生成请求") PayrollGenerateRequest request) {
        log.info("生成工资单: factoryId={}, workerId={}, period={} to {}",
                factoryId, request.getWorkerId(), request.getPeriodStart(), request.getPeriodEnd());

        PayrollRecord payroll = wageCalculationService.generatePayroll(
                factoryId,
                request.getWorkerId(),
                request.getPeriodStart(),
                request.getPeriodEnd());

        return ApiResponse.success(payroll);
    }

    /**
     * 批量生成工资单 (全工厂)
     */
    @PostMapping("/payroll/generate-batch")
    @Operation(summary = "批量生成工资单", description = "为工厂所有有效率记录的工人批量生成工资单")
    public ApiResponse<List<PayrollRecord>> generateBatchPayroll(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "批量生成请求") PayrollPeriodRequest request) {
        log.info("批量生成工资单: factoryId={}, period={} to {}",
                factoryId, request.getPeriodStart(), request.getPeriodEnd());

        List<PayrollRecord> payrolls = wageCalculationService.generateFactoryPayroll(
                factoryId,
                request.getPeriodStart(),
                request.getPeriodEnd());

        return ApiResponse.success(payrolls);
    }

    /**
     * 获取工资单列表
     */
    @GetMapping("/payroll")
    @Operation(summary = "获取工资单列表", description = "分页获取工资单列表，支持按工人ID和状态过滤")
    public ApiResponse<PageResponse<PayrollRecord>> getPayrollList(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(required = false) @Parameter(description = "工人ID", example = "1") Long workerId,
            @RequestParam(required = false) @Parameter(description = "状态", example = "PENDING") String status,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码", example = "1") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小", example = "20") Integer size) {
        log.info("获取工资单列表: factoryId={}, workerId={}, status={}", factoryId, workerId, status);

        List<PayrollRecord> allRecords = payrollRecordRepository.findByFactoryId(factoryId);

        // 过滤
        if (workerId != null) {
            allRecords = allRecords.stream()
                    .filter(p -> p.getWorkerId().equals(workerId))
                    .collect(java.util.stream.Collectors.toList());
        }
        if (status != null && !status.isEmpty()) {
            allRecords = allRecords.stream()
                    .filter(p -> status.equals(p.getStatus()))
                    .collect(java.util.stream.Collectors.toList());
        }

        // 排序 (按周期开始日期倒序)
        allRecords.sort((a, b) -> b.getPeriodStart().compareTo(a.getPeriodStart()));

        // 分页
        int total = allRecords.size();
        int fromIndex = Math.min((page - 1) * size, total);
        int toIndex = Math.min(fromIndex + size, total);
        List<PayrollRecord> pageContent = allRecords.subList(fromIndex, toIndex);

        PageResponse<PayrollRecord> pageResponse = new PageResponse<>();
        pageResponse.setContent(pageContent);
        pageResponse.setPage(page);
        pageResponse.setSize(size);
        pageResponse.setTotalElements((long) total);
        pageResponse.setTotalPages((int) Math.ceil((double) total / size));

        return ApiResponse.success(pageResponse);
    }

    /**
     * 获取工资单详情
     */
    @GetMapping("/payroll/{payrollId}")
    @Operation(summary = "获取工资单详情", description = "根据ID获取工资单的详细信息")
    public ApiResponse<PayrollRecord> getPayrollById(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "工资单ID", example = "1") Long payrollId) {
        log.info("获取工资单详情: factoryId={}, payrollId={}", factoryId, payrollId);

        PayrollRecord payroll = payrollRecordRepository.findById(payrollId)
                .orElseThrow(() -> new RuntimeException("工资单不存在: " + payrollId));

        if (!payroll.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("工资单不属于该工厂");
        }

        return ApiResponse.success(payroll);
    }

    /**
     * 审批工资单
     */
    @PutMapping("/payroll/{payrollId}/approve")
    @Operation(summary = "审批工资单", description = "审批通过待审核的工资单")
    public ApiResponse<PayrollRecord> approvePayroll(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "工资单ID", example = "1") Long payrollId,
            HttpServletRequest httpRequest) {
        log.info("审批工资单: factoryId={}, payrollId={}", factoryId, payrollId);

        // 验证工资单属于该工厂
        PayrollRecord payroll = payrollRecordRepository.findById(payrollId)
                .orElseThrow(() -> new RuntimeException("工资单不存在: " + payrollId));

        if (!payroll.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("工资单不属于该工厂");
        }

        // 获取审批人ID
        Long approverId = null;
        String authorization = httpRequest.getHeader("Authorization");
        if (authorization != null) {
            try {
                String token = TokenUtils.extractToken(authorization);
                var userDTO = mobileService.getUserFromToken(token);
                approverId = userDTO.getId();
            } catch (Exception e) {
                log.warn("无法从token获取用户信息: {}", e.getMessage());
            }
        }

        if (approverId == null) {
            throw new RuntimeException("无法获取审批人信息");
        }

        PayrollRecord approved = wageCalculationService.approvePayroll(payrollId, approverId);

        return ApiResponse.success(approved);
    }

    /**
     * 批量审批工资单
     */
    @PutMapping("/payroll/batch-approve")
    @Operation(summary = "批量审批工资单", description = "批量审批多个待审核的工资单")
    public ApiResponse<Map<String, Object>> batchApprovePayroll(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Parameter(description = "工资单ID列表") List<Long> payrollIds,
            HttpServletRequest httpRequest) {
        log.info("批量审批工资单: factoryId={}, count={}", factoryId, payrollIds.size());

        // 获取审批人ID
        Long approverId = null;
        String authorization = httpRequest.getHeader("Authorization");
        if (authorization != null) {
            try {
                String token = TokenUtils.extractToken(authorization);
                var userDTO = mobileService.getUserFromToken(token);
                approverId = userDTO.getId();
            } catch (Exception e) {
                log.warn("无法从token获取用户信息: {}", e.getMessage());
            }
        }

        if (approverId == null) {
            throw new RuntimeException("无法获取审批人信息");
        }

        int successCount = wageCalculationService.batchApprove(payrollIds, approverId);

        Map<String, Object> result = Map.of(
                "totalRequested", payrollIds.size(),
                "successCount", successCount,
                "failedCount", payrollIds.size() - successCount
        );

        return ApiResponse.success(result);
    }

    /**
     * 标记工资单已发放
     */
    @PutMapping("/payroll/{payrollId}/paid")
    @Operation(summary = "标记工资单已发放", description = "将已审核的工资单标记为已发放状态")
    public ApiResponse<PayrollRecord> markAsPaid(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "工资单ID", example = "1") Long payrollId) {
        log.info("标记工资单已发放: factoryId={}, payrollId={}", factoryId, payrollId);

        // 验证工资单属于该工厂
        PayrollRecord payroll = payrollRecordRepository.findById(payrollId)
                .orElseThrow(() -> new RuntimeException("工资单不存在: " + payrollId));

        if (!payroll.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("工资单不属于该工厂");
        }

        PayrollRecord paid = wageCalculationService.markAsPaid(payrollId);

        return ApiResponse.success(paid);
    }

    /**
     * 获取待审核工资单数量
     */
    @GetMapping("/payroll/pending-count")
    @Operation(summary = "获取待审核工资单数量", description = "获取工厂待审核的工资单数量")
    public ApiResponse<Map<String, Object>> getPendingPayrollCount(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.info("获取待审核工资单数量: factoryId={}", factoryId);

        long pendingCount = wageCalculationService.countPendingPayrolls(factoryId);

        return ApiResponse.success(Map.of(
                "factoryId", factoryId,
                "pendingCount", pendingCount
        ));
    }

    /**
     * 获取工资排行榜
     */
    @GetMapping("/payroll/top-earners")
    @Operation(summary = "获取工资排行榜", description = "获取指定周期内工资最高的工人排名")
    public ApiResponse<List<PayrollRecord>> getTopEarners(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "周期开始", example = "2026-01-01") LocalDate periodStart,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "周期结束", example = "2026-01-31") LocalDate periodEnd,
            @RequestParam(defaultValue = "10") @Parameter(description = "返回数量", example = "10") Integer limit) {
        log.info("获取工资排行榜: factoryId={}, period={} to {}", factoryId, periodStart, periodEnd);

        List<PayrollRecord> topEarners = wageCalculationService.getTopEarners(
                factoryId, periodStart, periodEnd, limit);

        return ApiResponse.success(topEarners);
    }

    // ========== 成本分析 ==========

    /**
     * 人力成本分析
     */
    @GetMapping("/analysis/labor-cost")
    @Operation(summary = "人力成本分析", description = "分析指定周期内的人力成本数据，包括总工资、计件工资、单件成本、效率统计等")
    public ApiResponse<Map<String, Object>> analyzeLaborCost(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "周期开始", example = "2026-01-01") LocalDate periodStart,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "周期结束", example = "2026-01-31") LocalDate periodEnd) {
        log.info("人力成本分析: factoryId={}, period={} to {}", factoryId, periodStart, periodEnd);

        Map<String, Object> analysis = wageCalculationService.analyzeLaborCost(factoryId, periodStart, periodEnd);

        return ApiResponse.success(analysis);
    }

    /**
     * 计算预估计件工资
     */
    @GetMapping("/analysis/estimate-wage")
    @Operation(summary = "计算预估计件工资", description = "根据件数和工序类型预估计件工资金额")
    public ApiResponse<Map<String, Object>> estimateWage(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "件数", example = "500") Integer pieceCount,
            @RequestParam(required = false) @Parameter(description = "工序类型", example = "CUTTING") String processStageType,
            @RequestParam(required = false) @Parameter(description = "产品类型ID", example = "PT001") String productTypeId) {
        log.info("计算预估计件工资: factoryId={}, pieceCount={}, processStageType={}",
                factoryId, pieceCount, processStageType);

        BigDecimal wage = wageCalculationService.calculatePieceRateWage(
                factoryId, null, pieceCount, processStageType, productTypeId, LocalDate.now());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pieceCount", pieceCount);
        result.put("processStageType", processStageType);
        result.put("productTypeId", productTypeId);
        result.put("estimatedWage", wage);

        return ApiResponse.success(result);
    }
}
