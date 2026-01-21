package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.dto.conversation.ConversationMessage;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.smartbi.*;
import com.cretas.aims.dto.smartbi.ForecastResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.smartbi.*;
import com.cretas.aims.entity.smartbi.enums.ActionType;
import com.cretas.aims.entity.smartbi.enums.BillingMode;
import com.cretas.aims.entity.smartbi.enums.SmartBIIntent;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.smartbi.*;
import com.cretas.aims.service.ConversationMemoryService;
import com.cretas.aims.service.LlmIntentFallbackClient;
import com.cretas.aims.service.smartbi.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collections;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * SmartBI 核心调度服务实现
 *
 * 实现 SmartBI 系统的中央调度功能：
 * - 聚合各分析服务的数据
 * - 统一缓存管理
 * - 配额控制与计费
 * - 自然语言查询处理
 * - AI 洞察生成
 *
 * 设计要点：
 * 1. 缓存优先：减少重复计算，提升响应速度
 * 2. 配额管控：保护系统资源，控制成本
 * 3. 统一入口：门面模式，简化外部调用
 * 4. 可观测性：完整的使用记录和日志
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
public class SmartBIServiceImpl implements SmartBIService {

    // ==================== 依赖注入 ====================

    private final SalesAnalysisService salesService;
    private final DepartmentAnalysisService deptService;
    private final RegionAnalysisService regionService;
    private final FinanceAnalysisService financeService;
    private final SmartBIIntentService intentService;
    private final SmartBIPromptService promptService;
    private final RecommendationService recommendationService;

    private final SmartBiAnalysisCacheRepository cacheRepository;
    private final SmartBiUsageRecordRepository usageRepository;
    private final SmartBiBillingConfigRepository billingRepository;
    private final SmartBiQueryHistoryRepository queryHistoryRepository;

    private final ObjectMapper objectMapper;

    // ==================== 新增: AI Chat 能力集成 ====================

    /**
     * LLM Fallback 客户端 - 用于低置信度意图识别
     * 复用 AI Chat 的 LLM 意图分类能力
     */
    @Autowired(required = false)
    private LlmIntentFallbackClient llmFallbackClient;

    /**
     * 对话记忆服务 - 用于多轮对话和指代消解
     * 复用 AI Chat 的会话上下文管理能力
     */
    @Autowired(required = false)
    private ConversationMemoryService conversationMemoryService;

    /**
     * DashScope 客户端 - 用于 LLM 洞察生成
     */
    @Autowired(required = false)
    private DashScopeClient dashScopeClient;

    /**
     * 预测服务 - 用于 FORECAST 意图处理
     */
    @Autowired(required = false)
    private ForecastService forecastService;

    // ==================== 配置参数 ====================

    @Value("${smartbi.llm.enabled:true}")
    private boolean llmEnabled;

    @Value("${smartbi.llm.insight-generation:true}")
    private boolean llmInsightEnabled;

    @Value("${smartbi.llm.fallback-threshold:0.7}")
    private double llmFallbackThreshold;

    @Value("${smartbi.conversation.enabled:true}")
    private boolean conversationEnabled;

    // ==================== 构造函数 ====================

    @Autowired
    public SmartBIServiceImpl(
            SalesAnalysisService salesService,
            DepartmentAnalysisService deptService,
            RegionAnalysisService regionService,
            FinanceAnalysisService financeService,
            SmartBIIntentService intentService,
            SmartBIPromptService promptService,
            RecommendationService recommendationService,
            SmartBiAnalysisCacheRepository cacheRepository,
            SmartBiUsageRecordRepository usageRepository,
            SmartBiBillingConfigRepository billingRepository,
            SmartBiQueryHistoryRepository queryHistoryRepository,
            ObjectMapper objectMapper) {
        this.salesService = salesService;
        this.deptService = deptService;
        this.regionService = regionService;
        this.financeService = financeService;
        this.intentService = intentService;
        this.promptService = promptService;
        this.recommendationService = recommendationService;
        this.cacheRepository = cacheRepository;
        this.usageRepository = usageRepository;
        this.billingRepository = billingRepository;
        this.queryHistoryRepository = queryHistoryRepository;
        this.objectMapper = objectMapper;
    }

    // ==================== 常量定义 ====================

    /** 缓存类型：仪表盘 */
    private static final String CACHE_TYPE_DASHBOARD = "DASHBOARD";
    /** 缓存类型：销售 */
    private static final String CACHE_TYPE_SALES = "SALES";
    /** 缓存类型：部门 */
    private static final String CACHE_TYPE_DEPARTMENT = "DEPARTMENT";
    /** 缓存类型：区域 */
    private static final String CACHE_TYPE_REGION = "REGION";
    /** 缓存类型：财务 */
    private static final String CACHE_TYPE_FINANCE = "FINANCE";
    /** 缓存类型：全部 */
    private static final String CACHE_TYPE_ALL = "ALL";

    /** 默认每日配额 */
    private static final int DEFAULT_DAILY_QUOTA = 50;

    // ==================== 经营驾驶舱 ====================

