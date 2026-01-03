package com.cretas.aims.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * OpenAPI (Swagger) 配置类
 * 提供 API 文档自动生成和 JWT 认证支持
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Configuration
public class OpenApiConfig {

    @Value("${server.port:10010}")
    private int serverPort;

    @Bean
    public OpenAPI customOpenAPI() {
        final String securitySchemeName = "bearerAuth";

        return new OpenAPI()
                // API 基本信息
                .info(new Info()
                        .title("白垩纪食品溯源系统 API")
                        .description("""
                                ## 白垩纪食品溯源系统 (Cretas Food Traceability System)

                                ### 功能模块
                                - **认证模块**: 用户登录、Token刷新
                                - **生产管理**: 生产计划、加工批次、原材料管理
                                - **质量管理**: 质检记录、处置规则、告警管理
                                - **设备管理**: 设备注册、维护记录、告警
                                - **溯源查询**: 批次追溯、供应链追踪
                                - **AI服务**: 智能分析、成本优化、报表生成

                                ### 认证方式
                                使用 JWT Bearer Token 认证，在请求头添加:
                                ```
                                Authorization: Bearer <your-token>
                                ```

                                ### 测试账号
                                - **管理员**: factory_admin1 / 123456
                                """)
                        .version("3.0.0")
                        .contact(new Contact()
                                .name("Cretas Team")
                                .email("support@cretas.com"))
                        .license(new License()
                                .name("Proprietary")
                                .url("https://cretas.com")))

                // 服务器配置
                .servers(List.of(
                        new Server()
                                .url("http://localhost:" + serverPort)
                                .description("本地开发环境"),
                        new Server()
                                .url("http://139.196.165.140:10010")
                                .description("生产服务器")))

                // JWT 安全配置
                .addSecurityItem(new SecurityRequirement()
                        .addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName,
                                new SecurityScheme()
                                        .name(securitySchemeName)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("输入JWT Token (不需要Bearer前缀)")));
    }
}
