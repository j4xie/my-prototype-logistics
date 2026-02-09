package com.cretas.aims.service.intent;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 意图预处理器
 *
 * 负责在意图分类之前对长句子进行预处理：
 * 1. 检测是否为长句子（超过阈值）
 * 2. 提取关键词（过滤停用词）
 * 3. 拆分多意图句子（识别连接词）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Component
@Slf4j
public class IntentPreprocessor {

    /**
     * 长句子阈值（字符数）
     */
    private static final int LONG_SENTENCE_THRESHOLD = 50;

    /**
     * 中文常用分隔符
     */
    private static final Pattern DELIMITER_PATTERN = Pattern.compile("[，、；。,;]");

    /**
     * 多意图分隔词
     */
    private static final List<String> MULTI_INTENT_SEPARATORS = Arrays.asList(
            "顺便", "另外", "还有", "同时", "然后", "接着", "以及", "并且", "还要", "再"
    );

    /**
     * 停用词集合
     * 包含常见的虚词、助词等
     */
    private static final Set<String> STOP_WORDS = Set.of(
            // 助词
            "的", "地", "得", "了", "着", "过",
            // 代词
            "我", "你", "他", "她", "它", "我们", "你们", "他们",
            // 系动词
            "是", "为",
            // 介词
            "在", "把", "被", "给", "让", "对", "从", "到", "向", "与", "和", "跟",
            // 连词
            "但", "但是", "而", "而且", "或", "或者", "如果", "因为", "所以",
            // 副词
            "很", "太", "非常", "特别", "比较", "更", "最", "都", "也", "就", "才", "还",
            // 语气词
            "吗", "呢", "吧", "啊", "哦", "嗯", "呀",
            // 疑问词
            "什么", "怎么", "怎样", "哪", "哪个", "哪些", "谁", "多少",
            // 量词助词
            "个", "些", "点", "下",
            // 请求相关
            "请", "帮", "帮我", "能", "可以", "能不能", "可不可以", "麻烦",
            // 时间助词
            "时候", "之前", "之后", "以前", "以后",
            // 其他常见虚词
            "这", "那", "有", "没", "没有", "不", "不是", "要", "想", "想要",
            "看", "看看", "查", "查看", "查一下", "一下"
    );

    /**
     * 需要保留的时间词
     */
    private static final Set<String> TIME_WORDS = Set.of(
            "今天", "昨天", "明天", "本周", "上周", "下周",
            "本月", "上月", "下月", "今年", "去年", "明年",
            "早上", "上午", "中午", "下午", "晚上",
            "周一", "周二", "周三", "周四", "周五", "周六", "周日",
            "一月", "二月", "三月", "四月", "五月", "六月",
            "七月", "八月", "九月", "十月", "十一月", "十二月",
            "第一季度", "第二季度", "第三季度", "第四季度",
            "Q1", "Q2", "Q3", "Q4"
    );

    /**
     * 判断输入是否需要预处理
     *
     * 当输入长度超过阈值时返回 true
     *
     * @param input 用户输入
     * @return true 表示需要预处理
     */
    public boolean needsPreprocessing(String input) {
        if (input == null || input.trim().isEmpty()) {
            return false;
        }

        String trimmedInput = input.trim();
        boolean needsProcessing = trimmedInput.length() > LONG_SENTENCE_THRESHOLD;

        if (needsProcessing) {
            log.debug("输入需要预处理: 长度={}, 阈值={}", trimmedInput.length(), LONG_SENTENCE_THRESHOLD);
        }

        return needsProcessing;
    }

    /**
     * 从输入中提取关键词
     *
     * 处理流程：
     * 1. 按分隔符拆分
     * 2. 过滤停用词
     * 3. 保留名词、动词、时间词
     *
     * @param input 用户输入
     * @return 提取的关键词（空格分隔）
     */
    public String extractKeywords(String input) {
        if (input == null || input.trim().isEmpty()) {
            return "";
        }

        String trimmedInput = input.trim();
        log.debug("开始提取关键词: {}", trimmedInput);

        // 按分隔符拆分
        String[] segments = DELIMITER_PATTERN.split(trimmedInput);

        List<String> keywords = new ArrayList<>();

        for (String segment : segments) {
            String cleaned = segment.trim();
            if (cleaned.isEmpty()) {
                continue;
            }

            // 提取该段中的关键词
            List<String> segmentKeywords = extractKeywordsFromSegment(cleaned);
            keywords.addAll(segmentKeywords);
        }

        // 去重并保持顺序
        List<String> uniqueKeywords = keywords.stream()
                .distinct()
                .collect(Collectors.toList());

        String result = String.join(" ", uniqueKeywords);
        log.debug("关键词提取结果: {} -> {}", trimmedInput, result);

        return result;
    }

