package com.cretas.aims.service.calibration.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.config.DashScopeConfig;
import com.cretas.aims.entity.calibration.ReflectionMemory;
import com.cretas.aims.repository.calibration.ReflectionMemoryRepository;
import com.cretas.aims.service.calibration.CorrectionAgentService;
import com.cretas.aims.service.calibration.ExternalVerifierService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 纠错 Agent 服务实现
 *
 * 基于 CRITIC + Reflexion 论文设计的智能纠错系统：
 * 1. 使用外部验证结果作为可靠反馈（CRITIC 核心思想）
 * 2. 调用 LLM 分析错误并生成修正参数
 * 3. 记录反思到 episodic memory（Reflexion 核心思想）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CorrectionAgentServiceImpl implements CorrectionAgentService {

    private final DashScopeClient dashScopeClient;
    private final DashScopeConfig dashScopeConfig;
    private final ReflectionMemoryRepository reflectionMemoryRepository;
    private final ObjectMapper objectMapper;

    // 最大重试次数
    private static final int MAX_RETRIES = 3;

    // JSON 提取正则
    private static final Pattern JSON_PATTERN = Pattern.compile("```json\\s*([\\s\\S]*?)\\s*```");
    private static final Pattern BRACE_PATTERN = Pattern.compile("\\{[\\s\\S]*\\}");

    /**
     * CRITIC-style 纠错 Prompt 模板
     *
     * 关键设计：
     * - 明确提供外部验证结果（不依赖 LLM 自我判断）
     * - 结构化输出要求（JSON 格式）
     * - 包含历史反思（Reflexion）
     */
    private static final String CORRECTION_PROMPT_TEMPLATE = """
        你是一个工具调用纠错专家。你的任务是分析工具执行失败的原因，并生成修正后的参数。

        ## 原始请求信息
        - 用户意图: %s
        - 工具名称: %s
        - 原始参数: %s

        ## 执行结果
        - 状态: 失败
        - 错误信息: %s

        ## 外部验证结果（重要！这是可靠的外部反馈）
        %s

        ## 历史反思记录
        %s

        ## 任务
        请分析错误原因，并生成修正后的工具调用参数。

        ## 输出要求
        请严格按以下 JSON 格式输出：
        ```json
        {
            "errorAnalysis": "错误原因分析（简洁明了）",
            "correctionStrategy": "RE_QUERY|EXPAND_RANGE|FIX_FORMAT|CHANGE_CONDITION|ABANDON",
            "correctedParams": {
                // 修正后的参数，保持与原始参数相同的键名
            },
            "reflection": "本次纠错的经验总结（用于未来参考）",
            "confidence": 0.0-1.0 的置信度
        }
        ```

        ## 策略说明
        - RE_QUERY: 调整查询条件重新查询
        - EXPAND_RANGE: 扩大时间范围或条件范围
        - FIX_FORMAT: 修正参数格式
        - CHANGE_CONDITION: 更换查询条件
        - ABANDON: 无法修正，放弃重试

        ## 约束
        1. 必须基于外部验证结果进行修正，不要猜测
        2. 如果验证结果显示无数据，考虑扩大查询范围
        3. 如果是格式错误，按正确格式修正
        4. 置信度低于 0.3 时建议 ABANDON
        5. 只输出 JSON，不要其他内容
        """;

    @Override
    @Transactional
    public CorrectionResult analyzeAndCorrect(
            String userIntent,
            String toolName,
            Map<String, Object> originalParams,
            String errorMessage,
            ExternalVerifierService.VerificationResult verificationResult,
            int attemptNumber) {

        log.info("纠错 Agent 开始分析: tool={}, attempt={}, error={}",
                toolName, attemptNumber, errorMessage);

        // 1. 检查是否应该继续重试
        if (!shouldRetry(errorMessage, verificationResult, attemptNumber)) {
            log.info("纠错 Agent 判断不应继续重试: attempt={}", attemptNumber);
            return CorrectionResult.noRetry("已达最大重试次数或错误不可恢复");
        }

        try {
            // 2. 获取历史反思
            String historicalReflections = getHistoricalReflections(null, toolName, 3);

            // 3. 构建纠错 Prompt
            String prompt = buildCorrectionPrompt(
                    userIntent, toolName, originalParams, errorMessage,
                    verificationResult, historicalReflections);

            // 4. 调用纠错模型（使用轻量模型）
            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .model(dashScopeConfig.getCorrectionModel())  // qwen-turbo
                    .temperature(0.3)  // 低温度，更确定性
                    .maxTokens(1000)
                    .messages(List.of(
                            ChatMessage.builder()
                                    .role("user")
                                    .content(prompt)
                                    .build()
                    ))
                    .build();

            ChatCompletionResponse response = dashScopeClient.chatCompletion(request);

            if (response == null || response.getErrorMessage() != null) {
                log.error("纠错 Agent 调用失败: {}", response != null ? response.getErrorMessage() : "null response");
                return CorrectionResult.noRetry("纠错 Agent 调用失败");
            }

            // 5. 解析 LLM 响应
            String content = response.getContent();
            log.debug("纠错 Agent 响应: {}", content);

            CorrectionResult result = parseCorrectionResponse(content);

            // 6. 保存反思到 episodic memory
            if (result.shouldRetry() && result.reflection() != null) {
                saveReflection(null, toolName, errorMessage, result);
            }

            log.info("纠错 Agent 完成: shouldRetry={}, strategy={}, confidence={}",
                    result.shouldRetry(), result.correctionStrategy(), result.confidence());

            return result;

        } catch (Exception e) {
            log.error("纠错 Agent 执行异常: {}", e.getMessage(), e);
            return CorrectionResult.noRetry("纠错 Agent 执行异常: " + e.getMessage());
        }
    }

    @Override
    public String getHistoricalReflections(String sessionId, String toolName, int limit) {
        try {
            List<ReflectionMemory> reflections = reflectionMemoryRepository
                    .findByToolNameOrderByCreatedAtDesc(toolName)
                    .stream()
                    .limit(limit)
                    .toList();

            if (reflections.isEmpty()) {
                return "无历史反思记录";
            }

            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < reflections.size(); i++) {
                ReflectionMemory r = reflections.get(i);
                sb.append(String.format("%d. [%s] %s -> %s\n",
                        i + 1,
                        r.isWasSuccessful() ? "成功" : "失败",
                        r.getOriginalError(),
                        r.getReflectionContent()));
            }
            return sb.toString();

        } catch (Exception e) {
            log.warn("获取历史反思失败: {}", e.getMessage());
            return "无法获取历史反思";
        }
    }

    @Override
    public boolean shouldRetry(String errorMessage, ExternalVerifierService.VerificationResult verificationResult, int attemptNumber) {
        // 1. 超过最大重试次数
        if (attemptNumber >= MAX_RETRIES) {
            return false;
        }

        // 2. 如果外部验证显示完全没有数据，可能不值得重试
        if (verificationResult != null && !verificationResult.hasData() &&
                "TABLE_EMPTY".equals(verificationResult.dataStatus())) {
            return false;
        }

        // 3. 某些错误类型不值得重试
        if (errorMessage != null) {
            String lower = errorMessage.toLowerCase();
            // 权限错误、配置错误等不重试
            if (lower.contains("permission denied") ||
                    lower.contains("unauthorized") ||
                    lower.contains("not configured") ||
                    lower.contains("api key")) {
                return false;
            }
        }

        return true;
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 构建纠错 Prompt
     */
    private String buildCorrectionPrompt(
            String userIntent,
            String toolName,
            Map<String, Object> originalParams,
            String errorMessage,
            ExternalVerifierService.VerificationResult verificationResult,
            String historicalReflections) {

        String paramsJson;
        try {
            paramsJson = objectMapper.writeValueAsString(originalParams);
        } catch (JsonProcessingException e) {
            paramsJson = originalParams.toString();
        }

        String verificationInfo = formatVerificationResult(verificationResult);

        return String.format(CORRECTION_PROMPT_TEMPLATE,
                userIntent != null ? userIntent : "未知",
                toolName,
                paramsJson,
                errorMessage,
                verificationInfo,
                historicalReflections != null ? historicalReflections : "无"
        );
    }

    /**
     * 格式化验证结果
     */
    private String formatVerificationResult(ExternalVerifierService.VerificationResult result) {
        if (result == null) {
            return "无外部验证结果";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("- 数据状态: ").append(result.dataStatus()).append("\n");
        sb.append("- 是否有数据: ").append(result.hasData() ? "是" : "否").append("\n");
        sb.append("- 记录数: ").append(result.recordCount()).append("\n");

        if (result.suggestion() != null) {
            sb.append("- 建议: ").append(result.suggestion()).append("\n");
        }

        if (result.contextInfo() != null && !result.contextInfo().isEmpty()) {
            sb.append("- 上下文信息:\n");
            for (Map.Entry<String, Object> entry : result.contextInfo().entrySet()) {
                sb.append("  - ").append(entry.getKey()).append(": ").append(entry.getValue()).append("\n");
            }
        }

        return sb.toString();
    }

    /**
     * 解析 LLM 纠错响应
     */
    private CorrectionResult parseCorrectionResponse(String content) {
        if (content == null || content.isBlank()) {
            return CorrectionResult.noRetry("LLM 返回空响应");
        }

        try {
            // 尝试提取 JSON
            String jsonStr = extractJson(content);
            if (jsonStr == null) {
                log.warn("无法从响应中提取 JSON: {}", content);
                return CorrectionResult.noRetry("无法解析 LLM 响应");
            }

            Map<String, Object> response = objectMapper.readValue(jsonStr, new TypeReference<>() {});

            String errorAnalysis = (String) response.getOrDefault("errorAnalysis", "未知");
            String strategy = (String) response.getOrDefault("correctionStrategy", "ABANDON");
            String reflection = (String) response.get("reflection");
            double confidence = response.containsKey("confidence") ?
                    ((Number) response.get("confidence")).doubleValue() : 0.5;

            // 如果策略是 ABANDON 或置信度太低，不重试
            if ("ABANDON".equals(strategy) || confidence < 0.3) {
                return CorrectionResult.noRetry(errorAnalysis);
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> correctedParams = (Map<String, Object>) response.get("correctedParams");

            if (correctedParams == null || correctedParams.isEmpty()) {
                return CorrectionResult.noRetry("未生成修正参数");
            }

            return CorrectionResult.withCorrection(
                    errorAnalysis,
                    correctedParams,
                    strategy,
                    reflection,
                    confidence
            );

        } catch (Exception e) {
            log.error("解析纠错响应失败: {}", e.getMessage());
            return CorrectionResult.noRetry("解析响应失败: " + e.getMessage());
        }
    }

    /**
     * 从文本中提取 JSON
     */
    private String extractJson(String content) {
        // 尝试从 ```json ``` 块中提取
        Matcher matcher = JSON_PATTERN.matcher(content);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }

        // 尝试直接匹配 JSON 对象
        Matcher braceMatcher = BRACE_PATTERN.matcher(content);
        if (braceMatcher.find()) {
            return braceMatcher.group().trim();
        }

        return null;
    }

    /**
     * 保存反思到 episodic memory
     */
    private void saveReflection(String sessionId, String toolName, String originalError, CorrectionResult result) {
        try {
            ReflectionMemory memory = ReflectionMemory.builder()
                    .sessionId(sessionId)
                    .toolName(toolName)
                    .originalError(originalError)
                    .reflectionContent(result.reflection())
                    .correctedParams(result.correctedParams() != null ?
                            objectMapper.writeValueAsString(result.correctedParams()) : null)
                    .correctionStrategy(result.correctionStrategy())
                    .confidence(result.confidence())
                    .wasSuccessful(false)  // 初始为 false，执行成功后更新
                    .createdAt(LocalDateTime.now())
                    .build();

            reflectionMemoryRepository.save(memory);
            log.debug("反思已保存: tool={}, strategy={}", toolName, result.correctionStrategy());

        } catch (Exception e) {
            log.warn("保存反思失败: {}", e.getMessage());
        }
    }
}
