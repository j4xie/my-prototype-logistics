package com.cretas.aims.service.calibration.impl;

import com.cretas.aims.dto.calibration.FailureType;
import com.cretas.aims.dto.calibration.RecoveryPrompt;
import com.cretas.aims.entity.calibration.CorrectionRecord;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.repository.calibration.CorrectionRecordRepository;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.service.calibration.PromptInjectionService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 提示注入服务实现
 * 通过分析工具执行失败原因，生成恢复提示来引导 LLM 重试
 *
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的设计
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Service
@Slf4j
public class PromptInjectionServiceImpl implements PromptInjectionService {

    private final ToolCallRecordRepository toolCallRecordRepository;
    private final CorrectionRecordRepository correctionRecordRepository;
    private final ObjectMapper objectMapper;

    /**
     * 工具分类映射（用于查找替代工具）
     * key: 工具名称, value: 工具分类
     */
    private static final Map<String, String> TOOL_CATEGORY_MAP = new ConcurrentHashMap<>();

    /**
     * 工具替代映射（同类工具列表）
     * key: 工具分类, value: 工具名称列表
     */
    private static final Map<String, List<String>> CATEGORY_TOOLS_MAP = new ConcurrentHashMap<>();

    /**
     * 参数提取正则模式
     */
    private static final Pattern PARAM_ERROR_PATTERN = Pattern.compile(
        "(?:参数|parameter)[\\s:：]*['\"]?([a-zA-Z_]+)['\"]?",
        Pattern.CASE_INSENSITIVE
    );

    /**
     * 必填参数提取正则模式
     */
    private static final Pattern REQUIRED_PARAM_PATTERN = Pattern.compile(
        "(?:缺少必填|missing required|required)[\\s:：]*['\"]?([a-zA-Z_]+)['\"]?",
        Pattern.CASE_INSENSITIVE
    );

    static {
        // 初始化工具分类映射
        initializeToolMappings();
    }

