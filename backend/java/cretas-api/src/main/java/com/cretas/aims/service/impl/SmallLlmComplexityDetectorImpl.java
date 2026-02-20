package com.cretas.aims.service.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.dto.ai.ProcessingMode;
import com.cretas.aims.service.SmallLlmComplexityDetector;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 小语言模型复杂度检测器实现
 *
 * Phase 2 实现：使用 DashScope (Qwen) 进行复杂度判断
 * 适用于规则难以判断的边界情况
 *
 * 设计原则：
 * - 使用低温度确保输出稳定
 * - 简短的 prompt 以减少 token 消耗
 * - 有降级策略：LLM 失败时返回默认值
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
public class SmallLlmComplexityDetectorImpl implements SmallLlmComplexityDetector {

    private final DashScopeClient dashScopeClient;

    /**
     * 是否启用 LLM 复杂度检测
     */
    @Value("${ai.complexity.llm-detection.enabled:true}")
    private boolean llmDetectionEnabled;

    /**
     * LLM 检测超时时间 (ms)
     */
    @Value("${ai.complexity.llm-detection.timeout:3000}")
    private int llmTimeout;

    /**
     * 复杂度判断 System Prompt
     */
    private static final String SYSTEM_PROMPT = """
        你是一个查询复杂度分析助手。请判断用户查询的复杂度等级 (1-5):

        1 = 简单查询 (单一数据查询，如"今天库存多少")
        2 = 标准查询 (多数据源查询，如"最近一周的出货记录")
        3 = 中等分析 (需要数据整合，如"分析本月销售情况")
        4 = 复杂分析 (多维度对比分析，如"对比各产品线的质检趋势")
        5 = 深度分析 (战略建议+因果推理，如"分析销售下降原因并给出改进方案")

        只返回数字 (1-5)，不要其他任何内容。
        """;

    /**
     * 从响应中提取数字的正则
     */
    private static final Pattern NUMBER_PATTERN = Pattern.compile("[1-5]");

    @Autowired
    public SmallLlmComplexityDetectorImpl(DashScopeClient dashScopeClient) {
        this.dashScopeClient = dashScopeClient;
    }

    @Override
    public ProcessingMode detectComplexity(String userInput) {
        if (!isAvailable()) {
            log.debug("LLM 复杂度检测不可用，返回默认值 ANALYSIS");
            return ProcessingMode.ANALYSIS;
        }

        try {
            long startTime = System.currentTimeMillis();

            // 调用 LLM
            String response = dashScopeClient.chatLowTemp(SYSTEM_PROMPT, userInput);

            long elapsed = System.currentTimeMillis() - startTime;
            log.debug("LLM 复杂度检测耗时: {}ms, 响应: '{}'", elapsed, response);

            // 提取数字
            int level = parseLevel(response);
            ProcessingMode mode = ProcessingMode.fromLevel(level);

            log.info("🤖 LLM 复杂度检测: level={}, mode={}, input='{}'",
                    level, mode,
                    userInput.length() > 30 ? userInput.substring(0, 30) + "..." : userInput);

            return mode;
        } catch (Exception e) {
            log.warn("LLM 复杂度检测失败，降级到默认值: {}", e.getMessage());
            return ProcessingMode.ANALYSIS;
        }
    }

    @Override
    public double detectComplexityScore(String userInput) {
        ProcessingMode mode = detectComplexity(userInput);

        // 将 ProcessingMode 转换为复杂度分数
        return switch (mode) {
            case FAST -> 0.2;
            case ANALYSIS -> 0.5;
            case MULTI_AGENT -> 0.7;
            case DEEP_REASONING -> 0.9;
        };
    }

    @Override
    public boolean isAvailable() {
        return llmDetectionEnabled && dashScopeClient != null && dashScopeClient.isAvailable();
    }

    /**
     * 从 LLM 响应中解析复杂度等级
     *
     * @param response LLM 响应
     * @return 复杂度等级 (1-5)，解析失败返回 3
     */
    private int parseLevel(String response) {
        if (response == null || response.isBlank()) {
            return 3;  // 默认中等复杂度
        }

        // 清理响应并提取数字
        String cleaned = response.trim();
        Matcher matcher = NUMBER_PATTERN.matcher(cleaned);

        if (matcher.find()) {
            return Integer.parseInt(matcher.group());
        }

        // 尝试直接解析
        try {
            int level = Integer.parseInt(cleaned.replaceAll("[^0-9]", ""));
            return Math.max(1, Math.min(5, level));
        } catch (NumberFormatException e) {
            log.warn("无法解析 LLM 响应: '{}'", response);
            return 3;
        }
    }
}