    /**
     * 拆分多意图句子
     *
     * 识别包含多个意图的句子，按连接词拆分为独立段落
     * 例如："查看今天的产量，顺便看下设备状态"
     *    -> ["查看今天的产量", "看下设备状态"]
     *
     * @param input 用户输入
     * @return 拆分后的句子列表，如果没有多意图则返回包含原句的单元素列表
     */
    public List<String> splitMultiIntent(String input) {
        if (input == null || input.trim().isEmpty()) {
            return Collections.emptyList();
        }

        String trimmedInput = input.trim();
        log.debug("开始多意图拆分: {}", trimmedInput);

        List<String> segments = new ArrayList<>();

        // 首先按逗号和分号拆分
        String[] commaSplit = trimmedInput.split("[，,；;]");

        for (String part : commaSplit) {
            String cleanPart = part.trim();
            if (cleanPart.isEmpty()) {
                continue;
            }

            // 检查是否包含多意图分隔词
            boolean containsSeparator = false;
            String separatorUsed = null;

            for (String separator : MULTI_INTENT_SEPARATORS) {
                if (cleanPart.contains(separator)) {
                    containsSeparator = true;
                    separatorUsed = separator;
                    break;
                }
            }

            if (containsSeparator && separatorUsed != null) {
                // 按分隔词拆分
                String[] subParts = cleanPart.split(separatorUsed);
                for (String subPart : subParts) {
                    String cleanSubPart = subPart.trim();
                    if (!cleanSubPart.isEmpty() && isValidSegment(cleanSubPart)) {
                        segments.add(cleanSubPart);
                    }
                }
            } else {
                // 无分隔词，保留完整段落
                if (isValidSegment(cleanPart)) {
                    segments.add(cleanPart);
                }
            }
        }

        // 如果没有有效拆分，返回原句
        if (segments.isEmpty()) {
            segments.add(trimmedInput);
        }

        log.debug("多意图拆分结果: {} -> {}", trimmedInput, segments);

        return segments;
    }

    // ==================== 私有方法 ====================

    /**
     * 从单个段落中提取关键词
     *
     * @param segment 文本段落
     * @return 关键词列表
     */
    private List<String> extractKeywordsFromSegment(String segment) {
        List<String> keywords = new ArrayList<>();

        // 简单的中文分词：按空格、标点分割，并尝试提取连续中文词
        // 首先处理空格分隔的词
        String[] tokens = segment.split("\\s+");

        for (String token : tokens) {
            // 提取中文词和英文词
            extractWordsFromToken(token, keywords);
        }

        return keywords;
    }

    /**
     * 从单个 token 中提取词语
     *
     * @param token 待处理的 token
     * @param keywords 关键词收集列表
     */
    private void extractWordsFromToken(String token, List<String> keywords) {
        if (token == null || token.isEmpty()) {
            return;
        }

        // 清理标点符号
        String cleaned = token.replaceAll("[\\p{Punct}]", "");
        if (cleaned.isEmpty()) {
            return;
        }

        // 检查是否为时间词（优先保留）
        if (TIME_WORDS.contains(cleaned)) {
            keywords.add(cleaned);
            return;
        }

        // 检查是否为停用词
        if (STOP_WORDS.contains(cleaned)) {
            return;
        }

        // 过滤过短的词（单字词，但保留数字）
        if (cleaned.length() < 2 && !cleaned.matches("\\d+")) {
            return;
        }

        // 纯数字单独处理（可能是数量、编号等）
        if (cleaned.matches("\\d+")) {
            keywords.add(cleaned);
            return;
        }

        // 添加有意义的词
        keywords.add(cleaned);

        // 尝试提取中文词组（简单的双字、三字词提取）
        if (containsChinese(cleaned) && cleaned.length() > 2) {
            // 提取连续的中文字符作为潜在关键词
            extractChineseWords(cleaned, keywords);
        }
    }

