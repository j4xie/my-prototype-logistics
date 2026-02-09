package com.cretas.aims.controller;

import com.cretas.aims.dto.blueprint.*;
import com.cretas.aims.entity.config.FactoryTypeBlueprint;
import com.cretas.aims.service.FactoryBlueprintService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 工厂蓝图管理控制器
 * 平台级别API，用于管理工厂类型蓝图
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@RestController
@RequestMapping("/api/platform/blueprints")
@RequiredArgsConstructor
@Tag(name = "Factory Blueprint Management", description = "工厂蓝图管理API")
public class FactoryBlueprintController {

    private final FactoryBlueprintService blueprintService;

    /**
     * 获取所有蓝图列表
     */
    @GetMapping
    @Operation(summary = "获取所有蓝图", description = "返回所有激活的工厂类型蓝图")
    public ResponseEntity<Map<String, Object>> getAllBlueprints(
            @Parameter(description = "行业类型过滤") @RequestParam(required = false) String industryType
    ) {
        log.info("获取蓝图列表, 行业类型: {}", industryType);

        List<FactoryTypeBlueprint> blueprints = industryType != null
                ? blueprintService.getBlueprintsByIndustryType(industryType)
                : blueprintService.getAllBlueprints();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", blueprints);
        response.put("message", "获取蓝图列表成功");

        return ResponseEntity.ok(response);
    }

    /**
     * 获取蓝图详情
     */
    @GetMapping("/{id}")
    @Operation(summary = "获取蓝图详情", description = "根据ID获取蓝图详细信息")
    public ResponseEntity<Map<String, Object>> getBlueprintById(
            @Parameter(description = "蓝图ID") @PathVariable String id
    ) {
        log.info("获取蓝图详情: {}", id);

        FactoryTypeBlueprint blueprint = blueprintService.getBlueprintById(id);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", blueprint);
        response.put("message", "获取蓝图详情成功");

        return ResponseEntity.ok(response);
    }

    /**
     * 创建蓝图
     */
    @PostMapping
    @Operation(summary = "创建蓝图", description = "创建新的工厂类型蓝图")
    public ResponseEntity<Map<String, Object>> createBlueprint(
            @Valid @RequestBody CreateBlueprintRequest request
    ) {
        log.info("创建蓝图: {}", request.getName());

        FactoryTypeBlueprint blueprint = blueprintService.createBlueprint(request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", blueprint);
        response.put("message", "创建蓝图成功");

        return ResponseEntity.ok(response);
    }

    /**
     * 更新蓝图
     */
    @PutMapping("/{id}")
    @Operation(summary = "更新蓝图", description = "更新现有蓝图配置")
    public ResponseEntity<Map<String, Object>> updateBlueprint(
            @Parameter(description = "蓝图ID") @PathVariable String id,
            @Valid @RequestBody CreateBlueprintRequest request
    ) {
        log.info("更新蓝图: {}", id);

        FactoryTypeBlueprint blueprint = blueprintService.updateBlueprint(id, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", blueprint);
        response.put("message", "更新蓝图成功");

        return ResponseEntity.ok(response);
    }

    /**
     * 删除蓝图
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "删除蓝图", description = "软删除指定蓝图")
    public ResponseEntity<Map<String, Object>> deleteBlueprint(
            @Parameter(description = "蓝图ID") @PathVariable String id
    ) {
        log.info("删除蓝图: {}", id);

        blueprintService.deleteBlueprint(id);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", null);
        response.put("message", "删除蓝图成功");

        return ResponseEntity.ok(response);
    }

    /**
     * 应用蓝图到工厂
     */
    @PostMapping("/{id}/apply")
    @Operation(summary = "应用蓝图到工厂", description = "将蓝图配置应用到指定工厂，创建表单模板、产品类型等")
    public ResponseEntity<Map<String, Object>> applyBlueprintToFactory(
            @Parameter(description = "蓝图ID") @PathVariable String id,
            @Valid @RequestBody ApplyBlueprintRequest request
    ) {
        log.info("应用蓝图 {} 到工厂 {}", id, request.getFactoryId());

        BlueprintApplicationResult result = blueprintService.applyBlueprintToFactory(id, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", result.getSuccess());
        response.put("data", result);
        response.put("message", result.getSummary());

        return ResponseEntity.ok(response);
    }

    /**
     * 预览蓝图应用效果
     */
    @PostMapping("/{id}/preview")
    @Operation(summary = "预览蓝图应用效果", description = "Dry-run模式，预览应用蓝图会创建哪些配置，不实际执行")
    public ResponseEntity<Map<String, Object>> previewBlueprintApplication(
            @Parameter(description = "蓝图ID") @PathVariable String id,
            @Parameter(description = "工厂ID") @RequestParam String factoryId
    ) {
        log.info("预览蓝图 {} 应用到工厂 {}", id, factoryId);

        BlueprintApplicationResult result = blueprintService.previewBlueprintApplication(id, factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", result);
        response.put("message", "预览成功（未实际执行）");

        return ResponseEntity.ok(response);
    }

    /**
     * 从工厂生成蓝图
     */
    @PostMapping("/generate-from-factory")
    @Operation(summary = "从工厂生成蓝图", description = "从现有工厂配置生成新蓝图模板")
    public ResponseEntity<Map<String, Object>> generateBlueprintFromFactory(
            @Valid @RequestBody GenerateBlueprintFromFactoryRequest request
    ) {
        log.info("从工厂 {} 生成蓝图: {}", request.getFactoryId(), request.getBlueprintName());

        FactoryTypeBlueprint blueprint = blueprintService.generateBlueprintFromFactory(request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", blueprint);
        response.put("message", "从工厂生成蓝图成功");

        return ResponseEntity.ok(response);
    }

    /**
     * 获取工厂的蓝图应用历史
     */
    @GetMapping("/history/{factoryId}")
    @Operation(summary = "获取工厂蓝图应用历史", description = "查询指定工厂的蓝图应用记录")
    public ResponseEntity<Map<String, Object>> getFactoryApplicationHistory(
            @Parameter(description = "工厂ID") @PathVariable String factoryId
    ) {
        log.info("获取工厂 {} 的蓝图应用历史", factoryId);

        List<BlueprintApplicationResult> history = blueprintService.getFactoryApplicationHistory(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", history);
        response.put("message", "获取应用历史成功");

        return ResponseEntity.ok(response);
    }
}
