package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.smartbi.ConfigOperationResult;
import com.cretas.aims.entity.smartbi.*;
import com.cretas.aims.service.smartbi.SmartBIConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

/**
 * SmartBI 配置管理控制器
 *
 * <p>提供统一的 REST API 管理 SmartBI 所有动态配置：
 * <ul>
 *   <li>意图配置（CRUD + reload）</li>
 *   <li>告警阈值（CRUD + reload）</li>
 *   <li>激励规则（CRUD + reload）</li>
 *   <li>字段映射（CRUD + reload）</li>
 *   <li>指标公式（CRUD + reload）</li>
 *   <li>全局配置重载和状态查询</li>
 * </ul>
 *
 * <p>安全说明：此 API 仅限管理员访问，请在 SecurityConfig 中配置权限控制。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/smartbi-config")
@RequiredArgsConstructor
@Tag(name = "SmartBI 配置管理", description = "SmartBI 动态配置管理 API（管理员专用）")
public class SmartBIConfigController {

    private final SmartBIConfigService configService;

    // ==================== 意图配置 ====================

    @GetMapping("/intents")
    @Operation(summary = "获取意图配置列表", description = "获取所有意图配置，可按分类筛选")
    public ResponseEntity<ApiResponse<List<AiIntentConfig>>> listIntents(
            @Parameter(description = "意图分类: QUERY/ANALYSIS/ALERT/ACTION")
            @RequestParam(required = false) String category) {

        log.info("获取意图配置列表: category={}", category);
        try {
            List<AiIntentConfig> intents = configService.listIntents(category);
            return ResponseEntity.ok(ApiResponse.success(intents));
        } catch (Exception e) {
            log.error("获取意图配置失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    @PostMapping("/intents")
    @Operation(summary = "创建意图配置", description = "创建新的意图配置")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> createIntent(
            @RequestBody @Valid AiIntentConfig config) {

        log.info("创建意图配置: intentCode={}", config.getIntentCode());
        try {
            ConfigOperationResult result = configService.createIntent(config);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("创建成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("创建意图配置失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("创建失败: " + e.getMessage()));
        }
    }

    @PutMapping("/intents/{id}")
    @Operation(summary = "更新意图配置", description = "更新指定的意图配置")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> updateIntent(
            @Parameter(description = "配置ID") @PathVariable String id,
            @RequestBody @Valid AiIntentConfig config) {

        log.info("更新意图配置: id={}", id);
        try {
            ConfigOperationResult result = configService.updateIntent(id, config);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("更新成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("更新意图配置失败: id={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("更新失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/intents/{id}")
    @Operation(summary = "删除意图配置", description = "删除指定的意图配置（软删除）")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> deleteIntent(
            @Parameter(description = "配置ID") @PathVariable String id) {

        log.info("删除意图配置: id={}", id);
        try {
            ConfigOperationResult result = configService.deleteIntent(id);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("删除成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("删除意图配置失败: id={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("删除失败: " + e.getMessage()));
        }
    }

    @PostMapping("/intents/reload")
    @Operation(summary = "重载意图配置", description = "重新加载意图配置缓存")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> reloadIntents() {

        log.info("重载意图配置");
        try {
            ConfigOperationResult result = configService.reloadIntents();
            return ResponseEntity.ok(ApiResponse.success("重载成功", result));
        } catch (Exception e) {
            log.error("重载意图配置失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("重载失败: " + e.getMessage()));
        }
    }

    // ==================== 告警阈值 ====================

    @GetMapping("/thresholds")
    @Operation(summary = "获取告警阈值列表", description = "获取所有告警阈值配置，可按类型筛选")
    public ResponseEntity<ApiResponse<List<SmartBiAlertThreshold>>> listThresholds(
            @Parameter(description = "阈值类型: SALES/FINANCE/DEPARTMENT/PRODUCTION/QUALITY")
            @RequestParam(required = false) String type) {

        log.info("获取告警阈值列表: type={}", type);
        try {
            List<SmartBiAlertThreshold> thresholds = configService.listThresholds(type);
            return ResponseEntity.ok(ApiResponse.success(thresholds));
        } catch (Exception e) {
            log.error("获取告警阈值失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    @PostMapping("/thresholds")
    @Operation(summary = "创建告警阈值", description = "创建新的告警阈值配置")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> createThreshold(
            @RequestBody @Valid SmartBiAlertThreshold threshold) {

        log.info("创建告警阈值: type={}, metricCode={}",
                threshold.getThresholdType(), threshold.getMetricCode());
        try {
            ConfigOperationResult result = configService.createThreshold(threshold);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("创建成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("创建告警阈值失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("创建失败: " + e.getMessage()));
        }
    }

    @PutMapping("/thresholds/{id}")
    @Operation(summary = "更新告警阈值", description = "更新指定的告警阈值配置")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> updateThreshold(
            @Parameter(description = "配置ID") @PathVariable Long id,
            @RequestBody @Valid SmartBiAlertThreshold threshold) {

        log.info("更新告警阈值: id={}", id);
        try {
            ConfigOperationResult result = configService.updateThreshold(id, threshold);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("更新成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("更新告警阈值失败: id={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("更新失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/thresholds/{id}")
    @Operation(summary = "删除告警阈值", description = "删除指定的告警阈值配置（软删除）")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> deleteThreshold(
            @Parameter(description = "配置ID") @PathVariable Long id) {

        log.info("删除告警阈值: id={}", id);
        try {
            ConfigOperationResult result = configService.deleteThreshold(id);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("删除成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("删除告警阈值失败: id={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("删除失败: " + e.getMessage()));
        }
    }

    @PostMapping("/thresholds/reload")
    @Operation(summary = "重载告警阈值", description = "重新加载告警阈值缓存")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> reloadThresholds() {

        log.info("重载告警阈值");
        try {
            ConfigOperationResult result = configService.reloadThresholds();
            return ResponseEntity.ok(ApiResponse.success("重载成功", result));
        } catch (Exception e) {
            log.error("重载告警阈值失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("重载失败: " + e.getMessage()));
        }
    }

    // ==================== 激励规则 ====================

    @GetMapping("/incentive-rules")
    @Operation(summary = "获取激励规则列表", description = "获取所有激励规则配置，可按规则代码筛选")
    public ResponseEntity<ApiResponse<List<SmartBiIncentiveRule>>> listIncentiveRules(
            @Parameter(description = "规则代码: SALES_TARGET/QUALITY_SCORE/ATTENDANCE_RATE")
            @RequestParam(required = false) String ruleCode) {

        log.info("获取激励规则列表: ruleCode={}", ruleCode);
        try {
            List<SmartBiIncentiveRule> rules = configService.listIncentiveRules(ruleCode);
            return ResponseEntity.ok(ApiResponse.success(rules));
        } catch (Exception e) {
            log.error("获取激励规则失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    @PostMapping("/incentive-rules")
    @Operation(summary = "创建激励规则", description = "创建新的激励规则配置")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> createIncentiveRule(
            @RequestBody @Valid SmartBiIncentiveRule rule) {

        log.info("创建激励规则: ruleCode={}, levelName={}",
                rule.getRuleCode(), rule.getLevelName());
        try {
            ConfigOperationResult result = configService.createIncentiveRule(rule);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("创建成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("创建激励规则失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("创建失败: " + e.getMessage()));
        }
    }

    @PutMapping("/incentive-rules/{id}")
    @Operation(summary = "更新激励规则", description = "更新指定的激励规则配置")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> updateIncentiveRule(
            @Parameter(description = "配置ID") @PathVariable Long id,
            @RequestBody @Valid SmartBiIncentiveRule rule) {

        log.info("更新激励规则: id={}", id);
        try {
            ConfigOperationResult result = configService.updateIncentiveRule(id, rule);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("更新成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("更新激励规则失败: id={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("更新失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/incentive-rules/{id}")
    @Operation(summary = "删除激励规则", description = "删除指定的激励规则配置（软删除）")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> deleteIncentiveRule(
            @Parameter(description = "配置ID") @PathVariable Long id) {

        log.info("删除激励规则: id={}", id);
        try {
            ConfigOperationResult result = configService.deleteIncentiveRule(id);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("删除成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("删除激励规则失败: id={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("删除失败: " + e.getMessage()));
        }
    }

    @PostMapping("/incentive-rules/reload")
    @Operation(summary = "重载激励规则", description = "重新加载激励规则缓存")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> reloadIncentiveRules() {

        log.info("重载激励规则");
        try {
            ConfigOperationResult result = configService.reloadIncentiveRules();
            return ResponseEntity.ok(ApiResponse.success("重载成功", result));
        } catch (Exception e) {
            log.error("重载激励规则失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("重载失败: " + e.getMessage()));
        }
    }

    // ==================== 字段映射 ====================

    @GetMapping("/field-mappings")
    @Operation(summary = "获取字段映射列表", description = "获取所有字段映射配置，可按字典类型筛选")
    public ResponseEntity<ApiResponse<List<SmartBiDictionary>>> listFieldMappings(
            @Parameter(description = "字典类型: region/department/metric/time/dimension")
            @RequestParam(required = false) String dictType) {

        log.info("获取字段映射列表: dictType={}", dictType);
        try {
            List<SmartBiDictionary> mappings = configService.listFieldMappings(dictType);
            return ResponseEntity.ok(ApiResponse.success(mappings));
        } catch (Exception e) {
            log.error("获取字段映射失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    @PostMapping("/field-mappings")
    @Operation(summary = "创建字段映射", description = "创建新的字段映射配置")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> createFieldMapping(
            @RequestBody @Valid SmartBiDictionary mapping) {

        log.info("创建字段映射: dictType={}, name={}",
                mapping.getDictType(), mapping.getName());
        try {
            ConfigOperationResult result = configService.createFieldMapping(mapping);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("创建成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("创建字段映射失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("创建失败: " + e.getMessage()));
        }
    }

    @PutMapping("/field-mappings/{id}")
    @Operation(summary = "更新字段映射", description = "更新指定的字段映射配置")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> updateFieldMapping(
            @Parameter(description = "配置ID") @PathVariable Long id,
            @RequestBody @Valid SmartBiDictionary mapping) {

        log.info("更新字段映射: id={}", id);
        try {
            ConfigOperationResult result = configService.updateFieldMapping(id, mapping);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("更新成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("更新字段映射失败: id={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("更新失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/field-mappings/{id}")
    @Operation(summary = "删除字段映射", description = "删除指定的字段映射配置（软删除）")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> deleteFieldMapping(
            @Parameter(description = "配置ID") @PathVariable Long id) {

        log.info("删除字段映射: id={}", id);
        try {
            ConfigOperationResult result = configService.deleteFieldMapping(id);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("删除成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("删除字段映射失败: id={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("删除失败: " + e.getMessage()));
        }
    }

    @PostMapping("/field-mappings/reload")
    @Operation(summary = "重载字段映射", description = "重新加载字段映射缓存")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> reloadFieldMappings() {

        log.info("重载字段映射");
        try {
            ConfigOperationResult result = configService.reloadFieldMappings();
            return ResponseEntity.ok(ApiResponse.success("重载成功", result));
        } catch (Exception e) {
            log.error("重载字段映射失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("重载失败: " + e.getMessage()));
        }
    }

    // ==================== 指标公式 ====================

    @GetMapping("/metric-formulas")
    @Operation(summary = "获取指标公式列表", description = "获取所有指标公式配置，可按公式类型筛选")
    public ResponseEntity<ApiResponse<List<SmartBiMetricFormula>>> listMetricFormulas(
            @Parameter(description = "公式类型: SIMPLE/DERIVED/CUSTOM")
            @RequestParam(required = false) String formulaType) {

        log.info("获取指标公式列表: formulaType={}", formulaType);
        try {
            List<SmartBiMetricFormula> formulas = configService.listMetricFormulas(formulaType);
            return ResponseEntity.ok(ApiResponse.success(formulas));
        } catch (Exception e) {
            log.error("获取指标公式失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    @PostMapping("/metric-formulas")
    @Operation(summary = "创建指标公式", description = "创建新的指标公式配置")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> createMetricFormula(
            @RequestBody @Valid SmartBiMetricFormula formula) {

        log.info("创建指标公式: metricCode={}", formula.getMetricCode());
        try {
            ConfigOperationResult result = configService.createMetricFormula(formula);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("创建成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("创建指标公式失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("创建失败: " + e.getMessage()));
        }
    }

    @PutMapping("/metric-formulas/{id}")
    @Operation(summary = "更新指标公式", description = "更新指定的指标公式配置")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> updateMetricFormula(
            @Parameter(description = "配置ID") @PathVariable Long id,
            @RequestBody @Valid SmartBiMetricFormula formula) {

        log.info("更新指标公式: id={}", id);
        try {
            ConfigOperationResult result = configService.updateMetricFormula(id, formula);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("更新成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("更新指标公式失败: id={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("更新失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/metric-formulas/{id}")
    @Operation(summary = "删除指标公式", description = "删除指定的指标公式配置（软删除）")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> deleteMetricFormula(
            @Parameter(description = "配置ID") @PathVariable Long id) {

        log.info("删除指标公式: id={}", id);
        try {
            ConfigOperationResult result = configService.deleteMetricFormula(id);
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("删除成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("删除指标公式失败: id={}, error={}", id, e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("删除失败: " + e.getMessage()));
        }
    }

    @PostMapping("/metric-formulas/reload")
    @Operation(summary = "重载指标公式", description = "重新加载指标公式缓存")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> reloadMetricFormulas() {

        log.info("重载指标公式");
        try {
            ConfigOperationResult result = configService.reloadMetricFormulas();
            return ResponseEntity.ok(ApiResponse.success("重载成功", result));
        } catch (Exception e) {
            log.error("重载指标公式失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("重载失败: " + e.getMessage()));
        }
    }

    // ==================== 全局操作 ====================

    @PostMapping("/reload-all")
    @Operation(summary = "重载所有配置", description = "重新加载所有 SmartBI 配置缓存")
    public ResponseEntity<ApiResponse<ConfigOperationResult>> reloadAll() {

        log.info("重载所有 SmartBI 配置");
        try {
            ConfigOperationResult result = configService.reloadAll();
            return ResponseEntity.ok(ApiResponse.success("重载成功", result));
        } catch (Exception e) {
            log.error("重载所有配置失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("重载失败: " + e.getMessage()));
        }
    }

    @GetMapping("/status")
    @Operation(summary = "获取配置状态", description = "获取所有配置的状态摘要（数量、缓存大小、最后更新时间等）")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getConfigStatus() {

        log.info("获取配置状态");
        try {
            Map<String, Object> status = configService.getConfigStatus();
            return ResponseEntity.ok(ApiResponse.success(status));
        } catch (Exception e) {
            log.error("获取配置状态失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }
}
