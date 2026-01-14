package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.decoration.*;
import com.cretas.aims.service.decoration.DecorationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

/**
 * 首页装饰控制器
 * 管理工厂首页布局配置、AI生成和智能建议
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/decoration")
@Tag(name = "首页装饰管理", description = "工厂首页布局配置相关接口，包括布局获取、草稿保存、发布、AI生成和智能建议")
@RequiredArgsConstructor
public class DecorationController {

    private final DecorationService decorationService;

    /**
     * 获取首页布局配置
     */
    @GetMapping("/home-layout")
    @Operation(summary = "获取首页布局", description = "获取工厂的首页布局配置，如果没有配置则返回默认布局")
    public ApiResponse<HomeLayoutDTO> getHomeLayout(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取首页布局: factoryId={}", factoryId);
        HomeLayoutDTO layout = decorationService.getHomeLayout(factoryId);
        return ApiResponse.success(layout);
    }

    /**
     * 保存布局草稿
     */
    @PostMapping("/home-layout")
    @Operation(summary = "保存布局草稿", description = "保存首页布局配置草稿，不会立即生效，需要发布后才会应用")
    public ApiResponse<HomeLayoutDTO> saveDraft(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "布局保存请求") HomeLayoutDTO.SaveRequest request) {
        log.info("保存布局草稿: factoryId={}", factoryId);
        HomeLayoutDTO layout = decorationService.saveDraft(factoryId, request);
        return ApiResponse.success("草稿已保存", layout);
    }

    /**
     * 发布布局配置
     */
    @PostMapping("/home-layout/publish")
    @Operation(summary = "发布布局", description = "将当前草稿发布为正式布局，发布后立即生效")
    public ApiResponse<HomeLayoutDTO> publishLayout(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.info("发布布局配置: factoryId={}", factoryId);
        HomeLayoutDTO layout = decorationService.publishLayout(factoryId);
        return ApiResponse.success("布局已发布", layout);
    }

    /**
     * AI生成布局
     */
    @PostMapping("/home-layout/ai-generate")
    @Operation(summary = "AI生成布局", description = "根据用户描述和偏好，使用AI生成个性化的首页布局配置")
    public ApiResponse<AILayoutResponse> generateLayoutWithAI(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Valid @Parameter(description = "AI生成请求") AILayoutRequest request) {
        log.info("AI生成布局: factoryId={}, prompt={}", factoryId, request.getPrompt());
        AILayoutResponse response = decorationService.generateLayoutWithAI(factoryId, request);
        return ApiResponse.success("布局生成成功", response);
    }

    /**
     * 获取智能布局建议
     */
    @GetMapping("/home-layout/suggestions")
    @Operation(summary = "获取布局建议", description = "基于用户使用行为分析，获取智能布局优化建议")
    public ApiResponse<LayoutSuggestionDTO> getSuggestions(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取布局建议: factoryId={}", factoryId);
        LayoutSuggestionDTO suggestions = decorationService.getSuggestions(factoryId);
        return ApiResponse.success(suggestions);
    }

    /**
     * 记录模块点击
     */
    @PostMapping("/home-layout/track-click")
    @Operation(summary = "记录模块点击", description = "记录用户点击模块的行为，用于使用行为分析")
    public ApiResponse<Void> trackModuleClick(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "模块ID", example = "today_stats") String moduleId) {
        log.debug("记录模块点击: factoryId={}, moduleId={}", factoryId, moduleId);
        decorationService.recordModuleClick(factoryId, moduleId);
        return ApiResponse.success();
    }

    /**
     * 重置为默认布局
     */
    @PostMapping("/home-layout/reset")
    @Operation(summary = "重置布局", description = "将首页布局重置为系统默认配置")
    public ApiResponse<HomeLayoutDTO> resetLayout(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.info("重置布局: factoryId={}", factoryId);
        HomeLayoutDTO layout = decorationService.resetToDefault(factoryId);
        return ApiResponse.success("布局已重置", layout);
    }

    /**
     * 获取可用模块列表
     */
    @GetMapping("/home-layout/available-modules")
    @Operation(summary = "获取可用模块", description = "获取所有可用于首页布局的模块列表")
    public ApiResponse<List<HomeLayoutDTO.ModuleConfig>> getAvailableModules(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {
        log.debug("获取可用模块列表: factoryId={}", factoryId);
        List<HomeLayoutDTO.ModuleConfig> modules = decorationService.getAvailableModules(factoryId);
        return ApiResponse.success(modules);
    }
}
