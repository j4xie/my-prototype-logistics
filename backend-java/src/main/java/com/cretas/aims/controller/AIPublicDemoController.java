package com.cretas.aims.controller;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.AIIntentService;
import com.cretas.aims.service.IntentExecutorService;
import com.cretas.aims.service.LinUCBService;
import com.cretas.aims.service.ResultFormatterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * AI公开演示控制器
 *
 * 提供无需登录的AI意图识别演示API：
 * - 查询类意图(LOW敏感度)可正常执行
 * - 写入类意图(MEDIUM/HIGH/CRITICAL)返回权限提示
 *
 * 用于演示页面展示AI能力，不暴露敏感操作
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@RestController
@RequestMapping("/api/public/ai-demo")
@RequiredArgsConstructor
@Tag(name = "AI公开演示", description = "无需登录的AI意图识别演示API")
@CrossOrigin(origins = "*") // 允许跨域访问
public class AIPublicDemoController {

    private final AIIntentService aiIntentService;
    private final IntentExecutorService intentExecutorService;
    private final ResultFormatterService resultFormatterService;
    private final LinUCBService linUCBService;

    // 演示用的默认工厂ID (使用真实工厂以获取正确的意图配置)
    private static final String DEMO_FACTORY_ID = "F001";

    // 演示用的默认用户信息 (使用 factory_super_admin 确保所有 LOW 敏感度查询能执行)
    // 写入操作（MEDIUM/HIGH/CRITICAL）会在敏感度检查阶段被拦截，不会执行
    private static final Long DEMO_USER_ID = 0L;
    private static final String DEMO_USER_ROLE = "factory_super_admin";

    // 允许执行的敏感度级别（只允许查询类）
    private static final Set<String> ALLOWED_SENSITIVITY_LEVELS = new HashSet<>(Arrays.asList("LOW"));

    // 需要上下文解析的指代词列表
    private static final Set<String> REFERENCE_WORDS = new HashSet<>(Arrays.asList(
            "这批", "那批", "上一批", "刚才那个", "这个", "那个", "它", "这些", "那些",
            "上面的", "前面的", "刚刚的", "之前的"
    ));

