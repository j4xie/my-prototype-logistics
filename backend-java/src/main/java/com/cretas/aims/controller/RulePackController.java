package com.cretas.aims.controller;

import com.cretas.aims.dto.pack.*;
import com.cretas.aims.service.RulePackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/**
 * 规则包管理控制器
 *
 * 提供 Drools 规则的批量导出/导入 API
 * Sprint 3 任务:
 * - S3-4: 规则包导出
 * - S3-5: 规则包导入
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@RestController
@RequestMapping("/api/platform/rule-packs")
@RequiredArgsConstructor
@Tag(name = "规则包管理", description = "规则包管理相关接口，提供Drools规则的批量导出/导入功能。支持规则包导出（从工厂导出规则到JSON）、规则包导入（将规则包导入到目标工厂）、导入预览（Dry-run模式查看导入效果）和格式验证")
public class RulePackController {

    private final RulePackService rulePackService;

    /**
     * 导出规则包
     */
    @PostMapping("/export")
    @Operation(summary = "导出规则包", description = "从指定工厂导出Drools规则包")
    public ResponseEntity<Map<String, Object>> exportRulePack(
            @Valid @RequestBody @Parameter(description = "规则包导出请求，包含工厂ID、包名、规则组筛选条件等") ExportRulePackRequest request
    ) {
        log.info("导出规则包, 工厂: {}, 包名: {}", request.getFactoryId(), request.getPackName());

        RulePackDTO pack = rulePackService.exportRulePack(request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", pack);
        response.put("message", String.format("成功导出 %d 条规则", pack.getRules().size()));

        return ResponseEntity.ok(response);
    }

    /**
     * 导入规则包
     */
    @PostMapping("/import")
    @Operation(summary = "导入规则包", description = "将规则包导入到指定工厂")
    public ResponseEntity<Map<String, Object>> importRulePack(
            @Valid @RequestBody @Parameter(description = "规则包导入请求，包含目标工厂ID、规则包数据、冲突处理策略等") ImportRulePackRequest request
    ) {
        log.info("导入规则包, 目标工厂: {}", request.getTargetFactoryId());

        ImportRulePackResult result = rulePackService.importRulePack(request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", result.getSuccess());
        response.put("data", result);
        response.put("message", result.getSummary());

        return ResponseEntity.ok(response);
    }

    /**
     * 预览导入效果
     */
    @PostMapping("/import/preview")
    @Operation(summary = "预览导入效果", description = "Dry-run模式，预览规则包导入会产生的效果（如新增/更新/跳过的规则数量），不实际执行导入操作")
    public ResponseEntity<Map<String, Object>> previewImport(
            @Valid @RequestBody @Parameter(description = "规则包导入请求，包含目标工厂ID和规则包数据") ImportRulePackRequest request
    ) {
        log.info("预览导入规则包, 目标工厂: {}", request.getTargetFactoryId());

        ImportRulePackResult result = rulePackService.previewImport(request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", result);
        response.put("message", "预览成功（未实际执行）");

        return ResponseEntity.ok(response);
    }

    /**
     * 验证规则包格式
     */
    @PostMapping("/validate")
    @Operation(summary = "验证规则包格式", description = "验证规则包数据格式是否正确")
    public ResponseEntity<Map<String, Object>> validatePack(
            @RequestBody @Parameter(description = "规则包数据，包含包名、版本、规则列表等，用于验证格式正确性") RulePackDTO pack
    ) {
        log.info("验证规则包格式: {}", pack.getPackName());

        String error = rulePackService.validatePack(pack);

        Map<String, Object> response = new HashMap<>();
        if (error == null) {
            response.put("success", true);
            response.put("data", Map.of("valid", true));
            response.put("message", "规则包格式验证通过");
        } else {
            response.put("success", false);
            response.put("data", Map.of("valid", false, "error", error));
            response.put("message", "规则包格式验证失败: " + error);
        }

        return ResponseEntity.ok(response);
    }
}
