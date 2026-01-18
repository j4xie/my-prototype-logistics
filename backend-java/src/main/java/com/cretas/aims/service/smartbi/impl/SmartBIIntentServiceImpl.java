package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.DateRange;
import com.cretas.aims.dto.smartbi.IntentResult;
import com.cretas.aims.entity.smartbi.enums.SmartBIIntent;
import com.cretas.aims.service.smartbi.SmartBIIntentService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * SmartBI 意图识别服务实现
 *
 * 实现基于规则的意图识别引擎：
 * 1. 关键词匹配（快速路径）
 * 2. 正则模式匹配（复杂表达式）
 * 3. 置信度计算
 * 4. 参数提取
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
public class SmartBIIntentServiceImpl implements SmartBIIntentService {

    // ==================== 配置 ====================

    @Value("${smartbi.intent.llm-fallback-threshold:0.7}")
    private double llmFallbackThreshold;

    @Value("${smartbi.intent.patterns-file:config/smartbi/intent_patterns.json}")
    private String patternsFile;

    private final ObjectMapper objectMapper;

    // ==================== 意图模式配置 ====================

    /**
     * 意图关键词映射
     * key: SmartBIIntent
     * value: 关键词列表
     */
    private final Map<SmartBIIntent, List<String>> intentKeywords = new ConcurrentHashMap<>();

    /**
     * 意图正则模式映射
     * key: SmartBIIntent
     * value: 编译后的正则模式列表
     */
    private final Map<SmartBIIntent, List<Pattern>> intentPatterns = new ConcurrentHashMap<>();

    /**
     * 意图权重（用于置信度计算）
     */
    private final Map<SmartBIIntent, Double> intentWeights = new ConcurrentHashMap<>();

    // ==================== 时间解析模式 ====================

    private static final Map<Pattern, String> TIME_PATTERNS = new LinkedHashMap<>();

    static {
        // 相对时间
        TIME_PATTERNS.put(Pattern.compile("今天|当天|今日"), "TODAY");
        TIME_PATTERNS.put(Pattern.compile("昨天|昨日"), "YESTERDAY");
        TIME_PATTERNS.put(Pattern.compile("本周|这周|这一周"), "THIS_WEEK");
        TIME_PATTERNS.put(Pattern.compile("上周|上一周"), "LAST_WEEK");
        TIME_PATTERNS.put(Pattern.compile("本月|这个月|当月"), "THIS_MONTH");
        TIME_PATTERNS.put(Pattern.compile("上月|上个月"), "LAST_MONTH");
        TIME_PATTERNS.put(Pattern.compile("本季度|这个季度|当季"), "THIS_QUARTER");
        TIME_PATTERNS.put(Pattern.compile("上季度|上个季度"), "LAST_QUARTER");
        TIME_PATTERNS.put(Pattern.compile("今年|本年|这一年"), "THIS_YEAR");
        TIME_PATTERNS.put(Pattern.compile("去年|上一年"), "LAST_YEAR");

        // 季度
        TIME_PATTERNS.put(Pattern.compile("Q1|第一季度|一季度"), "Q1");
        TIME_PATTERNS.put(Pattern.compile("Q2|第二季度|二季度"), "Q2");
        TIME_PATTERNS.put(Pattern.compile("Q3|第三季度|三季度"), "Q3");
        TIME_PATTERNS.put(Pattern.compile("Q4|第四季度|四季度"), "Q4");

        // 最近N天
        TIME_PATTERNS.put(Pattern.compile("最近(\\d+)天|过去(\\d+)天"), "LAST_N_DAYS");
        TIME_PATTERNS.put(Pattern.compile("最近(\\d+)周|过去(\\d+)周"), "LAST_N_WEEKS");
        TIME_PATTERNS.put(Pattern.compile("最近(\\d+)个?月|过去(\\d+)个?月"), "LAST_N_MONTHS");

        // 绝对时间
        TIME_PATTERNS.put(Pattern.compile("(\\d{4})年(\\d{1,2})月(\\d{1,2})日?"), "ABSOLUTE_DATE");
        TIME_PATTERNS.put(Pattern.compile("(\\d{4})年(\\d{1,2})月"), "ABSOLUTE_MONTH");
        TIME_PATTERNS.put(Pattern.compile("(\\d{4})年"), "ABSOLUTE_YEAR");
        TIME_PATTERNS.put(Pattern.compile("(\\d{4})-(\\d{1,2})-(\\d{1,2})"), "ISO_DATE");
    }

    // ==================== 维度解析模式 ====================

    private static final Map<Pattern, String> DIMENSION_PATTERNS = new LinkedHashMap<>();

