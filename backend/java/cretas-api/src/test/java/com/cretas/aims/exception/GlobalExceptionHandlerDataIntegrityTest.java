package com.cretas.aims.exception;

import com.cretas.aims.dto.common.ApiResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.*;

/**
 * BUG-1 fix verification (depth-e2e qa-v2.4 audit, PR #370).
 *
 * GlobalExceptionHandler.handleDataIntegrityViolationException 在 FK 违规时
 * 之前对所有 HTTP method 都返回 "无法删除" 的 message + actionHint, 这对
 * POST/PUT (新建/更新引用了不存在的资源) 极其误导. 现修为按 method 分发:
 *   - POST  → "新建失败: 关联资源不存在"
 *   - PUT   → "更新失败: 关联资源已失效"
 *   - DELETE/其他 → 保留 "无法删除" (原 wording)
 *
 * 不启动 Spring context, 直接实例化 handler.
 */
@DisplayName("BUG-1: GlobalExceptionHandler FK violation HTTP-method-aware wording")
class GlobalExceptionHandlerDataIntegrityTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    /**
     * 模拟 PG FK violation message: CREATE 引用不存在的 target.
     */
    private static final String FK_NOT_PRESENT_MSG =
            "could not execute statement; SQL [n/a]; nested exception is "
                    + "org.hibernate.exception.ConstraintViolationException: could not execute statement"
                    + " | Detail: ERROR: insert or update on table \"transfers\" violates foreign key "
                    + "constraint \"fk_transfers_target_factory\"\n"
                    + "  Detail: Key (target_factory_id)=(F999_NOT_EXIST) is not present in table \"factories\".";

    /**
     * 模拟 PG FK violation message: DELETE 被其他 table 引用.
     */
    private static final String FK_REFERENCED_FROM_MSG =
            "could not execute statement; SQL [n/a]; nested exception is "
                    + "org.hibernate.exception.ConstraintViolationException: could not execute statement"
                    + " | Detail: ERROR: update or delete on table \"factories\" violates foreign key "
                    + "constraint \"fk_xxx\" on table \"users\"\n"
                    + "  Detail: Key (id)=(F001) is still referenced from table \"users\".";

    @Test
    @DisplayName("POST + FK 引用了不存在的 target → 新建失败 wording + 请确认 actionHint")
    void postFkMissingTarget_returnsCreateFailureWording() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/mobile/F001/transfers");
        DataIntegrityViolationException ex = new DataIntegrityViolationException(FK_NOT_PRESENT_MSG);

        ApiResponse<?> resp = handler.handleDataIntegrityViolationException(ex, request);

        assertEquals((Integer) 409, resp.getCode(), "FK violation 仍是 409");
        assertEquals(Boolean.FALSE, resp.getSuccess());
        assertNotNull(resp.getMessage(), "message 不能为 null");
        assertTrue(resp.getMessage().contains("新建失败"),
                "POST 的 FK 错误应含 '新建失败' wording, 实际: " + resp.getMessage());
        assertFalse(resp.getMessage().contains("无法删除"),
                "POST 错误不能说 '无法删除', 实际: " + resp.getMessage());
        assertNotNull(resp.getActionHint(), "actionHint 必填 (FE interceptor 用它分流)");
        assertTrue(resp.getActionHint().contains("请确认"),
                "POST 的 actionHint 应提示 '请确认 X 已存在', 实际: " + resp.getActionHint());
        // hintTarget should be extracted from FK message
        assertEquals("factories", resp.getHintTarget(),
                "应从 FK 错误消息提取被引用的表名 'factories'");
    }

    @Test
    @DisplayName("PUT + FK 引用了已失效的 target → 更新失败 wording + 请刷新 actionHint")
    void putFkInvalidTarget_returnsUpdateFailureWording() {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/mobile/F001/transfers/123");
        DataIntegrityViolationException ex = new DataIntegrityViolationException(FK_NOT_PRESENT_MSG);

        ApiResponse<?> resp = handler.handleDataIntegrityViolationException(ex, request);

        assertEquals((Integer) 409, resp.getCode());
        assertNotNull(resp.getMessage());
        assertTrue(resp.getMessage().contains("更新失败"),
                "PUT 的 FK 错误应含 '更新失败' wording, 实际: " + resp.getMessage());
        assertFalse(resp.getMessage().contains("无法删除"),
                "PUT 错误不能说 '无法删除'");
        assertNotNull(resp.getActionHint());
        assertTrue(resp.getActionHint().contains("刷新页面"),
                "PUT 的 actionHint 应提示 '刷新页面后重新选择', 实际: " + resp.getActionHint());
        assertEquals("factories", resp.getHintTarget());
    }

    @Test
    @DisplayName("DELETE + FK 被其他记录引用 → 保留原 '无法删除' wording (向后兼容)")
    void deleteFkReferencedFrom_keepsLegacyWording() {
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/api/mobile/F001/factories/F001");
        DataIntegrityViolationException ex = new DataIntegrityViolationException(FK_REFERENCED_FROM_MSG);

        ApiResponse<?> resp = handler.handleDataIntegrityViolationException(ex, request);

        assertEquals((Integer) 409, resp.getCode());
        assertNotNull(resp.getMessage());
        assertTrue(resp.getMessage().contains("无法删除"),
                "DELETE 应保留 '无法删除' wording, 实际: " + resp.getMessage());
        assertTrue(resp.getMessage().contains("users"),
                "应提取 referenced from 表名, 实际: " + resp.getMessage());
        assertEquals("users", resp.getHintTarget());
        assertNotNull(resp.getActionHint());
        assertTrue(resp.getActionHint().contains("先处理"),
                "DELETE 的 actionHint 应提示 '先处理引用的记录'");
    }

    @Test
    @DisplayName("POST + 唯一约束违规 → wording 不受 method 影响 (沿用原唯一约束分支)")
    void postUniqueViolation_keepsUniqueWording() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/mobile/F001/users");
        // 唯一约束错误消息 (PG 格式)
        String uniqueMsg = "could not execute statement; SQL [n/a]"
                + " | Detail: ERROR: duplicate key value violates unique constraint \"users_phone_key\"\n"
                + "  Detail: Key (phone)=(13800001234) already exists.";
        DataIntegrityViolationException ex = new DataIntegrityViolationException(uniqueMsg);

        ApiResponse<?> resp = handler.handleDataIntegrityViolationException(ex, request);

        assertEquals((Integer) 409, resp.getCode());
        assertNotNull(resp.getMessage());
        assertTrue(resp.getMessage().contains("数据已存在"),
                "唯一约束 wording 不受 method 分支影响, 实际: " + resp.getMessage());
        assertEquals("phone", resp.getHintTarget(),
                "应从 unique violation 提取列名 phone");
        assertFalse(resp.getMessage().contains("无法删除"),
                "唯一约束不应触发 '无法删除' wording");
    }
}
