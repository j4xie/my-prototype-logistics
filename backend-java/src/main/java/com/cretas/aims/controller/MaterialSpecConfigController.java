package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.MaterialSpecConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotEmpty;
import java.util.List;
import java.util.Map;

/**
 * 原材料规格配置控制器
 *
 * <p>本控制器负责处理原材料规格配置相关的所有HTTP请求。</p>
 *
 * <h3>功能说明</h3>
 * <p>原材料规格配置用于管理每个工厂的原材料类别对应的规格选项。例如：</p>
 * <ul>
 *   <li>海鲜类别 -> ["整条", "切片", "去骨切片", "鱼块", "鱼排", "虾仁", "去壳"]</li>
 *   <li>肉类类别 -> ["整块", "切片", "切丁", "绞肉", "排骨", "带骨", "去骨"]</li>
 *   <li>蔬菜类别 -> ["整颗", "切段", "切丝", "切块", "切片"]</li>
 * </ul>
 *
 * <h3>API路径</h3>
 * <p>基础路径: <code>/api/mobile/{factoryId}/material-spec-config</code></p>
 *
 * <h3>提供的API端点</h3>
 * <ol>
 *   <li><b>GET</b>    /material-spec-config                    - 获取工厂的所有规格配置</li>
 *   <li><b>GET</b>    /material-spec-config/{category}         - 获取指定类别的规格配置</li>
 *   <li><b>PUT</b>    /material-spec-config/{category}         - 更新指定类别的规格配置</li>
 *   <li><b>DELETE</b> /material-spec-config/{category}         - 重置为系统默认配置</li>
 *   <li><b>GET</b>    /material-spec-config/system/defaults    - 获取系统默认配置</li>
 * </ol>
 *
 * <h3>业务规则</h3>
 * <ul>
 *   <li><b>系统默认配置</b>：每个类别都有系统预设的默认规格选项</li>
 *   <li><b>自定义配置</b>：工厂可以自定义每个类别的规格选项</li>
 *   <li><b>配置优先级</b>：如果工厂有自定义配置，使用自定义配置；否则使用系统默认配置</li>
 *   <li><b>数据存储</b>：规格列表以JSON格式存储在数据库中</li>
 * </ul>
 *
 * <h3>使用场景</h3>
 * <ul>
 *   <li>在创建原材料批次时，根据原材料类别显示对应的规格选项</li>
 *   <li>管理员可以自定义每个类别的规格选项，以适应不同工厂的业务需求</li>
 *   <li>支持重置为系统默认配置，方便恢复初始状态</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-04
 * @see MaterialSpecConfigService 业务逻辑层
 * @see MaterialSpecConfig 实体类
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/material-spec-config")
@RequiredArgsConstructor
@Tag(name = "原材料规格配置管理")
@Validated
public class MaterialSpecConfigController {

    private final MaterialSpecConfigService specConfigService;

    /**
     * 获取工厂的所有规格配置
     * GET /api/mobile/{factoryId}/material-spec-config
     */
    @GetMapping
    @Operation(summary = "获取所有规格配置", description = "获取工厂的所有原材料类别规格配置")
    public ApiResponse<Map<String, List<String>>> getAllSpecConfigs(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取规格配置: factoryId={}", factoryId);

        Map<String, List<String>> configs = specConfigService.getAllSpecConfigs(factoryId);
        return ApiResponse.success(configs);
    }

    /**
     * 获取指定类别的规格配置
     * GET /api/mobile/{factoryId}/material-spec-config/{category}
     */
    @GetMapping("/{category}")
    @Operation(summary = "获取类别规格配置", description = "获取指定类别的规格选项列表")
    public ApiResponse<List<String>> getSpecsByCategory(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "类别名称") String category) {
        log.info("获取类别规格: factoryId={}, category={}", factoryId, category);

        List<String> specs = specConfigService.getSpecsByCategory(factoryId, category);
        return ApiResponse.success(specs);
    }

    /**
     * 更新指定类别的规格配置
     * PUT /api/mobile/{factoryId}/material-spec-config/{category}
     */
    @PutMapping("/{category}")
    @Operation(summary = "更新类别规格配置", description = "更新指定类别的规格选项列表")
    public ApiResponse<Map<String, Object>> updateCategorySpecs(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "类别名称") String category,
            @RequestBody @Valid UpdateSpecRequest request) {
        log.info("更新类别规格: factoryId={}, category={}, specs={}", factoryId, category, request.getSpecifications());

        if (request.getSpecifications() == null || request.getSpecifications().isEmpty()) {
            return ApiResponse.error(400, "规格列表不能为空");
        }

        specConfigService.updateCategorySpecs(factoryId, category, request.getSpecifications());

        // 返回更新后的配置
        Map<String, Object> result = Map.of(
                "category", category,
                "specifications", request.getSpecifications()
        );

        return ApiResponse.success("规格配置更新成功", result);
    }

    /**
     * 重置为系统默认配置
     * DELETE /api/mobile/{factoryId}/material-spec-config/{category}
     */
    @DeleteMapping("/{category}")
    @Operation(summary = "重置为默认配置", description = "删除自定义配置，恢复系统默认配置")
    public ApiResponse<Map<String, Object>> resetToDefault(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "类别名称") String category) {
        log.info("重置为默认配置: factoryId={}, category={}", factoryId, category);

        List<String> defaultSpecs = specConfigService.resetToDefault(factoryId, category);

        Map<String, Object> result = Map.of(
                "category", category,
                "specifications", defaultSpecs
        );

        return ApiResponse.success("已重置为默认配置", result);
    }

    /**
     * 获取系统默认配置
     * GET /api/mobile/{factoryId}/material-spec-config/system/defaults
     */
    @GetMapping("/system/defaults")
    @Operation(summary = "获取系统默认配置", description = "获取所有类别的系统默认规格配置")
    public ApiResponse<Map<String, List<String>>> getSystemDefaults(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取系统默认配置: factoryId={}", factoryId);

        Map<String, List<String>> defaults = specConfigService.getSystemDefaultConfigs();
        return ApiResponse.success(defaults);
    }

    /**
     * 更新规格配置请求体
     */
    @lombok.Data
    public static class UpdateSpecRequest {
        @NotEmpty(message = "规格列表不能为空")
        private List<String> specifications;
    }
}
