package com.cretas.aims.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.util.HashSet;
import java.util.Set;

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

        // 初始化更新指示词
        if (updateIndicators.isEmpty()) {
            updateIndicators.addAll(Set.of(
                    "修改", "更新", "改成", "改为", "设置", "调整", "编辑", "变更", "改",
                    "把", "设成", "设为", "更改", "修订", "调为", "换成"
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

        log.info("IntentKnowledgeBase 初始化完成: stopWords={}, queryIndicators={}, updateIndicators={}",
                stopWords.size(), queryIndicators.size(), updateIndicators.size());
    }

    // ==================== 操作类型枚举 ====================

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
}