    public PromptInjectionServiceImpl(
            ToolCallRecordRepository toolCallRecordRepository,
            CorrectionRecordRepository correctionRecordRepository,
            ObjectMapper objectMapper) {
        this.toolCallRecordRepository = toolCallRecordRepository;
        this.correctionRecordRepository = correctionRecordRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public FailureType analyzeFailure(String errorType, String errorMessage) {
        log.debug("Analyzing failure - errorType: {}, errorMessage: {}",
                errorType, errorMessage != null ? errorMessage.substring(0, Math.min(100, errorMessage.length())) : "null");

        FailureType failureType = FailureType.fromErrorInfo(errorType, errorMessage);

        log.info("Failure analyzed - type: {}, recoverable: {}", failureType.getCode(), failureType.isRecoverable());

        return failureType;
    }

    @Override
    public RecoveryPrompt generateRecoveryPrompt(
            FailureType failureType,
            String toolName,
            String parameters,
            String errorMessage) {
        return generateRecoveryPromptWithContext(failureType, toolName, parameters, errorMessage, null, null);
    }

    @Override
    public RecoveryPrompt generateRecoveryPromptWithContext(
            FailureType failureType,
            String toolName,
            String parameters,
            String errorMessage,
            String originalQuery,
            Map<String, Object> context) {

        log.info("Generating recovery prompt for tool: {}, failureType: {}", toolName, failureType.getCode());

        // 构建系统提示
        String systemPrompt = buildSystemPrompt(failureType, toolName, errorMessage);

        // 构建用户提示
        String userPrompt = buildUserPrompt(failureType, toolName, originalQuery, errorMessage);

        // 获取建议列表
        List<String> suggestions = generateSuggestions(failureType, toolName, parameters, errorMessage);

        // 获取替代工具
        List<String> alternatives = suggestAlternativeTools(toolName);
        String alternativeTool = alternatives.isEmpty() ? null : alternatives.get(0);
        String alternativeDesc = alternativeTool != null ? getToolDescription(alternativeTool) : null;

        // 获取参数修复建议
        Map<String, Object> parameterFixes = suggestParameterFixes(toolName, parameters, errorMessage);

        // 计算预计成功率
        Double successRate = getRecoverySuccessRate(toolName, failureType);

        // 判断是否需要用户确认
        boolean requiresConfirmation = failureType == FailureType.PERMISSION_ERROR ||
                                       failureType == FailureType.BUSINESS_ERROR;

        return RecoveryPrompt.builder()
                .systemPrompt(systemPrompt)
                .userPrompt(userPrompt)
                .suggestions(suggestions)
                .alternativeTool(alternativeTool)
                .alternativeToolDescription(alternativeDesc)
                .failureType(failureType)
                .originalError(errorMessage)
                .failedToolName(toolName)
                .parameterFixes(parameterFixes)
                .shouldRetry(failureType.isRecoverable())
                .currentRetryCount(0)
                .maxRetryCount(MAX_RETRY_ATTEMPTS)
                .estimatedSuccessRate(successRate)
                .requiresUserConfirmation(requiresConfirmation)
                .userConfirmationPrompt(requiresConfirmation ? buildConfirmationPrompt(failureType) : null)
                .build();
    }

    @Override
    public List<String> suggestAlternativeTools(String failedToolName) {
        if (failedToolName == null || failedToolName.isEmpty()) {
            return Collections.emptyList();
        }

        // 获取工具分类
        String category = TOOL_CATEGORY_MAP.get(failedToolName);
        if (category == null) {
            category = inferToolCategory(failedToolName);
        }

        // 获取同类工具
        List<String> categoryTools = CATEGORY_TOOLS_MAP.get(category);
        if (categoryTools == null || categoryTools.isEmpty()) {
            return Collections.emptyList();
        }

        // 过滤掉失败的工具，返回替代列表
        return categoryTools.stream()
                .filter(tool -> !tool.equals(failedToolName))
                .limit(3)
                .collect(Collectors.toList());
    }

    @Override
    public Map<String, Object> suggestParameterFixes(
            String toolName,
            String parameters,
            String errorMessage) {

        Map<String, Object> fixes = new LinkedHashMap<>();

        if (errorMessage == null || errorMessage.isEmpty()) {
            return fixes;
        }

        // 解析原始参数
        Map<String, Object> originalParams = parseParameters(parameters);

        // 检测缺失的必填参数
        Matcher requiredMatcher = REQUIRED_PARAM_PATTERN.matcher(errorMessage);
        while (requiredMatcher.find()) {
            String paramName = requiredMatcher.group(1);
            fixes.put(paramName, Map.of(
                    "issue", "缺少必填参数",
                    "suggestion", "请提供 " + paramName + " 参数",
                    "currentValue", originalParams.getOrDefault(paramName, "未提供")
            ));
        }

        // 检测格式错误的参数
        Matcher paramMatcher = PARAM_ERROR_PATTERN.matcher(errorMessage);
        while (paramMatcher.find()) {
            String paramName = paramMatcher.group(1);
            if (!fixes.containsKey(paramName)) {
                Object currentValue = originalParams.get(paramName);
                fixes.put(paramName, Map.of(
                        "issue", "参数格式错误",
                        "suggestion", suggestParamFormat(toolName, paramName),
                        "currentValue", currentValue != null ? currentValue.toString() : "未提供"
                ));
            }
        }

        // 常见日期格式修复
        if (errorMessage.contains("日期") || errorMessage.toLowerCase().contains("date")) {
            fixes.put("_dateFormat", Map.of(
                    "issue", "日期格式问题",
                    "suggestion", "请使用 yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss 格式"
            ));
        }

        // 常见数字格式修复
        if (errorMessage.contains("数字") || errorMessage.toLowerCase().contains("number")) {
            fixes.put("_numberFormat", Map.of(
                    "issue", "数字格式问题",
                    "suggestion", "请确保数值参数为有效数字，不包含非数字字符"
            ));
        }

        log.debug("Generated {} parameter fixes for tool: {}", fixes.size(), toolName);

        return fixes;
    }

    @Override
    public boolean shouldAttemptRecovery(Long toolCallId) {
        if (toolCallId == null) {
            return false;
        }

        Optional<ToolCallRecord> recordOpt = toolCallRecordRepository.findById(toolCallId);
        if (recordOpt.isEmpty()) {
            log.warn("Tool call record not found: {}", toolCallId);
            return false;
        }

        ToolCallRecord record = recordOpt.get();

        // 检查重试次数
        int retryCount = record.getRetryCount() != null ? record.getRetryCount() : 0;
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
            log.info("Max retry attempts reached for toolCallId: {}", toolCallId);
            return false;
        }

        // 检查错误类型是否可恢复
        FailureType failureType = analyzeFailure(record.getErrorType(), record.getErrorMessage());
        if (!failureType.isRecoverable()) {
            log.info("Failure type {} is not recoverable for toolCallId: {}", failureType.getCode(), toolCallId);
            return false;
        }

        // 检查历史恢复成功率
        Double successRate = getRecoverySuccessRate(record.getToolName(), failureType);
        if (successRate != null && successRate < 0.1) {
            log.info("Low recovery success rate ({}) for tool: {}, failureType: {}",
                    successRate, record.getToolName(), failureType.getCode());
            return false;
        }

        return true;
    }

