package com.cretas.aims.service.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.config.DashScopeConfig;
import com.cretas.aims.config.LongTextConfig;
import com.cretas.aims.service.LongTextHandler;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

/**
 * 长文本处理服务实现
 *
 * 核心功能：
 * 1. 停用词移除 - 使用预定义的中文停用词表
 * 2. 意图摘要 - 使用 qwen-turbo 快速提取核心意图
 * 3. 结果缓存 - 避免重复处理相同内容
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Service
public class LongTextHandlerImpl implements LongTextHandler {

    private final LongTextConfig config;
    private final DashScopeConfig dashScopeConfig;
    private final DashScopeClient dashScopeClient;

    /**
     * 摘要结果缓存
     * Key: 原始输入的 hash
     * Value: 处理后的摘要
     */
    private Cache<String, String> summaryCache;

    /**
     * 统计计数器
     */
    private final AtomicLong totalProcessed = new AtomicLong(0);
    private final AtomicLong cacheHits = new AtomicLong(0);
    private final AtomicLong llmCalls = new AtomicLong(0);
    private final AtomicLong stopwordOnlyProcessed = new AtomicLong(0);

    /**
     * 中文停用词集合
     * 包含常见的语气词、助词、连接词等
     */
    private static final Set<String> CHINESE_STOPWORDS = new HashSet<>(Arrays.asList(
            // 语气词
            "啊", "呀", "哇", "哦", "嗯", "呢", "吧", "吗", "啦", "呐", "哈", "嘛", "噢",
            // 助词
            "的", "地", "得", "了", "着", "过",
            // 代词（保留指代消解需要的）
            "这个", "那个", "什么", "怎么", "哪个", "哪些", "某个", "某些",
            // 副词
            "很", "非常", "特别", "比较", "稍微", "有点", "太", "最", "更", "挺", "蛮",
            "就", "才", "都", "也", "又", "还", "再", "仅", "只", "光",
            // 连接词
            "和", "与", "及", "或", "而", "但", "但是", "可是", "然而", "不过",
            "因为", "所以", "因此", "于是", "如果", "假如", "要是", "虽然", "尽管",
            // 介词
            "在", "从", "向", "往", "到", "给", "对", "跟", "把", "被", "让", "叫",
            "按", "按照", "根据", "通过", "经过", "关于", "对于",
            // 量词修饰
            "个", "些", "点", "下", "次", "回", "遍", "番",
            // 时间助词
            "时候", "以后", "之后", "以前", "之前", "当时", "那时",
            // 口语化表达
            "就是", "其实", "反正", "总之", "然后", "接着", "首先", "其次",
            "一下", "一点", "一些", "有些", "有的", "有时",
            // 敬语/客气话
            "请", "请问", "麻烦", "劳驾", "您好", "好的", "谢谢", "感谢",
            "能不能", "可不可以", "是不是", "有没有",
            // 无意义填充词
            "那个", "这个", "就是说", "怎么说呢", "你知道", "我说",
            "嗯嗯", "哎", "唉", "哟", "诶"
    ));

    /**
     * 标点符号和特殊字符清理模式
     */
    private static final Pattern EXTRA_SPACES_PATTERN = Pattern.compile("\\s+");
    private static final Pattern REPEATED_PUNCTUATION_PATTERN = Pattern.compile("([，。！？、；：]){2,}");

    /**
     * 意图摘要系统提示词
     * 针对意图分类场景优化
     */
    private static final String INTENT_SUMMARY_SYSTEM_PROMPT = """
            你是一个文本摘要专家，专门为意图识别系统提取核心信息。

            任务：将用户的长输入压缩为简洁的意图表达。

            规则：
            1. 提取核心动作意图（查询、创建、更新、删除、分析、导出等）
            2. 保留关键业务实体：
               - 批次号（如 B2024xxxx）
               - 时间范围（如 今天、本周、1月1日-1月15日）
               - 数量/数值
               - 供应商/客户名称
               - 产品/物料名称
               - 仓库/设备名称
            3. 去除冗余的背景说明、客套话、重复内容
            4. 输出长度不超过 %d 字
            5. 直接输出摘要内容，不要有任何前缀说明

            示例：
            输入：你好，我想问一下，就是我们公司上周从金龙供应商那边进的那批三文鱼原料，批次号好像是B2024010501，能不能帮我查一下现在的库存情况怎么样，还有就是质检有没有什么问题，谢谢啊。
            输出：查询批次B2024010501三文鱼的库存和质检情况

            输入：麻烦帮我看看本月所有入库记录，特别是肉类原料的，我需要统计一下数量和供应商分布情况，另外如果方便的话，最好能按照日期排个序，这样我好做报告。
            输出：查询本月肉类原料入库记录，按日期排序，统计数量和供应商分布
            """;

    @Autowired
    public LongTextHandlerImpl(
            LongTextConfig config,
            DashScopeConfig dashScopeConfig,
            @Autowired(required = false) DashScopeClient dashScopeClient) {
        this.config = config;
        this.dashScopeConfig = dashScopeConfig;
        this.dashScopeClient = dashScopeClient;
    }

    @PostConstruct
    public void init() {
        // 初始化缓存
        summaryCache = Caffeine.newBuilder()
                .maximumSize(config.getCacheMaxSize())
                .expireAfterWrite(config.getCacheExpireSeconds(), TimeUnit.SECONDS)
                .recordStats()
                .build();

        log.info("LongTextHandler initialized with cache: maxSize={}, expireSeconds={}",
                config.getCacheMaxSize(), config.getCacheExpireSeconds());
    }

    @Override
    public String processForIntent(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }

        // 检查是否启用长文本处理
        if (!config.isEnabled()) {
            log.debug("Long text processing is disabled");
            return input;
        }

        totalProcessed.incrementAndGet();

        // 1. 检查缓存
        String cacheKey = generateCacheKey(input);
        String cached = summaryCache.getIfPresent(cacheKey);
        if (cached != null) {
            cacheHits.incrementAndGet();
            log.debug("Cache hit for long text processing, original length: {}, cached length: {}",
                    input.length(), cached.length());
            return cached;
        }

        // 2. 停用词移除（如果启用）
        String processed = input;
        if (config.isStopwordRemovalEnabled()) {
            processed = removeStopwords(input);
            log.debug("After stopword removal: {} -> {} chars", input.length(), processed.length());
        }

        // 3. 检查停用词移除后是否仍需要摘要
        if (processed.length() <= config.getThreshold()) {
            stopwordOnlyProcessed.incrementAndGet();
            summaryCache.put(cacheKey, processed);
            log.debug("Stopword removal sufficient, no LLM summary needed");
            return processed;
        }

        // 4. 调用 LLM 生成摘要
        String summary = summarizeForIntent(processed);

        // 5. 缓存结果
        summaryCache.put(cacheKey, summary);

        log.info("Long text processed: {} -> {} chars (stopword: {} -> LLM summary)",
                input.length(), summary.length(), processed.length());

        return summary;
    }

    @Override
    public String summarizeForIntent(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }

        // 检查 DashScope 客户端是否可用
        if (dashScopeClient == null || !dashScopeClient.isAvailable()) {
            log.warn("DashScope client not available, returning truncated input");
            return truncateText(input, config.getSummaryMaxLength());
        }

        llmCalls.incrementAndGet();

        try {
            // 构建摘要请求，使用 correctionModel (qwen-turbo)
            String systemPrompt = String.format(INTENT_SUMMARY_SYSTEM_PROMPT, config.getSummaryMaxLength());

            ChatCompletionRequest request = ChatCompletionRequest.simple(
                    dashScopeConfig.getCorrectionModel(),  // 使用 qwen-turbo
                    systemPrompt,
                    input
            );
            request.setMaxTokens(200);  // 摘要不需要太多 token
            request.setTemperature(0.3);  // 低温度确保稳定输出

            ChatCompletionResponse response = dashScopeClient.chatCompletion(request);

            if (response.hasError()) {
                log.error("LLM summary failed: {}", response.getErrorMessage());
                return truncateText(input, config.getSummaryMaxLength());
            }

            String summary = response.getContent();
            if (summary == null || summary.isEmpty()) {
                log.warn("LLM returned empty summary");
                return truncateText(input, config.getSummaryMaxLength());
            }

            // 确保摘要不超过最大长度
            summary = summary.trim();
            if (summary.length() > config.getSummaryMaxLength()) {
                summary = truncateText(summary, config.getSummaryMaxLength());
            }

            log.debug("LLM summary generated: {} -> {} chars", input.length(), summary.length());
            return summary;

        } catch (Exception e) {
            log.error("Error during LLM summarization: {}", e.getMessage(), e);
            return truncateText(input, config.getSummaryMaxLength());
        }
    }

    @Override
    public String removeStopwords(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }

        StringBuilder result = new StringBuilder();
        StringBuilder currentWord = new StringBuilder();

        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);

            // 中文字符
            if (Character.toString(c).matches("[\\u4e00-\\u9fa5]")) {
                currentWord.append(c);

                // 检查是否形成停用词（支持 1-4 字停用词）
                String word = currentWord.toString();
                boolean isStopword = false;

                // 检查当前累积的词是否为停用词
                if (CHINESE_STOPWORDS.contains(word)) {
                    // 可能是停用词，但需要检查后续字符是否形成更长的停用词
                    // 简化处理：如果当前词是停用词且长度 >= 2，直接移除
                    if (word.length() >= 2) {
                        isStopword = true;
                    } else {
                        // 单字停用词，检查是否可能与后续字符组成非停用词
                        // 简化：单字停用词直接保留（避免误删）
                        isStopword = false;
                    }
                }

                // 如果累积超过 4 字且不是停用词，输出第一个字符并继续
                if (word.length() > 4 && !isStopword) {
                    result.append(word.charAt(0));
                    currentWord = new StringBuilder(word.substring(1));
                }

                // 是停用词则清空当前词
                if (isStopword) {
                    currentWord = new StringBuilder();
                }
            } else {
                // 非中文字符（标点、空格、英文、数字等）
                // 先输出当前累积的词
                String word = currentWord.toString();
                if (!word.isEmpty() && !CHINESE_STOPWORDS.contains(word)) {
                    result.append(word);
                }
                currentWord = new StringBuilder();

                // 保留标点符号和空格（但清理重复的）
                if (!Character.isWhitespace(c) || result.length() == 0 ||
                        !Character.isWhitespace(result.charAt(result.length() - 1))) {
                    result.append(c);
                }
            }
        }

        // 处理最后的词
        String lastWord = currentWord.toString();
        if (!lastWord.isEmpty() && !CHINESE_STOPWORDS.contains(lastWord)) {
            result.append(lastWord);
        }

        // 清理多余空格和重复标点
        String cleaned = result.toString();
        cleaned = EXTRA_SPACES_PATTERN.matcher(cleaned).replaceAll(" ");
        cleaned = REPEATED_PUNCTUATION_PATTERN.matcher(cleaned).replaceAll("$1");

        return cleaned.trim();
    }

    @Override
    public boolean needsProcessing(String input) {
        return config.needsProcessing(input);
    }

    @Override
    public String getStats() {
        return String.format(
                "LongTextHandler Stats: total=%d, cacheHits=%d (%.1f%%), llmCalls=%d, stopwordOnly=%d, cacheSize=%d",
                totalProcessed.get(),
                cacheHits.get(),
                totalProcessed.get() > 0 ? (cacheHits.get() * 100.0 / totalProcessed.get()) : 0,
                llmCalls.get(),
                stopwordOnlyProcessed.get(),
                summaryCache.estimatedSize()
        );
    }

    @Override
    public void clearCache() {
        summaryCache.invalidateAll();
        log.info("LongTextHandler cache cleared");
    }

    /**
     * 生成缓存 key
     * 使用输入文本的哈希值作为 key
     */
    private String generateCacheKey(String input) {
        return "lth:" + input.hashCode();
    }

    /**
     * 截断文本到指定长度
     * 尝试在标点符号处截断以保持语义完整
     */
    private String truncateText(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) {
            return text;
        }

        // 尝试在标点符号处截断
        String truncated = text.substring(0, maxLength);
        int lastPunctuation = -1;

        for (int i = truncated.length() - 1; i >= maxLength / 2; i--) {
            char c = truncated.charAt(i);
            if (c == '，' || c == '。' || c == '；' || c == '、' || c == ' ') {
                lastPunctuation = i;
                break;
            }
        }

        if (lastPunctuation > 0) {
            return truncated.substring(0, lastPunctuation);
        }

        return truncated;
    }
}