    @PostMapping("/execute")
    @Operation(summary = "演示执行AI意图", description = "无需登录的AI意图识别与执行演示。查询类操作可执行，写入类操作需要权限验证。")
    public ResponseEntity<ApiResponse<IntentExecuteResponse>> executeDemo(
            @RequestBody DemoExecuteRequest request) {

        String userInput = request.getUserInput();
        log.info("AI演示请求: input='{}'",
                userInput.length() > 50 ? userInput.substring(0, 50) + "..." : userInput);

        // 0. 检测未解析的指代词（演示模式没有上下文，无法解析指代）
        String unresolvedRef = detectUnresolvedReference(userInput);
        if (unresolvedRef != null) {
            log.info("AI演示检测到未解析指代词: '{}'", unresolvedRef);
            IntentExecuteResponse response = IntentExecuteResponse.builder()
                    .intentRecognized(false)
                    .status("NEED_MORE_INFO")
                    .message(buildClarificationMessage(unresolvedRef))
                    .clarificationQuestions(buildClarificationQuestions(unresolvedRef))
                    .executedAt(LocalDateTime.now())
                    .build();
            return ResponseEntity.ok(ApiResponse.success(response));
        }

        // 1. 识别意图
        IntentMatchResult matchResult = aiIntentService.recognizeIntentWithConfidence(
                userInput, DEMO_FACTORY_ID, 1, null, null);

        // 2. 如果没有匹配到意图
        if (!matchResult.hasMatch()) {
            IntentExecuteResponse response = IntentExecuteResponse.builder()
                    .intentRecognized(false)
                    .status("NOT_RECOGNIZED")
                    .message("未能识别您的意图，请尝试更具体的描述")
                    .executedAt(LocalDateTime.now())
                    .build();
            return ResponseEntity.ok(ApiResponse.success(response));
        }

        AIIntentConfig matchedIntent = matchResult.getBestMatch();
        String sensitivityLevel = matchedIntent.getSensitivityLevel();

        // 修复 NPE: 部分意图的 sensitivityLevel 可能为 null，默认为 LOW (允许查询操作)
        if (sensitivityLevel == null) {
            sensitivityLevel = "LOW";
            log.warn("意图 {} 的 sensitivityLevel 为空，使用默认值 LOW", matchedIntent.getIntentCode());
        }

        log.info("AI演示意图匹配: intentCode={}, sensitivity={}, confidence={}",
                matchedIntent.getIntentCode(), sensitivityLevel, matchResult.getConfidence());

        // 3. 检查敏感度级别 - 只允许LOW级别的查询操作
        if (!ALLOWED_SENSITIVITY_LEVELS.contains(sensitivityLevel)) {
            // 写入类操作，返回权限提示
            IntentExecuteResponse response = IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(matchedIntent.getIntentCode())
                    .intentName(matchedIntent.getIntentName())
                    .intentCategory(matchedIntent.getIntentCategory())
                    .sensitivityLevel(sensitivityLevel)
                    .confidence(matchResult.getConfidence())
                    .matchMethod(matchResult.getMatchMethod() != null ?
                            matchResult.getMatchMethod().name() : "KEYWORD")
                    .status("NO_PERMISSION")
                    .message(buildPermissionDeniedMessage(matchedIntent))
                    .requiresApproval(matchedIntent.needsApproval())
                    .quotaCost(matchedIntent.getQuotaCost())
                    .executedAt(LocalDateTime.now())
                    .build();

            log.info("AI演示权限拒绝: intentCode={}, sensitivity={}",
                    matchedIntent.getIntentCode(), sensitivityLevel);

            return ResponseEntity.ok(ApiResponse.success(response));
        }

        // 4. LOW敏感度的查询操作，正常执行
        try {
            IntentExecuteRequest executeRequest = IntentExecuteRequest.builder()
                    .userInput(userInput)
                    .intentCode(matchedIntent.getIntentCode())
                    .build();

            IntentExecuteResponse response = intentExecutorService.execute(
                    DEMO_FACTORY_ID, executeRequest, DEMO_USER_ID, DEMO_USER_ROLE);

            // 补充意图识别信息
            response.setIntentRecognized(true);
            response.setIntentCode(matchedIntent.getIntentCode());
            response.setIntentName(matchedIntent.getIntentName());
            response.setIntentCategory(matchedIntent.getIntentCategory());
            response.setSensitivityLevel(sensitivityLevel);
            response.setConfidence(matchResult.getConfidence());
            response.setMatchMethod(matchResult.getMatchMethod() != null ?
                    matchResult.getMatchMethod().name() : "KEYWORD");

            // 格式化结果为自然语言文本
            resultFormatterService.formatAndSet(response);

            log.info("AI演示执行成功: intentCode={}", matchedIntent.getIntentCode());

            return ResponseEntity.ok(ApiResponse.success(response));

        } catch (Exception e) {
            log.error("AI演示执行失败: intentCode={}, error={}",
                    matchedIntent.getIntentCode(), e.getMessage(), e);

            IntentExecuteResponse response = IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(matchedIntent.getIntentCode())
                    .intentName(matchedIntent.getIntentName())
                    .status("FAILED")
                    .message("演示执行失败: " + e.getMessage())
                    .executedAt(LocalDateTime.now())
                    .build();

            return ResponseEntity.ok(ApiResponse.success(response));
        }
    }

