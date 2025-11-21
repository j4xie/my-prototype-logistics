package com.cretas.aims.service;

import com.cretas.aims.dto.MobileDTO;
import com.cretas.aims.entity.AIAnalysisResult;
import com.cretas.aims.entity.AIAuditLog;
import com.cretas.aims.entity.AIQuotaUsage;
import com.cretas.aims.repository.AIAnalysisResultRepository;
import com.cretas.aims.repository.AIAuditLogRepository;
import com.cretas.aims.repository.AIQuotaUsageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * AI企业级服务 - 完整的AI成本分析服务
 *
 * 核心功能：
 * 1. 智能路由：根据报告类型选择合适的处理逻辑
 * 2. 缓存管理：多层级报告缓存（batch/weekly/monthly/historical）
 * 3. 配额管理：每周100次配额，follow-up消耗1次，historical消耗5次
 * 4. 审计日志：完整的请求追踪和分析
 * 5. 定时任务支持：为AIReportScheduler提供报告生成方法
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-04
 */
@Service
public class AIEnterpriseService {
    private static final Logger log = LoggerFactory.getLogger(AIEnterpriseService.class);

    @Autowired
    private AIAnalysisService basicAIService;

    @Autowired
    private AIAnalysisResultRepository analysisResultRepository;

    @Autowired
    private AIQuotaUsageRepository quotaUsageRepository;

    @Autowired
    private AIAuditLogRepository auditLogRepository;

    @Autowired
    private ProcessingService processingService;

    /**
     * AI成本分析 - 主入口（智能路由）
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param request 请求参数
     * @param httpRequest HTTP请求（用于审计）
     * @return AI分析响应
     */
    @Transactional
    public MobileDTO.AICostAnalysisResponse analyzeCost(String factoryId, Long userId,
                                                         MobileDTO.AICostAnalysisRequest request,
                                                         HttpServletRequest httpRequest) {
        long startTime = System.currentTimeMillis();
        String questionType = determineQuestionType(request);
        boolean cacheHit = false;
        boolean success = false;
        String errorMessage = null;
        AIAnalysisResult cachedResult = null;

        try {
            // 1. 检查缓存（default和followup类型）
            if ("default".equals(questionType) || "followup".equals(questionType)) {
                cachedResult = checkCache(factoryId, request.getBatchId(), questionType, request.getQuestion());
                if (cachedResult != null) {
                    cacheHit = true;
                    success = true;
                    log.info("AI分析缓存命中: factoryId={}, batchId={}, type={}",
                            factoryId, request.getBatchId(), questionType);

                    // 记录审计日志（缓存命中不消耗配额）
                    logAuditRecord(factoryId, userId, request, questionType, true, null,
                                   System.currentTimeMillis() - startTime, cacheHit, httpRequest);

                    return buildResponseFromCache(cachedResult, factoryId);
                }
            }

            // 2. 配额检查（followup和historical消耗配额）
            if ("followup".equals(questionType) || "historical".equals(questionType)) {
                checkQuotaOrThrow(factoryId, questionType);
            }

            // 3. 调用AI服务生成分析
            String aiAnalysis;
            String sessionId = request.getSession_id();
            Integer messageCount = 0;

            if ("historical".equals(questionType)) {
                // 生成历史综合报告
                aiAnalysis = generateHistoricalReport(factoryId, request.getStartDate(), request.getEndDate());
            } else {
                // 获取成本数据并调用AI
                Map<String, Object> costData = processingService.getBatchCostAnalysis(factoryId, request.getBatchId());
                Map<String, Object> aiResult = basicAIService.analyzeCost(
                        factoryId, request.getBatchId(), costData,
                        sessionId, request.getQuestion());

                if (aiResult != null && Boolean.TRUE.equals(aiResult.get("success"))) {
                    aiAnalysis = (String) aiResult.get("aiAnalysis");
                    sessionId = (String) aiResult.get("sessionId");
                    messageCount = (Integer) aiResult.get("messageCount");
                    success = true;
                } else {
                    throw new RuntimeException("AI服务返回错误: " + aiResult.get("error"));
                }
            }

            // 4. 消耗配额
            if ("followup".equals(questionType)) {
                consumeQuota(factoryId, 1);
            } else if ("historical".equals(questionType)) {
                consumeQuota(factoryId, 5);
            }

            // 5. 保存结果到缓存
            AIAnalysisResult savedResult = saveAnalysisResult(
                    factoryId, request.getBatchId(), questionType, aiAnalysis, sessionId, request);

            // 6. 记录审计日志
            int quotaCost = "followup".equals(questionType) ? 1 : ("historical".equals(questionType) ? 5 : 0);
            logAuditRecord(factoryId, userId, request, questionType, true, quotaCost,
                           System.currentTimeMillis() - startTime, false, httpRequest);

            // 7. 构建响应
            return buildSuccessResponse(savedResult, factoryId, sessionId, messageCount,
                                        System.currentTimeMillis() - startTime);

        } catch (QuotaExceededException e) {
            errorMessage = e.getMessage();
            logAuditRecord(factoryId, userId, request, questionType, false, 0,
                           System.currentTimeMillis() - startTime, cacheHit, httpRequest);
            throw e;
        } catch (Exception e) {
            errorMessage = e.getMessage();
            log.error("AI分析失败: factoryId={}, batchId={}, error={}",
                     factoryId, request.getBatchId(), e.getMessage(), e);
            logAuditRecord(factoryId, userId, request, questionType, false, 0,
                           System.currentTimeMillis() - startTime, cacheHit, httpRequest);

            return MobileDTO.AICostAnalysisResponse.builder()
                    .success(false)
                    .errorMessage("AI分析失败: " + e.getMessage())
                    .build();
        }
    }

