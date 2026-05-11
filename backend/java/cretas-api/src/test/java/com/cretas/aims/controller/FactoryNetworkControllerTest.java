package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.platform.FactoryDTO;
import com.cretas.aims.service.FactoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * BUG-2 fix verification (depth-e2e qa-v2.4 audit, PR #370).
 *
 * /api/mobile/{factoryId}/factories/network 之前在 controller 内调用
 * factoryAccessValidator.validateAccess(factoryId), 该 validator 依赖
 * SecurityContextHolder, 但项目实际通过 JwtAuthInterceptor 把 userId/factoryId
 * 写入 request attributes (不填充 SecurityContextHolder). 结果对合法登录用户
 * 总是抛 AuthenticationException("用户未登录") = 401, f006_admin 等正常用户
 * 都被错误拒绝.
 *
 * 修复: 移除 validator 调用. 多租户边界已由 JwtAuthInterceptor.preHandle
 * 强制 (跨工厂访问 403, 未登录 401). controller 内只做业务逻辑.
 */
@DisplayName("BUG-2: FactoryNetworkController.getNetwork 不再因 SecurityContext 空抛 401")
@ExtendWith(MockitoExtension.class)
class FactoryNetworkControllerTest {

    @Mock
    private FactoryService factoryService;

    private FactoryNetworkController controller;

    @BeforeEach
    void setUp() {
        // BUG-2 fix: controller 不再注入 FactoryAccessValidator
        controller = new FactoryNetworkController(factoryService);
    }

    @Test
    @DisplayName("合法 factoryId, factoryService 正常返 → 200 含 self entry, 不抛 AuthenticationException")
    void validFactoryId_returnsNetworkWithoutAuthError() {
        FactoryDTO self = FactoryDTO.builder().id("F006").name("六腾门").build();
        when(factoryService.getFactoryById(eq("F006"))).thenReturn(self);
        when(factoryService.getAccessibleFactoryIds(eq("F006")))
                .thenReturn(Arrays.asList("F006"));

        ApiResponse<List<FactoryNetworkController.FactoryNetworkEntry>> resp =
                controller.getNetwork("F006");

        assertNotNull(resp);
        assertEquals(Boolean.TRUE, resp.getSuccess(),
                "合法登录用户访问自己工厂的 network 应该 success=true, 而不是 401");
        assertNotNull(resp.getData());
        assertEquals(1, resp.getData().size(), "self entry only (accessibleIds 返自身, 去重后剩一条)");
        assertEquals("F006", resp.getData().get(0).getFactoryId());
        assertEquals("六腾门", resp.getData().get(0).getFactoryName());
    }

    @Test
    @DisplayName("factoryService.getFactoryById 抛异常 → 优雅 fallback (stub entry), 不抛 401")
    void factoryServiceThrows_gracefulFallback() {
        // self lookup throws (e.g. factory record missing)
        when(factoryService.getFactoryById(eq("F999")))
                .thenThrow(new RuntimeException("DB connection refused"));
        when(factoryService.getAccessibleFactoryIds(eq("F999")))
                .thenReturn(Arrays.asList("F999"));

        ApiResponse<List<FactoryNetworkController.FactoryNetworkEntry>> resp =
                controller.getNetwork("F999");

        // BUG-2 fix 验证: 不再 propagate 401
        assertEquals(Boolean.TRUE, resp.getSuccess(),
                "graceful fallback 应保持 success=true (controller 内 try/catch)");
        assertNotNull(resp.getData());
        assertEquals(1, resp.getData().size(), "self stub entry");
        assertEquals("F999", resp.getData().get(0).getFactoryId());
    }
}