    @Override
    @Transactional(readOnly = true)
    public DashboardResponse getExecutiveDashboard(String factoryId, String period) {
        log.info("获取经营驾驶舱: factoryId={}, period={}", factoryId, period);
        long startTime = System.currentTimeMillis();

        // 1. 检查缓存
        String cacheKey = buildCacheKey("dashboard", period);
        Optional<Object> cached = getFromCache(factoryId, cacheKey);
        if (cached.isPresent()) {
            log.info("命中驾驶舱缓存: factoryId={}, period={}", factoryId, period);
            recordUsage(factoryId, null, ActionType.DASHBOARD.name(), 0, true);
            return (DashboardResponse) cached.get();
        }

        // 2. 计算日期范围
        DateRange range = calculateDateRange(period);

        // 3. 获取各维度数据
        DashboardResponse salesDashboard = salesService.getSalesOverview(
                factoryId, range.getStartDate(), range.getEndDate());

        // 4. 获取部门排名
        List<RankingItem> deptRankings = deptService.getDepartmentRanking(
                factoryId, range.getStartDate(), range.getEndDate());

        // 5. 获取区域排名
        List<RankingItem> regionRankings = regionService.getRegionRanking(
                factoryId, range.getStartDate(), range.getEndDate());

        // 6. 组装响应 - 合并排名数据
        Map<String, List<RankingItem>> rankingMap = new HashMap<>();
        if (salesDashboard.getRankings() != null) {
            rankingMap.putAll(salesDashboard.getRankings());
        }
        // 添加部门和区域排名到各自的分类中
        if (deptRankings != null && !deptRankings.isEmpty()) {
            rankingMap.put("department", deptRankings);
        }
        if (regionRankings != null && !regionRankings.isEmpty()) {
            rankingMap.put("region", regionRankings);
        }

        // 合并图表数据
        Map<String, ChartConfig> chartMap = new HashMap<>();
        if (salesDashboard.getCharts() != null) {
            chartMap.putAll(salesDashboard.getCharts());
        }

        // 添加部门趋势对比图
        ChartConfig deptTrendChart = deptService.getDepartmentTrendComparison(
                factoryId, range.getStartDate(), range.getEndDate(), "WEEK");
        if (deptTrendChart != null) {
            chartMap.put("department_trend", deptTrendChart);
        }

        // 7. 生成 AI 洞察
        List<AIInsight> aiInsights = new ArrayList<>();
        if (salesDashboard.getAiInsights() != null) {
            aiInsights.addAll(salesDashboard.getAiInsights());
        }
        aiInsights.addAll(generateAIInsights(factoryId, salesDashboard));

        // 8. 组装最终响应
        DashboardResponse response = DashboardResponse.builder()
                .kpiCards(salesDashboard.getKpiCards())
                .charts(chartMap)
                .rankings(rankingMap)
                .aiInsights(aiInsights)
                .suggestions(salesDashboard.getSuggestions())
                .lastUpdated(LocalDateTime.now())
                .build();

        // 9. 保存缓存
        Duration ttl = calculateCacheTtl(period);
        saveToCache(factoryId, cacheKey, response, ttl);

        // 10. 记录使用
        long elapsed = System.currentTimeMillis() - startTime;
        log.info("驾驶舱数据生成完成: factoryId={}, period={}, elapsed={}ms", factoryId, period, elapsed);
        recordUsage(factoryId, null, ActionType.DASHBOARD.name(), 0, false);

        return response;
    }

    // ==================== 综合分析 ====================

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getComprehensiveAnalysis(String factoryId, LocalDate startDate,
                                                          LocalDate endDate, String analysisType) {
        log.info("获取综合分析: factoryId={}, type={}, startDate={}, endDate={}",
                factoryId, analysisType, startDate, endDate);

        Map<String, Object> result = new HashMap<>();

        switch (analysisType.toLowerCase()) {
            case "sales":
                result.put("overview", salesService.getSalesOverview(factoryId, startDate, endDate));
                result.put("salespersonRanking", salesService.getSalespersonRanking(factoryId, startDate, endDate));
                result.put("productRanking", salesService.getProductRanking(factoryId, startDate, endDate));
                result.put("customerRanking", salesService.getCustomerRanking(factoryId, startDate, endDate));
                result.put("trendChart", salesService.getSalesTrendChart(factoryId, startDate, endDate, "DAY"));
                break;

            case "department":
                result.put("ranking", deptService.getDepartmentRanking(factoryId, startDate, endDate));
                result.put("completionRates", deptService.getDepartmentCompletionRates(factoryId, startDate, endDate));
                result.put("efficiencyMatrix", deptService.getDepartmentEfficiencyMatrix(factoryId, startDate, endDate));
                result.put("trendComparison", deptService.getDepartmentTrendComparison(factoryId, startDate, endDate, "WEEK"));
                break;

            case "region":
                result.put("ranking", regionService.getRegionRanking(factoryId, startDate, endDate));
                result.put("targetCompletion", regionService.getRegionTargetCompletion(factoryId, startDate, endDate));
                result.put("heatmap", regionService.getGeographicHeatmapData(factoryId, startDate, endDate));
                result.put("opportunityScores", regionService.getRegionOpportunityScores(factoryId, startDate, endDate));
                break;

            case "finance":
                result.put("overview", financeService.getFinanceOverview(factoryId, startDate, endDate));
                result.put("profitMetrics", financeService.getProfitMetrics(factoryId, startDate, endDate));
                result.put("costStructure", financeService.getCostStructureChart(factoryId, startDate, endDate));
                result.put("receivableAging", financeService.getReceivableAgingChart(factoryId, endDate));
                break;

            default:
                throw new BusinessException("不支持的分析类型: " + analysisType);
        }

        result.put("dateRange", DateRange.custom(startDate, endDate));
        result.put("generatedAt", LocalDateTime.now());

        return result;
    }

    // ==================== 自然语言问答 ====================

    @Override
    @Transactional
    public NLQueryResponse processQuery(String factoryId, Long userId, NLQueryRequest request) {
        log.info("处理自然语言查询: factoryId={}, userId={}, query={}",
                factoryId, userId, request.getEffectiveQuery());
        long startTime = System.currentTimeMillis();

        // 1. 检查配额
        if (!checkQuota(factoryId)) {
            throw new BusinessException("今日查询配额已用完，请明日再试或升级套餐");
        }

        // 2. 指代消解 - 解析多轮对话中的指代词（复用 AI Chat 会话记忆能力）
        String resolvedQuery = resolveQueryReferences(request);
        if (!resolvedQuery.equals(request.getEffectiveQuery())) {
            log.info("指代消解: '{}' -> '{}'", request.getEffectiveQuery(), resolvedQuery);
        }

        // 3. 意图识别
        IntentResult intentResult = intentService.recognizeIntent(resolvedQuery);
        log.info("意图识别结果: intent={}, confidence={}", intentResult.getIntent(), intentResult.getConfidence());

        // 4. 处理低置信度情况 - LLM Fallback（复用 AI Chat LLM 能力）
        if (intentResult.isNeedsLLMFallback()) {
            log.info("触发 LLM Fallback: confidence={}, threshold={}",
                    intentResult.getConfidence(), llmFallbackThreshold);
            intentResult = tryLLMFallback(factoryId, userId, resolvedQuery, intentResult);
        }

        // 5. 根据意图执行查询
        Object data = executeIntent(factoryId, intentResult);

        // 6. 生成响应文本
        String responseText = generateResponseText(intentResult, data);

        // 7. 生成图表配置
        List<ChartConfig> charts = generateChartConfig(intentResult, data);

        // 8. 生成后续问题建议
        List<String> followUpQuestions = generateFollowUpQuestions(intentResult);

        // 9. 更新对话记忆（复用 AI Chat 会话记忆能力）
        updateConversationMemory(request.getSessionId(), request, intentResult, responseText);

        // 10. 保存查询历史
        saveQueryHistory(factoryId, userId, request, intentResult, responseText);

        // 11. 记录使用
        long elapsed = System.currentTimeMillis() - startTime;
        recordUsageWithQuery(factoryId, userId, request.getEffectiveQuery(), intentResult.getIntent().getCode(),
                0, false, (int) elapsed);

        // 12. 构建响应
        Map<String, Object> parameters = intentResult.getParameters() != null ?
                intentResult.getParameters() : new HashMap<>();
        if (intentResult.getTimeRange() != null) {
            parameters.put("timeRange", intentResult.getTimeRange());
        }

        return NLQueryResponse.builder()
                .responseText(responseText)
                .intent(intentResult.getIntent().getCode())
                .parameters(parameters)
                .charts(charts)
                .followUpQuestions(followUpQuestions)
                .build();
    }

