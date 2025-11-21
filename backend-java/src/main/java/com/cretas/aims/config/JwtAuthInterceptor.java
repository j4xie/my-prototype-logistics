package com.cretas.aims.config;

import com.cretas.aims.util.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

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

    @Autowired
    private JwtUtil jwtUtil;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 从Authorization header中提取token
        String authorization = request.getHeader("Authorization");

        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring(7); // 移除"Bearer "前缀

            try {
                // 验证token
                if (jwtUtil.validateToken(token)) {
                    // 提取userId
                    Integer userId = jwtUtil.getUserIdFromToken(token);
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
                    String factoryId = jwtUtil.getFactoryIdFromToken(token);
                    if (factoryId != null) {
                        request.setAttribute("factoryId", factoryId);
                        log.debug("从JWT提取factoryId: {}", factoryId);
                    }

                    // 提取role (可选)
                    String role = jwtUtil.getRoleFromToken(token);
                    if (role != null) {
                        request.setAttribute("role", role);
                        log.debug("从JWT提取role: {}", role);
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

        // 继续处理请求（即使没有token，也允许继续，让Controller决定是否需要认证）
        return true;
    }
}
