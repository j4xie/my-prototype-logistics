package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.EncodingRule;
import com.cretas.aims.service.EncodingRuleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.*;

/**
 * 编码规则配置控制器
 *
 * 提供:
 * - 编码规则 CRUD
 * - 编码生成和预览
 * - 序列号管理
 * - 模板验证
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/encoding-rules")
@RequiredArgsConstructor
@Validated
@Tag(name = "EncodingRules", description = "编码规则配置API")
public class EncodingRuleController {

    private final EncodingRuleService encodingRuleService;

    // ==================== 编码生成 ====================

    /**
     * 生成编码
     */
    @PostMapping("/generate/{entityType}")
    @Operation(summary = "生成编码", description = "根据规则生成下一个编码")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin', 'workshop_supervisor', 'warehouse_keeper')")
    public ApiResponse<Map<String, String>> generateCode(
            @PathVariable String factoryId,
            @PathVariable String entityType,
            @RequestBody(required = false) Map<String, String> context
    ) {
        log.info("生成编码 - factoryId={}, entityType={}", factoryId, entityType);

        String code = encodingRuleService.generateCode(
            factoryId,
            entityType,
            context != null ? context : Collections.emptyMap()
        );

        return ApiResponse.success(Map.of("code", code));
    }

    /**
     * 预览编码（不消耗序号）
     */
    @GetMapping("/preview/{entityType}")
    @Operation(summary = "预览编码", description = "预览下一个编码，不消耗序号")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin', 'workshop_supervisor', 'warehouse_keeper')")
    public ApiResponse<Map<String, String>> previewCode(
            @PathVariable String factoryId,
            @PathVariable String entityType
    ) {
        log.info("预览编码 - factoryId={}, entityType={}", factoryId, entityType);

        String code = encodingRuleService.previewCode(factoryId, entityType);
        return ApiResponse.success(Map.of("code", code));
    }

    // ==================== 规则管理 ====================

    /**
     * 获取编码规则列表
     */
    @GetMapping
    @Operation(summary = "获取编码规则列表", description = "分页获取工厂的编码规则列表")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<Map<String, Object>> getRules(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        log.info("获取编码规则列表 - factoryId={}, page={}, size={}", factoryId, page, size);

        Page<EncodingRule> rulePage = encodingRuleService.getRules(factoryId, PageRequest.of(page - 1, size));

        Map<String, Object> result = new HashMap<>();
        result.put("content", rulePage.getContent());
        result.put("totalElements", rulePage.getTotalElements());
        result.put("totalPages", rulePage.getTotalPages());
        result.put("number", rulePage.getNumber());
        result.put("size", rulePage.getSize());

        return ApiResponse.success(result);
    }

    /**
     * 获取单个编码规则
     */
    @GetMapping("/{ruleId}")
    @Operation(summary = "获取编码规则详情", description = "获取单个编码规则的详细信息")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<EncodingRule> getRule(
            @PathVariable String factoryId,
            @PathVariable String ruleId
    ) {
        log.info("获取编码规则 - factoryId={}, ruleId={}", factoryId, ruleId);

        Optional<EncodingRule> ruleOpt = encodingRuleService.getRule(ruleId);
        if (ruleOpt.isEmpty()) {
            return ApiResponse.error("编码规则不存在");
        }

        EncodingRule rule = ruleOpt.get();
        if (rule.getFactoryId() != null && !rule.getFactoryId().equals(factoryId)) {
            return ApiResponse.error("无权限查看此编码规则");
        }

        return ApiResponse.success(rule);
    }

    /**
     * 获取指定实体类型的编码规则
     */
    @GetMapping("/entity-type/{entityType}")
    @Operation(summary = "获取实体类型的编码规则", description = "获取指定实体类型的编码规则")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin', 'workshop_supervisor', 'warehouse_keeper')")
    public ApiResponse<EncodingRule> getRuleByEntityType(
            @PathVariable String factoryId,
            @PathVariable String entityType
    ) {
        log.info("获取实体类型编码规则 - factoryId={}, entityType={}", factoryId, entityType);

        Optional<EncodingRule> ruleOpt = encodingRuleService.getRule(factoryId, entityType);
        if (ruleOpt.isEmpty()) {
            return ApiResponse.error("该实体类型暂无编码规则配置");
        }

        return ApiResponse.success(ruleOpt.get());
    }

    /**
     * 创建编码规则
     */
    @PostMapping
    @Operation(summary = "创建编码规则", description = "创建新的编码规则")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<EncodingRule> createRule(
            @PathVariable String factoryId,
            @Valid @RequestBody CreateEncodingRuleRequest request,
            @RequestAttribute("userId") Long userId
    ) {
        log.info("创建编码规则 - factoryId={}, entityType={}, ruleName={}",
                factoryId, request.getEntityType(), request.getRuleName());

        EncodingRule rule = EncodingRule.builder()
                .factoryId(factoryId)
                .entityType(request.getEntityType())
                .ruleName(request.getRuleName())
                .ruleDescription(request.getRuleDescription())
                .encodingPattern(request.getEncodingPattern())
                .prefix(request.getPrefix())
                .dateFormat(request.getDateFormat())
                .sequenceLength(request.getSequenceLength())
                .resetCycle(request.getResetCycle())
                .separator(request.getSeparator())
                .includeFactoryCode(request.getIncludeFactoryCode())
                .build();

        EncodingRule saved = encodingRuleService.createRule(rule, userId);
        return ApiResponse.success("编码规则创建成功", saved);
    }

    /**
     * 更新编码规则
     */
    @PutMapping("/{ruleId}")
    @Operation(summary = "更新编码规则", description = "更新编码规则配置")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<EncodingRule> updateRule(
            @PathVariable String factoryId,
            @PathVariable String ruleId,
            @Valid @RequestBody UpdateEncodingRuleRequest request,
            @RequestAttribute("userId") Long userId
    ) {
        log.info("更新编码规则 - factoryId={}, ruleId={}", factoryId, ruleId);

        // 验证权限
        Optional<EncodingRule> existingRule = encodingRuleService.getRule(ruleId);
        if (existingRule.isEmpty()) {
            return ApiResponse.error("编码规则不存在");
        }
        if (!factoryId.equals(existingRule.get().getFactoryId())) {
            return ApiResponse.error("无权限修改此编码规则");
        }

        EncodingRule updateData = EncodingRule.builder()
                .ruleName(request.getRuleName())
                .ruleDescription(request.getRuleDescription())
                .encodingPattern(request.getEncodingPattern())
                .prefix(request.getPrefix())
                .dateFormat(request.getDateFormat())
                .sequenceLength(request.getSequenceLength())
                .resetCycle(request.getResetCycle())
                .separator(request.getSeparator())
                .includeFactoryCode(request.getIncludeFactoryCode())
                .build();

        EncodingRule updated = encodingRuleService.updateRule(ruleId, updateData, userId);
        return ApiResponse.success("编码规则更新成功", updated);
    }

    /**
     * 启用/禁用编码规则
     */
    @PutMapping("/{ruleId}/enabled")
    @Operation(summary = "启用/禁用编码规则", description = "切换编码规则的启用状态")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<EncodingRule> toggleEnabled(
            @PathVariable String factoryId,
            @PathVariable String ruleId,
            @RequestParam boolean enabled
    ) {
        log.info("切换编码规则状态 - factoryId={}, ruleId={}, enabled={}", factoryId, ruleId, enabled);

        EncodingRule updated = encodingRuleService.toggleEnabled(ruleId, enabled);
        return ApiResponse.success("状态更新成功", updated);
    }

    /**
     * 删除编码规则
     */
    @DeleteMapping("/{ruleId}")
    @Operation(summary = "删除编码规则", description = "软删除编码规则")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<String> deleteRule(
            @PathVariable String factoryId,
            @PathVariable String ruleId
    ) {
        log.info("删除编码规则 - factoryId={}, ruleId={}", factoryId, ruleId);

        encodingRuleService.deleteRule(ruleId);
        return ApiResponse.success("编码规则已删除");
    }

    /**
     * 重置序列号
     */
    @PostMapping("/{ruleId}/reset-sequence")
    @Operation(summary = "重置序列号", description = "将编码规则的序列号重置为0")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<String> resetSequence(
            @PathVariable String factoryId,
            @PathVariable String ruleId
    ) {
        log.info("重置编码规则序列号 - factoryId={}, ruleId={}", factoryId, ruleId);

        encodingRuleService.resetSequence(ruleId);
        return ApiResponse.success("序列号已重置");
    }

    // ==================== 工具接口 ====================

    /**
     * 验证编码模板
     */
    @PostMapping("/validate-pattern")
    @Operation(summary = "验证编码模板", description = "验证编码模板格式是否正确")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<Map<String, Object>> validatePattern(
            @PathVariable String factoryId,
            @RequestBody Map<String, String> request
    ) {
        String pattern = request.get("pattern");
        if (pattern == null || pattern.isEmpty()) {
            return ApiResponse.error("编码模板不能为空");
        }

        Map<String, Object> validation = encodingRuleService.validatePattern(pattern);
        return ApiResponse.success(validation);
    }

    /**
     * 获取支持的占位符列表
     */
    @GetMapping("/placeholders")
    @Operation(summary = "获取占位符列表", description = "获取所有支持的编码占位符")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<List<Map<String, String>>> getPlaceholders(
            @PathVariable String factoryId
    ) {
        List<Map<String, String>> placeholders = encodingRuleService.getSupportedPlaceholders();
        return ApiResponse.success(placeholders);
    }

    /**
     * 获取编码规则统计
     */
    @GetMapping("/statistics")
    @Operation(summary = "获取统计信息", description = "获取编码规则统计信息")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<Map<String, Object>> getStatistics(
            @PathVariable String factoryId
    ) {
        Map<String, Object> stats = encodingRuleService.getStatistics(factoryId);
        return ApiResponse.success(stats);
    }

    /**
     * 获取系统默认规则
     */
    @GetMapping("/system-defaults")
    @Operation(summary = "获取系统默认规则", description = "获取系统级默认编码规则")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<List<EncodingRule>> getSystemDefaults(
            @PathVariable String factoryId
    ) {
        List<EncodingRule> defaults = encodingRuleService.getSystemDefaultRules();
        return ApiResponse.success(defaults);
    }

    /**
     * 获取实体类型列表
     */
    @GetMapping("/entity-types")
    @Operation(summary = "获取实体类型列表", description = "获取所有支持的实体类型")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<List<Map<String, String>>> getEntityTypes(
            @PathVariable String factoryId
    ) {
        List<Map<String, String>> entityTypes = List.of(
            Map.of("code", "MATERIAL_BATCH", "name", "原材料批次", "defaultPrefix", "MB"),
            Map.of("code", "PROCESSING_BATCH", "name", "加工批次", "defaultPrefix", "PB"),
            Map.of("code", "SHIPMENT", "name", "出货记录", "defaultPrefix", "SH"),
            Map.of("code", "QUALITY_INSPECTION", "name", "质检记录", "defaultPrefix", "QI"),
            Map.of("code", "DISPOSAL_RECORD", "name", "处置记录", "defaultPrefix", "DR"),
            Map.of("code", "EQUIPMENT", "name", "设备", "defaultPrefix", "EQ"),
            Map.of("code", "PRODUCTION_PLAN", "name", "生产计划", "defaultPrefix", "PP"),
            Map.of("code", "TIMECLOCK_RECORD", "name", "考勤记录", "defaultPrefix", "TC")
        );

        return ApiResponse.success(entityTypes);
    }

    // ==================== 请求类 ====================

    @lombok.Data
    public static class CreateEncodingRuleRequest {
        private String entityType;
        private String ruleName;
        private String ruleDescription;
        private String encodingPattern;
        private String prefix;
        private String dateFormat;
        private Integer sequenceLength;
        private String resetCycle;
        private String separator;
        private Boolean includeFactoryCode;
    }

    @lombok.Data
    public static class UpdateEncodingRuleRequest {
        private String ruleName;
        private String ruleDescription;
        private String encodingPattern;
        private String prefix;
        private String dateFormat;
        private Integer sequenceLength;
        private String resetCycle;
        private String separator;
        private Boolean includeFactoryCode;
    }
}
