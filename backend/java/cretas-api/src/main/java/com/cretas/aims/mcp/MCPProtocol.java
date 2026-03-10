package com.cretas.aims.mcp;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * MCP (Model Context Protocol) 共享 DTO 定义
 *
 * 包含 JSON-RPC 风格的请求/响应结构，以及工具定义格式。
 * 遵循 MCP 协议规范：https://modelcontextprotocol.io
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-09
 */
public class MCPProtocol {

    private MCPProtocol() {
        // 工具类，禁止实例化
    }

    /**
     * MCP JSON-RPC 请求
     *
     * 示例:
     * {
     *   "jsonrpc": "2.0",
     *   "id": "req-1",
     *   "method": "tools/list",
     *   "params": {}
     * }
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MCPRequest {
        @Builder.Default
        private String jsonrpc = "2.0";
        private String id;
        private String method;
        private Map<String, Object> params;
    }

    /**
     * MCP JSON-RPC 响应
     *
     * 成功示例:
     * {
     *   "jsonrpc": "2.0",
     *   "id": "req-1",
     *   "result": { "tools": [...] }
     * }
     *
     * 错误示例:
     * {
     *   "jsonrpc": "2.0",
     *   "id": "req-1",
     *   "error": { "code": -32602, "message": "Tool not found" }
     * }
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MCPResponse {
        @Builder.Default
        private String jsonrpc = "2.0";
        private String id;
        private Object result;
        private MCPError error;

        /**
         * 构建成功响应
         */
        public static MCPResponse success(String id, Object result) {
            return MCPResponse.builder()
                    .id(id)
                    .result(result)
                    .build();
        }

        /**
         * 构建错误响应
         */
        public static MCPResponse error(String id, int code, String message) {
            return MCPResponse.builder()
                    .id(id)
                    .error(MCPError.builder().code(code).message(message).build())
                    .build();
        }

        /**
         * 构建带详情的错误响应
         */
        public static MCPResponse error(String id, int code, String message, Object data) {
            return MCPResponse.builder()
                    .id(id)
                    .error(MCPError.builder().code(code).message(message).data(data).build())
                    .build();
        }
    }

    /**
     * MCP 错误对象
     *
     * 标准 JSON-RPC 错误码:
     * -32700: Parse error
     * -32600: Invalid request
     * -32601: Method not found
     * -32602: Invalid params
     * -32603: Internal error
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MCPError {
        private int code;
        private String message;
        private Object data;
    }

    /**
     * MCP 工具定义
     *
     * 描述一个工具的名称、用途和输入参数 schema。
     *
     * 示例:
     * {
     *   "name": "material_batch_query",
     *   "description": "查询原料批次信息",
     *   "inputSchema": {
     *     "type": "object",
     *     "properties": { "batchNumber": { "type": "string" } },
     *     "required": ["batchNumber"]
     *   }
     * }
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MCPToolDefinition {
        private String name;
        private String description;
        private Map<String, Object> inputSchema;
    }

    // ── 标准 JSON-RPC 错误码常量 ──

    public static final int ERROR_PARSE = -32700;
    public static final int ERROR_INVALID_REQUEST = -32600;
    public static final int ERROR_METHOD_NOT_FOUND = -32601;
    public static final int ERROR_INVALID_PARAMS = -32602;
    public static final int ERROR_INTERNAL = -32603;
}