    @Override
    @Transactional
    public void recordRecoveryAttempt(Long toolCallId, RecoveryPrompt recoveryPrompt, boolean success) {
        if (toolCallId == null) {
            log.warn("Cannot record recovery attempt: toolCallId is null");
            return;
        }

        Optional<ToolCallRecord> recordOpt = toolCallRecordRepository.findById(toolCallId);
        if (recordOpt.isEmpty()) {
            log.warn("Tool call record not found: {}", toolCallId);
            return;
        }

        ToolCallRecord toolCallRecord = recordOpt.get();

        // 更新工具调用记录
        toolCallRecord.incrementRetryCount();
        if (success) {
            toolCallRecord.recordRecovery(recoveryPrompt.getFailureType().getCode());
        }
        toolCallRecordRepository.save(toolCallRecord);

        // 创建纠错记录
        CorrectionRecord correctionRecord = CorrectionRecord.builder()
                .toolCallId(toolCallId)
                .factoryId(toolCallRecord.getFactoryId())
                .sessionId(toolCallRecord.getSessionId())
                .errorType(toolCallRecord.getErrorType())
                .errorCategory(mapFailureTypeToErrorCategory(recoveryPrompt.getFailureType()))
                .originalErrorMessage(recoveryPrompt.getOriginalError())
                .correctionStrategy(CorrectionRecord.CorrectionStrategy.PROMPT_INJECTION)
                .injectedPrompt(truncatePrompt(recoveryPrompt.getSystemPrompt()))
                .correctionSuccess(success)
                .correctionRounds(recoveryPrompt.getCurrentRetryCount() + 1)
                .finalStatus(success ? "RECOVERED" : "FAILED")
                .build();

        correctionRecordRepository.save(correctionRecord);

        log.info("Recovery attempt recorded - toolCallId: {}, success: {}, rounds: {}",
                toolCallId, success, correctionRecord.getCorrectionRounds());
    }

    @Override
    public Double getRecoverySuccessRate(String toolName, FailureType failureType) {
        if (toolName == null || failureType == null) {
            return null;
        }

        try {
            // 查询最近30天的数据
            LocalDateTime startTime = LocalDateTime.now().minusDays(30);
            LocalDateTime endTime = LocalDateTime.now();

            CorrectionRecord.ErrorCategory errorCategory = mapFailureTypeToErrorCategory(failureType);

            // 这里简化处理，实际应该有更精确的查询
            List<CorrectionRecord> records = correctionRecordRepository
                    .findByErrorCategory(errorCategory, org.springframework.data.domain.PageRequest.of(0, 100))
                    .getContent();

            if (records.isEmpty()) {
                return null;
            }

            long total = records.size();
            long successful = records.stream().filter(CorrectionRecord::getCorrectionSuccess).count();

            return total > 0 ? (double) successful / total : null;

        } catch (Exception e) {
            log.error("Error calculating recovery success rate for tool: {}", toolName, e);
            return null;
        }
    }

