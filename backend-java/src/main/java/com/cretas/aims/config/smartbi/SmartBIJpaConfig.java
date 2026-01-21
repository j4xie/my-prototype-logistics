package com.cretas.aims.config.smartbi;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * SmartBI JPA 配置类
 *
 * 显式配置 SmartBI 模块的 JPA 扫描，确保：
 * - SmartBI 实体类被正确扫描
 * - SmartBI Repository 接口被正确注册为 Bean
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Configuration
@EntityScan(basePackages = "com.cretas.aims.entity")
@EnableJpaRepositories(basePackages = "com.cretas.aims.repository")
public class SmartBIJpaConfig {
    // 配置类，无需额外代码
    // 注意: 子包 entity.smartbi 和 repository.smartbi 会被自动扫描
}
