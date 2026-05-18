package com.cretas.aims.controller;

import com.cretas.aims.config.RequireRole;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.inventory.PurchaseOrderApprovalRule;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.inventory.PurchaseOrderApprovalRuleRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * 采购订单审批规则 — 自由配置端点 (Issue follow-up F006 客户).
 *
 * <p>per-factory 配置 3 字段:
 * <ul>
 *   <li>priceVarianceThreshold — 价格偏差%阈值, 默认 10</li>
 *   <li>amountThreshold — 金额阈值 (null = 不触发金额条件)</li>
 *   <li>enabled — 启用/关闭 (关闭后所有 PO 不经财务复核, 直接 APPROVED)</li>
 * </ul>
 *
 * <p>触发任一条件 → PO 状态 = PENDING_FINANCE_REVIEW (进财务待审列表).
 * 都不触发 → 状态 = APPROVED (直接通过).
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/purchase-approval-rules")
@Tag(name = "采购审批规则", description = "采购单财务复核触发条件 自由配置")
@RequiredArgsConstructor
public class PurchaseApprovalRuleController {

    private final PurchaseOrderApprovalRuleRepository repo;

    @Data
    public static class RuleRequest {
        @NotBlank(message = "规则名称不能为空")
        private String ruleName;

        @DecimalMin(value = "0.00", message = "价格偏差阈值不能为负")
        @DecimalMax(value = "100.00", message = "价格偏差阈值不能超过 100%")
        private BigDecimal priceVarianceThreshold;

        /** 金额阈值, null = 不触发金额条件. */
        @DecimalMin(value = "0.00", message = "金额阈值不能为负")
        private BigDecimal amountThreshold;

        private Boolean enabled = true;
    }