    // ==================== AI Chat 能力集成方法 ====================

    /**
     * 解析查询中的指代词（复用 ConversationMemoryService）
     *
     * 支持的指代模式：
     * - "这批"、"那批" -> 上一轮提到的批次
     * - "这家"、"那个供应商" -> 上一轮提到的供应商
     * - "这个部门"、"那个区域" -> 上一轮提到的部门/区域
     *
     * @param request 查询请求
     * @return 消解后的查询文本
     */
    private String resolveQueryReferences(NLQueryRequest request) {
        if (!conversationEnabled || conversationMemoryService == null) {
            return request.getEffectiveQuery();
        }

        String sessionId = request.getSessionId();
        if (sessionId == null || sessionId.isEmpty()) {
            return request.getEffectiveQuery();
        }

        try {
            // 调用 AI Chat 的指代消解能力
            String resolved = conversationMemoryService.resolveReference(sessionId, request.getEffectiveQuery());
            return resolved != null ? resolved : request.getEffectiveQuery();
        } catch (Exception e) {
            log.warn("指代消解失败: sessionId={}, error={}", sessionId, e.getMessage());
            return request.getEffectiveQuery();
        }
    }

    /**
     * 尝试 LLM Fallback 意图识别（复用 LlmIntentFallbackClient）
     *
     * 当规则引擎置信度低于阈值时，调用 LLM 进行意图澄清。
     * 参考 AIIntentServiceImpl:1055 的实现。
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param query 查询文本
     * @param ruleResult 规则引擎识别结果
     * @return 最终意图识别结果
     */
    private IntentResult tryLLMFallback(String factoryId, Long userId, String query, IntentResult ruleResult) {
        if (!llmEnabled || llmFallbackClient == null) {
            log.debug("LLM Fallback 未启用或客户端未配置");
            return ruleResult;
        }

        try {
            // 将 SmartBI 意图转换为 AIIntentConfig 列表
            List<AIIntentConfig> intentConfigs = convertToIntentConfigs(SmartBIIntent.values());

            // 调用 LLM 进行意图分类（参考 AIIntentServiceImpl:1055）
            IntentMatchResult llmResult = llmFallbackClient.classifyIntent(
                    query, intentConfigs, factoryId, userId, null);

            if (llmResult != null && llmResult.hasMatch()) {
                log.info("LLM Fallback 成功: intent={}, confidence={}",
                        llmResult.getBestMatch().getIntentCode(), llmResult.getConfidence());

                // 如果 LLM 置信度更高，使用 LLM 结果
                if (llmResult.getConfidence() > ruleResult.getConfidence()) {
                    return convertToSmartBIIntentResult(llmResult, query);
                }
            }
        } catch (Exception e) {
            log.error("LLM Fallback 异常: {}", e.getMessage(), e);
        }

        return ruleResult;
    }

    /**
     * 更新对话记忆（复用 ConversationMemoryService）
     *
     * 参考 IntentExecutorServiceImpl:648 的 updateConversationMemory() 实现。
     *
     * @param sessionId 会话ID
     * @param request 查询请求
     * @param intentResult 意图识别结果
     * @param responseText 响应文本
     */
    private void updateConversationMemory(String sessionId, NLQueryRequest request,
                                          IntentResult intentResult, String responseText) {
        if (!conversationEnabled || conversationMemoryService == null) {
            return;
        }

        if (sessionId == null || sessionId.isEmpty()) {
            return;
        }

        try {
            // 记录用户消息
            conversationMemoryService.addMessage(sessionId,
                    ConversationMessage.user(request.getEffectiveQuery()));

            // 记录助手回复
            conversationMemoryService.addMessage(sessionId,
                    ConversationMessage.assistant(responseText, intentResult.getIntent().getCode()));

            // 更新最后意图
            conversationMemoryService.updateLastIntent(sessionId, intentResult.getIntent().getCode());

            log.debug("对话记忆已更新: sessionId={}, intent={}", sessionId, intentResult.getIntent().getCode());
        } catch (Exception e) {
            log.warn("更新对话记忆失败: sessionId={}, error={}", sessionId, e.getMessage());
        }
    }

    /**
     * 将 SmartBIIntent 枚举转换为 AIIntentConfig 列表
     * 用于 LLM Fallback 调用
     */
    private List<AIIntentConfig> convertToIntentConfigs(SmartBIIntent[] intents) {
        List<AIIntentConfig> configs = new ArrayList<>();
        for (SmartBIIntent intent : intents) {
            if (intent == SmartBIIntent.UNKNOWN) {
                continue;
            }
            AIIntentConfig config = AIIntentConfig.builder()
                    .intentCode(intent.getCode())
                    .intentName(intent.getName())
                    .intentCategory(intent.getCategory())
                    .build();
            configs.add(config);
        }
        return configs;
    }

    /**
     * 将 AI Chat 的 IntentMatchResult 转换为 SmartBI 的 IntentResult
     */
    private IntentResult convertToSmartBIIntentResult(IntentMatchResult matchResult, String originalQuery) {
        SmartBIIntent intent = SmartBIIntent.fromCode(matchResult.getBestMatch().getIntentCode());

        return IntentResult.builder()
                .intent(intent)
                .confidence(matchResult.getConfidence())
                .originalQuery(originalQuery)
                .needsLLMFallback(false)
                .matchMethod("LLM")
                .build();
    }