    static {
        DIMENSION_PATTERNS.put(Pattern.compile("按部门|分部门|各部门|部门维度"), "department");
        DIMENSION_PATTERNS.put(Pattern.compile("按区域|分区域|各区域|按地区|分地区|各地区|区域维度|城市"), "region");
        DIMENSION_PATTERNS.put(Pattern.compile("按产品|分产品|各产品|按商品|分品类|产品维度"), "product");
        DIMENSION_PATTERNS.put(Pattern.compile("按人员|分人员|各人员|按销售|分销售|按员工|人员维度"), "person");
        DIMENSION_PATTERNS.put(Pattern.compile("按月|分月|每月|月度|按周|分周|每周|周度|按日|分日|每日|日度"), "time");
    }

    // ==================== 实体抽取模式 ====================

    /**
     * 部门名称模式
     */
    private static final Pattern DEPARTMENT_PATTERN = Pattern.compile(
            "(销售部|市场部|研发部|财务部|人事部|运营部|客服部|技术部|产品部|行政部|" +
            "销售一部|销售二部|销售三部|市场一部|市场二部|" +
            "[一二三四五六七八九十]部|\\d+部)");

    /**
     * 区域名称模式
     */
    private static final Pattern REGION_PATTERN = Pattern.compile(
            "(华东|华南|华北|华中|西南|西北|东北|" +
            "北京|上海|广州|深圳|杭州|南京|成都|武汉|西安|重庆|" +
            "江苏|浙江|广东|山东|四川|湖北|湖南|河南|河北|安徽|" +
            "一区|二区|三区|\\d+区)");

    /**
     * 指标名称模式
     */
    private static final Pattern METRIC_PATTERN = Pattern.compile(
            "(销售额|销量|营收|收入|利润|毛利|净利|成本|费用|" +
            "同比|环比|增长率|占比|均价|客单价|转化率|回款率)");

    // ==================== 统计信息 ====================

    private final Map<SmartBIIntent, AtomicLong> intentCounts = new ConcurrentHashMap<>();
    private final AtomicLong totalRequests = new AtomicLong(0);
    private final AtomicLong llmFallbackCount = new AtomicLong(0);
    private double totalConfidence = 0.0;

    // ==================== 构造函数 ====================