    @Override
    public RecoveryPrompt quickRecover(
            Long toolCallId,
            String toolName,
            String parameters,
            String errorType,
            String errorMessage) {

        // 检查是否应该尝试恢复
        if (toolCallId != null && !shouldAttemptRecovery(toolCallId)) {
            return RecoveryPrompt.unrecoverable(
                    "已达到最大重试次数或错误类型不可恢复",
                    analyzeFailure(errorType, errorMessage)
            );
        }

        // 分析失败类型
        FailureType failureType = analyzeFailure(errorType, errorMessage);

        // 如果不可恢复，直接返回
        if (!failureType.isRecoverable()) {
            return RecoveryPrompt.unrecoverable(
                    failureType.getDefaultRecoveryHint(),
                    failureType
            );
        }

        // 生成恢复提示
        RecoveryPrompt prompt = generateRecoveryPrompt(failureType, toolName, parameters, errorMessage);

        // 设置当前重试次数
        if (toolCallId != null) {
            Optional<ToolCallRecord> recordOpt = toolCallRecordRepository.findById(toolCallId);
            if (recordOpt.isPresent()) {
                int retryCount = recordOpt.get().getRetryCount() != null ? recordOpt.get().getRetryCount() : 0;
                prompt.setCurrentRetryCount(retryCount);
            }
        }

        log.info("Quick recovery prompt generated for tool: {}, canRetry: {}", toolName, prompt.canRetry());

        return prompt;
    }

    @Override
    public Map<String, Object> analyzeFailurePatterns(String factoryId, String toolName, int days) {
        Map<String, Object> analysis = new LinkedHashMap<>();

        try {
            LocalDateTime startTime = LocalDateTime.now().minusDays(days);
            LocalDateTime endTime = LocalDateTime.now();

            // 获取失败的工具调用记录
            List<ToolCallRecord> failedCalls;
            if (factoryId != null) {
                failedCalls = toolCallRecordRepository
                        .findByFactoryIdAndCreatedAtBetween(factoryId, startTime, endTime)
                        .stream()
                        .filter(r -> r.getExecutionStatus() == ToolCallRecord.ExecutionStatus.FAILED)
                        .collect(Collectors.toList());
            } else {
                failedCalls = new ArrayList<>();
            }

            if (toolName != null) {
                failedCalls = failedCalls.stream()
                        .filter(r -> toolName.equals(r.getToolName()))
                        .collect(Collectors.toList());
            }

            // 统计失败类型分布
            Map<String, Long> failureTypeDistribution = failedCalls.stream()
                    .map(r -> analyzeFailure(r.getErrorType(), r.getErrorMessage()))
                    .collect(Collectors.groupingBy(FailureType::getCode, Collectors.counting()));

            // 统计工具失败分布
            Map<String, Long> toolFailureDistribution = failedCalls.stream()
                    .collect(Collectors.groupingBy(
                            ToolCallRecord::getToolName,
                            Collectors.counting()
                    ));

            // 计算恢复率
            long totalFailed = failedCalls.size();
            long totalRecovered = failedCalls.stream().filter(r -> Boolean.TRUE.equals(r.getRecovered())).count();
            double recoveryRate = totalFailed > 0 ? (double) totalRecovered / totalFailed : 0;

            // 常见错误消息
            List<String> topErrorMessages = failedCalls.stream()
                    .map(ToolCallRecord::getErrorMessage)
                    .filter(Objects::nonNull)
                    .collect(Collectors.groupingBy(msg -> msg.length() > 100 ? msg.substring(0, 100) : msg, Collectors.counting()))
                    .entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .limit(5)
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toList());

            analysis.put("period", Map.of("startTime", startTime.toString(), "endTime", endTime.toString()));
            analysis.put("totalFailures", totalFailed);
            analysis.put("totalRecovered", totalRecovered);
            analysis.put("recoveryRate", recoveryRate);
            analysis.put("failureTypeDistribution", failureTypeDistribution);
            analysis.put("toolFailureDistribution", toolFailureDistribution);
            analysis.put("topErrorMessages", topErrorMessages);

            // 建议
            List<String> recommendations = generateRecommendations(failureTypeDistribution, recoveryRate);
            analysis.put("recommendations", recommendations);

        } catch (Exception e) {
            log.error("Error analyzing failure patterns", e);
            analysis.put("error", e.getMessage());
        }

