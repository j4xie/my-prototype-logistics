package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.platform.AIFactoryInitRequest;
import com.cretas.aims.dto.platform.AIFactoryInitResponse;
import com.cretas.aims.dto.platform.CreateFactoryRequest;
import com.cretas.aims.dto.platform.FactoryAIQuotaDTO;
import com.cretas.aims.dto.platform.FactoryDTO;
import com.cretas.aims.dto.platform.PlatformAIUsageStatsDTO;
import com.cretas.aims.dto.platform.PlatformStatisticsDTO;
import com.cretas.aims.dto.platform.UpdateAIQuotaRequest;
import com.cretas.aims.dto.platform.UpdateFactoryRequest;
import com.cretas.aims.service.AIEnterpriseService;
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
    private final AIEnterpriseService aiEnterpriseService;

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

    // ==================== AI 工厂初始化 API ====================

    /**
     * AI 初始化工厂配置
     *
     * 使用 AI 根据自然语言描述生成工厂的完整表单配置。
     *
     * 示例输入: "这是一个水产品加工厂，主要生产带鱼罐头，需要原料入库、生产、质检、出货全流程"
     *
     * 输出包含:
     * - 所有 EntityType 的 Formily Schema (MATERIAL_BATCH, PROCESSING_BATCH, QUALITY_CHECK, SHIPMENT 等)
     * - 建议的产品类型、原料类型、转换率配置
     * - AI 生成的配置说明
     *
     * @param factoryId 工厂ID
     * @param request   包含工厂描述的请求
     * @return AI 生成的配置响应
     * @since 2025-12-29
     */
    @PostMapping("/factories/{factoryId}/ai-initialize")
    @Operation(summary = "AI初始化工厂配置",
               description = "使用AI根据自然语言描述生成工厂的完整表单配置（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<AIFactoryInitResponse> aiInitializeFactory(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody AIFactoryInitRequest request
    ) {
        log.info("API调用: AI初始化工厂配置 - factoryId={}, description长度={}",
                factoryId, request.getFactoryDescription().length());

        try {
            // 获取工厂信息
            FactoryDTO factory = factoryService.getFactoryById(factoryId);

            // 调用 AI 服务生成配置
            Map<String, Object> aiResult = aiEnterpriseService.batchInitializeFactory(
                    factoryId,
                    request.getFactoryName() != null ? request.getFactoryName() : factory.getName(),
                    request.getFactoryDescription(),
                    request.getIndustryHint(),
                    request.getIncludeBusinessData()
            );

            // 构建响应
            AIFactoryInitResponse response = buildAIFactoryInitResponse(aiResult);

            log.info("AI初始化工厂配置成功 - factoryId={}, industryCode={}, schemasCount={}",
                    factoryId, response.getIndustryCode(),
                    response.getSchemas() != null ? response.getSchemas().size() : 0);

            return ApiResponse.success("AI配置生成成功", response);

        } catch (Exception e) {
            log.error("AI初始化工厂配置失败 - factoryId={}, error={}", factoryId, e.getMessage(), e);

            AIFactoryInitResponse errorResponse = AIFactoryInitResponse.builder()
                    .success(false)
                    .message("AI配置生成失败: " + e.getMessage())
                    .build();

            return ApiResponse.error("AI配置生成失败: " + e.getMessage());
        }
    }

    /**
     * 构建 AI 工厂初始化响应
     */
    @SuppressWarnings("unchecked")
    private AIFactoryInitResponse buildAIFactoryInitResponse(Map<String, Object> aiResult) {
        AIFactoryInitResponse.AIFactoryInitResponseBuilder builder = AIFactoryInitResponse.builder();

        builder.success(Boolean.TRUE.equals(aiResult.get("success")));
        builder.industryCode((String) aiResult.get("industryCode"));
        builder.industryName((String) aiResult.get("industryName"));
        builder.aiSummary((String) aiResult.get("aiSummary"));
        builder.message((String) aiResult.get("message"));

        // 解析 schemas
        Object schemasObj = aiResult.get("schemas");
        if (schemasObj instanceof List) {
            List<Map<String, Object>> schemasList = (List<Map<String, Object>>) schemasObj;
            List<AIFactoryInitResponse.EntitySchemaDTO> schemas = new ArrayList<>();

            for (Map<String, Object> schemaMap : schemasList) {
                AIFactoryInitResponse.EntitySchemaDTO schemaDTO = AIFactoryInitResponse.EntitySchemaDTO.builder()
                        .entityType((String) schemaMap.get("entityType"))
                        .entityName((String) schemaMap.get("entityName"))
                        .description((String) schemaMap.get("description"))
                        .fields((List<Map<String, Object>>) schemaMap.get("fields"))
                        .build();
                schemas.add(schemaDTO);
            }
            builder.schemas(schemas);
        }

        // 解析 suggestedData
        Object suggestedDataObj = aiResult.get("suggestedData");
        if (suggestedDataObj instanceof Map) {
            Map<String, Object> suggestedDataMap = (Map<String, Object>) suggestedDataObj;
            AIFactoryInitResponse.SuggestedBusinessDataDTO suggestedData =
                    AIFactoryInitResponse.SuggestedBusinessDataDTO.builder()
                            .productTypes((List<Map<String, Object>>) suggestedDataMap.get("productTypes"))
                            .materialTypes((List<Map<String, Object>>) suggestedDataMap.get("materialTypes"))
                            .conversionRates((List<Map<String, Object>>) suggestedDataMap.get("conversionRates"))
                            .build();
            builder.suggestedData(suggestedData);
        }

        return builder.build();
    }
}
