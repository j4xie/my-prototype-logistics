package com.cretas.aims.service.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.config.TimeNormalizationRules;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.ai.PreprocessedQuery;
import com.cretas.aims.dto.conversation.EntitySlot;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.service.ResultValidatorService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 结果验证服务实现
 * 验证意图执行结果的质量和相关性
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResultValidatorServiceImpl implements ResultValidatorService {

    private final DashScopeClient dashScopeClient;
    private final ObjectMapper objectMapper;

    @Value("${cretas.ai.validation.enabled:true}")
    private boolean validationEnabled;

    @Value("${cretas.ai.validation.rule-validation-enabled:true}")
    private boolean ruleValidationEnabled;

    @Value("${cretas.ai.validation.semantic-enabled:true}")
    private boolean semanticValidationEnabled;

    @Value("${cretas.ai.validation.semantic-threshold:0.75}")
    private double semanticValidationThreshold;

    @Override
    public ValidationResult validate(IntentExecuteResponse response,
                                     PreprocessedQuery query,
                                     IntentMatchResult intentResult) {
        if (!validationEnabled) {
            log.debug("验证服务已禁用，返回有效结果");
            return ValidationResult.valid();
        }

        log.info("开始验证意图执行结果: intentCode={}",
                 response != null ? response.getIntentCode() : "null");

        // Step 1: 规则验证
        RuleValidationResult ruleResult = validateWithRules(response, query);
        log.debug("规则验证完成: passed={}, score={}", ruleResult.isPassed(), ruleResult.getScore());

        if (!ruleResult.isPassed() && ruleResult.getScore() < 0.5) {
            // 严重问题，直接返回无效
            return buildInvalidResult(ruleResult);
        }

        // Step 2: 判断是否需要语义验证
        if (!requiresSemanticValidation(intentResult, ruleResult)) {
            log.debug("无需语义验证，返回规则验证结果");
            return buildValidResult(ruleResult);
        }

        // Step 3: 语义验证
        String intentDesc = getIntentDescription(intentResult);
        String originalQuery = query != null ? query.getOriginalInput() : "";
        SemanticValidationResult semanticResult = validateWithLLM(response, originalQuery, intentDesc);
        log.debug("语义验证完成: relevant={}, score={}",
                  semanticResult.isRelevant(), semanticResult.getRelevanceScore());

        return buildFinalResult(ruleResult, semanticResult);
    }

    @Override
    public RuleValidationResult validateWithRules(IntentExecuteResponse response,
                                                  PreprocessedQuery query) {
        if (!ruleValidationEnabled) {
            return RuleValidationResult.passed();
        }

        List<ValidationIssue> issues = new ArrayList<>();

        // 规则1: 检查响应非空
        if (response == null) {
            issues.add(ValidationIssue.builder()
                    .type(ValidationIssue.IssueType.EMPTY_RESULT)
                    .message("响应对象为空")
                    .build());
            return RuleValidationResult.failed(issues, 0.0);
        }

        // 规则2: 检查执行状态
        if ("FAILED".equals(response.getStatus())) {
            issues.add(ValidationIssue.builder()
                    .type(ValidationIssue.IssueType.EXECUTION_FAILED)
                    .field("status")
                    .expected("COMPLETED")
                    .actual(response.getStatus())
                    .message("意图执行失败: " + response.getMessage())
                    .build());
        }

        // 规则3: 检查结果非空
        if (isEmptyResult(response)) {
            issues.add(ValidationIssue.builder()
                    .type(ValidationIssue.IssueType.EMPTY_RESULT)
                    .message("返回结果数据为空")
                    .build());
        }

        // 规则4: 检查时间范围
        if (query != null && query.getPrimaryTimeRange() != null) {
            ValidationIssue timeIssue = validateTimeRange(response, query.getPrimaryTimeRange());
            if (timeIssue != null) {
                issues.add(timeIssue);
            }
        }

        // 规则5: 检查实体匹配
        if (query != null && query.getResolvedReferences() != null && !query.getResolvedReferences().isEmpty()) {
            List<ValidationIssue> entityIssues = validateEntitiesFromResolvedRefs(response, query.getResolvedReferences());
            issues.addAll(entityIssues);
        }

        // 规则6: 检查必需字段
        List<ValidationIssue> fieldIssues = validateRequiredFields(response);
        issues.addAll(fieldIssues);

        double score = calculateRuleScore(issues);

        return RuleValidationResult.builder()
                .passed(issues.isEmpty() || score >= 0.7)
                .issues(issues)
                .score(score)
                .build();
    }

    @Override
    public SemanticValidationResult validateWithLLM(IntentExecuteResponse response,
                                                    String originalQuery,
                                                    String intentDescription) {
        if (!semanticValidationEnabled) {
            return SemanticValidationResult.relevant(1.0, "语义验证已禁用");
        }

        try {
            String prompt = buildSemanticValidationPrompt(response, originalQuery, intentDescription);
            String llmResponse = dashScopeClient.chatLowTemp(prompt, "验证以下执行结果是否正确回答了用户问题");

            return parseSemanticValidationResponse(llmResponse);
        } catch (Exception e) {
            log.error("语义验证失败: {}", e.getMessage(), e);
            // 语义验证失败时，默认返回相关（不阻塞流程）
            return SemanticValidationResult.builder()
                    .relevant(true)
                    .relevanceScore(0.5)
                    .reasoning("语义验证执行失败: " + e.getMessage())
                    .parseSuccess(false)
                    .build();
        }
    }

    @Override
    public boolean requiresSemanticValidation(IntentMatchResult intentResult,
                                              RuleValidationResult ruleResult) {
        if (!semanticValidationEnabled) {
            return false;
        }

        if (intentResult == null) {
            return false;
        }

        // 条件1: 置信度低于阈值
        Double confidence = intentResult.getConfidence();
        if (confidence != null && confidence < semanticValidationThreshold) {
            log.debug("意图置信度 {} 低于阈值 {}，需要语义验证", confidence, semanticValidationThreshold);
            return true;
        }

        // 条件2: 多意图结果
        if (Boolean.TRUE.equals(intentResult.getIsMultiIntent())) {
            log.debug("多意图结果，需要语义验证");
            return true;
        }

        // 条件3: 规则验证分数边界
        if (ruleResult != null && ruleResult.getScore() < 0.9 && ruleResult.getScore() >= 0.7) {
            log.debug("规则验证分数 {} 处于边界区间，需要语义验证", ruleResult.getScore());
            return true;
        }

        // 条件4: 使用了 LLM fallback 匹配
        if (intentResult.getMatchMethod() == IntentMatchResult.MatchMethod.LLM) {
            log.debug("使用了 LLM fallback，需要语义验证");
            return true;
        }

        return false;
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 构建语义验证提示词
     */
    private String buildSemanticValidationPrompt(IntentExecuteResponse response,
                                                 String originalQuery,
                                                 String intentDescription) {
        StringBuilder sb = new StringBuilder();
        sb.append("## 任务\n");
        sb.append("判断以下执行结果是否真正回答了用户的问题。\n\n");

        sb.append("## 用户原始问题\n");
        sb.append(originalQuery != null ? originalQuery : "未提供").append("\n\n");

        sb.append("## 识别的意图\n");
        sb.append(intentDescription != null ? intentDescription : "未识别").append("\n\n");

        sb.append("## 执行结果\n");
        sb.append(formatResponseForValidation(response)).append("\n\n");

        sb.append("## 输出格式 (仅返回JSON，不要添加其他文字)\n");
        sb.append("```json\n");
        sb.append("{\n");
        sb.append("  \"relevant\": true/false,\n");
        sb.append("  \"relevance_score\": 0.0-1.0,\n");
        sb.append("  \"reasoning\": \"判断理由\",\n");
        sb.append("  \"missing_information\": [\"缺少的信息1\", \"缺少的信息2\"],\n");
        sb.append("  \"suggested_follow_up\": \"建议的后续问题（如果结果不完整）\"\n");
        sb.append("}\n");
        sb.append("```\n");

        return sb.toString();
    }

    /**
     * 格式化响应用于验证
     */
    private String formatResponseForValidation(IntentExecuteResponse response) {
        if (response == null) {
            return "无响应";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("状态: ").append(response.getStatus()).append("\n");
        sb.append("消息: ").append(response.getMessage()).append("\n");

        if (response.getResultData() != null) {
            try {
                String dataStr = objectMapper.writeValueAsString(response.getResultData());
                // 截断过长的数据
                if (dataStr.length() > 1000) {
                    dataStr = dataStr.substring(0, 1000) + "... (已截断)";
                }
                sb.append("数据: ").append(dataStr).append("\n");
            } catch (JsonProcessingException e) {
                sb.append("数据: ").append(response.getResultData().toString()).append("\n");
            }
        }

        if (response.getAffectedEntities() != null && !response.getAffectedEntities().isEmpty()) {
            sb.append("受影响实体: ").append(response.getAffectedEntities().size()).append(" 个\n");
        }

        return sb.toString();
    }

    /**
     * 解析语义验证响应
     */
    private SemanticValidationResult parseSemanticValidationResponse(String llmResponse) {
        try {
            // 提取 JSON 部分
            String jsonStr = extractJsonFromResponse(llmResponse);
            if (jsonStr == null) {
                log.warn("无法从 LLM 响应中提取 JSON: {}", llmResponse);
                return SemanticValidationResult.parseError();
            }

            JsonNode root = objectMapper.readTree(jsonStr);

            boolean relevant = root.path("relevant").asBoolean(false);
            double relevanceScore = root.path("relevance_score").asDouble(0.5);
            String reasoning = root.path("reasoning").asText("无推理说明");
            String followUp = root.path("suggested_follow_up").asText(null);

            List<String> missingInfo = new ArrayList<>();
            JsonNode missingNode = root.path("missing_information");
            if (missingNode.isArray()) {
                for (JsonNode item : missingNode) {
                    missingInfo.add(item.asText());
                }
            }

            return SemanticValidationResult.builder()
                    .relevant(relevant)
                    .relevanceScore(relevanceScore)
                    .reasoning(reasoning)
                    .missingInformation(missingInfo)
                    .suggestedFollowUp(followUp)
                    .parseSuccess(true)
                    .build();

        } catch (Exception e) {
            log.error("解析语义验证响应失败: {}", e.getMessage());
            return SemanticValidationResult.parseError();
        }
    }

    /**
     * 从响应中提取 JSON
     */
    private String extractJsonFromResponse(String response) {
        if (response == null) {
            return null;
        }

        // 尝试找到 JSON 对象
        int start = response.indexOf('{');
        int end = response.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return response.substring(start, end + 1);
        }

        return null;
    }

    /**
     * 检查结果是否为空
     */
    private boolean isEmptyResult(IntentExecuteResponse response) {
        if (response == null || response.getResultData() == null) {
            // 对于某些状态，空结果是正常的
            String status = response != null ? response.getStatus() : null;
            if ("NEED_MORE_INFO".equals(status) || "PENDING_APPROVAL".equals(status)) {
                return false;
            }
            return true;
        }

        Object data = response.getResultData();
        if (data instanceof Collection) {
            return ((Collection<?>) data).isEmpty();
        }
        if (data instanceof Map) {
            return ((Map<?, ?>) data).isEmpty();
        }
        if (data instanceof String) {
            return ((String) data).trim().isEmpty();
        }

        return false;
    }

    /**
     * 验证时间范围
     */
    private ValidationIssue validateTimeRange(IntentExecuteResponse response,
                                              TimeNormalizationRules.TimeRange timeRange) {
        if (timeRange == null || timeRange.getStart() == null || timeRange.getEnd() == null) {
            return null;
        }

        Object data = response.getResultData();
        if (data == null) {
            return null;
        }

        // 检查结果中是否包含时间相关信息
        try {
            String dataStr = objectMapper.writeValueAsString(data);

            // 简单检查：如果查询包含时间范围，但结果中完全没有时间信息，可能有问题
            if (!dataStr.contains("time") && !dataStr.contains("date") &&
                !dataStr.contains("Time") && !dataStr.contains("Date") &&
                !dataStr.contains("At") && !dataStr.contains("创建") && !dataStr.contains("更新")) {
                // 可能是统计类查询，不需要时间字段
                return null;
            }
        } catch (JsonProcessingException e) {
            log.trace("序列化数据失败，跳过时间验证");
        }

        return null; // 默认不产生时间问题
    }

    /**
     * 验证实体匹配 - 从 ResolvedReference 映射
     */
    private List<ValidationIssue> validateEntitiesFromResolvedRefs(IntentExecuteResponse response,
                                                                    Map<String, PreprocessedQuery.ResolvedReference> resolvedReferences) {
        List<ValidationIssue> issues = new ArrayList<>();

        if (resolvedReferences == null || resolvedReferences.isEmpty()) {
            return issues;
        }

        Object data = response.getResultData();
        if (data == null) {
            return issues;
        }

        try {
            String dataStr = objectMapper.writeValueAsString(data);

            for (Map.Entry<String, PreprocessedQuery.ResolvedReference> entry : resolvedReferences.entrySet()) {
                PreprocessedQuery.ResolvedReference ref = entry.getValue();
                if (ref == null) continue;

                String entityId = ref.getEntityId();
                String entityName = ref.getEntityName();

                // 检查实体 ID 或名称是否出现在结果中
                boolean found = false;
                if (entityId != null && !entityId.isEmpty() && dataStr.contains(entityId)) {
                    found = true;
                }
                if (!found && entityName != null && !entityName.isEmpty() && dataStr.contains(entityName)) {
                    found = true;
                }

                if (!found) {
                    // 某些情况下实体可能被处理或转换，不一定直接出现
                    log.debug("实体 {} ({}) 未在结果中直接出现", ref.getEntityType(), entityId);
                }
            }
        } catch (JsonProcessingException e) {
            log.trace("序列化数据失败，跳过实体验证");
        }

        return issues;
    }

    /**
     * 验证实体匹配 - 从 SlotType 映射 (旧接口)
     */
    private List<ValidationIssue> validateEntities(IntentExecuteResponse response,
                                                   Map<EntitySlot.SlotType, String> resolvedReferences) {
        List<ValidationIssue> issues = new ArrayList<>();

        if (resolvedReferences == null || resolvedReferences.isEmpty()) {
            return issues;
        }

        Object data = response.getResultData();
        if (data == null) {
            return issues;
        }

        try {
            String dataStr = objectMapper.writeValueAsString(data);

            for (Map.Entry<EntitySlot.SlotType, String> entry : resolvedReferences.entrySet()) {
                EntitySlot.SlotType slotType = entry.getKey();
                String entityId = entry.getValue();

                // 检查实体 ID 是否出现在结果中
                if (entityId != null && !entityId.isEmpty() && !dataStr.contains(entityId)) {
                    // 某些情况下实体 ID 可能被处理或转换，不一定直接出现
                    // 这里只记录为轻微问题
                    log.debug("实体 {} ({}) 未在结果中直接出现", slotType, entityId);
                }
            }
        } catch (JsonProcessingException e) {
            log.trace("序列化数据失败，跳过实体验证");
        }

        return issues;
    }

    /**
     * 验证必需字段
     */
    private List<ValidationIssue> validateRequiredFields(IntentExecuteResponse response) {
        List<ValidationIssue> issues = new ArrayList<>();

        // 检查基本必需字段
        if (response.getStatus() == null) {
            issues.add(ValidationIssue.builder()
                    .type(ValidationIssue.IssueType.MISSING_FIELD)
                    .field("status")
                    .message("响应缺少状态字段")
                    .build());
        }

        // 对于成功状态，检查是否有结果数据或消息
        if ("COMPLETED".equals(response.getStatus())) {
            if (response.getResultData() == null && response.getMessage() == null) {
                issues.add(ValidationIssue.builder()
                        .type(ValidationIssue.IssueType.INCOMPLETE_INFO)
                        .message("执行完成但未返回数据或消息")
                        .build());
            }
        }

        // 对于需要更多信息状态，检查是否有澄清问题
        if ("NEED_MORE_INFO".equals(response.getStatus())) {
            if ((response.getClarificationQuestions() == null || response.getClarificationQuestions().isEmpty()) &&
                (response.getMissingParameters() == null || response.getMissingParameters().isEmpty())) {
                issues.add(ValidationIssue.builder()
                        .type(ValidationIssue.IssueType.MISSING_FIELD)
                        .field("clarificationQuestions")
                        .message("需要更多信息但未提供澄清问题")
                        .build());
            }
        }

        return issues;
    }

    /**
     * 计算规则验证分数
     */
    private double calculateRuleScore(List<ValidationIssue> issues) {
        if (issues == null || issues.isEmpty()) {
            return 1.0;
        }

        // 根据问题严重程度计算扣分
        double deduction = issues.stream()
                .mapToDouble(issue -> getIssueWeight(issue.getType()))
                .sum();

        return Math.max(0, 1.0 - deduction);
    }

    /**
     * 获取问题权重
     */
    private double getIssueWeight(ValidationIssue.IssueType type) {
        if (type == null) {
            return 0.1;
        }

        switch (type) {
            case EMPTY_RESULT:
                return 0.5;
            case EXECUTION_FAILED:
                return 0.6;
            case TIME_MISMATCH:
                return 0.3;
            case ENTITY_MISMATCH:
                return 0.3;
            case MISSING_FIELD:
                return 0.1;
            case IRRELEVANT_ANSWER:
                return 0.4;
            case INCOMPLETE_INFO:
                return 0.2;
            case TYPE_MISMATCH:
                return 0.2;
            default:
                return 0.1;
        }
    }

    /**
     * 构建无效结果
     */
    private ValidationResult buildInvalidResult(RuleValidationResult ruleResult) {
        String suggestion = buildSuggestion(ruleResult.getIssues());
        ValidationResult.RetryStrategy strategy = determineRetryStrategy(ruleResult.getIssues());

        return ValidationResult.builder()
                .valid(false)
                .status(ValidationResult.ValidationStatus.INVALID)
                .issues(ruleResult.getIssues())
                .suggestion(suggestion)
                .shouldRetry(strategy != ValidationResult.RetryStrategy.NONE)
                .retryStrategy(strategy)
                .ruleScore(ruleResult.getScore())
                .build();
    }

    /**
     * 构建有效结果
     */
    private ValidationResult buildValidResult(RuleValidationResult ruleResult) {
        ValidationResult.ValidationStatus status = ruleResult.getScore() >= 0.9 ?
                ValidationResult.ValidationStatus.VALID :
                ValidationResult.ValidationStatus.PARTIALLY_VALID;

        return ValidationResult.builder()
                .valid(true)
                .status(status)
                .issues(ruleResult.getIssues())
                .shouldRetry(false)
                .retryStrategy(ValidationResult.RetryStrategy.NONE)
                .ruleScore(ruleResult.getScore())
                .build();
    }

    /**
     * 构建最终结果（结合规则和语义验证）
     */
    private ValidationResult buildFinalResult(RuleValidationResult ruleResult,
                                              SemanticValidationResult semanticResult) {
        // 综合评分
        double finalScore = (ruleResult.getScore() * 0.6) + (semanticResult.getRelevanceScore() * 0.4);

        boolean isValid = finalScore >= 0.7 && semanticResult.isRelevant();

        ValidationResult.ValidationStatus status;
        if (isValid && finalScore >= 0.9) {
            status = ValidationResult.ValidationStatus.VALID;
        } else if (isValid) {
            status = ValidationResult.ValidationStatus.PARTIALLY_VALID;
        } else if (semanticResult.getMissingInformation() != null && !semanticResult.getMissingInformation().isEmpty()) {
            status = ValidationResult.ValidationStatus.NEED_CLARIFICATION;
        } else {
            status = ValidationResult.ValidationStatus.INVALID;
        }

        // 合并问题
        List<ValidationIssue> allIssues = new ArrayList<>(ruleResult.getIssues());
        if (!semanticResult.isRelevant()) {
            allIssues.add(ValidationIssue.builder()
                    .type(ValidationIssue.IssueType.IRRELEVANT_ANSWER)
                    .message(semanticResult.getReasoning())
                    .build());
        }

        // 构建建议
        String suggestion = buildCombinedSuggestion(ruleResult, semanticResult);

        ValidationResult.RetryStrategy strategy;
        if (!isValid) {
            if (status == ValidationResult.ValidationStatus.NEED_CLARIFICATION) {
                strategy = ValidationResult.RetryStrategy.USER_INPUT;
            } else if (!semanticResult.isRelevant()) {
                strategy = ValidationResult.RetryStrategy.REWRITE_QUERY;
            } else {
                strategy = ValidationResult.RetryStrategy.DIFFERENT_TOOL;
            }
        } else {
            strategy = ValidationResult.RetryStrategy.NONE;
        }

        return ValidationResult.builder()
                .valid(isValid)
                .status(status)
                .issues(allIssues)
                .suggestion(suggestion)
                .shouldRetry(!isValid)
                .retryStrategy(strategy)
                .ruleScore(ruleResult.getScore())
                .semanticScore(semanticResult.getRelevanceScore())
                .build();
    }

    /**
     * 构建建议信息
     */
    private String buildSuggestion(List<ValidationIssue> issues) {
        if (issues == null || issues.isEmpty()) {
            return null;
        }

        StringBuilder sb = new StringBuilder();
        for (ValidationIssue issue : issues) {
            if (issue.getMessage() != null) {
                sb.append(issue.getMessage()).append("; ");
            }
        }

        return sb.length() > 0 ? sb.toString().trim() : null;
    }

    /**
     * 构建组合建议
     */
    private String buildCombinedSuggestion(RuleValidationResult ruleResult,
                                           SemanticValidationResult semanticResult) {
        StringBuilder sb = new StringBuilder();

        // 添加规则验证建议
        String ruleSuggestion = buildSuggestion(ruleResult.getIssues());
        if (ruleSuggestion != null) {
            sb.append(ruleSuggestion);
        }

        // 添加语义验证建议
        if (semanticResult.getSuggestedFollowUp() != null) {
            if (sb.length() > 0) {
                sb.append(" ");
            }
            sb.append(semanticResult.getSuggestedFollowUp());
        }

        // 添加缺失信息提示
        if (semanticResult.getMissingInformation() != null && !semanticResult.getMissingInformation().isEmpty()) {
            if (sb.length() > 0) {
                sb.append(" 缺少: ");
            } else {
                sb.append("缺少: ");
            }
            sb.append(String.join(", ", semanticResult.getMissingInformation()));
        }

        return sb.length() > 0 ? sb.toString() : null;
    }

    /**
     * 确定重试策略
     */
    private ValidationResult.RetryStrategy determineRetryStrategy(List<ValidationIssue> issues) {
        if (issues == null || issues.isEmpty()) {
            return ValidationResult.RetryStrategy.NONE;
        }

        // 检查问题类型，决定重试策略
        for (ValidationIssue issue : issues) {
            if (issue.getType() == ValidationIssue.IssueType.EXECUTION_FAILED) {
                return ValidationResult.RetryStrategy.DIFFERENT_TOOL;
            }
            if (issue.getType() == ValidationIssue.IssueType.MISSING_FIELD ||
                issue.getType() == ValidationIssue.IssueType.INCOMPLETE_INFO) {
                return ValidationResult.RetryStrategy.USER_INPUT;
            }
        }

        // 默认重写查询
        return ValidationResult.RetryStrategy.REWRITE_QUERY;
    }

    /**
     * 获取意图描述
     */
    private String getIntentDescription(IntentMatchResult intentResult) {
        if (intentResult == null) {
            return "";
        }

        if (intentResult.getBestMatch() != null) {
            return intentResult.getBestMatch().getIntentName() +
                   " - " +
                   (intentResult.getBestMatch().getDescription() != null ?
                    intentResult.getBestMatch().getDescription() : "");
        }

        return "";
    }
}
