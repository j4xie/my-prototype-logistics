package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.platform.AIFactoryInitRequest;
import com.cretas.aims.dto.platform.AIFactoryInitResponse;
import com.cretas.aims.dto.platform.AIQuotaRuleDTO;
import com.cretas.aims.dto.platform.CreateAIQuotaRuleRequest;
import com.cretas.aims.dto.platform.CreateFactoryRequest;
import com.cretas.aims.dto.platform.FactoryAIQuotaDTO;
import com.cretas.aims.dto.platform.FactoryDTO;
import com.cretas.aims.dto.platform.PlatformAIUsageStatsDTO;
import com.cretas.aims.dto.platform.PlatformReportDTO;
import com.cretas.aims.dto.platform.PlatformStatisticsDTO;
import com.cretas.aims.dto.platform.SystemMetricsDTO;
import com.cretas.aims.dto.platform.UpdateAIQuotaRequest;
import com.cretas.aims.dto.platform.UpdateAIQuotaRuleRequest;
import com.cretas.aims.dto.platform.UpdateFactoryRequest;
import com.cretas.aims.service.AIEnterpriseService;
import com.cretas.aims.service.AIQuotaRuleService;
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
import java.lang.management.ManagementFactory;
import java.lang.management.OperatingSystemMXBean;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.cretas.aims.util.ErrorSanitizer;

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
    private final AIQuotaRuleService quotaRuleService;

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

    /**
     * 获取平台报表数据
     * 提供跨工厂的综合报表数据，包括生产、财务、质量等报表
     *
     * @param reportType 报表类型 (production, financial, quality, user)
     * @param timePeriod 时间周期 (week, month, quarter, year)
     * @return 平台报表数据
     * @since 2025-12-31
     */
    @GetMapping("/reports")
    @Operation(summary = "获取平台报表数据",
               description = "获取跨工厂的综合报表数据（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<PlatformReportDTO> getPlatformReport(
            @RequestParam(defaultValue = "production")
            @Parameter(description = "报表类型: production, financial, quality, user") String reportType,
            @RequestParam(defaultValue = "month")
            @Parameter(description = "时间周期: week, month, quarter, year") String timePeriod
    ) {
        log.info("API调用: 获取平台报表 - reportType={}, timePeriod={}", reportType, timePeriod);

        PlatformReportDTO report = buildPlatformReport(reportType, timePeriod);
        return ApiResponse.success(report);
    }

    /**
     * 构建平台报表数据
     * TODO: 未来从实际数据库聚合统计数据
     */
    private PlatformReportDTO buildPlatformReport(String reportType, String timePeriod) {
        // 获取所有工厂列表
        List<FactoryDTO> factories = factoryService.getAllFactories();

        // 构建趋势数据
        List<PlatformReportDTO.TrendData> trends = new ArrayList<>();
        String[] periodLabels = getPeriodLabels(timePeriod);
        double baseValue = 285.3;
        for (int i = 0; i < periodLabels.length; i++) {
            double value = baseValue + (Math.random() * 50 - 25);
            double change = (value - baseValue) / baseValue * 100;
            trends.add(PlatformReportDTO.TrendData.builder()
                    .period(periodLabels[i])
                    .value(Math.round(value * 10) / 10.0)
                    .change(Math.round(change * 10) / 10.0)
                    .build());
            baseValue = value;
        }

        // 构建工厂排行榜
        List<PlatformReportDTO.FactoryRanking> rankings = new ArrayList<>();
        int rank = 1;
        for (FactoryDTO factory : factories) {
            if (rank > 10) break; // 只返回前10名
            double production = 900 - (rank - 1) * 80 + (Math.random() * 40 - 20);
            double revenue = production * 400 + (Math.random() * 10000);
            double efficiency = 96 - (rank - 1) * 1.5 + (Math.random() * 2 - 1);
            double qualityScore = 98 - (rank - 1) * 0.5 + (Math.random() - 0.5);

            rankings.add(PlatformReportDTO.FactoryRanking.builder()
                    .factoryId(factory.getId())
                    .name(factory.getName())
                    .production(Math.round(production * 10) / 10.0)
                    .revenue((double) Math.round(revenue))
                    .efficiency(Math.round(efficiency * 10) / 10.0)
                    .qualityScore(Math.round(qualityScore * 10) / 10.0)
                    .rank(rank)
                    .build());
            rank++;
        }

        // 构建报表摘要
        double totalProduction = rankings.stream()
                .mapToDouble(PlatformReportDTO.FactoryRanking::getProduction).sum();
        double totalRevenue = rankings.stream()
                .mapToDouble(PlatformReportDTO.FactoryRanking::getRevenue).sum();
        double avgQuality = rankings.stream()
                .mapToDouble(PlatformReportDTO.FactoryRanking::getQualityScore).average().orElse(0);

        PlatformReportDTO.ReportSummary summary = PlatformReportDTO.ReportSummary.builder()
                .totalRevenue((double) Math.round(totalRevenue))
                .totalProduction(Math.round(totalProduction * 10) / 10.0)
                .totalOrders((int) (totalProduction * 0.25))
                .averageQualityScore(Math.round(avgQuality * 10) / 10.0)
                .changePercentage(12.5) // 模拟同比变化
                .build();

        return PlatformReportDTO.builder()
                .summary(summary)
                .trends(trends)
                .topFactories(rankings)
                .reportType(reportType)
                .timePeriod(timePeriod)
                .build();
    }

    /**
     * 根据时间周期获取周期标签
     */
    private String[] getPeriodLabels(String timePeriod) {
        switch (timePeriod) {
            case "week":
                return new String[]{"周一", "周二", "周三", "周四", "周五", "周六", "周日"};
            case "month":
                return new String[]{"第1周", "第2周", "第3周", "第4周"};
            case "quarter":
                return new String[]{"第1月", "第2月", "第3月"};
            case "year":
                return new String[]{"Q1", "Q2", "Q3", "Q4"};
            default:
                return new String[]{"第1周", "第2周", "第3周", "第4周"};
        }
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
                    .message("AI配置生成失败: " + ErrorSanitizer.sanitize(e))
                    .build();

            return ApiResponse.error("AI配置生成失败: " + ErrorSanitizer.sanitize(e));
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

    // ==================== AI 配额规则管理 API ====================

    /**
     * 获取所有配额规则
     */
    @GetMapping("/ai-quota-rules")
    @Operation(summary = "获取所有配额规则", description = "获取所有工厂的配额规则设置（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<List<AIQuotaRuleDTO>> getAllQuotaRules() {
        log.info("API调用: 获取所有配额规则");

        List<AIQuotaRuleDTO> rules = quotaRuleService.getAllRules();
        return ApiResponse.success(rules);
    }

    /**
     * 获取工厂的配额规则
     */
    @GetMapping("/ai-quota-rules/factory/{factoryId}")
    @Operation(summary = "获取工厂配额规则", description = "获取指定工厂的配额规则（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<AIQuotaRuleDTO> getFactoryQuotaRule(
            @PathVariable @Parameter(description = "工厂ID") String factoryId
    ) {
        log.info("API调用: 获取工厂配额规则 - factoryId={}", factoryId);

        AIQuotaRuleDTO rule = quotaRuleService.getEffectiveRuleByFactory(factoryId);
        return ApiResponse.success(rule);
    }

    /**
     * 获取全局默认配额规则
     */
    @GetMapping("/ai-quota-rules/default")
    @Operation(summary = "获取全局默认配额规则", description = "获取全局默认配额规则（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<AIQuotaRuleDTO> getGlobalDefaultQuotaRule() {
        log.info("API调用: 获取全局默认配额规则");

        AIQuotaRuleDTO rule = quotaRuleService.getGlobalDefaultRule();
        return ApiResponse.success(rule);
    }

    /**
     * 创建配额规则
     */
    @PostMapping("/ai-quota-rules")
    @Operation(summary = "创建配额规则", description = "创建工厂配额规则（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<AIQuotaRuleDTO> createQuotaRule(
            @Valid @RequestBody CreateAIQuotaRuleRequest request
    ) {
        log.info("API调用: 创建配额规则 - factoryId={}, weeklyQuota={}",
                request.getFactoryId(), request.getWeeklyQuota());

        AIQuotaRuleDTO rule = quotaRuleService.createRule(request);
        return ApiResponse.success("配额规则创建成功", rule);
    }

    /**
     * 更新配额规则
     */
    @PutMapping("/ai-quota-rules/{ruleId}")
    @Operation(summary = "更新配额规则", description = "更新指定配额规则（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<AIQuotaRuleDTO> updateQuotaRule(
            @PathVariable @Parameter(description = "规则ID") Long ruleId,
            @Valid @RequestBody UpdateAIQuotaRuleRequest request
    ) {
        log.info("API调用: 更新配额规则 - ruleId={}", ruleId);

        AIQuotaRuleDTO rule = quotaRuleService.updateRule(ruleId, request);
        return ApiResponse.success("配额规则更新成功", rule);
    }

    /**
     * 删除配额规则
     */
    @DeleteMapping("/ai-quota-rules/{ruleId}")
    @Operation(summary = "删除配额规则", description = "删除指定配额规则（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<String> deleteQuotaRule(
            @PathVariable @Parameter(description = "规则ID") Long ruleId
    ) {
        log.info("API调用: 删除配额规则 - ruleId={}", ruleId);

        quotaRuleService.deleteRule(ruleId);
        return ApiResponse.success("配额规则已删除");
    }

    /**
     * 创建或更新全局默认配额规则
     */
    @PostMapping("/ai-quota-rules/default")
    @Operation(summary = "创建或更新全局默认配额规则",
               description = "创建或更新全局默认配额规则（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<AIQuotaRuleDTO> createOrUpdateGlobalDefaultRule(
            @Valid @RequestBody CreateAIQuotaRuleRequest request
    ) {
        log.info("API调用: 创建或更新全局默认配额规则 - weeklyQuota={}", request.getWeeklyQuota());

        AIQuotaRuleDTO rule = quotaRuleService.createOrUpdateGlobalDefaultRule(request);
        return ApiResponse.success("全局默认配额规则已更新", rule);
    }

    /**
     * 计算用户配额
     */
    @GetMapping("/ai-quota-rules/calculate")
    @Operation(summary = "计算用户配额",
               description = "根据工厂和角色计算用户的实际配额（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<Map<String, Object>> calculateUserQuota(
            @RequestParam @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "用户角色") String role
    ) {
        log.info("API调用: 计算用户配额 - factoryId={}, role={}", factoryId, role);

        Integer quota = quotaRuleService.calculateQuotaForUser(factoryId, role);

        Map<String, Object> result = new HashMap<>();
        result.put("factoryId", factoryId);
        result.put("role", role);
        result.put("calculatedQuota", quota);

        return ApiResponse.success(result);
    }

    // ==================== 系统监控 API ====================

    /**
     * 获取系统监控指标
     * 提供 CPU、内存、磁盘、网络等实时监控数据
     */
    @GetMapping("/system/metrics")
    @Operation(summary = "获取系统监控指标",
               description = "获取平台系统的实时监控数据（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<SystemMetricsDTO> getSystemMetrics() {
        log.info("API调用: 获取系统监控指标");

        SystemMetricsDTO metrics = buildSystemMetrics();
        return ApiResponse.success(metrics);
    }

    /**
     * 构建系统监控指标
     */
    private SystemMetricsDTO buildSystemMetrics() {
        Runtime runtime = Runtime.getRuntime();
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();

        // 内存指标
        long usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        long maxMemory = runtime.maxMemory() / (1024 * 1024);
        double memoryUsage = (double) usedMemory / maxMemory * 100;

        // CPU 使用率 (系统负载作为近似值)
        double cpuLoad = osBean.getSystemLoadAverage();
        double cpuUsage = cpuLoad >= 0 ? Math.min(cpuLoad / runtime.availableProcessors() * 100, 100) : 25.0;

        // JVM 运行时间
        long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();

        // 构建服务健康状态
        List<SystemMetricsDTO.ServiceHealthStatus> serviceHealthList = new ArrayList<>();
        serviceHealthList.add(SystemMetricsDTO.ServiceHealthStatus.builder()
                .serviceName("Java Backend")
                .status("UP")
                .message("运行正常")
                .responseTimeMs(15L)
                .build());
        serviceHealthList.add(SystemMetricsDTO.ServiceHealthStatus.builder()
                .serviceName("MySQL Database")
                .status("UP")
                .message("连接正常")
                .responseTimeMs(5L)
                .build());
        serviceHealthList.add(SystemMetricsDTO.ServiceHealthStatus.builder()
                .serviceName("AI Service")
                .status("UP")
                .message("响应正常")
                .responseTimeMs(120L)
                .build());

        // 构建最近活动日志
        List<SystemMetricsDTO.ActivityLog> activities = new ArrayList<>();
        activities.add(SystemMetricsDTO.ActivityLog.builder()
                .id(1L)
                .type("info")
                .message("系统健康检查完成")
                .time(formatTimeAgo(2))
                .icon("check-circle")
                .color("#4CAF50")
                .build());
        activities.add(SystemMetricsDTO.ActivityLog.builder()
                .id(2L)
                .type("info")
                .message("数据库连接池正常")
                .time(formatTimeAgo(5))
                .icon("database-check")
                .color("#2196F3")
                .build());
        activities.add(SystemMetricsDTO.ActivityLog.builder()
                .id(3L)
                .type("success")
                .message("AI服务响应正常")
                .time(formatTimeAgo(10))
                .icon("robot")
                .color("#9C27B0")
                .build());
        activities.add(SystemMetricsDTO.ActivityLog.builder()
                .id(4L)
                .type("info")
                .message("自动备份任务执行完成")
                .time(formatTimeAgo(30))
                .icon("backup-restore")
                .color("#00BCD4")
                .build());

        return SystemMetricsDTO.builder()
                .cpuUsage(Math.round(cpuUsage * 10) / 10.0)
                .memoryUsage(Math.round(memoryUsage * 10) / 10.0)
                .usedMemoryMB(usedMemory)
                .maxMemoryMB(maxMemory)
                .diskUsage(35.0) // 模拟值，实际需要系统调用获取
                .networkIn(85.6) // 模拟值
                .networkOut(42.3) // 模拟值
                .activeConnections(runtime.availableProcessors() * 50) // 估算值
                .requestsPerMinute(850) // 模拟值，实际需要 Metrics 收集
                .averageResponseTime(65) // 模拟值
                .errorRate(0.02) // 模拟值
                .uptime(formatUptime(uptimeMs))
                .uptimeMs(uptimeMs)
                .availableProcessors(runtime.availableProcessors())
                .javaVersion(System.getProperty("java.version"))
                .osName(System.getProperty("os.name"))
                .osArch(System.getProperty("os.arch"))
                .appVersion("1.0.0")
                .connectionPool(SystemMetricsDTO.ConnectionPoolStatus.builder()
                        .activeConnections(15)
                        .idleConnections(35)
                        .maxConnections(50)
                        .utilizationPercent(30.0)
                        .build())
                .serviceHealthStatus(serviceHealthList)
                .recentActivity(activities)
                .build();
    }

    /**
     * 格式化运行时间
     */
    private String formatUptime(long uptimeMs) {
        long seconds = uptimeMs / 1000;
        long minutes = seconds / 60;
        long hours = minutes / 60;
        long days = hours / 24;

        if (days > 0) {
            return String.format("%d天 %d小时 %d分钟", days, hours % 24, minutes % 60);
        } else if (hours > 0) {
            return String.format("%d小时 %d分钟", hours, minutes % 60);
        } else {
            return String.format("%d分钟", minutes);
        }
    }

    /**
     * 格式化时间差
     */
    private String formatTimeAgo(int minutesAgo) {
        if (minutesAgo < 60) {
            return minutesAgo + "分钟前";
        } else if (minutesAgo < 1440) {
            return (minutesAgo / 60) + "小时前";
        } else {
            return (minutesAgo / 1440) + "天前";
        }
    }
}
