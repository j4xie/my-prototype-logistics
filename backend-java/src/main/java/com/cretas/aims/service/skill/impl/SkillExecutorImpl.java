package com.cretas.aims.service.skill.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.dto.skill.SkillContext;
import com.cretas.aims.dto.skill.SkillDefinition;
import com.cretas.aims.dto.skill.SkillResult;
import com.cretas.aims.service.skill.SkillExecutor;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Skill 执行器服务实现
 *
 * 负责执行 Skill 的完整生命周期:
 * 1. 准备 Prompt (替换模板变量)
 * 2. 调用 LLM 获取参数和执行计划
 * 3. 解析 LLM 响应，提取参数
 * 4. 执行关联的 Tools
 *
 * 集成现有服务:
 * - ToolRegistry: 获取和执行工具
 * - DashScopeClient: LLM 调用
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SkillExecutorImpl implements SkillExecutor {

    private final ToolRegistry toolRegistry;
    private final DashScopeClient dashScopeClient;
    private final ObjectMapper objectMapper;

    // ==================== Configuration ====================

    @Value("${ai.skill_executor.parallel_execution_enabled:true}")
    private boolean parallelExecutionEnabled;

    @Value("${ai.skill_executor.tool_timeout_seconds:30}")
    private int toolTimeoutSeconds;

    @Value("${ai.skill_executor.max_tools_per_skill:5}")
    private int maxToolsPerSkill;

    @Value("${ai.skill_executor.default_timeout_ms:60000}")
    private long defaultTimeoutMs;

    /**
     * Tool execution thread pool
     */
    private final ExecutorService executorService = Executors.newFixedThreadPool(4);

    /**
     * Variable placeholder pattern: ${variableName}
     */
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\$\\{([^}]+)}");

    // ==================== Interface Implementation ====================

    @Override
    public SkillResult execute(SkillDefinition skill, SkillContext context) {
        return execute(skill, context, defaultTimeoutMs);
    }

    @Override
    public SkillResult execute(SkillDefinition skill, SkillContext context, long timeoutMs) {
        long startTime = System.currentTimeMillis();
        List<String> executedTools = new ArrayList<>();

        log.info("Starting skill execution: skill={}, userQuery='{}', timeout={}ms",
                skill.getName(),
                truncateQuery(context.getUserQuery()),
                timeoutMs);

        try {
            // 1. Validate context
            String validationError = validateContext(skill, context);
            if (validationError != null) {
                log.warn("Context validation failed for skill {}: {}", skill.getName(), validationError);
                return SkillResult.error(skill.getName(), validationError,
                        executedTools, System.currentTimeMillis() - startTime);
            }

            // 2. Check if skill is enabled
            if (!skill.isEnabled()) {
                log.warn("Skill is disabled: {}", skill.getName());
                return SkillResult.error(skill.getName(), "Skill is disabled",
                        executedTools, System.currentTimeMillis() - startTime);
            }

            // 3. Prepare Prompt (replace template variables)
            String prompt = preparePrompt(skill, context);
            log.debug("Prepared prompt for skill {}: length={}", skill.getName(), prompt.length());

            // 4. Call LLM to get parameters and execution plan
            String llmResponse = callLlm(prompt, context.getUserQuery());
            log.debug("LLM response for skill {}: length={}", skill.getName(),
                    llmResponse != null ? llmResponse.length() : 0);

            // 5. Parse LLM response and extract parameters
            Map<String, Object> params = extractParams(llmResponse, context);
            context.setExtractedParams(params);
            log.info("Extracted {} parameters for skill {}", params.size(), skill.getName());

            // 6. Execute associated Tools
            Object toolResult = executeTools(skill, params, executedTools, context);

            long executionTime = System.currentTimeMillis() - startTime;
            log.info("Skill execution completed: skill={}, tools={}, time={}ms",
                    skill.getName(), executedTools, executionTime);

            return SkillResult.builder()
                    .success(true)
                    .skillName(skill.getName())
                    .data(toolResult)
                    .executedTools(executedTools)
                    .executionTime(executionTime)
                    .build();

        } catch (Exception e) {
            long executionTime = System.currentTimeMillis() - startTime;
            log.error("Skill execution failed: skill={}, error={}",
                    skill.getName(), e.getMessage(), e);

            return SkillResult.error(skill.getName(), e.getMessage(),
                    executedTools, executionTime);
        }
    }

    @Override
    public String validateContext(SkillDefinition skill, SkillContext context) {
        if (context == null) {
            return "Context is null";
        }

        if (context.getUserQuery() == null || context.getUserQuery().trim().isEmpty()) {
            return "User query is empty";
        }

        // Check required context fields
        List<String> contextNeeded = skill.getContextNeeded();
        if (contextNeeded != null && !contextNeeded.isEmpty()) {
            List<String> missingFields = new ArrayList<>();

            for (String field : contextNeeded) {
                if (!hasContextField(context, field)) {
                    missingFields.add(field);
                }
            }

            if (!missingFields.isEmpty()) {
                return "Missing required context fields: " + String.join(", ", missingFields);
            }
        }

        // Check if required tools are available
        List<String> tools = skill.getTools();
        if (tools != null && !tools.isEmpty()) {
            List<String> missingTools = tools.stream()
                    .filter(t -> !toolRegistry.hasExecutor(t))
                    .collect(Collectors.toList());

            if (!missingTools.isEmpty()) {
                return "Required tools not available: " + String.join(", ", missingTools);
            }
        }

        return null; // Validation passed
    }

    @Override
    public boolean supports(SkillDefinition skill) {
        if (skill == null || skill.getName() == null) {
            return false;
        }

        // Check if all required tools are available
        List<String> tools = skill.getTools();
        if (tools == null || tools.isEmpty()) {
            return true; // Skill with no tools is supported
        }

        return tools.stream().allMatch(toolRegistry::hasExecutor);
    }

    // ==================== Private Helper Methods ====================

    /**
     * Check if context has a specific field
     */
    private boolean hasContextField(SkillContext context, String field) {
        switch (field.toLowerCase()) {
            case "factoryid":
                return context.getFactoryId() != null && !context.getFactoryId().isEmpty();
            case "userid":
                return context.getUserId() != null && !context.getUserId().isEmpty();
            case "sessionid":
                return context.getSessionId() != null && !context.getSessionId().isEmpty();
            case "userquery":
                return context.getUserQuery() != null && !context.getUserQuery().isEmpty();
            default:
                // Check in extracted params
                if (context.getExtractedParams() != null) {
                    return context.getExtractedParams().containsKey(field);
                }
                return false;
        }
    }

    /**
     * Prepare Prompt
     *
     * Replace template variables:
     * - ${userQuery}: User query
     * - ${factoryId}: Factory ID
     * - ${userId}: User ID
     * - ${tools}: Available tools list
     * - ${contextNeeded}: Required context
     * - Custom variables: From context.extractedParams
     */
    private String preparePrompt(SkillDefinition skill, SkillContext context) {
        String template = skill.getPromptTemplate();

        if (template == null || template.isEmpty()) {
            // Use default template
            template = buildDefaultPromptTemplate(skill);
        }

        // Build variable mapping
        Map<String, String> variables = new HashMap<>();
        variables.put("userQuery", context.getUserQuery() != null ? context.getUserQuery() : "");
        variables.put("factoryId", context.getFactoryId() != null ? context.getFactoryId() : "");
        variables.put("userId", context.getUserId() != null ? context.getUserId() : "");
        variables.put("sessionId", context.getSessionId() != null ? context.getSessionId() : "");
        variables.put("skillName", skill.getName());
        variables.put("skillDescription", skill.getDescription() != null ? skill.getDescription() : "");

        // Add tools list
        if (skill.getTools() != null && !skill.getTools().isEmpty()) {
            String toolsList = skill.getTools().stream()
                    .map(this::formatToolInfo)
                    .collect(Collectors.joining("\n"));
            variables.put("tools", toolsList);
        } else {
            variables.put("tools", "No specific tools defined");
        }

        // Add context requirements
        if (skill.getContextNeeded() != null && !skill.getContextNeeded().isEmpty()) {
            variables.put("contextNeeded", String.join(", ", skill.getContextNeeded()));
        } else {
            variables.put("contextNeeded", "None");
        }

        // Add extracted params from context
        if (context.getExtractedParams() != null) {
            for (Map.Entry<String, Object> entry : context.getExtractedParams().entrySet()) {
                variables.put(entry.getKey(),
                        entry.getValue() != null ? entry.getValue().toString() : "");
            }
        }

        // Replace variables
        return replaceVariables(template, variables);
    }

    /**
     * Build default Prompt template
     */
    private String buildDefaultPromptTemplate(SkillDefinition skill) {
        StringBuilder sb = new StringBuilder();

        sb.append("## Role\n");
        sb.append("You are an intelligent assistant executing the '").append(skill.getDisplayName()).append("' skill.\n\n");

        if (skill.getDescription() != null && !skill.getDescription().isEmpty()) {
            sb.append("## Skill Description\n");
            sb.append(skill.getDescription()).append("\n\n");
        }

        sb.append("## User Request\n");
        sb.append("${userQuery}\n\n");

        sb.append("## Context Information\n");
        sb.append("- Factory ID: ${factoryId}\n");
        sb.append("- User ID: ${userId}\n");
        sb.append("- Required Context: ${contextNeeded}\n\n");

        if (skill.getTools() != null && !skill.getTools().isEmpty()) {
            sb.append("## Available Tools\n");
            sb.append("${tools}\n\n");
        }

        sb.append("## Task\n");
        sb.append("1. Analyze user request and extract key parameters\n");
        sb.append("2. Determine which tools to call\n");
        sb.append("3. Prepare required parameters for each tool\n\n");

        sb.append("## Output Format (Strict JSON)\n");
        sb.append("```json\n");
        sb.append("{\n");
        sb.append("  \"extracted_params\": {\n");
        sb.append("    \"param_name\": \"param_value\"\n");
        sb.append("  },\n");
        sb.append("  \"tools_to_execute\": [\n");
        sb.append("    {\n");
        sb.append("      \"tool_name\": \"tool_name\",\n");
        sb.append("      \"params\": {}\n");
        sb.append("    }\n");
        sb.append("  ],\n");
        sb.append("  \"execution_order\": \"sequential or parallel\",\n");
        sb.append("  \"reasoning\": \"Execution plan explanation\"\n");
        sb.append("}\n");
        sb.append("```\n");

        return sb.toString();
    }

    /**
     * Format tool information
     */
    private String formatToolInfo(String toolName) {
        Optional<ToolExecutor> executorOpt = toolRegistry.getExecutor(toolName);
        if (executorOpt.isPresent()) {
            ToolExecutor executor = executorOpt.get();
            return String.format("- %s: %s", toolName, executor.getDescription());
        }
        return String.format("- %s: (Tool info not available)", toolName);
    }

    /**
     * Replace template variables
     */
    private String replaceVariables(String template, Map<String, String> variables) {
        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        StringBuffer result = new StringBuffer();

        while (matcher.find()) {
            String varName = matcher.group(1);
            String replacement = variables.getOrDefault(varName, "");
            // Escape special characters
            replacement = Matcher.quoteReplacement(replacement);
            matcher.appendReplacement(result, replacement);
        }
        matcher.appendTail(result);

        return result.toString();
    }

    /**
     * Call LLM
     */
    private String callLlm(String prompt, String userQuery) {
        try {
            return dashScopeClient.chat(prompt, userQuery);
        } catch (Exception e) {
            log.error("LLM call failed: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to call LLM: " + e.getMessage(), e);
        }
    }

    /**
     * Extract parameters from LLM response
     */
    private Map<String, Object> extractParams(String llmResponse, SkillContext context) {
        Map<String, Object> params = new HashMap<>();

        // Preserve existing params from context
        if (context.getExtractedParams() != null) {
            params.putAll(context.getExtractedParams());
        }

        // Add base context params
        params.put("factoryId", context.getFactoryId());
        params.put("userId", context.getUserId());
        params.put("sessionId", context.getSessionId());
        params.put("userQuery", context.getUserQuery());

        if (llmResponse == null || llmResponse.isEmpty()) {
            log.warn("Empty LLM response, returning context params only");
            return params;
        }

        try {
            // Extract JSON
            String json = extractJson(llmResponse);
            if (json == null) {
                log.warn("No JSON found in LLM response");
                return params;
            }

            JsonNode root = objectMapper.readTree(json);

            // Extract extracted_params
            if (root.has("extracted_params")) {
                JsonNode paramsNode = root.get("extracted_params");
                Map<String, Object> extractedParams = objectMapper.convertValue(
                        paramsNode, new TypeReference<Map<String, Object>>() {});
                params.putAll(extractedParams);
            }

            // Store tools_to_execute for later use
            if (root.has("tools_to_execute")) {
                params.put("_tools_to_execute", root.get("tools_to_execute"));
            }

            // Store execution_order
            if (root.has("execution_order")) {
                params.put("_execution_order", root.get("execution_order").asText());
            }

            // Store reasoning
            if (root.has("reasoning")) {
                params.put("_reasoning", root.get("reasoning").asText());
            }

        } catch (JsonProcessingException e) {
            log.error("Failed to parse LLM response JSON: {}", e.getMessage());
        }

        return params;
    }

    /**
     * Extract JSON from response
     */
    private String extractJson(String response) {
        if (response == null || response.isEmpty()) {
            return null;
        }

        // Try to find JSON code block
        int start = response.indexOf("```json");
        if (start != -1) {
            start = response.indexOf("\n", start) + 1;
            int end = response.indexOf("```", start);
            if (end != -1) {
                return response.substring(start, end).trim();
            }
        }

        // Try to find { } brackets
        start = response.indexOf("{");
        if (start != -1) {
            int end = response.lastIndexOf("}");
            if (end != -1 && end > start) {
                return response.substring(start, end + 1);
            }
        }

        return null;
    }

    /**
     * Execute associated Tools
     */
    private Object executeTools(SkillDefinition skill, Map<String, Object> params,
                                 List<String> executedTools, SkillContext context) {

        // 1. Determine tools to execute
        List<ToolExecutionPlan> toolPlans = buildToolExecutionPlans(skill, params);

        if (toolPlans.isEmpty()) {
            log.warn("No tools to execute for skill: {}", skill.getName());
            return Map.of("message", "No tools executed", "params", params);
        }

        // Limit tool count
        if (toolPlans.size() > maxToolsPerSkill) {
            log.warn("Too many tools ({}) for skill {}, limiting to {}",
                    toolPlans.size(), skill.getName(), maxToolsPerSkill);
            toolPlans = toolPlans.subList(0, maxToolsPerSkill);
        }

        // 2. Determine execution order
        String executionOrder = (String) params.getOrDefault("_execution_order", "sequential");
        boolean isParallel = "parallel".equalsIgnoreCase(executionOrder) && parallelExecutionEnabled;

        // 3. Execute tools
        Map<String, Object> results;
        if (isParallel && toolPlans.size() > 1) {
            results = executeToolsParallel(toolPlans, params, executedTools, context);
        } else {
            results = executeToolsSequential(toolPlans, params, executedTools, context);
        }

        // 4. Add execution metadata
        results.put("_executionOrder", executionOrder);
        results.put("_toolCount", executedTools.size());

        String reasoning = (String) params.get("_reasoning");
        if (reasoning != null) {
            results.put("_reasoning", reasoning);
        }

        return results;
    }

    /**
     * Build tool execution plans
     */
    private List<ToolExecutionPlan> buildToolExecutionPlans(SkillDefinition skill,
                                                            Map<String, Object> params) {
        List<ToolExecutionPlan> plans = new ArrayList<>();

        // Prioritize LLM-generated execution plan
        Object toolsToExecute = params.get("_tools_to_execute");
        if (toolsToExecute instanceof JsonNode) {
            JsonNode toolsNode = (JsonNode) toolsToExecute;
            if (toolsNode.isArray()) {
                int order = 1;
                for (JsonNode toolNode : toolsNode) {
                    String toolName = toolNode.has("tool_name") ?
                            toolNode.get("tool_name").asText() : null;

                    if (toolName != null && toolRegistry.hasExecutor(toolName)) {
                        Map<String, Object> toolParams = new HashMap<>();
                        if (toolNode.has("params")) {
                            try {
                                toolParams = objectMapper.convertValue(
                                        toolNode.get("params"),
                                        new TypeReference<Map<String, Object>>() {});
                            } catch (Exception e) {
                                log.warn("Failed to parse tool params for {}", toolName);
                            }
                        }

                        plans.add(new ToolExecutionPlan(toolName, toolParams, order++));
                    } else {
                        log.warn("Tool not found in registry: {}", toolName);
                    }
                }
            }
        }

        // If LLM didn't specify tools, use Skill's default tools
        if (plans.isEmpty() && skill.getTools() != null) {
            int order = 1;
            for (String toolName : skill.getTools()) {
                if (toolRegistry.hasExecutor(toolName)) {
                    plans.add(new ToolExecutionPlan(toolName, new HashMap<>(), order++));
                }
            }
        }

        return plans;
    }

    /**
     * Execute tools sequentially
     */
    private Map<String, Object> executeToolsSequential(List<ToolExecutionPlan> plans,
                                                        Map<String, Object> globalParams,
                                                        List<String> executedTools,
                                                        SkillContext context) {
        Map<String, Object> results = new LinkedHashMap<>();
        Map<String, Object> chainContext = new HashMap<>(globalParams);

        // Sort by order
        plans.sort(Comparator.comparingInt(p -> p.order));

        for (ToolExecutionPlan plan : plans) {
            try {
                // Merge params: global + tool-specific + chain context
                Map<String, Object> mergedParams = new HashMap<>(chainContext);
                mergedParams.putAll(plan.params);

                Object result = executeSingleTool(plan.toolName, mergedParams, context);
                results.put(plan.toolName, result);
                executedTools.add(plan.toolName);

                // Add result to chain context for subsequent tools
                chainContext.put("previous_" + plan.toolName, result);

            } catch (Exception e) {
                log.error("Tool execution failed, stopping chain: {}", plan.toolName, e);
                results.put(plan.toolName, Map.of("error", e.getMessage(), "success", false));
                executedTools.add(plan.toolName + " (failed)");
                break;
            }
        }

        return results;
    }

    /**
     * Execute tools in parallel
     */
    private Map<String, Object> executeToolsParallel(List<ToolExecutionPlan> plans,
                                                      Map<String, Object> globalParams,
                                                      List<String> executedTools,
                                                      SkillContext context) {
        Map<String, Future<Object>> futures = new LinkedHashMap<>();

        for (ToolExecutionPlan plan : plans) {
            Map<String, Object> mergedParams = new HashMap<>(globalParams);
            mergedParams.putAll(plan.params);

            futures.put(plan.toolName, executorService.submit(() ->
                    executeSingleTool(plan.toolName, mergedParams, context)));
        }

        Map<String, Object> results = new LinkedHashMap<>();

        for (Map.Entry<String, Future<Object>> entry : futures.entrySet()) {
            String toolName = entry.getKey();
            try {
                Object result = entry.getValue().get(toolTimeoutSeconds, TimeUnit.SECONDS);
                results.put(toolName, result);
                executedTools.add(toolName);
            } catch (TimeoutException e) {
                log.error("Tool execution timeout: {}", toolName);
                results.put(toolName, Map.of("error", "Execution timeout", "success", false));
                executedTools.add(toolName + " (timeout)");
            } catch (Exception e) {
                log.error("Tool execution failed: {}", toolName, e);
                results.put(toolName, Map.of("error", e.getMessage(), "success", false));
                executedTools.add(toolName + " (failed)");
            }
        }

        return results;
    }

    /**
     * Execute a single tool
     */
    private Object executeSingleTool(String toolName, Map<String, Object> params,
                                      SkillContext context) throws Exception {
        Optional<ToolExecutor> executorOpt = toolRegistry.getExecutor(toolName);
        if (executorOpt.isEmpty()) {
            throw new IllegalArgumentException("Tool not found: " + toolName);
        }

        ToolExecutor executor = executorOpt.get();

        // Build ToolCall
        ToolCall toolCall = ToolCall.builder()
                .id(UUID.randomUUID().toString())
                .type("function")
                .function(ToolCall.FunctionCall.builder()
                        .name(toolName)
                        .arguments(objectMapper.writeValueAsString(params))
                        .build())
                .build();

        // Build execution context
        Map<String, Object> execContext = new HashMap<>(params);
        execContext.put("factoryId", context.getFactoryId());
        execContext.put("userId", context.getUserId());
        execContext.put("sessionId", context.getSessionId());

        long startTime = System.currentTimeMillis();
        String result = executor.execute(toolCall, execContext);
        long duration = System.currentTimeMillis() - startTime;

        log.info("Tool {} executed in {}ms", toolName, duration);

        // Try to parse as JSON
        try {
            return objectMapper.readTree(result);
        } catch (Exception e) {
            return result;
        }
    }

    /**
     * Truncate query for logging
     */
    private String truncateQuery(String query) {
        if (query == null) {
            return "";
        }
        return query.length() > 50 ? query.substring(0, 50) + "..." : query;
    }

    // ==================== Inner Classes ====================

    /**
     * Tool execution plan
     */
    private static class ToolExecutionPlan {
        final String toolName;
        final Map<String, Object> params;
        final int order;

        ToolExecutionPlan(String toolName, Map<String, Object> params, int order) {
            this.toolName = toolName;
            this.params = params;
            this.order = order;
        }
    }
}
