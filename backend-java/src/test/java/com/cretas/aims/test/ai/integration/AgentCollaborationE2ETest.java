package com.cretas.aims.test.ai.integration;

import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.common.ApiResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.Disabled;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Agent Collaboration End-to-End Test
 *
 * Tests the real API endpoints for AI intent execution and agent collaboration.
 * These tests verify the complete flow from HTTP request to response.
 *
 * API Endpoint: POST /api/public/ai-demo/execute
 * Request: {"userInput": "..."}
 * Response: ApiResponse<IntentExecuteResponse>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("AgentCollaborationE2ETest - AI Agent协作端到端测试")
class AgentCollaborationE2ETest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    private static final String API_ENDPOINT = "/api/public/ai-demo/execute";

    // Production server for manual curl verification
    private static final String PROD_SERVER = "http://139.196.165.140:10010";

    // ==================== Helper Methods ====================

    /**
     * Build the request entity with JSON body
     */
    private HttpEntity<Map<String, String>> buildRequest(String userInput) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, String> body = new HashMap<>();
        body.put("userInput", userInput);

        return new HttpEntity<>(body, headers);
    }

    /**
     * Execute the demo API call
     */
    private ResponseEntity<ApiResponse<IntentExecuteResponse>> executeApi(String userInput) {
        String url = "http://localhost:" + port + API_ENDPOINT;
        HttpEntity<Map<String, String>> request = buildRequest(userInput);

        // Use ParameterizedTypeReference to handle generic type
        return restTemplate.exchange(
                url,
                HttpMethod.POST,
                request,
                new ParameterizedTypeReference<ApiResponse<IntentExecuteResponse>>() {}
        );
    }

    // ==================== Test 1: Demo API with Analysis Routing ====================

    /**
     * Test 1: Demo API with Analysis Routing
     *
     * curl command for manual testing:
     * ```bash
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "产品状态怎么样"}'
     * ```
     */
    @Test
    @Order(1)
    @DisplayName("Test1: 产品状态查询 - 分析路由测试")
    void testProductStatusQuery_AnalysisRouting() {
        // Given
        String userInput = "产品状态怎么样";

        // When
        ResponseEntity<ApiResponse<IntentExecuteResponse>> response = executeApi(userInput);

        // Then: Verify 200 response
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        // Then: Verify success = true
        ApiResponse<IntentExecuteResponse> apiResponse = response.getBody();
        assertThat(apiResponse).isNotNull();
        assertThat(apiResponse.getSuccess()).isTrue();

        // Then: Verify response data
        IntentExecuteResponse data = apiResponse.getData();
        assertThat(data).isNotNull();

        // Then: Verify formattedText is not null/empty (analysis routing should produce formatted output)
        // Note: formattedText may be null if intent is not recognized, so check status first
        String status = data.getStatus();
        assertThat(status).isNotNull();

        // If intent was recognized and executed, verify formatted text
        if ("COMPLETED".equals(status) || "PREVIEW".equals(status)) {
            assertThat(data.getFormattedText())
                    .as("Analysis routing should produce formatted text")
                    .isNotNull()
                    .isNotEmpty();
        }

        // Log for debugging
        System.out.println("=== Test1: Product Status Query ===");
        System.out.println("Status: " + status);
        System.out.println("IntentCode: " + data.getIntentCode());
        System.out.println("FormattedText: " + data.getFormattedText());
    }

    // ==================== Test 2: Complex Analysis with Multi-Agent ====================

    /**
     * Test 2: Complex Analysis with Multi-Agent Collaboration
     *
     * curl command for manual testing:
     * ```bash
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "分析近期质检异常的原因并提供改进方案"}'
     * ```
     */
    @Test
    @Order(2)
    @DisplayName("Test2: 复杂分析任务 - 多Agent协作测试")
    void testComplexAnalysis_MultiAgentCollaboration() {
        // Given: Complex analysis query requiring multi-agent collaboration
        String userInput = "分析近期质检异常的原因并提供改进方案";

        // When
        ResponseEntity<ApiResponse<IntentExecuteResponse>> response = executeApi(userInput);

        // Then: Verify 200 response
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        ApiResponse<IntentExecuteResponse> apiResponse = response.getBody();
        assertThat(apiResponse).isNotNull();
        assertThat(apiResponse.getSuccess()).isTrue();

        IntentExecuteResponse data = apiResponse.getData();
        assertThat(data).isNotNull();

        String status = data.getStatus();
        assertThat(status).isNotNull();

        // For complex analysis that was executed, verify detailed report
        if ("COMPLETED".equals(status) || "PREVIEW".equals(status)) {
            String formattedText = data.getFormattedText();
            if (formattedText != null) {
                // Complex analysis should produce detailed report (length > 100)
                assertThat(formattedText.length())
                        .as("Complex analysis should produce detailed report with length > 100")
                        .isGreaterThan(100);
            }
        }

        // Log for debugging
        System.out.println("=== Test2: Complex Analysis ===");
        System.out.println("Status: " + status);
        System.out.println("IntentCode: " + data.getIntentCode());
        System.out.println("FormattedText length: " +
                (data.getFormattedText() != null ? data.getFormattedText().length() : 0));
    }

    // ==================== Test 3: Simple Query Fast Mode ====================

    /**
     * Test 3: Simple Query with Fast Mode Processing
     *
     * curl command for manual testing:
     * ```bash
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "查询今天库存"}'
     * ```
     */
    @Test
    @Order(3)
    @DisplayName("Test3: 简单查询 - FAST模式处理测试")
    void testSimpleQuery_FastModeProcessing() {
        // Given: Simple query that should use FAST mode
        String userInput = "查询今天库存";

        // When: Measure response time
        long startTime = System.currentTimeMillis();
        ResponseEntity<ApiResponse<IntentExecuteResponse>> response = executeApi(userInput);
        long endTime = System.currentTimeMillis();
        long responseTime = endTime - startTime;

        // Then: Verify 200 response
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        ApiResponse<IntentExecuteResponse> apiResponse = response.getBody();
        assertThat(apiResponse).isNotNull();
        assertThat(apiResponse.getSuccess()).isTrue();

        IntentExecuteResponse data = apiResponse.getData();
        assertThat(data).isNotNull();

        // Simple queries should be fast (typically < 5 seconds for FAST mode)
        // Note: This is a soft assertion for performance monitoring
        System.out.println("=== Test3: Simple Query Fast Mode ===");
        System.out.println("Response Time: " + responseTime + "ms");
        System.out.println("Status: " + data.getStatus());
        System.out.println("IntentCode: " + data.getIntentCode());

        // Verify intent was recognized or handled appropriately
        String status = data.getStatus();
        assertThat(status).isNotNull();
        // FAST mode should not timeout or fail unexpectedly
        assertThat(status).isNotIn("TIMEOUT", "FAILED");
    }

    // ==================== Test 4: Ambiguous Query (CRAG Test) ====================

    /**
     * Test 4: Ambiguous Query Handling (CRAG - Corrective RAG Test)
     *
     * curl command for manual testing:
     * ```bash
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "生产情况"}'
     * ```
     */
    @Test
    @Order(4)
    @DisplayName("Test4: 模糊查询 - CRAG处理测试")
    void testAmbiguousQuery_CRAGHandling() {
        // Given: Ambiguous query that may need clarification
        String userInput = "生产情况";

        // When
        ResponseEntity<ApiResponse<IntentExecuteResponse>> response = executeApi(userInput);

        // Then: Verify 200 response (should not error)
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        ApiResponse<IntentExecuteResponse> apiResponse = response.getBody();
        assertThat(apiResponse).isNotNull();
        assertThat(apiResponse.getSuccess()).isTrue();

        IntentExecuteResponse data = apiResponse.getData();
        assertThat(data).isNotNull();

        String status = data.getStatus();
        assertThat(status).isNotNull();

        // Ambiguous query should either:
        // 1. Be handled with a best-effort response (COMPLETED)
        // 2. Request clarification (NEED_MORE_INFO)
        // 3. Not be recognized (NOT_RECOGNIZED)
        // But should NOT cause server error (500)
        assertThat(status).isIn(
                "COMPLETED", "PREVIEW", "NEED_MORE_INFO",
                "NOT_RECOGNIZED", "NO_PERMISSION"
        );

        // Log for debugging
        System.out.println("=== Test4: Ambiguous Query CRAG ===");
        System.out.println("Status: " + status);
        System.out.println("IntentCode: " + data.getIntentCode());
        System.out.println("Message: " + data.getMessage());

        // If clarification is needed, verify clarification questions are provided
        if ("NEED_MORE_INFO".equals(status)) {
            assertThat(data.getClarificationQuestions())
                    .as("NEED_MORE_INFO should provide clarification questions")
                    .isNotNull();
        }
    }

    // ==================== Test 5: NPE Fix Verification ====================

    /**
     * Test 5: NPE Fix Verification
     * Verifies that the sensitivityLevel null check works correctly.
     *
     * curl command for manual testing:
     * ```bash
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "设备状态"}'
     * ```
     */
    @Test
    @Order(5)
    @DisplayName("Test5: NPE修复验证 - 设备状态查询")
    void testNPEFix_DeviceStatusQuery() {
        // Given: Query that previously might cause NPE due to null sensitivityLevel
        String userInput = "设备状态";

        // When
        ResponseEntity<ApiResponse<IntentExecuteResponse>> response = executeApi(userInput);

        // Then: Verify NO 500 error (NPE would cause 500)
        assertThat(response.getStatusCode())
                .as("Should not return 500 Internal Server Error (NPE)")
                .isNotEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);

        // Then: Verify 200 response
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        ApiResponse<IntentExecuteResponse> apiResponse = response.getBody();
        assertThat(apiResponse).isNotNull();
        assertThat(apiResponse.getSuccess()).isTrue();

        IntentExecuteResponse data = apiResponse.getData();
        assertThat(data).isNotNull();

        // Verify proper response (not an error response)
        String status = data.getStatus();
        assertThat(status).isNotNull();
        assertThat(status).isNotEqualTo("FAILED");

        // Log for debugging
        System.out.println("=== Test5: NPE Fix Verification ===");
        System.out.println("Status: " + status);
        System.out.println("IntentCode: " + data.getIntentCode());
        System.out.println("SensitivityLevel: " + data.getSensitivityLevel());
    }

    // ==================== Test 6: Empty Input Handling ====================

    /**
     * Test 6: Empty Input Handling
     *
     * curl command for manual testing:
     * ```bash
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": ""}'
     * ```
     */
    @Test
    @Order(6)
    @DisplayName("Test6: 空输入处理测试")
    void testEmptyInput_Handling() {
        // Given: Empty input
        String userInput = "";

        // When
        ResponseEntity<ApiResponse<IntentExecuteResponse>> response = executeApi(userInput);

        // Then: Should return 200 (not crash)
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        ApiResponse<IntentExecuteResponse> apiResponse = response.getBody();
        assertThat(apiResponse).isNotNull();
        assertThat(apiResponse.getSuccess()).isTrue();

        IntentExecuteResponse data = apiResponse.getData();
        assertThat(data).isNotNull();

        // Empty input should result in NOT_RECOGNIZED or similar
        String status = data.getStatus();
        assertThat(status).isNotNull();

        System.out.println("=== Test6: Empty Input Handling ===");
        System.out.println("Status: " + status);
        System.out.println("Message: " + data.getMessage());
    }

    // ==================== Test 7: Reference Word Detection ====================

    /**
     * Test 7: Reference Word Detection (Context Resolution)
     * Tests that unresolved reference words trigger clarification.
     *
     * curl command for manual testing:
     * ```bash
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "这批物料的质检结果"}'
     * ```
     */
    @Test
    @Order(7)
    @DisplayName("Test7: 指代词检测 - 上下文解析测试")
    void testReferenceWordDetection() {
        // Given: Query with reference word that needs context
        String userInput = "这批物料的质检结果";

        // When
        ResponseEntity<ApiResponse<IntentExecuteResponse>> response = executeApi(userInput);

        // Then: Verify 200 response
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        ApiResponse<IntentExecuteResponse> apiResponse = response.getBody();
        assertThat(apiResponse).isNotNull();
        assertThat(apiResponse.getSuccess()).isTrue();

        IntentExecuteResponse data = apiResponse.getData();
        assertThat(data).isNotNull();

        // Should detect reference word and request clarification
        String status = data.getStatus();
        assertThat(status).isEqualTo("NEED_MORE_INFO");

        // Should provide clarification message about the reference
        assertThat(data.getMessage())
                .as("Should mention the reference word in clarification message")
                .contains("这批");

        System.out.println("=== Test7: Reference Word Detection ===");
        System.out.println("Status: " + status);
        System.out.println("Message: " + data.getMessage());
    }

    // ==================== Test 8: Write Operation Permission Check ====================

    /**
     * Test 8: Write Operation Permission Check
     * Tests that write operations are blocked in demo mode.
     *
     * curl command for manual testing:
     * ```bash
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "删除批次MB001"}'
     * ```
     */
    @Test
    @Order(8)
    @DisplayName("Test8: 写操作权限拦截 - 演示模式安全测试")
    void testWriteOperation_PermissionBlock() {
        // Given: Write operation (should be blocked in demo mode)
        String userInput = "删除批次MB001";

        // When
        ResponseEntity<ApiResponse<IntentExecuteResponse>> response = executeApi(userInput);

        // Then: Verify 200 response (not an error)
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        ApiResponse<IntentExecuteResponse> apiResponse = response.getBody();
        assertThat(apiResponse).isNotNull();
        assertThat(apiResponse.getSuccess()).isTrue();

        IntentExecuteResponse data = apiResponse.getData();
        assertThat(data).isNotNull();

        String status = data.getStatus();
        // Write operations should be blocked with NO_PERMISSION or NOT_RECOGNIZED
        assertThat(status).isIn("NO_PERMISSION", "NOT_RECOGNIZED", "NEED_MORE_INFO");

        System.out.println("=== Test8: Write Operation Permission Check ===");
        System.out.println("Status: " + status);
        System.out.println("Message: " + data.getMessage());
    }

    // ==================== Disabled Tests for Real Server ====================

    /**
     * Test against real production server.
     * Disabled by default - enable for manual integration testing.
     *
     * curl commands for all test cases:
     * ```bash
     * # Test 1: Simple query (FAST mode)
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "查询今天库存"}'
     *
     * # Test 2: Product status query
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "产品状态怎么样"}'
     *
     * # Test 3: Complex analysis
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "分析近期质检异常的原因并提供改进方案"}'
     *
     * # Test 4: Ambiguous query
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "生产情况"}'
     *
     * # Test 5: Device status (NPE fix verification)
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "设备状态"}'
     *
     * # Test 6: Reference word detection
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "这批物料的质检结果"}'
     *
     * # Test 7: Write operation (should be blocked)
     * curl -X POST "http://139.196.165.140:10010/api/public/ai-demo/execute" \
     *   -H "Content-Type: application/json" \
     *   -d '{"userInput": "删除批次MB001"}'
     * ```
     */
    @Test
    @Order(100)
    @Disabled("Requires real production server - enable for manual testing")
    @DisplayName("RealServer: 生产服务器集成测试")
    void testRealServer_Integration() {
        // This test requires the real production server at PROD_SERVER
        // Enable manually for integration testing

        TestRestTemplate prodRestTemplate = new TestRestTemplate();
        String url = PROD_SERVER + API_ENDPOINT;

        HttpEntity<Map<String, String>> request = buildRequest("查询今天库存");

        ResponseEntity<ApiResponse<IntentExecuteResponse>> response = prodRestTemplate.exchange(
                url,
                HttpMethod.POST,
                request,
                new ParameterizedTypeReference<ApiResponse<IntentExecuteResponse>>() {}
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getSuccess()).isTrue();

        System.out.println("=== Real Server Integration Test ===");
        System.out.println("Response: " + response.getBody().getData());
    }

    // ==================== Performance Benchmark ====================

    /**
     * Performance benchmark test.
     * Disabled by default - enable for performance testing.
     */
    @Test
    @Order(101)
    @Disabled("Performance test - enable for benchmarking")
    @DisplayName("Performance: API响应时间基准测试")
    void testPerformance_Benchmark() {
        String[] testQueries = {
                "查询今天库存",
                "产品状态怎么样",
                "生产情况",
                "设备状态"
        };

        System.out.println("=== Performance Benchmark ===");

        for (String query : testQueries) {
            long startTime = System.currentTimeMillis();
            ResponseEntity<ApiResponse<IntentExecuteResponse>> response = executeApi(query);
            long endTime = System.currentTimeMillis();

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

            System.out.printf("Query: '%s' - Response Time: %dms - Status: %s%n",
                    query,
                    (endTime - startTime),
                    response.getBody().getData().getStatus());
        }
    }
}
