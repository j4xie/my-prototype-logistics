package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.platform.CreateFactoryRequest;
import com.cretas.aims.dto.platform.FactoryAIQuotaDTO;
import com.cretas.aims.dto.platform.FactoryDTO;
import com.cretas.aims.dto.platform.PlatformAIUsageStatsDTO;
import com.cretas.aims.dto.platform.PlatformStatisticsDTO;
import com.cretas.aims.dto.platform.UpdateAIQuotaRequest;
import com.cretas.aims.dto.platform.UpdateFactoryRequest;
import com.cretas.aims.service.FactoryService;
import com.cretas.aims.service.PlatformService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 平台管理控制器
 * 仅平台管理员可访问
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
@Slf4j
@RestController
@RequestMapping("/api/platform")
@RequiredArgsConstructor
@Validated
@Tag(name = "Platform", description = "平台管理API")
public class PlatformController {

    private final PlatformService platformService;
    private final FactoryService factoryService;

    /**
     * 获取所有工厂的AI配额设置
     */
    @GetMapping("/ai-quota")
    @Operation(summary = "获取所有工厂AI配额", description = "获取所有工厂的AI配额设置和历史调用统计（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<List<FactoryAIQuotaDTO>> getFactoryAIQuotas() {
        log.info("API调用: 获取所有工厂AI配额");

        List<FactoryAIQuotaDTO> quotas = platformService.getAllFactoryAIQuotas();
        return ApiResponse.success(quotas);
    }

    /**
     * 更新工厂AI配额
     */
    @PutMapping("/ai-quota/{factoryId}")
    @Operation(summary = "更新工厂AI配额", description = "更新指定工厂的AI配额设置（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<Map<String, Object>> updateFactoryAIQuota(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody UpdateAIQuotaRequest request
    ) {
        log.info("API调用: 更新工厂AI配额 - factoryId={}, weeklyQuota={}", factoryId, request.getWeeklyQuota());

        platformService.updateFactoryAIQuota(factoryId, request.getWeeklyQuota());

        Map<String, Object> result = new HashMap<>();
        result.put("factoryId", factoryId);
        result.put("weeklyQuota", request.getWeeklyQuota());

        return ApiResponse.success("配额已更新", result);
    }

    /**
     * 获取平台AI使用统计
     */
    @GetMapping("/ai-usage-stats")
    @Operation(summary = "获取平台AI使用统计", description = "获取平台级别的AI使用统计数据（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<PlatformAIUsageStatsDTO> getPlatformAIUsageStats() {
        log.info("API调用: 获取平台AI使用统计");

        PlatformAIUsageStatsDTO stats = platformService.getPlatformAIUsageStats();
        return ApiResponse.success(stats);
    }

    // ==================== 工厂管理API ====================

    /**
     * 获取所有工厂列表
     */
    @GetMapping("/factories")
    @Operation(summary = "获取所有工厂列表", description = "获取所有工厂的详细信息（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<List<FactoryDTO>> getAllFactories(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        log.info("API调用: 获取所有工厂列表, page={}, size={}", page, size);

        List<FactoryDTO> factories = factoryService.getAllFactories();

        // 如果提供了分页参数，进行分页处理
        if (page != null && size != null && size > 0) {
            int start = page * size;
            int end = Math.min(start + size, factories.size());
            if (start < factories.size()) {
                factories = factories.subList(start, end);
            } else {
                factories = new ArrayList<>();
            }
        }

        return ApiResponse.success(factories);
    }

    /**
     * 根据ID获取工厂详情
     */
    @GetMapping("/factories/{factoryId}")
    @Operation(summary = "获取工厂详情", description = "根据ID获取工厂详细信息（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<FactoryDTO> getFactoryById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId
    ) {
        log.info("API调用: 获取工厂详情 - factoryId={}", factoryId);

        FactoryDTO factory = factoryService.getFactoryById(factoryId);
        return ApiResponse.success(factory);
    }

    /**
     * 创建新工厂
     */
    @PostMapping("/factories")
    @Operation(summary = "创建新工厂", description = "创建新的工厂（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<FactoryDTO> createFactory(
            @Valid @RequestBody CreateFactoryRequest request
    ) {
        log.info("API调用: 创建新工厂 - name={}, industryCode={}, regionCode={}",
                request.getName(), request.getIndustryCode(), request.getRegionCode());

        FactoryDTO factory = factoryService.createFactory(request);
        return ApiResponse.success("工厂创建成功", factory);
    }

    /**
     * 更新工厂信息
     */
    @PutMapping("/factories/{factoryId}")
    @Operation(summary = "更新工厂信息", description = "更新指定工厂的信息（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<FactoryDTO> updateFactory(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody UpdateFactoryRequest request
    ) {
        log.info("API调用: 更新工厂信息 - factoryId={}", factoryId);

        FactoryDTO factory = factoryService.updateFactory(factoryId, request);
        return ApiResponse.success("工厂更新成功", factory);
    }

    /**
     * 删除工厂（软删除）
     */
    @DeleteMapping("/factories/{factoryId}")
    @Operation(summary = "删除工厂", description = "删除指定工厂（软删除，设置isActive=false）（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<String> deleteFactory(
            @PathVariable @Parameter(description = "工厂ID") String factoryId
    ) {
        log.info("API调用: 删除工厂 - factoryId={}", factoryId);

        factoryService.deleteFactory(factoryId);
        return ApiResponse.success("工厂已删除");
    }

    /**
     * 激活工厂
     */
    @PostMapping("/factories/{factoryId}/activate")
    @Operation(summary = "激活工厂", description = "激活指定工厂（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<FactoryDTO> activateFactory(
            @PathVariable @Parameter(description = "工厂ID") String factoryId
    ) {
        log.info("API调用: 激活工厂 - factoryId={}", factoryId);

        FactoryDTO factory = factoryService.activateFactory(factoryId);
        return ApiResponse.success("工厂已激活", factory);
    }

    /**
     * 停用工厂
     */
    @PostMapping("/factories/{factoryId}/deactivate")
    @Operation(summary = "停用工厂", description = "停用指定工厂（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<FactoryDTO> deactivateFactory(
            @PathVariable @Parameter(description = "工厂ID") String factoryId
    ) {
        log.info("API调用: 停用工厂 - factoryId={}", factoryId);

        FactoryDTO factory = factoryService.deactivateFactory(factoryId);
        return ApiResponse.success("工厂已停用", factory);
    }

    /**
     * 获取平台统计数据
     * 提供全平台的汇总统计信息，包括工厂、用户、批次、产量和AI配额等
     *
     * @return 平台统计数据
     * @since 2025-11-20
     */
    @GetMapping("/dashboard/statistics")
    @Operation(summary = "获取平台统计数据",
               description = "获取所有工厂的汇总统计（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<PlatformStatisticsDTO> getDashboardStatistics() {
        log.info("API调用: 获取平台统计数据");

        PlatformStatisticsDTO statistics = platformService.getDashboardStatistics();
        return ApiResponse.success("获取成功", statistics);
    }
}
