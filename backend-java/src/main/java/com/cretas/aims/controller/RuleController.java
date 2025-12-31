package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.rules.DroolsRule;
import com.cretas.aims.repository.DroolsRuleRepository;
import com.cretas.aims.service.RuleEngineService;
import com.cretas.aims.service.StateMachineService;
import com.cretas.aims.service.StateMachineService.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.util.*;

/**
 * 规则引擎控制器
 *
 * 提供:
 * - Drools 规则 CRUD
 * - 状态机配置管理
 * - 规则验证和测试
 * - 决策表上传
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/rules")
@RequiredArgsConstructor
@Validated
@Tag(name = "Rules", description = "规则引擎管理API")
public class RuleController {

    private final RuleEngineService ruleEngineService;
    private final StateMachineService stateMachineService;
    private final DroolsRuleRepository droolsRuleRepository;

    // ==================== 规则管理 ====================

    /**
     * 获取规则列表
     */
    @GetMapping
    @Operation(summary = "获取规则列表", description = "分页获取工厂的规则列表")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<Map<String, Object>> getRules(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String ruleGroup
    ) {
        log.info("获取规则列表 - factoryId={}, page={}, size={}, ruleGroup={}",
                factoryId, page, size, ruleGroup);

        Page<DroolsRule> rulePage;
        if (ruleGroup != null && !ruleGroup.isEmpty()) {
            rulePage = droolsRuleRepository.findByFactoryIdAndRuleGroup(
                    factoryId, ruleGroup, PageRequest.of(page - 1, size));
        } else {
            rulePage = droolsRuleRepository.findByFactoryId(
                    factoryId, PageRequest.of(page - 1, size));
        }

        Map<String, Object> result = new HashMap<>();
        result.put("content", rulePage.getContent());
        result.put("totalElements", rulePage.getTotalElements());
        result.put("totalPages", rulePage.getTotalPages());
        result.put("number", rulePage.getNumber());
        result.put("size", rulePage.getSize());

        return ApiResponse.success(result);
    }

    /**
     * 创建规则
     */
    @PostMapping
    @Operation(summary = "创建规则", description = "创建新的 DRL 规则")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<DroolsRule> createRule(
            @PathVariable String factoryId,
            @Valid @RequestBody CreateRuleRequest request,
            @RequestAttribute("userId") Long userId
    ) {
        log.info("创建规则 - factoryId={}, ruleName={}, ruleGroup={}",
                factoryId, request.getRuleName(), request.getRuleGroup());

        // 验证规则语法
        Map<String, Object> validation = ruleEngineService.validateDRL(request.getRuleContent());
        if (!(Boolean) validation.get("isValid")) {
            return ApiResponse.error("规则语法错误: " + validation.get("errors"));
        }

        // 检查规则名是否已存在
        if (droolsRuleRepository.existsByFactoryIdAndRuleGroupAndRuleName(
                factoryId, request.getRuleGroup(), request.getRuleName())) {
            return ApiResponse.error("规则名已存在: " + request.getRuleName());
        }

        // 创建规则
        DroolsRule rule = DroolsRule.builder()
                .id(UUID.randomUUID().toString())
                .factoryId(factoryId)
                .ruleGroup(request.getRuleGroup())
                .ruleName(request.getRuleName())
                .ruleDescription(request.getRuleDescription())
                .ruleContent(request.getRuleContent())
                .priority(request.getPriority() != null ? request.getPriority() : 0)
                .enabled(request.getEnabled() != null ? request.getEnabled() : true)
                .version(1)
                .createdBy(userId)
                .build();

        DroolsRule saved = droolsRuleRepository.save(rule);

        // 重新加载规则
        ruleEngineService.reloadRuleGroup(factoryId, request.getRuleGroup());

        return ApiResponse.success("规则创建成功", saved);
    }

    /**
     * 更新规则
     */
    @PutMapping("/{ruleId}")
    @Operation(summary = "更新规则", description = "更新规则内容")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<DroolsRule> updateRule(
            @PathVariable String factoryId,
            @PathVariable String ruleId,
            @Valid @RequestBody UpdateRuleRequest request,
            @RequestAttribute("userId") Long userId
    ) {
        log.info("更新规则 - factoryId={}, ruleId={}", factoryId, ruleId);

        Optional<DroolsRule> ruleOpt = droolsRuleRepository.findById(ruleId);
        if (ruleOpt.isEmpty()) {
            return ApiResponse.error("规则不存在");
        }

        DroolsRule rule = ruleOpt.get();
        if (!rule.getFactoryId().equals(factoryId)) {
            return ApiResponse.error("无权限修改此规则");
        }

        // 验证新规则内容
        if (request.getRuleContent() != null) {
            Map<String, Object> validation = ruleEngineService.validateDRL(request.getRuleContent());
            if (!(Boolean) validation.get("isValid")) {
                return ApiResponse.error("规则语法错误: " + validation.get("errors"));
            }
            rule.setRuleContent(request.getRuleContent());
        }

        if (request.getRuleDescription() != null) {
            rule.setRuleDescription(request.getRuleDescription());
        }
        if (request.getPriority() != null) {
            rule.setPriority(request.getPriority());
        }
        if (request.getEnabled() != null) {
            rule.setEnabled(request.getEnabled());
        }

        rule.setVersion(rule.getVersion() + 1);
        rule.setUpdatedBy(userId);

        DroolsRule saved = droolsRuleRepository.save(rule);

        // 重新加载规则
        ruleEngineService.reloadRuleGroup(factoryId, rule.getRuleGroup());

        return ApiResponse.success("规则更新成功", saved);
    }

    /**
     * 删除规则
     */
    @DeleteMapping("/{ruleId}")
    @Operation(summary = "删除规则", description = "软删除规则")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<String> deleteRule(
            @PathVariable String factoryId,
            @PathVariable String ruleId
    ) {
        log.info("删除规则 - factoryId={}, ruleId={}", factoryId, ruleId);

        Optional<DroolsRule> ruleOpt = droolsRuleRepository.findById(ruleId);
        if (ruleOpt.isEmpty()) {
            return ApiResponse.error("规则不存在");
        }

        DroolsRule rule = ruleOpt.get();
        if (!rule.getFactoryId().equals(factoryId)) {
            return ApiResponse.error("无权限删除此规则");
        }

        String ruleGroup = rule.getRuleGroup();
        rule.softDelete();
        droolsRuleRepository.save(rule);

        // 重新加载规则
        ruleEngineService.reloadRuleGroup(factoryId, ruleGroup);

        return ApiResponse.success("规则已删除");
    }

    /**
     * 验证 DRL 规则语法
     */
    @PostMapping("/validate")
    @Operation(summary = "验证规则语法", description = "验证 DRL 规则语法是否正确")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<Map<String, Object>> validateRule(
            @PathVariable String factoryId,
            @RequestBody Map<String, String> request
    ) {
        String drlContent = request.get("ruleContent");
        if (drlContent == null || drlContent.isEmpty()) {
            return ApiResponse.error("规则内容不能为空");
        }

        Map<String, Object> validation = ruleEngineService.validateDRL(drlContent);
        return ApiResponse.success(validation);
    }

    /**
     * Dry-Run 规则执行（沙箱模式）
     *
     * 用于在规则发布前测试新规则的执行效果，不会影响已保存的规则或数据。
     * 支持 ChangeSet 发布前的预览功能。
     */
    @PostMapping("/dry-run")
    @Operation(summary = "Dry-Run 规则执行", description = "在沙箱环境中测试未保存的规则，预览执行效果")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<Map<String, Object>> dryRunRule(
            @PathVariable String factoryId,
            @Valid @RequestBody DryRunRequest request
    ) {
        log.info("Dry-Run 规则执行 - factoryId={}, entityType={}", factoryId, request.getEntityType());

        try {
            // 验证必填字段
            if (request.getRuleContent() == null || request.getRuleContent().isEmpty()) {
                return ApiResponse.error("规则内容不能为空");
            }

            // 构建执行上下文
            Map<String, Object> context = new HashMap<>();
            context.put("factoryId", factoryId);
            context.put("entityType", request.getEntityType());
            context.put("hookPoint", request.getHookPoint());
            context.put("dryRun", true);

            // 执行 Dry-Run
            Map<String, Object> result = ruleEngineService.executeDryRun(
                    request.getRuleContent(),
                    request.getTestData(),
                    context
            );

            // 添加元数据
            result.put("factoryId", factoryId);
            result.put("entityType", request.getEntityType());
            result.put("hookPoint", request.getHookPoint());

            if ((Boolean) result.getOrDefault("success", false)) {
                return ApiResponse.success("Dry-Run 执行成功", result);
            } else {
                return ApiResponse.success("Dry-Run 执行失败", result);
            }

        } catch (Exception e) {
            log.error("Dry-Run 执行异常 - factoryId={}", factoryId, e);
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("validationErrors", Collections.singletonList("执行异常: " + e.getMessage()));
            errorResult.put("rulesMatched", Collections.emptyList());
            errorResult.put("result", null);
            return ApiResponse.error("Dry-Run 执行异常: " + e.getMessage());
        }
    }

    /**
     * 测试规则执行
     *
     * 用于前端 useRuleHooks 的 testRule 功能
     * 在不实际修改数据的情况下测试规则执行效果
     */
    @PostMapping("/{ruleId}/test")
    @Operation(summary = "测试规则执行", description = "使用测试数据执行指定规则，返回执行结果")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin', 'workshop_supervisor', 'quality_inspector')")
    public ApiResponse<Map<String, Object>> testRule(
            @PathVariable String factoryId,
            @PathVariable String ruleId,
            @RequestBody TestRuleRequest request
    ) {
        log.info("测试规则执行 - factoryId={}, ruleId={}, entityType={}",
                factoryId, ruleId, request.getEntityType());

        try {
            // 1. 加载指定规则
            Optional<DroolsRule> ruleOpt = droolsRuleRepository.findById(ruleId);
            if (ruleOpt.isEmpty()) {
                return ApiResponse.error("规则不存在: " + ruleId);
            }

            DroolsRule rule = ruleOpt.get();
            if (!rule.getFactoryId().equals(factoryId)) {
                return ApiResponse.error("无权限测试此规则");
            }

            if (!Boolean.TRUE.equals(rule.getEnabled())) {
                Map<String, Object> result = new HashMap<>();
                result.put("rulesExecuted", 0);
                result.put("results", Collections.emptyList());
                result.put("message", "规则已禁用，未执行");
                result.put("skipped", true);
                return ApiResponse.success(result);
            }

            // 2. 准备执行上下文
            Map<String, Object> context = new HashMap<>();
            context.put("factoryId", factoryId);
            context.put("entityType", request.getEntityType());
            context.put("hookPoint", request.getHookPoint());
            context.put("testMode", true);  // 标记为测试模式

            // 3. 执行规则 (使用 ruleGroup 执行包含该规则的规则组)
            Map<String, Object> executionResult = ruleEngineService.executeRules(
                    factoryId,
                    rule.getRuleGroup(),
                    request.getTestData(),
                    context
            );

            // 4. 构建响应
            Map<String, Object> result = new HashMap<>();
            result.put("rulesExecuted", executionResult.getOrDefault("rulesExecuted", 0));
            result.put("message", "规则测试完成");
            result.put("testMode", true);

            // 构建规则执行结果详情
            List<Map<String, Object>> ruleResults = new ArrayList<>();
            Map<String, Object> ruleResult = new HashMap<>();
            ruleResult.put("ruleId", ruleId);
            ruleResult.put("ruleName", rule.getRuleName());
            ruleResult.put("ruleGroup", rule.getRuleGroup());

            // 判断规则是否被触发
            int executed = (Integer) executionResult.getOrDefault("rulesExecuted", 0);
            ruleResult.put("fired", executed > 0);

            // 提取修改的值和验证错误
            @SuppressWarnings("unchecked")
            Map<String, Object> modifiedFacts = (Map<String, Object>) executionResult.getOrDefault("modifiedFacts", new HashMap<>());
            @SuppressWarnings("unchecked")
            List<String> validationErrors = (List<String>) executionResult.getOrDefault("validationErrors", new ArrayList<>());
            @SuppressWarnings("unchecked")
            List<String> warnings = (List<String>) executionResult.getOrDefault("warnings", new ArrayList<>());

            ruleResult.put("modifiedValues", modifiedFacts);
            ruleResult.put("validationErrors", validationErrors);
            ruleResult.put("warnings", warnings);

            ruleResults.add(ruleResult);
            result.put("results", ruleResults);

            // 如果有验证错误，标记为规则验证失败
            if (!validationErrors.isEmpty()) {
                result.put("hasValidationErrors", true);
            }

            return ApiResponse.success(result);

        } catch (Exception e) {
            log.error("规则测试执行失败 - ruleId={}", ruleId, e);
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("rulesExecuted", 0);
            errorResult.put("results", Collections.emptyList());
            errorResult.put("message", "规则测试失败: " + e.getMessage());
            errorResult.put("error", true);
            return ApiResponse.success(errorResult);
        }
    }

    /**
     * 上传决策表
     */
    @PostMapping("/decision-table")
    @Operation(summary = "上传决策表", description = "上传 Excel 决策表并生成 DRL 规则")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<Map<String, Object>> uploadDecisionTable(
            @PathVariable String factoryId,
            @RequestParam("file") MultipartFile file,
            @RequestParam String ruleGroup,
            @RequestParam String ruleName,
            @RequestAttribute("userId") Long userId
    ) {
        log.info("上传决策表 - factoryId={}, ruleGroup={}, ruleName={}, fileName={}",
                factoryId, ruleGroup, ruleName, file.getOriginalFilename());

        try {
            byte[] content = file.getBytes();
            String drl = ruleEngineService.generateDRLFromDecisionTable(content);

            // 验证生成的 DRL
            Map<String, Object> validation = ruleEngineService.validateDRL(drl);
            if (!(Boolean) validation.get("isValid")) {
                return ApiResponse.error("决策表转换后的规则有语法错误: " + validation.get("errors"));
            }

            // 保存规则
            DroolsRule rule = DroolsRule.builder()
                    .id(UUID.randomUUID().toString())
                    .factoryId(factoryId)
                    .ruleGroup(ruleGroup)
                    .ruleName(ruleName)
                    .ruleDescription("从决策表生成: " + file.getOriginalFilename())
                    .ruleContent(drl)
                    .decisionTable(content)
                    .decisionTableType(getFileExtension(file.getOriginalFilename()))
                    .priority(0)
                    .enabled(true)
                    .version(1)
                    .createdBy(userId)
                    .build();

            DroolsRule saved = droolsRuleRepository.save(rule);

            // 重新加载规则
            ruleEngineService.reloadRuleGroup(factoryId, ruleGroup);

            Map<String, Object> result = new HashMap<>();
            result.put("rule", saved);
            result.put("generatedDRL", drl);

            return ApiResponse.success("决策表上传成功", result);

        } catch (Exception e) {
            log.error("决策表上传失败", e);
            return ApiResponse.error("决策表上传失败: " + e.getMessage());
        }
    }

    /**
     * 获取规则统计
     */
    @GetMapping("/statistics")
    @Operation(summary = "获取规则统计", description = "获取规则引擎统计信息")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<Map<String, Object>> getStatistics(
            @PathVariable String factoryId
    ) {
        Map<String, Object> stats = ruleEngineService.getStatistics(factoryId);

        // 添加规则组统计
        List<String> ruleGroups = droolsRuleRepository.findDistinctRuleGroupsByFactoryId(factoryId);
        stats.put("ruleGroups", ruleGroups);

        return ApiResponse.success(stats);
    }

    // ==================== 状态机管理 ====================

    /**
     * 获取状态机列表
     */
    @GetMapping("/state-machines")
    @Operation(summary = "获取状态机列表", description = "获取工厂所有状态机配置")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<List<StateMachineConfig>> getStateMachines(
            @PathVariable String factoryId
    ) {
        List<StateMachineConfig> machines = stateMachineService.getAllStateMachines(factoryId);
        return ApiResponse.success(machines);
    }

    /**
     * 获取状态机详情
     */
    @GetMapping("/state-machines/{entityType}")
    @Operation(summary = "获取状态机详情", description = "获取指定实体类型的状态机配置")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<StateMachineConfig> getStateMachine(
            @PathVariable String factoryId,
            @PathVariable String entityType
    ) {
        Optional<StateMachineConfig> config = stateMachineService.getStateMachine(factoryId, entityType);
        if (config.isEmpty()) {
            return ApiResponse.error("状态机配置不存在");
        }
        return ApiResponse.success(config.get());
    }

    /**
     * 创建或更新状态机
     */
    @PostMapping("/state-machines/{entityType}")
    @Operation(summary = "保存状态机配置", description = "创建或更新状态机配置")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<StateMachineConfig> saveStateMachine(
            @PathVariable String factoryId,
            @PathVariable String entityType,
            @Valid @RequestBody StateMachineConfig config,
            @RequestAttribute("userId") Long userId
    ) {
        log.info("保存状态机配置 - factoryId={}, entityType={}", factoryId, entityType);

        StateMachineConfig saved = stateMachineService.saveStateMachine(
                factoryId, entityType, config, userId);

        return ApiResponse.success("状态机配置保存成功", saved);
    }

    /**
     * 删除状态机
     */
    @DeleteMapping("/state-machines/{entityType}")
    @Operation(summary = "删除状态机配置", description = "删除指定实体类型的状态机配置")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<String> deleteStateMachine(
            @PathVariable String factoryId,
            @PathVariable String entityType
    ) {
        log.info("删除状态机配置 - factoryId={}, entityType={}", factoryId, entityType);
        stateMachineService.deleteStateMachine(factoryId, entityType);
        return ApiResponse.success("状态机配置已删除");
    }

    /**
     * 获取可用状态转换
     */
    @GetMapping("/state-machines/{entityType}/transitions")
    @Operation(summary = "获取可用转换", description = "获取当前状态可用的转换列表")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin', 'workshop_supervisor', 'quality_inspector')")
    public ApiResponse<List<TransitionInfo>> getAvailableTransitions(
            @PathVariable String factoryId,
            @PathVariable String entityType,
            @RequestParam String currentState
    ) {
        List<TransitionInfo> transitions = stateMachineService.getAvailableTransitions(
                factoryId, entityType, currentState, null);
        return ApiResponse.success(transitions);
    }

    // ==================== 私有方法 ====================

    private String getFileExtension(String filename) {
        if (filename == null) return "XLS";
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0) {
            return filename.substring(dotIndex + 1).toUpperCase();
        }
        return "XLS";
    }

    // ==================== 请求/响应类 ====================

    @lombok.Data
    public static class CreateRuleRequest {
        private String ruleGroup;
        private String ruleName;
        private String ruleDescription;
        private String ruleContent;
        private Integer priority;
        private Boolean enabled;
    }

    @lombok.Data
    public static class UpdateRuleRequest {
        private String ruleDescription;
        private String ruleContent;
        private Integer priority;
        private Boolean enabled;
    }

    /**
     * 规则测试请求
     */
    @lombok.Data
    public static class TestRuleRequest {
        /**
         * 实体类型 (如 MaterialBatch, ProcessingBatch, QualityInspection)
         */
        private String entityType;

        /**
         * Hook 触发点 (如 beforeCreate, beforeSubmit, afterSubmit)
         */
        private String hookPoint;

        /**
         * 测试数据 - 模拟的表单/实体数据
         */
        private Map<String, Object> testData;
    }

    /**
     * Dry-Run 规则测试请求
     * 用于在沙箱环境中测试未保存的 DRL 规则
     */
    @lombok.Data
    public static class DryRunRequest {
        /**
         * DRL 规则内容 (完整的 Drools 规则定义)
         */
        @javax.validation.constraints.NotBlank(message = "规则内容不能为空")
        private String ruleContent;

        /**
         * 实体类型 (如 MATERIAL_BATCH, PROCESSING_BATCH, QUALITY_INSPECTION)
         */
        private String entityType;

        /**
         * Hook 触发点 (如 beforeCreate, beforeSubmit, afterSubmit)
         */
        private String hookPoint;

        /**
         * 测试数据 - 用于规则执行的事实对象
         * 可以是单个对象或 { "facts": [...] } 格式的多个事实
         */
        private Map<String, Object> testData;
    }

    // ==================== 状态机执行 DTO ====================

    @lombok.Data
    public static class ExecuteTransitionRequest {
        @NotBlank(message = "entityId不能为空")
        private String entityId;

        @NotBlank(message = "currentState不能为空")
        private String currentState;

        @NotBlank(message = "targetState不能为空")
        private String targetState;

        private Map<String, Object> entity;

        /** 操作用户ID (可选，不提供时使用默认值) */
        private Long userId;
    }

    @lombok.Data
    public static class TransitionValidation {
        private boolean valid;
        private boolean guardPassed;
        private String guardExpression;
        private String evaluationResult;
        private String message;
    }

    // ==================== 状态机执行 API ====================

    @PostMapping("/state-machines/{entityType}/validate")
    @Operation(summary = "验证状态转换", description = "验证状态转换是否允许，检查守卫条件")
    public ResponseEntity<ApiResponse<TransitionValidation>> validateTransition(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "实体类型") @PathVariable String entityType,
            @Valid @RequestBody ExecuteTransitionRequest request) {

        log.info("Validating transition for {} from {} to {}",
            entityType, request.getCurrentState(), request.getTargetState());

        TransitionValidation result = new TransitionValidation();

        try {
            // 调用状态机服务验证转换
            StateMachineService.TransitionValidation validation = stateMachineService.validateTransition(
                factoryId, entityType,
                request.getCurrentState(), request.getTargetState(),
                request.getEntity());

            result.setValid(validation.getIsValid());
            result.setGuardPassed(validation.getIsValid());
            result.setMessage(validation.getMessage() != null ? validation.getMessage() :
                (validation.getIsValid() ? "状态转换验证通过" : "守卫条件不满足"));

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Transition validation failed: {}", e.getMessage());
            result.setValid(false);
            result.setGuardPassed(false);
            result.setMessage("验证失败: " + e.getMessage());
            return ResponseEntity.ok(ApiResponse.success(result));
        }
    }

    @PostMapping("/state-machines/{entityType}/execute")
    @Operation(summary = "执行状态转换", description = "执行状态转换并返回结果")
    public ResponseEntity<ApiResponse<StateMachineService.TransitionResult>> executeTransition(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "实体类型") @PathVariable String entityType,
            @Valid @RequestBody ExecuteTransitionRequest request) {

        log.info("Executing transition for {} from {} to {}",
            entityType, request.getCurrentState(), request.getTargetState());

        try {
            // 获取当前用户ID (从SecurityContext或使用默认值)
            Long userId = request.getUserId() != null ? request.getUserId() : 0L;

            StateMachineService.TransitionResult result = stateMachineService.executeTransition(
                factoryId, entityType, request.getEntityId(),
                request.getCurrentState(), request.getTargetState(),
                request.getEntity(), userId);

            if (result.getSuccess()) {
                return ResponseEntity.ok(ApiResponse.success("状态转换成功", result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("Transition execution failed: {}", e.getMessage());
            return ResponseEntity.ok(ApiResponse.error("状态转换失败: " + e.getMessage()));
        }
    }
}
