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
    private final RequireRoleInterceptor requireRoleInterceptor;
    private final ModuleEnabledInterceptor moduleEnabledInterceptor;

    // 构造器注入 - Spring 确保依赖已就绪
    public WebMvcConfig(JwtAuthInterceptor jwtAuthInterceptor,
                        PermissionInterceptor permissionInterceptor,
                        RequireRoleInterceptor requireRoleInterceptor,
                        ModuleEnabledInterceptor moduleEnabledInterceptor) {
        this.jwtAuthInterceptor = jwtAuthInterceptor;
        this.permissionInterceptor = permissionInterceptor;
        this.requireRoleInterceptor = requireRoleInterceptor;
        this.moduleEnabledInterceptor = moduleEnabledInterceptor;
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
        // /api/internal/** 走 X-Internal-Key 校验分支 (JwtAuthInterceptor:155)，同样由此拦截器处理
        // Issue #718 (2026-05-17): 加 /api/camera/** 和 /api/ai/** — 之前这些 path 完全没 JWT 校验
        //   (CameraController/ComplexityTrainingController @PreAuthorize 是 NO-OP because
        //    Spring Security disabled). 前端无 caller, 加 JWT 不破坏现有调用方.
        registry.addInterceptor(jwtAuthInterceptor)
                .addPathPatterns("/api/mobile/**", "/api/platform/**", "/api/admin/**",
                                 "/api/internal/**", "/api/camera/**", "/api/ai/**")
                .excludePathPatterns(swaggerWhitelist)  // 排除Swagger
                .order(1);  // 最高优先级

        // 2. 权限检查拦截器 - 检查 @RequirePermission 注解
        registry.addInterceptor(permissionInterceptor)
                .addPathPatterns("/api/mobile/**", "/api/platform/**", "/api/admin/**",
                                 "/api/camera/**", "/api/ai/**")
                .excludePathPatterns(swaggerWhitelist)  // 排除Swagger
                .order(2);  // 在JWT之后执行

        // 3. Round 5 Fix SEC-1: @RequireRole 拦截器 - 检查方法级角色限制
        // Spring Security 在 application.properties 中被禁用，@PreAuthorize 失效，改用自定义注解。
        registry.addInterceptor(requireRoleInterceptor)
                .addPathPatterns("/api/mobile/**", "/api/platform/**", "/api/admin/**",
                                 "/api/camera/**", "/api/ai/**")
                .excludePathPatterns(swaggerWhitelist)
                .order(3);

        // 4. Apr 24 Phase 8: @RequireModule 拦截器 - 检查 Canvas 工厂模块是否启用
        // 必须在 Spring @Valid 验证之前运行 (aspect 顺序太晚),确保餐饮租户等
        // disable 了某模块后, URL 直访被 400 "模块 xxx 未启用" 而非 "字段不能为空".
        registry.addInterceptor(moduleEnabledInterceptor)
                .addPathPatterns("/api/mobile/**")
                .excludePathPatterns(swaggerWhitelist)
                .order(4);

        WebMvcConfigurer.super.addInterceptors(registry);
    }
}