    @GetMapping
    @Operation(summary = "列出工厂的所有审批规则")
    @RequireRole({"factory_super_admin", "permission_admin", "procurement_manager", "finance_manager"})
    public ApiResponse<List<PurchaseOrderApprovalRule>> list(@PathVariable String factoryId) {
        // 列全部 (含 disabled), 用于 UI 管理
        List<PurchaseOrderApprovalRule> rules = repo.findAll().stream()
                .filter(r -> factoryId.equals(r.getFactoryId()))
                .toList();
        return ApiResponse.success(rules);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取单条规则")
    @RequireRole({"factory_super_admin", "permission_admin", "procurement_manager", "finance_manager"})
    public ApiResponse<PurchaseOrderApprovalRule> get(@PathVariable String factoryId, @PathVariable String id) {
        PurchaseOrderApprovalRule rule = repo.findById(id)
                .orElseThrow(() -> new BusinessException(404, "规则不存在: " + id));
        if (!factoryId.equals(rule.getFactoryId())) {
            throw new BusinessException(403, "无权访问其他工厂的规则");
        }
        return ApiResponse.success(rule);
    }

    @PostMapping
    @Operation(summary = "创建审批规则")
    @RequireRole({"factory_super_admin", "permission_admin"})
    @Transactional
    public ApiResponse<PurchaseOrderApprovalRule> create(
            @PathVariable String factoryId,
            @Valid @RequestBody RuleRequest request) {
        // 唯一约束 factory_id + rule_name
        Optional<PurchaseOrderApprovalRule> existing = repo.findByFactoryIdAndRuleName(factoryId, request.getRuleName());
        if (existing.isPresent()) {
            throw new BusinessException(409, "规则名已存在: " + request.getRuleName())
                    .withHint("请使用其他名称")
                    .withSeverity("warning")
                    .withHintTarget("ruleName");
        }
        PurchaseOrderApprovalRule rule = new PurchaseOrderApprovalRule();
        rule.setFactoryId(factoryId);
        rule.setRuleName(request.getRuleName());
        rule.setPriceVarianceThreshold(request.getPriceVarianceThreshold() != null
                ? request.getPriceVarianceThreshold()
                : new BigDecimal("10.00"));
        rule.setAmountThreshold(request.getAmountThreshold());
        rule.setEnabled(request.getEnabled() != null ? request.getEnabled() : true);
        PurchaseOrderApprovalRule saved = repo.save(rule);
        log.info("创建采购审批规则: factoryId={}, ruleName={}, priceThreshold={}, amountThreshold={}, enabled={}",
                factoryId, saved.getRuleName(), saved.getPriceVarianceThreshold(),
                saved.getAmountThreshold(), saved.getEnabled());
        return ApiResponse.success("规则创建成功", saved);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新审批规则")
    @RequireRole({"factory_super_admin", "permission_admin"})
    @Transactional
    public ApiResponse<PurchaseOrderApprovalRule> update(
            @PathVariable String factoryId,
            @PathVariable String id,
            @Valid @RequestBody RuleRequest request) {
        PurchaseOrderApprovalRule rule = repo.findById(id)
                .orElseThrow(() -> new BusinessException(404, "规则不存在: " + id));
        if (!factoryId.equals(rule.getFactoryId())) {
            throw new BusinessException(403, "无权修改其他工厂的规则");
        }
        // 改名时再 check 唯一
        if (!rule.getRuleName().equals(request.getRuleName())) {
            Optional<PurchaseOrderApprovalRule> dup = repo.findByFactoryIdAndRuleName(factoryId, request.getRuleName());
            if (dup.isPresent() && !dup.get().getId().equals(id)) {
                throw new BusinessException(409, "规则名已存在: " + request.getRuleName())
                        .withHint("请使用其他名称")
                        .withSeverity("warning")
                        .withHintTarget("ruleName");
            }
        }
        rule.setRuleName(request.getRuleName());
        if (request.getPriceVarianceThreshold() != null) {
            rule.setPriceVarianceThreshold(request.getPriceVarianceThreshold());
        }
        rule.setAmountThreshold(request.getAmountThreshold());
        if (request.getEnabled() != null) {
            rule.setEnabled(request.getEnabled());
        }
        PurchaseOrderApprovalRule saved = repo.save(rule);
        log.info("更新采购审批规则: id={}, factoryId={}, ruleName={}, priceThreshold={}, amountThreshold={}, enabled={}",
                id, factoryId, saved.getRuleName(), saved.getPriceVarianceThreshold(),
                saved.getAmountThreshold(), saved.getEnabled());
        return ApiResponse.success("规则更新成功", saved);
    }

    @PostMapping("/{id}/toggle")
    @Operation(summary = "启用/禁用 规则")
    @RequireRole({"factory_super_admin", "permission_admin"})
    @Transactional
    public ApiResponse<PurchaseOrderApprovalRule> toggle(@PathVariable String factoryId, @PathVariable String id) {
        PurchaseOrderApprovalRule rule = repo.findById(id)
                .orElseThrow(() -> new BusinessException(404, "规则不存在: " + id));
        if (!factoryId.equals(rule.getFactoryId())) {
            throw new BusinessException(403, "无权修改其他工厂的规则");
        }
        rule.setEnabled(!Boolean.TRUE.equals(rule.getEnabled()));
        PurchaseOrderApprovalRule saved = repo.save(rule);
        log.info("toggle 采购审批规则: id={}, enabled={}", id, saved.getEnabled());
        return ApiResponse.success(saved.getEnabled() ? "规则已启用" : "规则已禁用", saved);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除规则 (软删)")
    @RequireRole({"factory_super_admin", "permission_admin"})
    @Transactional
    public ApiResponse<Void> delete(@PathVariable String factoryId, @PathVariable String id) {
        PurchaseOrderApprovalRule rule = repo.findById(id)
                .orElseThrow(() -> new BusinessException(404, "规则不存在: " + id));
        if (!factoryId.equals(rule.getFactoryId())) {
            throw new BusinessException(403, "无权删除其他工厂的规则");
        }
        rule.softDelete();
        repo.save(rule);
        log.info("删除采购审批规则: id={}, ruleName={}", id, rule.getRuleName());
        return ApiResponse.success("规则已删除", null);
    }
}
