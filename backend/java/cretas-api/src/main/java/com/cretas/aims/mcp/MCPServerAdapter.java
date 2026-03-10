package com.cretas.aims.mcp;

import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.mcp.MCPProtocol.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * MCP Server Adapter — 将内部 ToolRegistry 暴露为 MCP 兼容的 HTTP 端点
 *
 * <p>实现两个核心 MCP 方法：
 * <ul>
 *   <li>{@code tools/list} — 列出所有已注册工具及其 schema</li>
 *   <li>{@code tools/call} — 根据工具名称和参数执行工具</li>
 * </ul>
 *
 * <p>认证方式：通过 {@code X-MCP-API-Key} 请求头传递 API Key，
 * 由 {@code cretas.mcp.api-key} 配置项控制。若配置项为空则不校验。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mcp")
public class MCPServerAdapter {

    @Autowired
    private ToolRegistry toolRegistry;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * MCP API Key，为空则不启用认证
     */
    @Value("${cretas.mcp.api-key:}")
    private String apiKey;

    /**
     * tools/list — 列出所有已注册的工具定义
     *
     * <p>请求体示例:
     * <pre>
     * { "jsonrpc": "2.0", "id": "1", "method": "tools/list" }
     * </pre>
     *
     * <p>响应示例:
     * <pre>
     * {
     *   "jsonrpc": "2.0",
     *   "id": "1",
     *   "result": {
     *     "tools": [
     *       { "name": "material_batch_query", "description": "...", "inputSchema": {...} }
     *     ]
     *   }
     * }
     * </pre>
     *
     * @param request MCP JSON-RPC 请求
     * @param mcpApiKey 可选的 API Key 请求头
     * @return MCP 响应，包含工具列表
     */
    @PostMapping("/tools/list")
    public ResponseEntity<MCPResponse> listTools(
            @RequestBody(required = false) MCPRequest request,
            @RequestHeader(value = "X-MCP-API-Key", required = false) String mcpApiKey) {

        String requestId = request != null ? request.getId() : null;

        // 认证检查
        if (!authenticateRequest(mcpApiKey)) {
            log.warn("MCP tools/list 认证失败");
            return ResponseEntity.status(401)
                    .body(MCPResponse.error(requestId, MCPProtocol.ERROR_INVALID_REQUEST, "Invalid or missing API key"));
        }

        try {
            List<MCPToolDefinition> tools = toolRegistry.getAllToolNames().stream()
                    .map(name -> {
                        Optional<ToolExecutor> executor = toolRegistry.getExecutor(name);
                        if (executor.isEmpty()) return null;
                        ToolExecutor exec = executor.get();
                        return MCPToolDefinition.builder()
                                .name(exec.getToolName())
                                .description(exec.getDescription())
                                .inputSchema(exec.getParametersSchema())
                                .build();
                    })
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("tools", tools);

            log.info("MCP tools/list: 返回 {} 个工具", tools.size());
            return ResponseEntity.ok(MCPResponse.success(requestId, result));

        } catch (Exception e) {
            log.error("MCP tools/list 执行失败", e);
            return ResponseEntity.internalServerError()
                    .body(MCPResponse.error(requestId, MCPProtocol.ERROR_INTERNAL, e.getMessage()));
        }
    }

    /**
     * tools/call — 调用指定工具
     *
     * <p>请求体示例:
     * <pre>
     * {
     *   "jsonrpc": "2.0",
     *   "id": "2",
     *   "method": "tools/call",
     *   "params": {
     *     "name": "material_batch_query",
     *     "arguments": { "batchNumber": "B001" },
     *     "context": { "factoryId": "F001", "userId": 22 }
     *   }
     * }
     * </pre>
     *
     * @param request MCP JSON-RPC 请求
     * @param mcpApiKey 可选的 API Key 请求头
     * @return MCP 响应，包含工具执行结果
     */
    @PostMapping("/tools/call")
    public ResponseEntity<MCPResponse> callTool(
            @RequestBody MCPRequest request,
            @RequestHeader(value = "X-MCP-API-Key", required = false) String mcpApiKey) {

        String requestId = request != null ? request.getId() : null;

        // 认证检查
        if (!authenticateRequest(mcpApiKey)) {
            log.warn("MCP tools/call 认证失败");
            return ResponseEntity.status(401)
                    .body(MCPResponse.error(requestId, MCPProtocol.ERROR_INVALID_REQUEST, "Invalid or missing API key"));
        }

        if (request == null || request.getParams() == null) {
            return ResponseEntity.badRequest()
                    .body(MCPResponse.error(requestId, MCPProtocol.ERROR_INVALID_PARAMS, "Missing params"));
        }

        Map<String, Object> params = request.getParams();
        String toolName = (String) params.get("name");

        if (toolName == null || toolName.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(MCPResponse.error(requestId, MCPProtocol.ERROR_INVALID_PARAMS, "Missing tool name in params.name"));
        }

        // 查找工具
        Optional<ToolExecutor> executorOpt = toolRegistry.getExecutor(toolName);
        if (executorOpt.isEmpty()) {
            log.warn("MCP tools/call: 工具不存在 - {}", toolName);
            return ResponseEntity.ok(
                    MCPResponse.error(requestId, MCPProtocol.ERROR_METHOD_NOT_FOUND,
                            "Tool not found: " + toolName));
        }

        try {
            ToolExecutor executor = executorOpt.get();

            // 构建 ToolCall 对象
            Object arguments = params.get("arguments");
            String argumentsJson;
            if (arguments instanceof String) {
                argumentsJson = (String) arguments;
            } else if (arguments != null) {
                argumentsJson = objectMapper.writeValueAsString(arguments);
            } else {
                argumentsJson = "{}";
            }

            ToolCall toolCall = ToolCall.of(
                    requestId != null ? requestId : UUID.randomUUID().toString(),
                    toolName,
                    argumentsJson
            );

            // 构建执行上下文
            @SuppressWarnings("unchecked")
            Map<String, Object> context = params.containsKey("context")
                    ? (Map<String, Object>) params.get("context")
                    : new HashMap<>();

            // 执行工具
            log.info("MCP tools/call: 执行工具 {} (args={})", toolName, argumentsJson);
            String resultJson = executor.execute(toolCall, context);

            // 解析结果为 Object 以便正确序列化
            Object resultObj;
            try {
                resultObj = objectMapper.readValue(resultJson, Map.class);
            } catch (Exception e) {
                // 如果不是有效 JSON，包装为文本结果
                resultObj = Map.of("content", resultJson);
            }

            Map<String, Object> resultWrapper = new LinkedHashMap<>();
            resultWrapper.put("content", List.of(Map.of("type", "text", "text", resultJson)));
            resultWrapper.put("isError", false);

            return ResponseEntity.ok(MCPResponse.success(requestId, resultWrapper));

        } catch (Exception e) {
            log.error("MCP tools/call 执行失败: tool={}", toolName, e);

            Map<String, Object> errorResult = new LinkedHashMap<>();
            errorResult.put("content", List.of(Map.of("type", "text", "text", e.getMessage())));
            errorResult.put("isError", true);

            return ResponseEntity.ok(MCPResponse.success(requestId, errorResult));
        }
    }

    /**
     * 校验 API Key
     *
     * @param providedKey 请求中携带的 API Key
     * @return true 表示认证通过
     */
    private boolean authenticateRequest(String providedKey) {
        // 未配置 API Key 则不启用认证
        if (apiKey == null || apiKey.isBlank()) {
            return true;
        }
        return apiKey.equals(providedKey);
    }
}