    // ==================== 数据下钻 ====================

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> processDrillDown(String factoryId, DrillDownRequest request) {
        log.info("处理数据下钻: factoryId={}, dimension={}, filterValue={}",
                factoryId, request.getDimension(), request.getFilterValue());

        Map<String, Object> result = new HashMap<>();
        LocalDate startDate = request.getStartDate();
        LocalDate endDate = request.getEndDate();

        // 使用默认日期范围
        if (startDate == null || endDate == null) {
            DateRange defaultRange = DateRange.thisMonth();
            startDate = defaultRange.getStartDate();
            endDate = defaultRange.getEndDate();
        }

        switch (request.getDimension().toLowerCase()) {
            case "region":
                result = processRegionDrillDown(factoryId, request, startDate, endDate);
                break;

            case "department":
                result = processDepartmentDrillDown(factoryId, request, startDate, endDate);
                break;

            case "product":
                result = processProductDrillDown(factoryId, request, startDate, endDate);
                break;

            case "time":
                result = processTimeDrillDown(factoryId, request, startDate, endDate);
                break;

            case "salesperson":
                result = processSalespersonDrillDown(factoryId, request, startDate, endDate);
                break;

            default:
                throw new BusinessException("不支持的下钻维度: " + request.getDimension());
        }

        result.put("drillPath", request.getDrillPath());
        result.put("level", request.getLevel());
        result.put("dimension", request.getDimension());

        // 记录使用
        recordUsage(factoryId, null, ActionType.DRILLDOWN.name(), 0, false);

        return result;
    }

    // ==================== 缓存管理 ====================

