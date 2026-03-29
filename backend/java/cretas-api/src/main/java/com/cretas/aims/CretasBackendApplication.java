package com.cretas.aims;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 白垩纪AI Agent - Spring Boot 主应用类
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@SpringBootApplication
@EnableScheduling
@EnableJpaAuditing
public class CretasBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(CretasBackendApplication.class, args);
        System.out.println("\n========================================");
        System.out.println("  Cretas Backend System Started!");
        System.out.println("  Server running on port: 10010");
        System.out.println("  TimeClock API: /api/mobile/{factoryId}/timeclock");
        System.out.println("========================================\n");
    }

    /**
     * 全局 CORS 配置
     * allowedOriginPatterns("*") with allowCredentials(true) is required
     * for web admin HttpOnly cookie authentication.
     * (allowedOrigins("*") would conflict with allowCredentials(true))
     */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOriginPatterns("*")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true)
                        .maxAge(3600);
            }
        };
    }
}
