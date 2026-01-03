package com.cretas.aims.controller;

import com.cretas.aims.entity.Supplier;
import com.cretas.aims.repository.SupplierRepository;
import com.cretas.aims.service.SupplierAdmissionRuleService;
import com.cretas.aims.service.SupplierAdmissionRuleService.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 供应商准入控制器
 * 提供供应商准入评估、供货许可检查、验收策略生成等API
 *
 * @author Claude AI
 * @since 2025-12-30
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/supplier-admission")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "供应商准入管理", description = "供应商准入评估相关接口，包括准入资格评估、供货许可检查、验收策略生成、准入规则配置、供应商评估报告等功能")
public class SupplierAdmissionController {

    private final SupplierAdmissionRuleService supplierAdmissionRuleService;
    private final SupplierRepository supplierRepository;

    /**
     * 评估供应商准入资格
     *
     * @param factoryId 工厂ID
     * @param supplierId 供应商ID
     * @return 准入评估结果
     */
    @GetMapping("/evaluate/{supplierId}")
    @Operation(summary = "评估供应商准入资格", description = "对指定供应商进行准入资格评估，检查资质证书、信用额度、历史记录等，返回综合评估结果")
    public ResponseEntity<Map<String, Object>> evaluateAdmission(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "供应商ID", example = "SUP001") String supplierId) {

        log.info("评估供应商准入资格: factoryId={}, supplierId={}", factoryId, supplierId);

        Map<String, Object> response = new HashMap<>();

        try {
            // 查找供应商
            Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                    .orElse(null);

            if (supplier == null) {
                response.put("success", false);
                response.put("message", "供应商不存在");
                return ResponseEntity.badRequest().body(response);
            }

            // 执行准入评估
            AdmissionEvaluationResult result = supplierAdmissionRuleService
                    .evaluateAdmission(factoryId, supplier);

            response.put("success", true);
            response.put("data", result);
            response.put("message", "评估完成");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("评估供应商准入失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "评估失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 批量评估供应商准入资格
     *
     * @param factoryId 工厂ID
     * @param request 包含供应商ID列表
     * @return 批量评估结果
     */
    @PostMapping("/evaluate/batch")
    @Operation(summary = "批量评估供应商准入资格", description = "对多个供应商进行批量准入资格评估，返回每个供应商的评估结果列表")
    public ResponseEntity<Map<String, Object>> evaluateAdmissionBatch(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Parameter(description = "批量评估请求，包含supplierIds数组") Map<String, Object> request) {

        log.info("批量评估供应商准入: factoryId={}", factoryId);

        Map<String, Object> response = new HashMap<>();

        try {
            @SuppressWarnings("unchecked")
            List<String> supplierIds = (List<String>) request.get("supplierIds");

            if (supplierIds == null || supplierIds.isEmpty()) {
                response.put("success", false);
                response.put("message", "供应商ID列表不能为空");
                return ResponseEntity.badRequest().body(response);
            }

            // 优化：批量查询供应商避免 N+1 问题
            Map<String, Supplier> supplierMap = supplierRepository
                    .findByIdInAndFactoryId(supplierIds, factoryId)
                    .stream()
                    .collect(Collectors.toMap(Supplier::getId, Function.identity()));

            List<Map<String, Object>> results = new java.util.ArrayList<>();

            for (String supplierId : supplierIds) {
                Map<String, Object> resultItem = new HashMap<>();
                resultItem.put("supplierId", supplierId);

                Supplier supplier = supplierMap.get(supplierId);

                if (supplier == null) {
                    resultItem.put("success", false);
                    resultItem.put("message", "供应商不存在");
                } else {
                    AdmissionEvaluationResult evalResult = supplierAdmissionRuleService
                            .evaluateAdmission(factoryId, supplier);
                    resultItem.put("success", true);
                    resultItem.put("result", evalResult);
                }

                results.add(resultItem);
            }

            response.put("success", true);
            response.put("data", results);
            response.put("message", "批量评估完成");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("批量评估失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "批量评估失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 检查供应商供货许可
     *
     * @param factoryId 工厂ID
     * @param supplierId 供应商ID
     * @param materialTypeId 原料类型ID
     * @return 供货许可结果
     */
    @GetMapping("/permission/{supplierId}")
    @Operation(summary = "检查供应商供货许可", description = "检查指定供应商对特定原料类型的供货许可状态，验证是否允许供货")
    public ResponseEntity<Map<String, Object>> checkSupplyPermission(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "供应商ID", example = "SUP001") String supplierId,
            @RequestParam @Parameter(description = "原料类型ID", example = "MT001") String materialTypeId) {

        log.info("检查供货许可: factoryId={}, supplierId={}, materialTypeId={}",
                factoryId, supplierId, materialTypeId);

        Map<String, Object> response = new HashMap<>();

        try {
            Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                    .orElse(null);

            if (supplier == null) {
                response.put("success", false);
                response.put("message", "供应商不存在");
                return ResponseEntity.badRequest().body(response);
            }

            SupplyPermissionResult result = supplierAdmissionRuleService
                    .checkSupplyPermission(factoryId, supplier, materialTypeId);

            response.put("success", true);
            response.put("data", result);
            response.put("message", result.isPermitted() ? "允许供货" : "供货受限");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("检查供货许可失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "检查失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 生成验收策略
     *
     * @param factoryId 工厂ID
     * @param request 包含供应商ID、原料类型ID、数量
     * @return 验收策略
     */
    @PostMapping("/acceptance-strategy")
    @Operation(summary = "生成验收策略", description = "根据供应商信息、原料类型和数量，生成相应的验收策略，包括抽检比例、检测项目等")
    public ResponseEntity<Map<String, Object>> generateAcceptanceStrategy(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Parameter(description = "验收策略请求，包含supplierId、materialTypeId、quantity") Map<String, Object> request) {

        log.info("生成验收策略: factoryId={}", factoryId);

        Map<String, Object> response = new HashMap<>();

        try {
            String supplierId = (String) request.get("supplierId");
            String materialTypeId = (String) request.get("materialTypeId");
            Object quantityObj = request.get("quantity");

            if (supplierId == null || materialTypeId == null || quantityObj == null) {
                response.put("success", false);
                response.put("message", "缺少必要参数: supplierId, materialTypeId, quantity");
                return ResponseEntity.badRequest().body(response);
            }

            BigDecimal quantity;
            if (quantityObj instanceof Number) {
                quantity = new BigDecimal(quantityObj.toString());
            } else {
                quantity = new BigDecimal((String) quantityObj);
            }

            Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                    .orElse(null);

            if (supplier == null) {
                response.put("success", false);
                response.put("message", "供应商不存在");
                return ResponseEntity.badRequest().body(response);
            }

            AcceptanceStrategy strategy = supplierAdmissionRuleService
                    .generateAcceptanceStrategy(factoryId, supplier, materialTypeId, quantity);

            response.put("success", true);
            response.put("data", strategy);
            response.put("message", "验收策略生成成功");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("生成验收策略失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "生成失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 获取供应商准入规则配置
     *
     * @param factoryId 工厂ID
     * @return 规则配置
     */
    @GetMapping("/rules")
    @Operation(summary = "获取供应商准入规则配置", description = "获取工厂的供应商准入规则配置信息，包括准入评分阈值、资质要求、信用额度标准等")
    public ResponseEntity<Map<String, Object>> getRuleConfiguration(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        log.info("获取准入规则配置: factoryId={}", factoryId);

        Map<String, Object> response = new HashMap<>();

        try {
            SupplierRuleConfig config = supplierAdmissionRuleService
                    .getRuleConfiguration(factoryId);

            response.put("success", true);
            response.put("data", config);
            response.put("message", "获取成功");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("获取规则配置失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "获取失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 更新供应商准入规则配置
     *
     * @param factoryId 工厂ID
     * @param config 新的规则配置
     * @return 更新后的配置
     */
    @PutMapping("/rules")
    @Operation(summary = "更新供应商准入规则配置", description = "更新工厂的供应商准入规则配置，可调整评分阈值、资质要求、信用额度标准等")
    public ResponseEntity<Map<String, Object>> updateRuleConfiguration(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Parameter(description = "准入规则配置信息") SupplierRuleConfig config) {

        log.info("更新准入规则配置: factoryId={}", factoryId);

        Map<String, Object> response = new HashMap<>();

        try {
            SupplierRuleConfig updatedConfig = supplierAdmissionRuleService
                    .updateRuleConfiguration(factoryId, config);

            response.put("success", true);
            response.put("data", updatedConfig);
            response.put("message", "更新成功");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("更新规则配置失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "更新失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 获取供应商详细评估报告
     * 包含准入评估、供货能力、历史记录等综合信息
     *
     * @param factoryId 工厂ID
     * @param supplierId 供应商ID
     * @return 综合评估报告
     */
    @GetMapping("/report/{supplierId}")
    @Operation(summary = "获取供应商详细评估报告", description = "获取供应商的综合评估报告，包含准入评估、供货能力、历史记录等信息")
    public ResponseEntity<Map<String, Object>> getSupplierReport(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "供应商ID", example = "SUP001") String supplierId) {

        log.info("获取供应商评估报告: factoryId={}, supplierId={}", factoryId, supplierId);

        Map<String, Object> response = new HashMap<>();

        try {
            Supplier supplier = supplierRepository.findByIdAndFactoryId(supplierId, factoryId)
                    .orElse(null);

            if (supplier == null) {
                response.put("success", false);
                response.put("message", "供应商不存在");
                return ResponseEntity.badRequest().body(response);
            }

            // 准入评估
            AdmissionEvaluationResult admissionResult = supplierAdmissionRuleService
                    .evaluateAdmission(factoryId, supplier);

            // 构建报告
            Map<String, Object> report = new HashMap<>();
            report.put("supplier", buildSupplierSummary(supplier));
            report.put("admissionEvaluation", admissionResult);
            report.put("generatedAt", java.time.LocalDateTime.now().toString());

            response.put("success", true);
            response.put("data", report);
            response.put("message", "报告生成成功");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("获取评估报告失败: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("message", "获取失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 构建供应商摘要信息
     */
    private Map<String, Object> buildSupplierSummary(Supplier supplier) {
        Map<String, Object> summary = new HashMap<>();
        summary.put("id", supplier.getId());
        summary.put("name", supplier.getName());
        summary.put("code", supplier.getCode());
        summary.put("contactPerson", supplier.getContactPerson());
        summary.put("contactPhone", supplier.getContactPhone());
        summary.put("rating", supplier.getRating());
        summary.put("isActive", supplier.getIsActive());
        summary.put("businessLicense", supplier.getBusinessLicense() != null ? "已提供" : "未提供");
        summary.put("qualityCertificates", supplier.getQualityCertificates());
        summary.put("creditLimit", supplier.getCreditLimit());
        summary.put("currentBalance", supplier.getCurrentBalance());
        return summary;
    }
}