    @Override
    @Transactional
    public void invalidateCache(String factoryId, String analysisType) {
        log.info("清除缓存: factoryId={}, analysisType={}", factoryId, analysisType);

        if (CACHE_TYPE_ALL.equalsIgnoreCase(analysisType)) {
            // 清除所有缓存
            List<SmartBiAnalysisCache> caches = cacheRepository.findByFactoryIdAndAnalysisType(
                    factoryId, CACHE_TYPE_DASHBOARD);
            caches.addAll(cacheRepository.findByFactoryIdAndAnalysisType(factoryId, CACHE_TYPE_SALES));
            caches.addAll(cacheRepository.findByFactoryIdAndAnalysisType(factoryId, CACHE_TYPE_DEPARTMENT));
            caches.addAll(cacheRepository.findByFactoryIdAndAnalysisType(factoryId, CACHE_TYPE_REGION));
            caches.addAll(cacheRepository.findByFactoryIdAndAnalysisType(factoryId, CACHE_TYPE_FINANCE));
            cacheRepository.deleteAll(caches);
        } else {
            List<SmartBiAnalysisCache> caches = cacheRepository.findByFactoryIdAndAnalysisType(
                    factoryId, analysisType.toUpperCase());
            cacheRepository.deleteAll(caches);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Object> getFromCache(String factoryId, String cacheKey) {
        Optional<SmartBiAnalysisCache> cacheOpt = cacheRepository.findByFactoryIdAndCacheKey(factoryId, cacheKey);

        if (cacheOpt.isEmpty()) {
            return Optional.empty();
        }

        SmartBiAnalysisCache cache = cacheOpt.get();

        // 检查是否过期
        if (cache.isExpired()) {
            log.debug("缓存已过期: factoryId={}, cacheKey={}", factoryId, cacheKey);
            return Optional.empty();
        }

        // 反序列化缓存数据
        try {
            if (cacheKey.startsWith("dashboard:")) {
                DashboardResponse response = objectMapper.readValue(cache.getKpiData(), DashboardResponse.class);
                return Optional.of(response);
            }
            // 其他类型的缓存反序列化
            return Optional.of(cache.getKpiData());
        } catch (JsonProcessingException e) {
            log.error("缓存反序列化失败: factoryId={}, cacheKey={}", factoryId, cacheKey, e);
            return Optional.empty();
        }
    }

    @Override
    @Transactional
    public void saveToCache(String factoryId, String cacheKey, Object data, Duration ttl) {
        log.debug("保存缓存: factoryId={}, cacheKey={}, ttl={}", factoryId, cacheKey, ttl);

        try {
            String jsonData = objectMapper.writeValueAsString(data);
            String analysisType = extractAnalysisTypeFromCacheKey(cacheKey);

            // 查找或创建缓存记录
            SmartBiAnalysisCache cache = cacheRepository.findByFactoryIdAndCacheKey(factoryId, cacheKey)
                    .orElse(SmartBiAnalysisCache.builder()
                            .factoryId(factoryId)
                            .cacheKey(cacheKey)
                            .analysisType(analysisType)
                            .analysisDate(LocalDate.now())
                            .build());

            cache.setKpiData(jsonData);
            cache.setExpiresAt(LocalDateTime.now().plus(ttl));

            cacheRepository.save(cache);
        } catch (JsonProcessingException e) {
            log.error("缓存序列化失败: factoryId={}, cacheKey={}", factoryId, cacheKey, e);
        }
    }

    // ==================== 使用记录 ====================

    @Override
    @Transactional
    public void recordUsage(String factoryId, Long userId, String actionType, int tokenCount, boolean cacheHit) {
        SmartBiUsageRecord record = SmartBiUsageRecord.builder()
                .factoryId(factoryId)
                .userId(userId)
                .actionType(ActionType.valueOf(actionType))
                .tokenCount(tokenCount)
                .cacheHit(cacheHit)
                .success(true)
                .build();

        // 计算费用
        BigDecimal cost = calculateCost(factoryId, tokenCount, cacheHit);
        record.setCostAmount(cost);

        usageRepository.save(record);
    }

    /**
     * 记录查询使用（包含查询详情）
     */
    private void recordUsageWithQuery(String factoryId, Long userId, String queryText,
                                       String intentDetected, int tokenCount, boolean cacheHit,
                                       int responseTimeMs) {
        SmartBiUsageRecord record = SmartBiUsageRecord.builder()
                .factoryId(factoryId)
                .userId(userId)
                .actionType(ActionType.QUERY)
                .queryText(queryText)
                .intentDetected(intentDetected)
                .tokenCount(tokenCount)
                .cacheHit(cacheHit)
                .responseTimeMs(responseTimeMs)
                .success(true)
                .build();

        BigDecimal cost = calculateCost(factoryId, tokenCount, cacheHit);
        record.setCostAmount(cost);

        usageRepository.save(record);
    }

    // ==================== 配额检查 ====================

    @Override
    @Transactional(readOnly = true)
    public boolean checkQuota(String factoryId) {
        Optional<SmartBiBillingConfig> configOpt = billingRepository.findByFactoryId(factoryId);

        if (configOpt.isEmpty()) {
            // 使用默认配额
            Long todayUsage = usageRepository.countTodayUsage(factoryId, LocalDate.now());
            return todayUsage < DEFAULT_DAILY_QUOTA;
        }

        SmartBiBillingConfig config = configOpt.get();

        if (!config.getIsActive()) {
            return false;
        }

        if (config.isUnlimitedMode()) {
            return true;
        }

        if (config.isQuotaMode()) {
            Long todayUsage = usageRepository.countTodayUsage(factoryId, LocalDate.now());
            return todayUsage < config.getDailyQuota();
        }

        if (config.isPayAsYouGoMode()) {
            // 检查月度费用是否超限
            LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
            LocalDateTime monthEnd = LocalDateTime.now();
            BigDecimal monthCost = usageRepository.sumCostByPeriod(factoryId, monthStart, monthEnd);
            return monthCost == null || monthCost.compareTo(config.getMonthlyLimit()) < 0;
        }

        return false;
    }

    @Override
    @Transactional(readOnly = true)
    public int getRemainingQuota(String factoryId) {
        Optional<SmartBiBillingConfig> configOpt = billingRepository.findByFactoryId(factoryId);

        if (configOpt.isEmpty()) {
            Long todayUsage = usageRepository.countTodayUsage(factoryId, LocalDate.now());
            return Math.max(0, DEFAULT_DAILY_QUOTA - todayUsage.intValue());
        }

        SmartBiBillingConfig config = configOpt.get();

        if (config.isUnlimitedMode()) {
            return Integer.MAX_VALUE;
        }

        if (config.isQuotaMode()) {
            Long todayUsage = usageRepository.countTodayUsage(factoryId, LocalDate.now());
            return Math.max(0, config.getDailyQuota() - todayUsage.intValue());
        }

        // PAY_AS_YOU_GO 模式返回预估剩余查询数
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime monthEnd = LocalDateTime.now();
        BigDecimal monthCost = usageRepository.sumCostByPeriod(factoryId, monthStart, monthEnd);
        if (monthCost == null) {
            monthCost = BigDecimal.ZERO;
        }
        BigDecimal remaining = config.getMonthlyLimit().subtract(monthCost);
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        return remaining.divide(config.getPricePerQuery(), 0, BigDecimal.ROUND_DOWN).intValue();
    }

    // ==================== AI 洞察生成 ====================

    @Override
    public List<AIInsight> generateAIInsights(String factoryId, DashboardResponse dashboard) {
        List<AIInsight> insights = new ArrayList<>();

        if (dashboard == null || dashboard.getKpiCards() == null) {
            return insights;
        }

        // 1. 从推荐服务获取规则引擎洞察
        List<AIInsight> recommendationInsights = recommendationService.generateInsightSummary(dashboard);
        if (recommendationInsights != null) {
            insights.addAll(recommendationInsights);
        }

        // 2. LLM 生成洞察（复用 DashScopeClient）
        if (llmInsightEnabled && dashScopeClient != null && checkQuota(factoryId)) {
            try {
                List<AIInsight> llmInsights = generateLLMInsights(factoryId, dashboard);
                if (llmInsights != null && !llmInsights.isEmpty()) {
                    insights.addAll(llmInsights);
                    log.info("LLM 洞察生成成功: factoryId={}, count={}", factoryId, llmInsights.size());
                }
            } catch (Exception e) {
                log.warn("LLM 洞察生成失败: factoryId={}, error={}", factoryId, e.getMessage());
            }
        }

        // 3. 去重、限制返回数量，按级别排序
        return insights.stream()
                .distinct()
                .sorted(this::compareInsightLevel)
                .limit(5)
                .collect(Collectors.toList());
    }

    /**
     * 使用 LLM 生成 AI 洞察
     *
     * 调用 DashScopeClient 分析仪表盘数据，生成 3-5 条关键洞察。
     *
     * @param factoryId 工厂ID
     * @param dashboard 仪表盘数据
     * @return LLM 生成的洞察列表
     */
    private List<AIInsight> generateLLMInsights(String factoryId, DashboardResponse dashboard) {
        if (dashScopeClient == null) {
            return Collections.emptyList();
        }

        try {
            // 构建分析提示词
            String dataJson = objectMapper.writeValueAsString(dashboard.getKpiCards());
            String prompt = buildInsightPrompt(dashboard, dataJson);

            // 系统提示词
            String systemPrompt = "你是一位专业的BI分析师，请基于给定的业务数据生成3-5条关键洞察。\n" +
                    "要求：\n" +
                    "1. 每条洞察包含：level（级别）、category（分类）、message（洞察内容）、relatedEntity（相关实体）、actionSuggestion（建议）\n" +
                    "2. level取值: RED（严重警告）, YELLOW（注意）, GREEN（良好）, INFO（信息）\n" +
                    "3. 优先发现异常和风险（用RED/YELLOW标记）\n" +
                    "4. 提供可操作的行动建议\n" +
                    "5. 返回JSON数组格式：[{\"level\":\"YELLOW\",\"category\":\"销售分析\",\"message\":\"华东区销售增长放缓\",\"relatedEntity\":\"华东区\",\"actionSuggestion\":\"建议加强华东区促销力度\"}]";

            // 调用 LLM
            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .messages(List.of(
                            ChatMessage.system(systemPrompt),
                            ChatMessage.user(prompt)
                    ))
                    .temperature(0.3)
                    .maxTokens(1024)
                    .build();

            ChatCompletionResponse response = dashScopeClient.chatCompletion(request);

            if (response != null && response.getChoices() != null && !response.getChoices().isEmpty()) {
                String content = response.getChoices().get(0).getMessage().getContent();
                return parseLLMInsights(content);
            }
        } catch (Exception e) {
            log.error("LLM 洞察生成异常: {}", e.getMessage(), e);
        }

        return Collections.emptyList();
    }

    /**
     * 构建 LLM 洞察分析提示词
     */
    private String buildInsightPrompt(DashboardResponse dashboard, String kpiJson) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("请分析以下业务数据并生成洞察：\n\n");

        // KPI 数据
        prompt.append("【KPI指标】\n").append(kpiJson).append("\n\n");

        // 排名数据
        if (dashboard.getRankings() != null && !dashboard.getRankings().isEmpty()) {
            prompt.append("【排名数据】\n");
            dashboard.getRankings().forEach((key, rankings) -> {
                prompt.append(key).append(": ");
                if (rankings != null && !rankings.isEmpty()) {
                    prompt.append(rankings.stream()
                            .limit(3)
                            .map(r -> r.getName() + "(" + r.getValue() + ")")
                            .collect(Collectors.joining(", ")));
                }
                prompt.append("\n");
            });
        }

        prompt.append("\n请返回JSON数组格式的洞察列表。");
        return prompt.toString();
    }

    /**
     * 解析 LLM 返回的洞察 JSON
     */
    private List<AIInsight> parseLLMInsights(String llmResponse) {
        List<AIInsight> insights = new ArrayList<>();

        try {
            // 提取 JSON 数组（处理可能的 markdown 代码块）
            String jsonContent = llmResponse;
            if (jsonContent.contains("```json")) {
                jsonContent = jsonContent.substring(jsonContent.indexOf("```json") + 7);
                jsonContent = jsonContent.substring(0, jsonContent.indexOf("```"));
            } else if (jsonContent.contains("```")) {
                jsonContent = jsonContent.substring(jsonContent.indexOf("```") + 3);
                jsonContent = jsonContent.substring(0, jsonContent.indexOf("```"));
            }
            jsonContent = jsonContent.trim();

            // 解析 JSON 数组
            List<Map<String, Object>> insightMaps = objectMapper.readValue(
                    jsonContent, new TypeReference<List<Map<String, Object>>>() {});

            for (Map<String, Object> map : insightMaps) {
                // AIInsight 字段: level, category, message, relatedEntity, actionSuggestion
                AIInsight insight = AIInsight.builder()
                        .level((String) map.getOrDefault("level", "INFO"))
                        .category((String) map.getOrDefault("category", "LLM_INSIGHT"))
                        .message((String) map.getOrDefault("content",
                                (String) map.getOrDefault("message", "")))
                        .relatedEntity((String) map.getOrDefault("relatedEntity",
                                (String) map.getOrDefault("title", "")))
                        .actionSuggestion((String) map.getOrDefault("actionSuggestion",
                                (String) map.getOrDefault("suggestion", "")))
                        .build();
                insights.add(insight);
            }
        } catch (Exception e) {
            log.warn("解析 LLM 洞察响应失败: {}", e.getMessage());
        }

        return insights;
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 构建缓存键
     */
    private String buildCacheKey(String type, String... params) {
        return type + ":" + String.join(":", params);
    }

    /**
     * 从缓存键提取分析类型
     */
    private String extractAnalysisTypeFromCacheKey(String cacheKey) {
        if (cacheKey.startsWith("dashboard:")) {
            return CACHE_TYPE_DASHBOARD;
        } else if (cacheKey.startsWith("sales:")) {
            return CACHE_TYPE_SALES;
        } else if (cacheKey.startsWith("department:")) {
            return CACHE_TYPE_DEPARTMENT;
        } else if (cacheKey.startsWith("region:")) {
            return CACHE_TYPE_REGION;
        } else if (cacheKey.startsWith("finance:")) {
            return CACHE_TYPE_FINANCE;
        }
        return CACHE_TYPE_DASHBOARD;
    }

    /**
     * 计算日期范围
     */
    private DateRange calculateDateRange(String period) {
        switch (period.toLowerCase()) {
            case "today":
                return DateRange.today();
            case "yesterday":
                return DateRange.yesterday();
            case "week":
            case "this_week":
                return DateRange.thisWeek();
            case "last_week":
                return DateRange.lastWeek();
            case "month":
            case "this_month":
                return DateRange.thisMonth();
            case "last_month":
                return DateRange.lastMonth();
            case "quarter":
            case "this_quarter":
                return DateRange.thisQuarter();
            case "year":
            case "this_year":
                return DateRange.thisYear();
            case "last_year":
                return DateRange.lastYear();
            default:
                return DateRange.thisMonth();
        }
    }

    /**
     * 计算缓存 TTL
     */
    private Duration calculateCacheTtl(String period) {
        switch (period.toLowerCase()) {
            case "today":
                return Duration.ofMinutes(15);
            case "week":
            case "this_week":
            case "month":
            case "this_month":
                return Duration.ofHours(1);
            case "quarter":
            case "this_quarter":
            case "year":
            case "this_year":
                return Duration.ofHours(4);
            default:
                return Duration.ofHours(1);
        }
    }

    /**
     * 根据意图执行查询
     */
    private Object executeIntent(String factoryId, IntentResult intentResult) {
        DateRange range = intentResult.getTimeRange();
        if (range == null) {
            range = DateRange.thisMonth();
        }

        SmartBIIntent intent = intentResult.getIntent();
        LocalDate startDate = range.getStartDate();
        LocalDate endDate = range.getEndDate();

        switch (intent) {
            case QUERY_SALES_OVERVIEW:
                return salesService.getSalesOverview(factoryId, startDate, endDate);

            case QUERY_SALES_RANKING:
                return salesService.getSalespersonRanking(factoryId, startDate, endDate);

            case QUERY_SALES_TREND:
                return salesService.getSalesTrendChart(factoryId, startDate, endDate, "DAY");

            case QUERY_DEPARTMENT_PERFORMANCE:
                return deptService.getDepartmentRanking(factoryId, startDate, endDate);

            case QUERY_REGION_ANALYSIS:
                return regionService.getRegionRanking(factoryId, startDate, endDate);

            case QUERY_FINANCE_OVERVIEW:
                return financeService.getFinanceOverview(factoryId, startDate, endDate);

            case QUERY_PROFIT_ANALYSIS:
                return financeService.getProfitMetrics(factoryId, startDate, endDate);

            case QUERY_COST_ANALYSIS:
                return financeService.getCostStructureChart(factoryId, startDate, endDate);

            case QUERY_RECEIVABLE:
                return financeService.getReceivableMetrics(factoryId, endDate);

            case QUERY_PRODUCT_ANALYSIS:
                return salesService.getProductRanking(factoryId, startDate, endDate);

            case COMPARE_PERIOD:
                return handlePeriodComparison(factoryId, intentResult);

            case COMPARE_DEPARTMENT:
                return handleDepartmentComparison(factoryId, intentResult, startDate, endDate);

            case COMPARE_REGION:
                return handleRegionComparison(factoryId, intentResult, startDate, endDate);

            case DRILL_DOWN:
                return handleDrillDownIntent(factoryId, intentResult);

            case FORECAST:
                return handleForecastIntent(factoryId, intentResult, startDate, endDate);

            default:
                log.warn("未支持的意图类型: {}", intent);
                throw new BusinessException("暂不支持该查询类型: " + intent.getName());
        }
    }

    /**
     * 处理预测分析意图
     */
    private Object handleForecastIntent(String factoryId, IntentResult intentResult,
                                        LocalDate startDate, LocalDate endDate) {
        if (forecastService == null) {
            throw new BusinessException("预测服务未配置");
        }

        // 默认预测未来7天
        int forecastDays = 7;
        Object forecastDaysParam = intentResult.getParameters() != null ?
                intentResult.getParameters().get("forecastDays") : null;
        if (forecastDaysParam instanceof Number) {
            forecastDays = ((Number) forecastDaysParam).intValue();
        }

        // 获取预测指标类型，默认为销售额
        String metricType = intentResult.getStringParameter("metricType");
        if (metricType == null || metricType.isEmpty()) {
            metricType = "SALES";
        }

        log.info("执行预测分析: factoryId={}, metricType={}, forecastDays={}",
                factoryId, metricType, forecastDays);

        // 调用预测服务
        if ("SALES".equalsIgnoreCase(metricType)) {
            return forecastService.forecastSales(factoryId, startDate, endDate, forecastDays);
        } else {
            return forecastService.forecastMetric(factoryId, metricType, startDate, endDate, forecastDays);
        }
    }

    /**
     * 处理时期对比
     */
    private Object handlePeriodComparison(String factoryId, IntentResult intentResult) {
        // 获取当期和对比期数据
        DateRange currentRange = intentResult.getTimeRange() != null ?
                intentResult.getTimeRange() : DateRange.thisMonth();
        DateRange previousRange = DateRange.lastMonth();

        Map<String, Object> result = new HashMap<>();
        result.put("current", salesService.getSalesOverview(
                factoryId, currentRange.getStartDate(), currentRange.getEndDate()));
        result.put("previous", salesService.getSalesOverview(
                factoryId, previousRange.getStartDate(), previousRange.getEndDate()));
        result.put("currentPeriod", currentRange.getOriginalExpression());
        result.put("previousPeriod", previousRange.getOriginalExpression());

        return result;
    }

    /**
     * 处理部门对比
     */
    private Object handleDepartmentComparison(String factoryId, IntentResult intentResult,
                                               LocalDate startDate, LocalDate endDate) {
        List<String> departments = intentResult.getEntities();
        if (departments == null || departments.isEmpty()) {
            // 返回所有部门排名
            return deptService.getDepartmentRanking(factoryId, startDate, endDate);
        }
        // 返回部门详情对比
        Map<String, Object> result = new HashMap<>();
        for (String dept : departments) {
            result.put(dept, deptService.getDepartmentDetail(factoryId, dept, startDate, endDate));
        }
        return result;
    }

    /**
     * 处理区域对比
     */
    private Object handleRegionComparison(String factoryId, IntentResult intentResult,
                                           LocalDate startDate, LocalDate endDate) {
        List<String> regions = intentResult.getEntities();
        if (regions == null || regions.isEmpty()) {
            return regionService.getRegionRanking(factoryId, startDate, endDate);
        }
        Map<String, Object> result = new HashMap<>();
        for (String region : regions) {
            result.put(region, regionService.getRegionDetail(factoryId, region, startDate, endDate));
        }
        return result;
    }

    /**
     * 处理下钻意图
     */
    private Object handleDrillDownIntent(String factoryId, IntentResult intentResult) {
        String dimension = intentResult.getDimension();
        DateRange range = intentResult.getTimeRange() != null ?
                intentResult.getTimeRange() : DateRange.thisMonth();

        DrillDownRequest request = DrillDownRequest.builder()
                .dimension(dimension != null ? dimension : "region")
                .filterValue(intentResult.getEntities() != null && !intentResult.getEntities().isEmpty() ?
                        intentResult.getEntities().get(0) : null)
                .startDate(range.getStartDate())
                .endDate(range.getEndDate())
                .build();

        return processDrillDown(factoryId, request);
    }

    /**
     * 生成响应文本
     */
    private String generateResponseText(IntentResult intentResult, Object data) {
        SmartBIIntent intent = intentResult.getIntent();
        DateRange range = intentResult.getTimeRange();
        String periodDesc = range != null ? range.getOriginalExpression() : "本月";

        // 根据意图类型生成不同的响应文本
        switch (intent) {
            case QUERY_SALES_OVERVIEW:
                return String.format("以下是%s的销售概览数据：", periodDesc);

            case QUERY_SALES_RANKING:
                return String.format("以下是%s的销售员排名：", periodDesc);

            case QUERY_SALES_TREND:
                return String.format("以下是%s的销售趋势分析：", periodDesc);

            case QUERY_DEPARTMENT_PERFORMANCE:
                return String.format("以下是%s各部门的业绩表现：", periodDesc);

            case QUERY_REGION_ANALYSIS:
                return String.format("以下是%s各区域的销售分析：", periodDesc);

            case QUERY_FINANCE_OVERVIEW:
                return String.format("以下是%s的财务概览：", periodDesc);

            case QUERY_PROFIT_ANALYSIS:
                return String.format("以下是%s的利润分析：", periodDesc);

            case COMPARE_PERIOD:
                return "以下是环比/同比对比分析结果：";

            case COMPARE_DEPARTMENT:
                return "以下是部门对比分析结果：";

            case COMPARE_REGION:
                return "以下是区域对比分析结果：";

            default:
                return "以下是查询结果：";
        }
    }

    /**
     * 生成图表配置
     */
    private List<ChartConfig> generateChartConfig(IntentResult intentResult, Object data) {
        List<ChartConfig> charts = new ArrayList<>();

        // 如果数据本身包含图表，直接返回
        if (data instanceof DashboardResponse) {
            DashboardResponse dashboard = (DashboardResponse) data;
            if (dashboard.getCharts() != null) {
                return new ArrayList<>(dashboard.getCharts().values());
            }
        }

        if (data instanceof ChartConfig) {
            charts.add((ChartConfig) data);
            return charts;
        }

        // 根据意图类型生成默认图表
        SmartBIIntent intent = intentResult.getIntent();
        if (intent.isQueryIntent() && data instanceof List) {
            // 生成排名类图表
            ChartConfig barChart = ChartConfig.builder()
                    .chartType("BAR")
                    .title(intent.getName())
                    .xAxisField("name")
                    .yAxisField("value")
                    .build();
            charts.add(barChart);
        }

        return charts;
    }

    /**
     * 生成后续问题建议
     */
    private List<String> generateFollowUpQuestions(IntentResult intentResult) {
        List<String> questions = new ArrayList<>();
        SmartBIIntent intent = intentResult.getIntent();

        switch (intent) {
            case QUERY_SALES_OVERVIEW:
                questions.add("各部门的销售情况如何？");
                questions.add("哪个销售员表现最好？");
                questions.add("和上月相比增长了多少？");
                break;

            case QUERY_SALES_RANKING:
                questions.add("第一名的详细数据是什么？");
                questions.add("按部门分组看排名");
                questions.add("最近的销售趋势如何？");
                break;

            case QUERY_DEPARTMENT_PERFORMANCE:
                questions.add("哪个部门完成率最低？");
                questions.add("部门之间的对比如何？");
                questions.add("人均产出是多少？");
                break;

            case QUERY_REGION_ANALYSIS:
                questions.add("华东区域的详细数据");
                questions.add("各省份的销售排名");
                questions.add("哪个区域增长最快？");
                break;

            default:
                questions.add("查看销售概览");
                questions.add("查看部门业绩");
                questions.add("查看区域分析");
        }

        return questions.stream().limit(3).collect(Collectors.toList());
    }

    /**
     * 保存查询历史
     */
    private void saveQueryHistory(String factoryId, Long userId, NLQueryRequest request,
                                   IntentResult intentResult, String responseText) {
        try {
            SmartBiQueryHistory history = SmartBiQueryHistory.builder()
                    .factoryId(factoryId)
                    .userId(userId)
                    .sessionId(request.getSessionId())
                    .queryText(request.getEffectiveQuery())
                    .intent(intentResult.getIntent().getCode())
                    .parameters(objectMapper.writeValueAsString(intentResult.getParameters()))
                    .context(request.getContext() != null ?
                            objectMapper.writeValueAsString(request.getContext()) : null)
                    .responseText(responseText)
                    .build();

            queryHistoryRepository.save(history);
        } catch (JsonProcessingException e) {
            log.error("保存查询历史失败", e);
        }
    }

    /**
     * 计算费用
     */
    private BigDecimal calculateCost(String factoryId, int tokenCount, boolean cacheHit) {
        if (cacheHit) {
            return BigDecimal.ZERO;
        }

        Optional<SmartBiBillingConfig> configOpt = billingRepository.findByFactoryId(factoryId);
        if (configOpt.isEmpty()) {
            return BigDecimal.ZERO;
        }

        SmartBiBillingConfig config = configOpt.get();
        if (config.isUnlimitedMode()) {
            return BigDecimal.ZERO;
        }

        return config.getPricePerQuery();
    }

    /**
     * 处理区域下钻
     */
    private Map<String, Object> processRegionDrillDown(String factoryId, DrillDownRequest request,
                                                         LocalDate startDate, LocalDate endDate) {
        Map<String, Object> result = new HashMap<>();

        if (request.getFilterValue() == null || request.getFilterValue().isEmpty()) {
            // 第一层：大区
            result.put("data", regionService.getRegionRanking(factoryId, startDate, endDate));
            result.put("nextLevel", "province");
        } else if (request.getLevel() == null || request.getLevel() <= 1) {
            // 第二层：省份
            result.put("data", regionService.getProvinceRanking(
                    factoryId, request.getFilterValue(), startDate, endDate));
            result.put("nextLevel", "city");
        } else {
            // 第三层：城市
            result.put("data", regionService.getCityRanking(
                    factoryId, request.getFilterValue(), startDate, endDate));
            result.put("nextLevel", null);
        }

        return result;
    }

    /**
     * 处理部门下钻
     */
    private Map<String, Object> processDepartmentDrillDown(String factoryId, DrillDownRequest request,
                                                             LocalDate startDate, LocalDate endDate) {
        Map<String, Object> result = new HashMap<>();

        if (request.getFilterValue() == null || request.getFilterValue().isEmpty()) {
            // 第一层：部门
            result.put("data", deptService.getDepartmentRanking(factoryId, startDate, endDate));
            result.put("nextLevel", "salesperson");
        } else {
            // 第二层：部门详情（包含销售员）
            result.put("data", deptService.getDepartmentDetail(
                    factoryId, request.getFilterValue(), startDate, endDate));
            result.put("nextLevel", null);
        }

        return result;
    }

    /**
     * 处理产品下钻
     */
    private Map<String, Object> processProductDrillDown(String factoryId, DrillDownRequest request,
                                                          LocalDate startDate, LocalDate endDate) {
        Map<String, Object> result = new HashMap<>();

        // 产品排名
        result.put("data", salesService.getProductRanking(factoryId, startDate, endDate));
        result.put("chart", salesService.getProductDistributionChart(factoryId, startDate, endDate));
        result.put("nextLevel", null);

        return result;
    }

    /**
     * 处理时间下钻
     */
    private Map<String, Object> processTimeDrillDown(String factoryId, DrillDownRequest request,
                                                       LocalDate startDate, LocalDate endDate) {
        Map<String, Object> result = new HashMap<>();

        String period = "DAY";
        if (request.getLevel() != null) {
            switch (request.getLevel()) {
                case 1:
                    period = "MONTH";
                    break;
                case 2:
                    period = "WEEK";
                    break;
                default:
                    period = "DAY";
            }
        }

        result.put("data", salesService.getSalesTrendChart(factoryId, startDate, endDate, period));
        result.put("period", period);

        return result;
    }

    /**
     * 处理销售员下钻
     */
    private Map<String, Object> processSalespersonDrillDown(String factoryId, DrillDownRequest request,
                                                              LocalDate startDate, LocalDate endDate) {
        Map<String, Object> result = new HashMap<>();

        if (request.getFilterValue() == null || request.getFilterValue().isEmpty()) {
            result.put("data", salesService.getSalespersonRanking(factoryId, startDate, endDate));
        } else {
            result.put("data", salesService.getSalespersonMetrics(
                    factoryId, request.getFilterValue(), startDate, endDate));
        }

        return result;
    }

    /**
     * 比较洞察级别（用于排序）
     */
    private int compareInsightLevel(AIInsight a, AIInsight b) {
        Map<String, Integer> levelOrder = Map.of(
                "RED", 0,
                "YELLOW", 1,
                "GREEN", 2,
                "INFO", 3
        );
        int orderA = levelOrder.getOrDefault(a.getLevel(), 4);
        int orderB = levelOrder.getOrDefault(b.getLevel(), 4);
        return Integer.compare(orderA, orderB);
    }
}