        return analysis;
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 构建系统提示
     */
    private String buildSystemPrompt(FailureType failureType, String toolName, String errorMessage) {
        StringBuilder sb = new StringBuilder();

        sb.append("## 错误恢复指导\n\n");

        sb.append("### 失败信息\n");
        sb.append("- **工具**: ").append(toolName).append("\n");
        sb.append("- **错误类型**: ").append(failureType.getDescription()).append("\n");
        sb.append("- **错误详情**: ").append(errorMessage != null ? errorMessage : "无详细信息").append("\n\n");

        sb.append("### 恢复策略\n");
        sb.append(failureType.getDefaultRecoveryHint()).append("\n\n");

        switch (failureType) {
            case PARAMETER_ERROR:
                sb.append("### 参数检查要点\n");
                sb.append("1. 确认所有必填参数已提供\n");
                sb.append("2. 检查参数类型是否正确（字符串、数字、日期等）\n");
                sb.append("3. 验证参数值是否在有效范围内\n");
                sb.append("4. 注意日期格式应为 yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss\n");
                break;

            case DATA_NOT_FOUND:
                sb.append("### 数据查询建议\n");
                sb.append("1. 尝试使用更宽泛的查询条件\n");
                sb.append("2. 检查数据标识符是否正确\n");
                sb.append("3. 考虑使用模糊匹配或部分匹配\n");
                sb.append("4. 确认数据确实存在于系统中\n");
                break;

            case SERVICE_UNAVAILABLE:
                sb.append("### 服务恢复建议\n");
                sb.append("1. 等待 2-3 秒后重试\n");
                sb.append("2. 如果持续失败，尝试使用替代工具\n");
                sb.append("3. 简化请求参数减少处理负担\n");
                break;

            case VALIDATION_ERROR:
                sb.append("### 数据验证建议\n");
                sb.append("1. 检查输入数据格式\n");
                sb.append("2. 确保数值在合理范围内\n");
                sb.append("3. 验证业务规则约束\n");
                break;

            case PERMISSION_ERROR:
                sb.append("### 权限问题处理\n");
                sb.append("1. 此操作需要更高权限\n");
                sb.append("2. 建议用户联系管理员\n");
                sb.append("3. 或尝试使用权限要求更低的替代功能\n");
                break;

            default:
                sb.append("### 通用恢复步骤\n");
                sb.append("1. 仔细分析错误消息\n");
                sb.append("2. 调整参数后重试\n");
                sb.append("3. 如果持续失败，考虑替代方案\n");
        }

        return sb.toString();
    }

    /**
     * 构建用户提示
     */
    private String buildUserPrompt(FailureType failureType, String toolName, String originalQuery, String errorMessage) {
        StringBuilder sb = new StringBuilder();

        if (originalQuery != null && !originalQuery.isEmpty()) {
            sb.append("原始请求: ").append(originalQuery).append("\n\n");
        }

        sb.append("上次尝试使用工具 [").append(toolName).append("] 失败。\n");
        sb.append("错误原因: ").append(failureType.getDescription()).append("\n");

        if (errorMessage != null) {
            sb.append("详细错误: ").append(errorMessage).append("\n");
        }

        sb.append("\n请根据错误信息调整参数后重新尝试，或选择其他合适的工具。");

        return sb.toString();
    }