    /**
     * 从字符串中提取中文词组
     *
     * 简单策略：提取2-4字的连续中文作为候选词
     *
     * @param text 待处理文本
     * @param keywords 关键词收集列表
     */
    private void extractChineseWords(String text, List<String> keywords) {
        // 提取连续中文字符
        StringBuilder chineseBuilder = new StringBuilder();

        for (char c : text.toCharArray()) {
            if (isChineseCharacter(c)) {
                chineseBuilder.append(c);
            } else {
                // 遇到非中文字符，处理已收集的中文
                processChineseSegment(chineseBuilder.toString(), keywords);
                chineseBuilder.setLength(0);
            }
        }

        // 处理最后的中文段
        if (chineseBuilder.length() > 0) {
            processChineseSegment(chineseBuilder.toString(), keywords);
        }
    }

    /**
     * 处理中文段落，提取有意义的词组
     *
     * @param chineseSegment 中文段落
     * @param keywords 关键词收集列表
     */
    private void processChineseSegment(String chineseSegment, List<String> keywords) {
        if (chineseSegment.length() < 2) {
            return;
        }

        // 检查整个段落是否为停用词
        if (STOP_WORDS.contains(chineseSegment)) {
            return;
        }

        // 检查是否为时间词
        if (TIME_WORDS.contains(chineseSegment)) {
            if (!keywords.contains(chineseSegment)) {
                keywords.add(chineseSegment);
            }
            return;
        }

        // 对于较长的中文段落（>4字），尝试提取双字词
        if (chineseSegment.length() > 4) {
            for (int i = 0; i <= chineseSegment.length() - 2; i++) {
                String biGram = chineseSegment.substring(i, i + 2);
                if (!STOP_WORDS.contains(biGram) && !keywords.contains(biGram)) {
                    // 只保留看起来有意义的双字词
                    if (isPotentialKeyword(biGram)) {
                        keywords.add(biGram);
                    }
                }
            }
        }

        // 保留完整段落（如果不是太长且不是停用词）
        if (chineseSegment.length() <= 6 && !keywords.contains(chineseSegment)) {
            keywords.add(chineseSegment);
        }
    }

    /**
     * 判断是否为潜在关键词
     *
     * @param word 待判断的词
     * @return true 表示可能是有意义的关键词
     */
    private boolean isPotentialKeyword(String word) {
        if (word == null || word.length() < 2) {
            return false;
        }

        // 排除停用词
        if (STOP_WORDS.contains(word)) {
            return false;
        }

        // 时间词总是保留
        if (TIME_WORDS.contains(word)) {
            return true;
        }

        // 其他情况默认保留
        return true;
    }

    /**
     * 判断字符是否为中文字符
     *
     * @param c 字符
     * @return true 表示是中文字符
     */
    private boolean isChineseCharacter(char c) {
        return c >= '\u4e00' && c <= '\u9fff';
    }

    /**
     * 判断字符串是否包含中文字符
     *
     * @param text 待判断的字符串
     * @return true 表示包含中文字符
     */
    private boolean containsChinese(String text) {
        for (char c : text.toCharArray()) {
            if (isChineseCharacter(c)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 判断拆分后的段落是否有效
     *
     * 过滤掉过短或无意义的段落
     *
     * @param segment 待验证的段落
     * @return true 表示有效
     */
    private boolean isValidSegment(String segment) {
        if (segment == null || segment.trim().isEmpty()) {
            return false;
        }

        String trimmed = segment.trim();

        // 至少包含2个字符
        if (trimmed.length() < 2) {
            return false;
        }

        // 不能全是停用词
        String cleaned = trimmed;
        for (String stopWord : STOP_WORDS) {
            cleaned = cleaned.replace(stopWord, "");
        }

        // 如果清理后为空或只剩标点，则无效
        cleaned = cleaned.replaceAll("[\\p{Punct}\\s]", "");
        return !cleaned.isEmpty();
    }
}