    /**
     * 生成周报告（定时任务调用）
     */
    @Transactional
    public void generateWeeklyReport(String factoryId, LocalDate weekStart, LocalDate weekEnd) {
        try {
            log.info("开始生成周报告: factoryId={}, week={} to {}",
                    factoryId, weekStart, weekEnd);

            // 1. 获取本周所有批次的成本数据
            List<Map<String, Object>> weeklyBatches = processingService.getWeeklyBatchesCost(
                    factoryId,
                    weekStart.atStartOfDay(),
                    weekEnd.atTime(23, 59, 59));

            // 2. 调用AI生成周报告
            String weeklyAnalysis = callAIForWeeklyReport(factoryId, weeklyBatches, weekStart, weekEnd);

            // 3. 保存周报告（30���有效期）
            AIAnalysisResult weeklyReport = AIAnalysisResult.builder()
                    .factoryId(factoryId)
                    .reportType("weekly")
                    .analysisText(weeklyAnalysis)
                    .periodStart(weekStart.atStartOfDay())
                    .periodEnd(weekEnd.atTime(23, 59, 59))
                    .expiresAt(LocalDateTime.now().plusDays(30))
                    .isAutoGenerated(true)
                    .build();
            analysisResultRepository.save(weeklyReport);

            log.info("周报告生成成功: factoryId={}, reportId={}", factoryId, weeklyReport.getId());

        } catch (Exception e) {
            log.error("周报告生成失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
        }
    }

    /**
     * 生成月报告（定时任务调用）
     */
    @Transactional
    public void generateMonthlyReport(String factoryId, LocalDate monthStart, LocalDate monthEnd) {
        try {
            log.info("开始生成月报告: factoryId={}, month={} to {}",
                    factoryId, monthStart, monthEnd);

            // 1. 获取本月所有批次的成本数据
            List<Map<String, Object>> monthlyBatches = processingService.getWeeklyBatchesCost(
                    factoryId,
                    monthStart.atStartOfDay(),
                    monthEnd.atTime(23, 59, 59));

            // 2. 调用AI生成月报告
            String monthlyAnalysis = callAIForMonthlyReport(factoryId, monthlyBatches, monthStart, monthEnd);

            // 3. 保存月报告（90天有效期）
            AIAnalysisResult monthlyReport = AIAnalysisResult.builder()
                    .factoryId(factoryId)
                    .reportType("monthly")
                    .analysisText(monthlyAnalysis)
                    .periodStart(monthStart.atStartOfDay())
                    .periodEnd(monthEnd.atTime(23, 59, 59))
                    .expiresAt(LocalDateTime.now().plusDays(90))
                    .isAutoGenerated(true)
                    .build();
            analysisResultRepository.save(monthlyReport);

            log.info("月报告生成成功: factoryId={}, reportId={}", factoryId, monthlyReport.getId());

        } catch (Exception e) {
            log.error("月报告生成失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
        }
    }

    /**
     * 获取工厂的AI报告列表
     */
    public MobileDTO.AIReportListResponse getReportList(String factoryId,
                                                        MobileDTO.AIReportListRequest request) {
        List<AIAnalysisResult> reports;

        if (request.getReportType() != null) {
            // 按类型查询
            reports = analysisResultRepository
                    .findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(factoryId, LocalDateTime.now())
                    .stream()
                    .filter(r -> request.getReportType().equals(r.getReportType()))
                    .collect(Collectors.toList());
        } else {
            // 查询所有有效报告
            reports = analysisResultRepository
                    .findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(factoryId, LocalDateTime.now());
        }

        // 转换为摘要格式
        List<MobileDTO.AIReportSummary> summaries = reports.stream()
                .map(this::toReportSummary)
                .collect(Collectors.toList());

        return MobileDTO.AIReportListResponse.builder()
                .reports(summaries)
                .total(summaries.size())
                .build();
    }

    /**
     * 获取工厂配额信息
     */
    public MobileDTO.AIQuotaInfo getQuotaInfo(String factoryId) {
        LocalDate weekStart = getWeekStart(LocalDate.now());
        Optional<AIQuotaUsage> quotaOpt = quotaUsageRepository.findByFactoryIdAndWeekStart(factoryId, weekStart);

        AIQuotaUsage quota = quotaOpt.orElseGet(() -> createNewQuota(factoryId, weekStart));

        LocalDate nextMonday = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY));

        return MobileDTO.AIQuotaInfo.builder()
                .total(quota.getQuotaLimit())
                .used(quota.getUsedCount())
                .remaining(quota.getRemainingQuota())
                .usageRate(quota.getUsageRate())
                .resetDate(nextMonday.atStartOfDay())
                .exceeded(quota.isExceeded())
                .build();
    }

    /**
     * 获取AI报告详情
     *
     * @param factoryId 工厂ID
     * @param reportId 报告ID
     * @return AI报告详情
     */
    public MobileDTO.AICostAnalysisResponse getReportDetail(String factoryId, Long reportId) {
        // 1. 查询报告
        AIAnalysisResult report = analysisResultRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("报告不存在: reportId=" + reportId));

        // 2. 权限验证
        if (!report.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("无权访问此报告: factoryId=" + factoryId + ", reportFactoryId=" + report.getFactoryId());
        }

        // 3. 检查是否过期
        if (report.getExpiresAt().isBefore(LocalDateTime.now())) {
            log.warn("尝试访问已过期报告: reportId={}, expiresAt={}", reportId, report.getExpiresAt());
            throw new RuntimeException("报告已过期: expiresAt=" + report.getExpiresAt());
        }

        log.info("获取AI报告详情成功: factoryId={}, reportId={}, reportType={}",
                factoryId, reportId, report.getReportType());

