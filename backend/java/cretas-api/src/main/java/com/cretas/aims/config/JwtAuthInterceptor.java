package com.cretas.aims.config;

import com.cretas.aims.utils.JwtUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * JWT认证拦截器
 * 自动从Authorization header中提取JWT token，解析userId和username并注入到request attributes中
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-20
 */
@Component
public class JwtAuthInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthInterceptor.class);

    // 平台管理员角色列表，可访问所有工厂
    private static final Set<String> PLATFORM_ADMIN_ROLES = Set.of(
            "super_admin", "platform_admin", "developer"
    );

    // 匹配URL中的factoryId的正则表达式
    private static final Pattern FACTORY_ID_PATTERN = Pattern.compile("/api/mobile/([^/]+)/");

    // 平台API路径前缀
    private static final String PLATFORM_API_PREFIX = "/api/platform";

    @Autowired
    private JwtUtil jwtUtil;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 从Authorization header中提取token
        String authorization = request.getHeader("Authorization");

        String tokenFactoryId = null;
        String tokenRole = null;
        Long userId = null;

        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring(7); // 移除"Bearer "前缀

            try {
                // 验证token
                if (jwtUtil.validateToken(token)) {
                    // 提取userId
                    userId = jwtUtil.getUserIdFromToken(token);
                    if (userId != null) {
                        request.setAttribute("userId", userId);
                        log.debug("从JWT提取userId: {}", userId);
                    }

                    // 提取username
                    String username = jwtUtil.getUsernameFromToken(token);
                    if (username != null) {
                        request.setAttribute("username", username);
                        log.debug("从JWT提取username: {}", username);
                    }

                    // 提取factoryId (可选)
                    tokenFactoryId = jwtUtil.getFactoryIdFromToken(token);
                    if (tokenFactoryId != null) {
                        request.setAttribute("factoryId", tokenFactoryId);
                        log.debug("从JWT提取factoryId: {}", tokenFactoryId);
                    }

                    // 提取role (可选)
                    tokenRole = jwtUtil.getRoleFromToken(token);
                    if (tokenRole != null) {
                        request.setAttribute("role", tokenRole);
                        log.debug("从JWT提取role: {}", tokenRole);
                    }
                } else {
                    log.warn("无效的JWT token");
                }
            } catch (Exception e) {
                log.error("解析JWT token失败: {}", e.getMessage());
            }
        } else {
            log.debug("请求未包含Authorization header或格式不正确");
        }

        // 跨工厂权限验证
        String requestUri = request.getRequestURI();

        // 平台API权限验证 - BUG-044修复: 只有平台管理员才能访问/api/platform/**
        if (requestUri.startsWith(PLATFORM_API_PREFIX)) {
            // 首先检查是否有有效的认证信息
            if (userId == null) {
                log.warn("平台API未认证请求: uri={}", requestUri);
                sendUnauthorizedResponse(response, "未授权，请先登录");
                return false;
            }

            // 检查是否有平台管理员角色
            if (tokenRole == null || !PLATFORM_ADMIN_ROLES.contains(tokenRole.toLowerCase())) {
                log.warn("平台API权限不足: userId={}, role={}, uri={}",
                        userId, tokenRole, requestUri);
                sendForbiddenResponse(response, "无权访问平台管理API，需要平台管理员权限");
                return false;
            }

            log.debug("平台API权限验证通过: userId={}, role={}", userId, tokenRole);
            return true;
        }

        String urlFactoryId = extractFactoryIdFromUrl(requestUri);

        if (urlFactoryId != null && !isPublicEndpoint(requestUri)) {
            // 首先检查是否有有效的认证信息（401 场景）
            if (userId == null || (tokenFactoryId == null && tokenRole == null)) {
                log.warn("未认证请求: userId={}, tokenFactoryId={}, urlFactoryId={}",
                        userId, tokenFactoryId, urlFactoryId);
                sendUnauthorizedResponse(response, "未授权，请先登录");
                return false;
            }

            // URL中包含factoryId，需要验证权限（403 场景）
            if (!validateFactoryAccess(urlFactoryId, tokenFactoryId, tokenRole)) {
                log.warn("跨工厂访问被拒绝: userId={}, tokenFactoryId={}, urlFactoryId={}, role={}",
                        userId, tokenFactoryId, urlFactoryId, tokenRole);
                sendForbiddenResponse(response, "无权访问该工厂数据");
                return false;
            }
        }

        // 继续处理请求
        return true;
    }

    /**
     * 从URL中提取factoryId
     */
    private String extractFactoryIdFromUrl(String uri) {
        Matcher matcher = FACTORY_ID_PATTERN.matcher(uri);
        if (matcher.find()) {
            String factoryId = matcher.group(1);
            // 排除非factoryId的路径部分
            if (!"auth".equals(factoryId) && !"activation".equals(factoryId)
                    && !"health".equals(factoryId) && !"upload".equals(factoryId)
                    && !"voice".equals(factoryId) && !"ai".equals(factoryId)
                    && !"scale-protocols".equals(factoryId)) {
                return factoryId;
            }
        }
        return null;
    }

    /**
     * 检查是否为公开端点（不需要权限验证）
     */
    private boolean isPublicEndpoint(String uri) {
        return uri.contains("/auth/") ||
               uri.contains("/activation/") ||
               uri.contains("/health") ||
               uri.contains("/upload") ||
               uri.contains("/voice/") ||  // 语音识别接口（不需要工厂权限）
               uri.startsWith("/api/public/");  // 公开溯源查询接口
    }

    /**
     * 验证工厂访问权限
     */
    private boolean validateFactoryAccess(String urlFactoryId, String tokenFactoryId, String tokenRole) {
        // 未登录用户不能访问工厂数据
        if (tokenFactoryId == null && tokenRole == null) {
            return false;
        }

        // 平台管理员可访问所有工厂（大小写不敏感）
        if (tokenRole != null && PLATFORM_ADMIN_ROLES.contains(tokenRole.toLowerCase())) {
            return true;
        }

        // PLATFORM工厂ID表示平台级用户
        if ("PLATFORM".equals(tokenFactoryId)) {
            return true;
        }

        // 普通用户只能访问自己工厂的数据
        return urlFactoryId.equals(tokenFactoryId);
    }

    /**
     * 发送401 Unauthorized响应
     */
    private void sendUnauthorizedResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("code", 401);
        errorResponse.put("message", message);
        errorResponse.put("success", false);
        errorResponse.put("timestamp", java.time.LocalDateTime.now().toString());

        ObjectMapper mapper = new ObjectMapper();
        response.getWriter().write(mapper.writeValueAsString(errorResponse));
    }

    /**
     * 发送403 Forbidden响应
     */
    private void sendForbiddenResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("code", 403);
        errorResponse.put("message", message);
        errorResponse.put("success", false);
        errorResponse.put("timestamp", java.time.LocalDateTime.now().toString());

        ObjectMapper mapper = new ObjectMapper();
        response.getWriter().write(mapper.writeValueAsString(errorResponse));
    }
}
