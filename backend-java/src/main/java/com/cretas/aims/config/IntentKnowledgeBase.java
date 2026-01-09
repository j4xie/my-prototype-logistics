package com.cretas.aims.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.util.*;

/**
 * 意图识别知识库配置
 * 包含停用词、动作指示词等语言学知识
 *
 * <p>配置前缀: cretas.ai.knowledge</p>
 *
 * <p>可通过配置文件覆盖默认值（使用 YAML 格式更易读）:</p>
 * <pre>
 * cretas:
 *   ai:
 *     knowledge:
 *       stop-words:
 *         - "的"
 *         - "是"
 *         - "了"
 *       query-indicators:
 *         - "查询"
 *         - "查看"
 * </pre>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Configuration
@ConfigurationProperties(prefix = "cretas.ai.knowledge")
@Data
@Slf4j
public class IntentKnowledgeBase {

    /**
     * 停用词列表 - 这些词不应作为关键词学习
     */
    private Set<String> stopWords = new HashSet<>();

    /**
     * 查询类动作指示词
     */
    private Set<String> queryIndicators = new HashSet<>();

    /**
     * 更新类动作指示词
     */
    private Set<String> updateIndicators = new HashSet<>();

    /**
     * 创建类动作指示词
     */
    private Set<String> createIndicators = new HashSet<>();

    /**
     * 删除类动作指示词
     */
    private Set<String> deleteIndicators = new HashSet<>();

    /**
     * 意图代码中的查询标识（用于判断意图类型）
     */
    private Set<String> intentQueryMarkers = new HashSet<>();

    /**
     * 意图代码中的更新标识（用于判断意图类型）
     */
    private Set<String> intentUpdateMarkers = new HashSet<>();

    /**
     * 短输入停用词（单独使用时需要确认）
     */
    private Set<String> shortInputStopWords = new HashSet<>();

    /**
     * 有意义的英文单词（用于判断输入是否有意义）
     */
    private Set<String> meaningfulEnglishWords = new HashSet<>();

    /**
     * 通用咨询问题指示词（触发LLM对话而非执行意图）
     * 例如："如何提高生产效率" 应该由LLM回答，而不是执行某个意图
     */
    private Set<String> generalQuestionIndicators = new HashSet<>();

    /**
     * 闲聊/问候指示词
     */
    private Set<String> conversationalIndicators = new HashSet<>();

    // ==================== 阶段二：短语优先匹配 ====================

    /**
     * 短语到意图的精确映射
     * 用于高优先级的短语匹配，避免复杂的关键词分析
     */
    private Map<String, String> phraseToIntentMapping = new LinkedHashMap<>();

    // ==================== 阶段三：领域优先级 ====================

    /**
     * 领域关键词映射
     * 用于检测用户输入所属的业务领域
     */
    private Map<Domain, Set<String>> domainKeywords = new EnumMap<>(Domain.class);

    /**
     * 意图代码到领域的映射缓存
     */
    private Map<String, Domain> intentToDomainCache = new HashMap<>();

    // ==================== 阶段四：意图消歧 ====================

    /**
     * 功能等价意图组
     * 同一组内的意图被认为是功能等价的
     */
    private static final Map<String, Set<String>> EQUIVALENT_INTENTS = new HashMap<>();

    static {
        // 初始化功能等价意图组
        // 库存查询相关
        Set<String> inventoryGroup = Set.of(
                "INVENTORY_QUERY", "STOCK_QUERY", "MATERIAL_INVENTORY_QUERY"
        );
        for (String intent : inventoryGroup) {
            EQUIVALENT_INTENTS.put(intent, inventoryGroup);
        }

        // 批次查询相关
        Set<String> batchGroup = Set.of(
                "BATCH_QUERY", "BATCH_LIST", "PROCESSING_BATCH_LIST"
        );
        for (String intent : batchGroup) {
            EQUIVALENT_INTENTS.put(intent, batchGroup);
        }

        // 设备状态相关
        Set<String> equipmentStatusGroup = Set.of(
                "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_OVERVIEW", "EQUIPMENT_LIST"
        );
        for (String intent : equipmentStatusGroup) {
            EQUIVALENT_INTENTS.put(intent, equipmentStatusGroup);
        }

        // 告警查询相关
        Set<String> alertGroup = Set.of(
                "ALERT_QUERY", "ALERT_LIST", "EQUIPMENT_ALERT_QUERY"
        );
        for (String intent : alertGroup) {
            EQUIVALENT_INTENTS.put(intent, alertGroup);
        }

        // 发货查询相关
        Set<String> shipmentGroup = Set.of(
                "SHIPMENT_QUERY", "SHIPMENT_LIST", "SHIPMENT_RECORD_QUERY"
        );
        for (String intent : shipmentGroup) {
            EQUIVALENT_INTENTS.put(intent, shipmentGroup);
        }

        // 质检查询相关
        Set<String> qualityGroup = Set.of(
                "QUALITY_CHECK_QUERY", "QUALITY_INSPECTION_LIST", "QC_RECORD_QUERY"
        );
        for (String intent : qualityGroup) {
            EQUIVALENT_INTENTS.put(intent, qualityGroup);
        }

        // 报表相关
        Set<String> reportGroup = Set.of(
                "REPORT_QUERY", "DAILY_REPORT", "PRODUCTION_REPORT", "REPORT_GENERATE"
        );
        for (String intent : reportGroup) {
            EQUIVALENT_INTENTS.put(intent, reportGroup);
        }
    }

    /**
     * 初始化默认值
     */
    @PostConstruct
    public void initDefaults() {
        // 初始化停用词
        if (stopWords.isEmpty()) {
            stopWords.addAll(Set.of(
                    // 常用助词、介词
                    "的", "是", "了", "把", "我", "要", "你", "他", "她", "它",
                    "这", "那", "有", "没", "不", "在", "和", "与", "或", "但",
                    "给", "让", "被", "对", "从", "到", "为", "以", "等", "也",
                    "就", "都", "还", "很", "太", "好", "请", "帮", "帮我", "一下",
                    "看看", "查", "查一下", "查看", "能", "可以", "吗", "呢", "啊", "吧",
                    // 礼貌用语
                    "麻烦", "谢谢", "感谢",
                    // 疑问词（单独使用时无意义）
                    "怎么", "什么", "哪", "哪个", "多少", "为什么", "如何", "几"
            ));
        }

        // 初始化查询指示词
        if (queryIndicators.isEmpty()) {
            queryIndicators.addAll(Set.of(
                    "查询", "查看", "多少", "还剩", "有几", "列表", "统计", "查",
                    "显示", "获取", "看看", "有多少", "剩多少", "剩余", "库存",
                    "情况", "状态", "有什么", "有哪些", "是多少", "数量",
                    "搜索", "找", "查找", "了解", "汇总"
            ));
        }

        // 初始化更新指示词（包含状态控制类动作）
        if (updateIndicators.isEmpty()) {
            updateIndicators.addAll(Set.of(
                    // 常规更新操作
                    "修改", "更新", "改成", "改为", "设置", "调整", "编辑", "变更", "改",
                    "把", "设成", "设为", "更改", "修订", "调为", "换成",
                    // 状态控制操作 - 生产/设备控制
                    "停", "停止", "暂停", "中断", "启动", "开始", "恢复", "继续",
                    "完成", "结束", "开工", "收工", "关闭", "打开", "开启"
            ));
        }

        // 初始化创建指示词
        if (createIndicators.isEmpty()) {
            createIndicators.addAll(Set.of(
                    "创建", "新建", "添加", "新增", "录入", "登记", "建立", "生成"
            ));
        }

        // 初始化删除指示词
        if (deleteIndicators.isEmpty()) {
            deleteIndicators.addAll(Set.of(
                    "删除", "移除", "清除", "取消", "作废", "去掉"
            ));
        }

        // 初始化意图代码查询标记
        if (intentQueryMarkers.isEmpty()) {
            intentQueryMarkers.addAll(Set.of(
                    "QUERY", "LIST", "STATS", "GET", "SEARCH", "VIEW", "STATUS", "OVERVIEW"
            ));
        }

        // 初始化意图代码更新标记
        if (intentUpdateMarkers.isEmpty()) {
            intentUpdateMarkers.addAll(Set.of(
                    "UPDATE", "CREATE", "DELETE", "MODIFY", "SET", "CHANGE", "EDIT"
            ));
        }

        // 初始化短输入停用词
        if (shortInputStopWords.isEmpty()) {
            shortInputStopWords.addAll(Set.of(
                    "查", "看", "找", "要", "帮", "给", "说", "做",
                    "啥", "嘛", "吗", "呢", "吧", "了", "的", "是",
                    "what", "how", "why", "help", "show", "get"
            ));
        }

        // 初始化有意义的英文单词
        if (meaningfulEnglishWords.isEmpty()) {
            meaningfulEnglishWords.addAll(Set.of(
                    "query", "list", "get", "show", "create", "update", "delete",
                    "material", "batch", "quality", "shipment", "report", "alert",
                    "inventory", "stock", "order", "production", "check"
            ));
        }

        // 初始化通用咨询问题指示词
        // 这些词开头的句子通常是寻求建议/解释，而非执行操作
        if (generalQuestionIndicators.isEmpty()) {
            generalQuestionIndicators.addAll(Set.of(
                    // "如何..." 类型 - 寻求方法建议
                    "如何", "怎么", "怎样", "怎么样",
                    // "为什么..." 类型 - 寻求原因解释
                    "为什么", "为何", "为啥",
                    // "什么是..." 类型 - 寻求概念解释
                    "什么是", "啥是", "是什么意思",
                    // "能否解释..." 类型 - 请求解释
                    "能不能解释", "可以解释", "请解释", "解释一下",
                    // "有什么建议..." 类型 - 寻求建议
                    "有什么建议", "有何建议", "该怎么", "应该怎么",
                    "一些建议", "给我建议", "建议吗", "给我一些",
                    "管理建议", "好的建议", "什么建议", "啥建议",
                    // 比较类问题
                    "哪个更好", "哪种更好", "有什么区别", "区别是什么",
                    // "想了解..." 类型 - 寻求信息
                    "想了解", "想知道", "想问问", "想请教",
                    // "哪些因素..." 类型 - 分析类问题
                    "哪些因素", "什么因素", "受什么影响", "会影响",
                    // "应该注意..." 类型 - 注意事项咨询
                    "应该注意", "注意什么", "注意哪些", "需要注意",
                    // "有什么技巧..." 类型 - 技巧/方法咨询
                    "什么技巧", "有什么技巧", "什么方法", "有什么方法",
                    // 其他咨询模式
                    "要点是什么", "的要点", "的关键",
                    // ★ 愿望/期望表达型（表达宏观目标，不是具体操作指令）
                    // 这些句子表达的是用户的期望，应该由LLM提供建议
                    "我想要让", "我想让", "我希望能", "我希望可以",
                    "想要提高", "想要改善", "想要优化", "想要减少",
                    "想提高", "想改善", "想优化", "想减少", "想降低",
                    "希望提高", "希望改善", "希望优化", "希望减少",
                    "能不能提高", "能不能改善", "能不能优化",
                    "有没有办法", "有什么办法",
                    // 英文问题模式
                    "how to", "why is", "what is", "can you explain"
            ));
        }

        // 初始化闲聊/问候指示词
        if (conversationalIndicators.isEmpty()) {
            conversationalIndicators.addAll(Set.of(
                    // 问候类
                    "你好", "您好", "嗨", "hi", "hello", "hey",
                    "早上好", "下午好", "晚上好",
                    // 感谢类
                    "谢谢", "感谢", "多谢", "thanks", "thank you",
                    "辛苦了", "辛苦",
                    // 告别类
                    "再见", "拜拜", "bye", "goodbye",
                    // 确认类
                    "好的", "明白", "知道了", "收到",
                    // 询问在线类
                    "在吗", "在不在", "忙不忙",
                    // 请求帮助类（不具体，注：移除"帮我"因为有具体的"帮我X"短语映射）
                    "帮帮我", "帮帮忙", "求助",
                    // 困惑类
                    "我不太明白", "不太懂", "不明白",
                    // 询问能力类
                    "你是谁", "你叫什么", "你能做什么", "你能干什么",
                    // 闲聊类
                    "讲个笑话", "聊聊天", "无聊"
            ));
        }

        // ==================== 阶段二：初始化短语到意图映射 ====================
        if (phraseToIntentMapping.isEmpty()) {
            initPhraseMappings();
        }

        // ==================== 阶段三：初始化领域关键词 ====================
        if (domainKeywords.isEmpty()) {
            initDomainKeywords();
        }

        log.info("IntentKnowledgeBase 初始化完成: stopWords={}, queryIndicators={}, updateIndicators={}, " +
                        "generalQuestionIndicators={}, phraseToIntentMapping={}, domainKeywords={}",
                stopWords.size(), queryIndicators.size(), updateIndicators.size(),
                generalQuestionIndicators.size(), phraseToIntentMapping.size(), domainKeywords.size());
    }

    /**
     * 初始化短语到意图的精确映射 - 阶段二
     *
     * <p>按照优先级从高到低添加短语映射</p>
     * <p>更长、更具体的短语应该排在前面</p>
     */
    private void initPhraseMappings() {
        // === 发货/物流相关 (优化5: 扩充查询类短语，使用实际存在的意图) ===
        phraseToIntentMapping.put("发货查询", "SHIPMENT_QUERY");  // 新增：明确查询意图
        phraseToIntentMapping.put("查发货", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("看发货", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("查出货", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("发货情况", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("发货记录", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("出货记录", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("发货列表", "SHIPMENT_QUERY");  // SHIPMENT_LIST不存在，改为SHIPMENT_QUERY
        phraseToIntentMapping.put("发货单", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("物流信息", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("配送记录", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("发货历史", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("出货历史", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("出货单列表", "SHIPMENT_QUERY");

        // === 库存相关 (使用实际存在的意图代码) ===
        phraseToIntentMapping.put("库存查询", "REPORT_INVENTORY");
        phraseToIntentMapping.put("查库存", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("库存情况", "REPORT_INVENTORY");
        phraseToIntentMapping.put("库存统计", "REPORT_INVENTORY");
        phraseToIntentMapping.put("库存列表", "REPORT_INVENTORY");
        phraseToIntentMapping.put("原料库存", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("物料库存", "MATERIAL_BATCH_QUERY");

        // === 设备相关 (优化5: 扩充设备查询短语) ===
        phraseToIntentMapping.put("看设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("查设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("设备有哪些", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("有什么设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("有哪些设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("设备都有哪些", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("设备状态", "EQUIPMENT_STATUS_QUERY");
        phraseToIntentMapping.put("设备列表", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("设备故障", "EQUIPMENT_ALERT_QUERY");
        phraseToIntentMapping.put("设备运行", "EQUIPMENT_STATUS_QUERY");
        phraseToIntentMapping.put("设备概览", "EQUIPMENT_OVERVIEW");
        phraseToIntentMapping.put("设备维护", "EQUIPMENT_MAINTENANCE_QUERY");
        phraseToIntentMapping.put("设备清单", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("全部设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("所有设备", "EQUIPMENT_LIST");

        // === 电子秤相关 (优化5: 区分于通用设备) ===
        phraseToIntentMapping.put("看秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("查秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤有哪些", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("有哪些秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("所有秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("电子秤列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("电子秤", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("称重数据", "SCALE_DATA_QUERY");
        phraseToIntentMapping.put("秤的状态", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("秤状态", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("称重状态", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("称重记录", "SCALE_RECORD_QUERY");
        phraseToIntentMapping.put("读取重量", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("称重", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("读秤", "SCALE_DEVICE_DETAIL");

        // === 告警相关 ===
        phraseToIntentMapping.put("告警信息", "ALERT_QUERY");
        phraseToIntentMapping.put("告警列表", "ALERT_LIST");
        phraseToIntentMapping.put("报警记录", "ALERT_QUERY");
        phraseToIntentMapping.put("预警信息", "ALERT_QUERY");
        phraseToIntentMapping.put("异常告警", "ALERT_QUERY");

        // === 生产/加工相关 ===
        phraseToIntentMapping.put("生产批次", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("加工记录", "PROCESSING_RECORD_QUERY");
        phraseToIntentMapping.put("生产记录", "PROCESSING_RECORD_QUERY");
        phraseToIntentMapping.put("批次列表", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("批次查询", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("今日生产", "DAILY_PRODUCTION_QUERY");
        phraseToIntentMapping.put("生产进度", "PROCESSING_PROGRESS_QUERY");
        phraseToIntentMapping.put("停止生产", "PROCESSING_STOP");
        phraseToIntentMapping.put("暂停生产", "PROCESSING_PAUSE");
        phraseToIntentMapping.put("恢复生产", "PROCESSING_RESUME");

        // === 质检相关 ===
        phraseToIntentMapping.put("质检记录", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("质检报告", "QUALITY_REPORT_QUERY");
        phraseToIntentMapping.put("质量检测", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("检验结果", "QUALITY_CHECK_QUERY");

        // === 原料/物料相关 ===
        phraseToIntentMapping.put("原料入库", "MATERIAL_INBOUND_QUERY");
        phraseToIntentMapping.put("物料入库", "MATERIAL_INBOUND_QUERY");
        phraseToIntentMapping.put("原料批次", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料列表", "MATERIAL_LIST");

        // === 报表相关 ===
        phraseToIntentMapping.put("今日报表", "DAILY_REPORT");
        phraseToIntentMapping.put("日报表", "DAILY_REPORT");
        phraseToIntentMapping.put("生产报表", "PRODUCTION_REPORT");
        phraseToIntentMapping.put("统计报表", "STATS_REPORT");
        phraseToIntentMapping.put("数据报表", "DATA_REPORT");

        // === 客户相关 ===
        phraseToIntentMapping.put("客户列表", "CUSTOMER_LIST");
        phraseToIntentMapping.put("客户信息", "CUSTOMER_QUERY");
        phraseToIntentMapping.put("客户查询", "CUSTOMER_QUERY");

        // === 用户/员工相关 ===
        phraseToIntentMapping.put("员工列表", "USER_LIST");
        phraseToIntentMapping.put("用户信息", "USER_QUERY");

        // === 考勤相关 (优化5: 补充签到/打卡映射) ===
        phraseToIntentMapping.put("员工签到", "CLOCK_IN");
        phraseToIntentMapping.put("工人签到", "CLOCK_IN");
        phraseToIntentMapping.put("上工签到", "CLOCK_IN");
        phraseToIntentMapping.put("生产签到", "CLOCK_IN");
        phraseToIntentMapping.put("工位签到", "CLOCK_IN");
        phraseToIntentMapping.put("员工签退", "CLOCK_OUT");
        phraseToIntentMapping.put("工人签退", "CLOCK_OUT");
        phraseToIntentMapping.put("下工签退", "CLOCK_OUT");
        phraseToIntentMapping.put("生产签退", "CLOCK_OUT");
        phraseToIntentMapping.put("工位签退", "CLOCK_OUT");
        phraseToIntentMapping.put("今日考勤", "ATTENDANCE_TODAY");
        phraseToIntentMapping.put("今天考勤", "ATTENDANCE_TODAY");
        phraseToIntentMapping.put("考勤情况", "ATTENDANCE_TODAY");
        phraseToIntentMapping.put("考勤历史", "ATTENDANCE_HISTORY");
        phraseToIntentMapping.put("历史考勤", "ATTENDANCE_HISTORY");
        phraseToIntentMapping.put("打卡记录", "ATTENDANCE_HISTORY");
        phraseToIntentMapping.put("考勤记录", "ATTENDANCE_HISTORY");

        // === 口语化"帮我X"模式短语 (v4.0 优化) ===
        // 考勤类
        phraseToIntentMapping.put("帮我打卡", "CLOCK_IN");
        phraseToIntentMapping.put("帮我签到", "CLOCK_IN");
        phraseToIntentMapping.put("帮我签退", "CLOCK_OUT");
        phraseToIntentMapping.put("帮我下班", "CLOCK_OUT");
        // 设备类
        phraseToIntentMapping.put("帮我看设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("帮我查设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("帮我看秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("帮我查秤", "SCALE_LIST_DEVICES");
        // 报表类 (使用实际存在的意图代码)
        phraseToIntentMapping.put("帮我看报表", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("帮我生成报表", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("帮我出报告", "REPORT_DASHBOARD_OVERVIEW");
        // 库存类 (使用实际存在的意图代码)
        phraseToIntentMapping.put("帮我查库存", "REPORT_INVENTORY");
        phraseToIntentMapping.put("帮我看库存", "REPORT_INVENTORY");
        // 批次类
        phraseToIntentMapping.put("帮我查批次", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("帮我看批次", "PROCESSING_BATCH_LIST");
        // 发货类
        phraseToIntentMapping.put("帮我查发货", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("帮我看发货", "SHIPMENT_QUERY");
        // 告警类
        phraseToIntentMapping.put("帮我看告警", "ALERT_LIST");
        phraseToIntentMapping.put("帮我查告警", "ALERT_LIST");

        // === v4.1优化：溯源类短语映射（解决TRACE被BATCH抢占）===
        phraseToIntentMapping.put("溯源", "TRACE_BATCH");
        phraseToIntentMapping.put("批次溯源", "TRACE_BATCH");
        phraseToIntentMapping.put("追溯", "TRACE_BATCH");
        phraseToIntentMapping.put("追溯批次", "TRACE_BATCH");
        phraseToIntentMapping.put("追踪批次", "TRACE_BATCH");
        phraseToIntentMapping.put("批次追踪", "TRACE_BATCH");
        phraseToIntentMapping.put("批次追溯", "TRACE_BATCH");
        phraseToIntentMapping.put("查批次流向", "TRACE_BATCH");
        phraseToIntentMapping.put("批次来源", "TRACE_BATCH");
        phraseToIntentMapping.put("批次从哪来", "TRACE_BATCH");
        phraseToIntentMapping.put("溯源这个批次", "TRACE_BATCH");
        phraseToIntentMapping.put("全链路追溯", "TRACE_FULL");
        phraseToIntentMapping.put("全链路溯源", "TRACE_FULL");
        phraseToIntentMapping.put("完整溯源", "TRACE_FULL");
        phraseToIntentMapping.put("从头到尾追踪", "TRACE_FULL");
        phraseToIntentMapping.put("全流程追溯", "TRACE_FULL");
        phraseToIntentMapping.put("端到端溯源", "TRACE_FULL");
        phraseToIntentMapping.put("公开溯源", "TRACE_PUBLIC");
        phraseToIntentMapping.put("生成溯源码", "TRACE_PUBLIC");
        phraseToIntentMapping.put("溯源二维码", "TRACE_PUBLIC");
        phraseToIntentMapping.put("产品溯源二维码", "TRACE_PUBLIC");
        phraseToIntentMapping.put("消费者溯源", "TRACE_PUBLIC");
        phraseToIntentMapping.put("对外溯源", "TRACE_PUBLIC");

        // === v4.1优化：告警类短语映射（解决ALERT混淆）===
        phraseToIntentMapping.put("活跃告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("当前告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("未处理告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("待处理告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("进行中告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("实时告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("正在报警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("正在发生的告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("未解决告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("未关闭警报", "ALERT_ACTIVE");
        phraseToIntentMapping.put("确认告警", "ALERT_ACKNOWLEDGE");
        phraseToIntentMapping.put("确认收到告警", "ALERT_ACKNOWLEDGE");
        phraseToIntentMapping.put("告警已读", "ALERT_ACKNOWLEDGE");
        phraseToIntentMapping.put("标记告警已读", "ALERT_ACKNOWLEDGE");
        phraseToIntentMapping.put("我知道这个告警了", "ALERT_ACKNOWLEDGE");
        phraseToIntentMapping.put("告警我看到了", "ALERT_ACKNOWLEDGE");
        phraseToIntentMapping.put("确认这个警报", "ALERT_ACKNOWLEDGE");
        phraseToIntentMapping.put("知悉告警", "ALERT_ACKNOWLEDGE");
        phraseToIntentMapping.put("解决告警", "ALERT_RESOLVE");
        phraseToIntentMapping.put("告警已处理", "ALERT_RESOLVE");
        phraseToIntentMapping.put("关闭告警", "ALERT_RESOLVE");
        phraseToIntentMapping.put("关闭这个告警", "ALERT_RESOLVE");
        phraseToIntentMapping.put("问题已解决", "ALERT_RESOLVE");
        phraseToIntentMapping.put("告警处理完毕", "ALERT_RESOLVE");
        phraseToIntentMapping.put("解除告警", "ALERT_RESOLVE");
        phraseToIntentMapping.put("告警诊断", "ALERT_DIAGNOSE");
        phraseToIntentMapping.put("诊断告警", "ALERT_DIAGNOSE");
        phraseToIntentMapping.put("诊断这个异常", "ALERT_DIAGNOSE");
        phraseToIntentMapping.put("告警怎么回事", "ALERT_DIAGNOSE");
        phraseToIntentMapping.put("为什么会报警", "ALERT_DIAGNOSE");
        phraseToIntentMapping.put("告警根因分析", "ALERT_DIAGNOSE");
        phraseToIntentMapping.put("分析告警原因", "ALERT_DIAGNOSE");

        // === v4.1优化：秤类短语映射扩展（解决SCALE NONE问题）===
        phraseToIntentMapping.put("地磅列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("台秤列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("台秤清单", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("称重设备列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("称重设备清单", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("称重设备", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("智能秤列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("物联网秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("IoT秤列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("电子称一览", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤都有哪些", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("我们有多少秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("工厂里的秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("添加秤", "SCALE_ADD_DEVICE");
        phraseToIntentMapping.put("新增秤", "SCALE_ADD_DEVICE");
        phraseToIntentMapping.put("注册新秤", "SCALE_ADD_DEVICE");
        phraseToIntentMapping.put("录入电子秤", "SCALE_ADD_DEVICE");
        phraseToIntentMapping.put("接入秤", "SCALE_ADD_DEVICE");
        phraseToIntentMapping.put("添加称重设备", "SCALE_ADD_DEVICE");
        phraseToIntentMapping.put("秤详情", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("秤的详细信息", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("秤的参数", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("秤的精度", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("秤的量程", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("秤连接状态", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("秤在线吗", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("秤是否正常", "SCALE_DEVICE_DETAIL");

        // === v4.1优化：出货类短语映射扩展（解决SHIPMENT NONE问题）===
        phraseToIntentMapping.put("发货查询", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("发货记录", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("发货记录查询", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("出货查询", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("出货记录", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("发货单查询", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("查询出货", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("查出货", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("看发货", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("看下发货", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("创建发货", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("新建发货", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("新建出货单", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("创建发货单", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("创建发货任务", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("安排发货", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("安排一批发货", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("登记出货", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("准备发货", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("开一张出货单", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("发个货", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("今日发货", "SHIPMENT_BY_DATE");
        phraseToIntentMapping.put("今天发货", "SHIPMENT_BY_DATE");
        phraseToIntentMapping.put("今天发了多少货", "SHIPMENT_BY_DATE");
        phraseToIntentMapping.put("昨天发货", "SHIPMENT_BY_DATE");
        phraseToIntentMapping.put("本周出货", "SHIPMENT_BY_DATE");
        phraseToIntentMapping.put("近期发货", "SHIPMENT_BY_DATE");
        phraseToIntentMapping.put("发货统计", "SHIPMENT_STATS");
        phraseToIntentMapping.put("出货统计", "SHIPMENT_STATS");
        phraseToIntentMapping.put("发货报表", "SHIPMENT_STATS");
        phraseToIntentMapping.put("出货报表", "SHIPMENT_STATS");
        phraseToIntentMapping.put("发货数据", "SHIPMENT_STATS");
        phraseToIntentMapping.put("发货数量统计", "SHIPMENT_STATS");
        phraseToIntentMapping.put("出货量分析", "SHIPMENT_STATS");
        phraseToIntentMapping.put("本月出货统计", "SHIPMENT_STATS");
        phraseToIntentMapping.put("修改发货单", "SHIPMENT_UPDATE");
        phraseToIntentMapping.put("更新出货信息", "SHIPMENT_UPDATE");
        phraseToIntentMapping.put("编辑发货记录", "SHIPMENT_UPDATE");
        phraseToIntentMapping.put("变更发货内容", "SHIPMENT_UPDATE");
        phraseToIntentMapping.put("调整出货数量", "SHIPMENT_UPDATE");

        // === v4.1优化：设备类短语映射扩展 ===
        phraseToIntentMapping.put("设备告警列表", "EQUIPMENT_ALERT_LIST");
        phraseToIntentMapping.put("设备警报", "EQUIPMENT_ALERT_LIST");
        phraseToIntentMapping.put("设备故障", "EQUIPMENT_ALERT_LIST");
        phraseToIntentMapping.put("设备有什么问题", "EQUIPMENT_ALERT_LIST");
        phraseToIntentMapping.put("机器报警信息", "EQUIPMENT_ALERT_LIST");
        phraseToIntentMapping.put("设备异常汇总", "EQUIPMENT_ALERT_LIST");
        phraseToIntentMapping.put("哪些设备有故障", "EQUIPMENT_ALERT_LIST");
        phraseToIntentMapping.put("设备保养", "EQUIPMENT_MAINTENANCE");
        phraseToIntentMapping.put("设备维护", "EQUIPMENT_MAINTENANCE");
        phraseToIntentMapping.put("设备该保养了", "EQUIPMENT_MAINTENANCE");
        phraseToIntentMapping.put("机器维修计划", "EQUIPMENT_MAINTENANCE");
        phraseToIntentMapping.put("启动设备", "EQUIPMENT_START");
        phraseToIntentMapping.put("开启设备", "EQUIPMENT_START");
        phraseToIntentMapping.put("把设备打开", "EQUIPMENT_START");
        phraseToIntentMapping.put("开启机器", "EQUIPMENT_START");
        phraseToIntentMapping.put("停止设备", "EQUIPMENT_STOP");
        phraseToIntentMapping.put("关闭设备", "EQUIPMENT_STOP");
        phraseToIntentMapping.put("把设备关了", "EQUIPMENT_STOP");
        phraseToIntentMapping.put("关掉设备", "EQUIPMENT_STOP");

        log.debug("短语映射初始化完成，共 {} 条映射", phraseToIntentMapping.size());
    }

    /**
     * 初始化领域关键词 - 阶段三
     */
    private void initDomainKeywords() {
        // 设备领域
        domainKeywords.put(Domain.EQUIPMENT, new HashSet<>(Set.of(
                "设备", "机器", "机台", "产线", "生产线", "设备状态", "设备运行",
                "equipment", "machine", "device"
        )));

        // 电子秤领域
        domainKeywords.put(Domain.SCALE, new HashSet<>(Set.of(
                "电子秤", "秤", "称重", "重量", "克重", "斤", "公斤", "千克",
                "scale", "weight", "weigh"
        )));

        // 加工领域
        domainKeywords.put(Domain.PROCESSING, new HashSet<>(Set.of(
                "生产", "加工", "批次", "工序", "工艺", "产量", "产出", "投产",
                "production", "processing", "batch"
        )));

        // 原料领域
        domainKeywords.put(Domain.MATERIAL, new HashSet<>(Set.of(
                "原料", "物料", "材料", "原材料", "辅料", "配料", "成分",
                "material", "ingredient", "raw"
        )));

        // 告警领域 - v4.1优化：增加操作词汇（解决告警意图混淆）
        domainKeywords.put(Domain.ALERT, new HashSet<>(Set.of(
                "告警", "报警", "预警", "异常", "故障", "警报", "警告",
                "确认", "解决", "关闭", "处理完毕", "已读", "诊断", "活跃",
                "alert", "alarm", "warning", "acknowledge", "resolve"
        )));

        // 质检领域
        domainKeywords.put(Domain.QUALITY, new HashSet<>(Set.of(
                "质检", "质量", "检验", "检测", "品控", "合格", "不合格", "抽检",
                "quality", "inspection", "qc"
        )));

        // 发货领域 - v4.1优化：增加溯源词汇（解决TRACE被PROCESSING抢占）
        domainKeywords.put(Domain.SHIPMENT, new HashSet<>(Set.of(
                "发货", "出货", "配送", "物流", "运输", "快递", "出库",
                "溯源", "追溯", "追踪", "来源", "流向", "链路", "全链路",
                "shipment", "delivery", "shipping", "trace", "traceability"
        )));

        // 报表领域
        domainKeywords.put(Domain.REPORT, new HashSet<>(Set.of(
                "报表", "报告", "统计", "汇总", "分析", "数据",
                "report", "statistics", "summary"
        )));

        // 库存领域
        domainKeywords.put(Domain.INVENTORY, new HashSet<>(Set.of(
                "库存", "存货", "储存", "仓库", "入库", "库位",
                "inventory", "stock", "warehouse"
        )));

        // 客户领域
        domainKeywords.put(Domain.CUSTOMER, new HashSet<>(Set.of(
                "客户", "顾客", "买家", "订单", "订货", "采购方",
                "customer", "client", "buyer"
        )));

        // 用户领域
        domainKeywords.put(Domain.USER, new HashSet<>(Set.of(
                "用户", "员工", "工人", "操作员", "管理员", "人员",
                "user", "employee", "worker", "staff"
        )));

        // 系统领域
        domainKeywords.put(Domain.SYSTEM, new HashSet<>(Set.of(
                "系统", "配置", "设置", "参数", "权限", "角色",
                "system", "config", "setting"
        )));

        // 通用领域（兜底）
        domainKeywords.put(Domain.GENERAL, new HashSet<>(Set.of(
                "查询", "列表", "记录", "信息",
                "query", "list", "info"
        )));

        log.debug("领域关键词初始化完成，共 {} 个领域", domainKeywords.size());
    }

    // ==================== 枚举定义 ====================

    /**
     * 问题类型枚举 - 用于判断用户输入的意图类别
     *
     * <p>这是识别架构的第一层过滤，在关键词匹配之前执行</p>
     */
    public enum QuestionType {
        /**
         * 操作指令 - 需要执行具体操作的输入
         * 例如: "查询库存", "创建批次", "查看今日报表"
         */
        OPERATIONAL_COMMAND,

        /**
         * 通用咨询问题 - 需要LLM对话回答的输入
         * 例如: "如何提高生产效率", "为什么产量下降", "什么是溯源"
         */
        GENERAL_QUESTION,

        /**
         * 闲聊/问候 - 简单对话
         * 例如: "你好", "谢谢", "再见"
         */
        CONVERSATIONAL,

        /**
         * 无法判断 - 需要进一步分析
         */
        UNDETERMINED
    }

    /**
     * 操作类型枚举
     */
    public enum ActionType {
        /** 查询操作 */
        QUERY,
        /** 创建操作 */
        CREATE,
        /** 更新操作 */
        UPDATE,
        /** 删除操作 */
        DELETE,
        /** 查询和更新指示词都存在 */
        AMBIGUOUS,
        /** 无法判断 */
        UNKNOWN
    }

    /**
     * 业务领域枚举 - 阶段三：领域优先级
     *
     * <p>用于将用户输入归类到特定业务领域，提高意图匹配精度</p>
     */
    public enum Domain {
        /** 设备管理领域 */
        EQUIPMENT("设备", "EQUIPMENT"),
        /** 电子秤/称重领域 */
        SCALE("称重", "SCALE"),
        /** 生产加工领域 */
        PROCESSING("加工", "PROCESSING"),
        /** 原料/物料领域 */
        MATERIAL("物料", "MATERIAL"),
        /** 告警/预警领域 */
        ALERT("告警", "ALERT"),
        /** 质量检测领域 */
        QUALITY("质检", "QUALITY"),
        /** 发货/物流领域 */
        SHIPMENT("发货", "SHIPMENT"),
        /** 报表/统计领域 */
        REPORT("报表", "REPORT"),
        /** 库存领域 */
        INVENTORY("库存", "INVENTORY"),
        /** 客户/CRM领域 */
        CUSTOMER("客户", "CUSTOMER"),
        /** 用户/员工领域 */
        USER("用户", "USER"),
        /** 系统配置领域 */
        SYSTEM("系统", "SYSTEM"),
        /** 通用/未分类 */
        GENERAL("通用", "GENERAL");

        private final String displayName;
        private final String intentPrefix;

        Domain(String displayName, String intentPrefix) {
            this.displayName = displayName;
            this.intentPrefix = intentPrefix;
        }

        public String getDisplayName() {
            return displayName;
        }

        public String getIntentPrefix() {
            return intentPrefix;
        }
    }

    // ==================== 判断方法 ====================

    /**
     * 检查是否是停用词
     *
     * @param word 待检查的词
     * @return 如果是停用词返回 true
     */
    public boolean isStopWord(String word) {
        if (word == null || word.isEmpty()) {
            return true;
        }
        return stopWords.contains(word.toLowerCase());
    }

    /**
     * 检查是否是短输入停用词
     *
     * @param word 待检查的词
     * @return 如果是短输入停用词返回 true
     */
    public boolean isShortInputStopWord(String word) {
        if (word == null || word.isEmpty()) {
            return true;
        }
        return shortInputStopWords.contains(word.toLowerCase());
    }

    /**
     * 检测用户输入的问题类型（第一层分类）
     *
     * <p>这个方法应该在关键词匹配之前调用，用于判断是否需要直接路由到LLM</p>
     *
     * <p>判断逻辑优先级：</p>
     * <ol>
     *   <li>闲聊/问候检测 - 最高优先级</li>
     *   <li>通用咨询问题检测 - 如果输入以"如何/怎么/为什么"等开头</li>
     *   <li>操作指令检测 - 如果包含明确的操作指示词</li>
     *   <li>默认为 UNDETERMINED</li>
     * </ol>
     *
     * @param input 用户输入
     * @return 问题类型
     */
    public QuestionType detectQuestionType(String input) {
        if (input == null || input.trim().isEmpty()) {
            return QuestionType.UNDETERMINED;
        }

        String trimmedInput = input.trim().toLowerCase();

        // 1. 检测闲聊/问候
        for (String indicator : conversationalIndicators) {
            // 完全匹配或输入以问候语开头
            if (trimmedInput.equals(indicator.toLowerCase()) ||
                trimmedInput.startsWith(indicator.toLowerCase())) {
                // 确保不是"帮我停一下生产线"这种带有操作指令的情况
                // 修复：优先检查操作指示词，只有不包含操作词时才认为是闲聊
                if (!containsOperationalIndicator(trimmedInput)) {
                    // 短输入（如"帮我"、"帮帮我"）或纯闲聊都归类为对话
                    log.debug("检测到闲聊类型: input='{}', matched='{}'", input, indicator);
                    return QuestionType.CONVERSATIONAL;
                }
                // 包含操作指示词时，跳过闲聊检测，继续后续处理
                log.debug("输入以'{}'开头但包含操作指示词，跳过闲聊检测: input='{}'", indicator, input);
            }
        }

        // 2. 检测通用咨询问题（如何/怎么/为什么...）
        for (String indicator : generalQuestionIndicators) {
            if (trimmedInput.startsWith(indicator.toLowerCase()) ||
                trimmedInput.contains(indicator.toLowerCase())) {
                // 额外检查：如果同时包含明确的操作指示词，可能是混合型
                // 例如 "怎么查询库存" 是操作指令，而 "怎么提高效率" 是通用问题
                if (containsStrongOperationalIndicator(trimmedInput)) {
                    log.debug("检测到混合型问题，优先按操作指令处理: input='{}', indicator='{}'", input, indicator);
                    return QuestionType.OPERATIONAL_COMMAND;
                }
                log.debug("检测到通用咨询问题: input='{}', matched='{}'", input, indicator);
                return QuestionType.GENERAL_QUESTION;
            }
        }

        // 3. 检测操作指令
        if (containsOperationalIndicator(trimmedInput)) {
            log.debug("检测到操作指令: input='{}'", input);
            return QuestionType.OPERATIONAL_COMMAND;
        }

        // 4. 无法判断
        log.debug("问题类型无法判断: input='{}'", input);
        return QuestionType.UNDETERMINED;
    }

    /**
     * 检查输入是否包含操作指示词
     */
    private boolean containsOperationalIndicator(String input) {
        return queryIndicators.stream().anyMatch(input::contains) ||
               updateIndicators.stream().anyMatch(input::contains) ||
               createIndicators.stream().anyMatch(input::contains) ||
               deleteIndicators.stream().anyMatch(input::contains);
    }

    /**
     * 检查输入是否包含强操作指示词（排除模糊词如"查"）
     * 用于判断 "怎么查询库存" vs "怎么提高效率"
     */
    private boolean containsStrongOperationalIndicator(String input) {
        Set<String> strongIndicators = Set.of(
                // 常规操作
                "查询", "查看", "创建", "新建", "添加", "修改", "更新", "删除",
                "获取", "列表", "统计", "录入", "登记", "设置",
                // 状态控制操作
                "停止", "暂停", "启动", "恢复", "开始", "完成", "结束", "关闭", "打开"
        );
        return strongIndicators.stream().anyMatch(input::contains);
    }

    /**
     * 检测用户输入的操作类型
     *
     * @param input 用户输入（建议传入小写形式）
     * @return 操作类型
     */
    public ActionType detectActionType(String input) {
        if (input == null || input.isEmpty()) {
            return ActionType.UNKNOWN;
        }

        String lowerInput = input.toLowerCase();

        boolean hasQuery = queryIndicators.stream().anyMatch(lowerInput::contains);
        boolean hasUpdate = updateIndicators.stream().anyMatch(lowerInput::contains);
        boolean hasCreate = createIndicators.stream().anyMatch(lowerInput::contains);
        boolean hasDelete = deleteIndicators.stream().anyMatch(lowerInput::contains);

        // 创建和删除优先级最高
        if (hasCreate && !hasQuery && !hasUpdate) {
            return ActionType.CREATE;
        }
        if (hasDelete && !hasQuery && !hasUpdate) {
            return ActionType.DELETE;
        }

        // 查询和更新
        if (hasQuery && !hasUpdate && !hasCreate && !hasDelete) {
            return ActionType.QUERY;
        }
        if (hasUpdate && !hasQuery) {
            return ActionType.UPDATE;
        }

        // 混合情况
        if ((hasQuery && hasUpdate) || (hasQuery && hasCreate) || (hasUpdate && hasDelete)) {
            return ActionType.AMBIGUOUS;
        }

        return ActionType.UNKNOWN;
    }

    /**
     * 判断意图代码是否为查询类意图
     *
     * @param intentCode 意图代码
     * @return 如果是查询类意图返回 true
     */
    public boolean isQueryIntent(String intentCode) {
        if (intentCode == null) return false;
        String upperCode = intentCode.toUpperCase();
        return intentQueryMarkers.stream().anyMatch(upperCode::contains);
    }

    /**
     * 判断意图代码是否为更新类意图
     *
     * @param intentCode 意图代码
     * @return 如果是更新类意图返回 true
     */
    public boolean isUpdateIntent(String intentCode) {
        if (intentCode == null) return false;
        String upperCode = intentCode.toUpperCase();
        return intentUpdateMarkers.stream().anyMatch(upperCode::contains);
    }

    /**
     * 计算操作类型权重调整值
     *
     * @param intentCode 意图代码
     * @param actionType 检测到的操作类型
     * @param matchBonus 匹配加分值
     * @param mismatchPenalty 不匹配减分值
     * @return 权重调整值（正数加分，负数减分）
     */
    public int calculateOperationTypeAdjustment(String intentCode, ActionType actionType,
                                                  int matchBonus, int mismatchPenalty) {
        if (actionType == ActionType.UNKNOWN || actionType == ActionType.AMBIGUOUS) {
            return 0;  // 无法判断时不调整
        }

        boolean isQuery = isQueryIntent(intentCode);
        boolean isUpdate = isUpdateIntent(intentCode);

        // 查询输入 + 查询意图 = 加分
        if (actionType == ActionType.QUERY && isQuery) {
            return matchBonus;
        }
        // 更新输入 + 更新意图 = 加分
        if (actionType == ActionType.UPDATE && isUpdate) {
            return matchBonus;
        }
        // 创建输入 + 更新意图（创建属于更新类操作）= 加分
        if (actionType == ActionType.CREATE && isUpdate) {
            return matchBonus;
        }
        // 删除输入 + 更新意图（删除属于更新类操作）= 加分
        if (actionType == ActionType.DELETE && isUpdate) {
            return matchBonus;
        }

        // 查询输入 + 更新意图 = 减分
        if (actionType == ActionType.QUERY && isUpdate) {
            return -mismatchPenalty;
        }
        // 更新输入 + 查询意图 = 减分
        if ((actionType == ActionType.UPDATE || actionType == ActionType.CREATE ||
             actionType == ActionType.DELETE) && isQuery) {
            return -mismatchPenalty;
        }

        return 0;
    }

    /**
     * 检查输入是否包含中文字符
     *
     * @param input 输入文本
     * @return 如果包含中文返回 true
     */
    public boolean containsChinese(String input) {
        if (input == null) return false;
        return input.matches(".*[\\u4e00-\\u9fa5]+.*");
    }

    /**
     * 检查输入是否包含有意义的英文单词
     *
     * @param input 输入文本
     * @return 如果包含有意义的英文单词返回 true
     */
    public boolean containsMeaningfulEnglish(String input) {
        if (input == null) return false;
        String lower = input.toLowerCase();
        return meaningfulEnglishWords.stream().anyMatch(lower::contains);
    }

    /**
     * 检查输入是否有意义（包含中文或有意义的英文）
     *
     * @param input 输入文本
     * @return 如果有意义返回 true
     */
    public boolean isMeaningfulInput(String input) {
        return containsChinese(input) || containsMeaningfulEnglish(input);
    }

    // ==================== 阶段二：短语优先匹配方法 ====================

    /**
     * 短语优先匹配 - 阶段二核心方法
     *
     * <p>在复杂的关键词分析之前，先尝试精确短语匹配</p>
     * <p>如果用户输入包含已知短语，直接返回对应意图，避免歧义</p>
     *
     * @param input 用户输入
     * @return 匹配到的意图代码，未匹配返回 Optional.empty()
     */
    public Optional<String> matchPhrase(String input) {
        if (input == null || input.trim().isEmpty()) {
            return Optional.empty();
        }

        String normalizedInput = input.trim().toLowerCase();

        // 按短语长度倒序排列，优先匹配更长的短语
        List<Map.Entry<String, String>> sortedEntries = phraseToIntentMapping.entrySet()
                .stream()
                .sorted((e1, e2) -> Integer.compare(e2.getKey().length(), e1.getKey().length()))
                .toList();

        for (Map.Entry<String, String> entry : sortedEntries) {
            String phrase = entry.getKey().toLowerCase();
            if (normalizedInput.contains(phrase)) {
                String intentCode = entry.getValue();
                log.debug("短语匹配成功: input='{}', phrase='{}', intent='{}'",
                        input, entry.getKey(), intentCode);
                return Optional.of(intentCode);
            }
        }

        log.debug("短语匹配未命中: input='{}'", input);
        return Optional.empty();
    }

    /**
     * 获取短语映射（只读）
     *
     * @return 短语到意图的映射
     */
    public Map<String, String> getPhraseToIntentMapping() {
        return Collections.unmodifiableMap(phraseToIntentMapping);
    }

    /**
     * 添加自定义短语映射
     *
     * @param phrase 短语
     * @param intentCode 意图代码
     */
    public void addPhraseMapping(String phrase, String intentCode) {
        if (phrase != null && intentCode != null && !phrase.trim().isEmpty()) {
            phraseToIntentMapping.put(phrase.trim(), intentCode.trim());
            log.debug("添加短语映射: '{}' -> '{}'", phrase, intentCode);
        }
    }

    // ==================== 阶段三：领域优先级方法 ====================

    /**
     * 检测用户输入所属的业务领域 - 阶段三核心方法
     *
     * <p>通过分析输入中的领域关键词，确定用户查询所属的业务领域</p>
     * <p>这可以帮助在多个候选意图中优先选择同领域的意图</p>
     *
     * @param input 用户输入
     * @return 检测到的领域，默认返回 GENERAL
     */
    public Domain detectDomain(String input) {
        if (input == null || input.trim().isEmpty()) {
            return Domain.GENERAL;
        }

        String normalizedInput = input.trim().toLowerCase();

        // 记录每个领域的匹配权重
        Map<Domain, Integer> domainScores = new EnumMap<>(Domain.class);

        for (Map.Entry<Domain, Set<String>> entry : domainKeywords.entrySet()) {
            Domain domain = entry.getKey();
            if (domain == Domain.GENERAL) {
                continue; // 跳过通用领域
            }

            int score = 0;
            for (String keyword : entry.getValue()) {
                if (normalizedInput.contains(keyword.toLowerCase())) {
                    // 关键词长度作为权重，更长的关键词更精确
                    score += keyword.length();
                }
            }

            if (score > 0) {
                domainScores.put(domain, score);
            }
        }

        if (domainScores.isEmpty()) {
            log.debug("领域检测未命中，返回 GENERAL: input='{}'", input);
            return Domain.GENERAL;
        }

        // 返回得分最高的领域
        Domain detectedDomain = domainScores.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(Domain.GENERAL);

        log.debug("领域检测结果: input='{}', domain={}, scores={}",
                input, detectedDomain, domainScores);

        return detectedDomain;
    }

    /**
     * 根据意图代码获取其所属领域 - 阶段三辅助方法
     *
     * <p>通过分析意图代码的前缀来判断其所属领域</p>
     *
     * @param intentCode 意图代码
     * @return 意图所属的领域
     */
    public Domain getDomainFromIntentCode(String intentCode) {
        if (intentCode == null || intentCode.trim().isEmpty()) {
            return Domain.GENERAL;
        }

        // 检查缓存
        Domain cached = intentToDomainCache.get(intentCode);
        if (cached != null) {
            return cached;
        }

        String upperCode = intentCode.toUpperCase();

        // 按照领域前缀匹配
        Domain detectedDomain = Domain.GENERAL;
        for (Domain domain : Domain.values()) {
            if (domain == Domain.GENERAL) {
                continue;
            }
            if (upperCode.startsWith(domain.getIntentPrefix() + "_") ||
                upperCode.contains("_" + domain.getIntentPrefix() + "_") ||
                upperCode.endsWith("_" + domain.getIntentPrefix())) {
                detectedDomain = domain;
                break;
            }
        }

        // 缓存结果
        intentToDomainCache.put(intentCode, detectedDomain);

        log.debug("意图领域识别: intentCode='{}', domain={}", intentCode, detectedDomain);
        return detectedDomain;
    }

    /**
     * 检查意图是否属于指定领域
     *
     * @param intentCode 意图代码
     * @param domain 目标领域
     * @return 如果意图属于该领域返回 true
     */
    public boolean isIntentInDomain(String intentCode, Domain domain) {
        return getDomainFromIntentCode(intentCode) == domain;
    }

    /**
     * 获取领域关键词（只读）
     *
     * @param domain 领域
     * @return 该领域的关键词集合
     */
    public Set<String> getDomainKeywords(Domain domain) {
        Set<String> keywords = domainKeywords.get(domain);
        return keywords != null ? Collections.unmodifiableSet(keywords) : Collections.emptySet();
    }

    // ==================== 阶段四：意图消歧方法 ====================

    /**
     * 判断两个意图是否功能等价 - 阶段四核心方法
     *
     * <p>功能等价的意图可以互相替代，在消歧时可以选择任一个</p>
     * <p>例如 INVENTORY_QUERY 和 STOCK_QUERY 功能上是等价的</p>
     *
     * @param intent1 第一个意图代码
     * @param intent2 第二个意图代码
     * @return 如果两个意图功能等价返回 true
     */
    public boolean areFunctionallyEquivalent(String intent1, String intent2) {
        if (intent1 == null || intent2 == null) {
            return false;
        }

        String upper1 = intent1.toUpperCase();
        String upper2 = intent2.toUpperCase();

        // 完全相同
        if (upper1.equals(upper2)) {
            return true;
        }

        // 检查是否在同一等价组中
        Set<String> group1 = EQUIVALENT_INTENTS.get(upper1);
        if (group1 != null && group1.contains(upper2)) {
            log.debug("意图功能等价: '{}' <=> '{}'", intent1, intent2);
            return true;
        }

        return false;
    }

    /**
     * 获取意图的功能等价组
     *
     * @param intentCode 意图代码
     * @return 功能等价的意图集合，如果没有等价组则返回只包含自身的集合
     */
    public Set<String> getEquivalentIntents(String intentCode) {
        if (intentCode == null) {
            return Collections.emptySet();
        }

        String upperCode = intentCode.toUpperCase();
        Set<String> group = EQUIVALENT_INTENTS.get(upperCode);

        if (group != null) {
            return Collections.unmodifiableSet(group);
        }

        // 没有等价组，返回只包含自身的集合
        return Set.of(upperCode);
    }

    /**
     * 从候选意图列表中选择最佳意图
     *
     * <p>考虑领域匹配和功能等价性进行选择</p>
     *
     * @param candidates 候选意图列表
     * @param inputDomain 用户输入检测到的领域
     * @return 最佳意图代码，如果列表为空返回 Optional.empty()
     */
    public Optional<String> selectBestIntent(List<String> candidates, Domain inputDomain) {
        if (candidates == null || candidates.isEmpty()) {
            return Optional.empty();
        }

        if (candidates.size() == 1) {
            return Optional.of(candidates.get(0));
        }

        // 优先选择与输入领域匹配的意图
        for (String candidate : candidates) {
            if (isIntentInDomain(candidate, inputDomain)) {
                log.debug("选择领域匹配的意图: candidate='{}', domain={}", candidate, inputDomain);
                return Optional.of(candidate);
            }
        }

        // 检查是否存在功能等价的意图，如果有则选择第一个
        for (int i = 0; i < candidates.size(); i++) {
            for (int j = i + 1; j < candidates.size(); j++) {
                if (areFunctionallyEquivalent(candidates.get(i), candidates.get(j))) {
                    log.debug("存在功能等价意图，选择第一个: '{}' (等价于 '{}')",
                            candidates.get(i), candidates.get(j));
                    return Optional.of(candidates.get(i));
                }
            }
        }

        // 默认返回第一个
        return Optional.of(candidates.get(0));
    }
}
