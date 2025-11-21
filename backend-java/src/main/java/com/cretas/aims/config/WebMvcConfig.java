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
 * @version 1.0.0
 * @since 2025-11-20
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private JwtAuthInterceptor jwtAuthInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(jwtAuthInterceptor)
                .addPathPatterns("/api/mobile/**")  // 拦截所有mobile API
                .order(1);  // 设置最高优先级，确保在其他Interceptor之前执行

        WebMvcConfigurer.super.addInterceptors(registry);
    }
}
