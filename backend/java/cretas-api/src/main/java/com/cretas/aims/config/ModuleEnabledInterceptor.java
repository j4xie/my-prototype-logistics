package com.cretas.aims.config;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.service.config.FactoryConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Canvas module enable-check interceptor.
 *
 * Runs BEFORE Spring @Valid body validation so disabled-module writes
 * return "模块 xxx 未启用" instead of "字段不能为空". Previously this
 * check was an @Before AOP aspect (ModuleEnabledAspect) which fires
 * AFTER Spring validation — so valid-schema+disabled-module was never
 * tested properly.
 *
 * @since Apr 24 2026 Phase 8
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ModuleEnabledInterceptor implements HandlerInterceptor {

    private final FactoryConfigService configService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }
        HandlerMethod hm = (HandlerMethod) handler;
        RequireModule annotation = hm.getMethodAnnotation(RequireModule.class);
        if (annotation == null) {
            annotation = hm.getBeanType().getAnnotation(RequireModule.class);
        }
        if (annotation == null) {
            return true;
        }

        String moduleCode = annotation.value();
        // Extract factoryId from path — all our canvas-scoped writes follow
        // /api/mobile/{factoryId}/...
        String path = request.getRequestURI();
        String factoryId = extractFactoryId(path);
        if (factoryId == null) {
            // C2 fix (reviewer Apr 24): false-accept is silent security gap.
            // Log at WARN so ops notices + return 400 with explicit reason.
            log.warn("@RequireModule({}) on {} but no factoryId extractable — blocking", moduleCode, path);
            sendCanvasError(response, "请求路径缺少 factoryId, 无法校验模块状态");
            return false;
        }

        if (!configService.isModuleEnabled(factoryId, moduleCode)) {
            log.info("模块 {} 在工厂 {} 中未启用，拒绝访问 {}", moduleCode, factoryId, path);
            sendModuleDisabled(response, moduleCode);
            return false;
        }
        return true;
    }

    private String extractFactoryId(String path) {
        // /api/mobile/{factoryId}/...
        if (path == null) return null;
        String[] parts = path.split("/");
        // /api/mobile/F001/... → parts = ["", "api", "mobile", "F001", ...]
        for (int i = 0; i < parts.length - 1; i++) {
            if ("mobile".equals(parts[i]) && i + 1 < parts.length) {
                return parts[i + 1];
            }
        }
        return null;
    }

    private void sendModuleDisabled(HttpServletResponse response, String moduleCode) throws Exception {
        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", 400);
        body.put("success", false);
        body.put("message", "模块 " + moduleCode + " 未启用");
        body.put("data", null);
        body.put("timestamp", java.time.LocalDateTime.now().toString());
        body.put("actionHint", "该功能需要在 Canvas 配置中启用 " + moduleCode + " 模块后才能使用");
        body.put("severity", "warning");
        response.getWriter().write(objectMapper.writeValueAsString(body));
        response.getWriter().flush();
    }

    private void sendCanvasError(HttpServletResponse response, String message) throws Exception {
        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", 400);
        body.put("success", false);
        body.put("message", message);
        body.put("data", null);
        body.put("timestamp", java.time.LocalDateTime.now().toString());
        body.put("severity", "error");
        response.getWriter().write(objectMapper.writeValueAsString(body));
        response.getWriter().flush();
    }
}
