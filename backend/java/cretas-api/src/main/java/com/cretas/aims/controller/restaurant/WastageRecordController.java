package com.cretas.aims.controller.restaurant;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.restaurant.WastageRecord;
import com.cretas.aims.repository.restaurant.WastageRecordRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 损耗记录管理 Controller
 *
 * @author Cretas Team
 * @since 2026-02-20
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/restaurant/wastage")
@RequiredArgsConstructor
@Tag(name = "餐饮-损耗管理")
public class WastageRecordController {

    private final WastageRecordRepository wastageRepository;

    // ==================== 列表查询 ====================

    @GetMapping
    @Operation(summary = "损耗记录列表", description = "支持按日期范围、状态、类型筛选")
    public ApiResponse<Page<WastageRecord>> list(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(Math.max(0, page - 1), size);

        if (status != null) {
            WastageRecord.Status s = WastageRecord.Status.valueOf(status);
            return ApiResponse.success(
                    wastageRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(factoryId, s, pageable));
        }
        if (type != null) {
            WastageRecord.WastageType t = WastageRecord.WastageType.valueOf(type);
            return ApiResponse.success(
                    wastageRepository.findByFactoryIdAndTypeOrderByCreatedAtDesc(factoryId, t, pageable));
        }
        return ApiResponse.success(
                wastageRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable));
    }

    // ==================== 详情 ====================

    @GetMapping("/{wastageId}")
    @Operation(summary = "损耗记录详情")
    public ApiResponse<WastageRecord> detail(
            @PathVariable String factoryId,
            @PathVariable String wastageId) {
        return wastageRepository.findByIdAndFactoryId(wastageId, factoryId)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("损耗记录不存在: " + wastageId));
    }

    // ==================== 创建 ====================

    @PostMapping
    @Operation(summary = "创建损耗记录")
    public ApiResponse<WastageRecord> create(
            @PathVariable String factoryId,
            @RequestAttribute("userId") @Parameter(hidden = true) Long userId,
            @RequestBody @Valid WastageRecord record) {
        log.info("创建损耗记录: factoryId={}, type={}, materialId={}",
                factoryId, record.getType(), record.getRawMaterialTypeId());

        record.setId(null);
        record.setFactoryId(factoryId);
        record.setReportedBy(userId);
        record.setStatus(WastageRecord.Status.DRAFT);
        if (record.getWastageDate() == null) {
            record.setWastageDate(LocalDate.now());
        }

        // 自动生成单号
        long todayCount = wastageRepository.countByFactoryIdAndDate(factoryId, record.getWastageDate());
        String dateStr = record.getWastageDate().toString().replace("-", "");
        record.setWastageNumber(String.format("WST-%s-%03d", dateStr, todayCount + 1));

        WastageRecord saved = wastageRepository.save(record);
        return ApiResponse.success("损耗记录创建成功", saved);
    }

    // ==================== 提交 ====================

    @PostMapping("/{wastageId}/submit")
    @Operation(summary = "提交损耗记录", description = "将草稿提交审批")
    public ApiResponse<WastageRecord> submit(
            @PathVariable String factoryId,
            @PathVariable String wastageId) {
        return wastageRepository.findByIdAndFactoryId(wastageId, factoryId)
                .map(record -> {
                    if (record.getStatus() != WastageRecord.Status.DRAFT) {
                        return ApiResponse.<WastageRecord>error("只有草稿状态的损耗记录可以提交");
                    }
                    record.setStatus(WastageRecord.Status.SUBMITTED);
                    WastageRecord updated = wastageRepository.save(record);
                    return ApiResponse.success("损耗记录已提交", updated);
                })
                .orElse(ApiResponse.error("损耗记录不存在: " + wastageId));
    }

    // ==================== 审批 ====================

    @PostMapping("/{wastageId}/approve")
    @Operation(summary = "审批损耗记录")
    public ApiResponse<WastageRecord> approve(
            @PathVariable String factoryId,
            @PathVariable String wastageId,
            @RequestAttribute("userId") @Parameter(hidden = true) Long approverId) {
        return wastageRepository.findByIdAndFactoryId(wastageId, factoryId)
                .map(record -> {
                    if (record.getStatus() != WastageRecord.Status.SUBMITTED) {
                        return ApiResponse.<WastageRecord>error("只有已提交的损耗记录可以审批");
                    }
                    record.setStatus(WastageRecord.Status.APPROVED);
                    record.setApprovedBy(approverId);
                    record.setApprovedAt(LocalDateTime.now());
                    WastageRecord updated = wastageRepository.save(record);
                    return ApiResponse.success("损耗记录已审批", updated);
                })
                .orElse(ApiResponse.error("损耗记录不存在: " + wastageId));
    }

    // ==================== 统计 ====================

    @GetMapping("/statistics")
    @Operation(summary = "损耗统计", description = "按损耗类型和食材统计损耗数量与金额")
    public ApiResponse<Map<String, Object>> statistics(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate start = startDate != null ? startDate : LocalDate.now().withDayOfMonth(1);
        LocalDate end = endDate != null ? endDate : LocalDate.now();

        BigDecimal totalCost = wastageRepository.getTotalEstimatedCost(factoryId, start, end);

        List<Object[]> byType = wastageRepository.getStatisticsByType(factoryId, start, end);
        List<Map<String, Object>> typeStats = byType.stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("type", row[0]);
            m.put("count", row[1]);
            m.put("totalQuantity", row[2]);
            m.put("totalCost", row[3]);
            return m;
        }).collect(Collectors.toList());

        List<Object[]> byMaterial = wastageRepository.getStatisticsByMaterial(factoryId, start, end);
        List<Map<String, Object>> materialStats = byMaterial.stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("rawMaterialTypeId", row[0]);
            m.put("unit", row[1]);
            m.put("totalQuantity", row[2]);
            m.put("totalCost", row[3]);
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("startDate", start.toString());
        result.put("endDate", end.toString());
        result.put("totalEstimatedCost", totalCost);
        result.put("byType", typeStats);
        result.put("byMaterial", materialStats);
        return ApiResponse.success(result);
    }
}