    /**
     * 生成恢复建议列表
     */
    private List<String> generateSuggestions(
            FailureType failureType,
            String toolName,
            String parameters,
            String errorMessage) {

        List<String> suggestions = new ArrayList<>();

        switch (failureType) {
            case PARAMETER_ERROR:
                suggestions.add("检查参数格式是否正确");
                suggestions.add("确保所有必填参数已提供");
                suggestions.add("验证参数值类型（数字、字符串、日期等）");
                if (errorMessage != null && errorMessage.contains("日期")) {
                    suggestions.add("日期格式应为: yyyy-MM-dd");
                }
                break;

            case DATA_NOT_FOUND:
                suggestions.add("扩大查询范围或放宽条件");
                suggestions.add("检查输入的标识符是否正确");
                suggestions.add("尝试使用模糊匹配");
                suggestions.add("确认目标数据确实存在");
                break;

            case SERVICE_UNAVAILABLE:
                suggestions.add("等待几秒后重试");
                suggestions.add("减少请求的数据量");
                List<String> alternatives = suggestAlternativeTools(toolName);
                if (!alternatives.isEmpty()) {
                    suggestions.add("尝试替代工具: " + String.join(", ", alternatives));
                }
                break;

            case PERMISSION_ERROR:
                suggestions.add("联系管理员获取相应权限");
                suggestions.add("检查当前用户的角色设置");
                suggestions.add("尝试使用权限要求更低的操作");
                break;

            case VALIDATION_ERROR:
                suggestions.add("检查数据格式是否符合要求");
                suggestions.add("确保数值在有效范围内");
                suggestions.add("验证是否满足业务规则");
                break;

            case BUSINESS_ERROR:
                suggestions.add("检查当前业务状态是否允许此操作");
                suggestions.add("确认前置条件已满足");
                suggestions.add("查看业务规则限制");
                break;

            case RESOURCE_CONFLICT:
                suggestions.add("使用不同的资源标识符");
                suggestions.add("先查询现有资源再决定创建或更新");
                suggestions.add("考虑更新而非创建");
                break;

            default:
                suggestions.add("分析错误消息中的关键信息");
                suggestions.add("尝试简化请求");
                suggestions.add("考虑分步骤执行");
        }

        return suggestions;
    }

    /**
     * 构建用户确认提示
     */
    private String buildConfirmationPrompt(FailureType failureType) {
        switch (failureType) {
            case PERMISSION_ERROR:
                return "此操作需要额外权限，是否继续尝试或联系管理员？";
            case BUSINESS_ERROR:
                return "业务规则限制此操作，是否调整操作方式后重试？";
            default:
                return "是否继续尝试恢复？";
        }
    }

