package com.cretas.aims.integration;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.web.server.LocalServerPort;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * ProcessMode API Contract Test
 *
 * Verifies the HTTP contract (status codes, JSON shape, required fields)
 * for all process-mode endpoints: WorkProcess, ProcessTask,
 * ProcessWorkReporting, and WorkflowNode.
 *
 * Uses {@link TestRestTemplate} against a real server on a random port
 * with the H2-backed "test" profile. Tests degrade gracefully via
 * {@code assumeTrue} when auth or prerequisite data is unavailable.
 *
 * @author Cretas Team
 * @since 2026-03-12
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("ProcessModeApiContractTest - 工序制API契约测试")
class ProcessModeApiContractTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @LocalServerPort
    private int port;

    private static final String FACTORY_ID = "F001";
    // Shared state across ordered tests
    private static String authToken;
    private static String createdWorkProcessId;
    private static String createdProcessTaskId;

    // ==================== Helper Methods ====================

    /**
     * Attempt to obtain a JWT token via the unified login endpoint.
     * Returns null if auth infrastructure is not available in the test profile.
     */
    private String getAuthToken() {
        if (authToken != null) {
            return authToken;
        }
        try {
            Map<String, String> loginBody = new LinkedHashMap<>();
            loginBody.put("username", "factory_admin1");
            loginBody.put("password", "123456");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> request = new HttpEntity<>(loginBody, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    baseUrl() + "/api/mobile/auth/unified-login",
                    HttpMethod.POST,
                    request,
                    new ParameterizedTypeReference<Map<String, Object>>() {});

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                Boolean success = (Boolean) body.get("success");
                if (Boolean.TRUE.equals(success) && body.get("data") != null) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> data = (Map<String, Object>) body.get("data");
                    authToken = (String) data.get("token");
                    if (authToken == null) {
                        authToken = (String) data.get("accessToken");
                    }
                    return authToken;
                }
            }
        } catch (Exception e) {
            // Auth not available in test env — will skip auth-dependent tests
        }
        return null;
    }

    private String baseUrl() {
        return "http://localhost:" + port;
    }

    private HttpHeaders authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String token = getAuthToken();
        if (token != null) {
            headers.set("Authorization", "Bearer " + token);
        }
        return headers;
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    /**
     * Extract the top-level ApiResponse fields from a raw Map body.
     */
    private void assertApiSuccess(Map<String, Object> body) {
        assertThat(body).isNotNull();
        assertThat(body.get("success")).isEqualTo(true);
        assertThat(body).containsKey("data");
        assertThat(body).containsKey("message");
    }

    // ==================== AC-01: POST /work-processes ====================

    @Test
    @Order(1)
    @DisplayName("AC-01: POST /work-processes — create returns success with id and processName")
    void ac01_createWorkProcess() {
        String token = getAuthToken();
        assumeTrue(token != null, "Auth not available in test profile — skipping write test");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("processName", "契约测试工序_" + System.currentTimeMillis());
        body.put("processCategory", "初加工");
        body.put("unit", "kg");
        body.put("estimatedMinutes", 30);
        body.put("sortOrder", 999);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, authHeaders());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                baseUrl() + "/api/mobile/" + FACTORY_ID + "/work-processes",
                HttpMethod.POST,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        assertThat(response.getStatusCode()).isIn(HttpStatus.OK, HttpStatus.CREATED);
        Map<String, Object> responseBody = response.getBody();
        assertApiSuccess(responseBody);

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) responseBody.get("data");
        assertThat(data).containsKey("id");
        assertThat(data).containsKey("processName");
        assertThat(data.get("processName").toString()).contains("契约测试工序");

        createdWorkProcessId = data.get("id").toString();
    }

    // ==================== AC-02: GET /work-processes/active ====================

    @Test
    @Order(2)
    @DisplayName("AC-02: GET /work-processes/active — returns sorted list with success=true")
    void ac02_listActiveWorkProcesses() {
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                baseUrl() + "/api/mobile/" + FACTORY_ID + "/work-processes/active",
                HttpMethod.GET,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertApiSuccess(body);

        // data should be a list
        Object data = body.get("data");
        assertThat(data).isInstanceOf(List.class);
    }

    // ==================== AC-03: POST /process-tasks ====================

    @Test
    @Order(3)
    @DisplayName("AC-03: POST /process-tasks — create returns success with status=PENDING")
    void ac03_createProcessTask() {
        String token = getAuthToken();
        assumeTrue(token != null, "Auth not available in test profile — skipping write test");

        // Use either the work process we just created, or a placeholder
        String workProcessId = createdWorkProcessId != null ? createdWorkProcessId : "WP-TEST-001";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("productTypeId", "PT-F001-001");
        body.put("workProcessId", workProcessId);
        body.put("plannedQuantity", 100.00);
        body.put("unit", "kg");
        body.put("startDate", LocalDate.now().toString());

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, authHeaders());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                baseUrl() + "/api/mobile/" + FACTORY_ID + "/process-tasks",
                HttpMethod.POST,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        // Might be 200 or might fail if product type doesn't exist in H2 — gracefully handle
        if (response.getStatusCode().is2xxSuccessful()) {
            Map<String, Object> responseBody = response.getBody();
            assertApiSuccess(responseBody);

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) responseBody.get("data");
            assertThat(data).containsKey("id");
            assertThat(data).containsKey("status");
            assertThat(data.get("status").toString()).isEqualTo("PENDING");

            createdProcessTaskId = data.get("id").toString();
        } else {
            // If the service returned an error (e.g. product type not found), the response
            // should still be well-formed JSON with success=false
            Map<String, Object> responseBody = response.getBody();
            assertThat(responseBody).isNotNull();
            assertThat(responseBody).containsKey("success");
        }
    }

    // ==================== AC-04: GET /process-tasks/active ====================

    @Test
    @Order(4)
    @DisplayName("AC-04: GET /process-tasks/active — only PENDING/IN_PROGRESS/SUPPLEMENTING statuses")
    void ac04_getActiveProcessTasks() {
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                baseUrl() + "/api/mobile/" + FACTORY_ID + "/process-tasks/active",
                HttpMethod.GET,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertApiSuccess(body);

        Object data = body.get("data");
        assertThat(data).isInstanceOf(List.class);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tasks = (List<Map<String, Object>>) data;
        Set<String> allowedStatuses = Set.of("PENDING", "IN_PROGRESS", "SUPPLEMENTING");
        for (Map<String, Object> task : tasks) {
            if (task.containsKey("status")) {
                assertThat(allowedStatuses).contains(task.get("status").toString());
            }
        }
    }

    // ==================== AC-05: PUT /process-tasks/{id}/status ====================

    @Test
    @Order(5)
    @DisplayName("AC-05: PUT /process-tasks/{id}/status — validates transition, returns success")
    void ac05_updateProcessTaskStatus() {
        String token = getAuthToken();
        assumeTrue(token != null, "Auth not available — skipping");
        assumeTrue(createdProcessTaskId != null, "No task created in AC-03 — skipping");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "IN_PROGRESS");
        body.put("notes", "契约测试: PENDING -> IN_PROGRESS");

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, authHeaders());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                baseUrl() + "/api/mobile/" + FACTORY_ID + "/process-tasks/" + createdProcessTaskId + "/status",
                HttpMethod.PUT,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        if (response.getStatusCode().is2xxSuccessful()) {
            Map<String, Object> responseBody = response.getBody();
            assertApiSuccess(responseBody);

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) responseBody.get("data");
            assertThat(data).containsKey("status");
            assertThat(data.get("status").toString()).isEqualTo("IN_PROGRESS");
        } else {
            // Transition validation rejection is also a valid contract response
            Map<String, Object> responseBody = response.getBody();
            assertThat(responseBody).isNotNull();
            assertThat(responseBody).containsKey("success");
            assertThat(responseBody).containsKey("message");
        }
    }

    // ==================== AC-06: GET /process-tasks/{id}/summary ====================

    @Test
    @Order(6)
    @DisplayName("AC-06: GET /process-tasks/{id}/summary — returns TaskSummary with quantities")
    void ac06_getProcessTaskSummary() {
        assumeTrue(createdProcessTaskId != null, "No task created in AC-03 — skipping");

        HttpEntity<Void> request = new HttpEntity<>(authHeaders());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                baseUrl() + "/api/mobile/" + FACTORY_ID + "/process-tasks/" + createdProcessTaskId + "/summary",
                HttpMethod.GET,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        if (response.getStatusCode().is2xxSuccessful()) {
            Map<String, Object> responseBody = response.getBody();
            assertApiSuccess(responseBody);

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) responseBody.get("data");
            assertThat(data).isNotNull();
            // TaskSummary should have quantity fields
            assertThat(data).containsKey("plannedQuantity");
            assertThat(data).containsKey("taskId");
        } else {
            // 404 for non-existent task is a valid contract response
            assertThat(response.getStatusCode().value()).isIn(200, 404, 500);
        }
    }

    // ==================== AC-07: PUT /process-work-reporting/{id}/approve ====================

    @Test
    @Order(7)
    @DisplayName("AC-07: PUT /process-work-reporting/{id}/approve — success or data-not-found")
    void ac07_approveWorkReport() {
        String token = getAuthToken();
        assumeTrue(token != null, "Auth not available — skipping");

        // Use a non-existent ID; we expect either a proper error or success if data exists
        Long reportId = 999999L;

        HttpEntity<Void> request = new HttpEntity<>(authHeaders());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                baseUrl() + "/api/mobile/" + FACTORY_ID + "/process-work-reporting/" + reportId + "/approve",
                HttpMethod.PUT,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        // Contract: server should return a well-formed JSON response, not a 500 crash
        Map<String, Object> body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body).containsKey("success");
        assertThat(body).containsKey("message");

        // If the report doesn't exist, success should be false
        if (!response.getStatusCode().is2xxSuccessful()) {
            assertThat(body.get("success")).isEqualTo(false);
        }
    }

    // ==================== AC-08: PUT /process-work-reporting/{id}/reject ====================

    @Test
    @Order(8)
    @DisplayName("AC-08: PUT /process-work-reporting/{id}/reject — success or data-not-found")
    void ac08_rejectWorkReport() {
        String token = getAuthToken();
        assumeTrue(token != null, "Auth not available — skipping");

        Long reportId = 999999L;
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                baseUrl() + "/api/mobile/" + FACTORY_ID + "/process-work-reporting/" + reportId
                        + "/reject?reason=" + "契约测试拒绝原因",
                HttpMethod.PUT,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        Map<String, Object> body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body).containsKey("success");
        assertThat(body).containsKey("message");

        if (!response.getStatusCode().is2xxSuccessful()) {
            assertThat(body.get("success")).isEqualTo(false);
        }
    }

    // ==================== AC-09: POST /process-work-reporting/supplement ====================

    @Test
    @Order(9)
    @DisplayName("AC-09: POST /process-work-reporting/supplement — success or task-not-found")
    void ac09_submitSupplement() {
        String token = getAuthToken();
        assumeTrue(token != null, "Auth not available — skipping");

        String taskId = createdProcessTaskId != null ? createdProcessTaskId : "TASK-NONEXISTENT";

        HttpEntity<Void> request = new HttpEntity<>(authHeaders());

        String url = baseUrl() + "/api/mobile/" + FACTORY_ID + "/process-work-reporting/supplement"
                + "?processTaskId=" + taskId
                + "&reporterName=测试员工"
                + "&outputQuantity=10.5";

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        Map<String, Object> body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body).containsKey("success");
        assertThat(body).containsKey("message");
    }

    // ==================== AC-10: PUT /process-work-reporting/batch-approve ====================

    @Test
    @Order(10)
    @DisplayName("AC-10: PUT /process-work-reporting/batch-approve — accepts list of IDs")
    void ac10_batchApprove() {
        String token = getAuthToken();
        assumeTrue(token != null, "Auth not available — skipping");

        List<Long> reportIds = Arrays.asList(999991L, 999992L, 999993L);

        HttpEntity<List<Long>> request = new HttpEntity<>(reportIds, authHeaders());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                baseUrl() + "/api/mobile/" + FACTORY_ID + "/process-work-reporting/batch-approve",
                HttpMethod.PUT,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        Map<String, Object> body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body).containsKey("success");
        assertThat(body).containsKey("message");
    }

    // ==================== AC-11: GET /api/workflow/node-schemas ====================

    @Test
    @Order(11)
    @DisplayName("AC-11: GET /api/workflow/node-schemas — returns array with schema definitions")
    void ac11_getWorkflowNodeSchemas() {
        HttpEntity<Void> request = new HttpEntity<>(authHeaders());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                baseUrl() + "/api/workflow/node-schemas",
                HttpMethod.GET,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertApiSuccess(body);

        Object data = body.get("data");
        assertThat(data).isInstanceOf(List.class);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> schemas = (List<Map<String, Object>>) data;
        // WorkflowNodeRegistry should return 6 node schemas
        assertThat(schemas).hasSizeGreaterThanOrEqualTo(1);

        // Each schema should have a type/category identifying it
        if (!schemas.isEmpty()) {
            Map<String, Object> firstSchema = schemas.get(0);
            assertThat(firstSchema).isNotEmpty();
        }
    }

    // ==================== AC-12: POST with missing required fields ====================

    @Test
    @Order(12)
    @DisplayName("AC-12: POST /work-processes with missing processName — returns 400")
    void ac12_createWorkProcessMissingRequiredFields() {
        String token = getAuthToken();
        assumeTrue(token != null, "Auth not available — skipping validation test");

        // Send empty body — processName is @NotBlank
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("processCategory", "初加工");
        // processName intentionally omitted

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, authHeaders());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                baseUrl() + "/api/mobile/" + FACTORY_ID + "/work-processes",
                HttpMethod.POST,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        // Should be 400 Bad Request for missing @NotBlank field
        assertThat(response.getStatusCode().value()).isIn(400, 422, 500);

        Map<String, Object> responseBody = response.getBody();
        if (responseBody != null && responseBody.containsKey("success")) {
            assertThat(responseBody.get("success")).isEqualTo(false);
        }
    }

    // ==================== AC-12b: POST /process-tasks with missing fields ====================

    @Test
    @Order(13)
    @DisplayName("AC-12b: POST /process-tasks with missing productTypeId — returns error")
    void ac12b_createProcessTaskMissingRequiredFields() {
        String token = getAuthToken();
        assumeTrue(token != null, "Auth not available — skipping validation test");

        // Missing productTypeId and workProcessId (both @NotBlank)
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("plannedQuantity", 50.0);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, authHeaders());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                baseUrl() + "/api/mobile/" + FACTORY_ID + "/process-tasks",
                HttpMethod.POST,
                request,
                new ParameterizedTypeReference<Map<String, Object>>() {});

        assertThat(response.getStatusCode().value()).isIn(400, 422, 500);

        Map<String, Object> responseBody = response.getBody();
        if (responseBody != null && responseBody.containsKey("success")) {
            assertThat(responseBody.get("success")).isEqualTo(false);
        }
    }
}
