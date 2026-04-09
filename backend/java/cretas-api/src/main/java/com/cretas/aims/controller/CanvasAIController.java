package com.cretas.aims.controller;

import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.dto.common.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/config/v2/ai")
@RequiredArgsConstructor
@Tag(name = "Canvas AI Agent", description = "Canvas AI 配置助手")
public class CanvasAIController {

    private final ToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;

    @Data
    public static class AIRequest {
        private String message;
        private String mode;
        private String moduleCode;
    }

    @Data
    public static class AIResponse {
        private String reply;
        private List<Map<String, Object>> diffs;
        private boolean applied;
    }

    @PostMapping("/chat")
    @Operation(summary = "Canvas AI 对话")
    public ApiResponse<AIResponse> chat(
            @PathVariable String factoryId,
            @RequestBody AIRequest request) {

        AIResponse response = new AIResponse();
        String mode = request.getMode() != null ? request.getMode() : "action";
        String message = request.getMessage();
        log.info("Canvas AI [{}] factory={}: {}", mode, factoryId, message);

        switch (mode) {
            case "autopilot" -> {
                response.setReply(executeAutopilot(factoryId, message));
                response.setApplied(true);
            }
            case "plan" -> {
                List<Map<String, Object>> diffs = generatePlan(factoryId, message);
                response.setDiffs(diffs);
                response.setReply("已生成 " + diffs.size() + " 项变更方案，请逐项审核。");
                response.setApplied(false);
            }
            case "action" -> {
                response.setReply(analyzeImpact(factoryId, message));
                response.setApplied(false);
            }
            default -> response.setReply("未知模式: " + mode);
        }

        return ApiResponse.success(response);
    }

    @PostMapping("/apply-diffs")
    @Operation(summary = "批量应用 Plan Mode 生成的变更")
    public ApiResponse<String> applyDiffs(
            @PathVariable String factoryId,
            @RequestBody List<Map<String, Object>> diffs) {

        int applied = 0;
        for (Map<String, Object> diff : diffs) {
            String toolName = (String) diff.get("tool");
            if (toolName == null) continue;

            Optional<ToolExecutor> executor = toolRegistry.getExecutor(toolName);
            if (executor.isEmpty()) continue;

            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> params = (Map<String, Object>) diff.getOrDefault("params", Map.of());
                String argsJson = objectMapper.writeValueAsString(params);
                ToolCall toolCall = ToolCall.of("ai-apply-" + applied, toolName, argsJson);
                executor.get().execute(toolCall, Map.of("factoryId", factoryId));
                applied++;
            } catch (Exception e) {
                log.warn("Failed to apply diff {}: {}", toolName, e.getMessage());
            }
        }

        return ApiResponse.success("已应用 " + applied + "/" + diffs.size() + " 项变更");
    }

    private String executeAutopilot(String factoryId, String message) {
        if (message.contains("模板") || message.contains("template")) {
            return "请使用模板选择器选择行业模板，或告诉我行业类型（如'烘焙'、'水产'），AI 将自动配置。";
        }
        if (message.contains("禁用") || message.contains("disable")) {
            return "请指定要禁用的模块或工具名称，如: '禁用排程模块' 或 '禁用 scheduling_list 工具'";
        }
        return "Autopilot 已收到指令: " + message + "。正在分析配置方案...";
    }

    private List<Map<String, Object>> generatePlan(String factoryId, String message) {
        List<Map<String, Object>> diffs = new ArrayList<>();
        // In production, LLM analyzes message and generates tool call list
        diffs.add(Map.of(
            "type", "FIELD_CHANGE",
            "tool", "canvas_update_field",
            "params", Map.of("moduleCode", "sales_order", "fieldCode", "example", "property", "required", "value", false),
            "description", "示例变更 — 连接 LLM 后将生成真实变更"
        ));
        return diffs;
    }

    private String analyzeImpact(String factoryId, String message) {
        return "提示: 此操作可能影响关联模块配置。详细影响分析将在连接 LLM 服务后启用。";
    }
}
