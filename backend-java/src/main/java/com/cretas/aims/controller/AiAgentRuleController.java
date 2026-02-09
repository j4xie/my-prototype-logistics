package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.smartbi.AiAgentRule;
import com.cretas.aims.repository.smartbi.AiAgentRuleRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * AI Agent 规则管理控制器
 *
 * 提供 AI Agent 规则的 CRUD 管理 API:
 * - 规则列表查询（支持按触发类型、工厂过滤）
 * - 规则创建、更新、删除
 * - 规则启用/禁用切换
 * - 规则优先级调整
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/ai/agent/rules")
@RequiredArgsConstructor
@Tag(name = "AI Agent规则管理", description = "AI Agent 规则配置管理 API")
public class AiAgentRuleController {

    private final AiAgentRuleRepository aiAgentRuleRepository;

    // ==================== 规则查询 ====================

    @GetMapping
    @Operation(summary = "获取所有规则", description = "获取工厂的所有启用的 AI Agent 规则列表")
    public ResponseEntity<ApiResponse<List<AiAgentRule>>> getAllRules(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        List<AiAgentRule> rules = aiAgentRuleRepository.findAllActiveByFactoryId(factoryId);
        log.debug("获取工厂 {} 的 AI Agent 规则，共 {} 条", factoryId, rules.size());
        return ResponseEntity.ok(ApiResponse.success(rules));
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")
    @Operation(summary = "获取所有规则（含禁用）", description = "获取工厂的所有 AI Agent 规则，包括已禁用的")
    public ResponseEntity<ApiResponse<List<AiAgentRule>>> getAllRulesIncludeDisabled(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        List<AiAgentRule> rules = aiAgentRuleRepository.findAll();
        // 过滤出属于该工厂或全局的规则
        rules = rules.stream()
                .filter(r -> "DEFAULT".equals(r.getFactoryId()) || factoryId.equals(r.getFactoryId()))
                .toList();
        return ResponseEntity.ok(ApiResponse.success(rules));
    }

    @GetMapping("/{ruleId}")
    @Operation(summary = "获取单个规则", description = "根据规则ID获取规则详情")
    public ResponseEntity<ApiResponse<AiAgentRule>> getRule(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "规则ID") @PathVariable String ruleId) {

        Optional<AiAgentRule> rule = aiAgentRuleRepository.findById(ruleId);
        if (rule.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.error("规则不存在: " + ruleId));
        }

        // 检查规则是否属于该工厂或是全局规则
        AiAgentRule r = rule.get();
        if (!"DEFAULT".equals(r.getFactoryId()) && !factoryId.equals(r.getFactoryId())) {
            return ResponseEntity.ok(ApiResponse.error("无权访问该规则"));
        }

