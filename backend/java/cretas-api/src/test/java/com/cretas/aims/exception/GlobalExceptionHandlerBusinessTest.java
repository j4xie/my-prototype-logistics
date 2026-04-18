package com.cretas.aims.exception;

import com.cretas.aims.dto.common.ApiResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 验证 UX 2026-04-18 增强:
 * 1. handleBusinessException 按 code 映射 HTTP status (409/403/404 ↔ CONFLICT/FORBIDDEN/NOT_FOUND, 其他→400)
 * 2. actionHint/severity/hintTarget 通过 ApiResponse.errorWithHint 进 response body
 * 3. 未带 hint 的 BusinessException 走 plain ApiResponse.error 路径,body 不含 hint 字段
 *
 * 直接实例化 handler + 调 method,不启动 Spring context,~2s 跑完.
 */
class GlobalExceptionHandlerBusinessTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void businessException_code_409_maps_to_http_409_conflict() {
        BusinessException ex = new BusinessException(409, "重复的开票申请");
        ResponseEntity<ApiResponse<?>> resp = handler.handleBusinessException(ex);
        assertEquals(409, resp.getStatusCode().value());
    }

    @Test
    void businessException_code_403_maps_to_http_403_forbidden() {
        BusinessException ex = new BusinessException(403, "无权访问");
        ResponseEntity<ApiResponse<?>> resp = handler.handleBusinessException(ex);
        assertEquals(403, resp.getStatusCode().value());
    }

    @Test
    void businessException_code_404_maps_to_http_404_not_found() {
        BusinessException ex = new BusinessException(404, "资源不存在");
        ResponseEntity<ApiResponse<?>> resp = handler.handleBusinessException(ex);
        assertEquals(404, resp.getStatusCode().value());
    }

    @Test
    void businessException_unspecified_code_maps_to_http_400_bad_request() {
        BusinessException ex = new BusinessException("普通业务错误");  // default code 400
        ResponseEntity<ApiResponse<?>> resp = handler.handleBusinessException(ex);
        assertEquals(400, resp.getStatusCode().value());
    }

    @Test
    void businessException_unknown_code_defaults_to_http_400() {
        // 任意未在 switch 里列的 code (如 418) 走 default → 400
        BusinessException ex = new BusinessException(418, "I'm a teapot");
        ResponseEntity<ApiResponse<?>> resp = handler.handleBusinessException(ex);
        assertEquals(400, resp.getStatusCode().value());
    }

    @Test
    void businessException_with_hint_body_contains_all_hint_fields() {
        BusinessException ex = new BusinessException(409, "重复的开票申请")
                .withHint("请先处理或撤销已有的发票申请")
                .withSeverity("BLOCKING")
                .withHintTarget("开票申请");

        ResponseEntity<ApiResponse<?>> resp = handler.handleBusinessException(ex);
        ApiResponse<?> body = resp.getBody();

        assertNotNull(body, "response body 不应为 null");
        assertEquals("请先处理或撤销已有的发票申请", body.getActionHint());
        assertEquals("BLOCKING", body.getSeverity());
        assertEquals("开票申请", body.getHintTarget());
        assertEquals((Integer) 409, body.getCode());
        assertEquals(Boolean.FALSE, body.getSuccess());
    }

    @Test
    void businessException_without_hint_body_has_null_hint_fields() {
        BusinessException ex = new BusinessException(409, "plain 409");
        // 不调用 withHint/withSeverity/withHintTarget

        ResponseEntity<ApiResponse<?>> resp = handler.handleBusinessException(ex);
        ApiResponse<?> body = resp.getBody();

        assertNotNull(body);
        assertNull(body.getActionHint(), "未设 actionHint 时 body.actionHint 必须是 null");
        assertNull(body.getSeverity());
        assertNull(body.getHintTarget());
    }

    @Test
    void businessException_with_only_actionHint_still_triggers_errorWithHint_path() {
        // 只设一个 hint 字段也应该走 errorWithHint 分支
        BusinessException ex = new BusinessException(400, "msg").withHint("操作提示");

        ResponseEntity<ApiResponse<?>> resp = handler.handleBusinessException(ex);
        ApiResponse<?> body = resp.getBody();

        assertEquals("操作提示", body.getActionHint());
        assertNull(body.getSeverity());
        assertNull(body.getHintTarget());
    }
}
