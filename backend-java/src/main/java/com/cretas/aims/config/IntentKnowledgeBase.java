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
        // 注意：只使用实际存在于系统中的意图代码

        // 批次查询相关 - BATCH_QUERY_GROUP
        Set<String> batchGroup = Set.of(
                "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL"
        );
        for (String intent : batchGroup) {
            EQUIVALENT_INTENTS.put(intent, batchGroup);
        }

        // 设备状态相关 - EQUIPMENT_GROUP
        Set<String> equipmentStatusGroup = Set.of(
                "EQUIPMENT_STATS", "EQUIPMENT_LIST"
        );
        for (String intent : equipmentStatusGroup) {
            EQUIVALENT_INTENTS.put(intent, equipmentStatusGroup);
        }

        // 告警查询相关 - ALERT_GROUP
        Set<String> alertGroup = Set.of(
                "ALERT_LIST", "ALERT_DIAGNOSE", "EQUIPMENT_ALERT_LIST", "MATERIAL_LOW_STOCK_ALERT"
        );
        for (String intent : alertGroup) {
            EQUIVALENT_INTENTS.put(intent, alertGroup);
        }

        // 质量相关 - QUALITY_GROUP
        Set<String> qualityGroup = Set.of(
                "QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_QUALITY"
        );
        for (String intent : qualityGroup) {
            EQUIVALENT_INTENTS.put(intent, qualityGroup);
        }

        // 报表相关 - REPORT_GROUP
        Set<String> reportGroup = Set.of(
                "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_INVENTORY"
        );
        for (String intent : reportGroup) {
            EQUIVALENT_INTENTS.put(intent, reportGroup);
        }

        // 原料库存相关 - MATERIAL_GROUP
        Set<String> materialGroup = Set.of(
                "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY"
        );
        for (String intent : materialGroup) {
            EQUIVALENT_INTENTS.put(intent, materialGroup);
        }

        // 发货查询相关 - SHIPMENT_GROUP (只有单一意图，保留以便扩展)
        Set<String> shipmentGroup = Set.of(
                "SHIPMENT_QUERY"
        );
        for (String intent : shipmentGroup) {
            EQUIVALENT_INTENTS.put(intent, shipmentGroup);
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
                    "讲个笑话", "聊聊天", "无聊",
                    // === v5.2新增：P3优先级-扩展闲聊指示词 ===
                    "明天", "天气", "下雨", "你觉得", "随便", "有意思",
                    "唱", "歌", "写", "诗", "笑话", "聊聊", "闲聊"
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
        phraseToIntentMapping.put("设备状态", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("设备列表", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("设备故障", "EQUIPMENT_ALERT_LIST");
        phraseToIntentMapping.put("设备运行", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("设备概览", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("设备维护", "EQUIPMENT_MAINTENANCE");
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
        phraseToIntentMapping.put("称重数据", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤的状态", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("秤状态", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("称重状态", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("称重记录", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("读取重量", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("称重", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("读秤", "SCALE_DEVICE_DETAIL");

        // === 告警相关 ===
        phraseToIntentMapping.put("告警信息", "ALERT_LIST");
        phraseToIntentMapping.put("告警列表", "ALERT_LIST");
        phraseToIntentMapping.put("报警记录", "ALERT_LIST");
        phraseToIntentMapping.put("预警信息", "ALERT_LIST");
        phraseToIntentMapping.put("异常告警", "ALERT_LIST");

        // === 生产/加工相关 ===
        phraseToIntentMapping.put("生产批次", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("加工记录", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("生产记录", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("批次列表", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("批次查询", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("今日生产", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("生产进度", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("停止生产", "PROCESSING_BATCH_CANCEL");
        phraseToIntentMapping.put("暂停生产", "PROCESSING_BATCH_PAUSE");
        phraseToIntentMapping.put("恢复生产", "PROCESSING_BATCH_RESUME");
        // === v4.2优化：生产类短语映射补充 ===
        phraseToIntentMapping.put("正在生产的批次", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("生产订单", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("车间生产情况", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("全部批次信息", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("生产进度如何", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("登记生产批次", "PROCESSING_BATCH_CREATE");
        phraseToIntentMapping.put("安排生产任务", "PROCESSING_BATCH_CREATE");
        phraseToIntentMapping.put("新建生产批次", "PROCESSING_BATCH_CREATE");
        phraseToIntentMapping.put("启动这个批次", "PROCESSING_BATCH_START");
        phraseToIntentMapping.put("生产任务开始", "PROCESSING_BATCH_START");
        phraseToIntentMapping.put("开始生产", "PROCESSING_BATCH_START");
        phraseToIntentMapping.put("生产任务暂停", "PROCESSING_BATCH_PAUSE");
        phraseToIntentMapping.put("暂停这个批次", "PROCESSING_BATCH_PAUSE");
        phraseToIntentMapping.put("批次生产完了", "PROCESSING_BATCH_COMPLETE");
        phraseToIntentMapping.put("完成这个批次", "PROCESSING_BATCH_COMPLETE");
        phraseToIntentMapping.put("生产任务结束", "PROCESSING_BATCH_COMPLETE");
        phraseToIntentMapping.put("删除这个生产计划", "PROCESSING_BATCH_CANCEL");
        phraseToIntentMapping.put("作废生产任务", "PROCESSING_BATCH_CANCEL");
        phraseToIntentMapping.put("取消这个批次", "PROCESSING_BATCH_CANCEL");

        // === 质检相关 ===
        phraseToIntentMapping.put("质检记录", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("质检报告", "QUALITY_STATS");
        phraseToIntentMapping.put("质量检测", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("检验结果", "QUALITY_CHECK_QUERY");
        // === v4.2优化：质检类短语映射补充 ===
        phraseToIntentMapping.put("检验内容", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("质量要求", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("做质量检查", "QUALITY_CHECK_EXECUTE");
        phraseToIntentMapping.put("检查产品质量", "QUALITY_CHECK_EXECUTE");
        phraseToIntentMapping.put("执行质检", "QUALITY_CHECK_EXECUTE");
        phraseToIntentMapping.put("检验数据分析", "QUALITY_STATS");
        phraseToIntentMapping.put("质量统计", "QUALITY_STATS");
        phraseToIntentMapping.put("品质怎么样", "QUALITY_STATS");
        phraseToIntentMapping.put("处理不合格品", "QUALITY_DISPOSITION_EXECUTE");
        phraseToIntentMapping.put("次品怎么处理", "QUALITY_DISPOSITION_EXECUTE");
        phraseToIntentMapping.put("不合格品处理", "QUALITY_DISPOSITION_EXECUTE");

        // === 原料/物料相关 ===
        phraseToIntentMapping.put("原料入库", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("物料入库", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料批次", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料列表", "MATERIAL_BATCH_QUERY");
        // === v4.2优化：原料类短语映射补充 ===
        phraseToIntentMapping.put("原料有哪些", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("物料批次", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料库存情况", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("物料信息", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料批次列表", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("仓库原料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("材料清单", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料数量", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("库存不足预警", "MATERIAL_LOW_STOCK_ALERT");
        phraseToIntentMapping.put("即将到期的物料", "MATERIAL_EXPIRING_ALERT");
        phraseToIntentMapping.put("已失效物料", "MATERIAL_EXPIRED_QUERY");
        phraseToIntentMapping.put("不能用的原料", "MATERIAL_EXPIRED_QUERY");
        phraseToIntentMapping.put("应该用哪批原料", "MATERIAL_FIFO_RECOMMEND");
        phraseToIntentMapping.put("哪批原料该先用", "MATERIAL_FIFO_RECOMMEND");
        phraseToIntentMapping.put("修改库存", "MATERIAL_ADJUST_QUANTITY");

        // === 报表相关 ===
        phraseToIntentMapping.put("今日报表", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("日报表", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("生产报表", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("统计报表", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("数据报表", "REPORT_DASHBOARD_OVERVIEW");
        // === v4.2优化：报表类短语映射补充 ===
        phraseToIntentMapping.put("生产情况报告", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("今天生产了多少", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("产量报表", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("生产统计", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("产出报表", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("生产效率分析", "REPORT_EFFICIENCY");
        phraseToIntentMapping.put("效率报表", "REPORT_EFFICIENCY");
        phraseToIntentMapping.put("效率怎么样", "REPORT_EFFICIENCY");
        phraseToIntentMapping.put("库存够不够", "REPORT_INVENTORY");
        phraseToIntentMapping.put("库存报表", "REPORT_INVENTORY");
        phraseToIntentMapping.put("给我看看数据", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("厂里现在什么情况", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("今天忙不忙", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("最近怎么样", "REPORT_DASHBOARD_OVERVIEW");
        // === v4.2优化：报表类短语映射补充（冲92%）===
        phraseToIntentMapping.put("综合报表", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("首页数据", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("整体情况", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("产量数据", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("加工数据报表", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("物料库存报表", "REPORT_INVENTORY");
        phraseToIntentMapping.put("质量报表", "REPORT_QUALITY");
        phraseToIntentMapping.put("品质数据报告", "REPORT_QUALITY");
        phraseToIntentMapping.put("质检报表", "REPORT_QUALITY");
        phraseToIntentMapping.put("合格率报表", "REPORT_QUALITY");
        phraseToIntentMapping.put("质量分析报告", "REPORT_QUALITY");
        phraseToIntentMapping.put("品质报告", "REPORT_QUALITY");
        phraseToIntentMapping.put("设备效率报告", "REPORT_EFFICIENCY");
        phraseToIntentMapping.put("机器效率", "REPORT_EFFICIENCY");
        phraseToIntentMapping.put("产线效率", "REPORT_EFFICIENCY");

        // === 客户相关 ===
        phraseToIntentMapping.put("客户列表", "CUSTOMER_LIST");
        phraseToIntentMapping.put("客户信息", "CUSTOMER_SEARCH");
        phraseToIntentMapping.put("客户查询", "CUSTOMER_SEARCH");
        // === v4.2优化：客户类短语映射补充 ===
        phraseToIntentMapping.put("客户资料", "CUSTOMER_LIST");
        phraseToIntentMapping.put("所有客户", "CUSTOMER_LIST");
        phraseToIntentMapping.put("客户满意度如何", "CUSTOMER_STATS");
        phraseToIntentMapping.put("客户评价", "CUSTOMER_STATS");

        // === 用户/员工相关 ===
        phraseToIntentMapping.put("员工列表", "USER_CREATE");
        phraseToIntentMapping.put("用户信息", "USER_CREATE");

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
        // === v4.2优化：考勤类短语映射补充 ===
        phraseToIntentMapping.put("我先撤了", "CLOCK_OUT");
        phraseToIntentMapping.put("今天干完了", "CLOCK_OUT");
        phraseToIntentMapping.put("下班了", "CLOCK_OUT");
        phraseToIntentMapping.put("走了", "CLOCK_OUT");
        phraseToIntentMapping.put("考勤数据分析", "ATTENDANCE_STATS");
        phraseToIntentMapping.put("考勤统计", "ATTENDANCE_STATS");
        phraseToIntentMapping.put("考勤异常人员", "ATTENDANCE_ANOMALY");
        phraseToIntentMapping.put("考勤异常", "ATTENDANCE_ANOMALY");

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
        // === v4.2优化：溯源类短语映射补充 ===
        phraseToIntentMapping.put("追踪这个批次", "TRACE_BATCH");
        phraseToIntentMapping.put("消费者可查的溯源", "TRACE_PUBLIC");
        phraseToIntentMapping.put("可查溯源", "TRACE_PUBLIC");

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

        // === v4.2优化：告警类短语映射补充（解决ALERT混淆）===
        phraseToIntentMapping.put("系统警报", "ALERT_LIST");
        phraseToIntentMapping.put("异常提醒", "ALERT_LIST");
        phraseToIntentMapping.put("所有报警", "ALERT_LIST");
        phraseToIntentMapping.put("警报都有哪些", "ALERT_LIST");
        phraseToIntentMapping.put("报警汇总", "ALERT_LIST");
        phraseToIntentMapping.put("预警消息", "ALERT_LIST");
        phraseToIntentMapping.put("告警清单", "ALERT_LIST");
        phraseToIntentMapping.put("预警信息汇总", "ALERT_LIST");
        phraseToIntentMapping.put("有什么告警", "ALERT_LIST");
        phraseToIntentMapping.put("现在有哪些告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("进行中的警报", "ALERT_ACTIVE");
        phraseToIntentMapping.put("还没处理的告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("待解决的告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("未关闭的警报", "ALERT_ACTIVE");
        phraseToIntentMapping.put("活动中的告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("正在发生的异常", "ALERT_ACTIVE");
        phraseToIntentMapping.put("当前的异常", "ALERT_ACTIVE");
        phraseToIntentMapping.put("告警可以关了", "ALERT_RESOLVE");
        phraseToIntentMapping.put("完成告警处理", "ALERT_RESOLVE");
        phraseToIntentMapping.put("异常发生频率", "ALERT_STATS");
        // === v4.2优化：告警诊断短语映射 ===
        phraseToIntentMapping.put("告警怎么回事", "ALERT_DIAGNOSE");
        phraseToIntentMapping.put("为什么会报警", "ALERT_DIAGNOSE");
        phraseToIntentMapping.put("报警原因", "ALERT_DIAGNOSE");

        // === v5.0优化：告警统计类短语映射 ===
        phraseToIntentMapping.put("告警统计", "ALERT_STATS");
        phraseToIntentMapping.put("告警统计数据", "ALERT_STATS");
        phraseToIntentMapping.put("报警次数统计", "ALERT_STATS");
        phraseToIntentMapping.put("告警趋势", "ALERT_STATS");
        phraseToIntentMapping.put("警报数量分析", "ALERT_STATS");
        phraseToIntentMapping.put("告警数量", "ALERT_STATS");
        phraseToIntentMapping.put("告警汇总", "ALERT_STATS");
        phraseToIntentMapping.put("报警统计", "ALERT_STATS");
        phraseToIntentMapping.put("告警分析", "ALERT_STATS");
        phraseToIntentMapping.put("告警报表", "ALERT_STATS");

        // === v5.0优化：告警分级类短语映射 ===
        phraseToIntentMapping.put("严重告警", "ALERT_BY_LEVEL");
        phraseToIntentMapping.put("高级别警报", "ALERT_BY_LEVEL");
        phraseToIntentMapping.put("紧急级别告警", "ALERT_BY_LEVEL");
        phraseToIntentMapping.put("一般性告警", "ALERT_BY_LEVEL");
        phraseToIntentMapping.put("按级别查告警", "ALERT_BY_LEVEL");
        phraseToIntentMapping.put("告警级别", "ALERT_BY_LEVEL");
        phraseToIntentMapping.put("分级告警", "ALERT_BY_LEVEL");
        phraseToIntentMapping.put("高优先级告警", "ALERT_BY_LEVEL");
        phraseToIntentMapping.put("低优先级告警", "ALERT_BY_LEVEL");
        phraseToIntentMapping.put("预警监控平台", "ALERT_LIST");

        // === v4.2优化：设备类短语映射（解决EQUIPMENT混淆）===
        phraseToIntentMapping.put("有多少台设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("获取设备数据", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("调出设备信息", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("机台一览", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("工厂机器汇总", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("车间里有几台设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("查看某台设备", "EQUIPMENT_DETAIL");
        phraseToIntentMapping.put("设备基本情况", "EQUIPMENT_DETAIL");
        phraseToIntentMapping.put("设备型号查询", "EQUIPMENT_DETAIL");
        phraseToIntentMapping.put("具体设备状态", "EQUIPMENT_DETAIL");
        phraseToIntentMapping.put("机器利用率", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("机器警告列表", "EQUIPMENT_ALERT_LIST");
        phraseToIntentMapping.put("机台维护情况", "EQUIPMENT_MAINTENANCE");
        phraseToIntentMapping.put("设备检修安排", "EQUIPMENT_MAINTENANCE");

        // === v5.0优化：设备详情类短语映射 ===
        phraseToIntentMapping.put("设备详细信息", "EQUIPMENT_DETAIL");
        phraseToIntentMapping.put("设备具体参数", "EQUIPMENT_DETAIL");
        phraseToIntentMapping.put("机器详情", "EQUIPMENT_DETAIL");
        phraseToIntentMapping.put("某个设备的信息", "EQUIPMENT_DETAIL");
        phraseToIntentMapping.put("机台详细资料", "EQUIPMENT_DETAIL");
        phraseToIntentMapping.put("设备运维管理", "EQUIPMENT_MAINTENANCE");
        phraseToIntentMapping.put("设备健康监测", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("设备保修记录", "EQUIPMENT_MAINTENANCE");

        // === v5.0优化：设备列表类短语映射 ===
        phraseToIntentMapping.put("展示全部机器", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("看一下设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("设备汇总", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("机器都有什么", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("给我设备数量", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("厂里设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("生产设备情况", "EQUIPMENT_LIST");

        // === v4.1优化：秤类短语映射扩展（解决SCALE NONE问题）===
        phraseToIntentMapping.put("地磅列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("台秤列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("台秤清单", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("称重设备列表", "SCALE_LIST_DEVICES");
        // === v4.2优化：秤类短语映射补充（解决SCALE混淆）===
        phraseToIntentMapping.put("秤都在哪里", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("称重器材列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("看下秤的情况", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("查看某个秤", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("秤具体是什么型号", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("新增一个秤", "SCALE_ADD_DEVICE");
        phraseToIntentMapping.put("接入一台秤", "SCALE_ADD_DEVICE");
        phraseToIntentMapping.put("秤信息变更", "SCALE_UPDATE_DEVICE");
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

        // === v5.0优化：秤更新/删除类短语映射 ===
        phraseToIntentMapping.put("修改秤配置", "SCALE_UPDATE_DEVICE");
        phraseToIntentMapping.put("更新秤参数", "SCALE_UPDATE_DEVICE");
        phraseToIntentMapping.put("调整秤设置", "SCALE_UPDATE_DEVICE");
        phraseToIntentMapping.put("编辑秤资料", "SCALE_UPDATE_DEVICE");
        phraseToIntentMapping.put("修改秤信息", "SCALE_UPDATE_DEVICE");
        phraseToIntentMapping.put("更新称重设备", "SCALE_UPDATE_DEVICE");
        phraseToIntentMapping.put("秤配置修改", "SCALE_UPDATE_DEVICE");
        phraseToIntentMapping.put("删掉这个秤", "SCALE_DELETE_DEVICE");
        phraseToIntentMapping.put("移除秤设备", "SCALE_DELETE_DEVICE");
        phraseToIntentMapping.put("把秤去掉", "SCALE_DELETE_DEVICE");
        phraseToIntentMapping.put("注销秤", "SCALE_DELETE_DEVICE");
        phraseToIntentMapping.put("秤不用了删除", "SCALE_DELETE_DEVICE");
        phraseToIntentMapping.put("删除秤", "SCALE_DELETE_DEVICE");
        phraseToIntentMapping.put("移除称重设备", "SCALE_DELETE_DEVICE");
        phraseToIntentMapping.put("停用秤", "SCALE_DELETE_DEVICE");

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
        // === v4.2优化：出货类短语映射补充 ===
        phraseToIntentMapping.put("查一下出货", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("出货订单", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("出货情况如何", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("录入发货单", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("新增发货记录", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("某天的发货记录", "SHIPMENT_BY_DATE");
        phraseToIntentMapping.put("按日期查出货", "SHIPMENT_BY_DATE");
        phraseToIntentMapping.put("给谁发过货", "SHIPMENT_BY_CUSTOMER");
        phraseToIntentMapping.put("客户发货记录", "SHIPMENT_BY_CUSTOMER");
        phraseToIntentMapping.put("发给这个客户的货", "SHIPMENT_BY_CUSTOMER");
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

        // === v4.2优化：供应商类短语映射 ===
        phraseToIntentMapping.put("供应商列表", "SUPPLIER_LIST");
        phraseToIntentMapping.put("合作供应商", "SUPPLIER_LIST");
        phraseToIntentMapping.put("所有供应商", "SUPPLIER_LIST");
        phraseToIntentMapping.put("供应商表现怎样", "SUPPLIER_RANKING");
        phraseToIntentMapping.put("供应商排名", "SUPPLIER_RANKING");

        // === v4.2优化：系统配置类短语映射 ===
        phraseToIntentMapping.put("排产改为自动", "SCHEDULING_SET_AUTO");
        phraseToIntentMapping.put("开启自动排产", "SCHEDULING_SET_AUTO");
        phraseToIntentMapping.put("改为人工排产", "SCHEDULING_SET_MANUAL");
        phraseToIntentMapping.put("切换功能状态", "FACTORY_FEATURE_TOGGLE");
        phraseToIntentMapping.put("修改规则", "RULE_CONFIG");
        phraseToIntentMapping.put("规则修改", "RULE_CONFIG");

        // === v4.2优化：出货类补充 ===
        phraseToIntentMapping.put("配送订单", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("安排出货", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("安排发货任务", "SHIPMENT_CREATE");

        // === v4.2优化：原料类补充 ===
        phraseToIntentMapping.put("快要过期的材料", "MATERIAL_EXPIRING_ALERT");
        phraseToIntentMapping.put("即将过期原料", "MATERIAL_EXPIRING_ALERT");
        phraseToIntentMapping.put("调整原料数量", "MATERIAL_ADJUST_QUANTITY");
        phraseToIntentMapping.put("原料数量变更", "MATERIAL_ADJUST_QUANTITY");

        // === v4.2优化：客户类补充 ===
        phraseToIntentMapping.put("合作客户", "CUSTOMER_LIST");
        phraseToIntentMapping.put("查找某个客户", "CUSTOMER_SEARCH");
        phraseToIntentMapping.put("搜索客户", "CUSTOMER_SEARCH");
        phraseToIntentMapping.put("活跃客户列表", "CUSTOMER_ACTIVE");
        phraseToIntentMapping.put("活跃客户", "CUSTOMER_ACTIVE");
        phraseToIntentMapping.put("客户分析", "CUSTOMER_STATS");

        // === v4.2优化：用户类补充 ===
        phraseToIntentMapping.put("调整用户角色", "USER_ROLE_ASSIGN");
        phraseToIntentMapping.put("用户权限调整", "USER_ROLE_ASSIGN");

        // === v4.2优化：生产类补充 ===
        phraseToIntentMapping.put("重新开始生产", "PROCESSING_BATCH_RESUME");
        phraseToIntentMapping.put("继续生产", "PROCESSING_BATCH_RESUME");

        // === v4.2优化：质检类补充 ===
        phraseToIntentMapping.put("质量问题处置", "QUALITY_DISPOSITION_EXECUTE");
        phraseToIntentMapping.put("处置质量问题", "QUALITY_DISPOSITION_EXECUTE");

        // === v5.0优化：E类-短输入领域映射 ===
        // 秤领域短输入
        phraseToIntentMapping.put("秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("智能秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("IoT秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤设备", "SCALE_LIST_DEVICES");
        // 告警领域短输入
        phraseToIntentMapping.put("告警", "ALERT_LIST");
        phraseToIntentMapping.put("预警", "ALERT_LIST");
        phraseToIntentMapping.put("警报", "ALERT_LIST");
        phraseToIntentMapping.put("异常", "ALERT_LIST");
        phraseToIntentMapping.put("报警", "ALERT_LIST");
        // 原料领域短输入
        phraseToIntentMapping.put("原料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("物料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("材料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原材料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("辅料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("库存", "REPORT_INVENTORY");
        // 生产领域短输入
        phraseToIntentMapping.put("生产", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("批次", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("加工", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("产量", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("产出", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("生产线", "PROCESSING_BATCH_LIST");
        // 质检领域短输入
        phraseToIntentMapping.put("质检", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("品质", "QUALITY_STATS");
        phraseToIntentMapping.put("质量", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("检验", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("合格率", "QUALITY_STATS");
        phraseToIntentMapping.put("不良品", "QUALITY_DISPOSITION_EXECUTE");

        // === v5.0优化：F类-操作+领域组合 ===
        // 查询操作
        phraseToIntentMapping.put("查询设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("列出批次", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("有哪些原料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("显示告警", "ALERT_LIST");
        phraseToIntentMapping.put("获取发货", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("搜索质检", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("查找秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("统计报表", "REPORT_DASHBOARD_OVERVIEW");
        // 创建操作
        phraseToIntentMapping.put("新建批次", "PROCESSING_BATCH_CREATE");
        phraseToIntentMapping.put("创建发货单", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("添加设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("新增原料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("录入质检", "QUALITY_CHECK_EXECUTE");
        phraseToIntentMapping.put("登记批次", "PROCESSING_BATCH_CREATE");
        phraseToIntentMapping.put("建立发货", "SHIPMENT_CREATE");
        phraseToIntentMapping.put("生成报表", "REPORT_PRODUCTION");
        // 删除/取消操作
        phraseToIntentMapping.put("删除设备", "SCALE_DELETE_DEVICE");
        phraseToIntentMapping.put("取消批次", "PROCESSING_BATCH_CANCEL");
        phraseToIntentMapping.put("作废发货", "SHIPMENT_UPDATE");
        phraseToIntentMapping.put("清除告警", "ALERT_ACKNOWLEDGE");
        // 更新操作
        phraseToIntentMapping.put("修改设备", "EQUIPMENT_STATUS_UPDATE");
        phraseToIntentMapping.put("更新批次", "PROCESSING_BATCH_DETAIL");
        phraseToIntentMapping.put("编辑发货", "SHIPMENT_UPDATE");
        phraseToIntentMapping.put("设置告警", "RULE_CONFIG");

        // === v5.0优化：D类-更多负向词排斥场景的正向映射 ===
        phraseToIntentMapping.put("列出秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤的列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("所有的秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("查看秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤有多少", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤的数目", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤设备查询", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("查询秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤的清单列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("看看秤", "SCALE_LIST_DEVICES");
        // 告警活跃类
        phraseToIntentMapping.put("活跃的告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("当前的警报", "ALERT_ACTIVE");
        phraseToIntentMapping.put("未处理的告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("进行中告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("正在发生警报", "ALERT_ACTIVE");
        phraseToIntentMapping.put("实时告警信息", "ALERT_ACTIVE");
        phraseToIntentMapping.put("最新的告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("紧急的警报", "ALERT_ACTIVE");
        phraseToIntentMapping.put("待处理告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("还未关闭告警", "ALERT_ACTIVE");
        // 原料查询类
        phraseToIntentMapping.put("查询原料库存", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料查看", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("物料列表查询", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料清单查看", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("查看物料统计", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料有什么", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("物料查询统计", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料情况查看", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("查原料清单", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("看原料列表", "MATERIAL_BATCH_QUERY");
        // 生产控制类
        phraseToIntentMapping.put("取消生产", "PROCESSING_BATCH_CANCEL");
        phraseToIntentMapping.put("作废批次", "PROCESSING_BATCH_CANCEL");
        phraseToIntentMapping.put("取消这个批次", "PROCESSING_BATCH_CANCEL");
        phraseToIntentMapping.put("生产任务作废", "PROCESSING_BATCH_CANCEL");
        phraseToIntentMapping.put("撤销生产计划", "PROCESSING_BATCH_CANCEL");
        phraseToIntentMapping.put("启动批次", "PROCESSING_BATCH_START");
        phraseToIntentMapping.put("完成生产", "PROCESSING_BATCH_COMPLETE");
        phraseToIntentMapping.put("结束批次", "PROCESSING_BATCH_COMPLETE");
        phraseToIntentMapping.put("暂停生产", "PROCESSING_BATCH_PAUSE");

        // === v5.0优化：H类-高置信短语 ===
        phraseToIntentMapping.put("发货查询", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("库存查询", "REPORT_INVENTORY");
        phraseToIntentMapping.put("设备状态", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("告警列表", "ALERT_LIST");
        phraseToIntentMapping.put("质检记录", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("生产批次", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("原料批次", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("秤列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("今日生产", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("设备列表", "EQUIPMENT_LIST");

        // === v5.0优化：H类边界-更多场景映射 ===
        phraseToIntentMapping.put("设备情况怎么样", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("生产进度如何", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("原料够不够用", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("质量有问题吗", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("发货正常吗", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("告警严重吗", "ALERT_LIST");
        phraseToIntentMapping.put("秤准不准", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("效率高不高", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("库存足够吗", "REPORT_INVENTORY");
        phraseToIntentMapping.put("进度快不快", "PROCESSING_BATCH_LIST");

        // === v5.0优化：J类-学习表达映射 ===
        phraseToIntentMapping.put("显示所有设备清单", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("我要看全部机器", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("查看今日的产量数据", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("统计一下发货情况", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("列出所有原料批次", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("展示质检结果报告", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("查询告警信息列表", "ALERT_LIST");
        phraseToIntentMapping.put("获取秤设备数据", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("显示生产批次进度", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("查看库存报表", "REPORT_INVENTORY");
        phraseToIntentMapping.put("统计设备运行数据", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("列出发货单明细", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("查询原料库存量", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("获取质量统计数据", "QUALITY_STATS");
        phraseToIntentMapping.put("显示所有告警记录", "ALERT_LIST");
        // 中置信度口语
        phraseToIntentMapping.put("机器状态怎样", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("产品做好了没", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("东西发走了吗", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("材料还有没", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("检测过了吗", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("有警告吗", "ALERT_LIST");
        phraseToIntentMapping.put("称了多少", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("产线忙不忙", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("仓库有货吗", "REPORT_INVENTORY");
        phraseToIntentMapping.put("设备转着呢", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("单子出了", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("料够用", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("品质OK", "QUALITY_STATS");
        phraseToIntentMapping.put("有异常", "ALERT_LIST");
        phraseToIntentMapping.put("秤好使", "SCALE_DEVICE_DETAIL");
        // 正向反馈类
        phraseToIntentMapping.put("设备运行状态概览", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("生产批次完成进度", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("发货订单追踪查询", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("原料库存盘点清单", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("质量检测合格统计", "QUALITY_STATS");
        phraseToIntentMapping.put("告警事件处理记录", "ALERT_LIST");
        phraseToIntentMapping.put("称重设备在线状态", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("生产效率分析报表", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("库存预警提醒", "MATERIAL_LOW_STOCK_ALERT");
        phraseToIntentMapping.put("设备维护保养计划", "EQUIPMENT_MAINTENANCE");
        phraseToIntentMapping.put("机台运转情况", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("工单执行状态", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("物流配送进度", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("物资存储情况", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("品控检测结果", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("异常报警汇总", "ALERT_LIST");
        phraseToIntentMapping.put("电子秤读数记录", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("产能利用率报告", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("原料消耗预警", "MATERIAL_LOW_STOCK_ALERT");
        phraseToIntentMapping.put("设备保修记录", "EQUIPMENT_MAINTENANCE");

        // === v5.0优化：K类-版本控制/行业术语映射 ===
        phraseToIntentMapping.put("设备运维管理", "EQUIPMENT_MAINTENANCE");
        phraseToIntentMapping.put("产线作业进度", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("出库发运记录", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("物料领用清单", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("品质管控数据", "QUALITY_STATS");
        phraseToIntentMapping.put("告警通知中心", "ALERT_LIST");
        phraseToIntentMapping.put("计量设备管理", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("生产计划看板", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("仓储管理报表", "REPORT_INVENTORY");
        phraseToIntentMapping.put("设备健康监测", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("全厂设备一览", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("车间生产汇总", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("发货业务统计", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("原辅料库存表", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("质量管理系统", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("预警监控平台", "ALERT_LIST");
        phraseToIntentMapping.put("智能称重系统", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("制造执行系统", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("经营分析报表", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("资产管理系统", "EQUIPMENT_LIST");

        // === v5.0优化：B类-更多负向词相关映射 ===
        // 秤列表变体
        phraseToIntentMapping.put("秤有几个", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("智能秤有哪些", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("查看所有秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("列出全部秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤的清单", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("工厂有多少秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("称重设备一览", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤设备统计", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("现有的秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("可用的秤列表", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("在线的秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤都有什么", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("哪些秤在用", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤设备总数", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("联网的秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤的数量", "SCALE_LIST_DEVICES");
        // 告警活跃变体
        phraseToIntentMapping.put("待处理的告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("未解决的警报", "ALERT_ACTIVE");
        phraseToIntentMapping.put("正在发生的警报", "ALERT_ACTIVE");
        phraseToIntentMapping.put("进行中的告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("还有什么告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("现有告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("待解决警报", "ALERT_ACTIVE");
        phraseToIntentMapping.put("尚未关闭的告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("今日告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("紧急告警", "ALERT_ACTIVE");
        phraseToIntentMapping.put("最新告警", "ALERT_ACTIVE");
        // 告警其他
        phraseToIntentMapping.put("告警情况", "ALERT_LIST");
        phraseToIntentMapping.put("历史告警", "ALERT_LIST");
        phraseToIntentMapping.put("告警记录", "ALERT_LIST");
        // 原料查询变体
        phraseToIntentMapping.put("原料清单", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("物料统计", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("查询原料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料有哪些", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("查看物料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料库存查询", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("物料列表", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料汇总", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("材料情况", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料总量", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("仓库物料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料概览", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("物料明细", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料状态", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("物料数据", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料信息", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("查原料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("看原料", "MATERIAL_BATCH_QUERY");

        // === v5.0优化：A类-秤相关映射 ===
        phraseToIntentMapping.put("称重记录查询", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤的详细状态", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("读取秤重量", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("IoT秤管理", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤的称重数据", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("最近称重记录", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤设备概览", "SCALE_LIST_DEVICES");

        // === v5.0优化：C类-口语表达映射 ===
        phraseToIntentMapping.put("这批货咋样了", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("货发了没", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("东西做完了吗", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("料够不够", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("机器有事儿没", "EQUIPMENT_ALERT_LIST");
        phraseToIntentMapping.put("秤好使不", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("质量咋样", "QUALITY_STATS");
        phraseToIntentMapping.put("今儿干了多少", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("告警有没有", "ALERT_LIST");
        phraseToIntentMapping.put("活儿干完没", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("发出去了吗", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("机子转着呢吗", "EQUIPMENT_STATS");
        // 语义区分
        phraseToIntentMapping.put("设备状况", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("设备问题", "EQUIPMENT_ALERT_LIST");
        phraseToIntentMapping.put("生产情况", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("生产问题", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("原料状况", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料问题", "MATERIAL_LOW_STOCK_ALERT");
        phraseToIntentMapping.put("质量情况", "QUALITY_STATS");
        phraseToIntentMapping.put("质量问题", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("发货状况", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("发货问题", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("告警情况", "ALERT_LIST");
        phraseToIntentMapping.put("告警问题", "ALERT_LIST");
        phraseToIntentMapping.put("秤的状况", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("秤的问题", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("报表状况", "REPORT_DASHBOARD_OVERVIEW");

        // === v5.0优化：G类-操作指令短输入 ===
        phraseToIntentMapping.put("查库存", "REPORT_INVENTORY");
        phraseToIntentMapping.put("创建批次", "PROCESSING_BATCH_CREATE");
        phraseToIntentMapping.put("看发货", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("查设备", "EQUIPMENT_LIST");
        phraseToIntentMapping.put("看告警", "ALERT_LIST");
        phraseToIntentMapping.put("查质检", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("看秤", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("查原料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("看报表", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("查生产", "PROCESSING_BATCH_LIST");

        // === v5.0优化：C类-行业术语映射 ===
        phraseToIntentMapping.put("MES状态", "EQUIPMENT_STATS");  // v5.2修正：测试期望EQUIPMENT_STATS
        phraseToIntentMapping.put("OEE数据", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("PLC数据", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("AGV状态", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("SPC图表", "QUALITY_STATS");
        phraseToIntentMapping.put("WIP查询", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("QC结果", "QUALITY_CHECK_QUERY");
        // === v5.2新增：C类术语扩展 ===
        phraseToIntentMapping.put("ERP订单", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("SCADA监控", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("KPI报表", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("SLA统计", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("DOC管理", "REPORT_DASHBOARD_OVERVIEW");
        phraseToIntentMapping.put("BOM物料", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("FIFO推荐", "MATERIAL_FIFO_RECOMMEND");
        phraseToIntentMapping.put("IoT设备", "EQUIPMENT_LIST");

        // === v5.0优化：补充测试覆盖短语映射 ===
        // 秤数据查询类 (SCALE_LIST_DEVICES)
        phraseToIntentMapping.put("称重记录查询", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("称重记录", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤的称重数据", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("最近称重记录", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("称重数据", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("称重历史", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("过磅记录", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("过磅数据", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("秤记录", "SCALE_LIST_DEVICES");

        // 告警列表类补充 (ALERT_LIST)
        phraseToIntentMapping.put("告警情况", "ALERT_LIST");
        phraseToIntentMapping.put("告警记录", "ALERT_LIST");
        phraseToIntentMapping.put("异常报警汇总", "ALERT_LIST");
        phraseToIntentMapping.put("告警事件处理记录", "ALERT_LIST");

        // 告警历史类 (ALERT_HISTORY)
        phraseToIntentMapping.put("历史告警", "ALERT_LIST");
        phraseToIntentMapping.put("过去的告警", "ALERT_LIST");
        phraseToIntentMapping.put("告警历史记录", "ALERT_LIST");

        // 发货查询类补充 (SHIPMENT_QUERY)
        phraseToIntentMapping.put("出库单", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("运输记录", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("装车单", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("发货物流状态", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("发货订单明细", "SHIPMENT_QUERY");

        // 生产报告类 (REPORT_PRODUCTION)
        phraseToIntentMapping.put("今日生产进度", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("当天产量多少", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("今天做了多少", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("生产效率报表", "REPORT_PRODUCTION");

        // 物料查询类 (MATERIAL_BATCH_QUERY)
        phraseToIntentMapping.put("物料库存情况", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("原料消耗统计", "MATERIAL_BATCH_QUERY");

        // 物料预警类 (MATERIAL_LOW_STOCK_ALERT)
        phraseToIntentMapping.put("原料库存预警", "MATERIAL_LOW_STOCK_ALERT");

        // 设备统计类 (EQUIPMENT_STATS)
        phraseToIntentMapping.put("设备状态和告警", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("设备运行统计", "EQUIPMENT_STATS");

        // === v5.0优化 Phase2：覆盖剩余失败用例 ===

        // 秤数据查询补充
        phraseToIntentMapping.put("秤的称重数据", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("称了多少", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("获取秤设备数据", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("电子秤读数记录", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("过磅数据", "SCALE_LIST_DEVICES");
        phraseToIntentMapping.put("过磅记录", "SCALE_LIST_DEVICES");

        // 告警列表补充
        phraseToIntentMapping.put("告警有没有", "ALERT_LIST");
        phraseToIntentMapping.put("告警问题", "ALERT_LIST");
        phraseToIntentMapping.put("有警告吗", "ALERT_LIST");
        phraseToIntentMapping.put("有异常", "ALERT_LIST");
        phraseToIntentMapping.put("看告警", "ALERT_LIST");
        phraseToIntentMapping.put("异常报警汇总", "ALERT_LIST");
        phraseToIntentMapping.put("显示所有告警记录", "ALERT_LIST");
        phraseToIntentMapping.put("预警监控平台", "ALERT_LIST");

        // 设备统计补充
        phraseToIntentMapping.put("设备状态", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("机器状态怎样", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("机器有事儿没", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("机子转着呢吗", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("设备情况怎么样", "EQUIPMENT_STATS");
        phraseToIntentMapping.put("设备健康监测", "EQUIPMENT_STATS");

        // 发货日期查询
        phraseToIntentMapping.put("昨天发了多少货", "SHIPMENT_BY_DATE");
        phraseToIntentMapping.put("本周发货统计", "SHIPMENT_BY_DATE");
        phraseToIntentMapping.put("上个月的出货量", "SHIPMENT_BY_DATE");
        phraseToIntentMapping.put("发货时间统计", "SHIPMENT_BY_DATE");

        // 生产报告补充
        phraseToIntentMapping.put("今日生产", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("今儿干了多少", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("查看今日的产量数据", "REPORT_PRODUCTION");

        // 发货查询补充
        phraseToIntentMapping.put("装车单", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("托运单", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("出货凭证", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("货发了没", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("发出去了吗", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("单子出了", "SHIPMENT_QUERY");

        // 生产批次列表补充
        phraseToIntentMapping.put("这批货咋样了", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("东西做完了吗", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("活儿干完没", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("产品做好了没", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("生产完成情况", "PROCESSING_BATCH_LIST");

        // 质量统计补充
        phraseToIntentMapping.put("质检结果统计", "QUALITY_STATS");
        phraseToIntentMapping.put("质量趋势分析", "QUALITY_STATS");
        phraseToIntentMapping.put("品质OK", "QUALITY_STATS");
        phraseToIntentMapping.put("SPC图表", "QUALITY_STATS");

        // 设备维护补充
        phraseToIntentMapping.put("设备运维管理", "EQUIPMENT_MAINTENANCE");
        phraseToIntentMapping.put("设备保修记录", "EQUIPMENT_MAINTENANCE");

        // 历史告警
        phraseToIntentMapping.put("历史告警", "ALERT_LIST");

        // === v5.1新增：装饰系统/首页布局相关映射 ===
        // 布局更新类 (HOME_LAYOUT_UPDATE)
        phraseToIntentMapping.put("调整布局", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("移动模块", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("隐藏模块", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("显示模块", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("调整顺序", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("移到顶部", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("移到底部", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("放到上面", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("放到下面", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("放大模块", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("缩小模块", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("把AI洞察移到顶部", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("隐藏开发工具", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("显示AI洞察", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("隐藏欢迎卡片", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("调整首页布局", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("改变布局", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("修改首页", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("自定义首页", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("首页排序", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("模块排序", "HOME_LAYOUT_UPDATE");
        phraseToIntentMapping.put("首页配置", "HOME_LAYOUT_UPDATE");

        // 布局生成类 (HOME_LAYOUT_GENERATE)
        phraseToIntentMapping.put("生成布局", "HOME_LAYOUT_GENERATE");
        phraseToIntentMapping.put("推荐布局", "HOME_LAYOUT_GENERATE");
        phraseToIntentMapping.put("设计首页", "HOME_LAYOUT_GENERATE");
        phraseToIntentMapping.put("自动布局", "HOME_LAYOUT_GENERATE");
        phraseToIntentMapping.put("优化首页", "HOME_LAYOUT_GENERATE");
        phraseToIntentMapping.put("AI生成布局", "HOME_LAYOUT_GENERATE");
        phraseToIntentMapping.put("智能布局", "HOME_LAYOUT_GENERATE");
        phraseToIntentMapping.put("帮我设计首页", "HOME_LAYOUT_GENERATE");
        phraseToIntentMapping.put("给我一个好看的布局", "HOME_LAYOUT_GENERATE");
        phraseToIntentMapping.put("重新设计首页", "HOME_LAYOUT_GENERATE");
        phraseToIntentMapping.put("换个布局", "HOME_LAYOUT_GENERATE");
        phraseToIntentMapping.put("新布局方案", "HOME_LAYOUT_GENERATE");

        // 布局建议类 (HOME_LAYOUT_SUGGEST)
        phraseToIntentMapping.put("布局建议", "HOME_LAYOUT_SUGGEST");
        phraseToIntentMapping.put("分析使用习惯", "HOME_LAYOUT_SUGGEST");
        phraseToIntentMapping.put("推荐排序", "HOME_LAYOUT_SUGGEST");
        phraseToIntentMapping.put("首页优化建议", "HOME_LAYOUT_SUGGEST");
        phraseToIntentMapping.put("布局优化建议", "HOME_LAYOUT_SUGGEST");
        phraseToIntentMapping.put("怎么排布局好", "HOME_LAYOUT_SUGGEST");
        phraseToIntentMapping.put("首页怎么布置", "HOME_LAYOUT_SUGGEST");
        phraseToIntentMapping.put("布局有什么建议", "HOME_LAYOUT_SUGGEST");
        phraseToIntentMapping.put("分析我的使用习惯", "HOME_LAYOUT_SUGGEST");

        // === v6.1新增：页面设计/低代码相关映射 ===
        // 页面生成类 (PAGE_GENERATE)
        phraseToIntentMapping.put("生成页面", "PAGE_GENERATE");
        phraseToIntentMapping.put("创建页面", "PAGE_GENERATE");
        phraseToIntentMapping.put("AI设计页面", "PAGE_GENERATE");
        // 组件添加类 (PAGE_COMPONENT_ADD)
        phraseToIntentMapping.put("添加组件", "PAGE_COMPONENT_ADD");
        phraseToIntentMapping.put("放一个", "PAGE_COMPONENT_ADD");
        phraseToIntentMapping.put("加入组件", "PAGE_COMPONENT_ADD");
        // 样式更新类 (PAGE_STYLE_UPDATE)
        phraseToIntentMapping.put("修改样式", "PAGE_STYLE_UPDATE");
        phraseToIntentMapping.put("改主题", "PAGE_STYLE_UPDATE");
        phraseToIntentMapping.put("换颜色", "PAGE_STYLE_UPDATE");
        // 数据绑定类 (PAGE_DATA_BIND)
        phraseToIntentMapping.put("绑定数据", "PAGE_DATA_BIND");
        phraseToIntentMapping.put("连接数据", "PAGE_DATA_BIND");

        // === v5.2新增：P0优先级-口语/方言映射 ===
        phraseToIntentMapping.put("出货情况汇总", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("生产计划安排", "PROCESSING_BATCH_CREATE");
        phraseToIntentMapping.put("库里还有啥", "MATERIAL_BATCH_QUERY");
        phraseToIntentMapping.put("检了没", "QUALITY_CHECK_QUERY");
        phraseToIntentMapping.put("单子出了没", "SHIPMENT_QUERY");

        // === v6.0优化：修复返回 None 的口语化表达 ===
        // 产量/生产相关口语
        phraseToIntentMapping.put("干得怎么样了", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("产量出来没", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("产量跟白班比", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("夜班的产量", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("今天早上开工到现在", "REPORT_PRODUCTION");
        phraseToIntentMapping.put("产出情况给我说说", "REPORT_PRODUCTION");

        // 任务/活儿 相关口语
        phraseToIntentMapping.put("活儿排好了没", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("明天的活儿", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("活儿先建好", "PROCESSING_BATCH_CREATE");
        phraseToIntentMapping.put("进度怎么样了", "PROCESSING_BATCH_LIST");
        phraseToIntentMapping.put("各条线进度", "PROCESSING_BATCH_LIST");

        // 质量相关口语
        phraseToIntentMapping.put("合格率比上个月", "QUALITY_STATS");
        phraseToIntentMapping.put("不良率的趋势", "QUALITY_STATS");
        phraseToIntentMapping.put("次品怎么处理", "QUALITY_DISPOSITION_EXECUTE");
        phraseToIntentMapping.put("不合格品记录在哪", "QUALITY_DISPOSITION_EXECUTE");

        // 发货相关口语
        phraseToIntentMapping.put("发货进度", "SHIPMENT_QUERY");
        phraseToIntentMapping.put("发货量跟上个月比", "SHIPMENT_STATS");
        phraseToIntentMapping.put("明天的发货安排", "SHIPMENT_QUERY");

        // 库存/原料相关口语
        phraseToIntentMapping.put("库存周转怎么样", "REPORT_INVENTORY");
        phraseToIntentMapping.put("原料不够了怎么办", "MATERIAL_LOW_STOCK_ALERT");
        phraseToIntentMapping.put("没原料了", "MATERIAL_LOW_STOCK_ALERT");

        // 成本/费用查询相关
        phraseToIntentMapping.put("成本查询", "COST_QUERY");
        phraseToIntentMapping.put("查看成本", "COST_QUERY");
        phraseToIntentMapping.put("成本多少", "COST_QUERY");
        phraseToIntentMapping.put("花了多少钱", "COST_QUERY");
        phraseToIntentMapping.put("钱花哪了", "COST_QUERY");
        phraseToIntentMapping.put("成本控制", "COST_QUERY");
        phraseToIntentMapping.put("费用明细", "COST_QUERY");
        phraseToIntentMapping.put("成本控制得怎么样", "COST_QUERY");
        phraseToIntentMapping.put("成本跟预算比", "COST_QUERY");
        phraseToIntentMapping.put("这块成本", "COST_QUERY");
        phraseToIntentMapping.put("查费用", "COST_QUERY");
        phraseToIntentMapping.put("看费用", "COST_QUERY");
        phraseToIntentMapping.put("费用查询", "COST_QUERY");
        phraseToIntentMapping.put("花销情况", "COST_QUERY");
        phraseToIntentMapping.put("开支情况", "COST_QUERY");
        phraseToIntentMapping.put("支出情况", "COST_QUERY");
        phraseToIntentMapping.put("花费多少", "COST_QUERY");
        phraseToIntentMapping.put("成本情况", "COST_QUERY");
        phraseToIntentMapping.put("费用怎么样", "COST_QUERY");
        phraseToIntentMapping.put("成本怎么样", "COST_QUERY");
        phraseToIntentMapping.put("钱花在哪", "COST_QUERY");
        // V6测试覆盖: 成本查询补充
        phraseToIntentMapping.put("成本这块控制得怎么样", "COST_QUERY");
        phraseToIntentMapping.put("本月成本花了多少", "COST_QUERY");
        phraseToIntentMapping.put("成本跟预算比怎么样", "COST_QUERY");
        phraseToIntentMapping.put("哪块成本最高", "COST_QUERY");
        phraseToIntentMapping.put("人工成本多少", "COST_QUERY");
        phraseToIntentMapping.put("人工成本", "COST_QUERY");
        phraseToIntentMapping.put("材料成本统计", "COST_QUERY");
        phraseToIntentMapping.put("材料成本", "COST_QUERY");
        phraseToIntentMapping.put("制造费用", "COST_QUERY");
        phraseToIntentMapping.put("各产品的成本和利润对比", "COST_QUERY");
        phraseToIntentMapping.put("成本和利润", "COST_QUERY");
        phraseToIntentMapping.put("哪个产品最赚钱", "COST_QUERY");
        phraseToIntentMapping.put("成本排名", "COST_QUERY");
        phraseToIntentMapping.put("成本超预算的项目", "COST_QUERY");
        phraseToIntentMapping.put("成本超预算", "COST_QUERY");
        // 成本趋势分析
        phraseToIntentMapping.put("成本趋势分析", "COST_TREND_ANALYSIS");
        phraseToIntentMapping.put("成本趋势", "COST_TREND_ANALYSIS");
        phraseToIntentMapping.put("成本环比", "COST_TREND_ANALYSIS");
        phraseToIntentMapping.put("降本增效情况", "COST_TREND_ANALYSIS");
        phraseToIntentMapping.put("降本增效", "COST_TREND_ANALYSIS");

        // 秤/设备相关口语
        phraseToIntentMapping.put("秤不显示了", "SCALE_DEVICE_DETAIL");
        phraseToIntentMapping.put("秤怎么办", "SCALE_DEVICE_DETAIL");

        // 交接班相关
        phraseToIntentMapping.put("交接班要注意什么", "PROCESSING_BATCH_LIST");

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

        // 装饰/首页布局领域
        domainKeywords.put(Domain.DECORATION, new HashSet<>(Set.of(
                "布局", "首页", "模块", "卡片", "排列", "顺序", "显示", "隐藏",
                "调整", "移动", "放大", "缩小", "装饰", "自定义",
                "layout", "home", "module", "card", "arrange", "decoration"
        )));

        // 页面设计领域
        domainKeywords.put(Domain.PAGE_DESIGN, new HashSet<>(Set.of(
                "页面", "设计", "组件", "添加组件", "样式", "主题", "数据绑定",
                "创建页面", "生成页面", "低代码", "自定义页面",
                "page", "design", "component", "style", "theme", "lowcode"
        )));

        // 财务/成本领域
        domainKeywords.put(Domain.FINANCE, new HashSet<>(Set.of(
                "成本", "费用", "花销", "开支", "钱", "花费", "支出",
                "预算", "财务", "账目", "账单", "金额",
                "cost", "expense", "budget", "finance", "money"
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
     * 意图粒度枚举 - v6.0语义优先架构
     *
     * <p>用于区分用户查询的粒度级别：列表/详情/统计/通用查询</p>
     */
    public enum Granularity {
        /** 列表查询 - 查看多条记录 */
        LIST,
        /** 详情查询 - 查看单条记录的具体信息 */
        DETAIL,
        /** 统计查询 - 聚合、汇总、对比数据 */
        STATS,
        /** 通用查询 - 兼容LIST和DETAIL */
        QUERY,
        /** 无法判断 */
        UNKNOWN
    }

    // ========== 粒度检测配置 ==========

    /** 列表粒度指示词 */
    private static final Set<String> LIST_INDICATORS = Set.of(
            "这些", "有哪些", "都有啥", "列一下", "清单", "所有",
            "多少", "几个", "哪些", "列表", "全部"
    );

    /** 详情粒度指示词 */
    private static final Set<String> DETAIL_INDICATORS = Set.of(
            "那个", "这个", "那批", "具体", "详细", "信息",
            "查一下", "看看", "是什么"
    );

    /** 统计粒度指示词 */
    private static final Set<String> STATS_INDICATORS = Set.of(
            "汇总", "统计", "排名", "对比", "占比", "总共",
            "趋势", "报表", "分析", "平均", "最多", "最少"
    );

    /**
     * 检测用户输入的粒度
     *
     * @param userInput 用户输入
     * @return 检测到的粒度
     */
    public Granularity detectGranularity(String userInput) {
        if (userInput == null || userInput.isEmpty()) {
            return Granularity.UNKNOWN;
        }

        String normalizedInput = userInput.toLowerCase();

        // 统计各粒度指示词命中数
        int listHits = 0;
        int detailHits = 0;
        int statsHits = 0;

        for (String indicator : LIST_INDICATORS) {
            if (normalizedInput.contains(indicator)) listHits++;
        }
        for (String indicator : DETAIL_INDICATORS) {
            if (normalizedInput.contains(indicator)) detailHits++;
        }
        for (String indicator : STATS_INDICATORS) {
            if (normalizedInput.contains(indicator)) statsHits++;
        }

        // 根据命中数判断粒度
        if (statsHits > 0 && statsHits >= listHits && statsHits >= detailHits) {
            return Granularity.STATS;
        }
        if (listHits > detailHits) {
            return Granularity.LIST;
        }
        if (detailHits > 0) {
            return Granularity.DETAIL;
        }

        return Granularity.QUERY;  // 默认为通用查询
    }

    /**
     * 根据意图代码推断粒度
     *
     * @param intentCode 意图代码
     * @return 意图的粒度
     */
    public Granularity getIntentGranularity(String intentCode) {
        if (intentCode == null) return Granularity.UNKNOWN;

        String upper = intentCode.toUpperCase();

        if (upper.endsWith("_LIST") || upper.contains("_ALL_")) {
            return Granularity.LIST;
        }
        if (upper.endsWith("_DETAIL") || upper.endsWith("_INFO")) {
            return Granularity.DETAIL;
        }
        if (upper.endsWith("_STATS") || upper.startsWith("REPORT_") ||
            upper.contains("_TREND") || upper.contains("_ANALYSIS")) {
            return Granularity.STATS;
        }
        if (upper.endsWith("_QUERY")) {
            return Granularity.QUERY;
        }

        return Granularity.UNKNOWN;
    }

    /**
     * 检查粒度是否兼容
     *
     * @param inputGranularity 用户输入的粒度
     * @param intentGranularity 意图的粒度
     * @return 是否兼容
     */
    public boolean isGranularityCompatible(Granularity inputGranularity, Granularity intentGranularity) {
        if (inputGranularity == Granularity.UNKNOWN || intentGranularity == Granularity.UNKNOWN) {
            return true;  // 未知粒度不做惩罚
        }

        // QUERY 兼容 LIST 和 DETAIL
        if (intentGranularity == Granularity.QUERY) {
            return inputGranularity == Granularity.LIST ||
                   inputGranularity == Granularity.DETAIL ||
                   inputGranularity == Granularity.QUERY;
        }

        // 严格匹配
        return inputGranularity == intentGranularity;
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
        /** 装饰/首页布局领域 */
        DECORATION("装饰", "HOME_LAYOUT"),
        /** 页面设计领域 */
        PAGE_DESIGN("页面设计", "PAGE"),
        /** 财务/成本领域 */
        FINANCE("财务", "COST"),
        /** 通用/未分类 */
        GENERAL("通用", "REPORT_DASHBOARD_OVERVIEW");

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
     * 检查输入是否包含强操作指示词或业务关键词
     * 用于判断 "怎么查询库存" vs "怎么提高效率"
     * v6.1优化：增加业务关键词检查，解决"合格率怎么样"等被误判为GENERAL_QUESTION的问题
     */
    private boolean containsStrongOperationalIndicator(String input) {
        Set<String> strongIndicators = Set.of(
                // 常规操作
                "查询", "查看", "创建", "新建", "添加", "修改", "更新", "删除",
                "获取", "列表", "统计", "录入", "登记", "设置",
                // 状态控制操作
                "停止", "暂停", "启动", "恢复", "开始", "完成", "结束", "关闭", "打开"
        );

        // v6.1新增：业务关键词 - 这些词表示用户在询问具体业务数据，而非通用咨询
        // 例如："合格率怎么样" 应匹配 QUALITY_STATS，而非 GENERAL_QUESTION
        Set<String> businessKeywords = Set.of(
                // 质量相关
                "合格率", "不合格率", "良品率", "次品率", "质量", "品质", "质检", "检验",
                // 生产相关
                "产量", "产出", "生产", "加工", "批次", "进度", "效率",
                // 库存相关
                "库存", "存货", "原料", "物料", "材料",
                // 发货相关
                "发货", "出货", "发货量", "配送", "物流",
                // 设备相关
                "设备", "机器", "机台", "产线", "秤",
                // 告警相关
                "告警", "报警", "异常", "故障",
                // 报表/数据相关
                "报表", "数据", "报告", "成本", "周转"
        );

        return strongIndicators.stream().anyMatch(input::contains) ||
               businessKeywords.stream().anyMatch(input::contains);
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
        int inputLength = normalizedInput.length();

        // 按短语长度倒序排列，优先匹配更长的短语
        List<Map.Entry<String, String>> sortedEntries = phraseToIntentMapping.entrySet()
                .stream()
                .sorted((e1, e2) -> Integer.compare(e2.getKey().length(), e1.getKey().length()))
                .toList();

        for (Map.Entry<String, String> entry : sortedEntries) {
            String phrase = entry.getKey().toLowerCase();
            int phraseLength = phrase.length();

            // v5.0优化: 防止过短短语匹配过长输入
            // 规则1: 精确匹配（长度相同）- 直接通过
            // 规则2: 短语包含匹配 - 短语长度必须 >= 输入长度的40%
            // 规则3: 短语长度 >= 4 的长短语，允许直接包含匹配
            if (normalizedInput.contains(phrase)) {
                boolean isExactMatch = (phraseLength == inputLength);
                boolean isLongPhrase = (phraseLength >= 4);
                double coverageRatio = (double) phraseLength / inputLength;

                if (isExactMatch || isLongPhrase || coverageRatio >= 0.4) {
                    String intentCode = entry.getValue();
                    log.debug("短语匹配成功: input='{}', phrase='{}', intent='{}', coverage={}",
                            input, entry.getKey(), intentCode, String.format("%.2f", coverageRatio));
                    return Optional.of(intentCode);
                } else {
                    log.debug("短语匹配跳过(覆盖率不足): input='{}', phrase='{}', coverage={}",
                            input, entry.getKey(), String.format("%.2f", coverageRatio));
                }
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
     * 统计输入中命中的领域关键词数量
     * 用于动态计算领域加分
     *
     * @param input 用户输入（已小写化）
     * @param domain 目标领域
     * @return 命中的领域关键词数量
     */
    public int countDomainKeywords(String input, Domain domain) {
        if (input == null || domain == null || domain == Domain.GENERAL) {
            return 0;
        }

        Set<String> keywords = domainKeywords.get(domain);
        if (keywords == null || keywords.isEmpty()) {
            return 0;
        }

        int count = 0;
        String normalizedInput = input.toLowerCase();
        for (String kw : keywords) {
            if (normalizedInput.contains(kw.toLowerCase())) {
                count++;
            }
        }
        return count;
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
