package com.cretas.aims.config;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.User;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.PermissionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 权限拦截器
 *
 * 处理 @RequirePermission 注解，检查用户权限
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-12-27
 */
@Component
public class PermissionInterceptor implements HandlerInterceptor {

    @Autowired
    private PermissionService permissionService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {

        // 只处理 HandlerMethod (Controller方法)
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }

        HandlerMethod handlerMethod = (HandlerMethod) handler;

        // 获取方法或类上的 @RequirePermission 注解
        RequirePermission methodAnnotation = handlerMethod.getMethodAnnotation(RequirePermission.class);
        RequirePermission classAnnotation = handlerMethod.getBeanType().getAnnotation(RequirePermission.class);

        // 优先使用方法注解，如果没有则使用类注解
        RequirePermission annotation = methodAnnotation != null ? methodAnnotation : classAnnotation;

        // 没有注解，放行
        if (annotation == null) {
            return true;
        }

        // 获取当前用户
        User user = getCurrentUser(request);
        if (user == null) {
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "用户未登录");
            return false;
        }

        // 检查权限
        String[] requiredPermissions = annotation.value();
        boolean hasPermission;

        if (annotation.requireAll()) {
            hasPermission = permissionService.hasAllPermissions(user, requiredPermissions);
        } else {
            hasPermission = permissionService.hasAnyPermission(user, requiredPermissions);
        }

        if (!hasPermission) {
            sendError(response, HttpServletResponse.SC_FORBIDDEN, annotation.message());
            return false;
        }

        return true;
    }

    /**
     * 获取当前登录用户
     */
    private User getCurrentUser(HttpServletRequest request) {
        // 从请求属性中获取用户ID (由 JwtAuthInterceptor 设置)
        Object userIdObj = request.getAttribute("userId");
        if (userIdObj == null) {
            return null;
        }

        Long userId;
        if (userIdObj instanceof Long) {
            userId = (Long) userIdObj;
        } else if (userIdObj instanceof Integer) {
            userId = ((Integer) userIdObj).longValue();
        } else if (userIdObj instanceof String) {
            try {
                userId = Long.parseLong((String) userIdObj);
            } catch (NumberFormatException e) {
                return null;
            }
        } else {
            return null;
        }

        Optional<User> userOpt = userRepository.findById(userId);
        return userOpt.orElse(null);
    }

    /**
     * 发送错误响应
     */
    private void sendError(HttpServletResponse response, int status, String message) throws Exception {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");

        Map<String, Object> errorBody = new HashMap<>();
        errorBody.put("success", false);
        errorBody.put("message", message);
        errorBody.put("code", status == HttpServletResponse.SC_UNAUTHORIZED ? "UNAUTHORIZED" : "FORBIDDEN");

        response.getWriter().write(objectMapper.writeValueAsString(errorBody));
    }
}