    public SmartBIIntentServiceImpl(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // ==================== 初始化 ====================

    @PostConstruct
    public void init() {
        log.info("初始化 SmartBI 意图识别服务...");
        initDefaultKeywords();
        initDefaultPatterns();
        loadPatternsFromFile();
        log.info("SmartBI 意图识别服务初始化完成，支持 {} 个意图", intentKeywords.size());
    }

    /**
     * 初始化默认关键词
     */
    private void initDefaultKeywords() {
        // 销售查询类
        intentKeywords.put(SmartBIIntent.QUERY_SALES_OVERVIEW, Arrays.asList(
                "销售情况", "销售概览", "销售总览", "销售数据", "卖了多少", "营收情况",
                "销售怎么样", "销售如何", "业绩情况", "总体销售",
                // 新增：简单查询
                "销售额", "营业额", "销售收入", "总销售", "销量多少", "卖多少",
                "销售额是多少", "营业额是多少", "卖了多少钱", "收入多少",
                "业绩多少", "做了多少业绩", "今天销售", "本月销售", "这个月销售"));

        intentKeywords.put(SmartBIIntent.QUERY_SALES_RANKING, Arrays.asList(
                "销售排名", "销售TOP", "销量排名", "卖得最好", "销量第一", "前几名",
                "排行榜", "销售冠军", "最高销量", "业绩排名",
                // 新增：销售员相关
                "销售员排名", "业务员排名", "谁卖得最多", "谁业绩最好", "销售员业绩"));

        intentKeywords.put(SmartBIIntent.QUERY_SALES_TREND, Arrays.asList(
                "销售趋势", "销售走势", "销量变化", "增长趋势", "销售曲线",
                "走势图", "趋势分析", "变化趋势", "销售波动"));

        intentKeywords.put(SmartBIIntent.QUERY_DEPARTMENT_PERFORMANCE, Arrays.asList(
                "部门业绩", "部门表现", "各部门销售", "团队业绩", "部门销量",
                "哪个部门", "部门数据", "团队表现", "部门情况"));

        intentKeywords.put(SmartBIIntent.QUERY_REGION_ANALYSIS, Arrays.asList(
                "区域分析", "区域销售", "各地区销量", "地区分布", "区域数据",
                "哪个区域", "城市销售", "地区排名", "区域表现"));

        // 财务查询类
        intentKeywords.put(SmartBIIntent.QUERY_FINANCE_OVERVIEW, Arrays.asList(
                "财务概览", "财务情况", "财务报表", "收支情况", "财务数据",
                "财务怎么样", "资金情况", "财务状况"));

        intentKeywords.put(SmartBIIntent.QUERY_PROFIT_ANALYSIS, Arrays.asList(
                "利润分析", "利润率", "毛利", "净利润", "利润情况",
                "赚了多少", "盈利情况", "利润多少"));

        intentKeywords.put(SmartBIIntent.QUERY_COST_ANALYSIS, Arrays.asList(
                "成本分析", "成本构成", "费用分析", "成本占比", "成本情况",
                "花了多少", "开支情况", "费用明细"));

        intentKeywords.put(SmartBIIntent.QUERY_RECEIVABLE, Arrays.asList(
                "应收账款", "欠款", "账期", "回款情况", "应收款",
                "还有多少没收", "待收款", "账龄"));

        // 产品查询类
        intentKeywords.put(SmartBIIntent.QUERY_PRODUCT_ANALYSIS, Arrays.asList(
                "产品分析", "产品销量", "产品表现", "哪个产品", "商品分析",
                "品类分析", "产品数据", "SKU分析"));

        intentKeywords.put(SmartBIIntent.QUERY_INVENTORY, Arrays.asList(
                "库存情况", "库存量", "存货", "库存分析", "库存数据",
                "还有多少货", "库存多少", "缺货"));

        // 对比类
        intentKeywords.put(SmartBIIntent.COMPARE_PERIOD, Arrays.asList(
                "环比", "同比", "对比", "去年同期", "上个月对比",
                "比较", "增长", "下降", "变化多少"));

        intentKeywords.put(SmartBIIntent.COMPARE_DEPARTMENT, Arrays.asList(
                "部门对比", "部门比较", "哪个部门更好", "团队PK",
                "部门之间", "对比部门"));

        intentKeywords.put(SmartBIIntent.COMPARE_REGION, Arrays.asList(
                "区域对比", "地区比较", "哪个区域更好", "城市对比",
                "区域之间", "对比区域"));

        // 下钻类
        intentKeywords.put(SmartBIIntent.DRILL_DOWN, Arrays.asList(
                "详情", "明细", "下钻", "展开", "具体看看",
                "详细数据", "细节", "深入分析"));

        // 预测类
        intentKeywords.put(SmartBIIntent.FORECAST, Arrays.asList(
                "预测", "预估", "预计", "会怎样", "下个月会",
                "未来趋势", "预测分析", "预期"));

        // 汇总类
        intentKeywords.put(SmartBIIntent.AGGREGATE_SUMMARY, Arrays.asList(
                "汇总", "总计", "合计", "一共", "总共",
                "加起来", "累计", "统计"));
    }

    /**
     * 初始化默认正则模式
     */
    private void initDefaultPatterns() {
        intentPatterns.put(SmartBIIntent.QUERY_SALES_OVERVIEW, Arrays.asList(
                Pattern.compile(".*销售.*(情况|概览|总览|怎么样|如何).*"),
                Pattern.compile(".*这个?月.*卖.*多少.*"),
                Pattern.compile(".*看.*销售.*"),
                // 新增：简单查询模式
                Pattern.compile(".*(销售额|营业额|营收|收入).*是?多少.*"),
                Pattern.compile(".*(本月|这个月|今天|昨天|上月|本周).*(销售|营收|收入).*"),
                Pattern.compile(".*(卖|销售)了?(多少|几).*"),
                Pattern.compile(".*多少.*(销售额|营业额|收入).*")
        ));

        intentPatterns.put(SmartBIIntent.QUERY_SALES_RANKING, Arrays.asList(
                Pattern.compile(".*销售.*(排名|排行|TOP\\d*).*"),
                Pattern.compile(".*卖得?最(好|多).*"),
                Pattern.compile(".*谁.*销售.*最(高|好).*"),
                // 新增：销售员排名模式
                Pattern.compile(".*(销售员|业务员|人员).*(排名|排行|业绩).*"),
                Pattern.compile(".*(排名|排行).*(销售员|业务员|人员).*"),
                Pattern.compile(".*谁.*业绩.*最(好|高).*")
        ));

        intentPatterns.put(SmartBIIntent.QUERY_SALES_TREND, Arrays.asList(
                Pattern.compile(".*销售.*(趋势|走势|变化).*"),
                Pattern.compile(".*(趋势|走势).*销售.*"),
                // 新增：时间序列趋势
                Pattern.compile(".*(最近|近).*(天|周|月).*(趋势|走势|变化).*"),
                Pattern.compile(".*(日|周|月)度.*(趋势|走势|变化).*")
        ));

        intentPatterns.put(SmartBIIntent.QUERY_DEPARTMENT_PERFORMANCE, Arrays.asList(
                Pattern.compile(".*部门.*(业绩|表现|销售|数据).*"),
                Pattern.compile(".*各.*部门.*"),
                Pattern.compile(".*哪个?部门.*")
        ));

        intentPatterns.put(SmartBIIntent.QUERY_REGION_ANALYSIS, Arrays.asList(
                Pattern.compile(".*区域.*(分析|销售|数据|分布).*"),
                Pattern.compile(".*各.*区域.*"),
                Pattern.compile(".*哪个?(区域|地区|城市).*")
        ));

        intentPatterns.put(SmartBIIntent.COMPARE_PERIOD, Arrays.asList(
                Pattern.compile(".*(同比|环比).*"),
                Pattern.compile(".*和?(去年|上月|上周).*对?比.*"),
                Pattern.compile(".*比.*去年.*")
        ));

        intentPatterns.put(SmartBIIntent.DRILL_DOWN, Arrays.asList(
                Pattern.compile(".*看.*详[细情].*"),
                Pattern.compile(".*具体.*看看.*"),
                Pattern.compile(".*展开.*")
        ));

        intentPatterns.put(SmartBIIntent.FORECAST, Arrays.asList(
                Pattern.compile(".*预[测计估].*"),
                Pattern.compile(".*下个?月.*会.*"),
                Pattern.compile(".*未来.*趋势.*")
        ));
    }

    /**
     * 从配置文件加载模式
     */
    private void loadPatternsFromFile() {
        try {
            ClassPathResource resource = new ClassPathResource(patternsFile);
            if (resource.exists()) {
                try (InputStream is = resource.getInputStream()) {
                    Map<String, Map<String, Object>> patterns = objectMapper.readValue(
                            is, new TypeReference<Map<String, Map<String, Object>>>() {});

                    for (Map.Entry<String, Map<String, Object>> entry : patterns.entrySet()) {
                        SmartBIIntent intent = SmartBIIntent.fromCode(entry.getKey());
                        if (intent != SmartBIIntent.UNKNOWN) {
                            Map<String, Object> config = entry.getValue();

                            // 加载关键词
                            if (config.containsKey("keywords")) {
                                @SuppressWarnings("unchecked")
                                List<String> keywords = (List<String>) config.get("keywords");
                                // 创建新的可变列表，合并现有和新加载的关键词
                                List<String> existing = intentKeywords.get(intent);
                                List<String> merged = new ArrayList<>();
                                if (existing != null) {
                                    merged.addAll(existing);
                                }
                                merged.addAll(keywords);
                                intentKeywords.put(intent, merged);
                            }

                            // 加载正则模式
                            if (config.containsKey("patterns")) {
                                @SuppressWarnings("unchecked")
                                List<String> patternStrings = (List<String>) config.get("patterns");
                                List<Pattern> compiledPatterns = patternStrings.stream()
                                        .map(Pattern::compile)
                                        .collect(Collectors.toList());
                                // 创建新的可变列表，合并现有和新加载的模式
                                List<Pattern> existing = intentPatterns.get(intent);
                                List<Pattern> merged = new ArrayList<>();
                                if (existing != null) {
                                    merged.addAll(existing);
                                }
                                merged.addAll(compiledPatterns);
                                intentPatterns.put(intent, merged);
                            }

                            // 加载权重
                            if (config.containsKey("weight")) {
                                intentWeights.put(intent, ((Number) config.get("weight")).doubleValue());
                            }
                        }
                    }
                    log.info("从配置文件加载了 {} 个意图模式", patterns.size());
                }
            } else {
                log.warn("意图模式配置文件不存在: {}", patternsFile);
            }
        } catch (IOException e) {
            log.error("加载意图模式配置文件失败: {}", e.getMessage());
        }
    }

    // ==================== 意图识别实现 ====================

    @Override
    public IntentResult recognizeIntent(String userQuery) {
        return recognizeIntent(userQuery, null);
    }

    @Override
    public IntentResult recognizeIntent(String userQuery, Map<String, Object> context) {
        long startTime = System.currentTimeMillis();
        totalRequests.incrementAndGet();

        if (userQuery == null || userQuery.trim().isEmpty()) {
            return IntentResult.unknown("");
        }

        String normalizedQuery = normalizeQuery(userQuery);
        List<IntentResult.CandidateIntent> candidates = new ArrayList<>();

        // 1. 关键词匹配
        for (Map.Entry<SmartBIIntent, List<String>> entry : intentKeywords.entrySet()) {
            SmartBIIntent intent = entry.getKey();
            List<String> keywords = entry.getValue();

            List<String> matchedKeywords = keywords.stream()
                    .filter(normalizedQuery::contains)
                    .collect(Collectors.toList());

            if (!matchedKeywords.isEmpty()) {
                double confidence = calculateKeywordConfidence(matchedKeywords, keywords.size(), normalizedQuery);
                candidates.add(IntentResult.CandidateIntent.builder()
                        .intent(intent)
                        .confidence(confidence)
                        .matchedKeywords(matchedKeywords)
                        .build());
            }
        }

        // 2. 正则模式匹配
        for (Map.Entry<SmartBIIntent, List<Pattern>> entry : intentPatterns.entrySet()) {
            SmartBIIntent intent = entry.getKey();
            List<Pattern> patterns = entry.getValue();

            for (Pattern pattern : patterns) {
                if (pattern.matcher(normalizedQuery).matches()) {
                    // 检查是否已有该意图的候选
                    Optional<IntentResult.CandidateIntent> existing = candidates.stream()
                            .filter(c -> c.getIntent() == intent)
                            .findFirst();

                    if (existing.isPresent()) {
                        // 提升置信度
                        IntentResult.CandidateIntent candidate = existing.get();
                        candidate.setConfidence(Math.min(candidate.getConfidence() + 0.2, 1.0));
                    } else {
                        candidates.add(IntentResult.CandidateIntent.builder()
                                .intent(intent)
                                .confidence(0.75)
                                .matchedKeywords(Collections.emptyList())
                                .build());
                    }
                    break;
                }
            }
        }

        // 3. 排序候选（按置信度降序）
        candidates.sort((a, b) -> Double.compare(b.getConfidence(), a.getConfidence()));

        // 4. 构建结果
        IntentResult result;
        if (candidates.isEmpty()) {
            result = IntentResult.unknown(userQuery);
            llmFallbackCount.incrementAndGet();
        } else {
            IntentResult.CandidateIntent top = candidates.get(0);
            result = IntentResult.builder()
                    .intent(top.getIntent())
                    .confidence(top.getConfidence())
                    .originalQuery(userQuery)
                    .matchedKeywords(top.getMatchedKeywords())
                    .matchMethod(top.getMatchedKeywords().isEmpty() ? "PATTERN" : "KEYWORD")
                    .candidates(candidates)
                    .needsLLMFallback(top.getConfidence() < llmFallbackThreshold)
                    .build();

            // 更新统计
            intentCounts.computeIfAbsent(top.getIntent(), k -> new AtomicLong(0)).incrementAndGet();
            if (top.getConfidence() < llmFallbackThreshold) {
                llmFallbackCount.incrementAndGet();
            }
        }

        // 5. 提取参数
        if (result.isValid()) {
            Map<String, Object> parameters = extractParameters(userQuery, result.getIntent());
            result.setParameters(parameters);
        }

        // 6. 解析时间范围
        DateRange timeRange = parseTimeRange(userQuery);
        result.setTimeRange(timeRange);

        // 7. 解析维度
        String dimension = parseDimension(userQuery);
        result.setDimension(dimension);

        // 8. 抽取实体
        List<String> entities = parseAllEntitiesAsList(userQuery);
        result.setEntities(entities);

        // 9. 设置处理时间
        result.setProcessingTimeMs(System.currentTimeMillis() - startTime);

        // 10. 更新统计
        totalConfidence += result.getConfidence();

        log.debug("意图识别完成: query={}, intent={}, confidence={}, time={}ms",
                userQuery, result.getIntent(), result.getConfidence(), result.getProcessingTimeMs());

        return result;
    }

    @Override
    public IntentResult recognizeIntentWithSession(String userQuery, String sessionId) {
        // TODO: 实现会话上下文管理
        return recognizeIntent(userQuery);
    }

    // ==================== 参数提取实现 ====================

    @Override
    public Map<String, Object> extractParameters(String userQuery, SmartBIIntent intent) {
        Map<String, Object> params = new HashMap<>();

        if (userQuery == null || intent == null) {
            return params;
        }

        String normalizedQuery = normalizeQuery(userQuery);

        // 提取指标
        Matcher metricMatcher = METRIC_PATTERN.matcher(normalizedQuery);
        if (metricMatcher.find()) {
            params.put("metric", metricMatcher.group(1));
        }

        // 提取 TOP N
        Matcher topNMatcher = Pattern.compile("top\\s*(\\d+)|前\\s*(\\d+)").matcher(normalizedQuery);
        if (topNMatcher.find()) {
            String num = topNMatcher.group(1) != null ? topNMatcher.group(1) : topNMatcher.group(2);
            params.put("topN", Integer.parseInt(num));
        }

        // 提取排序方式
        if (normalizedQuery.contains("升序") || normalizedQuery.contains("从低到高")) {
            params.put("sortOrder", "ASC");
        } else if (normalizedQuery.contains("降序") || normalizedQuery.contains("从高到低")) {
            params.put("sortOrder", "DESC");
        }

        // 提取聚合方式
        if (normalizedQuery.contains("总计") || normalizedQuery.contains("合计") || normalizedQuery.contains("总和")) {
            params.put("aggregation", "SUM");
        } else if (normalizedQuery.contains("平均") || normalizedQuery.contains("均值")) {
            params.put("aggregation", "AVG");
        } else if (normalizedQuery.contains("最大") || normalizedQuery.contains("最高")) {
            params.put("aggregation", "MAX");
        } else if (normalizedQuery.contains("最小") || normalizedQuery.contains("最低")) {
            params.put("aggregation", "MIN");
        } else if (normalizedQuery.contains("数量") || normalizedQuery.contains("个数")) {
            params.put("aggregation", "COUNT");
        }

        // 根据意图类型添加特定参数
        switch (intent) {
            case COMPARE_PERIOD:
                if (normalizedQuery.contains("同比")) {
                    params.put("compareType", "YoY");
                } else if (normalizedQuery.contains("环比")) {
                    params.put("compareType", "MoM");
                }
                break;
            case QUERY_SALES_RANKING:
            case QUERY_DEPARTMENT_PERFORMANCE:
                if (!params.containsKey("topN")) {
                    params.put("topN", 10); // 默认 TOP 10
                }
                if (!params.containsKey("sortOrder")) {
                    params.put("sortOrder", "DESC"); // 默认降序
                }
                break;
            default:
                break;
        }

        return params;
    }

    // ==================== 时间解析实现 ====================

    @Override
    public DateRange parseTimeRange(String userQuery) {
        return parseTimeRange(userQuery, null);
    }

    @Override
    public DateRange parseTimeRange(String userQuery, DateRange defaultRange) {
        if (userQuery == null || userQuery.trim().isEmpty()) {
            return defaultRange;
        }

        String normalizedQuery = normalizeQuery(userQuery);

        for (Map.Entry<Pattern, String> entry : TIME_PATTERNS.entrySet()) {
            Matcher matcher = entry.getKey().matcher(normalizedQuery);
            if (matcher.find()) {
                String timeType = entry.getValue();
                DateRange range = parseTimeType(timeType, matcher);
                if (range != null) {
                    return range;
                }
            }
        }

        return defaultRange;
    }

    /**
     * 根据时间类型解析时间范围
     */
    private DateRange parseTimeType(String timeType, Matcher matcher) {
        LocalDate today = LocalDate.now();

        switch (timeType) {
            case "TODAY":
                return DateRange.today();
            case "YESTERDAY":
                return DateRange.yesterday();
            case "THIS_WEEK":
                return DateRange.thisWeek();
            case "LAST_WEEK":
                return DateRange.lastWeek();
            case "THIS_MONTH":
                return DateRange.thisMonth();
            case "LAST_MONTH":
                return DateRange.lastMonth();
            case "THIS_QUARTER":
                return DateRange.thisQuarter();
            case "LAST_QUARTER":
                int currentQuarter = (today.getMonthValue() - 1) / 3 + 1;
                int lastQuarter = currentQuarter == 1 ? 4 : currentQuarter - 1;
                int year = currentQuarter == 1 ? today.getYear() - 1 : today.getYear();
                return DateRange.quarter(year, lastQuarter);
            case "THIS_YEAR":
                return DateRange.thisYear();
            case "LAST_YEAR":
                return DateRange.lastYear();
            case "Q1":
                return DateRange.quarter(today.getYear(), 1);
            case "Q2":
                return DateRange.quarter(today.getYear(), 2);
            case "Q3":
                return DateRange.quarter(today.getYear(), 3);
            case "Q4":
                return DateRange.quarter(today.getYear(), 4);
            case "LAST_N_DAYS":
                String daysStr = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
                if (daysStr != null) {
                    return DateRange.lastDays(Integer.parseInt(daysStr));
                }
                break;
            case "LAST_N_WEEKS":
                String weeksStr = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
                if (weeksStr != null) {
                    return DateRange.lastDays(Integer.parseInt(weeksStr) * 7);
                }
                break;
            case "LAST_N_MONTHS":
                String monthsStr = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
                if (monthsStr != null) {
                    int months = Integer.parseInt(monthsStr);
                    LocalDate startDate = today.minusMonths(months);
                    return DateRange.custom(startDate, today);
                }
                break;
            case "ABSOLUTE_DATE":
                try {
                    int absYear = Integer.parseInt(matcher.group(1));
                    int absMonth = Integer.parseInt(matcher.group(2));
                    int absDay = Integer.parseInt(matcher.group(3));
                    LocalDate date = LocalDate.of(absYear, absMonth, absDay);
                    return DateRange.custom(date, date);
                } catch (Exception e) {
                    log.debug("解析绝对日期失败: {}", e.getMessage());
                }
                break;
            case "ABSOLUTE_MONTH":
                try {
                    int monthYear = Integer.parseInt(matcher.group(1));
                    int month = Integer.parseInt(matcher.group(2));
                    LocalDate startOfMonth = LocalDate.of(monthYear, month, 1);
                    LocalDate endOfMonth = startOfMonth.withDayOfMonth(startOfMonth.lengthOfMonth());
                    return DateRange.builder()
                            .startDate(startOfMonth)
                            .endDate(endOfMonth)
                            .granularity("MONTH")
                            .originalExpression(monthYear + "年" + month + "月")
                            .relative(false)
                            .build();
                } catch (Exception e) {
                    log.debug("解析绝对月份失败: {}", e.getMessage());
                }
                break;
            case "ABSOLUTE_YEAR":
                try {
                    int absYearOnly = Integer.parseInt(matcher.group(1));
                    return DateRange.year(absYearOnly);
                } catch (Exception e) {
                    log.debug("解析绝对年份失败: {}", e.getMessage());
                }
                break;
            case "ISO_DATE":
                try {
                    int isoYear = Integer.parseInt(matcher.group(1));
                    int isoMonth = Integer.parseInt(matcher.group(2));
                    int isoDay = Integer.parseInt(matcher.group(3));
                    LocalDate isoDate = LocalDate.of(isoYear, isoMonth, isoDay);
                    return DateRange.custom(isoDate, isoDate);
                } catch (Exception e) {
                    log.debug("解析ISO日期失败: {}", e.getMessage());
                }
                break;
            default:
                break;
        }

        return null;
    }

    // ==================== 维度解析实现 ====================

    @Override
    public String parseDimension(String userQuery) {
        if (userQuery == null || userQuery.trim().isEmpty()) {
            return null;
        }

        String normalizedQuery = normalizeQuery(userQuery);

        for (Map.Entry<Pattern, String> entry : DIMENSION_PATTERNS.entrySet()) {
            if (entry.getKey().matcher(normalizedQuery).find()) {
                return entry.getValue();
            }
        }

        return null;
    }

    @Override
    public List<String> parseAllDimensions(String userQuery) {
        if (userQuery == null || userQuery.trim().isEmpty()) {
            return Collections.emptyList();
        }

        String normalizedQuery = normalizeQuery(userQuery);
        List<String> dimensions = new ArrayList<>();

        for (Map.Entry<Pattern, String> entry : DIMENSION_PATTERNS.entrySet()) {
            if (entry.getKey().matcher(normalizedQuery).find()) {
                dimensions.add(entry.getValue());
            }
        }

        return dimensions;
    }

    // ==================== 实体抽取实现 ====================

    @Override
    public List<String> parseEntities(String userQuery, String entityType) {
        if (userQuery == null || entityType == null) {
            return Collections.emptyList();
        }

        String normalizedQuery = normalizeQuery(userQuery);
        Pattern pattern;

        switch (entityType.toLowerCase()) {
            case "department":
                pattern = DEPARTMENT_PATTERN;
                break;
            case "region":
                pattern = REGION_PATTERN;
                break;
            case "metric":
                pattern = METRIC_PATTERN;
                break;
            default:
                return Collections.emptyList();
        }

        List<String> entities = new ArrayList<>();
        Matcher matcher = pattern.matcher(normalizedQuery);
        while (matcher.find()) {
            entities.add(matcher.group(1));
        }

        return entities;
    }

    @Override
    public Map<String, List<String>> parseAllEntities(String userQuery) {
        Map<String, List<String>> result = new HashMap<>();
        result.put("department", parseEntities(userQuery, "department"));
        result.put("region", parseEntities(userQuery, "region"));
        result.put("metric", parseEntities(userQuery, "metric"));
        return result;
    }

    /**
     * 解析所有实体为列表
     */
    private List<String> parseAllEntitiesAsList(String userQuery) {
        return Stream.of("department", "region", "metric")
                .flatMap(type -> parseEntities(userQuery, type).stream())
                .distinct()
                .collect(Collectors.toList());
    }

    // ==================== LLM Fallback 判断 ====================

    @Override
    public boolean needsLLMFallback(String userQuery, double confidence) {
        return confidence < llmFallbackThreshold;
    }

    @Override
    public boolean needsLLMFallback(IntentResult intentResult) {
        if (intentResult == null) {
            return true;
        }
        // 检查置信度
        if (intentResult.getConfidence() < llmFallbackThreshold) {
            return true;
        }
        // 检查意图是否为 UNKNOWN
        if (intentResult.getIntent() == SmartBIIntent.UNKNOWN) {
            return true;
        }
        // 检查是否存在歧义（多个高置信度候选）
        if (intentResult.getCandidates() != null && intentResult.getCandidates().size() > 1) {
            List<IntentResult.CandidateIntent> highConfidenceCandidates = intentResult.getCandidates().stream()
                    .filter(c -> c.getConfidence() >= llmFallbackThreshold - 0.1)
                    .collect(Collectors.toList());
            if (highConfidenceCandidates.size() > 1) {
                double confidenceDiff = highConfidenceCandidates.get(0).getConfidence()
                        - highConfidenceCandidates.get(1).getConfidence();
                return confidenceDiff < 0.1; // 置信度差异小于 0.1 视为歧义
            }
        }
        return false;
    }

    // ==================== 配置管理实现 ====================

    @Override
    public double getLLMFallbackThreshold() {
        return llmFallbackThreshold;
    }

    @Override
    public void setLLMFallbackThreshold(double threshold) {
        if (threshold < 0.0 || threshold > 1.0) {
            throw new IllegalArgumentException("Threshold must be between 0.0 and 1.0");
        }
        this.llmFallbackThreshold = threshold;
        log.info("LLM Fallback 阈值已更新为: {}", threshold);
    }

    @Override
    public List<SmartBIIntent> getSupportedIntents() {
        return Arrays.stream(SmartBIIntent.values())
                .filter(intent -> intent != SmartBIIntent.UNKNOWN)
                .collect(Collectors.toList());
    }

    @Override
    public List<SmartBIIntent> getIntentsByCategory(String category) {
        return Arrays.stream(SmartBIIntent.values())
                .filter(intent -> category.equals(intent.getCategory()))
                .collect(Collectors.toList());
    }

    // ==================== 统计信息实现 ====================

    @Override
    public Map<String, Object> getStatistics() {
        Map<String, Object> stats = new HashMap<>();

        // 总请求数
        stats.put("totalRequests", totalRequests.get());

        // LLM Fallback 比例
        long total = totalRequests.get();
        double fallbackRate = total > 0 ? (double) llmFallbackCount.get() / total : 0.0;
        stats.put("llmFallbackRate", String.format("%.2f%%", fallbackRate * 100));

        // 平均置信度
        double avgConfidence = total > 0 ? totalConfidence / total : 0.0;
        stats.put("averageConfidence", String.format("%.3f", avgConfidence));

        // 意图分布
        Map<String, Long> distribution = new HashMap<>();
        for (Map.Entry<SmartBIIntent, AtomicLong> entry : intentCounts.entrySet()) {
            distribution.put(entry.getKey().getName(), entry.getValue().get());
        }
        stats.put("intentDistribution", distribution);

        // 支持的意图数
        stats.put("supportedIntents", getSupportedIntents().size());

        return stats;
    }

    @Override
    public void resetStatistics() {
        totalRequests.set(0);
        llmFallbackCount.set(0);
        totalConfidence = 0.0;
        intentCounts.clear();
        log.info("意图识别统计信息已重置");
    }

    @Override
    public void refreshPatterns() {
        log.info("刷新意图模式配置...");
        intentKeywords.clear();
        intentPatterns.clear();
        intentWeights.clear();
        initDefaultKeywords();
        initDefaultPatterns();
        loadPatternsFromFile();
        log.info("意图模式配置刷新完成");
    }

    // ==================== 工具方法 ====================

    /**
     * 规范化查询文本
     */
    private String normalizeQuery(String query) {
        if (query == null) {
            return "";
        }
        return query.toLowerCase()
                .replaceAll("[\\s]+", "") // 去除空白
                .replaceAll("[,，.。!！?？;；:：]", ""); // 去除标点
    }

    /**
     * 计算关键词匹配置信度
     */
    private double calculateKeywordConfidence(List<String> matchedKeywords, int totalKeywords, String query) {
        if (matchedKeywords.isEmpty()) {
            return 0.0;
        }

        // 基础分数：匹配关键词数量 / 总关键词数量
        double baseScore = Math.min((double) matchedKeywords.size() / Math.min(totalKeywords, 5), 1.0);

        // 关键词覆盖率加成
        int totalMatchLength = matchedKeywords.stream().mapToInt(String::length).sum();
        double coverageBonus = Math.min((double) totalMatchLength / query.length(), 0.3);

        // 精确匹配加成
        double exactMatchBonus = matchedKeywords.stream()
                .anyMatch(kw -> kw.length() >= 4) ? 0.1 : 0.0;

        return Math.min(baseScore + coverageBonus + exactMatchBonus, 1.0);
    }
}
