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
@Tag(name = "编码规则配置", description = "编码规则管理相关接口，包括编码规则的增删改查、编码生成与预览、序列号管理、模板验证、占位符列表获取、实体类型列表、系统默认规则、统计信息等功能。支持自定义编码格式如 {PREFIX}-{DATE:yyyyMMdd}-{SEQ:4}")
public class EncodingRuleController {

    private final EncodingRuleService encodingRuleService;

    // ==================== 编码生成 ====================

    /**
     * 生成编码
     */
    @PostMapping("/generate/{entityType}")
    @Operation(summary = "生成编码", description = "根据配置的编码规则生成下一个唯一编码，会自动递增序列号。支持传入上下文参数用于动态占位符替换")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'workshop_supervisor', 'warehouse_keeper')")
    public ApiResponse<Map<String, String>> generateCode(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "实体类型: MATERIAL_BATCH/PROCESSING_BATCH/SHIPMENT等", example = "MATERIAL_BATCH") String entityType,
            @RequestBody(required = false) @io.swagger.v3.oas.annotations.Parameter(description = "上下文参数，用于动态占位符替换，如{\"customField\":\"value\"}") Map<String, String> context
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
    @Operation(summary = "预览编码", description = "预览下一个将要生成的编码，不消耗序列号，可用于表单预填或确认编码格式")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'workshop_supervisor', 'warehouse_keeper')")
    public ApiResponse<Map<String, String>> previewCode(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "实体类型", example = "PROCESSING_BATCH") String entityType
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
    @Operation(summary = "获取编码规则列表", description = "分页获取工厂配置的所有编码规则列表，包含各实体类型的编码规则及其状态")
    @PreAuthorize("hasAuthority('factory_super_admin')")
    public ApiResponse<Map<String, Object>> getRules(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(defaultValue = "1") @io.swagger.v3.oas.annotations.Parameter(description = "页码（1-based）", example = "1") int page,
            @RequestParam(defaultValue = "20") @io.swagger.v3.oas.annotations.Parameter(description = "每页数量", example = "20") int size
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
    @Operation(summary = "获取编码规则详情", description = "根据规则ID获取单个编码规则的完整配置信息，包含编码模板、日期格式、序列号长度等")
    @PreAuthorize("hasAuthority('factory_super_admin')")
    public ApiResponse<EncodingRule> getRule(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "编码规则ID（UUID）", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String ruleId
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
    @Operation(summary = "获取实体类型的编码规则", description = "根据实体类型获取工厂配置的编码规则，用于业务模块获取对应的编码生成规则")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'workshop_supervisor', 'warehouse_keeper')")
    public ApiResponse<EncodingRule> getRuleByEntityType(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "实体类型", example = "MATERIAL_BATCH") String entityType
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
    @Operation(summary = "创建编码规则", description = "为工厂创建新的编码规则，配置实体类型、编码模板、前缀、日期格式、序列号长度和重置周期等")
    @PreAuthorize("hasAuthority('factory_super_admin')")
    public ApiResponse<EncodingRule> createRule(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId,
            @Valid @RequestBody @io.swagger.v3.oas.annotations.Parameter(description = "编码规则创建请求，包含实体类型、规则名称、编码模板等配置") CreateEncodingRuleRequest request,
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
    @Operation(summary = "更新编码规则", description = "更新指定编码规则的配置信息，可修改编码模板、前缀、日期格式、序列号长度等，但不会重置已生成的序列号")
    @PreAuthorize("hasAuthority('factory_super_admin')")
    public ApiResponse<EncodingRule> updateRule(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "编码规则ID（UUID）", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String ruleId,
            @Valid @RequestBody @io.swagger.v3.oas.annotations.Parameter(description = "编码规则更新请求") UpdateEncodingRuleRequest request,
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
    @Operation(summary = "启用/禁用编码规则", description = "切换编码规则的启用状态。禁用后该规则将不再用于编码生成，系统会使用默认规则")
    @PreAuthorize("hasAuthority('factory_super_admin')")
    public ApiResponse<EncodingRule> toggleEnabled(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "编码规则ID（UUID）", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String ruleId,
            @RequestParam @io.swagger.v3.oas.annotations.Parameter(description = "是否启用：true-启用，false-禁用", example = "true") boolean enabled
    ) {
        log.info("切换编码规则状态 - factoryId={}, ruleId={}, enabled={}", factoryId, ruleId, enabled);

        EncodingRule updated = encodingRuleService.toggleEnabled(ruleId, enabled);
        return ApiResponse.success("状态更新成功", updated);
    }

    /**
     * 删除编码规则
     */
    @DeleteMapping("/{ruleId}")
    @Operation(summary = "删除编码规则", description = "软删除编码规则，删除后该规则将不再可用，但历史生成的编码不受影响")
    @PreAuthorize("hasAuthority('factory_super_admin')")
    public ApiResponse<String> deleteRule(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "编码规则ID（UUID）", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String ruleId
    ) {
        log.info("删除编码规则 - factoryId={}, ruleId={}", factoryId, ruleId);

        encodingRuleService.deleteRule(ruleId);
        return ApiResponse.success("编码规则已删除");
    }

    /**
     * 重置序列号
     */
    @PostMapping("/{ruleId}/reset-sequence")
    @Operation(summary = "重置序列号", description = "将编码规则的当前序列号重置为0，下次生成编码时从1开始。通常在更换年度或业务周期时使用")
    @PreAuthorize("hasAuthority('factory_super_admin')")
    public ApiResponse<String> resetSequence(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "编码规则ID（UUID）", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String ruleId
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
    @Operation(summary = "验证编码模板", description = "验证编码模板格式是否正确，检查占位符语法、日期格式等。返回验证结果和模板解析预览")
    @PreAuthorize("hasAuthority('factory_super_admin')")
    public ApiResponse<Map<String, Object>> validatePattern(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @io.swagger.v3.oas.annotations.Parameter(description = "验证请求，格式: {\"pattern\": \"{PREFIX}-{DATE:yyyyMMdd}-{SEQ:4}\"}") Map<String, String> request
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
    @Operation(summary = "获取占位符列表", description = "获取所有支持的编码占位符及其说明，如{PREFIX}前缀、{DATE:format}日期、{SEQ:n}序列号、{FACTORY}工厂代码等")
    @PreAuthorize("hasAuthority('factory_super_admin')")
    public ApiResponse<List<Map<String, String>>> getPlaceholders(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId
    ) {
        List<Map<String, String>> placeholders = encodingRuleService.getSupportedPlaceholders();
        return ApiResponse.success(placeholders);
    }

    /**
     * 获取编码规则统计
     */
    @GetMapping("/statistics")
    @Operation(summary = "获取统计信息", description = "获取工厂编码规则的统计信息，包括总规则数、启用数、各实体类型规则配置情况、最近生成的编码等")
    @PreAuthorize("hasAuthority('factory_super_admin')")
    public ApiResponse<Map<String, Object>> getStatistics(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId
    ) {
        Map<String, Object> stats = encodingRuleService.getStatistics(factoryId);
        return ApiResponse.success(stats);
    }

    /**
     * 获取系统默认规则
     */
    @GetMapping("/system-defaults")
    @Operation(summary = "获取系统默认规则", description = "获取平台预置的系统级默认编码规则，可作为工厂自定义规则的模板参考")
    @PreAuthorize("hasAuthority('factory_super_admin')")
    public ApiResponse<List<EncodingRule>> getSystemDefaults(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId
    ) {
        List<EncodingRule> defaults = encodingRuleService.getSystemDefaultRules();
        return ApiResponse.success(defaults);
    }

    /**
     * 获取实体类型列表
     */
    @GetMapping("/entity-types")
    @Operation(summary = "获取实体类型列表", description = "获取所有支持配置编码规则的实体类型，包含类型代码、名称和默认前缀")
    @PreAuthorize("hasAuthority('factory_super_admin')")
    public ApiResponse<List<Map<String, String>>> getEntityTypes(
            @PathVariable @io.swagger.v3.oas.annotations.Parameter(description = "工厂ID", example = "F001") String factoryId
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
