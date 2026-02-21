package com.cretas.aims.controller.restaurant;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.restaurant.MaterialRequisition;
import com.cretas.aims.repository.restaurant.MaterialRequisitionRepository;
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
 * 领料/日消耗管理 Controller
 *
 * @author Cretas Team
 * @since 2026-02-20
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/restaurant/requisitions")
@RequiredArgsConstructor
@Tag(name = "餐饮-领料管理")
public class MaterialRequisitionController {

    private final MaterialRequisitionRepository requisitionRepository;

    // ==================== 列表查询 ====================

    @GetMapping
    @Operation(summary = "领料单列表", description = "支持按日期、状态、类型筛选")
    public ApiResponse<Page<MaterialRequisition>> list(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(Math.max(0, page - 1), size);

        if (status != null) {
            MaterialRequisition.Status s = MaterialRequisition.Status.valueOf(status);
            return ApiResponse.success(
                    requisitionRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(factoryId, s, pageable));
        }
        if (type != null) {
            MaterialRequisition.RequisitionType t = MaterialRequisition.RequisitionType.valueOf(type);
            return ApiResponse.success(
                    requisitionRepository.findByFactoryIdAndTypeOrderByCreatedAtDesc(factoryId, t, pageable));
        }
        return ApiResponse.success(
                requisitionRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable));
    }

    // ==================== 详情 ====================

    @GetMapping("/{requisitionId}")
    @Operation(summary = "领料单详情")
    public ApiResponse<MaterialRequisition> detail(
            @PathVariable String factoryId,
            @PathVariable String requisitionId) {
        return requisitionRepository.findByIdAndFactoryId(requisitionId, factoryId)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("领料单不存在: " + requisitionId));
    }

    // ==================== 创建 ====================

    @PostMapping
    @Operation(summary = "创建领料单")
    public ApiResponse<MaterialRequisition> create(
            @PathVariable String factoryId,
            @RequestAttribute("userId") @Parameter(hidden = true) Long userId,
            @RequestBody @Valid MaterialRequisition requisition) {
        log.info("创建领料单: factoryId={}, type={}, userId={}", factoryId, requisition.getType(), userId);

        requisition.setId(null);
        requisition.setFactoryId(factoryId);
        requisition.setRequestedBy(userId);
        requisition.setStatus(MaterialRequisition.Status.DRAFT);
        if (requisition.getRequisitionDate() == null) {
            requisition.setRequisitionDate(LocalDate.now());
        }

        // 自动生成单号
        long todayCount = requisitionRepository.countByFactoryIdAndDate(factoryId, requisition.getRequisitionDate());
        String dateStr = requisition.getRequisitionDate().toString().replace("-", "");
        requisition.setRequisitionNumber(String.format("REQ-%s-%03d", dateStr, todayCount + 1));

        MaterialRequisition saved = requisitionRepository.save(requisition);
        return ApiResponse.success("领料单创建成功", saved);
    }

    // ==================== 提交审批 ====================

    @PostMapping("/{requisitionId}/submit")
    @Operation(summary = "提交领料单", description = "将草稿提交审批")
    public ApiResponse<MaterialRequisition> submit(
            @PathVariable String factoryId,
            @PathVariable String requisitionId) {
        return requisitionRepository.findByIdAndFactoryId(requisitionId, factoryId)
                .map(req -> {
                    if (req.getStatus() != MaterialRequisition.Status.DRAFT) {
                        return ApiResponse.<MaterialRequisition>error("只有草稿状态的领料单可以提交");
                    }
                    req.setStatus(MaterialRequisition.Status.SUBMITTED);
                    MaterialRequisition updated = requisitionRepository.save(req);
                    return ApiResponse.success("领料单已提交", updated);
                })
                .orElse(ApiResponse.error("领料单不存在: " + requisitionId));
    }

    // ==================== 审批通过 ====================

    @PostMapping("/{requisitionId}/approve")
    @Operation(summary = "审批通过", description = "审批通过并填写实际领用量")
    public ApiResponse<MaterialRequisition> approve(
            @PathVariable String factoryId,
            @PathVariable String requisitionId,
            @RequestAttribute("userId") @Parameter(hidden = true) Long approverId,
            @RequestBody(required = false) Map<String, Object> body) {
        return requisitionRepository.findByIdAndFactoryId(requisitionId, factoryId)
                .map(req -> {
                    if (req.getStatus() != MaterialRequisition.Status.SUBMITTED) {
                        return ApiResponse.<MaterialRequisition>error("只有已提交的领料单可以审批");
                    }
                    req.setStatus(MaterialRequisition.Status.APPROVED);
                    req.setApprovedBy(approverId);
                    req.setApprovedAt(LocalDateTime.now());

                    // 如果 body 包含 actualQuantity，更新实际领用量
                    if (body != null && body.containsKey("actualQuantity")) {
                        req.setActualQuantity(new BigDecimal(body.get("actualQuantity").toString()));
                    } else if (req.getActualQuantity() == null) {
                        // 默认实际量等于申请量
                        req.setActualQuantity(req.getRequestedQuantity());
                    }

                    MaterialRequisition updated = requisitionRepository.save(req);
                    return ApiResponse.success("领料单已审批通过", updated);
                })
                .orElse(ApiResponse.error("领料单不存在: " + requisitionId));
    }

    // ==================== 驳回 ====================

    @PostMapping("/{requisitionId}/reject")
    @Operation(summary = "驳回领料单")
    public ApiResponse<MaterialRequisition> reject(
            @PathVariable String factoryId,
            @PathVariable String requisitionId,
            @RequestAttribute("userId") @Parameter(hidden = true) Long approverId,
            @RequestBody(required = false) Map<String, Object> body) {
        return requisitionRepository.findByIdAndFactoryId(requisitionId, factoryId)
                .map(req -> {
                    if (req.getStatus() != MaterialRequisition.Status.SUBMITTED) {
                        return ApiResponse.<MaterialRequisition>error("只有已提交的领料单可以驳回");
                    }
                    req.setStatus(MaterialRequisition.Status.REJECTED);
                    req.setApprovedBy(approverId);
                    req.setApprovedAt(LocalDateTime.now());
                    if (body != null && body.containsKey("reason")) {
                        req.setNotes(body.get("reason").toString());
                    }
                    MaterialRequisition updated = requisitionRepository.save(req);
                    return ApiResponse.success("领料单已驳回", updated);
                })
                .orElse(ApiResponse.error("领料单不存在: " + requisitionId));
    }

    // ==================== 日汇总 ====================

    @GetMapping("/daily-summary")
    @Operation(summary = "日消耗汇总", description = "按食材聚合当天所有已审批的领料量")
    public ApiResponse<Map<String, Object>> dailySummary(
            @PathVariable String factoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        List<Object[]> rows = requisitionRepository.getDailySummaryByMaterial(factoryId, targetDate);

        List<Map<String, Object>> items = rows.stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("rawMaterialTypeId", row[0]);
            m.put("unit", row[1]);
            m.put("totalQuantity", row[2]);
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("date", targetDate.toString());
        result.put("materialCount", items.size());
        result.put("items", items);
        return ApiResponse.success(result);
    }

    // ==================== 统计概览 ====================

    @GetMapping("/statistics")
    @Operation(summary = "领料统计概览")
    public ApiResponse<Map<String, Object>> statistics(@PathVariable String factoryId) {
        long total = requisitionRepository.findByFactoryIdOrderByCreatedAtDesc(
                factoryId, PageRequest.of(0, 1)).getTotalElements();
        long pending = requisitionRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(
                factoryId, MaterialRequisition.Status.SUBMITTED, PageRequest.of(0, 1)).getTotalElements();
        long approved = requisitionRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(
                factoryId, MaterialRequisition.Status.APPROVED, PageRequest.of(0, 1)).getTotalElements();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalRequisitions", total);
        result.put("pendingApproval", pending);
        result.put("approved", approved);
        return ApiResponse.success(result);
    }
}