    @PostMapping("/recognize")
    @Operation(summary = "演示意图识别", description = "仅识别意图，不执行操作")
    public ResponseEntity<ApiResponse<IntentRecognizeResponse>> recognizeDemo(
            @RequestBody DemoExecuteRequest request) {

        String userInput = request.getUserInput();
        log.info("AI演示识别请求: input='{}'",
                userInput.length() > 50 ? userInput.substring(0, 50) + "..." : userInput);

        IntentMatchResult matchResult = aiIntentService.recognizeIntentWithConfidence(
                userInput, DEMO_FACTORY_ID, 1, null, null);

        IntentRecognizeResponse response = new IntentRecognizeResponse();
        response.setUserInput(userInput);
        response.setMatched(matchResult.hasMatch());

        if (matchResult.hasMatch()) {
            AIIntentConfig intent = matchResult.getBestMatch();
            response.setIntentCode(intent.getIntentCode());
            response.setIntentName(intent.getIntentName());
            response.setCategory(intent.getIntentCategory());
            response.setSensitivityLevel(intent.getSensitivityLevel());
            response.setConfidence(matchResult.getConfidence());
            response.setMatchMethod(matchResult.getMatchMethod() != null ?
                    matchResult.getMatchMethod().name() : null);
            response.setMatchLayer(determineMatchLayer(matchResult));
            response.setCanExecuteInDemo(ALLOWED_SENSITIVITY_LEVELS.contains(intent.getSensitivityLevel()));
            response.setToolName(intent.getToolName());
        }

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 构建权限拒绝消息
     */
    private String buildPermissionDeniedMessage(AIIntentConfig intent) {
        String sensitivityDesc;
        // 修复 NPE: sensitivityLevel 可能为 null
        String level = intent.getSensitivityLevel() != null ? intent.getSensitivityLevel() : "LOW";
        switch (level) {
            case "MEDIUM":
                sensitivityDesc = "中等敏感度操作";
                break;
            case "HIGH":
                sensitivityDesc = "高敏感度操作";
                break;
            case "CRITICAL":
                sensitivityDesc = "关键操作";
                break;
            default:
                sensitivityDesc = "敏感操作";
        }

        StringBuilder message = new StringBuilder();
        message.append("该操作属于").append(sensitivityDesc).append("（")
               .append(intent.getIntentName()).append("），需要验证权限。\n\n");
        message.append("在正式系统中，您需要：\n");
        message.append("1. 使用有效账号登录系统\n");
        message.append("2. 拥有「").append(intent.getIntentCategory()).append("」模块的操作权限\n");

        if (intent.needsApproval()) {
            message.append("3. 该操作还需要经过审批流程\n");
        }

        message.append("\n当前为演示模式，仅支持查询类操作。");

        return message.toString();
    }

    /**
     * 确定匹配层级
     */
    private int determineMatchLayer(IntentMatchResult matchResult) {
        if (matchResult.getMatchMethod() == null) return 6;

        switch (matchResult.getMatchMethod()) {
            case REGEX:
                return 1;
            case KEYWORD:
                Double conf = matchResult.getConfidence();
                if (conf != null && conf >= 0.9) return 2;
                if (conf != null && conf >= 0.7) return 3;
                return 4;
            case SEMANTIC:
                return 5;
            case LLM:
                return 6;
            default:
                return 6;
        }
    }

    /**
     * 检测输入中未解析的指代词
     * 演示模式没有对话上下文，无法解析指代词，需要提示用户澄清
     *
     * @param input 用户输入
     * @return 检测到的指代词，如果没有则返回null
     */
    private String detectUnresolvedReference(String input) {
        if (input == null || input.isEmpty()) {
            return null;
        }

        for (String refWord : REFERENCE_WORDS) {
            if (input.contains(refWord)) {
                return refWord;
            }
        }
        return null;
    }

    /**
     * 构建澄清消息
     */
    private String buildClarificationMessage(String refWord) {
        if (refWord.contains("批")) {
            return "您提到了「" + refWord + "」，但当前没有上下文信息。请问您想查询哪个批次？您可以提供批次号，例如：MB20260115001";
        } else if (refWord.contains("个") || refWord.equals("它")) {
            return "您提到了「" + refWord + "」，请具体说明您要查询的对象。例如：查询批次号MB20260115001的信息";
        } else {
            return "您的描述中包含指代词「" + refWord + "」，请提供更具体的信息。例如指定具体的批次号、产品名称或时间范围。";
        }
    }

    /**
     * 构建澄清问题示例
     */
    private java.util.List<String> buildClarificationQuestions(String refWord) {
        java.util.List<String> questions = new java.util.ArrayList<>();

        if (refWord.contains("批")) {
            questions.add("查询批次 MB20260115001 的质检结果");
            questions.add("查询今天的所有批次");
            questions.add("查询最近一周的质检记录");
        } else {
            questions.add("查询批次号为XXX的详情");
            questions.add("查询产品名称包含XXX的记录");
            questions.add("查询今天的所有记录");
        }

        return questions;
    }

    // ==================== LinUCB 测试端点 ====================

    @PostMapping("/linucb-test")
    @Operation(summary = "测试LinUCB工人推荐", description = "公开测试端点，验证LinUCB算法和策略干预集成")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> testLinUCB(
            @RequestBody LinUCBTestRequest request) {

        log.info("LinUCB测试请求: taskType={}", request.getTaskType());

        java.util.Map<String, Object> result = new java.util.HashMap<>();

        try {
            // 构造任务特征
            java.util.Map<String, Object> taskFeatures = new java.util.HashMap<>();
            taskFeatures.put("quantity", request.getQuantity() != null ? request.getQuantity() : 500);
            taskFeatures.put("deadlineHours", request.getDeadlineHours() != null ? request.getDeadlineHours() : 8);
            taskFeatures.put("productType", request.getTaskType() != null ? request.getTaskType() : "frozen_fish");
            taskFeatures.put("priority", request.getPriority() != null ? request.getPriority() : 5);
            taskFeatures.put("complexity", request.getComplexity() != null ? request.getComplexity() : 2);

            // 提取特征向量
            double[] featureArray = linUCBService.extractTaskFeatures(taskFeatures);

            // 候选工人ID (使用默认测试数据)
            java.util.List<Long> candidateIds = request.getCandidateWorkerIds();
            if (candidateIds == null || candidateIds.isEmpty()) {
                candidateIds = java.util.Arrays.asList(1L, 2L, 3L, 4L, 5L);
            }

            // 调用LinUCB推荐
            java.util.List<LinUCBService.WorkerRecommendation> recommendations =
                    linUCBService.recommendWorkers(DEMO_FACTORY_ID, featureArray, candidateIds);

            // 构造返回结果
            result.put("success", true);
            result.put("taskFeatures", taskFeatures);
            result.put("candidateCount", candidateIds.size());
            result.put("recommendations", recommendations);
            result.put("message", "LinUCB推荐完成，包含策略干预重排序 (新人培训/公平轮换/疲劳控制/紧急任务加权)");

            log.info("LinUCB测试成功: 返回 {} 个推荐", recommendations.size());

        } catch (Exception e) {
            log.error("LinUCB测试失败: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("message", "LinUCB测试失败: " + e.getMessage());
        }

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ==================== DTO Classes ====================

    @lombok.Data
    public static class DemoExecuteRequest {
        private String userInput;
    }

    @lombok.Data
    public static class LinUCBTestRequest {
        private String taskType;
        private Integer quantity;
        private Integer deadlineHours;
        private Integer priority;
        private Integer complexity;
        private java.util.List<Long> candidateWorkerIds;
    }

    @lombok.Data
    public static class IntentRecognizeResponse {
        private String userInput;
        private boolean matched;
        private String intentCode;
        private String intentName;
        private String category;
        private String sensitivityLevel;
        private Double confidence;
        private String matchMethod;
        private int matchLayer;
        private boolean canExecuteInDemo;
        private String toolName;
    }
}
