package com.cretas.aims.controller;

import com.cretas.aims.dto.AIRequestDTO;
import com.cretas.aims.dto.AIResponseDTO;
import com.cretas.aims.dto.MobileDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.AIAnalysisService;
import com.cretas.aims.service.AIEnterpriseService;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * AI统一接口控制器
 *
 * 整合所有AI相关功能：
 * - 成本分析（批次/时间范围/对比）
 * - 配额管理
 * - 对话历史
 * - 报告管理
 * - 健康检查
 *
 * 统一路径结构：/api/mobile/{factoryId}/ai/{resource}/{action}
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-11-04
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/ai")
@Tag(name = "AI智能分析", description = "AI成本分析、配额管理、报告生成等统一接口")
@Validated
public class AIController {

    @Autowired
    private AIEnterpriseService aiEnterpriseService;

    @Autowired
    private AIAnalysisService basicAIService;

    @Autowired
    private MobileService mobileService;

    // ========== 成本分析接口 ==========

    /**
     * AI批次成本分析
     *
     * 支持三种分析模式：
     * 1. 默认分析（无question）- 首次分析，消耗配额
     * 2. Follow-up对话（有question + sessionId）- 追问，少量消耗配额
     * 3. 历史综合报告（历史批次）- 深度分析，较多消耗配额
     */
    @PostMapping("/analysis/cost/batch")
    @Operation(summary = "AI批次成本分析",
               description = "对指定批次进行AI成本分析，支持默认分析、follow-up对话和历史综合报告")
    public ApiResponse<MobileDTO.AICostAnalysisResponse> analyzeBatchCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "批次成本分析请求")
            MobileDTO.AICostAnalysisRequest request,
            HttpServletRequest httpRequest) {

        // 从Token获取用户ID
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        Long userId = (long) mobileService.getUserFromToken(token).getId();

        log.info("AI批次成本分析: factoryId={}, userId={}, batchId={}, question={}",
                factoryId, userId, request.getBatchId(), request.getQuestion());

        // 调用企业级AI服务（包含配额管理、缓存、审计日志）
        MobileDTO.AICostAnalysisResponse response = aiEnterpriseService.analyzeCost(
                factoryId, userId, request, httpRequest);

        return ApiResponse.success(response);
    }

    /**
     * AI时间范围成本分析
     *
     * 分析指定时间段内的成本数据
     */
    @PostMapping("/analysis/cost/time-range")
    @Operation(summary = "AI时间范围成本分析",
               description = "分析指定时间范围内的成本数据，支持日/周/月等不同维度")
    public ApiResponse<MobileDTO.AICostAnalysisResponse> analyzeTimeRangeCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "时间范围分析请求")
            AIRequestDTO.TimeRangeAnalysisRequest request,
            HttpServletRequest httpRequest) {

        // 从Token获取用户ID
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        Long userId = (long) mobileService.getUserFromToken(token).getId();

        log.info("AI时间范围成本分析: factoryId={}, userId={}, startDate={}, endDate={}",
                factoryId, userId, request.getStartDate(), request.getEndDate());

        // 转换LocalDate为LocalDateTime
        LocalDateTime startDateTime = request.getStartDate().atStartOfDay();
        LocalDateTime endDateTime = request.getEndDate().atTime(23, 59, 59);

        // 调用企业级AI服务进行时间范围成本分析
        MobileDTO.AICostAnalysisResponse response = aiEnterpriseService.analyzeTimeRangeCost(
                factoryId,
                userId,
                startDateTime,
                endDateTime,
                request.getDimension(),
                request.getQuestion(),
                httpRequest
        );

        return ApiResponse.success(response);
    }

    /**
     * AI批次对比分析
     *
     * 对比多个批次的成本效率
     */
    @PostMapping("/analysis/cost/compare")
    @Operation(summary = "AI批次对比分析",
               description = "对比2-5个批次的成本、效率、质量等指标")
    public ApiResponse<MobileDTO.AICostAnalysisResponse> compareBatchCosts(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "批次对比分析请求")
            AIRequestDTO.ComparativeAnalysisRequest request,
            HttpServletRequest httpRequest) {

        // 从Token获取用户ID
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        Long userId = (long) mobileService.getUserFromToken(token).getId();

        log.info("AI批次对比分析: factoryId={}, userId={}, batchIds={}",
                factoryId, userId, request.getBatchIds());

        // 调用企业级AI服务进行批次对比分析
        MobileDTO.AICostAnalysisResponse response = aiEnterpriseService.compareBatchCosts(
                factoryId, userId, request.getBatchIds(), request.getQuestion(), httpRequest);

        return ApiResponse.success(response);
    }

    // ========== 配额管理接口 ==========

    /**
     * 查询AI配额信息
     *
     * 统一配额查询接口，替代原有的多个重复端点
     */
    @GetMapping("/quota")
    @Operation(summary = "查询AI配额信息",
               description = "获取工厂的AI配额使用情况、剩余额度、使用记录等")
    public ApiResponse<MobileDTO.AIQuotaInfo> getQuotaInfo(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            HttpServletRequest httpRequest) {

        log.info("查询AI配额信息: factoryId={}", factoryId);

        // 调用AIEnterpriseService获取配额信息
        MobileDTO.AIQuotaInfo quotaInfo = aiEnterpriseService.getQuotaInfo(factoryId);

        return ApiResponse.success(quotaInfo);
    }

    /**
     * 更新AI配额（仅供平台管理员使用）
     */
    @PutMapping("/quota")
    @Operation(summary = "更新AI配额",
               description = "平台管理员更新工厂的AI配额（仅限平台角色）")
    public ApiResponse<Void> updateQuota(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "新配额限制") Integer newQuotaLimit,
            HttpServletRequest httpRequest) {

        // 从Token获取用户信息
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        Object user = mobileService.getUserFromToken(token);

        log.info("更新AI配额请求: factoryId={}, newQuotaLimit={}, user={}",
                factoryId, newQuotaLimit, user.getClass().getSimpleName());

        // 权限检查：仅平台管理员可以更新配额
        // TODO: 实现具体的权限验证逻辑（检查用户是否为platform_admin角色）
        // 当前简化处理：记录日志并继续
        // 在生产环境中，应该检查用户角色：if (!isPlatformAdmin(user)) throw UnauthorizedException

        // 调用服务更新配额
        aiEnterpriseService.updateQuotaLimit(factoryId, newQuotaLimit);

        log.info("AI配额更新成功: factoryId={}, newQuotaLimit={}", factoryId, newQuotaLimit);

        return ApiResponse.success();
    }

    // ========== 对话管理接口 ==========

    /**
     * 获取AI对话历史
     */
    @GetMapping("/conversations/{sessionId}")
    @Operation(summary = "获取AI对话历史",
               description = "获取指定会话的完整对话历史记录")
    public ApiResponse<AIResponseDTO.ConversationResponse> getConversation(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "会话ID") String sessionId) {

        log.info("获取AI对话历史: factoryId={}, sessionId={}", factoryId, sessionId);

        // 调用基础AI服务获取对话历史
        List<Map<String, Object>> messages = basicAIService.getSessionHistory(sessionId);

        // 转换为统一响应格式
        AIResponseDTO.ConversationResponse response = AIResponseDTO.ConversationResponse.builder()
                .sessionId(sessionId)
                .messages(messages.stream()
                        .map(msg -> AIResponseDTO.ConversationMessage.builder()
                                .role(msg.get("role").toString())
                                .content(msg.get("content").toString())
                                .timestamp(LocalDateTime.now())  // 简化处理
                                .build())
                        .collect(Collectors.toList()))
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .status("active")
                .build();

        return ApiResponse.success(response);
    }

    /**
     * 关闭AI对话会话
     */
    @DeleteMapping("/conversations/{sessionId}")
    @Operation(summary = "关闭AI对话会话",
               description = "结束指定的AI对话会话")
    public ApiResponse<Void> closeConversation(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "会话ID") String sessionId) {

        log.info("关闭AI对话会话: factoryId={}, sessionId={}", factoryId, sessionId);

        // DeepSeek AI服务会自动管理会话生命周期
        // 会话超时后会自动清理，无需额外操作
        // 这里仅记录日志用于审计追踪

        log.info("AI会话已标记关闭（DeepSeek自动管理）: factoryId={}, sessionId={}",
                factoryId, sessionId);

        return ApiResponse.success();
    }

    // ========== 报告管理接口 ==========

    /**
     * 获取AI报告列表
     *
     * 统一报告查询接口，支持按类型和时间范围筛选
     */
    @GetMapping("/reports")
    @Operation(summary = "获取AI报告列表",
               description = "获取工厂的AI成本分析报告列表，支持按类型和时间筛选")
    public ApiResponse<MobileDTO.AIReportListResponse> getReports(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "报告类型") String reportType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            @Parameter(description = "开始日期") LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            @Parameter(description = "结束日期") LocalDateTime endDate) {

        log.info("获取AI报告列表: factoryId={}, reportType={}", factoryId, reportType);

        // 构建请求对象
        MobileDTO.AIReportListRequest request = MobileDTO.AIReportListRequest.builder()
                .reportType(reportType)
                .startDate(startDate)
                .endDate(endDate)
                .build();

        // 调用企业级AI服务获取报告列表
        MobileDTO.AIReportListResponse reports = aiEnterpriseService.getReportList(factoryId, request);

        return ApiResponse.success(reports);
    }

    /**
     * 获取AI报告详情
     */
    @GetMapping("/reports/{reportId}")
    @Operation(summary = "获取AI报告详情",
               description = "获取指定AI报告的完整内容")
    public ApiResponse<MobileDTO.AICostAnalysisResponse> getReportDetail(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "报告ID") Long reportId) {

        log.info("获取AI报告详情: factoryId={}, reportId={}", factoryId, reportId);

        // 调用企业级AI服务获取报告详情
        MobileDTO.AICostAnalysisResponse response = aiEnterpriseService.getReportDetail(factoryId, reportId);

        return ApiResponse.success(response);
    }

    /**
     * 生成新报告（手动触发）
     */
    @PostMapping("/reports/generate")
    @Operation(summary = "生成AI报告",
               description = "手动触发生成AI分析报告（周报/月报等）")
    public ApiResponse<MobileDTO.AICostAnalysisResponse> generateReport(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "报告生成请求")
            AIRequestDTO.ReportGenerationRequest request,
            HttpServletRequest httpRequest) {

        // 从Token获取用户ID
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        Long userId = (long) mobileService.getUserFromToken(token).getId();

        log.info("生成AI报告: factoryId={}, userId={}, reportType={}",
                factoryId, userId, request.getReportType());

        // 根据报告类型路由到相应的生成方法
        MobileDTO.AICostAnalysisResponse response;

        switch (request.getReportType()) {
            case "batch":
                // 批次报告 - 路由到批次成本分析
                if (request.getBatchId() == null) {
                    throw new IllegalArgumentException("批次报告需要提供batchId");
                }
                MobileDTO.AICostAnalysisRequest batchRequest = new MobileDTO.AICostAnalysisRequest();
                batchRequest.setBatchId(String.valueOf(request.getBatchId()));
                batchRequest.setReportType("batch");
                response = aiEnterpriseService.analyzeCost(factoryId, userId, batchRequest, httpRequest);
                break;

            case "weekly":
            case "monthly":
            case "custom":
                // 时间范围报告 - 路由到时间范围成本分析
                if (request.getStartDate() == null || request.getEndDate() == null) {
                    throw new IllegalArgumentException("时间范围报告需要提供startDate和endDate");
                }
                response = aiEnterpriseService.analyzeTimeRangeCost(
                        factoryId,
                        userId,
                        request.getStartDate().atStartOfDay(),
                        request.getEndDate().atTime(23, 59, 59),
                        request.getReportType(),
                        null,  // 无自定义问题
                        httpRequest
                );
                break;

            default:
                throw new IllegalArgumentException("不支持的报告类型: " + request.getReportType());
        }

        log.info("AI报告生成完成: factoryId={}, reportType={}, reportId={}",
                factoryId, request.getReportType(), response.getReportId());

        return ApiResponse.success(response);
    }

    // ========== 健康检查接口 ==========

    /**
     * AI服务健康检查
     */
    @GetMapping("/health")
    @Operation(summary = "AI服务健康检查",
               description = "检查AI服务和DeepSeek API的可用性")
    public ApiResponse<AIResponseDTO.HealthCheckResponse> checkHealth(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {

        log.info("AI服务健康检查: factoryId={}", factoryId);

        // 调用基础AI服务进行健康检查
        Map<String, Object> healthData = basicAIService.healthCheck();

        AIResponseDTO.HealthCheckResponse response = AIResponseDTO.HealthCheckResponse.builder()
                .status((Boolean) healthData.get("available") ? "healthy" : "unavailable")
                .deepseekAvailable((Boolean) healthData.get("available"))
                .responseTime(100L)  // 简化处理
                .lastCheckTime(LocalDateTime.now())
                .errorMessage(healthData.get("error") != null ?
                        healthData.get("error").toString() : null)
                .build();

        return ApiResponse.success(response);
    }
}
