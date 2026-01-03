package com.cretas.aims.config;

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

    private final JwtAuthInterceptor jwtAuthInterceptor;
    private final PermissionInterceptor permissionInterceptor;

    // 构造器注入 - Spring 确保依赖已就绪
    public WebMvcConfig(JwtAuthInterceptor jwtAuthInterceptor,
                        PermissionInterceptor permissionInterceptor) {
        this.jwtAuthInterceptor = jwtAuthInterceptor;
        this.permissionInterceptor = permissionInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Swagger/OpenAPI 白名单路径
        String[] swaggerWhitelist = {
                "/swagger-ui/**",
                "/swagger-ui.html",
                "/v3/api-docs/**",
                "/swagger-resources/**",
                "/webjars/**"
        };

        // 1. JWT认证拦截器 - 验证Token，设置用户信息
        registry.addInterceptor(jwtAuthInterceptor)
                .addPathPatterns("/api/mobile/**", "/api/platform/**")  // 拦截所有mobile和platform API
                .excludePathPatterns(swaggerWhitelist)  // 排除Swagger
                .order(1);  // 最高优先级

        // 2. 权限检查拦截器 - 检查 @RequirePermission 注解
        registry.addInterceptor(permissionInterceptor)
                .addPathPatterns("/api/mobile/**", "/api/platform/**")  // 拦截所有mobile和platform API
                .excludePathPatterns(swaggerWhitelist)  // 排除Swagger
                .order(2);  // 在JWT之后执行

        WebMvcConfigurer.super.addInterceptors(registry);
    }
}
