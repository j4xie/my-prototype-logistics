package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.LowcodeComponentDefinition;
import com.cretas.aims.entity.LowcodePageConfig;
import com.cretas.aims.service.LowcodeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

/**
 * 低代码平台控制器
 *
 * 提供:
 * - 页面配置 CRUD API
 * - 页面发布管理
 * - 组件库查询接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-14
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/lowcode")
@RequiredArgsConstructor
@Tag(name = "低代码平台", description = "低代码平台相关接口，包括页面配置的创建、查询、更新、删除、发布，组件库管理等功能")
@Validated
public class LowcodeController {

    private final LowcodeService lowcodeService;

    // ==================== 页面管理 ====================

    /**
     * 获取页面列表
     */
    @GetMapping("/pages")
    @Operation(summary = "获取页面列表", description = "获取工厂的所有低代码页面配置列表，支持按角色过滤")
    public ApiResponse<List<LowcodePageConfig>> getPages(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(required = false) @Parameter(description = "角色编码，用于筛选特定角色的页面配置") String roleCode) {
        log.info("获取页面列表: factoryId={}, roleCode={}", factoryId, roleCode);
        List<LowcodePageConfig> result = lowcodeService.getPages(factoryId, roleCode);
        return ApiResponse.success(result);
    }

    /**
     * 获取页面配置详情
     */
    @GetMapping("/pages/{pageId}")
    @Operation(summary = "获取页面配置", description = "根据页面ID获取页面配置详情，支持配置继承逻辑：角色配置 -> 工厂默认 -> 系统默认")
    public ApiResponse<LowcodePageConfig> getPageConfig(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "页面ID") String pageId,
            @RequestParam(required = false) @Parameter(description = "角色编码，用于获取角色定制配置") String roleCode) {
        log.info("获取页面配置: factoryId={}, pageId={}, roleCode={}", factoryId, pageId, roleCode);
        return lowcodeService.getPage(factoryId, pageId, roleCode)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "页面不存在: " + pageId));
    }

    /**
     * 创建页面
     */
    @PostMapping("/pages")
    @Operation(summary = "创建页面", description = "创建新的低代码页面配置")
    public ApiResponse<LowcodePageConfig> createPage(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "页面配置信息") LowcodePageConfig config) {
        log.info("创建页面: factoryId={}, pageName={}", factoryId, config.getPageName());
        LowcodePageConfig result = lowcodeService.createPage(factoryId, config);
        return ApiResponse.success("页面创建成功", result);
    }

    /**
     * 更新页面
     */
    @PutMapping("/pages/{pageId}")
    @Operation(summary = "更新页面", description = "更新页面配置信息，自动增加版本号")
    public ApiResponse<LowcodePageConfig> updatePage(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "页面ID") String pageId,
            @RequestBody @Valid @Parameter(description = "页面配置信息") LowcodePageConfig config) {
        log.info("更新页面: factoryId={}, pageId={}", factoryId, pageId);
        LowcodePageConfig result = lowcodeService.updatePage(factoryId, pageId, config);
        return ApiResponse.success("页面更新成功", result);
    }

    /**
     * 发布页面
     */
    @PostMapping("/pages/{pageId}/publish")
    @Operation(summary = "发布页面", description = "将页面从草稿状态发布为正式版本，设置 status=1")
    public ApiResponse<LowcodePageConfig> publishPage(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "页面ID") String pageId) {
        log.info("发布页面: factoryId={}, pageId={}", factoryId, pageId);
        LowcodePageConfig result = lowcodeService.publishPage(factoryId, pageId);
        return ApiResponse.success("页面发布成功", result);
    }

    /**
     * 删除页面
     */
    @DeleteMapping("/pages/{pageId}")
    @Operation(summary = "删除页面", description = "删除指定的页面配置")
    public ApiResponse<Void> deletePage(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "页面ID") String pageId) {
        log.info("删除页面: factoryId={}, pageId={}", factoryId, pageId);
        lowcodeService.deletePage(factoryId, pageId);
        return ApiResponse.success("页面删除成功", null);
    }

    // ==================== 组件管理 ====================

    /**
     * 获取可用组件列表
     */
    @GetMapping("/components")
    @Operation(summary = "获取组件列表", description = "获取所有可用的低代码组件列表，包括系统组件和工厂自定义组件")
    public ApiResponse<List<LowcodeComponentDefinition>> getComponents(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(required = false) @Parameter(description = "角色编码，用于权限过滤") String roleCode) {
        log.info("获取组件列表: factoryId={}, roleCode={}", factoryId, roleCode);
        List<LowcodeComponentDefinition> result = lowcodeService.getComponents(factoryId, roleCode);
        return ApiResponse.success(result);
    }

    /**
     * 获取组件详情
     */
    @GetMapping("/components/{type}")
    @Operation(summary = "获取组件详情", description = "获取指定类型组件的详细配置信息，包括属性定义、事件、样式等")
    public ApiResponse<LowcodeComponentDefinition> getComponentDetail(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "组件类型", example = "Button") String type) {
        log.info("获取组件详情: factoryId={}, type={}", factoryId, type);
        return lowcodeService.getComponent(type)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "组件不存在: " + type));
    }
}
