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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
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
}