    /**
     * 解析参数 JSON
     */
    private Map<String, Object> parseParameters(String parameters) {
        if (parameters == null || parameters.isEmpty()) {
            return Collections.emptyMap();
        }

        try {
            return objectMapper.readValue(parameters, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.debug("Failed to parse parameters as JSON: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    /**
     * 建议参数格式
     */
    private String suggestParamFormat(String toolName, String paramName) {
        // 常见参数格式建议
        String paramLower = paramName.toLowerCase();

        if (paramLower.contains("date") || paramLower.contains("time")) {
            return "格式: yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss";
        }
        if (paramLower.contains("id")) {
            return "格式: 有效的ID标识符";
        }
        if (paramLower.contains("quantity") || paramLower.contains("amount") || paramLower.contains("count")) {
            return "格式: 正整数或正数";
        }
        if (paramLower.contains("page") || paramLower.contains("size")) {
            return "格式: 正整数，page从0或1开始";
        }

        return "请检查参数值格式";
    }

    /**
     * 推断工具分类
     */
    private String inferToolCategory(String toolName) {
        if (toolName == null) {
            return "unknown";
        }

        String lower = toolName.toLowerCase();

        if (lower.contains("query") || lower.contains("list") || lower.contains("get") || lower.contains("search")) {
            return "query";
        }
        if (lower.contains("create") || lower.contains("add")) {
            return "create";
        }
        if (lower.contains("update") || lower.contains("modify")) {
            return "update";
        }
        if (lower.contains("delete") || lower.contains("remove")) {
            return "delete";
        }
        if (lower.contains("material") || lower.contains("batch")) {
            return "material";
        }
        if (lower.contains("production") || lower.contains("plan")) {
            return "production";
        }
        if (lower.contains("quality") || lower.contains("check")) {
            return "quality";
        }
        if (lower.contains("equipment") || lower.contains("device")) {
            return "equipment";
        }
        if (lower.contains("report") || lower.contains("stats")) {
            return "report";
        }
        if (lower.contains("alert") || lower.contains("alarm")) {
            return "alert";
        }
        if (lower.contains("shipment") || lower.contains("delivery")) {
            return "shipment";
        }
        if (lower.contains("user") || lower.contains("hr") || lower.contains("attendance")) {
            return "hr";
        }

        return "general";
    }

    /**
     * 获取工具描述
     */
    private String getToolDescription(String toolName) {
        // 简化实现，实际应该从 ToolRegistry 获取
        Map<String, String> descriptions = Map.of(
                "MaterialBatchQueryTool", "查询物料批次信息",
                "MaterialBatchListTool", "列出物料批次列表",
                "ProductionPlanQueryTool", "查询生产计划",
                "QualityCheckQueryTool", "查询质检记录",
                "EquipmentListTool", "查询设备列表",
                "ReportDashboardOverviewTool", "获取仪表板概览"
        );

        return descriptions.getOrDefault(toolName, "替代工具");
    }

    /**
     * 映射 FailureType 到 ErrorCategory
     */
    private CorrectionRecord.ErrorCategory mapFailureTypeToErrorCategory(FailureType failureType) {
        switch (failureType) {
            case PARAMETER_ERROR:
            case VALIDATION_ERROR:
                return CorrectionRecord.ErrorCategory.FORMAT_ERROR;
            case DATA_NOT_FOUND:
                return CorrectionRecord.ErrorCategory.DATA_INSUFFICIENT;
            case BUSINESS_ERROR:
                return CorrectionRecord.ErrorCategory.LOGIC_ERROR;
            default:
                return CorrectionRecord.ErrorCategory.UNKNOWN;
        }
    }

    /**
     * 截断提示（用于存储）
     */
    private String truncatePrompt(String prompt) {
        if (prompt == null) {
            return null;
        }
        return prompt.length() > 2000 ? prompt.substring(0, 2000) : prompt;
    }

    /**
     * 生成优化建议
     */
    private List<String> generateRecommendations(Map<String, Long> failureTypeDistribution, double recoveryRate) {
        List<String> recommendations = new ArrayList<>();

        if (recoveryRate < 0.3) {
            recommendations.add("恢复成功率较低，建议优化恢复策略或增加参数验证");
        }

        if (failureTypeDistribution.getOrDefault("PARAMETER_ERROR", 0L) > 10) {
            recommendations.add("参数错误频发，建议加强输入验证和用户引导");
        }

        if (failureTypeDistribution.getOrDefault("SERVICE_UNAVAILABLE", 0L) > 5) {
            recommendations.add("服务可用性问题较多，建议检查服务健康状况");
        }

        if (failureTypeDistribution.getOrDefault("DATA_NOT_FOUND", 0L) > 10) {
            recommendations.add("数据未找到错误较多，建议优化查询逻辑或数据提示");
        }

        if (recommendations.isEmpty()) {
            recommendations.add("整体失败恢复情况良好，继续保持");
        }

        return recommendations;
    }

    /**
     * 初始化工具映射
     */
    private static void initializeToolMappings() {
        // 物料类工具
        List<String> materialTools = Arrays.asList(
                "MaterialBatchQueryTool", "MaterialBatchListTool", "MaterialBatchCreateTool",
                "MaterialBatchUseTool", "MaterialBatchConsumeTool", "MaterialBatchReserveTool",
                "MaterialBatchReleaseTool", "MaterialAdjustQuantityTool",
                "MaterialLowStockAlertTool", "MaterialExpiringAlertTool", "MaterialExpiredQueryTool",
                "MaterialFifoRecommendTool"
        );
        CATEGORY_TOOLS_MAP.put("material", materialTools);
        materialTools.forEach(tool -> TOOL_CATEGORY_MAP.put(tool, "material"));

        // 生产类工具
        List<String> productionTools = Arrays.asList(
                "ProcessingBatchListTool", "ProcessingBatchDetailTool", "ProcessingBatchTimelineTool",
                "ProcessingBatchCreateTool", "ProcessingBatchStartTool", "ProcessingBatchPauseTool",
                "ProcessingBatchResumeTool", "ProcessingBatchCompleteTool", "ProcessingBatchCancelTool",
                "ProcessingBatchWorkersTool", "ProcessingWorkerAssignTool", "ProcessingWorkerCheckoutTool"
        );
        CATEGORY_TOOLS_MAP.put("production", productionTools);
        productionTools.forEach(tool -> TOOL_CATEGORY_MAP.put(tool, "production"));

        // 质检类工具
        List<String> qualityTools = Arrays.asList(
                "QualityCheckQueryTool", "QualityRecordQueryTool", "QualityStatsQueryTool",
                "QualityCheckCreateTool", "QualityCheckUpdateTool", "QualityResultSubmitTool"
        );
        CATEGORY_TOOLS_MAP.put("quality", qualityTools);
        qualityTools.forEach(tool -> TOOL_CATEGORY_MAP.put(tool, "quality"));

        // 设备类工具
        List<String> equipmentTools = Arrays.asList(
                "EquipmentListTool", "EquipmentDetailTool", "EquipmentStatsTool",
                "EquipmentStartTool", "EquipmentStopTool", "EquipmentStatusUpdateTool",
                "EquipmentAlertListTool", "EquipmentAlertStatsTool",
                "EquipmentAlertAcknowledgeTool", "EquipmentAlertResolveTool"
        );
        CATEGORY_TOOLS_MAP.put("equipment", equipmentTools);
        equipmentTools.forEach(tool -> TOOL_CATEGORY_MAP.put(tool, "equipment"));

        // 报表类工具
        List<String> reportTools = Arrays.asList(
                "ReportDashboardOverviewTool", "ReportProductionTool", "ReportQualityTool",
                "ReportInventoryTool", "ReportEfficiencyTool", "ReportFinanceTool",
                "ReportKpiTool", "ReportTrendsTool", "ReportAnomalyTool",
                "ReportOeeTool", "ReportBomCostTool", "ReportCostVarianceTool"
        );
        CATEGORY_TOOLS_MAP.put("report", reportTools);
        reportTools.forEach(tool -> TOOL_CATEGORY_MAP.put(tool, "report"));

        // 告警类工具
        List<String> alertTools = Arrays.asList(
                "AlertListTool", "AlertActiveTool", "AlertByEquipmentTool", "AlertByLevelTool",
                "AlertStatsTool", "AlertAcknowledgeTool", "AlertResolveTool",
                "AlertDiagnoseTool", "AlertTriageTool"
        );
        CATEGORY_TOOLS_MAP.put("alert", alertTools);
        alertTools.forEach(tool -> TOOL_CATEGORY_MAP.put(tool, "alert"));

        // 发货类工具
        List<String> shipmentTools = Arrays.asList(
                "ShipmentQueryTool", "ShipmentByDateTool", "ShipmentByCustomerTool",
                "ShipmentStatsQueryTool", "ShipmentCreateTool", "ShipmentUpdateTool",
                "ShipmentConfirmTool", "ShipmentCompleteTool", "ShipmentCancelTool",
                "ShipmentStatusUpdateTool"
        );
        CATEGORY_TOOLS_MAP.put("shipment", shipmentTools);
        shipmentTools.forEach(tool -> TOOL_CATEGORY_MAP.put(tool, "shipment"));

        // 溯源类工具
        List<String> traceTools = Arrays.asList(
                "TraceBatchTool", "TraceFullTool", "TracePublicTool"
        );
        CATEGORY_TOOLS_MAP.put("trace", traceTools);
        traceTools.forEach(tool -> TOOL_CATEGORY_MAP.put(tool, "trace"));

        // 客户/供应商类工具
        List<String> crmTools = Arrays.asList(
                "CustomerListTool", "CustomerSearchTool", "CustomerActiveTool",
                "CustomerByTypeTool", "CustomerPurchaseHistoryTool", "CustomerStatsTool",
                "SupplierListTool", "SupplierSearchTool", "SupplierActiveTool",
                "SupplierByCategoryTool", "SupplierEvaluateTool", "SupplierRankingTool"
        );
        CATEGORY_TOOLS_MAP.put("crm", crmTools);
        crmTools.forEach(tool -> TOOL_CATEGORY_MAP.put(tool, "crm"));

        // 人事/考勤类工具
        List<String> hrTools = Arrays.asList(
                "ClockInTool", "ClockOutTool", "AttendanceTodayTool",
                "AttendanceStatusTool", "AttendanceHistoryTool", "AttendanceMonthlyTool",
                "AttendanceDepartmentTool", "AttendanceAnomalyTool", "AttendanceStatsTool",
                "UserCreateTool", "UserRoleAssignTool", "UserDisableTool"
        );
        CATEGORY_TOOLS_MAP.put("hr", hrTools);
        hrTools.forEach(tool -> TOOL_CATEGORY_MAP.put(tool, "hr"));
    }
}
