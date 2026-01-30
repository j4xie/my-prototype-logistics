package com.cretas.aims;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 白垩纪食品溯源系统 - Spring Boot 主应用类
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
     * 允许跨域请求（用于React Native前端调用）
     */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new CorsWebMvcConfigurer();
    }

    /**
     * CORS配置实现类（避免DevTools类加载问题）
     */
    private static class CorsWebMvcConfigurer implements WebMvcConfigurer {
        @Override
        public void addCorsMappings(CorsRegistry registry) {
            registry.addMapping("/api/**")
                    .allowedOrigins("*")
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                    .allowedHeaders("*")
                    .allowCredentials(false)
                    .maxAge(3600);
        }
    }
}
