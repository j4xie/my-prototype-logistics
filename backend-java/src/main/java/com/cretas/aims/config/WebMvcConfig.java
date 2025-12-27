package com.cretas.aims.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Spring MVC配置
 * 注册Interceptor和其他Web相关配置
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-11-20
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private JwtAuthInterceptor jwtAuthInterceptor;

    @Autowired
    private PermissionInterceptor permissionInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 1. JWT认证拦截器 - 验证Token，设置用户信息
        registry.addInterceptor(jwtAuthInterceptor)
                .addPathPatterns("/api/mobile/**")  // 拦截所有mobile API
                .order(1);  // 最高优先级

        // 2. 权限检查拦截器 - 检查 @RequirePermission 注解
        registry.addInterceptor(permissionInterceptor)
                .addPathPatterns("/api/mobile/**")  // 拦截所有mobile API
                .order(2);  // 在JWT之后执行

        WebMvcConfigurer.super.addInterceptors(registry);
    }
}
