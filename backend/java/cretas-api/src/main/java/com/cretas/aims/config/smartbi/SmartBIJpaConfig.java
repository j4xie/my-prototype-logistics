package com.cretas.aims.config.smartbi;

import org.springframework.context.annotation.Configuration;

/**
 * SmartBI JPA 配置类
 *
 * 注意: JPA 扫描已移至 datasource 包下的配置类:
 * - PrimaryDataSourceConfig: MySQL 主数据源 (包含原有 SmartBI 固定表)
 * - SmartBIPostgresDataSourceConfig: PostgreSQL 动态数据源 (JSONB 存储)
 *
 * 此类保留用于将来可能的 SmartBI 特定配置
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2026-01-25
 */
@Configuration
public class SmartBIJpaConfig {
    // JPA 扫描配置已移至 datasource 包
    // 此类保留用于将来的 SmartBI 特定配置
}
