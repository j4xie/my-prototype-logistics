package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.DateRange;
import com.cretas.aims.dto.smartbi.DepartmentEntity;
import com.cretas.aims.dto.smartbi.DimensionEntity;
import com.cretas.aims.dto.smartbi.IntentResult;
import com.cretas.aims.dto.smartbi.MetricEntity;
import com.cretas.aims.dto.smartbi.RegionEntity;
import com.cretas.aims.dto.smartbi.TimeEntity;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.smartbi.enums.SmartBIIntent;
import com.cretas.aims.repository.config.AIIntentConfigRepository;
import com.cretas.aims.service.smartbi.DepartmentEntityRecognizer;
import com.cretas.aims.service.smartbi.DimensionEntityRecognizer;
import com.cretas.aims.service.smartbi.MetricEntityRecognizer;
import com.cretas.aims.service.smartbi.RegionEntityRecognizer;
import com.cretas.aims.service.smartbi.SmartBIIntentService;
import com.cretas.aims.service.smartbi.TimeEntityRecognizer;
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

    private final AIIntentConfigRepository aiIntentConfigRepository;
    private final RegionEntityRecognizer regionRecognizer;
    private final DepartmentEntityRecognizer departmentRecognizer;
    private final MetricEntityRecognizer metricRecognizer;
    private final TimeEntityRecognizer timeRecognizer;
    private final DimensionEntityRecognizer dimensionRecognizer;

    /**
     * 标记是否已从数据库加载 SmartBI 意图
     */
    private volatile boolean databaseIntentsLoaded = false;

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

    public SmartBIIntentServiceImpl(ObjectMapper objectMapper,
                                     AIIntentConfigRepository aiIntentConfigRepository,
                                     RegionEntityRecognizer regionRecognizer,
                                     DepartmentEntityRecognizer departmentRecognizer,
                                     MetricEntityRecognizer metricRecognizer,
                                     TimeEntityRecognizer timeRecognizer,
                                     DimensionEntityRecognizer dimensionRecognizer) {
        this.objectMapper = objectMapper;
        this.aiIntentConfigRepository = aiIntentConfigRepository;
        this.regionRecognizer = regionRecognizer;
        this.departmentRecognizer = departmentRecognizer;
        this.metricRecognizer = metricRecognizer;
        this.timeRecognizer = timeRecognizer;
        this.dimensionRecognizer = dimensionRecognizer;
    }

    // ==================== 初始化 ====================

    @PostConstruct
    public void init() {
        log.info("初始化 SmartBI 意图识别服务...");

        // 1. 先初始化硬编码的默认配置（作为 fallback）
        initDefaultKeywords();
        initDefaultPatterns();

        // 2. 从配置文件加载额外的模式
        loadPatternsFromFile();

        // 3. 尝试从数据库加载 SmartBI 意图配置（优先级最高）
        loadIntentsFromDatabase();

        log.info("SmartBI 意图识别服务初始化完成，支持 {} 个意图，数据库加载状态: {}",
                intentKeywords.size(), databaseIntentsLoaded ? "成功" : "使用默认配置");
    }

    /**
     * 从数据库加载 SmartBI 意图配置
     * 数据库配置优先于硬编码配置
     */
    private void loadIntentsFromDatabase() {
        try {
            List<AIIntentConfig> smartBIConfigs = aiIntentConfigRepository.findSmartBIIntents();

            if (smartBIConfigs.isEmpty()) {
                log.info("数据库中没有 SmartBI 意图配置，使用默认硬编码配置");
                return;
            }

            int loadedCount = 0;
            for (AIIntentConfig config : smartBIConfigs) {
                try {
                    SmartBIIntent intent = SmartBIIntent.fromCode(config.getIntentCode());
                    if (intent == SmartBIIntent.UNKNOWN) {
                        log.warn("未知的 SmartBI 意图代码: {}, 跳过", config.getIntentCode());
                        continue;
                    }

                    // 加载关键词（覆盖默认配置）
                    List<String> keywords = config.getKeywordsList();
                    if (!keywords.isEmpty()) {
                        intentKeywords.put(intent, new ArrayList<>(keywords));
                        log.debug("从数据库加载意图 {} 的关键词: {} 个", intent.getCode(), keywords.size());
                    }

                    // 加载正则模式
                    String regexPattern = config.getRegexPattern();
                    if (regexPattern != null && !regexPattern.isEmpty()) {
                        try {
                            Pattern pattern = Pattern.compile(regexPattern);
                            List<Pattern> patterns = intentPatterns.computeIfAbsent(intent, k -> new ArrayList<>());
                            patterns.add(0, pattern); // 数据库模式优先
                            log.debug("从数据库加载意图 {} 的正则模式", intent.getCode());
                        } catch (Exception e) {
                            log.warn("意图 {} 的正则模式编译失败: {}", intent.getCode(), e.getMessage());
                        }
                    }

                    // 加载置信度提升值
                    if (config.getConfidenceBoost() != null && config.getConfidenceBoost().doubleValue() > 0) {
                        intentWeights.put(intent, config.getConfidenceBoost().doubleValue());
                    }

                    loadedCount++;
                } catch (Exception e) {
                    log.error("处理 SmartBI 意图配置失败: intentCode={}, error={}",
                            config.getIntentCode(), e.getMessage());
                }
            }

            if (loadedCount > 0) {
                databaseIntentsLoaded = true;
                log.info("从数据库成功加载 {} 个 SmartBI 意图配置", loadedCount);
            }

        } catch (Exception e) {
            log.error("从数据库加载 SmartBI 意图配置失败: {}", e.getMessage());
            log.info("将使用默认硬编码配置");
        }
    }

    /**
     * 热重载 SmartBI 意图配置
     * 可通过 API 调用触发，无需重启服务
     */
    public void reload() {
        log.info("开始热重载 SmartBI 意图配置...");

        // 清空现有配置
        intentKeywords.clear();
        intentPatterns.clear();
        intentWeights.clear();
        databaseIntentsLoaded = false;

        // 重新加载
        initDefaultKeywords();
        initDefaultPatterns();
        loadPatternsFromFile();
        loadIntentsFromDatabase();

        log.info("SmartBI 意图配置热重载完成，当前支持 {} 个意图", intentKeywords.size());
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
                "哪个区域", "城市销售", "地区排名", "区域表现", "各区域销售", "区域业绩",
                "各省销售", "省份销售", "城市业绩", "地区业绩", "区域情况", "地区情况"));
        // 注意：具体区域名称（如华东、华南等）通过 boostIntentByEntityDetection() 动态识别

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

        // 生产查询类
        intentKeywords.put(SmartBIIntent.QUERY_OEE_OVERVIEW, Arrays.asList(
                "OEE", "oee", "设备效率", "综合效率", "产线效率", "设备综合效率",
                "OEE是多少", "今日OEE", "本月OEE", "设备效率怎么样"));

        intentKeywords.put(SmartBIIntent.QUERY_PRODUCTION_EFFICIENCY, Arrays.asList(
                "生产效率", "产能", "产量", "生产情况", "生产数据",
                "产了多少", "生产了多少", "日产量", "月产量"));

        intentKeywords.put(SmartBIIntent.QUERY_EQUIPMENT_UTILIZATION, Arrays.asList(
                "设备利用率", "设备使用", "开机率", "运行时长",
                "设备运行", "设备状态", "稼动率"));

        // 质量查询类
        intentKeywords.put(SmartBIIntent.QUERY_QUALITY_SUMMARY, Arrays.asList(
                "质量情况", "质量概览", "合格率", "质量分析", "质量数据",
                "良品率", "质量怎么样", "质量报告"));

        intentKeywords.put(SmartBIIntent.QUERY_DEFECT_ANALYSIS, Arrays.asList(
                "缺陷分析", "不良品", "缺陷率", "质量问题",
                "不合格品", "缺陷类型", "不良原因"));

        intentKeywords.put(SmartBIIntent.QUERY_REWORK_COST, Arrays.asList(
                "返工成本", "返工率", "报废", "质量损失",
                "返工情况", "报废成本", "质量成本"));

        // 库存健康类
        intentKeywords.put(SmartBIIntent.QUERY_INVENTORY_HEALTH, Arrays.asList(
                "库存健康", "库存状况", "周转率", "库存周转",
                "库存效率", "库存管理"));

        intentKeywords.put(SmartBIIntent.QUERY_EXPIRY_RISK, Arrays.asList(
                "过期风险", "即将过期", "效期预警", "保质期",
                "临期商品", "近效期", "效期管理"));

        intentKeywords.put(SmartBIIntent.QUERY_LOSS_ANALYSIS, Arrays.asList(
                "损耗分析", "库存损失", "报损", "损耗率",
                "损耗情况", "库存损耗", "损失分析"));

        // 销售深化类
        intentKeywords.put(SmartBIIntent.QUERY_SALES_FUNNEL, Arrays.asList(
                "销售漏斗", "转化率", "销售管道", "成交漏斗",
                "漏斗分析", "转化漏斗", "销售转化"));

        intentKeywords.put(SmartBIIntent.QUERY_CUSTOMER_RFM, Arrays.asList(
                "RFM", "rfm", "客户分群", "客户价值", "客户分析",
                "客户分层", "客户画像", "高价值客户"));

        intentKeywords.put(SmartBIIntent.QUERY_PRODUCT_ABC, Arrays.asList(
                "ABC分析", "abc分析", "产品分类", "产品贡献", "二八法则",
                "产品ABC", "SKU分类", "销量分类"));

        // 采购查询类
        intentKeywords.put(SmartBIIntent.QUERY_PROCUREMENT_OVERVIEW, Arrays.asList(
                "采购情况", "采购概览", "采购分析", "进货情况",
                "采购数据", "采购报表", "进货分析"));

        intentKeywords.put(SmartBIIntent.QUERY_SUPPLIER_EVALUATION, Arrays.asList(
                "供应商评估", "供应商表现", "供应商排名", "供应商分析",
                "供应商考核", "供应商评分", "供应商管理"));

        intentKeywords.put(SmartBIIntent.QUERY_PURCHASE_COST, Arrays.asList(
                "采购成本", "进货成本", "采购价格", "成本趋势",
                "采购支出", "进货价格", "采购费用"));

        // 财务深化类
        intentKeywords.put(SmartBIIntent.QUERY_CASH_FLOW, Arrays.asList(
                "现金流", "资金流向", "资金情况", "现金情况",
                "资金流", "现金流量", "资金分析"));

        intentKeywords.put(SmartBIIntent.QUERY_FINANCIAL_RATIOS, Arrays.asList(
                "财务比率", "财务指标", "ROE", "ROA", "流动比率",
                "财务健康", "财务分析", "盈利能力"));

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

        // 2.5 实体感知意图提升
        // 如果检测到区域实体 + 销售相关词，提升 REGION_ANALYSIS 意图
        boostIntentByEntityDetection(normalizedQuery, candidates);

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

        // 使用动态时间识别器
        TimeEntity firstTimeEntity = timeRecognizer.recognizeFirst(userQuery);
        if (firstTimeEntity != null) {
            DateRange range = timeRecognizer.parseToDateRange(firstTimeEntity);
            if (range != null) {
                log.debug("使用动态时间识别器解析: {} -> {}", firstTimeEntity.getText(), range);
                return range;
            }
        }

        // 回退到硬编码模式（向后兼容）
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

        // 使用动态维度识别器
        DimensionEntity primaryDimension = dimensionRecognizer.parsePrimaryDimension(userQuery);
        if (primaryDimension != null) {
            log.debug("使用动态维度识别器解析: {} -> {}", primaryDimension.getText(), primaryDimension.getDimensionType());
            return primaryDimension.getDimensionType();
        }

        // 回退到硬编码模式（向后兼容）
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

        // 使用动态维度识别器
        List<DimensionEntity> dimensionEntities = dimensionRecognizer.parseAllDimensions(userQuery);
        if (!dimensionEntities.isEmpty()) {
            return dimensionEntities.stream()
                    .map(DimensionEntity::getDimensionType)
                    .distinct()
                    .collect(Collectors.toList());
        }

        // 回退到硬编码模式
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

        // 使用动态识别器处理各类实体
        switch (entityType.toLowerCase()) {
            case "region":
                return regionRecognizer.recognize(userQuery).stream()
                        .map(RegionEntity::getNormalizedName)
                        .distinct()
                        .collect(Collectors.toList());

            case "department":
                return departmentRecognizer.recognize(userQuery).stream()
                        .map(DepartmentEntity::getNormalizedName)
                        .distinct()
                        .collect(Collectors.toList());

            case "metric":
                return metricRecognizer.recognize(userQuery).stream()
                        .map(MetricEntity::getNormalizedName)
                        .distinct()
                        .collect(Collectors.toList());

            case "time":
                return timeRecognizer.recognize(userQuery).stream()
                        .map(TimeEntity::getText)
                        .distinct()
                        .collect(Collectors.toList());

            case "dimension":
                return dimensionRecognizer.recognize(userQuery).stream()
                        .map(DimensionEntity::getText)
                        .distinct()
                        .collect(Collectors.toList());

            default:
                return Collections.emptyList();
        }
    }

    @Override
    public Map<String, List<String>> parseAllEntities(String userQuery) {
        Map<String, List<String>> result = new HashMap<>();
        result.put("department", parseEntities(userQuery, "department"));
        result.put("region", parseEntities(userQuery, "region"));
        result.put("metric", parseEntities(userQuery, "metric"));
        result.put("time", parseEntities(userQuery, "time"));
        result.put("dimension", parseEntities(userQuery, "dimension"));
        return result;
    }

    /**
     * 解析所有实体为列表
     */
    private List<String> parseAllEntitiesAsList(String userQuery) {
        return Stream.of("department", "region", "metric", "time", "dimension")
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
        databaseIntentsLoaded = false;

        initDefaultKeywords();
        initDefaultPatterns();
        loadPatternsFromFile();
        loadIntentsFromDatabase();

        log.info("意图模式配置刷新完成，数据库加载状态: {}", databaseIntentsLoaded ? "成功" : "使用默认配置");
    }

    /**
     * 检查是否已从数据库加载意图配置
     * @return true 如果已从数据库加载
     */
    public boolean isDatabaseIntentsLoaded() {
        return databaseIntentsLoaded;
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
     * 基于实体检测的意图提升
     * 当检测到特定实体组合时，提升相应意图的置信度
     *
     * 使用动态识别器（Trie树）代替硬编码的正则表达式，
     * 支持更灵活的实体表达方式识别：
     * - 地域实体：省、市、区域
     * - 部门实体：部门、团队、组
     * - 指标实体：销售额、利润等
     */
    private void boostIntentByEntityDetection(String query, List<IntentResult.CandidateIntent> candidates) {
        // 使用动态识别器检测各类实体
        List<RegionEntity> regionEntities = regionRecognizer.recognize(query);
        List<DepartmentEntity> deptEntities = departmentRecognizer.recognize(query);
        List<MetricEntity> metricEntities = metricRecognizer.recognize(query);

        boolean hasRegionEntity = !regionEntities.isEmpty();
        boolean hasDeptEntity = !deptEntities.isEmpty();
        boolean hasMetricEntity = !metricEntities.isEmpty();

        // 销售相关词汇（作为备用判断，当指标识别器未识别到时）
        boolean hasSalesKeyword = hasMetricEntity || query.contains("销售") || query.contains("业绩") ||
                query.contains("销量") || query.contains("营收") || query.contains("收入") ||
                query.contains("情况") || query.contains("怎么样") || query.contains("如何") ||
                query.contains("数据") || query.contains("分析");

        // 如果有区域实体 + 销售相关，提升 REGION_ANALYSIS
        if (hasRegionEntity && hasSalesKeyword) {
            boostRegionAnalysisIntent(candidates, regionEntities);
        }

        // 如果有部门实体 + 销售相关，提升 DEPARTMENT_PERFORMANCE
        if (hasDeptEntity && hasSalesKeyword) {
            boostDepartmentIntent(candidates, deptEntities);
        }

        // 如果识别到指标实体，记录到日志便于调试
        if (hasMetricEntity) {
            List<String> metricNames = metricEntities.stream()
                    .map(MetricEntity::getNormalizedName)
                    .collect(Collectors.toList());
            log.debug("检测到指标实体: {}", metricNames);
        }
    }

    /**
     * 提升区域分析意图置信度
     */
    private void boostRegionAnalysisIntent(List<IntentResult.CandidateIntent> candidates, List<RegionEntity> regionEntities) {
        Optional<IntentResult.CandidateIntent> regionCandidate = candidates.stream()
                .filter(c -> c.getIntent() == SmartBIIntent.QUERY_REGION_ANALYSIS)
                .findFirst();

        List<String> matchedRegionNames = regionEntities.stream()
                .map(RegionEntity::getText)
                .collect(Collectors.toList());

        if (regionCandidate.isPresent()) {
            double boost = Math.min(0.2 + regionEntities.size() * 0.1, 0.4);
            double newConfidence = Math.min(regionCandidate.get().getConfidence() + boost, 1.0);
            regionCandidate.get().setConfidence(newConfidence);
            List<String> existingKeywords = new ArrayList<>(regionCandidate.get().getMatchedKeywords());
            existingKeywords.addAll(matchedRegionNames);
            regionCandidate.get().setMatchedKeywords(existingKeywords.stream().distinct().collect(Collectors.toList()));
            log.debug("检测到区域实体 {}，提升 REGION_ANALYSIS 置信度: {}", matchedRegionNames, newConfidence);
        } else {
            candidates.add(IntentResult.CandidateIntent.builder()
                    .intent(SmartBIIntent.QUERY_REGION_ANALYSIS)
                    .confidence(0.85)
                    .matchedKeywords(matchedRegionNames)
                    .build());
            log.debug("检测到区域实体 {}，新增 REGION_ANALYSIS 候选，置信度: 0.85", matchedRegionNames);
        }
    }

    /**
     * 提升部门业绩意图置信度
     */
    private void boostDepartmentIntent(List<IntentResult.CandidateIntent> candidates, List<DepartmentEntity> deptEntities) {
        Optional<IntentResult.CandidateIntent> deptCandidate = candidates.stream()
                .filter(c -> c.getIntent() == SmartBIIntent.QUERY_DEPARTMENT_PERFORMANCE)
                .findFirst();

        List<String> matchedDeptNames = deptEntities.stream()
                .map(DepartmentEntity::getText)
                .collect(Collectors.toList());

        if (deptCandidate.isPresent()) {
            double boost = Math.min(0.2 + deptEntities.size() * 0.1, 0.4);
            double newConfidence = Math.min(deptCandidate.get().getConfidence() + boost, 1.0);
            deptCandidate.get().setConfidence(newConfidence);
            List<String> existingKeywords = new ArrayList<>(deptCandidate.get().getMatchedKeywords());
            existingKeywords.addAll(matchedDeptNames);
            deptCandidate.get().setMatchedKeywords(existingKeywords.stream().distinct().collect(Collectors.toList()));
            log.debug("检测到部门实体 {}，提升 DEPARTMENT_PERFORMANCE 置信度: {}", matchedDeptNames, newConfidence);
        } else {
            candidates.add(IntentResult.CandidateIntent.builder()
                    .intent(SmartBIIntent.QUERY_DEPARTMENT_PERFORMANCE)
                    .confidence(0.85)
                    .matchedKeywords(matchedDeptNames)
                    .build());
            log.debug("检测到部门实体 {}，新增 DEPARTMENT_PERFORMANCE 候选，置信度: 0.85", matchedDeptNames);
        }
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