        // 4. 构建响应
        return buildResponseFromCache(report, factoryId);
    }

    /**
     * AI时间范围成本分析
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @param dimension 分析维度（overall/daily/weekly）
     * @param question 用户问题（可选）
     * @param httpRequest HTTP请求
     * @return AI分析结果
     */
    @Transactional
    public MobileDTO.AICostAnalysisResponse analyzeTimeRangeCost(
            String factoryId, Long userId,
            LocalDateTime startDate, LocalDateTime endDate,
            String dimension, String question,
            HttpServletRequest httpRequest) {

        long startTime = System.currentTimeMillis();

        try {
            log.info("开始时间范围成本分析: factoryId={}, userId={}, 时间段={} to {}, 维度={}",
                    factoryId, userId, startDate.toLocalDate(), endDate.toLocalDate(), dimension);

            // 1. 检查缓存（基于时间范围和维度，仅在无question时）
            if (question == null || question.trim().isEmpty()) {
                Optional<AIAnalysisResult> cachedResult = analysisResultRepository
                        .findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(factoryId, LocalDateTime.now())
                        .stream()
                        .filter(r -> "time_range".equals(r.getReportType()))
                        .filter(r -> r.getPeriodStart() != null && r.getPeriodEnd() != null)
                        .filter(r -> r.getPeriodStart().equals(startDate) && r.getPeriodEnd().equals(endDate))
                        .findFirst();

                if (cachedResult.isPresent()) {
                    log.info("时间范围分析缓存命中: factoryId={}, startDate={}, endDate={}",
                            factoryId, startDate, endDate);

                    // 记录审计日志（缓存命中不消耗配额）
                    logAuditRecord(factoryId, userId, null, "time_range", true, 0,
                            System.currentTimeMillis() - startTime, true, httpRequest);

                    return buildResponseFromCache(cachedResult.get(), factoryId);
                }
            }

            // 2. 配额检查（时间范围分析消耗2次配额）
            checkQuotaOrThrow(factoryId, "time_range");

            // 3. 获取时间范围内的批次成本数据
            List<Map<String, Object>> batchesData = processingService
                    .getTimeRangeBatchesCostAnalysis(factoryId, startDate, endDate);

            if (batchesData.isEmpty()) {
                log.warn("时间范围内无批次数据: factoryId={}, startDate={}, endDate={}",
                        factoryId, startDate, endDate);
                throw new RuntimeException("该时间范围内无生产批次数据");
            }

            // 4. 格式化为AI Prompt
            String promptMessage = formatTimeRangePrompt(batchesData, startDate, endDate, dimension, question);

            // 5. 调用AI分析
            Map<String, Object> costData = new java.util.HashMap<>();
            costData.put("timeRangeBatches", batchesData);
            costData.put("startDate", startDate);
            costData.put("endDate", endDate);
            costData.put("dimension", dimension);

            Map<String, Object> aiResult = basicAIService.analyzeCost(
                    factoryId, null, costData, null, promptMessage);

            if (aiResult == null || !Boolean.TRUE.equals(aiResult.get("success"))) {
                throw new RuntimeException("AI服务返回错误: " + (aiResult != null ? aiResult.get("error") : "unknown"));
            }

            String aiAnalysis = (String) aiResult.get("aiAnalysis");
            String sessionId = (String) aiResult.get("sessionId");

            // 6. 消耗配额（时间范围分析消耗2次）
            consumeQuota(factoryId, 2);

            // 7. 保存结果到缓存（7天有效期）
            AIAnalysisResult result = AIAnalysisResult.builder()
                    .factoryId(factoryId)
                    .reportType("time_range")
                    .analysisText(aiAnalysis)
                    .sessionId(sessionId)
                    .periodStart(startDate)
                    .periodEnd(endDate)
                    .expiresAt(LocalDateTime.now().plusDays(7))
                    .isAutoGenerated(false)
                    .build();
            analysisResultRepository.save(result);

            // 8. 记录审计日志
            logAuditRecord(factoryId, userId, null, "time_range", true, 2,
                    System.currentTimeMillis() - startTime, false, httpRequest);

            log.info("时间范围成本分析完成: factoryId={}, reportId={}, 批次数={}",
                    factoryId, result.getId(), batchesData.size());

            // 9. 构建响应
            return buildSuccessResponse(result, factoryId, sessionId, null,
                    System.currentTimeMillis() - startTime);

        } catch (QuotaExceededException e) {
            log.error("时间范围成本分析配额不足: factoryId={}, error={}", factoryId, e.getMessage());
            logAuditRecord(factoryId, userId, null, "time_range", false, 0,
                    System.currentTimeMillis() - startTime, false, httpRequest);
            throw e;
        } catch (Exception e) {
            log.error("时间范围成本分析失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            logAuditRecord(factoryId, userId, null, "time_range", false, 0,
                    System.currentTimeMillis() - startTime, false, httpRequest);

            return MobileDTO.AICostAnalysisResponse.builder()
                    .success(false)
                    .errorMessage("时间范围成本分析失败: " + e.getMessage())
                    .build();
        }
    }

    /**
     * 格式化时间范围Prompt
     */
    private String formatTimeRangePrompt(List<Map<String, Object>> batchesData,
                                        LocalDateTime startDate, LocalDateTime endDate,
                                        String dimension, String question) {
        StringBuilder sb = new StringBuilder();
        sb.append("【时间范围成本分析】\n\n");
        sb.append("时间范围: ").append(startDate.toLocalDate())
          .append(" 至 ").append(endDate.toLocalDate()).append("\n");
        sb.append("分析维度: ").append(dimension != null ? dimension : "overall").append("\n");
        sb.append("批次数量: ").append(batchesData.size()).append("\n\n");

        // 汇总统计
        java.math.BigDecimal totalCost = batchesData.stream()
                .map(b -> (java.math.BigDecimal) ((Map) b.get("costSummary")).get("totalCost"))
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        sb.append("【汇总数据】\n");
        sb.append("总成本: ¥").append(String.format("%.2f", totalCost)).append("\n");
        sb.append("平均批次成本: ¥").append(String.format("%.2f",
                totalCost.divide(java.math.BigDecimal.valueOf(batchesData.size()), 2, java.math.RoundingMode.HALF_UP))).append("\n\n");

        // 批次列表（显示前10个）
        sb.append("【批次详情】\n");
        int displayCount = Math.min(batchesData.size(), 10);
        for (int i = 0; i < displayCount; i++) {
            Map<String, Object> batch = batchesData.get(i);
            Map batchInfo = (Map) batch.get("batchInfo");
            Map costSummary = (Map) batch.get("costSummary");

            sb.append((i + 1)).append(". ")
              .append(batch.get("batchNumber")).append(" - ")
              .append(batch.get("productName")).append("\n")
              .append("   状态: ").append(batch.get("status"))
              .append(", 成本: ¥").append(costSummary.get("totalCost"))
              .append(", 良品率: ").append(batchInfo.get("yieldRate")).append("%\n");
        }

        if (batchesData.size() > 10) {
            sb.append("... 还有 ").append(batchesData.size() - 10).append(" 个批次\n");
        }

        // 用户问题
        if (question != null && !question.trim().isEmpty()) {
            sb.append("\n【用户问题】\n").append(question).append("\n");
        }

        sb.append("\n请基于以上数据，提供成本分析和优化建议。");

        return sb.toString();
    }

    /**
     * 批次对比分析
     */
    @Transactional
    public MobileDTO.AICostAnalysisResponse compareBatchCosts(
            String factoryId, Long userId, List<String> batchIds,
            String question, HttpServletRequest httpRequest) {

        long startTime = System.currentTimeMillis();

        try {
            log.info("开始批次对比分析: factoryId={}, userId={}, batchIds={}", factoryId, userId, batchIds);

            // 1. 参数校验
            if (batchIds == null || batchIds.size() < 2) {
                throw new IllegalArgumentException("至少需要2个批次进行对比分析");
            }
            if (batchIds.size() > 5) {
                throw new IllegalArgumentException("最多支持5个批次进行对比分析");
            }

            // 2. 检查缓存（仅在无question时）
            if (question == null || question.trim().isEmpty()) {
                String cacheKey = String.join(",", batchIds);
                Optional<AIAnalysisResult> cachedResult = analysisResultRepository
                        .findByFactoryIdAndExpiresAtAfterOrderByCreatedAtDesc(factoryId, LocalDateTime.now())
                        .stream()
                        .filter(r -> "comparison".equals(r.getReportType()))
                        .filter(r -> cacheKey.equals(r.getBatchId()))
                        .findFirst();

                if (cachedResult.isPresent()) {
                    log.info("命中缓存: 批次对比分析");
                    return buildResponseFromCache(cachedResult.get(), factoryId);
                }
            }

            // 3. 配额检查（对比分析消耗3次配额）
            checkQuotaOrThrow(factoryId, "comparison");

            // 4. 获取批次对比数据
            List<Map<String, Object>> batchesData = processingService
                    .getComparativeBatchesCostAnalysis(factoryId, batchIds);

            // 5. 格式化为AI Prompt（表格格式）
            String promptMessage = formatComparisonPrompt(batchesData, question);

            // 6. 构造虚拟costData用于调用AI (使用第一个批次ID作为主体)
            Map<String, Object> virtualCostData = new java.util.HashMap<>();
            virtualCostData.put("comparisonData", batchesData);
            virtualCostData.put("type", "comparison");

            // 7. 调用AI分析
            Map<String, Object> aiResult = basicAIService.analyzeCost(
                    factoryId, batchIds.get(0), virtualCostData, null, promptMessage);

            String aiAnalysis = (String) aiResult.get("aiAnalysis");
            String sessionId = (String) aiResult.get("sessionId");
            Integer messageCount = (Integer) aiResult.getOrDefault("messageCount", 1);

            // 8. 消耗配额（对比分析消耗3次）
            consumeQuota(factoryId, 3);

            // 9. 保存结果到缓存（7天有效期）
            String cacheKey = String.join(",", batchIds);
            AIAnalysisResult result = AIAnalysisResult.builder()
                    .factoryId(factoryId)
                    .batchId(cacheKey)  // 使用批次ID组合作为key
                    .reportType("comparison")
                    .analysisText(aiAnalysis)
                    .sessionId(sessionId)
                    .expiresAt(LocalDateTime.now().plusDays(7))
                    .build();
            analysisResultRepository.save(result);

            // 10. 记录审计日志
            MobileDTO.AICostAnalysisRequest dummyRequest = new MobileDTO.AICostAnalysisRequest();
            dummyRequest.setBatchId(cacheKey);
            dummyRequest.setQuestion(question);
            logAuditRecord(factoryId, userId, dummyRequest, "comparison", true, 3,
                          System.currentTimeMillis() - startTime, false, httpRequest);

            log.info("批次对比分析完成: reportId={}", result.getId());

            return MobileDTO.AICostAnalysisResponse.builder()
                    .success(true)
                    .reportId(result.getId())
                    .analysis(aiAnalysis)
                    .sessionId(sessionId)
                    .messageCount(messageCount)
                    .generatedAt(LocalDateTime.now())
                    .processingTimeMs(System.currentTimeMillis() - startTime)
                    .quotaConsumed(3)
                    .build();

        } catch (QuotaExceededException e) {
            log.warn("配额不足: factoryId={}, error={}", factoryId, e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("批次对比分析失败: factoryId={}, batchIds={}, error={}",
                    factoryId, batchIds, e.getMessage(), e);

            return MobileDTO.AICostAnalysisResponse.builder()
                    .success(false)
                    .errorMessage("批次对比分析失败: " + e.getMessage())
                    .build();
        }
    }

    /**
     * 格式化批次对比Prompt（表格格式）
     */
    private String formatComparisonPrompt(List<Map<String, Object>> batchesData, String question) {
        StringBuilder sb = new StringBuilder();

        sb.append("# 批次对比分析\n\n");
        sb.append("以下是").append(batchesData.size()).append("个批次的详细成本数据对比：\n\n");

        // 表头
        sb.append("| 指标 | ");
        for (int i = 0; i < batchesData.size(); i++) {
            Map<String, Object> batch = batchesData.get(i);
            sb.append(batch.get("batchNumber")).append(" | ");
        }
        sb.append("\n");

        // 分隔线
        sb.append("|------|");
        for (int i = 0; i < batchesData.size(); i++) {
            sb.append("------|");
        }
        sb.append("\n");

        // 数据行
        String[] metrics = {
            "产品名称:productName",
            "状态:status",
            "总成本:totalCost",
            "原材料成本:materialCost",
            "人工成本:laborCost",
            "设备成本:equipmentCost",
            "能源成本:energyCost",
            "包装成本:packagingCost",
            "单位成本:unitCost",
            "良品率:yieldRate",
            "生产效率:efficiency",
            "批次大小:batchSize"
        };

        for (String metric : metrics) {
            String[] parts = metric.split(":");
            String label = parts[0];
            String key = parts[1];

            sb.append("| ").append(label).append(" | ");
            for (Map<String, Object> batch : batchesData) {
                Object value = batch.get(key);
                sb.append(value != null ? value : "N/A").append(" | ");
            }
            sb.append("\n");
        }

        if (question != null && !question.trim().isEmpty()) {
            sb.append("\n用户问题：").append(question).append("\n");
        }

        sb.append("\n请基于以上数据，提供：\n");
        sb.append("1. 成本对比分析（哪个批次成本最优？原因是什么？）\n");
        sb.append("2. 效率对比分析（哪个批次效率最高？关键因素是什么？）\n");
        sb.append("3. 质量对比分析（良品率差异及改进建议）\n");
        sb.append("4. 综合优化建议（如何将低效批次改进到最优水平？）\n");

        return sb.toString();
    }

    // ========== 私有辅助方法 ==========

    /**
     * 判断问题类型
     */
    private String determineQuestionType(MobileDTO.AICostAnalysisRequest request) {
        if (request.getReportType() != null) {
            return request.getReportType();
        }
        if (request.getQuestion() != null && !request.getQuestion().trim().isEmpty()) {
            return "followup";
        }
        return "default";
    }

    /**
     * 检查缓存
     */
    private AIAnalysisResult checkCache(String factoryId, String batchId, String type, String question) {
        if ("default".equals(type)) {
            return analysisResultRepository
                    .findFirstByFactoryIdAndBatchIdAndReportTypeOrderByCreatedAtDesc(
                            factoryId, batchId, "batch")
                    .filter(r -> r.getExpiresAt().isAfter(LocalDateTime.now()))
                    .orElse(null);
        }
        // followup不缓存，每次都调用AI
        return null;
    }

    /**
     * 检查配额
     */
    private void checkQuotaOrThrow(String factoryId, String questionType) {
        LocalDate weekStart = getWeekStart(LocalDate.now());
        AIQuotaUsage quota = quotaUsageRepository
                .findByFactoryIdAndWeekStart(factoryId, weekStart)
                .orElseGet(() -> createNewQuota(factoryId, weekStart));

        // 不同类型消耗不同配额
        int required = 1;  // 默认1次
        if ("historical".equals(questionType)) {
            required = 5;
        } else if ("comparison".equals(questionType)) {
            required = 3;
        } else if ("time_range".equals(questionType)) {
            required = 2;
        }

        if (quota.getUsedCount() + required > quota.getQuotaLimit()) {
            throw new QuotaExceededException(
                    String.format("本周配额不足。已使用: %d/%d，需要: %d",
                            quota.getUsedCount(), quota.getQuotaLimit(), required));
        }
    }

    /**
     * 消耗配额
     */
    private void consumeQuota(String factoryId, int count) {
        LocalDate weekStart = getWeekStart(LocalDate.now());
        quotaUsageRepository.incrementUsedCount(factoryId, weekStart, count);
    }

    /**
     * 生成历史综合报告
     */
    @SuppressWarnings("unchecked")
    private String generateHistoricalReport(String factoryId, LocalDateTime startDate, LocalDateTime endDate) {
        try {
            log.info("生成历史综合报告: factoryId={}, startDate={}, endDate={}",
                     factoryId, startDate, endDate);

            // 1. 获取历史批次数据
            List<Map<String, Object>> historicalBatches = processingService.getWeeklyBatchesCost(
                    factoryId, startDate, endDate
            );

            if (historicalBatches == null || historicalBatches.isEmpty()) {
                log.warn("没有历史批次数据: factoryId={}, startDate={}, endDate={}",
                         factoryId, startDate, endDate);
                return "该时间段内暂无生产数据";
            }

            // 2. 格式化为AI Prompt
            String promptMessage = formatHistoricalReportPrompt(historicalBatches, startDate, endDate);

            // 3. 构建数据
            Map<String, Object> historicalData = new HashMap<>();
            historicalData.put("reportType", "historical");
            historicalData.put("batches", historicalBatches);
            historicalData.put("periodStart", startDate);
            historicalData.put("periodEnd", endDate);

            // 4. 调用AI分析
            Map<String, Object> aiResult = basicAIService.analyzeCost(
                    factoryId, null, historicalData, null, promptMessage
            );

            // 5. 返回AI分析
            if (aiResult != null && Boolean.TRUE.equals(aiResult.get("success"))) {
                return (String) aiResult.get("aiAnalysis");
            } else {
                log.error("历史报告AI分析失败: {}", aiResult);
                throw new RuntimeException("历史报告生成失败");
            }
        } catch (Exception e) {
            log.error("生成历史综合报告失败: {}", e.getMessage(), e);
            throw new RuntimeException("历史报告生成失败: " + e.getMessage(), e);
        }
    }

    /**
     * 调用AI生成周报告
     */
    @SuppressWarnings("unchecked")
    private String callAIForWeeklyReport(String factoryId, List<Map<String, Object>> batches,
                                        LocalDate weekStart, LocalDate weekEnd) {
        try {
            // 1. 格式化周数据为AI Prompt
            String promptMessage = formatWeeklyReportPrompt(batches, weekStart, weekEnd);

            // 2. 构建虚拟costData
            Map<String, Object> weeklyData = new HashMap<>();
            weeklyData.put("reportType", "weekly");
            weeklyData.put("batches", batches);
            weeklyData.put("periodStart", weekStart.atStartOfDay());
            weeklyData.put("periodEnd", weekEnd.atTime(23, 59, 59));

            // 3. 调用AI分析
            Map<String, Object> aiResult = basicAIService.analyzeCost(
                    factoryId,
                    null,  // 周报告没有单一batchId
                    weeklyData,
                    null,  // 新会话
                    promptMessage
            );

            // 4. 返回AI分析文本
            if (aiResult != null && Boolean.TRUE.equals(aiResult.get("success"))) {
                return (String) aiResult.get("aiAnalysis");
            } else {
                log.error("AI周报告生成失败: {}", aiResult);
                throw new RuntimeException("AI周报告生成失败");
            }
        } catch (Exception e) {
            log.error("调用AI生成周报告失败: {}", e.getMessage(), e);
            throw new RuntimeException("周报告生成失败: " + e.getMessage(), e);
        }
    }

    /**
     * 调用AI生成月报告
     */
    @SuppressWarnings("unchecked")
    private String callAIForMonthlyReport(String factoryId, List<Map<String, Object>> batches,
                                         LocalDate monthStart, LocalDate monthEnd) {
        try {
            // 1. 格式化月数据为AI Prompt
            String promptMessage = formatMonthlyReportPrompt(batches, monthStart, monthEnd);

            // 2. 构建虚拟costData
            Map<String, Object> monthlyData = new HashMap<>();
            monthlyData.put("reportType", "monthly");
            monthlyData.put("batches", batches);
            monthlyData.put("periodStart", monthStart.atStartOfDay());
            monthlyData.put("periodEnd", monthEnd.atTime(23, 59, 59));

            // 3. 调用AI分析
            Map<String, Object> aiResult = basicAIService.analyzeCost(
                    factoryId,
                    null,  // 月报告没有单一batchId
                    monthlyData,
                    null,  // 新会话
                    promptMessage
            );

            // 4. 返回AI分析文本
            if (aiResult != null && Boolean.TRUE.equals(aiResult.get("success"))) {
                return (String) aiResult.get("aiAnalysis");
            } else {
                log.error("AI月报告生成失败: {}", aiResult);
                throw new RuntimeException("AI月报告生成失败");
            }
        } catch (Exception e) {
            log.error("调用AI生成月报告失败: {}", e.getMessage(), e);
            throw new RuntimeException("月报告生成失败: " + e.getMessage(), e);
        }
    }

    /**
     * 保存分析结果
     */
    private AIAnalysisResult saveAnalysisResult(String factoryId, String batchId, String type,
                                               String analysis, String sessionId,
                                               MobileDTO.AICostAnalysisRequest request) {
        int expireDays = "batch".equals(type) ? 7 : 30;

        AIAnalysisResult result = AIAnalysisResult.builder()
                .factoryId(factoryId)
                .batchId(batchId)
                .reportType(type)
                .analysisText(analysis)
                .sessionId(sessionId)
                .expiresAt(LocalDateTime.now().plusDays(expireDays))
                .isAutoGenerated(false)
                .build();

        return analysisResultRepository.save(result);
    }

    /**
     * 记录审计日志
     */
    private void logAuditRecord(String factoryId, Long userId, MobileDTO.AICostAnalysisRequest request,
                               String questionType, boolean success, Integer quotaCost,
                               long responseTime, boolean cacheHit, HttpServletRequest httpRequest) {
        AIAuditLog log = AIAuditLog.builder()
                .factoryId(factoryId)
                .userId(userId)
                .batchId(request != null ? request.getBatchId() : null)
                .questionType(questionType)
                .question(request != null ? request.getQuestion() : null)
                .sessionId(request != null ? request.getSession_id() : null)
                .consumedQuota(quotaCost != null && quotaCost > 0)
                .quotaCost(quotaCost != null ? quotaCost : 0)
                .isSuccess(success)
                .responseTimeMs(responseTime)
                .cacheHit(cacheHit)
                .ipAddress(getClientIP(httpRequest))
                .userAgent(httpRequest != null ? httpRequest.getHeader("User-Agent") : null)
                .build();

        auditLogRepository.save(log);
    }

    /**
     * 从缓存构建响应
     */
    private MobileDTO.AICostAnalysisResponse buildResponseFromCache(AIAnalysisResult cached, String factoryId) {
        return MobileDTO.AICostAnalysisResponse.builder()
                .success(true)
                .analysis(cached.getAnalysisText())
                .sessionId(cached.getSessionId())
                .quota(getQuotaInfo(factoryId))
                .cacheHit(true)
                .processingTimeMs(0L)
                .generatedAt(cached.getCreatedAt())
                .expiresAt(cached.getExpiresAt())
                .build();
    }

    /**
     * 构建成功响应
     */
    private MobileDTO.AICostAnalysisResponse buildSuccessResponse(AIAnalysisResult result, String factoryId,
                                                                  String sessionId, Integer messageCount,
                                                                  long responseTime) {
        return MobileDTO.AICostAnalysisResponse.builder()
                .success(true)
                .analysis(result.getAnalysisText())
                .sessionId(sessionId)
                .messageCount(messageCount)
                .quota(getQuotaInfo(factoryId))
                .cacheHit(false)
                .processingTimeMs(responseTime)
                .generatedAt(result.getCreatedAt())
                .expiresAt(result.getExpiresAt())
                .build();
    }

    /**
     * 转换为报告摘要
     */
    private MobileDTO.AIReportSummary toReportSummary(AIAnalysisResult result) {
        String summary = result.getAnalysisText();
        if (summary != null && summary.length() > 200) {
            summary = summary.substring(0, 200) + "...";
        }

        return MobileDTO.AIReportSummary.builder()
                .id(result.getId())
                .batchId(result.getBatchId())
                .reportType(result.getReportType())
                .summaryText(summary)
                .periodStart(result.getPeriodStart())
                .periodEnd(result.getPeriodEnd())
                .createdAt(result.getCreatedAt())
                .expiresAt(result.getExpiresAt())
                .isAutoGenerated(result.getIsAutoGenerated())
                .build();
    }

    /**
     * 获取本周一日期
     */
    private LocalDate getWeekStart(LocalDate date) {
        return date.with(DayOfWeek.MONDAY);
    }

    /**
     * 创建新配额记录
     */
    private AIQuotaUsage createNewQuota(String factoryId, LocalDate weekStart) {
        AIQuotaUsage newQuota = AIQuotaUsage.builder()
                .factoryId(factoryId)
                .weekStart(weekStart)
                .usedCount(0)
                .quotaLimit(100)
                .build();
        return quotaUsageRepository.save(newQuota);
    }

    /**
     * 更新工厂的AI配额限制（平台管理员功能）
     *
     * @param factoryId 工厂ID
     * @param newQuotaLimit 新的配额限制
     */
    @Transactional
    public void updateQuotaLimit(String factoryId, Integer newQuotaLimit) {
        log.info("更新工厂AI配额: factoryId={}, newQuotaLimit={}", factoryId, newQuotaLimit);

        // 参数校验
        if (newQuotaLimit == null || newQuotaLimit < 0) {
            throw new IllegalArgumentException("配额限制不能为负数");
        }
        if (newQuotaLimit > 1000) {
            throw new IllegalArgumentException("配额限制不能超过1000");
        }

        // 获取当前周的配额记录
        LocalDate weekStart = getWeekStart(LocalDate.now());
        AIQuotaUsage quota = quotaUsageRepository
                .findByFactoryIdAndWeekStart(factoryId, weekStart)
                .orElseGet(() -> createNewQuota(factoryId, weekStart));

        // 更新配额限制
        int oldLimit = quota.getQuotaLimit();
        quota.setQuotaLimit(newQuotaLimit);
        quotaUsageRepository.save(quota);

        log.info("工厂AI配额已更新: factoryId={}, oldLimit={}, newLimit={}, usedCount={}",
                factoryId, oldLimit, newQuotaLimit, quota.getUsedCount());
    }

    /**
     * 获取客户端IP
     */
    private String getClientIP(HttpServletRequest request) {
        if (request == null) return null;

        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip;
    }

    /**
     * 格式化周报告Prompt
     */
    @SuppressWarnings("unchecked")
    private String formatWeeklyReportPrompt(List<Map<String, Object>> batches,
                                           LocalDate weekStart, LocalDate weekEnd) {
        StringBuilder sb = new StringBuilder();
        sb.append("【本周成本分析报告】\n\n");
        sb.append("时间范围: ").append(weekStart).append(" 至 ").append(weekEnd).append("\n");
        sb.append("批次总数: ").append(batches.size()).append("\n\n");

        if (batches.isEmpty()) {
            sb.append("本周暂无生产数据\n");
            return sb.toString();
        }

        // 汇总统计
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalQuantity = BigDecimal.ZERO;
        BigDecimal avgYieldRate = BigDecimal.ZERO;
        int completedCount = 0;

        for (Map<String, Object> batch : batches) {
            Map<String, Object> costSummary = (Map<String, Object>) batch.get("costSummary");
            if (costSummary != null) {
                Object totalCostObj = costSummary.get("totalCost");
                if (totalCostObj != null) {
                    totalCost = totalCost.add((BigDecimal) totalCostObj);
                }
            }

            Object quantityObj = batch.get("actualQuantity");
            if (quantityObj != null) {
                totalQuantity = totalQuantity.add((BigDecimal) quantityObj);
            }

            Object yieldObj = batch.get("yieldRate");
            if (yieldObj != null) {
                avgYieldRate = avgYieldRate.add((BigDecimal) yieldObj);
                completedCount++;
            }
        }

        sb.append("【汇总数据】\n");
        sb.append("总成本: ¥").append(String.format("%.2f", totalCost)).append("\n");
        sb.append("平均批次成本: ¥").append(String.format("%.2f",
                totalCost.divide(BigDecimal.valueOf(batches.size()), 2, java.math.RoundingMode.HALF_UP))).append("\n");
        sb.append("总产量: ").append(String.format("%.2f", totalQuantity)).append(" kg\n");
        if (completedCount > 0) {
            sb.append("平均良品率: ").append(String.format("%.2f",
                    avgYieldRate.divide(BigDecimal.valueOf(completedCount), 2, java.math.RoundingMode.HALF_UP)))
                    .append("%\n");
        }

        // 批次列表（显示前10个）
        sb.append("\n【批次详情】\n");
        int displayCount = Math.min(batches.size(), 10);
        for (int i = 0; i < displayCount; i++) {
            Map<String, Object> batch = batches.get(i);
            Map<String, Object> costSummary = (Map<String, Object>) batch.get("costSummary");

            sb.append((i + 1)).append(". ")
              .append(batch.get("batchNumber")).append(" - ")
              .append(batch.get("productName")).append("\n")
              .append("   状态: ").append(batch.get("status"))
              .append(", 成本: ¥").append(costSummary.get("totalCost"))
              .append(", 良品率: ").append(batch.get("yieldRate")).append("%\n");
        }

        if (batches.size() > 10) {
            sb.append("... 还有 ").append(batches.size() - 10).append(" 个批次\n");
        }

        sb.append("\n请基于以上数据，提供本周的成本分析和优化建议。");

        return sb.toString();
    }

    /**
     * 格式化月报告Prompt
     */
    @SuppressWarnings("unchecked")
    private String formatMonthlyReportPrompt(List<Map<String, Object>> batches,
                                            LocalDate monthStart, LocalDate monthEnd) {
        StringBuilder sb = new StringBuilder();
        sb.append("【本月成本分析报告】\n\n");
        sb.append("时间范围: ").append(monthStart).append(" 至 ").append(monthEnd).append("\n");
        sb.append("批次总数: ").append(batches.size()).append("\n\n");

        if (batches.isEmpty()) {
            sb.append("本月暂无生产数据\n");
            return sb.toString();
        }

        // 汇总统计（与周报告相同逻辑）
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalQuantity = BigDecimal.ZERO;
        BigDecimal avgYieldRate = BigDecimal.ZERO;
        int completedCount = 0;

        for (Map<String, Object> batch : batches) {
            Map<String, Object> costSummary = (Map<String, Object>) batch.get("costSummary");
            if (costSummary != null) {
                Object totalCostObj = costSummary.get("totalCost");
                if (totalCostObj != null) {
                    totalCost = totalCost.add((BigDecimal) totalCostObj);
                }
            }

            Object quantityObj = batch.get("actualQuantity");
            if (quantityObj != null) {
                totalQuantity = totalQuantity.add((BigDecimal) quantityObj);
            }

            Object yieldObj = batch.get("yieldRate");
            if (yieldObj != null) {
                avgYieldRate = avgYieldRate.add((BigDecimal) yieldObj);
                completedCount++;
            }
        }

        sb.append("【汇总数据】\n");
        sb.append("总成本: ¥").append(String.format("%.2f", totalCost)).append("\n");
        sb.append("平均批次成本: ¥").append(String.format("%.2f",
                totalCost.divide(BigDecimal.valueOf(batches.size()), 2, java.math.RoundingMode.HALF_UP))).append("\n");
        sb.append("总产量: ").append(String.format("%.2f", totalQuantity)).append(" kg\n");
        if (completedCount > 0) {
            sb.append("平均良品率: ").append(String.format("%.2f",
                    avgYieldRate.divide(BigDecimal.valueOf(completedCount), 2, java.math.RoundingMode.HALF_UP)))
                    .append("%\n");
        }

        // 批次列表
        sb.append("\n【批次详情】(显示前15个)\n");
        int displayCount = Math.min(batches.size(), 15);
        for (int i = 0; i < displayCount; i++) {
            Map<String, Object> batch = batches.get(i);
            Map<String, Object> costSummary = (Map<String, Object>) batch.get("costSummary");

            sb.append((i + 1)).append(". ")
              .append(batch.get("batchNumber")).append(" - ")
              .append(batch.get("productName")).append("\n")
              .append("   状态: ").append(batch.get("status"))
              .append(", 成本: ¥").append(costSummary.get("totalCost"))
              .append(", 良品率: ").append(batch.get("yieldRate")).append("%\n");
        }

        if (batches.size() > 15) {
            sb.append("... 还有 ").append(batches.size() - 15).append(" 个批次\n");
        }

        sb.append("\n请基于以上数据，提供本月的深度成本分析和战略性优化建议。");

        return sb.toString();
    }

    /**
     * 格式化历史报告Prompt
     */
    @SuppressWarnings("unchecked")
    private String formatHistoricalReportPrompt(List<Map<String, Object>> batches,
                                               LocalDateTime startDate, LocalDateTime endDate) {
        StringBuilder sb = new StringBuilder();
        sb.append("【历史综合成本分析报告】\n\n");
        sb.append("时间范围: ").append(startDate.toLocalDate())
          .append(" 至 ").append(endDate.toLocalDate()).append("\n");
        sb.append("批次总数: ").append(batches.size()).append("\n\n");

        if (batches.isEmpty()) {
            sb.append("该时间段内暂无生产数据\n");
            return sb.toString();
        }

        // 统计和趋势分析
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalQuantity = BigDecimal.ZERO;
        BigDecimal maxCost = BigDecimal.ZERO;
        BigDecimal minCost = null;
        BigDecimal avgYieldRate = BigDecimal.ZERO;
        int completedCount = 0;

        for (Map<String, Object> batch : batches) {
            Map<String, Object> costSummary = (Map<String, Object>) batch.get("costSummary");
            if (costSummary != null) {
                BigDecimal batchTotalCost = (BigDecimal) costSummary.get("totalCost");
                if (batchTotalCost != null) {
                    totalCost = totalCost.add(batchTotalCost);
                    if (batchTotalCost.compareTo(maxCost) > 0) {
                        maxCost = batchTotalCost;
                    }
                    if (minCost == null || batchTotalCost.compareTo(minCost) < 0) {
                        minCost = batchTotalCost;
                    }
                }
            }

            Object quantityObj = batch.get("actualQuantity");
            if (quantityObj != null) {
                totalQuantity = totalQuantity.add((BigDecimal) quantityObj);
            }

            Object yieldObj = batch.get("yieldRate");
            if (yieldObj != null) {
                avgYieldRate = avgYieldRate.add((BigDecimal) yieldObj);
                completedCount++;
            }
        }

        sb.append("【汇总统计】\n");
        sb.append("总批次数: ").append(batches.size()).append("\n");
        sb.append("总成本: ¥").append(String.format("%.2f", totalCost)).append("\n");
        sb.append("平均批次成本: ¥").append(String.format("%.2f",
                totalCost.divide(BigDecimal.valueOf(batches.size()), 2, java.math.RoundingMode.HALF_UP))).append("\n");
        sb.append("最高成本: ¥").append(String.format("%.2f", maxCost)).append("\n");
        if (minCost != null) {
            sb.append("最低成本: ¥").append(String.format("%.2f", minCost)).append("\n");
        }
        sb.append("总产量: ").append(String.format("%.2f", totalQuantity)).append(" kg\n");
        if (completedCount > 0) {
            sb.append("平均良品率: ").append(String.format("%.2f",
                    avgYieldRate.divide(BigDecimal.valueOf(completedCount), 2, java.math.RoundingMode.HALF_UP)))
                    .append("%\n");
        }

        sb.append("\n请基于历史数据进行深度分析，提供战略性的优化建议，包括：\n");
        sb.append("1. 成本变化趋势\n");
        sb.append("2. 主要成本驱动因素\n");
        sb.append("3. 成本优化的关键领域\n");
        sb.append("4. 长期改进计划\n");

        return sb.toString();
    }

    /**
     * 配额超额异常
     */
    public static class QuotaExceededException extends RuntimeException {
        public QuotaExceededException(String message) {
            super(message);
        }
    }
}