        return ResponseEntity.ok(ApiResponse.success(r));
    }

    @GetMapping("/trigger/{triggerType}")
    @Operation(summary = "按触发类型获取规则", description = "获取指定触发类型的规则列表")
    public ResponseEntity<ApiResponse<List<AiAgentRule>>> getRulesByTriggerType(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "触发类型 (SOP_UPLOAD, BATCH_COMPLETE, QUALITY_ALERT, SCHEDULE_CHANGE)")
            @PathVariable String triggerType) {

        List<AiAgentRule> rules = aiAgentRuleRepository.findByFactoryIdAndTriggerTypeAndIsActiveTrue(
                factoryId, triggerType);
        return ResponseEntity.ok(ApiResponse.success(rules));
    }

    @GetMapping("/trigger-types")
    @Operation(summary = "获取所有触发类型", description = "获取系统支持的所有触发类型")
    public ResponseEntity<ApiResponse<List<Map<String, String>>>> getTriggerTypes(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        List<Map<String, String>> types = List.of(
                Map.of("code", "SOP_UPLOAD", "name", "SOP文档上传", "description", "当上传SOP文档时触发"),
                Map.of("code", "BATCH_COMPLETE", "name", "批次完成", "description", "当生产批次完成时触发"),
                Map.of("code", "QUALITY_ALERT", "name", "质量告警", "description", "当发生质量告警时触发"),
                Map.of("code", "SCHEDULE_CHANGE", "name", "排产变更", "description", "当排产计划变更时触发")
        );
        return ResponseEntity.ok(ApiResponse.success(types));
    }

    // ==================== 规则管理 ====================

    @PostMapping
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")
    @Operation(summary = "创建规则", description = "创建新的 AI Agent 规则（仅工厂管理员）")
    public ResponseEntity<ApiResponse<AiAgentRule>> createRule(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody AiAgentRule rule) {

        // 设置工厂ID
        rule.setFactoryId(factoryId);
        rule.setId(null); // 确保是新建

        // 设置默认值
        if (rule.getPriority() == null) {
            rule.setPriority(100);
        }
        if (rule.getIsActive() == null) {
            rule.setIsActive(true);
        }
        if (rule.getUseLlmSelection() == null) {
            rule.setUseLlmSelection(false);
        }

        AiAgentRule saved = aiAgentRuleRepository.save(rule);
        log.info("创建 AI Agent 规则: id={}, name={}, triggerType={}, factoryId={}",
                saved.getId(), saved.getRuleName(), saved.getTriggerType(), factoryId);

        return ResponseEntity.ok(ApiResponse.success("规则创建成功", saved));
    }

    @PutMapping("/{ruleId}")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")
    @Operation(summary = "更新规则", description = "更新现有的 AI Agent 规则（仅工厂管理员）")
    public ResponseEntity<ApiResponse<AiAgentRule>> updateRule(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "规则ID") @PathVariable String ruleId,
            @RequestBody AiAgentRule rule) {

        Optional<AiAgentRule> existing = aiAgentRuleRepository.findById(ruleId);
        if (existing.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.error("规则不存在: " + ruleId));
        }

        AiAgentRule existingRule = existing.get();

        // 检查权限：只能修改自己工厂的规则，不能修改全局规则
        if ("DEFAULT".equals(existingRule.getFactoryId())) {
            return ResponseEntity.ok(ApiResponse.error("无法修改全局规则，请联系平台管理员"));
        }
        if (!factoryId.equals(existingRule.getFactoryId())) {
            return ResponseEntity.ok(ApiResponse.error("无权修改该规则"));
        }

        // 更新字段
        existingRule.setRuleName(rule.getRuleName());
        existingRule.setRuleDescription(rule.getRuleDescription());
        existingRule.setTriggerType(rule.getTriggerType());
        existingRule.setTriggerEntity(rule.getTriggerEntity());
        existingRule.setToolChainConfig(rule.getToolChainConfig());
        existingRule.setUseLlmSelection(rule.getUseLlmSelection());
        existingRule.setLlmSelectionPrompt(rule.getLlmSelectionPrompt());
        existingRule.setConditionExpression(rule.getConditionExpression());
        existingRule.setPriority(rule.getPriority());

        AiAgentRule saved = aiAgentRuleRepository.save(existingRule);
        log.info("更新 AI Agent 规则: id={}, name={}", ruleId, saved.getRuleName());

        return ResponseEntity.ok(ApiResponse.success("规则更新成功", saved));
    }

    @DeleteMapping("/{ruleId}")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")
    @Operation(summary = "删除规则", description = "删除 AI Agent 规则（仅工厂管理员）")
    public ResponseEntity<ApiResponse<Void>> deleteRule(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "规则ID") @PathVariable String ruleId) {

        Optional<AiAgentRule> existing = aiAgentRuleRepository.findById(ruleId);
        if (existing.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.error("规则不存在: " + ruleId));
        }

        AiAgentRule rule = existing.get();

        // 检查权限
        if ("DEFAULT".equals(rule.getFactoryId())) {
            return ResponseEntity.ok(ApiResponse.error("无法删除全局规则，请联系平台管理员"));
        }
        if (!factoryId.equals(rule.getFactoryId())) {
            return ResponseEntity.ok(ApiResponse.error("无权删除该规则"));
        }

        aiAgentRuleRepository.delete(rule);
        log.info("删除 AI Agent 规则: id={}, name={}", ruleId, rule.getRuleName());

        return ResponseEntity.ok(ApiResponse.successMessage("规则删除成功"));
    }

    @PostMapping("/{ruleId}/toggle")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")
    @Operation(summary = "切换规则状态", description = "启用或禁用 AI Agent 规则（仅工厂管理员）")
    public ResponseEntity<ApiResponse<AiAgentRule>> toggleRule(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "规则ID") @PathVariable String ruleId) {

        Optional<AiAgentRule> existing = aiAgentRuleRepository.findById(ruleId);
        if (existing.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.error("规则不存在: " + ruleId));
        }

        AiAgentRule rule = existing.get();

        // 检查权限
        if ("DEFAULT".equals(rule.getFactoryId())) {
            return ResponseEntity.ok(ApiResponse.error("无法修改全局规则状态，请联系平台管理员"));
        }
        if (!factoryId.equals(rule.getFactoryId())) {
            return ResponseEntity.ok(ApiResponse.error("无权修改该规则"));
        }

        // 切换状态
        rule.setIsActive(!rule.getIsActive());
        AiAgentRule saved = aiAgentRuleRepository.save(rule);

        String action = saved.getIsActive() ? "启用" : "禁用";
        log.info("{} AI Agent 规则: id={}, name={}", action, ruleId, saved.getRuleName());

        return ResponseEntity.ok(ApiResponse.success("规则已" + action, saved));
    }

    @PatchMapping("/{ruleId}/priority")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'FACTORY_ADMIN')")
    @Operation(summary = "调整规则优先级", description = "调整 AI Agent 规则的优先级（数值越小越优先）")
    public ResponseEntity<ApiResponse<AiAgentRule>> updatePriority(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "规则ID") @PathVariable String ruleId,
            @RequestBody PriorityRequest request) {

        Optional<AiAgentRule> existing = aiAgentRuleRepository.findById(ruleId);
        if (existing.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.error("规则不存在: " + ruleId));
        }

        AiAgentRule rule = existing.get();

        // 检查权限
        if ("DEFAULT".equals(rule.getFactoryId())) {
            return ResponseEntity.ok(ApiResponse.error("无法修改全局规则优先级，请联系平台管理员"));
        }
        if (!factoryId.equals(rule.getFactoryId())) {
            return ResponseEntity.ok(ApiResponse.error("无权修改该规则"));
        }

        rule.setPriority(request.getPriority());
        AiAgentRule saved = aiAgentRuleRepository.save(rule);

        log.info("调整 AI Agent 规则优先级: id={}, newPriority={}", ruleId, request.getPriority());

        return ResponseEntity.ok(ApiResponse.success("优先级调整成功", saved));
    }

    // ==================== 统计信息 ====================

    @GetMapping("/stats")
    @Operation(summary = "获取规则统计", description = "获取 AI Agent 规则的统计信息")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStats(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        List<AiAgentRule> allRules = aiAgentRuleRepository.findAll().stream()
                .filter(r -> "DEFAULT".equals(r.getFactoryId()) || factoryId.equals(r.getFactoryId()))
                .toList();

        long activeCount = allRules.stream().filter(AiAgentRule::getIsActive).count();
        long sopUploadCount = aiAgentRuleRepository.countByTriggerTypeAndIsActiveTrue(AiAgentRule.TRIGGER_SOP_UPLOAD);
        long batchCompleteCount = aiAgentRuleRepository.countByTriggerTypeAndIsActiveTrue(AiAgentRule.TRIGGER_BATCH_COMPLETE);
        long qualityAlertCount = aiAgentRuleRepository.countByTriggerTypeAndIsActiveTrue(AiAgentRule.TRIGGER_QUALITY_ALERT);
        long scheduleChangeCount = aiAgentRuleRepository.countByTriggerTypeAndIsActiveTrue(AiAgentRule.TRIGGER_SCHEDULE_CHANGE);

        Map<String, Object> stats = Map.of(
                "totalRules", allRules.size(),
                "activeRules", activeCount,
                "disabledRules", allRules.size() - activeCount,
                "byTriggerType", Map.of(
                        "SOP_UPLOAD", sopUploadCount,
                        "BATCH_COMPLETE", batchCompleteCount,
                        "QUALITY_ALERT", qualityAlertCount,
                        "SCHEDULE_CHANGE", scheduleChangeCount
                )
        );

        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    // ==================== 可用工具列表 ====================

    @GetMapping("/available-tools")
    @Operation(summary = "获取可用工具列表", description = "获取可在规则中使用的工具列表")
    public ResponseEntity<ApiResponse<List<Map<String, String>>>> getAvailableTools(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        List<Map<String, String>> tools = List.of(
                Map.of(
                        "name", "sop_parse_document",
                        "description", "解析SOP文档(PDF/Excel/图片)，提取工序步骤、时间要求、技能要求等信息",
                        "category", "SOP处理"
                ),
                Map.of(
                        "name", "sop_analyze_complexity",
                        "description", "分析SOP工序复杂度，输出1-5级复杂度评估及理由",
                        "category", "SOP处理"
                ),
                Map.of(
                        "name", "sku_update_complexity",
                        "description", "更新SKU复杂度等级，并触发排产特征重算",
                        "category", "SKU管理"
                ),
                Map.of(
                        "name", "scheduling_recalculate",
                        "description", "重新计算排产特征向量",
                        "category", "排产管理"
                )
        );

        return ResponseEntity.ok(ApiResponse.success(tools));
    }

    // ==================== DTO Classes ====================

    @lombok.Data
    public static class PriorityRequest {
        private Integer priority;
    }
}
